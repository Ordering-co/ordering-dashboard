/* eslint-disable import/first */
import React from 'react'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// redesign W1-6 (T1-6-4a, W1-D-14, W1-D-19, M-15): the chat of /messages asks for «read» at most once per event, keeps the
// focus in the message box after a good send, and re-arms the scroll to the bottom when the conversation changes.
// The chat runs the REAL Messages controller; only its contexts, fetch and the legacy shell are simulated.
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

// '~ui/src/utils' (where the Messages controller reads capitalize, ) is this same file. Two mocks of one
// module raced, and when the one without capitalize won the controller threw and the history row never painted: one mock, every name.
vi.mock('../../../../utils', () => ({ addQueryToUrl: vi.fn(), capitalize: (value) => value }))

vi.mock('../../../Shared', () => ({
  Alert: () => null,
  Image: ({ src, fallback }) => src ? <img src={src} alt='' /> : fallback,
  Modal: ({ children, open, title }) => open ? <div role='dialog' aria-label={`legacy ${title}`}>{children}</div> : null
}))

vi.mock('react-bootstrap', () => ({
  OverlayTrigger: ({ children }) => children,
  Tooltip: ({ children }) => <span>{children}</span>
}))

vi.mock('../../Logistics', () => ({ Logistics: () => null }))
vi.mock('../../OrderLogisticInformation', () => ({ OrderLogisticInformation: () => null }))

import { Messages } from '..'

const them = { id: 5, name: 'Ada', level: 3 }
const text = (id, authorId, extra = {}) => ({
  id, type: 2, created_at: '2026-10-02 16:00:00', comment: `msg ${id}`, author_id: authorId, author: authorId === 1 ? { id: 1, name: 'Me', level: 0 } : them, can_see: [0, 2, 3], ...extra
})
const image = (id, source) => ({ id, type: 3, created_at: '2026-10-02 16:00:00', comment: '', author_id: 5, author: them, can_see: [0, 2, 3], source, read: true })

// Conversations by order id: every GET …/messages answers the one of its order.
let conversations
const reads = () => global.fetch.mock.calls.map(([url]) => url).filter(url => /\/read\?/.test(url)).map(url => url.replace('https://api.test/', '').split('?')[0])
const posts = () => global.fetch.mock.calls.filter(([, options]) => options?.method === 'POST')

const ECHO = { id: 99, type: 2, comment: 'echo', author_id: 1, author: { id: 1, name: 'Me', level: 0 }, can_see: [3], created_at: '2026-10-02 17:00:00' }

const mockApi = ({ readAnswer = () => ({ ok: true, json: async () => ({ error: false, result: [] }) }), post } = {}) => {
  global.fetch = vi.fn(async (url, options) => {
    const respond = (result, error = false) => ({ ok: true, json: async () => ({ error, result }) })
    if (options?.method === 'POST') return post ? post() : respond(ECHO)
    if (/\/read\?/.test(url)) return readAnswer(url)
    const match = url.match(/orders\/(\d+)\/messages/)
    return respond(structuredClone(conversations[match[1]]))
  })
}

const orderOf = id => ({ id, status: 0, created_at: '2026-09-15T00:00:00Z', app_id: 'web', business: { name: 'Fast Bite' }, customer: { id: 5, name: 'Ada', lastname: 'Lovelace' } })
const chat = id => <Messages orderId={id} isChat order={orderOf(id)} />
const renderChat = (id = 42) => renderWithProviders(chat(id))
const box = () => screen.getByPlaceholderText('Write a message...')
const incoming = (message, orderId = 42) => act(async () => { mocks.handlers.forEach(handler => handler({ order_id: orderId, order: { id: orderId }, ...message })) })

describe('Messages · «read» is asked once per event (W1-D-14)', () => {
  beforeEach(() => {
    mocks.handlers.clear()
    mocks.user = { id: 1, level: 0 }
    conversations = { 42: [text(10, 5, { read: true }), text(11, 5, { read: false })], 43: [text(20, 5, { read: false })] }
  })

  it('opening the conversation asks once for its last unread message, and the re-renders after it ask no more', async () => {
    mockApi()
    renderChat()
    await screen.findByText('msg 11')
    await waitFor(() => expect(reads()).toEqual(['orders/42/messages/11/read']))
    await userEvent.type(box(), 'draft') // re-renders of the chat and of the controller
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)) })
    expect(reads()).toEqual(['orders/42/messages/11/read'])
  })

  it('a message from someone else that arrives in the open conversation is marked read, once', async () => {
    mockApi()
    renderChat()
    await screen.findByText('msg 11')
    await waitFor(() => expect(reads()).toHaveLength(1))
    await incoming(text(12, 5, { read: false }))
    await screen.findByText('msg 12')
    await waitFor(() => expect(reads()).toEqual(['orders/42/messages/11/read', 'orders/42/messages/12/read']))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)) })
    expect(reads()).toHaveLength(2)
  })

  // redesign W1-6 (W1-PB1-01): main marks the last message read whoever wrote it (for a business account, level 2, that read is what
  // resets the unread count of the open card); the round only dropped the duplicates and the request under the wrong order.
  it('a message of mine that arrives (sent from another tab, or just sent here) is marked read like any other, once', async () => {
    mockApi()
    renderChat()
    await screen.findByText('msg 11')
    await waitFor(() => expect(reads()).toHaveLength(1))
    await incoming(text(13, 1, { read: false }))
    await screen.findByText('msg 13')
    await waitFor(() => expect(reads()).toEqual(['orders/42/messages/11/read', 'orders/42/messages/13/read']))
    await act(async () => { box().focus(); await new Promise(resolve => setTimeout(resolve, 30)) }) // the box takes the focus again after a send: the same message is not asked for twice
    expect(reads()).toHaveLength(2)
  })

  it('for a business account (level 2) the message it just sent is read too, which is what resets the unread count of the open card', async () => {
    mocks.user = { id: 1, level: 2 }
    mockApi()
    renderChat()
    await screen.findByText('msg 11')
    await waitFor(() => expect(reads()).toHaveLength(1))
    await incoming(text(13, 1, { read: false, author: { id: 1, name: 'Me', level: 2 } }))
    await waitFor(() => expect(reads()).toEqual(['orders/42/messages/11/read', 'orders/42/messages/13/read']))
  })

  it('the focus of the box does not ask again once the message is read, and not while the request is on the way', async () => {
    let release
    mockApi({ readAnswer: () => new Promise(resolve => { release = () => resolve({ ok: true, json: async () => ({ error: false, result: [] }) }) }) })
    renderChat()
    await screen.findByText('msg 11')
    await waitFor(() => expect(reads()).toHaveLength(1))
    box().focus()
    box().blur()
    box().focus()
    expect(reads()).toHaveLength(1) // in flight
    await act(async () => { release() })
    box().blur()
    box().focus()
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)) })
    expect(reads()).toHaveLength(1)
  })

  it('a read that failed is asked again on the next event, not before', async () => {
    mockApi({ readAnswer: () => { throw new TypeError('Failed to fetch') } })
    renderChat()
    await screen.findByText('msg 11')
    await waitFor(() => expect(reads()).toHaveLength(1))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)) })
    expect(reads()).toHaveLength(1)
    box().focus()
    await waitFor(() => expect(reads()).toHaveLength(2))
  })

  it('changing conversation asks only for the new one, never for the old messages under the new order', async () => {
    // the read of the first conversation fails, so its last message is still unread when the user changes conversation
    mockApi({ readAnswer: (url) => { if (/orders\/42\//.test(url)) throw new TypeError('Failed to fetch'); return { ok: true, json: async () => ({ error: false, result: [] }) } } })
    const view = renderChat(42)
    await screen.findByText('msg 11')
    await waitFor(() => expect(reads()).toEqual(['orders/42/messages/11/read']))
    view.rerender(chat(43))
    await screen.findByText('msg 20')
    await waitFor(() => expect(reads()).toContain('orders/43/messages/20/read'))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)) })
    expect(reads()).toEqual(['orders/42/messages/11/read', 'orders/43/messages/20/read'])
  })
})

describe('Messages · the controller behind the chat (W1-D-14, W1-D-18)', () => {
  beforeEach(() => {
    mocks.handlers.clear()
    mocks.user = { id: 1, level: 0 }
  })

  it('a message that arrives while «read» is on the way stays in the list when the answer comes', async () => {
    conversations = { 42: [text(10, 5, { read: true }), text(11, 5, { read: false })] }
    const releases = []
    mockApi({ readAnswer: () => new Promise(resolve => { releases.push(() => resolve({ ok: true, json: async () => ({ error: false, result: [] }) })) }) })
    renderChat()
    await screen.findByText('msg 11')
    await waitFor(() => expect(releases).toHaveLength(1))
    await incoming(text(12, 5, { read: false })) // the first answer has not come yet
    await screen.findByText('msg 12')
    await act(async () => { releases[0]() })
    expect(screen.getByText('msg 12')).toBeInTheDocument()
    expect(screen.getByText('msg 11')).toBeInTheDocument()
  })

  it('the dates of a history event are painted by parseDate, not pasted raw', async () => {
    conversations = { 42: [{ id: 30, type: 1, created_at: '2026-10-02 16:00:00', read: true, change: { attribute: 'delivery_datetime', old: '2026-10-02 17:00:00', new: '2026-10-03 09:30:00' } }] }
    mockApi()
    renderChat()
    expect(await screen.findByText(/changed from/)).toHaveTextContent('Order delivery date changed from at 2026-10-02 17:00:00 to at 2026-10-03 09:30:00.')
  })
})

describe('Messages · the focus stays in the box after a good send (M-15)', () => {
  beforeEach(() => {
    mocks.handlers.clear()
    mocks.user = { id: 1, level: 0 }
    conversations = { 42: [text(10, 5, { read: true })] }
  })

  it('«Send» is disabled once the box empties and takes the focus with it; the box gets it back', async () => {
    let release
    mockApi({ post: () => new Promise(resolve => { release = () => resolve({ ok: true, json: async () => ({ error: false, result: ECHO }) }) }) })
    renderChat()
    await screen.findByText('msg 10')
    await userEvent.type(box(), 'Hello')
    const sendButton = screen.getByRole('button', { name: 'send' })
    sendButton.focus()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(posts()).toHaveLength(1))
    const sending = document.activeElement
    expect(sending).toBe(sendButton)
    sending.removeAttribute('disabled') // jsdom keeps the focus on a disabled button; the browser drops it
    sending.blur()
    sending.setAttribute('disabled', '')
    expect(document.body).toHaveFocus()
    await act(async () => { release() })
    await screen.findByText('echo')
    await waitFor(() => expect(document.activeElement).toBe(box()))
    // the message just sent is marked read once, as in main (W1-PB1-01), and the focus that came back did not ask for it again
    expect(reads()).toEqual(['orders/42/messages/99/read'])
  })

  it('does not steal the focus from where the user moved meanwhile', async () => {
    let release
    mockApi({ post: () => new Promise(resolve => { release = () => resolve({ ok: true, json: async () => ({ error: false, result: ECHO }) }) }) })
    renderChat()
    await screen.findByText('msg 10')
    await userEvent.type(box(), 'Hello')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(posts()).toHaveLength(1))
    const other = screen.getByRole('button', { name: /Customer/ })
    other.focus()
    await act(async () => { release() })
    await screen.findByText('echo')
    expect(other).toHaveFocus()
  })
})

describe('Messages · the images of the next conversation re-arm the scroll to the bottom (W1-D-19)', () => {
  beforeEach(() => {
    mocks.handlers.clear()
    mocks.user = { id: 1, level: 0 }
  })

  it('after three images in one conversation, the first image of the next one still takes the scroll to its bottom', async () => {
    conversations = {
      42: [image(1, 'data:image/png;base64,AA'), image(2, 'data:image/png;base64,AB'), image(3, 'data:image/png;base64,AC')],
      43: [image(4, 'data:image/png;base64,AD')]
    }
    mockApi()
    const view = renderChat(42)
    const loadAll = async () => { for (const img of document.querySelectorAll('#chat img')) fireEvent.load(img) }
    await waitFor(() => expect(document.querySelectorAll('#chat img')).toHaveLength(3))
    await loadAll()
    view.rerender(chat(43))
    await waitFor(() => expect(document.querySelectorAll('#chat img')).toHaveLength(1))
    const feed = document.getElementById('chat')
    Object.defineProperty(feed, 'scrollHeight', { configurable: true, value: 900 })
    feed.scrollTop = 0
    fireEvent.load(document.querySelector('#chat img'))
    expect(feed.scrollTop).toBe(900)
  })
})
