import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../contexts/ApiContext', () => {
  const ordering = { root: 'https://api.test/v400/en/demo', project: 'demo' }
  return { useApi: () => [ordering] }
})
vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'tok', user: { id: 1, level: 0 } }]
}))

import { useRemoteSearch } from '../useRemoteSearch'

describe('useRemoteSearch in serial mode', () => {
  let calls
  const search = (term, cancelToken) => new Promise(resolve => {
    calls.push({ term, resolve, cancelToken })
  })

  beforeEach(() => {
    vi.useFakeTimers()
    calls = []
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sends one request at a time, never aborts it, and then only the latest query', async () => {
    const { result, rerender } = renderHook(({ query }) => useRemoteSearch({ query, enabled: true, debounceMs: 100, serial: true, search }), { initialProps: { query: 'ana' } })
    await act(async () => { vi.advanceTimersByTime(100) })
    expect(calls.map(call => call.term)).toEqual(['ana'])

    rerender({ query: 'ana l' })
    await act(async () => { vi.advanceTimersByTime(100) })
    rerender({ query: 'ana lo' })
    await act(async () => { vi.advanceTimersByTime(100) })
    // Still waiting for the first one, which was not aborted
    expect(calls.map(call => call.term)).toEqual(['ana'])
    expect(calls[0].cancelToken.cancel).toBeUndefined()

    await act(async () => { calls[0].resolve({ error: false, result: [{ id: 1 }] }) })
    // The stale answer is dropped; only the latest query goes out
    expect(calls.map(call => call.term)).toEqual(['ana', 'ana lo'])
    expect(result.current.status).toBe('loading')

    await act(async () => { calls[1].resolve({ error: false, result: [{ id: 2 }] }) })
    expect(result.current).toMatchObject({ status: 'success', query: 'ana lo', results: [{ id: 2 }] })
  })

  it('does not send a waiting request after the palette closes', async () => {
    const { rerender } = renderHook(({ query, enabled }) => useRemoteSearch({ query, enabled, debounceMs: 100, serial: true, search }), { initialProps: { query: 'ana', enabled: true } })
    await act(async () => { vi.advanceTimersByTime(100) })
    rerender({ query: 'anabel', enabled: true })
    await act(async () => { vi.advanceTimersByTime(100) })
    rerender({ query: 'anabel', enabled: false })
    await act(async () => { calls[0].resolve({ error: false, result: [] }) })
    expect(calls.map(call => call.term)).toEqual(['ana'])
  })
})

describe('useRemoteSearch slow detection', () => {
  let calls
  const search = (term) => new Promise(resolve => { calls.push({ term, resolve }) })

  beforeEach(() => {
    vi.useFakeTimers()
    calls = []
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const render = (initialProps) => renderHook(
    ({ query, variant, onSlow }) => useRemoteSearch({ query, enabled: true, debounceMs: 100, serial: true, slowMs: 2000, variant, onSlow, search }),
    { initialProps }
  )

  it('reports a slow request, then the next variant does not wait for it', async () => {
    const onSlow = vi.fn()
    const { result, rerender } = render({ query: 'ana', variant: 'extended', onSlow })
    await act(async () => { vi.advanceTimersByTime(100) })
    await act(async () => { vi.advanceTimersByTime(2000) })
    expect(onSlow).toHaveBeenCalledWith('ana')
    expect(result.current).toMatchObject({ status: 'error', query: 'ana' })

    // The palette switches to safe mode: same query, new variant
    rerender({ query: 'ana', variant: 'safe', onSlow })
    await act(async () => { vi.advanceTimersByTime(100) })
    expect(calls.map(call => call.term)).toEqual(['ana', 'ana'])
    await act(async () => { calls[1].resolve({ error: false, result: [{ id: 9 }] }) })
    expect(result.current).toMatchObject({ status: 'success', results: [{ id: 9 }] })

    // The slow answer arriving late changes nothing
    await act(async () => { calls[0].resolve({ error: false, result: [{ id: 1 }] }) })
    expect(result.current.results).toEqual([{ id: 9 }])
  })

  it('still detects a slow request while the person keeps typing', async () => {
    const onSlow = vi.fn()
    const { rerender } = render({ query: 'ana', variant: 'extended', onSlow })
    await act(async () => { vi.advanceTimersByTime(100) })
    rerender({ query: 'ana l', variant: 'extended', onSlow })
    await act(async () => { vi.advanceTimersByTime(100) })
    // Waiting behind the first request, which is still running
    expect(calls.map(call => call.term)).toEqual(['ana'])
    await act(async () => { vi.advanceTimersByTime(1900) })
    expect(onSlow).toHaveBeenCalledWith('ana')
    // Released: the latest query goes out without waiting for the slow one
    expect(calls.map(call => call.term)).toEqual(['ana', 'ana l'])
  })

  it('does not report a request that answers in time', async () => {
    const onSlow = vi.fn()
    const { result } = render({ query: 'ana', variant: 'extended', onSlow })
    await act(async () => { vi.advanceTimersByTime(100) })
    await act(async () => { calls[0].resolve({ error: false, result: [] }) })
    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(onSlow).not.toHaveBeenCalled()
    expect(result.current.status).toBe('success')
  })
})
