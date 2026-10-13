/**
 * HTTP client of the Dashboard assistant. Requests go to api-ai, always
 * with the user's own JWT.
 */

/** Error codes of the contract, by the HTTP status that carries them */
const CODES_BY_STATUS = {
  403: 'no_permission',
  404: 'not_found',
  429: 'usage_limit',
  503: 'mcp_unavailable'
}

export class AssistantRequestError extends Error {
  constructor ({ code, message, status, retryAt }) {
    super(message || code)
    this.name = 'AssistantRequestError'
    this.code = code
    this.status = status ?? null
    this.retryAt = retryAt ?? null
  }
}

/**
 * When a reached usage limit lets the user write again, as an ISO date, from
 * `retry_at` (UTC, ISO 8601) or else `retry_after` (seconds)
 * @param {Object} source a 429 body, a stream `error` event or `/status` usage
 * @param {Number} [now] ms
 * @returns {String|null}
 */
export const getRetryAt = (source, now = Date.now()) => {
  const at = Date.parse(source?.retry_at)
  if (Number.isFinite(at)) return new Date(at).toISOString()
  const seconds = Number(source?.retry_after)
  if (Number.isFinite(seconds) && seconds > 0) return new Date(now + seconds * 1000).toISOString()
  return null
}

/**
 * The `usage` of `/status`: `retry_at` only while `limited`
 * @param {Object} usage `{ near_limit, limited, retry_after, retry_at }`
 * @param {Number} [now] ms
 */
export const toUsage = (usage, now = Date.now()) => {
  const limited = !!usage?.limited
  return {
    near_limit: !!usage?.near_limit,
    limited,
    retry_at: limited ? getRetryAt(usage, now) : null
  }
}

const LANGUAGE_PATTERN = /^[a-z]{2}(_[a-z]{2})?$/

/**
 * The api-ai language segment (`es`, `pt_br`) from a Dashboard language code,
 * or null when it does not fit
 * @param {String} code e.g. `es`, `pt-BR`
 */
export const toAssistantLanguage = (code) => {
  if (typeof code !== 'string') return null
  const language = code.trim().toLowerCase().replace('-', '_')
  return LANGUAGE_PATTERN.test(language) ? language : null
}

const messageOf = (result) => {
  if (Array.isArray(result)) return result.map(String).join(' ')
  return typeof result === 'string' ? result : ''
}

const toRequestError = async (response) => {
  let content = null
  try {
    content = await response.json()
  } catch {}
  return new AssistantRequestError({
    code: content?.code || CODES_BY_STATUS[response.status] || 'error',
    message: messageOf(content?.result),
    status: response.status,
    retryAt: getRetryAt(content)
  })
}

/**
 * Read a server-sent events body and call `onEvent(name, data)` for each event
 * @param {ReadableStream} body response body
 * @param {Function} onEvent `(event, data)`; data is parsed JSON, or the raw text when it is not JSON
 */
export const readEventStream = async (body, onEvent) => {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const dispatchBlock = (block) => {
    let event = 'message'
    const data = []
    for (const line of block.split(/\r?\n/)) {
      if (!line || line.startsWith(':')) continue
      const colon = line.indexOf(':')
      const field = colon === -1 ? line : line.slice(0, colon)
      const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '')
      if (field === 'event') event = value
      else if (field === 'data') data.push(value)
    }
    if (data.length === 0) return
    const raw = data.join('\n')
    let parsed = raw
    try {
      parsed = JSON.parse(raw)
    } catch {}
    onEvent(event, parsed)
  }

  while (true) {
    const { value, done } = await reader.read()
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
    const blocks = buffer.split(/\r?\n\r?\n/)
    buffer = blocks.pop()
    blocks.forEach(dispatchBlock)
    if (done) break
  }
  if (buffer.trim()) dispatchBlock(buffer)
}

/**
 * @param {Object} options
 * @param {String} options.baseUrl api-ai URL (`ai_api.url` of config.json)
 * @param {String} options.projectCode project code
 * @param {String} options.token Dashboard user JWT
 * @param {String|Function} [options.language] api-ai language segment, or a function that returns it on each request
 * @param {Function} [options.fetchImpl] fetch, for tests
 */
export const createAssistantClient = ({ baseUrl, projectCode, token, language = null, fetchImpl }) => {
  const doFetch = fetchImpl || ((...args) => fetch(...args))
  const root = `${String(baseUrl).replace(/\/+$/, '')}/projects/${encodeURIComponent(projectCode)}/ai/assistant`

  const headersFor = (hasBody) => ({
    Authorization: `Bearer ${token}`,
    ...(hasBody ? { 'Content-Type': 'application/json' } : {})
  })

  const getLanguage = () => (typeof language === 'function' ? language() : language)
  const withLanguage = (body) => {
    const current = getLanguage()
    return current ? { ...body, language: current } : body
  }

  const request = async (path, { method = 'GET', body = null, query = null, signal } = {}) => {
    const search = query ? `?${new URLSearchParams(query)}` : ''
    const response = await doFetch(`${root}${path}${search}`, {
      method,
      headers: headersFor(!!body),
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal
    })
    if (!response.ok) throw await toRequestError(response)
    const content = await response.json()
    if (content?.error) {
      throw new AssistantRequestError({ code: content.code || 'error', message: messageOf(content.result), status: response.status })
    }
    return content?.result
  }

  return {
    getStatus: ({ signal } = {}) => {
      const current = getLanguage()
      return request('/status', { query: current ? { language: current } : null, signal })
    },
    acceptNotice: (version, noticeLanguage) => request('/notice', { method: 'POST', body: withLanguage({ version, notice_language: noticeLanguage }) }),
    getConversation: (id, { signal } = {}) => request(`/conversations/${encodeURIComponent(id)}`, { signal }),
    deleteConversation: (id) => request(`/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    confirmActions: (actionIds) => request('/actions/confirm', { method: 'POST', body: withLanguage({ action_ids: actionIds }) }),
    cancelActions: (actionIds) => request('/actions/cancel', { method: 'POST', body: withLanguage({ action_ids: actionIds }) }),
    postDashboardSearchResults: ({ requestId, conversationId, scope, version, result, signal } = {}) => request('/dashboard-search/results', {
      method: 'POST',
      body: {
        request_id: requestId,
        conversation_id: conversationId,
        scope,
        version,
        result
      },
      signal
    }),

    /**
     * Send a message; the answer streams into `onEvent`. What fails before the
     * stream starts throws an AssistantRequestError; aborting `signal` stops
     * the turn on the server too.
     */
    sendMessage: async ({ message, conversationId = null, context = null, dashboardSearch = null, signal, onEvent }) => {
      const response = await doFetch(`${root}/messages`, {
        method: 'POST',
        headers: { ...headersFor(true), Accept: 'text/event-stream' },
        body: JSON.stringify(withLanguage({
          message,
          ...(conversationId ? { conversation_id: conversationId } : {}),
          ...(context ? { context } : {}),
          ...(dashboardSearch ? { dashboard_search: dashboardSearch } : {})
        })),
        cache: 'no-store',
        signal
      })
      if (!response.ok) throw await toRequestError(response)
      await readEventStream(response.body, onEvent)
    }
  }
}
