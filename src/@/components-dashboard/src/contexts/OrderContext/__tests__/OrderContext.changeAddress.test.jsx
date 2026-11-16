/* eslint-disable import/first */
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'

// redesign fix-qa E9: `changeAddress` answers `{ ok, error }` and, with `{ silent: true }`, leaves the global
// Alert alone so the caller can write the error where the user is looking. Without it nothing changes: the Alert
// opens as it always did.
const mocks = vi.hoisted(() => ({ session: {}, save: null }))

vi.mock('socket.io-client', () => ({ default: () => null }))
vi.mock('../../SessionContext', () => ({ useSession: () => [mocks.session, { logout: vi.fn() }] }))
vi.mock('../../ApiContext', () => ({
  useApi: () => [{
    appId: 'dashboard',
    appInternalName: 'dashboard',
    setAccessToken: () => ({ orderOptions: () => ({ get: vi.fn(), save: mocks.save }), carts: () => ({}) })
  }]
}))
vi.mock('../../WebsocketContext', () => ({
  useWebsocket: () => ({ on: vi.fn(), off: vi.fn(), getId: () => 'socket-id', socket: null })
}))
vi.mock('../../LanguageContext', () => ({ useLanguage: () => [{ loading: false }, (_key, fallback) => fallback] }))
vi.mock('../../EventContext', () => ({ useEvent: () => [{ emit: vi.fn(), on: vi.fn(), off: vi.fn() }] }))
vi.mock('../../ConfigContext', () => ({ useConfig: () => [{ loading: false, configs: {} }] }))
vi.mock('../../CustomerContext', () => ({
  useCustomer: () => [{ loading: false, user: null }, { setUserCustomer: vi.fn() }]
}))
vi.mock('../../ToastContext', () => ({ ToastType: { Info: 'info' }, useToast: () => [null, { showToast: vi.fn() }] }))

import { OrderProvider, useOrder } from '..'

const ok = { content: { error: false, result: { type: 1, moment: null, address: {}, carts: [] } } }
const failed = (result) => ({ content: { error: true, result } })

const renderProvider = () => {
  const order = { current: null }
  const Consumer = () => {
    order.current = useOrder()
    return null
  }
  const Alert = ({ open, content }) => open ? <div data-testid='order-alert'>{String(content)}</div> : null
  const utils = render(
    <OrderProvider strategy={{ getItem: vi.fn().mockResolvedValue(null), setItem: vi.fn(), removeItem: vi.fn() }} Alert={Alert}>
      <Consumer />
    </OrderProvider>
  )
  return { order, ...utils }
}

describe('OrderProvider changeAddress', () => {
  beforeEach(() => {
    mocks.session = { auth: true, loading: false, token: 'token', user: { id: 1, level: 0 } }
    mocks.save = vi.fn().mockResolvedValue(ok)
  })

  it('answers ok when the options were saved', async () => {
    const { order, queryByTestId } = renderProvider()
    let result
    await act(async () => { result = await order.current[1].changeAddress(5) })
    expect(result).toEqual({ ok: true })
    expect(queryByTestId('order-alert')).toBeNull()
  })

  it('by default a failed save opens the Alert, as before, and answers the error', async () => {
    mocks.save = vi.fn().mockResolvedValue(failed(['Address out of coverage']))
    const { order, findByTestId } = renderProvider()
    let result
    await act(async () => { result = await order.current[1].changeAddress(5) })
    expect(result).toEqual({ ok: false, error: 'Address out of coverage' })
    expect(await findByTestId('order-alert')).toHaveTextContent('Address out of coverage')
  })

  it('silent: a failed save answers the real text and leaves the Alert closed', async () => {
    mocks.save = vi.fn().mockResolvedValue(failed(['Address out of coverage', 'Try another one']))
    const { order, queryByTestId } = renderProvider()
    let result
    await act(async () => { result = await order.current[1].changeAddress(5, undefined, { silent: true }) })
    expect(result).toEqual({ ok: false, error: 'Address out of coverage Try another one' })
    expect(queryByTestId('order-alert')).toBeNull()
    expect(order.current[0].loading).toBe(false)
  })

  it('silent: a request that throws answers its message and leaves the Alert closed', async () => {
    mocks.save = vi.fn().mockRejectedValue(new Error('Failed to fetch'))
    const { order, queryByTestId } = renderProvider()
    let result
    await act(async () => { result = await order.current[1].changeAddress(5, undefined, { silent: true }) })
    expect(result).toEqual({ ok: false, error: 'Failed to fetch' })
    expect(queryByTestId('order-alert')).toBeNull()
  })

  it('silent does not change the request that goes out', async () => {
    const { order } = renderProvider()
    await act(async () => { await order.current[1].changeAddress(5, undefined, { silent: true }) })
    expect(mocks.save.mock.calls[0][0]).toMatchObject({ address_id: 5, user_id: 1 })
  })

  it('a stored address object (no request) answers ok', async () => {
    const { order } = renderProvider()
    let result
    await act(async () => { result = await order.current[1].changeAddress({ address: 'Main St' }) })
    expect(result).toEqual({ ok: true })
    expect(mocks.save).not.toHaveBeenCalled()
  })
})
