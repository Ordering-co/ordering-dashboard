import { useEffect, useState } from 'react'

const loads = new Map()
const authListeners = new Set()
let previousAuthFailure
let authFailureHandler
let rejectedSdk
let rejectedKey
const sdkReady = () => window.google?.maps?.Map && window.google?.maps?.places?.Autocomplete
const scriptKey = script => {
  try { return new URL(script.src).searchParams.get('key') } catch { return null }
}
const mapError = code => Object.assign(new Error(code), { code })

const subscribeAuthFailure = listener => {
  if (!authListeners.size) {
    previousAuthFailure = window.gm_authFailure
    authFailureHandler = () => {
      rejectedSdk = window.google?.maps
      rejectedKey = scriptKey(document.getElementById('__googleMapsScriptId') || {})
      for (const notify of authListeners) notify()
      previousAuthFailure?.()
    }
    window.gm_authFailure = authFailureHandler
  }
  authListeners.add(listener)
  return () => {
    authListeners.delete(listener)
    if (!authListeners.size && window.gm_authFailure === authFailureHandler) window.gm_authFailure = previousAuthFailure
  }
}

export const loadOnboardingMaps = apiKey => {
  if (!apiKey) return Promise.reject(mapError('missing_map_key'))
  const existingScript = document.getElementById('__googleMapsScriptId')
  if ((rejectedSdk && rejectedSdk === window.google?.maps) || (rejectedKey && rejectedKey === apiKey)) return Promise.reject(mapError('map_auth'))

  if (existingScript && scriptKey(existingScript) !== apiKey) return Promise.reject(mapError('map_session_key'))
  if (sdkReady()) return Promise.resolve(window.google.maps)
  if (loads.has(apiKey)) return loads.get(apiKey)
  const promise = new Promise((resolve, reject) => {
    const owned = !existingScript
    const script = existingScript || document.createElement('script')
    let settled = false
    const finish = error => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      clearInterval(checker)
      script.removeEventListener('load', check)
      script.removeEventListener('error', unavailable)
      unsubscribe()
      if (error) { if (owned) script.remove(); reject(error) } else resolve(window.google.maps)
    }
    const check = () => { if (sdkReady()) finish() }
    const unavailable = () => finish(mapError('map_unavailable'))
    const unsubscribe = subscribeAuthFailure(() => finish(mapError('map_auth')))
    const timeout = setTimeout(() => finish(mapError('map_timeout')), 15000)
    const checker = setInterval(check, 100)
    script.addEventListener('load', check)
    script.addEventListener('error', unavailable)
    if (owned) {
      script.id = '__googleMapsScriptId'
      script.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({ key: apiKey, v: 'weekly', libraries: 'places,geometry', loading: 'async' })}`
      script.async = true
      document.head.appendChild(script)
    }
  })
  loads.set(apiKey, promise)
  const clear = () => { if (loads.get(apiKey) === promise) loads.delete(apiKey) }
  promise.then(clear, clear)
  return promise
}

const reloadDocument = () => window.location.reload()
export const useOnboardingMaps = (apiKey, reloadPage = reloadDocument) => {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ key: apiKey, attempt, status: apiKey ? 'loading' : 'error', error: apiKey ? null : 'missing_map_key' })
  useEffect(() => {
    let active = true
    let authFailed = false
    setState({ key: apiKey, attempt, status: apiKey ? 'loading' : 'error', error: apiKey ? null : 'missing_map_key' })
    const unsubscribe = subscribeAuthFailure(() => {
      authFailed = true
      if (active) setState({ key: apiKey, attempt, status: 'error', error: 'map_auth' })
    })
    loadOnboardingMaps(apiKey).then(() => {
      if (active && !authFailed) setState({ key: apiKey, attempt, status: 'ready', error: null })
    }).catch(error => {
      if (active) setState({ key: apiKey, attempt, status: 'error', error: error.code || 'map_unavailable' })
    })
    return () => { active = false; unsubscribe() }
  }, [apiKey, attempt])
  const current = state.key === apiKey && state.attempt === attempt ? state : { key: apiKey, status: apiKey ? 'loading' : 'error', error: apiKey ? null : 'missing_map_key' }
  return {
    ...current,
    generation: attempt,
    retry: () => {
      if (['map_auth', 'map_session_key'].includes(current.error)) reloadPage()
      else setAttempt(n => n + 1)
    }
  }
}
