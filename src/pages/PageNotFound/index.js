import React from 'react'
import { PageNotFound as PageNotFoundController } from '~ui'
import { HelmetTags } from '../../components/HelmetTags'

export const PageNotFound = (props) => {
  return (
    <>
      {/* the 404 tab carries the same brand and a translated name, like every other route */}
      <HelmetTags page='not_found' />
      <PageNotFoundController {...props} />
    </>
  )
}
