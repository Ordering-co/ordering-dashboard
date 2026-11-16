/* eslint-disable import/first */
// redesign stores 5.9 (G4-06): the controller's writes now RETURN `{ ok, result | error }` so the new
// Payments UI can react to them, `handleSavePaymethod` saves an explicit object (not `changesState`),
// `handleTogglePaymethod` flips one row, and `handleSelectAllPaymethods(ids)` turns on the given rows in parallel with
// ONE summary toast instead of one per request.
import React from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ showToast: vi.fn() }))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', user: { level: 0 } }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test', appId: 'dashboard', appInternalName: 'dashboard' }, { configurations: {} }]
}))
vi.mock('../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: {} }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))

import { BusinessPaymethods } from '../index'

const BUSINESS = { id: 7, name: 'Sample Burgers' }
const CASH = { id: 1, name: 'Cash', gateway: 'cash', data_template: null }
const CARD = { id: 2, name: 'Card on delivery', gateway: 'card_delivery', data_template: null }
const PAYPAL = { id: 3, name: 'PayPal', gateway: 'paypal', data_template: null }
const PAGAZUL = { id: 4, name: 'Pagazul', gateway: 'pagazul', data_template: null }
const BUSINESS_CASH = { id: 31, paymethod_id: 1, enabled: true, sandbox: false, paymethod: CASH }
const BUSINESS_CARD = { id: 32, paymethod_id: 2, enabled: false, sandbox: false, paymethod: CARD }

const json = (body) => Promise.resolve({ json: () => Promise.resolve(body) })

let ui
const draw = () => {
  ui = null
  const UI = (props) => {
    ui = props
    return null
  }
  return render(<BusinessPaymethods UIComponent={UI} business={BUSINESS} />)
}

const settle = async () => {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
}

const writes = () => global.fetch.mock.calls.filter(([, options]) => (options?.method || 'GET') !== 'GET')
const bodyOf = (call) => JSON.parse(call[1].body)
const toastsOf = (type) => mocks.showToast.mock.calls.filter(([t]) => t === type)

// answers every GET with the fixtures and every write with `onWrite(url, method, body)`
const mockApi = (onWrite) => {
  global.fetch = vi.fn((url, options = {}) => {
    const method = options.method || 'GET'
    if (method === 'GET') {
      if (url.includes('/business/7/paymethods')) return json({ error: false, result: [BUSINESS_CASH, BUSINESS_CARD] })
      if (url.includes('/paymethods')) return json({ error: false, result: [CASH, CARD, PAYPAL, PAGAZUL] })
      return json({ error: false, result: [] })
    }
    return onWrite(url, method, options.body ? JSON.parse(options.body) : undefined)
  })
}

beforeEach(() => {
  mocks.showToast.mockReset()
  mockApi((url, method, body) => json({ error: false, result: { id: 31, ...body } }))
})

afterEach(() => {
  delete global.fetch
})

describe('BusinessPaymethods controller · write results (G4-06)', () => {
  it('an update returns { ok: true, result } on success and { ok: false, error } on failure', async () => {
    draw()
    await settle()
    let res
    await act(async () => { res = await ui.handleTogglePaymethod(1, false) })
    expect(res).toEqual({ ok: true, result: { id: 31, enabled: false } })
    mockApi(() => json({ error: true, result: ['X'] }))
    await act(async () => { res = await ui.handleTogglePaymethod(1, true) })
    expect(res).toEqual({ ok: false, error: ['X'] })
  })

  it('a create returns { ok: true, result } with the API record', async () => {
    draw()
    await settle()
    mockApi((url, method, body) => json({ error: false, result: { id: 41, ...body } }))
    let res
    await act(async () => { res = await ui.handleTogglePaymethod(4, true) })
    expect(res.ok).toBe(true)
    expect(res.result).toEqual({ id: 41, enabled: true, paymethod_id: 4, sandbox: false })
  })

  it('handleDeleteBusinessPaymethodOption returns the result', async () => {
    draw()
    await settle()
    mockApi(() => json({ error: false, result: 'Ok' }))
    let res
    await act(async () => { res = await ui.handleDeleteBusinessPaymethodOption(1) })
    expect(res).toEqual({ ok: true, result: 'Ok' })
    mockApi(() => json({ error: true, result: ['No'] }))
    await act(async () => { res = await ui.handleDeleteBusinessPaymethodOption(2) })
    expect(res).toEqual({ ok: false, error: ['No'] })
  })

  it('a request that throws returns { ok: false, error: message }', async () => {
    draw()
    await settle()
    global.fetch = vi.fn(() => Promise.reject(new Error('Network down')))
    let res
    await act(async () => { res = await ui.handleSavePaymethod(31, { sandbox: true }) })
    expect(res).toEqual({ ok: false, error: 'Network down' })
  })
})

describe('BusinessPaymethods controller · handleSavePaymethod', () => {
  it('sends only the given keys, serialized, and returns ok', async () => {
    draw()
    await settle()
    let res
    await act(async () => {
      res = await ui.handleSavePaymethod(31, {
        sandbox: true,
        data: { key: 'a' },
        data_sandbox: null,
        allowed_order_types: [1, 2],
        sites: [5],
        devices: [8, 9]
      })
    })
    expect(res.ok).toBe(true)
    const [call] = writes()
    expect(call[0]).toBe('https://api.test/business/7/paymethods/31')
    expect(call[1].method).toBe('PUT')
    expect(bodyOf(call)).toEqual({
      sandbox: true,
      data: JSON.stringify({ key: 'a' }),
      data_sandbox: null,
      allowed_order_types: JSON.stringify([1, 2]),
      sites: JSON.stringify([5]),
      devices: JSON.stringify([8, 9])
    })
  })

  it('an empty allowed_order_types goes as null and absent keys are not sent', async () => {
    draw()
    await settle()
    await act(async () => { await ui.handleSavePaymethod(31, { allowed_order_types: [] }) })
    expect(bodyOf(writes()[0])).toEqual({ allowed_order_types: null })
  })

  it('with no changes it returns ok without a request', async () => {
    draw()
    await settle()
    let res
    await act(async () => { res = await ui.handleSavePaymethod(31, {}) })
    expect(res).toEqual({ ok: true })
    expect(writes()).toHaveLength(0)
  })

  it('does not read changesState', async () => {
    draw()
    await settle()
    act(() => { ui.handleChangeBusinessPaymentState({ sandbox: true }) })
    await act(async () => { await ui.handleSavePaymethod(31, { sites: [1] }) })
    expect(bodyOf(writes()[0])).toEqual({ sites: JSON.stringify([1]) })
  })

  it('an { error: true } answer returns { ok: false, error } and frees loading', async () => {
    draw()
    await settle()
    mockApi(() => json({ error: true, result: ['X'] }))
    let res
    await act(async () => { res = await ui.handleSavePaymethod(31, { sandbox: true }) })
    expect(res).toEqual({ ok: false, error: ['X'] })
    expect(ui.actionState.loading).toBe(false)
    expect(toastsOf('error')).toEqual([['error', 'X']])
  })
})

describe('BusinessPaymethods controller · handleTogglePaymethod', () => {
  it('PUTs { enabled } on an existing record', async () => {
    draw()
    await settle()
    let res
    await act(async () => { res = await ui.handleTogglePaymethod(2, true) })
    expect(res.ok).toBe(true)
    const [call] = writes()
    expect(call[0]).toBe('https://api.test/business/7/paymethods/32')
    expect(call[1].method).toBe('PUT')
    expect(bodyOf(call)).toEqual({ enabled: true })
  })

  it('POSTs with the given enabled when there is no record and returns the created record', async () => {
    draw()
    await settle()
    mockApi((url, method, body) => json({ error: false, result: { id: 40, ...body } }))
    let res
    await act(async () => { res = await ui.handleTogglePaymethod(3, false) })
    const [call] = writes()
    expect(call[0]).toBe('https://api.test/business/7/paymethods')
    expect(call[1].method).toBe('POST')
    expect(bodyOf(call)).toEqual({ enabled: false, paymethod_id: 3, sandbox: true })
    expect(res.ok).toBe(true)
    expect(res.created).toEqual({ id: 40, enabled: false, paymethod_id: 3, sandbox: true, paymethod: PAYPAL })
  })

  it('a failed create returns ok false and no created record', async () => {
    draw()
    await settle()
    mockApi(() => json({ error: true, result: ['Nope'] }))
    let res
    await act(async () => { res = await ui.handleTogglePaymethod(3, true) })
    expect(res.ok).toBe(false)
    expect(res.created).toBeUndefined()
  })

  it('handleCreateBusinessPaymentOption keeps today\'s rule (enabled: !callback) when enabled is not given', async () => {
    draw()
    await settle()
    await act(async () => { await ui.handleClickPayment(3) })
    expect(bodyOf(writes()[0]).enabled).toBe(true)
  })
})

describe('BusinessPaymethods controller · handleSelectAllPaymethods(ids)', () => {
  it('makes one request per id that needs it, shows exactly one success toast and returns counts', async () => {
    draw()
    await settle()
    mockApi((url, method, body) => json({ error: false, result: { id: 50, ...body } }))
    let res
    // 1 is already enabled (skip), 2 is disabled (PUT), 3 and 4 have no record (POST)
    await act(async () => { res = await ui.handleSelectAllPaymethods([1, 2, 3, 4]) })
    expect(writes()).toHaveLength(3)
    expect(writes().map(c => c[1].method).sort()).toEqual(['POST', 'POST', 'PUT'])
    expect(res).toEqual({ ok: true, okCount: 3, failCount: 0 })
    expect(toastsOf('success')).toEqual([['success', '3 payment methods turned on']])
    expect(toastsOf('error')).toHaveLength(0)
    expect(toastsOf('info')).toHaveLength(0)
    const posts = writes().filter(c => c[1].method === 'POST').map(bodyOf)
    expect(posts.every(b => b.enabled === true)).toBe(true)
    expect(ui.businessPaymethodsState.paymethods.map(p => p.paymethod_id).sort()).toEqual([1, 2, 3, 4])
    expect(ui.actionState.loading).toBe(false)
  })

  it('on one failure shows one error toast with the API messages and the counts', async () => {
    draw()
    await settle()
    mockApi((url, method, body) => {
      if (body?.paymethod_id === 4) return json({ error: true, result: ['Pagazul rejected'] })
      return json({ error: false, result: { id: 50, ...body } })
    })
    let res
    await act(async () => { res = await ui.handleSelectAllPaymethods([2, 3, 4]) })
    expect(res).toEqual({ ok: false, okCount: 2, failCount: 1 })
    expect(toastsOf('success')).toEqual([['success', '2 payment methods turned on']])
    expect(toastsOf('error')).toEqual([['error', '1 could not be turned on: Pagazul rejected']])
    expect(ui.actionState.loading).toBe(false)
  })

  it('with no argument or a non-array it does nothing', async () => {
    draw()
    await settle()
    let res
    await act(async () => { res = await ui.handleSelectAllPaymethods() })
    expect(res).toEqual({ ok: true, okCount: 0, failCount: 0 })
    await act(async () => { res = await ui.handleSelectAllPaymethods('all') })
    expect(res).toEqual({ ok: true, okCount: 0, failCount: 0 })
    expect(writes()).toHaveLength(0)
    expect(mocks.showToast).not.toHaveBeenCalled()
  })
})
