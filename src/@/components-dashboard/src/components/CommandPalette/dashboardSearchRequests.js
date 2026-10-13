import { fetchWithCancel } from './useRemoteSearch'
import {
  BUSINESS_SEARCH_LIMIT,
  BUSINESS_SEARCH_PARAMS,
  buildBackofficeBusinessSearchUrl,
  buildBusinessSearchWhere,
  rankBusinessResults,
  shouldUseBackofficeBusinessSearch
} from '../../utils/commandPaletteBusinesses'
import {
  RECORD_SEARCH_LIMIT,
  RECORD_SEARCH_SLOW_MS,
  buildOrderSearchUrl,
  buildUserSearchUrl
} from '../../utils/commandPaletteRecords'
import { markCommandPaletteSlowSearch } from '../../utils/commandPaletteSearchMode'

const serialRequests = new Map()

const abortError = () => {
  const error = new Error('The dashboard search was cancelled')
  error.name = 'AbortError'
  return error
}

const responseContent = (response) => response?.content && typeof response.content === 'object'
  ? response.content
  : response

const withCancellation = async (signal, cancelToken, request) => {
  if (signal?.aborted) throw abortError()
  const onAbort = () => cancelToken.cancel?.()
  signal?.addEventListener('abort', onAbort, { once: true })
  try {
    return await request()
  } finally {
    signal?.removeEventListener('abort', onAbort)
  }
}

const makeCancelToken = (signal, cancelToken = {}) => ({
  cancelToken,
  request: (run) => withCancellation(signal, cancelToken, run)
})

/**
 * The SDK returns `{ content: { error, result } }`, while the backoffice
 * endpoint returns `{ error, result }`. Keep this normalization in one place
 * so CommandK and Dashboard destinations consume the same authorized rows.
 */
export const requestBusinessSearch = async ({
  ordering,
  token,
  user,
  term = '',
  limit = BUSINESS_SEARCH_LIMIT,
  cancelToken,
  signal
} = {}) => {
  const { cancelToken: activeCancelToken, request } = makeCancelToken(signal, cancelToken)
  if (shouldUseBackofficeBusinessSearch({ project: ordering?.project, level: user?.level })) {
    return responseContent(await request(() => fetchWithCancel(
      buildBackofficeBusinessSearchUrl(ordering.root, term, limit),
      token,
      activeCancelToken
    )))
  }
  const where = buildBusinessSearchWhere(term)
  let sdkRequest = ordering.setAccessToken(token).businesses().select(BUSINESS_SEARCH_PARAMS).asDashboard()
  if (where) sdkRequest = sdkRequest.where(where)
  const response = await request(() => sdkRequest.get({ query: { page: 1, page_size: limit }, cancelToken: activeCancelToken }))
  return responseContent(response)
}

export const fetchBusinessSearchRows = async (options = {}) => {
  const {
    term = '',
    limit = BUSINESS_SEARCH_LIMIT
  } = options
  const content = await requestBusinessSearch(options)
  if (!content || content.error) throw new Error('BUSINESS_SEARCH_ERROR')
  return rankBusinessResults(content.result, term, limit)
}

export const requestOrderSearch = ({
  ordering,
  token,
  query,
  extended = true,
  limit = RECORD_SEARCH_LIMIT,
  cancelToken,
  signal
} = {}) => {
  const { cancelToken: activeCancelToken, request } = makeCancelToken(signal, cancelToken)
  return request(() => fetchWithCancel(
    buildOrderSearchUrl(ordering.root, query, { extended, limit }),
    token,
    activeCancelToken
  ))
}

export const requestUserSearch = ({
  ordering,
  token,
  query,
  levels,
  extended = true,
  limit = RECORD_SEARCH_LIMIT,
  cancelToken,
  signal
} = {}) => {
  const { cancelToken: activeCancelToken, request } = makeCancelToken(signal, cancelToken)
  return request(() => fetchWithCancel(
    buildUserSearchUrl(ordering.root, query, levels, { extended, limit }),
    token,
    activeCancelToken
  ))
}

export const fetchRecordSearchRows = async (options = {}) => {
  const content = options.entity === 'users'
    ? await requestUserSearch(options)
    : await requestOrderSearch(options)
  if (!content || content.error) throw new Error(`${options.entity === 'users' ? 'USER' : 'ORDER'}_SEARCH_ERROR`)
  return Array.isArray(content.result) ? content.result : []
}

/**
 * Match CommandK's slow-search policy for non-hook consumers. The request
 * continues so completed rows remain usable; subsequent searches use the
 * persisted safe mode just like the palette.
 */
export const fetchRecordSearchWithSlowPolicy = async ({
  project,
  entity,
  extended = true,
  ...options
} = {}) => {
  const key = `${project}|${entity}`
  const previous = serialRequests.get(key)
  if (previous) {
    let removeAbort = () => {}
    const aborted = new Promise((resolve, reject) => {
      const onAbort = () => reject(abortError())
      if (options.signal?.aborted) onAbort()
      else {
        options.signal?.addEventListener('abort', onAbort, { once: true })
        removeAbort = () => options.signal?.removeEventListener('abort', onAbort)
      }
    })
    try {
      await Promise.race([previous.done, aborted])
    } finally {
      removeAbort()
    }
  }
  if (options.signal?.aborted) throw abortError()
  let release
  const gate = { done: new Promise(resolve => { release = resolve }) }
  serialRequests.set(key, gate)
  const releaseGate = () => {
    release()
    if (serialRequests.get(key) === gate) serialRequests.delete(key)
  }
  let slowTimer
  if (extended) {
    slowTimer = setTimeout(() => {
      markCommandPaletteSlowSearch(project, entity)
      releaseGate()
    }, RECORD_SEARCH_SLOW_MS)
  }
  try {
    return await fetchRecordSearchRows({ entity, extended, ...options })
  } finally {
    clearTimeout(slowTimer)
    releaseGate()
  }
}
