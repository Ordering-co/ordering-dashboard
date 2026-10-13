import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { CampaignListing as CampaignListingController } from '~ui'

export const CampaignListing = (props) => {
  const campaignListProps = {
    ...props,
    isUseQuery: true
  }
  return (
    <>
      <HelmetTags page='campaign' />
      <CampaignListingController {...campaignListProps} />
    </>
  )
}
