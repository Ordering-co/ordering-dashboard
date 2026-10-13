import { useEffect, useMemo, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { removeQueryToUrl } from '../utils'

/**
 * A query param that asks a page to open something once, such as an add form
 * (`?add=1`, command palette). Returns `{ key, value }` once per navigation,
 * or `null`, then removes the param so a reload or a close doesn't reopen it.
 */
export const useOneShotQuery = (param, { enabled = true } = {}) => {
  // Router location; the window when rendered without a router (isolated
  // renders). useLocation always runs, so the hook order never changes.
  let location
  try {
    location = useLocation()
  } catch {
    location = typeof window !== 'undefined' ? window.location : { search: '' }
  }
  const value = enabled && param ? new URLSearchParams(location.search).get(param) : null

  const seed = useMemo(
    () => value ? { key: location.key || value, value } : null,
    [value, location.key]
  )

  useEffect(() => {
    if (seed) removeQueryToUrl([param])
  }, [seed?.key])

  return seed
}

/**
 * Calls `open(value)` once for `?<param>=<value>` when the page is `ready`
 * (data loaded, button enabled). `accept` checks the value, so an unknown
 * value never opens an empty or wrong form.
 */
export const useOpenFromQuery = (param, open, { enabled = true, ready = true, accept = () => true } = {}) => {
  const seed = useOneShotQuery(param, { enabled })
  const appliedKey = useRef(null)

  useEffect(() => {
    if (!seed || !ready || appliedKey.current === seed.key) return
    appliedKey.current = seed.key
    if (accept(seed.value)) open(seed.value)
  }, [seed?.key, ready])

  return seed
}
