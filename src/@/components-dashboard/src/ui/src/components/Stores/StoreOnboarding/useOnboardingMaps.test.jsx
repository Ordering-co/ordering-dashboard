import { renderHook, act, cleanup } from '@testing-library/react'
import { vi, beforeEach, afterEach, it, expect } from 'vitest'

const installSdk = () => { window.google = { maps: { Map: class {}, places: { Autocomplete: class {} } } }; return window.google }
beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); delete window.google; delete window.gm_authFailure; document.querySelectorAll('script').forEach(s => s.remove()) })
afterEach(async () => { cleanup(); await vi.runAllTimersAsync(); vi.useRealTimers(); delete window.google; delete window.gm_authFailure; document.querySelectorAll('script').forEach(s => s.remove()) })

it('broadcasts auth failure to both editors, retains error after retry and preserves prior handlers', async () => {
  const prior = vi.fn(); window.gm_authFailure = prior; const sdk = installSdk(); const reload = vi.fn()
  const { useOnboardingMaps } = await import('./useOnboardingMaps')
  const first = renderHook(() => useOnboardingMaps('same-key', reload))
  const second = renderHook(() => useOnboardingMaps('same-key', reload))
  await act(async () => {})
  expect(first.result.current.status).toBe('ready')
  act(() => window.gm_authFailure())
  expect(first.result.current.error).toBe('map_auth'); expect(second.result.current.error).toBe('map_auth')
  expect(prior).toHaveBeenCalledOnce()
  act(() => first.result.current.retry())
  expect(reload).toHaveBeenCalledOnce(); expect(first.result.current.status).toBe('error')
  expect(window.google).toBe(sdk)
  first.unmount(); expect(window.gm_authFailure).not.toBe(prior)
  second.unmount(); expect(window.gm_authFailure).toBe(prior)
  const next = renderHook(() => useOnboardingMaps('same-key', reload))
  await act(async () => {})
  expect(next.result.current.status).toBe('error')
})

it('shares one load, retries network failure once and ignores stale unmounted owners', async () => {
  const { useOnboardingMaps } = await import('./useOnboardingMaps')
  const first = renderHook(() => useOnboardingMaps('network-key'))
  const second = renderHook(() => useOnboardingMaps('network-key'))
  expect(document.querySelectorAll('script')).toHaveLength(1)
  await act(async () => document.querySelector('script').dispatchEvent(new Event('error')))
  expect(first.result.current.status).toBe('error'); expect(second.result.current.status).toBe('error')
  expect(document.querySelectorAll('script')).toHaveLength(0)
  act(() => first.result.current.retry())
  expect(document.querySelectorAll('script')).toHaveLength(1)
  second.unmount()
  await act(async () => { installSdk(); document.querySelector('script').dispatchEvent(new Event('load')) })
  expect(first.result.current.status).toBe('ready')
  expect(vi.getTimerCount()).toBe(0)
})

it('bounds stalled requests and rejects missing keys even if a foreign SDK exists', async () => {
  const { useOnboardingMaps } = await import('./useOnboardingMaps')
  const hook = renderHook(() => useOnboardingMaps('stalled-key'))
  await act(async () => { await vi.advanceTimersByTimeAsync(15000) })
  expect(hook.result.current.error).toBe('map_timeout')
  expect(document.querySelectorAll('script')).toHaveLength(0)
  expect(vi.getTimerCount()).toBe(0)
  installSdk()
  const missing = renderHook(() => useOnboardingMaps())
  await act(async () => {})
  expect(missing.result.current.error).toBe('missing_map_key')
})

it('keeps foreign scripts and their callbacks intact and requests reload for a changed tenant key', async () => {
  const foreign = document.createElement('script'); foreign.id = '__googleMapsScriptId'; foreign.src = 'https://maps.googleapis.com/maps/api/js?key=old-key'
  document.head.appendChild(foreign); const oldLoad = vi.fn(); foreign.onload = oldLoad
  const sdk = installSdk(); const reload = vi.fn(); const { useOnboardingMaps } = await import('./useOnboardingMaps')
  const hook = renderHook(() => useOnboardingMaps('new-key', reload))
  await act(async () => {})
  expect(hook.result.current.error).toBe('map_session_key')
  act(() => hook.result.current.retry())
  expect(reload).toHaveBeenCalledOnce(); expect(window.google).toBe(sdk)
  expect(document.getElementById('__googleMapsScriptId')).toBe(foreign)
  expect(foreign.onload).toBe(oldLoad)
})

it('does not delete an existing matching script when its request times out', async () => {
  const script = document.createElement('script'); script.id = '__googleMapsScriptId'; script.src = 'https://maps.googleapis.com/maps/api/js?key=shared-key'
  document.head.appendChild(script)
  const { useOnboardingMaps } = await import('./useOnboardingMaps')
  const hook = renderHook(() => useOnboardingMaps('shared-key'))
  await act(async () => { await vi.advanceTimersByTimeAsync(15000) })
  expect(hook.result.current.error).toBe('map_timeout')
  expect(document.getElementById('__googleMapsScriptId')).toBe(script)
})
