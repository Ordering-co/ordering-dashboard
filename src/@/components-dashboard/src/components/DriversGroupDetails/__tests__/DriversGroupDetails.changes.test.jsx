/* eslint-disable import/first */
// redesign DG-B1 (M-DG5): after a correct PUT the DriversGroupDetails controller drops from `changesState` only the keys
// that were sent. A "Save" that sends `changesState` empties it as before; the header switch (`{ enabled }`) no longer
// wipes the unsaved changes of the other tabs. Save and delete also return `{ ok: true }` or `{ ok: false, error }`.
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  showToast: vi.fn(),
  onClose: vi.fn(),
  setGroups: vi.fn()
}))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', user: { level: 0, id: 1 } }]
}))
vi.mock('../../../contexts/ApiContext', () => {
  const ordering = { root: 'https://api.test' }
  return { useApi: () => [ordering] }
})
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))

import { DriversGroupDetails } from '../index'

const GROUP = { id: 3, name: 'North', enabled: true, type: 0 }
const json = (body) => Promise.resolve({ json: () => Promise.resolve(body) })

let ui
const draw = (groupExtra = {}) => {
  ui = null
  // fresh objects per render tree: the controller assigns the PUT result onto the group it was given
  const group = { ...GROUP, ...groupExtra }
  const groupsState = { groups: [group], loading: false, error: null }
  const UI = (p) => {
    ui = p
    return null
  }
  return render(
    <DriversGroupDetails
      UIComponent={UI}
      curDriversGroup={group}
      driversGroupsState={groupsState}
      setDriversGroupsState={mocks.setGroups}
      driversManagers={[]}
      onClose={mocks.onClose}
    />
  )
}

beforeEach(() => {
  mocks.fetch.mockReset()
  mocks.showToast.mockReset()
  mocks.onClose.mockReset()
  mocks.setGroups.mockReset()
  mocks.fetch.mockImplementation((url, options) => {
    if (options?.method === 'PUT') return json({ error: false, result: { ...GROUP, ...JSON.parse(options.body) } })
    if (options?.method === 'DELETE') return json({ error: false, result: {} })
    return json({ error: false, result: [] })
  })
  globalThis.fetch = mocks.fetch
})

describe('DriversGroupDetails controller · changesState after a correct PUT (M-DG5)', () => {
  it('a "Save" that sends changesState empties it, as before', async () => {
    draw()
    act(() => { ui.handleChangesState({ name: 'South', priority: 2 }) })
    expect(ui.changesState).toEqual({ name: 'South', priority: 2 })
    let result
    await act(async () => { result = await ui.handleUpdateDriversGroup(ui.changesState) })
    expect(result).toEqual({ ok: true })
    expect(ui.changesState).toEqual({})
  })

  it('the header switch ({ enabled }) leaves the other unsaved changes intact', async () => {
    draw()
    act(() => { ui.handleChangesState({ name: 'South', priority: 2 }) })
    let result
    await act(async () => { result = await ui.handleUpdateDriversGroup({ enabled: false }) })
    expect(result).toEqual({ ok: true })
    expect(mocks.fetch).toHaveBeenCalledWith('https://api.test/drivergroups/3', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ enabled: false }) }))
    expect(ui.changesState).toEqual({ name: 'South', priority: 2 })
  })

  it('a pending change of the same key is dropped with the one that was sent', async () => {
    draw()
    act(() => { ui.handleChangesState({ enabled: true, name: 'South' }) })
    await act(async () => { await ui.handleUpdateDriversGroup({ enabled: false }) })
    expect(ui.changesState).toEqual({ name: 'South' })
  })

  it('keeps the changes when the API refuses', async () => {
    draw()
    act(() => { ui.handleChangesState({ name: 'South' }) })
    mocks.fetch.mockImplementation(() => json({ error: true, result: ['Name taken'] }))
    let result
    await act(async () => { result = await ui.handleUpdateDriversGroup({ name: 'South' }) })
    expect(result).toEqual({ ok: false, error: ['Name taken'] })
    expect(ui.changesState).toEqual({ name: 'South' })
    expect(ui.actionState.error).toEqual(['Name taken'])
  })
})

describe('DriversGroupDetails controller · results of save and delete', () => {
  it('save returns { ok: false, error: [message] } when the request throws', async () => {
    draw()
    mocks.fetch.mockImplementation(() => Promise.reject(new Error('offline')))
    let result
    await act(async () => { result = await ui.handleUpdateDriversGroup({ enabled: false }) })
    expect(result).toEqual({ ok: false, error: ['offline'] })
    expect(ui.actionState).toEqual({ loading: false, error: ['offline'] })
  })

  it('delete returns { ok: true }, shows the toast and closes', async () => {
    draw()
    let result
    await act(async () => { result = await ui.handleDeleteDriversGroup() })
    expect(result).toEqual({ ok: true })
    expect(mocks.onClose).toHaveBeenCalledTimes(1)
    expect(mocks.showToast.mock.calls.map(([type]) => type)).toEqual(['info', 'success'])
  })

  it('delete returns { ok: false, error } when the API refuses, and does not close', async () => {
    draw()
    mocks.fetch.mockImplementation(() => json({ error: true, result: ['Group has active orders'] }))
    let result
    await act(async () => { result = await ui.handleDeleteDriversGroup() })
    expect(result).toEqual({ ok: false, error: ['Group has active orders'] })
    expect(mocks.onClose).not.toHaveBeenCalled()
    await waitFor(() => expect(ui.actionState.error).toEqual(['Group has active orders']))
  })

  it('delete returns { ok: false, error: [message] } when the request throws', async () => {
    draw()
    mocks.fetch.mockImplementation(() => Promise.reject(new Error('offline')))
    let result
    await act(async () => { result = await ui.handleDeleteDriversGroup() })
    expect(result).toEqual({ ok: false, error: ['offline'] })
  })
})

// «Use advanced logistic» no longer overwrites the group's values with 1/1 when it is checked again
describe('DriversGroupDetails controller · advanced logistic keeps the values', () => {
  it('checking it again restores the values the group had saved', () => {
    draw({ autoassign_amount_drivers: 4, orders_group_max_orders: 3 })
    expect(ui.useAdvanced).toBe(true)
    act(() => { ui.handleLogistic(false) })
    expect(ui.changesState).toMatchObject({ autoassign_amount_drivers: 0, orders_group_max_orders: 0 })
    expect(ui.useAdvanced).toBe(false)
    act(() => { ui.handleLogistic(true) })
    expect(ui.changesState).toMatchObject({ autoassign_amount_drivers: 4, orders_group_max_orders: 3 })
    expect(ui.useAdvanced).toBe(true)
  })

  it('restores the values edited in this session too', () => {
    draw({ autoassign_amount_drivers: 4, orders_group_max_orders: 3 })
    act(() => { ui.handleChangesState({ autoassign_amount_drivers: 1000 }) })
    act(() => { ui.handleLogistic(false) })
    act(() => { ui.handleLogistic(true) })
    expect(ui.changesState).toMatchObject({ autoassign_amount_drivers: 1000, orders_group_max_orders: 3 })
  })

  it('falls back to 1/1 when the group never had values', () => {
    draw({ autoassign_amount_drivers: 0, orders_group_max_orders: 0 })
    expect(ui.useAdvanced).toBe(false)
    act(() => { ui.handleLogistic(true) })
    expect(ui.changesState).toMatchObject({ autoassign_amount_drivers: 1, orders_group_max_orders: 1 })
  })

  it('unchecking still sends 0/0', () => {
    draw({ autoassign_amount_drivers: 4, orders_group_max_orders: 3 })
    act(() => { ui.handleLogistic(false) })
    expect(ui.changesState).toMatchObject({ autoassign_amount_drivers: 0, orders_group_max_orders: 0 })
  })
})
