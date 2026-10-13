/* eslint-disable import/first */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  level: 0
}))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', user: { id: 7, level: mocks.level } }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test/v400/en/demo', project: 'demo' }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [null, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (key, fallback) => fallback]
}))
vi.mock('../../../contexts/EventContext', () => ({
  useEvent: () => [{ on: vi.fn(), off: vi.fn(), emit: vi.fn() }]
}))
vi.mock('../../../contexts/AssistantContext', () => ({
  useAssistantRecordChanges: () => {}
}))

import { BusinessDetails } from '../index'

const business = { id: 42, name: 'Demo' }
const cloverPlugin = {
  root: 'https://clover.plugins.test',
  setup_url: '/views/setup?project_code=@{project_code}&token=@{access_token}&business_id=@{business_id}'
}
const installedClover = { id: 364, key: 'clover_integration', plugin_id: 3367, plugin_root: 'https://clover.plugins.test', plugin: cloverPlugin }
const uninstalledClover = { id: 364, key: 'clover_integration', plugin_id: null, plugin_root: 'https://clover.plugins.test', plugin: null }

let controller
const UI = (props) => {
  controller = props
  return null
}

const json = (body) => Promise.resolve({ json: async () => body })

const mockApi = ({ integrations, install } = {}) => {
  const queue = [...integrations]
  return vi.fn((url, options = {}) => {
    if (url.endsWith('/third_party_integrations')) {
      const next = queue.length > 1 ? queue.shift() : queue[0]
      return next instanceof Error ? Promise.reject(next) : json({ error: false, result: next })
    }
    if (url.endsWith('/plugins') && options.method === 'POST') return install ? install() : json({ error: false, result: {} })
    return json({ error: false, result: [] })
  })
}

const renderController = (props = {}) => render(
  <BusinessDetails UIComponent={UI} businessId={42} business={business} notGetSites notGetTaxes notGetStreamConnection {...props} />
)

describe('BusinessDetails Clover install and connect', () => {
  beforeEach(() => {
    controller = null
    mocks.level = 0
    mocks.showToast.mockReset()
    vi.spyOn(window, 'open').mockReturnValue(null)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('opens the Clover plugin setup wizard when Clover is installed', async () => {
    vi.stubGlobal('fetch', mockApi({ integrations: [[{ id: 1, key: 'other' }, installedClover]] }))
    renderController()

    await waitFor(() => expect(controller.cloverState.installed).toBe(true))
    act(() => controller.handleSyncClover())

    expect(window.open).toHaveBeenCalledWith('https://clover.plugins.test/views/setup?project_code=demo&token=test-token&business_id=42', '_blank')
  })

  it('installs Clover from the store and then lets the store connect', async () => {
    const fetchMock = mockApi({ integrations: [[uninstalledClover], [installedClover]] })
    vi.stubGlobal('fetch', fetchMock)
    renderController()

    await waitFor(() => expect(controller.cloverState.loading).toBe(false))
    expect(controller.cloverState.installed).toBe(false)

    let result
    await act(async () => {
      result = await controller.handleInstallClover()
    })

    expect(result).toBe(true)
    const installCall = fetchMock.mock.calls.find(([url, options]) => url.endsWith('/plugins') && options?.method === 'POST')
    expect(installCall[0]).toBe('https://api.test/v400/en/demo/plugins')
    expect(JSON.parse(installCall[1].body)).toEqual({ url: 'https://clover.plugins.test' })
    expect(controller.cloverState.installed).toBe(true)
    expect(controller.cloverState.installing).toBe(false)
    expect(mocks.showToast).toHaveBeenLastCalledWith('success', 'Clover installed. You can connect this store now.')

    act(() => controller.handleSyncClover())
    expect(window.open).toHaveBeenCalledWith(expect.stringContaining('https://clover.plugins.test/views/setup?'), '_blank')
  })

  it('installs from the default Clover plugin url when the project has no Clover integration yet', async () => {
    const fetchMock = mockApi({ integrations: [[{ id: 1, key: 'other' }], [{ ...installedClover, plugin_root: 'https://clover.plugins.orderingplus.com' }]] })
    vi.stubGlobal('fetch', fetchMock)
    renderController()

    await waitFor(() => expect(controller.cloverState.loading).toBe(false))
    await act(async () => {
      await controller.handleInstallClover()
    })

    const installCall = fetchMock.mock.calls.find(([url, options]) => url.endsWith('/plugins') && options?.method === 'POST')
    expect(JSON.parse(installCall[1].body)).toEqual({ url: 'https://clover.plugins.orderingplus.com' })
  })

  it('shows the API error and keeps the install option when the install fails', async () => {
    vi.stubGlobal('fetch', mockApi({
      integrations: [[uninstalledClover]],
      install: () => json({ error: true, result: ['Plugin already installed'] })
    }))
    renderController()

    await waitFor(() => expect(controller.cloverState.loading).toBe(false))
    let result
    await act(async () => {
      result = await controller.handleInstallClover()
    })

    expect(result).toBe(false)
    expect(controller.cloverState.installed).toBe(false)
    expect(controller.cloverState.installing).toBe(false)
    expect(mocks.showToast).toHaveBeenLastCalledWith('error', 'Plugin already installed')
  })

  it('marks the status as unknown instead of offering an install when the lookup fails', async () => {
    vi.stubGlobal('fetch', mockApi({ integrations: [new TypeError('Failed to fetch')] }))
    renderController()

    await waitFor(() => expect(controller.cloverState.loading).toBe(false))
    expect(controller.cloverState.error).toBe(true)
    expect(controller.cloverState.installed).toBe(false)
  })

  it('skips the lookup for store rows and for users who are not admins', async () => {
    const fetchMock = mockApi({ integrations: [[installedClover]] })
    vi.stubGlobal('fetch', fetchMock)

    renderController({ notGetCloverIntegration: true })
    mocks.level = 2
    renderController()

    await act(async () => {})
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/third_party_integrations'))).toBe(false)
    expect(controller.cloverState.loading).toBe(false)
  })
})
