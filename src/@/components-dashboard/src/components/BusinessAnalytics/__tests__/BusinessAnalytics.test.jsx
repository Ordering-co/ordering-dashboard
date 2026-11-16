/* eslint-disable import/first */
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// redesign bi FA1 (D2, D6, D10, BI-07, BI-08, BI-21, auditor 1, 2, 3, 8): the controller of /intelligence/business

const ROOT = 'https://api.test/v400/en/dev'
const session = vi.hoisted(() => ({ value: null }))
const ordering = vi.hoisted(() => ({ value: null }))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [session.value] }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [ordering.value] }))

import { periodOf } from '../../../utils/businessReports'
import { BusinessAnalytics } from '..'
import { normalizeTimezone } from '../../../utils'

// "Now" is Friday 2026-10-09 15:30 local time
const NOW = new Date(2026, 9, 9, 15, 30)
const TZ = normalizeTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)

const REPORT_TYPES = [
  'orders', 'sales', 'top_selling', 'top_categories', 'orders_status', 'users',
  'customer_satisfaction', 'orders_accept_spend', 'arrived_pickup_spend', 'order_location'
]
const BLOCK_PROPS = [
  'ordersList', 'salesList', 'topProductList', 'topCategoryList', 'orderStatusList', 'registerUsersList',
  'customerSatisfactionList', 'ordersAcceptSpendList', 'arrivedPickUpSpendList', 'orderLocationList'
]

// orders and sales are asked without the cancelled orders, after the filters
const withoutCancelled = (type) => (type === 'orders' || type === 'sales' ? '&exclude_cancelled=1' : '')
const urlOf = (type, lapse = 'today', extra = '') => `${ROOT}/reports/${type}?lapse=${lapse}&timezone=${TZ}${extra}${withoutCancelled(type)}`
// the body of an API that applied `exclude_cancelled`
const excluded = (result) => ({ error: false, result, exclude_cancelled: true })
const mainUrls = (lapse = 'today', extra = '') => REPORT_TYPES.map(type => urlOf(type, lapse, extra))

const DEFAULTS = {
  orders: [{ time: '2026-10-09 10:00:00', orders: 2 }, { time: '2026-10-09 12:00:00', orders: 1 }],
  sales: [{ time: '2026-10-09 10:00:00', sales: 50 }, { time: '2026-10-09 12:00:00', sales: 42.5 }],
  users: [{ time: '2026-10-09 10:00:00', users: 4 }],
  top_selling: [{ name: 'Pizza', sales: 3 }],
  top_categories: [{ name: 'Food', sales: 3 }],
  orders_status: [{ status: 7, orders: 2 }],
  customer_satisfaction: { 1: '0.00', 2: '0.00', 3: '0.00', 4: '1.00', 5: '4.00' },
  orders_accept_spend: '20704.95',
  arrived_pickup_spend: 600,
  order_location: [{ lat: 1, lng: 2 }]
}

const state = { reports: {}, fetch: null }

/** Entry of `state.reports` by `type|lapse`, then by `type`; a function may answer with a promise or throw. */
const answer = async (url) => {
  const parsed = new URL(url)
  const type = parsed.pathname.split('/').pop()
  const lapse = parsed.searchParams.get('lapse')
  const key = [`${type}|${lapse}`, type].find(candidate => candidate in state.reports)
  let entry = key === undefined ? DEFAULTS[type] : state.reports[key]
  if (typeof entry === 'function') entry = await entry(url)
  const isEnvelope = entry && typeof entry === 'object' && !Array.isArray(entry) && 'error' in entry
  const body = isEnvelope ? entry : { error: false, result: entry }
  return { json: async () => body }
}

const deferred = () => {
  let resolve
  const promise = new Promise((_resolve) => { resolve = _resolve })
  return { promise, resolve }
}

const calls = () => state.fetch.mock.calls.map(([url]) => url)

const renderController = async ({ wait = true, props = {} } = {}) => {
  const ui = { current: null, renders: [] }
  const UIComponent = (uiProps) => {
    ui.current = uiProps
    ui.renders.push(uiProps)
    return null
  }
  const view = render(<BusinessAnalytics UIComponent={UIComponent} {...props} />)
  ui.view = view
  ui.element = <BusinessAnalytics UIComponent={UIComponent} {...props} />
  if (wait) await settle(ui)
  return ui
}

const settle = async (ui) => {
  await waitFor(() => {
    BLOCK_PROPS.forEach(prop => expect(ui.current[prop].loading).toBe(false))
    expect(ui.current.comparison.loading).toBe(false)
  })
}

const change = async (ui, next, options) => {
  await act(async () => { ui.current.handleChangeFilterList(next, options) })
}

describe('BusinessAnalytics · requests', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    session.value = { token: 'tok', loading: false }
    ordering.value = { root: ROOT }
    state.reports = {}
    state.fetch = vi.fn(answer)
    vi.stubGlobal('fetch', state.fetch)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('the first render has every block loading, and the filters keep the shape and defaults of main', async () => {
    const ui = await renderController({ wait: false })
    const first = ui.renders[0]
    BLOCK_PROPS.forEach((prop) => {
      expect(first[prop].loading).toBe(true)
      expect(first[prop].error).toBeNull()
    })
    expect(first.filterList).toEqual({
      lapse: 'today', businessIds: null, app_id: 'all', franchises_id: null, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    })
    expect(first.countryCode).toBe('')
    expect(typeof first.handleChangeCode).toBe('function')
    await settle(ui)
  })

  it('the initial load asks the 10 reports with the exact URLs of main, in the same order', async () => {
    await renderController()
    expect(calls().slice(0, 10)).toEqual(mainUrls())
    expect(calls().slice(0, 10)).toEqual([
      `${ROOT}/reports/orders?lapse=today&timezone=${TZ}&exclude_cancelled=1`,
      `${ROOT}/reports/sales?lapse=today&timezone=${TZ}&exclude_cancelled=1`,
      `${ROOT}/reports/top_selling?lapse=today&timezone=${TZ}`,
      `${ROOT}/reports/top_categories?lapse=today&timezone=${TZ}`,
      `${ROOT}/reports/orders_status?lapse=today&timezone=${TZ}`,
      `${ROOT}/reports/users?lapse=today&timezone=${TZ}`,
      `${ROOT}/reports/customer_satisfaction?lapse=today&timezone=${TZ}`,
      `${ROOT}/reports/orders_accept_spend?lapse=today&timezone=${TZ}`,
      `${ROOT}/reports/arrived_pickup_spend?lapse=today&timezone=${TZ}`,
      `${ROOT}/reports/order_location?lapse=today&timezone=${TZ}`
    ])
  })

  it('sends the token like main', async () => {
    await renderController()
    expect(state.fetch.mock.calls[0][1]).toEqual({
      method: 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' }
    })
  })

  it('fills each block with its result, and the locations also under `locations`', async () => {
    const ui = await renderController()
    expect(ui.current.ordersList).toEqual({ loading: false, data: DEFAULTS.orders, error: null })
    expect(ui.current.customerSatisfactionList.data).toEqual(DEFAULTS.customer_satisfaction)
    expect(ui.current.ordersAcceptSpendList.data).toBe('20704.95')
    expect(ui.current.orderLocationList.locations).toEqual(DEFAULTS.order_location)
    expect(ui.current.orderLocationList.loading).toBe(false)
  })

  it('builds the filter parameters in the order of main: businesses, app_id, franchises_id', async () => {
    const ui = await renderController()
    state.fetch.mockClear()
    await change(ui, { ...ui.current.filterList, businessIds: [1, 2], app_id: 5, franchises_id: [3] })
    await settle(ui)
    const extra = `&businesses=1,2&app_id=5&franchises_id=${JSON.stringify([3])}`
    expect(calls().slice(0, 10)).toEqual(mainUrls('today', extra))
  })

  it('skips the filters that are empty: app_id «all» or null, no businesses, no franchises', async () => {
    const ui = await renderController()
    state.fetch.mockClear()
    await change(ui, { ...ui.current.filterList, businessIds: [], app_id: null, franchises_id: [] })
    await settle(ui)
    expect(calls().slice(0, 10)).toEqual(mainUrls('today'))
  })

  it('a filter change asks every report once, and the pills change at once', async () => {
    const ui = await renderController()
    state.fetch.mockClear()
    await change(ui, { ...ui.current.filterList, lapse: 'yesterday' })
    expect(ui.current.filterList.lapse).toBe('yesterday')
    await settle(ui)
    const made = calls()
    mainUrls('yesterday').forEach(url => expect(made.filter(item => item === url)).toHaveLength(1))
    // yesterday compares with the 4 reports of the day before (orders_status since ), nothing else
    expect(made).toHaveLength(14)
  })

  it('a filter change that is a function receives the current filters', async () => {
    const ui = await renderController()
    state.fetch.mockClear()
    await change(ui, (current) => ({ ...current, lapse: 'last_7_days' }))
    expect(ui.current.filterList.lapse).toBe('last_7_days')
    await settle(ui)
    expect(calls().slice(0, 10)).toEqual(mainUrls('last_7_days'))
  })

  it('with debounce two changes within 600 ms ask once, 600 ms after the last', async () => {
    const ui = await renderController()
    state.fetch.mockClear()
    vi.useRealTimers()
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    vi.setSystemTime(NOW)
    await change(ui, { ...ui.current.filterList, businessIds: [1] }, { debounce: true })
    expect(ui.current.filterList.businessIds).toEqual([1])
    await act(async () => { await vi.advanceTimersByTimeAsync(400) })
    await change(ui, { ...ui.current.filterList, businessIds: [1, 2] }, { debounce: true })
    expect(ui.current.filterList.businessIds).toEqual([1, 2])
    await act(async () => { await vi.advanceTimersByTimeAsync(599) })
    expect(state.fetch).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(calls().slice(0, 10)).toEqual(mainUrls('today', '&businesses=1,2'))
    expect(calls().filter(url => url.includes('/reports/orders?lapse=today'))).toHaveLength(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(calls().filter(url => url.includes('/reports/orders?lapse=today'))).toHaveLength(1)
  })

  it('a change without debounce after a pending one applies the latest filters at once, and the timer asks nothing more', async () => {
    const ui = await renderController()
    state.fetch.mockClear()
    vi.useRealTimers()
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    vi.setSystemTime(NOW)
    await change(ui, { ...ui.current.filterList, businessIds: [1] }, { debounce: true })
    await change(ui, { ...ui.current.filterList, lapse: 'yesterday' })
    expect(calls().slice(0, 10)).toEqual(mainUrls('yesterday', '&businesses=1'))
    const before = calls().length
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(calls()).toHaveLength(before)
  })

  it('a slow response of the previous load never overwrites the new one (BI-21)', async () => {
    const slow = deferred()
    state.reports['orders|today'] = () => slow.promise
    const ui = await renderController({ wait: false })
    await waitFor(() => expect(ui.current.salesList.loading).toBe(false))
    expect(ui.current.ordersList.loading).toBe(true)

    state.reports['orders|yesterday'] = [{ time: '2026-10-08 10:00:00', orders: 7 }]
    await change(ui, { ...ui.current.filterList, lapse: 'yesterday' })
    await waitFor(() => expect(ui.current.ordersList.loading).toBe(false))
    expect(ui.current.ordersList.data).toEqual([{ time: '2026-10-08 10:00:00', orders: 7 }])

    await act(async () => { slow.resolve([{ time: '2026-10-09 10:00:00', orders: 999 }]) })
    await act(async () => { await Promise.resolve() })
    expect(ui.current.ordersList.data).toEqual([{ time: '2026-10-08 10:00:00', orders: 7 }])
    expect(ui.current.ordersList.loading).toBe(false)
  })

  it('a slow error of the previous load does not paint an error on the new data', async () => {
    const slow = deferred()
    state.reports['sales|today'] = () => slow.promise
    const ui = await renderController({ wait: false })
    await waitFor(() => expect(ui.current.ordersList.loading).toBe(false))
    await change(ui, { ...ui.current.filterList, lapse: 'yesterday' })
    await waitFor(() => expect(ui.current.salesList.loading).toBe(false))
    await act(async () => { slow.resolve({ error: true, result: ['old'] }) })
    await act(async () => { await Promise.resolve() })
    expect(ui.current.salesList.error).toBeNull()
    expect(ui.current.salesList.data).toEqual(DEFAULTS.sales)
  })

  it('a failing report leaves its block with an error and empty data, the others intact; reloadBlock asks only that one (BI-07)', async () => {
    state.reports.sales = { error: true, result: ['Sales are down'] }
    const ui = await renderController()
    expect(ui.current.salesList).toEqual({ loading: false, data: [], error: ['Sales are down'] })
    expect(ui.current.ordersList.error).toBeNull()
    expect(ui.current.ordersList.data).toEqual(DEFAULTS.orders)
    expect(ui.current.registerUsersList.error).toBeNull()

    const hold = deferred()
    state.reports.sales = () => hold.promise
    state.fetch.mockClear()
    await act(async () => { ui.current.reloadBlock('sales') })
    expect(ui.current.salesList.loading).toBe(true)
    await act(async () => { hold.resolve([{ time: '2026-10-09 10:00:00', sales: 9 }]) })
    await waitFor(() => expect(ui.current.salesList.loading).toBe(false))
    expect(calls()).toEqual([urlOf('sales')])
    expect(ui.current.salesList).toEqual({ loading: false, data: [{ time: '2026-10-09 10:00:00', sales: 9 }], error: null })
    expect(ui.current.ordersList.data).toEqual(DEFAULTS.orders)
  })

  it('a rejected request (network) is a block error with empty data', async () => {
    state.reports.users = () => { throw new Error('offline') }
    const ui = await renderController()
    expect(ui.current.registerUsersList.loading).toBe(false)
    expect(ui.current.registerUsersList.data).toEqual([])
    expect(ui.current.registerUsersList.error).toBeInstanceOf(Error)
    expect(ui.current.registerUsersList.error.message).toBe('offline')
  })

  it('a failing locations report leaves empty locations', async () => {
    state.reports.order_location = { error: true, result: ['nope'] }
    const ui = await renderController()
    expect(ui.current.orderLocationList.error).toEqual(['nope'])
    expect(ui.current.orderLocationList.locations).toEqual([])
  })

  it('reloadBlock accepts every block and ignores an unknown one', async () => {
    const ui = await renderController()
    state.fetch.mockClear()
    await act(async () => { ui.current.reloadBlock('nonsense') })
    expect(state.fetch).not.toHaveBeenCalled()
    await act(async () => { ui.current.reloadBlock('orderLocation') })
    await waitFor(() => expect(ui.current.orderLocationList.loading).toBe(false))
    expect(calls()).toEqual([urlOf('order_location')])
  })

  it('asks nothing while the session loads, and asks when it finishes', async () => {
    session.value = { token: null, loading: true }
    const ui = await renderController({ wait: false })
    await act(async () => { await Promise.resolve() })
    expect(state.fetch).not.toHaveBeenCalled()
    BLOCK_PROPS.forEach(prop => expect(ui.current[prop].loading).toBe(true))

    session.value = { token: 'tok', loading: false }
    ui.view.rerender(ui.element)
    await settle(ui)
    expect(calls().slice(0, 10)).toEqual(mainUrls())
    expect(calls().filter(url => url.includes('/reports/orders?'))).toHaveLength(2)
    expect(state.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer tok')
  })

  it('a response that arrives after unmounting writes nothing and breaks nothing', async () => {
    const slow = deferred()
    state.reports.orders = () => slow.promise
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const ui = await renderController({ wait: false })
    await waitFor(() => expect(ui.current.salesList.loading).toBe(false))
    const rendersBefore = ui.renders.length
    ui.view.unmount()
    await act(async () => { slow.resolve([{ time: '2026-10-09 10:00:00', orders: 5 }]) })
    await act(async () => { await Promise.resolve() })
    expect(ui.renders).toHaveLength(rendersBefore)
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
  })

  it('the country code toggles like main', async () => {
    const ui = await renderController()
    await act(async () => { ui.current.handleChangeCode('ES') })
    expect(ui.current.countryCode).toBe('ES')
    await act(async () => { ui.current.handleChangeCode('MX') })
    expect(ui.current.countryCode).toBe('MX')
    await act(async () => { ui.current.handleChangeCode('MX') })
    expect(ui.current.countryCode).toBe('')
  })

  it('passes its own props through to the UI', async () => {
    const ui = await renderController({ props: { custom: 'x' } })
    expect(ui.current.custom).toBe('x')
  })
})

describe('BusinessAnalytics · totals and period', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    session.value = { token: 'tok', loading: false }
    ordering.value = { root: ROOT }
    state.reports = {}
    state.fetch = vi.fn(answer)
    vi.stubGlobal('fetch', state.fetch)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('derives the six figures from the blocks, and nulls while they load', async () => {
    const ui = await renderController({ wait: false })
    expect(ui.renders[0].totals).toEqual({
      orders: null, ordersBase: 'includesCancelled', sales: null, users: null, averageTicket: null, acceptSeconds: null, pickupSeconds: null
    })
    await settle(ui)
    expect(ui.current.totals).toEqual({
      orders: 3, ordersBase: 'includesCancelled', sales: 92.5, users: 4, averageTicket: 92.5 / 3, acceptSeconds: 20704.95, pickupSeconds: 600
    })
  })

  // (tanda AK, AK-282): a figure and its comparison share a base. Today compares «by now», which has no breakdown by
  // status, so its orders keep the cancelled ones; a whole period leaves them out with `orders_status`. The ticket keeps them.
  it('today keeps the cancelled orders in the orders figure, and says so in its base', async () => {
    state.reports['orders_status|today'] = [{ status: 7, orders: 1 }, { status: 2, orders: 2 }]
    const ui = await renderController()
    expect(ui.current.totals.ordersBase).toBe('includesCancelled')
    expect(ui.current.totals.orders).toBe(3)
  })

  it('a whole period leaves the cancelled orders out of the orders figure, but not out of the average ticket', async () => {
    state.reports['orders|yesterday'] = [{ time: '2026-10-08 10:00:00', orders: 6 }]
    state.reports['sales|yesterday'] = [{ time: '2026-10-08 10:00:00', sales: 120 }]
    // 2, 5, 6, 10, 12, 16 and 17 are the cancelled family
    state.reports['orders_status|yesterday'] = [{ status: 11, orders: 3 }, { status: 2, orders: 1 }, { status: 17, orders: 1 }, { status: 7, orders: 1 }]
    const ui = await renderController()
    await change(ui, { ...ui.current.filterList, lapse: 'yesterday' })
    await settle(ui)
    expect(ui.current.totals.ordersBase).toBe('excludesCancelled')
    expect(ui.current.totals.orders).toBe(4)
    expect(ui.current.totals.averageTicket).toBe(20)
  })

  // review AK-R1: the base followed the filters at once, while the figures still came from the previous period, and the page keeps
  // that mixed figure on screen while the new one loads. Every render pairs a figure with the base of the period it was asked for.
  it('changing the period never pairs the figures of one period with the base of the other', async () => {
    const ordersYesterday = deferred()
    state.reports['orders|yesterday'] = () => ordersYesterday.promise
    state.reports['orders_status|today'] = [{ status: 2, orders: 1 }]
    const ui = await renderController()
    expect(ui.current.totals).toMatchObject({ orders: 3, ordersBase: 'includesCancelled' })
    const before = ui.renders.length
    await change(ui, { ...ui.current.filterList, lapse: 'yesterday' })
    await act(async () => { ordersYesterday.resolve([{ time: '2026-10-08 10:00:00', orders: 6 }]) })
    await settle(ui)
    const shown = ui.renders.slice(before).map(render => render.totals).filter(totals => totals.orders !== null)
    shown.forEach(totals => {
      if (totals.orders === 3) expect(totals.ordersBase).toBe('includesCancelled')
      else expect(totals).toMatchObject({ orders: 6, ordersBase: 'excludesCancelled' })
    })
    expect(ui.current.totals).toMatchObject({ orders: 6, ordersBase: 'excludesCancelled' })
  })

  it('a whole period without its statuses has no orders figure: it cannot tell the cancelled ones', async () => {
    state.reports['orders_status|yesterday'] = { error: true, result: ['x'] }
    const ui = await renderController()
    await change(ui, { ...ui.current.filterList, lapse: 'yesterday' })
    await settle(ui)
    expect(ui.current.totals.orders).toBeNull()
    expect(ui.current.totals.averageTicket).not.toBeNull()
  })

  // the tests above are an API that ignores `exclude_cancelled` (deployed before it). One that applied it says so, and its
  // orders and sales are the figures as they come: no subtraction of the statuses, «by now» included, and the ticket in that base
  it('an API that left the cancelled orders out: today the orders figure excludes them, without subtracting the statuses', async () => {
    state.reports['orders|today'] = excluded(DEFAULTS.orders)
    state.reports['sales|today'] = excluded(DEFAULTS.sales)
    state.reports['orders_status|today'] = [{ status: 7, orders: 1 }, { status: 2, orders: 2 }]
    const ui = await renderController()
    expect(ui.current.ordersList.excludesCancelled).toBe(true)
    expect(ui.current.salesList.excludesCancelled).toBe(true)
    expect(ui.current.totals).toMatchObject({ orders: 3, ordersBase: 'excludesCancelled', sales: 92.5, averageTicket: 92.5 / 3 })
  })

  it('an API that left the cancelled orders out: a whole period does not subtract them again, nor needs the statuses', async () => {
    state.reports['orders|yesterday'] = excluded([{ time: '2026-10-08 10:00:00', orders: 4 }])
    state.reports['sales|yesterday'] = excluded([{ time: '2026-10-08 10:00:00', sales: 100 }])
    state.reports['orders_status|yesterday'] = { error: true, result: ['x'] }
    const ui = await renderController()
    await change(ui, { ...ui.current.filterList, lapse: 'yesterday' })
    await settle(ui)
    expect(ui.current.totals).toMatchObject({ orders: 4, ordersBase: 'excludesCancelled', sales: 100, averageTicket: 25 })
  })

  it('an API that ignores the parameter leaves the blocks without the mark', async () => {
    const ui = await renderController()
    expect(ui.current.ordersList.excludesCancelled).toBeUndefined()
    expect(ui.current.salesList.excludesCancelled).toBeUndefined()
  })

  it('orders and sales in different bases give no average ticket', async () => {
    state.reports['orders|today'] = excluded(DEFAULTS.orders)
    const ui = await renderController()
    expect(ui.current.totals.orders).toBe(3)
    expect(ui.current.totals.averageTicket).toBeNull()
  })

  it('a block with an error gives a null figure; the others stay', async () => {
    state.reports.sales = { error: true, result: ['x'] }
    const ui = await renderController()
    expect(ui.current.totals.sales).toBeNull()
    expect(ui.current.totals.averageTicket).toBeNull()
    expect(ui.current.totals.orders).toBe(3)
  })

  it('the average ticket is null without orders, and no time is null (never 0)', async () => {
    state.reports.orders = []
    state.reports.sales = []
    state.reports.orders_accept_spend = []
    state.reports.arrived_pickup_spend = null
    const ui = await renderController()
    expect(ui.current.totals.orders).toBe(0)
    expect(ui.current.totals.sales).toBe(0)
    expect(ui.current.totals.averageTicket).toBeNull()
    expect(ui.current.totals.acceptSeconds).toBeNull()
    expect(ui.current.totals.pickupSeconds).toBeNull()
  })

  it('a duration of 0 seconds is a real 0', async () => {
    state.reports.orders_accept_spend = 0
    const ui = await renderController()
    expect(ui.current.totals.acceptSeconds).toBe(0)
  })

  it('gives the period of the lapse so the UI can name the dates and pick the granularity', async () => {
    const ui = await renderController()
    expect(ui.current.period).toEqual({ from: '2026-10-09', to: '2026-10-09', days: 1, includesToday: true, granularity: 'hour' })
    await change(ui, { ...ui.current.filterList, lapse: 'last_30_days' })
    expect(ui.current.period).toEqual({ from: '2026-09-09', to: '2026-10-09', days: 31, includesToday: true, granularity: 'day' })
    await settle(ui)
  })
})

describe('BusinessAnalytics · comparison (D2, auditor 1)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    session.value = { token: 'tok', loading: false }
    ordering.value = { root: ROOT }
    state.reports = {}
    state.fetch = vi.fn(answer)
    vi.stubGlobal('fetch', state.fetch)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const comparisonUrls = () => calls().slice(10)

  it('starts loading, with no plan yet', async () => {
    const ui = await renderController({ wait: false })
    expect(ui.renders[0].comparison.loading).toBe(true)
    expect(ui.renders[0].comparison.error).toBeNull()
    await settle(ui)
  })

  it('today: 2 GET of yesterday, summed up to the current hour, and no percentage', async () => {
    state.reports['orders|2026-10-08,2026-10-08'] = [
      { time: '2026-10-08 10:00:00', orders: 1 },
      { time: '2026-10-08 16:00:00', orders: 4 },
      { time: '2026-10-08 17:00:00', orders: 8 },
      { time: '2026-10-09 00:00:00', orders: 16 }
    ]
    state.reports['sales|2026-10-08,2026-10-08'] = [
      { time: '2026-10-08 10:00:00', sales: 10 },
      { time: '2026-10-08 16:00:00', sales: 40 },
      { time: '2026-10-08 17:00:00', sales: 80 }
    ]
    const ui = await renderController()
    expect(comparisonUrls()).toEqual([urlOf('orders', '2026-10-08,2026-10-08'), urlOf('sales', '2026-10-08,2026-10-08')])
    const { comparison } = ui.current
    expect(comparison.plan).toEqual({ mode: 'byNow', previous: '2026-10-08,2026-10-08', hour: 15 })
    // 16:00 closes the hour that starts at 15, the current one
    expect(comparison.previous).toEqual({ orders: 5, sales: 50, users: null, averageTicket: 10 }) // redesign bi integration (D2): the ticket of yesterday by this time, 50 / 5
    expect(comparison.current).toBeNull()
    expect(comparison.change).toEqual({ orders: null, sales: null, users: null, averageTicket: null })
    expect(comparison.error).toBeNull()
  })

  it('yesterday: 4 GET of the day before, percentage against the blocks', async () => {
    state.reports['orders|yesterday'] = [{ time: '2026-10-08 10:00:00', orders: 6 }]
    state.reports['sales|yesterday'] = [{ time: '2026-10-08 10:00:00', sales: 150 }]
    state.reports['users|yesterday'] = [{ time: '2026-10-08 10:00:00', users: 8 }]
    state.reports['orders|2026-10-07,2026-10-07'] = [{ time: '2026-10-07 10:00:00', orders: 4 }]
    state.reports['sales|2026-10-07,2026-10-07'] = [{ time: '2026-10-07 10:00:00', sales: 100 }]
    state.reports['users|2026-10-07,2026-10-07'] = [{ time: '2026-10-07 10:00:00', users: 16 }]
    const ui = await renderController()
    state.fetch.mockClear()
    await change(ui, { ...ui.current.filterList, lapse: 'yesterday' })
    await settle(ui)
    expect(comparisonUrls()).toEqual([
      urlOf('orders', '2026-10-07,2026-10-07'),
      urlOf('sales', '2026-10-07,2026-10-07'),
      urlOf('users', '2026-10-07,2026-10-07'),
      urlOf('orders_status', '2026-10-07,2026-10-07')
    ])
    const { comparison } = ui.current
    expect(comparison.plan).toEqual({ mode: 'previous', previous: '2026-10-07,2026-10-07', days: 1 })
    expect(comparison.current).toBeNull()
    expect(comparison.previous).toEqual({ orders: 4, sales: 100, users: 16, averageTicket: 25 })
    expect(comparison.change.orders).toBe(50)
    expect(comparison.change.sales).toBe(50)
    expect(comparison.change.users).toBe(-50)
    expect(comparison.change.averageTicket).toBe(0)
  })

  // (AK-282): the period compared with has the same base as the figure, and the ticket the same base as before
  it('yesterday: the previous day also leaves its cancelled orders out, so the change compares the same thing', async () => {
    state.reports['orders|yesterday'] = [{ time: '2026-10-08 10:00:00', orders: 6 }]
    state.reports['orders_status|yesterday'] = [{ status: 11, orders: 4 }, { status: 5, orders: 2 }]
    state.reports['orders|2026-10-07,2026-10-07'] = [{ time: '2026-10-07 10:00:00', orders: 5 }]
    state.reports['sales|2026-10-07,2026-10-07'] = [{ time: '2026-10-07 10:00:00', sales: 100 }]
    state.reports['orders_status|2026-10-07,2026-10-07'] = [{ status: 11, orders: 2 }, { status: 6, orders: 3 }]
    const ui = await renderController()
    await change(ui, { ...ui.current.filterList, lapse: 'yesterday' })
    await settle(ui)
    const { comparison } = ui.current
    expect(comparison.previous.orders).toBe(2)
    expect(comparison.previous.averageTicket).toBe(20) // 100 / 5: sales carry the cancelled orders, so the ticket counts them
    expect(ui.current.totals.orders).toBe(4)
    expect(comparison.change.orders).toBe(100)
  })

  // the period compared with comes from the same API: when it left the cancelled orders out, nothing is subtracted
  it('yesterday with an API that left the cancelled orders out: the previous day is not subtracted either', async () => {
    state.reports['orders|yesterday'] = excluded([{ time: '2026-10-08 10:00:00', orders: 4 }])
    state.reports['sales|yesterday'] = excluded([{ time: '2026-10-08 10:00:00', sales: 100 }])
    state.reports['orders|2026-10-07,2026-10-07'] = excluded([{ time: '2026-10-07 10:00:00', orders: 2 }])
    state.reports['sales|2026-10-07,2026-10-07'] = excluded([{ time: '2026-10-07 10:00:00', sales: 40 }])
    state.reports['orders_status|2026-10-07,2026-10-07'] = [{ status: 11, orders: 2 }, { status: 6, orders: 3 }]
    const ui = await renderController()
    await change(ui, { ...ui.current.filterList, lapse: 'yesterday' })
    await settle(ui)
    const { comparison } = ui.current
    expect(comparison.previous).toMatchObject({ orders: 2, sales: 40, averageTicket: 20 })
    expect(comparison.change.orders).toBe(100)
    expect(comparison.change.averageTicket).toBe(25)
  })

  // (review): mixed answers never compare a figure with one in the other base: its previous figure and change are null
  it('yesterday: sales marked against a previous day that is not, no previous sales, ticket or change for them; orders still compare', async () => {
    state.reports['orders|yesterday'] = excluded([{ time: '2026-10-08 10:00:00', orders: 4 }])
    state.reports['sales|yesterday'] = excluded([{ time: '2026-10-08 10:00:00', sales: 100 }])
    state.reports['orders|2026-10-07,2026-10-07'] = [{ time: '2026-10-07 10:00:00', orders: 5 }]
    state.reports['sales|2026-10-07,2026-10-07'] = [{ time: '2026-10-07 10:00:00', sales: 40 }]
    state.reports['orders_status|2026-10-07,2026-10-07'] = [{ status: 11, orders: 2 }, { status: 6, orders: 3 }]
    const ui = await renderController()
    await change(ui, { ...ui.current.filterList, lapse: 'yesterday' })
    await settle(ui)
    const { comparison } = ui.current
    expect(comparison.previous).toEqual({ orders: 2, sales: null, users: 4, averageTicket: null })
    expect(comparison.change.orders).toBe(100)
    expect(comparison.change.sales).toBeNull()
    expect(comparison.change.averageTicket).toBeNull()
  })

  it('a period whose orders came marked and sales did not has no ticket', async () => {
    state.reports['orders|2026-10-07,2026-10-07'] = excluded([{ time: '2026-10-07 10:00:00', orders: 2 }])
    state.reports['sales|2026-10-07,2026-10-07'] = [{ time: '2026-10-07 10:00:00', sales: 40 }]
    const ui = await renderController()
    await change(ui, { ...ui.current.filterList, lapse: 'yesterday' })
    await settle(ui)
    expect(ui.current.comparison.previous.averageTicket).toBeNull()
  })

  it('today: marked orders on screen against yesterday by now unmarked, no previous orders', async () => {
    state.reports['orders|today'] = excluded(DEFAULTS.orders)
    state.reports['sales|today'] = excluded(DEFAULTS.sales)
    state.reports['orders|2026-10-08,2026-10-08'] = [{ time: '2026-10-08 10:00:00', orders: 1 }]
    state.reports['sales|2026-10-08,2026-10-08'] = excluded([{ time: '2026-10-08 10:00:00', sales: 10 }])
    const ui = await renderController()
    const { previous } = ui.current.comparison
    expect(previous.orders).toBeNull()
    expect(previous.sales).toBe(10)
    expect(previous.averageTicket).toBeNull()
  })

  it('last 7 days: closed days marked against the 7 before unmarked, no previous sales nor change', async () => {
    state.reports['orders|2026-10-02,2026-10-08'] = excluded([{ time: '2026-10-05 00:00:00', orders: 30 }])
    state.reports['sales|2026-10-02,2026-10-08'] = excluded([{ time: '2026-10-05 00:00:00', sales: 300 }])
    state.reports['orders|2026-09-25,2026-10-01'] = [{ time: '2026-09-28 00:00:00', orders: 20 }]
    state.reports['sales|2026-09-25,2026-10-01'] = [{ time: '2026-09-28 00:00:00', sales: 400 }]
    const ui = await renderController()
    await change(ui, { ...ui.current.filterList, lapse: 'last_7_days' })
    await settle(ui)
    const { comparison } = ui.current
    expect(comparison.current).toMatchObject({ orders: 30, sales: 300, averageTicket: 10 })
    expect(comparison.previous).toMatchObject({ orders: 20, sales: null, averageTicket: null })
    expect(comparison.change).toMatchObject({ orders: 50, sales: null, averageTicket: null })
  })

  it('a previous of 0 gives no percentage', async () => {
    state.reports['orders|2026-10-07,2026-10-07'] = []
    const ui = await renderController()
    await change(ui, { ...ui.current.filterList, lapse: 'yesterday' })
    await settle(ui)
    expect(ui.current.comparison.previous.orders).toBe(0)
    expect(ui.current.comparison.change.orders).toBeNull()
  })

  it('last_7_days: 8 GET, 7 closed days against the 7 before, percentage between them', async () => {
    state.reports['orders|2026-10-02,2026-10-08'] = [{ time: '2026-10-05 00:00:00', orders: 30 }]
    state.reports['sales|2026-10-02,2026-10-08'] = [{ time: '2026-10-05 00:00:00', sales: 300 }]
    state.reports['users|2026-10-02,2026-10-08'] = [{ time: '2026-10-05 00:00:00', users: 9 }]
    state.reports['orders|2026-09-25,2026-10-01'] = [{ time: '2026-09-28 00:00:00', orders: 20 }]
    state.reports['sales|2026-09-25,2026-10-01'] = [{ time: '2026-09-28 00:00:00', sales: 400 }]
    state.reports['users|2026-09-25,2026-10-01'] = [{ time: '2026-09-28 00:00:00', users: 3 }]
    const ui = await renderController()
    state.fetch.mockClear()
    await change(ui, { ...ui.current.filterList, lapse: 'last_7_days' })
    await settle(ui)
    expect(comparisonUrls()).toEqual([
      urlOf('orders', '2026-10-02,2026-10-08'),
      urlOf('sales', '2026-10-02,2026-10-08'),
      urlOf('users', '2026-10-02,2026-10-08'),
      urlOf('orders_status', '2026-10-02,2026-10-08'),
      urlOf('orders', '2026-09-25,2026-10-01'),
      urlOf('sales', '2026-09-25,2026-10-01'),
      urlOf('users', '2026-09-25,2026-10-01'),
      urlOf('orders_status', '2026-09-25,2026-10-01')
    ])
    const { comparison } = ui.current
    expect(comparison.plan).toEqual({
      mode: 'closed', current: '2026-10-02,2026-10-08', previous: '2026-09-25,2026-10-01', days: 7
    })
    expect(comparison.current).toEqual({ orders: 30, sales: 300, users: 9, averageTicket: 10 })
    expect(comparison.previous).toEqual({ orders: 20, sales: 400, users: 3, averageTicket: 20 })
    expect(comparison.change.orders).toBe(50)
    expect(comparison.change.sales).toBe(-25)
    expect(comparison.change.users).toBe(200)
    expect(comparison.change.averageTicket).toBe(-50)
  })

  it('last_30_days asks the exact lapses of the audit: 09 Sep – 08 Oct against 10 Aug – 08 Sep', async () => {
    const ui = await renderController()
    state.fetch.mockClear()
    await change(ui, { ...ui.current.filterList, lapse: 'last_30_days' })
    await settle(ui)
    expect(comparisonUrls().map(url => new URL(url).searchParams.get('lapse'))).toEqual([
      '2026-09-09,2026-10-08', '2026-09-09,2026-10-08', '2026-09-09,2026-10-08', '2026-09-09,2026-10-08',
      '2026-08-10,2026-09-08', '2026-08-10,2026-09-08', '2026-08-10,2026-09-08', '2026-08-10,2026-09-08'
    ])
  })

  it('a custom range in the past compares with the same number of days before', async () => {
    const ui = await renderController()
    state.fetch.mockClear()
    await change(ui, { ...ui.current.filterList, lapse: '2026-09-01,2026-09-10' })
    await settle(ui)
    expect(mainUrls('2026-09-01,2026-09-10').every(url => calls().includes(url))).toBe(true)
    expect(comparisonUrls().map(url => new URL(url).searchParams.get('lapse'))).toEqual([
      '2026-08-22,2026-08-31', '2026-08-22,2026-08-31', '2026-08-22,2026-08-31', '2026-08-22,2026-08-31'
    ])
  })

  it('a range of more than 31 days keeps the previous figures but gives no percentage', async () => {
    state.reports['orders|2026-01-01,2026-10-08'] = [{ time: '2026-03-01 00:00:00', orders: 100 }]
    state.reports['orders|2025-03-26,2025-12-31'] = [{ time: '2025-05-01 00:00:00', orders: 50 }]
    const ui = await renderController()
    state.fetch.mockClear()
    await change(ui, { ...ui.current.filterList, lapse: '2026-01-01,2026-10-09' })
    await settle(ui)
    const { comparison } = ui.current
    expect(comparison.plan.mode).toBe('closed')
    expect(comparison.previous.orders).toBe(50)
    expect(comparison.current.orders).toBe(100)
    expect(comparison.change).toEqual({ orders: null, sales: null, users: null, averageTicket: null })
  })

  it('uses the same filters and time zone as the main load', async () => {
    const ui = await renderController()
    state.fetch.mockClear()
    await change(ui, { ...ui.current.filterList, lapse: 'yesterday', businessIds: [4], app_id: 2, franchises_id: [9] })
    await settle(ui)
    const extra = `&businesses=4&app_id=2&franchises_id=${JSON.stringify([9])}`
    expect(comparisonUrls()).toEqual([
      urlOf('orders', '2026-10-07,2026-10-07', extra),
      urlOf('sales', '2026-10-07,2026-10-07', extra),
      urlOf('users', '2026-10-07,2026-10-07', extra),
      urlOf('orders_status', '2026-10-07,2026-10-07', extra)
    ])
  })

  it('a failing comparison leaves the blocks alone and reloadComparison asks it again', async () => {
    state.reports['sales|2026-10-08,2026-10-08'] = { error: true, result: ['no comparison'] }
    const ui = await renderController()
    expect(ui.current.comparison.error).toEqual(['no comparison'])
    expect(ui.current.comparison.loading).toBe(false)
    expect(ui.current.comparison.previous).toEqual({ orders: null, sales: null, users: null, averageTicket: null })
    expect(ui.current.comparison.change).toEqual({ orders: null, sales: null, users: null, averageTicket: null })
    BLOCK_PROPS.forEach(prop => expect(ui.current[prop].error).toBeNull())
    expect(ui.current.ordersList.data).toEqual(DEFAULTS.orders)

    const hold = deferred()
    state.reports['sales|2026-10-08,2026-10-08'] = () => hold.promise
    state.fetch.mockClear()
    await act(async () => { ui.current.reloadComparison() })
    expect(ui.current.comparison.loading).toBe(true)
    await act(async () => { hold.resolve(DEFAULTS.sales) })
    await waitFor(() => expect(ui.current.comparison.loading).toBe(false))
    expect(calls()).toEqual([urlOf('orders', '2026-10-08,2026-10-08'), urlOf('sales', '2026-10-08,2026-10-08')])
    expect(ui.current.comparison.error).toBeNull()
  })

  it('a failing block does not touch the comparison', async () => {
    state.reports['orders|today'] = { error: true, result: ['x'] }
    const ui = await renderController()
    expect(ui.current.ordersList.error).toEqual(['x'])
    expect(ui.current.comparison.error).toBeNull()
  })

  it('a slow comparison of the previous load never overwrites the new one', async () => {
    const slow = deferred()
    state.reports['orders|2026-10-08,2026-10-08'] = () => slow.promise
    const ui = await renderController({ wait: false })
    await waitFor(() => expect(ui.current.salesList.loading).toBe(false))
    await change(ui, { ...ui.current.filterList, lapse: 'yesterday' })
    await settle(ui)
    const before = ui.current.comparison
    expect(before.plan.mode).toBe('previous')
    await act(async () => { slow.resolve([{ time: '2026-10-08 10:00:00', orders: 999 }]) })
    await act(async () => { await Promise.resolve() })
    expect(ui.current.comparison.plan.mode).toBe('previous')
    expect(ui.current.comparison.previous.orders).not.toBe(999)
  })

  it('the plan follows the hour of the clock when the comparison starts', async () => {
    vi.setSystemTime(new Date(2026, 9, 9, 9, 5))
    const ui = await renderController()
    expect(ui.current.comparison.plan.hour).toBe(9)
  })
})

// redesign bi R1 (F1): the time zone the user picks decides which day is «today», for the period and for the comparison.
// 2026-10-10T04:06:00Z is 13:06 of 10-10 in Tokyo and 06:06 of 10-10 in Madrid
describe('BusinessAnalytics · time zone (R1 F1)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-10T04:06:00Z'))
    session.value = { token: 'tok', loading: false }
    ordering.value = { root: ROOT }
    state.reports = {}
    state.fetch = vi.fn(answer)
    vi.stubGlobal('fetch', state.fetch)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const urlIn = (type, lapse, zone) => `${ROOT}/reports/${type}?lapse=${lapse}&timezone=${zone}${withoutCancelled(type)}`

  it('today in Tokyo: yesterday is the 09-10, cut at the hour of Tokyo, and the period is the 10-10', async () => {
    const ui = await renderController()
    const before = calls().length
    await change(ui, { ...ui.current.filterList, timeZone: 'Asia/Tokyo' })
    await settle(ui)
    expect(calls().slice(before)).toEqual([
      ...REPORT_TYPES.map(type => urlIn(type, 'today', 'Asia/Tokyo')),
      urlIn('orders', '2026-10-09,2026-10-09', 'Asia/Tokyo'),
      urlIn('sales', '2026-10-09,2026-10-09', 'Asia/Tokyo')
    ])
    expect(ui.current.comparison.plan).toEqual({ mode: 'byNow', previous: '2026-10-09,2026-10-09', hour: 13 })
    expect(ui.current.period).toMatchObject({ from: '2026-10-10', to: '2026-10-10' })
  })

  // redesign bi R1 targeted (N1): the API labels its rows in the same days whatever the zone, so the chart axis keeps the browser's days
  it('the chart axis is continuous only in the browser zone; with another zone the rows are drawn as they come', async () => {
    const ui = await renderController()
    expect(ui.current.chartPeriod).toEqual(periodOf('today', new Date()))
    await change(ui, { ...ui.current.filterList, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Tokyo' ? 'Europe/Madrid' : 'Asia/Tokyo' })
    await settle(ui)
    expect(ui.current.chartPeriod).toBeNull()
    expect(ui.current.period.from).toBeTruthy()
  })

  // redesign bi R1 targeted (N2): a reload of the same preset after midnight moves the period line to the new day
  it('reloading the active preset after midnight moves the period to the new day', async () => {
    const ui = await renderController()
    await change(ui, { ...ui.current.filterList, timeZone: 'America/Chicago' })
    await settle(ui)
    expect(ui.current.period).toMatchObject({ from: '2026-10-09', to: '2026-10-09' })
    vi.setSystemTime(new Date('2026-10-10T05:00:20Z')) // 00:00:20 in Chicago
    await change(ui, { ...ui.current.filterList })
    await settle(ui)
    expect(ui.current.period).toMatchObject({ from: '2026-10-10', to: '2026-10-10' })
  })

  it('the period follows the zone as soon as it changes, with the same lapse', async () => {
    const ui = await renderController()
    await change(ui, { ...ui.current.filterList, lapse: 'last_7_days', timeZone: 'Europe/Madrid' })
    await settle(ui)
    expect(ui.current.period).toMatchObject({ from: '2026-10-03', to: '2026-10-10', days: 8 })
    await change(ui, { ...ui.current.filterList, timeZone: 'America/Chicago' })
    await settle(ui)
    expect(ui.current.period).toMatchObject({ from: '2026-10-02', to: '2026-10-09', days: 8 })
  })

  it('last 7 days in Madrid compares the closed days 03-10 to 09-10, with the same lapse in the blocks', async () => {
    const ui = await renderController()
    const before = calls().length
    await change(ui, { ...ui.current.filterList, lapse: 'last_7_days', timeZone: 'Europe/Madrid' })
    await settle(ui)
    const asked = calls().slice(before)
    expect(asked.slice(0, 10)).toEqual(REPORT_TYPES.map(type => urlIn(type, 'last_7_days', 'Europe/Madrid')))
    expect(asked.slice(10)).toEqual([
      ...['orders', 'sales', 'users', 'orders_status'].map(type => urlIn(type, '2026-10-03,2026-10-09', 'Europe/Madrid')),
      ...['orders', 'sales', 'users', 'orders_status'].map(type => urlIn(type, '2026-09-26,2026-10-02', 'Europe/Madrid'))
    ])
    expect(ui.current.comparison.plan).toMatchObject({ mode: 'closed', days: 7 })
  })
})
