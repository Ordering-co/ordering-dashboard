import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMenuImportRun } from '../useMenuImportRun'
import { IMPORT_STALE_AFTER_MS, RUN_EXPIRES_AFTER_MS, clearRun, saveRun } from '../menuImportRuns'

const ref = { project: 'demo', businessId: 42, source: 'doordash' }
const baseRun = {
  status: 'importing',
  startedAt: '2026-10-13T10:32:00.000Z',
  finishedAt: null,
  sourceUrl: null,
  appliedCount: null,
  errorMessage: null,
  menuBefore: null,
  menuAfter: null
}

describe('useMenuImportRun', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null when there is no run', () => {
    const { result } = renderHook(() => useMenuImportRun(ref))

    expect(result.current).toBeNull()
  })

  it('re-renders with the saved run and clears when the run is removed', () => {
    vi.useFakeTimers({ now: Date.parse(baseRun.startedAt) + 1000 })
    const { result } = renderHook(() => useMenuImportRun(ref))

    act(() => {
      saveRun(ref, baseRun)
    })
    expect(result.current).toEqual(baseRun)

    act(() => {
      clearRun(ref)
    })
    expect(result.current).toBeNull()
  })

  it('reads an importing run older than the stale window as unknown', () => {
    vi.useFakeTimers({ now: Date.parse(baseRun.startedAt) + IMPORT_STALE_AFTER_MS + 1 })
    saveRun(ref, baseRun)

    const { result } = renderHook(() => useMenuImportRun(ref))

    expect(result.current.status).toBe('unknown')
    expect(result.current.startedAt).toBe(baseRun.startedAt)
  })

  it('keeps a finished run as stored past the stale window', () => {
    const finishedAt = '2026-10-13T10:41:00.000Z'
    // Past the stale window, but well inside any configured expiry.
    vi.useFakeTimers({ now: Date.parse(finishedAt) + IMPORT_STALE_AFTER_MS + 1 })
    saveRun(ref, { ...baseRun, status: 'success', finishedAt })

    const { result } = renderHook(() => useMenuImportRun(ref))

    expect(result.current.status).toBe('success')
  })

  it('hides any run a day after its last activity, but keeps a recently checked one', () => {
    const finishedAt = '2026-10-13T10:41:00.000Z'
    const now = Date.parse(finishedAt) + RUN_EXPIRES_AFTER_MS + 1
    vi.useFakeTimers({ now })
    saveRun(ref, { ...baseRun, status: 'success', finishedAt })

    const { result, rerender } = renderHook(() => useMenuImportRun(ref))
    expect(result.current).toBeNull()

    act(() => {
      saveRun(ref, { ...baseRun, status: 'failed', finishedAt, errorMessage: 'Boom' })
    })
    rerender()
    expect(result.current).toBeNull()

    act(() => {
      saveRun(ref, {
        ...baseRun,
        status: 'unknown',
        finishedAt,
        checkedAt: new Date(now - 60 * 1000).toISOString(),
        menuAfter: { categories: 3, products: 20 }
      })
    })
    rerender()
    expect(result.current.status).toBe('unknown')
  })
})
