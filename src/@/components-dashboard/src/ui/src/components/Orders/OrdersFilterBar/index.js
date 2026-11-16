import React, { useContext, useEffect, useRef, useState } from 'react'
import { useHistory } from 'react-router-dom'
import { useLanguage, useConfig, useUtils } from '../../../../../index'
import { SETTINGS_SLA_PATH } from '../../../../../utils/settingsExternalEditors'
import { ConfigFileContext } from '../../../contexts/ConfigFileContext'
import { useFilterValues } from '../../../contexts/FilterValuesContext'
import { useLegacyPlanUpgrade } from '../../../contexts/LegacyPlanUpgradeContext'
import { useIsPathHiddenByReadOnly } from '../../../hooks/useIsPathHiddenByReadOnly'
import { Button, FilterBar, FilterChips, InlineNotice, Menu, SearchField } from '../../Shared/Product'
import { SlidersHorizontal, TriangleAlert } from '../../Shared/Icon'
import { OrdersFilterGroup } from '../OrdersFilterGroup'
import {
  hasActiveOrdersNarrowing,
  hasActiveSubStatus,
  clearOrdersNarrowing
} from '../OrdersFilterGroup/activeFilters'
import { pillValue, withoutLeadingLabel } from '../../Shared/Product/filterValueText' // redesign W0-2a (T0-4)
import { OrdersHeaderFilterGroup } from '../OrdersHeaderFilterGroup'
import { SubStatusPill, getSubOrderStatuses, nextSelectedSubOrderStatus } from '../OrderStatusSubFilter'
import { formatVisibleDay, dayOf } from '../../../../../utils/dateRange'
import { OrdersDateBusinessPills } from './DateBusinessPills'
import { limitOrderSearchInput } from '../../../../../components/DashboardOrdersList/orderSearchInput'
import { summarizeIds } from '../../Shared/Product/FilterPopover' // redesign W0-2a (T0-4)
import './orders-filter-bar.css'

// The same wait the old SearchBar used with `lazyLoad`.
const SEARCH_DEBOUNCE_MS = 750

const named = (list, key) => (id) => list?.find(item => item?.[key ?? 'id'] === id)?.name

const isSet = (value) => value !== undefined && value !== null && value !== ''

// redesign fix-qa C3 (B12): the days are written in the project's date format, like the range field, not ISO.
// redesign tramo A r5 (W0-QA3-02, decision 13): and with no project format, in the visible default («01 Sep 2026»), never ISO: the
// same `parseDate` as the list. What goes to the API and the URL stays ISO (this is only the text).
const dateLabel = (filterValues, t, parseDate) => {
  const { dateType, deliveryFromDatetime: from, deliveryEndDatetime: end } = filterValues
  const day = (value) => formatVisibleDay(dayOf(value), parseDate) || String(value)
  switch (dateType) {
    case 'today': return t('TODAY', 'Today')
    case 'yesterday': return t('YESTERDAY', 'Yesterday')
    case 'last7': return t('LAST_7_DAYS', 'Last 7 days')
    case 'last30': return t('LAST_30_DAYS', 'Last 30 days')
    case 'term':
      if (from && end) return `${day(from)} – ${day(end)}`
      if (from) return `${t('FROM', 'From')} ${day(from)}`
      if (end) return `${t('TO', 'To')} ${day(end)}`
      return ''
    default: return ''
  }
}

/**
 * One chip per active filter of the shared context: `name` and `value` read well
 * together, `patch` is what removing it changes. Keys that no screen sets (statuses,
 * groupTypes, driverGroupIds) have no chip; they still count for the «Filters applied»
 * notice, which uses activeFilters.js.
 */
export const buildActiveFilters = ({ filterValues, t, labels, lists, parseDate, subStatus }) => {
  const entries = []
  const countText = (count) => t('FILTER_VALUES_SELECTED', '_count_ selected').replace('_count_', count)
  // `stripLabel`: a group name from the API may already start with the label («Driver Group: Shipday»).
  const ids = (key, name, nameOf, stripLabel) => {
    const summary = summarizeIds(filterValues[key], nameOf, countText)
    const value = stripLabel ? withoutLeadingLabel(stripLabel, summary) : summary
    if (value) entries.push({ key, name, value, patch: { [key]: [] } })
  }
  const text = (key, name, value = filterValues[key]) => {
    if (isSet(value)) entries.push({ key, name, value: String(value), patch: { [key]: null } })
  }
  const fullName = (list) => (id) => {
    const item = list?.find(entry => entry.id === id)
    return item ? `${item.name} ${item.lastname ?? ''}`.trim() : undefined
  }
  const options = (pairs) => (id) => pairs.find(([value]) => value === id)?.[1]

  // redesign F6c-2 (Q2-01): the Status sub filter of the tab (not «all») is a filter like the others; its
  // chip is removed by putting the sub status back to «all» (`reset`), not by a patch of the shared values.
  if (subStatus && hasActiveSubStatus(subStatus)) {
    const group = getSubOrderStatuses(t)[subStatus.ordersStatusGroup]
    const value = summarizeIds(
      subStatus.selectedSubOrderStatus[subStatus.ordersStatusGroup],
      (key) => group.find(status => status.key === key)?.value,
      countText
    )
    entries.push({ key: 'subStatus', name: labels.status, value, reset: true })
  }
  text('orderId', labels.orderId)
  text('externalId', labels.externalId)
  const date = dateLabel(filterValues, t, parseDate)
  if (date) {
    entries.push({
      key: 'date',
      name: labels.date,
      value: date,
      patch: { dateType: null, deliveryFromDatetime: null, deliveryEndDatetime: null }
    })
  }
  ids('businessIds', labels.business, named(lists.businesses))
  ids('cityIds', labels.city, named(Array.isArray(lists.cities) ? lists.cities : lists.cities?.cities))
  ids('countryCode', labels.country, (code) => code)
  ids('currency', labels.currency, (code) => code)
  ids('deliveryTypes', labels.deliveryType, options([
    [1, t('DELIVERY', 'Delivery')],
    [2, t('PICKUP', 'Pickup')],
    [3, t('EAT_IN', 'Eat in')],
    [4, t('CURBSIDE', 'Curbside')],
    [5, t('DRIVE_THRU', 'Drive thru')],
    [7, t('CATERING_DELIVERY', 'Catering delivery')],
    [8, t('CATERING_PICKUP', 'Catering pickup')],
    [9, t('RESERVATIONS', 'Reservation')]
  ]))
  ids('paymethodIds', labels.paymethod, named(lists.paymethods))
  ids('administratorIds', labels.administrator, fullName(lists.admins))
  ids('driverIds', labels.driver, fullName(lists.drivers))
  ids('driverGroupBusinessIds', labels.driverGroupAssignable, named(lists.assignableGroups), labels.driverGroupAssignable)
  ids('groupTypesUnassigned', labels.driverGroupAssigned, named(lists.groups), labels.driverGroupAssignable)
  text('customerName', labels.customerName)
  text('customerLastname', labels.customerLastname)
  text('customerEmail', labels.customerEmail)
  text('customerCellphone', labels.customerCellphone)
  text('coupon', labels.coupon)
  text('offerId', labels.offerId)
  if (isSet(filterValues.assigned)) {
    const value = filterValues.assigned === 0 ? t('ASSIGNED', 'Assigned') : t('UNASSIGNED', 'Unassigned')
    entries.push({ key: 'assigned', name: labels.driverStatus, value, patch: { assigned: null } })
  }
  if (isSet(filterValues.logisticStatus)) {
    const value = options([
      [0, t('PENDING', 'Pending')],
      [1, t('IN_PROGRESS', 'In progress')],
      [2, t('IN_QUEUE', 'In queue')],
      [3, t('EXPIRED', 'Expired')],
      [4, t('RESOLVED', 'Resolved')]
    ])(filterValues.logisticStatus) ?? String(filterValues.logisticStatus)
    entries.push({ key: 'logisticStatus', name: labels.logisticStatus, value, patch: { logisticStatus: null } })
  }
  if (isSet(filterValues.fraudStatus)) {
    const value = options([
      ['invalid', t('FRAUD_DECLINED', 'Declined')],
      ['error', t('FRAUD_FAIL_OPEN', 'Fail-open')]
    ])(filterValues.fraudStatus) ?? String(filterValues.fraudStatus)
    entries.push({ key: 'fraudStatus', name: labels.fraudStatus, value, patch: { fraudStatus: null } })
  }
  if (isSet(filterValues.timeStatus)) {
    entries.push({
      key: 'timeStatus',
      name: labels.sla,
      value: labels.slaValues[filterValues.timeStatus] ?? String(filterValues.timeStatus),
      patch: { timeStatus: null },
      isSla: true
    })
  }
  ;(filterValues.metafield || []).filter(item => item?.key).forEach(item => {
    entries.push({
      key: `metafield-${item.id}`,
      name: item.key,
      value: item.value ? String(item.value) : '',
      patch: { metafield: filterValues.metafield.filter(other => other.id !== item.id) }
    })
  })
  return entries
}

/**
 * SLA as a menu (C10): the same values and effects as OrdersDashboardSLAControls. The four values
 * are one choice (`type: 'radio'`, the current one `checked`, so a screen reader hears it); «SLA
 * settings» is an action and stays a plain item.
 */
const SlaMenu = ({ filterValues, handleFilterValues, setTimeStatus, label, valueLabels, t }) => {
  const history = useHistory()
  const { requestUpgrade } = useLegacyPlanUpgrade()
  // (R-4): a read-only admin cannot open Settings, so it is not offered «SLA settings» (nor its separator)
  const hideSlaSettings = useIsPathHiddenByReadOnly(SETTINGS_SLA_PATH)
  const active = filterValues?.timeStatus
  const change = (value) => {
    if (value === 'sla_settings') {
      const openSettings = () => history.push(SETTINGS_SLA_PATH)
      if (!requestUpgrade(undefined, openSettings)) openSettings()
      return
    }
    const timeStatus = value === 'default' ? null : value
    handleFilterValues?.({ ...filterValues, timeStatus })
    setTimeStatus?.(timeStatus)
  }
  const choice = (key, itemLabel) => ({
    key,
    label: itemLabel,
    type: 'radio',
    checked: key === 'default' ? !active : active === key,
    onSelect: () => change(key)
  })
  const items = [
    choice('default', t('ALL', 'All')),
    choice('in_time', valueLabels.in_time),
    choice('at_risk', valueLabels.at_risk),
    choice('delayed', valueLabels.delayed),
    ...(hideSlaSettings
      ? []
      : [{ key: 'sla_settings', label: t('SLA_SETTING', 'SLA settings'), separatorBefore: true, onSelect: () => change('sla_settings') }])
  ]
  return (
    <Menu
      // redesign F6c-2 (Q2-15): «Label · value», the same words as the other pills.
      label={active ? `${label} · ${valueLabels[active] ?? active}` : label}
      items={items}
      triggerVariant='ghost'
      align='start'
      triggerProps={active ? { 'data-active': '' } : undefined}
      className={active ? 'odc-orders-menu-pill odc-orders-menu-pill-on' : 'odc-orders-menu-pill'}
    />
  )
}

/**
 * Filter bar of the orders list (C7): search, quick filter pills, «Filters (n)»
 * with the sheet, one chip per active filter, and the inline «filters applied»
 * notice. It takes what OrdersContentHeader used to give its four filter widgets,
 * plus the sub status of the tab. `toolsSlot` leaves an empty `#orders-list-tools`
 * for the list to portal its tools into; `tools` is a node placed there too.
 */
export const OrdersFilterBar = (props) => {
  const {
    isSelectedOrders,
    searchValue,
    handleChangeSearch,
    handleChangeFilterValues,
    driverGroupList,
    assignableDriverGroupList,
    driversList,
    paymethodsList,
    businessesList,
    citiesList,
    adminsList,
    disableSocketRoomDriver,
    setTimeStatus,
    filterModalOpen,
    setFilterModalOpen,
    ordersStatusGroup,
    selectedSubOrderStatus,
    handleSelectedSubOrderStatus,
    toolsSlot,
    tools
  } = props

  const [{ dictionary }, t] = useLanguage()
  const [configState] = useConfig()
  const [{ parseDate }] = useUtils()
  const [filterValues, { handleFilterValues } = {}] = useFilterValues()
  const configFile = useContext(ConfigFileContext)?.[0]
  const [localOpen, setLocalOpen] = useState(false)

  const isShowSearchFilters = !configState?.configs?.search_box_enabled || configState?.configs?.search_box_enabled?.value === '1'
  const sheetOpen = setFilterModalOpen ? !!filterModalOpen : localOpen
  const setSheetOpen = setFilterModalOpen || setLocalOpen
  // redesign F1b (D-05): only the Filters button opens the sheet; Date and Business filter in their own popover.
  const openSheet = () => setSheetOpen(true)

  // Search text: typed locally, sent after the same wait as before; a value set from
  // outside (`?q=`, clear filters) shows unless the user is typing.
  const [searchText, setSearchText] = useState(searchValue || '')
  const searchTimer = useRef(null)
  const searchInput = useRef(null)
  useEffect(() => {
    if (!searchValue) {
      setSearchText('')
      return
    }
    if (typeof document !== 'undefined' && document.activeElement !== searchInput.current) setSearchText(searchValue)
  }, [searchValue])
  const typeSearch = (value) => {
    const next = limitOrderSearchInput(value)
    setSearchText(next)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => handleChangeSearch && handleChangeSearch(next), SEARCH_DEBOUNCE_MS)
  }
  const clearSearch = () => {
    clearTimeout(searchTimer.current)
    setSearchText('')
    handleChangeSearch && handleChangeSearch('')
  }

  const prefix = (configFile?.app_internal_name || '').toUpperCase()
  const slaLabel = t('SLA', 'SLA')
  const slaValues = {
    // the same words as the SLA column of the table
    in_time: t('ON_TIME', 'On time'),
    at_risk: t('AT_RISK', 'At risk'),
    delayed: t('DELAYED', 'Delayed')
  }
  const labels = {
    status: t('STATUS', 'Status'),
    orderId: t('ORDER_ID', 'Order ID'),
    externalId: dictionary?.[`${prefix}_EXTERNAL_ID`] ?? t('EXTERNAL_ID', 'External ID'),
    date: t('DATE', 'Date'),
    business: t('BUSINESS', 'Business'),
    city: t('CITY', 'City'),
    country: t('COUNTRY', 'Country'),
    currency: t('CURRENCY', 'Currency'),
    deliveryType: t('DELIVERY_TYPE', 'Delivery type'),
    paymethod: t('PAYMENT_METHOD', 'Payment method'),
    administrator: t('ADMINISTRATOR', 'Administrator'),
    driver: dictionary?.[`${prefix}_DRIVER`] ?? t('DRIVER', 'Driver'),
    // redesign F1b (D-13): the chip of the assignable group reads like its pill, «Driver group»; the sheet field says
    // «(assignable)» to tell it from the assigned one.
    driverGroupAssignable: dictionary?.DRIVER_GROUP ?? t('DRIVER_GROUP', 'Driver group'),
    driverGroupAssigned: t('DRIVER_GROUP_ASSIGNED', 'Driver group (assigned)'),
    customerName: t('CUSTOMER_NAME', 'Customer name'),
    customerLastname: t('CUSTOMER_LASTNAME', 'Customer last name'),
    customerEmail: t('CUSTOMER_EMAIL', 'Customer email'),
    customerCellphone: t('CUSTOMER_CELLPHONE', 'Customer cellphone'),
    coupon: t('COUPON', 'Coupon'),
    offerId: t('OFFER_ID', 'Offer ID'),
    driverStatus: t('ORDERS_FILTER_DRIVER_STATUS', 'Driver status'),
    logisticStatus: t('ORDERS_FILTER_LOGISTIC_STATUS', 'Logistic status'),
    fraudStatus: t('FRAUD_STATUS', 'Fraud status'),
    sla: slaLabel,
    slaValues
  }

  const hasSubStatus = !!(ordersStatusGroup && selectedSubOrderStatus && handleSelectedSubOrderStatus)
  const subStatus = hasSubStatus ? { ordersStatusGroup, selectedSubOrderStatus } : undefined
  const active = buildActiveFilters({
    filterValues: filterValues || {},
    subStatus,
    t,
    labels,
    parseDate,
    lists: {
      businesses: businessesList?.businesses,
      cities: citiesList,
      paymethods: paymethodsList?.paymethods,
      admins: adminsList?.admins,
      drivers: driversList?.drivers,
      assignableGroups: assignableDriverGroupList?.groups,
      groups: driverGroupList?.groups
    }
  })
  const valueOf = (key) => active.find(entry => entry.key === key)?.value
  const narrowing = hasActiveOrdersNarrowing(filterValues, searchValue, subStatus)
  const resetSubStatus = () => handleSelectedSubOrderStatus(nextSelectedSubOrderStatus({
    statusKey: 'all',
    ordersStatusGroup,
    selectedSubOrderStatus,
    statuses: getSubOrderStatuses(t)
  }))

  const removeFilter = (entry) => {
    if (entry.reset) {
      resetSubStatus()
      return
    }
    const next = { ...filterValues, ...entry.patch }
    handleFilterValues && handleFilterValues(next)
    handleChangeFilterValues && handleChangeFilterValues(next)
    if (entry.isSla) setTimeStatus && setTimeStatus(null)
  }
  const clearAll = () => clearOrdersNarrowing({
    filterValues,
    searchValue,
    handleChangeSearch,
    handleFilterValues,
    handleChangeFilterValues,
    ...(hasSubStatus ? { ordersStatusGroup, selectedSubOrderStatus, handleSelectedSubOrderStatus } : {})
  })

  const search = isShowSearchFilters
    ? (
      <SearchField
        value={searchText}
        onChange={typeSearch}
        onClear={clearSearch}
        inputRef={searchInput}
        label={t('SEARCH_ORDERS_LABEL', 'Search by order number, customer, phone or store')}
        placeholder={t('SEARCH', 'Search')}
        clearLabel={t('CLEAR_SEARCH', 'Clear search')}
      />
      )
    : undefined

  const filters = (
    <>
      {hasSubStatus && (
        <SubStatusPill
          ordersStatusGroup={ordersStatusGroup}
          selectedSubOrderStatus={selectedSubOrderStatus}
          handleSelectedSubOrderStatus={handleSelectedSubOrderStatus}
        />
      )}
      <SlaMenu
        filterValues={filterValues}
        handleFilterValues={handleFilterValues}
        setTimeStatus={setTimeStatus}
        label={slaLabel}
        valueLabels={slaValues}
        t={t}
      />
      <OrdersHeaderFilterGroup
        isSelectedOrders={isSelectedOrders}
        driverGroupList={driverGroupList}
        assignableDriverGroupList={assignableDriverGroupList}
        driversList={driversList}
        searchValue={searchValue}
        handleChangeFilterValues={handleChangeFilterValues}
        handleChangeSearch={handleChangeSearch}
        disableSocketRoomDriver={disableSocketRoomDriver}
      />
      <OrdersDateBusinessPills
        businessesList={businessesList}
        dateValue={valueOf('date')}
        businessValue={pillValue(filterValues?.businessIds, named(businessesList?.businesses))}
      />
    </>
  )

  const more = (
    <Button
      icon={SlidersHorizontal}
      name='filter-btn'
      aria-haspopup='dialog'
      aria-expanded={sheetOpen}
      onClick={openSheet}
    >
      {t('FILTERS', 'Filters')}
      {active.length > 0 && (
        <>
          {' '}
          <span className='odc-num odc-orders-filter-count' data-filterbar-count=''>{active.length}</span>
        </>
      )}
    </Button>
  )

  // redesign W0-4b (T0-14, decision 18): when the row has no room left for its words, FilterBar parks this button and lists it
  // in «+N» as one more entry (it reads the words of the button and presses it): the search never goes below 200px.
  const clearText = t('CLEAR_FILTERS', 'Clear filters')
  const clear = narrowing
    ? <Button variant='ghost' onClick={clearAll}>{clearText}</Button>
    : undefined

  const chips = active.length > 0
    ? (
      <FilterChips
        label={t('FILTERS_ACTIVE', 'Active filters')}
        clearAllLabel={t('CLEAR_FILTERS', 'Clear filters')}
        onClearAll={clearAll}
        chips={active.map(entry => ({
          key: entry.key,
          label: entry.value ? `${entry.name}: ${entry.value}` : entry.name,
          removeLabel: t('REMOVE_FILTER', 'Remove _filter_ filter').replace('_filter_', entry.name),
          onRemove: () => removeFilter(entry)
        }))}
      />
      )
    : undefined

  const notice = narrowing
    ? (
      <InlineNotice tone='warning' icon={TriangleAlert}>
        {t('WARNING_FILTER_APPLIED', 'Filters applied. You may miss new orders.')}
      </InlineNotice>
      )
    : undefined

  const toolsNode = (toolsSlot || tools)
    ? (
      <>
        {tools}
        {toolsSlot && <div id='orders-list-tools' className='odc-orders-tools-slot' />}
      </>
      )
    : undefined

  return (
    <>
      <FilterBar
        flush
        label={t('ORDER_FILTERS', 'Order filters')}
        // redesign F1b (D-06): the pills that do not fit go to «+N»; its name says how many.
        overflowLabel={(count) => `+${count} ${t('MORE_FILTERS', 'more filters')}`}
        // redesign F6d-1 (Q3-02): when «+N» holds a pill with a value it says so, «+4 · 1 active».
        overflowActiveLabel={(count) => t('FILTERS_ACTIVE_COUNT', '_count_ active').replace('_count_', count)}
        // redesign F6f-1 (Q5-01, Q5-02): the row holds the room of «Filters» with its longest count and of «Clear filters»
        // even with no filter on, so the first filter never moves the bar.
        moreReserve='99'
        clearReserve={clearText}
        search={search}
        filters={filters}
        more={more}
        clear={clear}
        chips={chips}
        notice={notice}
        tools={toolsNode}
      />
      <OrdersFilterGroup
        driverGroupList={driverGroupList}
        driversList={driversList}
        paymethodsList={paymethodsList}
        businessesList={businessesList}
        citiesList={citiesList}
        adminsList={adminsList}
        handleChangeFilterValues={handleChangeFilterValues}
        filterModalOpen={sheetOpen}
        setFilterModalOpen={setSheetOpen}
      />
    </>
  )
}
