import React, { useState } from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import { HelmetTags } from '../../components/HelmetTags'
import { OrderingWebsiteUI } from '~ui'
import { OrderingWebsite as OrderingWebsiteController } from '~components'

export const FranchisesWebsite = (props) => {
  const location = useLocation()
  const history = useHistory()
  const appId = new URLSearchParams(location.search).get('appId')
  const [appIdState, setAppIdState] = useState(appId || 'web_franchises_x')
  // redesign J5 row 54 (franchises-website P-FW2, ): the site picked (or the fallback below) goes into ?appId=, so a
  // reload or a shared link keeps it. Safe since (P-FW4): ?appId= only opens an existing franchise site. Written through
  // the router (review J5 #1): the sections editor rebuilds the address from the router's location when it changes section.
  const changeAppId = (value) => {
    setAppIdState(value)
    if (!value) return
    const current = history.location
    const next = new URLSearchParams(current.search)
    next.set('appId', value)
    history.replace({ pathname: current.pathname, search: `?${next.toString()}`, hash: current.hash, state: current.state })
  }
  const franchiseWebsiteProps = {
    ...props,
    UIComponent: OrderingWebsiteUI,
    appId: appIdState,
    type: 'franchiseweb',
    name: 'Franchise website',
    isFranchise: true,
    disableReplaceCode: true,
    // ?appId= only opens an existing franchise site; anything else opens this one
    fallbackAppId: 'web_franchises_x',
    setAppIdState: changeAppId,
    // redesign J5 row 52 (ordering-website P-OW3, ): the sections editor, with the franchise's title, site picker and texts
    layout: 'sections'
  }
  return (
    <>
      <HelmetTags page='franchises_website' />
      <OrderingWebsiteController {...franchiseWebsiteProps} />
    </>
  )
}
