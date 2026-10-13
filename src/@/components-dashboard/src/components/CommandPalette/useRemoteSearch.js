import { useCallback, useEffect, useRef, useState } from 'react'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'

const IDLE = { status: 'idle', query: '', results: [], error: null }
const DEFAULT_CACHE_TTL_MS = 60 * 1000

// Case only: the API compares accents, so “cafe” and “café” are different searches
const toCacheKey = (term, variant = '') => `${variant}|${term.toLowerCase()}`

/**
 * Server side search shared by the palette's remote sections (stores,
 * orders, users).
 *
 * Debounced. A newer query cancels the request in flight and a late answer
 * never replaces it. Results are cached per project, user and token: a
 * project or session change drops the cache and the shown results.
 *
 * `search(term, cancelToken, { ordering, token, user })` returns the raw API
 * content (`{ error, result }`); `cancelToken.cancel` may be set to abort.
 * `toResults(content.result, term)` maps it to what the section shows.
 *
 * `serial`: one request at a time. Aborting a fetch does not stop the query
 * in Postgres, so on large projects fast typing would stack them up. In
 * serial mode a request is never aborted; the next one waits for it, and
 * only the latest query is sent.
 *
 * `slowMs` + `onSlow(term)`: when a request has not answered after `slowMs`,
 * the section shows an error, `onSlow` runs (the palette switches that
 * search to safe mode, a different `variant`) and the next request stops
 * waiting for the slow one. `variant` is part of the cache key: changing it
 * runs the search again.
 */
export const useRemoteSearch = ({
  query = '',
  enabled = false,
  allowEmpty = false,
  debounceMs,
  cacheTtlMs = DEFAULT_CACHE_TTL_MS,
  errorCode = 'REMOTE_SEARCH_ERROR',
  search,
  toResults = (rows) => rows,
  serial = false,
  variant = '',
  slowMs = 0,
  onSlow
}) => {
  const [ordering] = useApi()
  const [{ token, user }] = useSession()
  const scopeKey = `${ordering?.project || ''}|${user?.id || ''}|${token || ''}`
  const cacheRef = useRef({ scopeKey, entries: new Map() })
  const requestRef = useRef(0)
  // Serial mode: the request in flight; the next one waits for `done`
  const gateRef = useRef(null)
  const mountedRef = useRef(true)
  const [retryCount, setRetryCount] = useState(0)
  const [state, setState] = useState(IDLE)

  const term = String(query || '').trim()
  const active = enabled && !!token && !!ordering?.root && (!!term || allowEmpty)

  useEffect(() => {
    if (cacheRef.current.scopeKey === scopeKey) return
    cacheRef.current = { scopeKey, entries: new Map() }
    requestRef.current += 1
    setState(IDLE)
  }, [scopeKey])

  useEffect(() => {
    const requestId = ++requestRef.current
    if (!active) {
      setState(IDLE)
      return undefined
    }
    const cacheKey = toCacheKey(term, variant)
    const cached = cacheRef.current.entries.get(cacheKey)
    if (cached && Date.now() - cached.at < cacheTtlMs) {
      setState({ status: 'success', query: term, results: cached.results, error: null })
      return undefined
    }

    // Keep the previous rows while typing so the list doesn't jump; the
    // request id below still keeps a late answer from replacing a newer query
    setState(prev => ({ status: 'loading', query: term, results: prev.status === 'success' || prev.status === 'loading' ? prev.results : [], error: null }))
    const cancelToken = {}
    const requestScope = scopeKey
    // Set on cleanup: a waiting serial request must not start after the query
    // changed or the palette closed
    let disposed = false
    const timer = setTimeout(async () => {
      if (serial && gateRef.current) {
        await gateRef.current.done
        if (disposed || requestId !== requestRef.current) return
      }
      let release
      const gate = { done: new Promise(resolve => { release = resolve }) }
      if (serial) gateRef.current = gate
      let settled = false
      let slow = false
      // Watches this request, not the query: it fires even if the person
      // kept typing, since the next request would be waiting behind it
      const slowTimer = slowMs > 0
        ? setTimeout(() => {
          if (settled || !mountedRef.current) return
          slow = true
          release()
          if (!disposed && requestId === requestRef.current) {
            setState({ status: 'error', query: term, results: [], error: new Error('SLOW_SEARCH') })
          }
          onSlow && onSlow(term)
        }, slowMs)
        : null
      try {
        let content
        try {
          content = await search(term, cancelToken, { ordering, token, user })
        } finally {
          settled = true
          clearTimeout(slowTimer)
          release()
        }
        if (slow || requestId !== requestRef.current) return
        if (!content || content.error) {
          const message = Array.isArray(content?.result) ? content.result.join(', ') : content?.result
          throw new Error(message || errorCode)
        }
        const results = toResults(content.result, term)
        if (cacheRef.current.scopeKey === requestScope) {
          cacheRef.current.entries.set(cacheKey, { at: Date.now(), results })
        }
        setState({ status: 'success', query: term, results, error: null })
      } catch (error) {
        if (slow || requestId !== requestRef.current || error?.name === 'AbortError') return
        setState({ status: 'error', query: term, results: [], error })
      }
    }, debounceMs)

    return () => {
      disposed = true
      clearTimeout(timer)
      if (!serial && typeof cancelToken.cancel === 'function') cancelToken.cancel()
    }
  }, [term, active, scopeKey, retryCount, variant])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const retry = useCallback(() => {
    cacheRef.current.entries.delete(toCacheKey(term, variant))
    setRetryCount(count => count + 1)
  }, [term, variant])

  return { ...state, retry }
}

/** GET with the session token and an abort hook on `cancelToken`. */
export const fetchWithCancel = async (url, token, cancelToken) => {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  cancelToken.cancel = () => controller?.abort()
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    signal: controller?.signal
  })
  return await response.json()
}
