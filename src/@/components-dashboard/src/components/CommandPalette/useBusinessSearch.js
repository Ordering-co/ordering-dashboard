import { useRemoteSearch } from './useRemoteSearch'
import {
  BUSINESS_SEARCH_CACHE_TTL_MS,
  BUSINESS_SEARCH_DEBOUNCE_MS,
  BUSINESS_SEARCH_LIMIT,
  rankBusinessResults
} from '../../utils/commandPaletteBusinesses'
import { requestBusinessSearch } from './dashboardSearchRequests'

/**
 * Server side business search for the command palette: a few rows with a
 * minimal projection, through `useRemoteSearch` (debounce, cancel, stale
 * guard, one minute cache per project, user and token).
 */
export const useBusinessSearch = ({
  query = '',
  enabled = false,
  allowEmpty = false,
  debounceMs = BUSINESS_SEARCH_DEBOUNCE_MS,
  limit = BUSINESS_SEARCH_LIMIT
} = {}) => useRemoteSearch({
  query,
  enabled,
  allowEmpty,
  debounceMs,
  cacheTtlMs: BUSINESS_SEARCH_CACHE_TTL_MS,
  errorCode: 'BUSINESS_SEARCH_ERROR',
  search: (term, cancelToken, { ordering, token, user }) => requestBusinessSearch({
    ordering,
    token,
    user,
    term,
    limit,
    cancelToken
  }),
  toResults: (rows, term) => rankBusinessResults(rows, term, limit)
})
