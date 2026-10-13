import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { Cms as CmsController } from '~ui'
export const Cms = (props) => {
  return (
    <>
      <HelmetTags page='pages' />
      <CmsController {...props} />
    </>
  )
}
