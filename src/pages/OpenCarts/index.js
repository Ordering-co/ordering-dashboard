import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { OpenCartListing as OpenCartListingController, addQueryToUrl, removeQueryToUrl } from '~ui'

export const OpenCarts = (props) => {
  const openCartsProps = {
    ...props,
    isUseQuery: true,
    onCartRedirect: (id) => {
      if (!id) {
        return removeQueryToUrl(['id'])
      }
      return addQueryToUrl({ id })
    }
  }

  return (
    <>
      <HelmetTags page='open_carts' />
      <OpenCartListingController {...openCartsProps} />
    </>
  )
}
