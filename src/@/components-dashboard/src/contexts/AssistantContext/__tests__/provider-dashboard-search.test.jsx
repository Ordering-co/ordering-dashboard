import React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AssistantProvider, useAssistant } from '../index'
import { ASSISTANT_NOTICE_VERSION } from '../notice'
import { DashboardDestinationsProvider, useDashboardDestinations } from '../../../ui/src/contexts/DashboardDestinationsContext'

const assistantRoot = 'https://ai.test/projects/demo/ai/assistant'
const encoder = new TextEncoder()

const jsonResponse = (result) => ({
  ok: true,
  status: 200,
  json: async () => ({ error: false, result })
})

const eventChunk = (event, data) => encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

const runtime = vi.hoisted(() => {
  const ordering = { project: 'demo', root: 'https://api.test/v400/en/demo' }
  const user = { id: 7, level: 0, user_system_id: 1 }
  return { ordering, user }
})
let assistantHandle

vi.mock('../../ApiContext', () => ({
  useApi: () => [runtime.ordering]
}))
vi.mock('../../SessionContext', () => ({
  useSession: () => [{ token: 'session-token', user: runtime.user, auth: true }]
}))
vi.mock('../../LanguageContext', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback]
}))
vi.mock('../../EventContext', () => ({
  useEvent: () => [null]
}))
vi.mock('../../../ui/src/hooks/useDashboardNavigation', () => ({
  useDashboardNavigation: () => vi.fn()
}))

const Reader = () => {
  const assistant = useAssistant()
  const destinations = useDashboardDestinations()
  assistantHandle = assistant
  return (
    <>
      <output data-testid='protocol'>{JSON.stringify({
        status: assistant.status,
        scope: destinations.scope,
        items: assistant.items
      })}</output>
    </>
  )
}

describe('AssistantProvider dashboard search callback', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    window.sessionStorage.clear()
  })

  it('keeps the registered callback through lazy catalog readiness and reduces returned destinations', async () => {
    let releaseSettings
    let markSettingsStarted
    let releaseCallback
    const settingsStarted = new Promise(resolve => { markSettingsStarted = resolve })
    const callbackPosted = new Promise(resolve => { releaseCallback = resolve })
    let callbackBody
    let messageBody
    const requestId = 'a6d31d69-8dae-4593-8c6d-f70894951dae'
    const conversationId = 'd93d7119-ad3a-4509-9808-064ff6306504'
    const resultEnvelope = {
      version: 1,
      scope: '',
      revision: 'rev-1',
      query: '',
      status: 'ok',
      items: [{ id: 'nav:orders', title: 'Orders' }],
      errors: []
    }

    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
      if (url.startsWith(`${assistantRoot}/status`)) {
        return jsonResponse({
          enabled: true,
          notice_version: ASSISTANT_NOTICE_VERSION,
          notice_accepted: true,
          dashboard_search_version: 1,
          dashboard_search_presentation_version: 2,
          usage: {}
        })
      }
      if (url === `${assistantRoot}/messages`) {
        messageBody = JSON.parse(options.body)
        return {
          ok: true,
          status: 200,
          body: {
            getReader: () => {
              const chunks = [
                eventChunk('conversation', { id: conversationId, title: 'Search' }),
                eventChunk('dashboard_search', {
                  request_id: requestId,
                  conversation_id: conversationId,
                  scope: messageBody.dashboard_search.scope,
                  version: 1,
                  args: { query: '', destination_id: 'nav:orders' }
                })
              ]
              let index = 0
              return {
                read: async () => {
                  if (index < chunks.length) return { value: chunks[index++], done: false }
                  if (index === 2) {
                    await callbackPosted
                    index++
                    resultEnvelope.scope = messageBody.dashboard_search.scope
                    return { value: eventChunk('destinations', { key: 'tool-1', ...resultEnvelope }), done: false }
                  }
                  if (index === 3) {
                    index++
                    return { value: eventChunk('done', { aborted: false }), done: false }
                  }
                  return { value: undefined, done: true }
                }
              }
            }
          }
        }
      }
      if (url === `${assistantRoot}/dashboard-search/results`) {
        callbackBody = JSON.parse(options.body)
        releaseCallback()
        return jsonResponse({ accepted: true })
      }
      if (url.includes('/config_categories')) {
        markSettingsStarted()
        await new Promise(resolve => { releaseSettings = resolve })
        return jsonResponse([])
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }))

    render(
      <MemoryRouter initialEntries={['/assistant']}>
        <AssistantProvider baseUrl='https://ai.test'>
          <DashboardDestinationsProvider>
            <Reader />
          </DashboardDestinationsProvider>
        </AssistantProvider>
      </MemoryRouter>
    )

    await waitFor(() => expect(JSON.parse(screen.getByTestId('protocol').textContent).status.loaded).toBe(true))
    let sendPromise
    act(() => {
      sendPromise = assistantHandle.sendMessage('Find orders')
    })
    await settingsStarted
    expect(messageBody.dashboard_search).toMatchObject({ version: 1, presentation_version: 2 })
    await act(async () => releaseSettings())
    await waitFor(() => expect(callbackBody).toBeDefined())
    await act(async () => { await sendPromise })

    expect(callbackBody).toMatchObject({
      request_id: requestId,
      conversation_id: conversationId,
      version: 1,
      result: { items: [{ id: 'nav:orders' }] }
    })
    expect(callbackBody).not.toHaveProperty('language')
    const protocol = JSON.parse(screen.getByTestId('protocol').textContent)
    expect(protocol.items).toContainEqual(expect.objectContaining({
      kind: 'destinations',
      key: 'tool-1',
      items: [{ id: 'nav:orders', title: 'Orders' }]
    }))
  })
})
