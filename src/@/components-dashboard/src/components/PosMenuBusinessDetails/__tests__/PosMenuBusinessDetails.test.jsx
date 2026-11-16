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

  describe('push actions and other failed requests', () => {
    const READABLE = 'The integration did not respond. Please try again.'

    it('says a push menu that never reached the API in words, not the browser text', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
      renderController()

      await act(async () => {
        await controller.handlePushAction(364, 'push_menu')
      })

      expect(mocks.showToast).toHaveBeenLastCalledWith('error', READABLE)
    })

    it('says it in words for the other browser wordings of a failed request', async () => {
      renderController()

      for (const text of ['NetworkError when attempting to fetch resource.', 'Load failed']) {
        fetchMock.mockRejectedValueOnce(new TypeError(text))
        await act(async () => {
          await controller.handlePushAction(364, 'push_menu')
        })
        expect(mocks.showToast).toHaveBeenLastCalledWith('error', READABLE)
      }
    })

    it('keeps showing the error the API returns for a push', async () => {
      fetchMock.mockResolvedValueOnce({ json: async () => ({ error: true, result: 'Menu is empty' }) })
      renderController()

      await act(async () => {
        await controller.handlePushAction(364, 'push_menu')
      })

      expect(mocks.showToast).toHaveBeenLastCalledWith('error', 'Menu is empty')
    })

    it('keeps the message of an error that is not a network failure', async () => {
      fetchMock.mockRejectedValueOnce(new SyntaxError('Unexpected token <'))
      renderController()

      await act(async () => {
        await controller.handlePushAction(364, 'push_menu')
      })

      expect(mocks.showToast).toHaveBeenLastCalledWith('error', 'Unexpected token <')
    })

    it('exposes the readable text, not the browser one, when a business action fails to reach the API', async () => {
      renderController()

      fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
      await act(async () => {
        await controller.handleDeleteBusiness()
      })
      expect(controller.actionStatus.error).toEqual([READABLE])

      fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
      await act(async () => {
        await controller.handleDuplicateBusiness()
      })
      expect(controller.actionStatus.error).toEqual([READABLE])

      fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
      await act(async () => {
        await controller.handleUpdateBusinessConfigs({ a: 1 }, 5)
      })
      expect(controller.actionStatus.error).toEqual([READABLE])
    })

    it('exposes the readable text when the business cannot be loaded or synced because the request failed', async () => {
      mocks.businessGet.mockRejectedValueOnce(new TypeError('Failed to fetch'))
      render(<PosMenuBusinessDetails UIComponent={UI} businessId={42} />)
      await waitFor(() => expect(controller.businessState.error).toEqual([READABLE]))

      fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
      await act(async () => {
        await controller.handleSyncEvent('business')
      })
      expect(controller.businessState.error).toEqual([READABLE])
    })
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
