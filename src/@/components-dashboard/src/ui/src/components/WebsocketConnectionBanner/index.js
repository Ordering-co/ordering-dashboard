import React, { useEffect, useState } from 'react'
import { useLanguage, useEvent } from '../../../../index'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { useTheme } from 'styled-components'
import { ExclamationTriangle, X } from 'react-bootstrap-icons'

import {
  Container,
  Banner,
  Icon,
  Content,
  ButtonWrap
} from '../Banners/styles'
import { Button } from '../../styles'

export const WebsocketConnectionBanner = () => {
  const theme = useTheme()
  const [, t] = useLanguage()
  const [events] = useEvent()
  const onlineStatus = useOnlineStatus()
  const [showBanner, setShowBanner] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const handleFailed = () => setShowBanner(true)
    const handleRestored = () => {
      setShowBanner(false)
      setDismissed(false)
    }

    events.on('websocket_connection_failed', handleFailed)
    events.on('websocket_connection_restored', handleRestored)

    return () => {
      events.off('websocket_connection_failed', handleFailed)
      events.off('websocket_connection_restored', handleRestored)
    }
  }, [events])

  if (!showBanner || dismissed) return null

  const subtitle = onlineStatus
    ? t('WEBSOCKET_BANNER_BLOCKED_SUBTITLE', 'Real-time updates are unavailable. Your browser may be blocking the connection — try disabling ad blockers or browser extensions, check your firewall settings, or reload the page.')
    : t('WEBSOCKET_BANNER_OFFLINE_SUBTITLE', 'No internet connection detected. Check your network and try again.')

  return (
    <Container>
      <Banner>
        <Icon>
          <ExclamationTriangle
            size={26}
            color={theme.colors.warning}
          />
        </Icon>
        <Content>
          <h1>{t('WEBSOCKET_BANNER_TITLE', 'Connection issue')}</h1>
          <p>{subtitle}</p>
        </Content>
        <ButtonWrap style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <Button
            color='warning'
            style={{
              borderRadius: 8,
              padding: '5px 30px',
              maxHeight: '40px'
            }}
            onClick={() => window.location.reload()}
          >
            {t('WEBSOCKET_BANNER_REFRESH', 'Refresh')}
          </Button>
          <Button
            color='secundary'
            style={{
              borderRadius: 8,
              padding: '5px 10px',
              maxHeight: '40px',
              minWidth: '40px'
            }}
            onClick={() => setDismissed(true)}
            aria-label={t('CLOSE', 'Close')}
          >
            <X size={18} />
          </Button>
        </ButtonWrap>
      </Banner>
    </Container>
  )
}
