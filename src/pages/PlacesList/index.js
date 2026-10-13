import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { PlaceListing as PlaceListingController } from '~ui'

export const PlacesList = (props) => {
  return (
    <>
      <HelmetTags page='places' />
      <PlaceListingController {...props} />
    </>
  )
}
