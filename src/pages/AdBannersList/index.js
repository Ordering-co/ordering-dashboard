import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { AdBannersListing as AdBannersListController } from '~ui'

export const AdBannersList = (props) => {
  return (
    <>
      <HelmetTags page='ad_banners' />
      <AdBannersListController {...props} />
    </>
  )
}
