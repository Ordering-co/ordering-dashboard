import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { AllSettings as SettingsController } from '~ui'

export const Settings = (props) => {
  return (
    <>
      <HelmetTags page='settings' />
      <SettingsController {...props} />
    </>
  )
}
