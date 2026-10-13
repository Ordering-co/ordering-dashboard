import { useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { removeQueryToUrl } from '../utils'
import { LISTING_SEARCH_PARAM, sanitizeListingSearch } from '../../../utils/commandPaletteHandoff'

/**
 * Search text carried to a listing with `?q=` (command palette hand-off).
 *
 * Returns `{ key, value }` once per navigation, or `null`. The param is then
 * removed from the address bar so clearing the search box or reloading the
 * page doesn't bring it back. `key` changes on every navigation, so the same
 * text sent twice is applied twice.
 */
export const useListingSearchSeed = ({ enabled = true } = {}) => {
  const location = useLocation()

  const seed = useMemo(() => {
    if (!enabled) return null
    const value = sanitizeListingSearch(new URLSearchParams(location.search).get(LISTING_SEARCH_PARAM))
    return value ? { key: location.key || value, value } : null
  }, [enabled, location.key, location.search])

  useEffect(() => {
    if (seed) removeQueryToUrl([LISTING_SEARCH_PARAM])
  }, [seed?.key])

  return seed
}
