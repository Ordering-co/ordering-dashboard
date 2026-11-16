/* eslint-disable import/first */
// redesign F6i-3 (A3-03): a failed refund tells the UI where the failure came from (`errorSource: 'refund'`) and how far the
// request got (`errorKind`), so one surface renders it; the refund flow shows no «Loading» toast. The refund calls
// (URL, payload) are main's and stay as they were.
import React from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({ showToast: vi.fn(), ui: null }))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', loading: false }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test/v400/en/demo', project: 'demo', appInternalName: 'dashboard' }]
}))
vi.mock('../../../contexts/WebsocketContext', () => ({ useWebsocket: () => ({ on: vi.fn(), off: vi.fn() }) }))
vi.mock('../../../contexts/EventContext', () => ({ useEvent: () => [{ on: vi.fn(), off: vi.fn() }] }))
vi.mock('../../../contexts/LanguageContext', () => ({ useLanguage: () => [null, (_key, fallback) => fallback] }))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [null, { showToast: runtime.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/UtilsContext', () => ({ useUtils: () => [{ parsePrice: value => String(value) }] }))
vi.mock('../../../contexts/ConfigContext', () => ({ useConfig: () => [{ configs: {} }] }))

import { OrderDetails } from '../index'

const order = {
  id: 42,
  uuid: 'uuid-42',
  business_id: 7,
  total: 80,
  paymethod: { gateway: 'stripe_connect' },
  payment_events: []
}

const UI = (props) => { runtime.ui = props; return null }

const mount = (orderPatch = {}) => render(
  <OrderDetails
    UIComponent={UI}
    orderId={42}
    isDisableLoadMessages
    order={{ ...order, ...orderPatch }}
  />
)

const fetchMock = vi.fn()

beforeEach(() => {
  runtime.showToast.mockReset()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

const loadingToasts = () => runtime.showToast.mock.calls.filter(([, text]) => text === 'Loading')

describe('OrderDetails controller · the refund of the payment fails', () => {
  it('without an answer (the network is down) it says so: refund source, no answer', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    mount()
    await act(async () => { await runtime.ui.handleRefundPaymentsStripe() })
    expect(runtime.ui.actionStatus).toMatchObject({ loading: false, error: ['Failed to fetch'], errorSource: 'refund', errorKind: 'network' })
    expect(loadingToasts()).toHaveLength(0)
    expect(runtime.showToast).not.toHaveBeenCalled()
  })

  it('an aborted request is the same: no answer', async () => {
    fetchMock.mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'))
    mount()
    await act(async () => { await runtime.ui.handleRefundPaymentsStripe() })
    expect(runtime.ui.actionStatus).toMatchObject({ errorSource: 'refund', errorKind: 'network' })
  })

  it('with an API error it keeps what the API said and marks it as the API\'s answer', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ error: true, result: ['Order already refunded'] }) })
    mount()
    await act(async () => { await runtime.ui.handleRefundPaymentsStripe() })
    expect(runtime.ui.actionStatus).toMatchObject({ loading: false, error: ['Order already refunded'], errorSource: 'refund', errorKind: 'api' })
    expect(loadingToasts()).toHaveLength(0)
  })

  it('an answer that cannot be read is told apart: the refund may have been sent', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => { throw new SyntaxError('Unexpected token <') } })
    mount()
    await act(async () => { await runtime.ui.handleRefundPaymentsStripe() })
    expect(runtime.ui.actionStatus).toMatchObject({ loading: false, errorSource: 'refund', errorKind: 'unreadable' })
  })

  it('a new attempt clears the previous error and a success leaves none', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    mount()
    await act(async () => { await runtime.ui.handleRefundPaymentsStripe() })
    expect(runtime.ui.actionStatus.error).toEqual(['Failed to fetch'])
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ error: false, result: 'refunded' }) })
    await act(async () => { await runtime.ui.handleRefundPaymentsStripe() })
    expect(runtime.ui.actionStatus).toMatchObject({ loading: false, error: null })
    expect(runtime.showToast).toHaveBeenCalledWith('success', 'Order refunded')
  })

  it('sends the same request as main', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ error: false, result: 'refunded' }) })
    mount()
    await act(async () => { await runtime.ui.handleRefundPaymentsStripe() })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.test/v400/en/demo/payments/stripe/refund')
    expect(options.method).toBe('POST')
    expect(options.headers).toEqual({ Authorization: 'Bearer test-token', 'Content-Type': 'application/json' })
    expect(JSON.parse(options.body)).toEqual({ order_id: 42, business_id: 7, gateway: 'stripe_connect' })
  })
})

describe('OrderDetails controller · the refund to a wallet fails', () => {
  it('marks the refund source and how far the request got, with no «Loading» toast', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    mount()
    await act(async () => { await runtime.ui.handleOrderRefund({ order_payment_event_id: 3 }) })
    expect(runtime.ui.actionStatus).toMatchObject({ loading: false, error: ['Failed to fetch'], errorSource: 'refund', errorKind: 'network', refundTarget: 'wallet' })
    expect(loadingToasts()).toHaveLength(0)
  })

  it('an API error keeps what the API said', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ error: true, result: ['Not enough funds'] }) })
    mount()
    await act(async () => { await runtime.ui.handleOrderRefund({}) })
    expect(runtime.ui.actionStatus).toMatchObject({ error: ['Not enough funds'], errorSource: 'refund', errorKind: 'api', refundTarget: 'wallet' })
  })
})

describe('OrderDetails controller · the refund through a plugin fails', () => {
  const plugin = { paymethod: { gateway: 'credibanco' } }

  it('without an answer: refund source, no answer, no «Loading» toast', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    mount(plugin)
    await act(async () => { await runtime.ui.handleRefundPaymentsPlugin() })
    expect(runtime.ui.actionStatus).toMatchObject({ loading: false, error: ['Failed to fetch'], errorSource: 'refund', errorKind: 'network' })
    expect(loadingToasts()).toHaveLength(0)
  })

  it('an HTTP error status is an answer that cannot be used', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => ({}) })
    mount(plugin)
    await act(async () => { await runtime.ui.handleRefundPaymentsPlugin() })
    expect(runtime.ui.actionStatus).toMatchObject({ errorSource: 'refund', errorKind: 'unreadable' })
  })

  it('an error of the provider is its answer', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ error: true, result: { message: 'Card declined' } }) })
    mount(plugin)
    await act(async () => { await runtime.ui.handleRefundPaymentsPlugin() })
    expect(runtime.ui.actionStatus).toMatchObject({ error: ['Card declined'], errorSource: 'refund', errorKind: 'api' })
  })
})
