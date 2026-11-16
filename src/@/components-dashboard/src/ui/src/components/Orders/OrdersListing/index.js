import React, { memo, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useHistory } from 'react-router-dom'
import { useLanguage, useConfig, useSession, useApi } from '../../../../../index'
import { OrdersTable } from '../OrdersTable'
import { useIsPhone } from '../../Shared/Product/useIsPhone' // redesign W1-1 (T1-1): was useOrderCardsViewport (OrdersTable/OrderCard)
import { OrdersCards } from '../OrdersCards'
import { ORDERS_AMOUNT_UNAVAILABLE } from '../OrderStatusFilterBar'
import { OrderStatusTypeSelector } from '../OrderStatusTypeSelector'
import { OrderDelete } from '../OrderDelete'
import { WrapOrderStatusTypeSelector } from '../OrdersDashboardControls/styles'
import { Button, ColumnManager, ConfirmDialog, EmptyState, IconButton, Menu, SelectionBar } from '../../Shared/Product'
import { FilterX, Inbox, Rows3, TriangleAlert } from '../../Shared/Icon'
import AiOutlineInfoCircle from '@meronex/icons/ai/AiOutlineInfoCircle'

import {
  WrapperOrderListContent,
  InfoMessage
} from './styles'
import { useFilterValues } from '../../../contexts/FilterValuesContext'
import { ConfigFileContext } from '../../../contexts/ConfigFileContext'
import { getOrderStatusPrefix, isFinalOrderStatusLocked, FINAL_ORDER_STATUSES } from '../../../utils'
import { hasActiveOrdersNarrowing, clearOrdersNarrowing } from '../OrdersFilterGroup/activeFilters'
import { useTrackedLoadState } from '~/analytics/useTrackedLoadState'
import { getOrdersAnalyticsModule } from './analytics'
import '../OrdersTable/orders-table.css'

// redesign 5.2-C: the list tools (sort text, density, columns) and the selection bar live here,
// because this is the component that has the controller's `allowColumns` and `saveUserSettings`.

// The filter bar (5.2-B) leaves this empty slot; the tools are drawn into it by portal.
const TOOLS_SLOT_ID = 'orders-list-tools'
const DENSITY_KEY = 'od.orders.density'
// A drag in the column manager moves a column many times; the settings are saved once it settles.
const SAVE_DELAY_MS = 400

// Density is remembered per browser; the four tab lists share it, so it is a tiny external store.
const densityListeners = new Set()
let densityFallback = 'comfortable'
const readDensity = () => {
  try {
    return window.localStorage.getItem(DENSITY_KEY) === 'compact' ? 'compact' : 'comfortable'
  } catch (error) {
    return densityFallback
  }
}
const writeDensity = (density) => {
  densityFallback = density
  try {
    window.localStorage.setItem(DENSITY_KEY, density)
  } catch (error) {
    // storage blocked: the choice lasts for this session only
  }
  densityListeners.forEach(listener => listener())
}
const subscribeDensity = (listener) => {
  densityListeners.add(listener)
  return () => densityListeners.delete(listener)
}

// Mirror of the defaults `OrdersManage` gives a user without saved settings (its `allowColumnsModel`
// plus the SLA and timer columns it forces on). TODO: have the controller expose its model so
// «Reset» does not depend on this copy.
const defaultColumnLayout = (showExternalId) => ({
  slaBar: { visable: true, order: -2 },
  orderNumber: { visable: !showExternalId, order: -1 },
  dateTime: { visable: true, order: showExternalId ? -1 : 0 },
  externalId: { visable: false, order: 1 },
  status: { visable: true, order: 2 },
  agent: { visable: false, order: 3 },
  cartGroupId: { visable: true, order: 4 },
  driverGroupId: { visable: true, order: 5 },
  business: { visable: true, order: 6 },
  customer: { visable: true, order: 7 },
  driver: { visable: true, order: 8 },
  advanced: { visable: true, order: 9 },
  cloned: { visable: true, order: 10 },
  timer: { visable: true, order: 11 },
  eta: { visable: true, order: 12 },
  channel: { visable: false, order: 13 },
  pod: { visable: true, order: 14 },
  total: { visable: true, order: 15 }
})

// redesign 5.2 audit-1 (C10): an empty list says which of three things it is. These are the tabs'
// own words (a tab with nothing in it) and the keys of the counters the page keeps for the tabs.
const TAB_KEYS = ['pending', 'inProgress', 'completed', 'cancelled']
// (W1-QA1-05): each one is a literal call of t with the key and its text, the only shape the key scanner
// (i18n/scanKeys.cjs) reads; a table of key and text pairs hid these four keys from the catalog and from i18n:verify.
const EMPTY_TAB_COPY = {
  pending: t => t('ORDERS_EMPTY_PENDING', 'No pending orders'),
  inProgress: t => t('ORDERS_EMPTY_IN_PROGRESS', 'No in-progress orders'),
  completed: t => t('ORDERS_EMPTY_COMPLETED', 'No completed orders'),
  cancelled: t => t('ORDERS_EMPTY_CANCELLED', 'No cancelled orders')
}
// A counter is a zero only when it is a number that is zero: loading (null) and failed are not.
const isZeroAmount = (amount) => amount !== null && amount !== undefined && amount !== '' &&
  amount !== ORDERS_AMOUNT_UNAVAILABLE && !isNaN(amount) && Number(amount) === 0

// «Select all N» (orders pilot, decision 3): the state of the selection beyond the page.
// idle: the page selection; loading: the ids are being fetched; all: every matching order is selected;
// error: the fetch failed and the page selection stays.
const SELECT_ALL_IDLE = { status: 'idle' }

const MANAGED_KEYS = ['status', 'agent', 'cartGroupId', 'driverGroupId', 'business', 'customer', 'driver', 'advanced', 'cloned', 'timer', 'eta', 'total', 'externalId', 'channel', 'pod']

export const OrdersListing = memo((props) => {
  const {
    hidePhoto,
    isSelectedOrders,
    orderList,
    selectedOrderIds,
    orderListView,
    handleUpdateOrderStatus,
    handleSelectedOrderIds,
    pagination,
    handleOpenOrderDetail,
    handleOpenMessage,
    handleOrderCardClick,
    handleUpdateDriverLocation,
    messageOrder,
    selectedOrderCard,
    messageListView,
    messageType,
    loadMoreOrders,
    getPageOrders,
    ordersStatusGroup,
    groupStatus,
    orderDetailId,
    searchValue,
    handleChangeSearch,
    handleChangeFilterValues,
    setFilterModalOpen,
    setOrdersTotalAmount,

    isMessagesView,
    setSelectedOrderIds,
    handleOpenTour,
    currentTourStep,
    isTourOpen,
    setIsTourOpen,
    slaSettingTime,

    allowColumns,
    setAllowColumns,
    handleDrop,
    isDelivery,
    saveUserSettings,
    isUseQuery,
    handleSetOpenOrderDetail,
    handleChangeMultiOrdersStatus,
    handleDeleteMultiOrders,
    inProgressSort,
    onInProgressSortChange,
    ordersAmountByStatus,
    filterValues,
    canSelectAllMatching,
    getAllMatchingOrderIds,
    selectedSubOrderStatus,
    handleSelectedSubOrderStatus
  } = props

  const [{ dictionary }, t] = useLanguage()
  const [configState] = useConfig()
  const [{ user }] = useSession()
  const [ordering] = useApi()
  const configFileState = useContext(ConfigFileContext)
  const history = useHistory()
  const [contextFilterValues, { handleFilterValues }] = useFilterValues()
  const density = useSyncExternalStore(subscribeDensity, readDensity, () => 'comfortable')
  const [widthHidden, setWidthHidden] = useState([])
  const [toolsSlot, setToolsSlot] = useState(null)
  const [selectAllState, setSelectAllState] = useState(SELECT_ALL_IDLE)
  const [pendingStatus, setPendingStatus] = useState(null)
  const selectAllRequest = useRef(0)
  const saveRef = useRef({ timer: null, pending: null, save: saveUserSettings })
  saveRef.current.save = saveUserSettings

  useTrackedLoadState({
    loading: orderList?.loading,
    error: orderList?.error,
    module: getOrdersAnalyticsModule({ isMessagesView, isDelivery }),
    action: 'load_orders',
    once: true
  })

  const showExternalId = configState?.configs?.change_order_id?.value === '1'

  const handleDobleClick = () => {
    if (handleSetOpenOrderDetail && orderDetailId) {
      handleSetOpenOrderDetail(true)
    }
  }

  // The slot is drawn by the filter bar in the same commit, so it is looked up after render.
  useLayoutEffect(() => {
    const slot = typeof document === 'undefined' ? null : document.getElementById(TOOLS_SLOT_ID)
    setToolsSlot(previous => previous === slot ? previous : slot)
  })

  const flushSave = useCallback(() => {
    const state = saveRef.current
    clearTimeout(state.timer)
    state.timer = null
    if (state.pending) {
      const pending = state.pending
      state.pending = null
      state.save && state.save(pending)
    }
  }, [])

  // Saves what is pending when the list goes away, so a quick change is not lost.
  useEffect(() => flushSave, [flushSave])

  const commitColumns = (updatedAllowColumns) => {
    setAllowColumns(updatedAllowColumns)
    const state = saveRef.current
    state.pending = JSON.parse(JSON.stringify(updatedAllowColumns))
    clearTimeout(state.timer)
    state.timer = setTimeout(flushSave, SAVE_DELAY_MS)
  }

  const defaultLayout = defaultColumnLayout(showExternalId)
  const firstKey = showExternalId ? 'dateTime' : 'orderNumber'
  const columnLabels = {
    // redesign F6c-5 (Q2-17): these five have keys of their own, so the casing of the API catalog («Order No», «External Id»,
    // «Pod», «SLA’s timer») never reaches the manager.
    orderNumber: t('ORDERS_COLUMN_ORDER_NUMBER', 'Order number'),
    dateTime: showExternalId ? t('DATE', 'Date') : t('DATE_TIME', 'Date and time'),
    status: t('STATUS', 'Status'),
    agent: t('AGENT', 'Agent'),
    cartGroupId: t('GROUP_ORDER', 'Group order'),
    driverGroupId: t('ORDERS_COLUMN_DRIVER_GROUP_ID', 'Driver group ID'),
    business: t('BUSINESS', 'Business'),
    customer: t('CUSTOMER', 'Customer'),
    driver: t('DRIVER', 'Driver'),
    advanced: t('ADVANCED_LOGISTICS', 'Advanced logistics'),
    cloned: t('CLONED', 'Cloned'),
    timer: t('ORDERS_COLUMN_SLA_TIMER', 'SLA timer'),
    eta: t('ETA', 'ETA'),
    total: t('EXPORT_TOTAL', 'Total'),
    externalId: t('ORDERS_COLUMN_EXTERNAL_ID', 'External ID'),
    channel: t('CHANNEL', 'Channel'),
    pod: t('ORDERS_COLUMN_POD', 'POD')
  }
  // The first cell merges number and date; with change_order_id on there is no separate date toggle.
  const managedKeys = showExternalId ? [firstKey, ...MANAGED_KEYS] : [firstKey, 'dateTime', ...MANAGED_KEYS]
  const columnOrder = (key) => allowColumns?.[key]?.order ?? defaultLayout[key].order
  const isColumnVisible = (key) => allowColumns?.[key]?.visable ?? defaultLayout[key].visable

  // redesign F6d-4b (Q3-04): `OrdersManage` starts with its own default model, where the SLA column and the timer are off, and
  // swaps it for the saved settings (forcing the SLA column on, whatever the user saved) once they arrive. Until then the table
  // must not draw that default set. TODO: have the controller expose a `columnsLoaded` flag so this does not depend on the model.
  const columnsReady = !(allowColumns?.slaBar?.visable === false && allowColumns?.timer?.visable === false)
  const timerAvailable = groupStatus === 'pending' || groupStatus === 'inProgress'
  const managerColumns = allowColumns
    ? managedKeys
      .map((key, index) => ({ key, index }))
      .sort((a, b) => columnOrder(a.key) - columnOrder(b.key) || a.index - b.index)
      .map(({ key }) => {
        const visible = key === firstKey ? true : isColumnVisible(key)
        // with change_order_id on the external id is what names an order (no number is shown): it locks too
        // (owner decision 1, 2026-10-27): Total can be hidden again, as in main. OrdersTable still keeps it out of the
        // width hiding and in the loading frame while it is shown.
        const lockable = key === firstKey || key === 'status' || (key === 'externalId' && showExternalId)
        return {
          id: key,
          label: columnLabels[key],
          visible,
          // an older setting may have hidden a locked column: it can be brought back, then it locks
          locked: lockable && visible,
          widthHidden: widthHidden.includes(key),
          // redesign F6e-3 (P5-04, replaces the disabled checkbox of F6d-4b Q2-17): the timer column only draws in Pending and In progress
          // (OrdersTable), but its checkbox is the one preference every tab shares, as in main: it stays enabled in all of them, and
          // outside those two a note says where the column shows. (ColumnManager still supports `disabled` for other columns.)
          ...(key === 'timer' && !timerAvailable
            ? { note: t('COLUMN_ONLY_SHOWN_PENDING_IN_PROGRESS', 'Only shown in Pending and In progress') }
            : {})
        }
      })
    : []

  // `next` is the manager's list in its new order. The columns trade the order values they
  // already had, so the columns outside the manager (the SLA one) keep their place.
  const handleColumnsChange = (next) => {
    const orderValues = managedKeys.map(columnOrder).sort((a, b) => a - b)
    const updated = { ...allowColumns }
    next.forEach((entry, index) => {
      const current = updated[entry.id] ?? {
        visable: defaultLayout[entry.id].visable,
        title: columnLabels[entry.id],
        className: '',
        draggable: true,
        colSpan: 1,
        order: defaultLayout[entry.id].order
      }
      updated[entry.id] = {
        ...current,
        visable: entry.id === firstKey ? current.visable : entry.visible,
        order: orderValues[index]
      }
    })
    commitColumns(updated)
  }

  // Restores order and visibility; titles, class names and the rest of each column stay.
  const handleResetColumns = () => {
    const updated = { ...allowColumns }
    Object.keys(defaultLayout).forEach(key => {
      const current = updated[key] ?? {
        title: columnLabels[key] ?? '',
        className: '',
        draggable: true,
        colSpan: 1
      }
      updated[key] = { ...current, visable: defaultLayout[key].visable, order: defaultLayout[key].order }
    })
    commitColumns(updated)
  }

  useEffect(() => {
    if (orderList.loading || !messageListView) return
    if (orderList.orders.length === 0 || messageOrder) return
    handleOpenMessage && handleOpenMessage(orderList.orders[0], messageType)
  }, [orderList.loading, messageListView])

  useEffect(() => {
    if (!isMessagesView || orderList.loading || selectedOrderCard) return
    if (orderList?.orders.length > 0) {
      handleOrderCardClick(orderList.orders[0])
    }
  }, [isMessagesView, orderList, selectedOrderCard])

  // redesign F6c-5 (Q2-01): the Status sub-filter of the tab is a filter too (activeFilters.js, F6c-2): «all» is the
  // neutral state. Both helpers take it as { ordersStatusGroup, selectedSubOrderStatus }.
  const subStatus = { ordersStatusGroup: groupStatus, selectedSubOrderStatus }
  const narrowed = hasActiveOrdersNarrowing(contextFilterValues, searchValue, subStatus)

  const handleClearFilters = () => clearOrdersNarrowing({
    filterValues: contextFilterValues,
    searchValue,
    handleChangeSearch,
    handleFilterValues,
    handleChangeFilterValues,
    ordersStatusGroup: groupStatus,
    selectedSubOrderStatus,
    handleSelectedSubOrderStatus
  })

  const isTableView = orderListView === 'table'
  // redesign 5.6-A: under 768px of viewport OrdersTable draws cards. A card has no columns, so the table tools stay out
  // (the lateral lists of a customer or a driver keep the table, as OrdersTable does). (W1, owner decision 1 A):
  // the cards do have selection (a «Select» mode in OrdersTable), so the selection bar is the same one at every width.
  const isCardsMode = useIsPhone() && isTableView && !isSelectedOrders
  const hasOrders = (orderList?.orders?.length ?? 0) > 0
  const loadFailed = !orderList.loading && !!orderList.error && !hasOrders

  // The tab counter shows the total; if the load failed it says so (a dash) instead of staying a skeleton.
  useEffect(() => {
    if (loadFailed) {
      setOrdersTotalAmount && setOrdersTotalAmount(ORDERS_AMOUNT_UNAVAILABLE)
      return
    }
    if (!isNaN(pagination.total)) {
      setOrdersTotalAmount && setOrdersTotalAmount(pagination.total)
    }
  }, [pagination.total, loadFailed])

  const isEmpty = !orderList.loading && !loadFailed && pagination?.total === 0
  // First time: every tab counts zero and nothing narrows the list. Without the counters (messages,
  // deliveries) the list cannot say so and only names its own tab.
  const firstRun = !narrowed && !!ordersAmountByStatus && TAB_KEYS.every(key => isZeroAmount(ordersAmountByStatus[key]))
  const tabCopy = EMPTY_TAB_COPY[groupStatus]
  // The create action opens what the header's «Create custom order» opens: that button reads
  // `?add=custom_order` once (the command palette uses it too), and only level 0 sees it. A lateral
  // bar has no page header, so no action.
  const canCreateOrder = !!history && user?.level === 0 && !isSelectedOrders
  const handleCreateOrder = () => {
    const params = new URLSearchParams(window.location.search)
    params.set('add', 'custom_order')
    history.replace({ pathname: history.location?.pathname ?? window.location.pathname, search: `?${params}` })
  }
  // (owner decision 2): in progress on /orders can go by the earliest delivery or newest first (main's order)
  const sortLabels = {
    delivery: t('SORT_EARLIEST_DELIVERY_FIRST', 'Earliest delivery first'),
    newest: t('SORT_NEWEST_FIRST', 'Newest first')
  }

  const tools = (
    <div className='odc-root odc-orders-tools'>
      {onInProgressSortChange && (
        <Menu
          label={sortLabels[inProgressSort] ?? sortLabels.delivery}
          triggerVariant='ghost'
          className='odc-orders-sort'
          items={Object.entries(sortLabels).map(([key, label]) => ({
            key,
            label,
            type: 'radio',
            checked: key === (inProgressSort ?? 'delivery'),
            onSelect: () => onInProgressSortChange(key)
          }))}
        />
      )}
      <IconButton
        icon={Rows3}
        label={t('COMPACT_ROWS', 'Compact rows')}
        aria-pressed={density === 'compact'}
        onClick={() => writeDensity(density === 'compact' ? 'comfortable' : 'compact')}
      />
      <ColumnManager
        columns={managerColumns}
        onChange={handleColumnsChange}
        onReset={handleResetColumns}
        triggerLabel={t('MANAGE_COLUMNS', 'Manage columns')}
        title={t('MANAGE_COLUMNS', 'Manage columns')}
        resetLabel={t('COLUMNS_RESET', 'Reset')}
        lockedNote={t('COLUMN_ALWAYS_SHOWN', 'Always shown')}
        widthHiddenNote={t('COLUMN_HIDDEN_AT_WIDTH', 'Hidden at this width')}
        moveUpLabel={label => t('MOVE_COLUMN_UP', 'Move _column_ up').replace('_column_', label)}
        moveDownLabel={label => t('MOVE_COLUMN_DOWN', 'Move _column_ down').replace('_column_', label)}
      />
    </div>
  )

  const selectedCount = selectedOrderIds?.length ?? 0
  const canChangeStatus = (user?.level !== 5 || configState?.configs?.allow_driver_manager_batch_update_order_status?.value === '1') &&
    typeof handleChangeMultiOrdersStatus === 'function'
  const canDelete = user?.level !== 5 && typeof handleDeleteMultiOrders === 'function'
  // redesign fix-qa E7: /all-in-one has its own selection controls and passes no bulk handlers; without them there is no bar.
  const hasBulkActions = typeof handleChangeMultiOrdersStatus === 'function' || typeof handleDeleteMultiOrders === 'function'

  // «Select all N»: only where the page asks for it (/orders) and only with the controller's fetch.
  const matchingMode = !!canSelectAllMatching && !isSelectedOrders
  const pageIds = (orderList?.orders ?? []).map(order => order.id)
  const totalMatching = Number(pagination?.total)
  const selectedSet = new Set(selectedOrderIds ?? [])
  const pageFullySelected = pageIds.length > 0 && pageIds.every(id => selectedSet.has(id))
  // A project can lock final orders for some roles (they have no checkbox). The fetched ids carry no
  // status, so there the selection stays per page and the locked ones can never be swept in.
  const finalOrdersLocked = isFinalOrderStatusLocked(ordering?.project, user?.level, FINAL_ORDER_STATUSES[0])
  const canOfferSelectAll = matchingMode && typeof getAllMatchingOrderIds === 'function' && !finalOrdersLocked &&
    pageFullySelected && totalMatching > pageIds.length && selectAllState.status !== 'all'
  const isAllSelected = selectAllState.status === 'all'
  const isSelectingAll = selectAllState.status === 'loading'

  const resetSelectAll = () => {
    selectAllRequest.current += 1
    setSelectAllState(SELECT_ALL_IDLE)
  }

  // The tab, the page, the page size, the search or a filter changed: «all» no longer describes what
  // is on screen, so it goes away together with the selection it made (never act on orders out of view).
  const filterKey = JSON.stringify(filterValues ?? null)
  useEffect(() => {
    if (selectAllState.status === 'idle') return
    if (selectAllState.status === 'all') setSelectedOrderIds && setSelectedOrderIds([])
    resetSelectAll()
  }, [pagination?.currentPage, pagination?.pageSize, searchValue, filterKey, ordersStatusGroup])

  // Anything else that changes the selection under «all» (the status queue taking orders out of it,
  // the controller clearing it) ends the mode without touching the selection.
  useEffect(() => {
    if (selectAllState.status === 'all') {
      const current = new Set(selectedOrderIds ?? [])
      if (current.size !== selectAllState.ids.length || selectAllState.ids.some(id => !current.has(id))) resetSelectAll()
    } else if (selectAllState.status !== 'idle' && selectedCount === 0) {
      resetSelectAll()
    }
  }, [selectedOrderIds, selectAllState])

  const handleSelectAllMatching = async () => {
    if (isSelectingAll) return
    const request = ++selectAllRequest.current
    setSelectAllState({ status: 'loading' })
    try {
      const ids = Array.from(new Set(await getAllMatchingOrderIds()))
      if (request !== selectAllRequest.current) return
      if (ids.length === 0) throw new Error('No ids')
      setSelectedOrderIds(ids)
      setSelectAllState({ status: 'all', ids })
    } catch (error) {
      if (request === selectAllRequest.current) setSelectAllState({ status: 'error' })
    }
  }

  // Leaving «all» by hand goes back to what is on the page: the other rows of it stay selected.
  // redesign fix-qa C2 (B10): any manual change to the selection also cancels a load of «all» in flight, so
  // the late ids never overwrite what the user just picked.
  const handleRowSelect = (orderId) => {
    if (isAllSelected) {
      resetSelectAll()
      setSelectedOrderIds(pageIds.filter(id => id !== orderId && selectedSet.has(id)))
      return
    }
    if (selectAllState.status !== 'idle') resetSelectAll()
    handleSelectedOrderIds(orderId)
  }
  const handleSetSelected = (ids) => {
    if (isAllSelected) {
      resetSelectAll()
      const pageSet = new Set(pageIds)
      setSelectedOrderIds(ids.filter(id => pageSet.has(id)))
      return
    }
    if (selectAllState.status !== 'idle') resetSelectAll()
    setSelectedOrderIds(ids)
  }
  // OrdersTable is memoised and does not compare its handlers, so it keeps the ones of the render it last drew.
  // The table gets stable wrappers that call the handlers of the latest render (they read the current select-all state).
  const latestSelection = useRef({})
  latestSelection.current = { handleRowSelect, handleSetSelected }
  const tableSelectRow = useCallback((orderId) => latestSelection.current.handleRowSelect(orderId), [])
  const tableSetSelected = useCallback((ids) => latestSelection.current.handleSetSelected(ids), [])
  const handleClearSelection = () => {
    if (selectAllState.status !== 'idle') resetSelectAll()
    setSelectedOrderIds && setSelectedOrderIds([])
  }

  // «All N» is a different decision from the page: it asks first. redesign fix-qa C2 (B5): only that mode asks;
  // a selection the user made by hand across pages goes straight through, as in main (OrdersDashboardControls:46-58).
  const handleBulkStatus = (status) => {
    if (matchingMode && isAllSelected) {
      setPendingStatus(status)
      return
    }
    handleChangeMultiOrdersStatus(status)
  }
  const handleConfirmBulkStatus = () => {
    const status = pendingStatus
    setPendingStatus(null)
    handleChangeMultiOrdersStatus(status)
  }
  const pendingStatusName = pendingStatus === null
    ? ''
    : getOrderStatusPrefix(pendingStatus, dictionary, configFileState?.[0]?.app_internal_name?.toUpperCase())

  // redesign F6c-5 (Q2-11): as in main, a hand-made selection keeps the orders of other pages. They do not show in the rows,
  // so the bar says how many they are, and each bulk action says how many orders it acts on.
  const onOtherPages = isAllSelected || isSelectingAll ? 0 : (selectedOrderIds ?? []).filter(id => !pageIds.includes(id)).length
  const bulkStatusLabel = selectedCount === 1
    ? t('BULK_CHANGE_STATUS_ONE', 'Change status of 1 order')
    : t('BULK_CHANGE_STATUS_MANY', 'Change status of _count_ orders').replace('_count_', selectedCount)
  const bulkDeleteLabel = selectedCount === 1
    ? t('BULK_DELETE_ONE', 'Delete 1 order')
    : t('BULK_DELETE_MANY', 'Delete _count_ orders').replace('_count_', selectedCount)

  const selectionCountLabel = isAllSelected
    ? t('ALL_ORDERS_SELECTED', 'All _total_ orders selected').replace('_total_', selectAllState.ids.length)
    : isSelectingAll
      ? t('SELECTING_ALL_ORDERS', 'Selecting all _total_ orders…').replace('_total_', totalMatching)
      : onOtherPages === 0
        ? t('ORDERS_SELECTED', '_count_ selected').replace('_count_', selectedCount)
        : onOtherPages === 1
          ? t('ORDERS_SELECTED_OTHER_PAGE', '_count_ selected · 1 on another page').replace('_count_', selectedCount)
          : t('ORDERS_SELECTED_OTHER_PAGES', '_count_ selected · _other_ on other pages').replace('_count_', selectedCount).replace('_other_', onOtherPages)

  return (
    <>
      {((ordersStatusGroup === groupStatus) || isMessagesView) && (
        <>
          {isTableView && !isCardsMode && (toolsSlot
            ? createPortal(tools, toolsSlot)
            : <div className='odc-orders-tools-row'>{tools}</div>)}
          {loadFailed || isEmpty
            ? (
              <div className='odc-root'>
                {loadFailed
                  ? (
                    <EmptyState
                      tone='error'
                      icon={TriangleAlert}
                      title={t('ORDERS_LOAD_ERROR_TITLE', 'We couldn’t load the orders')}
                      description={t('ORDERS_LOAD_ERROR_TEXT', 'The server didn’t answer. Check your connection and try again.')}
                      action={<Button onClick={() => getPageOrders(pagination?.pageSize, pagination?.currentPage)}>{t('TRY_AGAIN', 'Try again')}</Button>}
                    />
                    )
                  : narrowed
                    ? (
                      <EmptyState
                        icon={FilterX}
                        title={t('NO_ORDERS_MATCH_FILTERS', 'No orders match these filters')}
                        description={searchValue
                          ? t('NO_ORDERS_MATCH_SEARCH', 'Nothing matches “_search_”.').replace('_search_', searchValue)
                          : t('NO_ORDERS_MATCH_FILTERS_HINT', 'Try removing a filter.')}
                        action={(
                          <span className='odc-orders-empty-actions'>
                            <Button onClick={handleClearFilters}>{t('CLEAR_FILTERS', 'Clear filters')}</Button>
                            {/* redesign fix-qa E7 (main: OrdersListing:227-239): «Filters» opens the sheet, where the page has one */}
                            {typeof setFilterModalOpen === 'function' && (
                              <Button variant='ghost' onClick={() => setFilterModalOpen(true)}>{t('FILTERS', 'Filters')}</Button>
                            )}
                          </span>
                        )}
                      />
                      )
                    : firstRun
                      ? (
                        <EmptyState
                          icon={Inbox}
                          title={t('ORDERS_EMPTY_FIRST_TITLE', 'No orders yet')}
                          description={t('ORDERS_EMPTY_FIRST_TEXT', 'New orders will appear here as they come in')}
                          action={canCreateOrder
                            ? <Button onClick={handleCreateOrder}>{t('CREATE_CUSTOM_ORDER', 'Create custom order')}</Button>
                            : undefined}
                        />
                        )
                      : <EmptyState icon={Inbox} title={tabCopy ? tabCopy(t) : t('ORDERS_EMPTY_NONE', 'No orders')} />}
              </div>
              )
            : (
              <WrapperOrderListContent
                maxHeight={!isTableView}
                onDoubleClick={handleDobleClick}
              >
                {isTableView
                  ? (
                    <OrdersTable
                      hidePhoto={hidePhoto}
                      setSelectedOrderIds={tableSetSelected}
                      isSelectedOrders={isSelectedOrders}
                      orderList={orderList}
                      pagination={pagination}
                      selectedOrderIds={selectedOrderIds}
                      orderDetailId={orderDetailId}
                      loadMoreOrders={loadMoreOrders}
                      getPageOrders={getPageOrders}
                      handleUpdateOrderStatus={handleUpdateOrderStatus}
                      handleSelectedOrderIds={tableSelectRow}
                      handleOpenOrderDetail={handleOpenOrderDetail}
                      currentTourStep={currentTourStep}
                      isTourOpen={isTourOpen}
                      handleOpenTour={handleOpenTour}
                      setIsTourOpen={setIsTourOpen}
                      slaSettingTime={slaSettingTime}
                      groupStatus={groupStatus}
                      allowColumns={allowColumns}
                      columnsReady={columnsReady}
                      setAllowColumns={setAllowColumns}
                      handleDrop={handleDrop}
                      saveUserSettings={saveUserSettings}
                      isUseQuery={isUseQuery}
                      franchisesList={props.franchisesList}
                      density={density}
                      onWidthHiddenChange={setWidthHidden}
                    />
                    )
                  : (
                    <OrdersCards
                      isMessagesView={isMessagesView}

                      orderList={orderList}
                      pagination={pagination}
                      selectedOrderIds={selectedOrderIds}
                      loadMoreOrders={loadMoreOrders}
                      getPageOrders={getPageOrders}
                      handleUpdateOrderStatus={handleUpdateOrderStatus}
                      handleSelectedOrderIds={handleSelectedOrderIds}
                      handleOpenOrderDetail={handleOpenOrderDetail}
                      selectedOrderCard={selectedOrderCard}
                      handleOrderCardClick={handleOrderCardClick}
                      handleUpdateDriverLocation={handleUpdateDriverLocation}
                      slaSettingTime={slaSettingTime}
                      isDelivery={isDelivery}
                      isUseQuery={isUseQuery}
                      franchisesList={props.franchisesList}
                    />
                    )}
              </WrapperOrderListContent>
              )}
          {!isSelectedOrders && hasBulkActions && selectedCount > 0 && (
            <SelectionBar
              className='odc-orders-selbar'
              label={t('ORDERS_SELECTION_ACTIONS', 'Actions for selected orders')}
              countLabel={selectionCountLabel}
              selectAllLabel={canOfferSelectAll || isSelectingAll
                ? t('SELECT_ALL_MATCHING_ORDERS', 'Select all _total_ orders').replace('_total_', totalMatching)
                : undefined}
              onSelectAll={canOfferSelectAll || isSelectingAll ? handleSelectAllMatching : undefined}
              busy={isSelectingAll}
              message={selectAllState.status === 'error'
                ? t('SELECT_ALL_ORDERS_ERROR', 'We couldn’t select all the orders. The page selection stays.')
                : undefined}
              clearLabel={t('CLEAR_SELECTION', 'Clear selection')}
              onClear={handleClearSelection}
              actions={(
                <>
                  {canChangeStatus && (
                    <span className='odc-orders-bulk' role='group' aria-label={bulkStatusLabel} title={bulkStatusLabel}>
                      <WrapOrderStatusTypeSelector>
                        <OrderStatusTypeSelector
                          orderControl
                          isFirstSelect
                          noPadding
                          mutiOrdersChange
                          noSelected
                          defaultValue='default'
                          type='primary'
                          handleChangeMultiOrdersStatus={handleBulkStatus}
                        />
                      </WrapOrderStatusTypeSelector>
                    </span>
                  )}
                  {canDelete && (
                    <span className='odc-orders-bulk' data-tone='danger' role='group' aria-label={bulkDeleteLabel} title={bulkDeleteLabel}>
                      <OrderDelete triggerVariant='selection' count={selectedCount} handleDeleteMultiOrders={handleDeleteMultiOrders} />
                    </span>
                  )}
                </>
              )}
            />
          )}
          {matchingMode && (
            <ConfirmDialog
              open={pendingStatus !== null}
              tone='primary'
              title={t('CONFIRM_BULK_STATUS_TITLE', 'Change the status of _n_ orders?').replace('_n_', selectedCount)}
              confirmLabel={t('CHANGE_STATUS', 'Change status')}
              cancelLabel={t('CANCEL', 'Cancel')}
              closeLabel={t('CLOSE', 'Close')}
              onConfirm={handleConfirmBulkStatus}
              onCancel={() => setPendingStatus(null)}
            >
              {t('CONFIRM_BULK_STATUS_TEXT', 'Each order moves to _status_. This can’t be undone in one step.').replace('_status_', pendingStatusName)}
            </ConfirmDialog>
          )}
          {(handleSetOpenOrderDetail && orderDetailId) && (
            <InfoMessage>
              <AiOutlineInfoCircle />
              <span>{t('DOBLE_CLICK_OPEN_ORDER_INFO', 'Doble click order to open details')}</span>
            </InfoMessage>
          )}
        </>
      )}
    </>
  )
})

OrdersListing.displayName = 'OrdersListing'
