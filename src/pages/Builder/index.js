import React from 'react'
import { BuilderProducts } from '~ui'
import { HelmetTags } from '../../components/HelmetTags'

export const Builder = (props) => {
  return (
    <>
      <HelmetTags page='builder' />
      <BuilderProducts {...props} />
    </>
  )
}
