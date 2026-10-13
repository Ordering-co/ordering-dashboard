import { initializeApp, getApps, getApp } from 'firebase/app'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'

const FIREBASE_APP_NAME = 'push'
const SERVICE_WORKER_URL = '/push/firebase/firebase-messaging-sw.js'
const SERVICE_WORKER_SCOPE = '/push/firebase/'

export function getFirebaseWebConfig (configs) {
  return {
    apiKey: configs?.firebase_web_api_key?.value,
    authDomain: configs?.firebase_web_auth_domain?.value,
    projectId: configs?.firebase_web_project_id?.value,
    messagingSenderId: configs?.firebase_web_messaging_sender_id?.value,
    appId: configs?.firebase_web_app_id?.value,
    vapidKey: configs?.firebase_web_vapid_key?.value
  }
}

export function isFirebasePushEnabled (configs) {
  const config = getFirebaseWebConfig(configs)
  return configs?.firebase_push_enabled?.value === '1' &&
    !!(config.apiKey && config.projectId && config.messagingSenderId && config.appId && config.vapidKey)
}

export function getOpenedPushOrderUuid (data) {
  const orderUuid = data?.order_uuid
  if (orderUuid == null || orderUuid === '' || orderUuid === 'null') {
    return null
  }
  return orderUuid
}

export async function firebasePushSetup ({ config, onToken, onNotificationClick }) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) {
    return null
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return null
  }

  const { vapidKey, ...appConfig } = config
  const registration = await navigator.serviceWorker.register(
    `${SERVICE_WORKER_URL}?config=${encodeURIComponent(JSON.stringify(appConfig))}`,
    { scope: SERVICE_WORKER_SCOPE }
  )
  const app = getApps().some((existing) => existing.name === FIREBASE_APP_NAME)
    ? getApp(FIREBASE_APP_NAME)
    : initializeApp(appConfig, FIREBASE_APP_NAME)
  const messaging = getMessaging(app)

  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration
  })
  if (token && onToken) {
    onToken(token)
  }

  onMessage(messaging, (payload) => {
    const title = payload?.notification?.title
    const body = payload?.notification?.body
    if (!title && !body) return
    registration.showNotification(title || '', {
      body: body || '',
      data: payload?.data || {}
    })
  })

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event?.data?.type === 'FIREBASE_PUSH_CLICK' && onNotificationClick) {
      onNotificationClick(event.data.data || {})
    }
  })

  return token
}
