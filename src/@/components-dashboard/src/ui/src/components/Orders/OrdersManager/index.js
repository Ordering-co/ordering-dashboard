import React, { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useConfig, useLanguage, useSession, OrdersManage as OrdersManageController } from '../../../../../index'
import { OrderStatusFilterBar } from '../OrderStatusFilterBar'
import { OrdersContentHeader } from '../OrdersContentHeader'
import { OrderDetails } from '../OrderDetails'
import { OrdersDashboardControls } from '../OrdersDashboardControls'
import { OrderStatusRegressionModal } from '../OrderStatusRegressionModal'
import { Alert } from '../../Shared'
import { learnOptionsValues } from '../../../utils'
import { OrdersDashboard } from '../OrdersDashboard'
import { OrderStatusSubFilter } from '../OrderStatusSubFilter'
import { useListingSearchSeed } from '../../../hooks/useListingSearchSeed'
import { OrderNotification } from '../OrderNotification'
import { WizardOrders } from '../WizardOrders'
import { getOrdersUrlSearchState } from '../ordersUrlSearch'
import {
  OrdersListContainer,
  OrdersContent,
  OrdersInnerContent,
  WrapItemView,
  WrapperIndicator,
  OrderSubFilterControls,
  OrderStatusSubFilterWrapper
} from './styles'

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
  const [filterModalOpen, setFilterModalOpen] = useState(false)

  const [isTourOpen, setIsTourOpen] = useState(false)
  const [currentTourStep, setCurrentTourStep] = useState(0)
  const [isTourFlag, setIsTourFlag] = useState(false)
  const [alertState, setAlertState] = useState({ open: false, content: [] })
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
    setDetailsOrder(null)
    setOrderDetailId(null)
    if (!isSelectedOrders) {
      onOrderRedirect()
    } else {
      handleCustomOrderDetail && handleCustomOrderDetail(false)
    }
  }

  const closeAlert = () => {
    setAlertState({
      open: false,
      content: []
    })
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

  useEffect(() => {
    if (!isLateralBar || !driverId || isLateralTabPicked.current) return
    const tabs = ['inProgress', 'pending', 'completed', 'cancelled']
    if (tabs.some(tab => ordersAmountByStatus[tab] === null)) return
    isLateralTabPicked.current = true
    const firstTabWithOrders = tabs.find(tab => ordersAmountByStatus[tab] > 0)
    if (firstTabWithOrders) handleOrdersStatusGroupFilter(firstTabWithOrders)
  }, [ordersAmountByStatus])

  return (
    <>
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
        />
        <OrderStatusFilterBar
          isUseQuery={isUseQuery}
          selectedOrderStatus={ordersStatusGroup}
          changeOrderStatus={handleOrdersStatusGroupFilter}
          ordersAmountByStatus={ordersAmountByStatus}
        />
        <OrderSubFilterControls>
          <OrderStatusSubFilterWrapper isColumn={selectedOrderIds?.length}>
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
              franchiseId={props.franchiseId}
              handleChangeMultiOrdersStatus={handleChangeMultiOrdersStatus}
              handleDeleteMultiOrders={handleDeleteMultiOrders}
              handleOpenCustomOrderDetail={(id) => {
                setOrderDetailId(id)
                setIsOpenOrderDetail(true)
              }}
              handleOpenOrderDetail={handleOpenOrderDetail}
              ordersStatusGroup={ordersStatusGroup}
              selectedSubOrderStatus={selectedSubOrderStatus}
              disableSocketRoomDriver={disableSocketRoomDriver}
            />
          )}
        </OrderSubFilterControls>
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
                selectedOrderIds={selectedOrderIds}
                deletedOrderIds={deletedOrderIds}
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
                ordersAmountByStatus={ordersAmountByStatus}
                setOrdersAmountByStatus={setOrdersAmountByStatus}
                franchisesList={props.franchisesList}
              />
            </WrapItemView>
          </OrdersInnerContent>
        </OrdersContent>
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
          drivers={driversList.drivers}
          handleDeleteOrder={handleDeleteMultiOrders}
          handleBackRedirect={handleBackRedirect}
          handleOpenOrderDetail={handleOpenOrderDetail}
        />
      )}

      {!isSelectedOrders && (
        <OrderNotification customerId={props.customerId} />
      )}

      {totalSelectedOrder > 0 && (
        <WrapperIndicator>
          {selectedOrderIds.length}/{totalSelectedOrder}
        </WrapperIndicator>
      )}

      <WizardOrders
        isTourOpen={isTourOpen}
        setIsTourOpen={setIsTourOpen}
        currentStep={currentTourStep}
        detailsOrder={detailsOrder}
      />
      <Alert
        title={t('ORDERS_MANAGER', 'Orders manager')}
        content={alertState.content}
        open={alertState.open}
        onClose={() => closeAlert()}
        closeOnBackdrop={false}
      />
      <Alert
        title={t('ORDERS_MANAGER', 'Orders manager')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => closeAlert()}
        onAccept={() => closeAlert()}
        closeOnBackdrop={false}
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
