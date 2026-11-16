/* eslint-disable import/first */
import React from 'react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// redesign W0-2 r2 (W0-Q1-07, E5b): the chat of /messages kept `if (sendMessage.loading) clearInputs()`, which emptied
// the box (and the form) when the request STARTED, even when it then failed (same in main). A failed send now gives the
// text and the attachment back, the error shows in the Error dialog, and the same Send retries.
// redesign W0-2 r3 (W0-P2-02): the box still empties when the send starts, as in main; the draft comes back on failure
// only into a box that is still empty. The chat runs the REAL Messages controller; only its contexts, fetch and the
// legacy shell are simulated.
const mocks = vi.hoisted(() => ({ translate: null }))

const t = (key, fallback) => mocks.translate?.(key) ?? fallback ?? key
const sessionState = [{ user: { id: 1, level: 0 }, token: 'token' }]
const utilsState = [{
  parseDate: (value) => `at ${value}`,
  getTimeAgo: (value) => `ago ${value}`,
  optimizeImage: (value) => value,
  getOrderState: (status) => `State ${status}`,
  parsePrice: (value) => `$${value}`
}]

vi.mock('~ui', () => ({ capitalize: (value) => value }))
vi.mock('../../../../../../contexts/SessionContext', () => ({ useSession: () => sessionState }))
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
    useSession: () => sessionState,
    useConfig: () => [{ configs: {} }],
    useUtils: () => utilsState
  }
})

vi.mock('../../../../utils', () => ({ addQueryToUrl: vi.fn() }))

vi.mock('../../../Shared', () => ({
  Alert: () => null,
  Image: ({ src, fallback }) => src ? <img src={src} alt='' /> : fallback,
  Modal: ({ children, open, title }) => open ? <div role='dialog' aria-label={`legacy ${title}`}>{children}</div> : null
}))

vi.mock('../../../../styles', () => ({
  Button: React.forwardRef(function ButtonMock ({ children, ...props }, ref) {
    const domProps = { ...props }
    delete domProps.borderRadius
    delete domProps.circle
    delete domProps.color
    return <button ref={ref} {...domProps}>{children}</button>
  }),
  Input: React.forwardRef(function InputMock (props, ref) {
    return <input ref={ref} {...props} />
  })
}))

vi.mock('react-bootstrap', () => ({
  OverlayTrigger: ({ children }) => children,
  Tooltip: ({ children }) => <span>{children}</span>
}))

vi.mock('../../Logistics', () => ({ Logistics: () => null }))
vi.mock('../../OrderLogisticInformation', () => ({ OrderLogisticInformation: () => null }))

import { Messages } from '..'

const MESSAGES = [
  { id: 3, type: 2, created_at: '2026-10-02 16:00:00', comment: 'Where is my order?', author_id: 5, author: { id: 5, name: 'Ada', level: 3 }, can_see: [0, 2, 3], read: true }
]

// `posts` is the queue of answers to the message POST: a function throws or waits, an object answers.
const mockApi = (posts) => {
  const queue = [...posts]
  global.fetch = vi.fn(async (url, options) => {
    const respond = (result, error = false) => ({ ok: true, json: async () => ({ error, result }) })
    if (options?.method === 'POST') {
      const next = queue.shift()
      if (typeof next === 'function') return next()
      return respond(next.result, next.error)
    }
    if (url.includes('/read?')) return respond([])
    return respond(structuredClone(MESSAGES))
  })
}

const SENT = { error: false, result: { id: 99, type: 2, comment: 'echo', author_id: 1, author: { id: 1, name: 'Me', level: 0 }, can_see: [3], created_at: '2026-10-02 17:00:00' } }

const renderChat = () => renderWithProviders(
  <Messages
    orderId={42}
    isChat
    messageDashboardView
    handleMessageOrderDetail={vi.fn()}
    order={{ id: 42, status: 0, created_at: '2026-09-15T00:00:00Z', app_id: 'web', business: { name: 'Fast Bite' }, customer: { id: 5, name: 'Ada', lastname: 'Lovelace' } }}
  />
)

const postCalls = () => global.fetch.mock.calls.filter(([, options]) => options?.method === 'POST')
const box = () => screen.getByPlaceholderText('Write a message...')
const send = () => screen.getByRole('button', { name: 'send' })

describe('MessagesUI: a failed send keeps the draft (W0-Q1-07)', () => {
  beforeEach(() => {
    mocks.translate = null
    document.getElementById('app-modals')?.remove()
  })

  it('keeps the text, shows the error and sends once when the API refuses', async () => {
    mockApi([{ error: true, result: ['Not allowed'] }])
    renderChat()
    await screen.findByText('Where is my order?')
    await userEvent.type(box(), 'Hello there')
    await userEvent.click(send())
    const alert = await screen.findByRole('alertdialog', { name: 'Error' })
    expect(within(alert).getByText('Not allowed')).toBeInTheDocument()
    expect(box()).toHaveValue('Hello there')
    expect(postCalls()).toHaveLength(1)
  })

  it('keeps the text when the request itself fails (network) and the dialog says Error', async () => {
    mockApi([() => { throw new TypeError('Failed to fetch') }])
    renderChat()
    await screen.findByText('Where is my order?')
    await userEvent.type(box(), 'Hello there')
    await userEvent.click(send())
    const alert = await screen.findByRole('alertdialog', { name: 'Error' })
    expect(within(alert).getByText('Error', { selector: 'p, div, span, li' })).toBeInTheDocument()
    expect(box()).toHaveValue('Hello there')
    expect(postCalls()).toHaveLength(1)
  })

  it('translates the message the API sends as text', async () => {
    mocks.translate = key => key === 'INTERNAL_ERROR' ? 'Error interno' : undefined
    mockApi([{ error: true, result: ['INTERNAL_ERROR'] }])
    renderChat()
    await screen.findByText('Where is my order?')
    await userEvent.type(box(), 'Hello')
    await userEvent.click(send())
    const alert = await screen.findByRole('alertdialog', { name: 'Error' })
    expect(within(alert).getByText('Error interno')).toBeInTheDocument()
    expect(box()).toHaveValue('Hello')
  })

  it('keeps the attachment too, and the same Send retries: one request each, then it empties', async () => {
    mockApi([{ error: true, result: ['Not allowed'] }, SENT])
    const { container } = renderChat()
    await screen.findByText('Where is my order?')
    await userEvent.type(box(), 'Look at this')
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [new File(['x'], 'photo.png', { type: 'image/png' })] } })
    await waitFor(() => expect(container.querySelector('input[type="file"]')).toBeNull())
    await userEvent.click(send())
    const alert = await screen.findByRole('alertdialog', { name: 'Error' })
    await userEvent.click(within(alert).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(box()).toHaveValue('Look at this')
    expect(container.querySelector('input[type="file"]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
    expect(postCalls()).toHaveLength(1)

    await userEvent.click(send())
    await waitFor(() => expect(postCalls()).toHaveLength(2))
    expect(JSON.parse(postCalls()[1][1].body)).toEqual(JSON.parse(postCalls()[0][1].body))
    await waitFor(() => expect(box()).toHaveValue(''))
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe('MessagesUI: a good send empties the draft (W0-Q1-07)', () => {
  beforeEach(() => {
    mocks.translate = null
  })

  it('empties the box and the attachment once it went well, with one request', async () => {
    mockApi([SENT])
    const { container } = renderChat()
    await screen.findByText('Where is my order?')
    await userEvent.type(box(), 'Hello there')
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [new File(['x'], 'photo.png', { type: 'image/png' })] } })
    await screen.findByRole('button', { name: 'Remove' })
    await userEvent.click(send())
    await waitFor(() => expect(box()).toHaveValue(''))
    expect(await screen.findByText('echo')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(postCalls()).toHaveLength(1)
  })

  // redesign W0-2 r3 (W0-P2-02): as in main, the box empties when the send STARTS; what is typed while the request is on
  // the way is new text (the text already sent is not added to it), and it is the only one request of that send.
  it('empties the box when the send starts: what is typed while it is on the way stays alone', async () => {
    let release
    mockApi([() => new Promise(resolve => { release = () => resolve({ ok: true, json: async () => SENT }) })])
    renderChat()
    await screen.findByText('Where is my order?')
    await userEvent.type(box(), 'First')
    await userEvent.click(send())
    await waitFor(() => expect(postCalls()).toHaveLength(1))
    await waitFor(() => expect(box()).toHaveValue(''))
    await userEvent.type(box(), 'and more')
    release()
    await screen.findByText('echo')
    expect(box()).toHaveValue('and more')
    expect(JSON.parse(postCalls()[0][1].body).comment).toBe('First')
    expect(postCalls()).toHaveLength(1)
  })

  it('a send that fails gives the draft back when the box is still empty', async () => {
    let release
    mockApi([() => new Promise(resolve => { release = () => resolve({ ok: true, json: async () => ({ error: true, result: ['Not allowed'] }) }) })])
    renderChat()
    await screen.findByText('Where is my order?')
    await userEvent.type(box(), 'First')
    await userEvent.click(send())
    await waitFor(() => expect(box()).toHaveValue(''))
    release()
    await screen.findByRole('alertdialog', { name: 'Error' })
    expect(box()).toHaveValue('First')
    expect(postCalls()).toHaveLength(1)
  })

  it('a send that fails with text typed meanwhile keeps both: the sent draft, a separator (a space: the box is a single-line <input>) and the new text (W0-QA1-03)', async () => {
    let release
    mockApi([() => new Promise(resolve => { release = () => resolve({ ok: true, json: async () => ({ error: true, result: ['Not allowed'] }) }) })])
    renderChat()
    await screen.findByText('Where is my order?')
    await userEvent.type(box(), 'First')
    await userEvent.click(send())
    await waitFor(() => expect(box()).toHaveValue(''))
    await userEvent.type(box(), 'Something else')
    release()
    await screen.findByRole('alertdialog', { name: 'Error' })
    expect(box()).toHaveValue('First Something else') // redesign tramo A r3 (W0-QA1-03): a space, an <input> drops line breaks
    expect(postCalls()).toHaveLength(1)
  })

  // redesign tramo A r3 (W0-QA1-03): an attachment chosen while the send was on the way is the new one; a failed send does
  // not put the old one back over it (the retry sends the new file, once).
  it('a send that fails with a new attachment chosen meanwhile keeps the new one', async () => {
    let release
    mockApi([() => new Promise(resolve => { release = () => resolve({ ok: true, json: async () => ({ error: true, result: ['Not allowed'] }) }) }), SENT])
    const { container } = renderChat()
    await screen.findByText('Where is my order?')
    await userEvent.type(box(), 'Look')
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [new File(['old'], 'old.png', { type: 'image/png' })] } })
    await waitFor(() => expect(container.querySelector('input[type="file"]')).toBeNull())
    await userEvent.click(send())
    await waitFor(() => expect(postCalls()).toHaveLength(1))
    await waitFor(() => expect(container.querySelector('input[type="file"]')).not.toBeNull())
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [new File(['new'], 'new.png', { type: 'image/png' })] } })
    await waitFor(() => expect(container.querySelector('input[type="file"]')).toBeNull())
    release()
    const alert = await screen.findByRole('alertdialog', { name: 'Error' })
    await userEvent.click(within(alert).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(box()).toHaveValue('Look')
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
    await userEvent.click(send())
    await waitFor(() => expect(postCalls()).toHaveLength(2))
    expect(JSON.parse(postCalls()[1][1].body).file).toBe('data:image/png;base64,bmV3') // «new»
  })

  it('a send that fails with text typed meanwhile in several pieces keeps them in order after the sent draft', async () => {
    let release
    mockApi([() => new Promise(resolve => { release = () => resolve({ ok: true, json: async () => ({ error: true, result: ['Not allowed'] }) }) })])
    renderChat()
    await screen.findByText('Where is my order?')
    await userEvent.type(box(), 'First')
    await userEvent.click(send())
    await waitFor(() => expect(box()).toHaveValue(''))
    await userEvent.type(box(), 'a b')
    release()
    await screen.findByRole('alertdialog', { name: 'Error' })
    expect(box()).toHaveValue('First a b')
  })

  // redesign W0-2 r3 (W0-Q2-04): «Send» is disabled while it sends and takes the focus with it (the browser leaves it on
  // <body>; jsdom does not, so the test drops it as the browser does). Closing the alert puts the focus in the message box.
  it('after a failed send from «Send», closing the alert gives the focus to the message box', async () => {
    let release
    mockApi([() => new Promise(resolve => { release = () => resolve({ ok: true, json: async () => ({ error: true, result: ['Not allowed'] }) }) })])
    renderChat()
    await screen.findByText('Where is my order?')
    await userEvent.type(box(), 'First')
    const sendButton = send()
    sendButton.focus()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(postCalls()).toHaveLength(1))
    const sending = document.activeElement
    expect(sending).toBe(sendButton) // still on «Send», which is now disabled
    sending.removeAttribute('disabled') // jsdom keeps the focus on a disabled button; the browser drops it
    sending.blur()
    sending.setAttribute('disabled', '')
    expect(document.body).toHaveFocus()
    release()
    const alert = await screen.findByRole('alertdialog', { name: 'Error' })
    await userEvent.click(within(alert).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(box()))
    expect(postCalls()).toHaveLength(1)
  })
})
