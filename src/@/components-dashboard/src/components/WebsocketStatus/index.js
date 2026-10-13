import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useWebsocket } from '../../contexts/WebsocketContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useEvent } from '../../contexts/EventContext'
import { SOCKET_STATUS, MAX_CONNECTION_FAILURES } from '../../contexts/WebsocketContext/constants'

/**
 * Status read straight from a socket.io instance, used whenever listeners are (re)bound
 * so events emitted before binding are not lost.
 */
const getSocketStatus = (ioSocket) => {
  if (ioSocket?.connected) return SOCKET_STATUS.CONNECTED
  // `active` stays true while socket.io is connecting or auto-reconnecting
  if (ioSocket?.active) return SOCKET_STATUS.CONNECTING
  return SOCKET_STATUS.DISCONNECTED
}

/**
 * Component to manage websocket status without UI component
 */
export const WebsocketStatus = (props) => {
  const {
    UIComponent
  } = props

  const [, t] = useLanguage()
  const [events] = useEvent()
  const socket = useWebsocket()

  const [socketStatus, setSocketStatus] = useState(() => getSocketStatus(socket?.socket))
  const [connectedDate, setConnectedDate] = useState(new Date())
  const [connectionFailureCount, setConnectionFailureCount] = useState(0)

  const getWebsocketStatus = (num) => {
    switch (num) {
      case SOCKET_STATUS.CONNECTING:
        return t('CONNECTING', 'Connecting')
      case SOCKET_STATUS.CONNECTED:
        return t('OK', 'Ok')
      case SOCKET_STATUS.DISCONNECTED:
        return t('DISCONNECTED', 'Disconnected')
    }
  }

  const incrementFailureCount = () => {
    setConnectionFailureCount(prev => prev + 1)
  }

  const connectListener = () => {
    setConnectionFailureCount(0)
    setSocketStatus(SOCKET_STATUS.CONNECTED)
    setConnectedDate(new Date())
    events.emit('websocket_connection_restored')
  }

  const disconnectListener = () => {
    setSocketStatus(SOCKET_STATUS.DISCONNECTED)
  }

  const reconnectAttemptListener = () => {
    setSocketStatus(SOCKET_STATUS.CONNECTING)
  }

  const connectionErrorListener = () => {
    incrementFailureCount()
    setSocketStatus(SOCKET_STATUS.DISCONNECTED)
  }

  const reconnectFailedListener = () => {
    setSocketStatus(SOCKET_STATUS.DISCONNECTED)
  }

  const bindSocketListeners = (ioSocket) => {
    const status = getSocketStatus(ioSocket)
    setSocketStatus(status)
    if (status === SOCKET_STATUS.CONNECTED) {
      setConnectionFailureCount(0)
      events.emit('websocket_connection_restored')
    }
    if (!ioSocket) return () => {}

    // reconnect_attempt / reconnect_failed are emitted by the Manager, not the Socket (socket.io v4)
    const manager = ioSocket.io
    ioSocket.on('connect', connectListener)
    ioSocket.on('disconnect', disconnectListener)
    ioSocket.on('connect_error', connectionErrorListener)
    manager?.on('reconnect_attempt', reconnectAttemptListener)
    manager?.on('reconnect_failed', reconnectFailedListener)

    return () => {
      ioSocket.off('connect', connectListener)
      ioSocket.off('disconnect', disconnectListener)
      ioSocket.off('connect_error', connectionErrorListener)
      manager?.off('reconnect_attempt', reconnectAttemptListener)
      manager?.off('reconnect_failed', reconnectFailedListener)
    }
  }

  useEffect(() => {
    if (connectionFailureCount > MAX_CONNECTION_FAILURES) {
      events.emit('websocket_connection_failed', { count: connectionFailureCount })
    }
  }, [connectionFailureCount])

  useEffect(() => {
    if (!socket) return

    // connect() replaces socket.socket without a React update, so rebind on every swap
    let unbindSocketListeners = bindSocketListeners(socket.socket)
    const unsubscribeSocketChange = socket.onSocketChange?.((ioSocket) => {
      unbindSocketListeners()
      unbindSocketListeners = bindSocketListeners(ioSocket)
    })

    return () => {
      unsubscribeSocketChange?.()
      unbindSocketListeners()
    }
  }, [socket])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          socketStatus={socketStatus}
          connectedDate={connectedDate}
          getWebsocketStatus={getWebsocketStatus}
          connectionFailureCount={connectionFailureCount}
          reconnectAttemptCount={connectionFailureCount}
          isConnectionDegraded={connectionFailureCount > MAX_CONNECTION_FAILURES}
        />
      )}
    </>
  )
}

WebsocketStatus.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
