/* eslint-disable import/first */
// redesign bugs C (decision 4 of Stores): opening a gateway the store has no record of writes nothing. The detail starts from
// `getDraftBusinessPaymethod` (no request), and its first Save, `handleCreatePaymethodOnSave`, creates the record as main created it on
// open (disabled, the sandbox rule) and then saves the changes on it, silently (the panel says how the save went).
import React from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ showToast: vi.fn() }))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', user: { level: 0 } }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [
    { root: 'https://api.test', url: 'https://app.test', appId: 'dashboard', appInternalName: 'dashboard' },
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

const body = (call) => JSON.parse(call[1].body)

describe('BusinessPaymethods controller · a gateway is created by its first Save', () => {
  it('the draft of a gateway the store does not have is made without a request, with main\'s sandbox rule', async () => {
    draw()
    await settle()
    global.fetch.mockClear()
    expect(ui.getDraftBusinessPaymethod(1)).toMatchObject({ draft: true, paymethod_id: 1, enabled: false, sandbox: false, paymethod: CASH })
    expect(ui.getDraftBusinessPaymethod(5)).toMatchObject({ draft: true, paymethod_id: 5, enabled: false, sandbox: true })
    expect(ui.getDraftBusinessPaymethod(1).id).toBeUndefined()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('the first Save creates the record disabled, then saves the changes on it, with no toast', async () => {
    writes['POST /business/7/paymethods'] = { error: false, result: { id: 40, paymethod_id: 1, enabled: false, sandbox: false } }
    writes['PUT /business/7/paymethods/40'] = { error: false, result: { id: 40, paymethod_id: 1, sites: [3] } }
    draw()
    await settle()
    let response
    await act(async () => { response = await ui.handleCreatePaymethodOnSave(1, { sites: [3], allowed_order_types: [1] }) })
    expect(response).toMatchObject({ ok: true })
    const posts = requests('POST')
    expect(posts).toHaveLength(1)
    expect(posts[0][0]).toBe('https://api.test/business/7/paymethods')
    expect(body(posts[0])).toEqual({ enabled: false, paymethod_id: 1, sandbox: false })
    const puts = requests('PUT')
    expect(puts).toHaveLength(1)
    expect(puts[0][0]).toBe('https://api.test/business/7/paymethods/40')
    expect(body(puts[0])).toEqual({ sites: '[3]', allowed_order_types: '[1]' })
    expect(mocks.showToast).not.toHaveBeenCalled()
    // the list has the new record
    expect(ui.businessPaymethodsState.paymethods.find(item => item.paymethod_id === 1)).toMatchObject({ id: 40 })
  })

  it('a Save with nothing changed only creates the record', async () => {
    writes['POST /business/7/paymethods'] = { error: false, result: { id: 40, paymethod_id: 1 } }
    draw()
    await settle()
    let response
    await act(async () => { response = await ui.handleCreatePaymethodOnSave(1, {}) })
    expect(response).toMatchObject({ ok: true })
    expect(requests('POST')).toHaveLength(1)
    expect(requests('PUT')).toHaveLength(0)
  })

  it('a create that fails answers its error and saves nothing else', async () => {
    writes['POST /business/7/paymethods'] = { error: true, result: ['Nope'] }
    draw()
    await settle()
    let response
    await act(async () => { response = await ui.handleCreatePaymethodOnSave(1, { sandbox: true }) })
    expect(response).toEqual({ ok: false, error: ['Nope'] })
    expect(requests('PUT')).toHaveLength(0)
    expect(mocks.showToast).not.toHaveBeenCalled()
  })

  it('Stripe Connect saves its gateway part and its fees as its own Save does', async () => {
    writes['POST /business/7/paymethods'] = { error: false, result: { id: 41, paymethod_id: 5 } }
    draw()
    await settle()
    let response
    await act(async () => { response = await ui.handleCreatePaymethodOnSave(5, { sandbox: false, extra: { fixed_usage_fee: '2' } }, { stripeConnect: true }) })
    expect(response).toEqual({ ok: true })
    const puts = requests('PUT')
    expect(puts).toHaveLength(1)
    expect(puts[0][0]).toBe('https://api.test/business/7/paymethods/41')
    const posts = requests('POST')
    expect(posts).toHaveLength(2)
    expect(posts[1][0]).toBe('https://api.test/business/7')
    expect(body(posts[1])).toEqual({ fixed_usage_fee: '2' })
  })
})
