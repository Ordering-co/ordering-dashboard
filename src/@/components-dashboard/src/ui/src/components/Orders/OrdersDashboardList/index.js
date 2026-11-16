import React, { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useConfig, DashboardOrdersList as OrdersListController } from '../../../../../index'
import { OrdersListing } from '../OrdersListing'

// (owner decision 2 of the parity audit, 2026-10-27): on /orders the reader chooses the order of in progress, the
// earliest delivery (the default of the redesign) or the newest first of main. The choice is remembered on this browser only.
const IN_PROGRESS_SORT_KEY = 'odc-orders-in-progress-sort'
const IN_PROGRESS_SORTS = ['delivery', 'newest']
const readInProgressSort = () => {
  try {
    const saved = window.localStorage.getItem(IN_PROGRESS_SORT_KEY)
    return IN_PROGRESS_SORTS.includes(saved) ? saved : 'delivery'
  } catch {
    return 'delivery'
  }
}
const writeInProgressSort = (sort) => {
  try {
    window.localStorage.setItem(IN_PROGRESS_SORT_KEY, sort)
  } catch {
    // storage blocked: the choice lasts for this visit only
  }
}

export const OrdersDashboardList = (props) => {
  const {
    selectedSubOrderStatus,
    isMessagesView,
    orderByOption,
    setOrdersAmountByStatus,
    isUseQuery,
    isSelectedOrders,
    canSelectAllMatching
  } = props

  const [configState] = useConfig()

  const isShowSearchFilters = !configState?.configs?.search_box_enabled || configState?.configs?.search_box_enabled?.value === '1'
  const query = new URLSearchParams(useLocation().search)
  const defaultStatus = query.get('status')
  const defaultPage = query.get('page') || 1
  const defaultPageSize = query.get('pageSize') || 10

  // redesign 5.2 / fix-qa E7: «In progress» goes by the earliest delivery only on /orders, the page that asks
  // for «Select all N» (OrdersManager sets `canSelectAllMatching` for it and for no lateral list). The lists of a
  // customer or a driver and /all-in-one keep the newest-first order they always had.
  const canSortInProgress = !!canSelectAllMatching && !isSelectedOrders
  const [inProgressSort, setInProgressSort] = useState(readInProgressSort)
  const handleInProgressSortChange = (sort) => {
    if (!IN_PROGRESS_SORTS.includes(sort)) return
    setInProgressSort(sort)
    writeInProgressSort(sort)
  }
  const sortsInProgressByDelivery = canSortInProgress && inProgressSort === 'delivery'

  const OrdersCommonControlProps = {
    ...props,
    UIComponent: OrdersListing,
    useDefualtSessionManager: true,
    orderBy: isMessagesView ? orderByOption : 'id',
    orderDirection: isMessagesView
      ? orderByOption === 'id' ? 'desc' : 'asc'
      : 'desc',
    asDashboard: true,
    isSearchByOrderId: isShowSearchFilters,
    isSearchByCustomerName: isShowSearchFilters,
    isSearchByCustomerEmail: isShowSearchFilters,
    isSearchByCustomerPhone: isShowSearchFilters,
    isSearchByDriverName: isShowSearchFilters,
    isSearchByBusinessName: true,
    driverId: props.driverId,
    getDriversByControls: true
  }

  return (
    <>
      {isMessagesView
        ? (
        <OrdersListController
          isMessagesView
          {...OrdersCommonControlProps}
          paginationSettings={{
            initialPage: isUseQuery && !isNaN(defaultPage) ? Number(defaultPage) : 1,
            pageSize: isUseQuery && !isNaN(defaultPage) ? Number(defaultPageSize) : 10,
            controlType: 'pages'
          }}
          orderStatus={selectedSubOrderStatus?.all}
        />
          )
        : (
        <>
          <OrdersListController
            {...OrdersCommonControlProps}
            paginationSettings={{
              initialPage: isUseQuery && defaultStatus === 'pending' && !isNaN(defaultPage) ? Number(defaultPage) : 1,
              pageSize: isUseQuery && defaultStatus === 'pending' && !isNaN(defaultPage) ? Number(defaultPageSize) : 10,
              controlType: 'pages'
            }}
            groupStatus='pending'
            orderStatus={selectedSubOrderStatus?.pending}
            setOrdersTotalAmount={total => setOrdersAmountByStatus(prevState => ({ ...prevState, pending: total }))}
          />

          <OrdersListController
            groupStatus='inProgress'
            {...OrdersCommonControlProps}
            // redesign 5.2: on /orders in progress lists the earliest delivery first; the other tabs keep -id
            orderBy={sortsInProgressByDelivery ? 'delivery_datetime' : 'id'}
            orderDirection={sortsInProgressByDelivery ? 'asc' : 'desc'}
            inProgressSort={canSortInProgress ? inProgressSort : undefined}
            onInProgressSortChange={canSortInProgress ? handleInProgressSortChange : undefined}
            paginationSettings={{
              initialPage: isUseQuery && defaultStatus === 'inProgress' && !isNaN(defaultPage) ? Number(defaultPage) : 1,
              pageSize: isUseQuery && defaultStatus === 'inProgress' && !isNaN(defaultPage) ? Number(defaultPageSize) : 10,
              controlType: 'pages'
            }}
            orderStatus={selectedSubOrderStatus?.inProgress}
            setOrdersTotalAmount={total => setOrdersAmountByStatus(prevState => ({ ...prevState, inProgress: total }))}
          />

          <OrdersListController
            groupStatus='completed'
            {...OrdersCommonControlProps}
            paginationSettings={{
              initialPage: isUseQuery && defaultStatus === 'completed' && !isNaN(defaultPage) ? Number(defaultPage) : 1,
              pageSize: isUseQuery && defaultStatus === 'completed' && !isNaN(defaultPage) ? Number(defaultPageSize) : 10,
              controlType: 'pages'
            }}
            orderStatus={selectedSubOrderStatus?.completed}
            setOrdersTotalAmount={total => setOrdersAmountByStatus(prevState => ({ ...prevState, completed: total }))}
          />

          <OrdersListController
            groupStatus='cancelled'
            {...OrdersCommonControlProps}
            paginationSettings={{
              initialPage: isUseQuery && defaultStatus === 'cancelled' && !isNaN(defaultPage) ? Number(defaultPage) : 1,
              pageSize: isUseQuery && defaultStatus === 'cancelled' && !isNaN(defaultPage) ? Number(defaultPageSize) : 10,
              controlType: 'pages'
            }}
            orderStatus={selectedSubOrderStatus?.cancelled}
            setOrdersTotalAmount={total => setOrdersAmountByStatus(prevState => ({ ...prevState, cancelled: total }))}
          />
        </>
          )}
    </>
  )
}
