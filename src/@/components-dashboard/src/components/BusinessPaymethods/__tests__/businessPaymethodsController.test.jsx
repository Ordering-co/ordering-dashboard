/* eslint-disable import/first */
// redesign stores 5.11: the payments controller grows three things the new Stripe Connect panel needs.
//  - R2 of 5.9: `handleSavePaymethod(id, changes, { silent })` forwards `silent` (no Loading / success / error toasts).
//  - G4-24: `handleStripeConnect()` returns a Promise that always resolves, never leaks its `message` listener, its
//    interval or its timeout, and survives a blocked popup.
//  - `handleSaveStripeConnect(id, changes)`: the gateway part by PUT (silent), the fees by POST, with the honest
//    «saved, but the fees were not» answer when only the second failed.
import React from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ showToast: vi.fn() }))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', user: { level: 0 } }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [
    { root: 'https://api.test', url: 'https://app.test', project: 'acme', appId: 'dashboard', appInternalName: 'dashboard' },
    { configurations: { subdomain: 'acme' } }
  ]
}))
vi.mock('../../../contexts/ConfigContext', () => ({
  useConfig: () => [{
    configs: {
      stripe_connect_sandbox: { value: '0' },
      stripe_connect_client_id: { value: 'ca_live_123' },
      stripe_connect_client_id_sandbox: { value: 'ca_test_456' }
    }
  }]
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
const STRIPE = { id: 5, name: 'Stripe Connect', gateway: 'stripe_connect', data_template: null }
const BUSINESS_STRIPE = { id: 31, paymethod_id: 5, enabled: true, sandbox: false, paymethod: STRIPE }

const json = (body) => Promise.resolve({ json: () => Promise.resolve(body) })

let ui
let onSuccessUpdate
const draw = () => {
  ui = null
  const UI = (props) => {
    ui = props
    return null
  }
  return render(<BusinessPaymethods UIComponent={UI} business={BUSINESS} handleSuccessUpdate={onSuccessUpdate} />)
}

const settle = async () => {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
}

// Routes: GETs answer the lists; each write is answered by `writes[method + ' ' + path]`
let writes
const requests = (method) => global.fetch.mock.calls.filter(([, options]) => options?.method === method)

beforeEach(() => {
  mocks.showToast.mockReset()
  onSuccessUpdate = vi.fn()
  writes = {}
  global.fetch = vi.fn((url, options = {}) => {
    const method = options.method || 'GET'
    if (method === 'GET') {
      if (url.includes('/business/7/paymethods')) return json({ error: false, result: [BUSINESS_STRIPE] })
      if (url.includes('/paymethods')) return json({ error: false, result: [CASH, STRIPE] })
      return json({ error: false, result: [] })
    }
    const path = url.replace('https://api.test', '')
    const answer = writes[`${method} ${path}`]
    if (answer instanceof Error) return Promise.reject(answer)
    return json(answer || { error: false, result: { id: 31 } })
  })
})

afterEach(() => {
  delete global.fetch
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const errorToasts = () => mocks.showToast.mock.calls.filter(([type]) => type === 'error')

describe('BusinessPaymethods controller · handleSavePaymethod silent (R2 of 5.9)', () => {
  it('silent: a failed PUT returns { ok: false, error } and shows no toast at all', async () => {
    writes['PUT /business/7/paymethods/31'] = { error: true, result: ['Gateway refused'] }
    draw()
    await settle()
    let response
    await act(async () => { response = await ui.handleSavePaymethod(31, { sandbox: true }, { silent: true }) })
    expect(response).toEqual({ ok: false, error: ['Gateway refused'] })
    expect(mocks.showToast).not.toHaveBeenCalled()
    expect(ui.actionState.loading).toBe(false)
    expect(ui.actionState.result).toEqual({ error: true, result: ['Gateway refused'] })
  })

  it('silent: a successful PUT shows no toast either', async () => {
    draw()
    await settle()
    let response
    await act(async () => { response = await ui.handleSavePaymethod(31, { sandbox: true }, { silent: true }) })
    expect(response.ok).toBe(true)
    expect(mocks.showToast).not.toHaveBeenCalled()
  })

  it('without the option the toasts are as before (Loading + success)', async () => {
    draw()
    await settle()
    await act(async () => { await ui.handleSavePaymethod(31, { sandbox: true }) })
    expect(mocks.showToast.mock.calls.map(([type]) => type)).toEqual(['info', 'success'])
  })

  it('without the option a failure keeps its error toast', async () => {
    writes['PUT /business/7/paymethods/31'] = { error: true, result: ['Gateway refused'] }
    draw()
    await settle()
    await act(async () => { await ui.handleSavePaymethod(31, { sandbox: true }) })
    expect(errorToasts()).toEqual([['error', 'Gateway refused']])
  })
})

// A fake popup and a window `message` from the OAuth page
const OAUTH_RESULT = {
  livemode: false,
  access_token: 'tok_1',
  stripe_publishable_key: 'pk_1',
  stripe_user_id: 'acct_1',
  refresh_token: 'rt_1'
}
const MAPPED = {
  sandbox: true,
  data: { token: 'tok_1', publishable: 'pk_1', user: 'acct_1', refresh_token: 'rt_1' }
}
const ORIGIN = 'https://app.acme.ordering.co'
const sendMessage = (data, origin = ORIGIN) => {
  act(() => { window.dispatchEvent(new MessageEvent('message', { origin, data })) })
}
const advance = async (ms) => {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
}
const messageListeners = (spy) => spy.mock.calls.filter(([type]) => type === 'message').map(([, listener]) => listener)

describe('BusinessPaymethods controller · handleStripeConnect (G4-24)', () => {
  let popup
  let openSpy
  let addSpy
  let removeSpy
  let outcome
  let view

  const start = () => {
    outcome = { settled: false, value: undefined }
    let promise
    act(() => { promise = ui.handleStripeConnect() })
    promise.then(value => { outcome = { settled: true, value } })
    return promise
  }

  beforeEach(async () => {
    vi.useFakeTimers()
    popup = { closed: false, postMessage: vi.fn() }
    openSpy = vi.spyOn(window, 'open').mockImplementation(() => popup)
    addSpy = vi.spyOn(window, 'addEventListener')
    removeSpy = vi.spyOn(window, 'removeEventListener')
    view = draw()
    await advance(0)
  })

  // without redirect_uri Stripe used the platform's default address, which is Stripe Connect v2's once the
  // platform registers it, and the popup ended on a page that never answers «data»
  it('opens Stripe with its own redirect_uri and the same features as main (state=<token> untouched)', () => {
    start()
    expect(openSpy).toHaveBeenCalledTimes(1)
    expect(openSpy).toHaveBeenCalledWith(
      'https://connect.stripe.com/oauth/authorize?response_type=code&client_id=ca_live_123&scope=read_write&redirect_uri=https%3A%2F%2Fapp.test%2Fv400%2Fen%2Facme%2Fpayments%2Fstripe_connect%2Fcallback&state=test-token',
      '_blank',
      'directories=no,titlebar=no,toolbar=no,location=no,status=no,menubar=no,scrollbars=no,clearcache=yes'
    )
    expect(openSpy.mock.calls[0][0]).toContain('state=test-token')
  })

  it('posts «data» to the popup every 200ms while it is open', async () => {
    start()
    await advance(600)
    expect(popup.postMessage).toHaveBeenCalledTimes(3)
    expect(popup.postMessage).toHaveBeenCalledWith('data', 'https://app.test')
  })

  it('a blocked popup resolves { ok: false, reason: blocked } at once: no interval, no listener, no TypeError', async () => {
    openSpy.mockImplementation(() => null)
    const before = messageListeners(addSpy).length
    start()
    await advance(0)
    expect(outcome).toEqual({ settled: true, value: { ok: false, reason: 'blocked' } })
    expect(messageListeners(addSpy).length).toBe(before)
    expect(vi.getTimerCount()).toBe(0)
  })

  // the legacy Stripe Connect form and its stripeConnectData state are gone; the result travels in the outcome only
  it('a successful result resolves the mapped data and removes the SAME listener', async () => {
    start()
    const listener = messageListeners(addSpy).at(-1)
    expect(typeof listener).toBe('function')
    sendMessage({ result: OAUTH_RESULT })
    // the 1s wait before closing the popup is kept
    await advance(999)
    expect(outcome.settled).toBe(false)
    expect(popup.postMessage).not.toHaveBeenCalledWith('close', 'https://app.test')
    await advance(1)
    expect(popup.postMessage).toHaveBeenCalledWith('close', 'https://app.test')
    expect(outcome).toEqual({ settled: true, value: { ok: true, ...MAPPED } })
    expect(ui).not.toHaveProperty('stripeConnectData')
    expect(messageListeners(removeSpy)).toContain(listener)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('ignores a message whose origin is not the project subdomain', async () => {
    start()
    sendMessage({ result: OAUTH_RESULT }, 'https://evil.example.com')
    await advance(1500)
    expect(outcome.settled).toBe(false)
  })

  it('an OAuth error is kept in actionState and resolves { ok: false, reason: error, error }', async () => {
    start()
    sendMessage({ error: 'access_denied' })
    await advance(1000)
    expect(outcome).toEqual({ settled: true, value: { ok: false, reason: 'error', error: 'access_denied' } })
    expect(ui.actionState.error).toBe('access_denied')
    expect(ui.actionState.loading).toBe(false)
  })

  it('a result that cannot be mapped resolves { ok: false, reason: error } and changes nothing', async () => {
    start()
    sendMessage({ result: { livemode: true, access_token: 'tok_only' } })
    await advance(1000)
    expect(outcome.settled).toBe(true)
    expect(outcome.value).toEqual({ ok: false, reason: 'error' })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('a popup found closed without a result resolves { ok: false, reason: closed } and cleans up', async () => {
    start()
    const listener = messageListeners(addSpy).at(-1)
    await advance(200)
    popup.closed = true
    await advance(200)
    expect(outcome).toEqual({ settled: true, value: { ok: false, reason: 'closed' } })
    expect(messageListeners(removeSpy)).toContain(listener)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('a second call cleans the first flow (it resolves closed) and starts its own', async () => {
    const first = { value: undefined, settled: false }
    let promise
    act(() => { promise = ui.handleStripeConnect() })
    promise.then(value => { first.settled = true; first.value = value })
    const firstListener = messageListeners(addSpy).at(-1)

    const secondPopup = { closed: false, postMessage: vi.fn() }
    openSpy.mockImplementation(() => secondPopup)
    start()
    await advance(0)

    expect(first).toEqual({ settled: true, value: { ok: false, reason: 'closed' } })
    expect(messageListeners(removeSpy)).toContain(firstListener)
    const secondListener = messageListeners(addSpy).at(-1)
    expect(secondListener).not.toBe(firstListener)
    expect(outcome.settled).toBe(false)

    // only the second flow's popup is still being pinged
    popup.postMessage.mockClear()
    await advance(400)
    expect(popup.postMessage).not.toHaveBeenCalled()
    expect(secondPopup.postMessage).toHaveBeenCalled()

    sendMessage({ result: OAUTH_RESULT })
    await advance(1000)
    expect(outcome).toEqual({ settled: true, value: { ok: true, ...MAPPED } })
  })

  it('unmounting cleans the flow: listener removed, timers cleared, promise resolved closed', async () => {
    start()
    const listener = messageListeners(addSpy).at(-1)
    view.unmount()
    await advance(0)
    expect(outcome).toEqual({ settled: true, value: { ok: false, reason: 'closed' } })
    expect(messageListeners(removeSpy)).toContain(listener)
    sendMessage({ result: OAUTH_RESULT })
    await advance(2000)
    expect(popup.postMessage).not.toHaveBeenCalledWith('close', 'https://app.test')
  })
})

describe('BusinessPaymethods controller · handleSaveStripeConnect', () => {
  const GATEWAY = {
    sandbox: true,
    data: { token: 'a' },
    data_sandbox: null,
    allowed_order_types: ['delivery'],
    sites: [1],
    devices: [2]
  }
  const SERIALIZED = {
    sandbox: true,
    data: '{"token":"a"}',
    data_sandbox: null,
    allowed_order_types: '["delivery"]',
    sites: '[1]',
    devices: '[2]'
  }
  const body = (call) => JSON.parse(call[1].body)
  const FEES_NOT_SAVED = 'The payment method was saved, but the fees were not.'

  it('PUTs the gateway part with the exact serialization handleSavePaymethod uses, silently', async () => {
    draw()
    await settle()
    let response
    await act(async () => { response = await ui.handleSaveStripeConnect(31, GATEWAY) })
    expect(response).toEqual({ ok: true })
    const puts = requests('PUT')
    expect(puts).toHaveLength(1)
    expect(puts[0][0]).toBe('https://api.test/business/7/paymethods/31')
    expect(body(puts[0])).toEqual(SERIALIZED)
    expect(requests('POST')).toHaveLength(0)
    expect(mocks.showToast).not.toHaveBeenCalled()

    // the same body handleSavePaymethod sends for the same changes
    await act(async () => { await ui.handleSavePaymethod(31, GATEWAY) })
    const puts2 = requests('PUT')
    expect(body(puts2[1])).toEqual(body(puts2[0]))
  })

  it('POSTs the fees only when `extra` has keys, with exactly those keys and main\'s headers', async () => {
    draw()
    await settle()
    let response
    await act(async () => {
      response = await ui.handleSaveStripeConnect(31, { ...GATEWAY, extra: { percentage_usage_fee: '2.5' } })
    })
    expect(response).toEqual({ ok: true })
    const posts = requests('POST')
    expect(posts).toHaveLength(1)
    expect(posts[0][0]).toBe('https://api.test/business/7')
    expect(posts[0][1].body).toBe(JSON.stringify({ percentage_usage_fee: '2.5' }))
    expect(posts[0][1].headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-token',
      'x-app-x': 'dashboard',
      'X-INTERNAL-PRODUCT-X': 'dashboard'
    })
    // the fee keys never travel in the PUT
    expect(body(requests('PUT')[0])).not.toHaveProperty('extra')
    expect(body(requests('PUT')[0])).not.toHaveProperty('percentage_usage_fee')
    expect(onSuccessUpdate).toHaveBeenCalledWith({ id: 31 })
    expect(mocks.showToast).not.toHaveBeenCalled()
    expect(ui.actionState.loading).toBe(false)
  })

  it('an empty `extra` does not POST', async () => {
    draw()
    await settle()
    await act(async () => { await ui.handleSaveStripeConnect(31, { ...GATEWAY, extra: {} }) })
    expect(requests('POST')).toHaveLength(0)
    expect(requests('PUT')).toHaveLength(1)
  })

  it('fees alone (nothing to PUT) POST without a PUT', async () => {
    draw()
    await settle()
    let response
    await act(async () => {
      response = await ui.handleSaveStripeConnect(31, { extra: { fixed_usage_fee: '1', percentage_usage_fee: '3' } })
    })
    expect(response).toEqual({ ok: true })
    expect(requests('PUT')).toHaveLength(0)
    expect(body(requests('POST')[0])).toEqual({ fixed_usage_fee: '1', percentage_usage_fee: '3' })
  })

  it('nothing to save at all: { ok: true } and no request', async () => {
    draw()
    await settle()
    const before = global.fetch.mock.calls.length
    let response
    await act(async () => { response = await ui.handleSaveStripeConnect(31, {}) })
    expect(response).toEqual({ ok: true })
    expect(global.fetch.mock.calls.length).toBe(before)
    let second
    await act(async () => { second = await ui.handleSaveStripeConnect(31) })
    expect(second).toEqual({ ok: true })
    expect(global.fetch.mock.calls.length).toBe(before)
  })

  it('a failed PUT returns { ok: false, error } and does NOT post the fees', async () => {
    writes['PUT /business/7/paymethods/31'] = { error: true, result: ['Gateway refused'] }
    draw()
    await settle()
    let response
    await act(async () => {
      response = await ui.handleSaveStripeConnect(31, { ...GATEWAY, extra: { fixed_usage_fee: '1' } })
    })
    expect(response).toEqual({ ok: false, error: ['Gateway refused'] })
    expect(requests('POST')).toHaveLength(0)
    expect(onSuccessUpdate).not.toHaveBeenCalled()
    expect(mocks.showToast).not.toHaveBeenCalled()
    expect(ui.actionState.loading).toBe(false)
  })

  it('PUT ok + POST error: ok false, the «saved, but the fees were not» line first, then the API messages', async () => {
    writes['POST /business/7'] = { error: true, result: ['Fee out of range'] }
    draw()
    await settle()
    let response
    await act(async () => {
      response = await ui.handleSaveStripeConnect(31, { ...GATEWAY, extra: { fixed_usage_fee: '999' } })
    })
    // review 5.11 F2: `unsaved` tells the panel that only the fees are left
    expect(response).toEqual({ ok: false, error: [FEES_NOT_SAVED, 'Fee out of range'], unsaved: ['extra'] })
    expect(requests('PUT')).toHaveLength(1)
    expect(onSuccessUpdate).not.toHaveBeenCalled()
    expect(mocks.showToast).not.toHaveBeenCalled()
    expect(ui.actionState.loading).toBe(false)
  })

  it('PUT ok + POST throws: same honest answer with the thrown message', async () => {
    writes['POST /business/7'] = new Error('Network down')
    draw()
    await settle()
    let response
    await act(async () => {
      response = await ui.handleSaveStripeConnect(31, { ...GATEWAY, extra: { fixed_usage_fee: '1' } })
    })
    expect(response).toEqual({ ok: false, error: [FEES_NOT_SAVED, 'Network down'], unsaved: ['extra'] })
    expect(mocks.showToast).not.toHaveBeenCalled()
    expect(ui.actionState.loading).toBe(false)
  })

  it('no PUT + POST error: just the API messages (nothing was saved)', async () => {
    writes['POST /business/7'] = { error: true, result: ['Fee out of range'] }
    draw()
    await settle()
    let response
    await act(async () => {
      response = await ui.handleSaveStripeConnect(31, { extra: { fixed_usage_fee: '999' } })
    })
    expect(response).toEqual({ ok: false, error: ['Fee out of range'], unsaved: ['extra'] })
    expect(requests('PUT')).toHaveLength(0)
    expect(mocks.showToast).not.toHaveBeenCalled()
    expect(ui.actionState.loading).toBe(false)
  })
})
