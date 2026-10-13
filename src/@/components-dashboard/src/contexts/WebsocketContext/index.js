import React, { createContext, useContext, useEffect, useState } from 'react'
import { useSession } from '../SessionContext'
import { useEvent } from '../EventContext'
import { Socket } from './socket'

/**
 * Create SessionContext
 * This context will manage the socket conection and provide an easy interface
 */
export const WebsocketContext = createContext()

// let socket = null

/**
 * Custom provider to session manager
 * This provider has a reducer for manage session state
 * @param {props} props
 */
export const WebsocketProvider = ({ settings, children }) => {
  const [session] = useSession()
  const [events] = useEvent()
  const [socket, setSocket] = useState()

  useEffect(() => {
    if (session.loading) return
    if (session.auth && settings.project && settings.url) {
      const _socket = new Socket({ ...settings, accessToken: session.token, url: settings.url })
      setSocket(_socket)
    }
    if (!session.auth) {
      socket && socket.close()
    }
  }, [session])

  useEffect(() => {
    if (socket && session?.user?.id) {
      socket.connect()
    }
    return () => {
      socket && socket.close()
    }
  }, [socket, session?.user?.id])

  useEffect(() => {
    if (!socket?.socket) return

    const onConnect = () => {
      window.localStorage.setItem('websocket-connected-date', new Date())
      events.emit('websocket_connected')
    }

    socket.socket.on('connect', onConnect)

    return () => {
      socket.socket.off('connect', onConnect)
    }
  }, [socket?.socket, session])

  return (
    <WebsocketContext.Provider value={socket}>
      {children}
    </WebsocketContext.Provider>
  )
}

/**
 * Hook to get and update websocket state
 */
export const useWebsocket = () => {
  const sockerManager = useContext(WebsocketContext)
  return sockerManager || new Socket({})
}

export const useSocketInstance = (socket) => {
  const [ioSocket, setIoSocket] = useState(() => socket?.socket)

  useEffect(() => {
    setIoSocket(socket?.socket)
    return socket?.onSocketChange?.(setIoSocket)
  }, [socket])

  return ioSocket
}
