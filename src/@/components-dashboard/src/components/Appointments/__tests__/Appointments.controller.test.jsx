/* eslint-disable import/first */
// redesign appointments lote A (decisions 2 and 7): only the last requested business writes the state,
// a failure never leaves loading on, the UI can retry, and the chosen business is remembered per project and user.
// Request URL, headers and props are main's.
import React from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const session = vi.hoisted(() => ({ user: { id: 7 }, project: 'development' }))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'tok', user: session.user }]
}))
// The SDK check of a remembered business (R1-03): ordering.setAccessToken(t).businesses(id).asDashboard().select(cols).get(),
// settled by hand like the fetch below.
const sdk = vi.hoisted(() => ({ tokens: [], ids: [], selects: [], pending: [] }))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{
    root: 'http://api/v400/en/development',
    project: session.project,
    setAccessToken: (token) => {
      sdk.tokens.push(token)
      return {
        businesses: (id) => {
          sdk.ids.push(id)
          return {
            asDashboard: () => ({
              select: (columns) => {
                sdk.selects.push(columns)
                return { get: () => new Promise((resolve, reject) => { sdk.pending.push({ resolve, reject }) }) }
              }
            })
          }
        }
      }
    }
  }]
}))

import { Appointments } from '../index'
import { readRememberedBusiness, writeRememberedBusiness } from '../rememberedBusiness'

let ui = null
const UI = (props) => { ui = props; return null }

const KEY = 'appointments.business.development.7'
const storeA = { id: 1, name: 'Store A' }
const storeB = { id: 2, name: 'Store B' }
const eventsA = [{ id: 'a1' }]
const eventsB = [{ id: 'b1' }, { id: 'b2' }]

// A fetch whose responses are settled by hand, in any order.
const pending = []
const fetchMock = vi.fn((url, options) => new Promise((resolve, reject) => {
  pending.push({ url, options, resolve, reject })
}))
const respond = async (index, body) => {
  await act(async () => {
    pending[index].resolve({ json: async () => body })
  })
}
const respondWith = (url, body) => respond(pending.findIndex(p => p.url.includes(url)), body)

const verified = (index, content) => act(async () => { sdk.pending[index].resolve({ content }) })
const verifyFails = (index, message) => act(async () => { sdk.pending[index].reject(new Error(message)) })

const mount = () => render(<Appointments UIComponent={UI} />)
const choose = (business) => act(() => { ui.setSelectedBusiness(business) })

beforeEach(() => {
  ui = null
  pending.length = 0
  sdk.tokens.length = 0
  sdk.ids.length = 0
  sdk.selects.length = 0
  sdk.pending.length = 0
  fetchMock.mockClear()
  session.user = { id: 7 }
  session.project = 'development'
  window.localStorage.clear()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Appointments controller · request', () => {
  it('asks the same URL with the same headers, once per chosen business', async () => {
    mount()
    expect(fetchMock).not.toHaveBeenCalled()
    await choose(storeA)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('http://api/v400/en/development/business/1/calendar_events?page=1&page_size=50', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' }
    })
    await respond(0, { error: false, result: eventsA })
    expect(ui.businessCalendarEvents).toEqual({ loading: false, result: eventsA, error: null, businessId: 1 })
  })
})

// redesign (row 50, R1-07): the API always pages calendar_events (page_size at most 50): every page is asked and joined
describe('Appointments controller · every page of events', () => {
  const page = (n, total, result) => ({ error: false, result, pagination: { current_page: n, total_pages: total, page_size: 50 } })

  // review F-2: once page 1 says how many there are, the other pages are asked together (20 pages are not 20 round trips in a row)
  it('asks the other pages together after the first and shows them all in page order, loading until then', async () => {
    mount()
    await choose(storeA)
    await respond(0, page(1, 3, [{ id: 'p1' }]))
    expect(pending.map(p => p.url)).toEqual([
      'http://api/v400/en/development/business/1/calendar_events?page=1&page_size=50',
      'http://api/v400/en/development/business/1/calendar_events?page=2&page_size=50',
      'http://api/v400/en/development/business/1/calendar_events?page=3&page_size=50'
    ])
    expect(ui.businessCalendarEvents.loading).toBe(true)
    await respond(2, page(3, 3, [{ id: 'p3' }]))
    expect(ui.businessCalendarEvents.loading).toBe(true)
    await respond(1, page(2, 3, [{ id: 'p2' }]))
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(ui.businessCalendarEvents).toEqual({ loading: false, result: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }], error: null, businessId: 1 })
  })

  it('a failing later page is an error, not a partial list', async () => {
    mount()
    await choose(storeA)
    await respond(0, page(1, 2, [{ id: 'p1' }]))
    await respond(1, { error: true, result: ['Boom'] })
    expect(ui.businessCalendarEvents).toEqual({ loading: false, result: [], error: ['Boom'], businessId: 1 })
  })

  it('a business chosen meanwhile drops the pages of the previous one', async () => {
    mount()
    await choose(storeA)
    await respond(0, page(1, 2, [{ id: 'p1' }]))
    await choose(storeB)
    await respond(1, page(2, 2, [{ id: 'p2' }]))
    expect(ui.businessCalendarEvents.loading).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    await respondWith('business/2/', { error: false, result: eventsB })
    expect(ui.businessCalendarEvents).toEqual({ loading: false, result: eventsB, error: null, businessId: 2 })
  })
})

describe('Appointments controller · race', () => {
  it('empties the result while another business loads', async () => {
    mount()
    await choose(storeA)
    await respond(0, { error: false, result: eventsA })
    expect(ui.businessCalendarEvents.result).toEqual(eventsA)

    await choose(storeB)
    expect(ui.businessCalendarEvents).toEqual({ loading: true, result: [], error: null, businessId: 1 })
  })

  it('keeps the events of the second business when the first answers last', async () => {
    mount()
    await choose(storeA)
    await choose(storeB)
    expect(pending).toHaveLength(2)

    await respondWith('/business/2/', { error: false, result: eventsB })
    expect(ui.businessCalendarEvents).toEqual({ loading: false, result: eventsB, error: null, businessId: 2 })

    await respondWith('/business/1/', { error: false, result: eventsA })
    expect(ui.businessCalendarEvents).toEqual({ loading: false, result: eventsB, error: null, businessId: 2 })
  })

  it('drops a late failure of the first business too', async () => {
    mount()
    await choose(storeA)
    await choose(storeB)
    await respondWith('/business/2/', { error: false, result: eventsB })
    await act(async () => { pending[0].reject(new Error('late')) })
    expect(ui.businessCalendarEvents).toEqual({ loading: false, result: eventsB, error: null, businessId: 2 })
  })

  it('does not show the previous business events after a failure', async () => {
    mount()
    await choose(storeA)
    await respond(0, { error: false, result: eventsA })
    await choose(storeB)
    await respond(1, { error: true, result: ['nope'] })
    expect(ui.businessCalendarEvents.result).toEqual([])
  })

  it('does not show the previous business events after a network failure', async () => {
    mount()
    await choose(storeA)
    await respond(0, { error: false, result: eventsA })
    await choose(storeB)
    await act(async () => { pending[1].reject(new Error('Failed to fetch')) })
    expect(ui.businessCalendarEvents).toEqual({ loading: false, result: [], error: ['Failed to fetch'], businessId: 2 })
  })
})

describe('Appointments controller · errors', () => {
  it('passes the API messages and an empty result when the response has error: true', async () => {
    mount()
    await choose(storeA)
    await respond(0, { error: true, result: ['x'] })
    expect(ui.businessCalendarEvents).toEqual({ loading: false, result: [], error: ['x'], businessId: 1 })
  })

  it('turns a rejected fetch into [message] and stops loading', async () => {
    mount()
    await choose(storeA)
    await act(async () => { pending[0].reject(new Error('Failed to fetch')) })
    expect(ui.businessCalendarEvents).toEqual({ loading: false, result: [], error: ['Failed to fetch'], businessId: 1 })
  })

  it('turns a non-JSON answer (500 with HTML) into [message] and stops loading', async () => {
    mount()
    await choose(storeA)
    await act(async () => {
      pending[0].resolve({ json: async () => { throw new SyntaxError('Unexpected token < in JSON') } })
    })
    expect(ui.businessCalendarEvents.loading).toBe(false)
    expect(ui.businessCalendarEvents.result).toEqual([])
    expect(ui.businessCalendarEvents.error).toEqual(['Unexpected token < in JSON'])
  })
})

describe('Appointments controller · refreshCalendarEvents', () => {
  it('asks again for the chosen business', async () => {
    mount()
    await choose(storeA)
    await respond(0, { error: true, result: ['x'] })
    expect(typeof ui.refreshCalendarEvents).toBe('function')

    await act(async () => { ui.refreshCalendarEvents() })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(pending[1].url).toBe('http://api/v400/en/development/business/1/calendar_events?page=1&page_size=50')
    expect(ui.businessCalendarEvents).toEqual({ loading: true, result: [], error: null, businessId: 1 })

    await respond(1, { error: false, result: eventsA })
    expect(ui.businessCalendarEvents).toEqual({ loading: false, result: eventsA, error: null, businessId: 1 })
  })

  it('does nothing without a chosen business', async () => {
    mount()
    expect(typeof ui.refreshCalendarEvents).toBe('function')
    await act(async () => { ui.refreshCalendarEvents() })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(ui.businessCalendarEvents).toEqual({ loading: false, result: [], error: null, businessId: null })
  })
})

describe('Appointments controller · remembered business', () => {
  it('writes {id, name} under the project and user key when a business is chosen', async () => {
    mount()
    await choose({ ...storeA, extra: 'ignored', schedule: [] })
    expect(JSON.parse(window.localStorage.getItem(KEY))).toEqual(storeA)
  })

  it('starts with the remembered business chosen and asks for its events', async () => {
    window.localStorage.setItem(KEY, JSON.stringify(storeB))
    mount()
    expect(ui.selectedBusiness).toEqual(storeB)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(pending[0].url).toBe('http://api/v400/en/development/business/2/calendar_events?page=1&page_size=50')
  })

  it('chooses nothing when the user never chose', () => {
    mount()
    expect(ui.selectedBusiness).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('chooses nothing, without error, when the stored JSON is broken', () => {
    window.localStorage.setItem(KEY, '{broken')
    mount()
    expect(ui.selectedBusiness).toBeNull()
    expect(ui.businessCalendarEvents).toEqual({ loading: false, result: [], error: null, businessId: null })
  })

  it('chooses nothing, without error, when localStorage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied') })
    mount()
    expect(ui.selectedBusiness).toBeNull()
    await choose(storeA)
    expect(ui.selectedBusiness).toEqual(storeA)
    expect(ui.businessCalendarEvents.error).toBeNull()
  })

  it('does not show it to another user', () => {
    window.localStorage.setItem(KEY, JSON.stringify(storeB))
    session.user = { id: 8 }
    mount()
    expect(ui.selectedBusiness).toBeNull()
  })

  it('does not show it in another project', () => {
    window.localStorage.setItem(KEY, JSON.stringify(storeB))
    session.project = 'other'
    mount()
    expect(ui.selectedBusiness).toBeNull()
  })

  it('neither reads nor writes without a user id', async () => {
    session.user = null
    const getItem = vi.spyOn(Storage.prototype, 'getItem')
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    mount()
    await choose(storeA)
    expect(getItem).not.toHaveBeenCalled()
    expect(setItem).not.toHaveBeenCalled()
    expect(ui.selectedBusiness).toEqual(storeA)
  })

  it('neither reads nor writes without a project', async () => {
    session.project = undefined
    const getItem = vi.spyOn(Storage.prototype, 'getItem')
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    mount()
    await choose(storeA)
    expect(getItem).not.toHaveBeenCalled()
    expect(setItem).not.toHaveBeenCalled()
  })

  it('removes the key when the business is cleared', async () => {
    window.localStorage.setItem(KEY, JSON.stringify(storeA))
    mount()
    await choose(null)
    expect(window.localStorage.getItem(KEY)).toBeNull()
  })
})

describe('Appointments controller · remembered business check (R1-03)', () => {
  const remember = (business = storeB) => window.localStorage.setItem(KEY, JSON.stringify(business))
  const cleared = { loading: false, result: [], error: null, businessId: null }

  it('asks the SDK once for { id, name, timezone } of the remembered business, with the session token', () => {
    remember()
    mount()
    expect(sdk.tokens).toEqual(['tok'])
    expect(sdk.ids).toEqual([2])
    expect(sdk.selects).toEqual([['id', 'name', 'timezone']]) // the zone the calendar opens in
    // the events request goes out in parallel, as before
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not check anything when nothing is remembered, nor a business chosen by hand', async () => {
    mount()
    await choose(storeA)
    expect(sdk.pending).toHaveLength(0)
  })

  it('checks only once per mount', async () => {
    remember()
    mount()
    await verified(0, { result: storeB })
    await choose(storeA)
    await choose(storeB)
    expect(sdk.pending).toHaveLength(1)
  })

  it.each([
    ['an empty array', { result: [] }],
    ['an error response', { error: true, result: ['Not found'] }],
    ['a null result', { result: null }],
    ['an empty object', { result: {} }]
  ])('forgets a remembered business that answers with %s', async (_, content) => {
    remember({ id: 999999, name: 'Ghost store' })
    mount()
    expect(ui.selectedBusiness).toEqual({ id: 999999, name: 'Ghost store' })
    await verified(0, content)
    expect(ui.selectedBusiness).toBeNull()
    expect(window.localStorage.getItem(KEY)).toBeNull()
    expect(ui.businessCalendarEvents).toEqual(cleared)
  })

  it('discards the events of a forgotten business, even if they answer late', async () => {
    remember({ id: 999999, name: 'Ghost store' })
    mount()
    await verified(0, { result: [] })
    await respond(0, { error: false, result: [] })
    expect(ui.businessCalendarEvents).toEqual(cleared)
    expect(ui.selectedBusiness).toBeNull()
  })

  it('discards events that had already arrived', async () => {
    remember({ id: 999999, name: 'Ghost store' })
    mount()
    await respond(0, { error: false, result: [] })
    expect(ui.businessCalendarEvents.businessId).toBe(999999)
    await verified(0, { result: [] })
    expect(ui.selectedBusiness).toBeNull()
    expect(ui.businessCalendarEvents).toEqual(cleared)
  })

  // the remembered store learns its zone (or a new one) the same way, so the calendar opens in it
  it('adds the store\'s timezone to the state and to localStorage, without asking for the events again', async () => {
    remember()
    mount()
    await verified(0, { result: { id: 2, name: 'Store B', timezone: 'America/Bogota' } })
    expect(ui.selectedBusiness).toEqual({ id: 2, name: 'Store B', timezone: 'America/Bogota' })
    expect(JSON.parse(window.localStorage.getItem(KEY))).toEqual({ id: 2, name: 'Store B', timezone: 'America/Bogota' })
    expect(readRememberedBusiness(window.localStorage, 'development', 7)).toEqual({ id: 2, name: 'Store B', timezone: 'America/Bogota' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('updates the name in the state and in localStorage when the business was renamed, without asking for the events again', async () => {
    remember()
    mount()
    await verified(0, { result: { id: 2, name: 'Store B renamed' } })
    expect(ui.selectedBusiness).toEqual({ id: 2, name: 'Store B renamed' })
    expect(JSON.parse(window.localStorage.getItem(KEY))).toEqual({ id: 2, name: 'Store B renamed' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await respond(0, { error: false, result: eventsB })
    expect(ui.businessCalendarEvents).toEqual({ loading: false, result: eventsB, error: null, businessId: 2 })
  })

  it('changes nothing when the name is the same', async () => {
    remember()
    mount()
    const before = ui.selectedBusiness
    await verified(0, { result: { id: 2, name: 'Store B', schedule: [] } })
    expect(ui.selectedBusiness).toBe(before)
    expect(JSON.parse(window.localStorage.getItem(KEY))).toEqual(storeB)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('forgets nothing on a network failure', async () => {
    remember()
    mount()
    await verifyFails(0, 'Failed to fetch')
    expect(ui.selectedBusiness).toEqual(storeB)
    expect(JSON.parse(window.localStorage.getItem(KEY))).toEqual(storeB)
    await respond(0, { error: false, result: eventsB })
    expect(ui.businessCalendarEvents).toEqual({ loading: false, result: eventsB, error: null, businessId: 2 })
  })

  it('ignores the check when another business was chosen meanwhile', async () => {
    remember({ id: 999999, name: 'Ghost store' })
    mount()
    await choose(storeA)
    await verified(0, { result: [] })
    expect(ui.selectedBusiness).toEqual(storeA)
    expect(JSON.parse(window.localStorage.getItem(KEY))).toEqual(storeA)
    expect(pending).toHaveLength(2)
    await respondWith('/business/1/', { error: false, result: eventsA })
    expect(ui.businessCalendarEvents).toEqual({ loading: false, result: eventsA, error: null, businessId: 1 })
  })

  it('does not let a rename of the old business overwrite the one chosen meanwhile', async () => {
    remember()
    mount()
    await choose(storeA)
    await verified(0, { result: { id: 2, name: 'Store B renamed' } })
    expect(ui.selectedBusiness).toEqual(storeA)
    expect(JSON.parse(window.localStorage.getItem(KEY))).toEqual(storeA)
  })

  it('ignores the check when the business was cleared meanwhile', async () => {
    remember()
    mount()
    await choose(null)
    await verified(0, { result: { id: 2, name: 'Store B renamed' } })
    expect(ui.selectedBusiness).toBeNull()
    expect(window.localStorage.getItem(KEY)).toBeNull()
  })
})

describe('Appointments controller · businessId of the result (R1-06)', () => {
  it('starts as null', () => {
    mount()
    expect(ui.businessCalendarEvents.businessId).toBeNull()
  })

  it('keeps the previous one while loading and takes the request business when it succeeds', async () => {
    mount()
    await choose(storeA)
    expect(ui.businessCalendarEvents).toEqual({ loading: true, result: [], error: null, businessId: null })
    await respond(0, { error: false, result: eventsA })
    expect(ui.businessCalendarEvents.businessId).toBe(1)

    await choose(storeB)
    expect(ui.businessCalendarEvents).toEqual({ loading: true, result: [], error: null, businessId: 1 })
    await respond(1, { error: false, result: eventsB })
    expect(ui.businessCalendarEvents.businessId).toBe(2)
  })

  it('takes the request business when it fails (API error and network)', async () => {
    mount()
    await choose(storeA)
    await respond(0, { error: true, result: ['x'] })
    expect(ui.businessCalendarEvents.businessId).toBe(1)

    await choose(storeB)
    expect(ui.businessCalendarEvents.businessId).toBe(1)
    await act(async () => { pending[1].reject(new Error('Failed to fetch')) })
    expect(ui.businessCalendarEvents.businessId).toBe(2)
  })

  it('a late answer of a replaced business does not change it', async () => {
    mount()
    await choose(storeA)
    await choose(storeB)
    await respondWith('/business/2/', { error: false, result: eventsB })
    await respondWith('/business/1/', { error: false, result: eventsA })
    expect(ui.businessCalendarEvents.businessId).toBe(2)
  })
})

describe('rememberedBusiness', () => {
  const memory = () => {
    const data = {}
    return {
      data,
      getItem: (k) => (k in data ? data[k] : null),
      setItem: (k, v) => { data[k] = String(v) },
      removeItem: (k) => { delete data[k] }
    }
  }

  it('round-trips only id and name', () => {
    const storage = memory()
    writeRememberedBusiness(storage, 'dev', 3, { id: 'abc', name: 'Shop', other: 1 })
    expect(storage.data['appointments.business.dev.3']).toBe(JSON.stringify({ id: 'abc', name: 'Shop' }))
    expect(readRememberedBusiness(storage, 'dev', 3)).toEqual({ id: 'abc', name: 'Shop' })
  })

  it('reads null for invalid shapes', () => {
    const storage = memory()
    const key = 'appointments.business.dev.3'
    const bad = [
      '{broken', 'null', '[]', '5', '"x"',
      JSON.stringify({ id: '', name: 'x' }),
      JSON.stringify({ id: null, name: 'x' }),
      JSON.stringify({ id: {}, name: 'x' }),
      JSON.stringify({ id: 1, name: 5 }),
      JSON.stringify({ id: 1 })
    ]
    bad.forEach((raw) => {
      storage.data[key] = raw
      expect(readRememberedBusiness(storage, 'dev', 3)).toBeNull()
    })
  })

  it('reads null when there is no storage or the storage throws', () => {
    expect(readRememberedBusiness(null, 'dev', 3)).toBeNull()
    expect(readRememberedBusiness({ getItem: () => { throw new Error('x') } }, 'dev', 3)).toBeNull()
  })

  it('does not throw when the storage throws on write', () => {
    const storage = { setItem: () => { throw new Error('x') }, removeItem: () => { throw new Error('x') } }
    expect(() => writeRememberedBusiness(storage, 'dev', 3, { id: 1, name: 'a' })).not.toThrow()
    expect(() => writeRememberedBusiness(storage, 'dev', 3, null)).not.toThrow()
    expect(() => writeRememberedBusiness(null, 'dev', 3, { id: 1, name: 'a' })).not.toThrow()
  })

  it('does nothing without project or user id', () => {
    const storage = memory()
    writeRememberedBusiness(storage, undefined, 3, { id: 1, name: 'a' })
    writeRememberedBusiness(storage, 'dev', undefined, { id: 1, name: 'a' })
    expect(storage.data).toEqual({})
    expect(readRememberedBusiness(storage, undefined, 3)).toBeNull()
    expect(readRememberedBusiness(storage, 'dev', undefined)).toBeNull()
  })
})
