/* eslint-disable import/first */
// redesign DS-B1 (M-DS2, M-DS9, M-DS22): the DeliveryServiceDetails controller tells its UI how a group save went
// (`{ ok: true }` or `{ ok: false, error }`), writes the result into `deliveryGroups` (not into the providers' state),
// only drops from `changesState` the keys that were sent (a draft typed while the PUT was in flight survives), says
// why the credentials did not load (`pluginState.error`) and exposes `reloadPluginInformation()`; `availableModifyData`
// goes back to false when the provider (plugin key) changes. Everything else stays as it was.
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
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test' }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))

import { DeliveryServiceDetails } from '../index'

const DOORDASH = { id: 1, key: 'doordash' }
const UBER = { id: 2, key: 'uber_direct' }
const group = (id, plugin) => ({ id, name: `Group ${id}`, enabled: true, plugin, schedule: [], business: [], autoassign_amount_drivers: 1, orders_group_max_orders: 1 })
const json = (body) => Promise.resolve({ json: () => Promise.resolve(body) })
const deferred = () => {
  let resolve
  const promise = new Promise(_resolve => { resolve = _resolve })
  return { promise, resolve }
}
const configsOf = (pluginKey, values) => values.map((value, index) => ({ id: index + 1, key: `${pluginKey}_${index}`, value }))
const configsRequests = () => mocks.fetch.mock.calls
  .map(([url]) => url)
  .filter(url => url.includes('/configs?'))

let ui
let configsBody
const baseProps = () => {
  const dg = { groups: [group(101, DOORDASH)], loading: false, error: null }
  return {
    curDriversGroup: group(101, DOORDASH),
    driverGroupId: 101,
    deliveryServicesState: { companies: [{ id: 1, name: 'DoorDash' }], loading: false, error: null },
    deliveryGroups: dg,
    setDeliveryGroups: vi.fn(),
    businesses: [],
    paymethods: []
  }
}
const draw = (props = {}) => {
  ui = null
  const UI = (p) => {
    ui = p
    return null
  }
  const merged = { ...baseProps(), ...props }
  const view = render(<DeliveryServiceDetails UIComponent={UI} {...merged} />)
  return { ...view, props: merged, rerenderWith: (next) => view.rerender(<DeliveryServiceDetails UIComponent={UI} {...merged} {...next} />) }
}

beforeEach(() => {
  mocks.fetch.mockReset()
  mocks.showToast.mockReset()
  configsBody = () => ({ error: false, result: [...configsOf('doordash', ['a', 'b']), { id: 'virtual', key: 'doordash_x', value: '' }] })
  mocks.fetch.mockImplementation((url, options) => {
    if (options?.method === 'PUT') return json({ error: false, result: { id: 101, enabled: false } })
    if (url.includes('/configs?')) return json(configsBody())
    return json({ error: false, result: {} })
  })
  globalThis.fetch = mocks.fetch
})

describe('DeliveryServiceDetails controller · handleUpdateDeliveryGroup returns how the save went (M-DS2)', () => {
  it('returns { ok: true } and keeps the toasts and actionState when the PUT works', async () => {
    draw()
    let result
    await act(async () => { result = await ui.handleUpdateDeliveryGroup({ enabled: false }) })
    expect(result).toMatchObject({ ok: true })
    expect(mocks.fetch).toHaveBeenCalledWith('https://api.test/drivergroups/101', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ enabled: false }) }))
    expect(ui.actionState).toEqual({ error: null, loading: false })
    expect(mocks.showToast.mock.calls.map(([type]) => type)).toEqual(['info', 'success'])
  })

  it('writes the saved group into deliveryGroups (not mixed with the providers) and does not mutate the old group', async () => {
    const view = draw()
    const oldGroup = view.props.deliveryGroups.groups[0]
    const oldSnapshot = { ...oldGroup }
    await act(async () => { await ui.handleUpdateDeliveryGroup({ enabled: false }) })
    const setter = view.props.setDeliveryGroups
    expect(setter).toHaveBeenCalledTimes(1)
    const next = setter.mock.calls[0][0]
    expect(next).not.toHaveProperty('companies')
    expect(next.loading).toBe(false)
    expect(next.error).toBe(null)
    expect(next.groups).toHaveLength(1)
    expect(next.groups[0]).toMatchObject({ id: 101, enabled: false, name: 'Group 101' })
    expect(next.groups[0]).not.toBe(oldGroup)
    expect(oldGroup).toEqual(oldSnapshot)
    expect(oldGroup.enabled).toBe(true)
  })

  it('returns { ok: false, error: content.result } when the API refuses, and writes nothing', async () => {
    const view = draw()
    mocks.fetch.mockImplementation((url, options) => options?.method === 'PUT'
      ? json({ error: true, result: ['Invalid value'] })
      : json(configsBody()))
    let result
    await act(async () => { result = await ui.handleUpdateDeliveryGroup({ enabled: false }) })
    expect(result).toEqual({ ok: false, error: ['Invalid value'] })
    expect(ui.actionState.error).toEqual(['Invalid value'])
    expect(view.props.setDeliveryGroups).not.toHaveBeenCalled()
  })

  it('returns { ok: false, error: [message] } when the request throws', async () => {
    draw()
    mocks.fetch.mockImplementation((url, options) => options?.method === 'PUT'
      ? Promise.reject(new Error('offline'))
      : json(configsBody()))
    let result
    await act(async () => { result = await ui.handleUpdateDeliveryGroup({ enabled: false }) })
    expect(result).toEqual({ ok: false, error: ['offline'] })
    expect(ui.actionState).toEqual({ loading: false, error: ['offline'] })
  })

  it('still sends the skippable values as null, as before', async () => {
    draw()
    await act(async () => { await ui.handleUpdateDeliveryGroup({ business: '[]', note: '' }) })
    const [, options] = mocks.fetch.mock.calls.find(([, o]) => o?.method === 'PUT')
    expect(JSON.parse(options.body)).toEqual({ business: null, note: null })
  })
})

describe('DeliveryServiceDetails controller · changesState loses only the keys that were sent (M-DS2)', () => {
  it('after a good PUT the sent keys leave changesState and the others stay', async () => {
    draw()
    act(() => { ui.handleChangesState({ autoassign_max_orders: 3, orders_group_max_distance_between_pickup: 150, business: '[1]' }) })
    await act(async () => { await ui.handleUpdateDeliveryGroup({ autoassign_max_orders: 3 }) })
    expect(ui.changesState).toEqual({ orders_group_max_distance_between_pickup: 150, business: '[1]' })
  })

  it('a draft typed while the PUT is in flight survives the response', async () => {
    draw()
    act(() => { ui.handleChangesState({ autoassign_max_orders: 3 }) })
    const pending = deferred()
    mocks.fetch.mockImplementation((url, options) => options?.method === 'PUT'
      ? pending.promise.then(() => ({ json: () => Promise.resolve({ error: false, result: { id: 101, autoassign_max_orders: 3 } }) }))
      : json(configsBody()))
    let promise
    act(() => { promise = ui.handleUpdateDeliveryGroup({ autoassign_max_orders: 3 }) })
    act(() => { ui.handleChangesState({ orders_group_max_distance_between_pickup: 150 }) })
    await act(async () => { pending.resolve(); await promise })
    expect(ui.changesState).toEqual({ orders_group_max_distance_between_pickup: 150 })
  })

  it('after a refused PUT, changesState is kept whole', async () => {
    draw()
    act(() => { ui.handleChangesState({ autoassign_max_orders: 3, business: '[1]' }) })
    mocks.fetch.mockImplementation((url, options) => options?.method === 'PUT'
      ? json({ error: true, result: ['Invalid value'] })
      : json(configsBody()))
    await act(async () => { await ui.handleUpdateDeliveryGroup({ autoassign_max_orders: 3 }) })
    expect(ui.changesState).toEqual({ autoassign_max_orders: 3, business: '[1]' })
  })
})

describe('DeliveryServiceDetails controller · the credentials load says why they did not (M-DS9)', () => {
  it('loads the configs of the plugin and unlocks the sections when none is empty', async () => {
    configsBody = () => ({ error: false, result: configsOf('doordash', ['a', 'b']) })
    draw()
    await waitFor(() => expect(ui.pluginState.configs).toHaveLength(2))
    expect(ui.pluginState).toEqual({ configs: ui.pluginState.configs, loading: false, error: null })
    expect(ui.availableModifyData).toBe(true)
    expect(configsRequests()).toHaveLength(1)
  })

  it('keeps only the configs with a numeric id and does not unlock with an empty value (as today)', async () => {
    draw()
    await waitFor(() => expect(ui.pluginState.configs).toHaveLength(2))
    expect(ui.pluginState.configs.every(config => typeof config.id === 'number')).toBe(true)
    expect(ui.availableModifyData).toBe(false)
  })

  it('content.error -> pluginState = { configs: null, loading: false, error: content.result }', async () => {
    configsBody = () => ({ error: true, result: ['No access to configs'] })
    draw()
    await waitFor(() => expect(ui.pluginState.error).toEqual(['No access to configs']))
    expect(ui.pluginState).toEqual({ configs: null, loading: false, error: ['No access to configs'] })
    expect(ui.availableModifyData).toBe(false)
  })

  it('a network failure -> the same shape with [message]', async () => {
    mocks.fetch.mockImplementation((url) => url.includes('/configs?')
      ? Promise.reject(new Error('offline'))
      : json({ error: false, result: {} }))
    draw()
    await waitFor(() => expect(ui.pluginState.error).toEqual(['offline']))
    expect(ui.pluginState).toEqual({ configs: null, loading: false, error: ['offline'] })
  })

  it('reloadPluginInformation() asks again for the same plugin and recovers from the error', async () => {
    configsBody = () => ({ error: true, result: ['No access to configs'] })
    draw()
    await waitFor(() => expect(ui.pluginState.error).toEqual(['No access to configs']))
    expect(typeof ui.reloadPluginInformation).toBe('function')
    configsBody = () => ({ error: false, result: configsOf('doordash', ['a', 'b']) })
    await act(async () => { await ui.reloadPluginInformation() })
    expect(configsRequests()).toHaveLength(2)
    expect(configsRequests()[1]).toBe(configsRequests()[0])
    expect(configsRequests()[1]).toContain(encodeURI('%doordash%'))
    expect(ui.pluginState.error).toBe(null)
    expect(ui.pluginState.loading).toBe(false)
    expect(ui.pluginState.configs).toHaveLength(2)
    expect(ui.availableModifyData).toBe(true)
  })

  it('a provider without a plugin id asks for nothing and reloadPluginInformation() does nothing', async () => {
    draw({ curDriversGroup: group(101, undefined) })
    await act(async () => { await ui.reloadPluginInformation() })
    expect(configsRequests()).toEqual([])
  })
})

describe('DeliveryServiceDetails controller · availableModifyData goes back to false with the provider (M-DS22)', () => {
  it('switching to a provider with another plugin key locks the sections before asking for its configs', async () => {
    configsBody = () => ({ error: false, result: configsOf('doordash', ['a', 'b']) })
    const view = draw()
    await waitFor(() => expect(ui.availableModifyData).toBe(true))
    const pending = deferred()
    mocks.fetch.mockImplementation((url) => url.includes('/configs?')
      ? pending.promise.then(() => ({ json: () => Promise.resolve({ error: false, result: configsOf('uber_direct', ['x', '']) }) }))
      : json({ error: false, result: {} }))
    view.rerenderWith({ curDriversGroup: group(102, UBER), driverGroupId: 102 })
    await waitFor(() => expect(configsRequests()).toHaveLength(2))
    expect(configsRequests()[1]).toContain(encodeURI('%uber_direct%'))
    expect(ui.availableModifyData).toBe(false)
    await act(async () => { pending.resolve() })
    await waitFor(() => expect(ui.pluginState.configs).toHaveLength(2))
    expect(ui.availableModifyData).toBe(false)
  })

  it('switching to a provider without plugin also locks them', async () => {
    configsBody = () => ({ error: false, result: configsOf('doordash', ['a', 'b']) })
    const view = draw()
    await waitFor(() => expect(ui.availableModifyData).toBe(true))
    view.rerenderWith({ curDriversGroup: group(103, undefined), driverGroupId: 103 })
    await waitFor(() => expect(ui.availableModifyData).toBe(false))
  })

  it('a rerender with the same plugin key leaves them unlocked and asks for nothing again', async () => {
    configsBody = () => ({ error: false, result: configsOf('doordash', ['a', 'b']) })
    const view = draw()
    await waitFor(() => expect(ui.availableModifyData).toBe(true))
    view.rerenderWith({ curDriversGroup: { ...group(101, DOORDASH), name: 'Renamed' } })
    expect(ui.availableModifyData).toBe(true)
    expect(configsRequests()).toHaveLength(1)
  })
})

describe('DeliveryServiceDetails controller · what stays as it was', () => {
  it('starts from the group it is given and fills the selections', async () => {
    draw({ curDriversGroup: { ...group(101, DOORDASH), business: [{ id: 4 }, { id: 5 }], allowed_paymethods: [1] } })
    await waitFor(() => expect(ui.selectedBusinessIds).toEqual([4, 5]))
    expect(ui.deliveryServiceState.deliveryService.id).toBe(101)
    expect(ui.selectedPaymethodIds).toEqual([1])
    expect(ui.useAdvanced).toBe(true)
    for (const name of ['cleanChagesState', 'handleLogistic', 'handleChangesState', 'handleSelectBusiness', 'handleSelectAllBusiness', 'handleSelectPaymethod', 'handleSelectAllPaymethod', 'handleChangeMaxDistance', 'setAvailableModifyData', 'setPluginState']) {
      expect(typeof ui[name]).toBe('function')
    }
  })

  it('handleSelectBusiness writes the ids as a JSON string into changesState', async () => {
    draw()
    act(() => { ui.handleSelectBusiness(4, true) })
    expect(ui.changesState).toEqual({ business: JSON.stringify([4]) })
  })
})

// «Use advanced logistic» no longer overwrites the service's values with 1/1 when it is checked again
describe('DeliveryServiceDetails controller · advanced logistic keeps the values', () => {
  const withValues = (extra) => ({ curDriversGroup: { ...group(101, DOORDASH), ...extra } })

  it('checking it again restores the values the service had saved', () => {
    draw(withValues({ autoassign_amount_drivers: 4, orders_group_max_orders: 3 }))
    act(() => { ui.handleLogistic(false) })
    expect(ui.changesState).toMatchObject({ autoassign_amount_drivers: 0, orders_group_max_orders: 0 })
    expect(ui.useAdvanced).toBe(false)
    act(() => { ui.handleLogistic(true) })
    expect(ui.changesState).toMatchObject({ autoassign_amount_drivers: 4, orders_group_max_orders: 3 })
    expect(ui.useAdvanced).toBe(true)
  })

  it('restores the values edited in this session too', () => {
    draw(withValues({ autoassign_amount_drivers: 4, orders_group_max_orders: 3 }))
    act(() => { ui.handleChangesState({ orders_group_max_orders: 7 }) })
    act(() => { ui.handleLogistic(false) })
    act(() => { ui.handleLogistic(true) })
    expect(ui.changesState).toMatchObject({ autoassign_amount_drivers: 4, orders_group_max_orders: 7 })
  })

  it('falls back to 1/1 when the service never had values', () => {
    draw(withValues({ autoassign_amount_drivers: 0, orders_group_max_orders: 0 }))
    act(() => { ui.handleLogistic(true) })
    expect(ui.changesState).toMatchObject({ autoassign_amount_drivers: 1, orders_group_max_orders: 1 })
  })
})
