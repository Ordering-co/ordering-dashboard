import React, { useEffect, useRef, useState } from 'react'
// (row 32, driver-store-status P-7): promoted from Orders/WebsocketStatus. The contexts and the controller by file, not the components-dashboard index (which loads the whole legacy tree and bootstrap.css)
import { useLanguage } from '../../../../../contexts/LanguageContext'
import { useUtils } from '../../../../../contexts/UtilsContext'
import { useEvent } from '../../../../../contexts/EventContext'
import { WebsocketStatus as WebsocketStatusController } from '../../../../../components/WebsocketStatus'
import { SOCKET_STATUS } from '../../../../../contexts/WebsocketContext/constants'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { InlineNotice } from './FilterBar'
import { WifiOff } from '../Icon'
import './websocket-status.css'

/**
 * How long the socket may stay "connecting" before the screen treats it as offline (C10/C16):
 * past it the pill, the dialog and the page notice all read as disconnected.
 */
export const RECONNECT_GRACE_MS = 10000

/**
 * Redesign 5.2-A: a quiet "Live" indicator and a dialog that says the current
 * state only. The controller (components/WebsocketStatus) is unchanged: the grace
 * period lives here, in the presentation.
 *
 * `renderNotice(node)` is optional: while the socket is disconnected the page
 * can place a warning notice (list may be out of date, Update) wherever it wants;
 * without it nothing extra is drawn (/drivers, other screens).
 */
// redesign F6d (D-21): `isSettled` is false while a socket that has never connected is still inside its grace: it is
// drawn as «connecting» (neutral), not as «Reconnecting…». A degraded connection is real and never waits.
const getView = (socketStatus, isConnectionDegraded, isSettled = true) => {
  if (isConnectionDegraded) return 'off'
  if (socketStatus === SOCKET_STATUS.CONNECTED) return 'live'
  if (socketStatus === SOCKET_STATUS.CONNECTING) return 'connecting'
  return isSettled ? 'off' : 'connecting'
}

/**
 * The status the screen acts on: "connecting" turns into "disconnected" once the grace
 * period has run out, counted from the moment the socket stopped being connected and
 * reset only by a connection, so a retry loop never restarts the clock.
 */
const useEffectiveSocketStatus = (socketStatus) => {
  const [graceExpired, setGraceExpired] = useState(false)
  const isConnected = socketStatus === SOCKET_STATUS.CONNECTED

  useEffect(() => {
    if (isConnected) {
      setGraceExpired(false)
      return undefined
    }
    const timer = setTimeout(() => setGraceExpired(true), RECONNECT_GRACE_MS)
    return () => clearTimeout(timer)
  }, [isConnected])

  return socketStatus === SOCKET_STATUS.CONNECTING && graceExpired
    ? SOCKET_STATUS.DISCONNECTED
    : socketStatus
}

/**
 * redesign F6c (D-20): how long the page notice waits when the socket has never been connected on this screen. The
 * socket starts «disconnected» before it binds its listeners, so on load the notice flashed for a second. After a
 * connection (or after this grace) a loss shows at once.
 */
export const NOTICE_GRACE_MS = 3000

/**
 * Whether the socket state is settled enough to be told as lost: it has been connected once, or it has been out of
 * the connected state for NOTICE_GRACE_MS. The grace counts from the first moment it was not connected and is reset
 * by a connection, as the one of «connecting» is. The page notice (D-20) and the pill (D-21) wait for it.
 */
const useConnectionSettled = (socketStatus) => {
  const [graceOver, setGraceOver] = useState(false)
  const connectedOnce = useRef(false)
  const isConnected = socketStatus === SOCKET_STATUS.CONNECTED
  if (isConnected) connectedOnce.current = true

  useEffect(() => {
    if (isConnected) {
      setGraceOver(false)
      return undefined
    }
    const timer = setTimeout(() => setGraceOver(true), NOTICE_GRACE_MS)
    return () => clearTimeout(timer)
  }, [isConnected])

  return connectedOnce.current || graceOver
}

const reloadPage = () => window.location.reload()

// The legend of the dialog (parity audit 2, B6): the three states main explained, with its own keys and texts
// (main's STATUS_ITEMS, matched here to the view each one is drawn as).
const STATUS_ITEMS = [
  { view: 'live', labelKey: 'OK', labelDefault: 'Ok', descriptionKey: 'WEBSOCKET_OK', descriptionDefault: 'The websocket works normally.' },
  { view: 'connecting', labelKey: 'CONNECTING', labelDefault: 'Connecting', descriptionKey: 'WEBSOCKET_CONNECTING', descriptionDefault: 'The websocket is connecting.' },
  { view: 'off', labelKey: 'DISCONNECTED', labelDefault: 'Disconnected', descriptionKey: 'WEBSOCKET_DISCONNECTED_LEGEND', descriptionDefault: 'Live updates are paused until the connection is back.' }
]

const StateMark = ({ view }) => (view === 'off'
  ? <WifiOff className='odc-icon' />
  : <span className='odc-live-dot' aria-hidden='true' />)

const SocketStatusUI = (props) => {
  const {
    socketStatus: reportedSocketStatus,
    connectedDate,
    isConnectionDegraded,
    renderNotice
  } = props

  const [, t] = useLanguage()
  const [{ parseDate }] = useUtils()
  const [events] = useEvent()
  const [open, setOpen] = useState(false)

  const socketStatus = useEffectiveSocketStatus(reportedSocketStatus)
  const isSettled = useConnectionSettled(socketStatus)
  const view = getView(socketStatus, isConnectionDegraded, isSettled)
  const noticeVisible = socketStatus === SOCKET_STATUS.DISCONNECTED && isSettled
  const copy = {
    live: {
      label: t('LIVE', 'Live'),
      sentence: t('WEBSOCKET_OK', 'The websocket works normally.')
    },
    connecting: {
      label: t('CONNECTING', 'Connecting'),
      sentence: t('WEBSOCKET_CONNECTING', 'The websocket is connecting.')
    },
    off: {
      label: t('RECONNECTING', 'Reconnecting…'),
      // One wording per state: the dialog says what the page notice says.
      sentence: t('CONNECTION_LOST_NOTICE', 'Connection lost. The list may be out of date; it refreshes when the connection is back.')
    }
  }[view]

  const handleGoToSupport = () => {
    setOpen(false)
    events.emit('go_to_page', { page: 'support' })
  }

  const indicator = <StateMark view={view} />

  return (
    <>
      <span className='websocket-container odc-root odc-live' role='status' data-state={view}>
        <Button
          variant='ghost'
          size='sm'
          className='odc-live-btn'
          // F6d (Q3-14): under 640px of head the label is dropped visually; the title says it on hover
          title={copy.label}
          aria-haspopup='dialog'
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          {indicator}
          {copy.label}
        </Button>
      </span>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        size='sm'
        title={t('CONNECTION_STATUS', 'Connection status')}
        closeLabel={t('CLOSE', 'Close')}
        // Offline, the lead sentence is the one the page notice says. Otherwise the legend below already says it.
        description={view === 'off' ? copy.sentence : undefined}
        footer={(
          <>
            <Button onClick={() => setOpen(false)}>{t('CLOSE', 'Close')}</Button>
            <Button variant='primary' onClick={reloadPage}>{t('UPDATE', 'Update')}</Button>
          </>
        )}
      >
        <div className='odc-live-detail' data-state={view}>
          <p className='odc-live-current'>
            {indicator}
            <span>{copy.label}</span>
          </p>
          <p className='odc-live-meta'>{t('LAST_UPDATE', 'Last update')}: {parseDate(connectedDate)}</p>
          <p>{t('WEBSOCKET_STATUS_INFO_WITHOUT_LINK', 'Check the server connection by date and time with the connection status button. Press Update to refresh your dashboard and the status. Need help? Contact our customer support team.')}</p>
          <ul className='odc-live-legend'>
            {STATUS_ITEMS.map(item => (
              <li
                key={item.view}
                className='odc-live-legend-item'
                data-status={item.view}
                aria-current={item.view === view ? 'true' : undefined}
              >
                <span className='odc-live-legend-state'>
                  <StateMark view={item.view} />
                  <span>{t(item.labelKey, item.labelDefault)}</span>
                </span>
                <p>{t(item.descriptionKey, item.descriptionDefault)}</p>
              </li>
            ))}
          </ul>
          {isConnectionDegraded && (
            <section className='odc-live-troubleshoot'>
              <h3>{t('WEBSOCKET_TROUBLESHOOTING_TITLE', 'Troubleshooting')}</h3>
              <p>{t('WEBSOCKET_BANNER_BLOCKED_SUBTITLE', 'Real-time updates are unavailable. Your browser may be blocking the connection — try disabling ad blockers or browser extensions, check your firewall settings, or reload the page.')}</p>
              <Button size='sm' onClick={handleGoToSupport}>
                {t('CUSTOMER_SUPPORT', 'Customer support')}
              </Button>
            </section>
          )}
        </div>
      </Dialog>
      {noticeVisible && renderNotice?.(
        <InlineNotice
          tone='warning'
          icon={WifiOff}
          className='odc-connection-notice'
          action={<Button size='sm' onClick={reloadPage}>{t('UPDATE', 'Update')}</Button>}
        >
          {copy.sentence}
        </InlineNotice>
      )}
    </>
  )
}

export const WebsocketStatus = (props) => {
  const socketProps = {
    ...props,
    UIComponent: SocketStatusUI
  }
  return <WebsocketStatusController {...socketProps} />
}
