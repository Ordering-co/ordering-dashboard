import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import { WhatsAppBots } from '../index'
import theme from '~/theme.json'

const mocks = vi.hoisted(() => ({
  session: [{ token: 'test-token', user: { id: 7, level: 0 } }],
  api: [{ root: 'https://api.test/v400/en/demo' }]
}))

vi.mock('~components/contexts/SessionContext', () => ({ useSession: () => mocks.session }))
vi.mock('~components/contexts/ApiContext', () => ({ useApi: () => mocks.api }))

const bot = {
  id: 4,
  provider: 'whatsapp',
  provider_type: 'chat_bot',
  franchise_id: 67,
  enabled: true,
  provider_settings: { country_code: '1', phone_number: '5551234567', access_token: 'secret-meta-token' }
}

const respond = (body, ok = true) => Promise.resolve({ ok, json: async () => body })

describe('WhatsApp bots list switch', () => {
  let fetchMock

  beforeEach(() => {
    fetchMock = vi.fn((url) => String(url).includes('/franchises')
      ? respond({ error: false, result: [{ id: 67, name: 'Pizza Hat', logo: null }] })
      : respond({ error: false, result: [bot], pagination: { current_page: 1, page_size: 10, total_pages: 1, total: 1 } }))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('toggles enabled only and shows the error without a delete control', async () => {
    renderWithProviders(<WhatsAppBots />, { theme })

    const disable = await screen.findByRole('checkbox', { name: 'Disable' })
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull()

    fetchMock.mockImplementationOnce(() => respond({ error: false, result: { id: 4, enabled: false } }))
    fireEvent.click(disable)

    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Enable' })).toBeTruthy())
    const saveCall = fetchMock.mock.calls.find(([, options]) => options?.method === 'PUT')
    expect(saveCall[0]).toBe('https://api.test/v400/en/demo/ai/agents/4')
    expect(JSON.parse(saveCall[1].body)).toEqual({ enabled: false })

    fetchMock.mockImplementationOnce(() => respond({ error: true, result: ['ERROR_ACCESS_DENIED'] }, false))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The bot could not be updated.')
    expect(screen.getByRole('checkbox', { name: 'Enable' })).toBeTruthy()
  })

  it('opens the test chat from the list without putting the session token in the link', async () => {
    window.localStorage.setItem('token', 'session-secret-token')
    const withoutNumber = {
      ...bot,
      id: 8,
      enabled: false,
      provider_settings: { country_code: '', phone_number: '' }
    }
    fetchMock.mockImplementation((url) => String(url).includes('/franchises')
      ? respond({ error: false, result: [{ id: 67, name: 'Pizza Hat', logo: null }] })
      : respond({
        error: false,
        result: [bot, withoutNumber],
        pagination: { current_page: 1, page_size: 10, total_pages: 1, total: 2 }
      }))
    renderWithProviders(<WhatsAppBots />, { theme })

    const buttons = await screen.findAllByRole('button', { name: 'Test WhatsApp Agent' })
    expect(buttons).toHaveLength(1)
    fireEvent.click(buttons[0])

    const link = await screen.findByRole('link', { name: 'Open WhatsApp Link' })
    expect(link.getAttribute('href')).toBe('https://wa.me/15551234567')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(document.body.innerHTML).not.toContain('session-secret-token')
    window.localStorage.removeItem('token')
  })

  it('disables only the switch that is saving', async () => {
    const other = {
      ...bot,
      id: 8,
      enabled: false,
      provider_settings: { country_code: '57', phone_number: '3001234567' }
    }
    const list = { error: false, result: [bot, other], pagination: { current_page: 1, page_size: 10, total_pages: 1, total: 2 } }
    fetchMock.mockImplementation((url) => String(url).includes('/franchises')
      ? respond({ error: false, result: [{ id: 67, name: 'Pizza Hat', logo: null }] })
      : respond(list))
    renderWithProviders(<WhatsAppBots />, { theme })
    await screen.findByText('WhatsApp bot #8')

    let release
    fetchMock.mockImplementation((url, options) => {
      if (options?.method === 'PUT') {
        return new Promise((resolve) => {
          release = () => resolve({ ok: true, json: async () => ({ error: false, result: { id: 4, enabled: false } }) })
        })
      }
      return String(url).includes('/franchises')
        ? respond({ error: false, result: [{ id: 67, name: 'Pizza Hat', logo: null }] })
        : respond(list)
    })
    fireEvent.click(screen.getAllByRole('checkbox')[0])

    await waitFor(() => expect(screen.getAllByRole('checkbox')[0]).toBeDisabled())
    expect(screen.getAllByRole('checkbox')[1]).toBeEnabled()

    release()
    await waitFor(() => expect(screen.getAllByRole('checkbox')[0]).toBeEnabled())
    expect(screen.getAllByRole('checkbox')[1]).toBeEnabled()
  })

  it('hides the settings panel when it is closed after loading with ?id=', async () => {
    renderWithProviders(<WhatsAppBots />, {
      theme,
      initialEntries: ['/connect/whatsapp-bots?id=4']
    })

    await waitFor(() => {
      expect(document.getElementById('whatsapp_bot_settings')).toBeTruthy()
    })

    fireEvent.click(document.getElementById('whatsapp_bot_settings').querySelector('button'))

    await waitFor(() => {
      expect(document.getElementById('whatsapp_bot_settings')).toBeNull()
    })
  })
})
