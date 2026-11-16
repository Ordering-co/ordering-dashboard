import React, { memo, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import moment from 'moment'
import {
  useLanguage,
  useUtils,
  useConfig,
  useSession,
  useApi
} from '../../../../../index'
import { Avatar, Button, DataTable, EmptyState, IconButton, Menu, Skeleton, SlaBadge, Status, useSplitView } from '../../Shared/Product'
import { Check, ChevronLeft, ChevronRight, CircleCheck, Inbox } from '../../Shared/Icon'
import { ConfigFileContext } from '../../../contexts/ConfigFileContext'
import { getCurrenySymbol, addQueryToUrl, getOrderStatusPrefix as getOrderStatus, isFinalOrderStatusLocked } from '../../../utils'
import { getOrderStatusFamily, isOrderClosed } from '../../../utils/orderStatusFamily'
import { getOrderEtaMoment, formatOrderEta, SLA_PARSE_OPTIONS } from './orderEta' // redesign tramo A r2 (W0-PA1-04)
import { OrderCardList } from './OrderCardList'
import { useIsPhone } from '../../Shared/Product/useIsPhone' // redesign W1-1 (T1-1): the phone cut of the cards
import { requestDriverFocus } from '../DriverSelector/focusIntent'
import { canAssignDriverManually } from '../../../../../utils/dashboardFeatureAccess'
import './orders-table.css'

// redesign 5.2-C: the orders table is the Product DataTable. One column per visible key of
// `allowColumns` (the controller's model), in its `order`; the first cell merges the order
// number and the date, as the old first cell did.
// redesign 5.6-A: under 768px of viewport the same list is a list of cards (OrderCardList.jsx, on Product's RecordCard) built from
// the same renderers below; the desktop split view stays a table whatever its container's width.

const PAGE_SIZES = [10, 25, 50]

const lowerCaseUnit = (text, code) => {
  try {
    return String(text).toLocaleLowerCase(code || undefined)
  } catch (e) {
    return String(text).toLowerCase()
  }
}
// How long an order that arrived by socket stays highlighted (mirrors --od-x-arrive).
const ARRIVAL_MS = 2400
const CATERING_TYPES = [7, 8]
// Statuses that no longer show the «time ago» of the delivery (same list as the old total cell).
const NO_TIME_AGO_STATUSES = [1, 11, 2, 5, 6, 10, 12]

// redesign fix-qa C2 (coordinator decision, replaces the default-set rule of E7): on the full-width list NO column is
// hidden by width, whatever the set. A table that does not fit scrolls sideways, with the select-all and the order
// column in place (orders-table.css), as main showed every column. Only while the order panel is beside the list
// (the split view, `useSplitView`) may the untouched default set step columns aside, lowest priority first and only
// as far as needed, so a column never leaves free room behind it; they come back when the panel closes. The widths
// below are what each column asks for (px, padding included).
const SELECTION_WIDTH = 52
const FALLBACK_WIDTH = 120
// Measured with the columns on, then rounded up where the content varies (status names, people, codes). redesign F6e-3 (Q4-03):
// the status and the total are now never narrower than their floors (candidates.css, F6e-3: 193px and 71px, plus the 12px
// padding on each side, and the 24px gutter at the end for the total), so they ask for 217 and 107.
const COLUMN_WIDTH = {
  orderNumber: 152,
  dateTime: 152,
  status: 217,
  slaBar: 160,
  total: 107,
  business: 128,
  customer: 128,
  driver: 128,
  advanced: 164,
  cartGroupId: 102,
  driverGroupId: 120,
  cloned: 70,
  pod: 80,
  eta: 92,
  timer: 120,
  externalId: 110,
  agent: 150,
  channel: 110
}
// The default set steps aside in this order, the first of the list first. Locked columns never do.
const WIDTH_PRIORITY = ['advanced', 'cartGroupId', 'driverGroupId', 'cloned', 'pod', 'eta', 'timer', 'business', 'customer', 'driver']
// What `OrdersManage` shows to a user without saved settings, in its order. The controller forces the SLA column on
// whatever the user saved, so it is left out of the comparison. It forces the timer on too, but only without saved
// settings (with them the timer is the user's), so the timer is part of the default.
const DEFAULT_VISIBLE = ['orderNumber', 'dateTime', 'status', 'cartGroupId', 'driverGroupId', 'business', 'customer', 'driver', 'advanced', 'cloned', 'timer', 'eta', 'pod', 'total']
const FORCED_COLUMNS = ['slaBar']
// redesign F4 (C20): the model of a user without saved settings (the SLA first, then the default set in its order). Since F6d-4b
// the loading list no longer draws it while the saved settings are on their way (a saved set would reflow it): it only lends
// the entries of the locked columns below.
const FALLBACK_COLUMNS = Object.fromEntries([['slaBar', -2], ...DEFAULT_VISIBLE.map((key, index) => [key, index - 1])]
  .map(([key, order]) => [key, { visable: true, order }]))
const LOCKED_COLUMNS = ['orderNumber', 'dateTime', 'status', 'slaBar', 'total']
// redesign F6d-4b (Q3-04): with no saved set known, the loading list draws only what every user has (the locked columns), never
// the default set: a saved set that arrives later would replace it and the whole grid would reflow.
const LOCKED_FALLBACK_COLUMNS = Object.fromEntries(LOCKED_COLUMNS.filter(key => FALLBACK_COLUMNS[key]).map(key => [key, FALLBACK_COLUMNS[key]]))

// The last set of columns the controller delivered to this user on this device, so the next load starts from it instead of
// waiting for the settings (they come after the first paint). Keyed by user; a failure of the storage is no failure of the list.
const COLUMNS_CACHE_PREFIX = 'odc-orders-columns:'
const columnsCacheKey = (userId) => userId == null || userId === '' ? null : `${COLUMNS_CACHE_PREFIX}${userId}`
const isColumnSet = (value) => !!value && typeof value === 'object' && !Array.isArray(value) &&
  Object.values(value).length > 0 && Object.values(value).every(entry => entry && typeof entry === 'object' && typeof entry.order === 'number') &&
  Object.values(value).some(entry => entry.visable)
const readCachedColumns = (userId) => {
  const key = columnsCacheKey(userId)
  if (!key) return null
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key))
    return isColumnSet(parsed) ? parsed : null
  } catch (error) {
    return null
  }
}
const writeCachedColumns = (userId, columns) => {
  const key = columnsCacheKey(userId)
  if (!key) return
  try {
    window.localStorage.setItem(key, JSON.stringify(columns))
  } catch (error) {}
}

// True while the user has not changed which columns are on, nor their order: only then does the width choose for them.
export const isDefaultColumnSet = (allowColumns, showExternalId) => {
  const wanted = DEFAULT_VISIBLE.filter(key => !(showExternalId && key === 'orderNumber'))
  const keys = new Set([...DEFAULT_VISIBLE, ...Object.keys(allowColumns || {})].filter(key => !FORCED_COLUMNS.includes(key)))
  const sameVisibility = Array.from(keys).every(key => Boolean(allowColumns?.[key]?.visable) === wanted.includes(key))
  if (!sameVisibility) return false
  // The order in which the visible columns sit (ties keep the default order, as the sort of buildColumns does).
  const shown = wanted
    .map((key, index) => ({ key, index, order: allowColumns?.[key]?.order ?? index }))
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map(({ key }) => key)
  return shown.every((key, index) => key === wanted[index])
}

const OrderTablePropsAreEqual = (prevProps, nextProps) => {
  return prevProps.isSelectedOrders === nextProps.isSelectedOrders &&
    JSON.stringify(prevProps.orderList) === JSON.stringify(nextProps.orderList) &&
    JSON.stringify(prevProps.pagination) === JSON.stringify(nextProps.pagination) &&
    JSON.stringify(prevProps.selectedOrderIds) === JSON.stringify(nextProps.selectedOrderIds) &&
    JSON.stringify(prevProps.isTourOpen) === JSON.stringify(nextProps.isTourOpen) &&
    prevProps.groupStatus === nextProps.groupStatus &&
    JSON.stringify(prevProps.allowColumns) === JSON.stringify(nextProps.allowColumns) &&
    prevProps.columnsReady === nextProps.columnsReady &&
    prevProps.isUseQuery === nextProps.isUseQuery &&
    prevProps.orderDetailId === nextProps.orderDetailId &&
    prevProps.density === nextProps.density
}

// «Showing _from_–_to_ of _total_»: the numbers become <bdi> so they keep their direction in RTL.
const fillTemplate = (template, values) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined
    ? <bdi key={index} className='odc-num'>{values[name]}</bdi>
    : part
})

export const OrdersTable = memo((props) => {
  const {
    hidePhoto,
    isSelectedOrders,
    orderList,
    pagination,
    selectedOrderIds = [],
    orderDetailId,
    getPageOrders,
    handleSelectedOrderIds,
    handleOpenOrderDetail,
    handleUpdateOrderStatus,
    setSelectedOrderIds,
    currentTourStep,
    isTourOpen,
    handleOpenTour,
    setIsTourOpen,
    groupStatus,
    allowColumns,
    // redesign F6d-4b (Q3-04): false while `allowColumns` is still the controller's starting model, not the user's saved one.
    columnsReady = true,
    isUseQuery,
    franchisesList,
    density = 'comfortable',
    onWidthHiddenChange
  } = props
  const [{ dictionary, language }, t] = useLanguage()
  const [{ user }] = useSession()
  const [ordering] = useApi()
  const isOrderLocked = useCallback(
    (order) => isFinalOrderStatusLocked(ordering?.project, user?.level, order?.status),
    [ordering?.project, user?.level]
  )
  const [{ parseDate, parsePrice, optimizeImage, getTimeAgo }] = useUtils()
  const [configState] = useConfig()
  const canAssignDriver = canAssignDriverManually({ level: user?.level, configs: configState?.configs })
  const configFileState = useContext(ConfigFileContext)
  const prefixForVariable = configFileState?.[0]?.app_internal_name?.toUpperCase()
  const isTourOpenRef = useRef()
  const arrivalRef = useRef({ ids: null, page: null, pageSize: null })
  const arrivalTimer = useRef(null)
  const [newRowIds, setNewRowIds] = useState([])
  const [announcement, setAnnouncement] = useState('')
  const [pageDraft, setPageDraft] = useState(null)
  // The lateral lists of a customer or a driver (isSelectedOrders) live inside a panel: they keep the table.
  const cardsMode = useIsPhone() && !isSelectedOrders
  // The order panel is beside the list only in the split mode and not "open as a page" (then the list is hidden).
  const splitView = useSplitView()
  const panelBesideList = splitView.open && splitView.mode === 'split' && !splitView.expanded

  const orders = orderList?.orders || []
  // redesign F6d-4b (Q3-04): the model the columns are built from is the saved settings. While they have not arrived, the last set
  // kept on this device, or the columns every user has: never the default set, which a saved one would then replace.
  const columnsKnown = Boolean(allowColumns) && columnsReady !== false
  const userId = user?.id
  const cachedColumns = useMemo(() => columnsKnown ? null : readCachedColumns(userId), [columnsKnown, userId])
  const columnModel = columnsKnown ? allowColumns : (cachedColumns || LOCKED_FALLBACK_COLUMNS)
  const columnsKey = columnsKnown ? JSON.stringify(allowColumns) : null
  useEffect(() => {
    if (columnsKey) writeCachedColumns(userId, JSON.parse(columnsKey))
  }, [columnsKey, userId])
  const isEnabledRowInColor = configState?.configs?.row_in_color_enabled?.value === '1'
  const showExternalId = configState?.configs?.change_order_id?.value === '1'
  const formatTime = configState?.configs?.format_time?.value

  const franchiseImages = !franchisesList?.error && franchisesList?.franchises?.reduce((imageKeys, franchise) => {
    imageKeys[franchise.id] = franchise.logo
    return imageKeys
  }, {})

  const handleChangePage = useCallback((page) => {
    if (page !== pagination.currentPage) {
      getPageOrders(pagination.pageSize, page)
    }
  }, [pagination?.currentPage, pagination?.pageSize, getPageOrders])

  const handleChangePageSize = useCallback((pageSize) => {
    if (pageSize !== pagination.pageSize) {
      const expectedPage = Math.ceil(((pagination.currentPage - 1) * pagination.pageSize + 1) / pageSize)
      getPageOrders(pageSize, expectedPage)
    }
  }, [pagination?.currentPage, pagination?.pageSize, getPageOrders])

  const getDelayMinutes = (order) => {
    // targetMin = delivery_datetime  + eta_time - now()
    const diffTimeAsSeconds = getOrderEtaMoment(order, parseDate, SLA_PARSE_OPTIONS).diff( // redesign tramo A r2 (W0-PA1-04)
      moment().utc(), 'seconds')
    return Math.ceil(diffTimeAsSeconds / 60)
  }

  const displayDelayedTime = (order) => {
    let tagetedMin = getDelayMinutes(order)
    // get day, hour and minutes
    const sign = tagetedMin >= 0 ? '' : '- '
    tagetedMin = Math.abs(tagetedMin)
    let day = Math.floor(tagetedMin / 1440)
    const restMinOfTargetedMin = tagetedMin - 1440 * day
    let restHours = Math.floor(restMinOfTargetedMin / 60)
    let restMins = restMinOfTargetedMin - 60 * restHours
    // make standard time format
    // (bugs H): DAY is a title-case catalog label («Día»); after a number it is a unit, so it is lower-cased
    // in the language of the dashboard («2 día»). A code the browser rejects falls back to the plain lower-case.
    day = day === 0 ? '' : `${day + ' ' + lowerCaseUnit(t('DAY', 'day'), language?.code) + ' '}`
    restHours = restHours < 10 ? '0' + restHours : restHours
    restMins = restMins < 10 ? '0' + restMins : restMins

    return sign + day + restHours + ':' + restMins
  }

  // «25 min», «1 h 30 min» or «6 d 4 h»: the absolute distance to the estimated delivery time.
  const formatDuration = (minutes) => {
    const total = Math.abs(minutes)
    if (total < 60) return t('DURATION_MINUTES', '_min_ min').replace('_min_', total)
    if (total < 1440) {
      return t('DURATION_HOURS_MINUTES', '_h_ h _min_ min')
        .replace('_h_', Math.floor(total / 60))
        .replace('_min_', total % 60)
    }
    return t('DURATION_DAYS_HOURS', '_d_ d _h_ h')
      .replace('_d_', Math.floor(total / 1440))
      .replace('_h_', Math.floor((total % 1440) / 60))
  }

  const getLogisticTag = (status) => {
    switch (parseInt(status)) {
      case 0:
        return t('PENDING', 'Pending')
      case 1:
        return t('IN_PROGRESS', 'In progress')
      case 2:
        return t('IN_QUEUE', 'In queue')
      case 3:
        return t('EXPIRED', 'Expired')
      case 4:
        return t('RESOLVED', 'Resolved')
      default:
        return t('UNKNOWN', 'Unknown')
    }
  }

  const getPriorityTag = (priority) => {
    switch (parseInt(priority)) {
      case -1:
        return t('LOW', 'Low')
      case 0:
        return t('NORMAL', 'Normal')
      case 1:
        return t('HIGH', 'High')
      case 2:
        return t('URGENT', 'Urgent')
      default:
        return t('UNKNOWN', 'Unknown')
    }
  }

  const openOrder = (order) => handleOpenOrderDetail(order, false, isTourOpenRef.current)

  const handleSelectPage = (next) => {
    const pageIds = orders.filter(order => !isOrderLocked(order)).map(order => order.id)
    if (next) {
      setSelectedOrderIds(Array.from(new Set([...selectedOrderIds, ...pageIds])))
    } else {
      const pageIdSet = new Set(pageIds)
      setSelectedOrderIds(selectedOrderIds.filter(id => !pageIdSet.has(id)))
    }
  }

  const handleChangeKeyboard = (evt) => {
    if (evt.code === 'Escape') setIsTourOpen && setIsTourOpen(false)
    if (evt.keyCode === 37 && currentTourStep === 1) handleOpenTour()
    if (evt.keyCode === 37 && currentTourStep === 4) handleOpenOrderDetail(orderList?.orders[0], true)
    if (evt.keyCode === 39 && currentTourStep === 0) handleOpenOrderDetail(orderList?.orders[0])
  }

  useEffect(() => {
    isTourOpenRef.current = isTourOpen
    if (!isTourOpen) return
    document.addEventListener('keydown', handleChangeKeyboard)
    return () => document.removeEventListener('keydown', handleChangeKeyboard)
  }, [isTourOpen, currentTourStep])

  useEffect(() => {
    if (!isUseQuery || !pagination?.currentPage || !pagination?.pageSize || !pagination?.total) return
    addQueryToUrl({
      page: pagination.currentPage,
      pageSize: pagination.pageSize
    })
  }, [pagination?.currentPage, pagination?.pageSize, pagination?.total])

  // An order that shows up while the page and its size stay the same arrived by socket (the
  // controller puts it in the list). A reload or a page change resets the baseline instead.
  useEffect(() => {
    if (orderList?.loading) {
      arrivalRef.current = { ids: null, page: null, pageSize: null }
      return
    }
    const ids = orders.map(order => order.id)
    const previous = arrivalRef.current
    if (previous.ids && previous.page === pagination?.currentPage && previous.pageSize === pagination?.pageSize) {
      const arrived = ids.filter(id => !previous.ids.has(id))
      if (arrived.length) {
        setNewRowIds(arrived)
        setAnnouncement(t('NEW_ORDER_ARRIVED', 'New order _id_').replace('_id_', arrived.map(id => `#${id}`).join(', ')))
        clearTimeout(arrivalTimer.current)
        arrivalTimer.current = setTimeout(() => {
          setNewRowIds([])
          setAnnouncement('')
        }, ARRIVAL_MS)
      }
    }
    arrivalRef.current = { ids: new Set(ids), page: pagination?.currentPage, pageSize: pagination?.pageSize }
  }, [orderList?.loading, orderList?.orders, pagination?.currentPage, pagination?.pageSize])

  useEffect(() => () => clearTimeout(arrivalTimer.current), [])

  // The page field shows what the user types until Enter or leaving the field; a new page puts it back.
  useEffect(() => { setPageDraft(null) }, [pagination?.currentPage])

  // redesign fix-qa E8: reaching the first (or the last) page disables the button that was just pressed, and a disabled
  // button drops the focus to <body> (the sidebar is the next stop from there). After a page change that came from the
  // pager, if the focus is gone it goes to the page field (or to the other button when there is no field). Focus that
  // moved somewhere else on purpose, or is still on an enabled control, is left alone.
  const pagerRef = useRef(null)
  const pagerPressed = useRef(false)
  useLayoutEffect(() => {
    if (!pagerPressed.current) return
    pagerPressed.current = false
    const pager = pagerRef.current
    const active = document.activeElement
    const lost = !active || active === document.body || (pager?.contains(active) && active.disabled)
    if (pager && lost) (pager.querySelector('.odc-orders-page-input') ?? pager.querySelector('button:not(:disabled)'))?.focus()
  }, [pagination?.currentPage])

  const dash = (label = t('NO_DATA', 'No data')) => (
    <span className='odc-orders-empty'>
      <span aria-hidden='true'>—</span>
      <span className='odc-sr-only'>{label}</span>
    </span>
  )

  // redesign F6h-3 (A2-04): a name, a city, a phone come from the API, not from the translations. The element that clips has
  // dir="auto" (its own direction decides where the ellipsis falls and keeps the run isolated), so a Latin name in an Arabic page
  // ends «Customer De…», never «…stomer Demo». `secondaryContent` lets a line isolate the phone inside it; `secondary` is its title.
  const personCell = ({ name, photo, secondary, secondaryContent, kind = 'person', extra }) => (
    <span className='odc-orders-who'>
      {!hidePhoto && <Avatar kind={kind} name={name} src={photo ? optimizeImage(photo, 'h_50,c_limit') : undefined} />}
      <span className='odc-orders-who-text'>
        <span className='odc-orders-who-name' dir='auto' title={typeof name === 'string' ? name : undefined}>{name}{extra}</span>
        {secondary && <span className='odc-orders-sub' dir='auto' title={typeof secondary === 'string' ? secondary : undefined}>{secondaryContent ?? secondary}</span>}
      </span>
    </span>
  )

  // redesign F6g-2: a date or a time is one left-to-right run, so a right-to-left sentence around it does not reorder «PM 06:52 2026-10-06»
  const ltr = (value) => <bdi dir='ltr'>{value}</bdi>
  // redesign W0-3a (T0-9, decisión 11a): an hour or a date is a figure: the same left-to-right run, in mono with tabular
  // figures. Only the run holds the class, never the sentence around it («Created at:», «ETA»).
  const figure = (value) => <bdi dir='ltr' className='odc-figure'>{value}</bdi>

  const deliveryDate = (order) => order?.delivery_datetime_utc
    ? parseDate(order?.delivery_datetime_utc)
    : parseDate(order?.delivery_datetime, { utc: false })

  const getOrderTimeAgo = (order) => NO_TIME_AGO_STATUSES.includes(order?.status)
    ? undefined
    : (order?.delivery_datetime_utc ? getTimeAgo(order?.delivery_datetime_utc) : getTimeAgo(order?.delivery_datetime, { utc: false }))

  const renderOrderCell = (order) => {
    const showId = !showExternalId && columnModel?.orderNumber?.visable
    const showDate = columnModel?.dateTime?.visable
    const isCatering = CATERING_TYPES.includes(order?.delivery_type)
    const timeAgo = getOrderTimeAgo(order)
    return (
      <span className='odc-orders-cell'>
        {showId && <span className='odc-mono odc-orders-cell-id'>{ltr(`#${order?.id}`)}</span>}
        {showDate && isCatering && (
          <span className='odc-orders-sub'>{t('CREATED_AT', 'Created at')}: {figure(parseDate(order?.created_at))}</span>
        )}
        {showDate && (
          <span className='odc-orders-sub' title={timeAgo}>
            {isCatering ? <>{t('PLACED_TO', 'Placed to')}: {figure(deliveryDate(order))}</> : figure(deliveryDate(order))}
          </span>
        )}
      </span>
    )
  }

  const renderStatus = (order) => {
    const isReservationPreorder = parseInt(order?.delivery_type, 10) === 9 && parseInt(order?.status, 10) === 13
    const label = isReservationPreorder
      ? (dictionary?.RESERVATION ?? t('RESERVATION', 'Reservation'))
      : getOrderStatus(order.status, dictionary, prefixForVariable)
    // redesign F6c-5 (Q2-05): in the narrow list the name clips with an ellipsis, so the whole name is its title
    return <Status family={getOrderStatusFamily(order.status)} label={label} title={typeof label === 'string' ? label : undefined} />
  }

  // SLA in words (C5, C16). time_status comes from the server; the minutes are the
  // distance between the ETA and now, so they only mean something while the order is
  // open: a closed order says whether it was on time or late, never «delayed by 6 days».
  const renderSla = (order) => {
    const level = { in_time: 'ok', at_risk: 'risk', delayed: 'late' }[order?.time_status]
    if (!level) return dash()
    const closed = ['done', 'cancel'].includes(getOrderStatusFamily(order.status))
    // (tanda Y): the criterion of on the cards. The server says in_time, but an open order whose ETA
    // already passed is not on time: no «On time» then (a dash, as with no level). The filter does not change (DV-02).
    if (level === 'ok') return !closed && getDelayMinutes(order) < 0 ? dash() : <SlaBadge level='ok' label={t('ON_TIME', 'On time')} />
    if (closed) return <SlaBadge level={level} label={level === 'late' ? t('SLA_LATE', 'Late') : t('AT_RISK', 'At risk')} />
    const remaining = getDelayMinutes(order)
    if (level === 'risk') {
      return <SlaBadge level='risk' label={remaining > 0 ? t('SLA_DUE_IN', 'Due in _time_').replace('_time_', formatDuration(remaining)) : t('AT_RISK', 'At risk')} />
    }
    return <SlaBadge level='late' label={remaining < 0 ? t('SLA_DELAYED_BY', 'Delayed · _time_').replace('_time_', formatDuration(remaining)) : t('DELAYED', 'Delayed')} />
  }

  const getCustomerParts = (order) => {
    const customer = order?.customer
    const fullName = [customer?.name, customer?.lastname].map(part => String(part ?? '').trim()).filter(Boolean).join(' ')
    const isGuest = !customer?.email && !customer?.cellphone && !customer?.name
    const count = customer?.orders_count
    // The old badge showed a bare number (or «New») with no meaning on screen; it is said in words now.
    const history = count === 1
      ? t('ORDERS_COUNT_ONE', '1 order')
      : count ? t('ORDERS_COUNT', '_count_ orders').replace('_count_', count) : t('NEW_CUSTOMER', 'New customer')
    // A customer without a name is still someone: the email, then the phone, then a plain label (never a bare «76 orders»).
    const nameIsPhone = !isGuest && !fullName && !customer?.email && !!customer?.cellphone
    const name = isGuest
      ? t('GUEST_USER', 'Guest user')
      : fullName || customer?.email || customer?.cellphone || t('UNNAMED_CUSTOMER', 'Unnamed customer')
    const phone = nameIsPhone ? null : customer?.cellphone
    const historyText = isGuest ? null : history
    return {
      name,
      photo: customer?.photo,
      secondary: [phone, historyText].filter(Boolean).join(' · '),
      // redesign F6h-3: the phone is a left-to-right run of its own; the sentence around it follows the language
      secondaryContent: <>{phone && ltr(phone)}{phone && historyText && ' · '}{historyText}</>
    }
  }

  const renderCustomer = (order) => personCell(getCustomerParts(order))

  const businessPhoto = (order) => franchiseImages?.[order?.business?.franchise_id] || order?.business?.logo

  const renderTotal = (order) => (
    <span className='odc-figure odc-orders-total'>
      {parsePrice(order?.summary?.total, { currency: getCurrenySymbol(order?.currency) })}
    </span>
  )

  // redesign fix-qa E7: the total keeps «2 hours ago» of the delivery as its second line, as in main (Order.js:341-349).
  const renderTotalCell = (order) => {
    const timeAgo = getOrderTimeAgo(order)
    return (
      <span className='odc-orders-cell odc-orders-total-cell'>
        {renderTotal(order)}
        {timeAgo && <span className='odc-orders-sub'>{timeAgo}</span>}
      </span>
    )
  }

  const renderDriver = (order) => {
    if (order?.delivery_type !== 1) return dash()
    const driver = order?.driver || order?.external_driver
    if (driver) {
      const driverLine = order?.driver?.cellphone || order?.driver_company?.name
      return personCell({
        name: driver.name,
        photo: driver.photo,
        secondary: driverLine,
        secondaryContent: order?.driver?.cellphone ? ltr(driverLine) : undefined
      })
    }
    return (
      <span className='odc-orders-who'>
        {(isOrderClosed(order?.status) || !canAssignDriver)
          ? <span className='odc-subtle'>{t('UNASSIGNED', 'Unassigned')}</span>
          : (
            <Button size='sm' onClick={() => { requestDriverFocus(order?.id); openOrder(order) }} aria-label={t('ASSIGN_DRIVER_TO_ORDER', 'Assign a driver to order _id_').replace('_id_', order?.id)}>
              {t('ASSIGN', 'Assign')}
            </Button>
            )}
      </span>
    )
  }

  const renderAdvanced = (order) => (
    <span className='odc-orders-cell odc-orders-adv'>
      <span>{`${getLogisticTag(order?.logistic_status)} · ${t('ATTEMPTS', 'Attempts')} ${order?.logistic_attemps ?? 0}`}</span>
      <span className='odc-orders-sub'>{`${t('PRIORITY', 'Priority')}: ${getPriorityTag(order?.priority)}`}</span>
    </span>
  )

  const renderEta = (order) => {
    const eta = formatOrderEta(order, { parseDate, formatTime })
    if (!eta) return dash(t('NO_ETA', 'No ETA'))
    return (
      <span className='odc-orders-cell'>
        {/* odc-num stays for now: orders-table.css gives `.odc-orders-cell .odc-num` its medium weight (W0-3a, T0-9) */}
        <span className='odc-figure odc-num'>{ltr(eta.time)}</span>
        {eta.date && <span className='odc-orders-sub'>{figure(eta.date)}</span>}
      </span>
    )
  }

  const groupId = (value) => value ? `${t('No', 'No')}. ${value}` : dash()

  // redesign F4 (C20): what the loading cell of each column is made of: the lines its content has, the lead (an avatar,
  // a dot) and the token of the width the content asks for (candidates.css, «loading ghost»). It lives next to
  // the renderers above because the two change together. redesign F6e-3 (Q4-03): the floor is also the least width of the
  // header and of the real cells of that column (DataTable), so the columns do not move when the rows arrive.
  const personLead = (lead) => hidePhoto ? undefined : lead
  const orderLines = Math.max(1, Number(!showExternalId && !!columnModel?.orderNumber?.visable) + Number(!!columnModel?.dateTime?.visable))

  const buildColumns = () => {
    const firstKey = showExternalId ? 'dateTime' : 'orderNumber'
    const title = (key, fallback) => columnModel[key]?.title || fallback
    const cellsByKey = {
      slaBar: { header: t('SLA', 'SLA'), cell: renderSla, skeleton: { floor: 'var(--od-x-col-floor-sla)' } },
      [firstKey]: { header: showExternalId ? t('DATE', 'Date') : t('ORDER', 'Order'), cell: renderOrderCell, skeleton: { lines: orderLines, floor: 'var(--od-x-sk-order)' } },
      externalId: { header: title('externalId', t('EXTERNAL_ID', 'External ID')), cell: order => order?.external_id || dash(), hide: isSelectedOrders },
      status: { header: title('status', t('STATUS', 'Status')), cell: renderStatus, className: 'odc-orders-col-status', hide: isSelectedOrders, skeleton: { lead: 'dot', floor: 'var(--od-x-col-floor-status)' } },
      agent: {
        skeleton: { lines: 2 },
        header: title('agent', t('AGENT', 'Agent')),
        cell: order => order?.agent?.name
          ? (
            <span className='odc-orders-cell'>
              <span dir='auto'>{order.agent.name}</span>
              {order.agent.email && <span className='odc-orders-sub' dir='auto'>{order.agent.email}</span>}
            </span>
            )
          : dash()
      },
      cartGroupId: { header: title('cartGroupId', t('GROUP_ORDER', 'Group order')), cell: order => groupId(order?.cart_group_id) },
      driverGroupId: { header: title('driverGroupId', t('EXPORT_DRIVER_GROUP_ID', 'Driver group ID')), cell: order => groupId(order?.driver_group_id) },
      business: {
        header: title('business', t('BUSINESS', 'Business')),
        cell: order => personCell({
          kind: 'business',
          name: order?.business?.name,
          photo: businessPhoto(order),
          secondary: order?.business?.city?.name
        }),
        className: 'odc-orders-col-person',
        skeleton: { lines: 2, lead: personLead('business') }
      },
      customer: { header: title('customer', t('CUSTOMER', 'Customer')), cell: renderCustomer, className: 'odc-orders-col-person', skeleton: { lines: 2, lead: personLead('avatar') } },
      driver: { header: title('driver', t('DRIVER', 'Driver')), cell: renderDriver, className: 'odc-orders-col-person', hide: isSelectedOrders, skeleton: { lines: 2, lead: personLead('avatar') } },
      advanced: { header: title('advanced', t('ADVANCED_LOGISTICS', 'Advanced logistics')), cell: renderAdvanced, hide: isSelectedOrders, skeleton: { lines: 2 } },
      cloned: {
        header: title('cloned', t('CLONED', 'Cloned')),
        cell: order => order?.cloned_order_id
          ? (
            <>
              <CircleCheck className='odc-icon' aria-hidden='true' />
              <span className='odc-sr-only'>{t('CLONED', 'Cloned')}</span>
            </>
            )
          : dash()
      },
      timer: {
        header: title('timer', t('SLA_TIMER', 'SLA timer')),
        // the time_status colours the numbers like the SLA (main: Order.js:302)
        cell: order => <span className='odc-figure odc-orders-timer' data-status={order?.time_status}>{displayDelayedTime(order)}</span>,
        hide: !(groupStatus === 'pending' || groupStatus === 'inProgress')
      },
      eta: { header: title('eta', t('ETA', 'ETA')), cell: renderEta, skeleton: { lines: 2 } },
      channel: { header: title('channel', t('CHANNEL', 'Channel')), cell: order => order?.app_id || dash() },
      pod: { header: title('pod', t('PODS', 'Pod')), cell: order => order?.codigoPod || dash() },
      total: {
        header: title('total', t('EXPORT_TOTAL', 'Total')),
        align: 'end',
        cell: renderTotalCell,
        skeleton: { lines: 2, floor: 'var(--od-x-col-floor-total)' }
      }
    }
    const keys = Object.keys(columnModel)
      .filter(key => columnModel[key]?.visable && cellsByKey[key] && !cellsByKey[key].hide)
      .sort((key1, key2) => columnModel[key1]?.order - columnModel[key2]?.order)
    // slaBar was a fixed, non-draggable colour bar in front of every row, so its saved order
    // (the lowest) was never the user's choice. As the SLA column it sits after the status
    // (C5), until the user moves it in the column manager.
    const lowest = Math.min(...keys.map(key => columnModel[key]?.order ?? 0))
    // Without the status (the lateral lists of a customer or a driver) it follows the order cell instead,
    // so the order cell is the one that opens the row and stays in place when the table scrolls (E7).
    const slaAnchor = keys.includes('status') ? 'status' : firstKey
    if (keys.includes('slaBar') && keys.includes(slaAnchor) && columnModel.slaBar?.order === lowest && keys[0] === 'slaBar') {
      keys.splice(0, 1)
      keys.splice(keys.indexOf(slaAnchor) + 1, 0, 'slaBar')
    }
    // Width priorities only for the default set and only with the order panel beside the list (or in the narrow
    // lateral lists of a customer or a driver); each column steps aside when the ones that outrank it no longer
    // fit: the threshold of a column is the width of the table with it and all it outranks.
    const hideBelow = {}
    if ((panelBesideList || isSelectedOrders) && isDefaultColumnSet(columnModel, showExternalId)) {
      let needed = (isSelectedOrders ? 0 : SELECTION_WIDTH) + keys.reduce((sum, key) => sum + (COLUMN_WIDTH[key] ?? FALLBACK_WIDTH), 0)
      WIDTH_PRIORITY.filter(key => keys.includes(key)).forEach(key => {
        hideBelow[key] = needed
        needed -= COLUMN_WIDTH[key] ?? FALLBACK_WIDTH
      })
    }
    return keys
      .map((key, index) => ({
        id: key,
        header: cellsByKey[key].header,
        cell: cellsByKey[key].cell,
        skeleton: cellsByKey[key].skeleton,
        align: cellsByKey[key].align,
        wrap: cellsByKey[key].wrap,
        className: [cellsByKey[key].className, index === 0 && key === firstKey ? 'odc-orders-col-sticky' : null].filter(Boolean).join(' ') || undefined,
        hideBelow: hideBelow[key],
        locked: LOCKED_COLUMNS.includes(key) || (key === 'externalId' && showExternalId)
      }))
  }

  const selection = isSelectedOrders
    ? undefined
    : {
        selectedIds: selectedOrderIds,
        onToggle: (id) => handleSelectedOrderIds(id),
        onToggleAll: handleSelectPage,
        rowLabel: (order) => `${t('ORDER', 'Order')} ${order.id}`,
        allLabel: t('SELECT_ALL', 'Select all'),
        isSelectable: (order) => !isOrderLocked(order),
        checkboxClassName: 'orderCheckBox'
      }

  const renderCardDriver = (order) => {
    if (order?.delivery_type !== 1) return null
    const driver = order?.driver || order?.external_driver
    return driver
      ? personCell({ name: driver.name, photo: driver.photo })
      : <span className='odc-subtle'>{t('UNASSIGNED', 'Unassigned')}</span>
  }

  const renderCardEta = (order) => {
    const eta = formatOrderEta(order, { parseDate, formatTime })
    return eta ? <>{t('ETA', 'ETA')} {figure(eta.time)}{eta.date && <> · {figure(eta.date)}</>}</> : null
  }

  // The card shows what the row's cells show, from the same renderers; the name lines drop the second line.
  const getCardParts = (order) => {
    const customer = getCustomerParts(order)
    return {
      // redesign F6h-3: the number (or the external id) is a left-to-right run: «#13861» is not read «13861#» in RTL
      title: ltr(showExternalId && order?.external_id ? order.external_id : `#${order?.id}`),
      status: renderStatus(order),
      business: personCell({ kind: 'business', name: order?.business?.name, photo: businessPhoto(order) }),
      customer: personCell({ name: customer.name, photo: customer.photo }),
      sla: renderSla(order),
      // redesign F6c-5 (Q2-27): a closed order has no «time ago»; its date is already on the logistics line, so it is not said twice
      age: getOrderTimeAgo(order),
      total: renderTotal(order),
      // redesign fix-qa E7: what the Driver, date and ETA cells of the table show (null for a pickup's driver)
      driver: renderCardDriver(order),
      delivery: figure(deliveryDate(order)),
      eta: renderCardEta(order)
    }
  }

  const parsedDetailId = parseInt(orderDetailId)
  // On a phone the list is cards and has no columns to wait for.
  const waitsForColumns = !columnsKnown && !cachedColumns && !cardsMode
  const loading = Boolean(orderList?.loading || waitsForColumns)
  const total = Number(pagination?.total)
  const pageSize = pagination?.pageSize
  const currentPage = pagination?.currentPage
  const totalPages = Math.ceil(total / pageSize)
  const commitPage = () => {
    const typed = parseInt(pageDraft, 10)
    setPageDraft(null)
    if (Number.isFinite(typed)) handleChangePage(Math.min(Math.max(typed, 1), totalPages))
  }
  // redesign F4 (C20): the loading list has as many rows (or cards) as the page it waits for, ten while the size is not known.
  const skeletonCount = pageSize || PAGE_SIZES[0]
  const loadingLabel = t('ORDERS_LOADING', 'Loading orders')
  const pageSizes = PAGE_SIZES.includes(pageSize) || !pageSize ? PAGE_SIZES : [...PAGE_SIZES, pageSize].sort((a, b) => a - b)

  return (
    <>
      <div
        id='orderTable'
        className='odc-orders-table'
        data-no-scroll={isTourOpen && currentTourStep === 0 ? '' : undefined}
        data-bounded={isSelectedOrders ? '' : undefined}
        data-cards={cardsMode ? '' : undefined}
        aria-busy={loading || undefined}
      >
        {cardsMode
          ? (
            <OrderCardList
              label={t('ORDERS_LIST', 'Orders list')}
              orders={orders}
              loading={loading}
              loadingLabel={loadingLabel}
              skeletonCount={skeletonCount}
              empty={<EmptyState icon={Inbox} title={t('ORDERS_EMPTY_NONE', 'No orders')} />}
              activeId={Number.isFinite(parsedDetailId) ? parsedDetailId : undefined}
              newIds={newRowIds}
              getParts={getCardParts}
              getOrderLabel={(order) => `${t('ORDER', 'Order')} #${order.id}`}
              getTint={(order) => isEnabledRowInColor ? order?.time_status : undefined}
              onOpen={openOrder}
              onUpdateStatus={handleUpdateOrderStatus}
              // (W1, owner decision 1 A): the table's selection, on the cards behind a «Select» mode
              selection={selection && {
                selectedIds: selectedOrderIds,
                onToggle: selection.onToggle,
                onToggleAll: selection.onToggleAll,
                onClear: () => setSelectedOrderIds && setSelectedOrderIds([]),
                isSelectable: selection.isSelectable
              }}
            />
            )
          : (
            <DataTable
              label={t('ORDERS_LIST', 'Orders list')}
              columns={buildColumns()}
              rows={orders}
              getRowId={(order) => order.id}
              density={density}
              selection={selection}
              activeRowId={Number.isFinite(parsedDetailId) ? parsedDetailId : undefined}
              onOpenRow={openOrder}
              onClearSelection={() => setSelectedOrderIds && setSelectedOrderIds([])}
              onWidthHiddenChange={onWidthHiddenChange}
              newRowIds={newRowIds}
              loading={loading}
              loadingLabel={loadingLabel}
              skeletonRows={skeletonCount}
              // redesign tanda AB (O-1): the table (1024px) scrolls sideways inside the column of /all-in-one (698px); the
              // scroller is a named region and fades its edge, as the Stores table does. The rows are interactive: no extra tab stop.
              scrollLabel={t('ORDERS_TABLE_SCROLL_REGION', 'Orders table, scrolls sideways')}
              getRowAttributes={(order, index) => ({
                'data-tour': index === 0 ? 'tour_start' : undefined,
                'data-status': isEnabledRowInColor ? order?.time_status : undefined
              })}
              empty={<EmptyState icon={Inbox} title={t('ORDERS_EMPTY_NONE', 'No orders')} />}
            />
            )}
      </div>
      {/* redesign F6i-1 (A3-01): the hidden box needs a containing block of its own. Without one it is placed against a far
          ancestor (the list scrolls on its own, OrdersListContainer has no `position`) and stretches the page. */}
      <div className='odc-orders-live'>
        <span className='odc-sr-only' role='status' aria-live='polite'>{announcement}</span>
      </div>

      {/* F4 (C20): the footer holds its place while the first page loads, so the pager does not appear under the rows. */}
      {loading && !(total > 0) && (
        <div className='odc-root odc-orders-foot' data-skeleton='' data-cards={cardsMode ? '' : undefined} aria-hidden='true'>
          <span className='odc-orders-foot-count'><Skeleton size='var(--od-x-sk-foot-count)' /></span>
          <span className='odc-orders-pager'>
            <Skeleton size='var(--od-x-sk-foot-label)' />
            <Skeleton size='var(--od-x-sk-foot-menu)' shape='box' />
            <Skeleton size='var(--od-x-sk-foot-jump)' shape='box' className='odc-orders-foot-jump' />
            <Skeleton size='var(--od-x-control-height-sm)' shape='box' />
            <Skeleton size='var(--od-x-control-height-sm)' shape='box' />
          </span>
        </div>
      )}
      {pagination && total > 0 && (
        <div
          className='odc-root odc-orders-foot'
          data-cards={cardsMode ? '' : undefined}
          data-selecting={!isSelectedOrders && selectedOrderIds.length > 0 ? '' : undefined}
        >
          <span dir='auto'>
            {fillTemplate(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), {
              from: (currentPage - 1) * pageSize + 1,
              to: Math.min(currentPage * pageSize, total),
              total
            })}
          </span>
          <span className='odc-orders-pager' ref={pagerRef}>
            <span className='odc-orders-pager-label'>{t('ITEMS_PER_PAGE', 'Items per page')}</span>
            <Menu
              label={String(pageSize)}
              side='top'
              items={pageSizes.map(size => ({
                key: String(size),
                label: String(size),
                icon: size === pageSize ? Check : undefined,
                onSelect: () => handleChangePageSize(size)
              }))}
            />
            {totalPages > 1 && (
              <span className='odc-orders-pager-jump'>
                {/* redesign fix-qa E7: a field you can type a page in (Enter or leaving it jumps; a page out of range goes to the nearest). */}
                <input
                  className='odc-orders-page-input'
                  type='text'
                  inputMode='numeric'
                  pattern='[0-9]*'
                  autoComplete='off'
                  size={Math.max(String(totalPages).length, 2)}
                  aria-label={t('PAGE', 'Page')}
                  value={pageDraft ?? String(currentPage)}
                  onFocus={event => event.target.select()}
                  onChange={event => setPageDraft(event.target.value.replace(/\D/g, ''))}
                  onBlur={() => { if (pageDraft !== null) commitPage() }}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      commitPage()
                    } else if (event.key === 'Escape' && pageDraft !== null) {
                      event.preventDefault()
                      setPageDraft(null)
                    }
                  }}
                />
                <span>{fillTemplate(t('PAGE_OF_TOTAL', 'of _total_'), { total: totalPages })}</span>
              </span>
            )}
            {/* redesign cierre W0 (W0-QA4-01): the two steps are one item of the pager: they wrap together (as odc-pagination-steps in Pagination) */}
            <span className='odc-orders-pager-steps'>
              <IconButton
                icon={ChevronLeft}
                flipInRtl
                size='sm'
                label={t('PREVIOUS_PAGE', 'Previous page')}
                disabled={currentPage <= 1}
                onClick={() => { pagerPressed.current = true; handleChangePage(currentPage - 1) }}
              />
              <IconButton
                icon={ChevronRight}
                flipInRtl
                size='sm'
                label={t('NEXT_PAGE', 'Next page')}
                disabled={currentPage >= totalPages}
                onClick={() => { pagerPressed.current = true; handleChangePage(currentPage + 1) }}
              />
            </span>
          </span>
        </div>
      )}
    </>
  )
}, OrderTablePropsAreEqual)

OrdersTable.displayName = 'OrdersTable'
