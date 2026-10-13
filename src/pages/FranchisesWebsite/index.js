import React, { useState } from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { OrderingWebsiteUI } from '~ui'
import { OrderingWebsite as OrderingWebsiteController } from '~components'

export const FranchisesWebsite = (props) => {
  const appId = new URLSearchParams(window.location.search).get('appId')
  const [appIdState, setAppIdState] = useState(appId || 'web_franchises_x')
  const franchiseWebsiteProps = {
    ...props,
    UIComponent: OrderingWebsiteUI,
    appId: appIdState,
    type: 'franchiseweb',
    name: 'Franchise website',
    isFranchise: true,
    disableReplaceCode: true,
    setAppIdState
  }
  return (
    <>
      <HelmetTags page='franchises_website' />
      <OrderingWebsiteController {...franchiseWebsiteProps} />
    </>
  )
}
