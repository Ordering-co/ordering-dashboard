import React, { useEffect, useRef, useState } from 'react'
import dayjs from 'dayjs'
import { useLanguage, useConfig, useUtils } from '../../../../../index'
import { Button, ChecklistPopover, DateRangePopover, FilterBar, FilterChips, SearchField } from '../../Shared/Product'
import { FilterPill } from '../../Shared/Product/FilterBar'
import { pillValue, withoutLeadingLabel } from '../../Shared/Product/filterValueText'
import { Calendar, MapPin, Store } from '../../Shared/Icon'
import { DAY, describeDateFormat, formatDay, formatVisibleDay } from '../../../../../utils/dateRange'
import { getDateTimeFormats } from '../../../../../utils/settingsCustomSections'
import { CustomerPill } from './CustomerPill'

// redesign OC-D (M-1, M-2, M-3, M-4): the filter bar of the open carts queue (plan.md, «Props entre piezas»).
// Search by cart number plus four pills (Business, Customer, City, Last activity) that each filter in their own popover, one
// chip per value and «Clear filters». It holds no filter state: it shows `filters` and reports each action once, as a partial
// of `{ businessIds, customerIds, cityIds, lastActivity: { from, to } }` through `onFiltersChange`. The controller decides
// what the search text means (it only looks at its digits) and turns the dates to UTC.

// The wait before the search text reaches the controller: each change of it is a request of the list and of the counters
const SEARCH_DEBOUNCE_MS = 500

const NO_ACTIVITY = { from: null, to: null }

const asList = (value) => (Array.isArray(value) ? value : [])
const isDate = (value) => value instanceof Date && !Number.isNaN(value.getTime())
const named = (list) => (id) => list.find(item => item?.id === id)?.name

const toggled = (ids, id) => (ids.includes(id) ? ids.filter(other => other !== id) : [...ids, id])

// ---- last activity: presets as local days -------------------------------------------------------------------------------
// A preset is a closed range of whole local days that ends today: «Last 7 days» is today and the six days before it. The
// controller turns the Dates to UTC for the API (`updated_at`).
const PRESETS = ['today', 'yesterday', 'last7', 'last30']
const DAYS_BACK = { today: 0, yesterday: 1, last7: 6, last30: 29 }

// redesign OC-F1 (OC-Q1-06): own keys. The shared LAST_7_DAYS carries a typo in the API's runtime catalog («Last 7 dyas»), and a
// runtime catalog wins over the default text, so these presets cannot lean on the shared keys.
const presetsOf = (t) => [
  { value: 'today', label: t('OPEN_CARTS_RANGE_TODAY', 'Today') },
  { value: 'yesterday', label: t('OPEN_CARTS_RANGE_YESTERDAY', 'Yesterday') },
  { value: 'last7', label: t('OPEN_CARTS_RANGE_LAST_7_DAYS', 'Last 7 days') },
  { value: 'last30', label: t('OPEN_CARTS_RANGE_LAST_30_DAYS', 'Last 30 days') }
]

const presetRange = (key, now) => {
  const first = now.subtract(DAYS_BACK[key], 'day').startOf('day').toDate()
  const last = (key === 'yesterday' ? now.subtract(1, 'day') : now).endOf('day').toDate()
  return { from: first, to: last }
}

/** The preset a range is exactly, 'term' for any other range, 'default' for none. */
const presetOf = (activity, now) => {
  if (!isDate(activity.from) && !isDate(activity.to)) return 'default'
  return PRESETS.find(key => {
    const range = presetRange(key, now)
    return activity.from?.getTime() === range.from.getTime() && activity.to?.getTime() === range.to.getTime()
  }) || 'term'
}

const dayString = (date) => (isDate(date) ? dayjs(date).format(DAY) : null)
const startOfDay = (day) => dayjs(day, DAY).startOf('day').toDate()
const endOfDay = (day) => dayjs(day, DAY).endOf('day').toDate()

/**
 * The Last activity pill: the brand date range, with the presets and a custom range that applies once, on «Done».
 */
const LastActivityPill = ({ label, activity, now, onChange, t, dateFormat, parseDate, locale }) => {
  const from = dayString(activity.from)
  const to = dayString(activity.to)
  const preset = presetOf(activity, now)
  const presets = presetsOf(t)
  const text = activityText({ activity, preset, presets, t, dateFormat, parseDate })

  const labels = {
    title: t('SELECT_DATE', 'Select a date'),
    presets: label,
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

  return (
    <DateRangePopover
      presets={presets}
      presetValue={preset}
      from={from}
      to={to}
      dateFormat={dateFormat}
      triggerText={text || label}
      empty={!text}
      labels={labels}
      locale={locale}
      align='start'
      onPreset={(key) => onChange(presetRange(key, dayjs(now)))}
      // a range is a draft until «Done» (onApplyRange), so the popover never reports it piece by piece
      onRange={() => {}}
      onApplyRange={({ from: nextFrom, to: nextTo }) => onChange({
        from: nextFrom ? startOfDay(nextFrom) : null,
        to: nextTo ? endOfDay(nextTo) : null
      })}
      renderTrigger={({ ref, expanded, toggle }) => (
        <span ref={ref} className='odc-orders-pill-anchor'>
          <FilterPill
            icon={Calendar}
            label={label}
            value={text}
            priority='secondary'
            hasPopup='dialog'
            expanded={expanded}
            onClick={toggle}
          />
        </span>
      )}
    />
  )
}

/** What the pill and its chip say about the range: the preset's name, or the days in the project's date format. */
const activityText = ({ activity, preset, presets, t, dateFormat, parseDate }) => {
  const known = presets.find(item => item.value === preset)
  if (known) return known.label
  const from = dayString(activity.from)
  const to = dayString(activity.to)
  if (!from && !to) return ''
  const spec = describeDateFormat(dateFormat)
  const shown = (day) => (parseDate ? formatVisibleDay(day, parseDate) : formatDay(day, spec))
  if (from && to) return `${shown(from)} – ${shown(to)}`
  if (from) return `${t('FROM', 'From')} ${shown(from)}`
  return `${t('TO', 'To')} ${shown(to)}`
}

/**
 * Filter bar of the open carts queue. `search` is the text the controller holds; `filters` the active filters;
 * `businesses` and `cities` come from `GET /controls/orders`.
 */
export const QueueFilters = ({
  search = '',
  onSearchChange,
  filters: filterValues,
  onFiltersChange,
  onClearFilters,
  businesses,
  cities
}) => {
  const [languageState, t] = useLanguage()
  const [{ configs }] = useConfig()
  const [{ parseDate } = {}] = useUtils() || []
  const dateFormat = getDateTimeFormats(configs?.dates_general_format?.value).dateFormat

  const filters = {
    businessIds: asList(filterValues?.businessIds),
    customerIds: asList(filterValues?.customerIds),
    cityIds: asList(filterValues?.cityIds),
    lastActivity: {
      from: isDate(filterValues?.lastActivity?.from) ? filterValues.lastActivity.from : null,
      to: isDate(filterValues?.lastActivity?.to) ? filterValues.lastActivity.to : null
    }
  }
  const businessList = asList(businesses)
  // /controls/orders gives the cities as a list; an older shape wraps them in { cities }
  const cityList = asList(Array.isArray(cities) ? cities : cities?.cities)
  const change = (partial) => onFiltersChange?.(partial)

  // ---- search: typed here, sent after a wait (or at once on Enter), as the raw text -------------------------------------
  // The controller keeps the text and reads its digits; a value set from outside (clear filters) shows unless the user is typing.
  const [searchText, setSearchText] = useState(search || '')
  const searchTimer = useRef(null)
  const searchInput = useRef(null)
  const sentSearch = useRef(search || '')
  sentSearch.current = search || ''
  useEffect(() => {
    if (!search) {
      setSearchText('')
      return
    }
    if (typeof document !== 'undefined' && document.activeElement !== searchInput.current) setSearchText(search)
  }, [search])
  useEffect(() => () => clearTimeout(searchTimer.current), [])
  const sendSearch = (text) => {
    clearTimeout(searchTimer.current)
    if (text !== sentSearch.current) onSearchChange?.(text)
  }
  const typeSearch = (text) => {
    setSearchText(text)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => sendSearch(text), SEARCH_DEBOUNCE_MS)
  }
  const attachSearchInput = (node) => {
    searchInput.current = node
    // SearchField does not pass `inputMode` to its input: the digits keypad of a phone is set on the node
    node?.setAttribute('inputmode', 'numeric')
  }

  // ---- names: the customers' come from searches that later change, so the bar keeps the ones it has seen --------------
  const [customerNames, setCustomerNames] = useState({})
  const businessName = named(businessList)
  const cityName = named(cityList)
  const customerName = (id) => customerNames[id]

  const labels = {
    business: t('BUSINESS', 'Business'),
    customer: t('CUSTOMER', 'Customer'),
    city: t('CITY', 'City'),
    lastActivity: t('LAST_ACTIVITY', 'Last activity')
  }
  const pill = (label, ids, nameOf) => withoutLeadingLabel(label, pillValue(ids, nameOf))

  const now = dayjs()
  const preset = presetOf(filters.lastActivity, now)
  const activityValue = activityText({
    activity: filters.lastActivity,
    preset,
    presets: presetsOf(t),
    t,
    dateFormat,
    parseDate
  })

  const hasFilters = Boolean(
    (search || '').trim() ||
    filters.businessIds.length ||
    filters.customerIds.length ||
    filters.cityIds.length ||
    activityValue
  )
  const clearText = t('CLEAR_FILTERS', 'Clear filters')

  // ---- chips: one per value ---------------------------------------------------------------------------------------------
  const chips = (() => {
    const entries = []
    const add = (key, name, value, patch) => entries.push({
      key,
      label: `${name}: ${value}`,
      removeLabel: t('REMOVE_FILTER', 'Remove _filter_ filter').replace('_filter_', `${name} ${value}`),
      onRemove: () => onFiltersChange?.(patch)
    })
    const values = (key, name, ids, nameOf, patchKey) => ids.forEach(id => {
      add(`${key}-${id}`, name, withoutLeadingLabel(name, String(nameOf(id) ?? id)), { [patchKey]: ids.filter(other => other !== id) })
    })
    values('business', labels.business, filters.businessIds, businessName, 'businessIds')
    values('customer', labels.customer, filters.customerIds, customerName, 'customerIds')
    values('city', labels.city, filters.cityIds, cityName, 'cityIds')
    if (activityValue) add('lastActivity', labels.lastActivity, activityValue, { lastActivity: NO_ACTIVITY })
    return entries
  })()

  const searchNode = (
    <SearchField
      value={searchText}
      onChange={typeSearch}
      onClear={() => sendSearch('')}
      onKeyDown={(event) => { if (event.key === 'Enter') sendSearch(searchText) }}
      inputRef={attachSearchInput}
      label={t('SEARCH_CART_NUMBER', 'Search cart number')}
      placeholder={t('SEARCH_CART_NUMBER', 'Search cart number')}
      clearLabel={t('CLEAR_SEARCH', 'Clear search')}
    />
  )

  const searchProps = {
    searchLabel: t('SEARCH', 'Search'),
    clearSearchLabel: t('CLEAR_SEARCH', 'Clear search'),
    loadingLabel: `${t('LOADING', 'Loading')}...`,
    noResultsLabel: t('NO_RESULTS_FOUND', 'No results found'),
    clearLabel: t('CLEAR', 'Clear')
  }

  const pills = (
    <>
      <ChecklistPopover
        icon={Store}
        label={labels.business}
        value={pill(labels.business, filters.businessIds, businessName)}
        priority='secondary'
        items={businessList.map(business => ({ id: business.id, name: business.name ?? '', photo: business.logo }))}
        selected={filters.businessIds}
        onToggle={(id) => change({ businessIds: toggled(filters.businessIds, id) })}
        onClear={() => change({ businessIds: [] })}
        avatars='business'
        {...searchProps}
      />
      <CustomerPill
        label={labels.customer}
        value={pill(labels.customer, filters.customerIds, customerName)}
        selected={filters.customerIds}
        names={customerNames}
        onChange={(ids, learned) => {
          setCustomerNames(current => ({ ...current, ...learned }))
          change({ customerIds: ids })
        }}
      />
      <ChecklistPopover
        icon={MapPin}
        label={labels.city}
        value={pill(labels.city, filters.cityIds, cityName)}
        priority='secondary'
        items={cityList.map(city => ({ id: city.id, name: city.name ?? '' }))}
        selected={filters.cityIds}
        onToggle={(id) => change({ cityIds: toggled(filters.cityIds, id) })}
        onClear={() => change({ cityIds: [] })}
        {...searchProps}
      />
      <LastActivityPill
        label={labels.lastActivity}
        activity={filters.lastActivity}
        now={now}
        onChange={(range) => change({ lastActivity: range })}
        t={t}
        dateFormat={dateFormat}
        parseDate={parseDate}
        locale={languageState?.language?.code}
      />
    </>
  )

  return (
    <FilterBar
      flush
      label={t('CART_FILTERS', 'Cart filters')}
      // the pills that do not fit go to «+N»; its name says how many, and how many of them hold a value
      overflowLabel={(count) => `+${count} ${t('MORE_FILTERS', 'more filters')}`}
      overflowActiveLabel={(count) => t('FILTERS_ACTIVE_COUNT', '_count_ active').replace('_count_', count)}
      // the row keeps the room of «Clear filters» even with no filter on, so the first filter never moves the bar
      clearReserve={clearText}
      search={searchNode}
      filters={pills}
      clear={hasFilters ? <Button variant='ghost' onClick={() => onClearFilters?.()}>{clearText}</Button> : undefined}
      chips={chips.length > 0
        ? (
          <FilterChips
            label={t('FILTERS_ACTIVE', 'Active filters')}
            clearAllLabel={clearText}
            onClearAll={() => onClearFilters?.()}
            chips={chips}
          />
          )
        : undefined}
    />
  )
}
