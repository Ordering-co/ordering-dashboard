/* eslint-disable import/first */
// redesign DS-B1 (M-DS2, M-DS9, M-DS11 b, decision 6): the DeliveryServices controller tells its UI how a provider
// update / plugin install went (`{ ok: true, result }` or `{ ok: false, error }`), replaces the provider in `companies`
// without touching the old object, no longer leaves `loading` stuck when the API refuses, exposes
// `reloadDeliveryServices()`, loads the stores of every group in ONE request (`groupsInfo` + `reloadGroupsInfo()`),
// and keeps the schedule change per provider (`handleScheduleState(list, companyId)` + `resetScheduleState()`).
// Everything else stays as it was: the toasts, `actionState`, the three mount requests and the old prop names.
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  showToast: vi.fn(),
  businessesGet: vi.fn(),
  user: { level: 0, id: 1 }
}))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', user: mocks.user }]
}))
vi.mock('../../../contexts/ApiContext', () => {
  const chain = () => {
    const c = {
      select: () => c,
      asDashboard: () => c,
      get: () => mocks.businessesGet()
    }
    return c
  }
  const ordering = {
    root: 'https://api.test',
    setAccessToken: () => ({ businesses: chain })
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

import { DeliveryServices } from '../index'

const companies = () => ([
  { id: 1, name: 'DoorDash', enabled: true, plugin_id: 11, driver_groups: [{ id: 101 }] },
  { id: 2, name: 'Uber Direct', enabled: false, plugin_id: 12, driver_groups: [{ id: 102 }] },
  { id: 3, name: 'Not installed', enabled: false, plugin_id: null, driver_groups: [] }
])
const groupsResult = () => ([
  { id: 101, business: [{ id: 7 }, { id: 8 }], enabled: true, stray: 'x' },
  { id: 102, business: [], enabled: false }
])
const json = (body) => Promise.resolve({ json: () => Promise.resolve(body) })
const deferred = () => {
  let resolve
  const promise = new Promise(_resolve => { resolve = _resolve })
  return { promise, resolve }
}
const GROUPS_URL = ids => `https://api.test/drivergroups?params=id,business,enabled&where=${JSON.stringify([{ attribute: 'id', value: ids }])}`

let ui
const draw = (props = {}) => {
  ui = null
  const UI = (p) => {
    ui = p
    return null
  }
  return render(<DeliveryServices UIComponent={UI} paginationSettings={{ controlType: 'pages', initialPage: 1, pageSize: 10 }} {...props} />)
}
const urls = (method = 'GET') => mocks.fetch.mock.calls
  .filter(([, options]) => options?.method === method)
  .map(([url]) => url)
const groupsRequests = () => urls().filter(url => url.includes('/drivergroups?'))

let companiesBody
let groupsBody
beforeEach(() => {
  mocks.fetch.mockReset()
  mocks.showToast.mockReset()
  mocks.businessesGet.mockReset()
  mocks.user = { level: 0, id: 1 }
  companiesBody = () => ({ error: false, result: companies() })
  groupsBody = () => ({ error: false, result: groupsResult() })
  mocks.businessesGet.mockResolvedValue({ content: { error: false, result: [{ id: 5, name: 'Store' }] } })
  mocks.fetch.mockImplementation((url, options) => {
    const method = options?.method
    if (method === 'GET' && url.includes('/driver_companies?')) return json(companiesBody())
    if (method === 'GET' && url.includes('/drivergroups?')) return json(groupsBody())
    if (method === 'GET' && url.includes('/paymethods?')) return json({ error: false, result: [{ id: 1, name: 'Cash', gateway: 'cash' }] })
    if (method === 'POST' && url.endsWith('/plugins')) return json({ error: false, result: { id: 99 } })
    if (method === 'POST' && url.includes('/driver_companies/')) return json({ error: false, result: { id: 1, enabled: false, name: 'DoorDash' } })
    return json({ error: false, result: [] })
  })
  globalThis.fetch = mocks.fetch
})

const drawLoaded = async () => {
  const view = draw()
  await waitFor(() => expect(ui.deliveryServicesState.companies).toHaveLength(3))
  await waitFor(() => expect(ui.groupsInfo.loading).toBe(false))
  return view
}

describe('DeliveryServices controller · handleUpdateDeliveryService returns how the save went (M-DS2)', () => {
  it('returns { ok: true, result }, keeps the toasts and actionState, and swaps the provider in `companies`', async () => {
    await drawLoaded()
    const before = ui.deliveryServicesState.companies
    const oldFirst = before[0]
    const oldSnapshot = { ...oldFirst }
    let result
    await act(async () => { result = await ui.handleUpdateDeliveryService(1, { enabled: false }) })
    expect(result).toEqual({ ok: true, result: { id: 1, enabled: false, name: 'DoorDash' } })
    expect(mocks.fetch).toHaveBeenCalledWith('https://api.test/driver_companies/1', expect.objectContaining({ method: 'POST', body: JSON.stringify({ enabled: false }) }))
    expect(ui.actionState).toEqual({ error: null, loading: false })
    expect(mocks.showToast.mock.calls.map(([type]) => type)).toEqual(['info', 'success'])
    const after = ui.deliveryServicesState.companies
    expect(after).not.toBe(before)
    expect(after.map(c => c.id)).toEqual([1, 2, 3])
    expect(after[0].enabled).toBe(false)
    expect(after[0].plugin_id).toBe(11)
    expect(after[1]).toBe(before[1])
    expect(after[2]).toBe(before[2])
    // the previous object was not mutated and the state has no `groups` key
    expect(oldFirst).toEqual(oldSnapshot)
    expect(oldFirst.enabled).toBe(true)
    expect(ui.deliveryServicesState).not.toHaveProperty('groups')
  })

  // redesign (live check a1): the synthetic API answered another id and the row took it; the row keeps its id
  it('keeps the provider\'s own id even if the answer carries another one', async () => {
    await drawLoaded()
    mocks.fetch.mockImplementation((url, options) => options?.method === 'POST'
      ? json({ error: false, result: { id: 990001, enabled: false } })
      : json({ error: false, result: [] }))
    await act(async () => { await ui.handleUpdateDeliveryService(1, { enabled: false }) })
    const after = ui.deliveryServicesState.companies
    expect(after.map(c => c.id)).toEqual([1, 2, 3])
    expect(after[0].enabled).toBe(false)
  })

  it('returns { ok: false, error: content.result } when the API refuses, and the provider stays', async () => {
    await drawLoaded()
    const before = ui.deliveryServicesState.companies
    mocks.fetch.mockImplementation((url, options) => options?.method === 'POST'
      ? json({ error: true, result: ['Not allowed'] })
      : json({ error: false, result: [] }))
    let result
    await act(async () => { result = await ui.handleUpdateDeliveryService(1, { enabled: false }) })
    expect(result).toEqual({ ok: false, error: ['Not allowed'] })
    expect(ui.actionState.error).toEqual(['Not allowed'])
    expect(ui.actionState.loading).toBe(false)
    expect(ui.deliveryServicesState.companies).toBe(before)
  })

  it('returns { ok: false, error: [message] } when the request throws', async () => {
    await drawLoaded()
    mocks.fetch.mockImplementation((url, options) => options?.method === 'POST'
      ? Promise.reject(new Error('offline'))
      : json({ error: false, result: [] }))
    let result
    await act(async () => { result = await ui.handleUpdateDeliveryService(1, { enabled: false }) })
    expect(result).toEqual({ ok: false, error: ['offline'] })
    expect(ui.actionState).toEqual({ loading: false, error: ['offline'] })
  })
})

describe('DeliveryServices controller · the schedule change belongs to one provider (M-DS11 b)', () => {
  const week = [{ enabled: true, lapses: [{ open: { hour: 9, minute: 0 }, close: { hour: 17, minute: 0 } }] }]

  it('handleScheduleState(list, companyId) keeps both, and resetScheduleState() clears them', async () => {
    await drawLoaded()
    expect(ui.scheduleState).toMatchObject({ loading: false, change: null, companyId: null })
    act(() => { ui.handleScheduleState(week, 1) })
    expect(ui.scheduleState).toMatchObject({ change: week, companyId: 1 })
    act(() => { ui.handleScheduleState(week, 2) })
    expect(ui.scheduleState).toMatchObject({ change: week, companyId: 2 })
    expect(typeof ui.resetScheduleState).toBe('function')
    act(() => { ui.resetScheduleState() })
    expect(ui.scheduleState).toMatchObject({ change: null, companyId: null })
  })

  it('an empty list is ignored, as today', async () => {
    await drawLoaded()
    act(() => { ui.handleScheduleState(week, 1) })
    act(() => { ui.handleScheduleState([], 1) })
    expect(ui.scheduleState).toMatchObject({ change: week, companyId: 1 })
  })

  it('scheduleState.loading is true while the schedule saves and, on success, the change goes back to null', async () => {
    await drawLoaded()
    act(() => { ui.handleScheduleState(week, 1) })
    const pending = deferred()
    mocks.fetch.mockImplementation((url, options) => options?.method === 'POST'
      ? pending.promise.then(() => ({ json: () => Promise.resolve({ error: false, result: { id: 1, schedule: week } }) }))
      : json({ error: false, result: [] }))
    let promise
    act(() => { promise = ui.handleUpdateDeliveryService(1, { schedule: JSON.stringify(week) }) })
    await waitFor(() => expect(ui.scheduleState.loading).toBe(true))
    await act(async () => { pending.resolve(); await promise })
    expect(ui.scheduleState).toMatchObject({ loading: false, change: null, companyId: null })
    expect(ui.deliveryServicesState.companies[0].schedule).toEqual(week)
  })

  it('when the schedule save fails, loading ends and the change is kept so it can be retried', async () => {
    await drawLoaded()
    act(() => { ui.handleScheduleState(week, 1) })
    mocks.fetch.mockImplementation((url, options) => options?.method === 'POST'
      ? json({ error: true, result: ['Invalid schedule'] })
      : json({ error: false, result: [] }))
    let result
    await act(async () => { result = await ui.handleUpdateDeliveryService(1, { schedule: JSON.stringify(week) }) })
    expect(result).toEqual({ ok: false, error: ['Invalid schedule'] })
    expect(ui.scheduleState).toMatchObject({ loading: false, change: week, companyId: 1 })
  })

  it('a save without `schedule` does not touch the schedule state', async () => {
    await drawLoaded()
    act(() => { ui.handleScheduleState(week, 2) })
    await act(async () => { await ui.handleUpdateDeliveryService(1, { enabled: false }) })
    expect(ui.scheduleState).toMatchObject({ loading: false, change: week, companyId: 2 })
  })
})

describe('DeliveryServices controller · a refused or failed load no longer leaves `loading` on (M-DS9)', () => {
  it('providers: content.error -> loading false and error = content.result', async () => {
    companiesBody = () => ({ error: true, result: ['Forbidden'] })
    draw()
    await waitFor(() => expect(ui.deliveryServicesState.error).toEqual(['Forbidden']))
    expect(ui.deliveryServicesState.loading).toBe(false)
    expect(ui.deliveryServicesState.companies).toEqual([])
  })

  it('providers: a network failure -> error [message]', async () => {
    mocks.fetch.mockImplementation((url, options) => url.includes('/driver_companies?')
      ? Promise.reject(new Error('offline'))
      : json({ error: false, result: [] }))
    draw()
    await waitFor(() => expect(ui.deliveryServicesState.error).toEqual(['offline']))
    expect(ui.deliveryServicesState.loading).toBe(false)
  })

  it('businesses: content.error -> loading false and error = content.result; a failure -> [message]', async () => {
    mocks.businessesGet.mockResolvedValue({ content: { error: true, result: ['No stores for you'] } })
    draw()
    await waitFor(() => expect(ui.businessesList.error).toEqual(['No stores for you']))
    expect(ui.businessesList.loading).toBe(false)
  })

  it('businesses: a thrown failure -> error [message]', async () => {
    mocks.businessesGet.mockRejectedValue(new Error('offline'))
    draw()
    await waitFor(() => expect(ui.businessesList.error).toEqual(['offline']))
    expect(ui.businessesList.loading).toBe(false)
  })

  it('paymethods: content.error -> loading false and error = content.result; a failure -> [message]', async () => {
    mocks.fetch.mockImplementation((url, options) => {
      if (url.includes('/paymethods?')) return json({ error: true, result: ['No methods'] })
      if (url.includes('/driver_companies?')) return json(companiesBody())
      return json({ error: false, result: [] })
    })
    draw()
    await waitFor(() => expect(ui.paymethodsList.error).toEqual(['No methods']))
    expect(ui.paymethodsList.loading).toBe(false)
  })

  it('paymethods: a thrown failure -> error [message]', async () => {
    mocks.fetch.mockImplementation((url, options) => {
      if (url.includes('/paymethods?')) return Promise.reject(new Error('offline'))
      if (url.includes('/driver_companies?')) return json(companiesBody())
      return json({ error: false, result: [] })
    })
    draw()
    await waitFor(() => expect(ui.paymethodsList.error).toEqual(['offline']))
    expect(ui.paymethodsList.loading).toBe(false)
  })

  it('reloadDeliveryServices() asks again for the providers and recovers from the error', async () => {
    companiesBody = () => ({ error: true, result: ['Forbidden'] })
    draw()
    await waitFor(() => expect(ui.deliveryServicesState.error).toEqual(['Forbidden']))
    expect(typeof ui.reloadDeliveryServices).toBe('function')
    const before = urls().filter(url => url.includes('/driver_companies?')).length
    companiesBody = () => ({ error: false, result: companies() })
    await act(async () => { await ui.reloadDeliveryServices() })
    expect(urls().filter(url => url.includes('/driver_companies?')).length).toBe(before + 1)
    expect(ui.deliveryServicesState.companies).toHaveLength(3)
    expect(ui.deliveryServicesState.loading).toBe(false)
    expect(ui.deliveryServicesState.error).toBe(null)
  })
})

describe('DeliveryServices controller · the stores of every group, in ONE request (decision 6)', () => {
  it('after loading the providers asks once for the groups of the providers that have one', async () => {
    await drawLoaded()
    expect(groupsRequests()).toEqual([GROUPS_URL([101, 102])])
    expect(ui.groupsInfo).toEqual({
      loading: false,
      error: null,
      groups: {
        101: { id: 101, business: [{ id: 7 }, { id: 8 }], enabled: true },
        102: { id: 102, business: [], enabled: false }
      }
    })
  })

  it('groupsInfo is loading from the moment the providers arrive until the groups arrive', async () => {
    const pending = deferred()
    mocks.fetch.mockImplementation((url, options) => {
      if (url.includes('/drivergroups?')) return pending.promise.then(() => ({ json: () => Promise.resolve(groupsBody()) }))
      if (url.includes('/driver_companies?')) return json(companiesBody())
      return json({ error: false, result: [] })
    })
    draw()
    await waitFor(() => expect(ui.deliveryServicesState.companies).toHaveLength(3))
    expect(ui.groupsInfo.loading).toBe(true)
    await act(async () => { pending.resolve() })
    await waitFor(() => expect(ui.groupsInfo.loading).toBe(false))
    expect(Object.keys(ui.groupsInfo.groups)).toEqual(['101', '102'])
  })

  it('with no group ids, no request is made', async () => {
    companiesBody = () => ({ error: false, result: [{ id: 3, name: 'Not installed', enabled: false, plugin_id: null, driver_groups: [] }, { id: 4, name: 'No key' }] })
    draw()
    await waitFor(() => expect(ui.deliveryServicesState.companies).toHaveLength(2))
    expect(groupsRequests()).toEqual([])
    expect(ui.groupsInfo).toEqual({ loading: false, error: null, groups: {} })
  })

  it('content.error -> error = content.result; a network failure -> [message]; neither leaves loading on', async () => {
    groupsBody = () => ({ error: true, result: ['No groups for you'] })
    draw()
    await waitFor(() => expect(ui.groupsInfo.error).toEqual(['No groups for you']))
    expect(ui.groupsInfo.loading).toBe(false)
    expect(ui.groupsInfo.groups).toEqual({})
    mocks.fetch.mockImplementation((url, options) => url.includes('/drivergroups?')
      ? Promise.reject(new Error('offline'))
      : json({ error: false, result: [] }))
    await act(async () => { await ui.reloadGroupsInfo() })
    expect(ui.groupsInfo.error).toEqual(['offline'])
    expect(ui.groupsInfo.loading).toBe(false)
  })

  it('reloadGroupsInfo() asks again with the ids of the providers already loaded and recovers from the error', async () => {
    groupsBody = () => ({ error: true, result: ['No groups for you'] })
    draw()
    await waitFor(() => expect(ui.groupsInfo.error).toEqual(['No groups for you']))
    expect(typeof ui.reloadGroupsInfo).toBe('function')
    groupsBody = () => ({ error: false, result: groupsResult() })
    await act(async () => { await ui.reloadGroupsInfo() })
    expect(groupsRequests()).toEqual([GROUPS_URL([101, 102]), GROUPS_URL([101, 102])])
    expect(ui.groupsInfo.error).toBe(null)
    expect(Object.keys(ui.groupsInfo.groups)).toEqual(['101', '102'])
  })

  it('reloadDeliveryServices() also refreshes the stores of the groups', async () => {
    await drawLoaded()
    companiesBody = () => ({ error: false, result: [...companies(), { id: 4, name: 'New', enabled: true, plugin_id: 14, driver_groups: [{ id: 104 }] }] })
    groupsBody = () => ({ error: false, result: [...groupsResult(), { id: 104, business: [{ id: 9 }], enabled: true }] })
    await act(async () => { await ui.reloadDeliveryServices() })
    await waitFor(() => expect(groupsRequests()).toHaveLength(2))
    expect(groupsRequests()[1]).toBe(GROUPS_URL([101, 102, 104]))
    await waitFor(() => expect(ui.groupsInfo.groups[104]).toEqual({ id: 104, business: [{ id: 9 }], enabled: true }))
  })
})

describe('DeliveryServices controller · handleInstallSysPlugin returns how the install went', () => {
  it('returns { ok: true, result } and still calls the callback', async () => {
    await drawLoaded()
    const callback = vi.fn()
    let result
    await act(async () => { result = await ui.handleInstallSysPlugin('https://plugins.test/doordash.zip', callback) })
    expect(result).toEqual({ ok: true, result: { id: 99 } })
    expect(callback).toHaveBeenCalledWith({ error: false, result: { id: 99 } })
    expect(mocks.fetch).toHaveBeenCalledWith('https://api.test/plugins', expect.objectContaining({ method: 'POST', body: JSON.stringify({ url: 'https://plugins.test/doordash.zip' }) }))
    expect(mocks.showToast.mock.calls.map(([type]) => type)).toEqual(['info', 'success'])
  })

  it('works without a callback', async () => {
    await drawLoaded()
    let result
    await act(async () => { result = await ui.handleInstallSysPlugin('https://plugins.test/doordash.zip') })
    expect(result.ok).toBe(true)
  })

  it('returns { ok: false, error } when the API refuses, and does not call the callback', async () => {
    await drawLoaded()
    mocks.fetch.mockImplementation((url, options) => options?.method === 'POST'
      ? json({ error: true, result: ['Plugin not valid'] })
      : json({ error: false, result: [] }))
    const callback = vi.fn()
    let result
    await act(async () => { result = await ui.handleInstallSysPlugin('https://plugins.test/doordash.zip', callback) })
    expect(result).toEqual({ ok: false, error: ['Plugin not valid'] })
    expect(callback).not.toHaveBeenCalled()
    expect(ui.actionState.error).toEqual(['Plugin not valid'])
  })

  it('returns { ok: false, error: [message] } when the request throws', async () => {
    await drawLoaded()
    mocks.fetch.mockImplementation((url, options) => options?.method === 'POST'
      ? Promise.reject(new Error('offline'))
      : json({ error: false, result: [] }))
    let result
    await act(async () => { result = await ui.handleInstallSysPlugin('https://plugins.test/doordash.zip') })
    expect(result).toEqual({ ok: false, error: ['offline'] })
  })

  it('without plugin_root it does not call the API and returns { ok: false, error: [...] }', async () => {
    await drawLoaded()
    const callback = vi.fn()
    for (const empty of [undefined, null, '']) {
      let result
      await act(async () => { result = await ui.handleInstallSysPlugin(empty, callback) })
      expect(result.ok).toBe(false)
      expect(Array.isArray(result.error)).toBe(true)
      expect(result.error.length).toBeGreaterThan(0)
    }
    expect(urls('POST').filter(url => url.endsWith('/plugins'))).toEqual([])
    expect(callback).not.toHaveBeenCalled()
  })
})

describe('DeliveryServices controller · what stays as it was', () => {
  it('asks for the providers, the stores and the paymethods once on mount, and keeps the props the page reads', async () => {
    draw()
    await waitFor(() => expect(ui.deliveryServicesState.companies).toHaveLength(3))
    await waitFor(() => expect(ui.paymethodsList.paymethods).toHaveLength(1))
    await waitFor(() => expect(ui.businessesList.businesses).toHaveLength(1))
    expect(urls().filter(url => url.includes('/driver_companies?'))).toHaveLength(1)
    expect(urls().filter(url => url.includes('/paymethods?'))).toHaveLength(1)
    expect(mocks.businessesGet).toHaveBeenCalledTimes(1)
    expect(ui.businessesList.businesses).toHaveLength(1)
    expect(ui.paymethodsList.paymethods).toHaveLength(1)
    for (const name of ['getDeliveryGroups', 'setDeliveryGroups', 'setDeliveryServicesState']) {
      expect(typeof ui[name]).toBe('function')
    }
    // what only the old list read (delete, list-level group update, multi-select, pagination and search) is gone
    for (const name of ['handleDeleteDeliveryService', 'handleUpdateDeliveryGroup', 'handleSelectGroup', 'handleAllSelectGroup', 'selectedGroupList', 'setPaginationProps', 'onSearch', 'searchValue', 'pagination']) {
      expect(ui).not.toHaveProperty(name)
    }
    expect(ui.deliveryGroups).toEqual({ groups: [], loading: false, error: null })
    expect(ui.actionDisabled).toBe(false)
    expect(ui.deliveryServicesState).toMatchObject({ loading: false, error: null })
  })

  it('level 5 keeps actionDisabled when none of the providers is theirs', async () => {
    mocks.user = { level: 5, id: 77 }
    draw()
    await waitFor(() => expect(ui.deliveryServicesState.companies).toHaveLength(3))
    expect(ui.actionDisabled).toBe(true)
  })

  it('getDeliveryGroups still returns the group and fills deliveryGroups', async () => {
    draw()
    await waitFor(() => expect(ui.deliveryServicesState.companies).toHaveLength(3))
    mocks.fetch.mockImplementation(() => json({ error: false, result: { id: 101, enabled: true } }))
    let group
    await act(async () => { group = await ui.getDeliveryGroups(101) })
    expect(group).toEqual({ id: 101, enabled: true })
    expect(ui.deliveryGroups.groups).toEqual([{ id: 101, enabled: true }])
  })
})
