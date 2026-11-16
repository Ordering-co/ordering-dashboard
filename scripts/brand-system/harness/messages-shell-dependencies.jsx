import React from 'react'

export { addQueryToUrl, removeQueryToUrl } from '../../../src/@/components-dashboard/src/ui/src/utils/queryString'
export { learnOptionsValues } from '../../../src/@/components-dashboard/src/ui/src/utils/learnOptionsValues'

const orders = [
  { id: 501, uuid: 'order-501', customer: { name: 'First customer' }, unread_count: 2 },
  { id: 502, uuid: 'order-502', customer: { name: 'Second customer' }, unread_count: 0 }
]

export const OrdersContentHeader = props => {
  globalThis.__OD_MESSAGES_HEADER__ = {
    hideTour: props.hideTour,
    isDisableControl: props.isDisableControl,
    learnOptions: props.learnOptions,
    title: props.title
  }
  return (
    <header data-testid='messages-header'>
      <h1>{props.title}</h1>
      <button type='button' onClick={() => props.handleChangeSearch('fixture search')}>Header search</button>
      <button type='button' onClick={() => props.handleChangeFilterValues({ status: 'completed' })}>Header filter</button>
      <button type='button' onClick={() => props.setFilterModalOpen(true)}>Open filters</button>
      <button type='button' onClick={() => props.setTimeStatus('late')}>Set late status</button>
    </header>
  )
}

export const OrdersDashboardList = props => {
  globalThis.__OD_MESSAGES_DASHBOARD__ = {
    isMessagesView: props.isMessagesView,
    isUseQuery: props.isUseQuery,
    orderByOption: props.orderByOption,
    orderIdForUnreadCountUpdate: props.orderIdForUnreadCountUpdate,
    selectedOrderId: props.selectedOrderCard?.id,
    timeStatus: props.timeStatus
  }
  return (
    <section aria-label='Fixture message orders'>
      {orders.map(order => (
        <div key={order.id}>
          <button type='button' onClick={() => props.handleOrderCardClick(order)}>Select order {order.id}</button>
          <button type='button' onClick={() => props.handleOpenOrderDetail(order)}>Open details {order.id}</button>
        </div>
      ))}
    </section>
  )
}

export const Messages = props => (
  <section aria-label='Selected message'>
    <p>Selected conversation copy for order {props.orderId}</p>
    <button type='button' onClick={() => props.handleUpdateOrderForUnreadCount(props.orderId)}>Mark unread handled</button>
  </section>
)

export const OrderDetails = props => {
  globalThis.__OD_MESSAGES_ORDER_DETAILS__ = [...(globalThis.__OD_MESSAGES_ORDER_DETAILS__ || []), {
    open: props.open,
    orderId: props.orderId,
    // redesign messages FASE 3 (decision 2A): the order the header's «View order» hands over is the very object of the conversation list
    orderReference: orders.includes(props.order) || (globalThis.__OD_MESSAGES_CONVERSATION_REFERENCES__ || []).includes(props.order),
    driversCount: props.drivers?.length
  }]
  // redesign messages FASE 3 (decision 8A): like the real panel, it sits above the phone conversation layer (--od-x-layer-chrome)
  return (
    <aside aria-label='Order details fixture' style={{ position: 'fixed', insetBlock: 0, insetInlineEnd: 0, inlineSize: 'min(100%, 320px)', zIndex: 'calc(var(--od-x-layer-chrome) + 1)', background: 'var(--od-surface)' }}>
      <p>Order detail {props.orderId}</p>
      <button type='button' onClick={props.onClose}>Close order details</button>
      <button type='button' onClick={() => props.handleOpenOrderDetail(orders[1])}>Open nested order 502</button>
    </aside>
  )
}

export const OrderNotification = () => <div data-testid='order-notification'>Order notification fixture</div>
// W0-E-06: the slot MessagesListing mounts under its head since W0-12 (231eac6b), with the same wrapper as the real one.
export const OrderNotificationSlot = () => (
  <div className='odc-notice-slot' data-slot='order-notice-slot'>
    <OrderNotification />
  </div>
)

// redesign W1-1 (T1-2): ContactOrdersSheet replaces the lateral bar; like the real Sheet it shows nothing while closed
export const ContactOrdersSheet = props => {
  if (!props.open) return null
  const source = props.user || props.business
  globalThis.__OD_MESSAGES_LATERAL__ = [...(globalThis.__OD_MESSAGES_LATERAL__ || []), {
    businessId: props.business?.id,
    isBusiness: props.isBusiness,
    isCustomer: props.isCustomer,
    isDriver: props.isDriver,
    open: props.open,
    sameReference: [...usersForReference(), ...allBusinessesForReference()].includes(source),
    userId: props.user?.id
  }]
  return (
    <aside aria-label='Orders lateral fixture'>
      <p>Orders for {source?.name} {source?.lastname}</p>
      <button type='button' onClick={props.onClose}>Close lateral orders</button>
    </aside>
  )
}

const usersForReference = () => globalThis.__OD_MESSAGES_USER_REFERENCES__ || []
const allBusinessesForReference = () => globalThis.__OD_MESSAGES_BUSINESS_REFERENCES__ || []
