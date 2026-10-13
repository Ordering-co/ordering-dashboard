import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { Support as SupportController } from '~ui'

export const Support = (props) => {
  return (
    <>
      <HelmetTags page='support' />
      <SupportController {...props} />
    </>
  )
}
