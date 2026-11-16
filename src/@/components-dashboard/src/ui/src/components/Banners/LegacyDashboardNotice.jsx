import React, { useEffect, useRef, useState } from 'react'
import { useApi, useLanguage, useSession, useUtils } from '../../../../index'
import { focusPageStart } from '../../../../utils/focusPageStart'
import { Button, IconButton, InlineNotice } from '../Shared/Product'
import { ExternalLink, Info, X } from '../Shared/Icon'
import {
  buildLegacyDashboardUrl,
  isLegacyDashboardNoticeActive,
  LEGACY_DASHBOARD_LEVELS,
  legacyDashboardLastDay
} from './legacyDashboard'
import './banners.css'

// The opt-in migration notice can be dismissed for this browser session.
const DISMISS_KEY = 'ordering:legacy-dashboard-notice-dismissed'

const readDismissed = () => {
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export const LegacyDashboardNotice = ({ config, now }) => {
  const [, t] = useLanguage()
  const [{ parseDate }] = useUtils()
  const [{ token, user }] = useSession()
  const [ordering] = useApi()
  const [dismissed, setDismissed] = useState(readDismissed)
  const focusAfterClose = useRef(false)

  useEffect(() => {
    if (!dismissed || !focusAfterClose.current) return
    focusAfterClose.current = false
    focusPageStart(null)
  }, [dismissed])

  const active = isLegacyDashboardNoticeActive(config, { hostname: window.location.hostname, now: now ?? Date.now() })
  if (dismissed || !active || !token || !LEGACY_DASHBOARD_LEVELS.includes(user?.level)) return null

  const endDate = parseDate(legacyDashboardLastDay(config.ends_at), { dateOnly: true, utc: false })

  const href = buildLegacyDashboardUrl(config.url, {
    project: ordering?.project,
    token,
    trustedOrigin: import.meta.env.VITE_DASHBOARD_LEGACY_SESSION_ORIGIN
  })
  if (!href) return null
  const hasSessionTransfer = new URL(href).searchParams.has('token')
  const body = hasSessionTransfer
    ? t('LEGACY_DASHBOARD_NOTICE_BODY', 'The previous dashboard is still available for a limited time, until :date:. It opens in a new tab with your session.')
    : t('LEGACY_DASHBOARD_NOTICE_BODY_LINK_ONLY', 'The previous dashboard is still available until :date:. You may need to sign in there.')
  const handleOpen = () => window.open(href, '_blank', 'noopener,noreferrer')

  return (
    <InlineNotice
      tone='info'
      icon={Info}
      action={(
        <>
          <Button variant='secondary' size='md' iconEnd={ExternalLink} onClick={handleOpen}>
            {t('LEGACY_DASHBOARD_OPEN', 'Open previous dashboard')}
          </Button>
          <IconButton
            icon={X}
            label={t('CLOSE', 'Close')}
            onClick={(event) => {
              focusAfterClose.current = document.activeElement === event.currentTarget
              try {
                window.sessionStorage.setItem(DISMISS_KEY, '1')
              } catch {}
              setDismissed(true)
            }}
          />
        </>
      )}
    >
      <strong className='odc-shell-notice-title'>
        {t('LEGACY_DASHBOARD_NOTICE_TITLE', 'Welcome to the new dashboard.')}
      </strong>
      <span className='odc-shell-notice-body'>
        {body.replace(':date:', endDate)}
      </span>
    </InlineNotice>
  )
}
