import React from 'react'
import { useLocation } from 'react-router-dom'

import { useEvent } from '~components'
import { ProductsBuilderList as ProductsBuilder } from '~ui'
import { HelmetTags } from '../../components/HelmetTags'

export const ProductsBuilderList = (props) => {
  const { search, state } = useLocation()
  const [events] = useEvent()

  const productId = search
    ? (new URLSearchParams(window.document.location.search)).get('id')
    : state?.productId

  if (!productId) {
    events.emit('go_to_page', { page: 'home' })
  }

  const productsProps = {
    ...props,
    productId,
    typeApp: state?.type
  }

  return !productId
    ? null
    : (<>
        <HelmetTags page='products' />
        <ProductsBuilder {...productsProps} />
      </>)
}
