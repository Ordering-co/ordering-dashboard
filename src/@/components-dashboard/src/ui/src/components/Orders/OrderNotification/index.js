import React, { useState, useEffect, useRef } from 'react'
import {
  useLanguage,
  useConfig,
  useEvent,
  OrderNotification as OrderNotificationController
} from '../../../../../index'
import { Button, Dialog, InlineNotice } from '../../Shared/Product'
import { Info } from '../../Shared/Icon'
import 'react-toastify/dist/ReactToastify.css'
import { toast } from 'react-toastify'
import { useTheme } from 'styled-components'
import { captureException } from '@sentry/react'
import { getDashboardNotificationIconUrl } from '../../../utils'

import { ToastWrapper } from './styles'
import './order-notification.css'

toast.configure()

// NotAllowedError: the browser blocked autoplay. AbortError: play() was interrupted
// (dialog closed, a new load, or unmount). Both are expected and stay out of Sentry.
const blockedPlaybackErrors = new Set(['NotAllowedError', 'AbortError'])

const playNotificationSound = async (sound, reportedErrors) => {
  if (!sound) return
  try {
    sound.muted = false
    await sound.play()
  } catch (error) {
    const name = error?.name || 'unknown'
    if (blockedPlaybackErrors.has(name) || reportedErrors?.has(name)) return
    reportedErrors?.add(name)
    captureException(error)
  }
}

const OrderNotificationUI = (props) => {
  const {
    isOnlyDelivery,
    customerId
  } = props

  const [configState] = useConfig()
  const [, t] = useLanguage()
  const [events] = useEvent()
  const theme = useTheme()
  // redesign F6b (D-16): decided in the first render, not in an effect after the first paint: a notice that
  // pops in a frame later pushes the list down by its own height.
  const [showModal, setShowModal] = useState(() => !localStorage.getItem('new_order_notification'))

  const [notificationModalOpen, setNotificationModalOpen] = useState(false)
  const [registerOrderIds, setRegisterOrderIds] = useState([])
  const gotItRef = useRef(null)
  const soundRef = useRef(null)
  const reportedPlaybackErrorsRef = useRef(new Set())
  const [userInteracted, setUserInteracted] = useState(false)

  const handleNotification = (order) => {
    if (order?.products?.[0]?.type === 'gift_card') return
    if (customerId && order?.customer_id !== customerId) return
    if (isOnlyDelivery && order?.delivery_type !== 1) return
    const _registerOrderIds = [...registerOrderIds]
    if (!_registerOrderIds.includes(order.id)) {
      _registerOrderIds.push(order.id)
      setRegisterOrderIds(_registerOrderIds)
      if (!configState?.configs?.notification_in_app_enabled || configState?.configs?.notification_in_app_enabled?.value === '1') {
        if (configState?.configs?.notification_toast?.value === 'true') {
          toastNotify(order.id)
        } else {
          setNotificationModalOpen(true)
        }
      }
    }
  }

  const handleCloseNotificationModal = () => {
    setNotificationModalOpen(false)
    setRegisterOrderIds([])
  }

  const toastNotify = (orderId) => {
    const positionConfig = configState?.configs?.notification_in_app_position?.value ?? 'bottom-right'
    const toastConfigure = {
      position: positionConfig,
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined
    }
    const content = () => {
      return (
        <ToastWrapper>
          <img src={getDashboardNotificationIconUrl(configState?.configs, theme.images.logos.isotype)} alt='' />
          <div>
            <span>{t('WEB_DASHBOARD_APPNAME', 'Ordering Dashboard')}</span>
            <span>{t('ORDER_N_ORDERED', 'Order #_order_id_ has been ordered.').replace('_order_id_', `${orderId}`)}</span>
          </div>
        </ToastWrapper>
      )
    }
    toast(content, toastConfigure)
    if (!configState?.configs?.disable_sound_notification && userInteracted) {
      playNotificationSound(soundRef.current, reportedPlaybackErrorsRef.current)
    }
    setRegisterOrderIds([])
  }

  useEffect(() => {
    if (registerOrderIds.length > 0) return
    setNotificationModalOpen(false)
  }, [registerOrderIds])

  useEffect(() => {
    if (!notificationModalOpen || !userInteracted || configState?.configs?.disable_sound_notification) return
    const interval = setInterval(() => {
      playNotificationSound(soundRef.current, reportedPlaybackErrorsRef.current)
    }, 3000)
    return () => clearInterval(interval)
  }, [notificationModalOpen, userInteracted, configState?.configs?.disable_sound_notification])

  useEffect(() => {
    if (configState.loading) return
    events.on('order_added', handleNotification)
    return () => {
      events.off('order_added', handleNotification)
    }
  }, [configState, registerOrderIds, customerId, userInteracted])

  useEffect(() => {
    if (userInteracted) return
    const unmutedNotification = () => {
      setUserInteracted(true)
    }
    document.addEventListener('mousedown', unmutedNotification)

    return () => {
      document.removeEventListener('mousedown', unmutedNotification)
    }
  }, [userInteracted])

  // redesign 5.2-A: the sound notice is inline, not a modal. Both actions close it
  // and record a gesture so a later attempt can run. Only "Don't show again" is remembered.
  // A gesture does not guarantee playback; the browser can still block it.
  const handleCloseSoundNotice = () => {
    setShowModal(false)
    setUserInteracted(true)
  }

  const handleDontShowAgain = () => {
    localStorage.setItem('new_order_notification', '1')
    handleCloseSoundNotice()
  }

  // redesign F6d (Q3-03): the text clips with an ellipsis from 768px; it says itself in a title
  const soundNoticeText = t('SOUND_WILL_BE_PLAYED', 'The sound will be played on this page whenever a new order is received.')

  return (
    <>
      <Dialog
        open={notificationModalOpen}
        onOpenChange={(next) => { if (!next) handleCloseNotificationModal() }}
        size='md'
        title={t('NEW_ORDERS_RECEIVED', 'New orders received')}
        closeLabel={t('CLOSE', 'Close')}
        initialFocus={gotItRef}
        footer={(
          <Button ref={gotItRef} variant='primary' onClick={handleCloseNotificationModal}>
            {t('GOT_IT', 'Got it')}
          </Button>
        )}
      >
        <ul className='odc-new-orders'>
          {registerOrderIds.map((orderId) => (
            <li key={orderId}>
              {t('ORDER', 'Order')} <span className='odc-mono'>#{orderId}</span>
            </li>
          ))}
        </ul>
      </Dialog>
      <audio ref={soundRef} id='notification-sound' muted>
        <source src={theme.sounds.notificationOgg} type='audio/ogg' />
        <source src={theme.sounds.notificationMp3} type='audio/mpeg' />
      </audio>
      {showModal && (
        <InlineNotice
          tone='info'
          icon={Info}
          className='odc-sound-notice'
          action={(
            <span className='odc-sound-actions'>
              <Button size='sm' onClick={handleCloseSoundNotice}>{t('ACCEPT', 'Accept')}</Button>
              <Button variant='link' onClick={handleDontShowAgain}>{t('DONT_SHOW_AGAIN', 'Don\'t show again')}</Button>
            </span>
          )}
        >
          <span title={soundNoticeText}>{soundNoticeText}</span>
        </InlineNotice>
      )}
    </>
  )
}

export const OrderNotification = (props) => {
  const orderNotificationProps = {
    ...props,
    UIComponent: OrderNotificationUI
  }
  return (
    <OrderNotificationController {...orderNotificationProps} />
  )
}

// redesign W0-12 (W0-A0-01): the notice used to be mounted as a bare sibling of the page, which made it a flex column of the
// shell next to the page (685px wide at 1440, 350px at 390, the list left at 40px). A page mounts the notice through this slot: a
// one-line cell INSIDE its own container, under its head, which takes no height while the notice is not shown (the
// «Empty, loading and error states» rule: notices hold one fixed one-line slot; a hidden notice reserves no height).
// /orders keeps its own slot in OrdersContentHeader (`.odc-orders-notices`, which also hosts the connection notice).
// redesign cierre W0 (W0-QA4-04): `spaced` for a page whose head ends in a field with no padding of its own (DriversManager's search):
// on a phone the notice would touch it.
export const OrderNotificationSlot = ({ isOnlyDelivery, customerId, spaced }) => (
  <div className='odc-notice-slot' data-slot='order-notice-slot' data-spaced={spaced ? '' : undefined}>
    <OrderNotification isOnlyDelivery={isOnlyDelivery} customerId={customerId} />
  </div>
)
