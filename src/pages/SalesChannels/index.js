import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import {
  SalesChannels as SalesChannelsController,
  addQueryToUrl,
  removeQueryToUrl
} from '~ui'

export const SalesChannels = (props) => {
  const businessesProps = {
    ...props,
    isUseQuery: true,
    onBusinessRedirect: (businessId) => {
      if (!businessId) {
        return removeQueryToUrl(['id', 'section', 'tab', 'business_type', 'paymethod', 'paymethod_tab', 'setting_tab', 'menu', 'product', 'zone', 'zone_tab', 'wallet'])
      }
      return addQueryToUrl({ id: businessId })
    }
  }
  return (
    <>
      <HelmetTags page='sales_channels' />
      <SalesChannelsController {...businessesProps} />
    </>
  )
}
