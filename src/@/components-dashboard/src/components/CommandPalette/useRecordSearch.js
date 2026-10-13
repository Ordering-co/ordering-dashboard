import { useRemoteSearch } from './useRemoteSearch'
import {
  RECORD_SEARCH_LIMIT,
  RECORD_SEARCH_SLOW_MS,
  getRecordSearchMode
} from '../../utils/commandPaletteRecords'
import { requestOrderSearch, requestUserSearch } from './dashboardSearchRequests'

const modeOptions = (entity, extended, onSlow) => {
  const mode = getRecordSearchMode(entity, extended)
  return {
    variant: extended ? 'extended' : 'safe',
    debounceMs: mode.debounceMs,
    // Only an extended search can switch the project to safe mode
    slowMs: extended ? RECORD_SEARCH_SLOW_MS : 0,
    onSlow
  }
}

/** Orders: extended (number, customer, store) or safe (number only). Raw rows. */
export const useOrderSearch = ({ query = '', enabled = false, extended = true, onSlow, limit = RECORD_SEARCH_LIMIT } = {}) => useRemoteSearch({
  query,
  enabled,
  errorCode: 'ORDER_SEARCH_ERROR',
  serial: true,
  ...modeOptions('orders', extended, onSlow),
  search: (term, cancelToken, { ordering, token }) => requestOrderSearch({
    ordering,
    token,
    query: term,
    extended,
    limit,
    cancelToken
  }),
  toResults: (rows) => (Array.isArray(rows) ? rows : [])
})

/** Users of the given levels matching an id, name, email or phone. Raw rows. */
export const useUserSearch = ({ query = '', enabled = false, levels = [], extended = true, onSlow, limit = RECORD_SEARCH_LIMIT } = {}) => useRemoteSearch({
  query,
  enabled: enabled && levels.length > 0,
  errorCode: 'USER_SEARCH_ERROR',
  serial: true,
  ...modeOptions('users', extended, onSlow),
  search: (term, cancelToken, { ordering, token }) => requestUserSearch({
    ordering,
    token,
    query: term,
    levels,
    extended,
    limit,
    cancelToken
  }),
  toResults: (rows) => (Array.isArray(rows) ? rows : [])
})
