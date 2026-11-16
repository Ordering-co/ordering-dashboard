/* eslint-disable import/first */
import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// redesign W0-2 r2 (W0-Q1-07, E5): a failed send gives the text and the attachment back (main, and the pilot, lost them
// when the request failed). The error shows inline, translated, and the same Send retries.
// redesign W0-2 r3 (W0-P2-02): the box empties when the send starts, as in main; the draft comes back on failure only
// into a box that is still empty. The chat runs the REAL Messages controller; only its contexts and fetch are simulated.
const mocks = vi.hoisted(() => ({ translate: null }))

const t = (key, fallback) => mocks.translate?.(key) ?? fallback ?? key
const sessionState = () => [{ user: { id: 1, level: 0 }, token: 'token' }]
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
  { id: 3, type: 2, created_at: '2026-10-02 16:00:00', comment: 'Where is my order?', author_id: 5, author: { id: 5, name: 'Ada', level: 3 }, can_see: [0, 2, 3], read: true }
]

// `posts` is the queue of answers to the message POST: a function throws (network), an object answers.
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
  <ChatTab
    order={{ order: { id: 42, status: 7, customer_id: 5, customer: { id: 5, name: 'Ada', lastname: 'Lovelace' }, business: { name: 'Fast Bite' }, driver: null }, loading: false }}
    messages={{ messages: [] }}
    handleUpdateOrderForUnreadCount={vi.fn()}
    onClose={vi.fn()}
    isTourOpen={false}
    setCurrentTourStep={vi.fn()}
    onSelectTab={vi.fn()}
  />
)

const postCalls = () => global.fetch.mock.calls.filter(([, options]) => options?.method === 'POST')
const box = () => screen.getByRole('textbox', { name: 'Write a message...' })
const send = () => screen.getByRole('button', { name: 'Send' })

describe('ChatTab: a failed send keeps the draft (W0-Q1-07)', () => {
  beforeEach(() => {
    mocks.translate = null
  })

  it('keeps the text, shows the error inline and sends once when the API refuses', async () => {
    mockApi([{ error: true, result: ['Not allowed'] }])
    renderChat()
    await screen.findByText('Where is my order?')
    await userEvent.type(box(), 'Hello there')
    await userEvent.click(send())
    expect(await screen.findByRole('alert')).toHaveTextContent('Not allowed')
    expect(box()).toHaveValue('Hello there')
    expect(postCalls()).toHaveLength(1)
    expect(document.activeElement).not.toBe(document.body)
  })

  it('keeps the text when the request itself fails (network), with the generic Error', async () => {
    mockApi([() => { throw new TypeError('Failed to fetch') }])
    renderChat()
    await screen.findByText('Where is my order?')
    await userEvent.type(box(), 'Hello there')
    await userEvent.click(send())
    expect(await screen.findByRole('alert')).toHaveTextContent('Error')
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
    expect(await screen.findByRole('alert')).toHaveTextContent('Error interno')
    expect(box()).toHaveValue('Hello')
  })

  it('says Error when the API refuses without saying why', async () => {
    mockApi([{ error: true, result: null }])
    renderChat()
    await screen.findByText('Where is my order?')
    await userEvent.type(box(), 'Hello')
    await userEvent.click(send())
    expect(await screen.findByRole('alert')).toHaveTextContent('Error')
    expect(box()).toHaveValue('Hello')
  })

  it('keeps the attachment too, and the same Send retries: one request each, then it empties', async () => {
    mockApi([{ error: true, result: ['Not allowed'] }, SENT])
    const { container } = renderChat()
    await screen.findByText('Where is my order?')
    await userEvent.type(box(), 'Look at this')
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [new File(['x'], 'photo.png', { type: 'image/png' })] } })
    await screen.findByRole('img', { name: 'Image' })
    await userEvent.click(send())
    await screen.findByRole('alert')
    expect(box()).toHaveValue('Look at this')
    expect(screen.getByRole('img', { name: 'Image' })).toBeInTheDocument()
    expect(postCalls()).toHaveLength(1)

    await userEvent.click(send())
    await waitFor(() => expect(postCalls()).toHaveLength(2))
    expect(JSON.parse(postCalls()[1][1].body)).toEqual(JSON.parse(postCalls()[0][1].body))
    await waitFor(() => expect(box()).toHaveValue(''))
    expect(screen.queryByRole('img', { name: 'Image' })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('ChatTab: a good send empties the draft (W0-Q1-07)', () => {
  it('empties the box and the attachment once it went well, with one request', async () => {
    mockApi([SENT])
    const { container } = renderChat()
    await screen.findByText('Where is my order?')
    await userEvent.type(box(), 'Hello there')
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [new File(['x'], 'photo.png', { type: 'image/png' })] } })
    await screen.findByRole('img', { name: 'Image' })
    await userEvent.click(send())
    await waitFor(() => expect(box()).toHaveValue(''))
    expect(await screen.findByText('echo')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Image' })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
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
    expect(await screen.findByRole('alert')).toHaveTextContent('Not allowed')
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
    expect(await screen.findByRole('alert')).toHaveTextContent('Not allowed')
    expect(box()).toHaveValue('First Something else') // redesign tramo A r3 (W0-QA1-03): a space, an <input> drops line breaks
    expect(postCalls()).toHaveLength(1)
  })

  // redesign tramo A r4 (W0-QA2-05): the join is ONE space even when the new text starts with one (r3 left «First  + more»)
  it('a send that fails with new text that starts with a space joins with one space, and keeps the inside of both', async () => {
    let release
    mockApi([() => new Promise(resolve => { release = () => resolve({ ok: true, json: async () => ({ error: true, result: ['Not allowed'] }) }) })])
    renderChat()
    await screen.findByText('Where is my order?')
    await userEvent.type(box(), 'Uno  1')
    await userEvent.click(send())
    await waitFor(() => expect(box()).toHaveValue(''))
    await userEvent.type(box(), '  + mas  y')
    release()
    await screen.findByRole('alert')
    expect(box()).toHaveValue('Uno  1 + mas  y')
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
    await screen.findByRole('img', { name: 'Image' })
    await userEvent.click(send())
    await waitFor(() => expect(postCalls()).toHaveLength(1))
    await waitFor(() => expect(screen.queryByRole('img', { name: 'Image' })).not.toBeInTheDocument())
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [new File(['new'], 'new.png', { type: 'image/png' })] } })
    await screen.findByRole('img', { name: 'Image' })
    release()
    await screen.findByRole('alert')
    expect(box()).toHaveValue('Look')
    expect(screen.getByRole('img', { name: 'Image' })).toBeInTheDocument()
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
    await screen.findByRole('alert')
    expect(box()).toHaveValue('First a b')
  })

  // redesign W0-2 r3 (W0-P2-10): an error that comes as a list of lists is flattened one level, as /messages does
  it('shows the lines of an API error that came as a list of lists', async () => {
    mockApi([{ error: true, result: [['First line', 'Second line']] }])
    renderChat()
    await screen.findByText('Where is my order?')
    await userEvent.type(box(), 'Hello')
    await userEvent.click(send())
    expect(await screen.findByRole('alert')).toHaveTextContent('First line Second line')
    expect(box()).toHaveValue('Hello')
  })
})
