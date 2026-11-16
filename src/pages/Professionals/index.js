import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { ProfessionalAddForm, StaffListing } from '~ui'

export const Professionals = (props) => {
  // redesign (B1c): the staff directory driven by the professional kind (level 8, no stores). The level, the words, the fields to
  // fetch (main's list plus the schedule, occupation and timezone), the appointments add-on gate, the occupation row and the ?id= / ?tab=
  // of the record live in the kind and the directory. Users/ProfessionalListing stays in the tree, no route mounts it.
  const usersProps = {
    ...props,
    kind: 'professional',
    isUseQuery: true,
    // main's professional form (occupation, no level): given from here so the directory does not import it for every staff route
    AddForm: ProfessionalAddForm
  }
  return (
    <>
      <HelmetTags page='professionals' />
      <StaffListing {...usersProps} />
    </>
  )
}
