import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({
  ordering: { project: 'demo', root: 'https://api.test/v400/en/demo' },
  token: 'session-token',
  user: { id: 7, level: 0 }
}))

vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [runtime.ordering]
}))
vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: runtime.token, user: runtime.user }]
}))

import { useIntegrationsCatalog } from '../useIntegrationsCatalog'

describe('useIntegrationsCatalog source changes', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    runtime.ordering = { project: 'demo', root: 'https://api.test/v400/en/demo' }
  })

  it('loads every Builder page with authorization and a shared abort signal', async () => {
    const fetchMock = vi.fn(async url => {
      const page = Number(new URL(url).searchParams.get('page'))
      return { json: async () => ({ error: false, result: [{ id: page }], pagination: { total_pages: 2 } }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useIntegrationsCatalog({ loadBuilderApps: true }))

    await act(async () => { await result.current.ensure() })

    expect(result.current.builderApps).toEqual([{ id: 1 }, { id: 2 }])
    expect(result.current.errors.builderApps).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const signal = fetchMock.mock.calls[0][1].signal
    expect(signal).toBeInstanceOf(AbortSignal)
    for (const [url, options] of fetchMock.mock.calls) {
      expect(new URL(url).searchParams.get('page_size')).toBe('50')
      expect(options.headers.Authorization).toBe('Bearer session-token')
      expect(options.signal).toBe(signal)
    }
  })

  it('reloads previously loaded sources when a new authorized source becomes enabled', async () => {
    const requested = []
    vi.stubGlobal('fetch', vi.fn(async url => {
      requested.push(String(url))
      return { json: async () => ({ error: false, result: [] }) }
    }))
    const { result, rerender } = renderHook(
      props => useIntegrationsCatalog({ enabled: false, ...props }),
      { initialProps: { loadDeliveryCompanies: true, loadIntegrations: false } }
    )

    await act(async () => { await result.current.ensure() })
    expect(requested).toHaveLength(1)
    expect(requested[0]).toContain('/driver_companies?where=')

    rerender({ loadDeliveryCompanies: true, loadIntegrations: true })
    await act(async () => { await result.current.ensure() })

    expect(requested).toContain('https://api.test/v400/en/demo/third_party_integrations')
    expect(requested.filter(url => url.includes('/driver_companies?where=')).length).toBe(2)
    expect(result.current.loaded).toBe(true)
  })

  it('reloads authorized integration sources when the API root changes', async () => {
    const requested = []
    vi.stubGlobal('fetch', vi.fn(async url => {
      requested.push(String(url))
      return { json: async () => ({ error: false, result: [] }) }
    }))
    const { result, rerender } = renderHook(
      props => useIntegrationsCatalog({ enabled: false, loadDeliveryCompanies: true, ...props }),
      { initialProps: {} }
    )

    await act(async () => { await result.current.ensure() })
    runtime.ordering = { project: 'demo', root: 'https://api-next.test/v400/en/demo' }
    rerender({})
    await act(async () => { await result.current.ensure() })

    expect(requested.some(url => url.startsWith('https://api-next.test/v400/en/demo/driver_companies?where='))).toBe(true)
  })
})
