/* eslint-disable import/first */
import React from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// redesign business-payments FA (D2, D5, D6, D8): what the controller of /intelligence/business-payments asks and the
// state it gives the UI. The URLs and parameters are the ones of main (BPR). `fetch` is simulated; the UI component records its props.

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
const TODAY = new Date(2026, 9, 10, 12, 0)

const FAST_BITE = { id: 2, name: 'Fast Bite', external_id: null }
const OTHER_STORE = { id: 8, name: 'Burger Barn', external_id: null }

const INVOICES_2 = [
  { id: 10, business_id: 2, period_start: '2026-09-21 05:00:00', period_end: '2026-09-28 05:00:00', status: 'pending' },
  { id: 12, business_id: 2, period_start: '2026-09-28 05:00:00', period_end: '2026-10-05 05:00:00', status: 'pending' },
  { id: 11, business_id: 2, period_start: '2026-09-21 05:00:00', period_end: '2026-09-28 05:00:00', status: 'paid' }
]
const INVOICES_8 = [{ id: 40, business_id: 8, period_start: '2026-09-28 05:00:00', period_end: '2026-10-05 05:00:00', status: 'pending' }]

const METHODS = [
  { gateway: 'stripe', name: 'Stripe', cycle: 'weekly', cycle_day: 1, cycle_time: '05:00' },
  { gateway: 'ach', name: 'ACH', cycle: 'weekly', cycle_day: 1, cycle_time: '05:00' },
  { gateway: 'check', name: 'Check', cycle: 'monthly', cycle_day: 1, cycle_time: '05:00' }
]

const state = {
  calls: [],
  sdk: [],
  storeReads: [],
  stores: null,
  anchors: [],
  plugin: null,
  invoices: null,
  methods: null,
  history: null,
  report: null,
  business: null
}

const deferred = () => {
  let resolve
  const promise = new Promise((_resolve) => { resolve = _resolve })
  return { promise, resolve }
}

const json = (body) => Promise.resolve({ ok: true, json: async () => body })
const file = (type) => Promise.resolve({ ok: true, headers: { get: () => type }, blob: async () => new Blob(['x']) })

const fetchMock = (url, options) => {
  state.calls.push({ url, options })
  if (url.startsWith(`${ROOT}/plugins/key/`)) return state.plugin(url)
  if (url.startsWith(`${ROOT}/business_payment_invoices/payment_history`)) return state.history(url)
  if (url.startsWith(`${ROOT}/business_payment_invoices`)) return state.invoices(url)
  if (url.startsWith(`${ROOT}/business_payment_accounts/methods`)) return state.methods(url)
  if (url.startsWith(`${ROOT}/business_payment_reports/download`)) return state.report(url)
  return json({ error: true, result: ['unexpected url ' + url] })
}

const sdkChain = (id) => {
  const call = { id }
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
      // `businesses()` with no id is the one small read of the page on load (b); with an id, the store of the URL
      if (id == null) {
        state.storeReads.push({ ...call, query: options?.query })
        return state.stores()
      }
      state.sdk.push(call)
      return state.business(id)
    }
  }
  return chain
}

const businessIdOf = (url) => Number(decodeURIComponent(url).match(/"value":(\d+)/)?.[1])
const urls = () => state.calls.map(call => call.url)
const invoiceUrl = (id) => `${ROOT}/business_payment_invoices?where=[{"attribute":"business_id","value":${id}}]`

const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0) })
const run = (fn) => act(async () => { fn() })

const mount = async (props = {}) => {
  const ui = { current: null, renders: 0 }
  const UIComponent = (uiProps) => {
    ui.current = uiProps
    ui.renders += 1
    return null
  }
  render(<BusinessPaymentReports UIComponent={UIComponent} {...props} />)
  await flush()
  return ui
}

/** Mounted and with the store chosen (as the UI does it: with the object of the picker). */
const mountSelected = async (business = FAST_BITE) => {
  const ui = await mount()
  await run(() => ui.current.business.select(business))
  await flush()
  return ui
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(TODAY)
  window.history.replaceState(null, '', '/intelligence/business-payments')
  state.calls = []
  state.sdk = []
  state.storeReads = []
  state.stores = () => ({ content: { error: false, result: [FAST_BITE, OTHER_STORE], pagination: { total: 2 } } })
  state.anchors = []
  state.plugin = () => json({ error: true, result: 'Error finding plugin' })
  state.invoices = (url) => json({ error: false, result: businessIdOf(url) === 8 ? INVOICES_8 : INVOICES_2 })
  state.methods = () => json({ error: false, result: METHODS })
  state.history = () => file('application/pdf')
  state.report = () => file('text/csv')
  state.business = (id) => ({ content: { error: false, result: { ...FAST_BITE, id, slug: 'fast-bite', logo: null, city: 'Miami' } } })
  session.value = { token: 'token-1' }
  ordering.value = { root: ROOT, project: 'orderingv1', setAccessToken: () => ({ businesses: sdkChain }) }
  vi.stubGlobal('fetch', vi.fn(fetchMock))
  URL.createObjectURL = vi.fn(() => 'blob:report')
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
    state.anchors.push({ href: this.href, download: this.download })
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('BusinessPaymentReports: on mount', () => {
  it('(1) asks only the plugin (R1, BPR:620-643) and nothing else; it passes the props of the parent', async () => {
    const ui = await mount({ parentProp: 'x' })
    expect(urls()).toEqual([`${ROOT}/plugins/key/eatstreet_payment_reports`])
    expect(state.calls[0].options).toEqual({
      method: 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-1' }
    })
    expect(ui.current.parentProp).toBe('x')
    expect(ui.current).toMatchObject({
      view: 'business',
      plugin: { checked: true, installed: false },
      business: { selected: null, restoring: false },
      invoices: { loading: false, error: null, items: [] },
      history: { from: null, to: null, preset: null, loading: false, error: null },
      legacy: { available: false, tab: 'platform', importing: false, importError: null, page: 1, pageSize: 10 },
      detail: { invoiceId: null },
      legacyDetail: { reportId: null },
      methods: { loading: false, error: null, items: [] },
      method: null,
      periods: [],
      report: { loadingKey: null, error: null, errorKey: null }
    })
  })

  it('does not ask before the session has a token; `checked` stays false', async () => {
    session.value = { token: null }
    const ui = await mount()
    expect(state.calls).toHaveLength(0)
    expect(ui.current.plugin.checked).toBe(false)
  })

  it('the plugin is installed when R1 answers with a result; `checked` also turns true on a failed request', async () => {
    state.plugin = () => json({ error: false, result: { key: 'eatstreet_payment_reports' } })
    const installed = await mount()
    expect(installed.current.plugin).toMatchObject({ checked: true, installed: true })

    state.plugin = () => Promise.reject(new Error('offline'))
    const failed = await mount()
    expect(failed.current.plugin).toMatchObject({ checked: true, installed: false })
  })

  it('opens the panels the URL names, without any request (BPR:645-659)', async () => {
    window.history.replaceState(null, '', '/intelligence/business-payments?invoice_id=12&ext_report_id=77')
    const ui = await mount()
    expect(ui.current.detail.invoiceId).toBe('12')
    expect(ui.current.legacyDetail.reportId).toBe('77')
    expect(urls()).toEqual([`${ROOT}/plugins/key/eatstreet_payment_reports`])
  })
})

describe('BusinessPaymentReports: the store from the URL (R3, BPR:661-694)', () => {
  it('(2) ?business_id=2 asks the store with the same fields and then the invoices with the URL of main', async () => {
    window.history.replaceState(null, '', '/intelligence/business-payments?business_id=2')
    const gate = deferred()
    state.business = async (id) => {
      await gate.promise
      return { content: { error: false, result: { id, name: 'Fast Bite', external_id: null } } }
    }
    const ui = await mount()
    // the store is out and the invoices are not asked until it comes back
    expect(state.sdk).toHaveLength(1)
    expect(urls()).toEqual([`${ROOT}/plugins/key/eatstreet_payment_reports`])
    expect(ui.current.business).toMatchObject({ selected: null, restoring: true })
    await run(() => gate.resolve())
    await flush()
    expect(state.sdk).toEqual([{ id: 2, select: ['id', 'name', 'slug', 'logo', 'city', 'external_id'] }])
    expect(urls()).toEqual([`${ROOT}/plugins/key/eatstreet_payment_reports`, invoiceUrl(2)])
    expect(state.calls[1].options).toEqual({
      method: 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-1' }
    })
    expect(ui.current.business).toMatchObject({ selected: { id: 2, name: 'Fast Bite' }, restoring: false })
    expect(ui.current.invoices.items.map(i => i.id)).toEqual([12, 11, 10])
  })

  it('a store that does not come back leaves nothing selected and stops restoring', async () => {
    window.history.replaceState(null, '', '/intelligence/business-payments?business_id=2')
    state.business = () => ({ content: { error: true, result: ['nope'] } })
    const ui = await mount()
    expect(ui.current.business).toMatchObject({ selected: null, restoring: false })
    expect(urls()).toEqual([`${ROOT}/plugins/key/eatstreet_payment_reports`])
  })

  it('does not ask the store without a token', async () => {
    session.value = { token: null }
    window.history.replaceState(null, '', '/intelligence/business-payments?business_id=2')
    await mount()
    expect(state.sdk).toHaveLength(0)
  })
})

describe('BusinessPaymentReports: an account with one store (D-17 b)', () => {
  const ONE = { id: 5, name: 'Only Store', slug: 'only-store', logo: null, city: 'Miami', external_id: 'EXT-5' }
  const oneStore = () => ({ content: { error: false, result: [ONE], pagination: { total: 1 } } })
  const extUrls = () => urls().filter(url => url.startsWith(EXT))

  it('asks ONE small read on load: page 1, page_size 2, the fields the picker shows, the enabled stores the picker lists', async () => {
    await mount()
    expect(state.storeReads).toEqual([{
      id: undefined,
      select: ['id', 'name', 'slug', 'logo', 'city', 'external_id'],
      where: { conditions: [{ attribute: 'enabled', value: true }], conector: 'AND' },
      query: { page: 1, page_size: 2 }
    }])
  })

  it('two stores: nothing is chosen, no invoices are asked', async () => {
    const ui = await mount()
    expect(ui.current.business.selected).toBeNull()
    expect(urls()).toEqual([`${ROOT}/plugins/key/eatstreet_payment_reports`])
    expect(window.location.search).toBe('')
  })

  it('one store: it is chosen by itself, as the picker would (business_id in the URL, its invoices)', async () => {
    state.stores = oneStore
    const ui = await mount()
    expect(ui.current.business.selected).toEqual(ONE)
    expect(window.location.search).toBe('?business_id=5')
    expect(urls()).toEqual([`${ROOT}/plugins/key/eatstreet_payment_reports`, invoiceUrl(5)])
  })

  it('one store with the plugin: EatStreet is not asked on load, only when its tab is opened', async () => {
    state.plugin = () => json({ error: false, result: { key: 'eatstreet_payment_reports' } })
    state.stores = oneStore
    vi.stubGlobal('fetch', vi.fn((url, options) => {
      if (url.startsWith(EXT)) {
        state.calls.push({ url, options })
        return json(url.endsWith('/api/reports/list') ? { data: [{ id: 1 }], pagination: { total_pages: 1 } } : { error: false })
      }
      return fetchMock(url, options)
    }))
    const ui = await mount()
    expect(ui.current.business.selected).toEqual(ONE)
    expect(ui.current.legacy).toMatchObject({ available: true, tab: 'platform' })
    expect(extUrls()).toEqual([])
    await run(() => ui.current.legacy.setTab('eatstreet'))
    await flush()
    expect(extUrls()).toEqual([`${EXT}/api/reports/import/restaurant/EXT-5`, `${EXT}/api/reports/list`])
  })

  it('does not read the stores when the URL already names one (?business_id=)', async () => {
    window.history.replaceState(null, '', '/intelligence/business-payments?business_id=2')
    state.stores = oneStore
    const ui = await mount()
    expect(state.storeReads).toHaveLength(0)
    expect(ui.current.business.selected).toMatchObject({ id: 2 })
  })

  it('does not read the stores without a token', async () => {
    session.value = { token: null }
    state.stores = oneStore
    await mount()
    expect(state.storeReads).toHaveLength(0)
  })

  it('a store chosen by hand before the answer arrives is kept', async () => {
    const gate = deferred()
    state.stores = async () => {
      await gate.promise
      return oneStore()
    }
    const ui = await mount()
    await run(() => ui.current.business.select(OTHER_STORE))
    await run(() => gate.resolve())
    await flush()
    expect(ui.current.business.selected).toEqual(OTHER_STORE)
    expect(window.location.search).toBe('?business_id=8')
  })

  it('an error, a failed read or an empty list chooses nothing and shows nothing', async () => {
    state.stores = () => ({ content: { error: true, result: ['nope'] } })
    expect((await mount()).current.business.selected).toBeNull()
    state.stores = () => { throw new Error('offline') }
    expect((await mount()).current.business.selected).toBeNull()
    state.stores = () => ({ content: { error: false, result: [], pagination: { total: 0 } } })
    expect((await mount()).current.business.selected).toBeNull()
  })

  it('a page of one result that is part of more (total 2) chooses nothing', async () => {
    state.stores = () => ({ content: { error: false, result: [ONE], pagination: { total: 2 } } })
    expect((await mount()).current.business.selected).toBeNull()
  })
})

describe('BusinessPaymentReports: choosing a store (BPR:541-559)', () => {
  it('(3) asks the invoices, writes business_id in the URL and, without the plugin, does not ask EatStreet', async () => {
    const ui = await mountSelected({ ...FAST_BITE, external_id: 'EXT-9' })
    expect(urls()).toEqual([`${ROOT}/plugins/key/eatstreet_payment_reports`, invoiceUrl(2)])
    expect(window.location.search).toBe('?business_id=2')
    expect(ui.current.business.selected).toEqual({ ...FAST_BITE, external_id: 'EXT-9' })
    expect(ui.current.legacy.available).toBe(false)
    expect(ui.current.invoices).toMatchObject({ loading: false, error: null })
  })

  it('(3) with the plugin and an external_id, imports and then lists on the EatStreet host, in that order and once, when its tab is opened (a)', async () => {
    state.plugin = () => json({ error: false, result: { key: 'eatstreet_payment_reports' } })
    state.calls = []
    const imports = []
    const ui = await mount()
    // R9 answers
    vi.stubGlobal('fetch', vi.fn((url, options) => {
      if (url.startsWith(EXT)) {
        imports.push({ url, body: JSON.parse(options.body), options })
        return json(url.endsWith('/api/reports/list')
          ? { data: [{ id: 1 }], pagination: { total_pages: 1 } }
          : { error: false })
      }
      return fetchMock(url, options)
    }))
    await run(() => ui.current.business.select({ ...FAST_BITE, external_id: 'EXT-9' }))
    await flush()
    expect(imports).toEqual([])
    await run(() => ui.current.legacy.setTab('eatstreet'))
    await flush()
    expect(imports.map(call => call.url)).toEqual([
      `${EXT}/api/reports/import/restaurant/EXT-9`,
      `${EXT}/api/reports/list`
    ])
    expect(imports[0].body).toEqual({ query: { project: 'orderingv1' } })
    expect(imports[0].options.method).toBe('POST')
    expect(imports[0].options.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer token-1' })
    expect(imports[1].body).toEqual({ query: { project: 'orderingv1', restaurant_id: 'EXT-9', page: 1, per_page: 10 } })
    expect(ui.current.legacy.available).toBe(true)
    expect(ui.current.legacy.list.reports).toEqual([{ id: 1 }])
  })

  it('a store with no external_id never asks EatStreet, even with the plugin', async () => {
    state.plugin = () => json({ error: false, result: { key: 'eatstreet_payment_reports' } })
    const ui = await mountSelected(FAST_BITE)
    expect(urls().filter(url => url.startsWith(EXT))).toEqual([])
    expect(ui.current.legacy.available).toBe(false)
  })

  it('resets the tab, the page, the list, the import and the history range (and its error)', async () => {
    state.plugin = () => json({ error: false, result: { key: 'eatstreet_payment_reports' } })
    vi.stubGlobal('fetch', vi.fn((url, options) => {
      if (url.startsWith(EXT)) return json(url.endsWith('/api/reports/list') ? { data: [{ id: 1 }], pagination: { total_pages: 3 } } : { error: false })
      if (url.startsWith(`${ROOT}/business_payment_invoices/payment_history`)) return file('text/html')
      return fetchMock(url, options)
    }))
    const ui = await mount()
    await run(() => ui.current.business.select({ ...FAST_BITE, external_id: 'EXT-9' }))
    await flush()
    await run(() => ui.current.legacy.setTab('eatstreet'))
    await run(() => ui.current.legacy.setPage(2))
    await flush()
    await run(() => ui.current.history.setPreset('this_month'))
    await run(() => ui.current.history.download())
    await flush()
    expect(ui.current.history.error).toBe('Invalid response format')
    expect(ui.current.legacy.page).toBe(2)

    await run(() => ui.current.business.select(OTHER_STORE))
    await flush()
    expect(ui.current.legacy).toMatchObject({ tab: 'platform', page: 1, importing: false, importError: null })
    expect(ui.current.legacy.list).toMatchObject({ loading: false, reports: [], error: null, pagination: null })
    expect(ui.current.history).toMatchObject({ from: null, to: null, preset: null, loading: false, error: null })
    expect(window.location.search).toBe('?business_id=8')
  })
})

describe('BusinessPaymentReports: invoices (R4, BP-06, BP-07)', () => {
  it('gives them from the newest to the oldest', async () => {
    const ui = await mountSelected()
    expect(ui.current.invoices.items.map(i => i.id)).toEqual([12, 11, 10])
  })

  it('is loading, with no items, while the request is out', async () => {
    const gate = deferred()
    state.invoices = () => gate.promise
    const ui = await mountSelected()
    expect(ui.current.invoices).toMatchObject({ loading: true, items: [], error: null })
    await run(() => gate.resolve({ ok: true, json: async () => ({ error: false, result: INVOICES_2 }) }))
    await flush()
    expect(ui.current.invoices).toMatchObject({ loading: false, error: null })
    expect(ui.current.invoices.items).toHaveLength(3)
  })

  it('(4) an error is not an empty list: it is `invoices.error`, with no items; retry asks again', async () => {
    const answers = [{ error: true, result: ['Not allowed'] }, { error: false, result: INVOICES_2 }]
    state.invoices = () => json(answers.shift())
    const ui = await mountSelected()
    expect(ui.current.invoices).toMatchObject({ loading: false, items: [], error: ['Not allowed'] })
    expect(urls().filter(url => url === invoiceUrl(2))).toHaveLength(1)

    await run(() => ui.current.invoices.retry())
    await flush()
    expect(urls().filter(url => url === invoiceUrl(2))).toHaveLength(2)
    expect(ui.current.invoices).toMatchObject({ loading: false, error: null })
    expect(ui.current.invoices.items).toHaveLength(3)
  })

  it('(4) a failed request gives [message]', async () => {
    state.invoices = () => Promise.reject(new Error('Network down'))
    const ui = await mountSelected()
    expect(ui.current.invoices).toMatchObject({ loading: false, items: [], error: ['Network down'] })
  })

  it('an error answer with no result is still an error', async () => {
    state.invoices = () => json({ error: true })
    const ui = await mountSelected()
    expect(ui.current.invoices.error).toBeTruthy()
    expect(ui.current.invoices.items).toEqual([])
  })

  it('retry with no store chosen asks nothing', async () => {
    const ui = await mount()
    const before = state.calls.length
    await run(() => ui.current.invoices.retry())
    expect(state.calls).toHaveLength(before)
  })

  it('(8) the answer of a store chosen before, arriving late, is discarded', async () => {
    const first = deferred()
    state.invoices = (url) => (businessIdOf(url) === 2 ? first.promise : json({ error: false, result: INVOICES_8 }))
    const ui = await mount()
    await run(() => ui.current.business.select(FAST_BITE))
    await run(() => ui.current.business.select(OTHER_STORE))
    await flush()
    expect(ui.current.invoices.items.map(i => i.id)).toEqual([40])
    await run(() => first.resolve({ ok: true, json: async () => ({ error: false, result: INVOICES_2 }) }))
    await flush()
    expect(ui.current.business.selected.id).toBe(8)
    expect(ui.current.invoices.items.map(i => i.id)).toEqual([40])
    expect(ui.current.invoices.loading).toBe(false)
  })

  it('(8) a late error of a store chosen before does not replace the invoices of the current one', async () => {
    const first = deferred()
    state.invoices = (url) => (businessIdOf(url) === 2 ? first.promise : json({ error: false, result: INVOICES_8 }))
    const ui = await mount()
    await run(() => ui.current.business.select(FAST_BITE))
    await run(() => ui.current.business.select(OTHER_STORE))
    await flush()
    await run(() => first.resolve({ ok: true, json: async () => ({ error: true, result: ['late'] }) }))
    await flush()
    expect(ui.current.invoices).toMatchObject({ error: null })
    expect(ui.current.invoices.items.map(i => i.id)).toEqual([40])
  })
})

describe('BusinessPaymentReports: the general report (R7, R8; D5)', () => {
  it('(5) asks the methods once on the first switch to general; the first one is chosen without asking anything else', async () => {
    const ui = await mount()
    const before = state.calls.length
    await run(() => ui.current.setView('general'))
    await flush()
    expect(urls().slice(before)).toEqual([`${ROOT}/business_payment_accounts/methods`])
    expect(state.calls[before].options).toEqual({
      method: 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-1' }
    })
    expect(ui.current.view).toBe('general')
    expect(ui.current.methods).toMatchObject({ loading: false, error: null, items: METHODS })
    expect(ui.current.method).toEqual(METHODS[0])
    expect(ui.current.periods[0]).toMatchObject({ key: 'stripe|2026-10-05 05:00:00', periodStart: '2026-09-28 05:00:00', periodEnd: '2026-10-05 05:00:00' })

    await run(() => ui.current.setView('business'))
    await run(() => ui.current.setView('general'))
    await flush()
    expect(urls().filter(url => url.includes('/methods'))).toHaveLength(1)
  })

  it('selectMethod changes the method (and its periods); an unknown gateway leaves none', async () => {
    const ui = await mount()
    await run(() => ui.current.setView('general'))
    await flush()
    await run(() => ui.current.selectMethod('check'))
    expect(ui.current.method).toEqual(METHODS[2])
    expect(ui.current.periods).toHaveLength(12)
    expect(ui.current.periods[0].key).toBe('check|2026-10-01 05:00:00')
    await run(() => ui.current.selectMethod('nope'))
    expect(ui.current.method).toBeNull()
    expect(ui.current.periods).toEqual([])
  })

  it('a method already chosen is not replaced when the list arrives again', async () => {
    const ui = await mount()
    await run(() => ui.current.setView('general'))
    await flush()
    await run(() => ui.current.selectMethod('ach'))
    await run(() => ui.current.methods.retry())
    await flush()
    expect(ui.current.method.gateway).toBe('ach')
  })

  it('an error is `methods.error`; retry asks again', async () => {
    const answers = [{ error: true, result: ['Not allowed'] }, { error: false, result: METHODS }]
    state.methods = () => json(answers.shift())
    const ui = await mount()
    await run(() => ui.current.setView('general'))
    await flush()
    expect(ui.current.methods).toMatchObject({ loading: false, items: [], error: ['Not allowed'] })
    expect(ui.current.method).toBeNull()
    await run(() => ui.current.methods.retry())
    await flush()
    expect(ui.current.methods).toMatchObject({ error: null, items: METHODS })
    expect(ui.current.method).toEqual(METHODS[0])
  })

  it('(6) report.download(period) asks R8 with the URL of main, marks loadingKey, saves the CSV with its name and never starts on its own', async () => {
    const gate = deferred()
    state.report = () => gate.promise
    const ui = await mount()
    await run(() => ui.current.setView('general'))
    await flush()
    expect(urls().some(url => url.includes('/business_payment_reports/download'))).toBe(false)
    const period = ui.current.periods[0]
    await run(() => { ui.current.report.download(period) })
    const call = state.calls[state.calls.length - 1]
    expect(call.url).toBe(`${ROOT}/business_payment_reports/download?paymethod=stripe&period_start=2026-09-28+05%3A00%3A00&period_end=2026-10-05+05%3A00%3A00`)
    expect(call.options).toEqual({ method: 'GET', headers: { Authorization: 'Bearer token-1' } })
    expect(ui.current.report).toMatchObject({ loadingKey: 'stripe|2026-10-05 05:00:00', error: null, errorKey: null })
    await run(() => gate.resolve({ ok: true, blob: async () => new Blob(['x']) }))
    await flush()
    expect(ui.current.report).toMatchObject({ loadingKey: null, error: null, errorKey: null })
    expect(state.anchors).toEqual([{ href: 'blob:report', download: 'payment-report-stripe-2026-10-05.csv' }])
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:report')
    expect(document.querySelector('a[download]')).toBeNull()
  })

  it('(6) a failed download is `report.error` with the key of its period', async () => {
    state.report = () => Promise.resolve({ ok: false, json: async () => ({ error: true, result: ['Report not ready'] }) })
    const ui = await mount()
    await run(() => ui.current.setView('general'))
    await flush()
    const period = ui.current.periods[1]
    await run(() => { ui.current.report.download(period) })
    await flush()
    expect(ui.current.report).toMatchObject({ loadingKey: null, error: 'Report not ready', errorKey: period.key })
    expect(state.anchors).toEqual([])
  })

  it('an unreadable error body gives "Download failed"; a new download clears the error', async () => {
    state.report = () => Promise.resolve({ ok: false, json: async () => { throw new Error('not json') } })
    const ui = await mount()
    await run(() => ui.current.setView('general'))
    await flush()
    const period = ui.current.periods[0]
    await run(() => { ui.current.report.download(period) })
    await flush()
    expect(ui.current.report.error).toBe('Download failed')
    state.report = () => file('text/csv')
    await run(() => { ui.current.report.download(period) })
    await flush()
    expect(ui.current.report).toMatchObject({ loadingKey: null, error: null, errorKey: null })
  })

  it('without a method, download does nothing', async () => {
    const ui = await mount()
    const before = state.calls.length
    await run(() => { ui.current.report.download({ key: 'x', periodStart: 'a', periodEnd: 'b' }) })
    expect(state.calls).toHaveLength(before)
  })
})

describe('BusinessPaymentReports: payment history (R6, D6)', () => {
  it('(7) setPreset fixes the range from today and the preset, and asks nothing', async () => {
    const ui = await mountSelected()
    const before = state.calls.length
    await run(() => ui.current.history.setPreset('last_month'))
    expect(ui.current.history).toMatchObject({ from: '2026-09-01', to: '2026-09-30', preset: 'last_month' })
    expect(state.calls).toHaveLength(before)
    await run(() => ui.current.history.setPreset('this_year'))
    expect(ui.current.history).toMatchObject({ from: '2026-01-01', to: '2026-10-10', preset: 'this_year' })
    expect(state.calls).toHaveLength(before)
  })

  it('setRange fixes the range, clears the preset and asks nothing', async () => {
    const ui = await mountSelected()
    const before = state.calls.length
    await run(() => ui.current.history.setPreset('this_month'))
    await run(() => ui.current.history.setRange({ from: '2026-10-03', to: '2026-10-09' }))
    expect(ui.current.history).toMatchObject({ from: '2026-10-03', to: '2026-10-09', preset: null })
    expect(state.calls).toHaveLength(before)
  })

  it('(7) download() asks R6 with the URL of main, saves the PDF with its name and clears loading', async () => {
    const gate = deferred()
    state.history = () => gate.promise
    const ui = await mountSelected()
    await run(() => ui.current.history.setRange({ from: '2026-10-03', to: '2026-10-09' }))
    await run(() => { ui.current.history.download() })
    const call = state.calls[state.calls.length - 1]
    expect(call.url).toBe(`${ROOT}/business_payment_invoices/payment_history?business_id=2&period_start=2026-10-03&period_end=2026-10-09`)
    expect(call.options).toEqual({ method: 'GET', headers: { Authorization: 'Bearer token-1' } })
    expect(ui.current.history.loading).toBe(true)
    await run(() => gate.resolve({ ok: true, headers: { get: () => 'application/pdf' }, blob: async () => new Blob(['x']) }))
    await flush()
    expect(ui.current.history).toMatchObject({ loading: false, error: null })
    expect(state.anchors).toEqual([{ href: 'blob:report', download: 'payment_history_2_2026-10-03_to_2026-10-09.pdf' }])
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:report')
  })

  it('with no store or without the two days, download() asks nothing', async () => {
    const ui = await mount()
    const before = state.calls.length
    await run(() => { ui.current.history.download() })
    await run(() => ui.current.history.setRange({ from: '2026-10-03', to: null }))
    await run(() => { ui.current.history.download() })
    expect(state.calls).toHaveLength(before)

    await run(() => ui.current.business.select(FAST_BITE))
    await flush()
    const afterSelect = state.calls.length
    await run(() => ui.current.history.setRange({ from: '2026-10-03', to: null }))
    await run(() => { ui.current.history.download() })
    expect(state.calls).toHaveLength(afterSelect)
  })

  it('a response that is not a PDF is "Invalid response format"; a failed one gives its message', async () => {
    state.history = () => file('text/html')
    const ui = await mountSelected()
    await run(() => ui.current.history.setPreset('this_month'))
    await run(() => { ui.current.history.download() })
    await flush()
    expect(ui.current.history).toMatchObject({ loading: false, error: 'Invalid response format' })
    expect(state.anchors).toEqual([])

    state.history = () => Promise.resolve({ ok: false, json: async () => ({ result: ['No invoices in that range'] }) })
    await run(() => { ui.current.history.download() })
    await flush()
    expect(ui.current.history.error).toBe('No invoices in that range')
  })
})

describe('BusinessPaymentReports: panels (BPR:517-531, 561-575)', () => {
  // redesign closing a document takes out only its own parameter; the store stays chosen in the URL, so a reload keeps it
  it('opening an invoice writes invoice_id and business_id; closing removes only invoice_id', async () => {
    const ui = await mountSelected()
    await run(() => ui.current.detail.open(12))
    expect(ui.current.detail.invoiceId).toBe(12)
    expect(window.location.search).toBe('?business_id=2&invoice_id=12')
    await run(() => ui.current.detail.close())
    expect(ui.current.detail.invoiceId).toBeNull()
    expect(window.location.search).toBe('?business_id=2')
  })

  it('opening a legacy report writes ext_report_id and business_id; closing removes only ext_report_id', async () => {
    const ui = await mountSelected()
    await run(() => ui.current.legacyDetail.open(77))
    expect(ui.current.legacyDetail.reportId).toBe(77)
    expect(window.location.search).toBe('?business_id=2&ext_report_id=77')
    await run(() => ui.current.legacyDetail.close())
    expect(ui.current.legacyDetail.reportId).toBeNull()
    expect(window.location.search).toBe('?business_id=2')
  })

  it('opening one panel closes the other (D8) and the URL keeps only the one that is open', async () => {
    const ui = await mountSelected()
    await run(() => ui.current.legacyDetail.open(77))
    await run(() => ui.current.detail.open(12))
    expect(ui.current.legacyDetail.reportId).toBeNull()
    expect(ui.current.detail.invoiceId).toBe(12)
    expect(window.location.search).toBe('?business_id=2&invoice_id=12')
    await run(() => ui.current.legacyDetail.open(78))
    expect(ui.current.detail.invoiceId).toBeNull()
    expect(ui.current.legacyDetail.reportId).toBe(78)
    expect(window.location.search).toBe('?business_id=2&ext_report_id=78')
  })

  it('with both panels restored from the URL, closing one keeps business_id for the other (cross-clean of main)', async () => {
    window.history.replaceState(null, '', '/intelligence/business-payments?business_id=2&invoice_id=12&ext_report_id=77')
    const ui = await mount()
    await run(() => ui.current.detail.close())
    expect(window.location.search).toBe('?business_id=2&ext_report_id=77')
    await run(() => ui.current.legacyDetail.close())
    expect(window.location.search).toBe('?business_id=2')
  })

  it('does not write a business_id it does not have', async () => {
    const ui = await mount()
    await run(() => ui.current.detail.open(12))
    expect(window.location.search).toBe('?invoice_id=12')
  })
})
