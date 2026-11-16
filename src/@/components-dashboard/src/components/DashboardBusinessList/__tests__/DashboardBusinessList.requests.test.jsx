/* eslint-disable import/first */
// redesign stores 1.C: the list controller of /stores/list (also Connect, messages, BI and the ⌘K search).
// G1-07: an answer that comes back after a newer request never overwrites the list (one request number per load).
// G1-24: after a bulk Enable / Disable only the rows whose state really changed leave the tab, and the total goes down with them;
// a selection with stores of other pages asks for the page again, so rows and total are the server's.
import React from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({
  // a stable session: the controller reloads the list when the session object changes
  session: { token: 'test-token', loading: false, user: { level: 0 } },
  calls: [],
  project: 'demo',
  backofficeProjects: [],
  // redesign bugs F row 17: GET /countries requests the controller made
  countryRequests: 0,
  showToast: () => {}
}))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [mockState.session] }))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [null, { showToast: (...args) => mockState.showToast(...args) }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({ useLanguage: () => [{}, (_key, text) => text] }))
vi.mock('../../../contexts/AssistantContext', () => ({ useAssistantRecordChanges: () => {} }))
vi.mock('~/config', () => ({
  default: { get dashboard_project_allowlists () { return { backoffice_businesses: mockState.backofficeProjects } } }
}))
vi.mock('~/analytics/posthog', () => ({ captureDashboardOperation: () => {} }))
vi.mock('../../../contexts/ApiContext', () => {
  // the SDK chain of `ordering.businesses()...get()`: each get is a request the test answers when it wants
  const chain = {
    root: 'https://api.test/v400/en/demo',
    get project () { return mockState.project },
    setAccessToken: () => chain,
    businesses: () => chain,
    select: () => chain,
    asDashboard: () => chain,
    where: (where) => { chain.lastWhere = where; return chain },
    get: (options) => new Promise((resolve, reject) => { mockState.calls.push({ where: chain.lastWhere, options, resolve, reject }) }),
    countries: () => ({ get: async () => { mockState.countryRequests += 1; return { content: { error: false, result: [] } } } })
  }
  return { useApi: () => [chain] }
})

import { DashboardBusinessList } from '../index'

// the full shape the filter bar sends (storesListModel `initialFilterValues`), with `over` applied
const filters = (over) => ({ name: null, cityIds: [], availableMenus: { value: '', condition: '=' }, menus: { value: '', condition: '=' }, enabled: null, featured: null, externalId: null, ...over })
const store = (id, over = {}) => ({ id, name: `Store ${id}`, enabled: true, featured: false, ...over })
const answer = (businesses, { page = 1, pageSize = 10, total = businesses.length } = {}) => ({
  content: {
    error: false,
    result: businesses,
    pagination: { current_page: page, page_size: pageSize, total_pages: Math.ceil(total / pageSize), total, from: total ? (page - 1) * pageSize + 1 : 0, to: (page - 1) * pageSize + businesses.length }
  }
})

// The inactive probe (getInActiveBusinesses) asks for 10 `enabled: false` stores; the list of the Active tab asks for `enabled: true`
// (the Inactive-tab test lists 25 a page, so its list never looks like the probe)
const isInactiveProbe = (call) => call.options.query.page_size === 10 &&
  call.where?.conditions?.some(condition => condition.attribute === 'enabled' && condition.value === false)
const listCalls = () => mockState.calls.filter(call => !isInactiveProbe(call))

let latest
const UI = (props) => { latest = props; return null }

const mount = async (props = {}) => {
  render(
    <DashboardBusinessList
      UIComponent={UI}
      asDashboard
      paginationSettings={{ initialPage: 1, pageSize: 10, controlType: 'pages' }}
      {...props}
    />
  )
  await act(async () => {})
}

const resolve = async (call, value) => { await act(async () => { call.resolve(value) }) }

beforeEach(() => {
  latest = undefined
  mockState.project = 'demo'
  mockState.backofficeProjects = []
  mockState.session = { token: 'test-token', loading: false, user: { level: 0 } }
  mockState.calls = []
  mockState.countryRequests = 0
  mockState.showToast = () => {}
})
afterEach(() => vi.unstubAllGlobals())

describe('DashboardBusinessList Backoffice opt-in', () => {
  it.each([
    [true, 0, true],
    [false, 0, false],
    [true, 2, false]
  ])('routes configured=%s level=%s through Backoffice=%s', async (configured, level, backoffice) => {
    mockState.project = 'example-backoffice'
    mockState.backofficeProjects = configured ? [mockState.project] : []
    mockState.session.user.level = level
    const fetch = vi.fn(async () => ({ json: async () => answer([]).content }))
    vi.stubGlobal('fetch', fetch)
    await mount()
    expect(latest.isEatstreetProject).toBe(configured)
    if (backoffice) {
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('https://api.test/v400/en/demo/backoffice/businesses?'), expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' })
      }))
      expect(mockState.calls).toHaveLength(0)
    } else {
      expect(fetch.mock.calls.some(([url]) => String(url).includes('/backoffice/businesses?'))).toBe(false)
      expect(listCalls()).toHaveLength(1)
    }
  })
})

describe('DashboardBusinessList · an old answer never overwrites a newer one (G1-07)', () => {
  it('keeps the rows and the total of the last filter change when the previous one answers late', async () => {
    await mount()
    await resolve(listCalls()[0], answer([store(1)], { total: 1 }))

    await act(async () => { latest.handleChangeFilterValues(filters({ featured: true })) })
    await act(async () => { latest.handleChangeFilterValues(filters({ featured: false })) })
    const [, older, newer] = listCalls()
    expect(listCalls()).toHaveLength(3) // one request per change

    await resolve(newer, answer([store(20), store(21)], { total: 5 }))
    await resolve(older, answer([store(10)], { total: 9 }))

    expect(latest.businessList.businesses.map(business => business.id)).toEqual([20, 21])
    expect(latest.businessList.loading).toBe(false)
    expect(latest.pagination.total).toBe(5)
  })

  it('keeps the page asked last when two page changes answer out of order', async () => {
    await mount()
    await resolve(listCalls()[0], answer([store(1)], { total: 30 }))

    await act(async () => { latest.getPageBusinesses(10, 2) })
    await act(async () => { latest.getPageBusinesses(10, 3) })
    const [, page2, page3] = listCalls()

    await resolve(page3, answer([store(31)], { page: 3, total: 30 }))
    await resolve(page2, answer([store(21)], { page: 2, total: 30 }))

    expect(latest.businessList.businesses.map(business => business.id)).toEqual([31])
    expect(latest.pagination.currentPage).toBe(3)
  })

  it('a page change after a filter change wins over the late filter answer', async () => {
    await mount()
    await resolve(listCalls()[0], answer([store(1)], { total: 30 }))

    await act(async () => { latest.handleChangeFilterValues(filters({ featured: true })) })
    await act(async () => { latest.getPageBusinesses(10, 2) })
    const [, filtered, page2] = listCalls()

    await resolve(page2, answer([store(21)], { page: 2, total: 30 }))
    await resolve(filtered, answer([store(5)], { total: 1 }))

    expect(latest.businessList.businesses.map(business => business.id)).toEqual([21])
    expect(latest.pagination.total).toBe(30)
  })
})

// tanda AE (review finding 1): the business selector of /stores/products now loads page after page. A «load more» that
// failed by network emptied the rows, and the empty list made the controller ask again for the current page alone, so the person lost
// every page already loaded and landed on page 2 with no word.
describe('DashboardBusinessList · a failed «load more» keeps what was loaded', () => {
  it('keeps the rows and the pagination, stops loading, and asks for nothing by itself', async () => {
    await mount({ loadMorePageSize: 10 })
    await resolve(listCalls()[0], answer([store(1), store(2)], { pageSize: 2, total: 6 }))
    await act(async () => { latest.loadMoreBusinesses() })
    const [, more] = listCalls()
    await act(async () => { more.reject(new Error('network down')) })
    await act(async () => {})

    expect(latest.businessList.businesses.map(business => business.id)).toEqual([1, 2])
    expect(latest.businessList.loading).toBe(false)
    expect(latest.businessList.error).toEqual(['NETWORK_ERROR'])
    expect(latest.pagination.to).toBe(2)
    expect(listCalls()).toHaveLength(2) // no page asked again behind the person's back
  })

  it('a cancelled «load more» still keeps the rows (as before)', async () => {
    await mount({ loadMorePageSize: 10 })
    await resolve(listCalls()[0], answer([store(1)], { pageSize: 1, total: 3 }))
    await act(async () => { latest.loadMoreBusinesses() })
    const [, more] = listCalls()
    class Cancel {} // what the SDK throws when a request is cancelled (businessLoadAnalytics `isCancellation`)
    await act(async () => { more.reject(new Cancel()) })
    expect(latest.businessList.businesses.map(business => business.id)).toEqual([1])
  })
})

describe('DashboardBusinessList · bulk Enable / Disable (G1-24)', () => {
  const put = vi.fn()
  beforeEach(() => {
    put.mockReset()
    put.mockResolvedValue({ json: async () => ({ error: false, result: [] }) })
    vi.stubGlobal('fetch', put)
  })

  const mountWith = async (rows, { total = rows.length, ...props } = {}) => {
    await mount(props)
    await resolve(listCalls()[0], answer(rows, { total }))
  }

  it('«Enable» on active stores changes nothing in the Active tab: the rows stay and the total too', async () => {
    await mountWith([store(1), store(2), store(3)])
    await act(async () => { latest.setBusinessIds([1, 2]) })
    await act(async () => { await latest.handleEnableAllBusiness(true) })

    expect(put).toHaveBeenCalledTimes(1)
    expect(JSON.parse(put.mock.calls[0][1].body)).toEqual({ businesses_id: [1, 2], enabled: true })
    expect(latest.businessList.businesses.map(business => business.id)).toEqual([1, 2, 3])
    expect(latest.pagination.total).toBe(3)
  })

  it('«Disable» takes out of the Active tab only the rows that were active, and the total goes down by them', async () => {
    await mountWith([store(1), store(2), store(3), store(4)], { total: 14 })
    await act(async () => { latest.setBusinessIds([1, 3]) })
    await act(async () => { await latest.handleEnableAllBusiness(false) })

    expect(latest.businessList.businesses.map(business => business.id)).toEqual([2, 4])
    expect(latest.pagination.total).toBe(12)
    expect(latest.pagination.to).toBe(2)
    expect(latest.businessIds).toEqual([])
  })

  it('in the Inactive tab «Enable» takes out the rows and «Disable» leaves them', async () => {
    await mountWith([store(7, { enabled: false }), store(8, { enabled: false })], { defaultActive: false, paginationSettings: { initialPage: 1, pageSize: 25, controlType: 'pages' } })
    await act(async () => { latest.setBusinessIds([7]) })
    await act(async () => { await latest.handleEnableAllBusiness(false) })
    expect(latest.businessList.businesses.map(business => business.id)).toEqual([7, 8])
    expect(latest.pagination.total).toBe(2)

    await act(async () => { latest.setBusinessIds([7]) })
    await act(async () => { await latest.handleEnableAllBusiness(true) })
    expect(latest.businessList.businesses.map(business => business.id)).toEqual([8])
    expect(latest.pagination.total).toBe(1)
  })

  it('a selection with stores of another page asks for the current page again', async () => {
    await mountWith([store(1), store(2)], { total: 12 })
    await act(async () => { latest.setBusinessIds([2, 99]) })
    const before = listCalls().length
    await act(async () => { await latest.handleEnableAllBusiness(false) })

    expect(listCalls()).toHaveLength(before + 1)
    expect(listCalls().at(-1).options.query).toEqual({ page: 1, page_size: 10 })
  })

  it('without the active-state condition (noActiveStatusCondition) the rows change in place and stay', async () => {
    await mountWith([store(1), store(2)], { noActiveStatusCondition: true })
    await act(async () => { latest.setBusinessIds([1]) })
    await act(async () => { await latest.handleEnableAllBusiness(false) })

    expect(latest.businessList.businesses.map(business => [business.id, business.enabled])).toEqual([[1, false], [2, true]])
    expect(latest.pagination.total).toBe(2)
  })

  it('Feature / Unfeature still change the rows in place and keep the selection (as in main)', async () => {
    await mountWith([store(1), store(2)])
    await act(async () => { latest.setBusinessIds([2]) })
    await act(async () => { await latest.handleEnableAllBusiness(true, true) })

    expect(latest.businessList.businesses.map(business => [business.id, business.featured])).toEqual([[1, false], [2, true]])
    expect(latest.businessIds).toEqual([2])
  })

  it('a failed bulk change leaves rows, total and selection as they were', async () => {
    put.mockResolvedValue({ json: async () => ({ error: true, result: ['Nope'] }) })
    await mountWith([store(1), store(2)])
    await act(async () => { latest.setBusinessIds([1]) })
    await act(async () => { await latest.handleEnableAllBusiness(false) })

    expect(latest.businessList.businesses.map(business => business.id)).toEqual([1, 2])
    expect(latest.pagination.total).toBe(2)
    expect(latest.businessIds).toEqual([1])
  })
})

describe('DashboardBusinessList · the editor reports a store (handleSucessUpdateBusiness)', () => {
  it('a store that is not on the list and not of this tab leaves the rows and the total as they are', async () => {
    await mount({ defaultActive: false, paginationSettings: { initialPage: 1, pageSize: 25, controlType: 'pages' } })
    await resolve(listCalls()[0], answer([store(7, { enabled: false }), store(8, { enabled: false })], { total: 49, pageSize: 25 }))
    await act(async () => { latest.handleSucessUpdateBusiness(store(4, { enabled: true })) })

    expect(latest.businessList.businesses.map(business => business.id)).toEqual([7, 8])
    expect(latest.pagination.total).toBe(49)
  })

  // redesign bugs F row 16: ⌘K or ?id= opens an off-page store; the editor reports it and it must not join the list
  it('a store that is not on the page but belongs to this tab is not added and the total does not move', async () => {
    await mount({ paginationSettings: { initialPage: 1, pageSize: 25, controlType: 'pages' } })
    await resolve(listCalls()[0], answer([store(7), store(8)], { total: 49, pageSize: 25 }))
    await act(async () => { latest.handleSucessUpdateBusiness(store(4, { enabled: true })) })

    expect(latest.businessList.businesses.map(business => business.id)).toEqual([7, 8])
    expect(latest.pagination.total).toBe(49)
  })

  // review R-1 of bugs F: the editor reports the store it opens, and again after each save; a store opened off the page whose state
  // the editor then changes INTO this tab joins it and the total goes up, as in main
  it('a store opened off the page that the editor switches into this tab joins it, and the total goes up (as in main)', async () => {
    await mount({ paginationSettings: { initialPage: 1, pageSize: 25, controlType: 'pages' } })
    await resolve(listCalls()[0], answer([store(7), store(8)], { total: 49, pageSize: 25 }))
    await act(async () => { latest.handleSucessUpdateBusiness(store(4, { enabled: false })) }) // opened (Inactive, Active tab): nothing
    expect(latest.pagination.total).toBe(49)
    await act(async () => { latest.handleSucessUpdateBusiness(store(4, { enabled: true })) }) // switched on in the editor
    expect(latest.businessList.businesses.map(business => business.id)).toEqual([7, 8, 4])
    expect(latest.pagination.total).toBe(50)
  })

  it('a store of the list that changes tab still leaves it, and the total goes down (as in main)', async () => {
    await mount()
    await resolve(listCalls()[0], answer([store(1), store(2)], { total: 12 }))
    await act(async () => { latest.handleSucessUpdateBusiness(store(1, { enabled: false })) })

    expect(latest.businessList.businesses.map(business => business.id)).toEqual([2])
    expect(latest.pagination.total).toBe(11)
  })
})

// redesign stores 3.A: `defaultBusinessType` is opt-in; /stores/list reads `?type=` and starts filtered (one request, not two)
describe('DashboardBusinessList · defaultBusinessType (3.A)', () => {
  const typesCondition = (id) => ({ attribute: 'types', conditions: [{ attribute: 'id', value: id }] })
  const hasTypes = (call) => !!call.where?.conditions?.some(condition => condition.attribute === 'types')

  it('without the prop the first load has no types condition and mounting makes the same requests as before', async () => {
    await mount({ fetchInactiveProbe: true })

    expect(listCalls()).toHaveLength(1)
    expect(mockState.calls).toHaveLength(2) // the list plus the inactive probe (opt-in since bugs F row 17)
    expect(mockState.calls.some(hasTypes)).toBe(false)
    expect(latest.businessTypeSelected).toBeNull()
  })

  it('with defaultBusinessType the first list request already carries the types condition and no request goes without it', async () => {
    await mount({ defaultBusinessType: 3 })

    expect(listCalls()).toHaveLength(1)
    expect(listCalls()[0].where.conditions).toContainEqual(typesCondition(3))
    expect(mockState.calls[0].where.conditions).toContainEqual(typesCondition(3))
    expect(mockState.calls.filter(call => !hasTypes(call) && !isInactiveProbe(call))).toHaveLength(0)
    expect(latest.businessTypeSelected).toBe(3)
  })
})

// redesign bugs F row 17, SL-09: the inactive probe and GET /countries are opt-in (only /stores/list reads them); the
// probe runs once per session token and again only when the list settles empty (the «no stores» dialog needs a fresh answer)
describe('DashboardBusinessList · opt-in inactive probe and countries (bugs F row 17)', () => {
  const probes = () => mockState.calls.filter(isInactiveProbe)

  it('a default consumer makes only the list request: no inactive probe, no countries', async () => {
    await mount()
    await resolve(listCalls()[0], answer([store(1)], { total: 1 }))

    expect(mockState.calls).toHaveLength(1)
    expect(probes()).toHaveLength(0)
    expect(mockState.countryRequests).toBe(0)
  })

  it('with fetchInactiveProbe the probe runs once, not again when the first load lands', async () => {
    await mount({ fetchInactiveProbe: true })
    expect(probes()).toHaveLength(1) // on mount
    await resolve(listCalls()[0], answer([store(1), store(2)], { total: 2 }))

    expect(probes()).toHaveLength(1) // today: 2
    expect(listCalls()).toHaveLength(1)
  })

  it('the probe runs again when the list settles empty, so the dialog sees a fresh answer', async () => {
    await mount({ fetchInactiveProbe: true })
    expect(probes()).toHaveLength(1)
    await resolve(listCalls()[0], answer([], { total: 0 }))

    expect(probes()).toHaveLength(2)
    await resolve(probes()[1], answer([store(5, { enabled: false })], { total: 1 }))
    expect(latest.inActiveBusinesses.businesses.map(business => business.id)).toEqual([5])
  })

  it('with fetchCountries the countries are requested once; without it they are not', async () => {
    await mount({ fetchCountries: true })
    expect(mockState.countryRequests).toBe(1)
    expect(latest.countriesState.loading).toBe(false)
  })
})

// redesign bugs F row 18, SL-03: a bulk delete lowers the total, like a bulk change of state does
describe('DashboardBusinessList · bulk delete (bugs F row 18)', () => {
  const del = vi.fn()
  beforeEach(() => {
    del.mockReset()
    del.mockResolvedValue({ json: async () => ({ error: false, result: [] }) })
    vi.stubGlobal('fetch', del)
  })

  const mountWith = async (rows, { total = rows.length, ...props } = {}) => {
    await mount(props)
    await resolve(listCalls()[0], answer(rows, { total }))
  }

  it('takes the deleted rows out and lowers the total and the end of the page by them', async () => {
    await mountWith([store(1), store(2), store(3), store(4)], { total: 14 })
    await act(async () => { latest.setBusinessIds([1, 3]) })
    await act(async () => { await latest.handleDeleteMultiBusinesses() })

    expect(del).toHaveBeenCalledTimes(1)
    expect(del.mock.calls[0][1].method).toBe('DELETE')
    expect(JSON.parse(del.mock.calls[0][1].body)).toEqual({ businesses_id: [1, 3] })
    expect(latest.businessList.businesses.map(business => business.id)).toEqual([2, 4])
    expect(latest.pagination.total).toBe(12)
    expect(latest.pagination.to).toBe(2)
    expect(latest.businessIds).toEqual([])
  })

  // the ConfirmAdmin confirmation_token (StoresBulkBar's delete) travels on the DELETE.
  it('with a confirmation_token, the DELETE carries it', async () => {
    await mountWith([store(1), store(2)], { total: 2 })
    await act(async () => { latest.setBusinessIds([1]) })
    await act(async () => { await latest.handleDeleteMultiBusinesses('tok-biz-1') })

    expect(JSON.parse(del.mock.calls[0][1].body)).toEqual({ businesses_id: [1], confirmation_token: 'tok-biz-1' })
  })

  it('a selection with stores of another page asks for the current page again', async () => {
    await mountWith([store(1), store(2)], { total: 12 })
    await act(async () => { latest.setBusinessIds([2, 99]) })
    const before = listCalls().length
    await act(async () => { await latest.handleDeleteMultiBusinesses() })

    expect(listCalls()).toHaveLength(before + 1)
    expect(listCalls().at(-1).options.query).toEqual({ page: 1, page_size: 10 })
    expect(latest.businessIds).toEqual([])
  })

  it('a failed delete leaves rows, total and selection as they were', async () => {
    del.mockResolvedValue({ json: async () => ({ error: true, result: ['Nope'] }) })
    await mountWith([store(1), store(2)], { total: 5 })
    await act(async () => { latest.setBusinessIds([1]) })
    await act(async () => { await latest.handleDeleteMultiBusinesses() })

    expect(latest.businessList.businesses.map(business => business.id)).toEqual([1, 2])
    expect(latest.pagination.total).toBe(5)
    expect(latest.businessIds).toEqual([1])
  })
})

// redesign bugs F row 22, F3: `?q=` made two list requests (the seed was applied after the first load)
describe('DashboardBusinessList · defaultSearchValue (bugs F row 22)', () => {
  it('starts searching: exactly one list request, and it carries the search conditions', async () => {
    await mount({ defaultSearchValue: 'bob', isSearchByBusinessName: true, isSearchByBusinessEmail: true, isSearchByBusinessPhone: true })

    expect(listCalls()).toHaveLength(1)
    const search = listCalls()[0].where.conditions.find(condition => condition.conector === 'OR')
    expect(search.conditions.map(condition => condition.attribute)).toEqual(['name', 'email', 'phone'])
    expect(search.conditions[0].value.value).toBe(encodeURI('%bob%'))
    expect(latest.searchValue).toBe('bob')
  })

  it('the in-page onSearch with the same value does not ask again', async () => {
    await mount({ defaultSearchValue: 'bob', isSearchByBusinessName: true })
    await resolve(listCalls()[0], answer([store(1)], { total: 1 }))
    await act(async () => { latest.onSearch('bob') })

    expect(listCalls()).toHaveLength(1)
  })

  it('without the prop the search starts empty, as before', async () => {
    await mount()
    expect(latest.searchValue).toBeNull()
  })
})
