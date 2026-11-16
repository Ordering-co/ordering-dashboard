/* eslint-disable import/first */
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// redesign messages B1 (B1-4, decision 5A; B1-5, owner's extra): the recipients of the chat keep what the user chose until the
// order changes, show their state on each chip and say why Send is off when none is chosen; the messages the customer does not
// see (`can_see` without 3) carry an «Internal note» marker. The chat runs the REAL Messages controller; only its contexts and
// fetch are simulated.
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

const text = (id, authorId, extra = {}) => ({
  id, type: 2, created_at: '2026-10-02 16:00:00', comment: `msg ${id}`, author_id: authorId, author: authorId === 1 ? { id: 1, name: 'Me', level: 0 } : { id: authorId, name: 'Ada', level: 3 }, can_see: [0, 2, 3], read: true, ...extra
})

let conversation
const mockApi = () => {
  global.fetch = vi.fn(async (url, options) => {
    const respond = (result, error = false) => ({ ok: true, json: async () => ({ error, result }) })
    if (options?.method === 'POST') return respond({})
    if (/\/read\?/.test(url)) return respond([])
    return respond(structuredClone(conversation))
  })
}

const baseOrder = {
  id: 42,
  status: 7,
  customer_id: 5,
  customer: { id: 5, name: 'Ada', lastname: 'Lovelace' },
  business: { id: 9, name: 'Fast Bite' },
  driver: { id: 8, name: 'Dan', lastname: 'Driver' }
}
const chat = (orderOverrides = {}) => (
  <ChatTab order={{ order: { ...baseOrder, ...orderOverrides }, loading: false }} messages={{ messages: [] }} handleUpdateOrderForUnreadCount={vi.fn()} onClose={vi.fn()} />
)
const renderChat = (orderOverrides) => renderWithProviders(chat(orderOverrides))
const chip = name => screen.getByRole('button', { name: new RegExp(`^${name}:`) })
const sendButton = () => screen.getByRole('button', { name: 'Send' })
const box = () => screen.getByPlaceholderText('Write a message...')
const HINT = 'Choose at least one recipient to send.'

beforeEach(() => {
  mocks.handlers.clear()
  mocks.user = { id: 1, level: 0 }
  conversation = [text(10, 5)]
  mockApi()
})

describe('ChatTab · recipients that stay put (B1-4, decision 5A)', () => {
  it('everything available is chosen by default, as in main', async () => {
    renderChat()
    await screen.findByText('msg 10')
    for (const name of ['Business', 'Customer', 'Driver']) expect(chip(name)).toHaveAttribute('aria-pressed', 'true')
  })

  it('a new order object of the same id (a socket update_order) does not put back a recipient the user removed', async () => {
    const user = userEvent.setup()
    const view = renderChat()
    await screen.findByText('msg 10')
    await user.click(chip('Customer'))
    expect(chip('Customer')).toHaveAttribute('aria-pressed', 'false')
    view.rerender(chat({ status: 3 })) // same order id, new object
    expect(chip('Customer')).toHaveAttribute('aria-pressed', 'false')
    expect(chip('Business')).toHaveAttribute('aria-pressed', 'true')
  })

  it('another order starts again from everything chosen, and a driver that gets assigned is chosen', async () => {
    const user = userEvent.setup()
    conversation = [text(10, 5)]
    const view = renderChat({ driver: null })
    await screen.findByText('msg 10')
    await user.click(chip('Customer'))
    view.rerender(chat({ driver: baseOrder.driver }))
    expect(chip('Driver')).toHaveAttribute('aria-pressed', 'true')
    // redesign messages R1 (Q-01): the driver appearing only adds the driver; it no longer re-derives the defaults
    expect(chip('Customer')).toHaveAttribute('aria-pressed', 'false')
    await user.click(chip('Customer'))
    view.rerender(chat({ id: 43 }))
    await waitFor(() => expect(chip('Customer')).toHaveAttribute('aria-pressed', 'true'))
  })

  it('R1 Q-01: a driver assigned while the customer and the business are off keeps both off and adds only the driver', async () => {
    const user = userEvent.setup()
    const view = renderChat({ driver: null })
    await screen.findByText('msg 10')
    await user.click(chip('Customer'))
    await user.click(chip('Business'))
    view.rerender(chat({ driver: baseOrder.driver }))
    expect(chip('Driver')).toHaveAttribute('aria-pressed', 'true')
    expect(chip('Customer')).toHaveAttribute('aria-pressed', 'false')
    expect(chip('Business')).toHaveAttribute('aria-pressed', 'false')
  })

  it('R1 Q-01: another order id still starts from the defaults, whatever was chosen before', async () => {
    const user = userEvent.setup()
    const view = renderChat()
    await screen.findByText('msg 10')
    await user.click(chip('Customer'))
    await user.click(chip('Driver'))
    view.rerender(chat({ id: 43 }))
    await waitFor(() => expect(chip('Customer')).toHaveAttribute('aria-pressed', 'true'))
    expect(chip('Driver')).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('ChatTab · the state of each recipient is visible (B1-4)', () => {
  it('each chip carries a check box that is filled when chosen and empty when not', async () => {
    const user = userEvent.setup()
    renderChat()
    await screen.findByText('msg 10')
    const box = () => chip('Customer').querySelector('[data-chip-check]')
    expect(box()).not.toBeNull()
    expect(box()).toHaveAttribute('data-checked', 'true')
    await user.click(chip('Customer'))
    expect(box()).toHaveAttribute('data-checked', 'false')
    expect(chip('Customer')).toHaveAttribute('aria-pressed', 'false')
  })

  it('the stylesheet fills the box with the action colour and tints a pressed chip with the soft action colour, tokens only', () => {
    const css = readFileSync(resolve(__dirname, '../activity-tab.css'), 'utf8')
    const rule = (selector) => {
      const start = css.indexOf(selector)
      expect(start, selector).toBeGreaterThan(-1)
      return css.slice(start, css.indexOf('}', start))
    }
    const pressed = rule(".odt-chat-chip[aria-pressed='true'] {")
    expect(pressed).toMatch(/background:\s*var\(--od-action-soft\)/)
    expect(pressed).toMatch(/border-color:\s*var\(--od-action\)/)
    expect(rule(".odt-chat-chip-check[data-checked='true'] {")).toMatch(/background:\s*var\(--od-action\)/)
    expect(rule('.odt-chat-chip-check {')).toMatch(/border:[^;]*var\(--od-/)
  })
})

describe('ChatTab · none chosen says so instead of going read-only (B1-4, M-D5)', () => {
  const clearAll = async (user) => {
    for (const name of ['Business', 'Customer', 'Driver']) await user.click(chip(name))
  }

  it('shows the line in a status, disables Send with it as description, and keeps the input editable', async () => {
    const user = userEvent.setup()
    renderChat()
    await screen.findByText('msg 10')
    expect(screen.queryByText(HINT)).toBeNull()
    await clearAll(user)
    const hint = screen.getByText(HINT)
    expect(hint).toHaveAttribute('role', 'status')
    expect(box()).not.toHaveAttribute('readonly')
    await user.type(box(), 'Hello')
    expect(box()).toHaveValue('Hello')
    expect(sendButton()).toBeDisabled()
    expect(sendButton()).toHaveAttribute('aria-describedby', hint.id)
    expect(hint.id).not.toBe('')
    expect(screen.getByRole('button', { name: 'Insert image' })).toBeDisabled()
  })

  it('goes away when one recipient is chosen again, and Send works', async () => {
    const user = userEvent.setup()
    renderChat()
    await screen.findByText('msg 10')
    await clearAll(user)
    await user.type(box(), 'Hello')
    await user.click(chip('Customer'))
    expect(screen.queryByText(HINT)).toBeNull()
    expect(sendButton()).toBeEnabled()
    expect(sendButton()).not.toHaveAttribute('aria-describedby')
    expect(within(screen.getByRole('group', { name: 'Send to' })).getByRole('button', { name: /^Customer:/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('Enter in the box does not send while none is chosen', async () => {
    const user = userEvent.setup()
    renderChat()
    await screen.findByText('msg 10')
    await clearAll(user)
    await user.type(box(), 'Hello{Enter}')
    expect(global.fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0)
  })
})

describe('ChatTab · the internal note marker (B1-5)', () => {
  const messageOf = (id) => screen.getByText(`msg ${id}`).closest('[data-from]')

  it('marks a message whose can_see (a string "0,2,4") leaves the customer out, with the label before «Send to»', async () => {
    conversation = [text(20, 1, { can_see: '0,2,4' })]
    renderChat()
    await screen.findByText('msg 20')
    const message = messageOf(20)
    expect(message).toHaveAttribute('data-note', 'internal')
    expect(message).toHaveTextContent(/Internal note · Send to: Business, Driver/)
  })

  it('marks it for an array can_see as well, and for a picture', async () => {
    conversation = [text(21, 1, { can_see: [0, 2, 4] }), text(22, 1, { type: 3, comment: '', source: 'https://img.test/a.png', can_see: [0, 4] })]
    renderChat()
    await screen.findByText('msg 21')
    expect(messageOf(21)).toHaveAttribute('data-note', 'internal')
    expect(document.querySelector('[data-from] img[src="https://img.test/a.png"]').closest('[data-from]')).toHaveAttribute('data-note', 'internal')
  })

  it('does not mark a message the customer sees ("0,2,3")', async () => {
    conversation = [text(23, 1, { can_see: '0,2,3' }), text(24, 1, { can_see: [0, 3] })]
    renderChat()
    await screen.findByText('msg 23')
    expect(messageOf(23)).not.toHaveAttribute('data-note')
    expect(messageOf(24)).not.toHaveAttribute('data-note')
    expect(screen.queryByText(/Internal note/)).toBeNull()
  })

  it("does not mark the customer's own message, by id or by level", async () => {
    conversation = [
      text(25, 5, { can_see: '0,2,4' }),
      text(26, 77, { can_see: '0,2,4', author: { id: 77, name: 'Another customer', level: 3 } })
    ]
    renderChat()
    await screen.findByText('msg 25')
    expect(messageOf(25)).not.toHaveAttribute('data-note')
    expect(messageOf(26)).not.toHaveAttribute('data-note')
  })

  it('changes nothing else: the message keeps its side, sender and recipients line', async () => {
    conversation = [text(27, 1, { can_see: '0,2,4' })]
    renderChat()
    await screen.findByText('msg 27')
    expect(messageOf(27)).toHaveAttribute('data-from', 'me')
    expect(messageOf(27)).toHaveTextContent('Me (Admin)')
  })

  it('the stylesheet draws it with a dashed warning border and a soft warning background, tokens only', () => {
    const css = readFileSync(resolve(__dirname, '../activity-tab.css'), 'utf8')
    const start = css.indexOf(".odt-chat-msg[data-note='internal'] .odt-chat-bubble {")
    expect(start).toBeGreaterThan(-1)
    const rule = css.slice(start, css.indexOf('}', start))
    expect(rule).toMatch(/border-style:\s*dashed/)
    expect(rule).toMatch(/border-color:\s*var\(--od-warning-signal\)/)
    expect(rule).toMatch(/background:\s*var\(--od-warning-soft\)/)
  })

  // redesign messages integration (live 1440): outside the panel nobody pads the chat, so the log and the composer
  // touched the edges of the /messages pane. Standalone, both keep the panel's side padding.
  it('pads the standalone log and composer on both sides, tokens only', () => {
    const css = readFileSync(resolve(__dirname, '../activity-tab.css'), 'utf8')
    for (const selector of [".odt-chat[data-layout='standalone'] .odt-chat-log {", ".odt-chat[data-layout='standalone'] .odt-chat-composer {"]) {
      const start = css.indexOf(selector)
      expect(start).toBeGreaterThan(-1)
      const rule = css.slice(start, css.indexOf('}', start))
      expect(rule).toMatch(/padding-inline:\s*var\(--od-space-\d\)/)
    }
  })

  // redesign messages integration (live 1024): in the /messages pane (~390px wide at 1024) the four quick replies took four
  // rows and left the log 175px. Standalone, they fold behind «Quick replies» when the chat itself is narrow (a container
  // query, not the window), and an unfolded reply grows to fit its text instead of overflowing its box.
  it('folds the quick replies when the standalone chat is narrow, by container query', () => {
    const css = readFileSync(resolve(__dirname, '../activity-tab.css'), 'utf8')
    const root = css.slice(css.indexOf(".odt-chat[data-layout='standalone'] {"))
    expect(root.slice(0, root.indexOf('}'))).toMatch(/container:\s*odt-chat\s*\/\s*inline-size/)
    const start = css.indexOf('@container odt-chat (max-width: 719px)')
    expect(start).toBeGreaterThan(-1)
    const block = css.slice(start, css.indexOf('\n}', start))
    expect(block).toMatch(/\.odt-chat-quick-toggle\s*\{[^}]*display:\s*inline-flex/)
    expect(block).toMatch(/\.odt-chat-quick:not\(\[data-open\]\)\s*\{\s*display:\s*none/)
    const button = css.indexOf(".odt-chat[data-layout='standalone'] .odt-chat-quick .odc-btn {")
    expect(button).toBeGreaterThan(-1)
    expect(css.slice(button, css.indexOf('}', button))).toMatch(/block-size:\s*auto/)
  })
})

// redesign messages R1 (Q-06, decision 5A): the group has a visible «Send to» label, not only an aria-label.
describe('ChatTab · the visible «Send to» label (R1 Q-06)', () => {
  it('shows «Send to» as text before the chips and names the group through aria-labelledby, not aria-label', async () => {
    renderChat()
    await screen.findByText('msg 10')
    const group = screen.getByRole('group', { name: 'Send to' })
    expect(group).not.toHaveAttribute('aria-label')
    const label = document.getElementById(group.getAttribute('aria-labelledby'))
    expect(label).not.toBeNull()
    expect(label).toHaveTextContent(/^Send to$/)
    expect(label).toBeVisible()
    expect(label.compareDocumentPosition(chip('Business')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('the label is in the muted caption style, tokens only', () => {
    const css = readFileSync(resolve(__dirname, '../activity-tab.css'), 'utf8')
    const start = css.indexOf('.odt-chat-recipients-label {')
    expect(start).toBeGreaterThan(-1)
    const rule = css.slice(start, css.indexOf('}', start))
    expect(rule).toMatch(/color:\s*var\(--od-text-muted\)/)
    expect(rule).toMatch(/font-size:\s*var\(--od-x-type-caption-size\)/)
    expect(rule).not.toMatch(/#[0-9a-f]{3,8}\b|\d+px|rgba?\(/i)
  })
})

// redesign messages R1 (Q-07, M-D10): a person without a name is the role alone, never «(Customer)» or «Customer:».
describe('ChatTab · a person without a name (R1 Q-07)', () => {
  const sender = (id) => screen.getByText(`msg ${id}`).closest('[data-from]').querySelector('.odt-chat-sender')

  it('the bubble sender is the role alone when the author has no name, and the name plus role when it has one', async () => {
    conversation = [
      text(30, 5, { author: { id: 5, level: 3 } }),
      text(31, 8, { author: { id: 8, level: 4 } }),
      text(32, 5, { author: { id: 5, name: '', level: 3 } }),
      text(33, 1)
    ]
    renderChat()
    await screen.findByText('msg 30')
    expect(sender(30)).toHaveTextContent(/^Customer$/)
    expect(sender(31)).toHaveTextContent(/^Driver$/)
    expect(sender(32)).toHaveTextContent(/^Customer$/)
    expect(sender(33)).toHaveTextContent(/^Me \(Admin\)$/)
  })

  it('a recipient chip without a name is named by its role alone, for the customer, the driver and the business', async () => {
    renderChat({
      customer: { id: 5 },
      driver: { id: 8 },
      business: { id: 9 }
    })
    await screen.findByText('msg 10')
    for (const name of ['Customer', 'Driver', 'Business']) {
      const button = screen.getByRole('button', { name })
      expect(button).toHaveAttribute('aria-pressed', 'true')
      expect(button).toHaveAccessibleName(name)
    }
    expect(screen.queryByRole('button', { name: /undefined|:\s*$/ })).toBeNull()
  })

  it('shows the role once in a name-less chip, with no empty name line', async () => {
    renderChat({ customer: { id: 5 } })
    await screen.findByText('msg 10')
    const button = screen.getByRole('button', { name: 'Customer' })
    expect(button).toHaveTextContent(/^Customer$/)
    expect(button.querySelector('.odt-chat-chip-name > span:empty')).toBeNull()
  })

  it('a chip with a name keeps «Role: Name» as its accessible name', async () => {
    renderChat()
    await screen.findByText('msg 10')
    expect(chip('Customer')).toHaveAccessibleName('Customer: Ada Lovelace')
    expect(chip('Driver')).toHaveAccessibleName('Driver: Dan Driver')
    expect(chip('Business')).toHaveAccessibleName('Business: Fast Bite')
  })

  // redesign messages FASE 3 (e2e messages-shell, 320px coarse, RTL): the composer grid had one implicit `auto` column, so the
  // recipients and the input row (min-content wider than 288px) pushed the composer off the screen. The column may shrink.
  it('lets the composer column shrink below its content', () => {
    const css = readFileSync(resolve(__dirname, '../activity-tab.css'), 'utf8')
    const start = css.indexOf('.odt-chat-composer {\n')
    expect(start).toBeGreaterThan(-1)
    expect(css.slice(start, css.indexOf('}', start))).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/)
  })

  // redesign messages FASE 3 (e2e messages-shell, 320px coarse): in a 288px row the attach button shrank to 28px wide (under the
  // 32px a control draws). The field gives way; the buttons of the row never shrink.
  it('keeps the buttons of the composer row at their size', () => {
    const css = readFileSync(resolve(__dirname, '../activity-tab.css'), 'utf8')
    const start = css.indexOf('.odt-chat-row > .odc-btn {')
    expect(start).toBeGreaterThan(-1)
    expect(css.slice(start, css.indexOf('}', start))).toMatch(/flex:\s*none/)
  })

  // redesign messages ronda 2 (owner, 2026-10-09: «el botón de Mía tapa lo del botón de enviar»): in /messages the composer sits in
  // the bottom end corner of the page, under Mia's floating button. While the button is on screen (closed assistant), the standalone
  // composer gets the same room the order panel's foot gets (details-tab.css, fix-qa E6): the launcher clearance under its controls.
  it('keeps the standalone composer out from under Mia while her button is on screen', () => {
    const css = readFileSync(resolve(__dirname, '../activity-tab.css'), 'utf8')
    const ruleAfter = (from, selector) => {
      const start = css.indexOf(selector, from)
      expect(start, selector).toBeGreaterThan(-1)
      return css.slice(start, css.indexOf('}', start))
    }
    const shown = ":root:has(button[aria-controls='assistant_panel'][aria-expanded='false'])"
    // from 768px: room at the right of the field row (Mia is anchored to the physical right, also in RTL), the thread keeps its height
    expect(ruleAfter(0, ':root:not([dir=\'rtl\']):has(button[aria-controls=\'assistant_panel\'][aria-expanded=\'false\']) .odt-chat[data-layout=\'standalone\'] .odt-chat-row {')).toMatch(/padding-right:\s*var\(--od-x-launcher-inline-clearance\)/)
    // on a phone the row is the full width: room under the composer, as the order panel's foot does (details-tab.css, fix-qa E6)
    const phone = css.indexOf('@media (max-width: 767px)', css.indexOf("odt-chat[data-layout='standalone'] .odt-chat-row {"))
    expect(phone).toBeGreaterThan(-1)
    expect(ruleAfter(phone, `${shown} .odt-chat[data-layout='standalone'] .odt-chat-composer {`)).toMatch(/padding-block-end:\s*calc\(var\(--od-space-3\) \+ var\(--od-x-launcher-clearance\)\)/)
  })

  // redesign messages R2.4 (RTL, ar, live at 1440 and 1024): right to left the composer is at the left of the page and the sidebar
  // sits under Mia's button, so the room at the right of the field row would only shorten the field. It is for LTR only.
  it('reserves the room beside the field row only left to right', () => {
    const css = readFileSync(resolve(__dirname, '../activity-tab.css'), 'utf8')
    expect(css).toContain(":root:not([dir='rtl']):has(button[aria-controls='assistant_panel'][aria-expanded='false']) .odt-chat[data-layout='standalone'] .odt-chat-row {")
  })
})
