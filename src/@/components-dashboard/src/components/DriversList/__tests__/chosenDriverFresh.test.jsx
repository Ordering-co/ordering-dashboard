/* eslint-disable import/first */
// redesign drivers-dashboard B2 (DD-12, DD-13): the orders of the chosen driver were asked once per choice (never again while its
// assigned_orders_count moved), without the active statuses 24–26; and `batch_driver_locations` moved the pin but left
// `last_location_at` as it was on load, so the age of the location never moved either.
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ handlers: {}, socket: null, ui: null, wheres: [], selects: [] }))

const ordering = {
  root: 'https://api.test',
  project: 'cityeat',
  setAccessToken: () => ordering,
  orders: () => ({
    asDashboard: () => ({
      select: (fields) => {
        mocks.selects.push(fields)
        return {
          where: (where) => {
            mocks.wheres.push(where)
            return { get: async () => ({ content: { error: false, result: [{ id: 1, status: 7 }] } }) }
          }
        }
      }
    })
  })
}

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ auth: true, loading: false, token: 'token', user: { id: 7, level: 0 } }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [ordering]
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

const driver = { id: 69, name: 'Marcus', lastname: 'Hill', enabled: true, available: true, busy: false, assigned_orders_count: 1, last_location_at: '2026-01-01 00:00:00', location: { lat: 1, lng: 1 } }

const renderList = () => render(
  <DriversList
    useDriversByProps
    enableSocketEventDriverRoom
    disableSocketRoomDriver
    driversList={{ drivers: [driver], loading: false }}
    UIComponent={(uiProps) => { mocks.ui = uiProps; return null }}
  />
)

const statusesOf = (where) => where.conditions.find(condition => condition.attribute === 'status')?.value

describe('DriversList: the chosen driver stays fresh (DD-12, DD-13)', () => {
  beforeEach(() => {
    mocks.handlers = {}
    mocks.ui = null
    mocks.wheres = []
    mocks.selects = []
    mocks.socket = {
      socket: { connected: true, on: vi.fn(), off: vi.fn(), _callbacks: {} },
      on: (event, fn) => { (mocks.handlers[event] = mocks.handlers[event] || new Set()).add(fn) },
      off: (event, fn) => { mocks.handlers[event]?.delete(fn) },
      join: vi.fn(),
      leave: vi.fn()
    }
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('asks for the orders of the chosen driver with every active status, 24–26 included', async () => {
    renderList()
    await act(async () => { mocks.ui.setSelectedDriver(driver) })
    expect(mocks.wheres).toHaveLength(1)
    expect(statusesOf(mocks.wheres[0])).toEqual(expect.arrayContaining([0, 13, 7, 8, 4, 9, 3, 14, 18, 19, 20, 21, 22, 23, 24, 25, 26]))
  })

  // redesign drivers-dashboard B4 (live): the orders came with only business and customer: the panel had no status and the sheet could not
  // know the group that holds them
  it('asks for the status of the chosen driver orders', async () => {
    renderList()
    await act(async () => { mocks.ui.setSelectedDriver(driver) })
    expect(mocks.selects[0]).toEqual(expect.arrayContaining(['business', 'customer', 'status']))
  })

  it('asks again when the assigned orders count of the chosen driver changes, and keeps the orders while it reloads', async () => {
    renderList()
    await act(async () => { mocks.ui.setSelectedDriver(driver) })
    expect(mocks.wheres).toHaveLength(1)
    expect(mocks.ui.assignedOrders.orders).toHaveLength(1)

    await act(async () => {
      mocks.handlers.batch_driver_changes?.forEach(fn => fn([{ driver_id: 69, changes: [{ attribute: 'assigned_orders_count', old: 1, new: 2 }] }]))
    })

    expect(mocks.wheres).toHaveLength(2)
    expect(mocks.ui.assignedOrders.orders).toHaveLength(1)
  })

  // redesign drivers-dashboard R1-03: a reload is not a load: /all-in-one covers the whole page with a spinner while `loading` is true
  it('does not mark a reload of the same driver as loading', async () => {
    const seen = []
    render(
      <DriversList
        useDriversByProps
        enableSocketEventDriverRoom
        disableSocketRoomDriver
        driversList={{ drivers: [driver], loading: false }}
        UIComponent={(uiProps) => { mocks.ui = uiProps; seen.push(!!uiProps.assignedOrders.loading); return null }}
      />
    )
    await act(async () => { mocks.ui.setSelectedDriver(driver) })
    seen.length = 0
    await act(async () => {
      mocks.handlers.batch_driver_changes?.forEach(fn => fn([{ driver_id: 69, changes: [{ attribute: 'assigned_orders_count', old: 1, new: 2 }] }]))
    })
    expect(mocks.wheres).toHaveLength(2)
    expect(seen).not.toContain(true)
  })

  it('does not ask again for a change that is not the count', async () => {
    renderList()
    await act(async () => { mocks.ui.setSelectedDriver(driver) })
    await act(async () => {
      mocks.handlers.batch_driver_changes?.forEach(fn => fn([{ driver_id: 69, changes: [{ attribute: 'busy', old: false, new: true }] }]))
    })
    expect(mocks.wheres).toHaveLength(1)
  })

  it('stamps last_location_at (UTC, API shape) on the list and on the chosen driver with each location', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 9, 12, 34, 56)))
    renderList()
    await act(async () => { mocks.ui.setSelectedDriver(driver) })

    act(() => {
      mocks.handlers.batch_driver_locations?.forEach(fn => fn([{ driver_id: 69, location: { lat: 40.7, lng: -73.9 } }]))
    })

    expect(mocks.ui.driversList.drivers[0].last_location_at).toBe('2026-10-09 12:34:56')
    expect(mocks.ui.selectedDriver.last_location_at).toBe('2026-10-09 12:34:56')
    expect(mocks.ui.selectedDriver.location).toEqual({ lat: 40.7, lng: -73.9 })
  })
})
