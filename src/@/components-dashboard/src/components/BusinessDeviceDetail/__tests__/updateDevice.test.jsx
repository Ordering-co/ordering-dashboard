import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
import { BusinessDeviceDetail } from '../index'

const mocks = vi.hoisted(() => {
  const businessRequest = {
    asDashboard: () => businessRequest,
    select: () => businessRequest,
    get: async () => ({ content: { error: false, result: { id: 2, name: 'Pharmacy 1', owners: [] } } })
  }
  const ordering = {
    root: 'https://api.test/v400/en/demo',
    businesses: () => businessRequest,
    setAccessToken: () => ordering
  }
  return {
    showToast: vi.fn(),
    session: [{ token: 'test-token', user: { id: 7, level: 0 } }],
    api: [ordering]
  }
})

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => mocks.session }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => mocks.api }))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [null, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))

let controller
const UI = (props) => {
  controller = props
  return null
}

const device = { id: 68, name: 'local-kiosk', business_id: 2, user_id: 101 }

describe('BusinessDeviceDetail update', () => {
  let fetchMock

  beforeEach(() => {
    controller = null
    fetchMock = vi.fn(() => Promise.resolve({ json: async () => ({ error: false, result: { ...device, name: 'Front kiosk' } }) }))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps the assigned owner when only the name changes', async () => {
    render(<BusinessDeviceDetail UIComponent={UI} selectedDevice={device} devices={[device]} handleUpdateDeviceList={vi.fn()} />)
    await waitFor(() => expect(controller?.businessList?.loading).toBe(false))
    act(() => controller.handleChangeFormState({ name: 'Front kiosk' }))
    await act(async () => controller.updateDevice())

    const [url, options] = fetchMock.mock.calls.find(([, request]) => request?.method === 'PUT')
    expect(url).toBe('https://api.test/v400/en/demo/devices/68')
    expect(JSON.parse(options.body)).toEqual({ business_id: 2, user_id: 101, name: 'Front kiosk' })
  })

  it('sends the newly selected owner', async () => {
    render(<BusinessDeviceDetail UIComponent={UI} selectedDevice={device} devices={[device]} handleUpdateDeviceList={vi.fn()} />)
    await waitFor(() => expect(controller?.businessList?.loading).toBe(false))
    act(() => controller.handleChangeFormState({ user_id: 205 }))
    await act(async () => controller.updateDevice())

    const [, options] = fetchMock.mock.calls.find(([, request]) => request?.method === 'PUT')
    expect(JSON.parse(options.body)).toEqual({ business_id: 2, user_id: 205 })
  })
})
