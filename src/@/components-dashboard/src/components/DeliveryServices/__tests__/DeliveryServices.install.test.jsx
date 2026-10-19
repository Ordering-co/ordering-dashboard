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
  const emptyResponse = async () => ({ content: { error: false, result: [] } })
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
vi.mock('../../../utils/pluginInstall', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    waitForInstalledIntegration: (load, target) => actual.waitForInstalledIntegration(load, target, { attempts: 3, sleep: async () => {} })
  }
})

import { DeliveryServices } from '../index'

const PLUGIN_ROOT = 'https://uber-direct.plugins.orderingplus.com'
const pendingCompany = { id: 166, name: 'Uber Direct', plugin_id: null, plugin_root: PLUGIN_ROOT, driver_groups: [] }
const installedCompany = { ...pendingCompany, plugin_id: 1222 }

let controller
const UI = (props) => {
  controller = props
  return null
}

const json = (body) => Promise.resolve({ json: async () => body })

describe('DeliveryServices install without page reload', () => {
  let fetchMock
  let companies
  let installResponse

  beforeEach(() => {
    controller = null
    companies = [pendingCompany]
    installResponse = { error: false, result: { id: 1222 } }
    mocks.showToast.mockReset()
    fetchMock = vi.fn((url, options = {}) => {
      if (url.includes('/driver_companies')) return json({ error: false, result: companies })
      if (url.endsWith('/plugins') && options.method === 'POST') return json(installResponse)
      return json({ error: false, result: [] })
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const renderController = async () => {
    render(<DeliveryServices UIComponent={UI} />)
    await waitFor(() => expect(controller.deliveryServicesState.companies).toHaveLength(1))
  }

  it('waits for the plugin to link and updates only the company list', async () => {
    fetchMock.mockImplementation((url, options = {}) => {
      if (url.endsWith('/plugins') && options.method === 'POST') {
        companies = [installedCompany]
        return json(installResponse)
      }
      if (url.includes('/driver_companies')) return json({ error: false, result: companies })
      return json({ error: false, result: [] })
    })
    await renderController()

    let result
    await act(async () => {
      result = await controller.handleInstallDeliveryService(pendingCompany)
    })

    const [, options] = fetchMock.mock.calls.find(([url, requestOptions]) => url.endsWith('/plugins') && requestOptions?.method === 'POST')
    expect(JSON.parse(options.body)).toEqual({ url: PLUGIN_ROOT })
    expect(result).toEqual({ installed: true, company: installedCompany })
    expect(controller.deliveryServicesState.companies[0].plugin_id).toBe(1222)
    expect(controller.deliveryServicesState.loading).toBe(false)
    expect(controller.installingPluginRoot).toBeNull()
  })

  it('tells the user the plugin is still finishing its setup when it does not link in time', async () => {
    await renderController()

    let result
    await act(async () => {
      result = await controller.handleInstallDeliveryService(pendingCompany)
    })

    expect(result).toEqual({ installed: true, company: null })
    expect(mocks.showToast).toHaveBeenLastCalledWith('info', 'The plugin is installed and still finishing its setup. Try again in a few seconds.')
    expect(controller.installingPluginRoot).toBeNull()
  })

  it('exposes the plugin being installed and ignores a second install meanwhile', async () => {
    let resolveInstall
    fetchMock.mockImplementation((url, options = {}) => {
      if (url.endsWith('/plugins') && options.method === 'POST') return new Promise(resolve => { resolveInstall = resolve })
      if (url.includes('/driver_companies')) return json({ error: false, result: companies })
      return json({ error: false, result: [] })
    })
    await renderController()

    let first
    let second
    await act(async () => {
      first = controller.handleInstallDeliveryService(pendingCompany)
      second = await controller.handleInstallDeliveryService({ ...pendingCompany, id: 133, plugin_root: 'https://doordash.plugins.orderingplus.com' })
    })

    expect(second).toEqual({ installed: false, company: null })
    expect(controller.installingPluginRoot).toBe(PLUGIN_ROOT)

    await act(async () => {
      companies = [installedCompany]
      resolveInstall({ json: async () => installResponse })
      await first
    })
    expect(controller.installingPluginRoot).toBeNull()
  })

  it('shows the API error and does not wait when the install fails', async () => {
    installResponse = { error: true, result: ['Plugin url is invalid'] }
    await renderController()
    const companiesRequestsBefore = fetchMock.mock.calls.filter(([url]) => url.includes('/driver_companies')).length

    let result
    await act(async () => {
      result = await controller.handleInstallDeliveryService(pendingCompany)
    })

    expect(result).toEqual({ installed: false, company: null })
    expect(controller.actionState.error).toEqual(['Plugin url is invalid'])
    expect(fetchMock.mock.calls.filter(([url]) => url.includes('/driver_companies')).length).toBe(companiesRequestsBefore)
  })

  it('does not call the install API when the company has no plugin root', async () => {
    await renderController()

    let result
    await act(async () => {
      result = await controller.handleInstallDeliveryService({ ...pendingCompany, plugin_root: null })
    })

    expect(result).toEqual({ installed: false, company: null })
    expect(fetchMock.mock.calls.some(([url, options]) => url.endsWith('/plugins') && options?.method === 'POST')).toBe(false)
    expect(controller.installingPluginRoot).toBeNull()
    expect(mocks.showToast).not.toHaveBeenCalled()
  })

  it('keeps the current list when the companies request fails during the wait', async () => {
    await renderController()
    fetchMock.mockImplementation((url, options = {}) => {
      if (url.endsWith('/plugins') && options.method === 'POST') return json(installResponse)
      if (url.includes('/driver_companies')) return Promise.reject(new Error('Network error'))
      return json({ error: false, result: [] })
    })

    let result
    await act(async () => {
      result = await controller.handleInstallDeliveryService(pendingCompany)
    })

    expect(result).toEqual({ installed: true, company: null })
    expect(controller.deliveryServicesState.companies).toEqual([pendingCompany])
    expect(mocks.showToast).toHaveBeenLastCalledWith('info', 'The plugin is installed and still finishing its setup. Try again in a few seconds.')
    expect(controller.installingPluginRoot).toBeNull()
  })
})
