/* eslint-disable import/first */
// redesign stores-devices (G5-36): the list starts loading, keeps a failed load as `error` (main never showed it) and
// `reloadDevices` clears that error and loads again.
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', loading: false }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test' }]
}))

import { BusinessDeviceListing } from '../index'

const json = (body) => Promise.resolve({ json: () => Promise.resolve(body) })

let ui
const UI = (p) => {
  ui = p
  return null
}

beforeEach(() => {
  mocks.fetch.mockReset()
  globalThis.fetch = mocks.fetch
})

describe('BusinessDeviceListing controller', () => {
  it('starts loading and lands on the devices', async () => {
    mocks.fetch.mockImplementation(() => json({ error: false, result: [{ id: 1, name: 'Kiosk' }] }))
    render(<BusinessDeviceListing UIComponent={UI} />)
    expect(ui.deviceListState.loading).toBe(true)
    await waitFor(() => expect(ui.deviceListState.loading).toBe(false))
    expect(ui.deviceListState.devices).toEqual([{ id: 1, name: 'Kiosk' }])
    expect(mocks.fetch).toHaveBeenCalledWith('https://api.test/devices', expect.objectContaining({ method: 'GET' }))
  })

  it('keeps a failed load as an error and recovers on reload', async () => {
    mocks.fetch.mockImplementationOnce(() => json({ error: true, result: ['Server error'] }))
    render(<BusinessDeviceListing UIComponent={UI} />)
    await waitFor(() => expect(ui.deviceListState.error).toEqual(['Server error']))
    mocks.fetch.mockImplementation(() => json({ error: false, result: [] }))
    await act(async () => { await ui.reloadDevices() })
    expect(ui.deviceListState.error).toBe(null)
    expect(ui.deviceListState.devices).toEqual([])
  })

  it('updates the list in place', async () => {
    mocks.fetch.mockImplementation(() => json({ error: false, result: [{ id: 1 }] }))
    render(<BusinessDeviceListing UIComponent={UI} />)
    await waitFor(() => expect(ui.deviceListState.loading).toBe(false))
    act(() => ui.handleUpdateDeviceList([]))
    expect(ui.deviceListState.devices).toEqual([])
  })
})
