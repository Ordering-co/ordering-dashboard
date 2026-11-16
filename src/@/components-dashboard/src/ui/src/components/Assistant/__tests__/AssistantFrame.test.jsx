import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import theme from '~/theme.json'
import { scanSource } from '../../../../../../../../../scripts/product-ui/literal-guard.mjs'

// redesign AS-B: the page and panel frame (header, launcher), the states of the chat, the composer and the data notice

const assistant = vi.hoisted(() => ({ current: {} }))
const infoShare = vi.hoisted(() => ({ isCollapse: false, handleMenuCollapse: vi.fn() }))

vi.mock('../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
  useUtils: () => [{ parsePrice: (value) => `$${Number(value).toFixed(2)}`, parseDate: (value) => String(value) }],
  useAssistant: () => assistant.current
}))
vi.mock('../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: infoShare.isCollapse }, { handleMenuCollapse: infoShare.handleMenuCollapse }]
}))
// The messages and the destinations have their own tests (lot A)
vi.mock('../AssistantMessages', () => ({
  // redesign R1-2: the stand-in exposes «Propose again» so the frame's focus after it can be checked
  AssistantMessages: ({ onProposeAgain }) => <div>Messages{onProposeAgain && <button type='button' onClick={onProposeAgain}>Propose again (stand-in)</button>}</div>
}))

import { AssistantPage, AssistantPanel } from '../AssistantPanel'
import { AssistantComposer } from '../AssistantComposer'
import { ASSISTANT_NOTICE_VERSION } from '../../../../../contexts/AssistantContext/notice'

const READY = { loaded: true, enabled: true, error: null, noticeAccepted: true, noticeVersion: ASSISTANT_NOTICE_VERSION, usage: {} }

const setAssistant = (overrides = {}) => {
  assistant.current = {
    isAllowed: true,
    isAvailable: true,
    isOpen: true,
    setOpen: vi.fn(),
    status: { ...READY },
    conversation: null,
    items: [],
    actions: {},
    streaming: false,
    loadingConversation: false,
    pageEntities: null,
    newConversation: vi.fn(),
    deleteConversation: vi.fn(async () => {}),
    sendMessage: vi.fn(async () => ({ sent: true })),
    stopMessage: vi.fn(),
    loadStatus: vi.fn(),
    acceptNotice: vi.fn(),
    noticeState: { loading: false, error: null },
    noticeOutdated: false,
    ...overrides
  }
  return assistant.current
}

const withStatus = (status, overrides = {}) => setAssistant({ status: { ...READY, ...status }, ...overrides })

const renderPage = () => renderWithProviders(<AssistantPage />, { theme, initialEntries: ['/assistant'] })
const renderPanel = () => renderWithProviders(<AssistantPanel />, { theme })

beforeEach(() => {
  infoShare.isCollapse = false
  infoShare.handleMenuCollapse.mockClear()
  setAssistant()
  vi.stubGlobal('innerWidth', 390)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('header', () => {
  // redesign D-AS1: the page row is the compact one of the panel, so the stage pill sits inside the h1 as in the h2
  it('has the conversation title, or the name, as the h1 of the page', () => {
    const view = renderPage()
    expect(screen.getByRole('heading', { level: 1, name: /^Mia/ })).toBeInTheDocument()
    view.unmount()
    setAssistant({ conversation: { id: 5, title: 'Pepperoni price' } })
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: /^Pepperoni price/ })).toBeInTheDocument()
  })

  it('has the title as the h2 of the panel', () => {
    setAssistant({ conversation: { id: 5, title: 'Pepperoni price' } })
    renderPanel()
    expect(screen.getByRole('heading', { level: 2, name: /Pepperoni price/ })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
  })

  it('shows the beta stage as a pill in the page and in the panel', () => {
    const view = renderPage()
    expect(screen.getByText('Beta')).toBeVisible()
    view.unmount()
    renderPanel()
    expect(screen.getByText('Beta')).toBeVisible()
  })

  it('opens the menu from the page only when the menu is collapsed', () => {
    infoShare.isCollapse = true
    const view = renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(infoShare.handleMenuCollapse).toHaveBeenCalledWith(false)
    view.unmount()
    infoShare.isCollapse = false
    renderPage()
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
  })

  it('does not offer the menu in the panel', () => {
    infoShare.isCollapse = true
    renderPanel()
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
  })

  it.each([['page', renderPage], ['panel', renderPanel]])('disables New conversation while the conversation is empty, in the %s', (_, render) => {
    const state = setAssistant()
    const view = render()
    expect(screen.getByRole('button', { name: 'New conversation' })).toBeDisabled()
    view.unmount()
    state.items = [{ kind: 'user', key: 'u1', text: 'Hello' }]
    render()
    const button = screen.getByRole('button', { name: 'New conversation' })
    expect(button).toBeEnabled()
    fireEvent.click(button)
    expect(state.newConversation).toHaveBeenCalledTimes(1)
  })

  it('draws New conversation as a text button in the page, with its text clipped on a narrow header, and as an icon in the panel', () => {
    setAssistant({ items: [{ kind: 'user', key: 'u1', text: 'Hello' }] })
    const view = renderPage()
    const button = screen.getByRole('button', { name: 'New conversation' })
    expect(button).not.toHaveAttribute('data-icon-only')
    expect(button.querySelector('[data-collapse-label]')).toHaveTextContent('New conversation')
    view.unmount()
    renderPanel()
    expect(screen.getByRole('button', { name: 'New conversation' })).toHaveAttribute('data-icon-only')
  })

  it('has the expand, collapse and close controls with their names', () => {
    const view = renderPanel()
    expect(screen.getByRole('button', { name: 'Open full page' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close assistant' }))
    expect(assistant.current.setOpen).toHaveBeenCalledWith(false)
    view.unmount()
    renderPage()
    expect(screen.getByRole('button', { name: 'Back to the side panel' })).toBeInTheDocument()
  })

  it('keeps the product ancestor, the panel width as a variable and the side of the writing direction', () => {
    const view = renderPanel()
    const panel = screen.getByRole('complementary', { name: 'Mia' })
    expect(panel).toHaveAttribute('id', 'assistant_panel')
    expect(panel).toHaveClass('odc-root')
    expect(panel.style.getPropertyValue('--odc-as-panel-width')).toBe('380px')
    expect(panel).toHaveAttribute('dir', 'ltr')
    view.unmount()
    renderWithProviders(<AssistantPanel />, { theme: { ...theme, rtl: true } })
    expect(screen.getByRole('complementary', { name: 'Mia' })).toHaveAttribute('dir', 'rtl')
  })

  it('marks the panel as floating below the dock width, and not above it', () => {
    const view = renderPanel()
    expect(screen.getByRole('complementary')).toHaveAttribute('data-floating')
    view.unmount()
    vi.stubGlobal('innerWidth', 1600)
    renderPanel()
    expect(screen.getByRole('complementary')).not.toHaveAttribute('data-floating')
  })

  it('has the product ancestor in the page container', () => {
    const { container } = renderPage()
    expect(container.firstChild).toHaveClass('odc-root')
  })

  it('draws the launcher with its name, icon and the panel it opens', () => {
    setAssistant({ isOpen: false })
    renderPanel()
    const launcher = screen.getByRole('button', { name: 'Mia' })
    expect(launcher).toHaveAttribute('aria-expanded', 'false')
    expect(launcher).toHaveAttribute('aria-controls', 'assistant_panel')
    expect(launcher).toHaveClass('odc-root')
    expect(launcher.querySelector('svg')).not.toBeNull()
  })
})

// redesign J5 row 49 (assistant P-1, ): «Delete conversation» in a ⋯ menu of the header, with a confirmation
describe('delete the conversation', () => {
  for (const [where, render] of [['panel', () => renderPanel()], ['page', () => renderPage()]]) {
    it(`offers it in the ⋯ of the ${where} only when there is a conversation`, () => {
      const view = render()
      expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull()
      view.unmount()
      setAssistant({ items: [{ kind: 'user', key: 'u1', text: 'Hi' }], conversation: { id: 1, title: 'T' } })
      render()
      expect(screen.getByRole('button', { name: 'More actions' })).toBeInTheDocument()
    })

    it(`asks first in the ${where}, deletes on confirm and puts the focus in the composer`, async () => {
      const { deleteConversation } = setAssistant({ items: [{ kind: 'user', key: 'u1', text: 'Hi' }], conversation: { id: 1, title: 'T' } })
      render()
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'More actions' }))
      await user.click(await screen.findByRole('menuitem', { name: 'Delete conversation' }))
      const dialog = await screen.findByRole('alertdialog', { name: 'Delete this conversation?' })
      expect(dialog).toHaveTextContent("It can't be undone.")
      expect(deleteConversation).not.toHaveBeenCalled()
      await user.click(within(dialog).getByRole('button', { name: 'Delete conversation' }))
      expect(deleteConversation).toHaveBeenCalledTimes(1)
      await waitFor(() => expect(screen.getByRole('textbox', { name: 'Message to the assistant' })).toHaveFocus())
    })

    it(`keeps the conversation when the ${where} confirmation is cancelled`, async () => {
      const { deleteConversation } = setAssistant({ items: [{ kind: 'user', key: 'u1', text: 'Hi' }], conversation: { id: 1, title: 'T' } })
      render()
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'More actions' }))
      await user.click(await screen.findByRole('menuitem', { name: 'Delete conversation' }))
      const dialog = await screen.findByRole('alertdialog', { name: 'Delete this conversation?' })
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
      expect(deleteConversation).not.toHaveBeenCalled()
    })
  }
})

// redesign J5 row 50 (assistant P-2, ): on a phone the launcher is a 48px circle with the icon; its name stays «Mia»
describe('the launcher on a phone', () => {
  it('hides the visible word under 768px and keeps a square box', () => {
    const css = readFileSync(path.join(__dirname, '..', 'assistant.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    const phone = css.split('@media (max-width: 767px)').slice(1).join('')
    expect(phone).toMatch(/\.odc-as-launcher > \.odc-as-launcher-label \{[^}]*display: none/)
    expect(phone).toMatch(/\.odc-as-launcher \{[^}]*inline-size: calc\(var\(--od-x-target-coarse\) \+ var\(--od-space-1\)\)/)
  })

  // part 2: the 44px areas of the header buttons (32 visible) must not cross on the page either: 12px apart
  it('keeps the buttons of the header 12px apart under 768px on the page as in the panel', () => {
    const css = readFileSync(path.join(__dirname, '..', 'assistant.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    const coarse = css.split('@media (max-width: 767px), (pointer: coarse) {')[1].split(/\n\}\n/)[0]
    const gapOf = (selector) => {
      const rules = [...coarse.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter(([, selectors]) => selectors.split(',').some(item => item.trim() === selector))
      return rules.map(([, , body]) => body.match(/(?:^|[\s;])gap:\s*([^;]+)/)?.[1]).find(Boolean)
    }
    expect(gapOf('.odc-as-head[data-panel]')).toBe('var(--od-space-3)')
    expect(gapOf('.odc-as-head[data-page]')).toBe('var(--od-space-3)')
  })

  it('names the icon-only launcher «Mia» and marks its word as the label', () => {
    setAssistant({ isOpen: false })
    renderPanel()
    const launcher = screen.getByRole('button', { name: 'Mia' })
    expect(launcher.querySelector('.odc-as-launcher-label')).toHaveTextContent('Mia')
  })
})

describe('focus when the panel opens and closes', () => {
  const Opener = () => <button type='button'>Page control</button>
  const renderWithOpener = () => renderWithProviders(<><Opener /><AssistantPanel /></>, { theme })
  const reopen = (view, isOpen) => {
    assistant.current.isOpen = isOpen
    view.rerender(<><Opener /><AssistantPanel /></>)
  }

  it('moves the focus to the composer when the panel opens', () => {
    setAssistant({ isOpen: false })
    const view = renderWithOpener()
    screen.getByRole('button', { name: 'Mia' }).focus()
    reopen(view, true)
    expect(screen.getByRole('textbox', { name: 'Message to the assistant' })).toHaveFocus()
  })

  it('moves the focus to the first control of the panel when there is no composer', () => {
    setAssistant({ isOpen: false, status: { loaded: false } })
    const view = renderWithOpener()
    reopen(view, true)
    expect(screen.getByRole('button', { name: 'Open full page' })).toHaveFocus()
  })

  // redesign R1-3: a panel open from the start (sessionStorage) does not take the focus from the page when the status
  // loads; only the user accepting the notice, or opening the panel, moves it
  it('does not take the focus when the status of an already open panel loads', () => {
    setAssistant({ isOpen: true, status: { loaded: false, noticeAccepted: false } })
    const view = renderWithOpener()
    assistant.current.status = { ...READY }
    view.rerender(<><Opener /><AssistantPanel /></>)
    expect(document.body).toHaveFocus()
  })

  // reloading (or a new token resetting the status) leaves the assistant unavailable for a moment and then
  // available again, with isOpen restored from sessionStorage; that is a restoration, not the user opening the panel
  it('does not take the focus when an open panel is restored once the assistant becomes available', () => {
    setAssistant({ isAvailable: false, isOpen: true, status: { loaded: false, enabled: false, noticeAccepted: false } })
    const view = renderWithOpener()
    expect(screen.queryByRole('complementary', { name: 'Mia' })).not.toBeInTheDocument()
    assistant.current.isAvailable = true
    assistant.current.status = { ...READY }
    view.rerender(<><Opener /><AssistantPanel /></>)
    expect(screen.getByRole('complementary', { name: 'Mia' })).toBeInTheDocument()
    expect(document.body).toHaveFocus()
  })

  it('still moves the focus to the composer when the user opens the panel after it was restored', () => {
    setAssistant({ isAvailable: false, isOpen: true, status: { loaded: false, enabled: false, noticeAccepted: false } })
    const view = renderWithOpener()
    assistant.current.isAvailable = true
    assistant.current.status = { ...READY }
    view.rerender(<><Opener /><AssistantPanel /></>)
    reopen(view, false)
    reopen(view, true)
    expect(screen.getByRole('textbox', { name: 'Message to the assistant' })).toHaveFocus()
  })

  it('moves the focus to the composer when the user accepts the notice in the panel', () => {
    setAssistant({ isOpen: true, status: { ...READY, noticeAccepted: false } })
    const view = renderWithOpener()
    assistant.current.status = { ...READY }
    view.rerender(<><Opener /><AssistantPanel /></>)
    expect(screen.getByRole('textbox', { name: 'Message to the assistant' })).toHaveFocus()
  })

  it('does not move the focus for a panel that is open from the start', () => {
    setAssistant({ isOpen: true, status: { loaded: false } })
    renderWithOpener()
    expect(document.body).toHaveFocus()
  })

  it('gives the focus back to the element that had it when the panel closes with the X', () => {
    setAssistant({ isOpen: false })
    const view = renderWithOpener()
    screen.getByRole('button', { name: 'Page control' }).focus()
    reopen(view, true)
    expect(screen.getByRole('textbox')).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Close assistant' }))
    reopen(view, false)
    expect(screen.getByRole('button', { name: 'Page control' })).toHaveFocus()
  })

  it('gives the focus back with Escape when the panel floats', () => {
    setAssistant({ isOpen: false })
    const view = renderWithOpener()
    screen.getByRole('button', { name: 'Page control' }).focus()
    reopen(view, true)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(assistant.current.setOpen).toHaveBeenCalledWith(false)
    reopen(view, false)
    expect(screen.getByRole('button', { name: 'Page control' })).toHaveFocus()
  })

  it('goes back to the launcher when the opener is no longer in the document', () => {
    setAssistant({ isOpen: false })
    const view = renderWithOpener()
    screen.getByRole('button', { name: 'Mia' }).focus()
    reopen(view, true)
    reopen(view, false)
    expect(screen.getByRole('button', { name: 'Mia' })).toHaveFocus()
  })

  it('does not take the focus when it is somewhere else as the panel closes', () => {
    setAssistant({ isOpen: false })
    const view = renderWithOpener()
    reopen(view, true)
    const other = screen.getByRole('button', { name: 'Page control' })
    other.focus()
    reopen(view, false)
    expect(other).toHaveFocus()
  })
})

describe('states of the chat', () => {
  it('says it is loading, for screen readers, with skeleton lines', () => {
    withStatus({ loaded: false })
    const { container } = renderPage()
    expect(screen.getByRole('status')).toHaveTextContent('Loading')
    expect(container.querySelectorAll('.odc-skeleton').length).toBe(3)
  })

  it('shows the loading of a conversation above the list', () => {
    setAssistant({ loadingConversation: true, items: [{ kind: 'user', key: 'u1', text: 'Hello' }] })
    const { container } = renderPage()
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Loading')
    expect(container.querySelectorAll('.odc-skeleton').length).toBe(3)
    expect(status.compareDocumentPosition(screen.getByText('Messages')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('tells there is no permission as an error state', () => {
    withStatus({ error: 'no_permission' })
    const { container } = renderPage()
    expect(screen.getByRole('alert')).toHaveTextContent('No permission')
    expect(screen.getByText('Your user can\'t use the assistant in this project.')).toBeInTheDocument()
    expect(container.querySelector('.odc-state[data-tone="error"]')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it.each([
    ['an error', { error: 'network' }],
    ['a disabled assistant', { enabled: false }]
  ])('says it is not available for %s and offers Try again', (_, status) => {
    const state = withStatus(status)
    const { container } = renderPage()
    expect(screen.getByRole('alert')).toHaveTextContent('Ordering couldn\'t connect')
    expect(container.querySelector('.odc-state[data-tone="error"]')).not.toBeNull()
    const retry = screen.getByRole('button', { name: 'Try again' })
    expect(retry).toHaveAttribute('data-variant', 'secondary')
    fireEvent.click(retry)
    expect(state.loadStatus).toHaveBeenCalledTimes(1)
  })

  it('shows the empty state with three suggestions that send their text', () => {
    const state = setAssistant()
    renderPage()
    expect(screen.getByRole('heading', { level: 2, name: 'How can I help?' })).toBeInTheDocument()
    expect(screen.getByText('Ask about your orders, sales and catalog, or ask for a change.')).toBeInTheDocument()
    const suggestions = screen.getAllByRole('button', { name: /\?$/ })
    expect(suggestions.map(button => button.textContent)).toEqual([
      'How much did each store sell yesterday?',
      'Which orders are still pending right now?',
      'Which products are disabled?'
    ])
    suggestions.forEach(button => expect(button).toHaveAttribute('data-variant', 'secondary'))
    fireEvent.click(suggestions[1])
    expect(state.sendMessage.mock.calls[0][0]).toBe('Which orders are still pending right now?')
  })

  it('has the empty title one level under the title of the panel', () => {
    setAssistant()
    renderPanel()
    expect(screen.getByRole('heading', { level: 3, name: 'How can I help?' })).toBeInTheDocument()
  })

  it('disables the suggestions when the usage limit is reached', () => {
    const state = withStatus({ usage: { limited: true, retry_at: null } })
    renderPage()
    const suggestion = screen.getByRole('button', { name: 'Which products are disabled?' })
    expect(suggestion).toBeDisabled()
    fireEvent.click(suggestion)
    expect(state.sendMessage).not.toHaveBeenCalled()
  })

  it('shows the messages instead of the empty state once there are items', () => {
    setAssistant({ items: [{ kind: 'user', key: 'u1', text: 'Hello' }] })
    renderPage()
    expect(screen.getByText('Messages')).toBeInTheDocument()
    expect(screen.queryByText('How can I help?')).toBeNull()
  })
})

describe('composer', () => {
  const typeIn = (text) => {
    const input = screen.getByRole('textbox', { name: 'Message to the assistant' })
    fireEvent.change(input, { target: { value: text } })
    return input
  }

  it('sends with Enter and clears the box', () => {
    const state = setAssistant()
    renderPage()
    const input = typeIn('Raise the price')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(state.sendMessage.mock.calls[0][0]).toBe('Raise the price')
    expect(input).toHaveValue('')
  })

  it('does not send with Shift+Enter or while composing', () => {
    const state = setAssistant()
    renderPage()
    const input = typeIn('Line one')
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    expect(state.sendMessage).not.toHaveBeenCalled()
    expect(input).toHaveValue('Line one')
  })

  it('sends with the primary Send button, disabled while the box is empty', () => {
    const state = setAssistant()
    renderPage()
    const send = screen.getByRole('button', { name: 'Send' })
    expect(send).toBeDisabled()
    expect(send).toHaveAttribute('data-variant', 'primary')
    expect(send).toHaveAttribute('type', 'submit')
    typeIn('Hello')
    expect(send).toBeEnabled()
    fireEvent.click(send)
    expect(state.sendMessage.mock.calls[0][0]).toBe('Hello')
  })

  it('swaps Send for a secondary Stop that stops the answer while it streams', () => {
    const state = setAssistant({ streaming: true })
    renderPage()
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull()
    expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'Waiting for the answer…')
    const stop = screen.getByRole('button', { name: 'Stop' })
    expect(stop).toHaveAttribute('data-variant', 'secondary')
    expect(stop).toHaveAttribute('data-size', 'sm')
    fireEvent.click(stop)
    expect(state.stopMessage).toHaveBeenCalledTimes(1)
  })

  it('shows the page context as chips', () => {
    withStatus({}, { pageEntities: { product: { id: 45, name: 'Pizza Pepperoni' } } })
    renderPage()
    expect(screen.getByText('Context:')).toBeInTheDocument()
    expect(screen.getByText('Pizza Pepperoni')).toBeInTheDocument()
  })

  it('warns near the limit with an info notice and keeps the box', () => {
    withStatus({ usage: { near_limit: true } })
    const { container } = renderPage()
    expect(screen.getByText('There is little assistant use left.').closest('.odc-notice')).toHaveAttribute('data-tone', 'info')
    expect(container.querySelector('.odc-notice[data-tone="info"]')).not.toBeNull()
    expect(screen.getByRole('textbox', { name: 'Message to the assistant' })).toBeInTheDocument()
  })

  it('shows the limit as a warning notice instead of the box', () => {
    withStatus({ usage: { limited: true, near_limit: true, retry_at: null } })
    renderPage()
    const notice = screen.getByText('The assistant reached its usage limit').closest('.odc-notice')
    expect(notice).toHaveAttribute('data-tone', 'warning')
    expect(within(notice).getByText('The assistant reached its usage limit').tagName).toBe('STRONG')
    expect(notice).toHaveTextContent('You can use it again later. Changes waiting for you can still be confirmed.')
    expect(notice.querySelector('svg')).not.toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByText('There is little assistant use left.')).toBeNull()
  })

  it('is exported as a piece of its own with the same logic', () => {
    const state = setAssistant()
    const onSend = vi.fn()
    renderWithProviders(<AssistantComposer value='Hi' onChange={() => {}} onSend={onSend} />, { theme })
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    expect(onSend).toHaveBeenCalledTimes(1)
    expect(state.sendMessage).not.toHaveBeenCalled()
  })
})

describe('data notice', () => {
  const notAccepted = (overrides = {}) => withStatus({ noticeAccepted: false }, overrides)

  it('shows the notice with its title one level under the title and accepts it', () => {
    const state = notAccepted()
    const view = renderPage()
    expect(screen.getByRole('heading', { level: 2, name: 'Before you start' })).toBeInTheDocument()
    expect(screen.getByText(`Notice version ${ASSISTANT_NOTICE_VERSION}`)).toBeInTheDocument()
    const accept = screen.getByRole('button', { name: 'Accept and start' })
    expect(accept).toHaveAttribute('data-variant', 'primary')
    expect(accept).toHaveAttribute('data-size', 'lg')
    fireEvent.click(accept)
    expect(state.acceptNotice).toHaveBeenCalledTimes(1)
    view.unmount()
    renderPanel()
    expect(screen.getByRole('heading', { level: 3, name: 'Before you start' })).toBeInTheDocument()
  })

  it('does not offer to accept without a notice version, and is busy while it saves', () => {
    notAccepted()
    assistant.current.status = { ...assistant.current.status, noticeVersion: null }
    const view = renderPage()
    expect(screen.getByRole('button', { name: 'Accept and start' })).toBeDisabled()
    view.unmount()
    notAccepted({ noticeState: { loading: true, error: null } })
    renderPage()
    const accept = screen.getByRole('button', { name: 'Accept and start' })
    expect(accept).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(accept)
    expect(assistant.current.acceptNotice).not.toHaveBeenCalled()
  })

  it('hides the button and says the notice is being updated when it is outdated', () => {
    notAccepted({ noticeOutdated: true })
    renderPage()
    expect(screen.queryByRole('button', { name: 'Accept and start' })).toBeNull()
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('This notice is being updated. Reload the page in a few minutes to accept it.')
    expect(alert.closest('.odc-notice')).toHaveAttribute('data-tone', 'danger')
  })

  it('says it could not save the answer', () => {
    notAccepted({ noticeState: { loading: false, error: 'failed' } })
    renderPage()
    expect(screen.getByRole('alert')).toHaveTextContent('We couldn\'t save your answer. Try again.')
    expect(screen.getByRole('button', { name: 'Accept and start' })).toBeEnabled()
  })
})

describe('literal guard', () => {
  const dir = path.resolve(__dirname, '..')
  it.each(['AssistantPanel.js', 'AssistantChat.js', 'AssistantComposer.js', 'AssistantNotice.js', 'assistant.css'])(
    'finds no literal color, size or z-index in %s',
    (file) => {
      expect(scanSource(readFileSync(path.join(dir, file), 'utf8'), file)).toEqual([])
    }
  )

  it.each(['AssistantPanel.js', 'AssistantChat.js', 'AssistantComposer.js', 'AssistantNotice.js'])(
    'does not use the old styled-components file in %s',
    (file) => {
      expect(readFileSync(path.join(dir, file), 'utf8')).not.toMatch(/from '\.\/styles'/)
    }
  )
})

// redesign R1-2: the control the user pressed goes away (Propose again while the answer streams, New conversation once the
// chat is empty), so the focus goes to the composer instead of <body>
describe('focus after the control goes away', () => {
  it('moves the focus to the composer after Propose again', () => {
    const { sendMessage } = setAssistant({ items: [{ kind: 'user', key: 'u1', text: 'Hi' }] })
    renderPage()
    const again = screen.getByRole('button', { name: 'Propose again (stand-in)' })
    again.focus()
    fireEvent.click(again)
    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('textbox', { name: 'Message to the assistant' })).toHaveFocus()
  })

  // part 3: the suggestions of the empty state go away once sent, so the composer takes the focus
  it('moves the focus to the composer after a suggestion of the empty state, on the page and in the panel', () => {
    const { sendMessage } = setAssistant()
    const view = renderPage()
    const suggestion = screen.getByRole('button', { name: 'How much did each store sell yesterday?' })
    suggestion.focus()
    fireEvent.click(suggestion)
    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('textbox', { name: 'Message to the assistant' })).toHaveFocus()
    view.unmount()

    renderPanel()
    const inPanel = screen.getByRole('button', { name: 'Which orders are still pending right now?' })
    inPanel.focus()
    fireEvent.click(inPanel)
    expect(screen.getByRole('textbox', { name: 'Message to the assistant' })).toHaveFocus()
  })

  // (review): on a touch screen the composer would open the keyboard over the answer; the conversation takes the focus
  it('on a touch screen gives the focus to the conversation, not to the composer, after a suggestion or Propose again', () => {
    const matchMedia = window.matchMedia
    window.matchMedia = (query) => ({ matches: query === '(pointer: coarse)', media: query, addEventListener () {}, removeEventListener () {}, addListener () {}, removeListener () {} })
    try {
      setAssistant()
      const view = renderPage()
      const suggestion = screen.getByRole('button', { name: 'How much did each store sell yesterday?' })
      suggestion.focus()
      fireEvent.click(suggestion)
      expect(screen.getByRole('textbox', { name: 'Message to the assistant' })).not.toHaveFocus()
      expect(document.activeElement).toHaveClass('odc-as-body')
      view.unmount()

      setAssistant({ items: [{ kind: 'user', key: 'u1', text: 'Hi' }] })
      renderPage()
      const again = screen.getByRole('button', { name: 'Propose again (stand-in)' })
      again.focus()
      fireEvent.click(again)
      expect(document.activeElement).toHaveClass('odc-as-body')
    } finally {
      window.matchMedia = matchMedia
    }
  })

  it('moves the focus to the composer after New conversation, on the page and in the panel', async () => {
    const { newConversation } = setAssistant({ items: [{ kind: 'user', key: 'u1', text: 'Hi' }], conversation: { id: 1, title: 'T' } })
    const view = renderPage()
    const button = screen.getByRole('button', { name: 'New conversation' })
    button.focus()
    fireEvent.click(button)
    expect(newConversation).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Message to the assistant' })).toHaveFocus())
    view.unmount()

    renderPanel()
    const plus = screen.getByRole('button', { name: 'New conversation' })
    plus.focus()
    fireEvent.click(plus)
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Message to the assistant' })).toHaveFocus())
  })
})
