/* eslint-disable import/first */
// redesign driver-store-status (M-DSS1): a failed read is an error the UI can show and retry, not an empty
// page with zeros. The requests (users, drivergroups, 3 order counts, 2 order lists) are main's; (row 29) adds the
// active businesses (the stores that are in no group).
import React from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Ordering } from '../../../sdk/lib/classes/Ordering'

// Stable values, as the real providers give: a new object per render would refetch forever.
const sessionValue = vi.hoisted(() => [{ token: 'tok', loading: false, user: { id: 1, level: 0 } }])
vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => sessionValue
}))
const socket = vi.hoisted(() => ({ on: vi.fn(), off: vi.fn(), join: vi.fn(), leave: vi.fn() }))
vi.mock('../../../contexts/WebsocketContext', () => ({
  useWebsocket: () => socket,
  useSocketInstance: () => null
}))

// The SDK chain of the controller: users().asDashboard().select().where().get() and
// orders().asDashboard().select().parameters().where().get(); `api.users` and `api.orders` answer each call.
const api = vi.hoisted(() => ({ users: null, orders: null, businesses: null, wheres: [], requests: [] }))
const chain = (answer) => {
  const link = {
    asDashboard: () => link,
    select: () => link,
    parameters: () => link,
    where: (where) => { api.wheres.push(where); return link },
    get: () => answer()
  }
  return link
}
// (row 29): `businesses()` is the REAL SDK, so the test sees the exact URL it builds; only the XHR underneath is a stub
const sdk = vi.hoisted(() => ({ ordering: null }))
const ordering = vi.hoisted(() => [{
  root: 'http://api/v400/en/development',
  setAccessToken: (token) => ({
    users: () => chain(() => api.users()),
    orders: () => chain(() => api.orders()),
    businesses: () => sdk.ordering.setAccessToken(token).businesses()
  })
}])
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => ordering
}))

import { DriverStoreStatus } from '../index'

sdk.ordering = new Ordering({ url: 'http://api', version: 'v400', language: 'en', project: 'development' })

class StubXhr {
  open (method, url) { this.method = method; this.url = url; this.headers = {} }
  setRequestHeader (name, value) { this.headers[name] = value }
  abort () {}
  send () {
    api.requests.push({ url: this.url, headers: this.headers })
    api.businesses().then(
      body => { this.status = 200; this.statusText = 'OK'; this.response = JSON.stringify(body); this.onload?.() },
      err => this.onerror?.(err)
    )
  }
}

let ui = null
const UI = (props) => { ui = props; return null }

const okUsers = () => Promise.resolve({ content: { error: false, result: [{ id: 1, enabled: true, available: true, drivergroups: [5] }] } })
const okOrders = () => Promise.resolve({ content: { error: false, result: [], pagination: { total: 3 } } })
const okBusinesses = () => Promise.resolve({ error: false, result: [{ id: 8, name: 'North', enabled: true }, { id: 9, name: 'Loose', enabled: true }] })
const okGroups = { ok: true, json: async () => ({ error: false, result: [{ id: 5, business: [{ id: 8, name: 'North', enabled: true }] }] }) }

const order = (overrides) => ({ id: 1, business_id: 8, driver_id: null, status: 0, delivery_type: 1, has_items: true, delivery_datetime: '2026-10-20 12:00:00', ...overrides })
const emit = async (event, payload) => {
  const handler = socket.on.mock.calls.find(([name]) => name === event)[1]
  await act(async () => { handler(payload) })
}
const deferred = () => {
  const d = {}
  d.promise = new Promise((resolve, reject) => { d.resolve = resolve; d.reject = reject })
  return d
}

const mount = async () => {
  await act(async () => { render(<DriverStoreStatus UIComponent={UI} />) })
  await act(async () => {})
}

const realXhr = window.XMLHttpRequest
beforeEach(() => {
  ui = null
  sessionValue[0].user = { id: 1, level: 0 }
  api.wheres = []
  api.requests = []
  api.users = okUsers
  api.orders = okOrders
  api.businesses = okBusinesses
  window.XMLHttpRequest = StubXhr
  global.fetch = vi.fn(() => Promise.resolve(okGroups))
})

afterEach(() => {
  window.XMLHttpRequest = realXhr
  vi.restoreAllMocks()
})

describe('DriverStoreStatus controller · load errors (M-DSS1)', () => {
  it('loads with no error flags when every read answers', async () => {
    await mount()
    expect(ui.structureError).toBe(false)
    expect(ui.ordersError).toBe(false)
    expect(ui.groups).toHaveLength(1)
    expect(ui.orderCounts).toEqual({ total: 3, assigned: 3, finished: 3 })
  })

  it('flags the structure when the drivers read fails, and clears the flag on a successful reload', async () => {
    api.users = () => Promise.reject(new Error('Network'))
    await mount()
    expect(ui.structureError).toBe(true)
    expect(ui.driversLoading).toBe(false)
    api.users = okUsers
    await act(async () => { ui.onReload() })
    await act(async () => {})
    expect(ui.structureError).toBe(false)
  })

  it('flags the structure when the API answers the drivers read with an error', async () => {
    api.users = () => Promise.resolve({ content: { error: true, result: 'Session expired' } })
    await mount()
    expect(ui.structureError).toBe(true)
  })

  it('flags the structure when /drivergroups answers an error (never reads its message as groups)', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ error: true, result: 'Forbidden' }) }))
    await mount()
    expect(ui.structureError).toBe(true)
    expect(ui.groups).toEqual([])
  })

  it('flags the orders when a count answers an error, and keeps the structure clean', async () => {
    api.orders = () => Promise.resolve({ content: { error: true, result: 'Bad where' } })
    await mount()
    expect(ui.ordersError).toBe(true)
    expect(ui.ordersLoading).toBe(false)
    expect(ui.structureError).toBe(false)
  })
})

describe('DriverStoreStatus controller · which source failed (review r1, Q-01 and Q-02)', () => {
  it('names the failed source: drivers or groups', async () => {
    api.users = () => Promise.reject(new Error('Network'))
    await mount()
    expect(ui.driversError).toBe(true)
    expect(ui.groupsError).toBe(false)
  })

  it('names a failed groups read apart from the drivers', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, json: async () => ({ error: true, result: 'Forbidden' }) }))
    await mount()
    expect(ui.groupsError).toBe(true)
    expect(ui.driversError).toBe(false)
  })
})

// (row 29, driver-store-status P-4): the active stores that are in no delivery group come from one more read
describe('DriverStoreStatus controller · active businesses (row 29)', () => {
  const BUSINESSES_URL = 'http://api/v400/en/development/business?params=id,name,enabled&where=[{"attribute":"enabled","value":true}]&mode=dashboard'

  it('asks for the enabled businesses in dashboard mode with the session token, once per load (8 reads with the 7 of main)', async () => {
    await mount()
    expect(api.requests.map(request => request.url)).toEqual([BUSINESSES_URL])
    expect(api.requests[0].headers.Authorization).toBe('Bearer tok')
    // every read of a load has a `where` except the groups (fetch) and the businesses (XHR): users 1 + orders 5, + groups 1 + businesses 1
    expect(api.wheres.length + global.fetch.mock.calls.length + api.requests.length).toBe(8)
  })

  it('hands the businesses down with no error and no loading once they are in', async () => {
    await mount()
    expect(ui.businesses.map(business => business.id)).toEqual([8, 9])
    expect(ui.businessesLoading).toBe(false)
    expect(ui.businessesError).toBe(false)
  })

  it('flags a failed read apart from the others (the answer carrying an error is not read as businesses)', async () => {
    api.businesses = () => Promise.resolve({ error: true, result: 'Forbidden' })
    await mount()
    expect(ui.businessesError).toBe(true)
    expect(ui.businesses).toEqual([])
    expect(ui.businessesLoading).toBe(false)
    expect(ui.groupsError).toBe(false)
    expect(ui.driversError).toBe(false)
    expect(ui.ordersError).toBe(false)
  })

  it('flags a network failure, and the reload refetches and clears the flag', async () => {
    api.businesses = () => Promise.reject(new Error('Network'))
    await mount()
    expect(ui.businessesError).toBe(true)
    api.businesses = okBusinesses
    await act(async () => { ui.onReload() })
    await act(async () => {})
    expect(api.requests).toHaveLength(2)
    expect(ui.businessesError).toBe(false)
    expect(ui.businesses).toHaveLength(2)
  })

  it('keeps the businesses it had when a reload fails (and says so)', async () => {
    await mount()
    api.businesses = () => Promise.reject(new Error('Network'))
    await act(async () => { ui.onReload() })
    await act(async () => {})
    expect(ui.businessesError).toBe(true)
    expect(ui.businesses).toHaveLength(2)
  })

  it('is loading while the read is in flight', async () => {
    const pending = deferred()
    api.businesses = () => pending.promise
    await mount()
    expect(ui.businessesLoading).toBe(true)
    await act(async () => { pending.resolve({ error: false, result: [] }) })
    expect(ui.businessesLoading).toBe(false)
  })

  it('keeps the newer businesses when two reloads resolve out of order', async () => {
    await mount()
    const first = deferred()
    const second = deferred()
    api.businesses = () => first.promise
    await act(async () => { ui.onReload() })
    api.businesses = () => second.promise
    await act(async () => { ui.onReload() })
    await act(async () => { second.resolve({ error: false, result: [{ id: 2, name: 'New', enabled: true }] }) })
    await act(async () => { first.resolve({ error: false, result: [{ id: 3, name: 'Old', enabled: true }] }) })
    expect(ui.businesses.map(business => business.id)).toEqual([2])
    expect(ui.businessesLoading).toBe(false)
  })
})

// (review L4): a drivers manager (level 5) may be forbidden the stores read and sees only his groups' stores anyway
describe('DriverStoreStatus controller · stores read by level (review L4)', () => {
  it('level 0 asks for the active stores', async () => {
    await mount()
    expect(api.requests).toHaveLength(1)
    expect(ui.businesses).toHaveLength(2)
  })

  it('level 5 does not ask: no stores, not loading, no error, and the other reads are untouched', async () => {
    sessionValue[0].user = { id: 1, level: 5 }
    api.businesses = () => Promise.resolve({ error: true, result: 'Forbidden' }) // would flag the page if it were asked
    await mount()
    expect(api.requests).toHaveLength(0)
    expect(ui.businesses).toEqual([])
    expect(ui.businessesLoading).toBe(false)
    expect(ui.businessesError).toBe(false)
    expect(ui.structureError).toBe(false)
    expect(ui.groups).toHaveLength(1)
    expect(api.wheres.length + global.fetch.mock.calls.length).toBe(7) // the 7 reads of main
    await act(async () => { ui.onReload() })
    await act(async () => {})
    expect(api.requests).toHaveLength(0)
    expect(ui.businessesError).toBe(false)
  })
})

// (review M4): the in-progress share of «Active unassigned», for the tab «View unassigned orders» opens
describe('DriverStoreStatus controller · activeInProgressByBusiness (review M4)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 20, 15, 30))
    socket.on.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('counts only the orders of the /deliveries «In progress» group, so a pending one counts in activeByBusiness alone', async () => {
    api.orders = () => Promise.resolve({ content: { error: false, result: [order({ id: 1, status: 0 }), order({ id: 2, status: 0 })], pagination: { total: 2 } } })
    await mount()
    expect(ui.activeByBusiness.get(8)).toBe(2)
    expect(ui.activeInProgressByBusiness.get(8)).toBeUndefined()
    await emit('update_order', order({ id: 3, status: 7 }))
    expect(ui.activeByBusiness.get(8)).toBe(3)
    expect(ui.activeInProgressByBusiness.get(8)).toBe(1)
  })

  it('moves an order to In progress when its status changes', async () => {
    await mount()
    await emit('update_order', order({ id: 1, status: 0 }))
    expect(ui.activeInProgressByBusiness.get(8)).toBeUndefined()
    await emit('update_order', { id: 1, status: 8 })
    expect(ui.activeByBusiness.get(8)).toBe(1)
    expect(ui.activeInProgressByBusiness.get(8)).toBe(1)
  })
})

// + «Active unassigned» counts delivery orders only, from yesterday (the overdue) to the end of today
describe('DriverStoreStatus controller · Active unassigned ()', () => {
  const activeQuery = () => api.wheres.find(where => where.conditions.some(c => c.attribute === 'driver_id' && c.value.value === null))
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 20, 15, 30))
    socket.on.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('asks the server for delivery orders (1 and 7) from yesterday 00:00:00 to today 23:59:59', async () => {
    await mount()
    const { conditions } = activeQuery()
    expect(conditions).toContainEqual({ attribute: 'delivery_type', value: [1, 7] })
    expect(conditions).toContainEqual({ attribute: 'delivery_datetime', value: { condition: '>=', value: '2026-10-19 00:00:00' } })
    expect(conditions).toContainEqual({ attribute: 'delivery_datetime', value: { condition: '<=', value: '2026-10-20 23:59:59' } })
  })

  it('keeps the Finished today range: from today 00:00:00 to today 23:59:59, with no delivery type', async () => {
    await mount()
    const finished = api.wheres.find(where => where.conditions.some(c => c.attribute === 'status' && c.value.includes(1)) && where.conditions.some(c => c.attribute === 'delivery_datetime'))
    expect(finished.conditions).toContainEqual({ attribute: 'delivery_datetime', value: { condition: '>=', value: '2026-10-20 00:00:00' } })
    expect(finished.conditions).toContainEqual({ attribute: 'delivery_datetime', value: { condition: '<=', value: '2026-10-20 23:59:59' } })
    expect(finished.conditions.some(c => c.attribute === 'delivery_type')).toBe(false)
  })

  it('counts a delivery order from the socket', async () => {
    await mount()
    await emit('update_order', order())
    expect(ui.activeByBusiness.get(8)).toBe(1)
  })

  it('does not count a pickup order (delivery_type 2) from the socket', async () => {
    await mount()
    await emit('update_order', order({ delivery_type: 2 }))
    expect(ui.activeByBusiness.get(8)).toBeUndefined()
  })

  it('does not count an order from tomorrow', async () => {
    await mount()
    await emit('update_order', order({ delivery_datetime: '2026-10-21 09:00:00' }))
    expect(ui.activeByBusiness.get(8)).toBeUndefined()
  })

  it('still counts an order from yesterday that is unassigned', async () => {
    await mount()
    await emit('update_order', order({ delivery_datetime: '2026-10-19 22:00:00' }))
    expect(ui.activeByBusiness.get(8)).toBe(1)
  })

  it('does not count an order from the day before yesterday', async () => {
    await mount()
    await emit('update_order', order({ delivery_datetime: '2026-10-18 22:00:00' }))
    expect(ui.activeByBusiness.get(8)).toBeUndefined()
  })
})

// redesign bugs-d row 62: a response that is not the latest of its source never overwrites it, and the socket events that
// arrive while a read is in flight are applied over its result instead of being lost
describe('DriverStoreStatus controller · request order and socket events in flight (row 62)', () => {
  const driver = (overrides) => ({ id: 1, enabled: true, available: true, ...overrides })
  const usersAnswer = (result) => ({ content: { error: false, result } })
  const ordersAnswer = (total, result = []) => ({ content: { error: false, result, pagination: { total } } })
  const groupsAnswer = (id) => ({ ok: true, json: async () => ({ error: false, result: [{ id, business: [] }] }) })

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 20, 15, 30))
    socket.on.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps the newer drivers when two reloads resolve out of order', async () => {
    await mount()
    const first = deferred()
    const second = deferred()
    api.users = () => first.promise
    await act(async () => { ui.onReload() })
    api.users = () => second.promise
    await act(async () => { ui.onReload() })
    await act(async () => { second.resolve(usersAnswer([driver({ id: 2 })])) })
    await act(async () => { first.resolve(usersAnswer([driver({ id: 3 })])) })
    expect(ui.drivers.map(item => item.id)).toEqual([2])
    expect(ui.driversLoading).toBe(false)
  })

  it('does not flag the drivers when an older read fails after a newer one succeeded', async () => {
    await mount()
    const first = deferred()
    const second = deferred()
    api.users = () => first.promise
    await act(async () => { ui.onReload() })
    api.users = () => second.promise
    await act(async () => { ui.onReload() })
    await act(async () => { second.resolve(usersAnswer([driver({ id: 2 })])) })
    await act(async () => { first.reject(new Error('Network')) })
    expect(ui.driversError).toBe(false)
    expect(ui.drivers.map(item => item.id)).toEqual([2])
  })

  it('keeps the newer groups when two reloads resolve out of order', async () => {
    await mount()
    const first = deferred()
    const second = deferred()
    global.fetch = vi.fn(() => first.promise)
    await act(async () => { ui.onReload() })
    global.fetch = vi.fn(() => second.promise)
    await act(async () => { ui.onReload() })
    await act(async () => { second.resolve(groupsAnswer(22)) })
    await act(async () => { first.resolve(groupsAnswer(11)) })
    expect(ui.groups.map(group => group.id)).toEqual([22])
  })

  it('keeps the newer order figures when two reloads resolve out of order', async () => {
    await mount()
    const first = deferred()
    const second = deferred()
    api.orders = () => first.promise
    await act(async () => { ui.onReload() })
    api.orders = () => second.promise
    await act(async () => { ui.onReload() })
    await act(async () => { second.resolve(ordersAnswer(7)) })
    await act(async () => { first.resolve(ordersAnswer(1)) })
    expect(ui.orderCounts.total).toBe(7)
    expect(ui.ordersLoading).toBe(false)
  })

  it('keeps an update_order received while the orders read is in flight', async () => {
    await mount()
    const pending = deferred()
    api.orders = () => pending.promise
    await act(async () => { ui.onReload() })
    await emit('update_order', order())
    await act(async () => { pending.resolve(ordersAnswer(3)) })
    expect(ui.activeByBusiness.get(8)).toBe(1)
    expect(ui.orderCounts.total).toBe(3)
  })

  it('keeps an orders_register received during the first load', async () => {
    const pending = deferred()
    api.orders = () => pending.promise
    await act(async () => { render(<DriverStoreStatus UIComponent={UI} />) })
    await emit('orders_register', order({ id: 4 }))
    await act(async () => { pending.resolve(ordersAnswer(3)) })
    expect(ui.activeByBusiness.get(8)).toBe(1)
  })

  it('keeps a batch_driver_changes received while the drivers read is in flight', async () => {
    await mount()
    const pending = deferred()
    api.users = () => pending.promise
    await act(async () => { ui.onReload() })
    await emit('batch_driver_changes', [{ driver_id: 1, changes: [{ attribute: 'available', new: false }] }])
    await act(async () => { pending.resolve(usersAnswer([driver()])) })
    expect(ui.drivers[0].available).toBe(false)
  })

  it('keeps the live events when the read in flight fails', async () => {
    await mount()
    const pending = deferred()
    api.orders = () => pending.promise
    await act(async () => { ui.onReload() })
    await emit('update_order', order())
    await act(async () => { pending.reject(new Error('Network')) })
    expect(ui.ordersError).toBe(true)
    expect(ui.activeByBusiness.get(8)).toBe(1)
  })
})

// «Today» and «Active unassigned» are the days of the user's time zone (user.timezone, as /orders' Today), not of the
// browser; without one, the browser's, and the page is told so. The browser is in Tokyo, where it is already the 28th (01:30)
// while it is still the 27th in Bogotá (11:30).
describe('DriverStoreStatus controller · the user\'s time zone', () => {
  const originalTZ = process.env.TZ
  const activeQuery = () => api.wheres.find(where => where.conditions.some(c => c.attribute === 'driver_id' && c.value.value === null))
  const finishedQuery = () => api.wheres.find(where => where.conditions.some(c => c.attribute === 'status' && c.value.includes(1)) && where.conditions.some(c => c.attribute === 'delivery_datetime'))

  beforeEach(() => {
    process.env.TZ = 'Asia/Tokyo'
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-27T16:30:00Z'))
    socket.on.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    if (originalTZ === undefined) delete process.env.TZ
    else process.env.TZ = originalTZ
  })

  it('asks for the days of the user\'s zone and hands that zone to the page', async () => {
    sessionValue[0].user = { id: 1, level: 0, timezone: 'America/Bogota' }
    await mount()
    expect(activeQuery().conditions).toContainEqual({ attribute: 'delivery_datetime', value: { condition: '>=', value: '2026-10-26 00:00:00' } })
    expect(activeQuery().conditions).toContainEqual({ attribute: 'delivery_datetime', value: { condition: '<=', value: '2026-10-27 23:59:59' } })
    expect(finishedQuery().conditions).toContainEqual({ attribute: 'delivery_datetime', value: { condition: '>=', value: '2026-10-27 00:00:00' } })
    expect(finishedQuery().conditions).toContainEqual({ attribute: 'delivery_datetime', value: { condition: '<=', value: '2026-10-27 23:59:59' } })
    expect(ui.timeZone).toEqual({ zone: 'America/Bogota', fallback: false })
  })

  it('counts the live orders by the user\'s day: Bogotá\'s tomorrow is not today', async () => {
    sessionValue[0].user = { id: 1, level: 0, timezone: 'America/Bogota' }
    await mount()
    await emit('update_order', order({ id: 1, delivery_datetime: '2026-10-27 20:00:00' }))
    await emit('update_order', order({ id: 2, delivery_datetime: '2026-10-28 09:00:00' }))
    expect(ui.activeByBusiness.get(8)).toBe(1)
  })

  it('without a zone on the user, uses the browser\'s and says it is a fallback', async () => {
    await mount()
    expect(activeQuery().conditions).toContainEqual({ attribute: 'delivery_datetime', value: { condition: '<=', value: '2026-10-28 23:59:59' } })
    expect(ui.timeZone).toEqual({ zone: 'Asia/Tokyo', fallback: true })
  })
})
