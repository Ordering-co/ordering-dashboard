import React, { useEffect, useId, useState } from 'react'

import { AsyncSwitch, Button, Checkbox, NumberField, Pagination, SegmentedControl, SelectField, TextField } from '../../Shared/Product'
import { fillTemplate } from '../BusinessMarkups/markupShared'
import './markup-form.css'

// redesign stores 5.13 (E3a): the markup form on Product pieces. One form for three hosts: the /stores/markups route
// (inside a SideBar), the business markups modal and the Business markups section (inside a P/SectionSplit).
// - `formState` keeps its values as strings ('' is empty), as the two consumers validate those strings in their buildPayload.
// - Opt-in props, off by default (the form is then the one of before): `hideHeader` (the host paints the title and the switch, and
//   owns the frame: no padding and no scroll here), `hideActions` (the host has its own save bar), `disabled` (every field off while
//   it saves) and `showNameError` («Name is required» under an empty name).
// - «Enabled» is a P/AsyncSwitch (S-8): it saves at once through `onUpdateEnabled(markupId, next)` and goes back when that fails. The
//   route's handler returns nothing, and an empty answer counts as OK; `{ error: true, result }` is a failure.
// - Business, Site and Delivery type are P/SelectField and cannot be changed once the markup exists (as in `main`): the reason
//   is said under each one (S-11). The Business list is remote: its search is held by the host (`businessSearchValue`) and its pages are
//   the foot of the list (P/Pagination).
// - Rounding values are five checkboxes instead of a multi-select (S-9): the same values reach `handleToggleRounding`.
// - Percentages are numbers from 0 to 999, decimals included (P4: the API takes `numeric|min:0`); `markupValueError` says
//   what is wrong under the field. Changing the type never rewrites the value (F-1): «1200.5» going from Fixed to % stays
//   «1200.5» and the error says it.

const PERCENT_0_999 = /^\d{1,3}(\.\d+)?$/
const NUMBER_FORMAT = { useGrouping: false, maximumFractionDigits: 20 }

/**
 * What is wrong with a markup value, in words, or `undefined`. A percentage must be a number from 0 to 999, decimals included
 * (the 999 cap is the dashboard's, the API has none); a fixed amount must be a number of 0 or more. An empty value is not an error here (the consumers decide).
 * @param {'percentage'|'fixed'|string} type
 * @param {*} value The value as the form keeps it: a string.
 * @param {Function} t `(key, fallback)`
 * @returns {string|undefined}
 */
export const markupValueError = (type, value, t) => {
  const raw = String(value ?? '').trim()
  if (!raw) return undefined
  if (type === 'percentage') {
    return PERCENT_0_999.test(raw) ? undefined : t('MARKUP_PERCENT_0_999', 'Enter a number from 0 to 999.')
  }
  if (type === 'fixed') {
    const number = Number(raw)
    return Number.isFinite(number) && number >= 0 ? undefined : t('ENTER_AMOUNT_0_OR_MORE', 'Enter an amount of 0 or more.')
  }
  return undefined
}

// the string of the form as the number a NumberField shows (null when empty or not a number)
const toNumber = (value) => {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const number = Number(raw)
  return Number.isFinite(number) ? number : null
}

// the options of the controller (`{ value, content }`) as the P/Select takes them
const toSelectOptions = (options) => (options || []).map(option => ({ value: option.value, label: option.content }))

const firstText = (content) => (typeof content === 'string' ? content : String(content ?? ''))

// «Type» (% / Fixed) and «Value» side by side while there is room, one under the other when there is not
const MarkupRule = ({ t, typeLabel, valueLabel, type, value, typeOptions, onTypeChange, onValueChange, disabled }) => {
  const resolvedType = type || 'percentage'
  return (
    <div className='odc-mf-rule'>
      <div className='odc-mf-seg-field'>
        {/* the group names itself (aria-label); this line is what a sighted person reads */}
        <span className='odc-mf-label' aria-hidden='true'>{typeLabel}</span>
        {/* a native fieldset turns off the toggles of the segmented control, which has no disabled of its own */}
        <fieldset className='odc-mf-seg' role='none' disabled={disabled}>
          <SegmentedControl
            label={typeLabel}
            value={resolvedType}
            onValueChange={onTypeChange}
            options={typeOptions}
          />
        </fieldset>
      </div>
      <NumberField
        label={valueLabel}
        value={toNumber(value)}
        onChange={(next) => onValueChange(next == null ? '' : String(next))}
        format={NUMBER_FORMAT}
        inputMode='decimal'
        placeholder='0'
        error={markupValueError(resolvedType, value, t)}
        disabled={disabled}
      />
    </div>
  )
}

export const MarkupForm = (props) => {
  const {
    t,
    isEdit,
    actionLoading,
    isShowBusinessSelect = true,
    markupId,

    formState,
    setFormState,

    handleToggleRounding,
    handleSubmit,
    onUpdateEnabled,

    filteredBusinessOptions,
    filteredSitesOptions,
    deliveryTypeOptions,
    roundingOptions,
    markupTypeOptions,

    businessSearchValue,
    setBusinessSearchValue,
    businessPagination,
    handleChangeBusinessPage,
    businessesLoading,

    hideHeader = false,
    hideActions = false,
    disabled = false,
    showNameError = false
  } = props
  const roundingHintId = useId()
  // redesign (review 1): the business picked here keeps its name in the trigger while a search or another page leaves it
  // out of the list (else the trigger fell back to «All businesses» with a business chosen)
  const [pickedBusiness, setPickedBusiness] = useState(null)
  // redesign (review 3): the search of the business list is the host's; it does not outlive this form (the legacy select
  // emptied it when it closed), so the next markup opens the list on its first page
  useEffect(() => () => setBusinessSearchValue?.(''), [])

  const lockedHint = isEdit
    ? t('MARKUP_LOCKED_HINT', "Can't be changed after creating. Create a new markup to apply it elsewhere.")
    : undefined
  const locked = !!isEdit || disabled
  const set = (patch) => setFormState((prev) => ({ ...prev, ...patch }))

  const typeOptions = (markupTypeOptions || []).map((option) => ({ value: option.value, label: firstText(option.content) }))
  const rounding = Array.isArray(formState.rounding_values) ? formState.rounding_values : []

  const toggleEnabled = async (next) => {
    if (markupId != null && typeof onUpdateEnabled === 'function') {
      // an empty answer (the route's handler returns nothing) is OK; `{ error: true, result }` is a failure
      const answer = await Promise.resolve(onUpdateEnabled(markupId, next))
      if (answer && answer.error) return { ok: false, error: answer.result }
    }
    set({ enabled: next })
    return { ok: true }
  }

  // redesign (F-1): the value is kept as typed when the type changes; `markupValueError` says what is wrong under the field
  const changeType = (typeKey) => (next) => setFormState((prev) => ({ ...prev, [typeKey]: next }))

  const searchTexts = {
    searchLabel: t('SEARCH', 'Search'),
    clearSearchLabel: t('CLEAR_SEARCH', 'Clear search'),
    noResultsLabel: t('NO_RESULTS_FOUND', 'No results found')
  }
  // the pages of the Business list: the foot of the popover, only when there is more than one page
  const businessFooter = businessPagination?.totalPages > 1
    ? (
      <Pagination
        page={businessPagination.currentPage}
        pageSize={businessPagination.pageSize}
        total={businessPagination.totalItems ?? businessPagination.total ?? businessPagination.totalPages * businessPagination.pageSize}
        onPageChange={handleChangeBusinessPage}
        busy={!!businessesLoading}
        label={t('PAGINATION', 'Pagination')}
        previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
        nextLabel={t('NEXT_PAGE', 'Next page')}
        rangeLabel={(from, to, total, figure) => fillTemplate(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from, to, total }, figure)}
        pageStatusLabel={(current, total) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(total))}
      />
      )
    : undefined

  const nameMissing = showNameError && !String(formState.name ?? '').trim()

  return (
    <div className={`odc-root odc-mf${hideHeader ? ' odc-mf-embedded' : ''}`}>
      {!hideHeader && (
        <div className='odc-mf-header'>
          <h1 className='odc-mf-title'>
            {formState.name?.trim()
              ? formState.name
              : (isEdit ? t('EDIT_MARKUP', 'Edit markup') : t('CREATE_MARKUP', 'Create markup'))}
          </h1>
          {isEdit && (
            <AsyncSwitch
              checked={!!formState.enabled}
              onToggle={toggleEnabled}
              failureText={t('MARKUP_ENABLE_FAILED', "We couldn't change this markup.")}
              disabled={disabled}
            >
              {t('ENABLED', 'Enabled')}
            </AsyncSwitch>
          )}
        </div>
      )}

      <TextField
        label={t('NAME', 'Name')}
        required
        requiredLabel={t('REQUIRED', 'Required')}
        value={formState.name ?? ''}
        onChange={(value) => set({ name: value })}
        error={nameMissing ? t('NAME_IS_REQUIRED', 'Name is required') : undefined}
        maxLength={100}
        autoComplete='off'
        disabled={disabled}
      />

      <div className='odc-mf-section'>
        {isShowBusinessSelect && (
          <SelectField
            label={t('BUSINESS', 'Business')}
            placeholder={t('ALL_BUSINESSES', 'All businesses')}
            options={toSelectOptions(filteredBusinessOptions)}
            value={formState.business_id === '' ? undefined : formState.business_id}
            valueLabel={pickedBusiness && String(pickedBusiness.value) === String(formState.business_id) ? pickedBusiness.label : undefined}
            onValueChange={(value, option) => {
              setPickedBusiness(option)
              set({ business_id: value })
            }}
            disabled={locked}
            hint={lockedHint} // redesign stores 5.18 (m7): the lock hint describes the trigger
            searchable
            searchLabel={searchTexts.searchLabel}
            clearSearchLabel={searchTexts.clearSearchLabel}
            noResultsLabel={searchTexts.noResultsLabel}
            searchValue={businessSearchValue}
            onSearchChange={setBusinessSearchValue}
            searchDelay={750} // redesign the legacy search bar waited 750 ms (lazyLoad), not a fetch per key
            loading={!!businessesLoading}
            loadingLabel={t('LOADING', 'Loading')}
            footer={businessFooter}
          />
        )}

        <div className='odc-mf-pair'>
          <SelectField
            label={t('SITE', 'Site')}
            placeholder={t('ALL_SITES', 'All sites')}
            options={toSelectOptions(filteredSitesOptions)}
            value={(formState.site_id === '' ? 'all' : formState.site_id) ?? 'all'}
            onValueChange={(value) => set({ site_id: value })}
            disabled={locked}
            hint={lockedHint}
            searchable
            searchLabel={searchTexts.searchLabel}
            clearSearchLabel={searchTexts.clearSearchLabel}
            noResultsLabel={searchTexts.noResultsLabel}
          />
          <SelectField
            label={t('DELIVERY_TYPE', 'Delivery type')}
            placeholder={t('ALL_DELIVERY_TYPES', 'All delivery types')}
            options={toSelectOptions(deliveryTypeOptions)}
            value={(formState.delivery_type === '' ? 'all' : formState.delivery_type) ?? 'all'}
            onValueChange={(value) => set({ delivery_type: value })}
            disabled={locked}
            hint={lockedHint}
          />
        </div>
      </div>

      <fieldset className='odc-mf-rounding' aria-describedby={roundingHintId}>
        <legend className='odc-mf-label'>{t('ROUNDING_VALUES', 'Rounding values')}</legend>
        <div className='odc-mf-rounding-list'>
          {(roundingOptions || []).map((option) => (
            <Checkbox
              key={String(option.value)}
              checked={rounding.some((value) => Number(value) === Number(option.value))}
              onCheckedChange={() => handleToggleRounding?.(option.value)}
              disabled={disabled}
            >
              {Number(option.value).toFixed(2)}
            </Checkbox>
          ))}
        </div>
        <p id={roundingHintId} className='odc-mf-hint'>
          {t('MARKUP_ROUNDING_HINT', 'Prices are rounded up to end in these cents.')}
        </p>
      </fieldset>

      <div className='odc-mf-section'>
        <h2 className='odc-mf-section-title'>{t('RULES', 'Rules')}</h2>
        <MarkupRule
          t={t}
          typeLabel={t('PRODUCTS_MARKUP_TYPE', 'Products markup type')}
          valueLabel={t('PRODUCTS_MARKUP_VALUE', 'Products markup value')}
          type={formState.products_markup_type}
          value={formState.products_markup_value}
          typeOptions={typeOptions}
          onTypeChange={changeType('products_markup_type')}
          onValueChange={(next) => set({ products_markup_value: next })}
          disabled={disabled}
        />

        <div className='odc-mf-checks'>
          <Checkbox
            checked={!!formState.apply_to_suboptions}
            onCheckedChange={(next) => setFormState((prev) => ({
              ...prev,
              apply_to_suboptions: next,
              apply_same_value: next ? prev.apply_same_value : false
            }))}
            disabled={disabled}
          >
            {t('APPLY_TO_SUBOPTIONS', 'Apply to suboptions')}
          </Checkbox>
          {formState.apply_to_suboptions && (
            <Checkbox
              checked={!!formState.apply_same_value}
              onCheckedChange={(next) => set({ apply_same_value: next })}
              disabled={disabled}
            >
              {t('APPLY_SAME_VALUE', 'Apply same value')}
            </Checkbox>
          )}
        </div>

        {formState.apply_to_suboptions && !formState.apply_same_value && (
          <MarkupRule
            t={t}
            typeLabel={t('SUBOPTIONS_MARKUP_TYPE', 'Suboptions markup type')}
            valueLabel={t('SUBOPTIONS_MARKUP_VALUE', 'Suboptions markup value')}
            type={formState.suboptions_markup_type}
            value={formState.suboptions_markup_value}
            typeOptions={typeOptions}
            onTypeChange={changeType('suboptions_markup_type')}
            onValueChange={(next) => set({ suboptions_markup_value: next })}
            disabled={disabled}
          />
        )}
      </div>

      {!hideActions && (
        <div className='odc-mf-actions'>
          <Button variant='primary' disabled={!!actionLoading} onClick={handleSubmit}>
            {actionLoading ? t('SAVING', 'Saving') : t('SAVE', 'Save')}
          </Button>
        </div>
      )}
    </div>
  )
}
