/* eslint-disable import/first */
// redesign DG-B1 (M-DG10): the DriversGroupsList controller tells its UI how a save/delete went (`{ ok: true }` or
// `{ ok: false, error }`) and exposes `reloadDriversGroups()` (the same request the page change makes) for the
// "Retry" of the empty/error state. Everything else stays as it was: the toasts, `actionState`, the three mount requests,
// and the store editor (`isFromStore` + `business.drivergroups`) that mounts the list.
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  showToast: vi.fn()
}))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', user: { level: 0, id: 1 } }]
}))
vi.mock('../../../contexts/ApiContext', () => {
  const chain = () => {
    const c = {
      where: () => c,
      select: () => c,
      asDashboard: () => c,
      get: async () => ({ content: { error: false, result: [] } })
    }
    return c
  }
  const ordering = {
    root: 'https://api.test',
    setAccessToken: () => ({ users: chain, businesses: chain })
  }
  return { useApi: () => [ordering] }
})
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))

import { DriversGroupsList } from '../index'

const PAGINATION = { current_page: 1, total_pages: 1, total: 2, page_size: 10, from: 1, to: 2 }
const groups = () => ([
  { id: 1, name: 'Group A', enabled: true },
  { id: 2, name: 'Group B', enabled: true }
])
const json = (body) => Promise.resolve({ json: () => Promise.resolve(body) })

let ui
const draw = (props = {}) => {
  ui = null
  const UI = (p) => {
    ui = p
    return null
  }
  return render(<DriversGroupsList UIComponent={UI} paginationSettings={{ controlType: 'pages', initialPage: 1, pageSize: 10 }} {...props} />)
}
const urls = (method = 'GET') => mocks.fetch.mock.calls
  .filter(([, options]) => options?.method === method)
  .map(([url]) => url)

beforeEach(() => {
  mocks.fetch.mockReset()
  mocks.showToast.mockReset()
  mocks.fetch.mockImplementation((url, options) => {
    if (url.includes('/drivergroups?')) return json({ error: false, result: groups(), pagination: PAGINATION })
    if (options?.method === 'PUT') return json({ error: false, result: { id: 1, name: 'Group A', enabled: false } })
    if (options?.method === 'DELETE') return json({ error: false, result: {} })
    return json({ error: false, result: [] })
  })
  globalThis.fetch = mocks.fetch
})

describe('DriversGroupsList controller · handleUpdateDriversGroup returns how the save went', () => {
  it('returns { ok: true } and keeps the toasts and actionState when the PUT works', async () => {
    draw()
    await waitFor(() => expect(ui.driversGroupsState.groups).toHaveLength(2))
    let result
    await act(async () => { result = await ui.handleUpdateDriversGroup(1, { enabled: false }) })
    expect(result).toEqual({ ok: true })
    expect(mocks.fetch).toHaveBeenCalledWith('https://api.test/drivergroups/1', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ enabled: false }) }))
    expect(ui.actionState).toEqual({ error: null, loading: false })
    expect(ui.driversGroupsState.groups.find(g => g.id === 1).enabled).toBe(false)
    expect(mocks.showToast.mock.calls.map(([type]) => type)).toEqual(['info', 'success'])
  })

  it('returns { ok: false, error: content.result } when the API refuses', async () => {
    draw()
    await waitFor(() => expect(ui.driversGroupsState.groups).toHaveLength(2))
    mocks.fetch.mockImplementation((url, options) => options?.method === 'PUT'
      ? json({ error: true, result: ['Name is required'] })
      : json({ error: false, result: groups(), pagination: PAGINATION }))
    let result
    await act(async () => { result = await ui.handleUpdateDriversGroup(1, { enabled: false }) })
    expect(result).toEqual({ ok: false, error: ['Name is required'] })
    expect(ui.actionState.error).toEqual(['Name is required'])
    expect(ui.driversGroupsState.groups.find(g => g.id === 1).enabled).toBe(true)
  })

  it('returns { ok: false, error: [message] } when the request throws', async () => {
    draw()
    await waitFor(() => expect(ui.driversGroupsState.groups).toHaveLength(2))
    mocks.fetch.mockImplementation((url, options) => options?.method === 'PUT'
      ? Promise.reject(new Error('offline'))
      : json({ error: false, result: groups(), pagination: PAGINATION }))
    let result
    await act(async () => { result = await ui.handleUpdateDriversGroup(1, { enabled: false }) })
    expect(result).toEqual({ ok: false, error: ['offline'] })
    expect(ui.actionState).toEqual({ loading: false, error: ['offline'] })
  })
})

describe('DriversGroupsList controller · handleDeleteDriversGroup returns how the delete went', () => {
  it('returns { ok: true } and removes the group', async () => {
    draw()
    await waitFor(() => expect(ui.driversGroupsState.groups).toHaveLength(2))
    let result
    await act(async () => { result = await ui.handleDeleteDriversGroup(2) })
    expect(result).toEqual({ ok: true })
    expect(ui.driversGroupsState.groups.map(g => g.id)).toEqual([1])
    expect(mocks.showToast.mock.calls.map(([type]) => type)).toEqual(['info', 'success'])
  })

  it('returns { ok: false, error } when the API refuses, and the group stays', async () => {
    draw()
    await waitFor(() => expect(ui.driversGroupsState.groups).toHaveLength(2))
    mocks.fetch.mockImplementation((url, options) => options?.method === 'DELETE'
      ? json({ error: true, result: ['Group has active orders'] })
      : json({ error: false, result: groups(), pagination: PAGINATION }))
    let result
    await act(async () => { result = await ui.handleDeleteDriversGroup(2) })
    expect(result).toEqual({ ok: false, error: ['Group has active orders'] })
    expect(ui.actionState.error).toEqual(['Group has active orders'])
    expect(ui.driversGroupsState.groups).toHaveLength(2)
  })

  it('returns { ok: false, error: [message] } when the request throws', async () => {
    draw()
    await waitFor(() => expect(ui.driversGroupsState.groups).toHaveLength(2))
    mocks.fetch.mockImplementation((url, options) => options?.method === 'DELETE'
      ? Promise.reject(new Error('offline'))
      : json({ error: false, result: groups(), pagination: PAGINATION }))
    let result
    await act(async () => { result = await ui.handleDeleteDriversGroup(2) })
    expect(result).toEqual({ ok: false, error: ['offline'] })
  })
})

describe('DriversGroupsList controller · reloadDriversGroups', () => {
  it('asks again for the current page with the same request as the page change', async () => {
    draw()
    await waitFor(() => expect(ui.driversGroupsState.groups).toHaveLength(2))
    expect(typeof ui.reloadDriversGroups).toBe('function')
    const before = urls().filter(url => url === 'https://api.test/drivergroups?page=1&page_size=10').length
    mocks.fetch.mockImplementation(() => json({ error: false, result: [{ id: 9, name: 'Group Z', enabled: true }], pagination: { ...PAGINATION, total: 1 } }))
    await act(async () => { await ui.reloadDriversGroups() })
    const after = urls().filter(url => url === 'https://api.test/drivergroups?page=1&page_size=10').length
    expect(after).toBe(before + 1)
    expect(ui.driversGroupsState.groups.map(g => g.id)).toEqual([9])
    expect(ui.driversGroupsState.loading).toBe(false)
  })

  it('recovers from a load error', async () => {
    mocks.fetch.mockImplementation(() => Promise.reject(new Error('offline')))
    draw()
    await waitFor(() => expect(ui.driversGroupsState.error).toEqual(['offline']))
    mocks.fetch.mockImplementation(() => json({ error: false, result: groups(), pagination: PAGINATION }))
    await act(async () => { await ui.reloadDriversGroups() })
    expect(ui.driversGroupsState.groups).toHaveLength(2)
    expect(ui.driversGroupsState.loading).toBe(false)
    expect(ui.driversGroupsState.error).toBe(null)
  })
})

describe('DriversGroupsList controller · bulk delete re-fetches the list', () => {
  const listGets = () => urls().filter(url => url.includes('/drivergroups?'))

  it('deletes every selected group and then asks again for the page once, with the current page and size', async () => {
    draw()
    await waitFor(() => expect(ui.driversGroupsState.groups).toHaveLength(2))
    await act(async () => { ui.handleAllSelectGroup() })
    const before = listGets().length
    await act(async () => { ui.handleDeleteSelectedGroups() })
    await waitFor(() => expect(urls('DELETE')).toEqual(['https://api.test/drivergroups/1', 'https://api.test/drivergroups/2']))
    await waitFor(() => expect(listGets().length).toBe(before + 1))
    expect(listGets().at(-1)).toBe('https://api.test/drivergroups?page=1&page_size=10')
    expect(ui.selectedGroupList).toEqual([])
  })

  it('does not re-fetch before the last group is gone', async () => {
    draw()
    await waitFor(() => expect(ui.driversGroupsState.groups).toHaveLength(2))
    let release
    mocks.fetch.mockImplementation((url, options) => {
      if (options?.method === 'DELETE' && url.endsWith('/2')) return new Promise(resolve => { release = () => resolve({ json: () => Promise.resolve({ error: false, result: {} }) }) })
      if (options?.method === 'DELETE') return json({ error: false, result: {} })
      return json({ error: false, result: groups(), pagination: PAGINATION })
    })
    await act(async () => { ui.handleAllSelectGroup() })
    const before = listGets().length
    await act(async () => { ui.handleDeleteSelectedGroups() })
    await waitFor(() => expect(urls('DELETE')).toHaveLength(2))
    expect(listGets().length).toBe(before)
    await act(async () => { release() })
    await waitFor(() => expect(listGets().length).toBe(before + 1))
  })
})

describe('DriversGroupsList controller · the store editor (isFromStore + business.drivergroups) is unchanged', () => {
  it('shows the groups of the business without asking the API for them, and updates them as before', async () => {
    const business = { id: 5, drivergroups: [{ id: 1, name: 'Group A', enabled: true }] }
    draw({ isFromStore: true, business })
    await waitFor(() => expect(ui.driversGroupsState.groups).toHaveLength(1))
    expect(urls().filter(url => url.includes('/drivergroups?'))).toEqual([])
    let result
    await act(async () => { result = await ui.handleUpdateDriversGroup(1, { enabled: false }) })
    expect(result).toEqual({ ok: true })
    expect(ui.driversGroupsState.groups[0].enabled).toBe(false)
    expect(typeof ui.reloadDriversGroups).toBe('function')
    expect(ui.isFromStore).toBe(true)
  })
})
