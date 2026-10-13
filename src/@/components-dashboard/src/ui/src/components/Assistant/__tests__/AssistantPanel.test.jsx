import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import themeJson from '~/theme.json'

const session = vi.hoisted(() => ({ user: { id: 7, level: 0 }, token: 'jwt', auth: true }))
const languageStore = vi.hoisted(() => {
  let code = 'en'
  const listeners = new Set()
  return {
    get: () => code,
    set: (next) => {
      code = next
      listeners.forEach(listener => listener())
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
})
const useLanguageMock = vi.hoisted(() => (useSyncExternalStore) => () => {
  const code = useSyncExternalStore(languageStore.subscribe, languageStore.get)
  return [{ language: { code } }, (_key, fallback) => fallback]
})

vi.mock('../../../../../contexts/ApiContext', () => ({
  useApi: () => [{ project: 'demo' }]
}))
vi.mock('../../../../../contexts/SessionContext', () => ({
  useSession: () => [session]
}))
vi.mock('../../../../../contexts/LanguageContext', async () => {
  const { useSyncExternalStore } = await vi.importActual('react')
  return { useLanguage: useLanguageMock(useSyncExternalStore) }
})
vi.mock('../../../../../index', async () => {
  const { useSyncExternalStore } = await vi.importActual('react')
  const assistant = await vi.importActual('../../../../../contexts/AssistantContext')
  return {
    ...assistant,
    useLanguage: useLanguageMock(useSyncExternalStore),
    useUtils: () => [{ parsePrice: (value) => `$${Number(value).toFixed(2)}`, parseDate: (value) => String(value) }]
  }
})

import { AssistantProvider, useAssistantPageEntities, useAssistantRecordChanges } from '../../../../../contexts/AssistantContext'
import { EventProvider } from '../../../../../contexts/EventContext'
import { AssistantPanel } from '../AssistantPanel'
import { addQueryToUrl, removeQueryToUrl } from '../../../utils'

const ROOT = 'https://ai.test/projects/demo/ai/assistant'
const encoder = new TextEncoder()

const json = (result, status = 200, code = null) => ({
  ok: status < 400,
  status,
  json: async () => (status < 400 ? { error: false, result } : { error: true, result: [String(result)], code })
})

const sse = (events) => {
  const queue = events.map(([event, data]) => encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
  return {
    ok: true,
    status: 200,
    body: { getReader: () => ({ read: async () => (queue.length ? { value: queue.shift(), done: false } : { done: true }) }) }
  }
}

const preview = (overrides = {}) => ({
  id: 'a1',
  operation_id: 'Product.update',
  path_params: { product_id: 45 },
  record_name: 'Pizza Pepperoni',
  status: 'proposed',
  expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  changes: [{ field: 'price', before_known: true, before: 12, after: 14 }],
  ...overrides
})

const STATUS = { enabled: true, notice_version: 'assistant-2026-10-02', notice_accepted: true, usage: { near_limit: false, limited: false } }

let routes
const route = (method, path, response) => routes.push({ method, path, response })

const PAGE_URL = '/stores/products/pizza-hub?category=7&product=45&id=3'

/** A screen that shows records and reloads them when the assistant changes one */
const RecordScreen = ({ onChange }) => {
  useAssistantRecordChanges(onChange)
  return null
}

const renderPanel = ({ onRecordChange = () => {}, children = null } = {}) => {
  // The context comes from the browser URL (lateral panels write it with replaceState)
  window.history.replaceState(null, '', PAGE_URL)
  return renderWithProviders(
    <EventProvider>
      <AssistantProvider baseUrl='https://ai.test'>
        <RecordScreen onChange={onRecordChange} />
        {children}
        <AssistantPanel />
      </AssistantProvider>
    </EventProvider>,
    { theme: themeJson, initialEntries: [PAGE_URL] }
  )
}

const send = async (text) => {
  const input = await screen.findByRole('textbox', { name: 'Message to the assistant' })
  fireEvent.change(input, { target: { value: text } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

describe('AssistantPanel', () => {
  beforeEach(() => {
    routes = []
    languageStore.set('en')
    window.sessionStorage.clear()
    window.sessionStorage.setItem('assistant:demo:7:open', '1')
    global.fetch = vi.fn(async (url, options = {}) => {
      const method = options.method || 'GET'
      const path = String(url).replace(ROOT, '').split('?')[0]
      const index = routes.findIndex(item => item.method === method && item.path === path)
      if (index < 0) throw new Error(`Unexpected ${method} ${path}`)
      const [match] = routes.splice(index, 1)
      return typeof match.response === 'function' ? match.response(options) : match.response
    })
  })

  afterEach(() => {
    delete global.fetch
  })

  it('asks for the data notice once and then opens the chat', async () => {
    route('GET', '/status', json({ ...STATUS, notice_accepted: false }))
    route('POST', '/notice', (options) => {
      expect(JSON.parse(options.body)).toEqual({ version: 'assistant-2026-10-02', notice_language: 'en', language: 'en' })
      return json({ version: 'assistant-2026-10-02' })
    })
    renderPanel()

    expect(await screen.findByText('Notice version assistant-2026-10-02')).toBeInTheDocument()
    expect(screen.getByText(/Ordering sends your messages, the page you have open/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Accept and start' }))
    expect(await screen.findByText('How can I help?')).toBeInTheDocument()
  })

  it('shows the legal text of the notice from code in the user language', async () => {
    languageStore.set('es')
    route('GET', '/status', json({ ...STATUS, notice_accepted: false }))
    route('POST', '/notice', (options) => {
      expect(JSON.parse(options.body)).toEqual({ version: 'assistant-2026-10-02', notice_language: 'es', language: 'es' })
      return json({ version: 'assistant-2026-10-02' })
    })
    renderPanel()

    expect(await screen.findByText(/Ordering envía tus mensajes, la página que tienes abierta/)).toBeInTheDocument()
    expect(screen.getByText('Usa tus permisos: no puede ver ni cambiar nada que tú no puedas.')).toBeInTheDocument()
    expect(screen.getByText('Antes de empezar')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar y empezar' }))
    expect(await screen.findByText('How can I help?')).toBeInTheDocument()
  })

  it('records the language of the text shown, English without a text for the user language', async () => {
    languageStore.set('ja')
    route('GET', '/status', json({ ...STATUS, notice_accepted: false }))
    route('POST', '/notice', (options) => {
      expect(JSON.parse(options.body)).toEqual({ version: 'assistant-2026-10-02', notice_language: 'en', language: 'ja' })
      return json({ version: 'assistant-2026-10-02' })
    })
    renderPanel()

    expect(await screen.findByText(/Ordering sends your messages, the page you have open/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Accept and start' }))
    expect(await screen.findByText('How can I help?')).toBeInTheDocument()
  })

  it('does not offer to accept a notice of another version than the text shown', async () => {
    route('GET', '/status', json({ ...STATUS, notice_version: '2026-12-01', notice_accepted: false }))
    renderPanel()

    expect(await screen.findByText('This notice is being updated. Reload the page in a few minutes to accept it.')).toBeInTheDocument()
    expect(screen.getByText('Notice version assistant-2026-10-02')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Accept and start' })).not.toBeInTheDocument()
  })

  it('hides backend-shaped internal navigation tool events after the real stream reducer', async () => {
    route('GET', '/status', json(STATUS))
    route('POST', '/messages', sse([
      ['conversation', { id: 'c1', title: 'Stripe' }],
      ['tool', { id: 's1', name: 'search_dashboard_destinations', status: 'running' }],
      ['tool', { id: 's1', name: 'search_dashboard_destinations', status: 'done' }],
      ['tool', { id: 'p1', name: 'present_dashboard_navigation', status: 'running' }],
      ['tool', { id: 'p1', name: 'present_dashboard_navigation', status: 'done' }],
      ['text', { delta: 'Open Stripe Connect.' }],
      ['done', { message_id: 9, aborted: false }]
    ]))
    route('GET', '/status', json(STATUS))
    renderPanel()
    await send('Stripe Connect')
    expect(await screen.findByText('Open Stripe Connect.')).toBeInTheDocument()
    expect(screen.queryByText(/Looked up data/)).not.toBeInTheDocument()
    expect(screen.queryByText('Looking up data…')).not.toBeInTheDocument()
  })

  it('streams an answer with the page context and confirms the proposed change', async () => {
    route('GET', '/status', json(STATUS))
    route('POST', '/messages', (options) => {
      expect(JSON.parse(options.body)).toEqual({
        message: 'Raise it to $14',
        context: { route: '/stores/products/pizza-hub?category=7&product=45&id=3', business_id: 3, product_id: 45 },
        language: 'en'
      })
      return sse([
        ['conversation', { id: 'c1', title: 'Pepperoni price' }],
        ['tool', { id: 't1', name: 'read_operation', operation_id: 'Product.find', label: null, status: 'done' }],
        ['text', { delta: 'This is the change:' }],
        ['actions', { actions: [preview()] }],
        ['done', { message_id: 9, aborted: false }]
      ])
    })
    route('GET', '/status', json(STATUS))
    route('POST', '/actions/confirm', (options) => {
      expect(JSON.parse(options.body)).toEqual({ action_ids: ['a1'], language: 'en' })
      return json([preview({ record_name: null, status: 'executed', after: { price: 14 } })])
    })
    const onRecordChange = vi.fn()
    renderPanel({ onRecordChange })

    expect(await screen.findByText('Store #3')).toBeInTheDocument()
    expect(screen.getByText('Product #45')).toBeInTheDocument()
    await send('Raise it to $14')

    expect(await screen.findByText('This is the change:')).toBeInTheDocument()
    expect(screen.getByText('Looked up data')).toBeInTheDocument()
    expect(within(screen.getByRole('heading', { name: /Pepperoni price/ })).getByText('Beta')).toBeInTheDocument()
    expect(window.sessionStorage.getItem('assistant:demo:7:conversation')).toBe('c1')

    const card = screen.getByText('Pizza Pepperoni').closest('div[class]').parentElement.parentElement
    expect(within(card).getByText('Price')).toBeInTheDocument()
    expect(within(card).getByText('$12.00')).toBeInTheDocument()
    expect(within(card).getByText('$14.00')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(await screen.findByText('Product updated: Pizza Pepperoni')).toBeInTheDocument()
    expect(screen.getByText('Price: $12.00 → $14.00')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument()
    // Screens showing the product reload it
    expect(onRecordChange).toHaveBeenCalledExactlyOnceWith({
      entity: 'Product',
      id: 45,
      ids: { product_id: 45 },
      after: { price: 14 }
    })
  })

  it('follows the ?id= a lateral panel writes with addQueryToUrl', async () => {
    route('GET', '/status', json(STATUS))
    window.history.replaceState(null, '', '/stores/list')
    renderWithProviders(
      <AssistantProvider baseUrl='https://ai.test'>
        <AssistantPanel />
      </AssistantProvider>,
      { theme: themeJson, initialEntries: ['/stores/list'] }
    )

    expect(await screen.findByText('How can I help?')).toBeInTheDocument()
    expect(screen.queryByText('Store #3')).not.toBeInTheDocument()

    act(() => addQueryToUrl({ id: 3 }))
    expect(await screen.findByText('Store #3')).toBeInTheDocument()

    act(() => removeQueryToUrl(['id']))
    await waitFor(() => expect(screen.queryByText('Store #3')).not.toBeInTheDocument())
  })

  it('warns when the change is for another record than the one open', async () => {
    route('GET', '/status', json(STATUS))
    route('POST', '/messages', sse([
      ['conversation', { id: 'c1', title: null }],
      ['actions', { actions: [preview({ record_name: 'Crown Extra', context_mismatch: true })] }],
      ['done', { message_id: 9, aborted: false }]
    ]))
    route('GET', '/status', json(STATUS))
    renderPanel()

    await send('Change the price of this product to 7')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This change is for Crown Extra, not for what you have open on this page. Check it before confirming.'
    )
  })

  it('never shows an unknown outcome as done', async () => {
    route('GET', '/status', json(STATUS))
    route('POST', '/messages', sse([
      ['conversation', { id: 'c1', title: null }],
      ['actions', { actions: [preview()] }],
      ['done', { message_id: 9, aborted: false }]
    ]))
    route('GET', '/status', json(STATUS))
    route('POST', '/actions/confirm', json([preview({ status: 'unknown', observed: 'applied', after: { price: 14 } })]))
    renderPanel()

    await send('Raise it')
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))

    expect(await screen.findByText('We couldn\'t confirm the change to Pizza Pepperoni')).toBeInTheDocument()
    expect(screen.getByText('It looks applied. This is what Pizza Pepperoni has now:')).toBeInTheDocument()
    expect(screen.queryByText(/updated/)).not.toBeInTheDocument()
  })

  it('gives the text back when the server refuses the message', async () => {
    route('GET', '/status', json(STATUS))
    route('POST', '/messages', json('Still answering', 409, 'busy'))
    renderPanel()

    await send('Hello?')
    expect(await screen.findByText(/still answering in this conversation/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Message to the assistant' })).toHaveValue('Hello?'))
    expect(screen.queryByText('Hello?', { selector: 'div' })).not.toBeInTheDocument()
  })

  it('locks the composer when the usage limit is reached', async () => {
    route('GET', '/status', json({ ...STATUS, usage: { near_limit: true, limited: true, retry_after: 0, retry_at: null } }))
    renderPanel()

    expect(await screen.findByText('The assistant reached its usage limit')).toBeInTheDocument()
    expect(screen.getByText(/You can use it again later\. Changes waiting for you can still be confirmed\./)).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Message to the assistant' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Which products are disabled?' })).toBeDisabled()
  })

  it('says when the limit lifts and unlocks the composer then', async () => {
    route('GET', '/status', json(STATUS))
    route('POST', '/messages', {
      ok: false,
      status: 429,
      json: async () => ({ error: true, result: ['Limit reached'], code: 'usage_limit', retry_after: 1, retry_at: new Date(Date.now() + 100).toISOString() })
    })
    renderPanel()

    await send('Hello?')
    expect(await screen.findByText(/You can use it again (today|tomorrow) at/)).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Message to the assistant' })).not.toBeInTheDocument()

    route('GET', '/status', json(STATUS))
    expect(await screen.findByRole('textbox', { name: 'Message to the assistant' }, { timeout: 5000 })).toBeInTheDocument()
  }, 10000)

  it('keeps the chat when one change is not allowed', async () => {
    route('GET', '/status', json(STATUS))
    route('POST', '/messages', sse([
      ['conversation', { id: 'c1', title: null }],
      ['text', { delta: 'This is the change:' }],
      ['actions', { actions: [preview()] }],
      ['done', { message_id: 9, aborted: false }]
    ]))
    route('GET', '/status', json(STATUS))
    route('POST', '/actions/confirm', json('Forbidden', 403, 'no_permission'))
    renderPanel()

    await send('Raise it')
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))

    expect(await screen.findByText('You don\'t have permission to make this change. No change was made.')).toBeInTheDocument()
    expect(screen.getByText('This is the change:')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Message to the assistant' })).toBeInTheDocument()
    expect(screen.queryByText('Your user can\'t use the assistant in this project.')).not.toBeInTheDocument()
  })

  it('keeps the chat when the refresh after a turn fails', async () => {
    route('GET', '/status', json(STATUS))
    route('POST', '/messages', sse([
      ['conversation', { id: 'c1', title: null }],
      ['text', { delta: 'All good' }],
      ['done', { message_id: 9, aborted: false }]
    ]))
    route('GET', '/status', json('Down', 503, 'mcp_unavailable'))
    renderPanel()

    await send('Hello')
    expect(await screen.findByText('All good')).toBeInTheDocument()
    await waitFor(() => expect(routes).toHaveLength(0))
    expect(screen.queryByText('Ordering couldn\'t connect')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Message to the assistant' })).toBeInTheDocument()
  })

  it('keeps the conversation when the language changes and sends the new one', async () => {
    route('GET', '/status', json(STATUS))
    route('POST', '/messages', sse([
      ['conversation', { id: 'c1', title: null }],
      ['text', { delta: 'First answer' }],
      ['done', { message_id: 9, aborted: false }]
    ]))
    route('GET', '/status', json(STATUS))
    renderPanel()

    await send('Hello')
    expect(await screen.findByText('First answer')).toBeInTheDocument()
    await waitFor(() => expect(routes).toHaveLength(0))

    act(() => languageStore.set('es'))
    route('POST', '/messages', (options) => {
      expect(JSON.parse(options.body)).toMatchObject({ conversation_id: 'c1', language: 'es' })
      return sse([['text', { delta: 'Segunda' }], ['done', { message_id: 10, aborted: false }]])
    })
    route('GET', '/status', json(STATUS))
    await send('Hola')

    expect(await screen.findByText('Segunda')).toBeInTheDocument()
    expect(screen.getByText('First answer')).toBeInTheDocument()
  })

  it('takes the store only from the page that shares it, and does not re-render it while streaming', async () => {
    let renders = 0
    const Publisher = ({ id, enabled }) => {
      renders++
      useAssistantPageEntities({ business: { id, name: `Store ${id}` } }, enabled)
      return null
    }
    route('GET', '/status', json(STATUS))
    route('POST', '/messages', sse([
      ['conversation', { id: 'c1', title: null }],
      ['text', { delta: 'One ' }],
      ['text', { delta: 'two ' }],
      ['text', { delta: 'three' }],
      ['done', { message_id: 9, aborted: false }]
    ]))
    route('GET', '/status', json(STATUS))
    renderPanel({ children: <><Publisher id={3} enabled /><Publisher id={9} enabled={false} /></> })

    expect(await screen.findByText('Store 3')).toBeInTheDocument()
    expect(screen.queryByText('Store 9')).not.toBeInTheDocument()

    const before = renders
    await send('Hello')
    expect(await screen.findByText('One two three')).toBeInTheDocument()
    expect(renders).toBe(before)
  })

  it('shows the no permission state', async () => {
    route('GET', '/status', json('Forbidden', 403, 'no_permission'))
    renderPanel()

    expect(await screen.findByText('Your user can\'t use the assistant in this project.')).toBeInTheDocument()
  })
})
