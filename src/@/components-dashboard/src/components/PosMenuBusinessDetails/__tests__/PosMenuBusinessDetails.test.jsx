import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
import { PosMenuBusinessDetails } from '../index'

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  businessGet: vi.fn()
}))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', user: { id: 7, level: 0 } }]
}))
vi.mock('../../../contexts/ApiContext', () => {
  const endpoint = { asDashboard: () => endpoint, select: () => endpoint, get: (...args) => mocks.businessGet(...args) }
  const ordering = {
    root: 'https://api.test/v400/en/demo',
    project: 'demo',
    setAccessToken: () => ordering,
    businesses: () => endpoint
  }
  return { useApi: () => [ordering] }
})
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [null, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (key, fallback) => fallback]
}))

const business = { id: 42, name: 'Demo', third_party_integrations: [] }

let controller
const UI = (props) => {
  controller = props
  return null
}

const renderController = (props = {}) => render(
  <PosMenuBusinessDetails UIComponent={UI} businessId={42} business={business} {...props} />
)

describe('PosMenuBusinessDetails controller', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    controller = null
    fetchMock.mockReset()
    mocks.showToast.mockReset()
    mocks.businessGet.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('builds the plugin setup url from its template', async () => {
    renderController()
    const url = await controller.handleSync('/views/setup?project_code=@{project_code}&token=@{access_token}&business_id=@{business_id}', 'https://clover.plugins.test')
    expect(url).toBe('https://clover.plugins.test/views/setup?project_code=demo&token=test-token&business_id=42')
  })

  it('does not fall back to the legacy Clover page when the plugin has no setup url', async () => {
    renderController()
    expect(await controller.handleSync(undefined, 'https://other.plugins.test')).toBeNull()
    expect(await controller.handleSync('/setup', undefined)).toBeNull()
  })

  it('keeps an absolute or protocol-relative setup url instead of prepending the plugin root', async () => {
    renderController()
    expect(await controller.handleSync('https://calendly.com/pos/meet?business_id=@{business_id}', 'https://plugin.test')).toBe('https://calendly.com/pos/meet?business_id=42')
    expect(await controller.handleSync('//calendly.com/pos/meet', 'https://plugin.test')).toBe('//calendly.com/pos/meet')
  })

  it('connects the business and runs the callback on success', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ error: false, result: {} }) })
    const callback = vi.fn()
    renderController()

    let result
    await act(async () => {
      result = await controller.handleConnectBusiness(364, { enabled: true }, callback)
    })

    expect(result).toBe(true)
    expect(callback).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.test/v400/en/demo/business/42/third_party_integrations/364')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({ enabled: true })
    expect(mocks.showToast).toHaveBeenLastCalledWith('success', 'Business connected')
  })

  it('shows the API error and skips the callback when the connection is rejected', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ error: true, result: ['Plugin not configured'] }) })
    const callback = vi.fn()
    renderController()

    let result
    await act(async () => {
      result = await controller.handleConnectBusiness(364, { enabled: true }, callback)
    })

    expect(result).toBe(false)
    expect(callback).not.toHaveBeenCalled()
    expect(mocks.showToast).toHaveBeenLastCalledWith('error', 'Plugin not configured')
  })

  it('shows a readable error when the request fails or returns no JSON', async () => {
    renderController()

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await act(async () => {
      await controller.handleDisconnectBusiness(364, vi.fn())
    })
    expect(mocks.showToast).toHaveBeenLastCalledWith('error', 'The integration did not respond. Please try again.')

    fetchMock.mockResolvedValueOnce({ json: async () => { throw new SyntaxError('Unexpected token <') } })
    await act(async () => {
      await controller.handleConnectBusiness(364, { enabled: true }, vi.fn())
    })
    expect(mocks.showToast).toHaveBeenLastCalledWith('error', 'The integration did not respond. Please try again.')
    expect(controller.integrationActionLoading).toBe(false)
  })

  it('ignores a second request while one is in flight', async () => {
    let resolveFetch
    fetchMock.mockImplementation(() => new Promise(resolve => { resolveFetch = resolve }))
    renderController()

    let first
    let second
    await act(async () => {
      first = controller.handleConnectBusiness(364, { enabled: true }, vi.fn())
      second = await controller.handleConnectBusiness(364, { enabled: true }, vi.fn())
    })

    expect(second).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(controller.integrationActionLoading).toBe(true)

    await act(async () => {
      resolveFetch({ json: async () => ({ error: false, result: {} }) })
      await first
    })
    expect(controller.integrationActionLoading).toBe(false)
  })

  it('refreshes a loaded business without going back to the loading state', async () => {
    const refreshed = { ...business, third_party_integrations: [{ third_party_integration_id: 430 }] }
    let resolveGet
    mocks.businessGet.mockImplementation(() => new Promise(resolve => { resolveGet = resolve }))
    renderController()

    let refresh
    act(() => {
      refresh = controller.updateBusiness()
    })
    expect(controller.businessState.loading).toBe(false)
    expect(controller.businessState.business).toEqual(business)

    await act(async () => {
      resolveGet({ content: { error: false, result: refreshed } })
      await refresh
    })
    expect(controller.businessState.business).toEqual(refreshed)
  })

  it('exposes the API error when the business cannot be loaded', async () => {
    mocks.businessGet.mockResolvedValue({ content: { error: true, result: ['Business not found'] } })

    render(<PosMenuBusinessDetails UIComponent={UI} businessId={42} />)

    await waitFor(() => expect(controller.businessState.error).toEqual(['Business not found']))
    expect(controller.businessState.loading).toBe(false)
    expect(controller.businessState.business ?? null).toBeNull()
  })
})
