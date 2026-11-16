/* eslint-disable import/first */
// redesign SB-B1: the BusinessBrandListing controller answers `{ ok, error }` to its caller (switch, delete), keeps
// the list and the total right, never computes on a captured list, reads one brand (`getBrand`) and says when the first
// response arrived (`brandListState.loaded`).
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ showToast: vi.fn(), hideToast: vi.fn() }))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', loading: false, user: { level: 0 } }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test/v400/en/demo' }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast, hideToast: mocks.hideToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))

import { BusinessBrandListing } from '../index'

const BRANDS = [
  { id: 1, name: 'Burger Palace', logo: 'a.png', enabled: true, slug: 'burger-palace' },
  { id: 2, name: 'Vips', logo: 'b.png', enabled: false, slug: 'vips' }
]

const json = (body) => ({ json: async () => body })

let ui
const UI = (props) => {
  ui = props
  return null
}

const fetchMock = vi.fn()

// default route: the list; every test overrides what it needs by method and url
const routes = {}
const respond = (url, options = {}) => {
  const method = options.method || 'GET'
  const key = Object.keys(routes).find(k => k === `${method} ${url}`) || Object.keys(routes).find(k => `${method} ${url}`.startsWith(k))
  if (!key) throw new Error(`no route for ${method} ${url}`)
  const handler = routes[key]
  return typeof handler === 'function' ? handler(url, options) : handler
}

const draw = async () => {
  ui = null
  render(<BusinessBrandListing UIComponent={UI} />)
  await waitFor(() => expect(ui.brandListState.loaded).toBe(true))
}

beforeEach(() => {
  mocks.showToast.mockReset()
  mocks.hideToast.mockReset()
  fetchMock.mockReset()
  for (const key of Object.keys(routes)) delete routes[key]
  routes['GET https://api.test/v400/en/demo/franchises?'] = json({
    error: false,
    result: BRANDS,
    pagination: { current_page: 1, total_pages: 1, total: 2, from: 1, to: 2 }
  })
  fetchMock.mockImplementation(async (url, options) => respond(url, options))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BusinessBrandListing controller · loading', () => {
  it('starts with loaded false and says loaded after the first response', async () => {
    routes['GET https://api.test/v400/en/demo/franchises?'] = new Promise(() => {})
    ui = null
    render(<BusinessBrandListing UIComponent={UI} />)
    await waitFor(() => expect(ui.brandListState.loading).toBe(true))
    expect(ui.brandListState.loaded).toBe(false)
  })

  it('sets loaded and keeps the list on the first response', async () => {
    await draw()
    expect(ui.brandListState.brands).toEqual(BRANDS)
    expect(ui.brandListState.error).toBeNull()
    expect(ui.paginationProps.totalItems).toBe(2)
  })

  it('keeps the load error in brandListState.error', async () => {
    routes['GET https://api.test/v400/en/demo/franchises?'] = json({ error: true, result: ['ERROR_LOADING'] })
    await draw()
    expect(ui.brandListState.error).toEqual(['ERROR_LOADING'])
    expect(ui.brandListState.loaded).toBe(true)
  })
})

describe('BusinessBrandListing controller · handleChangeState', () => {
  it('returns { ok: true }, posts the change with the token, updates the row and toasts Loading then Brand updated', async () => {
    routes['POST https://api.test/v400/en/demo/franchises/2'] = json({ error: false, result: { id: 2, name: 'Vips', logo: 'b.png', enabled: true } })
    await draw()
    let result
    await act(async () => { result = await ui.handleChangeState(2, 'enabled', true) })
    expect(result).toEqual({ ok: true })
    const [url, options] = fetchMock.mock.calls.find(([, o]) => o?.method === 'POST')
    expect(url).toBe('https://api.test/v400/en/demo/franchises/2')
    expect(options.headers.Authorization).toBe('Bearer test-token')
    expect(JSON.parse(options.body)).toEqual({ enabled: true })
    expect(ui.brandListState.brands.find(b => b.id === 2).enabled).toBe(true)
    expect(mocks.showToast.mock.calls).toEqual([['info', 'Loading'], ['success', 'Brand updated']])
    expect(mocks.hideToast).not.toHaveBeenCalled()
  })

  it('returns { ok: false, error: result } on an API error: no success toast and no formState.result written', async () => {
    routes['POST https://api.test/v400/en/demo/franchises/2'] = json({ error: true, result: ['API_ERROR'] })
    await draw()
    let result
    await act(async () => { result = await ui.handleChangeState(2, 'enabled', true) })
    expect(result).toEqual({ ok: false, error: ['API_ERROR'] })
    expect(ui.brandListState.brands.find(b => b.id === 2).enabled).toBe(false)
    expect(ui.brandFormState.result).toEqual({ error: null })
    expect(ui.brandFormState.loading).toBe(false)
    expect(mocks.showToast.mock.calls.map(([type]) => type)).toEqual(['info'])
    // redesign bugs F row 19: the switch says the failure, so the «Loading» toast is hidden
    expect(mocks.hideToast).toHaveBeenCalledTimes(1)
  })

  it('returns { ok: false, error: [message] } when the request throws', async () => {
    routes['POST https://api.test/v400/en/demo/franchises/2'] = () => { throw new Error('Network down') }
    await draw()
    let result
    await act(async () => { result = await ui.handleChangeState(2, 'enabled', true) })
    expect(result).toEqual({ ok: false, error: ['Network down'] })
    expect(ui.brandFormState.result).toEqual({ error: null })
    expect(mocks.hideToast).toHaveBeenCalledTimes(1)
  })

  it('keeps both saves when two switches of different brands save at the same time', async () => {
    const pending = {}
    const later = (id, enabled) => new Promise(resolve => { pending[id] = () => resolve(json({ error: false, result: { ...BRANDS.find(b => b.id === id), enabled } })) })
    routes['POST https://api.test/v400/en/demo/franchises/1'] = () => later(1, false)
    routes['POST https://api.test/v400/en/demo/franchises/2'] = () => later(2, true)
    await draw()
    let first
    let second
    await act(async () => {
      first = ui.handleChangeState(1, 'enabled', false)
      second = ui.handleChangeState(2, 'enabled', true)
    })
    expect(ui.brandFormState.loading).toBe(true)
    await act(async () => {
      pending[2]()
      await second
      pending[1]()
      await first
    })
    expect(ui.brandListState.brands.map(b => [b.id, b.enabled])).toEqual([[1, false], [2, true]])
    expect(ui.brandFormState.loading).toBe(false)
  })
})

describe('BusinessBrandListing controller · handleDeleteBrand', () => {
  it('removes the row, lowers totalItems by one, closes the detail and toasts Loading then Brand deleted', async () => {
    routes['DELETE https://api.test/v400/en/demo/franchises/2'] = json({ error: false, result: true })
    await draw()
    act(() => ui.setOpenDetail(true))
    expect(ui.openDetail).toBe(true)
    let result
    await act(async () => { result = await ui.handleDeleteBrand(2) })
    expect(result).toEqual({ ok: true })
    expect(ui.brandListState.brands.map(b => b.id)).toEqual([1])
    expect(ui.paginationProps.totalItems).toBe(1)
    expect(ui.openDetail).toBe(false)
    expect(mocks.showToast.mock.calls).toEqual([['info', 'Loading'], ['success', 'Brand deleted']])
    expect(mocks.hideToast).not.toHaveBeenCalled()
  })

  it('returns { ok: false, error: result } and leaves the list, the total and the detail as they were', async () => {
    routes['DELETE https://api.test/v400/en/demo/franchises/2'] = json({ error: true, result: ['CANNOT_DELETE'] })
    await draw()
    act(() => ui.setOpenDetail(true))
    let result
    await act(async () => { result = await ui.handleDeleteBrand(2) })
    expect(result).toEqual({ ok: false, error: ['CANNOT_DELETE'] })
    expect(ui.brandListState.brands.map(b => b.id)).toEqual([1, 2])
    expect(ui.paginationProps.totalItems).toBe(2)
    expect(ui.openDetail).toBe(true)
    expect(ui.brandFormState.result).toEqual({ error: null })
    // the delete error dialog says the failure, so the «Loading» toast is hidden
    expect(mocks.hideToast).toHaveBeenCalledTimes(1)
  })

  it('returns { ok: false, error: [message] } when the request throws', async () => {
    routes['DELETE https://api.test/v400/en/demo/franchises/2'] = () => { throw new Error('Network down') }
    await draw()
    let result
    await act(async () => { result = await ui.handleDeleteBrand(2) })
    expect(result).toEqual({ ok: false, error: ['Network down'] })
    expect(ui.brandListState.brands).toHaveLength(2)
    expect(mocks.hideToast).toHaveBeenCalledTimes(1)
  })
})

describe('BusinessBrandListing controller · getBrand', () => {
  it('reads one brand with a GET and the token, and returns { ok: true, brand }', async () => {
    routes['GET https://api.test/v400/en/demo/franchises/9'] = json({ error: false, result: { id: 9, name: 'Far away' } })
    await draw()
    let result
    await act(async () => { result = await ui.getBrand(9) })
    expect(result).toEqual({ ok: true, brand: { id: 9, name: 'Far away' } })
    const [url, options] = fetchMock.mock.calls.find(([u]) => u.endsWith('/franchises/9'))
    expect(url).toBe('https://api.test/v400/en/demo/franchises/9')
    expect(options.method).toBe('GET')
    expect(options.headers.Authorization).toBe('Bearer test-token')
    expect(options.body).toBeUndefined()
  })

  it('returns { ok: false, error } when the brand does not exist or the request throws', async () => {
    routes['GET https://api.test/v400/en/demo/franchises/404'] = json({ error: true, result: ['NOT_FOUND'] })
    routes['GET https://api.test/v400/en/demo/franchises/500'] = () => { throw new Error('Network down') }
    await draw()
    let missing
    let thrown
    await act(async () => {
      missing = await ui.getBrand(404)
      thrown = await ui.getBrand(500)
    })
    expect(missing).toEqual({ ok: false, error: ['NOT_FOUND'] })
    expect(thrown).toEqual({ ok: false, error: ['Network down'] })
    expect(ui.brandListState.brands).toEqual(BRANDS)
  })
})
