/* eslint-disable import/first */
import React from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// redesign PE-B3 (PE-13, PE-14): the two controller fixes of the advanced editor.
//  - a record opened by `?id=` (promotion={}, promotionId=5) initialises the selected ids from what the GET brings;
//  - handleDeletePromotion deletes the id it can find (never /offers/undefined), RESOLVES its outcome and does not leave
//    `actionState.loading` stuck on an API error or a throw.
// The UI is a stub that records the props the controller gives it. Nothing is ever sent: `fetch` is a mock.
const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  hideToast: vi.fn(),
  fetch: vi.fn(),
  session: { token: 'token', user: { id: 1, level: 0 } }
}))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [mocks.session] }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [{ root: 'https://api.test' }] }))
vi.mock('../../../contexts/ToastContext', () => ({
  ToastType: { Info: 'INFO', Error: 'ERROR', Success: 'SUCCESS' },
  useToast: () => [null, { showToast: mocks.showToast, hideToast: mocks.hideToast }]
}))
vi.mock('../../../contexts/LanguageContext', () => ({ useLanguage: () => [null, (_key, fallback) => fallback] }))

import { EnterprisePromotionDetails } from '..'

const RECORD = {
  id: 5,
  name: 'Weekend 15%',
  businesses: [{ id: 11 }, { id: 12 }],
  sites: [{ id: 3 }],
  users: [{ id: 9 }],
  loyalty_levels: [{ id: 4 }]
}

const reply = (body) => Promise.resolve({ json: () => Promise.resolve(body) })

const renderDetails = (props = {}) => {
  const ui = { current: null }
  const UIComponent = (uiProps) => {
    ui.current = uiProps
    return null
  }
  const handlers = { onClose: vi.fn(), handleSuccessDeletePromotion: vi.fn() }
  render(<EnterprisePromotionDetails UIComponent={UIComponent} promotion={{}} promotionId={5} {...handlers} {...props} />)
  return { ui, ...handlers }
}

const settle = () => act(async () => { await Promise.resolve() })

describe('EnterprisePromotionDetails controller · opened by ?id= (PE-13)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetch.mockImplementation((url, options) => {
      if (options.method === 'GET') return reply({ error: false, result: [RECORD] })
      return reply({ error: false, result: {} })
    })
    global.fetch = mocks.fetch
  })
  afterEach(() => cleanup())

  it('takes the selected ids from the record the GET brings, not only from a record passed by prop', async () => {
    const { ui } = renderDetails()
    await settle()
    expect(mocks.fetch).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/api\.test\/offers\?page=1&page_size=1&params=(?=.*\bsites\b)(?=.*\busers\b)(?=.*\bloyalty_levels\b)(?=.*\bbusinesses\b).*&where=.*"attribute":"id","value":5\b/), expect.objectContaining({ method: 'GET' })) // redesign review r1 (R1): the relations the sections edit
    expect(ui.current.promotionState.promotion).toEqual(RECORD)
    expect(ui.current.selectedBusinessIds).toEqual([11, 12])
    expect(ui.current.selectedSitesIds).toEqual([3])
    expect(ui.current.selectedUserIds).toEqual([9])
    expect(ui.current.selectedLoyaltyLevelIds).toEqual([4])
  })

  // redesign review r1 (R1, directed check): unticking one site of a record opened by ?id= sent `sites: []` (the handlers started from
  // the empty prop, not from the loaded record): the change must start from what the record has
  it('a change to sites, users or loyalty levels starts from the loaded record, not from the empty prop', async () => {
    const { ui } = renderDetails()
    mocks.fetch.mockImplementation((url, options) => {
      if (options.method === 'GET') return reply({ error: false, result: [{ ...RECORD, sites: [{ id: 3 }, { id: 7 }], users: [{ id: 9 }, { id: 10 }], loyalty_levels: [{ id: 4 }, { id: 6 }] }] })
      return reply({ error: false, result: {} })
    })
    await settle()
    ui.current.getPromotion()
    await settle()
    act(() => { ui.current.handleSelectSite(false, 3) })
    expect(ui.current.formState.changes.sites).toEqual([7])
    act(() => { ui.current.handleSelectUser(false, 9) })
    expect(ui.current.formState.changes.users).toEqual([10])
    act(() => { ui.current.handleSelectLoyaltyLevel(false, 4) })
    expect(ui.current.formState.changes.loyalty_levels).toEqual([6])
  })

  it('gives the UI getPromotion, so a failed load can be asked again', async () => {
    const { ui } = renderDetails()
    await settle()
    expect(typeof ui.current.getPromotion).toBe('function')
    mocks.fetch.mockClear()
    await act(async () => { await ui.current.getPromotion() })
    expect(mocks.fetch).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/api\.test\/offers\?page=1&page_size=1&params=(?=.*\bsites\b)(?=.*\busers\b)(?=.*\bloyalty_levels\b)(?=.*\bbusinesses\b).*&where=.*"attribute":"id","value":5\b/), expect.objectContaining({ method: 'GET' })) // redesign review r1 (R1): the relations the sections edit
  })
})

describe('EnterprisePromotionDetails controller · delete (PE-14)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetch.mockImplementation((url, options) => {
      if (options.method === 'GET') return reply({ error: false, result: [RECORD] })
      return reply({ error: false, result: {} })
    })
    global.fetch = mocks.fetch
  })
  afterEach(() => cleanup())

  it('from a deep link it deletes /offers/5 (never /offers/undefined), tells the list and closes', async () => {
    const { ui, onClose, handleSuccessDeletePromotion } = renderDetails()
    await settle()

    let outcome
    await act(async () => { outcome = await ui.current.handleDeletePromotion() })

    expect(outcome).toEqual({ ok: true })
    expect(mocks.fetch).toHaveBeenCalledWith('https://api.test/offers/5', expect.objectContaining({ method: 'DELETE' }))
    expect(mocks.fetch.mock.calls.some(([url]) => String(url).includes('undefined'))).toBe(false)
    expect(handleSuccessDeletePromotion).toHaveBeenCalledWith(5)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(mocks.showToast).toHaveBeenCalledWith('INFO', 'Loading')
    expect(mocks.showToast).toHaveBeenCalledWith('SUCCESS', 'Offer deleted')
  })

  it('with the record passed by prop it still deletes that record', async () => {
    const { ui, handleSuccessDeletePromotion } = renderDetails({ promotion: { id: 8, name: 'Row' }, promotionId: 8 })
    await settle()
    await act(async () => { await ui.current.handleDeletePromotion() })
    expect(mocks.fetch).toHaveBeenCalledWith('https://api.test/offers/8', expect.objectContaining({ method: 'DELETE' }))
    expect(handleSuccessDeletePromotion).toHaveBeenCalledWith(8)
  })

  it('resolves { ok: false, error } on an API error, frees the Save buttons and neither closes nor tells the list', async () => {
    mocks.fetch.mockImplementation((url, options) => {
      if (options.method === 'GET') return reply({ error: false, result: [RECORD] })
      return reply({ error: true, result: ['The offer is in use'] })
    })
    const { ui, onClose, handleSuccessDeletePromotion } = renderDetails()
    await settle()

    let outcome
    await act(async () => { outcome = await ui.current.handleDeletePromotion() })

    expect(outcome).toEqual({ ok: false, error: ['The offer is in use'] })
    expect(ui.current.actionState).toEqual({ loading: false, error: ['The offer is in use'] })
    expect(onClose).not.toHaveBeenCalled()
    expect(handleSuccessDeletePromotion).not.toHaveBeenCalled()
    expect(mocks.showToast).not.toHaveBeenCalledWith('SUCCESS', 'Offer deleted')
    // redesign (row 81, review r1 R10): the «Loading» toast does not stay on screen after the failure
    expect(mocks.hideToast).toHaveBeenCalledTimes(1)
  })

  it('resolves { ok: false, error } when the request throws, and frees the Save buttons', async () => {
    mocks.fetch.mockImplementation((url, options) => {
      if (options.method === 'GET') return reply({ error: false, result: [RECORD] })
      return Promise.reject(new Error('Network down'))
    })
    const { ui, onClose } = renderDetails()
    await settle()

    let outcome
    await act(async () => { outcome = await ui.current.handleDeletePromotion() })

    expect(outcome).toEqual({ ok: false, error: ['Network down'] })
    expect(ui.current.actionState).toEqual({ loading: false, error: ['Network down'] })
    expect(onClose).not.toHaveBeenCalled()
    expect(mocks.hideToast).toHaveBeenCalledTimes(1) // redesign (row 81, R10)
  })
})

// owner decision 14 B: «Select all» takes every business of the project (or every match of the search) from the
// list's `getAllBusinessIds`, not the loaded page. «Select none» is unchanged.
describe('EnterprisePromotionDetails controller · select all businesses (owner decision 14 B)', () => {
  const ROW = { id: 8, name: 'Row', businesses: [{ id: 11 }, { id: 12 }] }
  const page = Array.from({ length: 10 }, (_, index) => ({ id: index + 1, name: `Store ${index + 1}` }))
  const ids = (count) => Array.from({ length: count }, (_, index) => index + 1)

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = mocks.fetch
  })
  afterEach(() => cleanup())

  const renderRow = (props = {}) => renderDetails({ promotion: ROW, promotionId: 8, businessesList: { businesses: page, loading: false }, ...props })

  it('selects every business of the project (23 over 3 pages), not the 10 of the loaded page', async () => {
    const getAllBusinessIds = vi.fn(() => Promise.resolve(ids(23)))
    const { ui } = renderRow({ getAllBusinessIds })
    await settle()

    await act(async () => { await ui.current.handleSelectAllBusiness(true) })

    expect(getAllBusinessIds).toHaveBeenCalledTimes(1)
    expect(ui.current.selectedBusinessIds).toEqual(ids(23))
    expect(ui.current.formState.changes.businesses).toEqual(ids(23))
  })

  // W1 review F1: «Select all» adds; it never takes the promotion off a business it already had (n.º 14 «añade sin quitar nada»)
  it('with a search, adds what the search finds (the ids the list answers) and keeps the businesses already selected', async () => {
    const getAllBusinessIds = vi.fn(() => Promise.resolve([3, 5, 14]))
    const { ui } = renderRow({ getAllBusinessIds })
    await settle()
    expect(ui.current.selectedBusinessIds).toEqual([11, 12])

    await act(async () => { await ui.current.handleSelectAllBusiness(true) })

    expect(ui.current.selectedBusinessIds).toEqual([3, 5, 14, 11, 12])
    expect(ui.current.formState.changes.businesses).toEqual([3, 5, 14, 11, 12])
  })

  it('says it is busy while it loads and a second click does not send a second read', async () => {
    let release
    const getAllBusinessIds = vi.fn(() => new Promise(resolve => { release = resolve }))
    const { ui } = renderRow({ getAllBusinessIds })
    await settle()
    expect(ui.current.isSelectingAllBusinesses).toBe(false)

    let first
    act(() => { first = ui.current.handleSelectAllBusiness(true) })
    expect(ui.current.isSelectingAllBusinesses).toBe(true)
    act(() => { ui.current.handleSelectAllBusiness(true) })
    expect(getAllBusinessIds).toHaveBeenCalledTimes(1)

    await act(async () => { release(ids(23)); await first })
    expect(ui.current.isSelectingAllBusinesses).toBe(false)
    expect(ui.current.selectedBusinessIds).toEqual(ids(23))
  })

  it('on failure keeps the previous selection, frees the control and shows the error toast', async () => {
    const getAllBusinessIds = vi.fn(() => Promise.reject(new Error('Businesses unavailable')))
    const { ui } = renderRow({ getAllBusinessIds })
    await settle()

    await act(async () => { await ui.current.handleSelectAllBusiness(true) })

    expect(ui.current.selectedBusinessIds).toEqual([11, 12])
    expect(ui.current.formState.changes.businesses).toBeUndefined()
    expect(ui.current.isSelectingAllBusinesses).toBe(false)
    expect(mocks.showToast).toHaveBeenCalledWith('ERROR', 'Businesses unavailable')
  })

  it('on a failure without a message it shows the stores error text', async () => {
    const getAllBusinessIds = vi.fn(() => Promise.reject(new Error('')))
    const { ui } = renderRow({ getAllBusinessIds })
    await settle()

    await act(async () => { await ui.current.handleSelectAllBusiness(true) })

    expect(mocks.showToast).toHaveBeenCalledWith('ERROR', "We couldn't load the stores.")
  })

  it('«Select none» is unchanged: it empties the selection without reading anything', async () => {
    const getAllBusinessIds = vi.fn(() => Promise.resolve(ids(23)))
    const { ui } = renderRow({ getAllBusinessIds })
    await settle()

    await act(async () => { await ui.current.handleSelectAllBusiness(false) })

    expect(getAllBusinessIds).not.toHaveBeenCalled()
    expect(ui.current.selectedBusinessIds).toEqual([])
    expect(ui.current.formState.changes.businesses).toEqual([])
  })

  it('without a reader (another host) it keeps the old behavior: the loaded page', async () => {
    const { ui } = renderRow()
    await settle()

    await act(async () => { await ui.current.handleSelectAllBusiness(true) })

    expect(ui.current.selectedBusinessIds).toEqual(ids(10))
    expect(ui.current.formState.changes.businesses).toEqual(ids(10))
  })
})
