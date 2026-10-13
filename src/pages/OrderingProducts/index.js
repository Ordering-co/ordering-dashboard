import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { OrderingProductsListing as OrderingProductsController } from '~ui'

export const OrderingProducts = (props) => {
  const orderingProductsProps = {
    ...props,
    isSearchByName: true,
    isSearchByDescription: true,
    isUseQuery: true,
    enableAutoFillFromWebsite: true
  }
  return (
    <>
      <HelmetTags page='ordering_products' />
      <OrderingProductsController {...orderingProductsProps} />
    </>
  )
}
