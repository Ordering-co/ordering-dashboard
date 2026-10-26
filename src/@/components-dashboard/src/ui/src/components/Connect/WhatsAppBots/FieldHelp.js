import React from 'react'
import { OverlayTrigger, Popover } from 'react-bootstrap'
import { QuestionCircle } from 'react-bootstrap-icons'
import { useLanguage } from '../../../../../index'
import { HelpButton } from './styles'

export const FieldHelp = ({ label, text }) => {
  const [, t] = useLanguage()
  if (!text) return null
  const helpLabel = t('WHATSAPP_FIELD_HELP', 'Help for _field_').replace('_field_', label)

  return (
    <OverlayTrigger
      trigger='click'
      placement='bottom'
      rootClose
      overlay={
        <Popover id={`whatsapp-help-${label.replace(/\s+/g, '-').toLowerCase()}`}>
          <Popover.Content>{text}</Popover.Content>
        </Popover>
      }
    >
      <HelpButton type='button' aria-label={helpLabel}>
        <QuestionCircle size={14} aria-hidden='true' />
      </HelpButton>
    </OverlayTrigger>
  )
}
