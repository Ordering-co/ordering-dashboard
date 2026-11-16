import React, { useEffect, useId, useRef, useState } from 'react'
import { useLanguage } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { RecipientSelect } from '../../Shared'
import { ChevronDown, TriangleAlert } from '../../Shared/Icon'
import {
  Button,
  InlineNotice,
  NumberField,
  RadioGroup,
  SaveBar,
  Switch,
  TextField,
  useLeaveGuard,
  useSectionSplit
} from '../../Shared/Product'
import './edit-tax-manager.css'

// redesign stores 5.12 (E2): the add / edit form of a tax (`type='taxes'`) or of a product fee (`type='fees'`) on Product.
// Two consumers keep one contract (`type`, `handleSave(id, type)`, `data`, `formChanges`, `onChange(name, value, orderType?)`, `onClose`):
// - `layout='modal'` (default, S/ProductDetailsAdvanced inside its legacy Modal): a footer with «Accept» and «Close». Accept validates,
//   waits for `handleSave(data?.value, type)` and closes only when the save did not fail (`{ ok: false }` or a throw keep it open).
// - `layout='panel'` (S/BusinessTaxAndFees inside a P/SectionSplit): no footer. A P/SaveBar counts and names what differs from the
//   stored record, `handleSave(data?.value, type, undefined, saveOptions)` and then `onSaved(result)`; `onDiscard()` is the parent's
//   «clear what is pending». The leave guard asks only when something really differs.
// The values shown are `formChanges[field] ?? data[field]` (the parent controller holds the pending changes). A cleared number is sent as
// '' (never null: `handleChangeTax(name, null)` drops `order_type_rates`). The nested «Change by order types» modal is an inline
// disclosure (decision B-3 of the lot); the pair `rate` + `type` of an order type is always sent together, as the old form did.
// The parent keys the component by record (`key={data?.value ?? 'new'}`): a different record starts from its own state.

const ORDER_TYPES = ['delivery', 'pickup', 'eatin']
const DEFAULTS = { type: 1, apply_to_fees: false, taxable: true, recipient: 'business' }
const TAX_FIELDS = ['name', 'description', 'rate', 'type', 'apply_to_fees', 'recipient', 'order_type_rates']
const FEE_FIELDS = ['name', 'description', 'fixed', 'percentage', 'taxable', 'recipient']
const NUMBER_FIELDS = ['rate', 'fixed', 'percentage']
const BOOLEAN_FIELDS = ['apply_to_fees', 'taxable']
const SAVED_NOTICE_MS = 4000
const FRACTION_DIGITS = { maximumFractionDigits: 6 }

// a number, or null when the value is empty or is not one ('' cleared, NaN from parseFloat('') in the controller)
const toNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
const inPercentRange = (number) => number >= 0 && number <= 100
const isNonNegative = (number) => number >= 0
const toType = (value) => (Number(value) === 2 ? 2 : 1)
const toText = (value) => String(value ?? '')

const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

export const EditTaxManager = (props) => {
  const {
    type,
    handleSave,
    data,
    formChanges,
    onChange,
    onClose,
    layout,
    onDiscard,
    onSaved,
    saveOptions
  } = props

  const [, t] = useLanguage()
  const isPanel = layout === 'panel'
  const isTax = type === 'taxes'
  const isNew = !data?.value

  const mounted = useRef(true)
  const savingRef = useRef(false)
  const savedTimer = useRef(null)
  const rootRef = useRef(null)
  const ratesPanelId = useId()
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const [ratesOpen, setRatesOpen] = useState(() => ORDER_TYPES.some(orderType => toNumber(data?.order_type_rates?.[orderType]?.rate) !== null))

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clearTimeout(savedTimer.current)
    }
  }, [])

  const stored = (field) => data?.[field] ?? DEFAULTS[field]
  const shown = (field) => formChanges?.[field] ?? stored(field)
  // a pending key wins even when it is null / '' / NaN: a cleared rate must not show (nor re-send) the stored one again
  const orderTypeValue = (orderType, field) => {
    const pending = formChanges?.order_type_rates?.[orderType]
    return pending && field in pending ? pending[field] : data?.order_type_rates?.[orderType]?.[field]
  }

  const rateLabel = `${t('RATE', 'Rate')} (%)`
  const labels = {
    name: t('NAME', 'Name'),
    description: t('DESCRIPTION', 'Description'),
    rate: rateLabel,
    type: t('TYPE', 'Type'),
    apply_to_fees: t('APPLY_TO_FEES', 'Apply to fees'),
    recipient: t('RECIPIENT', 'Recipient'),
    order_type_rates: t('RATES_BY_ORDER_TYPE', 'Rates by order type'),
    fixed: t('FIXED', 'Fixed'),
    percentage: `${t('PERCENTAGE', 'Percentage')} (%)`,
    taxable: t('TAXABLE', 'Taxable')
  }
  const orderTypeLabels = {
    delivery: t('DELIVERY', 'Delivery'),
    pickup: t('PICKUP', 'Pickup'),
    eatin: t('EAT_IN', 'Eat in') // the catalog's EATIN reads «Eatin»
  }
  const percentRangeText = t('ENTER_PERCENTAGE_0_TO_100', 'Enter a percentage from 0 to 100.')
  const minZeroText = t('STORE_FIELD_NUMBER_MIN_ZERO', 'Enter a number, 0 or more.')

  // ── What differs from the stored record (the preset `type: 1` of a new tax is not a change) ──
  const orderTypeRatesChanged = () => ORDER_TYPES.some(orderType => {
    const pending = formChanges?.order_type_rates?.[orderType]
    if (!pending) return false
    const rateChanged = 'rate' in pending && toNumber(pending.rate) !== toNumber(data?.order_type_rates?.[orderType]?.rate)
    const typeChanged = 'type' in pending && toType(pending.type) !== toType(data?.order_type_rates?.[orderType]?.type)
    return rateChanged || typeChanged
  })
  const hasChanged = (field) => {
    if (!formChanges || formChanges[field] === undefined) return false
    if (field === 'order_type_rates') return orderTypeRatesChanged()
    if (NUMBER_FIELDS.includes(field)) return toNumber(formChanges[field]) !== toNumber(data?.[field])
    if (field === 'type') return toType(formChanges.type) !== toType(stored('type'))
    if (BOOLEAN_FIELDS.includes(field)) return Boolean(formChanges[field]) !== Boolean(stored(field))
    return toText(formChanges[field] ?? DEFAULTS[field]) !== toText(stored(field))
  }
  const changedKeys = (isTax ? TAX_FIELDS : FEE_FIELDS).filter(hasChanged)
  const count = changedKeys.length
  const dirty = isPanel && count > 0

  const withCount = (template, value) => template.replace('_count_', String(value))

  // ── Changes ──
  const clearError = (key) => {
    setSaved(false)
    setSaveError(null)
    setErrors(current => {
      if (!current[key]) return current
      const { [key]: _gone, ...rest } = current // eslint-disable-line no-unused-vars
      return rest
    })
  }
  const change = (field, value) => {
    clearError(field)
    onChange(field, value)
  }
  const changeNumber = (field, value) => change(field, value === null ? '' : value)
  // the pair `rate` + `type` of an order type goes together, so what the parent holds is always complete
  const changeOrderType = (orderType, field, value) => {
    clearError(`order:${orderType}`)
    const other = field === 'rate' ? 'type' : 'rate'
    const otherValue = other === 'rate' ? (toNumber(orderTypeValue(orderType, 'rate')) ?? '') : toType(orderTypeValue(orderType, 'type'))
    onChange(field, value, orderType)
    onChange(other, otherValue, orderType)
  }

  // ── Validation: each message goes under its field ──
  const validate = () => {
    const found = {}
    if (!toText(shown('name')).trim()) found.name = t('NAME_REQUIRED', 'The name is required')
    if (!toText(shown('description')).trim()) found.description = t('DESCRIPTION_REQUIRED', 'The Description is required')
    const percent = (field, requiredText, inRange, rangeText) => {
      const number = toNumber(shown(field))
      if (number === null) found[field] = requiredText
      else if (!inRange(number)) found[field] = rangeText
    }
    if (isTax) {
      // main only checked that a tax rate (and an order-type rate) is a number: no upper bound, negatives refused
      percent('rate', t('TAX_RATE_REQUIRED', 'Tax rate is required'), isNonNegative, minZeroText)
      ORDER_TYPES.forEach(orderType => {
        const number = toNumber(orderTypeValue(orderType, 'rate'))
        if (number !== null && !isNonNegative(number)) found[`order:${orderType}`] = minZeroText
      })
    } else {
      const fixed = toNumber(shown('fixed'))
      if (fixed === null) found.fixed = t('FEE_FIXED_REQUIRED', 'Fee fixed is required')
      else if (fixed < 0) found.fixed = t('ENTER_AMOUNT_0_OR_MORE', 'Enter an amount of 0 or more.')
      // main kept the «not bigger than 100» rule on the fee percentage only
      percent('percentage', t('FEE_PERCENTAGE_REQUIRED', 'Fee percentage is required'), inPercentRange, percentRangeText)
    }
    return found
  }

  const save = async () => {
    if (savingRef.current) return { ok: false }
    const found = validate()
    if (Object.keys(found).length > 0) {
      setErrors(found)
      setSaveError(null)
      if (Object.keys(found).some(key => key.startsWith('order:'))) setRatesOpen(true)
      // the field may be off screen (Save is in the sticky bar): the focus goes to the first one that is wrong
      requestAnimationFrame(() => {
        const field = rootRef.current?.querySelector('[aria-invalid="true"]')
        field?.focus({ preventScroll: true })
        field?.scrollIntoView?.({ block: 'center' })
      })
      return { ok: false }
    }
    setErrors({})
    savingRef.current = true
    setSaving(true)
    setSaveError(null)
    setSaved(false)
    let result
    try {
      result = isPanel
        ? await handleSave(data?.value, type, undefined, saveOptions)
        : await handleSave(data?.value, type)
    } catch (error) {
      result = { ok: false }
    }
    savingRef.current = false
    const failed = result === false || result?.ok === false
    if (!mounted.current) return failed ? { ok: false, error: result?.error } : (result ?? { ok: true })
    setSaving(false)
    if (failed) {
      const fallback = isTax
        ? t('TAX_SAVE_FAILED', 'The tax could not be saved.')
        : t('FEE_SAVE_FAILED', 'The fee could not be saved.')
      setSaveError(translateApiMessage(t, firstMessage(result?.error), fallback))
      return { ok: false, error: result?.error }
    }
    if (isPanel) {
      setSaved(true)
      clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => {
        if (mounted.current) setSaved(false)
      }, SAVED_NOTICE_MS)
      onSaved?.(result)
    } else {
      onClose?.()
    }
    return result ?? { ok: true }
  }

  const discard = () => {
    onDiscard?.()
    setErrors({})
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

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!isPanel || dirty) save()
  }

  const errorCount = Object.keys(errors).length
  const barError = errorCount > 0
    ? withCount(errorCount === 1
      ? t('SETTINGS_FIX_FIELDS_ONE', 'Fix _count_ field to save.')
      : t('SETTINGS_FIX_FIELDS_OTHER', 'Fix _count_ fields to save.'), errorCount)
    : saveError

  const requiredLabel = t('REQUIRED', 'Required')
  const textField = (field) => (
    <TextField
      label={labels[field]}
      required
      requiredLabel={requiredLabel}
      value={toText(shown(field))}
      onChange={(value) => change(field, value)}
      error={errors[field]}
      autoComplete='off'
    />
  )
  const numberField = (field) => (
    <NumberField
      name={field}
      label={labels[field]}
      required
      requiredLabel={requiredLabel}
      min={0}
      format={FRACTION_DIGITS}
      value={toNumber(shown(field))}
      onChange={(value) => changeNumber(field, value)}
      error={errors[field]}
      autoComplete='off'
    />
  )
  const typeOptions = [
    { value: 1, label: t('INCLUDED_ON_PRICE', 'Included on price') },
    { value: 2, label: t('NOT_INCLUDED_ON_PRICE', 'Not included on price') }
  ]
  const recipient = (
    <RecipientSelect
      value={shown('recipient')}
      onChange={(value) => change('recipient', value)}
    />
  )

  return (
    <form
      ref={rootRef}
      className='odc-etm-form'
      data-layout={isPanel ? 'panel' : 'modal'}
      tabIndex={-1}
      noValidate
      onSubmit={handleSubmit}
    >
      <React.Fragment key={`fields-${resetKey}`}>
        {textField('name')}
        {textField('description')}
        {isTax && (
          <>
            {numberField('rate')}
            <RadioGroup
              label={labels.type}
              orientation='horizontal'
              options={typeOptions}
              value={toType(shown('type'))}
              onValueChange={(value) => change('type', Number(value))}
            />
            <Switch checked={Boolean(shown('apply_to_fees'))} onCheckedChange={(value) => change('apply_to_fees', value)}>
              {labels.apply_to_fees}
            </Switch>
            {recipient}
            <div className='odc-etm-rates'>
              <Button
                className='odc-etm-rates-toggle'
                variant='ghost'
                iconEnd={ChevronDown}
                aria-expanded={ratesOpen}
                aria-controls={ratesOpen ? ratesPanelId : undefined}
                onClick={() => setRatesOpen(open => !open)}
              >
                {labels.order_type_rates}
              </Button>
              {ratesOpen && (
                <div id={ratesPanelId} className='odc-etm-rates-body'>
                  {ORDER_TYPES.map(orderType => (
                    <div
                      key={orderType}
                      className='odc-etm-rate-row'
                      role='group'
                      aria-label={orderTypeLabels[orderType]}
                    >
                      <p className='odc-etm-rate-title' aria-hidden='true'>{orderTypeLabels[orderType]}</p>
                      <NumberField
                        name={`${orderType}-rate`}
                        label={rateLabel}
                        min={0}
                        format={FRACTION_DIGITS}
                        value={toNumber(orderTypeValue(orderType, 'rate'))}
                        onChange={(value) => changeOrderType(orderType, 'rate', value === null ? '' : value)}
                        error={errors[`order:${orderType}`]}
                        autoComplete='off'
                      />
                      <RadioGroup
                        label={labels.type}
                        orientation='horizontal'
                        options={typeOptions}
                        value={toType(orderTypeValue(orderType, 'type'))}
                        onValueChange={(value) => changeOrderType(orderType, 'type', Number(value))}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
        {!isTax && (
          <>
            {numberField('fixed')}
            {numberField('percentage')}
            <Switch checked={Boolean(shown('taxable'))} onCheckedChange={(value) => change('taxable', value)}>
              {labels.taxable}
            </Switch>
            {(formChanges?.target === 'customer' || data?.target === 'customer') && recipient}
          </>
        )}
      </React.Fragment>
      {isPanel
        ? (
          <SaveBar
            className='odc-etm-savebar'
            formSelector='.odc-etm-form'
            label={t('SAVE_CHANGES', 'Save changes')}
            count={count}
            countText={withCount(count === 1
              ? t('SETTINGS_UNSAVED_CHANGES_ONE', '_count_ unsaved change')
              : t('SETTINGS_UNSAVED_CHANGES_OTHER', '_count_ unsaved changes'), count)}
            names={changedKeys.map(key => labels[key])}
            moreText={(n) => withCount(t('SETTINGS_UNSAVED_MORE', '+_count_'), n)}
            saving={saving}
            errorText={barError}
            onRetry={errorCount === 0 && saveError && dirty ? () => save() : undefined}
            retryLabel={t('TRY_AGAIN', 'Try again')}
            saved={saved}
            savedText={t('SAVED', 'Saved')}
            discardLabel={t('DISCARD', 'Discard')}
            saveLabel={isNew
              ? (isTax ? t('ADD_TAX', 'Add tax') : t('ADD_FEE', 'Add fee'))
              : t('SAVE_CHANGES', 'Save changes')}
            saveType='submit'
            onDiscard={discard}
          />
          )
        : (
          <div className='odc-etm-footer'>
            <Button variant='primary' type={saving ? 'button' : 'submit'} busy={saving}>
              {t('ACCEPT', 'Accept')}
            </Button>
            <Button onClick={() => onClose?.()}>
              {t('CLOSE', 'Close')}
            </Button>
            {saveError && (
              <InlineNotice className='odc-etm-notice' tone='warning' icon={TriangleAlert} role='alert'>
                {saveError}
              </InlineNotice>
            )}
          </div>
          )}
    </form>
  )
}
