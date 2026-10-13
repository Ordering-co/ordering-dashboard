import { describe, expect, it, vi } from 'vitest'
import { BUILDER_MAX_PAGE_SIZE, fetchAllPages, withPage } from '../fetchAllPages'

const ROOT = 'https://apiv4.ordering.co/v400/en/demo/builder/apps/7/base_constants'
const OPTIONS = { method: 'GET', headers: { Authorization: 'Bearer token' } }

// A paginated Builder list as api-core answers it (getPaginationByTotal).
const paginatedApi = (items, { failPage } = {}) => vi.fn(async (url) => {
  const query = new URL(url).searchParams
  const page = Number(query.get('page'))
  const pageSize = Number(query.get('page_size'))
  const totalPages = Math.ceil(items.length / pageSize) || 1
  const body = page === failPage
    ? { error: true, result: ['ERROR_PAGE'] }
    : {
        error: false,
        result: items.slice((page - 1) * pageSize, page * pageSize),
        pagination: { total: items.length, current_page: page, page_size: pageSize, total_pages: totalPages }
      }
  return { json: async () => body }
})

const constants = Array.from({ length: 123 }, (_, index) => ({ id: index + 1, code: `CONSTANT_${index + 1}` }))

describe('withPage', () => {
  it('adds the page to a URL with or without a query', () => {
    expect(withPage('https://api/x', 2, 50)).toBe('https://api/x?page=2&page_size=50')
    expect(withPage('https://api/x?mode=dashboard', 1, 50)).toBe('https://api/x?mode=dashboard&page=1&page_size=50')
  })
})

describe('fetchAllPages', () => {
  it('reads every page of a list longer than one page, in order', async () => {
    const fetchImpl = paginatedApi(constants)
    const { error, result } = await fetchAllPages(ROOT, OPTIONS, { fetchImpl })

    expect(error).toBe(false)
    expect(result).toHaveLength(123)
    expect(result.map(item => item.id)).toEqual(constants.map(item => item.id))
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(fetchImpl.mock.calls.map(([url]) => new URL(url).searchParams.get('page'))).toEqual(['1', '2', '3'])
    fetchImpl.mock.calls.forEach(([url, options]) => {
      expect(new URL(url).searchParams.get('page_size')).toBe(String(BUILDER_MAX_PAGE_SIZE))
      expect(options).toBe(OPTIONS)
    })
  })

  it('stops after the first page when the list fits in it', async () => {
    const fetchImpl = paginatedApi(constants.slice(0, 12))
    const { result } = await fetchAllPages(ROOT, OPTIONS, { fetchImpl })
    expect(result).toHaveLength(12)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('answers an empty list as empty', async () => {
    const fetchImpl = paginatedApi([])
    expect(await fetchAllPages(ROOT, OPTIONS, { fetchImpl })).toEqual({ error: false, result: [] })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('takes a list without pagination as complete', async () => {
    const fetchImpl = vi.fn(async () => ({ json: async () => ({ error: false, result: constants }) }))
    const { result } = await fetchAllPages(ROOT, OPTIONS, { fetchImpl })
    expect(result).toHaveLength(123)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('answers the error of the first page', async () => {
    const fetchImpl = vi.fn(async () => ({ json: async () => ({ error: true, result: ['INVALID_TOKEN'] }) }))
    expect(await fetchAllPages(ROOT, OPTIONS, { fetchImpl })).toEqual({ error: true, result: ['INVALID_TOKEN'] })
  })

  it('answers the error of a later page instead of a partial list', async () => {
    const fetchImpl = paginatedApi(constants, { failPage: 2 })
    expect(await fetchAllPages(ROOT, OPTIONS, { fetchImpl })).toEqual({ error: true, result: ['ERROR_PAGE'] })
  })

  it('lets network errors reach the caller', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('Failed to fetch') })
    await expect(fetchAllPages(ROOT, OPTIONS, { fetchImpl })).rejects.toThrow('Failed to fetch')
  })
})
