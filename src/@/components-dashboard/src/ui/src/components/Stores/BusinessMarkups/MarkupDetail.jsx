import React, { useEffect, useRef, useState } from 'react'

import { useLanguage } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { AsyncSwitch, SaveBar, useLeaveGuard, useSectionSplit } from '../../Shared/Product'
import { MarkupForm, markupValueError } from '../MarkupForm'
import './business-markups.css'

// redesign stores 5.13 (E3b): the detail of one markup, inside the P/SectionSplit of `S/BusinessMarkups` (which draws its
// title and the X / «‹ Back»). The form is `S/MarkupForm` (E3a) without its own header and actions: `hideHeader` and `hideActions`.
// One form held until «Save» in the save bar (it counts and names what changed, Discard, the reason of a failed save, «Saved»), with
// the editor's leave guard. The payload is the one of `main` (same keys, «all» is null), written through the controller with
// `{ inlineError: true }`: the reason of a failure is said in the save bar, not in a toast or an Alert.
// - `formState` keeps its values as strings, as `MarkupForm` and `main` do. A percentage must be a number from 0 to 999 and a
//   fixed amount 0 or more (S-10: `markupValueError`); a field that is wrong is said under it and blocks the save.
// - Project mode (`businessField`): the /stores/markups page. The form has the Business select («all» is a markup for every
//   business and goes as null, as `main` does), a change of business counts in the bar and there is no «Business is required». Without
//   `businessField` the detail is the one of the store editor, which does not pass it. `guardScope` says which close guard it uses.
// - «Enabled» (S-8) is not part of the form: in edit mode a P/AsyncSwitch above it saves at once (`onToggleEnabled`) and goes back
//   when that fails. It never counts as a change of the bar. The stored value is what the form carries in a later save.

const FIELD_KEYS = [
  'name',
  'site_id',
  'delivery_type',
  'rounding_values',
  'products_markup_type',
  'products_markup_value',
  'apply_to_suboptions',
  'apply_same_value',
  'suboptions_markup_type',
  'suboptions_markup_value'
]
const SAVED_NOTICE_MS = 4000
const WRITE_OPTIONS = { inlineError: true }
const ANY_BUSINESS = { anyBusiness: true } // redesign the option of `markupToForm` / `buildMarkupPayload` in project mode
const ROUNDING_VALUES = [0, 0.25, 0.5, 0.75, 0.99]

const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

const emptyForm = (businessId, options) => ({
  name: '',
  enabled: true,
  business_id: options?.anyBusiness ? 'all' : businessId,
  site_id: 'all',
  delivery_type: 'all',
  rounding_values: [],
  products_markup_type: 'percentage',
  products_markup_value: '',
  apply_to_suboptions: true,
  apply_same_value: true,
  suboptions_markup_type: 'percentage',
  suboptions_markup_value: ''
})

/**
 * The form of a stored markup (or of a new one): strings for the values, «all» for no condition. Same reading as `main`.
 * `options.anyBusiness` (project mode, ): the business is the markup's own, and «all» when it has none (a new markup too).
 */
export const markupToForm = (markup, businessId, options) => {
  if (!markup) return emptyForm(businessId, options)
  const rounding = Array.isArray(markup.rounding_values) ? markup.rounding_values : []
  const products = markup.rules?.products || {}
  const suboptions = markup.rules?.suboptions || {}
  const applyToSuboptions = Number(suboptions.markup_value ?? 0) !== 0
  return {
    name: markup.name ?? '',
    enabled: !!markup.enabled,
    business_id: options?.anyBusiness ? (markup.business_id ?? 'all') : Number(businessId),
    site_id: markup.site_id ?? 'all',
    delivery_type: markup.delivery_type ?? 'all',
    rounding_values: rounding,
    products_markup_type: products.markup_type ?? 'percentage',
    products_markup_value: (products.markup_value ?? '') === 0 ? '0' : String(products.markup_value ?? ''),
    apply_to_suboptions: applyToSuboptions,
    apply_same_value: applyToSuboptions
      ? (products.markup_type === suboptions.markup_type) && (Number(products.markup_value) === Number(suboptions.markup_value))
      : true,
    suboptions_markup_type: suboptions.markup_type ?? (products.markup_type ?? 'percentage'),
    suboptions_markup_value: (suboptions.markup_value ?? '') === 0 ? '0' : String(suboptions.markup_value ?? '')
  }
}

/**
 * What the API gets: the payload of `main` (same keys; «all» is null). Call it with a form that has no field errors.
 * `options.anyBusiness` (project mode, ): `business_id` is null for «all» or empty, and the chosen value as it is otherwise.
 */
export const buildMarkupPayload = (form, businessId, options) => {
  const products = {
    markup_type: form.products_markup_type,
    markup_value: Number(form.products_markup_value)
  }
  let suboptions = { markup_type: 'fixed', markup_value: 0 }
  if (form.apply_to_suboptions) {
    suboptions = form.apply_same_value
      ? { ...products }
      : { markup_type: form.suboptions_markup_type, markup_value: Number(form.suboptions_markup_value) }
  }
  return {
    name: String(form.name || '').trim(),
    business_id: options?.anyBusiness
      ? (form.business_id === 'all' || form.business_id === '' ? null : form.business_id)
      : Number(businessId),
    site_id: form.site_id === 'all' || form.site_id === '' ? null : form.site_id,
    delivery_type: form.delivery_type === 'all' || form.delivery_type === '' ? null : form.delivery_type,
    rules: { products, suboptions },
    enabled: !!form.enabled,
    // NOTE: an empty array is sent on purpose, so rounding values can be cleared on edit
    rounding_values: (Array.isArray(form.rounding_values) ? form.rounding_values : []).map(value => Number(value))
  }
}

/** The fields that cannot be saved, by key: `name`, `products`, `suboptions` (only while the suboptions have a value of their own). */
export const validateMarkup = (form, t) => {
  const errors = {}
  if (!String(form.name || '').trim()) errors.name = t('NAME_IS_REQUIRED', 'Name is required')
  const products = markupValueError(form.products_markup_type, form.products_markup_value, t)
  if (products) errors.products = products
  if (form.apply_to_suboptions && !form.apply_same_value) {
    const suboptions = markupValueError(form.suboptions_markup_type, form.suboptions_markup_value, t)
    if (suboptions) errors.suboptions = suboptions
  }
  return errors
}

// two values as the numbers they mean: '' and '0' are the same markup; anything that is not a number is compared as text
const sameValue = (a, b) => {
  const left = String(a ?? '').trim()
  const right = String(b ?? '').trim()
  if (left === right) return true
  const x = Number(left === '' ? 0 : left)
  const y = Number(right === '' ? 0 : right)
  return Number.isFinite(x) && Number.isFinite(y) && x === y
}

const sameRounding = (a, b) => {
  const left = (Array.isArray(a) ? a : []).map(Number).sort()
  const right = (Array.isArray(b) ? b : []).map(Number).sort()
  return left.length === right.length && left.every((value, index) => value === right[index])
}

// «Changed» is what the user sees changed: a field the form does not show (the suboptions when they are not applied, or are the same
// as products) is not counted, and `enabled` is not part of the form (S-8).
const hasChanged = (key, form, baseline) => {
  switch (key) {
    case 'name':
      return String(form.name || '').trim() !== String(baseline.name || '').trim()
    case 'business_id': // redesign a number and its text are the same business
      return String(form.business_id ?? '') !== String(baseline.business_id ?? '')
    case 'rounding_values':
      return !sameRounding(form.rounding_values, baseline.rounding_values)
    case 'products_markup_value':
      return !sameValue(form.products_markup_value, baseline.products_markup_value)
    case 'apply_same_value':
      return form.apply_to_suboptions && baseline.apply_to_suboptions && form.apply_same_value !== baseline.apply_same_value
    case 'suboptions_markup_type':
      return form.apply_to_suboptions && !form.apply_same_value && form.suboptions_markup_type !== baseline.suboptions_markup_type
    case 'suboptions_markup_value':
      return form.apply_to_suboptions && !form.apply_same_value && !sameValue(form.suboptions_markup_value, baseline.suboptions_markup_value)
    default:
      return form[key] !== baseline[key]
  }
}

/**
 * @param {object}   props
 * @param {object|null} props.markup               The stored markup, or null for a new one.
 * @param {number|string} props.businessId
 * @param {Array}    props.deliveryTypeOptions     `[{ value, content }]`, «All delivery types» first.
 * @param {Array}    props.markupTypeOptions       `[{ value, content }]`: % and Fixed.
 * @param {Array}    props.siteOptions             Same as the delivery types, «All sites» first.
 * @param {Function} props.createMarkup            `(payload, { inlineError }) => { error, result }`.
 * @param {Function} props.updateMarkup            `(id, payload, { inlineError }) => { error, result }`.
 * @param {Function} props.onToggleEnabled         `(markup, next) => Promise<{ ok, error? }>`: the switch of the list's rows too.
 * @param {Function} props.onSaved                 `(record)`: an edit was saved; the record the API gave back.
 * @param {Function} props.onCreated               `(record)`: a new markup was created and the API gave it back with its id.
 * @param {Function} props.onClose                 Close the detail.
 * @param {object}   [props.businessField]         Project mode (opt-in): `{ options, searchValue, onSearchChange, pagination,
 *                                                 onChangePage, loading }` of the Business select. Absent: the store editor.
 * @param {'section'|'page'} [props.guardScope]    Which close guard the leave guard uses: the one of the enclosing P/SectionSplit
 *                                                 (`'section'`, default) or the one of the P/SplitView around the page (`'page'`).
 */
export const MarkupDetail = ({
  markup,
  businessId,
  deliveryTypeOptions,
  markupTypeOptions,
  siteOptions,
  createMarkup,
  updateMarkup,
  onToggleEnabled,
  onSaved,
  onCreated,
  onClose,
  businessField,
  guardScope = 'section'
}) => {
  const [, t] = useLanguage()
  const isNew = !markup
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  // redesign project mode reads and writes the business of the markup itself
  const formOptions = businessField ? ANY_BUSINESS : undefined
  const baseline = markupToForm(markup, businessId, formOptions)
  const [formState, setFormState] = useState(baseline)
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [resetKey, setResetKey] = useState(0)

  // «Enabled» saved from the list or from the switch above while this detail is open: the record is the truth, so the form follows
  // it, and a later save does not send the old value back
  const storedEnabled = markup ? !!markup.enabled : null
  const lastEnabled = useRef(storedEnabled)
  useEffect(() => {
    if (storedEnabled === null || lastEnabled.current === storedEnabled) return
    lastEnabled.current = storedEnabled
    setFormState(current => ({ ...current, enabled: storedEnabled }))
  }, [storedEnabled])

  const roundingOptions = ROUNDING_VALUES.map(value => ({ value, content: value.toFixed(2) }))

  const labels = {
    name: t('NAME', 'Name'),
    business_id: t('BUSINESS', 'Business'),
    site_id: t('SITE', 'Site'),
    delivery_type: t('DELIVERY_TYPE', 'Delivery type'),
    rounding_values: t('ROUNDING_VALUES', 'Rounding values'),
    products_markup_type: t('PRODUCTS_MARKUP_TYPE', 'Products markup type'),
    products_markup_value: t('PRODUCTS_MARKUP_VALUE', 'Products markup value'),
    apply_to_suboptions: t('APPLY_TO_SUBOPTIONS', 'Apply to suboptions'),
    apply_same_value: t('APPLY_SAME_VALUE', 'Apply same value'),
    suboptions_markup_type: t('SUBOPTIONS_MARKUP_TYPE', 'Suboptions markup type'),
    suboptions_markup_value: t('SUBOPTIONS_MARKUP_VALUE', 'Suboptions markup value')
  }
  // the business comes right after the name in the list of changes (project mode only)
  const fieldKeys = businessField ? ['name', 'business_id', ...FIELD_KEYS.slice(1)] : FIELD_KEYS
  const changedKeys = fieldKeys.filter(key => hasChanged(key, formState, baseline))
  const count = changedKeys.length
  const dirty = count > 0
  const withCount = (template, value) => template.replace('_count_', String(value))

  const errors = validateMarkup(formState, t)
  const invalidCount = Object.keys(errors).length
  const noBusiness = !businessField && !Number(businessId) // project mode: «all» is a business too

  // a changed field clears the old reason of a failed save and the «Saved» notice
  const lastForm = useRef(formState)
  useEffect(() => {
    if (lastForm.current === formState) return
    lastForm.current = formState
    setSaved(false)
    setSaveError(null)
  }, [formState])

  const save = async () => {
    if (saving) return { ok: false }
    if (invalidCount > 0) {
      setAttempted(true)
      return { ok: false }
    }
    if (noBusiness) {
      setSaveError(t('BUSINESS_REQUIRED', 'Business is required'))
      return { ok: false }
    }
    setSaved(false)
    setSaveError(null)
    setSaving(true)
    const payload = buildMarkupPayload(formState, businessId, formOptions)
    let result
    try {
      result = isNew ? await createMarkup?.(payload, WRITE_OPTIONS) : await updateMarkup?.(markup.id, payload, WRITE_OPTIONS)
    } catch (error) {
      result = { error: true, result: [error?.message] }
    }
    if (!mounted.current) return { ok: !result?.error && result != null }
    setSaving(false)
    if (!result || result.error) {
      const reason = firstMessage(result?.result)
      // main a duplicate scope comes back as a key; said in words, with what to do
      setSaveError(reason === 'API_ERROR_MARKUP_ALREADY_EXISTS'
        ? t('API_ERROR_MARKUP_ALREADY_EXISTS', 'A markup for this business, site and delivery type already exists. Edit that markup or pick a different combination.')
        : translateApiMessage(t, reason, t('MARKUP_SAVE_FAILED', 'The markup could not be saved.')))
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
    setFormState(markupToForm(markup, businessId, formOptions))
    setAttempted(false)
    setSaveError(null)
    setSaved(false)
    setResetKey(key => key + 1)
  }

  // redesign the hook is always called; `'page'` leaves out the section's guard so the enclosing P/SplitView's is used
  const sectionSplit = useSectionSplit()
  useLeaveGuard({
    dirty,
    count,
    save,
    discard,
    registerCloseGuard: guardScope === 'page' ? undefined : sectionSplit.registerCloseGuard
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

  // the rounding values of `main`: the same toggle, the same values
  const handleToggleRounding = (value) => {
    setFormState((prev) => {
      const next = Array.isArray(prev.rounding_values) ? [...prev.rounding_values] : []
      const index = next.findIndex(item => Number(item) === Number(value))
      if (index >= 0) next.splice(index, 1)
      else next.push(value)
      return { ...prev, rounding_values: next }
    })
  }

  const fixErrors = invalidCount === 1
    ? t('SETTINGS_FIX_FIELDS_ONE', 'Fix _count_ field to save.')
    : t('SETTINGS_FIX_FIELDS_OTHER', 'Fix _count_ fields to save.')
  const blocked = attempted && invalidCount > 0
  const errorText = blocked ? withCount(fixErrors, invalidCount) : saveError

  return (
    <form className='odc-bm-form' tabIndex={-1} noValidate onSubmit={handleSubmit}>
      {!isNew && (
        <div className='odc-bm-enabled'>
          <AsyncSwitch
            checked={storedEnabled}
            failureText={t('MARKUP_ENABLE_FAILED', "We couldn't change this markup.")}
            onToggle={(next) => onToggleEnabled(markup, next)}
          >
            {t('ENABLED', 'Enabled')}
          </AsyncSwitch>
        </div>
      )}
      <MarkupForm
        key={resetKey}
        t={t}
        isEdit={!isNew}
        isShowBusinessSelect={!!businessField}
        filteredBusinessOptions={businessField?.options}
        businessSearchValue={businessField?.searchValue}
        setBusinessSearchValue={businessField?.onSearchChange}
        businessPagination={businessField?.pagination}
        handleChangeBusinessPage={businessField?.onChangePage}
        businessesLoading={businessField?.loading}
        markupId={markup?.id}
        formState={formState}
        setFormState={setFormState}
        handleToggleRounding={handleToggleRounding}
        filteredSitesOptions={siteOptions}
        deliveryTypeOptions={deliveryTypeOptions}
        roundingOptions={roundingOptions}
        markupTypeOptions={markupTypeOptions}
        hideHeader
        hideActions
        disabled={saving}
        showNameError={attempted}
      />
      <SaveBar
        className='odc-bm-savebar'
        formSelector='.odc-bm-form'
        label={t('SAVE_CHANGES', 'Save changes')}
        count={count}
        countText={withCount(count === 1
          ? t('SETTINGS_UNSAVED_CHANGES_ONE', '_count_ unsaved change')
          : t('SETTINGS_UNSAVED_CHANGES_OTHER', '_count_ unsaved changes'), count)}
        names={changedKeys.map(key => labels[key])}
        moreText={(n) => withCount(t('SETTINGS_UNSAVED_MORE', '+_count_'), n)}
        saving={saving}
        errorText={errorText}
        onRetry={saveError && !blocked && dirty ? () => save() : undefined}
        retryLabel={t('TRY_AGAIN', 'Try again')}
        saved={saved}
        savedText={t('SAVED', 'Saved')}
        discardLabel={t('DISCARD', 'Discard')}
        saveLabel={isNew ? t('CREATE_MARKUP', 'Create markup') : t('SAVE_CHANGES', 'Save changes')}
        saveType='submit'
        onDiscard={discard}
      />
    </form>
  )
}
