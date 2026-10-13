import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchBusinessSearchRows, fetchRecordSearchWithSlowPolicy } from '../dashboardSearchRequests'
import { RECORD_SEARCH_SLOW_MS } from '../../../utils/commandPaletteRecords'
import { getCommandPaletteSlowKey, readCommandPaletteSlowSearch } from '../../../utils/commandPaletteSearchMode'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  window.localStorage.removeItem(getCommandPaletteSlowKey('slow-policy-test'))
})

describe('shared Dashboard business search request', () => {
  it('extracts and ranks SDK content.result while preserving the authorized slug', async () => {
    const request = {
      select: vi.fn(() => request),
      asDashboard: vi.fn(() => request),
      where: vi.fn(() => request),
      get: vi.fn(async () => ({
        content: {
          error: false,
          result: [
            { id: 2, name: 'Pizza Centro', slug: 'pizza-centro', enabled: true },
            { id: 1, name: 'Pizza', slug: 'pizza', enabled: true }
          ]
        }
      }))
    }
    const ordering = {
      project: 'demo',
      setAccessToken: vi.fn(() => ordering),
      businesses: vi.fn(() => request)
    }

    const rows = await fetchBusinessSearchRows({
      ordering,
      token: 'session-token',
      user: { id: 7, level: 0 },
      term: 'pizza',
      limit: 8
    })

    expect(rows.map(row => [row.id, row.slug])).toEqual([[1, 'pizza'], [2, 'pizza-centro']])
    expect(request.get).toHaveBeenCalledWith({
      query: { page: 1, page_size: 8 },
      cancelToken: expect.any(Object)
    })
  })
})

describe('shared record search policy', () => {
  it('marks an extended request slow using the same persisted CommandK policy', async () => {
    vi.useFakeTimers()
    let resolveFetch
    const pendingFetch = new Promise(resolve => { resolveFetch = resolve })
    vi.stubGlobal('fetch', vi.fn(() => pendingFetch))

    const search = fetchRecordSearchWithSlowPolicy({
      project: 'slow-policy-test',
      entity: 'users',
      ordering: { project: 'slow-policy-test', root: 'https://api.test/v400/en/demo' },
      token: 'session-token',
      query: 'ana',
      levels: [3],
      extended: true
    })

    await vi.advanceTimersByTimeAsync(RECORD_SEARCH_SLOW_MS)
    expect(readCommandPaletteSlowSearch('slow-policy-test').users).toBe(true)
    resolveFetch({ json: async () => ({ error: false, result: [] }) })
    await expect(search).resolves.toEqual([])
  })
})
