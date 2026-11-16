import React from 'react'
import { OrderMetaFields } from '../OrderMetaFields'

/**
 * Custom fields tab (batch 5.3): the order's metafields as a key-value table with visible labels.
 * Same controller and handlers as before (GET, POST and DELETE /orders/:id/metafields); the table
 * and the add form live in `OrderMetaFields`.
 */
export const FieldsTab = (props) => {
  const order = props.order?.order
  if (!order?.id) return null
  return <OrderMetaFields orderId={order.id} />
}
