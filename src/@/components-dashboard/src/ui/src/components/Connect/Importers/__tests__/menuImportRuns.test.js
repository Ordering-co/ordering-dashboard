import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  IMPORT_STALE_AFTER_MS,
  RUN_EXPIRES_AFTER_HOURS,
  RUN_EXPIRES_AFTER_MS,
  clearRun,
  getRun,
  isRunExpired,
  isRunResolved,
  menuGrew,
  resolveRunStatus,
  saveRun,
  subscribe
} from '../menuImportRuns'

const ref = { project: 'demo', businessId: 42, source: 'doordash' }
const importingRun = {
  status: 'importing',
  startedAt: '2026-10-13T10:32:00.000Z',
  finishedAt: null,
  sourceUrl: 'https://www.doordash.com/store/test',
  appliedCount: null,
  errorMessage: null,
  menuBefore: { categories: 3, products: 20 },
  menuAfter: null
}

describe('menuImportRuns', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('round-trips save, get and clear for one business and source', () => {
    expect(getRun(ref)).toBeNull()

    saveRun(ref, importingRun)
    expect(getRun(ref)).toEqual(importingRun)
    expect(window.localStorage.getItem('menu-import-runs:demo')).toContain('"42:doordash"')

    clearRun(ref)
    expect(getRun(ref)).toBeNull()
  })

  it('returns the same reference while storage is unchanged', () => {
    saveRun(ref, importingRun)

    expect(getRun(ref)).toBe(getRun(ref))
  })

  it('yields no run when the stored JSON is corrupt', () => {
    window.localStorage.setItem('menu-import-runs:demo', '{not json')

    expect(getRun(ref)).toBeNull()
  })

  it('scopes records by project', () => {
    saveRun(ref, importingRun)

    expect(getRun({ ...ref, project: 'other' })).toBeNull()
    expect(getRun({ ...ref, source: 'ubereats' })).toBeNull()
  })

  it('returns null without a project, business or source', () => {
    expect(getRun({ project: '', businessId: 42, source: 'doordash' })).toBeNull()
    expect(getRun({ project: 'demo', businessId: null, source: 'doordash' })).toBeNull()
    expect(getRun({ project: 'demo', businessId: 42, source: '' })).toBeNull()
  })

  it('notifies subscribers on save and clear until unsubscribed', () => {
    const listener = vi.fn()
    const unsubscribe = subscribe(listener)

    saveRun(ref, importingRun)
    clearRun(ref)
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
    saveRun(ref, importingRun)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('reads an importing run older than the stale window as unknown', () => {
    const startedAt = Date.parse(importingRun.startedAt)

    expect(resolveRunStatus(importingRun, startedAt + IMPORT_STALE_AFTER_MS - 1)).toBe('importing')
    expect(resolveRunStatus(importingRun, startedAt + IMPORT_STALE_AFTER_MS + 1)).toBe('unknown')
    expect(resolveRunStatus({ ...importingRun, status: 'success' }, startedAt + IMPORT_STALE_AFTER_MS + 1)).toBe('success')
  })

  it('exposes a 15 minute stale window', () => {
    expect(IMPORT_STALE_AFTER_MS).toBe(15 * 60 * 1000)
  })

  describe('resolution and expiry', () => {
    const finishedAt = '2026-10-13T10:41:00.000Z'
    const checkedAt = '2026-10-13T11:05:00.000Z'
    const successRun = { ...importingRun, status: 'success', finishedAt, menuAfter: { categories: 3, products: 25 } }
    const grownRun = { ...importingRun, status: 'unknown', checkedAt, menuAfter: { categories: 3, products: 36 } }
    const unchangedRun = { ...importingRun, status: 'unknown', checkedAt, menuAfter: { categories: 3, products: 20 } }
    const failedRun = { ...importingRun, status: 'failed', finishedAt, errorMessage: 'Boom' }

    it('tells when a menu grew in products or categories', () => {
      expect(menuGrew({ categories: 3, products: 20 }, { categories: 3, products: 21 })).toBe(true)
      expect(menuGrew({ categories: 3, products: 20 }, { categories: 4, products: 20 })).toBe(true)
      expect(menuGrew({ categories: 3, products: 20 }, { categories: 3, products: 20 })).toBe(false)
      expect(menuGrew(null, { categories: 3, products: 20 })).toBe(false)
      expect(menuGrew({ categories: 3, products: 20 }, null)).toBe(false)
    })

    it('resolves a success run and a lost-connection run whose menu grew after a check', () => {
      expect(isRunResolved(successRun)).toBe(true)
      expect(isRunResolved(grownRun)).toBe(true)
      expect(isRunResolved(unchangedRun)).toBe(false)
      expect(isRunResolved({ ...importingRun, status: 'unknown' })).toBe(false)
      expect(isRunResolved(failedRun)).toBe(false)
      expect(isRunResolved(importingRun)).toBe(false)
    })

    it('expires every run a day after its last activity', () => {
      const day = RUN_EXPIRES_AFTER_MS
      const startedAt = Date.parse(importingRun.startedAt)
      expect(RUN_EXPIRES_AFTER_HOURS).toBeGreaterThan(0)
      expect(RUN_EXPIRES_AFTER_MS).toBe(RUN_EXPIRES_AFTER_HOURS * 60 * 60 * 1000)

      expect(isRunExpired(successRun, Date.parse(finishedAt) + day - 1)).toBe(false)
      expect(isRunExpired(successRun, Date.parse(finishedAt) + day + 1)).toBe(true)
      expect(isRunExpired(grownRun, Date.parse(checkedAt) + day - 1)).toBe(false)
      expect(isRunExpired(grownRun, Date.parse(checkedAt) + day + 1)).toBe(true)
      // Failed: a day after it failed.
      expect(isRunExpired(failedRun, Date.parse(finishedAt) + day - 1)).toBe(false)
      expect(isRunExpired(failedRun, Date.parse(finishedAt) + day + 1)).toBe(true)
      // Lost connection without growth: a day after the last check keeps it alive.
      expect(isRunExpired(unchangedRun, Date.parse(checkedAt) + day - 1)).toBe(false)
      expect(isRunExpired(unchangedRun, Date.parse(checkedAt) + day + 1)).toBe(true)
      // Never checked: a day after it started.
      expect(isRunExpired(importingRun, startedAt + day - 1)).toBe(false)
      expect(isRunExpired(importingRun, startedAt + day + 1)).toBe(true)
      expect(isRunExpired(null)).toBe(false)
      expect(isRunExpired({ status: 'failed' })).toBe(true)
    })
  })
})
