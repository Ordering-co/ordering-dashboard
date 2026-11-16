import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { StaffListing } from '~ui'

export const BusinessOwnersList = (props) => {
  // redesign BO-B6 (decision 1): the staff directory driven by the business owner kind. The level, the words, Learn, the
  // fields to fetch (main's list plus the stores) and the ?id= / ?tab= of the record live in the kind and the directory.
  const usersProps = {
    ...props,
    kind: 'business_owner',
    isUseQuery: true
  }
  return (
    <>
      <HelmetTags page='business_owners' />
      <StaffListing {...usersProps} />
    </>
  )
}
