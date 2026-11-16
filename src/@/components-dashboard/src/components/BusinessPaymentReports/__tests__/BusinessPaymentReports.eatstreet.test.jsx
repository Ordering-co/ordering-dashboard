/* eslint-disable import/first */
import React from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// redesign business-payments FA (R9, T5): the legacy EatStreet reports. Same host, same bodies and same sequence
// (import, then list) as BPR:396-445, 541-590, 661-706. `fetch` is simulated; the UI component records its props.
// (D-17 a): the import runs when the Legacy Reports TAB is opened with a store chosen, not when the store is chosen.

const session = vi.hoisted(() => ({ value: null }))
const ordering = vi.hoisted(() => ({ value: null }))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [session.value] }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [ordering.value] }))
// The URL helpers of the UI barrel without the barrel (it loads the whole app): the same `replaceState` logic, minus the change event
vi.mock('../../../ui/src/utils', async () => {
  const { addQueryToUrl, removeQueryToUrl } = await import('../../../ui/src/utils/queryString')
  return { addQueryToUrl, removeQueryToUrl }
})

import { BusinessPaymentReports } from '..'

const ROOT = 'https://apiv4.example.test/v1/en/orderingv1'
const EXT = 'https://eatstreet-payment-reports.plugins.orderingplus.com'
const STORE = { id: 2, name: 'Fast Bite', external_id: 'EXT-9' }
const REPORTS = [{ id: 501, num_orders: 4 }, { id: 502, num_orders: 9 }]

const state = {
  calls: [],
  plugin: null,
  ext: null,
  business: null
}

const deferred = () => {
  let resolve
  const promise = new Promise((_resolve) => { resolve = _resolve })
  return { promise, resolve }
}

const json = (body) => Promise.resolve({ ok: true, json: async () => body })

const fetchMock = (url, options) => {
  state.calls.push({ url, options, body: options?.body ? JSON.parse(options.body) : null })
  if (url.startsWith(`${ROOT}/plugins/key/`)) return state.plugin()
  if (url.startsWith(`${ROOT}/business_payment_invoices`)) return json({ error: false, result: [] })
  if (url.startsWith(EXT)) return state.ext(url, state.calls[state.calls.length - 1].body)
  return json({ error: true, result: ['unexpected url ' + url] })
}

const extCalls = () => state.calls.filter(call => call.url.startsWith(EXT))
const extUrls = () => extCalls().map(call => call.url.replace(EXT, ''))

const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0) })
const run = (fn) => act(async () => { fn() })
const openTab = async (ui) => {
  await run(() => ui.current.legacy.setTab('eatstreet'))
  await flush()
}

const mount = async () => {
  const ui = { current: null }
  const UIComponent = (uiProps) => {
    ui.current = uiProps
    return null
  }
  render(<BusinessPaymentReports UIComponent={UIComponent} />)
  await flush()
  return ui
}

const okExt = (url, body) => {
  if (url.endsWith('/api/reports/list')) {
    return json({ data: REPORTS, pagination: { total_pages: 3, page: body.query.page } })
  }
  return json({ error: false })
}

beforeEach(() => {
  vi.useFakeTimers()
  window.history.replaceState(null, '', '/intelligence/business-payments')
  state.calls = []
  state.plugin = () => json({ error: false, result: { key: 'eatstreet_payment_reports' } })
  state.ext = okExt
  state.business = (id) => ({ content: { error: false, result: { id, name: 'Fast Bite', external_id: 'EXT-9' } } })
  session.value = { token: 'token-1' }
  ordering.value = {
    root: ROOT,
    project: 'orderingv1',
    setAccessToken: () => ({
      businesses: (id) => {
        // `businesses()` with no id is the one small read of the page on load (b): two stores, nothing is chosen
        const chain = {
          asDashboard: () => chain,
          select: () => chain,
          where: () => chain,
          get: async () => (id == null ? { content: { error: false, result: [STORE, { id: 8, name: 'Burger Barn', external_id: null }], pagination: { total: 2 } } } : state.business(id))
        }
        return chain
      }
    })
  }
  vi.stubGlobal('fetch', vi.fn(fetchMock))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('BusinessPaymentReports: legacy EatStreet reports', () => {
  it('imports and then lists, with the project in the body and the token, and gives the reports and the pagination', async () => {
    const ui = await mount()
    await run(() => ui.current.business.select(STORE))
    await flush()
    await openTab(ui)
    expect(extUrls()).toEqual(['/api/reports/import/restaurant/EXT-9', '/api/reports/list'])
    expect(extCalls().map(call => call.options.method)).toEqual(['POST', 'POST'])
    expect(extCalls()[0].options.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer token-1' })
    expect(extCalls()[0].body).toEqual({ query: { project: 'orderingv1' } })
    expect(extCalls()[1].body).toEqual({ query: { project: 'orderingv1', restaurant_id: 'EXT-9', page: 1, per_page: 10 } })
    expect(ui.current.legacy).toMatchObject({ available: true, tab: 'eatstreet', importing: false, importError: null, page: 1, pageSize: 10 })
    expect(ui.current.legacy.list).toEqual({ loading: false, reports: REPORTS, error: null, pagination: { total_pages: 3, page: 1 } })
  })

  it('is importing, and not yet listing, while the import is out', async () => {
    const gate = deferred()
    state.ext = (url, body) => (url.includes('/import/') ? gate.promise : okExt(url, body))
    const ui = await mount()
    await run(() => ui.current.business.select(STORE))
    await run(() => ui.current.legacy.setTab('eatstreet'))
    expect(ui.current.legacy.importing).toBe(true)
    expect(extUrls()).toEqual(['/api/reports/import/restaurant/EXT-9'])
    await run(() => gate.resolve({ ok: true, json: async () => ({ error: false }) }))
    await flush()
    expect(extUrls()).toEqual(['/api/reports/import/restaurant/EXT-9', '/api/reports/list'])
    expect(ui.current.legacy.importing).toBe(false)
  })

  it('a failed import is `importError` and the list is not asked', async () => {
    state.ext = () => json({ error: true, result: ['Import refused'] })
    const ui = await mount()
    await run(() => ui.current.business.select(STORE))
    await openTab(ui)
    expect(extUrls()).toEqual(['/api/reports/import/restaurant/EXT-9'])
    expect(ui.current.legacy).toMatchObject({ importing: false, importError: ['Import refused'] })
    expect(ui.current.legacy.list.reports).toEqual([])
  })

  it('an import that throws gives [message]', async () => {
    state.ext = () => Promise.reject(new Error('Host down'))
    const ui = await mount()
    await run(() => ui.current.business.select(STORE))
    await openTab(ui)
    expect(ui.current.legacy.importError).toEqual(['Host down'])
  })

  it('a failed list is `list.error` with no reports; a list that throws gives [message]', async () => {
    state.ext = (url, body) => (url.endsWith('/api/reports/list') ? json({ error: true, result: ['List refused'] }) : okExt(url, body))
    const ui = await mount()
    await run(() => ui.current.business.select(STORE))
    await openTab(ui)
    expect(ui.current.legacy.list).toEqual({ loading: false, reports: [], error: ['List refused'], pagination: null })

    state.ext = (url, body) => (url.endsWith('/api/reports/list') ? Promise.reject(new Error('Boom')) : okExt(url, body))
    await run(() => ui.current.business.select(STORE))
    await openTab(ui)
    expect(ui.current.legacy.list).toEqual({ loading: false, reports: [], error: ['Boom'], pagination: null })
  })

  it('changing the page imports and lists again with that page; changing the size goes back to page 1 with that size', async () => {
    const ui = await mount()
    await run(() => ui.current.business.select(STORE))
    await openTab(ui)
    state.calls = []
    await run(() => ui.current.legacy.setPage(2))
    await flush()
    expect(extUrls()).toEqual(['/api/reports/import/restaurant/EXT-9', '/api/reports/list'])
    expect(extCalls()[1].body.query).toEqual({ project: 'orderingv1', restaurant_id: 'EXT-9', page: 2, per_page: 10 })
    expect(ui.current.legacy.page).toBe(2)

    state.calls = []
    await run(() => ui.current.legacy.setPageSize(25))
    await flush()
    expect(extUrls()).toEqual(['/api/reports/import/restaurant/EXT-9', '/api/reports/list'])
    expect(extCalls()[1].body.query).toEqual({ project: 'orderingv1', restaurant_id: 'EXT-9', page: 1, per_page: 25 })
    expect(ui.current.legacy).toMatchObject({ page: 1, pageSize: 25 })
  })

  it('changing the page of a store with no external_id asks nothing', async () => {
    const ui = await mount()
    await run(() => ui.current.business.select({ id: 8, name: 'Burger Barn', external_id: null }))
    await flush()
    state.calls = []
    await run(() => ui.current.legacy.setPage(2))
    await run(() => ui.current.legacy.setPageSize(25))
    expect(state.calls).toHaveLength(0)
  })

  it('(a) choosing a store on the default tab asks EatStreet nothing, even with the plugin and an external_id', async () => {
    const ui = await mount()
    await run(() => ui.current.business.select(STORE))
    await flush()
    expect(extUrls()).toEqual([])
    expect(ui.current.legacy).toMatchObject({ available: true, tab: 'platform', importing: false })
    expect(ui.current.legacy.list).toEqual({ loading: false, reports: [], error: null, pagination: null })
  })

  it('(a) opening the tab asks once (import, then list); going back and opening it again asks nothing more', async () => {
    const ui = await mount()
    await run(() => ui.current.business.select(STORE))
    await flush()
    await run(() => ui.current.legacy.setTab('eatstreet'))
    await flush()
    expect(extUrls()).toEqual(['/api/reports/import/restaurant/EXT-9', '/api/reports/list'])
    state.calls = []
    await run(() => ui.current.legacy.setTab('platform'))
    await run(() => ui.current.legacy.setTab('eatstreet'))
    await flush()
    expect(state.calls).toHaveLength(0)
    expect(ui.current.legacy.list.reports).toEqual(REPORTS)
  })

  it('(a) choosing another store resets the tab to Reports and asks EatStreet nothing until the tab is opened again', async () => {
    const ui = await mount()
    await run(() => ui.current.business.select(STORE))
    await openTab(ui)
    state.calls = []
    await run(() => ui.current.business.select({ id: 5, name: 'Taco Town', external_id: 'EXT-5' }))
    await flush()
    expect(ui.current.legacy.tab).toBe('platform')
    expect(extUrls()).toEqual([])
    await openTab(ui)
    expect(extUrls()).toEqual(['/api/reports/import/restaurant/EXT-5', '/api/reports/list'])
  })

  it('(a) a failed import is tried again when the tab is opened again', async () => {
    state.ext = () => json({ error: true, result: ['Import refused'] })
    const ui = await mount()
    await run(() => ui.current.business.select(STORE))
    await openTab(ui)
    expect(extUrls()).toEqual(['/api/reports/import/restaurant/EXT-9'])
    await run(() => ui.current.legacy.setTab('platform'))
    state.calls = []
    await openTab(ui)
    expect(extUrls()).toEqual(['/api/reports/import/restaurant/EXT-9'])
  })

  it('(a) the tab opened for a store with no external_id, or without the plugin, asks nothing', async () => {
    const ui = await mount()
    await run(() => ui.current.business.select({ id: 8, name: 'Burger Barn', external_id: null }))
    await openTab(ui)
    expect(extUrls()).toEqual([])
  })

  it('the answer of the store chosen before, arriving late, is discarded', async () => {
    const first = deferred()
    state.ext = (url, body) => {
      if (url.includes('/import/EXT-1')) return first.promise
      return okExt(url, body)
    }
    const ui = await mount()
    await run(() => ui.current.business.select({ id: 1, name: 'Old', external_id: 'EXT-1' }))
    await run(() => ui.current.legacy.setTab('eatstreet'))
    await run(() => ui.current.business.select({ id: 2, name: 'New', external_id: 'EXT-2' }))
    await openTab(ui)
    expect(ui.current.legacy.list.reports).toEqual(REPORTS)
    await run(() => first.resolve({ ok: true, json: async () => ({ error: true, result: ['late'] }) }))
    await flush()
    expect(ui.current.legacy.importError).toBeNull()
    expect(ui.current.legacy.list.reports).toEqual(REPORTS)
  })
})

describe('BusinessPaymentReports: legacy reports from the URL (BPR:661-706)', () => {
  it('(a) ?business_id= with the plugin installed asks the invoices and not EatStreet; opening the tab imports and lists once', async () => {
    window.history.replaceState(null, '', '/intelligence/business-payments?business_id=2')
    const ui = await mount()
    const kinds = () => state.calls.map(call => (call.url.startsWith(EXT) ? call.url.replace(EXT, '') : call.url.replace(ROOT, '').split('?')[0]))
    expect(kinds()).toEqual(['/plugins/key/eatstreet_payment_reports', '/business_payment_invoices'])
    expect(ui.current.legacy.tab).toBe('platform')
    await openTab(ui)
    expect(kinds()).toEqual([
      '/plugins/key/eatstreet_payment_reports',
      '/business_payment_invoices',
      '/api/reports/import/restaurant/EXT-9',
      '/api/reports/list'
    ])
    expect(ui.current.legacy.list.reports).toEqual(REPORTS)
  })

  it('?business_id= and ?ext_report_id= open the legacy tab and the panel', async () => {
    window.history.replaceState(null, '', '/intelligence/business-payments?business_id=2&ext_report_id=501')
    const ui = await mount()
    expect(ui.current.legacy.tab).toBe('eatstreet')
    expect(ui.current.legacyDetail.reportId).toBe('501')
    expect(extUrls()).toEqual(['/api/reports/import/restaurant/EXT-9', '/api/reports/list'])
  })

  it('if the plugin check ends after the store is loaded, the legacy reports are fetched then, once', async () => {
    window.history.replaceState(null, '', '/intelligence/business-payments?business_id=2&ext_report_id=501')
    const gate = deferred()
    state.plugin = () => gate.promise
    const ui = await mount()
    expect(ui.current.business.selected.id).toBe(2)
    expect(extUrls()).toEqual([])
    await run(() => gate.resolve({ ok: true, json: async () => ({ error: false, result: { key: 'eatstreet_payment_reports' } }) }))
    await flush()
    expect(extUrls()).toEqual(['/api/reports/import/restaurant/EXT-9', '/api/reports/list'])
    expect(ui.current.legacy.tab).toBe('eatstreet')
    expect(ui.current.legacy.list.reports).toEqual(REPORTS)
  })

  it('without the plugin, ?business_id= never asks EatStreet', async () => {
    window.history.replaceState(null, '', '/intelligence/business-payments?business_id=2')
    state.plugin = () => json({ error: true, result: 'Error finding plugin' })
    const ui = await mount()
    expect(extUrls()).toEqual([])
    expect(ui.current.legacy.available).toBe(false)
  })

  it('a store with no external_id never asks EatStreet', async () => {
    window.history.replaceState(null, '', '/intelligence/business-payments?business_id=2')
    state.business = (id) => ({ content: { error: false, result: { id, name: 'Fast Bite', external_id: null } } })
    const ui = await mount()
    expect(extUrls()).toEqual([])
    expect(ui.current.legacy.available).toBe(false)
  })
})
