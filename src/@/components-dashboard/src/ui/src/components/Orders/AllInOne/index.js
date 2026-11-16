import React, { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useLanguage, useConfig, useSession, OrdersManage as OrdersManageController } from '../../../../../index'
import { useBoardStacked } from '../../../hooks/useBoardStacked' // redesign all-in-one B2 (decision 6): List | Map below 1024px
import { SegmentedControl, SelectionBar } from '../../Shared/Product'
import { OrderStatusFilterBar } from '../OrderStatusFilterBar'
import { OrdersContentHeader } from '../OrdersContentHeader'
import { OrderDetails } from '../OrderDetails'
import { OrdersDashboardControls } from '../OrdersDashboardControls'
import { OrderStatusRegressionModal } from '../OrderStatusRegressionModal'
import { AlertDialog } from '../../Shared/Product/AlertDialog' // redesign W1-5 (T1-5-4): was the legacy Alert, twice
import { learnOptionsValues, usePreventDoubleClick } from '../../../utils'
import { DriversManager } from './DriversManager'
import { DriversLocation } from '../DriversLocation'
import { OrdersDashboard } from '../OrdersDashboard'
import { OrderStatusSubFilter } from '../OrderStatusSubFilter'
import { OrderNotificationSlot } from '../OrderNotification'
import { WizardOrders } from '../WizardOrders'

import {
  OrdersListContainer,
  WrapperIndicator,
  OrderSubFilterControls,
  OrderStatusSubFilterWrapper
} from './styles'
import './all-in-one-board.css' // redesign all-in-one B2 (decisions 1 and 6): the board of the page
import '../OrdersTable/orders-table.css' // redesign page-bugs Y (F2): the dress of the selection bar (.odc-orders-selbar, .odc-orders-bulk), whatever the list draws

const DEBOUNCE_DELAY = 300
const OrdersManagerUI = (props) => {
  const {
    isSelectedOrders,
    searchValue,
    driverGroupList,
    driversList,
    paymethodsList,
    businessesList,
    citiesList,
    ordersStatusGroup,
    filterValues,
    deletedOrderId,
    startMulitOrderStatusChange,
    startMulitOrderDelete,
    handleChangeSearch,
    handleChangeFilterValues,
    handleOrdersStatusGroupFilter,
    handleChangeMultiOrdersStatus,
    multiOrderUpdateStatus,
    regressionRequest,
    handleSubmitRegressionReason,
    handleCancelRegressionReason,
    handleDeleteMultiOrders,
    handleSelectedOrderIds,
    selectedOrderIds,
    onOrderRedirect,
    selectedSubOrderStatus,
    handleSelectedSubOrderStatus,
    handleCustomOrderDetail,
    setSelectedOrderIds,
    allowColumns,
    setAllowColumns,
    isUseQuery,
    adminsList,
    assignableDriverGroupList,
    mapsData,
    setMapsData,
    detailsOrder,
    setDetailsOrder
  } = props

  const [, t] = useLanguage()
  const [{ user }] = useSession()
  const [{ configs }] = useConfig()

  const isFilterDriverGroup = (configs?.filter_order_options?.value.split('|').map(value => (value)) || []).includes('driver_group_general')

  const query = new URLSearchParams(useLocation().search)
  const [isOpenOrderDetail, setIsOpenOrderDetail] = useState(false)
  const [orderDetailId, setOrderDetailId] = useState(null)
  const [filterModalOpen, setFilterModalOpen] = useState(false)
  const [assignedOrders, setAssignedOrders] = useState({ loading: false, error: null, orders: [] })
  const [orderForMap, setOrderForMap] = useState(detailsOrder)
  const [isTourOpen, setIsTourOpen] = useState(false)
  const [currentTourStep, setCurrentTourStep] = useState(0)
  const [isTourFlag, setIsTourFlag] = useState(false)
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [timeStatus, setTimeStatus] = useState(null)
  const [slaSettingTime, setSlaSettingTime] = useState(60000)
  const [totalSelectedOrder, setTotalSelectedOrder] = useState(0)
  const [ordersAmountByStatus, setOrdersAmountByStatus] = useState({
    pending: null,
    inProgress: null,
    completed: null,
    cancelled: null
  })
  const learnOptions = learnOptionsValues(['all_in_one'], t)

  // redesign all-in-one B2 (decision 6): below 1024px one column with a List | Map switch; from there up both columns are drawn and `view` is not used.
  // The drivers and the orders are never unmounted when the view changes (they are hidden), so the selection and the requests survive.
  const isStacked = useBoardStacked()
  const [view, setView] = useState('list')
  const pageRef = useRef(null)
  const listScrollTop = useRef(0)
  const isMapView = isStacked && view === 'map'
  const showMap = !isStacked || view === 'map'

  // redesign all-in-one B2 (decision 6): the page keeps the scroll it had in «List» while «Map» is shown (a short page clamps it to 0)
  const handleChangeView = (nextView) => {
    if (nextView === 'map') listScrollTop.current = pageRef.current?.scrollTop ?? 0
    setView(nextView)
  }

  useLayoutEffect(() => {
    if (isStacked && view === 'list' && pageRef.current && listScrollTop.current > 0) {
      pageRef.current.scrollTop = listScrollTop.current
      listScrollTop.current = 0
    }
  }, [isStacked, view])

  const handleBackRedirect = () => {
    setIsOpenOrderDetail(false)
    setDetailsOrder(null)
    setOrderForMap(null)
    setOrderDetailId(null)
    if (!isSelectedOrders) {
      onOrderRedirect()
    } else {
      handleCustomOrderDetail && handleCustomOrderDetail(false)
    }
  }

  // redesign page-bugs Y (W1 review F2): below 1024px the page scrolls and the sub-bar scrolls away with the list, so while orders are
  // selected the two bulk actions and the count live in the SelectionBar of /orders, sticky at the foot of the orders (selection-bar.css,
  // all-in-one-board.css). From 1024px the sub-bar stays as it was and there is no bar. It needs the bulk handlers, as the bar of /orders does.
  const selectedCount = selectedOrderIds?.length ?? 0
  const hasBulkHandlers = typeof handleChangeMultiOrdersStatus === 'function' || typeof handleDeleteMultiOrders === 'function'
  const showSelectionBar = isStacked && !isSelectedOrders && hasBulkHandlers && selectedCount > 0

  // redesign page-bugs Y (W1 review F3): when a bulk change ends (or the selection is cleared) the control that had the focus goes away
  // and the focus fell to <body>. It goes to the bar if it is still there, otherwise to the list of orders (a labelled region, tabIndex -1).
  // Only when the focus was lost: a person who is somewhere else keeps it. A modal that closes (the regression reason) puts its own focus back
  // after a tick, so the check runs again then.
  const listRegionRef = useRef(null)
  const focusTimerRef = useRef(null)
  const previousFlow = useRef({ selected: selectedCount, started: !!startMulitOrderStatusChange })
  const restoreLostFocus = () => {
    const active = document.activeElement
    if (active && active !== document.body && active.isConnected) return
    const page = pageRef.current
    // tanda Y review (finding 2): the trigger of Change status is a <div role='button'>; the first control in document order wins, never Delete
    const target = page?.querySelector('.aio-selbar [role="button"], .aio-selbar button, .aio-selbar [href]') || listRegionRef.current
    target?.focus({ preventScroll: true })
  }
  useEffect(() => {
    const before = previousFlow.current
    previousFlow.current = { selected: selectedCount, started: !!startMulitOrderStatusChange }
    const selectionEnded = before.selected > 0 && selectedCount === 0
    const bulkEnded = before.started && !startMulitOrderStatusChange
    if (!selectionEnded && !bulkEnded) return
    restoreLostFocus()
    clearTimeout(focusTimerRef.current)
    focusTimerRef.current = setTimeout(restoreLostFocus, 0)
  }, [selectedCount, startMulitOrderStatusChange])
  useEffect(() => () => clearTimeout(focusTimerRef.current), [])

  const closeAlert = () => {
    setAlertState({
      open: false,
      content: []
    })
  }

  const handleOpenOrderDetailBase = (order, isKeydown = false) => {
    if (isTourOpen && currentTourStep === 4 && !isKeydown) {
      setIsTourOpen(false)
      return
    }
    (!configs?.optimize_order_data || (configs?.optimize_order_data?.value === '0')) && setDetailsOrder(order)
    setOrderForMap((prev) => (prev?.id === order?.id ? null : order))
    setOrderDetailId(order.id)
    if (orderForMap?.id === order?.id) {
      setMapsData({
        ...mapsData,
        selectedDriver: null
      })
    }
    // setIsOpenOrderDetail(true)
    if (!isSelectedOrders) {
      onOrderRedirect(order.id)
    } else {
      handleCustomOrderDetail && handleCustomOrderDetail(true)
    }
    if (isTourOpen && currentTourStep === 4) {
      setIsTourFlag(true)
    }
    if (isTourOpen && currentTourStep === 0) {
      setTimeout(() => {
        setCurrentTourStep(1)
      }, 1)
    }
  }

  const handleOpenOrderDetail = usePreventDoubleClick(handleOpenOrderDetailBase, DEBOUNCE_DELAY)

  const handleSetOpenOrderDetail = (state) => {
    setIsOpenOrderDetail(state)
  }

  const handleOpenTour = () => {
    const tourElement = document.querySelector('[data-tour="tour_start"]')
    if (!tourElement) {
      setAlertState({
        open: true,
        content: t('ONE_ORDER_IS_REQUIRED', 'One order is required')
      })
      return
    }

    const orderElement = document.getElementById('orderTable')
    if (orderElement) orderElement.scrollTo(0, 0)
    setCurrentTourStep(0)
    setIsTourOpen(true)
    handleBackRedirect()
  }

  const handleUpdateAssignedOrders = (_assignedOrders) => {
    setAssignedOrders(_assignedOrders)
  }

  useEffect(() => {
    if (startMulitOrderStatusChange || startMulitOrderDelete) {
      setTotalSelectedOrder(selectedOrderIds.length)
    }
  }, [startMulitOrderStatusChange, startMulitOrderDelete])

  // fila 48: the reset is cancelled only when the page goes (it fired after a test's environment was torn down);
  // while the page is mounted it runs as before, also when the selection changes within the 500 ms
  const resetTimersRef = useRef(new Set())
  useEffect(() => () => resetTimersRef.current.forEach(clearTimeout), [])

  useEffect(() => {
    if (selectedOrderIds.length === 0) {
      const timer = setTimeout(() => {
        resetTimersRef.current.delete(timer)
        setTotalSelectedOrder(0)
      }, 500)
      resetTimersRef.current.add(timer)
    }
  }, [selectedOrderIds])

  useEffect(() => {
    if (isSelectedOrders) return
    const id = query.get('id')
    if (id === null) setIsOpenOrderDetail(false)
    else {
      if (user?.level === 5) {
        handleBackRedirect()
      } else {
        setOrderDetailId(id)
        setIsOpenOrderDetail(true)
      }
    }
  }, [user])

  useEffect(() => {
    if (isTourOpen) return
    setIsTourFlag(false)
  }, [isTourOpen])

  return (
    <>
      <OrdersListContainer
        className='aio-page'
        ref={pageRef}
        isSelectedOrders={isSelectedOrders}
      >
        <OrdersContentHeader
          disableSocketRoomDriver
          hideTour
          isDisableTitle={isSelectedOrders}
          isDisableControl={isSelectedOrders}
          title={t('ALL_IN_ONE', 'All in one')} // redesign all-in-one B2 (decision 5, AIO-06): was «Orders manager»
          searchValue={searchValue}
          assignableDriverGroupList={assignableDriverGroupList}
          driverGroupList={driverGroupList}
          driversList={driversList}
          citiesList={citiesList}
          paymethodsList={paymethodsList}
          businessesList={businessesList}
          handleChangeSearch={handleChangeSearch}
          handleChangeFilterValues={handleChangeFilterValues}
          selectedOrderIds={selectedOrderIds}
          handleDeleteMultiOrders={handleDeleteMultiOrders}
          handleChangeMultiOrdersStatus={handleChangeMultiOrdersStatus}
          handleOpenTour={() => handleOpenTour()}
          filterModalOpen={filterModalOpen}
          adminsList={adminsList}
          setFilterModalOpen={setFilterModalOpen}
          setTimeStatus={setTimeStatus}
          setSlaSettingTime={setSlaSettingTime}
          learnOptions={learnOptions}
        />

        {/* redesign W0-12 (W0-A0-01): one-line slot under the head, inside the page container */}
        <OrderNotificationSlot customerId={props.customerId} />

        {/* redesign all-in-one B2 (decisions 1 and 6, AIO-01, AIO-03, AIO-08): the board. From 1024px the orders on the left and, on the right,
            the map over the drivers; below, one column with a List | Map switch. The page does not scroll from 1024px (styles.js). */}
        <div className='aio-board' data-view={isStacked ? view : undefined}>
          {isStacked && (
            <div className='aio-view'>
              <SegmentedControl
                label={t('VIEW', 'View')}
                value={view}
                onValueChange={handleChangeView}
                options={[
                  { value: 'list', label: t('LIST', 'List') },
                  { value: 'map', label: t('MAP', 'Map') }
                ]}
              />
            </div>
          )}
          <div className='aio-orders' hidden={isMapView}>
            <div className='aio-orders-head'>
              <OrderStatusFilterBar
                isUseQuery={isUseQuery}
                selectedOrderStatus={ordersStatusGroup}
                changeOrderStatus={handleOrdersStatusGroupFilter}
                ordersAmountByStatus={ordersAmountByStatus}
              />
              <OrderSubFilterControls className='aio-subfilter' isColumn={selectedOrderIds?.length}>
                <OrderStatusSubFilterWrapper className='aio-subfilter-status' isColumn={selectedOrderIds?.length}>
                  <OrderStatusSubFilter
                    ordersStatusGroup={ordersStatusGroup}
                    selectedSubOrderStatus={selectedSubOrderStatus}
                    handleSelectedSubOrderStatus={handleSelectedSubOrderStatus}
                  />
                </OrderStatusSubFilterWrapper>
                {!isSelectedOrders && (
                  <OrdersDashboardControls
                    selectedOrderNumber={selectedOrderIds?.length}
                    filterValues={filterValues}
                    // redesign W1-5 (T1-5-4): the tab and its sub-statuses, as /orders passes them. Without them the «Export filtered»
                    // tab picker started empty and the export threw a TypeError (selectedSubOrderStatus undefined in the controller).
                    ordersStatusGroup={ordersStatusGroup}
                    selectedSubOrderStatus={selectedSubOrderStatus}
                    handleChangeMultiOrdersStatus={handleChangeMultiOrdersStatus}
                    handleDeleteMultiOrders={handleDeleteMultiOrders}
                    hideBulk={showSelectionBar}
                  />
                )}
              </OrderSubFilterControls>
            </div>
            {/* redesign all-in-one B2 (AIO-02): the body scrolls inside itself; the cap on #orderTable of the old page is gone */}
            <div
              ref={listRegionRef}
              className='aio-orders-body order-content'
              role='region'
              aria-label={t('ORDERS', 'Orders')}
              tabIndex={-1}
            >
              {/* redesign W1-5 (T1-5-4, P8): the bulk handlers (handleChangeMultiOrdersStatus, handleDeleteMultiOrders) go to the head
                  and to the sub-bar controls above, never here: with them the list draws its own SelectionBar. allInOne.w15.test.jsx pins it. */}
              <OrdersDashboard
                hidePhoto
                isSelectedOrders={isSelectedOrders}
                driverId={props.driverId}
                customerId={props.customerId}
                businessId={props.businessId}
                searchValue={searchValue}
                filterValues={filterValues}
                selectedOrderIds={selectedOrderIds}
                deletedOrderId={deletedOrderId}
                driversList={driversList}
                ordersStatusGroup={ordersStatusGroup}
                selectedSubOrderStatus={selectedSubOrderStatus}
                handleSelectedOrderIds={handleSelectedOrderIds}
                orderDetailId={orderDetailId}
                handleOpenOrderDetail={handleOpenOrderDetail}
                setSelectedOrderIds={setSelectedOrderIds}
                currentTourStep={currentTourStep}
                handleOpenTour={handleOpenTour}
                isTourOpen={isTourOpen}
                setIsTourOpen={setIsTourOpen}
                setFilterModalOpen={setFilterModalOpen}
                timeStatus={timeStatus}
                slaSettingTime={slaSettingTime}
                allowColumns={allowColumns}
                setAllowColumns={setAllowColumns}
                setOrdersAmountByStatus={setOrdersAmountByStatus}
                isUseQuery={isUseQuery}
                handleSetOpenOrderDetail={handleSetOpenOrderDetail}
              />
            </div>
            {showSelectionBar && (
              <SelectionBar
                className='odc-orders-selbar aio-selbar'
                label={t('ORDERS_SELECTION_ACTIONS', 'Actions for selected orders')}
                // tanda Y review (finding 1): the «x/y» of a running bulk change is said here, so nothing floats over the bar
                countLabel={totalSelectedOrder > 0
                  ? `${t('ORDERS_SELECTED', '_count_ selected').replace('_count_', selectedCount)} · ${selectedCount}/${totalSelectedOrder}`
                  : t('ORDERS_SELECTED', '_count_ selected').replace('_count_', selectedCount)}
                busy={totalSelectedOrder > 0}
                clearLabel={t('CLEAR_SELECTION', 'Clear selection')}
                onClear={() => setSelectedOrderIds([])}
                actions={(
                  <OrdersDashboardControls
                    variant='bulk'
                    selectedOrderNumber={selectedCount}
                    handleChangeMultiOrdersStatus={handleChangeMultiOrdersStatus}
                    handleDeleteMultiOrders={handleDeleteMultiOrders}
                  />
                )}
              />
            )}
          </div>
          <div className='aio-side'>
            {/* redesign all-in-one B2 (decision 6): below 1024px the map is mounted only in «Map» (it frames with its real size) */}
            {showMap && (
              <div className='aio-map'>
                <DriversLocation
                  driversIsOnline={mapsData.driversIsOnline}
                  selectedDriver={mapsData.selectedDriver}
                  onlineDrivers={mapsData.onlineDrivers}
                  offlineDrivers={mapsData.offlineDrivers}
                  selectedOrder={orderForMap}
                  assignedOrders={assignedOrders}
                />
              </div>
            )}
            <div className='aio-drivers-slot' hidden={isMapView}>
              {/* redesign all-in-one B2 (AIO-04): the drivers come from OrdersManage (one request), with their loading flag, instead of `drivers` */}
              <DriversManager
                className='aio-side-drivers'
                enableSocketEventDriverRoom
                disableSocketRoomDriver
                disableDriverLocationsSockets
                showCompressedInfo
                filterValues={filterValues}
                searchFilterValue={searchValue}
                driverGroupList={driverGroupList}
                isFilterDriverGroup={isFilterDriverGroup}
                driversList={driversList}
                driversLoading={!!driversList?.loading}
                setMapsData={setMapsData}
                handleEmtpyOrderSelected={handleBackRedirect}
                handleUpdateAssignedOrders={handleUpdateAssignedOrders}
                orderForMap={orderForMap}
                setOrderForMap={setOrderForMap}
              />
            </div>
          </div>
        </div>
      </OrdersListContainer>

      {isOpenOrderDetail && (
        <OrderDetails
          isSelectedOrders={isSelectedOrders}
          open={isOpenOrderDetail}
          order={detailsOrder}
          orderId={orderDetailId}
          isTourOpen={isTourOpen}
          onClose={() => handleBackRedirect()}
          setCurrentTourStep={setCurrentTourStep}
          currentTourStep={currentTourStep}
          isTourFlag={isTourFlag}
          setIsTourFlag={setIsTourFlag}
          setIsTourOpen={setIsTourOpen}
          handleOpenOrderDetail={handleOpenOrderDetail}
          drivers={driversList.drivers}
          disableSocketRoomDriver
        />
      )}

      {totalSelectedOrder > 0 && !showSelectionBar && (
        <WrapperIndicator role='status' aria-live='polite'>
          {selectedOrderIds.length}/{totalSelectedOrder}
        </WrapperIndicator>
      )}

      <WizardOrders
        isTourOpen={isTourOpen}
        setIsTourOpen={setIsTourOpen}
        currentStep={currentTourStep}
        detailsOrder={detailsOrder}
      />
      {/* redesign W1-5 (T1-5-4): one dialog. Main drew two legacy Alerts on the same state (one without a button, one with «Accept»),
          so «One order is required» opened two dialogs at once. Same title and text, one «Accept». */}
      <AlertDialog
        title={t('ALL_IN_ONE', 'All in one')} // redesign all-in-one B2 (decision 5, AIO-06): was «Orders manager»
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('ACCEPT', 'Accept')}
        content={alertState.content}
        open={alertState.open}
        onClose={() => closeAlert()}
      />
      <OrderStatusRegressionModal
        open={!!regressionRequest}
        orderId={regressionRequest?.orderId}
        ordersCount={selectedOrderIds.length}
        newStatus={multiOrderUpdateStatus}
        onSubmit={handleSubmitRegressionReason}
        onClose={handleCancelRegressionReason}
      />
    </>
  )
}

export const AllInOne = (props) => {
  const OrdersListControlProps = {
    ...props,
    UIComponent: OrdersManagerUI,
    driversPropsToFetch: ['id', 'name', 'lastname', 'location', 'enabled', 'available', 'busy', 'driver_groups.name', 'driver_groups.id', 'assigned_orders_count', 'photo', 'last_location_at'] // redesign all-in-one B2 (AIO-04): the signal «Location 3 minutes ago» of the driver row
  }
  return <OrdersManageController {...OrdersListControlProps} />
}
