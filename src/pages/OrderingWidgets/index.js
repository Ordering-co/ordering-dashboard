import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { OrderingWidgets as OrderingWidgetsController } from '~ui'

export const OrderingWidgets = (props) => {
  return (
    <>
      <HelmetTags page='ordering_widgets' />
      <OrderingWidgetsController {...props} />
    </>
  )
}
