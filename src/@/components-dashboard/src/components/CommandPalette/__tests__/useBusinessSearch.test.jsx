import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  project: 'demo',
  session: { token: 'tok', user: { id: 1, level: 0 } },
  requests: []
}))

const { createOrdering } = vi.hoisted(() => ({
  createOrdering: () => {
    const request = {
      select: vi.fn(() => request),
      asDashboard: vi.fn(() => request),
      where: vi.fn((where) => {
        request.lastWhere = where
        return request
      }),
      get: vi.fn((options) => new Promise((resolve, reject) => {
        const entry = { options, where: request.lastWhere, resolve, reject, cancelled: false }
        options.cancelToken.cancel = () => { entry.cancelled = true }
        state.requests.push(entry)
      }))
    }
    return {
      root: 'https://api.test/v400/en/demo',
      get project () { return state.project },
      setAccessToken: vi.fn(function () { return this }),
      businesses: vi.fn(() => {
        request.lastWhere = null
        return request
      })
    }
  }
}))

vi.mock('../../../contexts/ApiContext', () => {
  const ordering = createOrdering()
  return { useApi: () => [ordering] }
})
vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [state.session]
}))

import { useBusinessSearch } from '../useBusinessSearch'

const ok = (result) => ({ content: { error: false, result } })

describe('useBusinessSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    state.requests = []
    state.project = 'demo'
    state.session = { token: 'tok', user: { id: 1, level: 0 } }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('stays idle when disabled or empty', () => {
    const { result } = renderHook(() => useBusinessSearch({ query: '', enabled: true }))
    expect(result.current.status).toBe('idle')
    act(() => { vi.advanceTimersByTime(500) })
    expect(state.requests).toHaveLength(0)
  })

  it('debounces, limits the request and ranks results', async () => {
    const { result } = renderHook(() => useBusinessSearch({ query: 'pizza', enabled: true }))
    expect(result.current.status).toBe('loading')
    await act(async () => { vi.advanceTimersByTime(250) })
    expect(state.requests).toHaveLength(1)
    expect(state.requests[0].options.query).toEqual({ page: 1, page_size: 8 })
    expect(state.requests[0].where.conditions[0].attribute).toBe('name')
    await act(async () => { state.requests[0].resolve(ok([{ id: 2, name: 'The pizza' }, { id: 1, name: 'Pizza', enabled: true }])) })
    expect(result.current.status).toBe('success')
    expect(result.current.results.map(row => row.id)).toEqual([1, 2])
  })

  it('never lets an old answer replace a newer query', async () => {
    const { result, rerender } = renderHook(({ query }) => useBusinessSearch({ query, enabled: true }), { initialProps: { query: 'piz' } })
    await act(async () => { vi.advanceTimersByTime(250) })
    rerender({ query: 'pizza' })
    expect(state.requests[0].cancelled).toBe(true)
    await act(async () => { vi.advanceTimersByTime(250) })
    await act(async () => { state.requests[1].resolve(ok([{ id: 9, name: 'Pizza new' }])) })
    await act(async () => { state.requests[0].resolve(ok([{ id: 1, name: 'Old' }])) })
    expect(result.current.query).toBe('pizza')
    expect(result.current.results.map(row => row.id)).toEqual([9])
  })

  it('reports errors and retries', async () => {
    const { result } = renderHook(() => useBusinessSearch({ query: 'taco', enabled: true }))
    await act(async () => { vi.advanceTimersByTime(250) })
    await act(async () => { state.requests[0].resolve({ content: { error: true, result: ['Not allowed'] } }) })
    expect(result.current.status).toBe('error')
    expect(result.current.error.message).toBe('Not allowed')
    act(() => { result.current.retry() })
    await act(async () => { vi.advanceTimersByTime(250) })
    expect(state.requests).toHaveLength(2)
    await act(async () => { state.requests[1].resolve(ok([{ id: 3, name: 'Taco' }])) })
    expect(result.current.status).toBe('success')
  })

  it('handles network failures', async () => {
    const { result } = renderHook(() => useBusinessSearch({ query: 'taco', enabled: true }))
    await act(async () => { vi.advanceTimersByTime(250) })
    await act(async () => { state.requests[0].reject(new Error('offline')) })
    expect(result.current.status).toBe('error')
  })

  it('caches per scope and drops the cache when the project changes', async () => {
    const { result, rerender } = renderHook(({ query }) => useBusinessSearch({ query, enabled: true }), { initialProps: { query: 'sushi' } })
    await act(async () => { vi.advanceTimersByTime(250) })
    await act(async () => { state.requests[0].resolve(ok([{ id: 4, name: 'Sushi' }])) })
    rerender({ query: 'sus' })
    await act(async () => { vi.advanceTimersByTime(250) })
    await act(async () => { state.requests[1].resolve(ok([])) })
    rerender({ query: 'sushi' })
    expect(result.current.status).toBe('success')
    expect(state.requests).toHaveLength(2)

    state.project = 'other'
    rerender({ query: 'sushi' })
    await act(async () => { vi.advanceTimersByTime(250) })
    expect(state.requests).toHaveLength(3)
  })

  it('lists the first stores with an empty query when asked', async () => {
    renderHook(() => useBusinessSearch({ query: '', enabled: true, allowEmpty: true }))
    await act(async () => { vi.advanceTimersByTime(250) })
    expect(state.requests).toHaveLength(1)
    expect(state.requests[0].where).toBeNull()
  })
})
