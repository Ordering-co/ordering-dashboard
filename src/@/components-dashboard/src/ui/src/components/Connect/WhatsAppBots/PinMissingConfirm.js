import React from 'react'
import { ExclamationTriangle } from 'react-bootstrap-icons'
import styled from 'styled-components'
import { useLanguage } from '../../../../../index'
import { Confirm } from '../../Shared'
import { Warning } from './styles'

const PinWarning = styled(Warning)`
  border: 1px solid ${props => props.theme.colors.warning};
`

export const PinMissingConfirm = ({ open, onContinue, onChangePin, onClose }) => {
  const [, t] = useLanguage()

  return (
    <Confirm
      open={open}
      width='440px'
      title={t('WHATSAPP_NO_PIN_TITLE', 'No PIN entered')}
      closeOnBackdrop={false}
      cancelText={t('CONTINUE', 'Continue')}
      acceptText={t('WHATSAPP_CHANGE_PIN', 'Change PIN')}
      onCancel={onContinue}
      onAccept={onChangePin}
      onClose={onClose}
    >
      <PinWarning>
        <ExclamationTriangle aria-hidden size={18} color='#B88A00' />
        <span>
          {t('WHATSAPP_NO_PIN_MODAL', "If you don't add a two-step verification PIN, one will be generated automatically. If you already have a PIN for this phone number, you should add it first.")}
        </span>
      </PinWarning>
    </Confirm>
  )
}
