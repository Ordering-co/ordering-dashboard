// redesign DG-B0: the shared Google Maps loader (promoted from the store onboarding)
import { renderHook, act, cleanup } from '@testing-library/react'
import { vi, beforeEach, afterEach, it, expect } from 'vitest'

const installSdk = () => { window.google = { maps: { Map: class {}, places: { Autocomplete: class {} } } }; return window.google }
const marker = (src) => { const script = document.createElement('script'); script.id = '__googleMapsScriptId'; if (src) script.src = src; document.body.appendChild(script) }
beforeEach(() => { vi.resetModules(); delete window.google; document.querySelectorAll('script').forEach(s => s.remove()) })
afterEach(() => { cleanup(); delete window.google; document.querySelectorAll('script').forEach(s => s.remove()) })

it('a script tag with no key and the SDK already there is ready, not «another key»', async () => {
  installSdk(); marker()
  const { useGoogleMapsSdk } = await import('../useGoogleMapsSdk')
  const hook = renderHook(() => useGoogleMapsSdk('project-key'))
  await act(async () => {})
  expect(hook.result.current.status).toBe('ready')
})

it('a script loaded with a different key is still an error', async () => {
  installSdk(); marker('https://maps.googleapis.com/maps/api/js?key=other-key')
  const { useGoogleMapsSdk } = await import('../useGoogleMapsSdk')
  const hook = renderHook(() => useGoogleMapsSdk('project-key'))
  await act(async () => {})
  expect(hook.result.current.error).toBe('map_session_key')
})

it('the onboarding names are the same loader', async () => {
  const shared = await import('../useGoogleMapsSdk')
  const onboarding = await import('../../components/Stores/StoreOnboarding/useOnboardingMaps')
  expect(onboarding.useOnboardingMaps).toBe(shared.useGoogleMapsSdk)
  expect(onboarding.loadOnboardingMaps).toBe(shared.loadGoogleMapsSdk)
})
