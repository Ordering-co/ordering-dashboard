import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { DriverStoreStatus as DriverStoreStatusController } from '~ui'

export const DriverStoreStatus = (props) => {
  return (
    <>
      <HelmetTags page='driver_store_status' />
      <DriverStoreStatusController {...props} />
    </>
  )
}
