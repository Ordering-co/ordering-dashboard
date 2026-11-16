import React, { useEffect, useMemo, useRef, useState } from 'react'

import { BusinessPromotionForm as BusinessPromotionFormController, useConfig, useLanguage } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { getDateTimeFormats } from '../../../../../utils/settingsCustomSections'
import { describeDateFormat, formatDay } from '../../../../../utils/dateRange'
import {
  AsyncSwitch,
  Button,
  Checkbox,
  DateRangePopover,
  Field,
  NumberField,
  RadioGroup,
  SaveBar,
  SegmentedControl,
  SelectField,
  Switch,
  TextArea,
  TextField,
  useLeaveGuard,
  useSectionSplit
} from '../../Shared/Product'
import { ImageField } from '../../Shared/Product/ImageField'
import { RecipientSelect } from '../../Shared'
import { Calendar } from '../../Shared/Icon'
import { bytesConverter } from '../../../utils'
import {
  RATE_FIXED,
  RATE_PERCENTAGE,
  TYPE_COUPON,
  TYPE_DISCOUNT,
  applyDateRange,
  buildPromotionBody,
  changedKeys,
  dayOfStamp,
  promotionToForm,
  validatePromotion
} from './promotionForm'
import './business-promotion-form.css'

// redesign stores 5.14 (E3; S-5, S-7…S-11): the General tab of a promotion on Product, inside the P/SectionSplit of the
// list (which draws the title, the tabs and the X / «‹ Back»). One form held until «Save» in the save bar (it counts and names what
// changed, Discard, the reason of a failed save, «Saved»), with the editor's leave guard, as the markups (5.13). «Enabled» is not part
// of the form: in edit mode a P/AsyncSwitch above it saves at once (`onToggleEnabled`, the same as the row of the list) and goes back
// when that fails.
// - The controller (BusinessPromotionForm) hands the UI `createPromotion(body, { inlineError: true })` and
//   `updatePromotion(body, { inlineError: true })`, each answering `{ ok: true, result }` | `{ ok: false, error }`: the reason of a
//   failure is said in the save bar, not in a toast or an Alert. Creating no longer closes the form: `onCreated(record)` lets the list
//   open the detail of the new promotion.
// - The rules and the request live in promotionForm.js: an edit sends only what changed (dates not touched are not sent, so a stored
//   17:34 survives), a new promotion sends its defaults plus what was written.

const SAVED_NOTICE_MS = 4000
const MAX_IMAGE_KB = 2048
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg']
const WRITE_OPTIONS = { inlineError: true }
const NO_EDITS = Object.freeze({})
const PERCENT_FORMAT = { style: 'unit', unit: 'percent', maximumFractionDigits: 2 }
const AMOUNT_FORMAT = { maximumFractionDigits: 2 }

const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

const withCount = (template, value) => template.replace('_count_', String(value))

/** The words of the date popover (P/DateRangePopover): the project's own, no presets. */
const rangeLabels = (t) => ({
  title: t('DATES_RANGE', 'Date range'),
  close: t('CLOSE', 'Close'),
  presets: t('DATES_RANGE', 'Date range'),
  done: t('DONE', 'Done'),
  from: t('FROM', 'From'),
  to: t('TO', 'To'),
  today: t('TODAY', 'Today'),
  goToToday: t('DATE_RANGE_GO_TO_TODAY', 'Go to today'),
  previousMonth: t('PREVIOUS_MONTH', 'Previous month'),
  nextMonth: t('NEXT_MONTH', 'Next month'),
  invalidDate: (format) => t('DATE_RANGE_INVALID', 'Enter a real date as _format_.').replace('_format_', () => format),
  outOfRange: t('CAMPAIGNS_DATE_UNAVAILABLE', 'That date is not available.'),
  rangeOrder: t('DATE_RANGE_ORDER', 'The start date must not be after the end date.')
})

/**
 * @param {object}   props
 * @param {object}   props.promotionState      `{ promotion }`: the stored promotion, `{}` for a new one (from the controller).
 * @param {Function} props.createPromotion     `(body, { inlineError }) => { ok, result } | { ok: false, error }`.
 * @param {Function} props.updatePromotion     Same, for an existing promotion.
 * @param {Function} props.onToggleEnabled     `(promotion, next) => Promise<{ ok, error? }>`: the switch of the list's rows too.
 * @param {Function} props.onCreated           `(record)`: a new promotion was created; the record the API gave back.
 * @param {Function} props.onSaved             `(record)`: an edit was saved.
 * @param {Function} props.onClose             Close the detail.
 */
export const BusinessPromotionGeneralFormUI = (props) => {
  const {
    promotionState,
    createPromotion,
    updatePromotion,
    onToggleEnabled,
    onCreated,
    onSaved,
    onClose
  } = props

  const [languageState, t] = useLanguage()
  const [{ configs } = {}] = useConfig() || []
  const advanced = !!configs?.advanced_offers_module?.value
  const locale = languageState?.language?.code
  const dateFormat = getDateTimeFormats(configs?.dates_general_format?.value).dateFormat
  const dateSpec = useMemo(() => describeDateFormat(dateFormat, locale), [dateFormat, locale])

  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])
  const formRef = useRef(null)

  // The record this detail is about. A promotion that was just created is the record from then on, even if the host has not handed it
  // back yet: a second «Create» would make a duplicate.
  const fromHost = promotionState?.promotion || props.promotion || {}
  const [created, setCreated] = useState(null)
  const record = fromHost?.id ? fromHost : (created || fromHost)
  const isNew = !record?.id

  // `baseline` is what is stored; `edits` is what the user changed on top of it. A save that the host has not echoed yet keeps its own
  // baseline (`saved`) until the stored record changes.
  const stored = promotionToForm(record, { advanced })
  const storedSig = JSON.stringify(stored)
  const [saved, setSavedBaseline] = useState(null)
  const baseline = saved && saved.sig === storedSig ? saved.form : stored
  const [edits, setEdits] = useState(NO_EDITS)
  const form = { ...baseline, ...edits }
  const setField = (patch) => setEdits(current => ({ ...current, ...patch }))

  const [attempted, setAttempted] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [savedNotice, setSavedNotice] = useState(false)
  const [imageError, setImageError] = useState(null)
  const [resetKey, setResetKey] = useState(0)

  const labels = {
    image: t('IMAGE', 'Image'),
    name: t('NAME', 'Name'),
    description: t('DESCRIPTION', 'Description'),
    dates: t('DATES_RANGE', 'Date range'),
    type: t('STORES_PROMOTION_APPLIED', 'How it\'s applied'),
    coupon: t('COUPON_CODE', 'Coupon code'),
    public: t('SHOW_IN_CART', 'Show in cart'),
    auto: t('AUTOMATIC_DISCOUNT', 'Automatic discount'),
    target: t('APPLIES_TO', 'Applies to'),
    rate_type: t('DISCOUNT_TYPE', 'Discount type'),
    rate: t('VALUE', 'Value'),
    minimum: t('MINIMUN_PURCHASED', 'Minimum purchase'),
    limit: t('LIMIT', 'Limit'),
    stackable: t('STORES_PROMOTION_COMBINE', 'Combine with others'),
    sponsor: t('SPONSOR', 'Sponsor')
  }

  const changed = changedKeys(form, baseline)
  const count = changed.length
  const dirty = count > 0

  const errors = validatePromotion(form, t, isNew ? undefined : baseline)
  const invalidCount = Object.keys(errors).length
  const showErrors = attempted > 0
  const shown = (key) => (showErrors ? errors[key] : undefined)

  // a changed field clears the old reason of a failed save and the «Saved» notice
  const lastEdits = useRef(edits)
  useEffect(() => {
    if (lastEdits.current === edits) return
    lastEdits.current = edits
    setSavedNotice(false)
    setSaveError(null)
  }, [edits])

  // a blocked save puts the focus on the first wrong field
  useEffect(() => {
    if (attempted === 0 || invalidCount === 0) return
    formRef.current?.querySelector('[aria-invalid="true"]')?.focus()
    // only a new attempt moves the focus, not every keystroke afterwards
  }, [attempted])

  const save = async () => {
    if (saving) return { ok: false }
    if (invalidCount > 0) {
      setAttempted(n => n + 1)
      return { ok: false }
    }
    setSavedNotice(false)
    setSaveError(null)
    setSaving(true)
    const body = buildPromotionBody(form, baseline, { isNew, advanced })
    let answer
    try {
      answer = isNew ? await createPromotion?.(body, WRITE_OPTIONS) : await updatePromotion?.(body, WRITE_OPTIONS)
    } catch (error) {
      answer = { ok: false, error: [error?.message] }
    }
    if (!mounted.current) return { ok: !!answer?.ok }
    setSaving(false)
    if (!answer?.ok) {
      setSaveError(translateApiMessage(t, firstMessage(answer?.error), t('PROMOTION_SAVE_FAILED_TITLE', 'We couldn\'t save the promotion')))
      return { ok: false }
    }
    const result = answer.result
    setSavedNotice(true)
    setAttempted(0)
    // the edits are folded into the baseline: that is not a field changing, so the «Saved» notice stays
    lastEdits.current = NO_EDITS
    setEdits(NO_EDITS)
    setImageError(null)
    if (result && typeof result === 'object') {
      setSavedBaseline({ sig: storedSig, form: promotionToForm(result, { advanced }) })
    } else {
      setSavedBaseline({ sig: storedSig, form })
    }
    if (isNew) {
      if (result?.id != null) {
        setCreated(result)
        onCreated?.(result)
      } else {
        onClose?.()
      }
    } else if (result && typeof result === 'object') {
      onSaved?.(result)
    }
    return { ok: true }
  }

  const discard = () => {
    setEdits(NO_EDITS)
    setAttempted(0)
    setSaveError(null)
    setSavedNotice(false)
    setImageError(null)
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
    if (!savedNotice) return undefined
    const timer = setTimeout(() => setSavedNotice(false), SAVED_NOTICE_MS)
    return () => clearTimeout(timer)
  }, [savedNotice])

  const handleSubmit = (event) => {
    event.preventDefault()
    if (dirty) save()
  }

  // the rules of the file of `main`: png / jpeg / jpg, up to 2 MB; the reason is said under the field
  const validateImage = (file) => {
    let message = null
    if (!IMAGE_TYPES.includes(file?.type)) message = t('ERROR_ONLY_IMAGES', 'Only images can be accepted')
    else if (bytesConverter(file.size) > MAX_IMAGE_KB) message = t('IMAGE_MAXIMUM_SIZE', 'The maximum image size is 2 megabytes')
    setImageError(message)
    return message == null
  }

  const startDay = dayOfStamp(form.start)
  const endDay = dayOfStamp(form.end)
  const showDay = (day) => formatDay(day, dateSpec)
  const rangeText = startDay && endDay
    ? `${showDay(startDay)} – ${showDay(endDay)}`
    : t('CAMPAIGNS_RULE_PICK_RANGE', 'Select dates')

  const targetOptions = [
    { value: 1, label: t('MOBILE_FRONT_SUB_TOTAL', 'Subtotal') },
    { value: 2, label: t('DELIVERY_FEE', 'Delivery fee') },
    { value: 3, label: t('BUSINESS_SERVICE_FEE', 'Service fee') }
  ]
  const appliedOptions = [
    {
      value: String(TYPE_COUPON),
      label: t('COUPON', 'Coupon'),
      description: t('STORES_PROMOTION_COUPON_HINT', 'Customers enter a code at checkout.')
    },
    {
      value: String(TYPE_DISCOUNT),
      label: t('DISCOUNT', 'Discount'),
      description: t('STORES_PROMOTION_DISCOUNT_HINT', 'Applied to the order without a code.')
    }
  ]
  const rateTypeOptions = [
    { value: String(RATE_PERCENTAGE), label: t('PERCENTAGE', 'Percentage') },
    { value: String(RATE_FIXED), label: t('FIXED_AMOUNT', 'Fixed amount') }
  ]

  const required = t('REQUIRED', 'Required')
  const isCoupon = form.type === TYPE_COUPON
  const isPercentage = form.rate_type === RATE_PERCENTAGE

  const fixErrors = invalidCount === 1
    ? t('SETTINGS_FIX_FIELDS_ONE', 'Fix _count_ field to save.')
    : t('SETTINGS_FIX_FIELDS_OTHER', 'Fix _count_ fields to save.')
  const blocked = showErrors && invalidCount > 0
  const errorText = blocked ? withCount(fixErrors, invalidCount) : saveError

  return (
    <form ref={formRef} className='odc-root odc-bp-form' tabIndex={-1} noValidate onSubmit={handleSubmit}>
      {!isNew && (
        <div className='odc-bp-enabled'>
          <AsyncSwitch
            checked={!!record.enabled}
            failureText={t('PROMOTION_TOGGLE_FAILED', 'We couldn\'t change this promotion. Try again.')}
            onToggle={(next) => onToggleEnabled?.(record, next)}
          >
            {t('ENABLED', 'Enabled')}
          </AsyncSwitch>
        </div>
      )}

      <ImageField
        className='odc-bp-image'
        label={labels.image}
        hint={t('STORE_IMAGE_HINT', 'PNG or JPG, up to 2 MB. Drag an image here or choose one.')}
        crop={false}
        droppable
        tooManyFilesText={t('IMAGE_ONE_AT_A_TIME', 'Drop one image at a time.')}
        changeLabel={t('STORES_PROMOTION_IMAGE_CHANGE', 'Change promotion image')}
        changeText={t('CHANGE', 'Change')}
        value={form.image}
        validateFile={validateImage}
        error={imageError}
        onChange={(image) => { setImageError(null); setField({ image }) }}
      />

      <TextField
        label={labels.name}
        name='name'
        required
        requiredLabel={required}
        autoComplete='off'
        dir='auto'
        value={form.name}
        error={shown('name')}
        onChange={(name) => setField({ name })}
      />

      <TextArea
        label={labels.description}
        name='description'
        rows={3}
        dir='auto'
        value={form.description}
        onChange={(description) => setField({ description })}
      />

      <Field label={labels.dates} required requiredLabel={required} error={shown('dates')}>
        <DateRangePopover
          presets={[]}
          presetValue=''
          from={startDay}
          to={endDay}
          dateFormat={dateFormat}
          triggerText=''
          empty={!startDay}
          labels={rangeLabels(t)}
          locale={locale}
          align='start'
          onPreset={() => {}}
          onRange={() => {}}
          // a range is a draft until «Done»: the popover never reports it piece by piece (S-9)
          onApplyRange={(range) => {
            const next = applyDateRange(form, baseline, range)
            setField({ start: next.start, end: next.end })
          }}
          renderTrigger={({ ref, expanded, toggle }) => (
            // the field's label would be the whole name of this button and hide the dates: the name carries both
            <Button
              ref={ref}
              className='odc-bp-date'
              icon={Calendar}
              aria-haspopup='dialog'
              aria-expanded={expanded}
              aria-label={`${labels.dates}: ${rangeText}`}
              onClick={toggle}
            >
              {startDay && endDay ? <span className='odc-figure'>{rangeText}</span> : rangeText}
            </Button>
          )}
        />
      </Field>

      <div className='odc-bp-group'>
        <RadioGroup
          label={labels.type}
          options={appliedOptions}
          value={String(form.type)}
          onValueChange={(next) => setField({ type: Number(next) })}
        />
        {isCoupon && (
          <div className='odc-bp-sub'>
            <TextField
              label={labels.coupon}
              name='coupon'
              required
              requiredLabel={required}
              autoComplete='off'
              value={form.coupon}
              error={shown('coupon')}
              onChange={(coupon) => setField({ coupon: coupon.replace(/\s+/g, '') })}
            />
            {advanced && (
              <div className='odc-bp-check'>
                <Checkbox checked={!!form.public} onCheckedChange={(next) => setField({ public: next })}>
                  {labels.public}
                </Checkbox>
                <p className='odc-bp-help'>{t('PLEASE_INDICATE_COUPON_FOR_CART', 'Please indicate if you want the coupon to be seen in the cart or hidden')}</p>
              </div>
            )}
          </div>
        )}
        {advanced && !isCoupon && (
          <div className='odc-bp-sub'>
            <Checkbox checked={!!form.auto} onCheckedChange={(next) => setField({ auto: next })}>
              {labels.auto}
            </Checkbox>
          </div>
        )}
      </div>

      {advanced && (
        <SelectField
          label={labels.target}
          options={targetOptions}
          value={form.target}
          onValueChange={(next) => setField({ target: Number(next) })}
        />
      )}

      <div className='odc-bp-pair'>
        <div className='odc-bp-segment'>
          <span className='odc-field-label'>{labels.rate_type}</span>
          <SegmentedControl
            label={labels.rate_type}
            options={rateTypeOptions}
            value={String(form.rate_type)}
            onValueChange={(next) => setField({ rate_type: Number(next) })}
          />
        </div>
        <NumberField
          label={labels.rate}
          name='rate'
          required
          requiredLabel={required}
          value={form.rate ?? null}
          format={isPercentage ? PERCENT_FORMAT : AMOUNT_FORMAT}
          error={shown('rate')}
          onChange={(rate) => setField({ rate })}
        />
      </div>

      <div className='odc-bp-pair'>
        <NumberField
          label={labels.minimum}
          name='minimum'
          value={form.minimum ?? null}
          format={AMOUNT_FORMAT}
          error={shown('minimum')}
          onChange={(minimum) => setField({ minimum })}
        />
        <NumberField
          label={labels.limit}
          name='limit'
          value={form.limit ?? null}
          error={shown('limit')}
          onChange={(limit) => setField({ limit })}
        />
      </div>

      {advanced && (
        <>
          <Switch checked={!!form.stackable} onCheckedChange={(next) => setField({ stackable: next })}>
            {t('ALLOW_COMBINE_OFFER', 'Allow to combine offer (discount/coupon) with others?')}
          </Switch>
          <div className='odc-bp-sponsor'>
            <RecipientSelect
              key={resetKey}
              labelKey='SPONSOR'
              labelFallback='Sponsor'
              value={form.sponsor}
              onChange={(sponsor) => setField({ sponsor })}
            />
          </div>
        </>
      )}

      <SaveBar
        className='odc-bp-savebar'
        formSelector='.odc-bp-form'
        label={t('SAVE_CHANGES', 'Save changes')}
        count={count}
        countText={withCount(count === 1
          ? t('SETTINGS_UNSAVED_CHANGES_ONE', '_count_ unsaved change')
          : t('SETTINGS_UNSAVED_CHANGES_OTHER', '_count_ unsaved changes'), count)}
        names={changed.map(key => labels[key])}
        moreText={(n) => withCount(t('SETTINGS_UNSAVED_MORE', '+_count_'), n)}
        saving={saving}
        errorText={errorText}
        onRetry={saveError && !blocked && dirty ? () => save() : undefined}
        retryLabel={t('TRY_AGAIN', 'Try again')}
        saved={savedNotice}
        savedText={t('SAVED', 'Saved')}
        discardLabel={t('DISCARD', 'Discard')}
        saveLabel={isNew ? t('STORES_PROMOTION_CREATE', 'Create promotion') : t('SAVE_CHANGES', 'Save changes')}
        saveType='submit'
        onDiscard={discard}
      />
    </form>
  )
}

export const BusinessPromotionGeneralForm = (props) => {
  const businessPromotionFormProps = {
    ...props,
    UIComponent: BusinessPromotionGeneralFormUI
  }
  return <BusinessPromotionFormController {...businessPromotionFormProps} />
}
