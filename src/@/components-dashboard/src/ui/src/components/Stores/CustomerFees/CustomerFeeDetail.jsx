import React, { useEffect, useId, useRef, useState } from 'react'

import { useConfig, useLanguage } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { getDateTimeFormats } from '../../../../../utils/settingsCustomSections'
import { RecipientSelect } from '../../Shared'
import { DatePicker, Field, NumberField, SaveBar, SelectField, Status, Switch, TextField, useLeaveGuard, useSectionSplit } from '../../Shared/Product'
import './customer-fees.css'

// redesign stores 5.12: the detail of one customer fee, inside the P/SectionSplit of `S/CustomerFees` (which draws its
// title and the X / «‹ Back»). One form held until «Save» in the save bar (it counts and names what changed, Discard, the reason of a
// failed save, «Saved»), with the editor's leave guard. The payload is the one of `main` (same keys, «All …» is null), written through
// the controller with `{ inlineError: true }`: the reason of a failure is said in the save bar, not in a toast or an Alert.
// - Name, Description, Fixed amount, Percentage and Fixed minimum are P/ fields; the three conditions are P/SelectField (search
//   included, ); the recipient is RecipientSelect (a P/SelectField too since ), as before (level 0 only).
// - «Limit by date range» reveals a start and an end day (P/DatePicker, 'YYYY-MM-DD' as before); an end before the start is said
//   under the end date and blocks the save. A percentage outside 0 to 100 is said under the field and blocks the save.
// - In edit mode «Enabled» is part of the form (saved with it, as before).
// - without `canManage` the API refuses `PUT /fees/{id}`, so a stored fee opens to read (disabled fields, its status in
//   words, no save bar). A new fee stays editable (`POST /fees` is allowed), and both say who can change it afterwards.

const FIELD_KEYS = ['name', 'description', 'fixed', 'percentage', 'fixed_minimum', 'delivery_type', 'paymethod_id', 'site_id', 'recipient', 'dates', 'enabled']
const SAVED_NOTICE_MS = 4000
const WRITE_OPTIONS = { inlineError: true }

const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

// the options of the controller (`{ value, content }`) as the P/Select takes them
const toSelectOptions = (options) => (options || []).map(option => ({ value: option.value, label: option.content }))

const numberOrNull = (value) => (value != null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null)
const dayOf = (stamp) => (stamp ? String(stamp).split(' ')[0] : '')

export const EMPTY_FEE_FORM = Object.freeze({
  name: '',
  description: '',
  enabled: true,
  fixed: null,
  percentage: null,
  fixed_minimum: null,
  delivery_type: 'all',
  site_id: 'all',
  paymethod_id: 'all',
  recipient: 'business',
  start_date: '',
  end_date: ''
})

/** The form of a stored fee (or of a new one): numbers as numbers, days as `YYYY-MM-DD`, «all» for no condition. */
export const feeToForm = (fee) => {
  if (!fee) return { ...EMPTY_FEE_FORM }
  return {
    name: fee.name ?? '',
    description: fee.description ?? '',
    enabled: !!fee.enabled,
    fixed: numberOrNull(fee.fixed),
    percentage: numberOrNull(fee.percentage),
    fixed_minimum: numberOrNull(fee.fixed_minimum),
    delivery_type: fee.delivery_type ?? 'all',
    site_id: fee.site_id ?? 'all',
    paymethod_id: fee.paymethod_id ?? 'all',
    recipient: fee.recipient ?? 'business',
    start_date: dayOf(fee.start_date),
    end_date: dayOf(fee.end_date)
  }
}

/** What the API gets: the payload of `main` (same keys; «all» is null, an empty amount is 0, an empty minimum is null). */
export const buildFeePayload = (form) => ({
  name: String(form.name || '').trim(),
  description: String(form.description || '').trim(),
  enabled: !!form.enabled,
  fixed: form.fixed ?? 0,
  percentage: form.percentage ?? 0,
  fixed_minimum: form.fixed_minimum,
  delivery_type: form.delivery_type === 'all' ? null : form.delivery_type,
  site_id: form.site_id === 'all' ? null : form.site_id,
  paymethod_id: form.paymethod_id === 'all' ? null : form.paymethod_id,
  recipient: form.recipient || 'business',
  start_date: form.start_date || null,
  end_date: form.end_date || null
})

/** The fields that cannot be saved, by key: `name`, `percentage`, `end_date`. */
export const validateFee = (form, t) => {
  const errors = {}
  const name = String(form.name || '').trim()
  if (!name) errors.name = t('NAME_IS_REQUIRED', 'Name is required')
  else if (name.length > 255) errors.name = t('NAME_MAX_255', 'Name max 255 chars')
  if (form.percentage != null && (form.percentage < 0 || form.percentage > 100)) {
    errors.percentage = t('ENTER_PERCENTAGE_0_TO_100', 'Enter a percentage from 0 to 100.')
  }
  if (form.start_date && form.end_date && form.end_date < form.start_date) {
    errors.end_date = t('CUSTOMER_FEE_END_BEFORE_START', 'The end date must be on or after the start date.')
  }
  return errors
}

const sameValue = (key, a, b) => {
  if (key === 'dates') return a.start_date === b.start_date && a.end_date === b.end_date
  if (key === 'name' || key === 'description') return String(a[key] || '').trim() === String(b[key] || '').trim()
  return a[key] === b[key]
}

const pickerLabels = (t) => ({
  title: t('SELECT_DATE', 'Select a date'),
  close: t('CLOSE', 'Close'),
  today: t('TODAY', 'Today'),
  goToToday: t('DATE_RANGE_GO_TO_TODAY', 'Go to today'),
  previousMonth: t('PREVIOUS_MONTH', 'Previous month'),
  nextMonth: t('NEXT_MONTH', 'Next month'),
  invalidDate: (format) => t('DATE_RANGE_INVALID', 'Enter a real date as _format_.').replace('_format_', () => format),
  outOfRange: t('CAMPAIGNS_DATE_UNAVAILABLE', 'That date is not available.')
})

/**
 * @param {object}   props
 * @param {object|null} props.fee               The stored fee, or null for a new one.
 * @param {Array}    props.deliveryTypeOptions  `[{ value, content }]`, «All delivery types» first.
 * @param {Array}    props.siteOptions          Same, «All sites» first.
 * @param {Array}    props.paymethodOptions     Same, «All payment methods» first.
 * @param {Function} props.createFee            `(payload, { inlineError }) => { error, result }`.
 * @param {Function} props.updateFee            `(id, payload, { inlineError }) => { error, result }`.
 * @param {boolean}  props.canManage            The user can change a stored fee (level 0).
 * @param {string}   props.adminOnlyNote        What the form says when the user cannot.
 * @param {Function} props.onSaved              `(record)`: an edit was saved; the record the API gave back.
 * @param {Function} props.onCreated            `(record)`: a new fee was created and the API gave it back with its id.
 * @param {Function} props.onClose              Close the detail.
 */
export const CustomerFeeDetail = ({
  fee,
  deliveryTypeOptions,
  siteOptions,
  paymethodOptions,
  createFee,
  updateFee,
  canManage,
  adminOnlyNote,
  onSaved,
  onCreated,
  onClose
}) => {
  const [languageState, t] = useLanguage()
  const [{ configs } = {}] = useConfig() || []
  const isNew = !fee
  const readOnly = !isNew && !canManage
  const dateFormat = getDateTimeFormats(configs?.dates_general_format?.value).dateFormat
  const locale = languageState?.language?.code
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  const baseline = feeToForm(fee)
  const [form, setForm] = useState(baseline)
  const [limitDates, setLimitDates] = useState(!!(baseline.start_date || baseline.end_date))
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const hintId = useId()
  const searchProps = {
    searchable: true,
    searchLabel: t('SEARCH', 'Search'),
    clearSearchLabel: t('CLEAR_SEARCH', 'Clear search'),
    noResultsLabel: t('NO_RESULTS_FOUND', 'No results found')
  }

  // «Enabled» saved from the list while this detail is open: the record is the truth, so the form follows it
  const storedEnabled = fee ? !!fee.enabled : null
  const lastEnabled = useRef(storedEnabled)
  useEffect(() => {
    if (storedEnabled === null || lastEnabled.current === storedEnabled) return
    lastEnabled.current = storedEnabled
    setForm(current => ({ ...current, enabled: storedEnabled }))
  }, [storedEnabled])

  const labels = {
    name: t('NAME', 'Name'),
    description: t('DESCRIPTION', 'Description'),
    fixed: t('FIXED_AMOUNT', 'Fixed amount'),
    percentage: t('CUSTOMER_FEE_PERCENTAGE_LABEL', 'Percentage (%)'),
    fixed_minimum: t('FIXED_MINIMUM', 'Fixed minimum'),
    delivery_type: t('DELIVERY_TYPE', 'Delivery type'),
    paymethod_id: t('PAYMENT_METHOD', 'Payment method'),
    site_id: `${t('SITE', 'Site')} (${t('PLATFORM', 'Platform')})`,
    recipient: t('RECIPIENT', 'Recipient'),
    dates: t('LIMIT_BY_DATE', 'Limit by date range'),
    enabled: t('ENABLED', 'Enabled')
  }
  const changedKeys = FIELD_KEYS.filter(key => (key !== 'enabled' || !isNew) && !sameValue(key, form, baseline))
  const count = changedKeys.length
  const dirty = count > 0
  const withCount = (template, value) => template.replace('_count_', String(value))

  const errors = validateFee(form, t)
  const invalidCount = Object.keys(errors).length
  // the percentage and the dates say so as they are typed; the name only once a save was tried
  const shown = {
    name: attempted ? errors.name : undefined,
    percentage: errors.percentage,
    end_date: errors.end_date
  }

  const hold = (patch) => {
    setSaved(false)
    setSaveError(null)
    setForm(current => ({ ...current, ...patch }))
  }

  const save = async () => {
    if (saving) return { ok: false }
    if (invalidCount > 0) {
      setAttempted(true)
      return { ok: false }
    }
    setSaved(false)
    setSaveError(null)
    setSaving(true)
    const payload = buildFeePayload(form)
    let result
    try {
      result = isNew ? await createFee?.(payload, WRITE_OPTIONS) : await updateFee?.(fee.id, payload, WRITE_OPTIONS)
    } catch (error) {
      result = { error: true, result: [error?.message] }
    }
    if (!mounted.current) return { ok: !result?.error && result != null }
    setSaving(false)
    if (!result || result.error) {
      setSaveError(translateApiMessage(t, firstMessage(result?.result), t('FEE_SAVE_FAILED', 'The fee could not be saved.')))
      return { ok: false }
    }
    setSaved(true)
    const record = result?.result
    if (!isNew) {
      if (record && typeof record === 'object') onSaved?.(record)
    } else if (record?.id != null) {
      onCreated?.(record)
    } else {
      onClose?.()
    }
    return { ok: true }
  }

  const discard = () => {
    setForm(feeToForm(fee))
    setLimitDates(!!(baseline.start_date || baseline.end_date))
    setAttempted(false)
    setSaveError(null)
    setSaved(false)
    setResetKey(key => key + 1)
  }

  useLeaveGuard({
    dirty,
    count,
    save,
    discard,
    registerCloseGuard: useSectionSplit().registerCloseGuard
  })

  useEffect(() => {
    if (!saved) return undefined
    const timer = setTimeout(() => setSaved(false), SAVED_NOTICE_MS)
    return () => clearTimeout(timer)
  }, [saved])

  const handleSubmit = (event) => {
    event.preventDefault()
    if (dirty) save()
  }

  const toggleLimit = (next) => {
    setLimitDates(next)
    if (!next) hold({ start_date: '', end_date: '' })
  }

  const numberChange = (key) => (value) => hold({ [key]: numberOrNull(value) })
  const fixErrors = invalidCount === 1
    ? t('SETTINGS_FIX_FIELDS_ONE', 'Fix _count_ field to save.')
    : t('SETTINGS_FIX_FIELDS_OTHER', 'Fix _count_ fields to save.')
  const errorText = attempted && invalidCount > 0 ? withCount(fixErrors, invalidCount) : saveError

  return (
    <form className='odc-cf-form' tabIndex={-1} noValidate onSubmit={handleSubmit}>
      {!canManage && <p className='odc-cf-hint'>{adminOnlyNote}</p>}
      <TextField
        label={labels.name}
        required
        requiredLabel={t('REQUIRED', 'Required')}
        value={form.name}
        onChange={(value) => { setAttempted(false); hold({ name: value }) }}
        error={shown.name}
        maxLength={255}
        autoComplete='off'
        disabled={saving || readOnly}
      />
      <TextField
        label={labels.description}
        value={form.description}
        onChange={(value) => hold({ description: value })}
        maxLength={500}
        autoComplete='off'
        disabled={saving || readOnly}
      />
      <div className='odc-cf-pair'>
        <NumberField
          label={labels.fixed}
          value={form.fixed}
          onChange={numberChange('fixed')}
          min={0}
          placeholder='0.00'
          disabled={saving || readOnly}
        />
        <NumberField
          label={labels.percentage}
          value={form.percentage}
          onChange={numberChange('percentage')}
          placeholder='0'
          error={shown.percentage}
          disabled={saving || readOnly}
        />
      </div>
      <NumberField
        label={labels.fixed_minimum}
        value={form.fixed_minimum}
        onChange={numberChange('fixed_minimum')}
        min={0}
        placeholder={t('OPTIONAL', 'Optional')}
        hint={t('FIXED_MINIMUM_DESCRIPTION', 'Minimum amount charged to the customer. If the calculated fee (fixed + percentage) is less than this value, this minimum will be applied instead.')}
        disabled={saving || readOnly}
      />
      <div className='odc-cf-pair' key={`conditions-${resetKey}`}>
        <SelectField
          label={labels.delivery_type}
          placeholder={t('SELECT_DELIVERY_TYPE', 'Select delivery type')}
          options={toSelectOptions(deliveryTypeOptions)}
          value={form.delivery_type ?? 'all'}
          onValueChange={(value) => hold({ delivery_type: value })}
          {...searchProps}
          disabled={readOnly}
        />
        <SelectField
          label={labels.paymethod_id}
          placeholder={t('SELECT_PAYMENT_METHOD', 'Select payment method')}
          options={toSelectOptions(paymethodOptions)}
          value={form.paymethod_id ?? 'all'}
          onValueChange={(value) => hold({ paymethod_id: value })}
          {...searchProps}
          disabled={readOnly}
        />
      </div>
      <div key={`site-${resetKey}`}>
        <SelectField
          label={labels.site_id}
          placeholder={t('SELECT_SITE', 'Select site')}
          options={toSelectOptions(siteOptions)}
          value={form.site_id ?? 'all'}
          onValueChange={(value) => hold({ site_id: value })}
          {...searchProps}
          disabled={readOnly}
        />
      </div>
      <div key={`recipient-${resetKey}`}>
        <RecipientSelect value={form.recipient ?? 'business'} onChange={(value) => hold({ recipient: value })} disabled={readOnly} />
      </div>
      <div className='odc-cf-limit'>
        <Switch checked={limitDates} onCheckedChange={toggleLimit} aria-describedby={hintId} disabled={saving || readOnly}>
          {labels.dates}
        </Switch>
        <p id={hintId} className='odc-cf-hint'>
          {t('LIMIT_BY_DATE_HINT', 'Without a date range, this fee applies indefinitely.')}
        </p>
      </div>
      {limitDates && (
        <div className='odc-cf-pair'>
          <Field label={t('START_DATE', 'Start date')}>
            <DatePicker
              label={t('START_DATE', 'Start date')}
              labels={{ ...pickerLabels(t), clear: t('CLEAR', 'Clear') }} // review P3: emptied alone, as main's date input
              dateFormat={dateFormat}
              locale={locale}
              value={form.start_date || null}
              disabled={saving || readOnly}
              onChange={(day) => hold({ start_date: day || '' })}
            />
          </Field>
          <Field label={t('END_DATE', 'End date')} error={shown.end_date}>
            <DatePicker
              label={t('END_DATE', 'End date')}
              labels={{ ...pickerLabels(t), clear: t('CLEAR', 'Clear') }}
              dateFormat={dateFormat}
              locale={locale}
              value={form.end_date || null}
              disabled={saving || readOnly}
              onChange={(day) => hold({ end_date: day || '' })}
            />
          </Field>
        </div>
      )}
      {!isNew && !readOnly && (
        <Switch checked={form.enabled} onCheckedChange={(next) => hold({ enabled: next })} disabled={saving}>
          {labels.enabled}
        </Switch>
      )}
      {readOnly && <Status family={form.enabled ? 'done' : 'cancel'} label={form.enabled ? t('ACTIVE', 'Active') : t('INACTIVE', 'Inactive')} />}
      {!readOnly && (
        <SaveBar
          className='odc-cf-savebar'
          formSelector='.odc-cf-form'
          label={t('SAVE_CHANGES', 'Save changes')}
          count={count}
          countText={withCount(count === 1
            ? t('SETTINGS_UNSAVED_CHANGES_ONE', '_count_ unsaved change')
            : t('SETTINGS_UNSAVED_CHANGES_OTHER', '_count_ unsaved changes'), count)}
          names={changedKeys.map(key => labels[key])}
          moreText={(n) => withCount(t('SETTINGS_UNSAVED_MORE', '+_count_'), n)}
          saving={saving}
          errorText={errorText}
          onRetry={saveError && !(attempted && invalidCount > 0) && dirty ? () => save() : undefined}
          retryLabel={t('TRY_AGAIN', 'Try again')}
          saved={saved}
          savedText={t('SAVED', 'Saved')}
          discardLabel={t('DISCARD', 'Discard')}
          saveLabel={isNew ? t('ADD_FEE', 'Add fee') : t('SAVE_CHANGES', 'Save changes')}
          saveType='submit'
          onDiscard={discard}
        />
      )}
    </form>
  )
}
