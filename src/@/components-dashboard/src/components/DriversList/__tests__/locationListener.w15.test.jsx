/* eslint-disable import/first */
// redesign W1-5 (T1-5-4): the listener of `batch_driver_locations` updated the order shown on the map from `orderForMap` without
// asking whether there was one. /all-in-one clears it when a driver is picked (handleEmtpyOrderSelected -> orderForMap = null), so the
// first location of the chosen driver threw `Cannot read properties of null (reading 'driver')` (measured live with a fake socket:
// one TypeError per location). The driver is still updated; the order is only rewritten when there is one.
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ handlers: {}, socket: null, ui: null }))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ auth: true, loading: false, token: 'token', user: { id: 7, level: 0 } }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test', project: 'cityeat' }]
}))
vi.mock('../../../contexts/WebsocketContext', () => ({
  useWebsocket: () => mocks.socket
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: vi.fn() }],
  ToastType: { Error: 'error', Success: 'success', Info: 'info' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))

import { DriversList } from '..'

const driver = { id: 69, name: 'Marcus', lastname: 'Hill', enabled: true, available: true, busy: false, location: { lat: 1, lng: 1 } }
const NEW_LOCATION = { lat: 40.77, lng: -73.96 }

const renderList = (props = {}) => render(
  <DriversList
    useDriversByProps
    enableSocketEventDriverRoom
    disableSocketRoomDriver
    driversList={{ drivers: [driver], loading: false }}
    UIComponent={(uiProps) => { mocks.ui = uiProps; return null }}
    {...props}
  />
)

const emitLocations = () => act(() => {
  mocks.handlers.batch_driver_locations?.forEach(fn => fn([{ driver_id: driver.id, location: NEW_LOCATION }]))
})

describe('DriversList: batch_driver_locations of the chosen driver', () => {
  beforeEach(() => {
    mocks.handlers = {}
    mocks.ui = null
    mocks.socket = {
      socket: { connected: true, on: vi.fn(), off: vi.fn(), _callbacks: {} },
      on: (event, fn) => { (mocks.handlers[event] = mocks.handlers[event] || new Set()).add(fn) },
      off: (event, fn) => { mocks.handlers[event]?.delete(fn) },
      join: vi.fn(),
      leave: vi.fn()
    }
  })

  afterEach(() => { vi.restoreAllMocks() })

  it('does not throw when there is no order on the map (orderForMap null), and still updates the driver', async () => {
    const setOrderForMap = vi.fn()
    renderList({ orderForMap: null, setOrderForMap })
    await act(async () => {})
    act(() => { mocks.ui.setSelectedDriver(driver) })
    expect(mocks.handlers.batch_driver_locations?.size).toBe(1)

    expect(() => emitLocations()).not.toThrow()
    expect(setOrderForMap).not.toHaveBeenCalled()
    expect(mocks.ui.selectedDriver.location).toEqual(NEW_LOCATION)
  })

  it('does not throw without a setter either (/drivers-dashboard)', async () => {
    renderList({ orderForMap: undefined, setOrderForMap: undefined })
    await act(async () => {})
    act(() => { mocks.ui.setSelectedDriver(driver) })
    expect(() => emitLocations()).not.toThrow()
    expect(mocks.ui.selectedDriver.location).toEqual(NEW_LOCATION)
  })

  it('keeps rewriting the order of the map when there is one', async () => {
    const setOrderForMap = vi.fn()
    const orderForMap = { id: 5, driver: { id: 69, location: { lat: 1, lng: 1 } } }
    renderList({ orderForMap, setOrderForMap })
    await act(async () => {})
    act(() => { mocks.ui.setSelectedDriver(driver) })
    emitLocations()
    expect(setOrderForMap).toHaveBeenCalledWith({ id: 5, driver: { id: 69, location: NEW_LOCATION } })
  })
})
