/* eslint-disable import/first */
import React from 'react'
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// redesign messages B1 (B1-3, decision 10A): ConversationChat mounts the panel's chat outside the panel (for /messages): it runs
// its own Messages controller for a plain order, fills its parent with the log as the scroll area and the composer below it,
// restores an initial draft once and reports every draft change (also the empty one after a send).
// The chat runs the REAL Messages controller; only its contexts and fetch are simulated.
const mocks = vi.hoisted(() => ({ handlers: new Set(), user: { id: 1, level: 0 } }))

const t = (key, fallback) => fallback ?? key
const sessionState = () => [{ user: mocks.user, token: 'token' }]
const utilsState = [{
  parseDate: (value) => `at ${value}`,
  getTimeAgo: (value) => `ago ${value}`,
  optimizeImage: (value) => value,
  getOrderState: (status) => `State ${status}`,
  parsePrice: (value) => `$${value}`
}]
const socket = {
  on: (event, handler) => { if (event === 'message') mocks.handlers.add(handler) },
  off: (event, handler) => { if (event === 'message') mocks.handlers.delete(handler) },
  join: vi.fn(),
  leave: vi.fn()
}

vi.mock('~ui', () => ({ capitalize: (value) => value }))
vi.mock('../../../../../../contexts/SessionContext', () => ({ useSession: () => sessionState() }))
vi.mock('../../../../../../contexts/ApiContext', () => ({ useApi: () => [{ root: 'https://api.test' }] }))
vi.mock('../../../../../../contexts/WebsocketContext', () => ({ useWebsocket: () => socket }))
vi.mock('../../../../../../contexts/ConfigContext', () => ({ useConfig: () => [{ configs: {} }] }))
vi.mock('../../../../../../contexts/LanguageContext', () => ({ useLanguage: () => [{}, t] }))
vi.mock('../../../../../../contexts/UtilsContext', () => ({ useUtils: () => utilsState }))

vi.mock('../../../../../../index', async () => {
  const { Messages } = await vi.importActual('../../../../../../components/Messages')
  return {
    Messages,
    useLanguage: () => [{}, t],
    useSession: () => sessionState(),
    useConfig: () => [{ configs: {} }],
    useUtils: () => utilsState
  }
})

import { ConversationChat } from '../ChatTab'

const them = { id: 5, name: 'Ada', level: 3 }
const text = (id, authorId, extra = {}) => ({
  id, type: 2, created_at: '2026-10-02 16:00:00', comment: `msg ${id}`, author_id: authorId, author: authorId === 1 ? { id: 1, name: 'Me', level: 0 } : them, can_see: [0, 2, 3], ...extra
})
const IMAGE = 'data:image/png;base64,AA'
// redesign messages R1 (Q-01): the draft also carries the chat's canRead object; the order of these tests has no driver.
const ALL = { administrator: true, business: true, customer: true, driver: false }

let conversations
const reads = () => global.fetch.mock.calls.map(([url]) => url).filter(url => /\/read\?/.test(url))
const posts = () => global.fetch.mock.calls.filter(([, options]) => options?.method === 'POST')
const OK = { ok: true, json: async () => ({ error: false, result: [] }) }

const mockApi = ({ post } = {}) => {
  global.fetch = vi.fn(async (url, options) => {
    const respond = (result, error = false) => ({ ok: true, json: async () => ({ error, result }) })
    if (options?.method === 'POST') return post ? post() : respond(text(99, 1, { comment: 'echo', read: true }))
    if (/\/read\?/.test(url)) return OK
    const match = url.match(/orders\/(\d+)\/messages/)
    return respond(structuredClone(conversations[match[1]]))
  })
}

const orderOf = (id, extra = {}) => ({ id, status: 7, customer_id: 5, customer: { id: 5, name: 'Ada', lastname: 'Lovelace' }, business: { name: 'Fast Bite' }, driver: null, ...extra })
const chat = (extra = {}, order = orderOf(42)) => <ConversationChat order={order} handleUpdateOrderForUnreadCount={vi.fn()} {...extra} />
const renderChat = (extra = {}, order) => renderWithProviders(chat(extra, order))
const box = () => screen.getByPlaceholderText('Write a message...')
const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 30)) })

beforeEach(() => {
  mocks.handlers.clear()
  mocks.user = { id: 1, level: 0 }
  conversations = { 42: [text(10, 5, { read: true }), text(11, 5, { read: true })], 43: [text(20, 5, { read: true })] }
})

describe('ConversationChat · the chat of the panel, mounted on its own (B1-3)', () => {
  it('renders the log and the composer for a plain order, with its own controller', async () => {
    mockApi()
    renderChat()
    expect(await screen.findByRole('log', { name: 'Messages' })).toHaveTextContent('msg 11')
    expect(box()).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument()
    expect(global.fetch.mock.calls.map(([url]) => url)).toContain('https://api.test/orders/42/messages?mode=dashboard')
  })

  it('renders nothing without an order id', () => {
    mockApi()
    const { container } = renderChat({}, {})
    expect(container).toBeEmptyDOMElement()
  })

  it('fills its parent: the chat root is the standalone layout, the log is the scroll area and the composer is below it, not inside', async () => {
    mockApi()
    const { container } = renderChat()
    const log = await screen.findByRole('log', { name: 'Messages' })
    const root = container.querySelector('[data-chat-root]')
    expect(root).toHaveAttribute('data-layout', 'standalone')
    expect(log).toHaveAttribute('data-chat-scroll')
    const composer = container.querySelector('.odt-chat-composer')
    expect(log.contains(composer)).toBe(false)
    expect(root.contains(composer)).toBe(true)
    expect(log.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  describe('scroll', () => {
    const sizes = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollHeight')
    const client = Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight')
    beforeEach(() => {
      Object.defineProperty(Element.prototype, 'scrollHeight', { configurable: true, get () { return this.hasAttribute('data-chat-scroll') || this.classList.contains('odc-od-body') ? 900 : 0 } })
      Object.defineProperty(Element.prototype, 'clientHeight', { configurable: true, get () { return this.hasAttribute('data-chat-scroll') || this.classList.contains('odc-od-body') ? 300 : 0 } })
    })
    afterEach(() => {
      if (sizes) Object.defineProperty(Element.prototype, 'scrollHeight', sizes); else delete Element.prototype.scrollHeight
      if (client) Object.defineProperty(Element.prototype, 'clientHeight', client); else delete Element.prototype.clientHeight
    })

    it('scrolls its own area to the end, not an outer panel body', async () => {
      mockApi()
      const view = renderWithProviders(<div className='odc-od-body'>{chat()}</div>)
      const log = await screen.findByRole('log', { name: 'Messages' })
      await waitFor(() => expect(log.scrollTop).toBe(600))
      expect(view.container.querySelector('.odc-od-body').scrollTop).toBe(0)
    })
  })

  it('takes readPolicy and engaged: with "interaction" and no engagement it reads nothing', async () => {
    conversations = { 42: [text(10, 5, { read: true }), text(11, 5, { read: false })] }
    mockApi()
    const view = renderChat({ readPolicy: 'interaction', engaged: false })
    await screen.findByText('msg 11')
    await settle()
    expect(reads()).toEqual([])
    view.rerender(chat({ readPolicy: 'interaction', engaged: true }))
    await waitFor(() => expect(reads()).toHaveLength(1))
  })
})

describe('ConversationChat · the draft (B1-3, decision 10A)', () => {
  it('restores the initial text and image once, and does not report them back as a change', async () => {
    mockApi()
    const onDraftChange = vi.fn()
    const view = renderChat({ initialDraft: { text: 'Almost there', image: IMAGE }, onDraftChange })
    await screen.findByText('msg 11')
    await waitFor(() => expect(box()).toHaveValue('Almost there'))
    expect(document.querySelector('.odt-chat-attachment img')).toHaveAttribute('src', IMAGE)
    // a later initialDraft does not overwrite what the user is writing
    await userEvent.type(box(), '!')
    view.rerender(chat({ initialDraft: { text: 'Something else', image: null }, onDraftChange }))
    await settle()
    expect(box()).toHaveValue('Almost there!')
    expect(document.querySelector('.odt-chat-attachment img')).toHaveAttribute('src', IMAGE)
  })

  it('starts empty with no initial draft, and reports nothing on mount', async () => {
    mockApi()
    const onDraftChange = vi.fn()
    renderChat({ initialDraft: null, onDraftChange })
    await screen.findByText('msg 11')
    await settle()
    expect(box()).toHaveValue('')
    expect(onDraftChange).not.toHaveBeenCalled()
  })

  it('reports the text as it changes, with the order id, and the empty draft after a successful send', async () => {
    mockApi()
    const onDraftChange = vi.fn()
    renderChat({ onDraftChange })
    await screen.findByText('msg 11')
    await userEvent.type(box(), 'Hi')
    expect(onDraftChange).toHaveBeenLastCalledWith(42, { text: 'Hi', image: null, recipients: ALL })
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(posts()).toHaveLength(1))
    await screen.findByText('echo')
    expect(onDraftChange).toHaveBeenLastCalledWith(42, { text: '', image: null, recipients: ALL })
  })

  it('reports the image when it is attached and removed', async () => {
    mockApi()
    const onDraftChange = vi.fn()
    renderChat({ initialDraft: { text: '', image: IMAGE }, onDraftChange })
    await screen.findByText('msg 11')
    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }))
    expect(onDraftChange).toHaveBeenLastCalledWith(42, { text: '', image: null, recipients: ALL })
  })

  // tanda P: removing the attached image unmounts its button; the focus goes back to «Insert image», not to the body
  it('puts the focus back on «Insert image» when the image is removed with the keyboard', async () => {
    mockApi()
    renderChat({ initialDraft: { text: '', image: IMAGE } })
    await screen.findByText('msg 11')
    const remove = await screen.findByRole('button', { name: 'Remove' })
    remove.focus()
    await userEvent.keyboard('{Enter}')
    expect(document.querySelector('.odt-chat-attachment')).toBeNull()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Insert image' })).toHaveFocus())
  })

  it('a failed send gives the draft back and reports it again', async () => {
    mockApi({ post: () => ({ ok: true, json: async () => ({ error: true, result: ['Nope'] }) }) })
    const onDraftChange = vi.fn()
    renderChat({ onDraftChange })
    await screen.findByText('msg 11')
    await userEvent.type(box(), 'Hi')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(posts()).toHaveLength(1))
    await waitFor(() => expect(box()).toHaveValue('Hi'))
    expect(onDraftChange).toHaveBeenLastCalledWith(42, { text: 'Hi', image: null, recipients: ALL })
  })

  // redesign messages R1 (Q-01): the recipients are part of the draft. Remounting a conversation (key={order.id}) used to put
  // every recipient back, so a «store only» note went to the customer if it was sent after coming back.
  describe('recipients (R1 Q-01)', () => {
    const customerChip = () => screen.getByRole('button', { name: /^Customer:/ })
    const businessChip = () => screen.getByRole('button', { name: /^Business:/ })

    it('restores the recipients of the initial draft after its own default reset: customer stays off', async () => {
      mockApi()
      renderChat({ initialDraft: { text: 'Store only', image: null, recipients: { ...ALL, customer: false } } })
      await screen.findByText('msg 11')
      await waitFor(() => expect(box()).toHaveValue('Store only'))
      expect(customerChip()).toHaveAttribute('aria-pressed', 'false')
      expect(businessChip()).toHaveAttribute('aria-pressed', 'true')
    })

    it('restores the recipients even when the draft has no text and no image', async () => {
      mockApi()
      renderChat({ initialDraft: { text: '', image: null, recipients: { ...ALL, customer: false } } })
      await screen.findByText('msg 11')
      await waitFor(() => expect(customerChip()).toHaveAttribute('aria-pressed', 'false'))
    })

    it('a draft with null recipients keeps the default (everything chosen)', async () => {
      mockApi()
      renderChat({ initialDraft: { text: 'Hi', image: null, recipients: null } })
      await screen.findByText('msg 11')
      await waitFor(() => expect(box()).toHaveValue('Hi'))
      expect(customerChip()).toHaveAttribute('aria-pressed', 'true')
    })

    it('sends to the restored recipients: the can_see of the POST leaves the customer out', async () => {
      mockApi()
      renderChat({ initialDraft: { text: 'Store only', image: null, recipients: { ...ALL, customer: false } } })
      await screen.findByText('msg 11')
      await waitFor(() => expect(box()).toHaveValue('Store only'))
      await userEvent.click(screen.getByRole('button', { name: 'Send' }))
      await waitFor(() => expect(posts()).toHaveLength(1))
      expect(JSON.parse(posts()[0][1].body).can_see).toBe('0,2')
    })

    it('reports the recipients when a chip is toggled, with the order id and the current text and image', async () => {
      mockApi()
      const onDraftChange = vi.fn()
      renderChat({ onDraftChange })
      await screen.findByText('msg 11')
      await userEvent.type(box(), 'Hi')
      await userEvent.click(customerChip())
      expect(onDraftChange).toHaveBeenLastCalledWith(42, { text: 'Hi', image: null, recipients: { ...ALL, customer: false } })
      await userEvent.click(customerChip())
      expect(onDraftChange).toHaveBeenLastCalledWith(42, { text: 'Hi', image: null, recipients: ALL })
    })

    it('reports the recipients with the text that follows, so the last report is never stale', async () => {
      mockApi()
      const onDraftChange = vi.fn()
      renderChat({ onDraftChange })
      await screen.findByText('msg 11')
      await userEvent.click(customerChip())
      await userEvent.type(box(), 'Yo')
      expect(onDraftChange).toHaveBeenLastCalledWith(42, { text: 'Yo', image: null, recipients: { ...ALL, customer: false } })
    })

    it('reports nothing on mount even with restored recipients', async () => {
      mockApi()
      const onDraftChange = vi.fn()
      renderChat({ initialDraft: { text: '', image: null, recipients: { ...ALL, customer: false } }, onDraftChange })
      await screen.findByText('msg 11')
      await settle()
      expect(onDraftChange).not.toHaveBeenCalled()
    })

    it('a driver assigned while the customer is off adds the driver and keeps the customer off', async () => {
      mockApi()
      const onDraftChange = vi.fn()
      const view = renderChat({ onDraftChange })
      await screen.findByText('msg 11')
      await userEvent.click(customerChip())
      view.rerender(chat({ onDraftChange }, orderOf(42, { driver: { id: 8, name: 'Dan', lastname: 'Driver' } })))
      const driver = await screen.findByRole('button', { name: /^Driver:/ })
      expect(driver).toHaveAttribute('aria-pressed', 'true')
      expect(customerChip()).toHaveAttribute('aria-pressed', 'false')
      expect(onDraftChange).toHaveBeenLastCalledWith(42, { text: '', image: null, recipients: { ...ALL, customer: false, driver: true } })
    })
  })
})
