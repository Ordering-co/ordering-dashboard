/* eslint-disable import/first */
// redesign stores 5.13 (E1): the markups controller (shared with the /stores/markups route).
//  - `createMarkup` / `updateMarkup` / `deleteMarkups` take `options.inlineError`: no LOADING / error toast and no
//    `actionState.error` (the UI shows the error inline); the success toasts stay and the return shapes are unchanged;
//  - G5-41 (controller part): `deleteMarkups` removes from the list (and the pagination totals) every id whose DELETE worked, and
//    says which ones failed: `{ error, result, deletedIds, failedIds }`.
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

import { Markups } from '../index'

const markup = (id, extra = {}) => ({ id, name: `Markup ${id}`, percentage: 5, ...extra })
const MARKUPS = [markup(1), markup(2), markup(3)]

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
    if (key === 'GET /markups') {
      return answer({ error: false, result: MARKUPS, pagination: { current_page: 1, page_size: 10, total: 3, total_pages: 1, from: 1, to: 3 } })
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
  render(<Markups UIComponent={UI} />)
  await waitFor(() => expect(ui.markupsList.markups).toHaveLength(3))
  mocks.showToast.mockReset()
}

beforeEach(() => {
  mocks.showToast.mockReset()
  routes = {}
  installFetch()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Markups controller · createMarkup', () => {
  it('as before: LOADING + error toast and actionState.error on an API error', async () => {
    routes['POST /markups'] = () => answer({ error: true, result: ['Name is required'] })
    await draw()
    let result
    await act(async () => { result = await ui.createMarkup({ name: 'x', percentage: 2 }) })
    expect(result).toEqual({ error: true, result: ['Name is required'] })
    expect(toasts()).toEqual([['info', 'Loading'], ['error', 'Error']])
    expect(ui.actionState).toEqual({ loading: false, error: ['Name is required'] })
  })

  it('inlineError: no toasts and no actionState.error on an API error, same return shape', async () => {
    routes['POST /markups'] = () => answer({ error: true, result: ['Name is required'] })
    await draw()
    let result
    await act(async () => { result = await ui.createMarkup({ name: 'x', percentage: 2 }, { inlineError: true }) })
    expect(result).toEqual({ error: true, result: ['Name is required'] })
    expect(mocks.showToast).not.toHaveBeenCalled()
    expect(ui.actionState).toEqual({ loading: false, error: null })
  })

  it('inlineError: no toasts when the request throws', async () => {
    routes['POST /markups'] = () => Promise.reject(new Error('Network down'))
    await draw()
    let result
    await act(async () => { result = await ui.createMarkup({ name: 'x', percentage: 2 }, { inlineError: true }) })
    expect(result).toEqual({ error: true, result: ['Network down'] })
    expect(mocks.showToast).not.toHaveBeenCalled()
    expect(ui.actionState.error).toBeNull()
  })

  it('as before: a request that throws shows the error toast and fills actionState.error', async () => {
    routes['POST /markups'] = () => Promise.reject(new Error('Network down'))
    await draw()
    await act(async () => { await ui.createMarkup({ name: 'x', percentage: 2 }) })
    expect(toasts()).toEqual([['info', 'Loading'], ['error', 'Error']])
    expect(ui.actionState.error).toEqual(['Network down'])
  })

  it('inlineError: the success toast stays and the markup reaches the list', async () => {
    routes['POST /markups'] = () => answer({ error: false, result: markup(9) })
    await draw()
    let result
    await act(async () => { result = await ui.createMarkup({ name: 'x', percentage: 2 }, { inlineError: true }) })
    expect(result).toEqual({ error: false, result: markup(9) })
    expect(toasts()).toEqual([['success', 'Markup created']])
    expect(ui.markupsList.markups.map((m) => m.id)).toContain(9)
  })

  it('does not change the request: POST /markups with the payload as given', async () => {
    routes['POST /markups'] = () => answer({ error: false, result: markup(9) })
    await draw()
    fetch.mockClear()
    await act(async () => { await ui.createMarkup({ name: 'x', percentage: 2 }, { inlineError: true }) })
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, options] = fetch.mock.calls[0]
    expect(`${options.method} ${url}`).toBe('POST https://api.test/markups')
    expect(JSON.parse(options.body)).toEqual({ name: 'x', percentage: 2 })
  })
})

describe('Markups controller · updateMarkup', () => {
  it('as before: LOADING + error toast and actionState.error on an API error', async () => {
    routes['PUT /markups/2'] = () => answer({ error: true, result: ['Nope'] })
    await draw()
    let result
    await act(async () => { result = await ui.updateMarkup(2, { name: 'y' }) })
    expect(result).toEqual({ error: true, result: ['Nope'] })
    expect(toasts()).toEqual([['info', 'Loading'], ['error', 'Error']])
    expect(ui.actionState.error).toEqual(['Nope'])
  })

  it('inlineError: no toasts and no actionState.error on an API error', async () => {
    routes['PUT /markups/2'] = () => answer({ error: true, result: ['Nope'] })
    await draw()
    let result
    await act(async () => { result = await ui.updateMarkup(2, { name: 'y' }, { inlineError: true }) })
    expect(result).toEqual({ error: true, result: ['Nope'] })
    expect(mocks.showToast).not.toHaveBeenCalled()
    expect(ui.actionState).toEqual({ loading: false, error: null })
  })

  it('inlineError: no toasts when the request throws', async () => {
    routes['PUT /markups/2'] = () => Promise.reject(new Error('Network down'))
    await draw()
    let result
    await act(async () => { result = await ui.updateMarkup(2, { name: 'y' }, { inlineError: true }) })
    expect(result).toEqual({ error: true, result: ['Network down'] })
    expect(mocks.showToast).not.toHaveBeenCalled()
    expect(ui.actionState.error).toBeNull()
  })

  it('inlineError: the success toast stays and the list is updated', async () => {
    routes['PUT /markups/2'] = () => answer({ error: false, result: markup(2, { name: 'Renamed' }) })
    await draw()
    await act(async () => { await ui.updateMarkup(2, { name: 'Renamed' }, { inlineError: true }) })
    expect(toasts()).toEqual([['success', 'Changes saved']])
    expect(ui.markupsList.markups.find((m) => m.id === 2).name).toBe('Renamed')
  })
})

describe('Markups controller · deleteMarkups', () => {
  it('everything deleted: { error: false, result: true, deletedIds, failedIds: [] }, rows and totals updated, success toast', async () => {
    routes['DELETE /markups/1'] = () => answer({ error: false, result: {} })
    routes['DELETE /markups/2'] = () => answer({ error: false, result: {} })
    await draw()
    let result
    await act(async () => { result = await ui.deleteMarkups([1, 2]) })
    expect(result).toEqual({ error: false, result: true, deletedIds: [1, 2], failedIds: [] })
    expect(ui.markupsList.markups.map((m) => m.id)).toEqual([3])
    expect(ui.paginationProps.totalItems).toBe(1)
    expect(toasts()).toEqual([['info', 'Loading'], ['success', 'Markups deleted']])
  })

  it('G5-41: a partial failure removes only the ids that were deleted and lists the failed ones', async () => {
    routes['DELETE /markups/1'] = () => answer({ error: false, result: {} })
    routes['DELETE /markups/2'] = () => answer({ error: true, result: ['In use'] })
    routes['DELETE /markups/3'] = () => answer({ error: false, result: {} })
    await draw()
    let result
    await act(async () => { result = await ui.deleteMarkups([1, 2, 3]) })
    expect(result).toEqual({ error: true, result: ['#2: In use'], deletedIds: [1, 3], failedIds: [2] })
    expect(ui.markupsList.markups.map((m) => m.id)).toEqual([2])
    expect(ui.paginationProps.totalItems).toBe(1)
    expect(toasts()).toEqual([['info', 'Loading'], ['error', 'Error']])
    expect(ui.actionState).toEqual({ loading: false, error: ['#2: In use'] })
  })

  it('every delete fails: nothing leaves the list, all ids are failed', async () => {
    routes['DELETE /markups/1'] = () => answer({ error: true, result: ['In use'] })
    routes['DELETE /markups/2'] = () => answer({ error: true, result: 'Locked' })
    await draw()
    let result
    await act(async () => { result = await ui.deleteMarkups([1, 2]) })
    expect(result).toEqual({ error: true, result: ['#1: In use', '#2: Locked'], deletedIds: [], failedIds: [1, 2] })
    expect(ui.markupsList.markups).toHaveLength(3)
    expect(ui.paginationProps.totalItems).toBe(3)
  })

  it('a request that throws counts as failed, the others still go through', async () => {
    routes['DELETE /markups/1'] = () => Promise.reject(new Error('Network down'))
    routes['DELETE /markups/2'] = () => answer({ error: false, result: {} })
    await draw()
    let result
    await act(async () => { result = await ui.deleteMarkups([1, 2]) })
    expect(result.error).toBe(true)
    expect(result.deletedIds).toEqual([2])
    expect(result.failedIds).toEqual([1])
    expect(result.result).toEqual(['#1: Network down'])
    expect(ui.markupsList.markups.map((m) => m.id)).toEqual([1, 3])
  })

  it('inlineError: no LOADING / error toast and no actionState.error on a partial failure, rows still leave', async () => {
    routes['DELETE /markups/1'] = () => answer({ error: false, result: {} })
    routes['DELETE /markups/2'] = () => answer({ error: true, result: ['In use'] })
    await draw()
    let result
    await act(async () => { result = await ui.deleteMarkups([1, 2], { inlineError: true }) })
    expect(result).toEqual({ error: true, result: ['#2: In use'], deletedIds: [1], failedIds: [2] })
    expect(mocks.showToast).not.toHaveBeenCalled()
    expect(ui.actionState).toEqual({ loading: false, error: null })
    expect(ui.markupsList.markups.map((m) => m.id)).toEqual([2, 3])
  })

  it('inlineError: the success toast stays', async () => {
    routes['DELETE /markups/1'] = () => answer({ error: false, result: {} })
    await draw()
    await act(async () => { await ui.deleteMarkups([1], { inlineError: true }) })
    expect(toasts()).toEqual([['success', 'Markups deleted']])
  })

  it('does not change the requests: one DELETE per id, same URL', async () => {
    routes['DELETE /markups/1'] = () => answer({ error: false, result: {} })
    routes['DELETE /markups/2'] = () => answer({ error: false, result: {} })
    await draw()
    fetch.mockClear()
    await act(async () => { await ui.deleteMarkups([1, 2]) })
    expect(fetch.mock.calls.map(([url, o]) => `${o.method} ${url}`)).toEqual(['DELETE https://api.test/markups/1', 'DELETE https://api.test/markups/2'])
  })
})

// redesign bugs F row 28: the list is fetched newest first (orderBy=-created_at), so a created markup lands FIRST on a
// full page 1 (and the last row drops off); an update keeps its position.
describe('Markups controller · position of a created markup on a full first page', () => {
  const fullPage = () => {
    routes['GET /markups'] = () => answer({
      error: false,
      result: [markup(3), markup(2), markup(1)],
      pagination: { current_page: 1, page_size: 3, total: 3, total_pages: 1, from: 1, to: 3 }
    })
  }

  it('fetches newest first', async () => {
    fullPage()
    await draw()
    expect(fetch.mock.calls.find(([url]) => url.includes('/markups?')).at(0)).toContain('orderBy=-created_at')
  })

  it('create: the new markup is first and the page keeps its size (the oldest row drops off)', async () => {
    fullPage()
    routes['POST /markups'] = () => answer({ error: false, result: markup(4) })
    await draw()
    await act(async () => { await ui.createMarkup({ name: 'x', percentage: 2 }, { inlineError: true }) })
    expect(ui.markupsList.markups.map((m) => m.id)).toEqual([4, 3, 2])
    expect(ui.markupsList.markups).toHaveLength(3)
  })

  it('update: the markup keeps its position', async () => {
    fullPage()
    routes['PUT /markups/2'] = () => answer({ error: false, result: markup(2, { name: 'Renamed' }) })
    await draw()
    await act(async () => { await ui.updateMarkup(2, { name: 'Renamed' }, { inlineError: true }) })
    expect(ui.markupsList.markups.map((m) => m.id)).toEqual([3, 2, 1])
    expect(ui.markupsList.markups[1].name).toBe('Renamed')
  })
})
