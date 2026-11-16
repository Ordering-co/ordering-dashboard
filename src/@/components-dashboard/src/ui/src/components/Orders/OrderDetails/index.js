import React from 'react'
import { OrderDetails as OrderDetailsController } from '../../../../../index'
import { OrderDetailsUI } from './OrderDetailsLazy'

// redesign N-05: the panel's code loads on demand; see OrderDetailsLazy (the chunk and the skeleton) and OrderDetailsPanel.
export const OrderDetails = (props) => {
  const orderDetailsProps = {
    ...props,
    asDashboard: true,
    isDisableLoadMessages: true,
    UIComponent: OrderDetailsUI
  }

  return (
    <OrderDetailsController {...orderDetailsProps} />
  )
}
