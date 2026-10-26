import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { WhatsAppBots as WhatsAppBotsController } from '~ui'

export const WhatsAppBots = (props) => {
  return (
    <>
      <HelmetTags page='whatsapp_bots' />
      <WhatsAppBotsController {...props} />
    </>
  )
}
