import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { useConfig, useLanguage, useSession, OrdersManage as OrdersManageController } from '../../../../../index'
import { OrderStatusFilterBar } from '../OrderStatusFilterBar'
import { OrdersContentHeader } from '../OrdersContentHeader'
import { OrderDetails } from '../OrderDetails'
import { OrdersDashboardControls } from '../OrdersDashboardControls'
import { CreateCustomOrderProvider } from '../CreateCustomOrder'
import { OrderStatusRegressionModal } from '../OrderStatusRegressionModal'
import { Button, Dialog, SplitView, TabPanel } from '../../Shared/Product'
import { learnOptionsValues } from '../../../utils'
import { OrdersDashboard } from '../OrdersDashboard'
import { useListingSearchSeed } from '../../../hooks/useListingSearchSeed'
import { OrderNotification } from '../OrderNotification'
import { WizardOrders } from '../WizardOrders'
import { getOrdersUrlSearchState } from '../ordersUrlSearch'
import { SelectSurfaceContext } from '../../Shared/UI/selectPlacement'
import {
  OrdersListContainer,
  OrdersContent,
  OrdersInnerContent,
  WrapItemView,
  WrapperIndicator
} from './styles'

// redesign F2 (C18): every dropdown inside /orders, the order panel and the create-order wizard is drawn with the
// one anatomy (field trigger, list at the trigger, brand rows). Screens outside this manager keep their lists.
const ORDERS_SELECT_SURFACE = { fitTrigger: true }

const OrdersManagerUI = (props) => {
  const {
    isLateralBar,
    isSelectedOrders,
    searchValue,
    driverGroupList,
    assignableDriverGroupList,
    driversList,
    paymethodsList,
    businessesList,
    citiesList,
    adminsList,
    ordersStatusGroup,
    filterValues,
    deletedOrderIds,
    startMulitOrderStatusChange,
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
    timeStatus,
    setTimeStatus,
    isUseQuery,
    disableDriverLocationsSockets,
    detailsOrder,
    setDetailsOrder,
    disableSocketRoomDriver,
    driverId
  } = props

  const [, t] = useLanguage()
  const [{ user }] = useSession()
  const [{ configs }] = useConfig()

  const { search } = useLocation()
  const { orderId: orderIdFromUrl, isDetailOpen: isDetailOpenFromUrl } = getOrdersUrlSearchState(search)
  const [isOpenOrderDetail, setIsOpenOrderDetail] = useState(false)
  const [orderDetailId, setOrderDetailId] = useState(null)
  // "Open as page": the order panel takes the whole width of the split view (redesign 5.3-A).
  const [isPanelExpanded, setIsPanelExpanded] = useState(false)
  const [filterModalOpen, setFilterModalOpen] = useState(false)
  // Where the "connection lost" notice lands, above the list (redesign 5.2-A).
  const [connectionNoticeHost, setConnectionNoticeHost] = useState(null)

  const [isTourOpen, setIsTourOpen] = useState(false)
  const [currentTourStep, setCurrentTourStep] = useState(0)
  const [isTourFlag, setIsTourFlag] = useState(false)
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const alertOkRef = useRef(null)
  const [slaSettingTime, setSlaSettingTime] = useState(60000)
  const [ordersAmountByStatus, setOrdersAmountByStatus] = useState({
    pending: null,
    inProgress: null,
    completed: null,
    cancelled: null
  })

  const [totalSelectedOrder, setTotalSelectedOrder] = useState(0)
  const isLateralTabPicked = useRef(false)
  const learnOptions = learnOptionsValues(['order_list_general_view', 'order_details', 'create_custom_order'], t)

  const handleBackRedirect = () => {
    setIsOpenOrderDetail(false)
    setIsPanelExpanded(false)
    setDetailsOrder(null)
    setOrderDetailId(null)
    if (!isSelectedOrders) {
      onOrderRedirect()
    } else {
      handleCustomOrderDetail && handleCustomOrderDetail(false)
    }
  }

  // Keeps the text while the dialog fades out.
  const closeAlert = () => {
    setAlertState(current => ({ ...current, open: false }))
  }

  // The order a custom order just created: it opens in the panel.
  const openCustomOrderDetail = (id) => {
    setOrderDetailId(id)
    setIsOpenOrderDetail(true)
  }

  const handleOpenOrderDetail = (order, isKeydown = false, forceTourOpen = false) => {
    const _isTourOpen = isTourOpen || forceTourOpen
    if (_isTourOpen && currentTourStep === 4 && !isKeydown) {
      setIsTourOpen(false)
      return
    }
    (!configs?.optimize_order_data || (configs?.optimize_order_data?.value === '0')) && setDetailsOrder(order)
    setOrderDetailId(order.id)
    setIsOpenOrderDetail(true)
    if (!isSelectedOrders) {
      onOrderRedirect(order.id)
    } else {
      handleCustomOrderDetail && handleCustomOrderDetail(true)
    }
    if (_isTourOpen && currentTourStep === 4) {
      setIsTourFlag(true)
    }
    if (_isTourOpen && currentTourStep === 0) {
      setTimeout(() => {
        setCurrentTourStep(1)
      }, 1)
    }
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

  useEffect(() => {
    if (startMulitOrderStatusChange) {
      setTotalSelectedOrder(selectedOrderIds.length)
    }
  }, [startMulitOrderStatusChange])

  useEffect(() => {
    if (selectedOrderIds.length === 0) {
      setTimeout(() => {
        setTotalSelectedOrder(0)
      }, 500)
    }
  }, [selectedOrderIds])

  useEffect(() => {
    if (isSelectedOrders) return
    if (!isDetailOpenFromUrl) {
      setIsOpenOrderDetail(false)
      setOrderDetailId(null)
      setDetailsOrder(null)
      return
    }
    if (user?.level === 5) {
      handleBackRedirect()
      return
    }
    setOrderDetailId(orderIdFromUrl)
    setIsOpenOrderDetail(true)
  }, [user, isSelectedOrders, search])

  useEffect(() => {
    if (isTourOpen) return
    setIsTourFlag(false)
  }, [isTourOpen])

  // main the driver panel opens on the first tab that has orders, once every count is in. A group the opener chose
  // (`statusGroup`, drivers-dashboard DD-06) wins: it is already the open tab.
  useEffect(() => {
    if (!isLateralBar || !driverId || isLateralTabPicked.current) return
    if (props.statusGroup !== undefined && props.statusGroup !== null) return
    const tabs = ['inProgress', 'pending', 'completed', 'cancelled']
    if (tabs.some(tab => ordersAmountByStatus[tab] === null)) return
    isLateralTabPicked.current = true
    const firstTabWithOrders = tabs.find(tab => ordersAmountByStatus[tab] > 0)
    if (firstTabWithOrders) handleOrdersStatusGroupFilter(firstTabWithOrders)
  }, [ordersAmountByStatus])

  const renderConnectionNotice = (notice) => (connectionNoticeHost ? createPortal(notice, connectionNoticeHost) : null)

  // Under the tabs, above the list: inline notices (connection lost, sound) and the one
  // tab panel around the list. Built once per render; the header only places it.
  const tabbedList = (
    <>
      <div className='odc-orders-notices'>
        <div ref={setConnectionNoticeHost} />
        {!isSelectedOrders && (
          <OrderNotification customerId={props.customerId} />
        )}
      </div>
      <TabPanel value={ordersStatusGroup || 'pending'}>
        <OrdersContent>
          <OrdersInnerContent className='order-content'>
            <WrapItemView>
              <OrdersDashboard
                isUseQuery={isUseQuery}
                isSelectedOrders={isSelectedOrders}
                driverId={props.driverId}
                customerId={props.customerId}
                businessId={props.businessId}
                franchiseId={props.franchiseId}
                searchValue={searchValue}
                filterValues={filterValues}
                handleChangeSearch={handleChangeSearch}
                handleChangeFilterValues={handleChangeFilterValues}
                selectedOrderIds={selectedOrderIds}
                deletedOrderIds={deletedOrderIds}
                driversList={driversList}
                ordersStatusGroup={ordersStatusGroup}
                selectedSubOrderStatus={selectedSubOrderStatus}
                handleSelectedSubOrderStatus={handleSelectedSubOrderStatus}
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
                ordersAmountByStatus={ordersAmountByStatus}
                setOrdersAmountByStatus={setOrdersAmountByStatus}
                franchisesList={props.franchisesList}
                handleChangeMultiOrdersStatus={handleChangeMultiOrdersStatus}
                handleDeleteMultiOrders={handleDeleteMultiOrders}
                multiOrderUpdateStatus={multiOrderUpdateStatus}
                // «Select all N» is only for the /orders page; the lateral bars and detail tabs keep the page selection
                canSelectAllMatching={!isSelectedOrders}
              />
            </WrapItemView>
          </OrdersInnerContent>
        </OrdersContent>
      </TabPanel>
    </>
  )

  const listView = (
    <OrdersListContainer
      isSelectedOrders={isSelectedOrders}
    >
      <OrdersContentHeader
        isDisableTitle={isSelectedOrders}
        isSelectedOrders={isSelectedOrders}
        title={t('ORDERS_LIST', 'Orders list')}
        searchValue={searchValue}
        assignableDriverGroupList={assignableDriverGroupList}
        driverGroupList={driverGroupList}
        driversList={driversList}
        citiesList={citiesList}
        paymethodsList={paymethodsList}
        businessesList={businessesList}
        adminsList={adminsList}
        filterValues={filterValues}
        handleChangeSearch={handleChangeSearch}
        handleChangeFilterValues={handleChangeFilterValues}
        selectedOrderIds={selectedOrderIds}
        handleDeleteMultiOrders={handleDeleteMultiOrders}
        handleChangeMultiOrdersStatus={handleChangeMultiOrdersStatus}
        handleOpenTour={() => handleOpenTour()}
        filterModalOpen={filterModalOpen}
        setFilterModalOpen={setFilterModalOpen}
        setTimeStatus={setTimeStatus}
        setSlaSettingTime={setSlaSettingTime}
        isLateralBar={isLateralBar}
        learnOptions={learnOptions}
        hideTour
        disableDriverLocationsSockets={disableDriverLocationsSockets}
        disableSocketRoomDriver={disableSocketRoomDriver}
        ordersStatusGroup={ordersStatusGroup}
        selectedSubOrderStatus={selectedSubOrderStatus}
        handleSelectedSubOrderStatus={handleSelectedSubOrderStatus}
        toolsSlot={!isSelectedOrders}
        renderConnectionNotice={renderConnectionNotice}
        headerActions={!isSelectedOrders && (
          <OrdersDashboardControls
            variant='header'
            learnOptions={learnOptions}
            isOpenOrderDetail={isOpenOrderDetail}
            selectedOrderNumber={selectedOrderIds?.length}
            filterValues={filterValues}
            franchiseId={props.franchiseId}
            handleChangeMultiOrdersStatus={handleChangeMultiOrdersStatus}
            handleDeleteMultiOrders={handleDeleteMultiOrders}
            handleOpenCustomOrderDetail={openCustomOrderDetail}
            handleOpenOrderDetail={handleOpenOrderDetail}
            ordersStatusGroup={ordersStatusGroup}
            selectedSubOrderStatus={selectedSubOrderStatus}
            disableSocketRoomDriver={disableSocketRoomDriver}
          />
        )}
        renderBelowTitle={(filterBar) => (
          <OrderStatusFilterBar
            isUseQuery={isUseQuery}
            selectedOrderStatus={ordersStatusGroup}
            changeOrderStatus={handleOrdersStatusGroupFilter}
            ordersAmountByStatus={ordersAmountByStatus}
            afterTabs={filterBar}
          >
            {tabbedList}
          </OrderStatusFilterBar>
        )}
      />
    </OrdersListContainer>
  )

  // /orders shows the order beside the list (split view); the lateral bars of a customer or a
  // driver keep the panel over the page, as before. The panel is the same component.
  const orderDetails = isOpenOrderDetail && (
    <OrderDetails
      isSelectedOrders={isSelectedOrders}
      layout={isSelectedOrders ? undefined : 'split'}
      expanded={isSelectedOrders ? undefined : isPanelExpanded}
      onExpandedChange={isSelectedOrders ? undefined : setIsPanelExpanded}
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
      drivers={driversList.drivers}
      handleDeleteOrder={handleDeleteMultiOrders}
      handleBackRedirect={handleBackRedirect}
      handleOpenOrderDetail={handleOpenOrderDetail}
    />
  )

  return (
    <SelectSurfaceContext.Provider value={ORDERS_SELECT_SURFACE}>
      {/* redesign F6c (Q2-08): the create-order form is hosted here, above every branch of the page head, so it
          survives the desktop/phone switch of the buttons that open it. */}
      <CreateCustomOrderProvider
        disabled={!!isSelectedOrders}
        handleOpenCustomOrderDetail={openCustomOrderDetail}
        handleOpenOrderDetail={handleOpenOrderDetail}
      >
        {isSelectedOrders
          ? (
            <>
              {listView}
              {orderDetails}
            </>
            )
          : (
            <SplitView
              className='odc-orders-split'
              list={listView}
              panel={orderDetails}
              open={isOpenOrderDetail}
              expanded={isPanelExpanded}
              panelLabel={t('ORDER_NUMBER_TITLE', 'Order _id_').replace('_id_', orderDetailId ?? '')}
              resizeLabel={t('RESIZE_ORDER_PANEL', 'Resize the order panel')}
              storageKey='od.orders.panel'
              onClose={() => {
                // Escape inside the panel: the same exit as the Close button; it also ends the Learn tour, as it always did.
                handleBackRedirect()
                setIsTourOpen(false)
              }}
            />
            )}

        {totalSelectedOrder > 0 && (
          <WrapperIndicator role='status'>
            {selectedOrderIds.length}/{totalSelectedOrder}
          </WrapperIndicator>
        )}

        <WizardOrders
          isTourOpen={isTourOpen}
          setIsTourOpen={setIsTourOpen}
          currentStep={currentTourStep}
          detailsOrder={detailsOrder}
        />
        <Dialog
          open={alertState.open}
          onOpenChange={(next) => { if (!next) closeAlert() }}
          size='sm'
          initialFocus={alertOkRef}
          title={t('ORDERS_MANAGER', 'Orders manager')}
          closeLabel={t('CLOSE', 'Close')}
          footer={<Button ref={alertOkRef} variant='primary' onClick={() => closeAlert()}>{t('OK', 'OK')}</Button>}
        >
          {alertState.content}
        </Dialog>
        <OrderStatusRegressionModal
          open={!!regressionRequest}
          orderId={regressionRequest?.orderId}
          ordersCount={selectedOrderIds.length}
          newStatus={multiOrderUpdateStatus}
          onSubmit={handleSubmitRegressionReason}
          onClose={handleCancelRegressionReason}
        />
      </CreateCustomOrderProvider>
    </SelectSurfaceContext.Provider>
  )
}

export const OrdersManager = (props) => {
  const searchSeed = useListingSearchSeed({ enabled: !!props.isUseQuery })
  const OrdersListControlProps = {
    ...props,
    searchSeed,
    UIComponent: OrdersManagerUI,
    driversPropsToFetch: ['id', 'name', 'lastname', 'location', 'enabled', 'available', 'busy', 'driver_groups', 'assigned_orders_count', 'last_order_assigned_at', 'last_location_at', 'cellphone', 'photo', 'qualification']
  }
  return <OrdersManageController {...OrdersListControlProps} />
}
