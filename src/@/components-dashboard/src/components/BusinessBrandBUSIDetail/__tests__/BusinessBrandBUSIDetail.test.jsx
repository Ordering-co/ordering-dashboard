/* eslint-disable import/first */
// redesign SB-B1 (G5-45, M-SB2, M-SB7): the BusinessBrandBUSIDetail controller saves the brand of a store only when the
// API answers (nothing is mutated before), answers `{ ok, error }`, keeps each failure in `businessList.failures`, saves the
// «Select all / none» block in series (and «none» only frees the stores of THIS brand), and keeps the load error for the UI.
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ showToast: vi.fn(), hideToast: vi.fn(), save: vi.fn() }))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', loading: false, user: { level: 0 } }]
}))
vi.mock('../../../contexts/ApiContext', () => {
  const api = {
    root: 'https://api.test/v400/en/demo',
    businesses: (id) => ({ save: (changes) => mocks.save(id, changes) })
  }
  return { useApi: () => [api] }
})
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast, hideToast: mocks.hideToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))

import { BusinessBrandBUSIDetail } from '../index'

const BRAND = 5
// A and D belong to this brand, B to another one (9), C to none
const STORES = [
  { id: 1, name: 'A', franchise_id: 5 },
  { id: 2, name: 'B', franchise_id: 9 },
  { id: 3, name: 'C', franchise_id: null },
  { id: 4, name: 'D', franchise_id: 5 }
]

const json = (body) => ({ json: async () => body })
const saved = (franchiseId) => ({ content: { error: false, result: { franchise_id: franchiseId } } })
const failed = (result) => ({ content: { error: true, result } })

let ui
const UI = (props) => {
  ui = props
  return null
}

const fetchMock = vi.fn()

const draw = async () => {
  ui = null
  render(<BusinessBrandBUSIDetail UIComponent={UI} isSearchByName />)
  await waitFor(() => expect(ui.businessList.loading).toBe(false))
  await waitFor(() => expect(ui.businessList.businesses).toHaveLength(4))
}

const franchises = () => Object.fromEntries(ui.businessList.businesses.map(b => [b.id, b.franchise_id]))
const toastTypes = () => mocks.showToast.mock.calls.map(([type]) => type)

beforeEach(() => {
  mocks.showToast.mockReset()
  mocks.hideToast.mockReset()
  mocks.save.mockReset()
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(json({ error: false, result: STORES.map(s => ({ ...s })), pagination: { page_size: 10, current_page: 1, total: 4 } }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BusinessBrandBUSIDetail controller · loading', () => {
  it('starts with no error, no failures and nothing pending', async () => {
    await draw()
    expect(ui.businessList.error).toBeNull()
    expect(ui.businessList.failures).toEqual({})
    expect(ui.businessList.pending).toEqual([])
  })

  it('keeps the load error (not an empty list) and handleRetry asks again for the same page and size', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: true, result: ['LOAD_FAILED'] }))
    ui = null
    render(<BusinessBrandBUSIDetail UIComponent={UI} />)
    await waitFor(() => expect(ui.businessList.error).toEqual(['LOAD_FAILED']))
    expect(ui.businessList.loading).toBe(false)
    expect(typeof ui.handleRetry).toBe('function')
    await act(async () => { await ui.handleRetry() })
    expect(ui.businessList.error).toBeNull()
    expect(ui.businessList.businesses).toHaveLength(4)
    expect(fetchMock.mock.calls[1][0]).toBe(fetchMock.mock.calls[0][0])
  })

  it('keeps an exception as a load error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network down'))
    ui = null
    render(<BusinessBrandBUSIDetail UIComponent={UI} />)
    await waitFor(() => expect(ui.businessList.error).toEqual(['Network down']))
  })
})

describe('BusinessBrandBUSIDetail controller · one store', () => {
  it('returns { ok: true }, mutates nothing before the answer and then changes only that store with the franchise_id returned', async () => {
    await draw()
    let resolve
    mocks.save.mockReturnValue(new Promise(_resolve => { resolve = _resolve }))
    let promise
    await act(async () => { promise = ui.handleChangeCheckBox({ target: { checked: true } }, 3, BRAND) })
    expect(mocks.save).toHaveBeenCalledWith(3, { franchise_id: BRAND })
    expect(franchises()).toEqual({ 1: 5, 2: 9, 3: null, 4: 5 })
    expect(ui.businessList.pending).toEqual([3])
    let result
    await act(async () => { resolve(saved(BRAND)); result = await promise })
    expect(result).toEqual({ ok: true })
    expect(franchises()).toEqual({ 1: 5, 2: 9, 3: 5, 4: 5 })
    expect(ui.businessList.pending).toEqual([])
    expect(toastTypes()).toEqual(['info', 'success'])
    expect(mocks.hideToast).not.toHaveBeenCalled()
  })

  it('unchecking sends franchise_id null', async () => {
    await draw()
    mocks.save.mockResolvedValue(saved(null))
    await act(async () => { await ui.handleChangeCheckBox({ target: { checked: false } }, 1, BRAND) })
    expect(mocks.save).toHaveBeenCalledWith(1, { franchise_id: null })
    expect(franchises()[1]).toBeNull()
  })

  it('returns { ok: false, error: result } on an API error, leaves the store and records the failure; retrying clears it', async () => {
    await draw()
    mocks.save.mockResolvedValueOnce(failed(['API_ERROR']))
    let result
    await act(async () => { result = await ui.handleChangeCheckBox({ target: { checked: true } }, 3, BRAND) })
    expect(result).toEqual({ ok: false, error: ['API_ERROR'] })
    expect(franchises()[3]).toBeNull()
    expect(ui.businessList.failures).toEqual({ 3: ['API_ERROR'] })
    expect(ui.businessList.pending).toEqual([])
    expect(toastTypes()).toEqual(['info'])
    // redesign bugs F row 19: the row says why it failed, so the «Loading» toast is hidden
    expect(mocks.hideToast).toHaveBeenCalledTimes(1)

    let resolve
    mocks.save.mockReturnValueOnce(new Promise(_resolve => { resolve = _resolve }))
    let retry
    await act(async () => { retry = ui.handleChangeCheckBox({ target: { checked: true } }, 3, BRAND) })
    expect(ui.businessList.failures).toEqual({})
    await act(async () => { resolve(saved(BRAND)); await retry })
    expect(franchises()[3]).toBe(5)
  })

  it('returns { ok: false, error: [message] } when the save throws', async () => {
    await draw()
    mocks.save.mockRejectedValueOnce(new Error('Network down'))
    let result
    await act(async () => { result = await ui.handleChangeCheckBox({ target: { checked: true } }, 3, BRAND) })
    expect(result).toEqual({ ok: false, error: ['Network down'] })
    expect(ui.businessList.failures).toEqual({ 3: ['Network down'] })
    expect(franchises()[3]).toBeNull()
    expect(mocks.hideToast).toHaveBeenCalledTimes(1)
  })

  it('forgets the failures when the list is paged or searched', async () => {
    await draw()
    mocks.save.mockResolvedValueOnce(failed(['API_ERROR']))
    await act(async () => { await ui.handleChangeCheckBox({ target: { checked: true } }, 3, BRAND) })
    expect(ui.businessList.failures).toEqual({ 3: ['API_ERROR'] })
    await act(async () => { await ui.handleChangeBusinessPage(2) })
    expect(ui.businessList.failures).toEqual({})

    mocks.save.mockResolvedValueOnce(failed(['API_ERROR']))
    await act(async () => { await ui.handleChangeCheckBox({ target: { checked: true } }, 3, BRAND) })
    expect(ui.businessList.failures).toEqual({ 3: ['API_ERROR'] })
    await act(async () => { ui.onSearch('c') })
    await waitFor(() => expect(ui.businessList.failures).toEqual({}))
  })
})

describe('BusinessBrandBUSIDetail controller · search keeps the page size', () => {
  // redesign bugs F row 41 (M-02): searching asked for the default 10 and forgot the size the user had chosen.
  it('after choosing a page size of 25, a search asks for page 1 with that size', async () => {
    await draw()
    await act(async () => { await ui.handleChangeBusinessPageSize(25) })
    expect(fetchMock.mock.calls.at(-1)[0]).toContain('page=1&page_size=25')
    const before = fetchMock.mock.calls.length
    await act(async () => { ui.onSearch('c') })
    await waitFor(() => expect(fetchMock.mock.calls.length).toBe(before + 1))
    const url = fetchMock.mock.calls.at(-1)[0]
    expect(url).toContain('page=1&page_size=25')
    expect(url).toContain('where=')
  })

  it('a search from the initial state still asks for the default size of 10', async () => {
    await draw()
    await act(async () => { ui.onSearch('c') })
    await waitFor(() => expect(fetchMock.mock.calls.length).toBe(2))
    expect(fetchMock.mock.calls.at(-1)[0]).toContain('page=1&page_size=10')
  })
})

describe('BusinessBrandBUSIDetail controller · Select all / Select none', () => {
  it('Select none frees only the stores of THIS brand: the store of another brand is not sent', async () => {
    await draw()
    mocks.save.mockResolvedValue(saved(null))
    let result
    await act(async () => { result = await ui.handleSelectAllBusinesses(false, BRAND) })
    expect(result).toEqual({ ok: true, failed: [] })
    expect(mocks.save.mock.calls).toEqual([[1, { franchise_id: null }], [4, { franchise_id: null }]])
    expect(franchises()).toEqual({ 1: null, 2: 9, 3: null, 4: null })
  })

  it('Select all moves the stores whose franchise_id is not this brand, one request per store', async () => {
    await draw()
    mocks.save.mockResolvedValue(saved(BRAND))
    let result
    await act(async () => { result = await ui.handleSelectAllBusinesses(true, BRAND) })
    expect(result).toEqual({ ok: true, failed: [] })
    expect(mocks.save.mock.calls).toEqual([[2, { franchise_id: BRAND }], [3, { franchise_id: BRAND }]])
    expect(franchises()).toEqual({ 1: 5, 2: 5, 3: 5, 4: 5 })
  })

  it('saves in series: the next request starts only when the previous one answered', async () => {
    await draw()
    const resolvers = []
    mocks.save.mockImplementation(() => new Promise(_resolve => resolvers.push(_resolve)))
    let promise
    await act(async () => { promise = ui.handleSelectAllBusinesses(true, BRAND) })
    expect(mocks.save).toHaveBeenCalledTimes(1)
    expect(ui.businessList.pending).toEqual([2, 3])
    await act(async () => { resolvers[0](saved(BRAND)) })
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2))
    expect(ui.businessList.pending).toEqual([3])
    await act(async () => { resolvers[1](saved(BRAND)); await promise })
    expect(ui.businessList.pending).toEqual([])
  })

  it('toasts one Loading at the start and one Business updated when everything went well', async () => {
    await draw()
    mocks.save.mockResolvedValue(saved(BRAND))
    await act(async () => { await ui.handleSelectAllBusinesses(true, BRAND) })
    expect(mocks.showToast.mock.calls).toEqual([['info', 'Loading'], ['success', 'Business updated']])
    expect(mocks.hideToast).not.toHaveBeenCalled()
  })

  it('a failure in the block leaves that store as it was, is recorded, the rest go on, and there is no success toast', async () => {
    await draw()
    mocks.save
      .mockResolvedValueOnce(failed(['API_ERROR']))
      .mockResolvedValueOnce(saved(BRAND))
    let result
    await act(async () => { result = await ui.handleSelectAllBusinesses(true, BRAND) })
    expect(result).toEqual({ ok: false, failed: [{ id: 2, error: ['API_ERROR'] }] })
    expect(franchises()).toEqual({ 1: 5, 2: 9, 3: 5, 4: 5 })
    expect(ui.businessList.failures).toEqual({ 2: ['API_ERROR'] })
    expect(ui.businessList.pending).toEqual([])
    expect(toastTypes()).toEqual(['info'])
    // one hide for the block, at the end (the per-store requests are silent), not one per failed store
    expect(mocks.hideToast).toHaveBeenCalledTimes(1)
  })

  it('does nothing and toasts nothing when no store of the page changes', async () => {
    await draw()
    let result
    await act(async () => { result = await ui.handleSelectAllBusinesses(false, 123) })
    expect(result).toEqual({ ok: true, failed: [] })
    expect(mocks.save).not.toHaveBeenCalled()
    expect(mocks.showToast).not.toHaveBeenCalled()
  })
})
