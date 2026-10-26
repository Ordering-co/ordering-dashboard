import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
import { WhatsAppBotsList } from '../index'

const mocks = vi.hoisted(() => ({
  session: [{ token: 'session-secret-token', user: { id: 7, level: 0 } }],
  api: [{ root: 'https://api.test/v400/en/demo' }]
}))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => mocks.session }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => mocks.api }))

const META_TOKEN = 'EAAsecret-meta-token'

let controller
const UI = (props) => {
  controller = props
  return null
}

const connectedAgent = {
  id: 4,
  provider: 'whatsapp',
  provider_type: 'chat_bot',
  franchise_id: null,
  enabled: true,
  provider_external_id: '10987654321',
  configured: true,
  misconfigured_reason: null,
  settings: {},
  provider_settings: {
    auth_type: 'business_login',
    country_code: '1',
    phone_number: '5551234567',
    access_token: META_TOKEN,
    waba_id: '2233445566',
    pin: '908172',
    pin_downloaded_at: '2026-10-01 10:00:00',
    registration_status: 'CONNECTED'
  }
}

const loggedOutAgent = {
  ...connectedAgent,
  provider_external_id: null,
  configured: false,
  misconfigured_reason: 'logged_out',
  provider_settings: { auth_type: 'business_login', language_code: 'en' }
}

const respond = (body, ok = true) => Promise.resolve({ ok, json: async () => body })
const pathOf = (url) => new URL(url).pathname.replace('/v400/en/demo', '')

const allUrls = (fetchMock) => fetchMock.mock.calls.map(([url]) => url)

describe('WhatsApp bot connection controller', () => {
  let fetchMock
  let agent

  beforeEach(() => {
    controller = null
    agent = connectedAgent
    fetchMock = vi.fn((url, options = {}) => {
      const path = pathOf(url)
      if (path === '/ai/agents' && !options.method) {
        return respond({ error: false, result: [agent], pagination: { current_page: 1, page_size: 10, total_pages: 1, total: 1 } })
      }
      if (path === '/ai/agents/4' && !options.method) return respond({ error: false, result: agent })
      if (path === '/ai/agents/4/auth/business_login/logout') {
        agent = loggedOutAgent
        return respond({ error: false, result: {} })
      }
      if (path === '/ai/agents/4' && options.method === 'PUT') return respond({ error: false, result: {} })
      return respond({ error: true, result: ['NOT_MOCKED'] }, false)
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete window.FB
  })

  it('reads the connection with params only and keeps no secret in the state', async () => {
    render(<WhatsAppBotsList UIComponent={UI} botId='4' />)
    await waitFor(() => expect(controller.connectionState.connection).toBeTruthy())

    const connectionCall = fetchMock.mock.calls.find(([url]) => pathOf(url) === '/ai/agents/4')
    const url = new URL(connectionCall[0])
    expect([...url.searchParams.keys()]).toEqual(['params'])
    expect(url.searchParams.get('params')).toBe('id,provider_external_id,configured,misconfigured_reason,provider_settings')
    expect(connectionCall[1].headers.Authorization).toBe('Bearer session-secret-token')

    expect(controller.connectionState.connection).toMatchObject({ configured: true, hasAccessToken: true, hasPin: true })
    expect(JSON.stringify(controller.connectionState)).not.toContain(META_TOKEN)
    expect(JSON.stringify(controller.connectionState)).not.toContain('908172')
  })

  it('disconnects, reloads and clears the number from the list row', async () => {
    render(<WhatsAppBotsList UIComponent={UI} botId='4' />)
    await waitFor(() => expect(controller.botsState.bots[0]?.phone).toBe('+1 555 123 4567'))
    await waitFor(() => expect(controller.connectionState.connection).toBeTruthy())

    await act(async () => { await controller.disconnect() })

    const logout = fetchMock.mock.calls.find(([url]) => pathOf(url) === '/ai/agents/4/auth/business_login/logout')
    expect(logout[1].method).toBe('POST')
    await waitFor(() => expect(controller.connectionState.connection.misconfiguredReason).toBe('logged_out'))
    expect(controller.connectionState.notice).toEqual({ type: 'success', key: 'disconnect', messages: [] })
    expect(controller.botsState.bots[0].phone).toBeNull()
  })

  it('sends manual credentials in the body, never in the URL', async () => {
    render(<WhatsAppBotsList UIComponent={UI} botId='4' />)
    await waitFor(() => expect(controller.connectionState.connection).toBeTruthy())

    await act(async () => {
      await controller.saveManualCredentials({ provider_settings: { access_token: 'EAAnew-token' } })
    })

    const put = fetchMock.mock.calls.find(([url, options]) => pathOf(url) === '/ai/agents/4' && options?.method === 'PUT')
    expect(JSON.parse(put[1].body)).toEqual({ provider_settings: { access_token: 'EAAnew-token' } })
    expect(allUrls(fetchMock).join(' ')).not.toContain('EAAnew-token')
    expect(allUrls(fetchMock).join(' ')).not.toContain('session-secret-token')
  })

  it('saves the PIN, runs Embedded Signup and completes with the session ids', async () => {
    agent = loggedOutAgent
    const routes = fetchMock.getMockImplementation()
    fetchMock.mockImplementation((url, options = {}) => {
      const path = pathOf(url)
      if (path === '/ai/agents/4/auth/business_login/init') {
        return respond({ error: false, result: { facebook: { app_id: 'app-1', config_id: 'cfg-1', scope: 'whatsapp_business_management' } } })
      }
      if (path === '/ai/agents/4/auth/business_login/complete') {
        agent = connectedAgent
        return respond({ error: false, result: {} })
      }
      return routes(url, options)
    })
    window.FB = {
      init: vi.fn(),
      login: vi.fn((callback) => {
        window.dispatchEvent(new MessageEvent('message', {
          origin: 'https://www.facebook.com',
          data: JSON.stringify({ type: 'WA_EMBEDDED_SIGNUP', event: 'FINISH', data: { phone_number_id: '10987654321', waba_id: '2233445566' } })
        }))
        callback({ authResponse: { code: 'meta-code' } })
      })
    }

    render(<WhatsAppBotsList UIComponent={UI} botId='4' />)
    await waitFor(() => expect(controller.connectionState.connection).toBeTruthy())

    await act(async () => { await controller.connectWithMeta({ pin: '654321' }) })

    const calls = fetchMock.mock.calls.filter(([url, options]) => options?.method)
    expect(calls.map(([url]) => pathOf(url))).toEqual([
      '/ai/agents/4',
      '/ai/agents/4/auth/business_login/init',
      '/ai/agents/4/auth/business_login/complete'
    ])
    expect(JSON.parse(calls[0][1].body)).toEqual({ provider_settings: { pin: '654321' } })
    expect(JSON.parse(calls[2][1].body)).toEqual({ code: 'meta-code', phone_number_id: '10987654321', waba_id: '2233445566' })
    expect(window.FB.init).toHaveBeenCalledWith(expect.objectContaining({ appId: 'app-1' }))
    await waitFor(() => expect(controller.connectionState.connection.configured).toBe(true))
    expect(allUrls(fetchMock).join(' ')).not.toContain('654321')
  })

  it('ignores signup messages from other origins', async () => {
    agent = loggedOutAgent
    const routes = fetchMock.getMockImplementation()
    fetchMock.mockImplementation((url, options = {}) => {
      const path = pathOf(url)
      if (path === '/ai/agents/4/auth/business_login/init') {
        return respond({ error: false, result: { facebook: { app_id: 'app-1', config_id: 'cfg-1' } } })
      }
      if (path === '/ai/agents/4/auth/business_login/complete') return respond({ error: false, result: {} })
      return routes(url, options)
    })
    vi.useFakeTimers({ shouldAdvanceTime: true })
    window.FB = {
      init: vi.fn(),
      login: vi.fn((callback) => {
        window.dispatchEvent(new MessageEvent('message', {
          origin: 'https://evil-facebook.com.attacker.test',
          data: JSON.stringify({ type: 'WA_EMBEDDED_SIGNUP', event: 'FINISH', data: { phone_number_id: '666', waba_id: '666' } })
        }))
        callback({ authResponse: { code: 'meta-code' } })
      })
    }

    render(<WhatsAppBotsList UIComponent={UI} botId='4' />)
    await waitFor(() => expect(controller.connectionState.connection).toBeTruthy())

    let done
    act(() => { done = controller.connectWithMeta({ pin: '' }) })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100)
      await done
    })
    vi.useRealTimers()

    const complete = fetchMock.mock.calls.find(([url]) => pathOf(url) === '/ai/agents/4/auth/business_login/complete')
    expect(JSON.parse(complete[1].body)).toEqual({ code: 'meta-code' })
  })
})
