import React from 'react'
import { SchoolsManagement } from '~ui'
import { HelmetTags } from '../../components/HelmetTags'

export const Schools = (props) => {
  return (
    <>
      <HelmetTags page='schools' />
      <SchoolsManagement {...props} />
    </>
  )
}
