import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { LanguageManager as LanguageManagerController } from '~ui'

export const LanguageManager = (props) => {
  return (
    <>
      <HelmetTags page='language' />
      <LanguageManagerController {...props} />
    </>
  )
}
