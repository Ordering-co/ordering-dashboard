import React from 'react'
import dayjs from 'dayjs'
import { act, render, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// redesign reports FA3 (D4, D10, D13; RP-06, RP-09, RP-20; auditor 3, 14)

const state = vi.hoisted(() => ({
  session: { token: 'tok', loading: false },
  requests: []
}))

vi.mock('../../../contexts/ApiContext', () => {
  const ordering = { root: 'https://api.test/v400/en/demo' }
  return { useApi: () => [ordering] }
})
vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [state.session]
}))

import { AdvancedReports } from '../index'
import { buildReportParams, useAdvancedReport } from '../useAdvancedReport'

const ROOT = 'https://api.test/v400/en/demo'
const TZ = 'America/Mexico_City'

const FILTERS = {
  from: '2026-10-03',
  to: '2026-10-10',
  businessIds: [3, 1],
  drivers_ids: [9],
  franchises_id: [],
  driver_companies_ids: null,
  driver_groups_ids: [2],
  delivery_types_ids: [1, 2],
  app_ids: [5],
  timeZone: TZ
}

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve()
  })
}

const respond = async (index, body) => {
  state.requests[index].resolve({ json: async () => body })
  await flush()
}

const fail = async (index, error) => {
  state.requests[index].reject(error)
  await flush()
}

const advance = async (ms) => {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
}

/**
 * What `main` asks for the same filters: the real, untouched `AdvancedReports`
 * controller is rendered and its fetch URLs are captured (reference for the URLs).
 */
const mainUrls = async (endpoint, endpoint1, filters) => {
  let ui = null
  const Capture = (props) => {
    ui = props
    return null
  }
  const { unmount } = render(<AdvancedReports endpoint={endpoint} endpoint1={endpoint1} UIComponent={Capture} />)
  const before = state.requests.length
  await act(async () => {
    ui.handleChangeFilterList({ ...filters, from: dayjs(filters.from), to: dayjs(filters.to) })
  })
  const urls = state.requests.slice(before).map((request) => request.url)
  unmount()
  return urls
}

describe('useAdvancedReport', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    state.requests = []
    state.session = { token: 'tok', loading: false }
    globalThis.fetch = vi.fn((url, options) => new Promise((resolve, reject) => {
      state.requests.push({ url, options, resolve, reject })
    }))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('asks for the same URL as the main controller (same order, format and headers)', async () => {
    const [mainFirst] = await mainUrls('orders_v2', undefined, FILTERS)
    state.requests = []
    renderHook(() => useAdvancedReport({ endpoint: 'orders_v2', filters: FILTERS }))
    expect(state.requests).toHaveLength(1)
    expect(state.requests[0].url).toBe(mainFirst)
    expect(state.requests[0].url).toBe(
      `${ROOT}/reports/orders_v2?timezone=${TZ}&from=2026-10-03 00:00:00&to=2026-10-10 23:59:59` +
      '&businesses_ids=[3,1]&drivers_ids=[9]&driver_groups_ids=[2]&delivery_types_ids=[1,2]&app_ids=[5]'
    )
    expect(state.requests[0].options).toEqual({
      method: 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' }
    })
  })

  it('sends the second request with the zone first, otherwise the same as main', async () => {
    const [, mainSecond] = await mainUrls('business_orders_count_sales', 'franchise_orders_count_sales', FILTERS)
    expect(mainSecond).not.toContain('timezone=')
    state.requests = []
    renderHook(() => useAdvancedReport({
      endpoint: 'business_orders_count_sales',
      endpoint1: 'franchise_orders_count_sales',
      filters: FILTERS
    }))
    expect(state.requests).toHaveLength(2)
    expect(state.requests[1].url).toBe(mainSecond.replace('?', `?timezone=${TZ}&`))
    expect(state.requests[1].url.startsWith(`${ROOT}/reports/franchise_orders_count_sales?timezone=${TZ}&from=`)).toBe(true)
    expect(state.requests[1].options.headers.Authorization).toBe('Bearer tok')
  })

  it('does not send filters that are empty, null or missing', () => {
    renderHook(() => useAdvancedReport({
      endpoint: 'sales_v2',
      filters: { ...FILTERS, businessIds: [], drivers_ids: null, driver_groups_ids: undefined, delivery_types_ids: [], app_ids: [] }
    }))
    expect(state.requests[0].url).toBe(
      `${ROOT}/reports/sales_v2?timezone=${TZ}&from=2026-10-03 00:00:00&to=2026-10-10 23:59:59`
    )
  })

  it('does not ask for anything when disabled, and asks at once when enabled', async () => {
    const { result, rerender } = renderHook((props) => useAdvancedReport(props), {
      initialProps: { endpoint: 'orders_v2', filters: FILTERS, enabled: false }
    })
    await advance(5000)
    expect(state.requests).toHaveLength(0)
    expect(result.current.loading).toBe(false)
    expect(result.current.updating).toBe(false)
    expect(result.current.data).toBeNull()
    rerender({ endpoint: 'orders_v2', filters: FILTERS, enabled: true })
    expect(state.requests).toHaveLength(1)
    expect(result.current.loading).toBe(true)
  })

  it('does not wait on the first mount, then waits debounceMs and sends one request after three changes', async () => {
    const { rerender } = renderHook((props) => useAdvancedReport(props), {
      initialProps: { endpoint: 'orders_v2', filters: FILTERS }
    })
    expect(state.requests).toHaveLength(1)
    await respond(0, { error: false, result: [] })

    rerender({ endpoint: 'orders_v2', filters: { ...FILTERS, businessIds: [1] } })
    await advance(200)
    rerender({ endpoint: 'orders_v2', filters: { ...FILTERS, businessIds: [1, 2] } })
    await advance(200)
    rerender({ endpoint: 'orders_v2', filters: { ...FILTERS, businessIds: [1, 2, 3] } })
    await advance(599)
    expect(state.requests).toHaveLength(1)
    await advance(1)
    expect(state.requests).toHaveLength(2)
    expect(state.requests[1].url).toContain('businesses_ids=[1,2,3]')
    await advance(5000)
    expect(state.requests).toHaveLength(2)
  })

  it('compares filters by value, not by reference', async () => {
    const { rerender } = renderHook((props) => useAdvancedReport(props), {
      initialProps: { endpoint: 'orders_v2', filters: FILTERS }
    })
    await respond(0, { error: false, result: [] })
    rerender({ endpoint: 'orders_v2', filters: { ...FILTERS, businessIds: [3, 1] } })
    await advance(5000)
    expect(state.requests).toHaveLength(1)
  })

  it('honors a custom debounceMs', async () => {
    const { rerender } = renderHook((props) => useAdvancedReport(props), {
      initialProps: { endpoint: 'orders_v2', filters: FILTERS, debounceMs: 100 }
    })
    rerender({ endpoint: 'orders_v2', filters: { ...FILTERS, app_ids: [7] }, debounceMs: 100 })
    await advance(99)
    expect(state.requests).toHaveLength(1)
    await advance(1)
    expect(state.requests).toHaveLength(2)
  })

  it('drops the answer of an old load (RP-20)', async () => {
    const { result, rerender } = renderHook((props) => useAdvancedReport(props), {
      initialProps: { endpoint: 'orders_v2', filters: FILTERS }
    })
    // A is still in flight when B is launched.
    rerender({ endpoint: 'orders_v2', filters: { ...FILTERS, businessIds: [8] } })
    await advance(600)
    expect(state.requests).toHaveLength(2)
    await respond(1, { error: false, result: ['B'] })
    expect(result.current.data).toEqual(['B'])
    await respond(0, { error: false, result: ['A'] })
    expect(result.current.data).toEqual(['B'])
    expect(result.current.loading).toBe(false)
    expect(result.current.updating).toBe(false)
  })

  it('drops an old answer that arrives while the new one is waiting for the debounce', async () => {
    const { result, rerender } = renderHook((props) => useAdvancedReport(props), {
      initialProps: { endpoint: 'orders_v2', filters: FILTERS }
    })
    rerender({ endpoint: 'orders_v2', filters: { ...FILTERS, businessIds: [8] } })
    await respond(0, { error: false, result: ['A'] })
    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(true)
  })

  it('tells loading (no data yet) from updating (data and a new load)', async () => {
    const { result, rerender } = renderHook((props) => useAdvancedReport(props), {
      initialProps: { endpoint: 'orders_v2', filters: FILTERS }
    })
    expect(result.current).toMatchObject({ loading: true, updating: false, data: null })
    await respond(0, { error: false, result: ['A'] })
    expect(result.current).toMatchObject({ loading: false, updating: false, data: ['A'] })
    rerender({ endpoint: 'orders_v2', filters: { ...FILTERS, businessIds: [8] } })
    expect(result.current).toMatchObject({ loading: false, updating: true, data: ['A'] })
    await advance(600)
    expect(result.current).toMatchObject({ loading: false, updating: true, data: ['A'] })
    await respond(1, { error: false, result: ['B'] })
    expect(result.current).toMatchObject({ loading: false, updating: false, data: ['B'] })
  })

  it('keeps data at null on an API error, shows it, and clears it when retrying', async () => {
    const { result, rerender } = renderHook((props) => useAdvancedReport(props), {
      initialProps: { endpoint: 'orders_v2', filters: FILTERS }
    })
    await respond(0, { error: false, result: ['A'] })
    rerender({ endpoint: 'orders_v2', filters: { ...FILTERS, businessIds: [8] } })
    await advance(600)
    await respond(1, { error: true, result: 'The report is not available' })
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBe('The report is not available')
    expect(result.current.loading).toBe(false)
    expect(result.current.updating).toBe(false)

    act(() => { result.current.retry() })
    // Retry does not wait for the debounce.
    expect(state.requests).toHaveLength(3)
    expect(state.requests[2].url).toBe(state.requests[1].url)
    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(true)
    await respond(2, { error: false, result: ['C'] })
    expect(result.current).toMatchObject({ data: ['C'], error: null, loading: false })
  })

  it('exposes a network failure as the Error', async () => {
    const { result } = renderHook(() => useAdvancedReport({ endpoint: 'orders_v2', filters: FILTERS }))
    const failure = new Error('Network down')
    await fail(0, failure)
    expect(result.current.error).toBe(failure)
    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('returns data1 and error1 of the second request on their own', async () => {
    const { result } = renderHook(() => useAdvancedReport({
      endpoint: 'sites_sales_average',
      endpoint1: 'order_types_sales_average',
      filters: FILTERS
    }))
    expect(state.requests).toHaveLength(2)
    state.requests[0].resolve({ json: async () => ({ error: false, result: ['one'] }) })
    state.requests[1].resolve({ json: async () => ({ error: true, result: 'second failed' }) })
    await flush()
    expect(result.current.data).toEqual(['one'])
    expect(result.current.data1).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.error1).toBe('second failed')
  })

  it('does not ask while the session is loading, and asks as soon as it is ready', async () => {
    state.session = { token: undefined, loading: true }
    const { result, rerender } = renderHook((props) => useAdvancedReport(props), {
      initialProps: { endpoint: 'orders_v2', filters: FILTERS }
    })
    expect(state.requests).toHaveLength(0)
    expect(result.current.loading).toBe(true)
    state.session = { token: 'tok', loading: false }
    rerender({ endpoint: 'orders_v2', filters: FILTERS })
    expect(state.requests).toHaveLength(1)
  })

  it('does not apply an answer after the report is closed', async () => {
    const { result, rerender } = renderHook((props) => useAdvancedReport(props), {
      initialProps: { endpoint: 'orders_v2', filters: FILTERS, enabled: true }
    })
    rerender({ endpoint: 'orders_v2', filters: FILTERS, enabled: false })
    await respond(0, { error: false, result: ['A'] })
    expect(result.current.data).toBeNull()
  })

  // redesign ecommerce FC (A3): `buildParams` lets a report (clicks) write its own query string
  it('uses the query string of buildParams for both requests when it is given', () => {
    const buildParams = vi.fn((filters) => `custom=${filters.from}`)
    renderHook(() => useAdvancedReport({
      endpoint: 'tracking_events',
      endpoint1: 'second',
      filters: FILTERS,
      buildParams
    }))
    expect(buildParams).toHaveBeenCalledWith(FILTERS)
    expect(state.requests).toHaveLength(2)
    expect(state.requests[0].url).toBe(`${ROOT}/reports/tracking_events?custom=2026-10-03`)
    expect(state.requests[1].url).toBe(`${ROOT}/reports/second?custom=2026-10-03`)
  })

  it('reloads when the string of buildParams changes, not when only the unused filters do', async () => {
    const buildParams = (filters) => `from=${filters.from}`
    const { rerender } = renderHook((props) => useAdvancedReport(props), {
      initialProps: { endpoint: 'tracking_events', filters: FILTERS, buildParams }
    })
    await respond(0, { error: false, result: [] })
    rerender({ endpoint: 'tracking_events', filters: { ...FILTERS, businessIds: [99] }, buildParams })
    await advance(5000)
    expect(state.requests).toHaveLength(1)
    rerender({ endpoint: 'tracking_events', filters: { ...FILTERS, from: '2026-10-04' }, buildParams })
    await advance(600)
    expect(state.requests).toHaveLength(2)
    expect(state.requests[1].url).toBe(`${ROOT}/reports/tracking_events?from=2026-10-04`)
  })

  it('keeps the default query string without buildParams', () => {
    renderHook(() => useAdvancedReport({ endpoint: 'orders_v2', filters: FILTERS }))
    expect(state.requests[0].url).toBe(`${ROOT}/reports/orders_v2?${buildReportParams(FILTERS)}`)
  })
})
