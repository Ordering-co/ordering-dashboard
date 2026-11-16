import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useLanguage, useSession, OrdersManage as OrdersManageController } from '../../../../../index'
import { OrdersContentHeader, OrderDetails } from '../../Orders'
import { OrderNotificationSlot } from '../../Orders/OrderNotification'
import { Inbox } from '../../Orders/Messages/Inbox' // redesign messages B3b: by file, as the order panel's chat is
import { useWindowSize } from '../../../hooks/useWindowSize'
import { addQueryToUrl, removeQueryToUrl, learnOptionsValues } from '../../../utils'

import { MessagesListingContainer } from './messages-listing-styles'

export const MessagesListingUI = (props) => {
  const {
    searchValue,
    driverGroupList,
    driversList,
    paymethodsList,
    businessesList,
    filterValues,
    selectedSubOrderStatus,
    handleChangeSearch,
    handleChangeFilterValues,
    isUseQuery
  } = props

  const query = new URLSearchParams(useLocation().search)
  const [{ user }] = useSession()

  const [, t] = useLanguage()
  const { width } = useWindowSize()
  const [isOpenOrderDetail, setIsOpenOrderDetail] = useState(false)
  const [orderDetailId, setOrderDetailId] = useState(null)
  const [detailsOrder, setDetailsOrder] = useState(null)
  const [filterModalOpen, setFilterModalOpen] = useState(false)
  const [timeStatus, setTimeStatus] = useState(null)

  // redesign messages B3b (decision 2A): the owner of a single store does not see the store repeated on every row. Admins (level other than 2)
  // and owners of more than one business do.
  const showBusiness = user?.level !== 2 || (businessesList?.businesses?.length ?? 0) > 1

  const learnOptions = learnOptionsValues(['message_general_view'], t)

  const handleOpenOrderDetail = (order) => {
    setDetailsOrder(order)
    setOrderDetailId(order.id)
    setIsOpenOrderDetail(true)

    if (isUseQuery) {
      addQueryToUrl({ id: order.id })
    }
  }

  const handleCloseOrderDetail = () => {
    setIsOpenOrderDetail(false)
    removeQueryToUrl(['id'])
  }

  // redesign W1-6 (T1-6-4, W1-D-16): below 768px the page behind the record panel does not scroll while it is open ('hidden' on
  // open, 'auto' on close, as in main). Main left 'hidden' behind when the page unmounted with the panel open (a menu click, the
  // back button), so the value the body had when the page mounted is put back on unmount. It is read before the effect below runs.
  useEffect(() => {
    const previous = document.body.style.overflow
    return () => { document.body.style.overflow = previous }
  }, [])

  useEffect(() => {
    if (width >= 768) return
    document.body.style.overflow = isOpenOrderDetail ? 'hidden' : 'auto'
  }, [width, isOpenOrderDetail])

  useEffect(() => {
    const id = query.get('id')
    if (id) {
      setOrderDetailId(id)
      setIsOpenOrderDetail(true)
    }
  }, [])

  return (
    <>
      <MessagesListingContainer id='deliveryDashboard'>
        <OrdersContentHeader
          isDisableControl
          title={t('MESSAGES', 'Messages')}
          searchValue={searchValue}
          driverGroupList={driverGroupList}
          driversList={driversList}
          paymethodsList={paymethodsList}
          businessesList={businessesList}
          filterValues={filterValues}
          handleChangeSearch={handleChangeSearch}
          handleChangeFilterValues={handleChangeFilterValues}
          filterModalOpen={filterModalOpen}
          setFilterModalOpen={setFilterModalOpen}
          setTimeStatus={setTimeStatus}
          learnOptions={learnOptions}
          hideTour
        />
        {/* redesign W0-12 (W0-A0-01): one-line slot under the head, inside the page container */}
        <OrderNotificationSlot />
        {/* redesign messages B3b (decisions 1A, 8A): the two-pane inbox replaces the single «Orders» tab, the sort buttons, the list and the old chat.
            «Contacts» and the businesses list were never mounted in main (W1-D-17): their files stay, this page no longer imports them. */}
        <Inbox
          searchValue={searchValue}
          filterValues={filterValues}
          driversList={driversList}
          selectedSubOrderStatus={selectedSubOrderStatus}
          timeStatus={timeStatus}
          isUseQuery={isUseQuery}
          franchisesList={props.franchisesList}
          onOpenOrder={handleOpenOrderDetail}
          orderDetailOpen={isOpenOrderDetail}
          showBusiness={showBusiness}
        />
      </MessagesListingContainer>

      {isOpenOrderDetail && (
        <OrderDetails
          open={isOpenOrderDetail}
          order={detailsOrder}
          orderId={orderDetailId}
          drivers={driversList.drivers}
          onClose={() => handleCloseOrderDetail()}
          handleOpenOrderDetail={handleOpenOrderDetail}
        />
      )}
    </>
  )
}

export const MessagesListing = (props) => {
  const OrdersListControlProps = {
    ...props,
    UIComponent: MessagesListingUI,
    driversPropsToFetch: ['id', 'name', 'lastname', 'location', 'enabled', 'available', 'busy', 'driver_groups.name', 'driver_groups.id', 'assigned_orders_count', 'last_order_assigned_at', 'last_location_at', 'cellphone', 'photo', 'qualification']
  }
  return <OrdersManageController {...OrdersListControlProps} />
}
