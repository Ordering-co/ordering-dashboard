import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { FreeProductsList as FreeProductsListController } from '~ui'

export const FreeProductsList = (props) => {
  return (
    <>
      <HelmetTags page='free_products' />
      <FreeProductsListController {...props} />
    </>
  )
}
