import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ instances: [] }))

vi.mock('socket.io-client', () => ({
  default: (url, options) => {
    const listeners = {}
    const instance = {
      options,
      connected: false,
      connectCalls: 0,
      closeCalls: 0,
      emit: vi.fn(),
      on: vi.fn((event, fn) => { (listeners[event] = listeners[event] || new Set()).add(fn) }),
      off: vi.fn((event, fn) => { listeners[event]?.delete(fn) }),
      connect: vi.fn(() => { instance.connectCalls += 1 }),
      close: vi.fn(() => {
        instance.closeCalls += 1
        instance.connected = false
        instance.fire('disconnect', 'io client disconnect')
      }),
      fire (event, ...args) { [...(listeners[event] || [])].forEach(fn => fn(...args)) },
      listenerCount: (event) => listeners[event]?.size || 0
    }
    state.instances.push(instance)
    return instance
  }
}))

const { Socket } = await import('../socket')

const createSocket = () => {
  const socket = new Socket({ url: 'wss://socket.test', project: 'cityeat', accessToken: 'token' })
  socket.connect()
  const io = state.instances[state.instances.length - 1]
  io.connected = true
  io.fire('connect')
  return { socket, io }
}

const serverDisconnect = (io) => {
  io.connected = false
  io.fire('disconnect', 'io server disconnect')
}

describe('Socket reconnect policy', () => {
  beforeEach(() => {
    state.instances.length = 0
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('configures socket.io reconnection backoff', () => {
    createSocket()
    expect(state.instances[0].options).toMatchObject({
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5
    })
  })

  it('leaves network drops to socket.io automatic reconnection', () => {
    const { io } = createSocket()
    io.connected = false
    io.fire('disconnect', 'transport close')
    io.fire('disconnect', 'ping timeout')
    vi.advanceTimersByTime(120000)
    expect(io.connectCalls).toBe(0)
  })

  it('keeps an intentionally closed socket closed', () => {
    const { socket, io } = createSocket()
    socket.close()
    vi.advanceTimersByTime(120000)
    expect(io.closeCalls).toBe(1)
    expect(io.connectCalls).toBe(0)
  })

  it('reconnects after a server disconnect with growing backoff instead of immediately', () => {
    const { io } = createSocket()

    serverDisconnect(io)
    expect(io.connectCalls).toBe(0)
    vi.advanceTimersByTime(999)
    expect(io.connectCalls).toBe(0)
    vi.advanceTimersByTime(1)
    expect(io.connectCalls).toBe(1)

    io.connected = true
    io.fire('connect')
    serverDisconnect(io)
    vi.advanceTimersByTime(1999)
    expect(io.connectCalls).toBe(1)
    vi.advanceTimersByTime(1)
    expect(io.connectCalls).toBe(2)
  })

  it('resets the backoff once a connection has been stable', () => {
    const { io } = createSocket()
    serverDisconnect(io)
    vi.advanceTimersByTime(1000)
    io.connected = true
    io.fire('connect')
    vi.advanceTimersByTime(30000)

    serverDisconnect(io)
    vi.advanceTimersByTime(1000)
    expect(io.connectCalls).toBe(2)
  })

  it('resets the backoff after a stable connection that dropped for another reason', () => {
    const { io } = createSocket()
    serverDisconnect(io)
    vi.advanceTimersByTime(1000)
    io.connected = true
    io.fire('connect')
    serverDisconnect(io)
    vi.advanceTimersByTime(2000)
    expect(io.connectCalls).toBe(2)

    io.connected = true
    io.fire('connect')
    vi.advanceTimersByTime(30000)
    io.connected = false
    io.fire('disconnect', 'transport close')
    io.connected = true
    io.fire('connect')

    serverDisconnect(io)
    vi.advanceTimersByTime(999)
    expect(io.connectCalls).toBe(2)
    vi.advanceTimersByTime(1)
    expect(io.connectCalls).toBe(3)
  })

  it('starts a fresh backoff after the socket is closed and connected again', () => {
    const { socket, io: first } = createSocket()
    serverDisconnect(first)
    vi.advanceTimersByTime(1000)
    first.connected = true
    first.fire('connect')
    serverDisconnect(first)
    vi.advanceTimersByTime(2000)
    expect(first.connectCalls).toBe(2)

    socket.close()
    socket.connect()
    const second = state.instances[1]
    second.connected = true
    second.fire('connect')
    serverDisconnect(second)
    vi.advanceTimersByTime(999)
    expect(second.connectCalls).toBe(0)
    vi.advanceTimersByTime(1)
    expect(second.connectCalls).toBe(1)
  })

  it('does not reconnect when the socket is closed while a reconnect is pending', () => {
    const { socket, io } = createSocket()
    serverDisconnect(io)
    socket.close()
    vi.advanceTimersByTime(120000)
    expect(io.connectCalls).toBe(0)
  })

  it('ignores server disconnects from a replaced socket.io instance', () => {
    const { socket, io: first } = createSocket()
    socket.connect()
    serverDisconnect(first)
    vi.advanceTimersByTime(120000)
    expect(first.connectCalls).toBe(0)
  })
})

describe('Socket queue', () => {
  beforeEach(() => {
    state.instances.length = 0
  })

  it('applies a queued off so the listener is removed once connected', () => {
    const socket = new Socket({ url: 'wss://socket.test', project: 'cityeat', accessToken: 'token' })
    socket.connect()
    const io = state.instances[0]
    const handler = vi.fn()
    socket.on('update_order', handler)
    socket.off('update_order', handler)

    io.connected = true
    io.fire('connect')
    io.fire('update_order', { id: 1 })

    expect(handler).not.toHaveBeenCalled()
    expect(io.listenerCount('update_order')).toBe(0)
  })
})
