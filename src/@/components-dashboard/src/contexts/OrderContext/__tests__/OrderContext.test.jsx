/* eslint-disable import/first */
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  session: {},
  configs: {},
  get: null,
  save: null,
  carts: {},
  socket: null,
  io: null
}))

vi.mock('socket.io-client', () => ({ default: () => mocks.io }))

vi.mock('../../SessionContext', () => ({
  useSession: () => [mocks.session, { logout: vi.fn() }]
}))
vi.mock('../../ApiContext', () => ({
  useApi: () => [{
    appId: 'dashboard',
    appInternalName: 'dashboard',
    setAccessToken: () => ({
      orderOptions: () => ({ get: mocks.get, save: mocks.save }),
      carts: () => mocks.carts
    })
  }]
}))
vi.mock('../../WebsocketContext', () => ({
  useWebsocket: () => mocks.socket || { on: vi.fn(), off: vi.fn(), getId: () => 'socket-id', socket: null }
}))
vi.mock('../../LanguageContext', () => ({
  useLanguage: () => [{ loading: false }, (_key, fallback) => fallback]
}))
vi.mock('../../EventContext', () => ({
  useEvent: () => [{ emit: vi.fn(), on: vi.fn(), off: vi.fn() }]
}))
vi.mock('../../ConfigContext', () => ({
  useConfig: () => [{ loading: false, configs: mocks.configs }]
}))
vi.mock('../../CustomerContext', () => ({
  useCustomer: () => [{ loading: false, user: null }, { setUserCustomer: vi.fn() }]
}))
vi.mock('../../ToastContext', () => ({
  ToastType: { Info: 'info' },
  useToast: () => [null, { showToast: vi.fn() }]
}))

import { OrderProvider, useOrder } from '..'
import { Socket } from '../../WebsocketContext/socket'

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

const orderTypesConfig = (allowed, defaultType) => ({
  order_types_allowed: { key: 'order_types_allowed', value: allowed },
  default_order_type: { key: 'default_order_type', value: defaultType }
})

const serverOptions = (options = {}) => ({
  content: { error: false, result: { type: 1, moment: null, address: {}, carts: [{ business_id: 41, uuid: 'cart-41' }], ...options } }
})

const createStrategy = () => ({
  getItem: vi.fn().mockResolvedValue(null),
  setItem: vi.fn().mockResolvedValue(undefined),
  removeItem: vi.fn().mockResolvedValue(undefined)
})

const renderProvider = (strategy = createStrategy()) => {
  const order = { current: null }
  const Consumer = () => {
    order.current = useOrder()
    return null
  }
  const Alert = ({ open, content }) => open ? <div data-testid='order-alert'>{String(content)}</div> : null
  const utils = render(
    <OrderProvider strategy={strategy} Alert={Alert}>
      <Consumer />
    </OrderProvider>
  )
  return { order, ...utils }
}

describe('OrderProvider', () => {
  beforeEach(() => {
    mocks.socket = null
    mocks.io = null
    mocks.session = { auth: true, loading: false, token: 'token', user: { id: 1, level: 0 } }
    mocks.configs = orderTypesConfig('1|2', 'delivery')
    mocks.get = vi.fn().mockResolvedValue(serverOptions())
    mocks.save = vi.fn().mockImplementation((body) => Promise.resolve(serverOptions({ type: body.type })))
  })

  it('does not request order options when an authenticated user boots the dashboard', async () => {
    const { order } = renderProvider()

    await act(async () => {})

    expect(mocks.get).not.toHaveBeenCalled()
    expect(mocks.save).not.toHaveBeenCalled()
    expect(order.current[0].loading).toBe(false)
    expect(order.current[0].carts).toEqual({})
  })

  it('does not force the order type while order options were never loaded', async () => {
    mocks.configs = orderTypesConfig('2', 'delivery')

    const { queryByTestId } = renderProvider()
    await act(async () => {})

    expect(mocks.save).not.toHaveBeenCalled()
    expect(queryByTestId('order-alert')).not.toBeInTheDocument()
  })

  it('loads order options and carts on demand', async () => {
    const { order } = renderProvider()

    await act(async () => {
      await order.current[1].refreshOrderOptions()
    })

    expect(mocks.get).toHaveBeenCalledTimes(1)
    expect(order.current[0].loading).toBe(false)
    expect(order.current[0].options.type).toBe(1)
    expect(order.current[0].carts).toEqual({ 'businessId:41': { business_id: 41, uuid: 'cart-41' } })
    expect(order.current[0].optionsUserId).toBe(1)
  })

  it('loads the options of the stored customer and remembers whose they are', async () => {
    const strategy = createStrategy()
    strategy.getItem.mockImplementation((key) => Promise.resolve(key === 'user-customer' ? { id: 77 } : null))
    const { order } = renderProvider(strategy)

    await act(async () => {
      await order.current[1].changeAddress(5)
    })

    expect(mocks.save.mock.calls[0][0]).toMatchObject({ address_id: 5, user_id: 77 })
    expect(order.current[0].optionsUserId).toBe(77)
    expect(order.current[0].carts).toHaveProperty(['businessId:41'])
  })

  it('clears the loaded options and carts', async () => {
    const { order } = renderProvider()
    await act(async () => {
      await order.current[1].refreshOrderOptions()
    })

    act(() => {
      order.current[1].clearOrderOptions()
    })

    expect(order.current[0].carts).toEqual({})
    expect(order.current[0].optionsUserId).toBeNull()
    expect(order.current[0].loading).toBe(false)
    expect(order.current[0].options).toEqual({ type: 1, moment: null, city_id: null })
  })

  it('drops a response that arrives after the options were cleared', async () => {
    let resolveGet
    mocks.get = vi.fn(() => new Promise(resolve => { resolveGet = resolve }))
    const { order } = renderProvider()

    let pending
    act(() => {
      pending = order.current[1].refreshOrderOptions()
    })
    await waitFor(() => expect(mocks.get).toHaveBeenCalled())

    act(() => {
      order.current[1].clearOrderOptions()
    })
    await act(async () => {
      resolveGet(serverOptions())
      await pending
    })

    expect(order.current[0].carts).toEqual({})
    expect(order.current[0].optionsUserId).toBeNull()
    expect(order.current[0].loading).toBe(false)
  })

  it('drops a cart update that arrives after the options were cleared', async () => {
    let resolveAdd
    const addProduct = vi.fn(() => new Promise(resolve => { resolveAdd = resolve }))
    mocks.carts = { addProduct }
    const { order } = renderProvider()
    await act(async () => {
      await order.current[1].refreshOrderOptions()
    })

    let pending
    act(() => {
      pending = order.current[1].addProduct({ id: 9, name: 'Burger' }, { business_id: 41 })
    })
    await waitFor(() => expect(addProduct).toHaveBeenCalled())

    act(() => {
      order.current[1].clearOrderOptions()
    })
    await act(async () => {
      resolveAdd({ content: { error: false, result: { business_id: 41, uuid: 'cart-41', products: [{ id: 9 }] } } })
      await pending
    })

    expect(order.current[0].carts).toEqual({})
    expect(order.current[0].optionsUserId).toBeNull()
  })

  it('moves loaded options to the configured default type when their type is not allowed', async () => {
    mocks.configs = orderTypesConfig('2|3', 'eatin')
    const { order } = renderProvider()

    await act(async () => {
      await order.current[1].refreshOrderOptions()
    })

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
    expect(mocks.save.mock.calls[0][0]).toMatchObject({ type: 3 })
  })

  it('falls back to the first allowed type when the default type is not allowed', async () => {
    mocks.configs = orderTypesConfig('2|3', 'delivery')
    const { order } = renderProvider()

    await act(async () => {
      await order.current[1].refreshOrderOptions()
    })

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
    expect(mocks.save.mock.calls[0][0]).toMatchObject({ type: 2 })
  })

  describe('main socket rooms', () => {
    const adminRooms = [
      { room: 'orders', user_id: 1, role: 'manager', project: 'cityeat' },
      'cityeat_orders',
      'cityeat_messages_orders'
    ]

    const connectSocket = ({ connected }) => {
      mocks.io = createFakeIo({ connected })
      mocks.socket = new Socket({ url: 'wss://socket.test', project: 'cityeat', accessToken: 'token' })
      mocks.socket.connect()
      return mocks.io
    }

    it('joins the main rooms once per connection, however many times the socket reconnects', async () => {
      const io = connectSocket({ connected: true })
      renderProvider()
      await act(async () => {})

      expect(joinedRooms(io)).toEqual(adminRooms)
      const connectListeners = io.listenerCount('connect')

      for (let i = 0; i < 5; i++) {
        io.emit.mockClear()
        act(() => reconnect(io))
        expect(joinedRooms(io)).toEqual(adminRooms)
      }
      expect(io.listenerCount('connect')).toBe(connectListeners)
    })

    it('joins the main rooms once when the socket connects after the provider mounts', async () => {
      const io = connectSocket({ connected: false })
      renderProvider()
      await act(async () => {})

      expect(joinedRooms(io)).toEqual([])

      act(() => {
        io.connected = true
        io.fire('connect')
      })

      expect(joinedRooms(io)).toEqual(adminRooms)
    })

    it('stops joining the main rooms after unmount', async () => {
      const io = connectSocket({ connected: true })
      const { unmount } = renderProvider()
      await act(async () => {})

      unmount()
      io.emit.mockClear()
      act(() => reconnect(io))

      expect(joinedRooms(io)).toEqual([])
    })
  })
})
