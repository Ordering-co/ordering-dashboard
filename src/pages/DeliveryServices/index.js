import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { DeliveryServices as DeliveryServicesController } from '~ui'

export const DeliveryServices = (props) => {
  const deliveryServicesProps = {
    ...props,
    isUseQuery: true
  }

  return (
    <>
      <HelmetTags page='delivery_services' />
      <DeliveryServicesController {...deliveryServicesProps} />
    </>
  )
}
