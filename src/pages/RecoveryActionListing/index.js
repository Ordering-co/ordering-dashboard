import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { RecoveryActionListing as RecoveryActionListingController } from '~ui'

export const RecoveryActionListing = (props) => {
  const recoveryActionListProps = {
    ...props,
    isUseQuery: true
  }
  return (
    <>
      <HelmetTags page='recovery_actions' />
      <RecoveryActionListingController {...recoveryActionListProps} />
    </>
  )
}
