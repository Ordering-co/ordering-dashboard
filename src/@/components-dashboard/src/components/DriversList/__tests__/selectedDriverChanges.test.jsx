/* eslint-disable import/first */
// redesign drivers-dashboard B2 (DD-01): `batch_driver_changes` was applied to the list but not to the chosen driver, so the driver
// picked on the map went `available: false`, left the list and the map kept showing it «Available». The chosen driver follows its changes.
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
const other = { id: 70, name: 'Ana', lastname: 'Ruiz', enabled: true, available: true, busy: false, location: { lat: 2, lng: 2 } }

const renderList = (props = {}) => render(
  <DriversList
    useDriversByProps
    enableSocketEventDriverRoom
    disableSocketRoomDriver
    driversList={{ drivers: [driver, other], loading: false }}
    UIComponent={(uiProps) => { mocks.ui = uiProps; return null }}
    {...props}
  />
)

const emitChanges = (changes) => act(() => {
  mocks.handlers.batch_driver_changes?.forEach(fn => fn(changes))
})

const goesBusy = (id) => ({
  driver_id: id,
  changes: [
    { attribute: 'available', old: true, new: false },
    { attribute: 'busy', old: false, new: true }
  ]
})

describe('DriversList: batch_driver_changes of the chosen driver (DD-01)', () => {
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

  it('applies the changes of the chosen driver to the chosen driver, and to the list', async () => {
    renderList()
    await act(async () => {})
    act(() => { mocks.ui.setSelectedDriver(driver) })
    expect(mocks.handlers.batch_driver_changes?.size).toBe(1)

    emitChanges([goesBusy(69)])

    expect(mocks.ui.selectedDriver.available).toBe(false)
    expect(mocks.ui.selectedDriver.busy).toBe(true)
    expect(mocks.ui.selectedDriver).not.toBe(driver)
    expect(driver.available).toBe(true)
    expect(mocks.ui.driversList.drivers.find(item => item.id === 69).available).toBe(false)
  })

  it('leaves the chosen driver untouched (same object) when the changes belong to another driver', async () => {
    renderList()
    await act(async () => {})
    act(() => { mocks.ui.setSelectedDriver(driver) })
    const before = mocks.ui.selectedDriver

    emitChanges([goesBusy(70)])

    expect(mocks.ui.selectedDriver).toBe(before)
    expect(mocks.ui.selectedDriver.available).toBe(true)
    expect(mocks.ui.driversList.drivers.find(item => item.id === 70).busy).toBe(true)
  })

  it('does not throw without a chosen driver and selectedDriver stays null', async () => {
    renderList()
    await act(async () => {})
    expect(mocks.ui.selectedDriver).toBeNull()

    expect(() => emitChanges([goesBusy(69)])).not.toThrow()

    expect(mocks.ui.selectedDriver).toBeNull()
  })
})
