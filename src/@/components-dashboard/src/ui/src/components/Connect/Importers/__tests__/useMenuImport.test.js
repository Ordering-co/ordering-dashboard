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

  // redesign IM-C2 (IM-03): a network failure reads as words, not «Failed to fetch» (main's lost-connection message)
  it('reports a network failure in words, to onError and in the error', async () => {
    global.fetch.mockRejectedValue(new TypeError('Failed to fetch'))
    const onError = vi.fn()
    const { result } = renderHook(() => useMenuImport('doordash'))

    await act(async () => {
      await result.current.triggerImport({ doordashUrl: 'https://www.doordash.com/store/x', businessIds: [42] }, { onError })
    })

    const message = 'We lost the connection to the importer. The import may still be running.'
    expect(result.current.error.message).toBe(message)
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message }))
    expect(JSON.stringify(onError.mock.calls)).not.toContain('Failed to fetch')
    expect(result.current.isImporting).toBe(false)
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

// one import to several stores. The service answers with synthetic fixtures here, never a real project.
describe('useMenuImport — several stores', () => {
  const params = {
    doordashUrl: 'https://www.doordash.com/store/test',
    businessIds: [1, 2, 3],
    project: 'demo',
    orderingApiBaseUrl: 'https://api.example.com'
  }
  const answer = (status, body) => global.fetch.mockResolvedValue({ ok: status < 300, status, json: async () => body })
  const run = async () => {
    const hook = renderHook(() => useMenuImport('doordash'))
    await act(async () => { await hook.result.current.triggerImport(params) })
    return hook.result.current
  }
  const lastRunOf = (businessId) => saveRun.mock.calls.filter(([ref]) => ref.businessId === businessId).at(-1)?.[1]

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    menuSnapshotGet.mockResolvedValue({
      content: { error: false, result: { id: 1, categories: [{ id: 1 }], available_products_count: 5 } }
    })
  })

  it('sends every store in businessIds, and a full success keeps a run per store', async () => {
    answer(200, { success: true, appliedCount: 3, jobId: 'job-3' })
    const current = await run()

    expect(JSON.parse(global.fetch.mock.calls[0][1].body).businessIds).toEqual([1, 2, 3])
    expect(current.status).toBe('success')
    expect(current.result).toEqual({ appliedCount: 3, jobId: 'job-3' })
    for (const id of [1, 2, 3]) {
      expect(lastRunOf(id)).toEqual(expect.objectContaining({ status: 'success', menuBefore: { categories: 1, products: 5 }, menuAfter: { categories: 1, products: 5 } }))
    }
    expect(logMenuImportSync).toHaveBeenCalledWith({ token: 'test-token', source: 'doordash', params })
  })

  it('a partial failure says which stores failed and why, and keeps the stores that worked', async () => {
    answer(200, {
      success: false,
      appliedCount: 2,
      error: 'Partial failure: 2/3 stores updated.',
      partialFailures: [{ businessId: 2, error: "{'error': True, 'result': ['Category name is required']}" }]
    })
    const current = await run()

    expect(current.status).toBe('partial')
    expect(current.result).toEqual({
      appliedCount: 2,
      total: 3,
      failed: [{ businessId: 2, message: 'Ordering rejected 1 entry in this menu. First reason: Category name is required Contact support; importing again will fail the same way.' }],
      pending: [],
      quotaMessage: null
    })
    expect(lastRunOf(1).status).toBe('success')
    expect(lastRunOf(3).status).toBe('success')
    expect(lastRunOf(2)).toEqual(expect.objectContaining({ status: 'failed', errorMessage: expect.stringContaining('Ordering rejected 1 entry') }))
    expect(logMenuImportSync).toHaveBeenCalledWith({ token: 'test-token', source: 'doordash', params: { ...params, businessIds: [1, 3] } })
    expect(JSON.stringify(saveRun.mock.calls)).not.toContain("'error': True")
  })

  it('a quota cut after some stores says how many were applied and which were left', async () => {
    answer(200, { success: false, appliedCount: 1, error: 'MENU_IMPORT_RATE_LIMITED applied=1 retry_after=30', partialFailures: [] })
    const current = await run()

    expect(current.status).toBe('partial')
    expect(current.result).toEqual(expect.objectContaining({
      appliedCount: 1,
      total: 3,
      failed: [],
      pending: [2, 3],
      quotaMessage: 'Ordering updated 1 store, then reached its API limit. Try again in 30 seconds.'
    }))
    expect(lastRunOf(1).status).toBe('success')
    expect(lastRunOf(2)).toEqual(expect.objectContaining({ status: 'failed', errorMessage: current.result.quotaMessage }))
    expect(lastRunOf(3).status).toBe('failed')
  })

  it('a 429 before any store leaves them all pending, with the quota message', async () => {
    answer(429, { detail: 'MENU_IMPORT_RATE_LIMITED applied=0 retry_after=60' })
    const current = await run()

    expect(current.status).toBe('partial')
    expect(current.result).toEqual(expect.objectContaining({
      appliedCount: 0,
      total: 3,
      pending: [1, 2, 3],
      quotaMessage: 'This project reached its Ordering API limit. Try again in 60 seconds.'
    }))
    expect(logMenuImportSync).not.toHaveBeenCalled()
  })

  it('a 502 because Ordering refused every store marks each store failed with the reason', async () => {
    answer(502, { detail: 'Failed to send menu to Ordering API: HTTP 500' })
    const current = await run()

    expect(current.status).toBe('partial')
    expect(current.result.appliedCount).toBe(0)
    expect(current.result.failed.map(({ businessId }) => businessId)).toEqual([1, 2, 3])
    expect(current.result.failed[0].message).toBe('Ordering did not accept the menu for this store. Try again or contact support.')
    expect(lastRunOf(3).status).toBe('failed')
  })

  it('a 502 of the source (not of the stores) stays a failed import, as with one store', async () => {
    answer(502, { detail: 'Upstream scraper error' })
    const current = await run()

    expect(current.status).toBe('failed')
    expect(current.result).toBeNull()
  })

  // review of #437 (2): a queued import or a count short of the stores is not a success, and nothing is recorded as imported
  it.each([
    ['a 202 with a job id', 202, { jobId: 'job-9' }, 'job-9'],
    ['a success that counts fewer stores', 200, { success: true, appliedCount: 2 }, null]
  ])('%s leaves the stores importing and records nothing', async (_name, status, body, jobId) => {
    answer(status, body)
    const current = await run()

    expect(current.status).toBe('queued')
    expect(current.result).toEqual({ jobId, total: 3 })
    expect(lastRunOf(1).status).toBe('importing')
    expect(logMenuImportSync).not.toHaveBeenCalled()
    expect(showToast).not.toHaveBeenCalled()
  })

  // review of #437 (4): the menu reads before and after go one at a time, not in a burst against the quota
  it('reads the menus of the stores one at a time', async () => {
    let inFlight = 0
    let most = 0
    menuSnapshotGet.mockImplementation(async () => {
      inFlight += 1
      most = Math.max(most, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 0))
      inFlight -= 1
      return { content: { error: false, result: { id: 1, categories: [], available_products_count: 0 } } }
    })
    answer(200, { success: true, appliedCount: 3 })
    await run()

    expect(menuSnapshotGet).toHaveBeenCalledTimes(6)
    expect(most).toBe(1)
  })

  it('with one store a 429 stays a failed import with the same message as today', async () => {
    answer(429, { detail: 'MENU_IMPORT_RATE_LIMITED applied=0 retry_after=60' })
    const hook = renderHook(() => useMenuImport('doordash'))
    await act(async () => { await hook.result.current.triggerImport({ ...params, businessIds: [1] }) })

    expect(hook.result.current.status).toBe('failed')
    expect(hook.result.current.error).toEqual({ message: 'This project reached its Ordering API limit. Try again in 60 seconds.', retryable: true })
  })
})
