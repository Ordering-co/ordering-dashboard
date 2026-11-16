/* eslint-disable import/first */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ io: null }))

vi.mock('socket.io-client', () => ({ default: () => mocks.io }))

import { Socket } from '../socket'

const createFakeIo = ({ connected }) => {
  const listeners = {}
  return {
    connected,
    emit: vi.fn(),
    on: vi.fn((event, fn) => { (listeners[event] = listeners[event] || new Set()).add(fn) }),
    off: vi.fn((event, fn) => { listeners[event]?.delete(fn) }),
    close: vi.fn(),
    fire (event, ...args) { [...(listeners[event] || [])].forEach(fn => fn(...args)) }
  }
}

const reconnect = (io) => {
  io.connected = false
  io.fire('disconnect', 'transport close')
  io.connected = true
  io.fire('connect')
}

const emitted = (io, event) => io.emit.mock.calls.filter(([name]) => name === event).map(([, room]) => room)

const connectSocket = ({ connected }) => {
  mocks.io = createFakeIo({ connected })
  const socket = new Socket({ url: 'wss://socket.test', project: 'cityeat', accessToken: 'token' })
  socket.connect()
  return { socket, io: mocks.io }
}

// parity audit 2 (B1): two subscribers of one room (the order panel keeps the chat mounted while the route also
// has its own Messages controller) must not make each other leave it.
describe('Socket rooms are reference counted', () => {
  beforeEach(() => { mocks.io = null })

  it('emits join only for the first user of a room', () => {
    const { socket, io } = connectSocket({ connected: true })
    socket.join('messages_orders_1_0')
    socket.join('messages_orders_1_0')
    expect(emitted(io, 'join')).toEqual(['cityeat_messages_orders_1_0'])
  })

  it('leaving one of two users keeps the room, leaving the last one emits leave', () => {
    const { socket, io } = connectSocket({ connected: true })
    socket.join('messages_orders_1_0')
    socket.join('messages_orders_1_0')

    socket.leave('messages_orders_1_0')
    expect(emitted(io, 'leave')).toEqual([])

    socket.leave('messages_orders_1_0')
    expect(emitted(io, 'leave')).toEqual(['cityeat_messages_orders_1_0'])
  })

  it('a room joined again after the last leave is emitted again', () => {
    const { socket, io } = connectSocket({ connected: true })
    socket.join('orders')
    socket.leave('orders')
    socket.join('orders')
    expect(emitted(io, 'join')).toEqual(['cityeat_orders', 'cityeat_orders'])
  })

  it('counts object rooms by content, whatever object the caller passes', () => {
    const { socket, io } = connectSocket({ connected: true })
    socket.join({ room: 'drivers', user_id: 7, role: 'manager' })
    socket.join({ room: 'drivers', user_id: 7, role: 'manager' })
    expect(emitted(io, 'join')).toEqual([{ room: 'drivers', user_id: 7, role: 'manager', project: 'cityeat' }])

    socket.leave({ room: 'drivers', user_id: 7, role: 'manager' })
    expect(emitted(io, 'leave')).toEqual([])
    socket.leave({ room: 'drivers', user_id: 7, role: 'manager' })
    expect(emitted(io, 'leave')).toEqual([{ room: 'drivers', user_id: 7, role: 'manager', project: 'cityeat' }])
  })

  it('keeps different rooms apart', () => {
    const { socket, io } = connectSocket({ connected: true })
    socket.join('messages_orders_1_0')
    socket.join('messages_orders_2_0')
    socket.leave('messages_orders_1_0')
    expect(emitted(io, 'leave')).toEqual(['cityeat_messages_orders_1_0'])
  })

  it('reconnect re-joins every room that still has users, once each, and none that was left', () => {
    const { socket, io } = connectSocket({ connected: true })
    socket.join('messages_orders_1_0')
    socket.join('messages_orders_1_0')
    socket.join('orders')
    socket.join('messages_orders_2_0')
    socket.leave('messages_orders_2_0')
    socket.leave('messages_orders_1_0')
    io.emit.mockClear()

    reconnect(io)

    expect(emitted(io, 'join').sort()).toEqual(['cityeat_messages_orders_1_0', 'cityeat_orders'])
  })

  it('a room joined while offline is sent when the socket connects, once', () => {
    const { socket, io } = connectSocket({ connected: false })
    socket.join('messages_orders_1_0')
    socket.join('messages_orders_1_0')
    expect(emitted(io, 'join')).toEqual([])

    io.connected = true
    io.fire('connect')

    expect(emitted(io, 'join')).toEqual(['cityeat_messages_orders_1_0'])
  })

  it('a leave while offline cancels the join: nothing is sent when the socket connects', () => {
    const { socket, io } = connectSocket({ connected: false })
    socket.join('orders')
    socket.leave('orders')
    io.connected = true
    io.fire('connect')
    expect(emitted(io, 'join')).toEqual([])
  })

  // The consumers that already re-join on their own `connect` listener (Messages, OrderContext, DriversList) call join
  // again while the wrapper is replaying: that must not count as another user.
  it('a consumer that re-joins from its own connect listener does not inflate the count', () => {
    const { socket, io } = connectSocket({ connected: true })
    const rejoin = () => socket.join('messages_orders_1_0')
    socket.join('messages_orders_1_0')
    io.on('connect', rejoin)
    io.emit.mockClear()

    reconnect(io)
    reconnect(io)
    expect(emitted(io, 'join')).toEqual(['cityeat_messages_orders_1_0', 'cityeat_messages_orders_1_0'])

    io.off('connect', rejoin)
    io.emit.mockClear()
    socket.leave('messages_orders_1_0')
    expect(emitted(io, 'leave')).toEqual(['cityeat_messages_orders_1_0'])
  })

  it('a consumer that re-joins from its own disconnect listener does not inflate the count either', () => {
    const { socket, io } = connectSocket({ connected: true })
    socket.join('sites')
    io.on('disconnect', () => socket.join('sites'))

    reconnect(io)

    io.emit.mockClear()
    socket.leave('sites')
    expect(emitted(io, 'leave')).toEqual(['cityeat_sites'])
  })

  it('a leave of a room nobody joined is still sent, as before', () => {
    const { socket, io } = connectSocket({ connected: true })
    socket.leave('orders')
    expect(emitted(io, 'leave')).toEqual(['cityeat_orders'])
  })

  it('queued on/off keep working across the first connection', () => {
    const { socket, io } = connectSocket({ connected: false })
    const handler = vi.fn()
    socket.on('message', handler)
    io.connected = true
    io.fire('connect')
    expect(io.on).toHaveBeenCalledWith('message', handler)
  })
})
