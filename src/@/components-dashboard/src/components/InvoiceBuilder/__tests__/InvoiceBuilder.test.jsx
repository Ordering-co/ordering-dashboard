/* eslint-disable import/first */
import React from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// redesign invoice FA (D5, D6, D7, auditor 1, 3, 4): the controller of /intelligence/invoice.
// Fake timers: the 400 ms wait between a change and the orders request is part of the contract.

const session = vi.hoisted(() => ({ value: null }))
const ordering = vi.hoisted(() => ({ value: null }))
const configState = vi.hoisted(() => ({ value: null }))
const translate = vi.hoisted(() => (key, fallback) => fallback)

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [session.value] }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [ordering.value] }))
vi.mock('../../../contexts/ConfigContext', () => ({ useConfig: () => [{ configs: configState.value }] }))
vi.mock('../../../contexts/LanguageContext', () => ({ useLanguage: () => [{}, translate] }))

import { InvoiceBuilder } from '..'
import { businessOrdersWhere, driverOrdersWhere, filterBusinessOrders } from '../../../utils/invoiceMath'
import {
  BUSINESS,
  CONFIGS,
  DRIVER,
  ORDERS,
  PAYMETHODS_API,
  ROOT,
  idsOf
} from '../../../utils/__tests__/fixtures/invoiceOrders'

const BUSINESS_2 = { id: 8, name: 'Burger Barn' }
// redesign (D-23): the clock of every test is 2026-10-20, so «Last month» is September 2026
const LAST_MONTH = { from: '2026-09-01', to: '2026-09-30' }
const PAGINATION = (page, totalPages = 2) => ({ current_page: page, page_size: 10, total_pages: totalPages, total: 11 })

const state = {
  /** What the orders request answers; may return a promise. */
  ordersAnswer: null,
  /** What the paymethods request answers. */
  paymethodsAnswer: null,
  calls: { orders: [], users: [], businesses: [], fetch: [] }
}

const okOrders = (result = ORDERS, pagination = { total: result.length }) => ({ content: { error: false, result, pagination } })

const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((_resolve, _reject) => {
    resolve = _resolve
    reject = _reject
  })
  return { promise, resolve, reject }
}

const makeOrdersChain = () => {
  const chain = {
    asDashboard: () => chain,
    where: (where) => {
      chain.recordedWhere = where
      return chain
    },
    get: (options) => {
      const call = { where: chain.recordedWhere, options, cancel: vi.fn() }
      // the SDK puts `cancel` on the token it is given (Ordering.makeRequest)
      if (options?.cancelToken && typeof options.cancelToken === 'object') options.cancelToken.cancel = call.cancel
      state.calls.orders.push(call)
      return Promise.resolve(state.ordersAnswer(call))
    }
  }
  return chain
}

const makeUsersChain = () => {
  const call = {}
  const chain = {
    asDashboard: () => chain,
    select: (fields) => {
      call.select = fields
      return chain
    },
    where: (where) => {
      call.where = where
      return chain
    },
    get: async () => {
      state.calls.users.push(call)
      return { content: { error: false, result: [{ ...DRIVER, level: 4 }], pagination: { total: 1 } } }
    }
  }
  return chain
}

const makeBusinessesChain = () => {
  const call = {}
  const chain = {
    asDashboard: () => chain,
    select: (fields) => {
      call.select = fields
      return chain
    },
    where: (where) => {
      call.where = where
      return chain
    },
    get: async (options) => {
      call.options = options
      state.calls.businesses.push(call)
      return { content: { error: false, result: [BUSINESS], pagination: PAGINATION(1, 1) } }
    }
  }
  return chain
}

const json = (body) => Promise.resolve({ json: async () => body })

const fetchMock = (url, options) => {
  state.calls.fetch.push({ url, options })
  if (url.includes('/backoffice/businesses')) {
    const page = Number(new URL(url).searchParams.get('page'))
    return json({ error: false, result: page === 2 ? [BUSINESS_2] : [BUSINESS], pagination: PAGINATION(page || 1) })
  }
  if (url.endsWith('/paymethods')) return state.paymethodsAnswer()
  return json({ error: true, result: ['unexpected url ' + url] })
}

const urls = () => state.calls.fetch.map(call => call.url)

const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0) })
const advance = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
const run = (fn) => act(async () => { fn() })

// redesign (D-23): the form starts on «Last month»; the tests of main's requests and sums choose «All dates» first, as a user
// can, so every order of the fixture counts. `{ period: 'default' }` keeps the period the form starts with.
const mount = async (props = {}, { period = 'all' } = {}) => {
  const ui = { current: null }
  const UIComponent = (uiProps) => {
    ui.current = uiProps
    return null
  }
  render(<InvoiceBuilder kind='business' UIComponent={UIComponent} {...props} />)
  await flush()
  if (period === 'all') await run(() => ui.current.setPeriod('', ''))
  return ui
}

/** Mounted, with the business chosen and its orders loaded. */
const mountLoaded = async (props = {}) => {
  const ui = await mount(props)
  await run(() => ui.current.party.select(props.kind === 'driver' ? DRIVER : BUSINESS))
  await advance(400)
  await flush()
  return ui
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 20, 12))
  state.calls = { orders: [], users: [], businesses: [], fetch: [] }
  state.ordersAnswer = () => okOrders()
  state.paymethodsAnswer = () => json({ error: false, result: PAYMETHODS_API })
  session.value = { token: 'token-1', loading: false, user: { id: 1, level: 0 } }
  ordering.value = { root: ROOT, orders: makeOrdersChain, users: makeUsersChain, businesses: makeBusinessesChain }
  configState.value = CONFIGS
  vi.stubGlobal('fetch', vi.fn(fetchMock))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('InvoiceBuilder: business, what it asks on mount', () => {
  it('asks the businesses and the paymethods with the URLs of main, and nothing else', async () => {
    const ui = await mount()
    expect(urls()).toEqual([
      `${ROOT}/backoffice/businesses?params=id,name&page=1&page_size=10`,
      `${ROOT}/paymethods`
    ])
    expect(state.calls.fetch[0].options.headers.Authorization).toBe('Bearer token-1')
    expect(state.calls.fetch[1].options.method).toBe('GET')
    expect(state.calls.orders).toHaveLength(0)
    expect(ui.current.party).toMatchObject({ kind: 'business', items: [BUSINESS], loading: false, error: null, page: 1, totalPages: 2, search: '', selected: null })
    expect(ui.current.payMethods.items).toEqual([
      { id: 1, name: 'Cash', gateway: 'cash', checked: true },
      { id: 2, name: 'Card', gateway: 'stripe', checked: true },
      { id: 3, name: 'PayPal', gateway: 'paypal', checked: true },
      { id: 5, name: 'Apple Pay', gateway: 'apple_pay', checked: true }
    ])
    expect(ui.current.orderTypes.items.map(item => [item.value, item.checked])).toEqual([[1, true], [2, true], [3, true]])
    expect(ui.current.orders).toMatchObject({ status: 'idle', blocked: 'no_party', truncated: null })
    expect(ui.current.invoice).toBeNull()
    expect(ui.current.canDownload).toBe(false)
  })

  it('the form starts with the defaults of main, the period apart: «Last month» (D-23)', async () => {
    const ui = await mount({}, { period: 'default' })
    expect(ui.current.kind).toBe('business')
    expect(ui.current.form).toEqual({
      type: 'charge',
      ...LAST_MONTH,
      cancelled: false,
      discounts: false,
      notes: '',
      percentage_fee: 0,
      fixed_fee: 0,
      tax: 0,
      misc_amount: 0,
      misc_description: ''
    })
  })

  it('a user that is not level 0 asks the businesses through the SDK, with propsToFetch name', async () => {
    session.value = { token: 'token-1', loading: false, user: { id: 2, level: 2 } }
    const ui = await mount()
    expect(state.calls.businesses).toHaveLength(1)
    expect(state.calls.businesses[0].select).toEqual(['name'])
    expect(state.calls.businesses[0].options).toEqual({ query: { page: 1, page_size: 10 } })
    expect(urls()).toEqual([`${ROOT}/paymethods`])
    expect(ui.current.party.items).toEqual([BUSINESS])
  })

  it('waits for the session before asking (main gave up on a session that was still loading)', async () => {
    session.value = { token: null, loading: true, user: null }
    await mount()
    expect(state.calls.fetch).toHaveLength(0)
  })

  it('search goes back to page 1 with the ilike where of main; goToPage keeps the search', async () => {
    const ui = await mount()
    await run(() => ui.current.party.setSearch('  piz '))
    await flush()
    const where = '{"conditions":[{"attribute":"name","value":{"condition":"ilike","value":"%25piz%25"}}],"conector":"AND"}'
    expect(urls()[2]).toBe(`${ROOT}/backoffice/businesses?params=id,name&page=1&page_size=10&where=${where}`)
    expect(ui.current.party.search).toBe('piz')
    await run(() => ui.current.party.goToPage(2))
    await flush()
    expect(urls()[3]).toBe(`${ROOT}/backoffice/businesses?params=id,name&page=2&page_size=10&where=${where}`)
    expect(ui.current.party.items).toEqual([BUSINESS_2])
    expect(ui.current.party.page).toBe(2)
  })

  it('the chosen business keeps its name after the list changes page (D8 of main)', async () => {
    const ui = await mountLoaded()
    expect(ui.current.invoice.business).toEqual(BUSINESS)
    await run(() => ui.current.party.goToPage(2))
    await flush()
    expect(ui.current.party.items).toEqual([BUSINESS_2])
    expect(ui.current.party.selected).toEqual(BUSINESS)
    expect(ui.current.invoice.business).toEqual(BUSINESS)
    await run(() => ui.current.party.setSearch('burger'))
    await flush()
    expect(ui.current.invoice.business.name).toBe('Pizza Palace')
  })
})

describe('InvoiceBuilder: business, when it asks the orders (D5)', () => {
  it('without a business it asks nothing; choosing one asks once after 400 ms with the where of main', async () => {
    const ui = await mount()
    await advance(2000)
    expect(state.calls.orders).toHaveLength(0)
    await run(() => ui.current.party.select({ id: BUSINESS.id, name: BUSINESS.name }))
    expect(ui.current.orders.blocked).toBeNull()
    await advance(399)
    expect(state.calls.orders).toHaveLength(0)
    await advance(1)
    await flush()
    expect(state.calls.orders).toHaveLength(1)
    // all methods and all types checked: neither paymethod_id nor delivery_type goes to the server
    expect(state.calls.orders[0].where).toEqual(businessOrdersWhere({ businessId: 7, from: '', to: '', deliveryTypeIds: [], paymethodIds: [] }))
    expect(state.calls.orders[0].where).toEqual([{ attribute: 'business_id', value: 7 }])
    expect(ui.current.orders.status).toBe('ready')
    expect(idsOf(ui.current.orders.raw)).toEqual(idsOf(ORDERS))
    expect(idsOf(ui.current.invoice.orders)).toEqual([101, 102, 103, 104, 106, 107, 108, 110])
    expect(ui.current.canDownload).toBe(true)
    expect(ui.current.updating).toBe(false)
  })

  it('with the period it starts with, the first request asks the orders of last month (D-23)', async () => {
    const ui = await mount({}, { period: 'default' })
    await run(() => ui.current.party.select(BUSINESS))
    await advance(400)
    await flush()
    expect(state.calls.orders).toHaveLength(1)
    expect(state.calls.orders[0].where).toEqual(businessOrdersWhere({ businessId: 7, ...LAST_MONTH, deliveryTypeIds: [], paymethodIds: [] }))
  })

  it('asks the orders with the dates of the period', async () => {
    const ui = await mount()
    await run(() => ui.current.setPeriod('2026-09-01', '2026-09-30'))
    await run(() => ui.current.party.select(BUSINESS))
    await advance(400)
    await flush()
    expect(state.calls.orders).toHaveLength(1)
    expect(state.calls.orders[0].where).toEqual(businessOrdersWhere({ businessId: 7, from: '2026-09-01', to: '2026-09-30', deliveryTypeIds: [], paymethodIds: [] }))
    expect(ui.current.form).toMatchObject({ from: '2026-09-01', to: '2026-09-30' })
    expect(idsOf(ui.current.invoice.orders)).toEqual([101, 102, 103, 104, 106, 107, 110])
  })

  it('unchecking a method adds paymethod_id with the checked ones; unchecking all of them removes it', async () => {
    const ui = await mountLoaded()
    expect(state.calls.orders).toHaveLength(1)
    await run(() => ui.current.payMethods.toggle(2))
    expect(ui.current.payMethods.items.find(item => item.id === 2).checked).toBe(false)
    await advance(400)
    await flush()
    expect(state.calls.orders).toHaveLength(2)
    expect(state.calls.orders[1].where).toEqual(businessOrdersWhere({ businessId: 7, from: '', to: '', deliveryTypeIds: [], paymethodIds: [1, 3, 5] }))
    await run(() => ui.current.payMethods.setAll(false))
    await advance(400)
    await flush()
    expect(state.calls.orders).toHaveLength(3)
    expect(state.calls.orders[2].where).toEqual([{ attribute: 'business_id', value: 7 }])
    // with none checked no order passes (D1 fixed, main kept the ones with payment events)
    expect(idsOf(ui.current.invoice.orders)).toEqual([])
    // checking them all again is the same where as with none checked: nothing new to ask, the client filter is read again
    await run(() => ui.current.payMethods.setAll(true))
    await advance(2000)
    await flush()
    expect(state.calls.orders).toHaveLength(3)
    expect(ui.current.canDownload).toBe(true)
    expect(idsOf(ui.current.invoice.orders)).toEqual([101, 102, 103, 104, 106, 107, 108, 110])
  })

  it('unchecking an order type sends delivery_type with the checked values', async () => {
    const ui = await mountLoaded()
    await run(() => ui.current.orderTypes.toggle(2))
    await advance(400)
    await flush()
    expect(state.calls.orders).toHaveLength(2)
    expect(state.calls.orders[1].where).toEqual(businessOrdersWhere({ businessId: 7, from: '', to: '', deliveryTypeIds: [1, 3], paymethodIds: [] }))
    expect(idsOf(ui.current.invoice.orders)).toEqual([101, 103, 104, 106, 107, 108, 110])
  })

  it('no order type checked: blocked no_order_types, no request, an invoice with 0 orders that can be downloaded, as in main', async () => {
    const ui = await mountLoaded()
    await run(() => ui.current.orderTypes.setAll(false))
    await advance(2000)
    await flush()
    expect(state.calls.orders).toHaveLength(1)
    expect(ui.current.orders.blocked).toBe('no_order_types')
    expect(ui.current.invoice.orders).toEqual([])
    expect(ui.current.invoice.orders_subtotal).toBe(0)
    expect(ui.current.orders.status).toBe('ready')
    expect(ui.current.canDownload).toBe(true)
    // checking them again goes back to the invoice already loaded, with no new request
    await run(() => ui.current.orderTypes.setAll(true))
    await advance(2000)
    await flush()
    expect(state.calls.orders).toHaveLength(1)
    expect(ui.current.orders.blocked).toBeNull()
    expect(ui.current.canDownload).toBe(true)
    expect(ui.current.invoice.orders).toHaveLength(8)
  })

  it('cancelled, discounts, type, fees, tax, misc and notes recalculate the invoice and ask nothing', async () => {
    const ui = await mountLoaded()
    const before = ui.current.invoice
    expect(before.total).toBe(0)
    await run(() => ui.current.setField('percentage_fee', '10'))
    expect(ui.current.form.percentage_fee).toBe('10')
    expect(ui.current.invoice.percentage_fee_total).toBeCloseTo(33.9, 10)
    expect(ui.current.invoice.total).toBeCloseTo(33.9, 10)
    await run(() => ui.current.setField('fixed_fee', 2))
    await run(() => ui.current.setField('tax', 10))
    await run(() => ui.current.setField('misc_amount', 5))
    await run(() => ui.current.setField('misc_description', 'Setup'))
    await run(() => ui.current.setField('notes', 'a <b>\nb'))
    await run(() => ui.current.setField('discounts', true))
    await run(() => ui.current.setField('type', 'payout'))
    await run(() => ui.current.setField('cancelled', true))
    expect(idsOf(ui.current.invoice.orders)).toEqual([101, 102, 103, 104, 105, 106, 107, 108, 110])
    expect(ui.current.invoice.type).toBe('payout')
    expect(ui.current.invoice.notes).toBe('a &lt;b&gt;<br>b')
    expect(ui.current.invoice.misc_amount).toBe(-5)
    await advance(2000)
    await flush()
    expect(state.calls.orders).toHaveLength(1)
    expect(ui.current.canDownload).toBe(true)
  })

  it('an empty tax is 0 and the total stays a number (D4)', async () => {
    const ui = await mountLoaded()
    await run(() => ui.current.setField('percentage_fee', 10))
    await run(() => ui.current.setField('tax', ''))
    expect(Number.isFinite(ui.current.invoice.total)).toBe(true)
    expect(ui.current.invoice.total).toBeCloseTo(33.9, 10)
  })

  it('two changes in a row ask once', async () => {
    const ui = await mountLoaded()
    await run(() => ui.current.setPeriod('2026-09-01', '2026-09-30'))
    await advance(200)
    await run(() => ui.current.payMethods.toggle(1))
    await advance(399)
    expect(state.calls.orders).toHaveLength(1)
    await advance(1)
    await flush()
    expect(state.calls.orders).toHaveLength(2)
    expect(state.calls.orders[1].where).toEqual(businessOrdersWhere({
      businessId: 7, from: '2026-09-01', to: '2026-09-30', deliveryTypeIds: [], paymethodIds: [2, 3, 5]
    }))
  })

  it('changing the business and changing back before the wait ends asks nothing', async () => {
    const ui = await mountLoaded()
    await run(() => ui.current.party.select(BUSINESS_2))
    await advance(200)
    await run(() => ui.current.party.select(BUSINESS))
    await advance(2000)
    await flush()
    expect(state.calls.orders).toHaveLength(1)
    expect(ui.current.canDownload).toBe(true)
  })

  it('a response that arrives late is discarded, and the older request is cancelled when the SDK allows it', async () => {
    const answers = []
    state.ordersAnswer = () => {
      const answer = deferred()
      answers.push(answer)
      return answer.promise
    }
    const ui = await mount()
    await run(() => ui.current.party.select(BUSINESS))
    await advance(400)
    expect(state.calls.orders).toHaveLength(1)
    expect(ui.current.orders.status).toBe('loading')
    expect(ui.current.invoice).toBeNull()
    await run(() => ui.current.setPeriod('2026-09-01', '2026-09-30'))
    await advance(400)
    expect(state.calls.orders).toHaveLength(2)
    expect(state.calls.orders[0].cancel).toHaveBeenCalledTimes(1)
    expect(state.calls.orders[1].cancel).not.toHaveBeenCalled()
    await act(async () => { answers[1].resolve(okOrders([ORDERS[0]])) })
    await flush()
    expect(idsOf(ui.current.orders.raw)).toEqual([101])
    await act(async () => { answers[0].resolve(okOrders(ORDERS)) })
    await flush()
    expect(idsOf(ui.current.orders.raw)).toEqual([101])
    expect(idsOf(ui.current.invoice.orders)).toEqual([101])
    expect(ui.current.canDownload).toBe(true)
  })

  it('canDownload is false while it waits and while it loads, and updating shows the older data', async () => {
    const answers = []
    const ui = await mountLoaded()
    expect(ui.current.canDownload).toBe(true)
    expect(ui.current.updating).toBe(false)
    state.ordersAnswer = () => {
      const answer = deferred()
      answers.push(answer)
      return answer.promise
    }
    await run(() => ui.current.setPeriod('2026-09-01', '2026-09-30'))
    // the wait
    expect(ui.current.canDownload).toBe(false)
    expect(ui.current.updating).toBe(true)
    expect(ui.current.invoice).not.toBeNull()
    await advance(400)
    // the load
    expect(ui.current.orders.status).toBe('loading')
    expect(ui.current.canDownload).toBe(false)
    expect(ui.current.updating).toBe(true)
    expect(ui.current.invoice).not.toBeNull()
    await act(async () => { answers[0].resolve(okOrders()) })
    await flush()
    expect(ui.current.canDownload).toBe(true)
    expect(ui.current.updating).toBe(false)
  })

  it('an error keeps the older invoice, blocks the download and retry() asks again', async () => {
    const ui = await mountLoaded()
    expect(ui.current.invoice).not.toBeNull()
    state.ordersAnswer = () => ({ content: { error: true, result: ['Server said no'] } })
    await run(() => ui.current.setPeriod('2026-09-01', '2026-09-30'))
    await advance(400)
    await flush()
    expect(ui.current.orders.status).toBe('error')
    expect(ui.current.orders.error).toEqual(['Server said no'])
    // the older orders stay on screen (read again with the new period), but they cannot be downloaded
    expect(idsOf(ui.current.invoice.orders)).toEqual([101, 102, 103, 104, 106, 107, 110])
    expect(ui.current.canDownload).toBe(false)
    expect(ui.current.updating).toBe(false)
    state.ordersAnswer = () => okOrders([ORDERS[0], ORDERS[1]])
    await run(() => ui.current.orders.retry())
    await flush()
    expect(state.calls.orders).toHaveLength(3)
    expect(state.calls.orders[2].where).toEqual(state.calls.orders[1].where)
    expect(ui.current.orders.status).toBe('ready')
    expect(ui.current.orders.error).toBeNull()
    expect(idsOf(ui.current.invoice.orders)).toEqual([101, 102])
    expect(ui.current.canDownload).toBe(true)
  })

  it('a request that throws is an error too, and with no data yet there is no invoice', async () => {
    state.ordersAnswer = () => { throw new Error('network down') }
    const ui = await mountLoaded()
    expect(ui.current.orders.status).toBe('error')
    expect(ui.current.orders.error).toBeTruthy()
    expect(ui.current.invoice).toBeNull()
    expect(ui.current.canDownload).toBe(false)
  })

  it('truncated is {received, total} when the server has more orders than it sent (D6)', async () => {
    state.ordersAnswer = () => okOrders(ORDERS, { total: 500, current_page: 1 })
    const ui = await mountLoaded()
    expect(ui.current.orders.truncated).toEqual({ received: ORDERS.length, total: 500 })
    state.ordersAnswer = () => okOrders(ORDERS, { total: ORDERS.length })
    await run(() => ui.current.setPeriod('2026-09-01', '2026-09-30'))
    await advance(400)
    await flush()
    expect(ui.current.orders.truncated).toBeNull()
  })

  it('without the paymethods or the config it is blocked as setup and asks no orders', async () => {
    state.paymethodsAnswer = () => json({ error: true, result: ['No paymethods'] })
    const ui = await mount()
    await run(() => ui.current.party.select(BUSINESS))
    await advance(2000)
    expect(ui.current.payMethods.error).toEqual(['No paymethods'])
    expect(ui.current.orders.blocked).toBe('setup')
    expect(state.calls.orders).toHaveLength(0)
    expect(ui.current.invoice).toBeNull()
    expect(ui.current.canDownload).toBe(false)
    state.paymethodsAnswer = () => json({ error: false, result: PAYMETHODS_API })
    await run(() => ui.current.payMethods.retry())
    await flush()
    expect(ui.current.payMethods.error).toBeNull()
    expect(ui.current.payMethods.items).toHaveLength(4)
    expect(ui.current.orders.blocked).toBeNull()
    await advance(400)
    await flush()
    expect(state.calls.orders).toHaveLength(1)
  })

  // D22 fixed: main offered no type without order_types_allowed, so the invoice billed 0 orders
  it('without order_types_allowed every order type is offered and checked, and it is not blocked', async () => {
    const { order_types_allowed: _omit, ...withoutTypes } = CONFIGS
    configState.value = withoutTypes
    const ui = await mountLoaded()
    expect(ui.current.orderTypes.items.map(item => [item.value, item.checked])).toEqual([[1, true], [2, true], [3, true], [4, true], [5, true]])
    expect(ui.current.orders.blocked).toBeNull()
    expect(ui.current.invoice.orders.length).toBeGreaterThan(0)
  })

  it('no config yet: blocked as setup', async () => {
    configState.value = {}
    const ui = await mount()
    await run(() => ui.current.party.select(BUSINESS))
    await advance(2000)
    expect(ui.current.orders.blocked).toBe('setup')
    expect(state.calls.orders).toHaveLength(0)
  })

  // redesign invoice R2 (P4): a project with no enabled payment method is not a failed setup; main calculated with the empty list
  it('with no payment method enabled it is not blocked: it asks and calculates with the empty list, as main (R2 P4)', async () => {
    state.paymethodsAnswer = () => json({ error: false, result: [] })
    const ui = await mount()
    await run(() => ui.current.party.select(BUSINESS))
    await advance(400)
    await flush()
    expect(ui.current.payMethods).toMatchObject({ error: null, loading: false, items: [] })
    expect(ui.current.orders.blocked).toBeNull()
    expect(state.calls.orders).toHaveLength(1)
    expect(ui.current.invoice).not.toBeNull()
    expect(idsOf(ui.current.invoice.orders)).toEqual(idsOf(filterBusinessOrders({ orders: ORDERS, form: ui.current.form, payMethods: [], orderTypes: ui.current.orderTypes.items })))
    expect(Number.isFinite(ui.current.invoice.total)).toBe(true)
    expect(ui.current.canDownload).toBe(true)
  })

  it('the same for a driver with no payment method enabled (R2 P4)', async () => {
    state.paymethodsAnswer = () => json({ error: false, result: [] })
    const ui = await mount({ kind: 'driver' })
    await run(() => ui.current.party.select(DRIVER))
    await advance(400)
    await flush()
    expect(ui.current.orders.blocked).toBeNull()
    expect(state.calls.orders).toHaveLength(1)
    expect(ui.current.invoice).not.toBeNull()
  })

  it('an error of /paymethods is still a blocked setup, with the error and a retry for the preview to show (R2 P4)', async () => {
    state.paymethodsAnswer = () => Promise.reject(new Error('offline'))
    const ui = await mount()
    await run(() => ui.current.party.select(BUSINESS))
    await advance(2000)
    expect(ui.current.orders.blocked).toBe('setup')
    expect(ui.current.payMethods.error).toBeTruthy()
    expect(typeof ui.current.payMethods.retry).toBe('function')
    expect(state.calls.orders).toHaveLength(0)
  })
})

describe('InvoiceBuilder: driver', () => {
  it('asks the drivers and the driver managers (levels 4 and 5, row 2), id and name, and the paymethods, and starts with «Last month» (D-23)', async () => {
    const ui = await mount({ kind: 'driver' }, { period: 'default' })
    expect(state.calls.users).toHaveLength(1)
    expect(state.calls.users[0].select).toEqual(['id', 'name'])
    expect(state.calls.users[0].where).toEqual([{ attribute: 'level', value: [4, 5] }])
    expect(urls()).toEqual([`${ROOT}/paymethods`])
    expect(ui.current.kind).toBe('driver')
    expect(ui.current.form).toEqual({
      ...LAST_MONTH,
      cancelled: false,
      notes: '',
      percentage_fee: 0,
      fixed_fee: 0,
      percentage_delivery_price: 0,
      percentage_driver_tip: 0,
      tax: 0,
      misc_amount: 0,
      misc_description: ''
    })
    expect(ui.current.party).toMatchObject({ kind: 'driver', items: [DRIVER], loading: false, error: null, selected: null })
    expect(ui.current.payMethods.items.map(item => item.id)).toEqual([1, 2, 3, 5])
    expect(ui.current.orderTypes).toBeNull()
    expect(ui.current.orders).toMatchObject({ status: 'idle', blocked: 'no_party' })
  })

  it('choosing a driver asks once after 400 ms with a where that carries driver_id', async () => {
    const ui = await mountLoaded({ kind: 'driver' })
    expect(state.calls.orders).toHaveLength(1)
    expect(state.calls.orders[0].where).toEqual(driverOrdersWhere({ driverId: 9, from: '', to: '', paymethodIds: [] }))
    expect(state.calls.orders[0].where).toEqual([{ attribute: 'driver_id', value: 9 }])
    expect(idsOf(ui.current.invoice.orders)).toEqual([101, 102, 106, 107, 108, 109])
    expect(ui.current.invoice.driver).toEqual(DRIVER)
    expect(ui.current.canDownload).toBe(true)
  })

  it('a method unchecked sends paymethod_id; the fees recalculate with no request', async () => {
    const ui = await mountLoaded({ kind: 'driver' })
    await run(() => ui.current.payMethods.toggle(3))
    await advance(400)
    await flush()
    expect(state.calls.orders).toHaveLength(2)
    expect(state.calls.orders[1].where).toEqual(driverOrdersWhere({ driverId: 9, from: '', to: '', paymethodIds: [1, 2, 5] }))
    await run(() => ui.current.setField('percentage_delivery_price', '50'))
    await run(() => ui.current.setField('misc_amount', ''))
    await advance(2000)
    expect(state.calls.orders).toHaveLength(2)
    expect(Number.isFinite(ui.current.invoice.total)).toBe(true)
    expect(ui.current.invoice.percentage_delivery_price).toBe(50)
  })

  it('with a wallet enabled the status, method and cancelled filters still run (D2 fixed, ; main counted every order)', async () => {
    configState.value = { ...CONFIGS, wallet_cash_enabled: { value: '1' } }
    const ui = await mountLoaded({ kind: 'driver' })
    expect(idsOf(ui.current.invoice.orders)).toEqual([101, 102, 106, 107, 108, 109])
  })
})
