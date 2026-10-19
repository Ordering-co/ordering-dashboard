/* eslint-disable import/first */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const { showToast } = vi.hoisted(() => ({
  showToast: vi.fn()
}))

const { menuSnapshotGet } = vi.hoisted(() => ({
  menuSnapshotGet: vi.fn()
}))

vi.mock('~components', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ token: 'test-token', user: { email: 'owner@test.com' } }],
  useApi: () => [{
    project: 'demo',
    root: 'https://api.example.com',
    businesses: () => ({ select: () => ({ get: menuSnapshotGet }) })
  }],
  useToast: () => [null, { showToast }],
  ToastType: {
    Error: 'ERROR',
    Success: 'SUCCESS'
  }
}))

vi.mock('../menuImportConfig.js', () => ({
  getMenuImportApiUrl: () => 'https://menu-import.test'
}))

const { logMenuImportSync } = vi.hoisted(() => ({
  logMenuImportSync: vi.fn()
}))

vi.mock('../logMenuImportSync.js', async () => {
  const actual = await vi.importActual('../logMenuImportSync.js')
  return { ...actual, logMenuImportSync }
})

const { saveRun } = vi.hoisted(() => ({
  saveRun: vi.fn()
}))

vi.mock('../menuImportRuns.js', async () => {
  const actual = await vi.importActual('../menuImportRuns.js')
  return { ...actual, saveRun }
})

import { useMenuImport } from '../useMenuImport'

const runRef = { project: 'demo', businessId: 42, source: 'doordash' }

describe('useMenuImport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    menuSnapshotGet.mockResolvedValue({
      content: { error: false, result: { id: 42, categories: [{ id: 1 }, { id: 2 }], available_products_count: 20 } }
    })
  })

  it('posts import params to the menu-import service', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    })

    const { result } = renderHook(() => useMenuImport('doordash'))
    const params = {
      doordashUrl: 'https://www.doordash.com/store/test',
      businessIds: [42],
      project: 'demo',
      orderingApiBaseUrl: 'https://api.example.com',
      useFixture: false
    }

    await act(async () => {
      await result.current.triggerImport(params)
    })

    expect(global.fetch).toHaveBeenCalledWith(
      'https://menu-import.test/api/import/doordash',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token'
        })
      })
    )
    expect(logMenuImportSync).toHaveBeenCalledWith({
      token: 'test-token',
      source: 'doordash',
      params
    })
    expect(showToast).toHaveBeenCalledWith(
      'SUCCESS',
      'Menu imported successfully'
    )
  })

  it('strips gloriafoodMasterKey from the menu-import API body', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    })

    const { result } = renderHook(() => useMenuImport('gloriafood'))

    await act(async () => {
      await result.current.triggerImport({
        gloriafoodRestaurantKey: 'res-1',
        gloriafoodMasterKey: 'mas-1',
        ignoreGloriaFoodForceLimits: true,
        businessIds: [7],
        project: 'demo',
        orderingApiBaseUrl: 'https://api.example.com'
      })
    })

    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body.gloriafoodRestaurantKey).toBe('res-1')
    expect(body.gloriafoodMasterKey).toBeUndefined()
    expect(body.ignoreGloriaFoodForceLimits).toBe(true)
    expect(logMenuImportSync).toHaveBeenCalled()
  })

  it('records a successful import with the applied count', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, appliedCount: 2, jobId: 'job-1' })
    })

    const { result } = renderHook(() => useMenuImport('doordash'))

    await act(async () => {
      await result.current.triggerImport({
        doordashUrl: 'https://www.doordash.com/store/test',
        businessIds: [42],
        project: 'demo',
        orderingApiBaseUrl: 'https://api.example.com'
      })
    })

    expect(result.current.status).toBe('success')
    expect(result.current.result).toEqual({ appliedCount: 2, jobId: 'job-1' })
    expect(result.current.error).toBeNull()
    expect(result.current.startedAt).toEqual(expect.any(String))
  })

  it('marks a 400 as a failed import that should not be retried, without an error toast', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ detail: 'Bad request' })
    })

    const { result } = renderHook(() => useMenuImport('doordash'))

    await act(async () => {
      await result.current.triggerImport({
        doordashUrl: 'https://www.doordash.com/store/test',
        businessIds: [42],
        project: 'demo',
        orderingApiBaseUrl: 'https://api.example.com'
      })
    })

    expect(result.current.status).toBe('failed')
    expect(result.current.error.retryable).toBe(false)
    expect(result.current.error.message).toBe(
      'We could not read a menu from that store URL. Check that the URL is right and the store is open, then try again.'
    )
    expect(showToast).not.toHaveBeenCalledWith('ERROR', expect.anything())
  })

  it('turns an Ordering rejection into a readable failed import', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({
        detail: "Failed to send menu to Ordering API: {'error': True, 'result': ['options/3: The external id may not be greater than 255 characters']}"
      })
    })

    const { result } = renderHook(() => useMenuImport('ubereats'))

    await act(async () => {
      await result.current.triggerImport({
        url: 'https://www.ubereats.com/store/test',
        businessIds: [42],
        project: 'demo',
        orderingApiBaseUrl: 'https://api.example.com'
      })
    })

    expect(result.current.status).toBe('failed')
    expect(result.current.error.retryable).toBe(false)
    expect(result.current.error.message).toContain('Ordering rejected 1 entry')
    expect(result.current.error.message).not.toContain("{'error'")
    expect(showToast).not.toHaveBeenCalledWith('ERROR', expect.anything())
  })

  it('marks a dropped connection as unknown', async () => {
    global.fetch.mockRejectedValue(new TypeError('Failed to fetch'))

    const { result } = renderHook(() => useMenuImport('doordash'))

    await act(async () => {
      await result.current.triggerImport({
        doordashUrl: 'https://www.doordash.com/store/test',
        businessIds: [42],
        project: 'demo',
        orderingApiBaseUrl: 'https://api.example.com'
      })
    })

    expect(result.current.status).toBe('unknown')
    expect(result.current.error.retryable).toBe(true)
    expect(showToast).not.toHaveBeenCalledWith('ERROR', expect.anything())
  })

  it('marks a 504 without JSON as unknown', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 504,
      json: async () => {
        throw new Error('not json')
      }
    })

    const { result } = renderHook(() => useMenuImport('doordash'))

    await act(async () => {
      await result.current.triggerImport({
        doordashUrl: 'https://www.doordash.com/store/test',
        businessIds: [42],
        project: 'demo',
        orderingApiBaseUrl: 'https://api.example.com'
      })
    })

    expect(result.current.status).toBe('unknown')
    expect(result.current.error.retryable).toBe(true)
  })

  it('persists the run as importing with the menu before, then success with the menu after', async () => {
    menuSnapshotGet
      .mockResolvedValueOnce({
        content: { error: false, result: { id: 42, categories: [{ id: 1 }, { id: 2 }], available_products_count: 20 } }
      })
      .mockResolvedValueOnce({
        content: { error: false, result: { id: 42, categories: Array.from({ length: 12 }, (_, id) => ({ id })), available_products_count: 120 } }
      })
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, appliedCount: 1, jobId: 'job-1' })
    })

    const { result } = renderHook(() => useMenuImport('doordash'))

    await act(async () => {
      await result.current.triggerImport({
        doordashUrl: 'https://www.doordash.com/store/test',
        businessIds: [42],
        project: 'demo',
        orderingApiBaseUrl: 'https://api.example.com'
      })
    })

    expect(saveRun).toHaveBeenCalledTimes(2)
    expect(saveRun.mock.calls[0][0]).toEqual(runRef)
    expect(saveRun.mock.calls[0][1]).toEqual({
      status: 'importing',
      startedAt: expect.any(String),
      finishedAt: null,
      sourceUrl: 'https://www.doordash.com/store/test',
      appliedCount: null,
      errorMessage: null,
      menuBefore: { categories: 2, products: 20 },
      menuAfter: null
    })
    expect(saveRun.mock.calls[1][1]).toEqual(expect.objectContaining({
      status: 'success',
      finishedAt: expect.any(String),
      appliedCount: 1,
      menuBefore: { categories: 2, products: 20 },
      menuAfter: { categories: 12, products: 120 }
    }))
  })

  it('persists a failed run with the readable message only', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ detail: 'Bad request' })
    })

    const { result } = renderHook(() => useMenuImport('doordash'))

    await act(async () => {
      await result.current.triggerImport({
        doordashUrl: 'https://www.doordash.com/store/test',
        businessIds: [42],
        project: 'demo',
        orderingApiBaseUrl: 'https://api.example.com'
      })
    })

    expect(saveRun).toHaveBeenLastCalledWith(runRef, expect.objectContaining({
      status: 'failed',
      finishedAt: expect.any(String),
      errorMessage: 'We could not read a menu from that store URL. Check that the URL is right and the store is open, then try again.'
    }))
    expect(JSON.stringify(saveRun.mock.calls)).not.toContain('Bad request')
    expect(JSON.stringify(saveRun.mock.calls)).not.toContain('test-token')
  })

  it('persists an unknown run when the connection drops', async () => {
    global.fetch.mockRejectedValue(new TypeError('Failed to fetch'))

    const { result } = renderHook(() => useMenuImport('doordash'))

    await act(async () => {
      await result.current.triggerImport({
        doordashUrl: 'https://www.doordash.com/store/test',
        businessIds: [42],
        project: 'demo',
        orderingApiBaseUrl: 'https://api.example.com'
      })
    })

    expect(saveRun).toHaveBeenLastCalledWith(runRef, expect.objectContaining({ status: 'unknown' }))
  })

  it('does not persist a run without a business id', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) })

    const { result } = renderHook(() => useMenuImport('doordash'))

    await act(async () => {
      await result.current.triggerImport({
        doordashUrl: 'https://www.doordash.com/store/test',
        businessIds: [],
        project: 'demo',
        orderingApiBaseUrl: 'https://api.example.com'
      })
    })

    expect(saveRun).not.toHaveBeenCalled()
    expect(result.current.status).toBe('success')
  })

  it('reset returns the import to idle', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, appliedCount: 1, jobId: 'job-2' })
    })

    const { result } = renderHook(() => useMenuImport('doordash'))

    await act(async () => {
      await result.current.triggerImport({
        doordashUrl: 'https://www.doordash.com/store/test',
        businessIds: [42],
        project: 'demo',
        orderingApiBaseUrl: 'https://api.example.com'
      })
    })

    act(() => {
      result.current.reset()
    })

    expect(result.current.status).toBe('idle')
    expect(result.current.result).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.startedAt).toBeNull()
  })
})
