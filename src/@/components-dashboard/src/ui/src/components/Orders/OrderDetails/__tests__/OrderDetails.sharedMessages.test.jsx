/* eslint-disable import/first */
// parity audit 2 (B1, B8): the panel runs ONE Messages controller for the route (Details), Activity and Chat. These
// tests run the real panel, tabs, Messages controller and Socket wrapper; only the contexts, the server (a fake
// socket.io that only delivers to the rooms that were joined) and fetch are simulated.
import React from 'react'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({ user: { id: 1, level: 0 }, socket: null, io: null }))

vi.mock('socket.io-client', () => ({ default: () => mocks.io }))
vi.mock('~ui', () => ({ capitalize: (value) => value }))

const t = (_key, fallback) => fallback ?? _key
const sessionState = () => [{ user: mocks.user, token: 'token' }]
const utilsState = [{
  parseDate: (value) => `at ${value}`,
  getTimeAgo: (value) => `ago ${value}`,
  optimizeImage: (value) => value,
  parseNumber: (value) => value,
  getOrderState: (status) => `State ${status}`,
  parsePrice: (value) => `$${value}`
}]

vi.mock('../../../../../../contexts/SessionContext', () => ({ useSession: () => sessionState() }))
vi.mock('../../../../../../contexts/ApiContext', () => ({ useApi: () => [{ root: 'https://api.test' }] }))
vi.mock('../../../../../../contexts/WebsocketContext', () => ({ useWebsocket: () => mocks.socket }))
vi.mock('../../../../../../contexts/ConfigContext', () => ({ useConfig: () => [{ configs: {} }] }))
vi.mock('../../../../../../contexts/LanguageContext', () => ({ useLanguage: () => [{}, t] }))
vi.mock('../../../../../../contexts/UtilsContext', () => ({ useUtils: () => utilsState }))

// Logistics are not under test here: the activity feed gets the history and no logs.
vi.mock('../../../../../../index', async () => {
  const { Messages } = await vi.importActual('../../../../../../components/Messages')
  return {
    Messages,
    Logistics: ({ UIComponent, ...props }) => <UIComponent {...props} logisticList={{ loading: false, error: null, logs: [] }} getLogistics={() => {}} />,
    LogisticInformation: () => null,
    OrderDetails: ({ UIComponent, ...props }) => <UIComponent {...props} />,
    useLanguage: () => [{}, t],
    useSession: () => sessionState(),
    useConfig: () => [{ configs: {} }],
    useUtils: () => utilsState,
    useApi: () => [{ root: 'https://api.test' }],
    useOrder: () => [{ loading: false }],
    GoogleAutocompleteInput: () => null,
    GoogleMapsMap: () => null
  }
})

vi.mock('../../../../utils', async (importOriginal) => ({
  ...(await importOriginal()),
  addQueryToUrl: vi.fn(),
  removeQueryToUrl: vi.fn()
}))
vi.mock('react-hook-form', () => ({
  useForm: () => ({ register: vi.fn(), handleSubmit: fn => fn, formState: { errors: {} } })
}))
vi.mock('../../OrderDetailsHeader', () => ({ OrderDetailsHeader: () => <div data-testid='header' /> }))
vi.mock('../DetailsFooter', () => ({ DetailsFooter: () => <div data-testid='footer' /> }))
vi.mock('../../CloneOrder', () => ({ CloneOrder: () => null }))
vi.mock('../../OrderToPrint', () => ({ OrderToPrint: React.forwardRef(function OrderToPrintMock () { return null }) }))
vi.mock('../../OrderToPrintTicket', () => ({ OrderToPrintTicket: React.forwardRef(function OrderToPrintTicketMock () { return null }) }))
vi.mock('../../OrderContactInformation', () => ({ OrderContactInformation: () => null }))
vi.mock('../../OrderBill', () => ({ OrderBill: () => null }))
vi.mock('../../ProductItemAccordion', () => ({ ProductItemAccordion: () => null }))
vi.mock('../../../Shared', () => ({
  Modal: ({ children, open }) => open ? <div role='dialog'>{children}</div> : null,
  Alert: () => null,
  Confirm: () => null,
  FeeBillRows: () => null,
  TaxBillRows: () => null
}))
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: 1280, height: 800 }) }))

import { Socket } from '../../../../../../contexts/WebsocketContext/socket'
import { OrderDetails } from '..'

const ROOM = 'cityeat_messages_orders_42_0'

// A server that only delivers a message to a socket that is in the room.
const createServer = () => {
  const listeners = {}
  const rooms = new Set()
  const io = {
    connected: true,
    rooms,
    emit: vi.fn((event, room) => {
      if (event === 'join') rooms.add(typeof room === 'string' ? room : JSON.stringify(room))
      if (event === 'leave') rooms.delete(typeof room === 'string' ? room : JSON.stringify(room))
    }),
    on: vi.fn((event, fn) => { (listeners[event] = listeners[event] || new Set()).add(fn) }),
    off: vi.fn((event, fn) => { listeners[event]?.delete(fn) }),
    close: vi.fn(),
    fire (event, ...args) { [...(listeners[event] || [])].forEach(fn => fn(...args)) },
    deliver (room, message) { if (rooms.has(room)) io.fire('message', message) }
  }
  return io
}

const HISTORY = [
  { id: 1, type: 0, created_at: '2026-10-02 15:51:00', app_id: 'web', author_id: 5, author: { name: 'Customer', lastname: 'Demo' } },
  { id: 3, type: 2, created_at: '2026-10-02 16:00:00', comment: 'Where is my order?', author_id: 5, author: { id: 5, name: 'Ada', level: 3 }, can_see: [0, 2, 3], read: true }
]

const order = {
  id: 42,
  status: 7,
  customer_id: 5,
  delivery_type: 1,
  created_at: '2026-10-02 15:51:00',
  currency: 'USD',
  products: [],
  summary: { total: 0 },
  business: { name: 'Fast Bite' },
  customer: { id: 5, name: 'Ada', lastname: 'Lovelace' },
  driver: null
}

const messageGets = () => global.fetch.mock.calls.filter(([url, options]) => /\/orders\/42\/messages(\?|$)/.test(url) && (options?.method ?? 'GET') === 'GET')

const renderPanel = (props = {}, search = '') => renderWithProviders(
  <OrderDetails
    open
    layout='split'
    order={{ loading: false, order }}
    messages={{ messages: [] }}
    customerInfoState={{ customer: {}, loading: false }}
    handleChangeCustomerInfoState={vi.fn()}
    handleUpdateCustomerInfo={vi.fn()}
    addressState={{}}
    setAddressState={vi.fn()}
    setCommentInfostate={vi.fn()}
    commentInfoState={{ open: false, driverId: null }}
    setIsTourFlag={vi.fn()}
    handleCloneOrder={vi.fn()}
    setCloneState={vi.fn()}
    cloneState={{ type: 1, loading: false }}
    setCurrentTourStep={vi.fn()}
    setIsTourOpen={vi.fn()}
    handleUpdateOrderForUnreadCount={vi.fn()}
    onClose={vi.fn()}
    {...props}
  />,
  { initialEntries: [`/orders${search}`] }
)

const openTab = async (user, name) => {
  await user.click(screen.getByRole('tab', { name }))
  await waitFor(() => expect(screen.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true'))
}

const chatLog = () => within(document.querySelector('.odc-od-chat-pane')).queryByRole('log', { name: 'Messages' })

describe('OrderDetails · one Messages controller for the route, Activity and Chat', () => {
  // FL-3: the panel is a lazy chunk (OrderDetailsLazy), so the first render shows the skeleton until the module graph of
  // OrderDetailsPanel is imported and transformed. That is heavy (about 0.5 s alone, past the 1 s `findBy` limit on a loaded
  // machine). Loading it once up front moves that cost out of the test; the assertions and their limits are untouched.
  beforeAll(async () => { await import('../OrderDetailsPanel') }, 60_000)

  beforeEach(() => {
    mocks.user = { id: 1, level: 0 }
    mocks.io = createServer()
    mocks.socket = new Socket({ url: 'wss://socket.test', project: 'cityeat', accessToken: 'token' })
    mocks.socket.connect()
    global.fetch = vi.fn(async (url) => {
      const respond = (result, error = false) => ({ ok: true, json: async () => ({ error, result }) })
      if (/\/messages(\?|$)/.test(url)) return respond(structuredClone(HISTORY))
      return respond([])
    })
  })
  afterEach(() => { document.getElementById('app-modals')?.remove() })

  it('opening an order asks for its messages once, and so do Activity and Chat afterwards', async () => {
    const user = userEvent.setup()
    renderPanel()
    // fila 48: the first mount of the lazy panel in this file is cold (1.2 s with the module already imported, on a loaded
    // machine), past the 1 s `findBy` default; the wait is for the same tab, only longer.
    await screen.findByRole('tab', { name: 'Details' }, { timeout: 10_000 })
    await waitFor(() => expect(messageGets()).toHaveLength(1))

    await openTab(user, 'Activity')
    await openTab(user, 'Chat')
    await openTab(user, 'Details')
    await act(async () => {})
    expect(messageGets()).toHaveLength(1)
    expect(messageGets()[0][0]).toBe('https://api.test/orders/42/messages?mode=dashboard')
  })

  it('opening on Activity (a deep link) asks once too', async () => {
    renderPanel({}, '?id=42&section=history')
    await screen.findByRole('tab', { name: 'Activity' })
    await act(async () => {})
    expect(messageGets()).toHaveLength(1)
  })

  it('a level without chat (5) still asks once, for the route and the history', async () => {
    mocks.user = { id: 1, level: 5 }
    renderPanel()
    await screen.findByRole('tab', { name: 'Details' })
    await act(async () => {})
    expect(screen.queryByRole('tab', { name: 'Chat' })).not.toBeInTheDocument()
    expect(messageGets()).toHaveLength(1)
  })

  it('the chat keeps receiving live messages after Details → Chat → Details → Chat', async () => {
    const user = userEvent.setup()
    renderPanel()
    await screen.findByRole('tab', { name: 'Details' })
    await waitFor(() => expect(mocks.io.rooms.has(ROOM)).toBe(true))

    await openTab(user, 'Chat')
    await openTab(user, 'Details')
    await openTab(user, 'Chat')
    await openTab(user, 'Details')
    await openTab(user, 'Chat')

    // The server still has the socket in the room, so it delivers.
    expect(mocks.io.rooms.has(ROOM)).toBe(true)
    expect(mocks.io.emit.mock.calls.filter(([event]) => event === 'leave')).toEqual([])
    await waitFor(() => expect(chatLog()).toBeInTheDocument())
    expect(within(chatLog()).queryByText('Live reply')).not.toBeInTheDocument()

    act(() => {
      mocks.io.deliver(ROOM, { id: 100, order_id: 42, type: 2, comment: 'Live reply', created_at: '2026-10-02 17:00:00', author_id: 5, author: { id: 5, name: 'Ada', level: 3 }, can_see: [0, 2, 3] })
    })
    expect(await within(chatLog()).findByText('Live reply')).toBeInTheDocument()

    // And the route and the history read the same list: back on Details and on Activity nothing is fetched again.
    await openTab(user, 'Activity')
    expect(messageGets()).toHaveLength(1)
  })

  it('closing the panel leaves the room', async () => {
    const view = renderPanel()
    await screen.findByRole('tab', { name: 'Details' })
    await waitFor(() => expect(mocks.io.rooms.has(ROOM)).toBe(true))
    view.unmount()
    expect(mocks.io.rooms.has(ROOM)).toBe(false)
  })
})
