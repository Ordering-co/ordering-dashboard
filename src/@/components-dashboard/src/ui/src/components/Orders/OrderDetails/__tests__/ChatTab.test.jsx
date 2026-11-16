/* eslint-disable import/first */
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// Redesign 5.3-C: the chat tab runs the REAL Messages controller (POST payload, read marking and
// endpoints of today); only its contexts and fetch are simulated.
const mocks = vi.hoisted(() => ({ user: { id: 1, level: 0 }, lowercaseSend: false, rawQuickKeys: false, translate: null }))

// `lowercaseSend` simulates the API catalog, whose "SEND" is the lowercase "send" (it overrides the default)
// `rawQuickKeys` simulates the catalog, where the quick replies' text is the key itself ("admin_message_1")
const t = (key, fallback) => {
  if (mocks.rawQuickKeys && /_MESSAGE_\d$/.test(key)) return key.toLowerCase()
  const translated = mocks.translate?.(key)
  if (translated !== undefined) return translated
  return mocks.lowercaseSend && key === 'SEND' ? 'send' : fallback ?? key
}
const sessionState = () => [{ user: mocks.user, token: 'token' }]
const utilsState = [{
  parseDate: (value) => `at ${value}`,
  getTimeAgo: (value) => `ago ${value}`,
  optimizeImage: (value) => value,
  getOrderState: (status) => `State ${status}`,
  parsePrice: (value) => `$${value}`
}]

vi.mock('~ui', () => ({ capitalize: (value) => value }))
vi.mock('../../../../../../contexts/SessionContext', () => ({ useSession: () => sessionState() }))
vi.mock('../../../../../../contexts/ApiContext', () => ({ useApi: () => [{ root: 'https://api.test' }] }))
vi.mock('../../../../../../contexts/WebsocketContext', () => ({ useWebsocket: () => ({ on: vi.fn(), off: vi.fn(), join: vi.fn(), leave: vi.fn() }) }))
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

const MESSAGES = [
  { id: 1, type: 0, created_at: '2026-10-02 15:51:00', app_id: 'web', author_id: 5, author: { name: 'Customer', lastname: 'Demo' }, user_agent: 'UA/placed', ip: '10.0.0.1' },
  { id: 2, type: 1, created_at: '2026-10-02 15:58:00', change: { attribute: 'status', old: 0, new: 7 }, app_id: 'ordering-react-native', author_id: 6, author: { name: 'Ordering', lastname: 'Admin' }, user_agent: 'UA/status', ip: '10.0.0.2' },
  { id: 3, type: 2, created_at: '2026-10-02 16:00:00', comment: 'Where is my order?', author_id: 5, author: { id: 5, name: 'Ada', level: 3 }, can_see: [0, 2, 3], read: true },
  { id: 4, type: 2, created_at: '2026-10-02 16:02:00', comment: 'On its way', author_id: 1, author: { id: 1, name: 'Me', level: 0 }, can_see: [0, 3, 4], read: false }
]

const mockApi = ({ messages = MESSAGES, postResult } = {}) => {
  global.fetch = vi.fn(async (url, options) => {
    const respond = (result, error = false) => ({ ok: true, json: async () => ({ error, result }) })
    if (options?.method === 'POST') return respond(postResult ?? { id: 99, type: 2, comment: 'echo', author_id: 1, author: { id: 1, name: 'Me', level: 0 }, can_see: [3], created_at: '2026-10-02 17:00:00' })
    if (url.includes('/read?')) return respond([])
    // the controller marks messages as read on the objects it gets: hand out copies
    return respond(structuredClone(messages))
  })
}

const baseOrder = {
  id: 42,
  status: 7,
  customer_id: 5,
  customer: { id: 5, name: 'Ada', lastname: 'Lovelace' },
  business: { name: 'Fast Bite' },
  driver: null
}

const renderChat = (overrides = {}, orderOverrides = {}) => {
  const props = {
    order: { order: { ...baseOrder, ...orderOverrides }, loading: false },
    messages: { messages: [] },
    handleUpdateOrderForUnreadCount: vi.fn(),
    onClose: vi.fn(),
    isTourOpen: false,
    setCurrentTourStep: vi.fn(),
    onSelectTab: vi.fn(),
    ...overrides
  }
  return { props, ...renderWithProviders(<ChatTab {...props} />) }
}

const postCalls = () => global.fetch.mock.calls.filter(([, options]) => options?.method === 'POST')

describe('ChatTab: the chat inside the panel', () => {
  beforeEach(() => {
    mocks.user = { id: 1, level: 0 }
    mocks.rawQuickKeys = false
    mocks.translate = null
    mockApi()
  })

  it('keeps the tour anchor and reads the messages from the same endpoint', async () => {
    const { container } = renderChat()
    await screen.findByText('Where is my order?')
    expect(container.querySelector('[data-tour="tour_message"]')).not.toBeNull()
    expect(global.fetch.mock.calls.map(([url]) => url)).toContain('https://api.test/orders/42/messages?mode=dashboard')
  })

  it('draws my messages apart from the others, with sender, level and time', async () => {
    renderChat()
    const log = await screen.findByRole('log', { name: 'Messages' })
    const theirs = within(log).getByText('Where is my order?').closest('[data-from]')
    const mine = within(log).getByText('On its way').closest('[data-from]')
    expect(theirs).toHaveAttribute('data-from', 'other')
    expect(mine).toHaveAttribute('data-from', 'me')
    expect(theirs).toHaveTextContent('Ada (Customer)')
    // redesign 5.3 audit-1: the time is absolute (parseDate), like in Activity, no longer relative (getTimeAgo)
    expect(theirs).toHaveTextContent('at 2026-10-02 16:00:00')
    expect(mine).toHaveTextContent('Me (Admin)')
  })

  it('writes who each message went to in words', async () => {
    renderChat({}, { driver: { id: 8, name: 'Dan', lastname: 'Driver' } })
    const log = await screen.findByRole('log', { name: 'Messages' })
    expect(within(log).getByText('On its way').closest('[data-from]')).toHaveTextContent('Send to: Customer, Driver')
    expect(within(log).getByText('Where is my order?').closest('[data-from]')).toHaveTextContent('Send to: Business, Customer')
  })

  it('shows the status events and the placement inline, with technical facts folded', async () => {
    renderChat()
    const log = await screen.findByRole('log', { name: 'Messages' })
    expect(log).toHaveTextContent(/changed from State 0 to State 7/)
    const details = within(log).getAllByText('Technical details').map(node => node.closest('details'))
    expect(details).toHaveLength(2)
    details.forEach(node => expect(node).not.toHaveAttribute('open'))
    expect(within(log).getByText('UA/status')).toBeInTheDocument()
    expect(within(log).getByText('10.0.0.1')).toBeInTheDocument()
    const statusBubble = [...log.querySelectorAll('[data-from="system"] .odt-chat-bubble')].find(node => /changed from/.test(node.textContent))
    // the title (first child) is the sentence alone; the facts live in the fold
    expect(statusBubble.firstElementChild).not.toHaveTextContent('10.0.0.2')
    expect(statusBubble.firstElementChild).not.toHaveTextContent('UA/status')
  })

  it.each([2])('level %i keeps the folds too', async (level) => {
    mocks.user = { id: 1, level }
    renderChat()
    const log = await screen.findByRole('log', { name: 'Messages' })
    expect(within(log).getAllByText('Technical details')).toHaveLength(2)
  })

  // Same visibility as main: the placed event shows app, author, user agent and IP at any level (now folded);
  // the technical tail of a status change is only for levels 0 and 2.
  it.each([0, 1, 2, 5])('level %i still sees the placed event facts, with its author, folded', async (level) => {
    mocks.user = { id: 1, level }
    renderChat()
    const log = await screen.findByRole('log', { name: 'Messages' })
    const placed = [...log.querySelectorAll('[data-from="system"] .odt-chat-bubble')].find(node => /Order placed for/.test(node.textContent))
    const details = within(placed).getByText('Technical details').closest('details')
    expect(details).not.toHaveAttribute('open')
    expect(within(details).getByText('UA/placed')).toBeInTheDocument()
    expect(within(details).getByText('10.0.0.1')).toBeInTheDocument()
    expect(within(details).getByText('Customer Demo')).toBeInTheDocument()
  })

  it.each([1, 5])('level %i has no fold, author or facts on the status change', async (level) => {
    mocks.user = { id: 1, level }
    renderChat()
    const log = await screen.findByRole('log', { name: 'Messages' })
    expect(within(log).getAllByText('Technical details')).toHaveLength(1)
    expect(screen.queryByText('10.0.0.2')).not.toBeInTheDocument()
    expect(screen.queryByText('UA/status')).not.toBeInTheDocument()
    expect(screen.queryByText('Ordering Admin')).not.toBeInTheDocument()
  })
})

describe('ChatTab: sending', () => {
  beforeEach(() => {
    mocks.user = { id: 1, level: 0 }
    mockApi()
  })

  it('sends the payload of today: text, type 2 and can_see for customer, admin and business', async () => {
    renderChat()
    await screen.findByText('Where is my order?')
    await userEvent.type(screen.getByRole('textbox', { name: 'Write a message...' }), 'Hello there')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(postCalls()).toHaveLength(1))
    const [url, options] = postCalls()[0]
    expect(url).toBe('https://api.test/orders/42/messages')
    expect(options.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer token' })
    expect(JSON.parse(options.body)).toEqual({ comment: 'Hello there', type: 2, can_see: '3,0,2' })
  })

  it('includes the driver in can_see when the order has one, and drops who is switched off', async () => {
    renderChat({}, { driver: { id: 8, name: 'Dan', lastname: 'Driver' } })
    await screen.findByText('Where is my order?')
    const recipients = screen.getByRole('group', { name: 'Send to' })
    const business = within(recipients).getByRole('button', { name: /Business/ })
    expect(business).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(business)
    expect(business).toHaveAttribute('aria-pressed', 'false')
    await userEvent.type(screen.getByRole('textbox', { name: 'Write a message...' }), 'Hi')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(postCalls()).toHaveLength(1))
    expect(JSON.parse(postCalls()[0][1].body).can_see).toBe('3,0,4')
  })

  it('a business user never gets the business recipient (it is themselves)', async () => {
    mocks.user = { id: 1, level: 2 }
    renderChat()
    await screen.findByText('Where is my order?')
    const recipients = screen.getByRole('group', { name: 'Send to' })
    expect(within(recipients).queryByRole('button', { name: /Business/ })).not.toBeInTheDocument()
    expect(within(recipients).getByRole('button', { name: /Customer/ })).toBeInTheDocument()
  })

  it('does not send an empty message', async () => {
    renderChat()
    await screen.findByText('Where is my order?')
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  })

  it('clears the box and shows the sent message after it is sent', async () => {
    renderChat()
    await screen.findByText('Where is my order?')
    const box = screen.getByRole('textbox', { name: 'Write a message...' })
    await userEvent.type(box, 'Hello there')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(box).toHaveValue(''))
    expect(await screen.findByText('echo')).toBeInTheDocument()
  })

  // main 4b7ff4f9 + owner decision 2A: only the quick replies a project configured show; one still on its placeholder
  // («admin_message_1», or a localized prefix) does not, and a project without any shows none.
  const ADMIN_CONFIGURED = { ADMIN_MESSAGE_2: 'Your order is on its way', ADMIN_MESSAGE_4: 'Can you confirm your address?' }
  const STORE_CONFIGURED = { STORE_MESSAGE_1: 'Ready for pickup' }
  const configure = (texts) => { mocks.translate = (key) => texts[key] }

  it('offers the quick messages the project configured (admin set), in order, and appends to what is typed', async () => {
    configure(ADMIN_CONFIGURED)
    renderChat()
    await screen.findByText('Where is my order?')
    const quick = screen.getByRole('group', { name: 'Quick messages' })
    const buttons = within(quick).getAllByRole('button')
    expect(buttons.map(button => button.textContent)).toEqual(['Your order is on its way', 'Can you confirm your address?'])
    const box = screen.getByRole('textbox', { name: 'Write a message...' })
    await userEvent.type(box, 'Hi')
    await userEvent.click(buttons[1])
    expect(box).toHaveValue('Hi Can you confirm your address?')
  })

  it('offers the configured store set to a business user and none to anyone else', async () => {
    configure({ ...ADMIN_CONFIGURED, ...STORE_CONFIGURED })
    mocks.user = { id: 1, level: 2 }
    const { unmount } = renderChat()
    await screen.findByText('Where is my order?')
    const storeButtons = within(screen.getByRole('group', { name: 'Quick messages' })).getAllByRole('button')
    expect(storeButtons.map(button => button.textContent)).toEqual(['Ready for pickup'])
    unmount()
    mocks.user = { id: 1, level: 5 }
    renderChat()
    await screen.findByText('Where is my order?')
    expect(screen.queryByRole('group', { name: 'Quick messages' })).not.toBeInTheDocument()
  })

  it('a project that configured none shows no quick messages at all', async () => {
    mocks.translate = null
    mocks.user = { id: 1, level: 0 }
    renderChat()
    await screen.findByText('Where is my order?')
    expect(screen.queryByRole('group', { name: 'Quick messages' })).not.toBeInTheDocument()
    expect(screen.queryByText(/_message_\d/i)).not.toBeInTheDocument()
  })

  it('a catalog that still answers the placeholder (also with a localized prefix) shows none', async () => {
    mocks.rawQuickKeys = true
    const { unmount } = renderChat()
    await screen.findByText('Where is my order?')
    expect(screen.queryByRole('group', { name: 'Quick messages' })).not.toBeInTheDocument()
    unmount()
    mocks.rawQuickKeys = false
    configure({ ADMIN_MESSAGE_1: 'administrador_message_1' })
    renderChat()
    await screen.findByText('Where is my order?')
    expect(screen.queryByRole('group', { name: 'Quick messages' })).not.toBeInTheDocument()
  })

  it('attaches an image and sends it as type 3 with the file, with a way to remove it', async () => {
    const { container } = renderChat()
    await screen.findByText('Where is my order?')
    const input = container.querySelector('input[type="file"]')
    expect(input).toHaveAttribute('accept', 'image/png,image/jpg,image/jpeg')
    const file = new File(['x'], 'photo.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [file] } })
    const preview = await screen.findByRole('img', { name: 'Image' })
    expect(preview.getAttribute('src')).toMatch(/^data:image\/png/)
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(postCalls()).toHaveLength(1))
    const body = JSON.parse(postCalls()[0][1].body)
    expect(body.type).toBe(3)
    expect(body.file).toMatch(/^data:image\/png/)
  })

  it('shows what the server refused', async () => {
    mockApi({ postResult: ['Not allowed'] })
    global.fetch = vi.fn(async (url, options) => {
      if (options?.method === 'POST') return { ok: true, json: async () => ({ error: true, result: ['Not allowed'] }) }
      if (url.includes('/read?')) return { ok: true, json: async () => ({ error: false, result: [] }) }
      return { ok: true, json: async () => ({ error: false, result: structuredClone(MESSAGES) }) }
    })
    renderChat()
    await screen.findByText('Where is my order?')
    await userEvent.type(screen.getByRole('textbox', { name: 'Write a message...' }), 'Hello')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Not allowed')
  })
})

describe('ChatTab: states', () => {
  beforeEach(() => {
    mocks.user = { id: 1, level: 0 }
  })

  it.each([1, 2, 5, 6, 10, 11, 12, 15, 16, 17])('closed order (status %i) has no composer, only the notice', async (status) => {
    mockApi()
    renderChat({}, { status })
    await screen.findByText('Where is my order?')
    expect(screen.getByText('You can\'t send messages because the order has ended')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Write a message...' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument()
  })

  it('marks the last message as read when it is unread (same GET as today)', async () => {
    mockApi()
    const { props } = renderChat()
    await screen.findByText('Where is my order?')
    // the last message (id 4) is unread
    await waitFor(() => {
      expect(global.fetch.mock.calls.map(([url]) => url)).toContain('https://api.test/orders/42/messages/4/read?order_id=42&order_message_id=4')
    })
    await waitFor(() => expect(props.handleUpdateOrderForUnreadCount).toHaveBeenCalledWith(42))
  })

  it('does not mark anything when the last message is already read', async () => {
    mockApi({ messages: [{ ...MESSAGES[2], read: true }] })
    renderChat()
    await screen.findByText('Where is my order?')
    expect(global.fetch.mock.calls.some(([url]) => url.includes('/read?'))).toBe(false)
  })

  // redesign bugs-d row 54: the order still counts unread messages (order 13861: 1) although its last message comes `read: true`
  const readReads = () => global.fetch.mock.calls.map(([url]) => url).filter(url => url.includes('/read?'))

  it('marks the last message as read when it is read but the order still counts unread ones', async () => {
    mockApi({ messages: [{ ...MESSAGES[2], read: true }] })
    const { props } = renderChat({}, { unread_count: 1 })
    await screen.findByText('Where is my order?')
    await waitFor(() => expect(readReads()).toEqual(['https://api.test/orders/42/messages/3/read?order_id=42&order_message_id=3']))
    await waitFor(() => expect(props.handleUpdateOrderForUnreadCount).toHaveBeenCalledWith(42))
  })

  it('counts unread_direct_count first, like the list badge', async () => {
    mockApi({ messages: [{ ...MESSAGES[2], read: true }] })
    renderChat({}, { unread_count: 3, unread_direct_count: 0 })
    await screen.findByText('Where is my order?')
    await new Promise(resolve => setTimeout(resolve, 30))
    expect(readReads()).toEqual([])
  })

  it('reads the last message once when unread_direct_count says so', async () => {
    mockApi({ messages: [{ ...MESSAGES[2], read: true }] })
    renderChat({}, { unread_direct_count: 1 })
    await screen.findByText('Where is my order?')
    await waitFor(() => expect(readReads()).toHaveLength(1))
    expect(readReads()).toEqual(['https://api.test/orders/42/messages/3/read?order_id=42&order_message_id=3'])
  })

  it('does not read a read last message of an order with unread messages until the user engages (readPolicy interaction)', async () => {
    mockApi({ messages: [{ ...MESSAGES[2], read: true }] })
    renderChat({ readPolicy: 'interaction' }, { unread_count: 2 })
    await screen.findByText('Where is my order?')
    await new Promise(resolve => setTimeout(resolve, 30))
    expect(readReads()).toEqual([])
    await userEvent.click(screen.getByRole('textbox', { name: 'Write a message...' }))
    await waitFor(() => expect(readReads()).toHaveLength(1))
  })

  it('shows an empty state and a skeleton before and without messages', async () => {
    mockApi({ messages: [] })
    const { container } = renderChat()
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(await screen.findByText('No messages yet')).toBeInTheDocument()
  })

  it('announces messages that cannot be read', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ error: true, result: ['no'] }) }))
    renderChat()
    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn\'t load the messages')
  })

  it('moves the tour on when a message is sent during the tour, like today', async () => {
    mockApi()
    const orderDetailClose = vi.fn()
    const { props } = renderChat({ isTourOpen: true, onClose: orderDetailClose })
    await screen.findByText('Where is my order?')
    await userEvent.type(screen.getByRole('textbox', { name: 'Write a message...' }), 'Hi')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(postCalls()).toHaveLength(1))
    expect(orderDetailClose).toHaveBeenCalledTimes(1)
    expect(props.setCurrentTourStep).toHaveBeenCalledWith(4)
  })

  it('moves the tour on when the panel is clicked outside the composer during the tour', async () => {
    mockApi()
    const { props, container } = renderChat({ isTourOpen: true })
    await screen.findByText('Where is my order?')
    fireEvent.click(container.querySelector('[data-tour="tour_message"]'))
    expect(props.onClose).toHaveBeenCalledTimes(1)
    expect(props.setCurrentTourStep).toHaveBeenCalledWith(4)
  })

  it('does not touch the tour when no tour is open', async () => {
    mockApi()
    const { props, container } = renderChat()
    await screen.findByText('Where is my order?')
    fireEvent.click(container.querySelector('[data-tour="tour_message"]'))
    expect(props.setCurrentTourStep).not.toHaveBeenCalled()
  })
})

// redesign fix-qa E6: the chat is mounted while another tab shows (so the draft survives), which
// means it must not mark messages as read until the user can actually see them.
describe('ChatTab: mounted but hidden (fix-qa E6)', () => {
  beforeEach(() => {
    mocks.user = { id: 1, level: 0 }
    mocks.lowercaseSend = false
    mockApi()
  })

  const readCalls = () => global.fetch.mock.calls.filter(([url]) => url.includes('/read?'))

  const Host = (props) => {
    const [active, setActive] = React.useState(false)
    return (
      <>
        <button type='button' onClick={() => setActive(true)}>show chat</button>
        <ChatTab {...props} active={active} />
      </>
    )
  }

  it('does not mark the last message as read while the tab is not the one on screen', async () => {
    const props = {
      order: { order: baseOrder, loading: false },
      messages: { messages: [] },
      handleUpdateOrderForUnreadCount: vi.fn(),
      onClose: vi.fn(),
      setCurrentTourStep: vi.fn(),
      onSelectTab: vi.fn()
    }
    renderWithProviders(<Host {...props} />)
    await screen.findByText('Where is my order?')
    expect(readCalls()).toHaveLength(0)
    expect(props.handleUpdateOrderForUnreadCount).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'show chat' }))
    await waitFor(() => expect(readCalls()).toHaveLength(1))
    await waitFor(() => expect(props.handleUpdateOrderForUnreadCount).toHaveBeenCalledWith(42))
  })

  it('keeps what was typed while it is hidden and shown again', async () => {
    const props = {
      order: { order: baseOrder, loading: false },
      messages: { messages: [] },
      onClose: vi.fn(),
      setCurrentTourStep: vi.fn(),
      onSelectTab: vi.fn()
    }
    renderWithProviders(<Host {...props} />)
    const box = await screen.findByRole('textbox', { name: 'Write a message...' })
    await userEvent.type(box, 'draft in progress')
    fireEvent.click(screen.getByRole('button', { name: 'show chat' }))
    expect(screen.getByRole('textbox', { name: 'Write a message...' })).toHaveValue('draft in progress')
  })

  it('writes the Send button with a capital even when the catalog says "send"', async () => {
    mocks.lowercaseSend = true
    renderChat()
    await screen.findByText('Where is my order?')
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'send' })).toBeNull()
  })
})

// redesign F6c (Q2-12, Q2-28): the chat on a phone gives the conversation most of the height, and the time of an event sits on top
// of it, as in Activity, so it is clear whose time it is.
describe('ChatTab: phone composer and event times (F6c)', () => {
  const CSS = readFileSync(resolve(__dirname, '..', 'activity-tab.css'), 'utf8')
  const phoneBlock = () => CSS.match(/@media \(max-width: 767px\) \{([\s\S]*?)\n\}/g)?.join('\n') ?? ''

  beforeEach(() => {
    mocks.user = { id: 1, level: 0 }
    mocks.rawQuickKeys = false
    mocks.translate = null
    mockApi()
  })

  // owner decision 2A: the toggle is there when the project configured quick replies
  const configureQuick = () => { mocks.translate = (key) => ({ ADMIN_MESSAGE_1: 'We are on it', ADMIN_MESSAGE_2: 'The order is on its way.' })[key] }

  it('puts the quick replies behind a «Quick replies» button that says whether they are open', async () => {
    configureQuick()
    renderChat()
    await screen.findByText('Where is my order?')
    const toggle = screen.getByRole('button', { name: 'Quick replies' })
    const group = screen.getByRole('group', { name: 'Quick messages' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveAttribute('aria-controls', group.id)
    expect(group).not.toHaveAttribute('data-open')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(group).toHaveAttribute('data-open')
    fireEvent.click(toggle)
    expect(group).not.toHaveAttribute('data-open')
  })

  it('still appends a quick reply to the draft and folds the list again', async () => {
    configureQuick()
    renderChat()
    await screen.findByText('Where is my order?')
    fireEvent.click(screen.getByRole('button', { name: 'Quick replies' }))
    fireEvent.click(within(screen.getByRole('group', { name: 'Quick messages' })).getAllByRole('button')[1])
    expect(screen.getByRole('textbox', { name: 'Write a message...' })).toHaveValue('The order is on its way.')
    expect(screen.getByRole('button', { name: 'Quick replies' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('has no toggle for a role without quick replies', async () => {
    mocks.user = { id: 4, level: 5 }
    renderChat()
    await screen.findByText('Where is my order?')
    expect(screen.queryByRole('button', { name: 'Quick replies' })).toBeNull()
  })

  it('folds the list and scrolls the recipients on one line below 768px, and shows the toggle only there', () => {
    expect(CSS).toMatch(/\.odt-chat-quick-toggle\s*\{[^}]*display:\s*none/)
    const phone = phoneBlock()
    expect(phone).toMatch(/\.odt-chat-quick-toggle\s*\{[^}]*display:\s*inline-flex/)
    expect(phone).toMatch(/\.odt-chat-quick:not\(\[data-open\]\)\s*\{[^}]*display:\s*none/)
    expect(phone).toMatch(/\.odt-chat-recipients\s*\{[^}]*flex-wrap:\s*nowrap[^}]*overflow-x:\s*auto/)
  })

  it('puts the time of an order event above the event, not between it and the next one', async () => {
    renderChat()
    const log = await screen.findByRole('log', { name: 'Messages' })
    const events = [...log.querySelectorAll('[data-from="system"]')]
    expect(events.length).toBeGreaterThan(0)
    events.forEach(event => {
      expect(event.firstElementChild).toHaveClass('odt-chat-meta')
      expect(event.lastElementChild).toHaveClass('odt-chat-bubble')
    })
  })

  it('scrolls to an anchor after the sticky composer, so the last event is not cut under it', async () => {
    const targets = []
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function () { targets.push(this) }
    try {
      renderChat()
      await screen.findByText('Where is my order?')
      const composer = document.querySelector('.odt-chat-composer')
      expect(targets.length).toBeGreaterThan(0)
      const anchor = targets[targets.length - 1]
      expect(anchor).toHaveAttribute('data-chat-end')
      expect(composer.compareDocumentPosition(anchor) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    } finally {
      Element.prototype.scrollIntoView = original
    }
  })

  // redesign F6d (Q3-05): `scrollIntoView` on the anchor stopped about 31px short of the end (the anchor sits inside the
  // composer's cancelled padding), so the last event stayed under the composer. The panel's scroll area goes to its very
  // end after the layout, on open and every time the tab is shown again.
  describe('opens at the very end of the conversation (Q3-05)', () => {
    const scrollArea = () => document.querySelector('.odc-od-body')

    const renderInBody = (props = {}) => {
      const Body = (extra) => (
        <div className='odc-od-body'>
          <ChatTab
            order={{ order: baseOrder, loading: false }}
            messages={{ messages: [] }}
            handleUpdateOrderForUnreadCount={vi.fn()}
            onClose={vi.fn()}
            isTourOpen={false}
            setCurrentTourStep={vi.fn()}
            onSelectTab={vi.fn()}
            {...props}
            {...extra}
          />
        </div>
      )
      const view = renderWithProviders(<Body />)
      const area = scrollArea()
      // jsdom has no layout: the area is 400px tall with 1152px of content more than it shows
      Object.defineProperty(area, 'clientHeight', { configurable: true, value: 400 })
      Object.defineProperty(area, 'scrollHeight', { configurable: true, value: 1552 })
      return { ...view, area, Body }
    }

    it('scrolls the panel body to its end once the messages are drawn', async () => {
      mockApi()
      const { area } = renderInBody()
      await screen.findByText('Where is my order?')
      await waitFor(() => expect(area.scrollTop).toBe(1552 - 400))
    })

    it('does it again when the tab is shown after another one', async () => {
      mockApi()
      const { area, rerender, Body } = renderInBody({ active: true })
      await screen.findByText('Where is my order?')
      await waitFor(() => expect(area.scrollTop).toBe(1552 - 400))
      rerender(<Body active={false} />)
      area.scrollTop = 0
      rerender(<Body active />)
      await waitFor(() => expect(area.scrollTop).toBe(1552 - 400))
    })
  })

  it('keeps the time of a person message under its bubble', async () => {
    renderChat()
    const log = await screen.findByRole('log', { name: 'Messages' })
    const mine = within(log).getByText('On its way').closest('[data-from]')
    expect(mine.lastElementChild).toHaveClass('odt-chat-meta')
  })
})
