/* eslint-disable import/first */
import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// Batch 5.4-B · the image preview of the chat tab: a `lg` Product Dialog whose image is described by its
// file name or its author and whose title is kept for assistive technology but not drawn. Same harness
// as ChatTab.test.jsx: the REAL Messages controller, only its contexts and fetch are simulated.
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

const photo = (id, source) => ({ id, type: 3, created_at: '2026-10-02 16:05:00', author_id: 5, author: { id: 5, name: 'Ada', level: 3 }, can_see: [0, 2, 3], read: true, source })

const mockApi = (messages) => {
  global.fetch = vi.fn(async (url, options) => {
    const respond = (result, error = false) => ({ ok: true, json: async () => ({ error, result }) })
    if (options?.method === 'POST') return respond({})
    if (url.includes('/read?')) return respond([])
    return respond(structuredClone(messages))
  })
}

const order = {
  id: 42,
  status: 7,
  customer_id: 5,
  customer: { id: 5, name: 'Ada', lastname: 'Lovelace' },
  business: { name: 'Fast Bite' },
  driver: null
}

const renderChat = () => renderWithProviders(
  <ChatTab
    order={{ order, loading: false }}
    messages={{ messages: [] }}
    handleUpdateOrderForUnreadCount={vi.fn()}
    onClose={vi.fn()}
    isTourOpen={false}
    setCurrentTourStep={vi.fn()}
    onSelectTab={vi.fn()}
  />
)

beforeEach(() => { mocks.user = { id: 1, level: 0 } })
afterEach(() => document.getElementById('app-modals')?.remove())

describe('ChatTab · image preview', () => {
  it('opens a large dialog named Image preview, with a hosted image described by its file name', async () => {
    mockApi([photo(1, 'https://cdn.test/uploads/door%20photo.png?v=2')])
    renderChat()
    await userEvent.click(await screen.findByRole('button', { name: 'Click to expand' }))
    const dialog = await screen.findByRole('dialog', { name: 'Image preview' })
    expect(dialog).toHaveAttribute('data-size', 'lg')
    expect(within(dialog).getByRole('img', { name: 'door photo.png' })).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: 'Open original image' })).toHaveAttribute('href', 'https://cdn.test/uploads/door%20photo.png?v=2')
  })

  it('describes an image with no file name by who sent it', async () => {
    mockApi([photo(1, 'data:image/png;base64,AA')])
    renderChat()
    await userEvent.click(await screen.findByRole('button', { name: 'Click to expand' }))
    const dialog = await screen.findByRole('dialog', { name: 'Image preview' })
    expect(within(dialog).getByRole('img', { name: 'Image from Ada' })).toBeInTheDocument()
  })

  it('keeps the title for assistive technology and does not draw it', async () => {
    mockApi([photo(1, 'data:image/png;base64,AA')])
    renderChat()
    await userEvent.click(await screen.findByRole('button', { name: 'Click to expand' }))
    const dialog = await screen.findByRole('dialog', { name: 'Image preview' })
    expect(dialog).toHaveClass('odc-image-dialog')
    expect(within(dialog).getByRole('heading', { name: 'Image preview' })).toBeInTheDocument()
  })

  it('Escape closes it and gives the focus back to the thumbnail', async () => {
    mockApi([photo(1, 'data:image/png;base64,AA')])
    renderChat()
    const thumb = await screen.findByRole('button', { name: 'Click to expand' })
    await userEvent.click(thumb)
    await screen.findByRole('dialog', { name: 'Image preview' })
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(thumb).toHaveFocus()
  })
})
