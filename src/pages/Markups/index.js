import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { Markups as MarkupsListing } from '~ui'

export const Markups = () => {
  return (
    <>
      <HelmetTags page='markups' />
      <MarkupsListing isUseQuery />
    </>
  )
}
