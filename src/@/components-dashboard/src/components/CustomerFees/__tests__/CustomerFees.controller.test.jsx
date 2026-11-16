/* eslint-disable import/first */
// redesign stores 5.12 (E1): the customer fees controller.
//  - `createFee` / `updateFee` / `deleteFees` take `options.inlineError`: no LOADING / error toast and no `actionState.error`
//    (the UI shows the error inline); the success toasts stay and the return shapes are unchanged;
//  - G4-33: `deleteFees` removes from the list (and the pagination totals) every id whose DELETE worked, and says which ones
//    failed: `{ error, result, deletedIds, failedIds }`.
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  showToast: vi.fn()
}))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', user: { level: 0 } }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test', project: 'demo' }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (key, text) => text]
}))

import { CustomerFees } from '../index'

const fee = (id, extra = {}) => ({ id, name: `Fee ${id}`, fixed: 1, percentage: 0, ...extra })
const FEES = [fee(1), fee(2), fee(3)]

const answer = (body) => Promise.resolve({ json: () => Promise.resolve(body) })
const toasts = () => mocks.showToast.mock.calls.map(([type, message]) => [type, message])

let ui
// Mock per URL + method; unknown requests answer an empty ok list.
let routes
const installFetch = () => {
  vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
    const key = `${options.method || 'GET'} ${url.split('?')[0].replace('https://api.test', '')}`
    const handler = routes[key]
    if (handler) return handler(options)
    if (key === 'GET /fees') {
      return answer({ error: false, result: FEES, pagination: { current_page: 1, page_size: 10, total: 3, total_pages: 1, from: 1, to: 3 } })
    }
    return answer({ error: false, result: [] })
  }))
}

const draw = async () => {
  ui = null
  const UI = (props) => {
    ui = props
    return null
  }
  render(<CustomerFees UIComponent={UI} businessId={7} />)
  await waitFor(() => expect(ui.feesList.fees).toHaveLength(3))
}

beforeEach(() => {
  mocks.showToast.mockReset()
  routes = {}
  installFetch()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('CustomerFees controller · createFee', () => {
  it('as before: LOADING + error toast and actionState.error on an API error', async () => {
    routes['POST /fees'] = () => answer({ error: true, result: ['Name is required'] })
    await draw()
    mocks.showToast.mockReset()
    let result
    await act(async () => { result = await ui.createFee({ name: 'x', fixed: 2 }) })
    expect(result).toEqual({ error: true, result: ['Name is required'] })
    expect(toasts()).toEqual([['info', 'Loading'], ['error', 'Error']])
    expect(ui.actionState).toEqual({ loading: false, error: ['Name is required'] })
  })

  it('inlineError: no toasts and no actionState.error on an API error, same return shape', async () => {
    routes['POST /fees'] = () => answer({ error: true, result: ['Name is required'] })
    await draw()
    mocks.showToast.mockReset()
    let result
    await act(async () => { result = await ui.createFee({ name: 'x', fixed: 2 }, { inlineError: true }) })
    expect(result).toEqual({ error: true, result: ['Name is required'] })
    expect(mocks.showToast).not.toHaveBeenCalled()
    expect(ui.actionState).toEqual({ loading: false, error: null })
  })

  it('inlineError: no toasts when the request throws', async () => {
    routes['POST /fees'] = () => Promise.reject(new Error('Network down'))
    await draw()
    mocks.showToast.mockReset()
    let result
    await act(async () => { result = await ui.createFee({ name: 'x', fixed: 2 }, { inlineError: true }) })
    expect(result).toEqual({ error: true, result: ['Network down'] })
    expect(mocks.showToast).not.toHaveBeenCalled()
    expect(ui.actionState.error).toBeNull()
  })

  it('inlineError: the success toast stays and the fee reaches the list', async () => {
    routes['POST /fees'] = () => answer({ error: false, result: fee(9) })
    await draw()
    mocks.showToast.mockReset()
    let result
    await act(async () => { result = await ui.createFee({ name: 'x', fixed: 2 }, { inlineError: true }) })
    expect(result).toEqual({ error: false, result: fee(9) })
    expect(toasts()).toEqual([['success', 'Fee created']])
    expect(ui.feesList.fees.map((f) => f.id)).toContain(9)
  })
})

describe('CustomerFees controller · updateFee', () => {
  it('as before: LOADING + error toast and actionState.error on an API error', async () => {
    routes['PUT /fees/2'] = () => answer({ error: true, result: ['Nope'] })
    await draw()
    mocks.showToast.mockReset()
    let result
    await act(async () => { result = await ui.updateFee(2, { name: 'y' }) })
    expect(result).toEqual({ error: true, result: ['Nope'] })
    expect(toasts()).toEqual([['info', 'Loading'], ['error', 'Error']])
    expect(ui.actionState.error).toEqual(['Nope'])
  })

  it('inlineError: no toasts and no actionState.error on an API error', async () => {
    routes['PUT /fees/2'] = () => answer({ error: true, result: ['Nope'] })
    await draw()
    mocks.showToast.mockReset()
    let result
    await act(async () => { result = await ui.updateFee(2, { name: 'y' }, { inlineError: true }) })
    expect(result).toEqual({ error: true, result: ['Nope'] })
    expect(mocks.showToast).not.toHaveBeenCalled()
    expect(ui.actionState).toEqual({ loading: false, error: null })
  })

  it('inlineError: no toasts when the request throws', async () => {
    routes['PUT /fees/2'] = () => Promise.reject(new Error('Network down'))
    await draw()
    mocks.showToast.mockReset()
    let result
    await act(async () => { result = await ui.updateFee(2, { name: 'y' }, { inlineError: true }) })
    expect(result).toEqual({ error: true, result: ['Network down'] })
    expect(mocks.showToast).not.toHaveBeenCalled()
    expect(ui.actionState.error).toBeNull()
  })

  it('inlineError: the success toast stays and the list is updated', async () => {
    routes['PUT /fees/2'] = () => answer({ error: false, result: fee(2, { name: 'Renamed' }) })
    await draw()
    mocks.showToast.mockReset()
    await act(async () => { await ui.updateFee(2, { name: 'Renamed' }, { inlineError: true }) })
    expect(toasts()).toEqual([['success', 'Changes saved']])
    expect(ui.feesList.fees.find((f) => f.id === 2).name).toBe('Renamed')
  })
})

describe('CustomerFees controller · deleteFees', () => {
  it('everything deleted: { error: false, result: true, deletedIds, failedIds: [] }, rows and totals updated, success toast', async () => {
    routes['DELETE /fees/1'] = () => answer({ error: false, result: {} })
    routes['DELETE /fees/2'] = () => answer({ error: false, result: {} })
    await draw()
    mocks.showToast.mockReset()
    let result
    await act(async () => { result = await ui.deleteFees([1, 2]) })
    expect(result).toEqual({ error: false, result: true, deletedIds: [1, 2], failedIds: [] })
    expect(ui.feesList.fees.map((f) => f.id)).toEqual([3])
    expect(ui.paginationProps.totalItems).toBe(1)
    expect(toasts()).toEqual([['info', 'Loading'], ['success', 'Fees deleted']])
  })

  it('G4-33: a partial failure removes only the ids that were deleted and lists the failed ones', async () => {
    routes['DELETE /fees/1'] = () => answer({ error: false, result: {} })
    routes['DELETE /fees/2'] = () => answer({ error: true, result: ['In use'] })
    routes['DELETE /fees/3'] = () => answer({ error: false, result: {} })
    await draw()
    mocks.showToast.mockReset()
    let result
    await act(async () => { result = await ui.deleteFees([1, 2, 3]) })
    expect(result).toEqual({ error: true, result: ['#2: In use'], deletedIds: [1, 3], failedIds: [2] })
    expect(ui.feesList.fees.map((f) => f.id)).toEqual([2])
    expect(ui.paginationProps.totalItems).toBe(1)
    expect(toasts()).toEqual([['info', 'Loading'], ['error', 'Error']])
    expect(ui.actionState).toEqual({ loading: false, error: ['#2: In use'] })
  })

  it('every delete fails: nothing leaves the list, all ids are failed', async () => {
    routes['DELETE /fees/1'] = () => answer({ error: true, result: ['In use'] })
    routes['DELETE /fees/2'] = () => answer({ error: true, result: 'Locked' })
    await draw()
    let result
    await act(async () => { result = await ui.deleteFees([1, 2]) })
    expect(result).toEqual({ error: true, result: ['#1: In use', '#2: Locked'], deletedIds: [], failedIds: [1, 2] })
    expect(ui.feesList.fees).toHaveLength(3)
    expect(ui.paginationProps.totalItems).toBe(3)
  })

  it('a request that throws counts as failed, the others still go through', async () => {
    routes['DELETE /fees/1'] = () => Promise.reject(new Error('Network down'))
    routes['DELETE /fees/2'] = () => answer({ error: false, result: {} })
    await draw()
    let result
    await act(async () => { result = await ui.deleteFees([1, 2]) })
    expect(result.error).toBe(true)
    expect(result.deletedIds).toEqual([2])
    expect(result.failedIds).toEqual([1])
    expect(result.result).toEqual(['#1: Network down'])
    expect(ui.feesList.fees.map((f) => f.id)).toEqual([1, 3])
  })

  it('inlineError: no LOADING / error toast and no actionState.error on a partial failure, rows still leave', async () => {
    routes['DELETE /fees/1'] = () => answer({ error: false, result: {} })
    routes['DELETE /fees/2'] = () => answer({ error: true, result: ['In use'] })
    await draw()
    mocks.showToast.mockReset()
    let result
    await act(async () => { result = await ui.deleteFees([1, 2], { inlineError: true }) })
    expect(result).toEqual({ error: true, result: ['#2: In use'], deletedIds: [1], failedIds: [2] })
    expect(mocks.showToast).not.toHaveBeenCalled()
    expect(ui.actionState).toEqual({ loading: false, error: null })
    expect(ui.feesList.fees.map((f) => f.id)).toEqual([2, 3])
  })

  it('inlineError: the success toast stays', async () => {
    routes['DELETE /fees/1'] = () => answer({ error: false, result: {} })
    await draw()
    mocks.showToast.mockReset()
    await act(async () => { await ui.deleteFees([1], { inlineError: true }) })
    expect(toasts()).toEqual([['success', 'Fees deleted']])
  })

  it('does not change the requests: one DELETE per id, same URL', async () => {
    routes['DELETE /fees/1'] = () => answer({ error: false, result: {} })
    routes['DELETE /fees/2'] = () => answer({ error: false, result: {} })
    await draw()
    fetch.mockClear()
    await act(async () => { await ui.deleteFees([1, 2]) })
    expect(fetch.mock.calls.map(([url, o]) => `${o.method} ${url}`)).toEqual(['DELETE https://api.test/fees/1', 'DELETE https://api.test/fees/2'])
  })
})

// redesign bugs F row 28: the list is fetched newest first (orderBy=-id), so a created fee lands FIRST on a full page 1
// (and the last row drops off); an update keeps its position.
describe('CustomerFees controller · position of a created fee on a full first page', () => {
  const fullPage = () => {
    routes['GET /fees'] = () => answer({
      error: false,
      result: [fee(3), fee(2), fee(1)],
      pagination: { current_page: 1, page_size: 3, total: 3, total_pages: 1, from: 1, to: 3 }
    })
  }

  it('fetches newest first', async () => {
    fullPage()
    await draw()
    expect(fetch.mock.calls.find(([url]) => url.includes('/fees?')).at(0)).toContain('orderBy=-id')
  })

  it('create: the new fee is first and the page keeps its size (the oldest row drops off)', async () => {
    fullPage()
    routes['POST /fees'] = () => answer({ error: false, result: fee(4) })
    await draw()
    await act(async () => { await ui.createFee({ name: 'x', fixed: 2 }, { inlineError: true }) })
    expect(ui.feesList.fees.map((f) => f.id)).toEqual([4, 3, 2])
    expect(ui.feesList.fees).toHaveLength(3)
  })

  it('update: the fee keeps its position', async () => {
    fullPage()
    routes['PUT /fees/2'] = () => answer({ error: false, result: fee(2, { name: 'Renamed' }) })
    await draw()
    await act(async () => { await ui.updateFee(2, { name: 'Renamed' }, { inlineError: true }) })
    expect(ui.feesList.fees.map((f) => f.id)).toEqual([3, 2, 1])
    expect(ui.feesList.fees[1].name).toBe('Renamed')
  })
})
