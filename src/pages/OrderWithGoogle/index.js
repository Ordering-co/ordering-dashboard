import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { OrderWithGoogle as OrderWithGoogleController } from '~ui'

export const OrderWithGoogle = (props) => {
  return (
    <>
      <HelmetTags page='order_with_google' />
      <OrderWithGoogleController {...props} />
    </>
  )
}
