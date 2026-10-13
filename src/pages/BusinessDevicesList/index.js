import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { BusinessDeviceListing as BusinessDeviceListingController } from '~ui'

export const BusinessDevicesList = (props) => {
  return (
    <>
      <HelmetTags page='devices' />
      <BusinessDeviceListingController {...props} />
    </>
  )
}
