/* eslint-disable import/first */
// redesign stores 5.5a: contract of the Menu list controller. The list (GET menus + GET /sites) is the only
// thing that decides `loading` / `error`; the toggle answers with `{ ok }` and never touches them; /sites failing no
// longer drops the menus; `reloadMenus()` repeats only the list.
import React from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const ordering = {
    root: 'https://api.test',
    appId: 'app-id',
    appInternalName: 'dashboard'
  }
  ordering.setAccessToken = vi.fn(() => ordering)
  ordering.businesses = vi.fn(() => ordering)
  ordering.select = vi.fn(() => ordering)
  ordering.asDashboard = vi.fn(() => ordering)
  ordering.get = vi.fn()
  return { ordering, showToast: vi.fn(), fetch: vi.fn() }
})

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token' }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [mocks.ordering]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (key, text) => text]
}))

import { BusinessMenu } from '../index'

const BUSINESS_ID = 7
const OWN = { id: 1, name: 'Lunch', business_id: BUSINESS_ID, enabled: true, sites: [] }
const OWN_2 = { id: 2, name: 'Dinner', business_id: BUSINESS_ID, enabled: true, sites: [] }
const SHARED = { id: 3, name: 'Brand menu', business_id: 99, enabled: true, sites: [] }
const SITES = [{ id: 10, name: 'Web' }]

const reply = (content) => () => Promise.resolve({ json: async () => content })
const boom = (message) => () => Promise.reject(new Error(message))
const never = () => new Promise(() => {})

let routes
let ui
let seen
let handleSuccessBusinessMenu

const menusCalls = () => mocks.fetch.mock.calls.filter(([url]) => url.includes('/menus?params='))
const putCalls = () => mocks.fetch.mock.calls.filter(([, options]) => options.method === 'PUT')
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })

const draw = async () => {
  ui = null
  seen = []
  handleSuccessBusinessMenu = vi.fn()
  const UI = (props) => {
    ui = props
    seen.push(props.businessMenusState)
    return null
  }
  render(<BusinessMenu UIComponent={UI} business={{ id: BUSINESS_ID }} handleSuccessBusinessMenu={handleSuccessBusinessMenu} />)
  await flush()
}

beforeEach(() => {
  mocks.showToast.mockReset()
  mocks.fetch.mockReset()
  mocks.ordering.get.mockReset()
  mocks.ordering.businesses.mockClear()
  mocks.ordering.get.mockResolvedValue({ content: { error: false, result: { id: BUSINESS_ID, categories: [] } } })
  routes = {
    menus: reply({ error: false, result: [OWN, OWN_2, SHARED] }),
    sites: reply({ error: false, result: SITES }),
    put: reply({ error: false, result: { id: OWN.id, enabled: false } })
  }
  mocks.fetch.mockImplementation((url, options) => {
    if (url.endsWith('/sites')) return routes.sites()
    if (url.includes('/menus?params=')) return routes.menus()
    if (options.method === 'PUT') return routes.put()
    throw new Error(`unexpected request ${options.method} ${url}`)
  })
  vi.stubGlobal('fetch', mocks.fetch)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BusinessMenu controller · list', () => {
  it('starts loading, with no error and no menus', async () => {
    routes.menus = never
    await draw()
    expect(seen[0]).toEqual({ menus: [], menusShared: [], loading: true, error: null })
    expect(ui.businessMenusState.loading).toBe(true)
  })

  it('splits own and shared menus, ends loading and keeps passing the business to handleSuccessBusinessMenu', async () => {
    await draw()
    expect(ui.businessMenusState).toEqual({ menus: [OWN, OWN_2], menusShared: [SHARED], loading: false, error: null })
    expect(ui.sitesState).toEqual({ sites: SITES, loading: false, error: null })
    expect(handleSuccessBusinessMenu).toHaveBeenCalledWith({ id: BUSINESS_ID, categories: [] })
  })

  it('does not let the business request decide the list loading or error', async () => {
    routes.menus = never
    mocks.ordering.get.mockResolvedValue({ content: { error: true, result: ['BUSINESS_FAILED'] } })
    await draw()
    expect(ui.businessMenusState).toEqual({ menus: [], menusShared: [], loading: true, error: null })
    expect(handleSuccessBusinessMenu).toHaveBeenCalledWith(null)

    mocks.ordering.get.mockRejectedValue(new Error('business down'))
    await draw()
    expect(ui.businessMenusState).toEqual({ menus: [], menusShared: [], loading: true, error: null })
  })

  it('a menus API error ends loading with the API error', async () => {
    routes.menus = reply({ error: true, result: ['API_ERROR_MENUS'] })
    await draw()
    expect(ui.businessMenusState).toEqual({ menus: [], menusShared: [], loading: false, error: ['API_ERROR_MENUS'] })
    expect(ui.sitesState.loading).toBe(false)
  })

  it('a menus network failure ends loading with the error message', async () => {
    routes.menus = boom('Network down')
    await draw()
    expect(ui.businessMenusState).toEqual({ menus: [], menusShared: [], loading: false, error: ['Network down'] })
    expect(ui.sitesState.loading).toBe(false)
  })

  it('still paints the menus when /sites throws', async () => {
    routes.sites = boom('sites down')
    await draw()
    expect(ui.businessMenusState).toEqual({ menus: [OWN, OWN_2], menusShared: [SHARED], loading: false, error: null })
    expect(ui.sitesState).toEqual({ sites: [], loading: false, error: 'sites down' })
  })

  it('still paints the menus when /sites answers an error', async () => {
    routes.sites = reply({ error: true, result: 'SITES_FAILED' })
    await draw()
    expect(ui.businessMenusState).toEqual({ menus: [OWN, OWN_2], menusShared: [SHARED], loading: false, error: null })
    expect(ui.sitesState).toEqual({ sites: [], loading: false, error: 'SITES_FAILED' })
  })

  it('reloadMenus() flips to loading with no error and repeats only the list request', async () => {
    routes.menus = reply({ error: true, result: ['API_ERROR_MENUS'] })
    await draw()
    expect(ui.businessMenusState.error).toEqual(['API_ERROR_MENUS'])
    expect(menusCalls()).toHaveLength(1)

    routes.menus = never
    await act(async () => { ui.reloadMenus() })
    expect(ui.businessMenusState.loading).toBe(true)
    expect(ui.businessMenusState.error).toBeNull()
    expect(menusCalls()).toHaveLength(2)
    expect(mocks.ordering.businesses).toHaveBeenCalledTimes(1)
    expect(mocks.ordering.get).toHaveBeenCalledTimes(1)
    expect(handleSuccessBusinessMenu).toHaveBeenCalledTimes(1)
  })

  it('reloadMenus() recovers the list when the retry works', async () => {
    routes.menus = boom('Network down')
    await draw()
    routes.menus = reply({ error: false, result: [OWN, SHARED] })
    await act(async () => { ui.reloadMenus() })
    await flush()
    expect(ui.businessMenusState).toEqual({ menus: [OWN], menusShared: [SHARED], loading: false, error: null })
  })
})

describe('BusinessMenu controller · handleChangeBusinessMenuActiveState', () => {
  it('own menu: resolves { ok: true }, updates the row immutably and never raises loading or the Loading toast', async () => {
    await draw()
    const before = ui.businessMenusState
    const originalRow = before.menus[0]
    seen = []
    let result
    await act(async () => { result = await ui.handleChangeBusinessMenuActiveState(OWN.id, false) })

    expect(result).toEqual({ ok: true })
    const [url, options] = putCalls()[0]
    expect(url).toBe(`https://api.test/business/${BUSINESS_ID}/menus/${OWN.id}`)
    expect(options.headers.Authorization).toBe('Bearer test-token')
    expect(JSON.parse(options.body)).toEqual({ enabled: false })

    expect(ui.businessMenusState.menus[0]).toEqual({ ...OWN, enabled: false })
    expect(ui.businessMenusState.menus[1]).toBe(before.menus[1])
    expect(ui.businessMenusState.menusShared).toBe(before.menusShared)
    expect(originalRow.enabled).toBe(true)
    expect(ui.businessMenusState.menus[0]).not.toBe(originalRow)
    expect(seen.every(state => state.loading === false && state.error === null)).toBe(true)

    expect(mocks.showToast).toHaveBeenCalledTimes(1)
    expect(mocks.showToast).toHaveBeenCalledWith('success', 'Products catalog saved')
  })

  it('shared menu: uses menus_shared, updates menusShared and keeps the row id', async () => {
    await draw()
    await act(async () => { ui.setIsSelectedSharedMenus(true) })
    routes.put = reply({ error: false, result: { id: 555, enabled: false } })
    let result
    await act(async () => { result = await ui.handleChangeBusinessMenuActiveState(SHARED.id, false) })

    expect(result).toEqual({ ok: true })
    expect(putCalls()[0][0]).toBe(`https://api.test/business/${BUSINESS_ID}/menus_shared/${SHARED.id}`)
    expect(ui.businessMenusState.menusShared).toEqual([{ ...SHARED, enabled: false, id: SHARED.id }])
    expect(ui.businessMenusState.menus).toEqual([OWN, OWN_2])
    expect(ui.businessMenusState.loading).toBe(false)
  })

  it('API error: resolves { ok: false, error }, leaves the list and its error alone', async () => {
    await draw()
    const before = ui.businessMenusState
    routes.put = reply({ error: true, result: ['x'] })
    seen = []
    let result
    await act(async () => { result = await ui.handleChangeBusinessMenuActiveState(OWN.id, false) })

    expect(result).toEqual({ ok: false, error: ['x'] })
    expect(ui.businessMenusState).toEqual(before)
    expect(ui.businessMenusState.error).toBeNull()
    expect(seen.every(state => state.loading === false && state.error === null)).toBe(true)
    expect(mocks.showToast).not.toHaveBeenCalled()
  })

  it('network failure: resolves { ok: false, error: message } and leaves the list alone', async () => {
    await draw()
    const before = ui.businessMenusState
    routes.put = boom('Network down')
    let result
    await act(async () => { result = await ui.handleChangeBusinessMenuActiveState(OWN.id, false) })

    expect(result).toEqual({ ok: false, error: 'Network down' })
    expect(ui.businessMenusState).toEqual(before)
  })
})

describe('BusinessMenu controller · surface', () => {
  it('no longer exposes the dead handleDeleteBusinessMenu and keeps the rest of the surface', async () => {
    await draw()
    expect(ui.handleDeleteBusinessMenu).toBeUndefined()
    expect(ui.reloadMenus).toBeTypeOf('function')
    expect(ui.handleChangeBusinessMenuActiveState).toBeTypeOf('function')
    expect(ui.setBusinessMenusState).toBeTypeOf('function')
    expect(ui.setIsSelectedSharedMenus).toBeTypeOf('function')
    expect(ui.isSelectedSharedMenus).toBe(false)
    expect(ui.propsToFetch).toBeDefined()
  })
})
