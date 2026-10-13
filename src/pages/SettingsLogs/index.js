import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { SettingsLogs as SettingsLogsController } from '~ui'

export const SettingsLogs = (props) => {
  return (
    <>
      <HelmetTags page='logs' />
      <SettingsLogsController {...props} />
    </>
  )
}
