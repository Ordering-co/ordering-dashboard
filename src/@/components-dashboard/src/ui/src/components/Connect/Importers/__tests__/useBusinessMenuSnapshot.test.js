/* eslint-disable import/first */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const { get, select, businesses } = vi.hoisted(() => {
  const get = vi.fn()
  const select = vi.fn(() => ({ get }))
  const businesses = vi.fn(() => ({ select }))
  return { get, select, businesses }
})

vi.mock('~components', () => ({
  useApi: () => [{ project: 'demo', root: 'https://api.example.com', businesses }]
}))

import { fetchBusinessMenuSnapshot, useBusinessMenuSnapshot } from '../useBusinessMenuSnapshot'

describe('fetchBusinessMenuSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps categories and available products from the SDK response', async () => {
    get.mockResolvedValue({
      content: {
        error: false,
        result: { id: 42, categories: [{ id: 1 }, { id: 2 }, { id: 3 }], available_products_count: 120 }
      }
    })

    const snapshot = await fetchBusinessMenuSnapshot({ businesses }, 42)

    expect(businesses).toHaveBeenCalledWith(42)
    expect(select).toHaveBeenCalledWith(['id', 'categories', 'available_products_count'])
    expect(snapshot).toEqual({ categories: 3, products: 120 })
  })

  it('returns null when the SDK reports an error', async () => {
    get.mockResolvedValue({ content: { error: true, result: ['Not found'] } })

    await expect(fetchBusinessMenuSnapshot({ businesses }, 42)).resolves.toBeNull()
  })

  it('returns null when the SDK throws', async () => {
    get.mockRejectedValue(new Error('network'))

    await expect(fetchBusinessMenuSnapshot({ businesses }, 42)).resolves.toBeNull()
  })

  it('returns null without a business id or SDK', async () => {
    await expect(fetchBusinessMenuSnapshot({ businesses }, null)).resolves.toBeNull()
    await expect(fetchBusinessMenuSnapshot(null, 42)).resolves.toBeNull()
    expect(businesses).not.toHaveBeenCalled()
  })
})

describe('useBusinessMenuSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not fetch until refetch is called, then exposes the snapshot', async () => {
    get.mockResolvedValue({
      content: { error: false, result: { id: 42, categories: [{ id: 1 }], available_products_count: 8 } }
    })

    const { result } = renderHook(() => useBusinessMenuSnapshot(42))

    expect(result.current.snapshot).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(businesses).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.refetch()
    })

    expect(result.current.snapshot).toEqual({ categories: 1, products: 8 })
    expect(result.current.loading).toBe(false)
    expect(result.current.failed).toBe(false)
  })

  it('flags a failed check without throwing', async () => {
    get.mockRejectedValue(new Error('network'))

    const { result } = renderHook(() => useBusinessMenuSnapshot(42))

    await act(async () => {
      await result.current.refetch()
    })

    expect(result.current.snapshot).toBeNull()
    expect(result.current.failed).toBe(true)
  })
})
