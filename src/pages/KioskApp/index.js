import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { KioskApp as KioskAppController } from '~ui'

export const KioskApp = (props) => {
  return (
    <>
      <HelmetTags page='kiosk_app' />
      <KioskAppController {...props} />
    </>
  )
}
