/* eslint-disable import/first */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  session: [{ token: 'test-token', user: { id: 7, level: 0 } }]
}))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => mocks.session
}))
vi.mock('../../../contexts/ApiContext', () => {
  const emptyResponse = async () => ({ content: { error: false, result: [], pagination: { total: 0, current_page: 1, page_size: 10, total_pages: 0 } } })
  const chain = () => new Proxy(function () {}, {
    get: (target, prop) => {
      if (prop === 'then') return undefined
      if (prop === 'get') return emptyResponse
      return () => chain()
    },
    apply: () => chain()
  })
  const ordering = new Proxy({}, {
    get: (target, prop) => {
      if (prop === 'root') return 'https://api.test/v400/en/demo'
      if (prop === 'project') return 'demo'
      if (prop === 'then') return undefined
      return () => chain()
    }
  })
  return { useApi: () => [ordering] }
})
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [null, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (key, fallback) => fallback]
}))

import { PosMenuBusinessList } from '../index'

const apiIntegrations = [
  { id: 364, key: 'clover_integration', name: 'Clover', type: 'pos', plugin_id: null, plugin_root: 'https://clover.plugins.orderingplus.com' },
  { id: 67, key: 'rappi_integration', name: 'Rappi', type: 'sales_channel', plugin_id: 1027, plugin_root: 'https://rappi.plugins.orderingplus.com' }
]

let controller
const UI = (props) => {
  controller = props
  return null
}

const json = (body) => Promise.resolve({ json: async () => body })

const renderController = (props = {}) => render(
  <PosMenuBusinessList UIComponent={UI} businesses={[]} {...props} />
)

describe('PosMenuBusinessList one-click POS install', () => {
  let fetchMock
  let integrations

  beforeEach(() => {
    controller = null
    integrations = apiIntegrations
    mocks.showToast.mockReset()
    fetchMock = vi.fn((url, options = {}) => {
      if (url.endsWith('/third_party_integrations')) return json({ error: false, result: integrations })
      if (url.endsWith('/plugins') && options.method === 'POST') return json({ error: false, result: { id: 2477 } })
      return json({ error: false, result: [] })
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists the catalog POS integrations the project has not installed yet', async () => {
    renderController({ integrationType: 'pos' })

    await waitFor(() => expect(controller.integrationsList.thirdPartyIntegrations.length).toBeGreaterThan(0))
    const keys = controller.integrationsList.thirdPartyIntegrations.map(item => item.key)
    expect(keys).toEqual(['clover_integration', 'square_pos_integration', 'simphony_integration', 'wansoft_integration'])
  })

  it('leaves sales channels without catalog rows', async () => {
    renderController({ integrationType: 'sales_channel' })

    await waitFor(() => expect(controller.integrationsList.thirdPartyIntegrations.length).toBe(1))
    expect(controller.integrationsList.thirdPartyIntegrations[0].key).toBe('rappi_integration')
  })

  // redesign bugs-d row 57 (IM-09): the importers page reads no integration, so it asks the controller not to load them
  it('loads the third party integrations on mount by default', async () => {
    renderController()

    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/third_party_integrations'))).toBe(true))
  })

  it('skipIntegrations does not request the third party integrations', async () => {
    renderController({ skipIntegrations: true })

    await waitFor(() => expect(controller).not.toBeNull())
    await act(async () => {})
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/third_party_integrations'))).toBe(false)
    expect(controller.integrationsList).toMatchObject({ loading: false, thirdPartyIntegrations: [] })
  })

  it('returns the refreshed list so the caller can find the installed integration', async () => {
    renderController({ integrationType: 'pos' })
    await waitFor(() => expect(controller.integrationsList.thirdPartyIntegrations.length).toBeGreaterThan(0))

    integrations = [...apiIntegrations, { id: 430, key: 'square_pos_integration', name: 'Square', type: 'pos', plugin_id: 2477 }]
    let list
    await act(async () => {
      list = await controller.getIntegrations()
    })

    expect(list.find(item => item.key === 'square_pos_integration')).toMatchObject({ id: 430, plugin_id: 2477 })
    expect(list.filter(item => item.key === 'square_pos_integration')).toHaveLength(1)
  })

  it('installs the plugin, waits for the callback and reports success', async () => {
    renderController({ integrationType: 'pos' })
    const callback = vi.fn(async () => {})

    let result
    await act(async () => {
      result = await controller.handleInstallSysPlugin('https://square-pos.plugins.orderingplus.com', callback)
    })

    expect(result).toBe(true)
    const [url, options] = fetchMock.mock.calls.find(([requestUrl, requestOptions]) => requestUrl.endsWith('/plugins') && requestOptions?.method === 'POST')
    expect(url).toBe('https://api.test/v400/en/demo/plugins')
    expect(JSON.parse(options.body)).toEqual({ url: 'https://square-pos.plugins.orderingplus.com' })
    expect(callback).toHaveBeenCalledTimes(1)
    expect(controller.installingPluginRoot).toBeNull()
  })

  it('exposes the plugin being installed and ignores a second install meanwhile', async () => {
    let resolveInstall
    fetchMock.mockImplementation((url, options = {}) => {
      if (url.endsWith('/plugins') && options.method === 'POST') return new Promise(resolve => { resolveInstall = resolve })
      if (url.endsWith('/third_party_integrations')) return json({ error: false, result: integrations })
      return json({ error: false, result: [] })
    })
    renderController({ integrationType: 'pos' })

    let first
    let second
    await act(async () => {
      first = controller.handleInstallSysPlugin('https://square-pos.plugins.orderingplus.com')
      second = await controller.handleInstallSysPlugin('https://clover.plugins.orderingplus.com')
    })

    expect(second).toBe(false)
    expect(controller.installingPluginRoot).toBe('https://square-pos.plugins.orderingplus.com')

    await act(async () => {
      resolveInstall({ json: async () => ({ error: false, result: {} }) })
      await first
    })
    expect(controller.installingPluginRoot).toBeNull()
  })

  it('installs a POS and returns its integration once the plugin links itself', async () => {
    fetchMock.mockImplementation((url, options = {}) => {
      if (url.endsWith('/plugins') && options.method === 'POST') {
        integrations = [{ id: 1, key: 'simphony_integration', name: 'Simphony', type: 'pos', plugin_id: 1, plugin_root: 'https://simphony.plugins.orderingplus.com' }]
        return json({ error: false, result: { id: 1 } })
      }
      if (url.endsWith('/third_party_integrations')) return json({ error: false, result: integrations })
      return json({ error: false, result: [] })
    })
    integrations = [{ id: 1, key: 'simphony_integration', name: 'Simphony', type: 'pos', plugin_id: null, plugin_root: 'https://simphony.plugins.orderingplus.com' }]
    renderController({ integrationType: 'pos' })
    await waitFor(() => expect(controller.integrationsList.thirdPartyIntegrations.length).toBeGreaterThan(0))

    let result
    await act(async () => {
      result = await controller.handleInstallPosIntegration({ key: 'simphony_integration', plugin_root: 'https://simphony.plugins.orderingplus.com' })
    })

    expect(result.installed).toBe(true)
    expect(result.integration).toMatchObject({ id: 1, plugin_id: 1 })
    expect(controller.integrationsList.thirdPartyIntegrations.find(item => item.key === 'simphony_integration').plugin_id).toBe(1)
    expect(controller.installingPluginRoot).toBeNull()
  })

  it('shows the API error and skips the callback when the install fails', async () => {
    fetchMock.mockImplementation((url, options = {}) => {
      if (url.endsWith('/plugins') && options.method === 'POST') return json({ error: true, result: ['Plugin url is invalid'] })
      if (url.endsWith('/third_party_integrations')) return json({ error: false, result: integrations })
      return json({ error: false, result: [] })
    })
    renderController({ integrationType: 'pos' })
    const callback = vi.fn()

    let result
    await act(async () => {
      result = await controller.handleInstallSysPlugin('https://square-pos.plugins.orderingplus.com', callback)
    })

    expect(result).toBe(false)
    expect(callback).not.toHaveBeenCalled()
    expect(mocks.showToast).toHaveBeenLastCalledWith('error', 'Plugin url is invalid')
  })

  // redesign bugs-d row 80: a request that never reached the API does not toast the browser's «Failed to fetch»
  it('a network failure in a bulk change toasts readable words', async () => {
    fetchMock.mockImplementation((url, options = {}) => {
      if (options.method === 'PUT') return Promise.reject(new TypeError('Failed to fetch'))
      return json({ error: false, result: [] })
    })
    renderController()

    await act(async () => {
      await controller.handleEnableAllBusiness(true)
    })

    expect(mocks.showToast).toHaveBeenLastCalledWith('error', 'The integration did not respond. Please try again.')
  })

  it('a network failure in a bulk delete toasts readable words', async () => {
    fetchMock.mockImplementation((url, options = {}) => {
      if (options.method === 'DELETE') return Promise.reject(new TypeError('Load failed'))
      return json({ error: false, result: [] })
    })
    renderController()

    await act(async () => {
      await controller.handleDeleteMultiBusinesses()
    })

    expect(mocks.showToast).toHaveBeenLastCalledWith('error', 'The integration did not respond. Please try again.')
  })

  it('keeps any other error message of a bulk change as it is', async () => {
    fetchMock.mockImplementation((url, options = {}) => {
      if (options.method === 'PUT') return Promise.reject(new Error('Business is locked'))
      return json({ error: false, result: [] })
    })
    renderController()

    await act(async () => {
      await controller.handleEnableAllBusiness(true)
    })

    expect(mocks.showToast).toHaveBeenLastCalledWith('error', 'Business is locked')
  })
})
