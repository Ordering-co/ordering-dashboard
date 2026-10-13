import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { PosApp as PosAppController } from '~ui'

export const PosApp = (props) => {
  return (
    <>
      <HelmetTags page='pos_app' />
      <PosAppController {...props} />
    </>
  )
}
