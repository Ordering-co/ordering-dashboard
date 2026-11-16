/* eslint-disable import/first */
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'

// redesign fix-qa C3: the text of an API error is always readable, whatever shape `order_options` answers it in:
// a list of messages, one message, or an object (`message`, `result`, or its text values joined) — never
// «[object Object]».
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

const failed = (result) => ({ content: { error: true, result } })

const renderProvider = () => {
  const order = { current: null }
  const Consumer = () => {
    order.current = useOrder()
    return null
  }
  render(
    <OrderProvider strategy={{ getItem: vi.fn().mockResolvedValue(null), setItem: vi.fn(), removeItem: vi.fn() }}>
      <Consumer />
    </OrderProvider>
  )
  return order
}

const errorFor = async (result) => {
  mocks.save = vi.fn().mockResolvedValue(failed(result))
  const order = renderProvider()
  let answer
  await act(async () => { answer = await order.current[1].changeAddress(5, undefined, { silent: true }) })
  expect(answer.ok).toBe(false)
  return answer.error
}

describe('OrderProvider · text of an API error (C3)', () => {
  beforeEach(() => {
    mocks.session = { auth: true, loading: false, token: 'token', user: { id: 1, level: 0 } }
  })

  it('a single message and a list keep their text', async () => {
    expect(await errorFor('Out of coverage')).toBe('Out of coverage')
    expect(await errorFor(['Out of coverage', '', 'Try another one'])).toBe('Out of coverage Try another one')
  })

  it('an object answers its message', async () => {
    expect(await errorFor({ message: 'Out of coverage', code: 4 })).toBe('Out of coverage')
  })

  it('an object without message answers its result, whether it is text or a list', async () => {
    expect(await errorFor({ result: 'Out of coverage' })).toBe('Out of coverage')
    expect(await errorFor({ result: ['Out of coverage', 'Try another one'] })).toBe('Out of coverage Try another one')
  })

  it('an object with neither joins its text values, and a list may hold objects', async () => {
    expect(await errorFor({ address: 'Out of coverage', zone: ['No driver'] })).toBe('Out of coverage No driver')
    expect(await errorFor([{ message: 'Out of coverage' }, 'Try another one'])).toBe('Out of coverage Try another one')
  })

  it('never says [object Object]', async () => {
    for (const result of [{ a: { b: {} } }, {}, [{}], null, undefined]) {
      expect(String(await errorFor(result))).not.toContain('[object Object]')
    }
  })
})
