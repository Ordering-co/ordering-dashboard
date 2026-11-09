import React, { useEffect, useRef } from 'react'
import styled from 'styled-components'
import {
  SUPPORT_STAY,
  SUPPORT_SWITCH,
  SUPPORT_SWITCH_PROJECT_MESSAGE,
  SUPPORT_SWITCH_PROJECT_TITLE,
  SUPPORT_SWITCH_USER_MESSAGE,
  SUPPORT_SWITCH_USER_TITLE
} from '../../../i18n/translations.json'

export const SWITCH_PROJECT = 'project'
export const SWITCH_USER = 'user'

// Rendered before the language provider exists, so copy comes from the
// bundled catalog instead of useLanguage().
const localTranslations = {
  SUPPORT_STAY,
  SUPPORT_SWITCH,
  SUPPORT_SWITCH_PROJECT_MESSAGE,
  SUPPORT_SWITCH_PROJECT_TITLE,
  SUPPORT_SWITCH_USER_MESSAGE,
  SUPPORT_SWITCH_USER_TITLE
}

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: ${props => props.theme?.colors?.backgroundPage || '#FFFFFF'};
  font-family: ${props => props.theme?.fonts?.primary?.name ? `'${props.theme.fonts.primary.name}', ` : ''}-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  z-index: 10000;
`

const Card = styled.div`
  width: 100%;
  max-width: 420px;
  padding: 24px;
  border: 1px solid ${props => props.theme?.colors?.borderColor || '#E9ECEF'};
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  background: #FFFFFF;
  color: ${props => props.theme?.colors?.headingColor || '#344050'};

  h1 {
    margin: 0 0 12px;
    font-size: 18px;
    font-weight: 600;
  }

  p {
    margin: 0 0 24px;
    font-size: 14px;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }
`

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
`

const ActionButton = styled.button`
  min-width: 96px;
  padding: 8px 16px;
  border-radius: 7.6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid ${props => props.theme?.colors?.primary || '#2C7BE5'};
  background: ${props => props.$primary ? (props.theme?.colors?.primary || '#2C7BE5') : '#FFFFFF'};
  color: ${props => props.$primary ? '#FFFFFF' : (props.theme?.colors?.primary || '#2C7BE5')};
`

const resolveLocale = (languageCode) => {
  const code = languageCode || window.navigator?.language || 'en'
  return String(code).toLowerCase().split(/[-_]/)[0]
}

export const SupportSwitchConfirm = ({
  kind = SWITCH_PROJECT,
  currentProject,
  currentUserEmail,
  newProject,
  supportEmail,
  languageCode,
  onSwitch,
  onStay
}) => {
  const locale = resolveLocale(languageCode)
  const t = (key, fallback) => localTranslations[key]?.[locale] || fallback
  const switchRef = useRef(null)

  useEffect(() => {
    switchRef.current?.focus()
  }, [])

  const isUserSwitch = kind === SWITCH_USER
  const title = isUserSwitch
    ? t('SUPPORT_SWITCH_USER_TITLE', 'Switch user?')
    : t('SUPPORT_SWITCH_PROJECT_TITLE', 'Switch project?')
  const template = isUserSwitch
    ? t(
      'SUPPORT_SWITCH_USER_MESSAGE',
      'You are signed in to _current_project_ as _current_user_email_. Switch to _support_email_ (support)?'
    )
    : t(
      'SUPPORT_SWITCH_PROJECT_MESSAGE',
      'You are signed in to _current_project_ as _current_user_email_. Switch to _new_project_ as support?'
    )
  const message = template
    .replace('_current_project_', currentProject || '')
    .replace('_current_user_email_', currentUserEmail || '')
    .replace('_new_project_', newProject || '')
    .replace('_support_email_', supportEmail || '')

  return (
    <Backdrop>
      <Card role='alertdialog' aria-modal='true' aria-labelledby='support-switch-title' aria-describedby='support-switch-message'>
        <h1 id='support-switch-title'>{title}</h1>
        <p id='support-switch-message'>{message}</p>
        <Actions>
          <ActionButton type='button' onClick={onStay}>{t('SUPPORT_STAY', 'Stay')}</ActionButton>
          <ActionButton type='button' $primary ref={switchRef} onClick={onSwitch}>{t('SUPPORT_SWITCH', 'Switch')}</ActionButton>
        </Actions>
      </Card>
    </Backdrop>
  )
}
