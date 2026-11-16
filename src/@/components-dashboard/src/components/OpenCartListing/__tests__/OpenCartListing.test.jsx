/* eslint-disable import/first */
// redesign OC-A (data contract): the controller of /cart-recovery/open-carts. The network is a
// fake `fetch` that behaves like the API measured in analysis.md section 3: it filters on `id`,
// `status`, `business_id`, `user_id` and `updated_at`, pages and orders the list, and gives a
// detail per cart. Dates are fixed with a fake clock; real timers keep the promises honest.
import React from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Stable values: the controller keeps them in effect dependencies.
const stable = vi.hoisted(() => ({
  session: [{ token: 'test-token', loading: false, user: { id: 1, level: 0 } }],
  api: [{ root: 'https://api.test/v400/en/demo' }]
}))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => stable.session }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => stable.api }))

import { OpenCartListing } from '../index'
import { ToastContext, ToastType } from '../../../contexts/ToastContext'
import { parseApiUtc, startOfLocalDay, toApiUtc } from '../../../utils/openCarts'

const ROOT_PATH = '/v400/en/demo'
const NOW = new Date(Date.UTC(2026, 9, 9, 15, 30, 0))

// ---------- fixtures ----------

const minutesBefore = (minutes) => toApiUtc(new Date(NOW.getTime() - minutes * 60000))
const DAY = 24 * 60

const user = (name, extra = {}) => ({ name, lastname: 'Test', email: null, phone: null, cellphone: null, photo: null, ...extra })

const makeCart = (id, minutes, { status = 0, owner, businessId = 5 } = {}) => ({
  id,
  uuid: `uuid-${id}`,
  status,
  business_id: businessId,
  user_id: 9000 + id,
  order_id: null,
  created_at: minutesBefore(minutes + 5),
  updated_at: minutesBefore(minutes),
  address: { address: `${id} Main St` },
  products: [{ product_id: 1, code: 'a', quantity: 1, options: [] }],
  user: owner === undefined ? null : owner,
  business: { id: businessId, name: `Business ${businessId}`, logo: null, phone: '555-0000', city: null }
})

const TOTALS = {}
const fixture = () => {
  const carts = []
  const add = (cart, total) => { carts.push(cart); TOTALS[cart.id] = total }
  add(makeCart(18101, 120, { owner: user('Ana', { email: 'ana@example.com' }) }), 20)
  add(makeCart(18102, 300, { status: 4, owner: user('Bob', { phone: '555-1002' }) }), 5)
  add(makeCart(18103, 30 * 60, { businessId: 6, owner: null }), 100)
  add(makeCart(18104, 3 * DAY, { businessId: 6, owner: user('Cleo', { email: 'cleo@example.com', phone: '555-1004' }) }), 60)
  add(makeCart(18105, 10 * DAY, { businessId: 7, owner: user('Dan', { email: 'dan@example.com' }) }), 30)
  add(makeCart(18106, 10, { owner: user('Eve', { email: 'eve@example.com' }) }), 15)
  // 12 more carts inside the week (so Follow up has a second page) and 12 older ones (so All does)
  for (let i = 1; i <= 12; i++) {
    add(makeCart(18300 + i, (3 + (i % 4)) * DAY + i, { businessId: 7, owner: user(`Week${i}`, { email: `week${i}@example.com` }) }), 1)
  }
  for (let i = 1; i <= 12; i++) {
    add(makeCart(18200 + i, (20 + i) * DAY, { businessId: 7, owner: user(`Old${i}`, { email: `old${i}@example.com` }) }), 2)
  }
  return carts
}

const BUSINESSES = [
  { id: 5, name: 'Business 5', city_id: 1 },
  { id: 6, name: 'Business 6', city_id: 1 },
  { id: 7, name: 'Business 7', city_id: 2 }
]
const CITIES = [{ id: 1, name: 'Miami' }, { id: 2, name: 'Orlando' }, { id: 99, name: 'Nowhere' }]
const RULES = [
  { id: 1, type: 'abandoned_cart', enabled: false },
  { id: 2, type: 'abandoned_cart', enabled: true },
  { id: 3, type: 'abandoned_cart', enabled: true },
  { id: 4, type: 'order_status', enabled: true }
]

// ---------- fake API ----------

const matchesCondition = (cart, condition) => {
  const { attribute, value } = condition
  if (attribute === 'updated_at') {
    if (value.condition === '>=') return cart.updated_at >= value.value
    if (value.condition === '<=') return cart.updated_at <= value.value
    return true
  }
  if (attribute === 'id') return String(cart.id).includes(String(value.value).replace(/%/g, ''))
  if (attribute === 'status') return [].concat(value).includes(cart.status)
  if (attribute === 'business_id' || attribute === 'user_id') return [].concat(value).includes(cart[attribute])
  return true // what the API does not know, it ignores
}

const createServer = () => {
  const server = {
    carts: fixture(),
    calls: [],
    pending: 0,
    overrides: [],
    businesses: BUSINESSES,
    mutated: false,
    serverTotals: true,
    uncomputable: []
  }

  const respond = (call) => {
    if (call.path === '/controls/orders') return { error: false, result: { businesses: BUSINESSES, cities: CITIES } }
    if (call.path === '/event_rules') return { error: false, result: RULES, pagination: { current_page: 1, page_size: 50, total: RULES.length, total_pages: 1 } }
    if (call.path === '/business') {
      const cityIds = (call.where || []).find(item => item.attribute === 'city_id')?.value || []
      return { error: false, result: server.businesses.filter(item => cityIds.includes(item.city_id)).map(({ id, city_id: cityId }) => ({ id, city_id: cityId })) }
    }
    if (call.path === '/carts/dashboard') {
      const page = Number(call.params.get('page'))
      // measured on orderingv1 (2026-10-09): above 50 the API silently answers pages of 10
      const asked = Number(call.params.get('page_size'))
      const pageSize = asked > 50 ? 10 : asked
      const orderBy = call.params.get('orderBy')
      let rows = server.carts.filter(cart => (call.where || []).every(condition => matchesCondition(cart, condition)))
      if (orderBy === '-updated_at') rows = [...rows].sort((a, b) => (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0))
      const total = rows.length
      let slice = rows.slice((page - 1) * pageSize, page * pageSize)
      // `params=totals` adds each cart's subtotal and total, and its products' names (null where it cannot compute);
      // today's API ignores it (`server.serverTotals = false`)
      if (call.params.get('params') === 'totals' && server.serverTotals) {
        slice = slice.map(cart => {
          const value = server.uncomputable.includes(cart.id) ? null : (TOTALS[cart.id] ?? 0)
          return { ...cart, subtotal: value, total: value, products: cart.products.map(product => ({ ...product, name: `Burger ${cart.id}`, price: value })) }
        })
      }
      return {
        error: false,
        result: slice,
        pagination: { current_page: page, page_size: pageSize, total, total_pages: Math.max(1, Math.ceil(total / pageSize)), from: slice.length ? (page - 1) * pageSize + 1 : 0, to: (page - 1) * pageSize + slice.length }
      }
    }
    if (call.path === '/carts/clear') {
      server.carts = server.carts.filter(cart => cart.uuid !== call.body.uuid)
      return { error: false, result: { ok: true } }
    }
    const detail = /^\/carts\/(uuid-(\d+))$/.exec(call.path)
    if (detail) {
      const cart = server.carts.find(item => item.uuid === detail[1])
      if (!cart) return { error: true, result: ['Cart not found'] }
      const total = TOTALS[cart.id] ?? 0
      return {
        error: false,
        result: {
          uuid: cart.uuid,
          status: cart.status,
          subtotal: total,
          total,
          products: [
            { id: 1, name: `Burger ${cart.id}`, quantity: 2, price: 5, total: 10 },
            { id: 2, name: 'Fries', quantity: 1, price: 3, total: 3 },
            { id: 3, name: 'Soda', quantity: 1, price: 2, total: 2 }
          ],
          business: { id: cart.business_id, name: `Business ${cart.business_id} (detail)`, tax: 0 }
        }
      }
    }
    throw new Error(`Unexpected request ${call.method} ${call.path}`)
  }

  server.fetch = vi.fn(async (url, init = {}) => {
    const parsed = new URL(url)
    const whereText = parsed.searchParams.get('where')
    const call = {
      url,
      method: init.method || 'GET',
      path: parsed.pathname.replace(ROOT_PATH, ''),
      params: parsed.searchParams,
      where: whereText ? JSON.parse(whereText) : null,
      headers: init.headers || {},
      body: init.body ? JSON.parse(init.body) : null
    }
    server.calls.push(call)
    server.pending++
    try {
      const override = server.overrides.find(item => item.match(call))
      const body = override ? await override.respond(call) : respond(call)
      return { json: async () => body }
    } finally {
      server.pending--
    }
  })

  server.on = (match, respondWith) => { server.overrides.push({ match, respond: respondWith }) }
  server.reset = () => { server.calls.length = 0 }
  server.at = (predicate) => server.calls.filter(predicate)
  server.lists = () => server.at(call => call.path === '/carts/dashboard' && call.params.get('page_size') !== '1')
  // the request of today's figures: the carts since the local midnight, a single `updated_at >=`
  server.dayFigures = () => server.at(call => call.path === '/carts/dashboard' && call.params.get('page_size') === '50' &&
    whereOf(call).length === 1 && whereOf(call)[0].attribute === 'updated_at' && whereOf(call)[0].value.condition === '>=' &&
    isLocalMidnight(whereOf(call)[0].value.value))
  // the lists of the view itself: not today's figures
  server.liveLists = () => server.lists().filter(call => !server.dayFigures().includes(call))
  server.counts = () => server.at(call => call.path === '/carts/dashboard' && call.params.get('page_size') === '1')
  server.details = () => server.at(call => /^\/carts\/uuid-/.test(call.path))
  server.clears = () => server.at(call => call.path === '/carts/clear')
  server.businessLookups = () => server.at(call => call.path === '/business')
  return server
}

// ---------- harness ----------

let server
let latest
const showToast = vi.fn()

const UI = (props) => {
  latest = props
  return null
}
const ui = () => latest

// waitFor of Testing Library polls with setInterval, which the polling tests fake: this one only
// uses the real setTimeout
const eventually = async (assertion, tries = 200) => {
  let failure
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      assertion()
      return
    } catch (error) {
      failure = error
    }
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)) })
  }
  throw failure
}

// Waits until no request is in flight and nothing is loading, for three checks in a row
const quiet = async () => {
  let calm = 0
  for (let attempt = 0; attempt < 400 && calm < 3; attempt++) {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)) })
    const busy = server.pending > 0 || !latest || latest.list.loading || Object.values(latest.details).some(entry => entry.loading)
    calm = busy ? 0 : calm + 1
  }
  expect(calm).toBeGreaterThanOrEqual(3)
}

const mount = async (props = {}) => {
  render(
    <ToastContext.Provider value={[{}, { showToast, hideToast: vi.fn() }]}>
      <OpenCartListing UIComponent={UI} {...props} />
    </ToastContext.Provider>
  )
  await quiet()
  expect(ui().counts.all).not.toBeNull()
  expect(ui().rules.loading).toBe(false)
  expect(ui().dayFigures.loading).toBe(false)
}

// Runs a UI action and waits until the controller is quiet again
const act2 = async (action) => {
  await act(async () => { action() })
  await quiet()
}

const ids = (carts) => carts.map(cart => cart.id)
const whereOf = (call) => call.where || []
const isLocalMidnight = (text) => {
  const date = parseApiUtc(text)
  return date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0
}
const attributes = (call) => whereOf(call).map(condition => condition.attribute)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  server = createServer()
  latest = null
  showToast.mockClear()
  vi.stubGlobal('fetch', server.fetch)
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

// ---------- loading the page ----------

describe('OpenCartListing: first load', () => {
  it('renders the UI component with the contract props and spreads its own props', async () => {
    await mount({ pageTag: 'x' })
    const props = ui()
    expect(props.pageTag).toBe('x')
    expect(props.view).toBe('followUp')
    expect(props.search).toBe('')
    expect(props.filters).toEqual({ businessIds: [], customerIds: [], cityIds: [], lastActivity: { from: null, to: null } })
    expect(props.withContactOnly).toBe(true)
    ;['onViewChange', 'onSearchChange', 'onFiltersChange', 'onClearFilters', 'onWithContactOnlyChange', 'onPageChange', 'onPageSizeChange', 'ensureDetails', 'deleteCart']
      .forEach(name => expect(typeof props[name]).toBe('function'))
    expect(typeof props.live.refresh).toBe('function')
    expect(props.businesses).toEqual(BUSINESSES)
    expect(props.cities).toEqual(CITIES)
  })

  // redesign OC-F3 (OC-Q1-08): the page can start with «With contact only» off (it keeps it in the URL)
  it('starts with the guests shown when initialWithContactOnly is false, and with them hidden by default', async () => {
    await mount({ initialWithContactOnly: false })
    expect(ui().withContactOnly).toBe(false)
    expect(ui().list.total).toBe(17)
    expect(ui().list.hiddenCount).toBe(0)
    cleanup()
    await mount()
    expect(ui().withContactOnly).toBe(true)
    expect(ui().list.total).toBe(16)
    expect(ui().list.hiddenCount).toBe(1)
  })

  it('asks for what the plan lists, once, with the session token', async () => {
    // an API without `params=totals`: each row reads its detail (GET /carts/{uuid})
    server.serverTotals = false
    await mount()
    // 1 controls, 1 rules, 4 counts, 1 Follow up list (up to 100), 1 for today's figures
    expect(server.at(call => call.path === '/controls/orders')).toHaveLength(1)
    expect(server.at(call => call.path === '/event_rules')).toHaveLength(1)
    expect(server.at(call => call.path === '/event_rules')[0].params.get('page_size')).toBe('50')
    expect(server.counts()).toHaveLength(4)
    const lists = server.lists()
    expect(lists).toHaveLength(2)
    // redesign OC-integration: never above the API's page size of 50 (above it answers 10)
    lists.forEach(call => expect(Number(call.params.get('page_size'))).toBeLessThanOrEqual(50))
    const followUp = lists.find(call => whereOf(call)?.[0]?.value?.value === minutesBefore(7 * DAY))
    expect(followUp.params.get('orderBy')).toBe('-updated_at')
    expect(followUp.params.get('page')).toBe('1')
    expect(whereOf(followUp)).toEqual([{ attribute: 'updated_at', value: { condition: '>=', value: minutesBefore(7 * DAY) } }])
    // one detail per cart of the week, never twice (Follow up and today's figures share them)
    expect(server.details()).toHaveLength(17)
    expect(new Set(server.details().map(call => call.path)).size).toBe(17)
    server.details().forEach(call => expect(call.params.get('user_id')).toBe(String(9000 + Number(call.path.replace('/carts/uuid-', '')))))
    server.calls.forEach(call => expect(call.headers.Authorization).toBe('Bearer test-token'))
  })

  it('shows Follow up ranked in two bands, guests out, one page of ten', async () => {
    await mount()
    const { list } = ui()
    expect(list.error).toBeNull()
    expect(list.groups.map(group => group.key)).toEqual(['last24h', 'earlier'])
    // failed payment first, then by total (20, 15), then the week by value then recency
    expect(ids(list.groups[0].carts)).toEqual([18102, 18101, 18106])
    expect(list.groups[1].carts[0].id).toBe(18104)
    expect(list.carts).toHaveLength(10)
    expect(ids(list.carts)).toEqual(list.groups.flatMap(group => ids(group.carts)))
    expect(list.page).toBe(1)
    expect(list.pageSize).toBe(10)
    expect(list.total).toBe(16) // 17 in the week, minus the guest
    expect(list.totalPages).toBe(2)
    expect(list.capped).toBe(false)
    expect(list.searchWithoutDigits).toBe(false)
    expect(ids(list.carts)).not.toContain(18103)
  })

  it('counts the four views with page_size=1 and the active filters; Follow up counts guests', async () => {
    await mount()
    expect(ui().counts).toEqual({ followUp: 17, paymentFailed: 1, live: 1, all: 30 })
    const counts = server.counts()
    expect(counts.map(call => attributes(call))).toEqual([['updated_at'], ['status'], ['updated_at'], []])
    counts.forEach(call => expect(call.params.get('page')).toBe('1'))
  })

  it('reads rules, controls and the figures of today', async () => {
    await mount()
    expect(ui().rules).toEqual({ loading: false, total: 3, enabled: 2 })
    const sinceMidnight = toApiUtc(startOfLocalDay(NOW))
    const today = server.carts.filter(cart => cart.updated_at >= sinceMidnight)
    const figure = server.lists().find(call => call.params.get('page_size') === '50')
    expect(whereOf(figure)).toEqual([{ attribute: 'updated_at', value: { condition: '>=', value: sinceMidnight } }])
    expect(ui().dayFigures).toEqual({
      loading: false,
      activeToday: today.length,
      atStakeToday: today.reduce((sum, cart) => sum + TOTALS[cart.id], 0),
      capped: false
    })
  })

  it('waits for the session and does nothing without a token', async () => {
    stable.session[0] = { token: null, loading: true, user: null }
    try {
      render(<OpenCartListing UIComponent={UI} />)
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
      expect(server.calls).toHaveLength(0)
      expect(ui().list.loading).toBe(true)
    } finally {
      stable.session[0] = { token: 'test-token', loading: false, user: { id: 1, level: 0 } }
    }
  })
})

// ---------- one request per change ----------

describe('OpenCartListing: one request per change', () => {
  it('a view change sends one list and no detail that is already stored', async () => {
    await mount()
    server.reset()
    await act2(() => ui().onViewChange('all'))
    const lists = server.lists()
    expect(lists).toHaveLength(1)
    expect(lists[0].params.get('orderBy')).toBe('-updated_at')
    expect(lists[0].params.get('page_size')).toBe('10')
    expect(lists[0].where).toBeNull()
    expect(server.counts()).toHaveLength(0)
    expect(ids(ui().list.carts).slice(0, 4)).toEqual([18106, 18101, 18102, 18103])
    expect(ui().list.groups).toBeNull()
    expect(ui().list.total).toBe(30)
    expect(ui().list.totalPages).toBe(3)
    // every visible row was already read for Follow up: nothing to fetch (cache by id + updated_at)
    expect(server.details()).toHaveLength(0)
    expect(ui().view).toBe('all')
    expect(ui().list.page).toBe(1)
  })

  it('Payment failed and Live now use their own condition and order', async () => {
    await mount()
    server.reset()
    await act2(() => ui().onViewChange('paymentFailed'))
    expect(server.lists()).toHaveLength(1)
    expect(whereOf(server.lists()[0])).toEqual([{ attribute: 'status', value: [4] }])
    expect(ids(ui().list.carts)).toEqual([18102])

    server.reset()
    await act2(() => ui().onViewChange('live'))
    expect(server.lists()).toHaveLength(1)
    const live = server.lists()[0]
    expect(whereOf(live)).toEqual([{ attribute: 'updated_at', value: { condition: '>=', value: minutesBefore(30) } }])
    expect(live.params.get('page_size')).toBe('50') // not paginated, capped
    expect(ids(ui().list.carts)).toEqual([18106])
  })

  it('a page change sends one list for that page', async () => {
    // an API without `params=totals`: each row reads its detail (GET /carts/{uuid})
    server.serverTotals = false
    await mount()
    await act2(() => ui().onViewChange('all'))
    server.reset()
    await act2(() => ui().onPageChange(2))
    expect(server.lists()).toHaveLength(1)
    expect(server.lists()[0].params.get('page')).toBe('2')
    expect(ui().list.page).toBe(2)
    expect(ui().list.carts).toHaveLength(10)
    // details only for the visible rows that Follow up had not read (older than the week)
    const missing = ui().list.carts.filter(cart => cart.updated_at < minutesBefore(7 * DAY)).map(cart => `/carts/${cart.uuid}`)
    expect(missing.length).toBeGreaterThan(0)
    expect(server.details().map(call => call.path).sort()).toEqual(missing.sort())
    server.reset()
    await act2(() => ui().onPageSizeChange(25))
    expect(server.lists()).toHaveLength(1)
    expect(server.lists()[0].params.get('page_size')).toBe('25')
    expect(server.lists()[0].params.get('page')).toBe('1')
    expect(ui().list.pageSize).toBe(25)
    expect(ui().list.page).toBe(1)
  })

  it('ignores a page size other than 10, 25 and 50', async () => {
    await mount()
    await act2(() => ui().onViewChange('all'))
    server.reset()
    await act(async () => { ui().onPageSizeChange(7) })
    expect(server.calls).toHaveLength(0)
    expect(ui().list.pageSize).toBe(10)
  })

  it('changing the view from a later page goes back to page 1 in one request', async () => {
    await mount()
    await act2(() => ui().onViewChange('all'))
    await act2(() => ui().onPageChange(3))
    server.reset()
    await act2(() => ui().onViewChange('paymentFailed'))
    expect(server.lists()).toHaveLength(1)
    expect(server.lists()[0].params.get('page')).toBe('1')
  })

  it('a search change sends one list and four counts, and searches the cart id (M-1)', async () => {
    await mount()
    await act2(() => ui().onViewChange('all'))
    server.reset()
    await act2(() => ui().onSearchChange('#18102'))
    expect(server.lists()).toHaveLength(1)
    expect(whereOf(server.lists()[0])).toEqual([{ attribute: 'id', value: { condition: 'ilike', value: '%18102%' } }])
    expect(server.counts()).toHaveLength(4)
    server.counts().forEach(call => expect(whereOf(call)).toContainEqual({ attribute: 'id', value: { condition: 'ilike', value: '%18102%' } }))
    expect(ids(ui().list.carts)).toEqual([18102])
    expect(ui().search).toBe('#18102')
    expect(ui().counts).toEqual({ followUp: 1, paymentFailed: 1, live: 0, all: 1 })
    expect(attributes(server.lists()[0])).not.toContain('city')
  })

  it('does not ask again when the text changes but its digits do not', async () => {
    await mount()
    await act2(() => ui().onViewChange('all'))
    await act2(() => ui().onSearchChange('18102'))
    server.reset()
    await act(async () => { ui().onSearchChange('18102 ') })
    await act(async () => { ui().onSearchChange('#18102') })
    expect(server.calls).toHaveLength(0)
    expect(ui().search).toBe('#18102')
  })

  it('a search without digits asks for nothing and says so', async () => {
    await mount()
    await act2(() => ui().onViewChange('all'))
    server.reset()
    await act(async () => { ui().onSearchChange('pizza') })
    await eventually(() => expect(ui().list.searchWithoutDigits).toBe(true))
    expect(server.calls).toHaveLength(0)
    expect(ui().list.carts).toEqual([])
    expect(ui().list.total).toBe(0)
    expect(ui().list.loading).toBe(false)
    expect(ui().list.error).toBeNull()
    // and back to a normal list as soon as it is cleared
    await act2(() => ui().onSearchChange(''))
    expect(ui().list.searchWithoutDigits).toBe(false)
    expect(server.lists()).toHaveLength(1)
    expect(ui().list.total).toBe(30)
  })

  // redesign OC-F2 (OC-Q1-07): letters have no cart number to count by, so the counts (and the header's) stay as they were
  it('a search without digits keeps the counts as if there were no search', async () => {
    await mount()
    await act2(() => ui().onViewChange('all'))
    const before = { ...ui().counts }
    expect(before.all).toBeGreaterThan(0)
    server.reset()
    await act(async () => { ui().onSearchChange('pizza') })
    await eventually(() => expect(ui().list.searchWithoutDigits).toBe(true))
    await quiet()
    expect(ui().counts).toEqual(before)
    expect(server.counts()).toHaveLength(0)
    // from a numeric search to letters: the counts are the ones of no search
    await act2(() => ui().onSearchChange('1810'))
    expect(ui().counts.all).toBeLessThan(before.all)
    await act2(() => ui().onSearchChange('abc'))
    expect(ui().counts).toEqual(before)
    expect(ui().list.searchWithoutDigits).toBe(true)
    expect(ui().list.carts).toEqual([])
  })

  it('a business filter sends one list (and four counts) with business_id', async () => {
    await mount()
    await act2(() => ui().onViewChange('all'))
    server.reset()
    await act2(() => ui().onFiltersChange({ businessIds: [5] }))
    expect(server.lists()).toHaveLength(1)
    expect(whereOf(server.lists()[0])).toEqual([{ attribute: 'business_id', value: [5] }])
    expect(server.counts()).toHaveLength(4)
    expect(ids(ui().list.carts)).toEqual([18106, 18101, 18102])
    expect(ui().filters.businessIds).toEqual([5])
    expect(ui().counts.all).toBe(3)
  })

  it('a customer filter sends user_id', async () => {
    await mount()
    await act2(() => ui().onViewChange('all'))
    server.reset()
    await act2(() => ui().onFiltersChange({ customerIds: [9000 + 18104] }))
    expect(whereOf(server.lists()[0])).toEqual([{ attribute: 'user_id', value: [9000 + 18104] }])
    expect(ids(ui().list.carts)).toEqual([18104])
  })

  it('the date filter is last activity, in UTC (M-4)', async () => {
    await mount()
    await act2(() => ui().onViewChange('all'))
    server.reset()
    const from = new Date(NOW.getTime() - 4 * DAY * 60000)
    const to = new Date(NOW.getTime() - 2 * DAY * 60000)
    await act2(() => ui().onFiltersChange({ lastActivity: { from, to } }))
    expect(server.lists()).toHaveLength(1)
    expect(whereOf(server.lists()[0])).toEqual([
      { attribute: 'updated_at', value: { condition: '>=', value: toApiUtc(from) } },
      { attribute: 'updated_at', value: { condition: '<=', value: toApiUtc(to) } }
    ])
    expect(attributes(server.lists()[0])).not.toContain('delivery_datetime')
    expect(ids(ui().list.carts)).toContain(18104)
    expect(ids(ui().list.carts)).not.toContain(18101)
    expect(ui().filters.lastActivity).toEqual({ from, to })
  })

  it('the same filter again sends nothing', async () => {
    await mount()
    await act2(() => ui().onViewChange('all'))
    await act2(() => ui().onFiltersChange({ businessIds: [5] }))
    server.reset()
    await act(async () => { ui().onFiltersChange({ businessIds: [5] }) })
    expect(server.calls).toHaveLength(0)
  })
})

describe('OpenCartListing: clear filters (M-2)', () => {
  it('reloads without any filter, and without the search too', async () => {
    await mount()
    await act2(() => ui().onViewChange('all'))
    await act2(() => ui().onFiltersChange({ businessIds: [5], customerIds: [9000 + 18101] }))
    await act2(() => ui().onSearchChange('18101'))
    expect(ids(ui().list.carts)).toEqual([18101])
    server.reset()
    await act2(() => ui().onClearFilters())
    expect(server.lists()).toHaveLength(1)
    expect(server.lists()[0].where).toBeNull()
    expect(ui().filters).toEqual({ businessIds: [], customerIds: [], cityIds: [], lastActivity: { from: null, to: null } })
    expect(ui().search).toBe('')
    expect(ui().list.total).toBe(30)
    expect(ui().counts.all).toBe(30)
  })

  it('does not ask again when there was nothing to clear', async () => {
    await mount()
    await act2(() => ui().onViewChange('all'))
    server.reset()
    await act(async () => { ui().onClearFilters() })
    expect(server.calls).toHaveLength(0)
  })
})

describe('OpenCartListing: city filter (M-3)', () => {
  it('resolves the city to its businesses once and filters by business_id', async () => {
    await mount()
    await act2(() => ui().onViewChange('all'))
    server.reset()
    await act2(() => ui().onFiltersChange({ cityIds: [2] }))
    const lookups = server.businessLookups()
    expect(lookups).toHaveLength(1) // shared by the list and the four counts
    expect(lookups[0].params.get('mode')).toBe('dashboard')
    expect(lookups[0].params.get('params')).toBe('id,city_id')
    expect(lookups[0].where).toEqual([{ attribute: 'city_id', value: [2] }])
    expect(server.lists()).toHaveLength(1)
    expect(whereOf(server.lists()[0])).toEqual([{ attribute: 'business_id', value: [7] }])
    expect(attributes(server.lists()[0])).not.toContain('city_id')
    expect(ui().list.total).toBe(25) // 1 + 12 + 12
    server.counts().forEach(call => expect(whereOf(call)).toContainEqual({ attribute: 'business_id', value: [7] }))
  })

  it('asks for every page of businesses', async () => {
    server.on(call => call.path === '/business', (call) => {
      const page = Number(call.params.get('page'))
      return {
        error: false,
        result: page === 1 ? [{ id: 5, city_id: 1 }] : [{ id: 6, city_id: 1 }],
        pagination: { current_page: page, page_size: 1, total: 2, total_pages: 2 }
      }
    })
    await mount()
    await act2(() => ui().onViewChange('all'))
    await act2(() => ui().onFiltersChange({ cityIds: [1] }))
    expect(whereOf(server.lists().at(-1))).toEqual([{ attribute: 'business_id', value: [5, 6] }])
  })

  it('with no business in the city the list is empty and no cart is requested', async () => {
    await mount()
    await act2(() => ui().onViewChange('all'))
    server.reset()
    await act(async () => { ui().onFiltersChange({ cityIds: [99] }) })
    await eventually(() => expect(server.businessLookups()).toHaveLength(1))
    await eventually(() => expect(ui().counts).toEqual({ followUp: 0, paymentFailed: 0, live: 0, all: 0 }))
    await eventually(() => expect(ui().list.loading).toBe(false))
    expect(server.lists()).toHaveLength(0)
    expect(server.counts()).toHaveLength(0)
    expect(ui().list.carts).toEqual([])
    expect(ui().list.total).toBe(0)
    expect(ui().list.error).toBeNull()
  })

  it('crosses the city with the chosen businesses', async () => {
    await mount()
    await act2(() => ui().onViewChange('all'))
    await act2(() => ui().onFiltersChange({ cityIds: [1], businessIds: [5, 7] }))
    expect(whereOf(server.lists().at(-1))).toEqual([{ attribute: 'business_id', value: [5] }])
    server.reset()
    await act(async () => { ui().onFiltersChange({ cityIds: [2], businessIds: [5] }) })
    await eventually(() => expect(ui().counts.all).toBe(0))
    await eventually(() => expect(ui().list.loading).toBe(false))
    expect(server.lists()).toHaveLength(0)
    expect(ui().list.carts).toEqual([])
  })

  it('shows an error, not an empty list, when the businesses cannot be read', async () => {
    server.on(call => call.path === '/business', () => ({ error: true, result: ['Not allowed'] }))
    await mount()
    await act2(() => ui().onViewChange('all'))
    await act(async () => { ui().onFiltersChange({ cityIds: [1] }) })
    await eventually(() => expect(ui().list.error).toEqual(['Not allowed']))
    expect(ui().list.loading).toBe(false)
  })
})

// ---------- Follow up ----------

describe('OpenCartListing: Follow up', () => {
  it('pages in the client without asking again', async () => {
    await mount()
    server.reset()
    await act(async () => { ui().onPageChange(2) })
    expect(server.calls).toHaveLength(0)
    expect(ui().list.page).toBe(2)
    expect(ui().list.carts).toHaveLength(6)
    expect(ui().list.groups.map(group => group.key)).toEqual(['earlier'])
    expect(ui().list.total).toBe(16)
    await act(async () => { ui().onPageSizeChange(25) })
    expect(server.calls).toHaveLength(0)
    expect(ui().list.page).toBe(1)
    expect(ui().list.carts).toHaveLength(16)
  })

  it('shows the guests again, in their band, without asking', async () => {
    await mount()
    server.reset()
    await act(async () => { ui().onPageSizeChange(25) })
    await act(async () => { ui().onWithContactOnlyChange(false) })
    expect(server.calls).toHaveLength(0)
    expect(ui().withContactOnly).toBe(false)
    expect(ui().list.total).toBe(17)
    // 18103 (30 h ago, 100) leads the second band
    expect(ids(ui().list.groups[1].carts).slice(0, 2)).toEqual([18103, 18104])
    expect(ui().list.hiddenCount).toBe(0)
  })

  it('reads a week of more than 50 carts in pages of 50, up to 100', async () => {
    const week = Array.from({ length: 70 }, (_, index) => makeCart(20000 + index, 60 + index, { owner: user(`Week${index}`, { email: `week${index}@example.com` }) }))
    server.carts.push(...week)
    week.forEach(cart => { TOTALS[cart.id] = 3 })
    await mount()
    const pages = server.lists().filter(call => whereOf(call)?.[0]?.value?.value === minutesBefore(7 * DAY))
    expect(pages.map(call => [call.params.get('page'), call.params.get('page_size')])).toEqual([['1', '50'], ['2', '50']])
    expect(ui().list.total).toBeGreaterThan(50)
  })

  it('says how many carts the contact filter hides', async () => {
    await mount()
    expect(ui().list.hiddenCount).toBe(1)
  })

  it('marks the list as capped when there are more than 100 carts', async () => {
    server.on(
      call => call.path === '/carts/dashboard' && call.params.get('page_size') === '50' && whereOf(call)?.[0]?.value?.value === minutesBefore(7 * DAY),
      (call) => ({
        error: false,
        result: server.carts.filter(cart => cart.updated_at >= minutesBefore(7 * DAY)).slice(0, 5),
        pagination: { current_page: Number(call.params.get('page')), page_size: 50, total: 150, total_pages: 3 }
      })
    )
    await mount()
    expect(ui().list.capped).toBe(true)
  })
})

// ---------- details ----------

describe('OpenCartListing: details', () => {
  const extraCarts = (count) => Array.from({ length: count }, (_, index) => makeCart(19000 + index, 5, { owner: user(`Extra${index}`, { email: `extra${index}@example.com` }) }))

  it('fetches at most 10 at a time, and a cached one is not fetched again', async () => {
    await mount()
    const carts = extraCarts(25)
    server.carts.push(...carts)
    carts.forEach(cart => { TOTALS[cart.id] = 7 })
    server.reset()

    let inFlight = 0
    let peak = 0
    const gates = []
    server.on(call => /^\/carts\/uuid-19\d+$/.test(call.path), (call) => new Promise((resolve) => {
      inFlight++
      peak = Math.max(peak, inFlight)
      gates.push(() => {
        inFlight--
        const cart = server.carts.find(item => item.uuid === call.path.slice(7))
        resolve({ error: false, result: { uuid: cart.uuid, total: 7, products: [{ name: 'Item', quantity: 1 }], business: { name: 'Detail business' } } })
      })
    }))

    let done
    await act(async () => { done = ui().ensureDetails(carts) })
    await eventually(() => expect(gates).toHaveLength(10))
    expect(peak).toBe(10)
    // each answered request lets the next one start
    while (gates.length) {
      const release = gates.shift()
      await act(async () => { release(); await new Promise(resolve => setTimeout(resolve, 0)) })
    }
    await act(async () => { await done })
    expect(peak).toBeLessThanOrEqual(10)
    expect(server.details()).toHaveLength(25)
    expect(ui().details[19000]).toMatchObject({ loading: false, error: null })
    expect(ui().details[19000].cart).toMatchObject({ total: 7, id: 19000, uuid: 'uuid-19000' })

    server.reset()
    await act(async () => { await ui().ensureDetails(carts) })
    expect(server.details()).toHaveLength(0)
  })

  it('merges what the list knows into the detail, as the panel got it before', async () => {
    // an API without `params=totals`: each row reads its detail (GET /carts/{uuid})
    server.serverTotals = false
    await mount()
    const detail = ui().details[18101].cart
    expect(detail.total).toBe(20)
    expect(detail.id).toBe(18101)
    expect(detail.uuid).toBe('uuid-18101')
    expect(detail.user_id).toBe(9000 + 18101)
    expect(detail.user).toMatchObject({ name: 'Ana', email: 'ana@example.com', address: '18101 Main St' })
    expect(detail.business).toMatchObject({ id: 5, name: 'Business 5', phone: '555-0000' }) // the list wins over the detail's
    expect(detail.updated_at).toBe(minutesBefore(120))
    expect(detail.products).toHaveLength(3)
  })

  it('fetches again when the cart changed (updated_at) and only then', async () => {
    await mount()
    const cart = server.carts.find(item => item.id === 18101)
    server.reset()
    await act(async () => { await ui().ensureDetails([cart]) })
    expect(server.details()).toHaveLength(0)
    const changed = { ...cart, updated_at: minutesBefore(1) }
    await act(async () => { await ui().ensureDetails([changed]) })
    expect(server.details()).toHaveLength(1)
    expect(ui().details[18101].cart.updated_at).toBe(minutesBefore(1))
  })

  // redesign OC-F3 (OC-Q1-09): a failed detail is fetched again by itself when ensureDetails is called again, once it is older than 10 s,
  // at most 3 attempts per cart + updated_at; the explicit `{ retry: true }` does not wait
  describe('a detail that failed', () => {
    const later = (seconds) => vi.setSystemTime(new Date(NOW.getTime() + seconds * 1000))
    const failing = async () => {
      await mount()
      const broken = makeCart(19900, 5, { owner: user('Broken') })
      server.carts.push(broken)
      const state = { fail: true }
      server.on(call => call.path === '/carts/uuid-19900', () => (state.fail ? { error: true, result: ['Cart is gone'] } : { error: false, result: { uuid: 'uuid-19900', total: 3, products: [] } }))
      server.reset()
      await act(async () => { await ui().ensureDetails([broken]) })
      return { broken, state }
    }

    it('keeps the error in its entry and does not ask again before 10 seconds', async () => {
      const { broken } = await failing()
      expect(ui().details[19900]).toMatchObject({ loading: false, error: ['Cart is gone'], cart: null })
      later(9)
      await act(async () => { await ui().ensureDetails([broken]) })
      expect(server.details()).toHaveLength(1)
    })

    it('asks again by itself after 10 seconds, and shows the detail when it comes', async () => {
      const { broken, state } = await failing()
      later(11)
      state.fail = false
      await act(async () => { await ui().ensureDetails([broken]) })
      expect(server.details()).toHaveLength(2)
      expect(ui().details[19900]).toMatchObject({ loading: false, error: null })
      expect(ui().details[19900].cart.total).toBe(3)
      later(60)
      await act(async () => { await ui().ensureDetails([broken]) })
      expect(server.details()).toHaveLength(2) // loaded: the cache holds
    })

    it('gives up after 3 attempts for the same cart + updated_at', async () => {
      const { broken } = await failing()
      later(11)
      await act(async () => { await ui().ensureDetails([broken]) })
      later(22)
      await act(async () => { await ui().ensureDetails([broken]) })
      expect(server.details()).toHaveLength(3)
      later(300)
      await act(async () => { await ui().ensureDetails([broken]) })
      expect(server.details()).toHaveLength(3)
      expect(ui().details[19900]).toMatchObject({ loading: false, error: ['Cart is gone'] })
    })

    it('starts counting again when the cart changed (updated_at)', async () => {
      const { broken } = await failing()
      later(11)
      await act(async () => { await ui().ensureDetails([broken]) })
      later(22)
      await act(async () => { await ui().ensureDetails([broken]) })
      const changed = { ...broken, updated_at: minutesBefore(0) }
      await act(async () => { await ui().ensureDetails([changed]) })
      expect(server.details()).toHaveLength(4)
      later(33)
      await act(async () => { await ui().ensureDetails([changed]) })
      expect(server.details()).toHaveLength(5)
    })

    it('retries at once, whatever the age or the attempts, with { retry: true }', async () => {
      const { broken, state } = await failing()
      later(11)
      await act(async () => { await ui().ensureDetails([broken]) })
      later(22)
      await act(async () => { await ui().ensureDetails([broken]) })
      expect(server.details()).toHaveLength(3)
      state.fail = false
      await act(async () => { await ui().ensureDetails([broken], { retry: true }) })
      expect(server.details()).toHaveLength(4)
      expect(ui().details[19900]).toMatchObject({ loading: false, error: null })
      expect(ui().details[19900].cart.total).toBe(3)
    })

    it('does not fetch the same cart twice while a retry is in flight', async () => {
      const { broken } = await failing()
      later(11)
      await act(async () => { await Promise.all([ui().ensureDetails([broken]), ui().ensureDetails([broken])]) })
      expect(server.details()).toHaveLength(2)
    })
  })

  it('keeps the detail of a cart that leaves the list', async () => {
    await mount()
    expect(ui().details[18101]).toBeDefined()
    await act2(() => ui().onViewChange('paymentFailed'))
    expect(ids(ui().list.carts)).toEqual([18102])
    expect(ui().details[18101].cart.total).toBe(20)
  })

  it('a network failure in a detail is an error in its entry', async () => {
    await mount()
    const flaky = makeCart(19901, 5, { owner: user('Flaky') })
    server.on(call => call.path === '/carts/uuid-19901', () => { throw new Error('network down') })
    await act(async () => { await ui().ensureDetails([flaky]) })
    expect(ui().details[19901]).toMatchObject({ loading: false, error: ['network down'], cart: null })
  })
})

// ---------- deleting ----------

describe('OpenCartListing: deleteCart', () => {
  it('posts /carts/clear, takes the row out and lowers the counts and the total (M-9)', async () => {
    await mount()
    await act2(() => ui().onViewChange('all'))
    const before = { ...ui().counts }
    const total = ui().list.total
    const cart = ui().list.carts.find(item => item.id === 18102) // failed payment, 5 h ago
    server.reset()
    let result
    await act(async () => { result = await ui().deleteCart(cart) })
    expect(result).toEqual({ ok: true, error: null })
    expect(server.clears()).toHaveLength(1)
    expect(server.clears()[0].method).toBe('POST')
    expect(server.clears()[0].body).toEqual({ user_id: 9000 + 18102, uuid: 'uuid-18102' })
    expect(server.clears()[0].headers).toMatchObject({ 'Content-Type': 'application/json', Authorization: 'Bearer test-token' })
    expect(ids(ui().list.carts)).not.toContain(18102)
    expect(ui().list.total).toBe(total - 1)
    expect(Number.isNaN(ui().list.total)).toBe(false)
    expect(ui().counts).toEqual({ followUp: before.followUp - 1, paymentFailed: before.paymentFailed - 1, live: before.live, all: before.all - 1 })
  })

  it('takes a Follow up row out of the queue too', async () => {
    await mount()
    const cart = ui().list.carts.find(item => item.id === 18101)
    await act(async () => { await ui().deleteCart(cart) })
    expect(ids(ui().list.carts)).not.toContain(18101)
    expect(ui().list.total).toBe(15)
    expect(ui().counts.followUp).toBe(16)
    expect(ui().counts.all).toBe(29)
  })

  // redesign OC-F2 (OC-Q1-04): main said «Cart deleted» once the API confirmed it; the redesign dropped it
  it('says «Cart deleted» once the API confirms it, and only then', async () => {
    await mount()
    const cart = ui().list.carts.find(item => item.id === 18101)
    expect(showToast).not.toHaveBeenCalled()
    await act(async () => { await ui().deleteCart(cart) })
    expect(showToast).toHaveBeenCalledTimes(1)
    expect(showToast).toHaveBeenCalledWith(ToastType.Success, 'Cart deleted')
  })

  it('says nothing when the API refuses or the network fails', async () => {
    await mount()
    const cart = ui().list.carts[0]
    server.on(call => call.path === '/carts/clear', () => ({ error: true, result: ['The cart could not be cleared'] }))
    await act(async () => { await ui().deleteCart(cart) })
    server.overrides.length = 0
    server.on(call => call.path === '/carts/clear', () => { throw new Error('network down') })
    await act(async () => { await ui().deleteCart(cart) })
    expect(showToast).not.toHaveBeenCalled()
  })

  it('answers the API error and leaves the list alone (M-8)', async () => {
    await mount()
    await act2(() => ui().onViewChange('all'))
    const cart = ui().list.carts[0]
    const total = ui().list.total
    server.on(call => call.path === '/carts/clear', () => ({ error: true, result: ['The cart could not be cleared'] }))
    let result
    await act(async () => { result = await ui().deleteCart(cart) })
    expect(result).toEqual({ ok: false, error: ['The cart could not be cleared'] })
    expect(ui().list.carts[0].id).toBe(cart.id)
    expect(ui().list.total).toBe(total)
  })

  it('answers a network failure the same way', async () => {
    await mount()
    const cart = ui().list.carts[0]
    server.on(call => call.path === '/carts/clear', () => { throw new Error('network down') })
    let result
    await act(async () => { result = await ui().deleteCart(cart) })
    expect(result).toEqual({ ok: false, error: ['network down'] })
    expect(ids(ui().list.carts)).toContain(cart.id)
  })

  it('lowers the figures of today when the cart was part of them', async () => {
    await mount()
    const before = ui().dayFigures
    const cart = ui().list.carts.find(item => item.id === 18106) // 10 minutes ago: today in any zone
    await act(async () => { await ui().deleteCart(cart) })
    expect(ui().dayFigures.activeToday).toBe(before.activeToday - 1)
    expect(ui().dayFigures.atStakeToday).toBe(before.atStakeToday - 15)
  })
})

// ---------- errors ----------

describe('OpenCartListing: errors are not silent (M-8)', () => {
  it('exposes the API error of the list', async () => {
    server.on(
      call => call.path === '/carts/dashboard' && call.params.get('page_size') === '10',
      () => ({ error: true, result: ['Server said no'] })
    )
    await mount()
    await act2(() => ui().onViewChange('all'))
    expect(ui().list.error).toEqual(['Server said no'])
    expect(ui().list.loading).toBe(false)
    expect(ui().list.carts).toEqual([])
  })

  it('exposes a network failure, and a reload recovers', async () => {
    await mount()
    let broken = true
    server.on(
      call => call.path === '/carts/dashboard' && call.params.get('page_size') === '10',
      () => { if (broken) throw new Error('network down'); return { error: false, result: [], pagination: { current_page: 1, page_size: 10, total: 0, total_pages: 1 } } }
    )
    await act2(() => ui().onViewChange('all'))
    expect(ui().list.error).toEqual(['network down'])
    broken = false
    server.reset()
    await act2(() => ui().onReload())
    // one request for the list; the figures of today and the counts are asked again too
    expect(server.liveLists()).toHaveLength(1)
    expect(server.dayFigures()).toHaveLength(1)
    expect(server.counts()).toHaveLength(4)
    expect(ui().list.error).toBeNull()
  })

  // a count that fails used to stay null, the same as «not here yet», and the header drew a skeleton for ever
  it('a count that cannot be read is marked unavailable, not left loading; the others keep their number', async () => {
    server.on(
      call => call.path === '/carts/dashboard' && call.params.get('page_size') === '1' && attributes(call).includes('status'),
      () => ({ error: true, result: ['Server said no'] })
    )
    await mount()
    expect(ui().counts.paymentFailed).toBe('unavailable')
    expect(ui().counts.followUp).toBe(17)
    expect(ui().counts.all).toBe(30)
  })

  it('Retry asks again for the list, the four counts and the figures of today, and brings every one back', async () => {
    let broken = true
    server.on(call => broken && call.path === '/carts/dashboard', () => ({ error: true, result: ['boom'] }))
    render(
      <ToastContext.Provider value={[{}, { showToast, hideToast: vi.fn() }]}>
        <OpenCartListing UIComponent={UI} initialView='all' />
      </ToastContext.Provider>
    )
    await quiet()
    expect(ui().list.error).toEqual(['boom'])
    expect(ui().dayFigures.error).toEqual(['boom'])
    expect(Object.values(ui().counts).some(value => typeof value === 'number')).toBe(false)
    expect(Object.values(ui().counts)).not.toContain(null)

    broken = false
    server.reset()
    await act2(() => ui().onReload())
    expect(ui().list.error).toBeNull()
    expect(ui().list.total).toBe(30)
    expect(ui().counts).toEqual({ followUp: 17, paymentFailed: 1, live: 1, all: 30 })
    expect(typeof ui().dayFigures.activeToday).toBe('number')
    expect(ui().dayFigures.error).toBeUndefined()
    expect(server.counts()).toHaveLength(4)
    expect(server.dayFigures()).toHaveLength(1)
    expect(server.liveLists()).toHaveLength(1)
  })

  it('a failed Follow up list is an error, not an empty queue', async () => {
    server.on(
      call => call.path === '/carts/dashboard' && call.params.get('page_size') === '50' && whereOf(call)?.[0]?.value?.value === minutesBefore(7 * DAY),
      () => ({ error: true, result: ['Nope'] })
    )
    render(<OpenCartListing UIComponent={UI} />)
    await eventually(() => expect(ui().list.error).toEqual(['Nope']))
    expect(ui().list.groups).toEqual([])
    expect(ui().list.loading).toBe(false)
  })

  it('an answer for an old query never replaces the newer one', async () => {
    await mount()
    const gates = []
    server.on(
      call => call.path === '/carts/dashboard' && call.params.get('page_size') === '10' && call.where?.some(item => item.attribute === 'status'),
      (call) => new Promise(resolve => { gates.push(() => resolve({ error: false, result: [server.carts[1]], pagination: { current_page: 1, page_size: 10, total: 1, total_pages: 1 } })) })
    )
    await act(async () => { ui().onViewChange('paymentFailed') })
    await eventually(() => expect(gates).toHaveLength(1))
    await act(async () => { ui().onViewChange('all') })
    await eventually(() => expect(ui().list.total).toBe(30))
    await act(async () => { gates[0](); await new Promise(resolve => setTimeout(resolve, 0)) })
    expect(ui().list.total).toBe(30)
    expect(ui().view).toBe('all')
  })
})

// ---------- Live now ----------

describe('OpenCartListing: Live now polling', () => {
  const tick = (ms) => act(async () => { vi.advanceTimersByTime(ms); await new Promise(resolve => setTimeout(resolve, 0)) })

  beforeEach(() => {
    vi.useRealTimers()
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(NOW)
  })

  it('reloads every 60 s only while the view is Live now, updating in place', async () => {
    // an API without `params=totals`: each row reads its detail (GET /carts/{uuid})
    server.serverTotals = false
    await mount()
    await act2(() => ui().onViewChange('live'))
    expect(ids(ui().list.carts)).toEqual([18106])
    expect(ui().live.newIds).toEqual([])
    const firstStamp = ui().live.lastUpdatedAt
    expect(typeof firstStamp).toBe('number')

    // a customer adds to a cart meanwhile
    server.carts.push(makeCart(19500, 1, { owner: user('Fresh', { email: 'fresh@example.com' }) }))
    TOTALS[19500] = 42
    server.reset()

    await tick(59000)
    expect(server.calls).toHaveLength(0)
    await tick(1000)
    expect(server.liveLists()).toHaveLength(1)
    expect(whereOf(server.liveLists()[0])[0].value.value).toBe(minutesBefore(30 - 1)) // the window moved with the clock
    await eventually(() => expect(ids(ui().list.carts)).toEqual([19500, 18106]))
    await eventually(() => expect(ui().live.refreshing).toBe(false))
    expect(ui().list.loading).toBe(false)
    expect(ui().live.newIds).toEqual([19500])
    expect(ui().live.lastUpdatedAt).toBeGreaterThan(firstStamp)
    // details only for the cart that was not known
    expect(server.details().map(call => call.path)).toEqual(['/carts/uuid-19500'])
    expect(ui().details[19500].cart.total).toBe(42)

    // the next one: nothing new, nothing marked
    server.reset()
    await tick(60000)
    await eventually(() => expect(server.liveLists()).toHaveLength(1))
    await eventually(() => expect(ui().live.refreshing).toBe(false))
    expect(ui().live.newIds).toEqual([])
    expect(server.details()).toHaveLength(0)
  })

  // redesign OC-F2 (OC-Q1-10): Live now refreshes the whole page's numbers, not only its list
  it('refreshes the counts and the figures of today with the list', async () => {
    await mount()
    await act2(() => ui().onViewChange('live'))
    const before = { counts: { ...ui().counts }, day: { ...ui().dayFigures } }
    server.carts.push(makeCart(19501, 1, { owner: user('Fresh', { email: 'fresh@example.com' }) }))
    TOTALS[19501] = 42
    server.reset()
    await tick(60000)
    await eventually(() => expect(ui().live.refreshing).toBe(false))
    expect(server.counts()).toHaveLength(4)
    expect(server.dayFigures()).toHaveLength(1)
    expect(ui().counts).toEqual({ followUp: before.counts.followUp + 1, paymentFailed: before.counts.paymentFailed, live: before.counts.live + 1, all: before.counts.all + 1 })
    expect(ui().dayFigures.activeToday).toBe(before.day.activeToday + 1)
    expect(ui().dayFigures.atStakeToday).toBe(before.day.atStakeToday + 42)
    // Refresh does the same
    server.carts.push(makeCart(19502, 1, { owner: user('Newer', { email: 'newer@example.com' }) }))
    TOTALS[19502] = 8
    server.reset()
    await act(async () => { ui().live.refresh() })
    await eventually(() => expect(ui().dayFigures.activeToday).toBe(before.day.activeToday + 2))
    expect(ui().dayFigures.atStakeToday).toBe(before.day.atStakeToday + 50)
    expect(ui().counts.all).toBe(before.counts.all + 2)
  })

  it('keeps the previous counts and figures while they reload, and when the reload fails', async () => {
    await mount()
    await act2(() => ui().onViewChange('live'))
    const counts = { ...ui().counts }
    const day = { ...ui().dayFigures }
    const gates = []
    server.on(call => call.path === '/carts/dashboard' && call.params.get('page_size') === '1', () => new Promise(resolve => { gates.push(resolve) }))
    server.on(call => call.path === '/carts/dashboard' && call.params.get('page_size') === '50' && whereOf(call).length === 1 && isLocalMidnight(whereOf(call)[0].value.value), () => new Promise(resolve => { gates.push(resolve) }))
    await tick(60000)
    await eventually(() => expect(gates.length).toBeGreaterThan(0))
    expect(ui().counts).toEqual(counts)
    expect(ui().dayFigures).toEqual(day)
    expect(ui().dayFigures.loading).toBe(false)
    // the answers fail: the numbers on screen stay
    await act(async () => { gates.forEach(gate => gate({ error: true, result: ['nope'] })); await new Promise(resolve => setTimeout(resolve, 0)) })
    await eventually(() => expect(ui().live.refreshing).toBe(false))
    expect(ui().counts).toEqual(counts)
    expect(ui().dayFigures.activeToday).toBe(day.activeToday)
    expect(ui().dayFigures.atStakeToday).toBe(day.atStakeToday)
  })

  it('counts today from the new local midnight when the day changed between refreshes', async () => {
    await mount()
    await act2(() => ui().onViewChange('live'))
    const first = server.dayFigures()[0]
    const firstFrom = whereOf(first)[0].value.value
    expect(firstFrom).toBe(toApiUtc(startOfLocalDay(NOW)))
    const later = new Date(NOW.getTime() + 26 * 3600000)
    vi.setSystemTime(later)
    server.reset()
    await tick(60000)
    await eventually(() => expect(server.dayFigures()).toHaveLength(1))
    expect(whereOf(server.dayFigures()[0])[0].value.value).toBe(toApiUtc(startOfLocalDay(new Date(later.getTime() + 60000))))
    expect(whereOf(server.dayFigures()[0])[0].value.value).not.toBe(firstFrom)
    await eventually(() => expect(ui().live.refreshing).toBe(false))
    // nothing in the fixture is newer than that midnight
    expect(ui().dayFigures.activeToday).toBe(0)
    expect(ui().dayFigures.atStakeToday).toBe(0)
  })

  it('does not empty the list or flag loading while it refreshes', async () => {
    await mount()
    await act2(() => ui().onViewChange('live'))
    const gates = []
    server.on(
      call => call.path === '/carts/dashboard' && call.params.get('page_size') === '50' && call.where?.[0]?.value?.value === minutesBefore(29),
      () => new Promise(resolve => { gates.push(resolve) })
    )
    await tick(60000)
    await eventually(() => expect(gates).toHaveLength(1))
    expect(ui().live.refreshing).toBe(true)
    expect(ui().list.loading).toBe(false)
    expect(ids(ui().list.carts)).toEqual([18106])
    await act(async () => { gates[0]({ error: false, result: [], pagination: { current_page: 1, page_size: 50, total: 0, total_pages: 1 } }); await new Promise(resolve => setTimeout(resolve, 0)) })
    await eventually(() => expect(ui().live.refreshing).toBe(false))
    expect(ui().list.carts).toEqual([])
  })

  it('skips the reload while the browser tab is hidden', async () => {
    await mount()
    await act2(() => ui().onViewChange('live'))
    server.reset()
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    await tick(180000)
    expect(server.calls).toHaveLength(0)
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    await tick(60000)
    await eventually(() => expect(server.liveLists()).toHaveLength(1))
  })

  it('does not poll in any other view', async () => {
    await mount()
    server.reset()
    await tick(180000)
    expect(server.calls).toHaveLength(0)
    await act2(() => ui().onViewChange('all'))
    server.reset()
    await tick(180000)
    expect(server.calls).toHaveLength(0)
  })

  it('stops polling when the view changes away and when it unmounts', async () => {
    await mount()
    await act2(() => ui().onViewChange('live'))
    await act2(() => ui().onViewChange('paymentFailed'))
    server.reset()
    await tick(120000)
    expect(server.calls).toHaveLength(0)
    await act2(() => ui().onViewChange('live'))
    cleanup()
    server.reset()
    await tick(120000)
    expect(server.calls).toHaveLength(0)
  })

  it('refresh() reloads on demand', async () => {
    await mount()
    await act2(() => ui().onViewChange('live'))
    server.reset()
    await act(async () => { ui().live.refresh() })
    await eventually(() => expect(server.liveLists()).toHaveLength(1))
    await eventually(() => expect(ui().live.refreshing).toBe(false))
  })
})

describe('OpenCartListing: server totals', () => {
  it('the list and the figures of today ask for params=totals and no row reads GET /carts/{uuid}', async () => {
    await mount()
    expect(server.details()).toHaveLength(0)
    server.lists().forEach(call => expect(call.params.get('params')).toBe('totals'))
    // the counts need no totals
    server.counts().forEach(call => expect(call.params.get('params')).toBeNull())
    // Follow up ranks by the same values: failed payment first, then 20, 15
    expect(ids(ui().list.groups[0].carts)).toEqual([18102, 18101, 18106])
    expect(ui().details[18101]).toMatchObject({ loading: false, error: null, partial: true })
    expect(ui().details[18101].cart).toMatchObject({ total: 20, id: 18101, user: { name: 'Ana', address: '18101 Main St' } })
    expect(ui().details[18101].cart.products[0].name).toBe('Burger 18101')
    const sinceMidnight = toApiUtc(startOfLocalDay(NOW))
    const today = server.carts.filter(cart => cart.updated_at >= sinceMidnight)
    expect(ui().dayFigures.atStakeToday).toBe(today.reduce((sum, cart) => sum + TOTALS[cart.id], 0))

    // the rows asking again (the table does on every change) read nothing
    await act(async () => { await ui().ensureDetails(ui().list.carts) })
    expect(server.details()).toHaveLength(0)
  })

  it('the open panel reads its whole detail, once, and it replaces the partial one', async () => {
    await mount()
    const cart = ui().list.carts.find(item => item.id === 18101)
    await act(async () => { await ui().ensureDetails([cart], { full: true }) })
    expect(server.details().map(call => call.path)).toEqual(['/carts/uuid-18101'])
    expect(ui().details[18101].partial).toBeUndefined()
    expect(ui().details[18101].cart.products).toHaveLength(3)

    // a silent reload brings the same cart: its whole detail stays, and is not read again
    await act(async () => { ui().live.refresh() })
    await quiet()
    expect(ui().details[18101].cart.products).toHaveLength(3)
    await act(async () => { await ui().ensureDetails([cart], { full: true }) })
    expect(server.details()).toHaveLength(1)
  })

  it('marks as full only the detail GET /carts/{uuid} answered, while it reloads and when a newer read fails', async () => {
    await mount()
    const cart = ui().list.carts.find(item => item.id === 18101)
    expect(ui().details[18101].full).toBeUndefined()

    let release
    server.on(call => call.path === '/carts/uuid-18101', () => new Promise((resolve) => { release = resolve }))
    act(() => { ui().ensureDetails([cart], { full: true }) })
    await eventually(() => expect(ui().details[18101].loading).toBe(true))
    expect(ui().details[18101].full).toBeUndefined()
    expect(ui().details[18101].cart.total).toBe(20)
    await act(async () => { release({ error: true, result: ['Cart is gone'] }) })
    await quiet()
    expect(ui().details[18101]).toMatchObject({ loading: false, error: ['Cart is gone'] })
    expect(ui().details[18101].full).toBeUndefined()

    server.overrides.length = 0
    await act(async () => { await ui().ensureDetails([cart], { retry: true }) })
    expect(ui().details[18101]).toMatchObject({ loading: false, error: null, full: true })

    server.on(call => call.path === '/carts/uuid-18101', () => ({ error: true, result: ['Cart is gone'] }))
    await act(async () => { await ui().ensureDetails([{ ...cart, updated_at: minutesBefore(1) }], { full: true }) })
    expect(server.details()).toHaveLength(3)
    expect(ui().details[18101]).toMatchObject({ loading: false, error: ['Cart is gone'], full: true })
    expect(ui().details[18101].cart.products).toHaveLength(3)
  })

  it('with an API that brings no totals: the rows read their details as today', async () => {
    server.serverTotals = false
    await mount()
    expect(server.details()).toHaveLength(17)
    expect(ids(ui().list.groups[0].carts)).toEqual([18102, 18101, 18106])
  })

  it('a total the API could not compute is a failed row that is not retried by itself', async () => {
    server.uncomputable = [18101]
    await mount()
    expect(ui().details[18101]).toMatchObject({ loading: false, partial: true })
    expect(ui().details[18101].error).toHaveLength(1)
    await act(async () => { await ui().ensureDetails([ui().list.carts.find(item => item.id === 18101)]) })
    expect(server.details()).toHaveLength(0)
    // the panel's «Retry» reads it
    await act(async () => { await ui().ensureDetails([server.carts.find(item => item.id === 18101)], { retry: true }) })
    expect(server.details().map(call => call.path)).toEqual(['/carts/uuid-18101'])
    expect(ui().details[18101]).toMatchObject({ loading: false, error: null })
  })
})
