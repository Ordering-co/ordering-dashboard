import { act, renderHook, cleanup } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useDraftImageRead } from './useDraftImageRead'
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('only accepts the newest image read and ignores completion after unmount', () => {
  const readers = []
  vi.stubGlobal('FileReader', class { constructor () { this.readyState = 1; this.abort = vi.fn(); readers.push(this) } readAsDataURL () {} })
  const loaded = vi.fn(); const error = vi.fn()
  const hook = renderHook(() => useDraftImageRead(true))
  act(() => { hook.result.current.read({}, loaded, error); hook.result.current.read({}, loaded, error) })
  expect(readers[0].abort).toHaveBeenCalled()
  act(() => { readers[0].result = 'OLD'; readers[0].onload() })
  expect(loaded).not.toHaveBeenCalled()
  act(() => { readers[1].result = 'NEW'; readers[1].onload() })
  expect(loaded).toHaveBeenCalledWith('NEW')
  expect(hook.result.current.reading).toBe(false)
  act(() => hook.result.current.read({}, loaded, error))
  hook.unmount(); readers[2].onload()
  expect(loaded).toHaveBeenCalledTimes(1)
  expect(readers[2].abort).toHaveBeenCalled()
})
it('clears pending state on failure and performs no reads when not opted in', () => {
  const readers = []
  vi.stubGlobal('FileReader', class { constructor () { readers.push(this) } readAsDataURL () {} })
  const error = vi.fn()
  const hook = renderHook(({ enabled }) => useDraftImageRead(enabled), { initialProps: { enabled: false } })
  act(() => hook.result.current.read({}, vi.fn(), error))
  expect(readers).toHaveLength(0)
  hook.rerender({ enabled: true })
  act(() => hook.result.current.read({}, vi.fn(), error))
  act(() => readers[0].onerror())
  expect(error).toHaveBeenCalledTimes(1)
  expect(hook.result.current.reading).toBe(false)
})
