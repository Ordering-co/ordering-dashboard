/* global firebase, clients, importScripts */

self.addEventListener('notificationclick', function (event) {
  const notificationData = event.notification && event.notification.data
  const data = (notificationData && notificationData.FCM_MSG && notificationData.FCM_MSG.data) || notificationData || {}
  event.notification.close()

  const orderUuid = data.order_uuid && data.order_uuid !== 'null' ? data.order_uuid : null
  const targetUrl = orderUuid ? '/orders?id=' + orderUuid : '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
      const client = windowClients.find(function (windowClient) { return 'focus' in windowClient })
      if (client) {
        client.postMessage({ type: 'FIREBASE_PUSH_CLICK', data })
        return client.focus()
      }
      return clients.openWindow(targetUrl)
    })
  )
})

importScripts('https://www.gstatic.com/firebasejs/9.15.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging-compat.js')

let config = null
try {
  config = JSON.parse(new URLSearchParams(self.location.search).get('config'))
} catch (error) {
  config = null
}

if (config && config.apiKey) {
  firebase.initializeApp(config)
  firebase.messaging().onBackgroundMessage(function () {})
}
