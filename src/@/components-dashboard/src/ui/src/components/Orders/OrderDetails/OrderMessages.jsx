import React, { createContext, useContext } from 'react'
import { Messages as MessagesController } from '../../../../../index'

/**
 * One `Messages` controller for the whole order panel (parity audit 2, B1 and B8). The route in Details, the
 * Activity feed and the Chat all read the same GET /orders/:id/messages, the same live `message` events and the same
 * room (`messages_orders_${id}_${level}`), so the panel asks the controller once and hands its state to the tabs
 * through this context. Before, each tab mounted its own controller: two or three GETs per order, and two
 * controllers joining and leaving the same socket room.
 *
 * A tab rendered on its own (outside the panel) finds no provider and mounts its own controller as it always did, so
 * the tabs keep working standalone.
 */
const OrderMessagesContext = createContext(null)

// What the controller gives its UIComponent: messages, send, read, draft, recipients... `children` is the panel.
const OrderMessagesState = ({ children, ...controllerState }) => (
  <OrderMessagesContext.Provider value={controllerState}>
    {children}
  </OrderMessagesContext.Provider>
)

export const OrderMessagesProvider = ({ order, handleUpdateOrderForUnreadCount, children }) => (
  <MessagesController
    orderId={order.id}
    order={order}
    asDashboard
    handleUpdateOrderForUnreadCount={handleUpdateOrderForUnreadCount}
    UIComponent={OrderMessagesState}
  >
    {children}
  </MessagesController>
)

/** The controller state of the panel, or null when the tab is rendered outside it. */
export const useOrderMessages = () => useContext(OrderMessagesContext)
