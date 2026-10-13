/* eslint-disable import/first */
import React, { useLayoutEffect, useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'

// Controllable socket.io double: every io() call returns a new socket with its own Manager
const ioSockets = vi.hoisted(() => [])
vi.mock('socket.io-client', () => {
  const createEmitter = () => {
    const handlers = {}
    return {
      on (event, fn) { (handlers[event] = handlers[event] || []).push(fn); return this },
      off (event, fn) { handlers[event] = (handlers[event] || []).filter(h => h !== fn); return this },
      fire (event, ...args) { (handlers[event] || []).slice().forEach(h => h(...args)) }
    }
  }
  const io = () => {
    const socket = Object.assign(createEmitter(), {
      connected: false,
      active: true,
      io: createEmitter(),
      emit: () => socket,
      close: () => {
        const wasConnected = socket.connected
        socket.connected = false
        socket.active = false
        if (wasConnected) socket.fire('disconnect', 'io client disconnect')
      }
    })
    socket.serverConnect = () => { socket.connected = true; socket.fire('connect') }
    socket.serverDisconnect = () => { socket.connected = false; socket.fire('disconnect', 'transport close') }
    ioSockets.push(socket)
    return socket
  }
  return { default: io, io }
})

vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false }, (_key, fallback) => fallback]
}))

import { SessionContext } from '../../../contexts/SessionContext'
import { EventContext } from '../../../contexts/EventContext'
import { WebsocketProvider } from '../../../contexts/WebsocketContext'
import { SOCKET_STATUS, MAX_CONNECTION_FAILURES } from '../../../contexts/WebsocketContext/constants'
import { WebsocketStatus } from '../index'

const LABELS = {
  [SOCKET_STATUS.CONNECTING]: 'connecting',
  [SOCKET_STATUS.CONNECTED]: 'connected',
  [SOCKET_STATUS.DISCONNECTED]: 'disconnected'
}

const StatusUI = ({ socketStatus, isConnectionDegraded }) => (
  <>
    <span data-testid='status'>{LABELS[socketStatus]}</span>
    <span data-testid='degraded'>{String(isConnectionDegraded)}</span>
  </>
)

const settings = { url: 'http://socket.test', project: 'development' }
const createSession = (user = {}) => ({ auth: true, token: 'token', user: { id: 1, ...user }, loading: false })
const events = { emit: vi.fn(), on: vi.fn(), off: vi.fn() }

const Harness = ({ session, showStatus = true, children }) => (
  <EventContext.Provider value={[events]}>
    <SessionContext.Provider value={[session, {}]}>
      <WebsocketProvider settings={settings}>
        {showStatus && <WebsocketStatus UIComponent={StatusUI} />}
        {children}
      </WebsocketProvider>
    </SessionContext.Provider>
  </EventContext.Provider>
)

const currentIoSocket = () => ioSockets[ioSockets.length - 1]
const status = () => screen.getByTestId('status').textContent

describe('WebsocketStatus', () => {
  beforeEach(() => {
    ioSockets.length = 0
    events.emit.mockClear()
  })

  it('shows connected when it mounts together with the provider', () => {
    render(<Harness session={createSession()} />)
    expect(status()).toBe('connecting')

    act(() => currentIoSocket().serverConnect())

    expect(status()).toBe('connected')
  })

  it('shows connected when the socket connects before listeners are bound', () => {
    const session = createSession()
    const view = render(<Harness session={session} showStatus={false} />)
    // Runs before passive effects, like a fast handshake landing mid-commit
    const ConnectBeforeEffects = () => {
      useLayoutEffect(() => { currentIoSocket().serverConnect() }, [])
      return null
    }

    view.rerender(<Harness session={session}><ConnectBeforeEffects /></Harness>)

    expect(status()).toBe('connected')
  })

  it('follows the new socket when the session changes', () => {
    let setSession
    const Wrapper = () => {
      const [session, _setSession] = useState(createSession())
      setSession = _setSession
      return <Harness session={session} />
    }
    render(<Wrapper />)
    const firstIoSocket = currentIoSocket()
    act(() => firstIoSocket.serverConnect())

    act(() => setSession(createSession({ name: 'edited' })))
    const secondIoSocket = currentIoSocket()
    expect(secondIoSocket).not.toBe(firstIoSocket)
    expect(status()).toBe('connecting')

    act(() => secondIoSocket.serverConnect())
    expect(status()).toBe('connected')

    act(() => firstIoSocket.serverDisconnect())
    expect(status()).toBe('connected')
  })

  it('tracks reconnection through the socket.io Manager events', () => {
    render(<Harness session={createSession()} />)
    const ioSocket = currentIoSocket()
    act(() => ioSocket.serverConnect())

    act(() => ioSocket.serverDisconnect())
    expect(status()).toBe('disconnected')

    act(() => ioSocket.io.fire('reconnect_attempt', 1))
    expect(status()).toBe('connecting')

    act(() => ioSocket.fire('connect_error', new Error('timeout')))
    expect(status()).toBe('disconnected')

    act(() => ioSocket.serverConnect())
    expect(status()).toBe('connected')

    act(() => ioSocket.io.fire('reconnect_failed'))
    expect(status()).toBe('disconnected')
  })

  it('counts one failure per failed reconnection and clears it on connect', () => {
    render(<Harness session={createSession()} />)
    const ioSocket = currentIoSocket()

    act(() => {
      for (let attempt = 0; attempt <= MAX_CONNECTION_FAILURES; attempt++) {
        ioSocket.io.fire('reconnect_attempt', attempt + 1)
        ioSocket.fire('connect_error', new Error('timeout'))
      }
    })
    expect(screen.getByTestId('degraded').textContent).toBe('true')
    expect(events.emit).toHaveBeenCalledWith('websocket_connection_failed', { count: MAX_CONNECTION_FAILURES + 1 })

    act(() => ioSocket.serverConnect())
    expect(screen.getByTestId('degraded').textContent).toBe('false')
    expect(events.emit).toHaveBeenCalledWith('websocket_connection_restored')
  })

  it('shows disconnected after the socket is closed', () => {
    const view = render(<Harness session={createSession()} />)
    act(() => currentIoSocket().serverConnect())

    view.rerender(<Harness session={{ auth: false, token: null, user: null, loading: false }} />)

    expect(status()).toBe('disconnected')
  })
})
