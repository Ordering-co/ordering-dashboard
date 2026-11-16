import React, { useEffect, useRef, useState } from 'react'
import { useLanguage, useEvent } from '../../../../index'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { focusPageStart } from '../../../../utils/focusPageStart'
import { Button, IconButton, InlineNotice } from '../Shared/Product'
import { TriangleAlert, X } from '../Shared/Icon'
import '../Banners/banners.css'

// redesign (R2): the real-time connection notice on Product. Same events (`websocket_connection_failed` / `_restored`),
// same copy and same actions (Refresh reloads, Close hides it until the next restore + failure); the markup is an InlineNotice
// (warning, role alert). It lives inside the BannerStack, whose styles Banners/banners.css holds.
export const WebsocketConnectionBanner = () => {
  const [, t] = useLanguage()
  const [events] = useEvent()
  const onlineStatus = useOnlineStatus()
  const [showBanner, setShowBanner] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  // (2): the ✕ goes away with the notice; when it had the focus, the start of the page takes it (not <body>)
  const focusAfterClose = useRef(false)

  useEffect(() => {
    if (!dismissed || !focusAfterClose.current) return
    focusAfterClose.current = false
    focusPageStart(null)
  }, [dismissed])

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
    <InlineNotice
      tone='warning'
      icon={TriangleAlert}
      role='alert'
      action={(
        <>
          <Button variant='secondary' onClick={() => window.location.reload()}>
            {t('WEBSOCKET_BANNER_REFRESH', 'Refresh')}
          </Button>
          <IconButton
            icon={X}
            label={t('CLOSE', 'Close')}
            onClick={(event) => {
              focusAfterClose.current = document.activeElement === event.currentTarget
              setDismissed(true)
            }}
          />
        </>
      )}
    >
      <strong className='odc-shell-notice-title'>{t('WEBSOCKET_BANNER_TITLE', 'Connection issue')}</strong>
      <span className='odc-shell-notice-body'>{subtitle}</span>
    </InlineNotice>
  )
}
