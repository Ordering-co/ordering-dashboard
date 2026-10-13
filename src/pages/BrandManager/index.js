import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { BusinessBrandListing as BusinessBrandListingController } from '~ui'

export const BrandManager = (props) => {
  return (
    <>
      <HelmetTags page='brand' />
      <BusinessBrandListingController {...props} />
    </>
  )
}
