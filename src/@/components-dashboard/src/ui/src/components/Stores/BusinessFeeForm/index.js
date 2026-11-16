import React, { useEffect, useId, useMemo, useRef, useState } from 'react'

import { useLanguage, useSession } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { NumberField, SaveBar, SegmentedControl, SelectField, Switch, TextField, useLeaveGuard, useSectionSplit } from '../../Shared/Product'
import '../BusinessFees/business-fees.css'

// redesign stores 5.13 (; S-2, S-3): the detail of one business fee, inside the P/SectionSplit of `S/BusinessFees` (which
// draws its title and the X / «‹ Back»). One form held until «Save» in the save bar (it counts and names what changed, Discard, the
// reason of a failed save, «Saved»), with the editor's leave guard; the same pattern as `S/CustomerFees/CustomerFeeDetail`. The payload is
// the one of `main` (same keys, «All …» is null), written through the controller with `{ inlineError: true }`: the reason of a failure
// is said in the save bar, not in a toast or an Alert.
// - Per order: delivery type, site and payment method (P/SelectField with its search, ), Fixed amount and Percentage. Recurrent: Period (Weekly | Monthly), the day (of the week, or of the month) and Fixed amount.
// - S-3: «Recurrent» does not erase what was written for the other kind. The draft keeps its per-order values (and its two days);
//   while the fee is recurrent the payload sends them as null / 0, as `main` did, and they come back when it is turned off.
// - The checks of `main` (a name, a fixed amount above 0 for a recurrent fee, a fixed amount or a percentage for a per-order one) are said
//   in the form after a save was tried; a percentage outside 0 to 100 is said under the field as it is typed.
// - In edit mode «Enabled» is part of the form (saved with it, as before) and follows the record when the list changes it. «Taxable» is
//   for level 0 only.

const FIELD_KEYS = [
  'name',
  'description',
  'recurrent',
  'recurring_period',
  'weekly_day',
  'monthly_day',
  'delivery_type',
  'site_id',
  'paymethod_id',
  'fixed',
  'percentage',
  'taxable',
  'enabled'
]
const PER_ORDER_KEYS = ['delivery_type', 'site_id', 'paymethod_id', 'percentage']
const RECURRING_KEYS = ['recurring_period', 'weekly_day', 'monthly_day']
const SAVED_NOTICE_MS = 4000
const WRITE_OPTIONS = { inlineError: true }

const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

// the options of the controller (`{ value, content }`) as the P/Select takes them
const toSelectOptions = (options) => (options || []).map(option => ({ value: option.value, label: option.content }))

const numberOrNull = (value) => (value != null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null)

export const EMPTY_FEE_FORM = Object.freeze({
  name: '',
  description: '',
  enabled: true,
  recurrent: false,
  recurring_period: 'weekly',
  weekly_day: 0,
  monthly_day: 1,
  delivery_type: 'all',
  site_id: 'all',
  paymethod_id: 'all',
  fixed: null,
  percentage: null,
  taxable: true
})

/** The form of a stored fee (or of a new one): numbers as numbers, «all» for no condition, one day for each period. */
export const feeToForm = (fee) => {
  if (!fee) return { ...EMPTY_FEE_FORM }
  const recurrent = !!fee.recurring_period
  const weekly = fee.recurring_period === 'weekly'
  const monthly = fee.recurring_period === 'monthly'
  return {
    name: fee.name ?? '',
    description: fee.description ?? '',
    enabled: !!fee.enabled,
    recurrent,
    recurring_period: recurrent ? fee.recurring_period : 'weekly',
    weekly_day: weekly ? (numberOrNull(fee.recurring_day) ?? 0) : 0,
    monthly_day: monthly ? (numberOrNull(fee.recurring_day) ?? 1) : 1,
    delivery_type: fee.delivery_type ?? 'all',
    site_id: fee.site_id ?? 'all',
    paymethod_id: fee.paymethod_id ?? 'all',
    fixed: numberOrNull(fee.fixed),
    percentage: numberOrNull(fee.percentage),
    taxable: typeof fee.taxable !== 'undefined' ? !!fee.taxable : true
  }
}

/** What the API gets: the payload of `main` (same keys; «all» is null; a recurrent fee sends the per-order values as null / 0). */
export const buildFeePayload = (form) => {
  const recurrent = !!form.recurrent
  const condition = (value) => (recurrent || value === 'all' ? null : value)
  return {
    name: String(form.name || '').trim(),
    description: String(form.description || '').trim(),
    enabled: !!form.enabled,
    fixed: form.fixed ?? 0,
    percentage: recurrent ? 0 : (form.percentage ?? 0),
    delivery_type: condition(form.delivery_type),
    site_id: condition(form.site_id),
    paymethod_id: condition(form.paymethod_id),
    recurring_period: recurrent ? form.recurring_period : null,
    recurring_day: recurrent ? (form.recurring_period === 'weekly' ? form.weekly_day : form.monthly_day) : null,
    taxable: typeof form.taxable !== 'undefined' ? !!form.taxable : true
  }
}

/** The fields that cannot be saved, by key: `name`, `fixed` (the amount of the fee) and `percentage`. */
export const validateFee = (form, t) => {
  const errors = {}
  const name = String(form.name || '').trim()
  if (!name) errors.name = t('NAME_IS_REQUIRED', 'Name is required')
  else if (name.length > 100) errors.name = t('NAME_MAX_100', 'Name max 100 chars')
  const fixed = form.fixed ?? 0
  const percentage = form.percentage ?? 0
  if (form.recurrent) {
    if (!(fixed > 0)) errors.fixed = t('RECURRING_FEE_REQUIRES_FIXED', 'Recurring fees require a fixed amount')
  } else {
    if (percentage < 0 || percentage > 100) errors.percentage = t('ENTER_PERCENTAGE_0_TO_100', 'Enter a percentage from 0 to 100.')
    if (!(fixed > 0) && !(percentage > 0)) errors.fixed = t('FEE_REQUIRES_AMOUNT', 'Fee requires a fixed amount or percentage')
  }
  return errors
}

const sameValue = (key, a, b) => {
  if (key === 'name' || key === 'description') return String(a[key] || '').trim() === String(b[key] || '').trim()
  return a[key] === b[key]
}

// What counts as a change: a value of the other kind is part of the draft but is not sent, so it is not a change either.
// The details of a period count only when the fee was recurrent already; turning «Recurrent» on is one change.
const isRelevant = (key, form, baseline) => {
  if (PER_ORDER_KEYS.includes(key)) return !form.recurrent
  if (RECURRING_KEYS.includes(key)) return form.recurrent && baseline.recurrent
  return true
}

/**
 * @param {object}   props
 * @param {object|null} props.fee               The stored fee, or null for a new one.
 * @param {Array}    props.deliveryTypeOptions  `[{ value, content }]`, «All delivery types» first.
 * @param {Array}    props.siteOptions          Same, «All sites» first.
 * @param {Array}    props.paymethodOptions     Same, «All payment methods» first.
 * @param {Function} props.createFee            `(payload, { inlineError }) => { error, result }`.
 * @param {Function} props.updateFee            `(id, payload, { inlineError }) => { error, result }`.
 * @param {Function} props.onSaved              `(record)`: an edit was saved; the record the API gave back.
 * @param {Function} props.onCreated            `(record)`: a new fee was created and the API gave it back with its id.
 * @param {Function} props.onClose              Close the detail.
 */
export const BusinessFeeDetail = ({
  fee,
  deliveryTypeOptions,
  siteOptions,
  paymethodOptions,
  createFee,
  updateFee,
  onSaved,
  onCreated,
  onClose
}) => {
  const [, t] = useLanguage()
  const [{ user } = {}] = useSession() || []
  const isNew = !fee
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  const baseline = feeToForm(fee)
  const [form, setForm] = useState(baseline)
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const hintId = useId()
  const searchTexts = {
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

  const weekDayOptions = useMemo(() => [
    { value: 0, content: t('SUNDAY', 'Sunday') },
    { value: 1, content: t('MONDAY', 'Monday') },
    { value: 2, content: t('TUESDAY', 'Tuesday') },
    { value: 3, content: t('WEDNESDAY', 'Wednesday') },
    { value: 4, content: t('THURSDAY', 'Thursday') },
    { value: 5, content: t('FRIDAY', 'Friday') },
    { value: 6, content: t('SATURDAY', 'Saturday') }
  ], [t])
  const monthDayOptions = useMemo(() => Array.from({ length: 31 }, (_, index) => ({ value: index + 1, content: String(index + 1) })), [])

  const labels = {
    name: t('NAME', 'Name'),
    description: t('DESCRIPTION', 'Description'),
    recurrent: t('RECURRENT_BUSINESS_FEE', 'Recurrent business fee'),
    recurring_period: t('RECURRING_PERIOD', 'Recurring period'),
    weekly_day: t('DAY_OF_WEEK', 'Day of week'),
    monthly_day: t('DAY_OF_MONTH', 'Day of month'),
    delivery_type: t('DELIVERY_TYPE', 'Delivery type'),
    site_id: t('SITE', 'Site'),
    paymethod_id: t('PAYMENT_METHOD', 'Payment method'),
    fixed: t('FIXED_AMOUNT', 'Fixed amount'),
    percentage: `${t('PERCENTAGE', 'Percentage')} (%)`,
    taxable: t('TAXABLE', 'Taxable'),
    enabled: t('ENABLED', 'Enabled')
  }

  const showTaxable = user?.level === 0
  const changedKeys = FIELD_KEYS.filter(key => (
    (key !== 'enabled' || !isNew) &&
    (key !== 'taxable' || showTaxable) &&
    isRelevant(key, form, baseline) &&
    !sameValue(key, form, baseline)
  ))
  const count = changedKeys.length
  const dirty = count > 0
  const withCount = (template, value) => template.replace('_count_', String(value))

  const errors = validateFee(form, t)
  const invalidCount = Object.keys(errors).length
  // the percentage says so as it is typed; the name and the amount only once a save was tried
  const shown = {
    name: attempted ? errors.name : undefined,
    fixed: attempted ? errors.fixed : undefined,
    percentage: errors.percentage
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

  const numberChange = (key) => (value) => hold({ [key]: numberOrNull(value) })
  const fixErrors = invalidCount === 1
    ? t('SETTINGS_FIX_FIELDS_ONE', 'Fix _count_ field to save.')
    : t('SETTINGS_FIX_FIELDS_OTHER', 'Fix _count_ fields to save.')
  const errorText = attempted && invalidCount > 0 ? withCount(fixErrors, invalidCount) : saveError
  const weekly = form.recurring_period === 'weekly'

  const fixedField = (
    <NumberField
      label={labels.fixed}
      value={form.fixed}
      onChange={numberChange('fixed')}
      min={0}
      placeholder='0.00'
      error={shown.fixed}
      disabled={saving}
    />
  )

  return (
    <form className='odc-bf-form' tabIndex={-1} noValidate onSubmit={handleSubmit}>
      <TextField
        label={labels.name}
        required
        requiredLabel={t('REQUIRED', 'Required')}
        value={form.name}
        onChange={(value) => { setAttempted(false); hold({ name: value }) }}
        error={shown.name}
        maxLength={100}
        autoComplete='off'
        disabled={saving}
      />
      <TextField
        label={labels.description}
        value={form.description}
        onChange={(value) => hold({ description: value })}
        maxLength={500}
        autoComplete='off'
        disabled={saving}
      />
      <div className='odc-bf-switch'>
        <Switch
          checked={form.recurrent}
          onCheckedChange={(next) => hold({ recurrent: next })}
          aria-describedby={hintId}
          disabled={saving}
        >
          {labels.recurrent}
        </Switch>
        <p id={hintId} className='odc-bf-hint'>
          {t('RECURRENT_BUSINESS_FEE_HINT', "Charged every week or month with a fixed amount. Delivery type, site, payment method and percentage don't apply.")}
        </p>
      </div>
      {showTaxable && (
        <Switch checked={form.taxable} onCheckedChange={(next) => hold({ taxable: next })} disabled={saving}>
          {labels.taxable}
        </Switch>
      )}
      {!form.recurrent && (
        <>
          <div className='odc-bf-pair' key={`conditions-${resetKey}`}>
            <SelectField
              label={labels.delivery_type}
              placeholder={t('SELECT_DELIVERY_TYPE', 'Select delivery type')}
              options={toSelectOptions(deliveryTypeOptions)}
              value={form.delivery_type ?? 'all'}
              onValueChange={(value) => hold({ delivery_type: value })}
              disabled={saving}
              searchable
              searchLabel={searchTexts.searchLabel}
              clearSearchLabel={searchTexts.clearSearchLabel}
              noResultsLabel={searchTexts.noResultsLabel}
            />
            <SelectField
              label={labels.site_id}
              placeholder={t('SELECT_SITE', 'Select site')}
              options={toSelectOptions(siteOptions)}
              value={form.site_id ?? 'all'}
              onValueChange={(value) => hold({ site_id: value })}
              disabled={saving}
              searchable
              searchLabel={searchTexts.searchLabel}
              clearSearchLabel={searchTexts.clearSearchLabel}
              noResultsLabel={searchTexts.noResultsLabel}
            />
          </div>
          <div key={`paymethod-${resetKey}`}>
            <SelectField
              label={labels.paymethod_id}
              placeholder={t('SELECT_PAYMENT_METHOD', 'Select payment method')}
              options={toSelectOptions(paymethodOptions)}
              value={form.paymethod_id ?? 'all'}
              onValueChange={(value) => hold({ paymethod_id: value })}
              disabled={saving}
              searchable
              searchLabel={searchTexts.searchLabel}
              clearSearchLabel={searchTexts.clearSearchLabel}
              noResultsLabel={searchTexts.noResultsLabel}
            />
          </div>
          <div className='odc-bf-pair'>
            {fixedField}
            <NumberField
              label={labels.percentage}
              value={form.percentage}
              onChange={numberChange('percentage')}
              placeholder='0'
              error={shown.percentage}
              disabled={saving}
            />
          </div>
        </>
      )}
      {form.recurrent && (
        <>
          <div className='odc-bf-period'>
            <span className='odc-bf-label' aria-hidden='true'>{labels.recurring_period}</span>
            <SegmentedControl
              label={labels.recurring_period}
              value={form.recurring_period}
              onValueChange={(next) => hold({ recurring_period: next })}
              options={[
                { value: 'weekly', label: t('WEEKLY', 'Weekly') },
                { value: 'monthly', label: t('MONTHLY', 'Monthly') }
              ]}
            />
          </div>
          <div key={`${form.recurring_period}-${resetKey}`}>
            {weekly
              ? (
                <SelectField
                  label={labels.weekly_day}
                  placeholder={t('SELECT_DAY', 'Select day')}
                  options={toSelectOptions(weekDayOptions)}
                  value={form.weekly_day ?? 'all'}
                  onValueChange={(value) => hold({ weekly_day: Number(value) })}
                  disabled={saving}
                />
                )
              : (
                <SelectField
                  label={labels.monthly_day}
                  placeholder={t('SELECT_DAY', 'Select day')}
                  options={toSelectOptions(monthDayOptions)}
                  value={form.monthly_day ?? 'all'}
                  onValueChange={(value) => hold({ monthly_day: Number(value) })}
                  disabled={saving}
                  searchable
                  searchLabel={searchTexts.searchLabel}
                  clearSearchLabel={searchTexts.clearSearchLabel}
                  noResultsLabel={searchTexts.noResultsLabel}
                />
                )}
          </div>
          {fixedField}
        </>
      )}
      {!isNew && (
        <Switch checked={form.enabled} onCheckedChange={(next) => hold({ enabled: next })} disabled={saving}>
          {labels.enabled}
        </Switch>
      )}
      <SaveBar
        className='odc-bf-savebar'
        formSelector='.odc-bf-form'
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
    </form>
  )
}

// `S/index.js` still re-exports the old name
export const BusinessFeeForm = BusinessFeeDetail
