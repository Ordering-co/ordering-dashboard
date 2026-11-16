/* eslint-disable import/first */
// redesign DG-B1 (M-DG25, M-DG38): the DriverGroupDeliveryDetails controller no longer rejects an unhandled promise nor
// leaves the API answer as `zones` when the zones fail to load (`zoneList = { zones: [], loading: false, error }`);
// it exposes `reloadZones()` and `resetZoneState()`; `onDeliveryStateSave` returns `{ ok, error }`; and with no zones the
// header checkbox state `isCheckAll` is false.
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  showToast: vi.fn()
}))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', user: { level: 0 } }]
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

import { DriverGroupDeliveryDetails } from '../index'

const GROUP = { id: 4, name: 'North' }
const ZONES = () => ([
  { id: 11, name: 'Centre', type: 1, enabled: true },
  { id: 12, name: 'Ring', type: 2, enabled: false },
  { id: 13, name: 'Everywhere', type: 3, enabled: true }
])
const json = (body) => Promise.resolve({ json: () => Promise.resolve(body) })
const zonesUrl = 'https://api.test/drivergroups/4/deliveryzones'

let ui
const draw = () => {
  ui = null
  const UI = (p) => {
    ui = p
    return null
  }
  return render(<DriverGroupDeliveryDetails UIComponent={UI} drivergroup={GROUP} />)
}
const unhandled = []
const onUnhandled = (reason) => unhandled.push(reason)

beforeEach(() => {
  unhandled.length = 0
  process.on('unhandledRejection', onUnhandled)
  mocks.fetch.mockReset()
  mocks.showToast.mockReset()
  mocks.fetch.mockImplementation((url, options) => {
    if (options?.method === 'PUT') return json({ error: false, result: { enabled: JSON.parse(options.body).enabled } })
    return json({ error: false, result: ZONES() })
  })
  globalThis.fetch = mocks.fetch
})

afterEach(() => {
  process.off('unhandledRejection', onUnhandled)
})

describe('DriverGroupDeliveryDetails controller · zones that fail to load (M-DG25)', () => {
  it('an API error leaves an empty list with the messages, and does not reject', async () => {
    mocks.fetch.mockImplementation(() => json({ error: true, result: ['Not allowed'] }))
    draw()
    await waitFor(() => expect(ui.zoneList.loading).toBe(false))
    expect(ui.zoneList).toEqual({ zones: [], loading: false, error: ['Not allowed'] })
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(unhandled).toEqual([])
  })

  it('a thrown request leaves an empty list with the message, and does not reject', async () => {
    mocks.fetch.mockImplementation(() => Promise.reject(new Error('offline')))
    draw()
    await waitFor(() => expect(ui.zoneList.loading).toBe(false))
    expect(ui.zoneList).toEqual({ zones: [], loading: false, error: ['offline'] })
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(unhandled).toEqual([])
  })

  it('reloadZones() asks for the zones again and recovers', async () => {
    mocks.fetch.mockImplementation(() => json({ error: true, result: ['Not allowed'] }))
    draw()
    await waitFor(() => expect(ui.zoneList.error).toEqual(['Not allowed']))
    expect(typeof ui.reloadZones).toBe('function')
    mocks.fetch.mockImplementation(() => json({ error: false, result: ZONES() }))
    await act(async () => { await ui.reloadZones() })
    expect(ui.zoneList.error).toBe(null)
    expect(ui.zoneList.loading).toBe(false)
    expect(ui.zoneList.zones.map(z => z.id)).toEqual([11, 12, 13])
    expect(mocks.fetch.mock.calls.filter(([url]) => url === zonesUrl)).toHaveLength(2)
  })
})

describe('DriverGroupDeliveryDetails controller · header checkbox with no zones (M-DG38)', () => {
  it('isCheckAll is false when the group has no zones', async () => {
    mocks.fetch.mockImplementation(() => json({ error: false, result: [] }))
    draw()
    await waitFor(() => expect(ui.zoneList.loading).toBe(false))
    expect(ui.zoneListState.changes).toEqual({})
    expect(ui.zoneListState.isCheckAll).toBe(false)
  })

  it('isCheckAll is false when the group only has the "everywhere" type', async () => {
    mocks.fetch.mockImplementation(() => json({ error: false, result: [{ id: 13, type: 3, enabled: true }] }))
    draw()
    await waitFor(() => expect(ui.zoneList.loading).toBe(false))
    expect(ui.zoneListState.isCheckAll).toBe(false)
  })

  it('isCheckAll still tracks the checkboxes when there are zones', async () => {
    draw()
    await waitFor(() => expect(ui.zoneListState.changes).toEqual({ 11: true, 12: false }))
    expect(ui.zoneListState.isCheckAll).toBe(false)
    act(() => { ui.handleChangeZoneState(12, true) })
    await waitFor(() => expect(ui.zoneListState.isCheckAll).toBe(true))
  })
})

describe('DriverGroupDeliveryDetails controller · onDeliveryStateSave returns how the save went', () => {
  it('returns { ok: true } and PUTs only the zones that changed', async () => {
    draw()
    await waitFor(() => expect(ui.zoneListState.changes).toEqual({ 11: true, 12: false }))
    act(() => { ui.handleChangeZoneState(12, true) })
    let result
    await act(async () => { result = await ui.onDeliveryStateSave() })
    expect(result).toEqual({ ok: true })
    const puts = mocks.fetch.mock.calls.filter(([, options]) => options?.method === 'PUT')
    expect(puts.map(([url]) => url)).toEqual([`${zonesUrl}/12`])
    expect(ui.zoneListState.isDirty).toBe(false)
    expect(ui.actionState).toEqual({ loading: false, error: null })
  })

  it('returns { ok: false, error } when a PUT fails, and the ones already sent are not undone', async () => {
    draw()
    await waitFor(() => expect(ui.zoneListState.changes).toEqual({ 11: true, 12: false }))
    act(() => { ui.handleChangeZoneState(11, false) })
    act(() => { ui.handleChangeZoneState(12, true) })
    mocks.fetch.mockImplementation((url, options) => {
      if (url === `${zonesUrl}/12`) return json({ error: true, result: 'Zone is locked' })
      if (options?.method === 'PUT') return json({ error: false, result: {} })
      return json({ error: false, result: ZONES() })
    })
    let result
    await act(async () => { result = await ui.onDeliveryStateSave() })
    expect(result).toEqual({ ok: false, error: ['Zone is locked'] })
    expect(ui.actionState.error).toEqual(['Zone is locked'])
    expect(ui.zoneListState.isDirty).toBe(true)
    const puts = mocks.fetch.mock.calls.filter(([, options]) => options?.method === 'PUT').map(([url]) => url)
    expect(puts).toEqual([`${zonesUrl}/11`, `${zonesUrl}/12`])
    // the failed zone keeps its pending change so the user can retry
    expect(ui.zoneListState.changes[12]).toBe(true)
  })

  it('returns { ok: false, error: [message] } when the request throws', async () => {
    draw()
    await waitFor(() => expect(ui.zoneListState.changes).toEqual({ 11: true, 12: false }))
    act(() => { ui.handleChangeZoneState(12, true) })
    mocks.fetch.mockImplementation(() => Promise.reject(new Error('offline')))
    let result
    await act(async () => { result = await ui.onDeliveryStateSave() })
    expect(result).toEqual({ ok: false, error: ['offline'] })
  })
})

describe('DriverGroupDeliveryDetails controller · resetZoneState() (Discard)', () => {
  it('returns the checkboxes to the stored values and clears isDirty', async () => {
    draw()
    await waitFor(() => expect(ui.zoneListState.changes).toEqual({ 11: true, 12: false }))
    expect(typeof ui.resetZoneState).toBe('function')
    act(() => { ui.handleChangeZoneState(11, false) })
    act(() => { ui.handleChangeZoneState(12, true) })
    expect(ui.zoneListState.isDirty).toBe(true)
    act(() => { ui.resetZoneState() })
    expect(ui.zoneListState.changes).toEqual({ 11: true, 12: false })
    expect(ui.zoneListState.isDirty).toBe(false)
    expect(ui.zoneListState.isCheckAll).toBe(false)
  })

  it('after a save, "stored" means what was just saved', async () => {
    draw()
    await waitFor(() => expect(ui.zoneListState.changes).toEqual({ 11: true, 12: false }))
    act(() => { ui.handleChangeZoneState(12, true) })
    await act(async () => { await ui.onDeliveryStateSave() })
    expect(ui.zoneListState.changes).toEqual({ 11: true, 12: true })
    act(() => { ui.handleChangeZoneState(12, false) })
    act(() => { ui.resetZoneState() })
    expect(ui.zoneListState.changes).toEqual({ 11: true, 12: true })
    // and toggling back is saved, not skipped against the stale list
    act(() => { ui.handleChangeZoneState(12, false) })
    await act(async () => { await ui.onDeliveryStateSave() })
    const puts = mocks.fetch.mock.calls.filter(([, options]) => options?.method === 'PUT').map(([url]) => url)
    expect(puts).toEqual([`${zonesUrl}/12`, `${zonesUrl}/12`])
  })
})

// redesign DG-B1 (D-01): saving or deleting one zone replaces `zoneList.zones`; a pending «Active» box survives it
describe('DriverGroupDeliveryDetails controller · pending «Active» boxes when the list is replaced (D-01)', () => {
  it('keeps a changed, unsaved box and takes the stored value for the others', async () => {
    draw()
    await waitFor(() => expect(ui.zoneListState.changes).toEqual({ 11: true, 12: false }))
    act(() => { ui.handleChangeZoneState(12, true) })
    // a zone form saved zone 11 (its name), and the zone controller replaced the list
    act(() => { ui.setZoneList(prev => ({ ...prev, zones: prev.zones.map(zone => zone.id === 11 ? { ...zone, name: 'Centre 2' } : zone) })) })
    await waitFor(() => expect(ui.zoneListState.changes).toEqual({ 11: true, 12: true }))
  })

  it('a deleted zone leaves the changes; a new one comes in with its stored value', async () => {
    draw()
    await waitFor(() => expect(ui.zoneListState.changes).toEqual({ 11: true, 12: false }))
    act(() => { ui.handleChangeZoneState(11, false) })
    act(() => { ui.setZoneList(prev => ({ ...prev, zones: [...prev.zones.filter(zone => zone.id !== 12), { id: 14, name: 'New', type: 2, enabled: true }] })) })
    await waitFor(() => expect(ui.zoneListState.changes).toEqual({ 11: false, 14: true }))
  })
})
