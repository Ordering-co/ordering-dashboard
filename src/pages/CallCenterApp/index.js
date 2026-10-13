import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { CallCenterApp as CallCenterAppController } from '~ui'

export const CallCenterApp = (props) => {
  return (
    <>
      <HelmetTags page='call_center_app' />
      <CallCenterAppController {...props} />
    </>
  )
}
