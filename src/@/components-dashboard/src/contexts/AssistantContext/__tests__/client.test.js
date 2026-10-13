import { describe, expect, it, vi } from 'vitest'
import { AssistantRequestError, createAssistantClient, getRetryAt, readEventStream, toAssistantLanguage, toUsage } from '../client'

const encoder = new TextEncoder()

/** A response body that yields the given chunks, split wherever the test wants */
const bodyOf = (chunks) => {
  const queue = chunks.map(chunk => encoder.encode(chunk))
  return {
    getReader: () => ({
      read: async () => (queue.length ? { value: queue.shift(), done: false } : { value: undefined, done: true })
    })
  }
}

const jsonResponse = (content, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => content
})

describe('readEventStream', () => {
  it('parses events split across chunks, multi-line data and comments', async () => {
    const events = []
    await readEventStream(bodyOf([
      ': keep-alive\n\nevent: conversation\ndata: {"id":"c1","ti',
      'tle":"Sales"}\n\nevent: text\ndata: {"delta":"Hel"}\r\n\r\nevent: text\ndata: {"delta":"lo"}\n\n',
      'event: note\ndata: line one\ndata: line two\n\nevent: done\ndata: {"aborted":false}'
    ]), (event, data) => events.push([event, data]))

    expect(events).toEqual([
      ['conversation', { id: 'c1', title: 'Sales' }],
      ['text', { delta: 'Hel' }],
      ['text', { delta: 'lo' }],
      ['note', 'line one\nline two'],
      ['done', { aborted: false }]
    ])
  })
})

describe('toAssistantLanguage', () => {
  it('maps dashboard codes to the api-ai segment and drops what does not fit', () => {
    expect(toAssistantLanguage('es')).toBe('es')
    expect(toAssistantLanguage('pt-BR')).toBe('pt_br')
    expect(toAssistantLanguage('zh-Hant-TW')).toBeNull()
    expect(toAssistantLanguage(undefined)).toBeNull()
  })
})

describe('createAssistantClient', () => {
  const setup = (response) => {
    const fetchImpl = vi.fn(async () => response)
    const client = createAssistantClient({
      baseUrl: 'https://ai.test/',
      projectCode: 'demo',
      token: 'jwt',
      language: 'es',
      fetchImpl
    })
    return { client, fetchImpl }
  }

  it('reads the status with the JWT and the language', async () => {
    const { client, fetchImpl } = setup(jsonResponse({ error: false, result: { enabled: true } }))
    await expect(client.getStatus()).resolves.toEqual({ enabled: true })

    const [url, options] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://ai.test/projects/demo/ai/assistant/status?language=es')
    expect(options.headers.Authorization).toBe('Bearer jwt')
    expect(options.method).toBe('GET')
  })

  it('reads the optional dashboard search protocol version', async () => {
    const { client } = setup(jsonResponse({ error: false, result: { enabled: true, dashboard_search_version: 1 } }))
    await expect(client.getStatus()).resolves.toMatchObject({ dashboard_search_version: 1 })
  })

  it('confirms actions with their ids and the language in the body', async () => {
    const { client, fetchImpl } = setup(jsonResponse({ error: false, result: [{ id: 'a1', status: 'executed' }] }))
    await client.confirmActions(['a1'])

    const [url, options] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://ai.test/projects/demo/ai/assistant/actions/confirm')
    expect(JSON.parse(options.body)).toEqual({ action_ids: ['a1'], language: 'es' })
  })

  it('reads the language on each request when it is a function', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: false, result: [] }))
    let language = 'es'
    const client = createAssistantClient({ baseUrl: 'https://ai.test', projectCode: 'demo', token: 'jwt', language: () => language, fetchImpl })

    await client.confirmActions(['a1'])
    language = 'pt_br'
    await client.confirmActions(['a1'])
    await client.getStatus()

    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).language).toBe('es')
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).language).toBe('pt_br')
    expect(fetchImpl.mock.calls[2][0]).toBe('https://ai.test/projects/demo/ai/assistant/status?language=pt_br')
  })

  it('turns the error body into an AssistantRequestError with its code', async () => {
    const { client } = setup(jsonResponse({ error: true, result: ['Limit reached'], code: 'usage_limit' }, 429))
    const error = await client.getStatus().catch(err => err)

    expect(error).toBeInstanceOf(AssistantRequestError)
    expect(error.code).toBe('usage_limit')
    expect(error.status).toBe(429)
    expect(error.message).toBe('Limit reached')
    expect(error.retryAt).toBeNull()
  })

  it('keeps when a reached limit lifts', async () => {
    const { client } = setup(jsonResponse({ error: true, result: ['Limit reached'], code: 'usage_limit', retry_after: 3600, retry_at: '2026-10-02T00:00:00Z' }, 429))
    await expect(client.getStatus()).rejects.toMatchObject({ code: 'usage_limit', retryAt: '2026-10-02T00:00:00.000Z' })
  })

  it('falls back to the code of the HTTP status when the body has none', async () => {
    const { client } = setup({ ok: false, status: 503, json: async () => { throw new Error('not json') } })
    await expect(client.getStatus()).rejects.toMatchObject({ code: 'mcp_unavailable', status: 503 })
  })

  it('streams a message with its conversation and page context', async () => {
    const { client, fetchImpl } = setup({
      ok: true,
      status: 200,
      body: bodyOf(['event: conversation\ndata: {"id":"c1"}\n\nevent: done\ndata: {"aborted":false}\n\n'])
    })
    const onEvent = vi.fn()
    await client.sendMessage({
      message: 'Hi',
      conversationId: 'c1',
      context: { route: '/orders?id=5', order_id: 5 },
      onEvent
    })

    const [url, options] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://ai.test/projects/demo/ai/assistant/messages')
    expect(options.headers.Accept).toBe('text/event-stream')
    expect(JSON.parse(options.body)).toEqual({
      message: 'Hi',
      conversation_id: 'c1',
      context: { route: '/orders?id=5', order_id: 5 },
      language: 'es'
    })
    expect(onEvent.mock.calls).toEqual([['conversation', { id: 'c1' }], ['done', { aborted: false }]])
  })

  it('opts into dashboard search only when the caller provides the registered capability', async () => {
    const { client, fetchImpl } = setup({
      ok: true,
      status: 200,
      body: bodyOf(['event: done\ndata: {"aborted":false}\n\n'])
    })
    await client.sendMessage({
      message: 'Open orders',
      dashboardSearch: { version: 1, scope: 'opaque-scope' },
      onEvent: vi.fn()
    })

    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).dashboard_search).toEqual({
      version: 1,
      scope: 'opaque-scope'
    })
  })

  it('posts correlated read-only search results with the authenticated client', async () => {
    const { client, fetchImpl } = setup(jsonResponse({ error: false, result: { accepted: true } }))
    const result = { version: 1, scope: 'opaque-scope', status: 'ok', items: [] }
    await expect(client.postDashboardSearchResults({
      requestId: 'a6d31d69-8dae-4593-8c6d-f70894951dae',
      conversationId: 'd93d7119-ad3a-4509-9808-064ff6306504',
      scope: 'opaque-scope',
      version: 1,
      result
    })).resolves.toEqual({ accepted: true })

    const [url, options] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://ai.test/projects/demo/ai/assistant/dashboard-search/results')
    expect(options.method).toBe('POST')
    expect(options.headers.Authorization).toBe('Bearer jwt')
    expect(JSON.parse(options.body)).toMatchObject({
      request_id: 'a6d31d69-8dae-4593-8c6d-f70894951dae',
      conversation_id: 'd93d7119-ad3a-4509-9808-064ff6306504',
      scope: 'opaque-scope',
      version: 1,
      result
    })
  })

  it('throws before streaming when the server refuses the message', async () => {
    const { client } = setup(jsonResponse({ error: true, result: ['busy'], code: 'busy' }, 409))
    const onEvent = vi.fn()
    await expect(client.sendMessage({ message: 'Hi', onEvent })).rejects.toMatchObject({ code: 'busy' })
    expect(onEvent).not.toHaveBeenCalled()
  })
})

describe('usage', () => {
  const now = Date.parse('2026-10-01T20:00:00Z')

  it('reads retry_at, else retry_after', () => {
    expect(getRetryAt({ retry_at: '2026-10-02T00:00:00Z', retry_after: 10 }, now)).toBe('2026-10-02T00:00:00.000Z')
    expect(getRetryAt({ retry_at: null, retry_after: 90 }, now)).toBe('2026-10-01T20:01:30.000Z')
    expect(getRetryAt({ retry_at: 'soon', retry_after: 0 }, now)).toBeNull()
    expect(getRetryAt(null, now)).toBeNull()
  })

  it('keeps retry_at only while limited', () => {
    expect(toUsage({ near_limit: true, limited: true, retry_after: 14400, retry_at: '2026-10-02T00:00:00Z' }, now))
      .toEqual({ near_limit: true, limited: true, retry_at: '2026-10-02T00:00:00.000Z' })
    expect(toUsage({ near_limit: true, limited: false, retry_after: 0, retry_at: null }, now))
      .toEqual({ near_limit: true, limited: false, retry_at: null })
    expect(toUsage(undefined, now)).toEqual({ near_limit: false, limited: false, retry_at: null })
  })
})
