import React, { useEffect, useState } from 'react'
import { useLanguage } from '../../../../index'
import { Modal } from '../Shared'
import {
  ModalBody,
  Description,
  IframeContainer,
  StyledIframe,
  StatusText,
  SecondaryLink
} from './styles'

export const AiAgentsUpgradeModal = (props) => {
  const { open, onClose, formUrl } = props

  const [, t] = useLanguage()
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!open) setLoaded(false)
  }, [open])

  return (
    <Modal
      open={open}
      onClose={onClose}
      width='720px'
      maxWidth='95vw'
      padding='30px'
      title={t('AI_AGENTS_UPGRADE_TITLE', 'Upgrade to use AI Agents')}
    >
      <ModalBody>
        <Description>
          {t('AI_AGENTS_UPGRADE_DESCRIPTION', 'AI Agents is available on the new version of Ordering. Tell us about your current setup and our team will help you upgrade.')}
        </Description>
        <IframeContainer>
          <StyledIframe
            title={t('AI_AGENTS_UPGRADE_FORM_TITLE', 'Upgrade request form')}
            src={formUrl}
            onLoad={() => setLoaded(true)}
          />
        </IframeContainer>
        {!loaded && (
          <StatusText role='status'>
            {t('AI_AGENTS_UPGRADE_FORM_LOADING', 'Loading the form…')}
          </StatusText>
        )}
        <SecondaryLink href={formUrl} target='_blank' rel='noopener noreferrer'>
          {t('AI_AGENTS_UPGRADE_OPEN_NEW_TAB', 'Open in a new tab')}
        </SecondaryLink>
      </ModalBody>
    </Modal>
  )
}
