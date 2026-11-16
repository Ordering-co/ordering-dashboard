/* eslint-disable import/first */
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// Redesign 5.3-C: the chat tab runs the REAL Messages controller (POST payload, read marking and
// endpoints of today); only its contexts and fetch are simulated.
const mocks = vi.hoisted(() => ({ user: { id: 1, level: 0 } }))

const t = (key, fallback) => fallback ?? key
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

// redesign 5.3 audit-1 (FD-4): the chat times are absolute and mono like in Activity, and no fold of
// technical details ends up apart from its message under the composer.
const readCss = (name) => readFileSync(resolve(__dirname, '..', name), 'utf8')
const ruleOf = (css, selector) => {
  const start = css.indexOf(`${selector} {`)
  if (start === -1) throw new Error(`rule ${selector} not found`)
  return css.slice(start, css.indexOf('}', start))
}

describe('ChatTab — absolute times (FD-4)', () => {
  beforeEach(() => {
    mocks.user = { id: 1, level: 0 }
    mockApi()
  })

  it('shows the absolute time of every message, in mono, like Activity', async () => {
    renderChat()
    const log = await screen.findByRole('log', { name: 'Messages' })
    const theirs = within(log).getByText('Where is my order?').closest('[data-from]')
    const time = within(theirs).getByText('at 2026-10-02 16:00:00')
    expect(time).toHaveClass('odc-mono')
    expect(time.closest('.odt-chat-meta')).not.toBeNull()
    expect(log).not.toHaveTextContent(/ago /)
  })

  it('gives the status events the same absolute time', async () => {
    renderChat()
    const log = await screen.findByRole('log', { name: 'Messages' })
    const statusEvent = [...log.querySelectorAll('[data-from="system"]')].find(node => /changed from/.test(node.textContent))
    expect(within(statusEvent).getByText('at 2026-10-02 15:58:00')).toHaveClass('odc-mono')
  })

  it('keeps who each message went to next to its time', async () => {
    renderChat({}, { driver: { id: 8, name: 'Dan', lastname: 'Driver' } })
    const log = await screen.findByRole('log', { name: 'Messages' })
    const mine = within(log).getByText('On its way').closest('[data-from]')
    expect(mine).toHaveTextContent('at 2026-10-02 16:02:00 · Send to: Customer, Driver')
  })
})

describe('ChatTab — every fold belongs to its message (FD-4)', () => {
  beforeEach(() => {
    mocks.user = { id: 1, level: 0 }
    mockApi()
  })

  it.each([[7], [11]])('has no technical fold outside a message or inside the composer (status %i)', async (status) => {
    const { container } = renderChat({}, { status })
    await screen.findByRole('log', { name: 'Messages' })
    const folds = [...container.querySelectorAll('details')]
    expect(folds.length).toBeGreaterThan(0)
    folds.forEach(fold => expect(fold.closest('.odt-chat-msg')).not.toBeNull())
    const composer = container.querySelector('.odt-chat-composer')
    folds.forEach(fold => {
      expect(composer.contains(fold)).toBe(false)
      // the composer is the last block: nothing of the log follows it
      expect(composer.compareDocumentPosition(fold) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(0)
    })
  })

  it('the sticky composer reaches the foot of the scroll area, over the padding of the panel body', () => {
    // The body of the panel pads its end; sticky positions inside that padding, so the log showed through
    // below the composer (a «Technical details» line under the ended notice). The composer cancels the padding.
    const bodyPadding = /padding-block:\s*var\(--od-space-4\)\s+(var\(--od-space-\d\))/.exec(ruleOf(readCss('order-details.css'), '.odc-od-body'))[1]
    const composer = ruleOf(readCss('activity-tab.css'), '.odt-chat-composer')
    expect(composer).toContain(`inset-block-end: calc(-1 * ${bodyPadding})`)
    expect(composer).toContain(`margin-block-end: calc(-1 * ${bodyPadding})`)
    expect(composer).toContain(`padding-block: var(--od-space-3) calc(var(--od-space-3) + ${bodyPadding})`)
  })
})
