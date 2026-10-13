import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { IntegrationListing as IntegrationListingController } from '~ui'

export const IntegrationsList = (props) => {
  return (
    <>
      <HelmetTags page='integrations' />
      <IntegrationListingController {...props} />
    </>
  )
}
