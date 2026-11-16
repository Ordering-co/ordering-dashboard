import React, { useEffect, useRef, useState } from 'react'
import { useLanguage, useConfig, useUtils } from '../../../../../index'
import {
  Button,
  DateRangePopover,
  FilterBar,
  FilterChips,
  FilterPill,
  FilterPopover,
  RadioGroup,
  SearchField,
  SegmentedControl
} from '../../Shared/Product'
import { pillValue } from '../../Shared/Product/filterValueText'
import { Calendar, CircleCheck, SlidersHorizontal, Star } from '../../Shared/Icon'
import { describeDateFormat, formatDay, formatVisibleDay } from '../../../../../utils/dateRange'
import { getDateTimeFormats } from '../../../../../utils/settingsCustomSections'
import { UsersFilterSheet } from './UsersFilterSheet'
import {
  SHEET_KEYS,
  activeFilterChips,
  clearFilterKey,
  completeFilterValues,
  hasActiveFilters,
  rangeToValues,
  sheetActiveCount,
  signUpPresetToValues,
  signUpPresetsOf,
  signUpText
} from './userFilters'
import './users-filter-bar.css'

// redesign UC-B3 (decisions 2 and 3; M-C2, M-C6, M-C7): the one-row filter bar of the customers list. It holds no filter state:
// it shows what K/UsersList holds (`searchValue`, `orderFilterValue`, `multiFilterValues`) and reports each action once. Every
// write of `multiFilterValues` is a COMPLETE object: the controller turns any key that is not null into a condition.
// redesign BO-B2 (promotion): moved from CustomersDirectory/CustomersFilters.jsx. New props, each defaulting to what the customers
// list has today: `showOrders` (the Orders segmented control), `sheetKeys` (the fields of the «Filters» sheet, in order; its count
// and its «Clear» only cover them), `searchLabel` and `barLabel` (`{ key, text }`: a translation key with its default text; a
// plain string is taken as already translated).
// redesign (B1b): `showLoyalty` (default true) is opt-in off: the professionals list has no Loyalty level, so with `false`
// neither its pill nor its chip is drawn.

const SEARCH_LABEL = { key: 'CUSTOMERS_SEARCH', text: 'Search name, email or phone' }
const BAR_LABEL = { key: 'CUSTOMERS_FILTER_BAR', text: 'Customer filters' }
const labelOf = (t, label) => (typeof label === 'string' ? label : t(label.key, label.text))

// The wait before the search text reaches the controller, as the search of today: each change of it is a request of the list
const SEARCH_DEBOUNCE_MS = 750

// The Orders control: the four buttons of today. The values are text for the control; the controller keeps null, 0, 1 or 5.
const ORDER_OPTIONS = [
  { key: 'all', value: null, labelKey: 'ALL', label: 'All' },
  { key: '0', value: 0, labelKey: 'NO_ORDERS', label: 'No orders' },
  { key: '1', value: 1, labelKey: 'WITH_ORDERS', label: 'With orders' },
  { key: '5', value: 5, labelKey: 'WITH_5_ORDERS', label: 'With 5+ orders' }
]
const orderKeyOf = (value) => (value === null || value === undefined ? 'all' : String(value))

const TRI_STATE = { any: null, yes: true, no: false }
const triKeyOf = (value) => (value === true ? 'yes' : value === false ? 'no' : 'any')

const dayOf = (datetime) => (datetime ? String(datetime).slice(0, 10) : null)

export const UsersFilterBar = ({
  searchValue = '',
  onSearch,
  orderFilterValue: orderFilterProp = null,
  onOrderFilterChange,
  multiFilterValues,
  onMultiFilterChange,
  loyaltyLevels,
  onClearAll,
  showOrders = true,
  showLoyalty = true,
  sheetKeys = SHEET_KEYS,
  searchLabel: searchLabelProp = SEARCH_LABEL,
  barLabel = BAR_LABEL
}) => {
  // with no Orders control on the page, a value of it held elsewhere does not narrow anything here
  const orderFilterValue = showOrders ? orderFilterProp : null
  const [languageState, t] = useLanguage()
  const [{ configs }] = useConfig()
  const [{ parseDate } = {}] = useUtils() || []
  const dateFormat = getDateTimeFormats(configs?.dates_general_format?.value).dateFormat
  const [sheetOpen, setSheetOpen] = useState(false)

  const values = completeFilterValues(multiFilterValues)
  const levels = Array.isArray(loyaltyLevels?.levels) ? loyaltyLevels.levels : []
  const write = (change) => onMultiFilterChange?.(completeFilterValues(multiFilterValues, change))

  // the days in the project format, as the list writes them (never ISO)
  const spec = describeDateFormat(dateFormat)
  const formatDate = (day) => (parseDate ? formatVisibleDay(day, parseDate) : formatDay(day, spec))

  // ---- search: typed here, sent after a wait (at once on Enter and on clear) ----------------------------------------------
  const [searchText, setSearchText] = useState(searchValue || '')
  const searchTimer = useRef(null)
  const searchInput = useRef(null)
  const sentSearch = useRef(searchValue || '')
  sentSearch.current = searchValue || ''
  // a value set from outside (⌘K, «Clear filters») shows unless the user is typing
  useEffect(() => {
    if (!searchValue) {
      setSearchText('')
      return
    }
    if (typeof document !== 'undefined' && document.activeElement !== searchInput.current) setSearchText(searchValue)
  }, [searchValue])
  useEffect(() => () => clearTimeout(searchTimer.current), [])
  const sendSearch = (text) => {
    clearTimeout(searchTimer.current)
    if (text !== sentSearch.current) onSearch?.(text)
  }
  const typeSearch = (text) => {
    setSearchText(text)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => sendSearch(text), SEARCH_DEBOUNCE_MS)
  }

  const searchLabel = labelOf(t, searchLabelProp)
  const searchNode = (
    <SearchField
      value={searchText}
      onChange={typeSearch}
      onClear={() => sendSearch('')}
      onKeyDown={(event) => { if (event.key === 'Enter') sendSearch(searchText) }}
      inputRef={searchInput}
      label={searchLabel}
      placeholder={searchLabel}
      clearLabel={t('CLEAR_SEARCH', 'Clear search')}
    />
  )

  // ---- pills ------------------------------------------------------------------------------------------------------------
  const yes = t('YES', 'Yes')
  const no = t('NO', 'No')
  const triOptions = [
    { value: 'any', label: t('ANY', 'Any') },
    { value: 'yes', label: yes },
    { value: 'no', label: no }
  ]
  const triText = (label, value) => (value === null || value === undefined ? '' : `${label}: ${value ? yes : no}`)
  const phoneLabel = t('PHONE', 'Phone')
  const emailLabel = t('EMAIL', 'Email')
  const verifiedText = [triText(phoneLabel, values.phoneVerified), triText(emailLabel, values.emailVerified)].filter(Boolean).join(', ')

  const signUpLabel = t('SIGN_UP_DATE', 'Sign up date')
  const signUp = signUpText(values, { t, formatDate })
  const isTerm = values.dateType === 'term' || (values.dateType == null && Boolean(signUp))
  const presets = signUpPresetsOf(t)
  const dateLabels = {
    title: t('SELECT_DATE', 'Select a date'),
    presets: signUpLabel,
    close: t('CLOSE', 'Close'),
    done: t('DONE', 'Done'),
    from: t('FROM', 'From'),
    to: t('TO', 'To'),
    today: t('TODAY', 'Today'),
    goToToday: t('DATE_RANGE_GO_TO_TODAY', 'Go to today'),
    previousMonth: t('PREVIOUS_MONTH', 'Previous month'),
    nextMonth: t('NEXT_MONTH', 'Next month'),
    rangeOrder: t('DATE_RANGE_ORDER', 'The start date must not be after the end date.'),
    invalidDate: (format) => t('DATE_RANGE_INVALID', 'Enter a real date as _format_.').replace('_format_', format)
  }

  const loyaltyLabel = t('LOYALTY_LEVEL', 'Loyalty level')
  const levelName = (id) => levels.find(level => String(level.id) === String(id))?.name
  const loyaltyText = pillValue(values.loyaltyLevel === null ? [] : [values.loyaltyLevel], levelName)

  // redesign UC-R1 (I-02): the Orders control is NOT one of the bar's pills. It always holds one option, so as a pill it was
  // «active» without a filter («+4 · 1 active»), it was parked in «+N» (a segmented control cannot work there) and at 390 it
  // lay over the pills. It has its own row before the bar, marked active only while an option other than «All» is chosen.
  const ordersControl = (
    <div className='odc-cf-orders' data-active={orderFilterValue === null || orderFilterValue === undefined ? undefined : ''}>
      <SegmentedControl
        label={t('ORDERS', 'Orders')}
        value={orderKeyOf(orderFilterValue)}
        onValueChange={(key) => onOrderFilterChange?.(ORDER_OPTIONS.find(option => option.key === key)?.value ?? null)}
        options={ORDER_OPTIONS.map(option => ({ value: option.key, label: t(option.labelKey, option.label) }))}
      />
    </div>
  )

  const filters = (
    <>
      <FilterPopover icon={CircleCheck} label={t('VERIFIED', 'Verified')} value={verifiedText} priority='secondary'>
        <div className='odc-cf-verified'>
          <RadioGroup
            label={phoneLabel}
            options={triOptions}
            value={triKeyOf(values.phoneVerified)}
            onValueChange={(key) => write({ phoneVerified: TRI_STATE[key] })}
          />
          <RadioGroup
            label={emailLabel}
            options={triOptions}
            value={triKeyOf(values.emailVerified)}
            onValueChange={(key) => write({ emailVerified: TRI_STATE[key] })}
          />
        </div>
      </FilterPopover>
      <DateRangePopover
        presets={presets}
        presetValue={values.dateType || (isTerm ? 'term' : 'default')}
        from={isTerm ? dayOf(values.deliveryFromDatetime) : null}
        to={isTerm ? dayOf(values.deliveryEndDatetime) : null}
        dateFormat={dateFormat}
        triggerText={signUp || signUpLabel}
        empty={!signUp}
        labels={dateLabels}
        locale={languageState?.language?.code}
        align='start'
        onPreset={(preset) => write(signUpPresetToValues(preset))}
        // a custom range is a draft until «Done» (onApplyRange): the popover never reports it piece by piece
        onRange={() => {}}
        onApplyRange={({ from, to }) => write(rangeToValues(from, to))}
        renderTrigger={({ ref, expanded, toggle }) => (
          <span ref={ref} className='odc-orders-pill-anchor'>
            <FilterPill
              icon={Calendar}
              label={signUpLabel}
              value={signUp}
              priority='secondary'
              hasPopup='dialog'
              expanded={expanded}
              onClick={toggle}
            />
          </span>
        )}
      />
      {showLoyalty && (
        <FilterPopover icon={Star} label={loyaltyLabel} value={loyaltyText} priority='secondary'>
          <div className='odc-cf-verified'>
            {loyaltyLevels?.loading
              ? <p role='status' className='odc-cf-hint'>{`${t('LOADING', 'Loading')}...`}</p>
              : (
                <RadioGroup
                  label={loyaltyLabel}
                  options={[{ value: 'any', label: t('ANY', 'Any') }, ...levels.map(level => ({ value: String(level.id), label: level.name ?? '' }))]}
                  value={values.loyaltyLevel === null ? 'any' : String(values.loyaltyLevel)}
                  // the id keeps the type the API gave it (a number): the controller sends it as the condition
                  onValueChange={(key) => write({ loyaltyLevel: key === 'any' ? null : levels.find(level => String(level.id) === key)?.id ?? key })}
                />
                )}
          </div>
        </FilterPopover>
      )}
    </>
  )

  // ---- «Filters»: the sheet with the fields of the old modal, named, with the count of what it holds (M-C6) ----------------
  const sheetCount = sheetActiveCount(values, sheetKeys)
  const more = (
    <Button
      icon={SlidersHorizontal}
      aria-haspopup='dialog'
      aria-expanded={sheetOpen}
      onClick={() => setSheetOpen(true)}
    >
      {t('FILTERS', 'Filters')}
      {sheetCount > 0 && <span className='odc-figure odc-cf-count' data-filterbar-count=''>{sheetCount}</span>}
    </Button>
  )

  // ---- chips: one per active value, and «Clear filters» (M-C7) --------------------------------------------------------------
  const clearText = t('CLEAR_FILTERS', 'Clear filters')
  // redesign UC-R2b (Q-04): both «Clear filters» buttons leave the page with the filters; the focus goes to the first control of the
  // bar (the search) before they do, so it never falls to <body>
  const clearAll = () => {
    onClearAll?.()
    searchInput.current?.focus()
  }
  const narrowing = hasActiveFilters({ searchValue: searchText || searchValue, orderFilterValue, multiFilterValues: values })
  const chips = activeFilterChips(values, { t, loyaltyLevels, formatDate }).filter(chip => showLoyalty || chip.key !== 'loyaltyLevel')

  return (
    <>
      <div className='odc-cf-block'>
        {showOrders && ordersControl}
        <FilterBar
          flush
          label={labelOf(t, barLabel)}
          // the pills that do not fit go to «+N»; its name says how many, and how many of them hold a value
          overflowLabel={(count) => `+${count} ${t('MORE_FILTERS', 'more filters')}`}
          overflowActiveLabel={(count) => t('FILTERS_ACTIVE_COUNT', '_count_ active').replace('_count_', count)}
          // the row keeps the room of «Filters» (with its longest count) and of «Clear filters» even with no filter on,
          // so the first filter never moves the bar
          moreReserve='99'
          clearReserve={clearText}
          search={searchNode}
          filters={filters}
          more={more}
          clear={narrowing ? <Button variant='ghost' onClick={clearAll}>{clearText}</Button> : undefined}
          chips={chips.length > 0
            ? (
              <FilterChips
                label={t('FILTERS_ACTIVE', 'Active filters')}
                clearAllLabel={clearText}
                onClearAll={clearAll}
                chips={chips.map(chip => ({
                  key: chip.key,
                  label: chip.label,
                  removeLabel: t('REMOVE_FILTER', 'Remove _filter_ filter').replace('_filter_', chip.label),
                  onRemove: () => onMultiFilterChange?.(clearFilterKey(multiFilterValues, chip.key))
                }))}
              />
              )
            : undefined}
        />
      </div>
      <UsersFilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        multiFilterValues={values}
        onApply={(next) => onMultiFilterChange?.(next)}
        sheetKeys={sheetKeys}
        showOrders={showOrders}
      />
    </>
  )
}
