/* eslint-disable import/first */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  socket: null,
  io: null
}))

vi.mock('socket.io-client', () => ({ default: () => mocks.io }))
vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ auth: true, loading: false, token: 'token', user: { id: 7, level: 0 } }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test', project: 'cityeat' }]
}))
vi.mock('../../../contexts/WebsocketContext', () => ({
  useWebsocket: () => mocks.socket
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: vi.fn() }],
  ToastType: { Error: 'error', Success: 'success', Info: 'info' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))

import { DriversList } from '..'
import { Socket } from '../../../contexts/WebsocketContext/socket'

const createFakeIo = ({ connected }) => {
  const listeners = {}
  const io = {
    connected,
    connectCalls: 0,
    emit: vi.fn(),
    on: vi.fn((event, fn) => { (listeners[event] = listeners[event] || new Set()).add(fn) }),
    off: vi.fn((event, fn) => { listeners[event]?.delete(fn) }),
    connect: vi.fn(() => { io.connectCalls += 1 }),
    close: vi.fn(() => {
      io.connected = false
      io.fire('disconnect', 'io client disconnect')
    }),
    fire (event, ...args) { [...(listeners[event] || [])].forEach(fn => fn(...args)) },
    listenerCount: (event) => listeners[event]?.size || 0
  }
  return io
}

const reconnect = (io, reason = 'transport close') => {
  io.connected = false
  io.fire('disconnect', reason)
  io.connected = true
  io.fire('connect')
}

const joinedRooms = (io) => io.emit.mock.calls.filter(([event]) => event === 'join').map(([, room]) => room.room)

const managerRooms = ['driver_locations', 'drivers']

const renderDriversList = () => render(
  <DriversList
    UIComponent={() => null}
    useDriversByProps
    driversList={{ drivers: [], loading: false }}
  />
)

describe('DriversList socket rooms', () => {
  const connectSocket = ({ connected }) => {
    mocks.io = createFakeIo({ connected })
    mocks.socket = new Socket({ url: 'wss://socket.test', project: 'cityeat', accessToken: 'token' })
    mocks.socket.connect()
    return mocks.io
  }

  beforeEach(() => {
    mocks.socket = null
    mocks.io = null
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('rejoins the manager rooms once per connection, however many times the socket reconnects', async () => {
    const io = connectSocket({ connected: true })
    renderDriversList()
    await act(async () => {})

    expect(joinedRooms(io)).toEqual(managerRooms)
    const connectListeners = io.listenerCount('connect')
    const disconnectListeners = io.listenerCount('disconnect')

    for (let i = 0; i < 5; i++) {
      io.emit.mockClear()
      act(() => reconnect(io))
      expect(joinedRooms(io)).toEqual(managerRooms)
    }
    expect(io.listenerCount('connect')).toBe(connectListeners)
    expect(io.listenerCount('disconnect')).toBe(disconnectListeners)
  })

  it('joins the manager rooms once when the socket connects after mount', async () => {
    const io = connectSocket({ connected: false })
    renderDriversList()
    await act(async () => {})

    expect(joinedRooms(io)).toEqual([])

    act(() => {
      io.connected = true
      io.fire('connect')
    })

    expect(joinedRooms(io)).toEqual(managerRooms)
  })

  it('does not revive the socket after an intentional client disconnect', async () => {
    const io = connectSocket({ connected: true })
    renderDriversList()
    await act(async () => {})

    act(() => mocks.socket.close())
    act(() => { vi.advanceTimersByTime(120000) })

    expect(io.connect).not.toHaveBeenCalled()
  })

  it('does not reconnect immediately after a server disconnect', async () => {
    const io = connectSocket({ connected: true })
    renderDriversList()
    await act(async () => {})

    act(() => {
      io.connected = false
      io.fire('disconnect', 'io server disconnect')
    })

    expect(io.connect).not.toHaveBeenCalled()
  })

  it('stops rejoining the manager rooms after unmount', async () => {
    const io = connectSocket({ connected: true })
    const { unmount } = renderDriversList()
    await act(async () => {})

    unmount()
    io.emit.mockClear()
    act(() => reconnect(io))

    expect(joinedRooms(io)).toEqual([])
  })
})
