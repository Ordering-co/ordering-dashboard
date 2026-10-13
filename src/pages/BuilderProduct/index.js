import React from 'react'
import { useParams } from 'react-router-dom'
import { BuilderProduct as BuilderProductDetail } from '~ui'
import { HelmetTags } from '../../components/HelmetTags'
import settings from '../../config'

export const BuilderProduct = (props) => {
  const { productId } = useParams()
  return (
    <>
      <HelmetTags page='builder' />
      <BuilderProductDetail {...props} productId={productId} buildGuides={settings?.builder_guides} />
    </>
  )
}
