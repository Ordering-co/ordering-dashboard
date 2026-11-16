import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { StaffListing } from '~ui'

export const CallcenterAgentsList = (props) => {
  // redesign CA-B1: the staff directory driven by the call center agent kind (level 9). The level, the words, the
  // fields to fetch (main's list plus `businesses_agent`) and the ?id= / ?tab= of the record live in the kind and the directory.
  const usersProps = {
    ...props,
    kind: 'callcenter_agent',
    isUseQuery: true
  }
  return (
    <>
      <HelmetTags page='callcenter_agents' />
      <StaffListing {...usersProps} />
    </>
  )
}
