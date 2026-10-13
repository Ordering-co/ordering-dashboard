import React from 'react'
import { AssistantPage } from '~ui'
import { HelmetTags } from '../../components/HelmetTags'

export const Assistant = (props) => {
  return (
    <>
      <HelmetTags page='assistant' />
      <AssistantPage {...props} />
    </>
  )
}
