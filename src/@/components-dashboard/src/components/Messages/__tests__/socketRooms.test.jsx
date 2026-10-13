/* eslint-disable import/first */
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  socket: null,
  io: null
}))

vi.mock('socket.io-client', () => ({ default: () => mocks.io }))
vi.mock('~ui', () => ({ capitalize: (value) => value }))
vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ user: { id: 7, level: 0 }, token: 'token' }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test' }]
}))
vi.mock('../../../contexts/WebsocketContext', () => ({
  useWebsocket: () => mocks.socket
}))
vi.mock('../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: {} }]
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))
vi.mock('../../../contexts/UtilsContext', () => ({
  useUtils: () => [{ getOrderState: () => '', parsePrice: (value) => value }]
}))

import { Messages } from '..'
import { Socket } from '../../../contexts/WebsocketContext/socket'

const createFakeIo = ({ connected }) => {
  const listeners = {}
  return {
    connected,
    emit: vi.fn(),
    on: vi.fn((event, fn) => { (listeners[event] = listeners[event] || new Set()).add(fn) }),
    off: vi.fn((event, fn) => { listeners[event]?.delete(fn) }),
    close: vi.fn(),
    fire (event, ...args) { [...(listeners[event] || [])].forEach(fn => fn(...args)) },
    listenerCount: (event) => listeners[event]?.size || 0
  }
}

const reconnect = (io) => {
  io.connected = false
  io.fire('disconnect', 'transport close')
  io.connected = true
  io.fire('connect')
}

const joinedRooms = (io) => io.emit.mock.calls.filter(([event]) => event === 'join').map(([, room]) => room)

const renderMessages = (props = {}) => render(
  <Messages
    UIComponent={() => null}
    orderId={1}
    asDashboard
    messages={{ loading: false, error: null, messages: [] }}
    setMessages={() => {}}
    {...props}
  />
)

describe('Messages socket rooms', () => {
  const connectSocket = ({ connected }) => {
    mocks.io = createFakeIo({ connected })
    mocks.socket = new Socket({ url: 'wss://socket.test', project: 'cityeat', accessToken: 'token' })
    mocks.socket.connect()
    return mocks.io
  }

  beforeEach(() => {
    mocks.socket = null
    mocks.io = null
  })

  it('joins the order messages room once per connection, however many times the socket reconnects', async () => {
    const io = connectSocket({ connected: true })
    renderMessages()
    await act(async () => {})

    expect(joinedRooms(io)).toEqual(['cityeat_messages_orders_1_0'])
    const connectListeners = io.listenerCount('connect')

    for (let i = 0; i < 5; i++) {
      io.emit.mockClear()
      act(() => reconnect(io))
      expect(joinedRooms(io)).toEqual(['cityeat_messages_orders_1_0'])
    }
    expect(io.listenerCount('connect')).toBe(connectListeners)
  })

  it('only rejoins the current order room after switching orders', async () => {
    const io = connectSocket({ connected: true })
    const { rerender } = renderMessages({ orderId: 1 })
    await act(async () => {})

    rerender(
      <Messages
        UIComponent={() => null}
        orderId={2}
        asDashboard
        messages={{ loading: false, error: null, messages: [] }}
        setMessages={() => {}}
      />
    )
    io.emit.mockClear()
    act(() => reconnect(io))

    expect(joinedRooms(io)).toEqual(['cityeat_messages_orders_2_0'])
  })

  it('joins the room once when the socket connects after mount', async () => {
    const io = connectSocket({ connected: false })
    renderMessages()
    await act(async () => {})

    expect(joinedRooms(io)).toEqual([])

    act(() => {
      io.connected = true
      io.fire('connect')
    })

    expect(joinedRooms(io)).toEqual(['cityeat_messages_orders_1_0'])
  })
})
