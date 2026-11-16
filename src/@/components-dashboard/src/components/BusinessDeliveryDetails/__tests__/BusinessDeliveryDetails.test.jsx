/* eslint-disable import/first */
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// redesign stores 5.7: the controller of Delivery keeps the SAVED zone enables apart from the PENDING ones, saves
// every pending zone in series (a failure does not stop the rest) and then the business fields, and tells the editor once.

const mocks = vi.hoisted(() => ({
  chain: null,
  session: { token: 'token' },
  ordering: { root: 'https://api.test', businesses: null, setAccessToken: null }
}))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [mocks.session] }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [mocks.ordering] }))

import { BusinessDeliveryDetails } from '..'

const zone = (id, enabled, extra = {}) => ({ id, name: `Zone ${id}`, enabled, type: 1, ...extra })
const ZONES = [zone(1, true), zone(2, false), zone(3, true), zone(4, true, { type: 3 })]

// A chainable fake of the SDK builder: `get` reads the zones, `save` writes the fields.
const makeChain = () => {
  const chain = {}
  chain.setAccessToken = vi.fn(() => chain)
  chain.businesses = vi.fn(() => chain)
  chain.select = vi.fn(() => chain)
  chain.asDashboard = vi.fn(() => chain)
  chain.get = vi.fn(async () => ({ content: { error: false, result: { id: 7, zones: ZONES } } }))
  chain.save = vi.fn(async (changes) => ({ content: { error: false, result: { ...changes } } }))
  return chain
}

// The PUT of a zone; `failing` maps a zone id to the content the API answers with.
const mockZoneApi = (failing = {}) => {
  global.fetch = vi.fn(async (url) => {
    const id = Number(url.split('/').pop())
    return { json: async () => (failing[id] ?? { error: false, result: { id } }) }
  })
}
const putCalls = () => global.fetch.mock.calls.map(([url, options]) => ({ url, method: options.method, body: JSON.parse(options.body) }))

const renderController = (props = {}) => {
  const ui = { current: null }
  const UIComponent = (uiProps) => {
    ui.current = uiProps
    return null
  }
  const handleUpdateBusinessState = vi.fn()
  const initial = { business: { id: 7, zones: ZONES }, handleUpdateBusinessState, ...props }
  const view = render(<BusinessDeliveryDetails UIComponent={UIComponent} {...initial} />)
  const rerender = (next) => view.rerender(<BusinessDeliveryDetails UIComponent={UIComponent} {...initial} {...next} />)
  return { ui, handleUpdateBusinessState, rerender }
}

beforeEach(() => {
  mocks.chain = makeChain()
  mocks.ordering.setAccessToken = mocks.chain.setAccessToken
  mocks.ordering.businesses = vi.fn(() => mocks.chain)
  mockZoneApi()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('BusinessDeliveryDetails controller · zone state', () => {
  it('lists the zones of the business without the type 3 ones, with their saved enables', () => {
    const { ui } = renderController()
    expect(ui.current.zoneListState.changes).toEqual({ 1: true, 2: false, 3: true })
    expect(ui.current.zoneListState.isCheckAll).toBe(false)
  })

  it('isCheckAll is true only when there is at least one zone and all are enabled', () => {
    const { ui } = renderController({ business: { id: 7, zones: [zone(1, true), zone(2, true), zone(9, false, { type: 3 })] } })
    expect(ui.current.zoneListState.isCheckAll).toBe(true)
  })

  it('isCheckAll is false with zero zones (G3-23)', () => {
    const { ui } = renderController({ business: { id: 7, zones: [] } })
    expect(ui.current.zoneListState.changes).toEqual({})
    expect(ui.current.zoneListState.isCheckAll).toBe(false)
    const only3 = renderController({ business: { id: 7, zones: [zone(4, true, { type: 3 })] } })
    expect(only3.ui.current.zoneListState.isCheckAll).toBe(false)
  })

  it('a change is pending; going back to the saved value removes it', () => {
    const { ui } = renderController()
    act(() => ui.current.handleChangeZoneState(2, true))
    expect(ui.current.zoneListState.changes[2]).toBe(true)
    expect(ui.current.zoneListState.isCheckAll).toBe(true)
    expect(ui.current.pendingZones).toEqual([{ id: 2, name: 'Zone 2' }])
    act(() => ui.current.handleChangeZoneState(2, false))
    expect(ui.current.zoneListState.changes[2]).toBe(false)
    expect(ui.current.pendingZones).toEqual([])
  })

  it('«all» applies to the listed zones and only the ones that differ are pending', () => {
    const { ui } = renderController()
    act(() => ui.current.handleChangeAllZoneState(false))
    expect(ui.current.zoneListState.changes).toEqual({ 1: false, 2: false, 3: false })
    expect(ui.current.pendingZones.map(item => item.id)).toEqual([1, 3])
    act(() => ui.current.handleChangeAllZoneState(true))
    expect(ui.current.zoneListState.isCheckAll).toBe(true)
    expect(ui.current.pendingZones.map(item => item.id)).toEqual([2])
  })

  it('keeps the pending enables when business.zones changes and drops the ones of a deleted zone (G3-23)', () => {
    const { ui, rerender } = renderController()
    act(() => ui.current.handleChangeZoneState(1, false))
    act(() => ui.current.handleChangeZoneState(2, true))
    // another panel adds zone 5 and deletes zone 2
    rerender({ business: { id: 7, zones: [zone(1, true), zone(3, true), zone(5, false)] } })
    expect(ui.current.zoneListState.changes).toEqual({ 1: false, 3: true, 5: false })
    expect(ui.current.pendingZones).toEqual([{ id: 1, name: 'Zone 1' }])
  })

  it('a pending value that the saved zone now has stops being pending', () => {
    const { ui, rerender } = renderController()
    act(() => ui.current.handleChangeZoneState(2, true))
    rerender({ business: { id: 7, zones: [zone(1, true), zone(2, true), zone(3, true)] } })
    expect(ui.current.pendingZones).toEqual([])
    // and does not come back if the saved value changes again
    rerender({ business: { id: 7, zones: [zone(1, true), zone(2, false), zone(3, true)] } })
    expect(ui.current.zoneListState.changes[2]).toBe(false)
    expect(ui.current.pendingZones).toEqual([])
  })

  it('discardZones empties the pending ones', () => {
    const { ui } = renderController()
    act(() => ui.current.handleChangeZoneState(1, false))
    act(() => ui.current.discardZones())
    expect(ui.current.pendingZones).toEqual([])
    expect(ui.current.zoneListState.changes[1]).toBe(true)
  })

  it('reads the zones when the business has none, and tells the editor', async () => {
    const { handleUpdateBusinessState } = renderController({ business: { id: 7 } })
    await waitFor(() => expect(handleUpdateBusinessState).toHaveBeenCalledWith({ id: 7, zones: ZONES }))
    expect(mocks.chain.select).toHaveBeenCalledWith(['id', 'zones', 'header', 'logo', 'timezone'])
  })

  it('does not read the zones when the business already has them', () => {
    renderController()
    expect(mocks.chain.get).not.toHaveBeenCalled()
  })
})

describe('BusinessDeliveryDetails controller · saveDelivery', () => {
  it('sends every pending zone in series, saves nothing else and tells the editor once with the new enables', async () => {
    const { ui, handleUpdateBusinessState } = renderController()
    act(() => ui.current.handleChangeZoneState(1, false))
    act(() => ui.current.handleChangeZoneState(2, true))
    let result
    await act(async () => { result = await ui.current.saveDelivery({}) })

    expect(result).toEqual({ ok: true, error: null, failedZones: [] })
    expect(putCalls()).toEqual([
      { url: 'https://api.test/business/7/deliveryzones/1', method: 'PUT', body: { enabled: false } },
      { url: 'https://api.test/business/7/deliveryzones/2', method: 'PUT', body: { enabled: true } }
    ])
    expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer token')
    expect(mocks.chain.save).not.toHaveBeenCalled()
    expect(handleUpdateBusinessState).toHaveBeenCalledTimes(1)
    const sent = handleUpdateBusinessState.mock.calls[0][0]
    expect(sent.zones.map(item => [item.id, item.enabled])).toEqual([[1, false], [2, true], [3, true], [4, true]])
    expect(ui.current.pendingZones).toEqual([])
  })

  it('a zone that fails does not stop the rest; the business fields are still saved; only the failed zone stays pending (G3-25)', async () => {
    const { ui, handleUpdateBusinessState } = renderController({ business: { id: 7, zones: [zone(1, true), zone(2, true), zone(3, true)] } })
    act(() => ui.current.handleChangeAllZoneState(false))
    let result
    mockZoneApi({ 2: { error: true, result: ['Zone is in use'] } })
    await act(async () => { result = await ui.current.saveDelivery({ delivery_time: '2:0' }) })

    expect(putCalls().map(call => call.url.split('/').pop())).toEqual(['1', '2', '3'])
    expect(result.ok).toBe(false)
    expect(result.error).toBeNull()
    expect(result.failedZones).toEqual([{ id: 2, name: 'Zone 2', message: 'Zone is in use' }])
    expect(mocks.chain.save).toHaveBeenCalledWith({ delivery_time: '2:0' }, { accessToken: 'token' })
    expect(handleUpdateBusinessState).toHaveBeenCalledTimes(1)
    const sent = handleUpdateBusinessState.mock.calls[0][0]
    expect(sent.delivery_time).toBe('2:0')
    expect(sent.zones.map(item => [item.id, item.enabled])).toEqual([[1, false], [2, true], [3, false]])
    expect(ui.current.pendingZones).toEqual([{ id: 2, name: 'Zone 2' }])
    expect(ui.current.zoneListState.changes[2]).toBe(false)
  })

  it('a thrown request is a failed zone with the thrown message', async () => {
    const { ui } = renderController()
    act(() => ui.current.handleChangeZoneState(1, false))
    global.fetch = vi.fn(async () => { throw new Error('Failed to fetch') })
    let result
    await act(async () => { result = await ui.current.saveDelivery({}) })
    expect(result.ok).toBe(false)
    expect(result.failedZones).toEqual([{ id: 1, name: 'Zone 1', message: 'Failed to fetch' }])
  })

  it('a stale zones list in the saved result never wins', async () => {
    const { ui, handleUpdateBusinessState } = renderController()
    act(() => ui.current.handleChangeZoneState(1, false))
    mocks.chain.save = vi.fn(async () => ({ content: { error: false, result: { delivery_time: '1:30', zones: ZONES } } }))
    mocks.ordering.businesses = vi.fn(() => mocks.chain)
    await act(async () => { await ui.current.saveDelivery({ delivery_time: '1:30' }) })
    const sent = handleUpdateBusinessState.mock.calls[0][0]
    expect(sent.delivery_time).toBe('1:30')
    expect(sent.zones.find(item => item.id === 1).enabled).toBe(false)
  })

  it('a failed fields save answers the first message and leaves the zones that were saved', async () => {
    const { ui, handleUpdateBusinessState } = renderController()
    act(() => ui.current.handleChangeZoneState(1, false))
    mocks.chain.save = vi.fn(async () => ({ content: { error: true, result: ['Invalid delivery time'] } }))
    let result
    await act(async () => { result = await ui.current.saveDelivery({ delivery_time: 'x' }) })
    expect(result).toEqual({ ok: false, error: 'Invalid delivery time', failedZones: [] })
    expect(handleUpdateBusinessState).toHaveBeenCalledTimes(1)
    expect(handleUpdateBusinessState.mock.calls[0][0]).not.toHaveProperty('delivery_time')
    expect(ui.current.pendingZones).toEqual([])
  })

  it('a thrown fields save answers its message', async () => {
    const { ui } = renderController()
    mocks.chain.save = vi.fn(async () => { throw new Error('Network down') })
    let result
    await act(async () => { result = await ui.current.saveDelivery({ delivery_time: '1:0' }) })
    expect(result).toEqual({ ok: false, error: 'Network down', failedZones: [] })
  })

  it('with nothing to save it sends nothing and does not tell the editor', async () => {
    const { ui, handleUpdateBusinessState } = renderController()
    let result
    await act(async () => { result = await ui.current.saveDelivery({}) })
    expect(result).toEqual({ ok: true, error: null, failedZones: [] })
    expect(global.fetch).not.toHaveBeenCalled()
    expect(mocks.chain.save).not.toHaveBeenCalled()
    expect(handleUpdateBusinessState).not.toHaveBeenCalled()
  })
})
