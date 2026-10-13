import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { ProfilePage as ProfileController } from '~ui'

export const Profile = (props) => {
  return (
    <>
      <HelmetTags page='profile' />
      <ProfileController {...props} />
    </>
  )
}
