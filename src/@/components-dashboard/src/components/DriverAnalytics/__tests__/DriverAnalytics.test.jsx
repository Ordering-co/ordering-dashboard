/* eslint-disable import/first */
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// redesign drivers FB (D2, D5, D9, DR-01, DR-12, DR-13, DR-19): the controller of /intelligence/drivers

const ROOT = 'https://api.test/v400/en/dev'
const session = vi.hoisted(() => ({ value: null }))
const ordering = vi.hoisted(() => ({ value: null }))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [session.value] }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [ordering.value] }))

import { DriverAnalytics } from '..'
import { normalizeTimezone } from '../../../utils'

// "Now" is Friday 2026-10-09 15:30 local time
const NOW = new Date(2026, 9, 9, 15, 30)
const TZ = normalizeTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)

// The 14 reports of main, in its order: API report and the prop the UI receives
const BLOCKS = [
  ['driver_orders_v2', 'ordersList'],
  ['driver_sales_v2', 'salesList'],
  ['drivers_orders_status', 'orderStatusList'],
  ['drivers_top_orders', 'topDriversList'],
  ['drivers_spend_times', 'spendTimesList'],
  ['drivers_available_times', 'availableTimesList'],
  ['drivers_busy_times', 'busyTimesList'],
  ['customer_satisfaction', 'customerSatisfactionList'],
  ['drivers_accept_spend', 'acceptSpendList'],
  ['drivers_complete_spend', 'completeSpendList'],
  ['drivers_arrived_pickup_spend', 'arrivedPickUpSpendList'],
  ['drivers_pickup_spend', 'pickUpSpendList'],
  ['drivers_order_location', 'orderLocationList'],
  ['drivers_delivery_spend', 'deliverySpendList']
]
const REPORT_TYPES = BLOCKS.map(([type]) => type)
const BLOCK_PROPS = BLOCKS.map(([, prop]) => prop)

const urlOf = (type, lapse = 'today', extra = '') => `${ROOT}/reports/${type}?lapse=${lapse}&timezone=${TZ}${extra}`
// The two v2 reports also receive `v2Extra`: they read the JSON `drivers_ids` / `businesses_ids`
const V2_TYPES = ['driver_orders_v2', 'driver_sales_v2']
const mainUrls = (lapse = 'today', extra = '', v2Extra = '') => REPORT_TYPES.map(type => urlOf(type, lapse, V2_TYPES.includes(type) ? `${extra}${v2Extra}` : extra))

const DEFAULTS = {
  driver_orders_v2: { type: 'chart', dataset: { x: { from: '2026-10-09 00:00:00', to: '2026-10-09 23:59:59' }, dataset: { label: 'Orders', data: [{ x: '2026-10-09 10:00:00', y: 2 }, { x: '2026-10-09 12:00', y: 1 }] } } },
  driver_sales_v2: {
    type: 'chart',
    dataset: {
      x: { from: '2026-10-03 00:00:00', to: '2026-10-09 23:59:59' },
      dataset: [
        { label: 'Sales', data: [{ x: '2026-10-09 10:00:00', y: '50' }, { x: '2026-10-09 12:00:00', y: 42.5 }] },
        { label: 'Other', data: [{ x: '2026-10-09 10:00:00', y: 1000 }] }
      ]
    }
  },
  drivers_orders_status: [{ status: 7, orders: 2 }],
  drivers_top_orders: [
    { id: 5, name: 'Ana', orders_count: 2, orders_percentage: '40.00' },
    { id: 9, name: 'Fattelo', orders_count: 2, orders_percentage: '40.00' },
    { id: 10, name: 'Fattelo', orders_count: 1, orders_percentage: '20.00' }
  ],
  drivers_spend_times: [
    { time: '2026-10-10', accept_spend: 20, pickup_spend: 30, delivery_spend: 40, complete_spend: 50 },
    { time: '2026-10-09', accept_spend: 10, pickup_spend: 11, delivery_spend: 12, complete_spend: 13 }
  ],
  drivers_available_times: {
    available: [{ at: '2026-10-10', time: 7200 }, { at: '2026-10-09', time: 3600 }],
    not_available: [{ at: '2026-10-09', time: 1800 }]
  },
  drivers_busy_times: {
    busy: [{ at: '2026-10-09', time: 600 }],
    not_busy: [{ at: '2026-10-11', time: 900 }, { at: '2026-10-09', time: 300 }]
  },
  customer_satisfaction: { 1: '0.00', 2: '0.00', 3: '0.00', 4: '1.00', 5: '4.00' },
  drivers_accept_spend: '20704.95',
  drivers_complete_spend: 900,
  drivers_arrived_pickup_spend: 600,
  drivers_pickup_spend: 300,
  drivers_order_location: [{ lat: 1, lng: 2 }],
  drivers_delivery_spend: 1200
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
  const view = render(<DriverAnalytics UIComponent={UIComponent} {...props} />)
  ui.view = view
  ui.element = <DriverAnalytics UIComponent={UIComponent} {...props} />
  if (wait) await settle(ui)
  return ui
}

const settle = async (ui) => {
  await waitFor(() => {
    BLOCK_PROPS.forEach(prop => expect(ui.current[prop].loading).toBe(false))
  })
}

const change = async (ui, next, options) => {
  await act(async () => { ui.current.handleChangeFilterList(next, options) })
}

const setup = () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  session.value = { token: 'tok', loading: false }
  ordering.value = { root: ROOT }
  state.reports = {}
  state.fetch = vi.fn(answer)
  vi.stubGlobal('fetch', state.fetch)
}
const teardown = () => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
}

describe('DriverAnalytics · requests', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('the first render has every block loading, and the filters have the shape of the kit', async () => {
    const ui = await renderController({ wait: false })
    const first = ui.renders[0]
    BLOCK_PROPS.forEach((prop) => {
      expect(first[prop].loading).toBe(true)
      expect(first[prop].error).toBeNull()
    })
    expect(first.filterList).toEqual({
      lapse: 'today',
      drivers_ids: null,
      businessIds: null,
      app_id: 'all',
      driver_groups_ids: null,
      franchises_id: null,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    })
    expect(first.countryCode).toBe('')
    expect(typeof first.handleChangeCode).toBe('function')
    expect(typeof first.reloadBlock).toBe('function')
    await settle(ui)
  })

  it('there is no comparison in this page (D2)', async () => {
    const ui = await renderController()
    expect(ui.current.comparison).toBeUndefined()
    expect(ui.current.reloadComparison).toBeUndefined()
  })

  it('the initial load asks the 14 reports of main with lapse=today, in the same order', async () => {
    await renderController()
    expect(calls()).toHaveLength(14)
    expect(calls()).toEqual(mainUrls())
    expect(calls()).toEqual([
      `${ROOT}/reports/driver_orders_v2?lapse=today&timezone=${TZ}`,
      `${ROOT}/reports/driver_sales_v2?lapse=today&timezone=${TZ}`,
      `${ROOT}/reports/drivers_orders_status?lapse=today&timezone=${TZ}`,
      `${ROOT}/reports/drivers_top_orders?lapse=today&timezone=${TZ}`,
      `${ROOT}/reports/drivers_spend_times?lapse=today&timezone=${TZ}`,
      `${ROOT}/reports/drivers_available_times?lapse=today&timezone=${TZ}`,
      `${ROOT}/reports/drivers_busy_times?lapse=today&timezone=${TZ}`,
      `${ROOT}/reports/customer_satisfaction?lapse=today&timezone=${TZ}`,
      `${ROOT}/reports/drivers_accept_spend?lapse=today&timezone=${TZ}`,
      `${ROOT}/reports/drivers_complete_spend?lapse=today&timezone=${TZ}`,
      `${ROOT}/reports/drivers_arrived_pickup_spend?lapse=today&timezone=${TZ}`,
      `${ROOT}/reports/drivers_pickup_spend?lapse=today&timezone=${TZ}`,
      `${ROOT}/reports/drivers_order_location?lapse=today&timezone=${TZ}`,
      `${ROOT}/reports/drivers_delivery_spend?lapse=today&timezone=${TZ}`
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
    expect(ui.current.ordersList).toEqual({ loading: false, data: DEFAULTS.driver_orders_v2, error: null })
    expect(ui.current.topDriversList.data).toEqual(DEFAULTS.drivers_top_orders)
    expect(ui.current.customerSatisfactionList.data).toEqual(DEFAULTS.customer_satisfaction)
    expect(ui.current.acceptSpendList.data).toBe('20704.95')
    expect(ui.current.orderLocationList.locations).toEqual(DEFAULTS.drivers_order_location)
    expect(ui.current.orderLocationList.loading).toBe(false)
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
    expect(calls()).toEqual(mainUrls())
    expect(state.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer tok')
  })

  it('drivers_ids [5, 9] are sent as drivers=5,9, after the timezone (D5)', async () => {
    const ui = await renderController()
    state.fetch.mockClear()
    await change(ui, { ...ui.current.filterList, drivers_ids: [5, 9] })
    await settle(ui)
    expect(calls()).toEqual(mainUrls('today', '&drivers=5,9', `&drivers_ids=${JSON.stringify([5, 9])}`))
  })

  it('driver_orders_v2 and driver_sales_v2 receive drivers_ids and businesses_ids in JSON; the other 12 keep drivers= and businesses= only', async () => {
    const ui = await renderController()
    state.fetch.mockClear()
    await change(ui, { ...ui.current.filterList, drivers_ids: [5, 9], businessIds: [1, 2] })
    await settle(ui)
    calls().forEach((url) => {
      const params = new URL(url).searchParams
      const isV2 = V2_TYPES.includes(new URL(url).pathname.split('/').pop())
      expect(params.get('drivers')).toBe('5,9')
      expect(params.get('businesses')).toBe('1,2')
      expect(params.get('drivers_ids')).toBe(isV2 ? '[5,9]' : null)
      expect(params.get('businesses_ids')).toBe(isV2 ? '[1,2]' : null)
    })
  })

  it('builds the parameters in the order of main: drivers, businesses, app_id, driver groups, franchises', async () => {
    const ui = await renderController()
    state.fetch.mockClear()
    await change(ui, { ...ui.current.filterList, drivers_ids: [5], businessIds: [1, 2], app_id: 5, driver_groups_ids: [4], franchises_id: [3] })
    await settle(ui)
    const extra = `&drivers=5&businesses=1,2&app_id=5&driver_groups_ids=${JSON.stringify([4])}&franchises_id=${JSON.stringify([3])}`
    expect(calls()).toEqual(mainUrls('today', extra, `&drivers_ids=${JSON.stringify([5])}&businesses_ids=${JSON.stringify([1, 2])}`))
  })

  it('an empty list is not sent: drivers, businesses, driver groups and franchises (DR-13)', async () => {
    const ui = await renderController()
    state.fetch.mockClear()
    await change(ui, { ...ui.current.filterList, drivers_ids: [], businessIds: [], driver_groups_ids: [], franchises_id: [] })
    await settle(ui)
    expect(calls()).toEqual(mainUrls('today'))
    calls().forEach((url) => {
      expect(url).not.toContain('drivers=')
      expect(url).not.toContain('drivers_ids')
      expect(url).not.toContain('driver_groups_ids')
      expect(url).not.toContain('franchises_id')
      expect(url).not.toContain('businesses')
    })
  })

  it('driver_groups_ids [] alone leaves the parameter out', async () => {
    const ui = await renderController()
    state.fetch.mockClear()
    await change(ui, { ...ui.current.filterList, driver_groups_ids: [] })
    await settle(ui)
    expect(calls()).toEqual(mainUrls('today'))
  })

  it('app_id «all» and null are not sent', async () => {
    const ui = await renderController()
    state.fetch.mockClear()
    await change(ui, { ...ui.current.filterList, app_id: 'all' })
    await settle(ui)
    expect(calls()).toEqual(mainUrls('today'))
    state.fetch.mockClear()
    await change(ui, { ...ui.current.filterList, app_id: null })
    await settle(ui)
    expect(calls()).toEqual(mainUrls('today'))
  })

  it('a filter change asks every report once, and the pills change at once', async () => {
    const ui = await renderController()
    state.fetch.mockClear()
    await change(ui, { ...ui.current.filterList, lapse: 'yesterday' })
    expect(ui.current.filterList.lapse).toBe('yesterday')
    await settle(ui)
    expect(calls()).toHaveLength(14)
    mainUrls('yesterday').forEach(url => expect(calls().filter(item => item === url)).toHaveLength(1))
  })

  it('a filter change that is a function receives the current filters', async () => {
    const ui = await renderController()
    state.fetch.mockClear()
    await change(ui, (current) => ({ ...current, lapse: 'last_7_days' }))
    expect(ui.current.filterList.lapse).toBe('last_7_days')
    await settle(ui)
    expect(calls()).toEqual(mainUrls('last_7_days'))
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
    expect(calls()).toEqual(mainUrls('today', '&businesses=1,2', `&businesses_ids=${JSON.stringify([1, 2])}`))
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(calls()).toHaveLength(14)
  })

  it('a change without debounce after a pending one applies the latest filters at once, and the timer asks nothing more', async () => {
    const ui = await renderController()
    state.fetch.mockClear()
    vi.useRealTimers()
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    vi.setSystemTime(NOW)
    await change(ui, { ...ui.current.filterList, businessIds: [1] }, { debounce: true })
    await change(ui, { ...ui.current.filterList, lapse: 'yesterday' })
    expect(calls()).toEqual(mainUrls('yesterday', '&businesses=1', `&businesses_ids=${JSON.stringify([1])}`))
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(calls()).toHaveLength(14)
  })

  it('a slow response of the previous load never overwrites the new one (DR-12)', async () => {
    const slow = deferred()
    state.reports['driver_orders_v2|today'] = () => slow.promise
    const ui = await renderController({ wait: false })
    await waitFor(() => expect(ui.current.salesList.loading).toBe(false))
    expect(ui.current.ordersList.loading).toBe(true)

    const yesterday = { type: 'chart', dataset: { dataset: { label: 'Orders', data: [{ x: '2026-10-08 10:00:00', y: 7 }] } } }
    state.reports['driver_orders_v2|yesterday'] = yesterday
    await change(ui, { ...ui.current.filterList, lapse: 'yesterday' })
    await waitFor(() => expect(ui.current.ordersList.loading).toBe(false))
    expect(ui.current.ordersList.data).toEqual(yesterday)

    await act(async () => { slow.resolve({ type: 'chart', dataset: { dataset: { label: 'Orders', data: [{ x: '2026-10-09 10:00:00', y: 999 }] } } }) })
    await act(async () => { await Promise.resolve() })
    expect(ui.current.ordersList.data).toEqual(yesterday)
    expect(ui.current.ordersList.loading).toBe(false)
  })

  it('two changes in a row: the first response arrives last and is ignored (DR-12)', async () => {
    const ui = await renderController()
    const first = deferred()
    state.reports['drivers_top_orders|yesterday'] = () => first.promise
    state.reports['drivers_top_orders|last_7_days'] = [{ id: 1, name: 'Latest', orders_count: 4, orders_percentage: '100.00' }]
    await change(ui, { ...ui.current.filterList, lapse: 'yesterday' })
    await change(ui, { ...ui.current.filterList, lapse: 'last_7_days' })
    await waitFor(() => expect(ui.current.topDriversList.loading).toBe(false))
    expect(ui.current.topDriversList.data).toEqual([{ id: 1, name: 'Latest', orders_count: 4, orders_percentage: '100.00' }])
    await act(async () => { first.resolve([{ id: 2, name: 'Stale', orders_count: 1, orders_percentage: '1.00' }]) })
    await act(async () => { await Promise.resolve() })
    expect(ui.current.topDriversList.data[0].name).toBe('Latest')
    expect(ui.current.topDrivers.map(item => item.name)).toEqual(['Latest'])
  })

  it('a slow error of the previous load does not paint an error on the new data', async () => {
    const slow = deferred()
    state.reports['driver_sales_v2|today'] = () => slow.promise
    const ui = await renderController({ wait: false })
    await waitFor(() => expect(ui.current.ordersList.loading).toBe(false))
    await change(ui, { ...ui.current.filterList, lapse: 'yesterday' })
    await waitFor(() => expect(ui.current.salesList.loading).toBe(false))
    await act(async () => { slow.resolve({ error: true, result: ['old'] }) })
    await act(async () => { await Promise.resolve() })
    expect(ui.current.salesList.error).toBeNull()
    expect(ui.current.salesList.data).toEqual(DEFAULTS.driver_sales_v2)
  })

  it('a failing report leaves its block with loading false, the error and empty data, the others intact (DR-01)', async () => {
    state.reports.drivers_busy_times = { error: true, result: ['Busy is down'] }
    const ui = await renderController()
    expect(ui.current.busyTimesList).toEqual({ loading: false, data: [], error: ['Busy is down'] })
    expect(ui.current.ordersList.error).toBeNull()
    expect(ui.current.ordersList.data).toEqual(DEFAULTS.driver_orders_v2)
    expect(ui.current.availableTimesList.error).toBeNull()
    BLOCK_PROPS.filter(prop => prop !== 'busyTimesList').forEach(prop => expect(ui.current[prop].error).toBeNull())
    expect(ui.current.busyPairs).toEqual([])
  })

  it('a rejected request (network) is a block error with empty data', async () => {
    state.reports.drivers_top_orders = () => { throw new Error('offline') }
    const ui = await renderController()
    expect(ui.current.topDriversList.loading).toBe(false)
    expect(ui.current.topDriversList.data).toEqual([])
    expect(ui.current.topDriversList.error).toBeInstanceOf(Error)
    expect(ui.current.topDriversList.error.message).toBe('offline')
  })

  it('a failing locations report leaves empty locations', async () => {
    state.reports.drivers_order_location = { error: true, result: ['nope'] }
    const ui = await renderController()
    expect(ui.current.orderLocationList.error).toEqual(['nope'])
    expect(ui.current.orderLocationList.locations).toEqual([])
  })

  it('reloadBlock(topDrivers) repeats only that GET, with the applied filters', async () => {
    const ui = await renderController()
    await change(ui, { ...ui.current.filterList, drivers_ids: [5, 9] })
    await settle(ui)
    state.fetch.mockClear()
    const hold = deferred()
    state.reports.drivers_top_orders = () => hold.promise
    await act(async () => { ui.current.reloadBlock('topDrivers') })
    expect(ui.current.topDriversList.loading).toBe(true)
    expect(ui.current.ordersList.loading).toBe(false)
    await act(async () => { hold.resolve([{ id: 5, name: 'Ana', orders_count: 9, orders_percentage: '90.00' }]) })
    await waitFor(() => expect(ui.current.topDriversList.loading).toBe(false))
    expect(calls()).toEqual([urlOf('drivers_top_orders', 'today', '&drivers=5,9')])
    expect(ui.current.topDrivers).toEqual([{ id: 5, name: 'Ana', count: 9, percent: 90, duplicate: false }])
  })

  it('reloadBlock accepts every block key and ignores an unknown one', async () => {
    const ui = await renderController()
    state.fetch.mockClear()
    await act(async () => { ui.current.reloadBlock('nonsense') })
    expect(state.fetch).not.toHaveBeenCalled()
    const keys = [
      'orders', 'sales', 'orderStatus', 'topDrivers', 'spendTimes', 'availableTimes', 'busyTimes', 'customerSatisfaction',
      'acceptSpend', 'completeSpend', 'arrivedPickUpSpend', 'pickUpSpend', 'orderLocation', 'deliverySpend'
    ]
    for (const key of keys) {
      state.fetch.mockClear()
      await act(async () => { ui.current.reloadBlock(key) })
      expect(calls()).toHaveLength(1)
      expect(calls()[0]).toContain(`/reports/${REPORT_TYPES[keys.indexOf(key)]}?`)
    }
  })

  it('a response that arrives after unmounting writes nothing and breaks nothing', async () => {
    const slow = deferred()
    state.reports.driver_orders_v2 = () => slow.promise
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const ui = await renderController({ wait: false })
    await waitFor(() => expect(ui.current.salesList.loading).toBe(false))
    const rendersBefore = ui.renders.length
    ui.view.unmount()
    await act(async () => { slow.resolve(DEFAULTS.driver_orders_v2) })
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

describe('DriverAnalytics · totals and derived data', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('derives the seven figures from the blocks, and nulls while they load', async () => {
    const ui = await renderController({ wait: false })
    expect(ui.renders[0].totals).toEqual({
      orders: null, sales: null, acceptSeconds: null, arrivedSeconds: null, pickupSeconds: null, deliverySeconds: null, completeSeconds: null
    })
    await settle(ui)
    expect(ui.current.totals).toEqual({
      orders: 3,
      // the first series only, like main (P7)
      sales: 92.5,
      acceptSeconds: 20704.95,
      arrivedSeconds: 600,
      pickupSeconds: 300,
      deliverySeconds: 1200,
      completeSeconds: 900
    })
  })

  it('a block with an error gives a null figure; the others stay', async () => {
    state.reports.driver_sales_v2 = { error: true, result: ['x'] }
    state.reports.drivers_delivery_spend = { error: true, result: ['y'] }
    const ui = await renderController()
    expect(ui.current.totals.sales).toBeNull()
    expect(ui.current.totals.deliverySeconds).toBeNull()
    expect(ui.current.totals.orders).toBe(3)
    expect(ui.current.totals.pickupSeconds).toBe(300)
  })

  it('a negative average gives null, never a negative duration (DR-19)', async () => {
    state.reports.drivers_accept_spend = -42
    state.reports.drivers_pickup_spend = '-1.5'
    const ui = await renderController()
    expect(ui.current.totals.acceptSeconds).toBeNull()
    expect(ui.current.totals.pickupSeconds).toBeNull()
    expect(ui.current.totals.completeSeconds).toBe(900)
  })

  it('no orders or no time: orders and sales are 0, a missing time is null (never 0), a real 0 is 0', async () => {
    state.reports.driver_orders_v2 = { type: 'chart', dataset: { dataset: { label: 'Orders', data: [] } } }
    state.reports.driver_sales_v2 = []
    state.reports.drivers_accept_spend = []
    state.reports.drivers_complete_spend = null
    state.reports.drivers_delivery_spend = 0
    const ui = await renderController()
    expect(ui.current.totals.orders).toBe(0)
    expect(ui.current.totals.sales).toBe(0)
    expect(ui.current.totals.acceptSeconds).toBeNull()
    expect(ui.current.totals.completeSeconds).toBeNull()
    expect(ui.current.totals.deliverySeconds).toBe(0)
  })

  it('gives the rows of the first series for the totals and the CSV, with the time completed and the value key', async () => {
    const ui = await renderController()
    expect(ui.current.ordersRows).toEqual([
      { time: '2026-10-09 10:00:00', orders: 2 },
      { time: '2026-10-09 12:00:00', orders: 1 }
    ])
    expect(ui.current.salesRows).toEqual([
      { time: '2026-10-09 10:00:00', sales: 50 },
      { time: '2026-10-09 12:00:00', sales: 42.5 }
    ])
  })

  // redesign drivers FB (phase-1 audit: Sales draws every series, as main)
  it('gives every series of Sales and Orders, while the totals keep the first', async () => {
    const ui = await renderController()
    expect(ui.current.salesSeries).toEqual([
      { label: 'Sales', rows: [{ time: '2026-10-09 10:00:00', sales: 50 }, { time: '2026-10-09 12:00:00', sales: 42.5 }] },
      { label: 'Other', rows: [{ time: '2026-10-09 10:00:00', sales: 1000 }] }
    ])
    expect(ui.current.ordersSeries).toEqual([
      { label: 'Orders', rows: [{ time: '2026-10-09 10:00:00', orders: 2 }, { time: '2026-10-09 12:00:00', orders: 1 }] }
    ])
    expect(ui.current.totals.sales).toBe(92.5)
  })

  // redesign drivers FB (phase-1 audit: the axis follows the range of the response, not the zone)
  it('gives the period of the chart from the response of each report', async () => {
    const ui = await renderController()
    expect(ui.current.ordersPeriod).toEqual({ from: '2026-10-09', to: '2026-10-09', granularity: 'hour' })
    expect(ui.current.salesPeriod).toEqual({ from: '2026-10-03', to: '2026-10-09', granularity: 'day' })
  })

  it('has no chart period while loading, on error or when the response carries no range', async () => {
    state.reports.driver_sales_v2 = { error: true, result: ['x'] }
    state.reports.driver_orders_v2 = { type: 'chart', dataset: { dataset: { label: 'Orders', data: [] } } }
    const ui = await renderController({ wait: false })
    expect(ui.renders[0].ordersPeriod).toBeNull()
    expect(ui.renders[0].salesPeriod).toBeNull()
    await settle(ui)
    expect(ui.current.ordersPeriod).toBeNull()
    expect(ui.current.salesPeriod).toBeNull()
  })

  it('the chart period does not depend on the zone, and `chartPeriod` is gone', async () => {
    const ui = await renderController()
    await change(ui, { ...ui.current.filterList, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Tokyo' ? 'Europe/Madrid' : 'Asia/Tokyo' })
    await settle(ui)
    expect(ui.current.ordersPeriod).toEqual({ from: '2026-10-09', to: '2026-10-09', granularity: 'hour' })
    expect(ui.current.chartPeriod).toBeUndefined()
  })

  it('gives the spend series, the available and busy pairs by their exact `at`, and the top drivers', async () => {
    const ui = await renderController()
    expect(ui.current.spendSeries).toEqual([
      { at: '2026-10-09', accept: 10, pickup: 11, delivery: 12, complete: 13 },
      { at: '2026-10-10', accept: 20, pickup: 30, delivery: 40, complete: 50 }
    ])
    expect(ui.current.availablePairs).toEqual([
      { at: '2026-10-09', first: 3600, second: 1800 },
      { at: '2026-10-10', first: 7200, second: null }
    ])
    expect(ui.current.busyPairs).toEqual([
      { at: '2026-10-09', first: 600, second: 300 },
      { at: '2026-10-11', first: null, second: 900 }
    ])
    expect(ui.current.dailyPairs).toBeUndefined()
    expect(ui.current.topDrivers).toEqual([
      { id: 5, name: 'Ana', count: 2, percent: 40, duplicate: false },
      { id: 9, name: 'Fattelo', count: 2, percent: 40, duplicate: true },
      { id: 10, name: 'Fattelo', count: 1, percent: 20, duplicate: true }
    ])
  })

  it('in Today the pairs and the spend series are hourly, not merged into the day', async () => {
    state.reports.drivers_available_times = {
      available: [{ at: '2026-10-09 11:00:00', time: 2 }, { at: '2026-10-09 10:00:00', time: 1 }],
      not_available: [{ at: '2026-10-09 10:00:00', time: 10 }]
    }
    state.reports.drivers_spend_times = [
      { time: '2026-10-09 11:00:00', accept_spend: 2 },
      { time: '2026-10-09 10:00:00', accept_spend: 1 }
    ]
    const ui = await renderController()
    expect(ui.current.availablePairs).toEqual([
      { at: '2026-10-09 10:00:00', first: 1, second: 10 },
      { at: '2026-10-09 11:00:00', first: 2, second: null }
    ])
    expect(ui.current.spendSeries.map(item => item.at)).toEqual(['2026-10-09 10:00:00', '2026-10-09 11:00:00'])
  })

  it('the derived data is empty while the blocks have none', async () => {
    const ui = await renderController({ wait: false })
    const first = ui.renders[0]
    expect(first.ordersRows).toEqual([])
    expect(first.salesRows).toEqual([])
    expect(first.ordersSeries).toEqual([])
    expect(first.salesSeries).toEqual([])
    expect(first.spendSeries).toEqual([])
    expect(first.availablePairs).toEqual([])
    expect(first.busyPairs).toEqual([])
    expect(first.topDrivers).toEqual([])
    await settle(ui)
  })

  it('gives the period of the lapse for the line of dates', async () => {
    const ui = await renderController()
    expect(ui.current.period).toEqual({ from: '2026-10-09', to: '2026-10-09', days: 1, includesToday: true, granularity: 'hour' })
    await change(ui, { ...ui.current.filterList, lapse: 'last_30_days' })
    expect(ui.current.period).toEqual({ from: '2026-09-09', to: '2026-10-09', days: 31, includesToday: true, granularity: 'day' })
    await settle(ui)
  })
})
