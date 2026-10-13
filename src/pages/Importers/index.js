import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import {
  Importers as ImportersController,
  addQueryToUrl,
  removeQueryToUrl
} from '~ui'

export const Importers = (props) => {
  const businessesProps = {
    ...props,
    isUseQuery: true,
    onBusinessRedirect: (businessId) => {
      if (!businessId) {
        return removeQueryToUrl(['id'])
      }
      return addQueryToUrl({ id: businessId })
    }
  }
  return (
    <>
      <HelmetTags page='importers' />
      <ImportersController {...businessesProps} />
    </>
  )
}
