/* eslint-disable import/first */
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// redesign BO-B1 (BO-1, BO-3): additive page-selection, saved ids, names and error state of the assigned-businesses controller
const mocks = vi.hoisted(() => ({
  chain: null,
  showToast: vi.fn(),
  session: { token: 'token', user: { id: 1, level: 0 } },
  ordering: { root: 'https://api.test' }
}))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [mocks.session] }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [mocks.ordering] }))
vi.mock('../../../contexts/ToastContext', () => ({
  ToastType: { Info: 'INFO', Error: 'ERROR', Success: 'SUCCESS' },
  useToast: () => [null, { showToast: mocks.showToast }]
}))
vi.mock('../../../contexts/LanguageContext', () => ({ useLanguage: () => [null, (_key, fallback) => fallback] }))

import { BusinessManagerBusinesses } from '..'

const business = (id) => ({ id, name: `Store ${id}` })
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, index) => from + index)
const ALL_IDS = range(1, 31)

// A chainable fake of the SDK builder: every step returns the chain, `get` is the read spy. `save` plays the API of
// one store added or removed (POST/DELETE users/{id}/businesses/{business_id}, sent with `fetch`) and answers its SDK-like content.
const makeChain = ({ assigned = ALL_IDS.map(business) } = {}) => {
  const chain = {}
  chain.setAccessToken = vi.fn(() => chain)
  chain.users = vi.fn(() => chain)
  chain.select = vi.fn(() => chain)
  chain.get = vi.fn(async () => ({ content: { error: false, result: { businesses: assigned } } }))
  chain.save = vi.fn(async () => ({ content: { error: false, result: {} } }))
  return chain
}

// The backoffice catalog is read with `fetch`; `pages` maps a page number to the businesses it returns.
const mockCatalog = (pages) => {
  global.fetch = vi.fn(async (url, options = {}) => {
    const assignment = new URL(url).pathname.match(/^\/users\/\d+\/businesses\/(\d+)$/)
    if (assignment) {
      const { content } = await mocks.chain.save({ method: options.method, id: Number(assignment[1]) })
      return { json: async () => content }
    }
    const page = Number(new URL(url).searchParams.get('page'))
    return {
      json: async () => ({
        error: false,
        result: pages[page] || [],
        pagination: { current_page: page, total_pages: Object.keys(pages).length, total: 31 }
      })
    }
  })
}

const catalogUrls = () => global.fetch.mock.calls.map(([url]) => url).filter(url => !/\/businesses\/\d+$/.test(new URL(url).pathname))
// the stores added or removed by a save, in order
const assignments = () => mocks.chain.save.mock.calls.map(([{ method, id }]) => [method, id])

const renderController = async (props = {}) => {
  const ui = { current: null }
  const UIComponent = (uiProps) => {
    ui.current = uiProps
    return null
  }
  render(<BusinessManagerBusinesses UIComponent={UIComponent} userId={5} {...props} />)
  return ui
}

const waitForReady = (ui, { selected = 31, page = 10 } = {}) => waitFor(() => {
  expect(ui.current.selectedBusinessIds).toHaveLength(selected)
  expect(ui.current.businessesState.businesses).toHaveLength(page)
})

describe('BusinessManagerBusinesses · owner with 31 stores and a catalog paginated by 10 (BO-B1 / BO-1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.chain = makeChain()
    mocks.ordering = Object.assign(mocks.chain, { root: 'https://api.test' })
    mockCatalog({ 1: range(1, 10).map(business), 2: range(11, 20).map(business) })
  })
  afterEach(() => { delete global.fetch })

  it('handleSelectPageBusinesses adds the visible page and saving keeps all 31 stores', async () => {
    const ui = await renderController()
    await waitForReady(ui)

    act(() => { ui.current.handleSelectPageBusinesses() })
    await waitFor(() => expect(ui.current.selectedBusinessIds).toEqual(ALL_IDS))

    let outcome
    await act(async () => { outcome = await ui.current.handleUpdateBusinesses() })

    // the visible page was already assigned: nothing to add or remove, and all 31 stay
    expect(outcome).toEqual({ ok: true })
    expect(assignments()).toEqual([])
    expect(ui.current.savedBusinessIds).toEqual(ALL_IDS)
  })

  it('handleSelectPageBusinesses unites without duplicates and keeps the already selected ones first', async () => {
    mocks.chain = makeChain({ assigned: [business(7), business(25)] })
    mocks.ordering = Object.assign(mocks.chain, { root: 'https://api.test' })
    const ui = await renderController()
    await waitForReady(ui, { selected: 2 })

    act(() => { ui.current.handleSelectPageBusinesses() })
    await waitFor(() => expect(ui.current.selectedBusinessIds).toEqual([7, 25, 1, 2, 3, 4, 5, 6, 8, 9, 10]))

    act(() => { ui.current.handleSelectPageBusinesses() })
    expect(ui.current.selectedBusinessIds).toEqual([7, 25, 1, 2, 3, 4, 5, 6, 8, 9, 10])
  })

  it('handleSetSelectedBusinessIds sets the selection (Discard)', async () => {
    const ui = await renderController()
    await waitForReady(ui)

    act(() => { ui.current.handleSetSelectedBusinessIds([3, 4]) })
    await waitFor(() => expect(ui.current.selectedBusinessIds).toEqual([3, 4]))
  })

  it('handleSelectAllBusiness(true) still selects only the visible page: the callcenter contract', async () => {
    const ui = await renderController()
    await waitForReady(ui)

    act(() => { ui.current.handleSelectAllBusiness(true) })
    await waitFor(() => expect(ui.current.selectedBusinessIds).toEqual(range(1, 10)))

    await act(async () => { await ui.current.handleUpdateBusinesses() })
    expect(assignments()).toEqual(range(11, 31).map(id => ['DELETE', id]))

    act(() => { ui.current.handleSelectAllBusiness(false) })
    await waitFor(() => expect(ui.current.selectedBusinessIds).toEqual([]))
  })
})

describe('BusinessManagerBusinesses · typeBusinessPropToFetch (BO-B1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCatalog({ 1: range(1, 10).map(business) })
  })
  afterEach(() => { delete global.fetch })

  it('businesses_agent asks select(["businesses_agent"]), reads result.businesses_agent and exposes assignedBusinesses', async () => {
    const chain = makeChain()
    chain.get = vi.fn(async () => ({ content: { error: false, result: { businesses_agent: [business(4), business(9)] } } }))
    mocks.ordering = Object.assign(chain, { root: 'https://api.test' })

    const ui = await renderController({ typeBusinessPropToFetch: 'businesses_agent' })
    await waitFor(() => expect(ui.current.selectedBusinessIds).toEqual([4, 9]))

    expect(chain.select).toHaveBeenCalledWith(['businesses_agent'])
    expect(ui.current.assignedBusinesses).toEqual([business(4), business(9)])
    expect(ui.current.savedBusinessIds).toEqual([4, 9])
  })

  it('assignedBusinesses is [] while there is no response', async () => {
    const chain = makeChain()
    chain.get = vi.fn(() => new Promise(() => {}))
    mocks.ordering = Object.assign(chain, { root: 'https://api.test' })

    const ui = await renderController()
    await waitFor(() => expect(ui.current.businessesState.businesses).toHaveLength(10))

    expect(ui.current.assignedBusinesses).toEqual([])
    expect(ui.current.savedBusinessIds).toEqual([])
  })
})

describe('BusinessManagerBusinesses · businessNames (BO-B1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.chain = makeChain({ assigned: [business(25), business(31)] })
    mocks.ordering = Object.assign(mocks.chain, { root: 'https://api.test' })
    mockCatalog({ 1: range(1, 10).map(business), 2: range(11, 20).map(business) })
  })
  afterEach(() => { delete global.fetch })

  it('accumulates the assigned names and the names of every catalog page, and never drops them', async () => {
    const ui = await renderController()
    await waitFor(() => {
      expect(ui.current.businessesState.businesses).toHaveLength(10)
      expect(ui.current.businessNames[25]).toBe('Store 25')
    })
    expect(ui.current.businessNames[1]).toBe('Store 1')
    expect(ui.current.businessNames[31]).toBe('Store 31')

    await act(async () => { ui.current.handleChangeBusinessPage(2) })
    await waitFor(() => expect(ui.current.businessNames[11]).toBe('Store 11'))

    // Page 1, page 2 and the assigned ones are all still known after changing page
    expect(ui.current.businessesState.businesses.map(item => item.id)).toEqual(range(11, 20))
    expect(Object.keys(ui.current.businessNames).map(Number).sort((a, b) => a - b)).toEqual([...range(1, 20), 25, 31])

    // ...and after a search that returns nothing
    mockCatalog({})
    await act(async () => { ui.current.searchBusinesses('zzz') })
    await waitFor(() => expect(ui.current.businessesState.businesses).toEqual([]))
    expect(ui.current.businessNames[1]).toBe('Store 1')
    expect(ui.current.businessNames[25]).toBe('Store 25')
  })
})

describe('BusinessManagerBusinesses · handleUpdateBusinesses outcome (BO-B1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.chain = makeChain({ assigned: [business(1), business(2)] })
    mocks.ordering = Object.assign(mocks.chain, { root: 'https://api.test' })
    mockCatalog({ 1: range(1, 10).map(business) })
  })
  afterEach(() => { delete global.fetch })

  it('resolves { ok: true } and moves savedBusinessIds to what was saved', async () => {
    const ui = await renderController()
    await waitForReady(ui, { selected: 2 })
    expect(ui.current.savedBusinessIds).toEqual([1, 2])

    act(() => { ui.current.handleSelectBusiness(3, true) })
    await waitFor(() => expect(ui.current.selectedBusinessIds).toEqual([1, 2, 3]))

    let outcome
    await act(async () => { outcome = await ui.current.handleUpdateBusinesses() })

    expect(outcome).toEqual({ ok: true })
    expect(assignments()).toEqual([['POST', 3]])
    expect(ui.current.savedBusinessIds).toEqual([1, 2, 3])
    expect(ui.current.actionState).toEqual({ loading: false, error: null })
  })

  it('resolves { ok: false, error } on an API error and leaves savedBusinessIds alone', async () => {
    mocks.chain.save.mockResolvedValue({ content: { error: true, result: ['Nope'] } })
    const ui = await renderController()
    await waitForReady(ui, { selected: 2 })

    act(() => { ui.current.handleSelectBusiness(3, true) })
    await waitFor(() => expect(ui.current.selectedBusinessIds).toEqual([1, 2, 3]))

    let outcome
    await act(async () => { outcome = await ui.current.handleUpdateBusinesses() })

    expect(outcome).toEqual({ ok: false, error: ['Nope'] })
    expect(ui.current.savedBusinessIds).toEqual([1, 2])
    expect(ui.current.actionState).toEqual({ loading: false, error: ['Nope'] })
  })

  it('resolves { ok: false, error: [message] } when the request throws', async () => {
    mocks.chain.save.mockRejectedValue(new Error('network down'))
    const ui = await renderController()
    await waitForReady(ui, { selected: 2 })

    act(() => { ui.current.handleSelectBusiness(3, true) })
    await waitFor(() => expect(ui.current.selectedBusinessIds).toEqual([1, 2, 3]))

    let outcome
    await act(async () => { outcome = await ui.current.handleUpdateBusinesses() })

    expect(outcome).toEqual({ ok: false, error: ['network down'] })
    expect(ui.current.savedBusinessIds).toEqual([1, 2])
  })
})

describe('BusinessManagerBusinesses · assigned stores read (BO-B1 / BO-9)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.chain = makeChain({ assigned: [business(1), business(2)] })
    mocks.ordering = Object.assign(mocks.chain, { root: 'https://api.test' })
    mockCatalog({ 1: range(1, 10).map(business) })
  })
  afterEach(() => { delete global.fetch })

  it('assignedState is { loading: true, loaded: false } while asking, then { loading: false, error: null, loaded: true }', async () => {
    let release
    mocks.chain.get = vi.fn(() => new Promise(resolve => { release = resolve }))
    const ui = await renderController()
    await waitFor(() => expect(ui.current.assignedState).toEqual({ loading: true, error: null, loaded: false }))

    await act(async () => { release({ content: { error: false, result: { businesses: [business(1), business(2)] } } }) })
    await waitFor(() => expect(ui.current.assignedState).toEqual({ loading: false, error: null, loaded: true }))
  })

  it('an error response leaves assignedState { loaded: false, error } and Save sends nothing (NOT_LOADED)', async () => {
    mocks.chain.get.mockResolvedValue({ content: { error: true, result: ['Boom'] } })
    const ui = await renderController()
    await waitFor(() => expect(ui.current.assignedState).toEqual({ loading: false, error: ['Boom'], loaded: false }))
    expect(ui.current.selectedBusinessIds).toEqual([])

    act(() => { ui.current.handleSelectBusiness(3, true) })
    await waitFor(() => expect(ui.current.selectedBusinessIds).toEqual([3]))

    let outcome
    await act(async () => { outcome = await ui.current.handleUpdateBusinesses() })

    expect(outcome).toEqual({ ok: false, error: ['NOT_LOADED'] })
    expect(mocks.chain.save).not.toHaveBeenCalled()
    expect(ui.current.savedBusinessIds).toEqual([])
  })

  it('a thrown read leaves assignedState { loaded: false, error: [message] } and Save sends nothing', async () => {
    mocks.chain.get.mockRejectedValue(new Error('network down'))
    const ui = await renderController()
    await waitFor(() => expect(ui.current.assignedState).toEqual({ loading: false, error: ['network down'], loaded: false }))

    let outcome
    await act(async () => { outcome = await ui.current.handleUpdateBusinesses() })

    expect(outcome).toEqual({ ok: false, error: ['NOT_LOADED'] })
    expect(mocks.chain.save).not.toHaveBeenCalled()
  })

  it('reloadAssigned asks again; once it works the selection is loaded and Save sends it', async () => {
    mocks.chain.get.mockResolvedValueOnce({ content: { error: true, result: ['Boom'] } })
    const ui = await renderController()
    await waitFor(() => expect(ui.current.assignedState.error).toEqual(['Boom']))

    await act(async () => { ui.current.reloadAssigned() })
    await waitFor(() => expect(ui.current.assignedState).toEqual({ loading: false, error: null, loaded: true }))
    expect(mocks.chain.get).toHaveBeenCalledTimes(2)
    expect(ui.current.selectedBusinessIds).toEqual([1, 2])
    expect(ui.current.assignedBusinesses).toEqual([business(1), business(2)])

    let outcome
    await act(async () => { outcome = await ui.current.handleUpdateBusinesses() })
    expect(outcome).toEqual({ ok: true })
    expect(ui.current.savedBusinessIds).toEqual([1, 2])
  })

  it('does not change actionState on a failed read: it still carries the API result, as before', async () => {
    mocks.chain.get.mockResolvedValue({ content: { error: true, result: ['Boom'] } })
    const ui = await renderController()
    await waitFor(() => expect(ui.current.assignedState.error).toEqual(['Boom']))
    expect(ui.current.actionState).toEqual({ loading: false, error: ['Boom'] })
  })

  it('with businesses_agent the save still adds the store to the businesses of the user', async () => {
    mocks.chain.get.mockResolvedValue({ content: { error: false, result: { businesses_agent: [business(4)] } } })
    const ui = await renderController({ typeBusinessPropToFetch: 'businesses_agent' })
    await waitFor(() => expect(ui.current.selectedBusinessIds).toEqual([4]))

    act(() => { ui.current.handleSelectBusiness(6, true) })
    await waitFor(() => expect(ui.current.selectedBusinessIds).toEqual([4, 6]))
    await act(async () => { await ui.current.handleUpdateBusinesses() })

    expect(assignments()).toEqual([['POST', 6]])
    expect(global.fetch.mock.calls.some(([url]) => url.endsWith('/users/5/businesses/6'))).toBe(true)
  })
})

describe('BusinessManagerBusinesses · catalog failure (BO-B1 / BO-3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.chain = makeChain({ assigned: [business(1)] })
    mocks.ordering = Object.assign(mocks.chain, { root: 'https://api.test' })
  })
  afterEach(() => { delete global.fetch })

  it('puts the API message in businessesState.error, keeps the list empty, and reloadBusinesses repeats the same page and search', async () => {
    mockCatalog({ 1: range(1, 10).map(business), 2: range(11, 20).map(business) })
    const ui = await renderController()
    await waitFor(() => expect(ui.current.businessesState.businesses).toHaveLength(10))

    await act(async () => { ui.current.searchBusinesses('pizza') })
    await waitFor(() => expect(catalogUrls()).toHaveLength(2))
    await act(async () => { ui.current.handleChangeBusinessPage(2) })
    await waitFor(() => expect(catalogUrls()).toHaveLength(3))

    global.fetch = vi.fn(async () => ({ json: async () => ({ error: true, result: ['Catalog down'] }) }))
    await act(async () => { ui.current.handleChangeBusinessPage(2) })
    await waitFor(() => expect(ui.current.businessesState.error).toEqual(['Catalog down']))
    expect(ui.current.businessesState.businesses).toEqual([])
    expect(ui.current.businessesState.loading).toBe(false)
    expect(ui.current.businessesPaginationProps.currentPage).toBe(1)
    const failedUrl = catalogUrls()[0]

    await act(async () => { ui.current.reloadBusinesses() })
    expect(catalogUrls()).toHaveLength(2)
    expect(catalogUrls()[1]).toBe(failedUrl)
    expect(failedUrl).toContain('page=2')
    expect(decodeURIComponent(failedUrl)).toContain('%pizza%')
  })

  it('a thrown fetch puts [err.message] in businessesState.error and a retry that works clears it', async () => {
    global.fetch = vi.fn(async () => { throw new Error('offline') })
    const ui = await renderController()
    await waitFor(() => expect(ui.current.businessesState.error).toEqual(['offline']))
    expect(ui.current.businessesState.businesses).toEqual([])

    mockCatalog({ 1: range(1, 10).map(business) })
    await act(async () => { ui.current.reloadBusinesses() })
    await waitFor(() => expect(ui.current.businessesState.businesses).toHaveLength(10))
    expect(ui.current.businessesState.error).toBeNull()
  })
})
