import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'

// redesign home FB (D2, D4, D5, D9, HM-01, HM-11, HM-14, auditor 5, 6, 9, 10)

const ROOT = 'http://api/v400/en/development'
const session = vi.hoisted(() => ({ value: null }))
const ordering = vi.hoisted(() => ({ value: null }))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [session.value] }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [ordering.value] }))

import { Home } from '../index'

// "Now" is Friday 2026-10-09 15:30 local time
const NOW = new Date(2026, 9, 9, 15, 30)
const LAPSE = {
  today: 'today',
  lastWeek: '2026-10-02,2026-10-02',
  trend: '2026-09-09,2026-10-08',
  previous: '2026-08-10,2026-09-08'
}

const ok = (result, pagination) => ({ error: false, result, ...(pagination ? { pagination } : {}) })
const fail = (result = ['boom']) => ({ error: true, result })

/** A project with orders in the window: the guide is not asked for. */
const defaultReports = () => ({
  'sales|today': [
    { time: '2026-10-09 10:00:00', sales: 50 },
    { time: '2026-10-09 12:00:00', sales: 42.5 }
  ],
  'orders|today': [
    { time: '2026-10-09 10:00:00', orders: 2 },
    { time: '2026-10-09 12:00:00', orders: 1 }
  ],
  'orders_status|today': [{ status: 7, orders: 2 }, { status: 2, orders: 1 }],
  'sales|2026-10-02,2026-10-02': [
    { time: '2026-10-02 10:00:00', sales: 10 },
    { time: '2026-10-02 14:00:00', sales: 20 },
    { time: '2026-10-02 16:00:00', sales: 40 }
  ],
  'orders|2026-10-02,2026-10-02': [
    { time: '2026-10-02 10:00:00', orders: 1 },
    { time: '2026-10-02 14:00:00', orders: 2 },
    { time: '2026-10-02 16:00:00', orders: 4 }
  ],
  'orders_status|2026-10-02,2026-10-02': [{ status: 7, orders: 6 }, { status: 6, orders: 1 }],
  'sales|2026-09-09,2026-10-08': [
    { time: '2026-09-20 00:00:00', sales: 30 },
    { time: '2026-10-01 00:00:00', sales: 100 },
    { time: '2026-10-05 00:00:00', sales: 50 }
  ],
  'sales|2026-08-10,2026-09-08': [{ time: '2026-08-15 00:00:00', sales: 100 }]
})

const mockApi = ({ reports = {}, overrides = () => undefined, orders = ok([], { total: 0 }) } = {}) => {
  const data = { ...defaultReports(), ...reports }
  const calls = []
  const handler = vi.fn(async (input) => {
    const url = new URL(input)
    const path = url.pathname.replace('/v400/en/development', '')
    calls.push({ url: input, path, params: url.searchParams })
    const custom = overrides(path, url)
    if (custom !== undefined) {
      if (custom instanceof Error) throw custom
      return { json: async () => custom }
    }
    if (path.startsWith('/reports/')) {
      const key = `${path.replace('/reports/', '')}|${url.searchParams.get('lapse')}`
      return { json: async () => ok(data[key] || []) }
    }
    if (path === '/orders') return { json: async () => orders }
    return { json: async () => ok([]) }
  })
  vi.stubGlobal('fetch', handler)
  return { handler, calls, reportCalls: () => calls.filter(call => call.path.startsWith('/reports/')) }
}

const renderHome = (props = {}) => {
  const ui = { current: null }
  const renders = []
  const UIComponent = (uiProps) => { ui.current = uiProps; renders.push(uiProps); return null }
  const view = render(<Home UIComponent={UIComponent} attentionKeys={[]} sites={[]} {...props} />)
  return { ui, renders, ...view }
}

const settled = (ui) => waitFor(() => {
  expect(ui.current.today.loading).toBe(false)
  expect(ui.current.trend.loading).toBe(false)
  expect(ui.current.attention.loading).toBe(false)
})

describe('Home controller', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    session.value = { token: 'tok', user: { id: 7, level: 0 }, loading: false }
    ordering.value = { root: ROOT, project: 'acme' }
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('requests', () => {
    it('sends the browser time zone on every report and the lapse of each window (HM-11, D5)', async () => {
      const api = mockApi()
      const { ui } = renderHome()
      await settled(ui)

      const reports = api.reportCalls()
      expect(reports).toHaveLength(8)
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
      reports.forEach(call => expect(call.params.get('timezone')).toBe(zone))
      const lapses = (type) => reports.filter(call => call.path === `/reports/${type}`).map(call => call.params.get('lapse')).sort()
      expect(lapses('sales')).toEqual([LAPSE.previous, LAPSE.lastWeek, LAPSE.trend, LAPSE.today].sort())
      expect(lapses('orders')).toEqual([LAPSE.lastWeek, LAPSE.today].sort())
      expect(lapses('orders_status')).toEqual([LAPSE.lastWeek, LAPSE.today].sort())
    })

    // Sales, orders, the ticket and the trend are asked without the cancelled orders, as Business Intelligence does
    it('asks sales and orders without cancelled orders, and only them', async () => {
      const api = mockApi()
      const { ui } = renderHome()
      await settled(ui)

      api.reportCalls().forEach(call => {
        const expected = call.path === '/reports/sales' || call.path === '/reports/orders' ? '1' : null
        expect(call.params.get('exclude_cancelled'), call.url).toBe(expected)
      })
      expect(api.reportCalls().filter(call => call.params.get('exclude_cancelled') === '1')).toHaveLength(6)
    })

    // an API deployed before `exclude_cancelled` ignores it; each figure is in the base its report came in, and a figure is
    // never put next to one in the other base
    const marked = (only) => {
      const data = defaultReports()
      return (path, url) => {
        const type = path.replace('/reports/', '')
        const lapse = url.searchParams.get('lapse')
        if ((type !== 'sales' && type !== 'orders') || (only && !only(type, lapse))) return undefined
        return { error: false, result: data[`${type}|${lapse}`] || [], exclude_cancelled: true }
      }
    }

    it('with every report marked, today and its references leave the cancelled orders out', async () => {
      mockApi({ overrides: marked() })
      const { ui } = renderHome()
      await settled(ui)
      const { today, trend } = ui.current
      expect(today.excludesCancelled).toEqual({ sales: true, orders: true })
      expect(today.averageTicket).not.toBeNull()
      expect(today.lastWeek.byNow.sales).not.toBeNull()
      expect(today.lastWeek.fullDay.averageTicket).not.toBeNull()
      expect(trend.previous.length).toBeGreaterThan(0)
      expect(trend.monthTotal).not.toBeNull()
    })

    it('without any mark, everything keeps the cancelled orders as before', async () => {
      mockApi()
      const { ui } = renderHome()
      await settled(ui)
      expect(ui.current.today.excludesCancelled).toEqual({ sales: false, orders: false })
      expect(ui.current.today.averageTicket).not.toBeNull()
      expect(ui.current.trend.monthTotal).not.toBeNull()
    })

    it('mixed answers: a reference or a ticket across two bases is null, the figures stay', async () => {
      mockApi({ overrides: marked((type, lapse) => type === 'sales' && lapse === LAPSE.today) })
      const { ui } = renderHome()
      await settled(ui)
      const { today } = ui.current
      expect(today.excludesCancelled).toEqual({ sales: true, orders: false })
      expect(today.sales).toBeGreaterThan(0)
      expect(today.orders).toBeGreaterThan(0)
      expect(today.averageTicket).toBeNull()
      expect(today.lastWeek.byNow.sales).toBeNull()
      expect(today.lastWeek.fullDay.sales).toBeNull()
      expect(today.lastWeek.fullDay.averageTicket).toBeNull()
      expect(today.lastWeek.byNow.orders).not.toBeNull()
      expect(today.lastWeek.fullDay.orders).not.toBeNull()
      // the 30-day trend came unmarked, today's sales marked: no month figure mixing them
      expect(ui.current.trend.monthTotal).toBeNull()
    })

    it('mixed answers in the trend: 30 days in another base than the 30 before have no previous series nor change', async () => {
      mockApi({ overrides: marked((type, lapse) => type === 'sales' && lapse === LAPSE.trend) })
      const { ui } = renderHome()
      await settled(ui)
      expect(ui.current.trend.previous).toEqual([])
      expect(ui.current.trend.change).toBeNull()
      expect(ui.current.trend.total).toBeGreaterThan(0)
    })

    it('GETs with the bearer token', async () => {
      const api = mockApi()
      const { ui } = renderHome()
      await settled(ui)
      const [, options] = api.handler.mock.calls[0]
      expect(options.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer tok' })
      expect(options.method).toBe('GET')
    })

    it('asks for nothing while the session is loading', async () => {
      const api = mockApi()
      session.value = { token: null, user: null, loading: true }
      const { ui, rerender } = renderHome()
      await act(async () => { await Promise.resolve() })
      expect(api.handler).not.toHaveBeenCalled()

      session.value = { token: 'tok', user: { id: 7, level: 0 }, loading: false }
      const UIComponent = (uiProps) => { ui.current = uiProps; return null }
      rerender(<Home UIComponent={UIComponent} attentionKeys={[]} sites={[]} />)
      await settled(ui)
      expect(api.reportCalls()).toHaveLength(8)
    })

    it('does not write state after unmounting', async () => {
      let release
      const gate = new Promise(resolve => { release = resolve })
      vi.stubGlobal('fetch', vi.fn(async () => { await gate; return { json: async () => ok([]) } }))
      const { renders, unmount } = renderHome()
      const before = renders.length
      unmount()
      await act(async () => { release(); await gate })
      expect(renders.length).toBe(before)
    })

    it('does not pass what the new page does not paint (HM-02)', async () => {
      mockApi()
      const { ui } = renderHome({ extra: 'kept' })
      await settled(ui)
      expect(ui.current.extra).toBe('kept')
      ;['taskList', 'handleUpdateTaskList', 'ordersList', 'todaySalelsList', 'getCurrentDateRange'].forEach(name => {
        expect(ui.current[name]).toBeUndefined()
      })
    })
  })

  describe('today', () => {
    it('adds sales, orders and cancelled, and the average ticket (HM-16)', async () => {
      mockApi()
      const { ui } = renderHome()
      await settled(ui)
      const { today } = ui.current
      expect(today.error).toBeNull()
      expect(today.sales).toBeCloseTo(92.5)
      expect(today.orders).toBe(3)
      expect(today.cancelled).toBe(1)
      expect(today.averageTicket).toBeCloseTo(92.5 / 3)
    })

    it('«last Thursday at this hour» reads the rows up to the current hour (D2)', async () => {
      mockApi()
      const { ui } = renderHome()
      await settled(ui)
      const { lastWeek } = ui.current.today
      expect(lastWeek.day).toBe('2026-10-02')
      // now is 15:30: the 10:00 and 14:00 rows count, the 16:00 one does not
      expect(lastWeek.byNow).toEqual({ sales: 30, orders: 3 })
      expect(lastWeek.fullDay.sales).toBe(70)
      expect(lastWeek.fullDay.orders).toBe(7)
      expect(lastWeek.fullDay.cancelled).toBe(1)
      expect(lastWeek.fullDay.averageTicket).toBe(10)
    })

    it('ticket is null without orders', async () => {
      mockApi({ reports: { 'sales|today': [], 'orders|today': [] } })
      const { ui } = renderHome()
      await settled(ui)
      expect(ui.current.today.orders).toBe(0)
      expect(ui.current.today.averageTicket).toBeNull()
    })

    it('an error puts error on today and reloadToday asks again', async () => {
      let broken = true
      const api = mockApi({ overrides: (path, url) => (broken && path === '/reports/orders_status' && url.searchParams.get('lapse') === 'today' ? fail() : undefined) })
      const { ui } = renderHome()
      await settled(ui)
      expect(ui.current.today.error).toBeTruthy()
      expect(ui.current.trend.error).toBeNull()

      broken = false
      const before = api.reportCalls().length
      await act(async () => { ui.current.reloadToday() })
      await waitFor(() => expect(ui.current.today.error).toBeNull())
      expect(api.reportCalls().length - before).toBe(6)
      expect(ui.current.today.cancelled).toBe(1)
    })
  })

  describe('trend', () => {
    it('gives 30 closed days aligned with the 30 before, with totals and change', async () => {
      mockApi()
      const { ui } = renderHome()
      await settled(ui)
      const { trend } = ui.current
      expect(trend.error).toBeNull()
      expect(trend.days).toHaveLength(30)
      expect(trend.days[0]).toBe('2026-09-09')
      expect(trend.days[29]).toBe('2026-10-08')
      expect(trend.current).toHaveLength(30)
      expect(trend.previous).toHaveLength(30)
      expect(trend.current[trend.days.indexOf('2026-10-01')]).toBe(100)
      expect(trend.current[trend.days.indexOf('2026-10-02')]).toBe(0)
      // 2026-08-15 is the 6th day of the previous window, aligned by index with 2026-09-14
      expect(trend.previous[5]).toBe(100)
      expect(trend.total).toBe(180)
      expect(trend.previousTotal).toBe(100)
      expect(trend.change).toBe(80)
    })

    it('change is null when the previous 30 days sold nothing', async () => {
      mockApi({ reports: { 'sales|2026-08-10,2026-09-08': [] } })
      const { ui } = renderHome()
      await settled(ui)
      expect(ui.current.trend.previousTotal).toBe(0)
      expect(ui.current.trend.change).toBeNull()
    })

    it('monthTotal is the days of this month in the window plus today', async () => {
      mockApi()
      const { ui } = renderHome()
      await settled(ui)
      // 100 (Oct 1) + 50 (Oct 5) + today 92.5; the 30 of September is not this month
      expect(ui.current.trend.monthTotal).toBeCloseTo(242.5)
    })

    it('monthTotal is null when today failed', async () => {
      mockApi({ overrides: (path, url) => (path === '/reports/sales' && url.searchParams.get('lapse') === 'today' ? fail() : undefined) })
      const { ui } = renderHome()
      await settled(ui)
      expect(ui.current.today.error).toBeTruthy()
      expect(ui.current.trend.monthTotal).toBeNull()
    })

    it('on the 1st of the month the month is only today (monthTotal; the Intercom series is the last 30 days)', async () => {
      vi.setSystemTime(new Date(2026, 9, 1, 15, 30))
      mockApi({
        reports: {
          'sales|2026-09-01,2026-09-30': [{ time: '2026-09-12 00:00:00', sales: 9 }]
        }
      })
      const { ui } = renderHome()
      await settled(ui)
      expect(ui.current.trend.days[29]).toBe('2026-09-30')
      expect(ui.current.trend.monthTotal).toBeCloseTo(92.5)
      // n.º 13: Intercom gets the 30 closed days, not the month: on the 1st that is the days of September, not today
      expect(ui.current.last30SalesList.sales).toEqual([{ time: '2026-09-12 00:00:00', sales: 9 }])
    })

    it('reloadTrend asks the two windows again', async () => {
      const api = mockApi()
      const { ui } = renderHome()
      await settled(ui)
      const before = api.reportCalls().length
      await act(async () => { ui.current.reloadTrend() })
      await waitFor(() => expect(api.reportCalls().length - before).toBe(2))
      await waitFor(() => expect(ui.current.trend.loading).toBe(false))
    })
  })

  describe('last30SalesList (Intercom)', () => {
    // n.º 13: the series is the 30 closed days of the trend window (the days whose sum is Home's 30-day total), only the days
    // with sales as before, in the `{ time, sales }` shape Intercom already holds as the type of project_sales_last_30_days
    it('is the series of the last 30 closed days: the days of the trend window with sales, today left out', async () => {
      mockApi()
      const { ui } = renderHome()
      await settled(ui)
      const { last30SalesList } = ui.current
      expect(last30SalesList.loading).toBe(false)
      expect(last30SalesList.error).toBeNull()
      expect(last30SalesList.sales).toEqual([
        { time: '2026-09-20 00:00:00', sales: 30 },
        { time: '2026-10-01 00:00:00', sales: 100 },
        { time: '2026-10-05 00:00:00', sales: 50 }
      ])
      expect(last30SalesList.sales.some(item => item.time.startsWith('2026-10-09'))).toBe(false)
      expect(last30SalesList.sales.every(item => item.time >= '2026-09-09' && item.time < '2026-10-09')).toBe(true)
      expect(last30SalesList.sales.every(item => item.sales > 0)).toBe(true)
      expect(last30SalesList.sales.reduce((total, item) => total + item.sales, 0)).toBe(ui.current.trend.total)
    })

    it('a month that started 5 days ago still sends all the 30 days of the window', async () => {
      vi.setSystemTime(new Date(2026, 9, 6, 15, 30))
      const rows = Array.from({ length: 30 }, (_, index) => {
        const date = new Date(2026, 8, 6 + index)
        const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        return { time: `${day} 00:00:00`, sales: index + 1 }
      })
      mockApi({ reports: { 'sales|2026-09-06,2026-10-05': rows } })
      const { ui } = renderHome()
      await settled(ui)
      expect(ui.current.trend.days[0]).toBe('2026-09-06')
      expect(ui.current.trend.days[29]).toBe('2026-10-05')
      const { sales } = ui.current.last30SalesList
      expect(sales).toHaveLength(30)
      expect(sales[0]).toEqual({ time: '2026-09-06 00:00:00', sales: 1 })
      expect(sales[29]).toEqual({ time: '2026-10-05 00:00:00', sales: 30 })
      expect(sales.every(item => item.sales > 0)).toBe(true)
      // only the 5 days of October are "this month", yet all the 30 days go
      expect(sales.filter(item => item.time >= '2026-10-01')).toHaveLength(5)
      expect(sales.reduce((total, item) => total + item.sales, 0)).toBe(ui.current.trend.total)
    })

    // n.º 13: Intercom fixes the type of a custom attribute on first receipt; the shape stays an array of `{ time, sales }`
    it('keeps the shape Intercom already holds: an array of exactly { time: "YYYY-MM-DD 00:00:00", sales: number }', async () => {
      mockApi()
      const { ui } = renderHome()
      await settled(ui)
      const { sales } = ui.current.last30SalesList
      expect(Array.isArray(sales)).toBe(true)
      expect(sales.length).toBeGreaterThan(0)
      sales.forEach(item => {
        expect(Object.keys(item).sort()).toEqual(['sales', 'time'])
        expect(typeof item.time).toBe('string')
        expect(item.time).toMatch(/^\d{4}-\d{2}-\d{2} 00:00:00$/)
        expect(typeof item.sales).toBe('number')
      })
    })

    it('is loading until trend and today are in', async () => {
      mockApi()
      const { ui, renders } = renderHome()
      expect(renders[0].last30SalesList.loading).toBe(true)
      await settled(ui)
      expect(ui.current.last30SalesList.loading).toBe(false)
    })

    // redesign home R1 (Q-10, PA-1): as in `main`, a failed month sends nothing to Intercom; the consumer sends only when !loading && !error
    it('HM-14: when the month report fails it stops loading and carries the error, with nothing to send', async () => {
      mockApi({ overrides: (path, url) => (path === '/reports/sales' && url.searchParams.get('lapse') === LAPSE.trend ? fail(['no month']) : undefined) })
      const { ui } = renderHome()
      await settled(ui)
      expect(ui.current.trend.error).toBeTruthy()
      expect(ui.current.last30SalesList).toEqual({ loading: false, error: expect.any(String), sales: [] })
      expect(ui.current.last30SalesList.error).toBeTruthy()
    })

    it('HM-14: a request that throws does not leave it loading either', async () => {
      mockApi({ overrides: (path, url) => (path === '/reports/sales' && url.searchParams.get('lapse') === LAPSE.trend ? new Error('network') : undefined) })
      const { ui } = renderHome()
      await settled(ui)
      // redesign home R1 (Q-10): error present, nothing to send
      expect(ui.current.last30SalesList).toEqual({ loading: false, error: 'network', sales: [] })
    })

    it('HM-14: when today fails it stops loading too', async () => {
      mockApi({ overrides: (path, url) => (path === '/reports/orders' && url.searchParams.get('lapse') === 'today' ? fail() : undefined) })
      const { ui } = renderHome()
      await settled(ui)
      expect(ui.current.today.error).toBeTruthy()
      // redesign home R1 (Q-10): error present, nothing to send
      expect(ui.current.last30SalesList).toEqual({ loading: false, error: expect.any(String), sales: [] })
    })

    // redesign home R1 (Q-10): a failure does not consume the send; the retry that succeeds hands the consumer the series with no error
    it('Q-10: a retry that succeeds replaces the error with the series: loading, then {error: null, sales}', async () => {
      let failing = true
      mockApi({ overrides: (path, url) => (failing && path === '/reports/sales' && url.searchParams.get('lapse') === LAPSE.trend ? fail(['no month']) : undefined) })
      const { ui, renders } = renderHome()
      await settled(ui)
      expect(ui.current.last30SalesList.error).toBeTruthy()
      failing = false
      const before = renders.length
      await act(async () => { ui.current.reloadTrend() })
      await waitFor(() => expect(ui.current.trend.loading).toBe(false))
      const after = renders.slice(before).map(render => render.last30SalesList)
      expect(after.some(list => list.loading === true && list.error === null && list.sales.length === 0)).toBe(true)
      expect(ui.current.last30SalesList.loading).toBe(false)
      expect(ui.current.last30SalesList.error).toBeNull()
      expect(ui.current.last30SalesList.sales.length).toBeGreaterThan(0)
    })

    it('Q-10: it is loading (no error, nothing to send) on the first paint, while today and the trend load', () => {
      mockApi()
      const { renders } = renderHome()
      expect(renders[0].last30SalesList).toEqual({ loading: true, error: null, sales: [] })
    })
  })

  describe('attention', () => {
    it('asks only for the keys it receives and reads pagination.total', async () => {
      const api = mockApi({
        overrides: (path) => {
          if (path === '/orders') return ok([{ id: 1 }], { total: 4 })
          if (path === '/carts/dashboard') return ok([{ id: 1 }], { total: 8 })
          return undefined
        }
      })
      const { ui } = renderHome({ attentionKeys: ['pending', 'failedCarts'] })
      await settled(ui)
      expect(ui.current.attention.error).toBeNull()
      expect(ui.current.attention.counts).toEqual({ pending: 4, failedCarts: 8 })

      const orders = api.calls.filter(call => call.path === '/orders')
      expect(orders).toHaveLength(1)
      expect(orders[0].params.get('mode')).toBe('dashboard')
      expect(orders[0].params.get('params')).toBe('id')
      expect(orders[0].params.get('page')).toBe('1')
      expect(orders[0].params.get('page_size')).toBe('1')
      const where = JSON.parse(orders[0].params.get('where'))
      expect(where.conector).toBe('AND')
      expect(where.conditions.find(item => item.attribute === 'status').value).toEqual([0, 13])
      expect(where.conditions.some(item => item.conector === 'OR' && item.conditions.some(inner => inner.attribute === 'has_items'))).toBe(true)

      const carts = api.calls.filter(call => call.path === '/carts/dashboard')
      expect(carts).toHaveLength(1)
      expect(carts[0].params.get('page_size')).toBe('1')
      expect(JSON.parse(carts[0].params.get('where'))).toEqual([{ attribute: 'status', value: [4] }])
    })

    it('asks nothing with no keys', async () => {
      const api = mockApi()
      const { ui } = renderHome({ attentionKeys: [] })
      await settled(ui)
      expect(api.calls.some(call => call.path === '/orders' || call.path === '/carts/dashboard')).toBe(false)
      expect(ui.current.attention).toEqual({ loading: false, error: null, counts: {} })
    })

    it('asks the three orders rows with their own scope', async () => {
      const api = mockApi({ overrides: (path) => (path === '/orders' ? ok([], { total: 2 }) : undefined) })
      const { ui } = renderHome({ attentionKeys: ['pending', 'late', 'waitingDriver'] })
      await settled(ui)
      expect(ui.current.attention.counts).toEqual({ pending: 2, late: 2, waitingDriver: 2 })
      const wheres = api.calls.filter(call => call.path === '/orders').map(call => JSON.parse(call.params.get('where')))
      expect(wheres).toHaveLength(3)
      expect(wheres.some(where => where.conditions.some(item => item.attribute === 'time_status'))).toBe(true)
      expect(wheres.some(where => where.conditions.some(item => item.attribute === 'driver_company_id'))).toBe(true)
    })

    it('one failure sets error and leaves the others', async () => {
      mockApi({
        overrides: (path) => {
          if (path === '/orders') return ok([], { total: 4 })
          if (path === '/carts/dashboard') return fail()
          return undefined
        }
      })
      const { ui } = renderHome({ attentionKeys: ['pending', 'failedCarts'] })
      await settled(ui)
      expect(ui.current.attention.error).toBeTruthy()
      expect(ui.current.attention.counts).toEqual({ pending: 4 })
    })

    it('reloadAttention asks again', async () => {
      const api = mockApi({ overrides: (path) => (path === '/orders' ? ok([], { total: 1 }) : undefined) })
      const { ui } = renderHome({ attentionKeys: ['pending'] })
      await settled(ui)
      await act(async () => { ui.current.reloadAttention() })
      await waitFor(() => expect(api.calls.filter(call => call.path === '/orders')).toHaveLength(2))
    })
  })

  describe('guide', () => {
    const emptyProject = {
      'sales|2026-09-09,2026-10-08': [],
      'sales|2026-08-10,2026-09-08': [],
      'sales|today': [],
      'orders|today': []
    }
    const guideApi = (extra = () => undefined) => mockApi({
      reports: emptyProject,
      overrides: (path, url) => {
        const custom = extra(path, url)
        if (custom !== undefined) return custom
        if (path === '/business') {
          return ok([
            { id: 1, name: 'A', enabled: false, menus_count: 0, zones: [] },
            { id: 2, name: 'B', enabled: true, menus_count: 3, zones: [{ id: 9 }] }
          ])
        }
        if (/^\/business\/\d+\/paymethods$/.test(path)) return ok([{ id: 1, enabled: true }])
        if (path === '/users') return ok([{ id: 4 }], { total: 17 })
        return undefined
      }
    })

    it('with orders in the window it asks nothing for the guide', async () => {
      const api = mockApi()
      const { ui } = renderHome()
      await settled(ui)
      expect(ui.current.guide.eligible).toBe(false)
      expect(ui.current.guide.loading).toBe(false)
      expect(api.calls.some(call => call.path === '/business' || call.path.includes('/paymethods') || call.path === '/users')).toBe(false)
    })

    it('with orders today only it asks nothing either', async () => {
      const api = mockApi({ reports: { ...emptyProject, 'orders|today': [{ time: '2026-10-09 09:00:00', orders: 1 }] } })
      const { ui } = renderHome()
      await settled(ui)
      expect(ui.current.guide.eligible).toBe(false)
      expect(api.calls.some(call => call.path === '/business')).toBe(false)
    })

    it('without orders it asks stores, payment methods of the enabled ones first, and the drivers (level 0)', async () => {
      const api = guideApi()
      const { ui } = renderHome({ sites: [{ domain: 'shop.acme.com', ssl_process_status: 'ended' }] })
      await settled(ui)
      await waitFor(() => expect(ui.current.guide.loading).toBe(false))
      await waitFor(() => expect(ui.current.guide.steps.length).toBeGreaterThan(0))

      const business = api.calls.find(call => call.path === '/business')
      expect(business.params.get('mode')).toBe('dashboard')
      expect(business.params.get('params')).toBe('id,name,enabled,menus_count,zones')
      expect(business.params.get('page')).toBe('1')
      expect(business.params.get('page_size')).toBe('50')

      const paymethods = api.calls.filter(call => /\/paymethods$/.test(call.path))
      expect(paymethods.map(call => call.path)).toEqual(['/business/2/paymethods', '/business/1/paymethods'])
      expect(paymethods[0].params.get('params')).toBe('sites,devices')

      const users = api.calls.find(call => call.path === '/users')
      expect(users.params.get('params')).toBe('id')
      expect(users.params.get('page_size')).toBe('1')
      expect(JSON.parse(users.params.get('where'))).toEqual({ conditions: [{ attribute: 'level', value: [4] }], conector: 'AND' })

      const { guide } = ui.current
      expect(guide.eligible).toBe(true)
      expect(guide.error).toBeNull()
      expect(guide.requiredCount).toBe(5)
      expect(guide.doneCount).toBe(4)
      const done = Object.fromEntries(guide.steps.map(step => [step.id, step.done]))
      expect(done).toEqual({ store: true, menu: true, zone: true, payment: true, first_order: false, drivers: true, domain: true })
    })

    it('asks the payment methods of 5 stores at most', async () => {
      const api = guideApi((path) => (path === '/business'
        ? ok(Array.from({ length: 8 }, (_, index) => ({ id: index + 1, enabled: true, menus_count: 1, zones: [] })))
        : undefined))
      const { ui } = renderHome()
      await settled(ui)
      await waitFor(() => expect(ui.current.guide.steps.length).toBeGreaterThan(0))
      expect(api.calls.filter(call => /\/paymethods$/.test(call.path))).toHaveLength(5)
    })

    it('level 2 does not ask for drivers and has no optional steps', async () => {
      session.value = { token: 'tok', user: { id: 8, level: 2 }, loading: false }
      const api = guideApi()
      const { ui } = renderHome()
      await settled(ui)
      await waitFor(() => expect(ui.current.guide.steps.length).toBeGreaterThan(0))
      expect(api.calls.some(call => call.path === '/users')).toBe(false)
      expect(ui.current.guide.steps.map(step => step.id)).toEqual(['store', 'menu', 'zone', 'payment', 'first_order'])
    })

    it('a failing store request puts error on the guide and does not leave it loading', async () => {
      guideApi((path) => (path === '/business' ? fail() : undefined))
      const { ui } = renderHome()
      await settled(ui)
      await waitFor(() => expect(ui.current.guide.error).toBeTruthy())
      expect(ui.current.guide.loading).toBe(false)
    })

    it('hideGuide persists in this browser and survives a new mount; showGuide clears it', async () => {
      guideApi()
      const first = renderHome()
      await settled(first.ui)
      expect(first.ui.current.guide.hidden).toBe(false)

      await act(async () => { first.ui.current.hideGuide() })
      expect(first.ui.current.guide.hidden).toBe(true)
      expect(window.localStorage.getItem('odc-home-guide-hidden:acme:7')).toBeTruthy()
      first.unmount()

      const second = renderHome()
      expect(second.ui.current.guide.hidden).toBe(true)
      await settled(second.ui)
      await act(async () => { second.ui.current.showGuide() })
      expect(second.ui.current.guide.hidden).toBe(false)
      expect(window.localStorage.getItem('odc-home-guide-hidden:acme:7')).toBeNull()
    })

    it('the hidden flag is per project and per user', async () => {
      window.localStorage.setItem('odc-home-guide-hidden:acme:7', '1')
      guideApi()
      session.value = { token: 'tok', user: { id: 99, level: 0 }, loading: false }
      const { ui } = renderHome()
      expect(ui.current.guide.hidden).toBe(false)
      await settled(ui)
    })

    it('survives a localStorage that throws', async () => {
      guideApi()
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied') })
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied') })
      const { ui } = renderHome()
      await settled(ui)
      expect(ui.current.guide.hidden).toBe(false)
      await act(async () => { ui.current.hideGuide() })
      expect(ui.current.guide.hidden).toBe(true)
      await act(async () => { ui.current.showGuide() })
      expect(ui.current.guide.hidden).toBe(false)
    })

    // redesign home R1 (Q-03): the card is reserved from the first paint on a project that already had the guide
    describe('expected (Q-03)', () => {
      const KEY = 'odc-home-guide-eligible:acme:7'

      it('is false on the first paint of a project without a memory, and stays false when it is not eligible', async () => {
        mockApi()
        const { ui, renders } = renderHome()
        expect(renders[0].guide.expected).toBe(false)
        await settled(ui)
        expect(ui.current.guide.expected).toBe(false)
      })

      it('is the remembered eligibility while today and the trend load, and follows eligible after', async () => {
        window.localStorage.setItem(KEY, '1')
        mockApi()
        const { ui, renders } = renderHome()
        expect(renders[0].guide.expected).toBe(true)
        expect(renders[0].guide.eligible).toBe(false)
        await settled(ui)
        // the project has orders now: the memory was wrong, so the reserve goes away
        expect(ui.current.guide.eligible).toBe(false)
        expect(ui.current.guide.expected).toBe(false)
      })

      it('remembers an eligible visit and forgets it when eligible turns false', async () => {
        guideApi()
        const first = renderHome()
        await settled(first.ui)
        await waitFor(() => expect(first.ui.current.guide.steps.length).toBeGreaterThan(0))
        expect(first.ui.current.guide.eligible).toBe(true)
        expect(first.ui.current.guide.expected).toBe(true)
        expect(window.localStorage.getItem(KEY)).toBe('1')
        first.unmount()

        // next visit: the project got its first order
        vi.unstubAllGlobals()
        mockApi()
        const second = renderHome()
        expect(second.renders[0].guide.expected).toBe(true)
        await settled(second.ui)
        expect(second.ui.current.guide.expected).toBe(false)
        expect(window.localStorage.getItem(KEY)).toBeNull()
      })

      it('is per project and per user', async () => {
        window.localStorage.setItem(KEY, '1')
        mockApi()
        session.value = { token: 'tok', user: { id: 99, level: 0 }, loading: false }
        const other = renderHome()
        expect(other.renders[0].guide.expected).toBe(false)
        await settled(other.ui)
        other.unmount()
        session.value = { token: 'tok', user: { id: 7, level: 0 }, loading: false }
        ordering.value = { root: ROOT, project: 'other' }
        const another = renderHome()
        expect(another.renders[0].guide.expected).toBe(false)
        await settled(another.ui)
      })

      it('survives a localStorage that throws', async () => {
        mockApi()
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied') })
        vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied') })
        const { ui, renders } = renderHome()
        expect(renders[0].guide.expected).toBe(false)
        await settled(ui)
        expect(ui.current.guide.expected).toBe(false)
      })
    })
  })
})
