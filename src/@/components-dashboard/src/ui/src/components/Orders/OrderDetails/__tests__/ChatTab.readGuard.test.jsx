/* eslint-disable import/first */
import React from 'react'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// redesign messages B1 (decision 4A, B1-1; decision 9A, B1-2): the chat of the order panel, shared with /messages, asks for
// «read» at most once per «orderId:messageId» (the W1-D-14 semantics of the old /messages chat), never under another order,
// and with readPolicy='interaction' reads only once the user engaged with the conversation.
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

import { ChatTab } from '../ChatTab'

const them = { id: 5, name: 'Ada', level: 3 }
const text = (id, authorId, extra = {}) => ({
  id, type: 2, created_at: '2026-10-02 16:00:00', comment: `msg ${id}`, author_id: authorId, author: authorId === 1 ? { id: 1, name: 'Me', level: 0 } : them, can_see: [0, 2, 3], ...extra
})

let conversations
const reads = () => global.fetch.mock.calls.map(([url]) => url).filter(url => /\/read\?/.test(url)).map(url => url.replace('https://api.test/', '').split('?')[0])
const OK = { ok: true, json: async () => ({ error: false, result: [] }) }

const mockApi = ({ readAnswer = () => OK } = {}) => {
  global.fetch = vi.fn(async (url, options) => {
    const respond = (result, error = false) => ({ ok: true, json: async () => ({ error, result }) })
    if (options?.method === 'POST') return respond({})
    if (/\/read\?/.test(url)) return readAnswer(url)
    const match = url.match(/orders\/(\d+)\/messages/)
    return respond(structuredClone(conversations[match[1]]))
  })
}

const orderOf = id => ({ id, status: 7, customer_id: 5, customer: { id: 5, name: 'Ada', lastname: 'Lovelace' }, business: { name: 'Fast Bite' }, driver: null })
const chat = (id, extra = {}) => (
  <ChatTab order={{ order: orderOf(id), loading: false }} messages={{ messages: [] }} handleUpdateOrderForUnreadCount={vi.fn()} onClose={vi.fn()} {...extra} />
)
const renderChat = (id = 42, extra = {}) => renderWithProviders(chat(id, extra))
const box = () => screen.getByPlaceholderText('Write a message...')
const incoming = (message, orderId = 42) => act(async () => { mocks.handlers.forEach(handler => handler({ order_id: orderId, order: { id: orderId }, ...message })) })
const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 30)) })

beforeEach(() => {
  mocks.handlers.clear()
  mocks.user = { id: 1, level: 0 }
  conversations = { 42: [text(10, 5, { read: true }), text(11, 5, { read: false })], 43: [text(20, 5, { read: false })] }
})

describe('ChatTab · «read» is asked once per message (B1-1, decision 4A)', () => {
  it('asks once for the last unread message across re-renders, an incoming message and a focus', async () => {
    mockApi()
    renderChat()
    await screen.findByText('msg 11')
    await waitFor(() => expect(reads()).toEqual(['orders/42/messages/11/read']))
    await userEvent.type(box(), 'draft') // re-renders of the chat and of the controller
    await settle()
    expect(reads()).toEqual(['orders/42/messages/11/read'])
    await incoming(text(12, 5, { read: false }))
    await screen.findByText('msg 12')
    await waitFor(() => expect(reads()).toEqual(['orders/42/messages/11/read', 'orders/42/messages/12/read']))
    await act(async () => { box().blur(); box().focus() })
    await settle()
    expect(reads()).toEqual(['orders/42/messages/11/read', 'orders/42/messages/12/read'])
  })

  it('a focus does not repeat a read that is still on the way', async () => {
    let release
    mockApi({ readAnswer: () => new Promise(resolve => { release = () => resolve(OK) }) })
    renderChat()
    await screen.findByText('msg 11')
    await waitFor(() => expect(reads()).toHaveLength(1))
    await act(async () => { box().focus(); box().blur(); box().focus() })
    expect(reads()).toHaveLength(1)
    await act(async () => { release() })
    await settle()
    expect(reads()).toEqual(['orders/42/messages/11/read'])
  })

  it('a re-render with a new order object of the same id does not read again', async () => {
    mockApi()
    const view = renderChat()
    await screen.findByText('msg 11')
    await waitFor(() => expect(reads()).toHaveLength(1))
    view.rerender(chat(42))
    view.rerender(chat(42))
    await settle()
    expect(reads()).toEqual(['orders/42/messages/11/read'])
  })

  it('a read that failed is asked again on the next event, not before', async () => {
    mockApi({ readAnswer: () => { throw new TypeError('Failed to fetch') } })
    renderChat()
    await screen.findByText('msg 11')
    await waitFor(() => expect(reads()).toHaveLength(1))
    await settle()
    expect(reads()).toHaveLength(1)
    await act(async () => { box().focus() })
    await waitFor(() => expect(reads()).toHaveLength(2))
  })

  it('the messages that arrive in the open conversation are read whoever wrote them, once', async () => {
    mockApi()
    renderChat()
    await screen.findByText('msg 11')
    await waitFor(() => expect(reads()).toHaveLength(1))
    await incoming(text(13, 1, { read: false })) // mine, from another tab
    await screen.findByText('msg 13')
    await waitFor(() => expect(reads()).toEqual(['orders/42/messages/11/read', 'orders/42/messages/13/read']))
    await act(async () => { box().focus() })
    await settle()
    expect(reads()).toHaveLength(2)
  })

  it('changing order asks only for the new one, never for the old message id under the new order', async () => {
    // the read of the first conversation fails, so its last message is still unread when the order changes
    mockApi({ readAnswer: (url) => { if (/orders\/42\//.test(url)) throw new TypeError('Failed to fetch'); return OK } })
    const view = renderChat(42)
    await screen.findByText('msg 11')
    await waitFor(() => expect(reads()).toEqual(['orders/42/messages/11/read']))
    view.rerender(chat(43))
    await screen.findByText('msg 20')
    await waitFor(() => expect(reads()).toContain('orders/43/messages/20/read'))
    await settle()
    expect(reads()).toEqual(['orders/42/messages/11/read', 'orders/43/messages/20/read'])
  })
})

describe('ChatTab · readPolicy="interaction" reads only after the user engaged (B1-2, decision 9A)', () => {
  it('reads nothing on mount nor on an incoming message', async () => {
    mockApi()
    renderChat(42, { readPolicy: 'interaction' })
    await screen.findByText('msg 11')
    await settle()
    await incoming(text(12, 5, { read: false }))
    await screen.findByText('msg 12')
    await settle()
    expect(reads()).toEqual([])
  })

  it('a pointerdown inside the log reads once, and from then on the new messages are read too', async () => {
    mockApi()
    renderChat(42, { readPolicy: 'interaction' })
    await screen.findByText('msg 11')
    await settle()
    fireEvent.pointerDown(screen.getByRole('log'))
    await waitFor(() => expect(reads()).toEqual(['orders/42/messages/11/read']))
    await settle()
    expect(reads()).toEqual(['orders/42/messages/11/read'])
    await incoming(text(12, 5, { read: false }))
    await waitFor(() => expect(reads()).toEqual(['orders/42/messages/11/read', 'orders/42/messages/12/read']))
  })

  it.each([
    ['keydown', () => fireEvent.keyDown(screen.getByRole('log'), { key: 'ArrowDown' })],
    ['wheel', () => fireEvent.wheel(screen.getByRole('log'))],
    ['focusin', () => fireEvent.focusIn(screen.getByRole('log'))]
  ])('a %s inside the chat reads once', async (_name, interact) => {
    mockApi()
    renderChat(42, { readPolicy: 'interaction' })
    await screen.findByText('msg 11')
    await settle()
    expect(reads()).toEqual([])
    await act(async () => { interact() })
    await waitFor(() => expect(reads()).toEqual(['orders/42/messages/11/read']))
    await settle()
    expect(reads()).toHaveLength(1)
  })

  it('the composer focus reads', async () => {
    mockApi()
    renderChat(42, { readPolicy: 'interaction' })
    await screen.findByText('msg 11')
    await settle()
    await act(async () => { box().focus() })
    await waitFor(() => expect(reads()).toEqual(['orders/42/messages/11/read']))
    await settle()
    expect(reads()).toHaveLength(1)
  })

  it('engaged=true reads on mount, and turning it on later reads then', async () => {
    mockApi()
    renderChat(42, { readPolicy: 'interaction', engaged: true })
    await screen.findByText('msg 11')
    await waitFor(() => expect(reads()).toEqual(['orders/42/messages/11/read']))
  })

  it('engaged going from false to true reads then', async () => {
    mockApi()
    const view = renderChat(42, { readPolicy: 'interaction', engaged: false })
    await screen.findByText('msg 11')
    await settle()
    expect(reads()).toEqual([])
    view.rerender(chat(42, { readPolicy: 'interaction', engaged: true }))
    await waitFor(() => expect(reads()).toEqual(['orders/42/messages/11/read']))
  })

  it('the engagement resets when the order changes', async () => {
    mockApi()
    const view = renderChat(42, { readPolicy: 'interaction' })
    await screen.findByText('msg 11')
    await settle()
    fireEvent.pointerDown(screen.getByRole('log'))
    await waitFor(() => expect(reads()).toEqual(['orders/42/messages/11/read']))
    view.rerender(chat(43, { readPolicy: 'interaction' }))
    await screen.findByText('msg 20')
    await settle()
    expect(reads()).toEqual(['orders/42/messages/11/read'])
    fireEvent.pointerDown(screen.getByRole('log'))
    await waitFor(() => expect(reads()).toEqual(['orders/42/messages/11/read', 'orders/43/messages/20/read']))
  })

  it('"auto" (the default) reads on mount, as today', async () => {
    mockApi()
    renderChat(42, { readPolicy: 'auto' })
    await screen.findByText('msg 11')
    await waitFor(() => expect(reads()).toEqual(['orders/42/messages/11/read']))
  })
})
