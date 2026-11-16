import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { StaffListing } from '~ui'

export const ManagersList = (props) => {
  // redesign AD-B1: the staff directory driven by the admin kind (level 0, no stores). The level, the words, the fields
  // to fetch (main's list), main's two Learn entries and the ?id= / ?tab= of the record live in the kind and the directory.
  const usersProps = {
    ...props,
    kind: 'admin',
    isUseQuery: true
  }
  return (
    <>
      <HelmetTags page='admins' />
      <StaffListing {...usersProps} />
    </>
  )
}
