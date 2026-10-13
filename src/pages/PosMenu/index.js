import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import {
  PosMenu as PosMenuController,
  addQueryToUrl,
  removeQueryToUrl
} from '~ui'

export const PosMenu = (props) => {
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
      <HelmetTags page='pos_menu' />
      <PosMenuController {...businessesProps} />
    </>
  )
}
