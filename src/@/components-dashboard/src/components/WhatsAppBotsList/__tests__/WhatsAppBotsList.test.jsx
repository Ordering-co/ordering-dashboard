import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
import { WhatsAppBotsList, toWhatsAppBot } from '../index'

const mocks = vi.hoisted(() => ({
  session: [{ token: 'test-token', user: { id: 7, level: 0 } }],
  api: [{ root: 'https://api.test/v400/en/demo' }]
}))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => mocks.session }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => mocks.api }))

let controller
const UI = (props) => {
  controller = props
  return null
}

const pagination = { current_page: 1, page_size: 10, total_pages: 1, total: 2 }

const whatsappBot = {
  id: 4,
  provider: 'whatsapp',
  provider_type: 'chat_bot',
  franchise_id: 67,
  enabled: true,
  provider_settings: { country_code: '1', phone_number: '5551234567', access_token: 'secret-meta-token' }
}

const respond = (body, ok = true) => Promise.resolve({ ok, json: async () => body })
const brands = { error: false, result: [{ id: 67, name: 'Pizza Hat', logo: 'https://cdn.test/pizza.png' }] }
const isBrandRequest = (url) => new URL(url).pathname.endsWith('/franchises')

describe('WhatsAppBotsList', () => {
  let fetchMock

  beforeEach(() => {
    controller = null
    fetchMock = vi.fn((url) => isBrandRequest(url)
      ? respond(brands)
      : respond({ error: false, result: [whatsappBot], pagination }))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('asks /ai/agents for whatsapp chat bots only, one page at a time', async () => {
    render(<WhatsAppBotsList UIComponent={UI} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    const [url, options] = fetchMock.mock.calls[0]
    const parsed = new URL(url)
    expect(parsed.origin + parsed.pathname).toBe('https://api.test/v400/en/demo/ai/agents')
    expect(JSON.parse(parsed.searchParams.get('where'))).toEqual([
      { attribute: 'provider', value: 'whatsapp' },
      { attribute: 'provider_type', value: 'chat_bot' }
    ])
    expect(parsed.searchParams.get('page')).toBe('1')
    expect(parsed.searchParams.get('page_size')).toBe('10')
    expect(options.headers.Authorization).toBe('Bearer test-token')
  })

  it('keeps only whatsapp chat bots, adds their brand and never the access token', async () => {
    fetchMock.mockImplementationOnce(() => respond({
      error: false,
      result: [
        whatsappBot,
        { id: 8, provider: 'whatsapp', provider_type: 'chat', franchise_id: 67, enabled: true },
        { id: 9, provider: 'finitless', provider_type: 'voice', enabled: true }
      ],
      pagination
    }))
    render(<WhatsAppBotsList UIComponent={UI} />)
    await waitFor(() => expect(controller.botsState.bots[0]?.brand).toBeTruthy())

    expect(controller.botsState.bots).toEqual([{
      id: 4,
      phone: '+1 555 123 4567',
      enabled: true,
      brandId: 67,
      brand: { id: 67, name: 'Pizza Hat', logo: 'https://cdn.test/pizza.png' }
    }])
    expect(JSON.stringify(controller.botsState)).not.toContain('secret-meta-token')
    expect(controller.botsState.pagination).toEqual({ currentPage: 1, pageSize: 10, totalPages: 1, total: 2 })

    const brandUrl = new URL(fetchMock.mock.calls.find(([url]) => isBrandRequest(url))[0])
    expect(JSON.parse(brandUrl.searchParams.get('where'))).toEqual([{ attribute: 'id', value: [67] }])
    expect(brandUrl.searchParams.get('params')).toBe('id,name,logo')
  })

  it('still lists the bots when the brands cannot be read', async () => {
    fetchMock.mockImplementation((url) => isBrandRequest(url)
      ? Promise.reject(new Error('Failed to fetch'))
      : respond({ error: false, result: [whatsappBot], pagination }))
    render(<WhatsAppBotsList UIComponent={UI} />)
    await waitFor(() => expect(controller.botsState.loading).toBe(false))
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => isBrandRequest(url))).toBe(true))

    expect(controller.botsState.error).toBeNull()
    expect(controller.botsState.bots).toEqual([{ id: 4, phone: '+1 555 123 4567', enabled: true, brandId: 67, brand: null }])
  })

  it('does not ask for brands when no bot has one', async () => {
    fetchMock.mockImplementationOnce(() => respond({ error: false, result: [{ ...whatsappBot, franchise_id: null }], pagination }))
    render(<WhatsAppBotsList UIComponent={UI} />)
    await waitFor(() => expect(controller.botsState.loading).toBe(false))

    expect(fetchMock.mock.calls.some(([url]) => isBrandRequest(url))).toBe(false)
  })

  it('loads the requested page and page size', async () => {
    render(<WhatsAppBotsList UIComponent={UI} />)
    await waitFor(() => expect(controller.botsState.loading).toBe(false))
    await act(async () => controller.getBots(3, 25))

    const agentCalls = fetchMock.mock.calls.filter(([url]) => !isBrandRequest(url))
    const parsed = new URL(agentCalls[1][0])
    expect(parsed.searchParams.get('page')).toBe('3')
    expect(parsed.searchParams.get('page_size')).toBe('25')
  })

  it('exposes the API error and clears the list', async () => {
    fetchMock.mockImplementationOnce(() => respond({ error: true, result: ['ERROR_ACCESS_DENIED'] }, false))
    render(<WhatsAppBotsList UIComponent={UI} />)
    await waitFor(() => expect(controller.botsState.loading).toBe(false))

    expect(controller.botsState.error).toEqual(['ERROR_ACCESS_DENIED'])
    expect(controller.botsState.bots).toEqual([])
  })

  it('exposes a network failure as an error', async () => {
    fetchMock.mockImplementationOnce(() => Promise.reject(new Error('Failed to fetch')))
    render(<WhatsAppBotsList UIComponent={UI} />)
    await waitFor(() => expect(controller.botsState.loading).toBe(false))

    expect(controller.botsState.error).toEqual(['Failed to fetch'])
  })

  it('sends only the changed color and keeps the saved colors when the hex is rejected', async () => {
    const agent = {
      error: false,
      result: {
        id: 4,
        settings: {
          branch_selection_mode: 'marketplace',
          webview_primary_color: '#aabbcc',
          webview_secondary_color: '#112233'
        }
      }
    }
    fetchMock.mockImplementation((url) => {
      if (isBrandRequest(url)) return respond(brands)
      if (String(url).includes('/ai/agents/4')) return respond(agent)
      return respond({ error: false, result: [whatsappBot], pagination })
    })
    render(<WhatsAppBotsList UIComponent={UI} botId={4} />)
    await waitFor(() => expect(controller.settingsState.saved?.primaryColor).toBe('#aabbcc'))

    fetchMock.mockImplementationOnce(() => respond({
      error: true,
      result: ['The settings.webview_primary_color must be a hex color like #rrggbb.']
    }, false))
    await act(async () => {
      await controller.saveBotSettings({ webview_primary_color: '#fff' })
    })

    const saveCall = fetchMock.mock.calls.find(([, options]) => options?.method === 'PUT')
    expect(saveCall[0]).toBe('https://api.test/v400/en/demo/ai/agents/4')
    expect(JSON.parse(saveCall[1].body)).toEqual({ settings: { webview_primary_color: '#fff' } })
    expect(controller.settingsState.error).toEqual(['The settings.webview_primary_color must be a hex color like #rrggbb.'])
    expect(controller.settingsState.saved).toEqual({
      branchSelectionMode: 'marketplace',
      primaryColor: '#aabbcc',
      secondaryColor: '#112233'
    })
  })

  it('sends the new brand on its own and updates the row', async () => {
    render(<WhatsAppBotsList UIComponent={UI} botId={4} />)
    await waitFor(() => expect(controller.botsState.bots[0]?.brandId).toBe(67))

    fetchMock.mockImplementation((url, options) => {
      if (options?.method === 'PUT') return respond({ error: false, result: { id: 4, franchise_id: 8 } })
      if (isBrandRequest(url)) return respond(brands)
      return respond({ error: false, result: [whatsappBot], pagination })
    })
    await act(async () => {
      await controller.saveBotSettings({}, { franchiseId: 8, brand: { name: 'Other', logo: 'https://cdn.test/other.png' } })
    })

    const saveCall = fetchMock.mock.calls.find(([, options]) => options?.method === 'PUT')
    expect(JSON.parse(saveCall[1].body)).toEqual({ franchise_id: 8 })
    expect(controller.botsState.bots[0].brandId).toBe(8)
    expect(controller.botsState.bots[0].brand).toEqual({ id: 8, name: 'Other', logo: 'https://cdn.test/other.png' })
  })

  it('keeps the current brand when the change is rejected', async () => {
    render(<WhatsAppBotsList UIComponent={UI} botId={4} />)
    await waitFor(() => expect(controller.botsState.bots[0]?.brandId).toBe(67))

    fetchMock.mockImplementation((url, options) => {
      if (options?.method === 'PUT') return respond({ error: true, result: ['ERROR_ACCESS_DENIED'] }, false)
      if (isBrandRequest(url)) return respond(brands)
      return respond({ error: false, result: [whatsappBot], pagination })
    })
    await act(async () => {
      await controller.saveBotSettings({}, { franchiseId: 8, brand: { name: 'Other', logo: null } })
    })

    expect(controller.botsState.bots[0].brandId).toBe(67)
    expect(controller.settingsState.error).toEqual(['ERROR_ACCESS_DENIED'])
  })

  it('loads the brand catalog one page at a time', async () => {
    fetchMock.mockImplementation((url) => {
      if (!isBrandRequest(url)) return respond({ error: false, result: [whatsappBot], pagination })
      const page = Number(new URL(url).searchParams.get('page'))
      const where = new URL(url).searchParams.get('where')
      if (where) return respond(brands)
      return respond({
        error: false,
        result: page === 1
          ? [{ id: 1, name: 'Alpha', enabled: true, logo: null }]
          : [{ id: 2, name: 'Closed', enabled: false, logo: null }],
        pagination: { current_page: page, total_pages: 2 }
      })
    })
    render(<WhatsAppBotsList UIComponent={UI} />)
    await waitFor(() => expect(controller.botsState.loading).toBe(false))

    await act(async () => { await controller.loadBrands() })

    const catalogCall = fetchMock.mock.calls.map(([url]) => new URL(url)).filter(url => isBrandRequest(url) && !url.searchParams.get('where')).pop()
    expect(catalogCall.searchParams.get('page')).toBe('1')
    expect(catalogCall.searchParams.get('page_size')).toBe('10')
    expect(controller.brandsState.brands.map(brand => brand.id)).toEqual([1])
    expect(controller.brandsState.hasNextPage).toBe(true)

    await act(async () => { await controller.loadMoreBrands() })

    expect(controller.brandsState.brands).toEqual([
      { id: 1, name: 'Alpha', logo: null, enabled: true },
      { id: 2, name: 'Closed', logo: null, enabled: false }
    ])
    expect(controller.brandsState.hasNextPage).toBe(false)
  })

  it('creates a whatsapp chat bot and never another provider', async () => {
    render(<WhatsAppBotsList UIComponent={UI} />)
    await waitFor(() => expect(controller.botsState.loading).toBe(false))

    fetchMock.mockImplementationOnce(() => respond({ error: false, result: { id: 90 } }))
    let created
    await act(async () => {
      created = await controller.createBot({
        provider: 'finitless',
        provider_type: 'voice',
        franchiseId: 67,
        languageCode: 'es',
        enabled: true,
        branchSelectionMode: 'auto',
        authType: 'business_login',
        primaryColor: '',
        secondaryColor: '#ffc72c'
      })
    })

    const createCall = fetchMock.mock.calls.find(([, options]) => options?.method === 'POST')
    expect(createCall[0]).toBe('https://api.test/v400/en/demo/ai/agents')
    expect(JSON.parse(createCall[1].body)).toEqual({
      provider: 'whatsapp',
      provider_type: 'chat_bot',
      franchise_id: 67,
      enabled: true,
      provider_settings: { auth_type: 'business_login', language_code: 'es' },
      settings: { branch_selection_mode: 'auto', webview_secondary_color: '#ffc72c' }
    })
    expect(created).toBe(90)
    expect(controller.createState.error).toBeNull()
  })

  it('sends only enabled when the switch changes', async () => {
    render(<WhatsAppBotsList UIComponent={UI} />)
    await waitFor(() => expect(controller.botsState.loading).toBe(false))

    fetchMock.mockImplementationOnce(() => respond({ error: false, result: { id: 4, enabled: false } }))
    await act(async () => {
      await controller.setBotEnabled(4, false)
    })

    const saveCall = fetchMock.mock.calls.find(([, options]) => options?.method === 'PUT')
    expect(saveCall[0]).toBe('https://api.test/v400/en/demo/ai/agents/4')
    expect(JSON.parse(saveCall[1].body)).toEqual({ enabled: false })
    expect(Object.keys(JSON.parse(saveCall[1].body))).toEqual(['enabled'])
    expect(controller.botsState.bots[0].enabled).toBe(false)
    expect(controller.toggleState.error).toBeNull()
  })

  it('keeps the previous enabled state when the update is rejected', async () => {
    render(<WhatsAppBotsList UIComponent={UI} />)
    await waitFor(() => expect(controller.botsState.loading).toBe(false))

    fetchMock.mockImplementationOnce(() => respond({ error: true, result: ['ERROR_ACCESS_DENIED'] }, false))
    await act(async () => {
      await controller.setBotEnabled(4, false)
    })

    expect(controller.botsState.bots[0].enabled).toBe(true)
    expect(controller.toggleState).toEqual({ savingId: null, error: { id: 4, codes: ['ERROR_ACCESS_DENIED'] } })
  })

  it('keeps the previous enabled state when the update cannot be sent', async () => {
    render(<WhatsAppBotsList UIComponent={UI} />)
    await waitFor(() => expect(controller.botsState.loading).toBe(false))

    fetchMock.mockImplementationOnce(() => Promise.reject(new Error('Failed to fetch')))
    await act(async () => {
      await controller.setBotEnabled(4, false)
    })

    expect(controller.botsState.bots[0].enabled).toBe(true)
    expect(controller.toggleState.error).toEqual({ id: 4, codes: ['Failed to fetch'] })
  })
})

describe('toWhatsAppBot', () => {
  it('builds the phone from the dial parts and leaves it empty when missing', () => {
    expect(toWhatsAppBot({ id: 1, enabled: false, franchise_id: 3, provider_settings: { country_code: '+57', phone_number: '300 123-4567' } }))
      .toEqual({ id: 1, phone: '+57 300 1234567', enabled: false, brandId: 3, brand: null })
    expect(toWhatsAppBot({ id: 2, enabled: true, provider_settings: {} }))
      .toEqual({ id: 2, phone: null, enabled: true, brandId: null, brand: null })
    expect(toWhatsAppBot({ id: 3 })).toEqual({ id: 3, phone: null, enabled: false, brandId: null, brand: null })
  })
})
