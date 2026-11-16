/* eslint-disable import/first */
// redesign messages B3a: the conversation list of the /messages inbox (decisions 2A, 3A, 6A and 7A).
// The dates run through the real UtilsContext (the API writes UTC without a zone: W1-QB1-01), the statuses through the real
// getOrderStatusPrefix. The controller is a fake that records the props it is given, except in the last describe, where the
// real DashboardOrdersList runs over a fake XMLHttpRequest to prove that a scope or sort change asks for page 1.
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  configs: {},
  config: [{ loading: false, configs: {} }],
  language: null,
  realController: false,
  controllerCalls: [],
  controllerState: {},
  entry: '/messages',
  tracked: null,
  addQuery: null,
  session: [{ token: 'test-token', loading: false, user: { level: 0 } }],
  socket: { on: () => {}, off: () => {}, join: () => {}, leave: () => {} },
  events: [{ on: () => {}, off: () => {}, emit: () => {} }]
}))
mocks.language = [{ dictionary: {} }, (_key, fallback) => fallback]
mocks.tracked = vi.fn()
mocks.addQuery = vi.fn()

// redesign messages R1 (P-01, P-02): the analytics hook and the URL writer are recorded, not run
vi.mock('~/analytics/useTrackedLoadState', () => ({ useTrackedLoadState: (...args) => mocks.tracked(...args) }))
vi.mock('../../../../utils', async (importActual) => ({ ...(await importActual()), addQueryToUrl: (...args) => mocks.addQuery(...args) }))

vi.mock('../../../../../../index', async () => {
  const { useUtils } = await vi.importActual('../../../../../../contexts/UtilsContext')
  const { DashboardOrdersList: RealController } = await vi.importActual('../../../../../../components/DashboardOrdersList')
  const FakeController = ({ UIComponent, ...props }) => {
    mocks.controllerCalls.push({ UIComponent, ...props })
    return <UIComponent {...props} {...mocks.controllerState} />
  }
  return {
    useUtils,
    useLanguage: () => mocks.language,
    useConfig: () => mocks.config,
    DashboardOrdersList: (props) => mocks.realController ? <RealController {...props} /> : <FakeController {...props} />
  }
})
vi.mock('../../../../../../contexts/ConfigContext', () => ({ useConfig: () => mocks.config }))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: true, language: undefined }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../contexts/SessionContext', () => ({ useSession: () => mocks.session }))
vi.mock('../../../../../../contexts/WebsocketContext', () => ({ useWebsocket: () => mocks.socket }))
vi.mock('../../../../../../contexts/EventContext', () => ({ useEvent: () => mocks.events }))
vi.mock('../../../../../../contexts/ApiContext', async () => {
  const { Ordering } = await import('../../../../../../sdk/lib/index')
  const apiState = [new Ordering({ url: 'https://api.test', version: 'v400', language: 'en', project: 'demo' })]
  return { useApi: () => apiState }
})

import { UtilsProviders } from '../../../../../../contexts/UtilsContext'
import { ConfigFileContext } from '../../../../contexts/ConfigFileContext'
import { ConversationList, ConversationListUI } from '../ConversationList'
import { ACTIVE_ORDER_STATUSES, ALL_ORDER_STATUSES, CHAT_ENDED_STATUSES } from '../conversationScope'

const NOW = '2026-10-08T12:00:00Z'
const originalTZ = process.env.TZ
const RealXhr = window.XMLHttpRequest
const requests = []

const setZone = (tz, offsetMinutes) => {
  process.env.TZ = tz
  expect(new Date(NOW).getTimezoneOffset()).toBe(offsetMinutes) // fails loud when the zone was not applied
}

beforeEach(() => {
  setZone('America/Chicago', 300) // CDT, -5
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(NOW))
  mocks.configs = {}
  mocks.config = [{ loading: false, configs: mocks.configs }]
  mocks.realController = false
  mocks.controllerCalls.length = 0
  mocks.controllerState = {}
  mocks.entry = '/messages'
  mocks.tracked.mockClear()
  mocks.addQuery.mockClear()
  requests.length = 0
  window.matchMedia = vi.fn((query) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }))
  vi.stubGlobal('ResizeObserver', class { observe () {} unobserve () {} disconnect () {} })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  delete window.matchMedia
  window.XMLHttpRequest = RealXhr
  if (originalTZ === undefined) delete process.env.TZ
  else process.env.TZ = originalTZ
})

const setConfigs = (configs) => {
  mocks.configs = configs
  mocks.config = [{ loading: false, configs }]
}

// the wired list reads the query (P-02), so it lives inside a router
const Providers = ({ children }) => (
  <MemoryRouter initialEntries={[mocks.entry]}>
    <UtilsProviders>
      <ConfigFileContext.Provider value={[{ app_internal_name: 'ordering' }]}>
        {children}
      </ConfigFileContext.Provider>
    </UtilsProviders>
  </MemoryRouter>
)

const makeOrder = (id, extra = {}) => ({
  id,
  status: 7,
  delivery_type: 1,
  customer: { name: 'Ada', lastname: 'Lovelace' },
  business: { name: 'Fast Bite' },
  last_direct_message_at: '2026-10-08 11:55:00',
  unread_direct_count: 0,
  unread_count: 0,
  ...extra
})

const list = (orders, extra = {}) => ({ loading: false, error: null, orders, ...extra })

const uiProps = (extra = {}) => ({
  orderList: list([makeOrder(42)]),
  pagination: { currentPage: 1, pageSize: 10, total: 1 },
  getPageOrders: vi.fn(),
  scope: 'active',
  onScopeChange: vi.fn(),
  sort: 'last_direct_message_at',
  onSortChange: vi.fn(),
  selectedId: null,
  onSelect: vi.fn(),
  onOrdersChange: vi.fn(),
  autoSelectFirst: false,
  showBusiness: false,
  searchValue: null,
  filterValues: {},
  outsideMessages: 0,
  arrival: null,
  ...extra
})

const renderUI = (extra = {}) => {
  const props = uiProps(extra)
  const view = render(<Providers><ConversationListUI {...props} /></Providers>)
  return {
    props,
    ...view,
    update: (next = {}) => view.rerender(<Providers><ConversationListUI {...props} {...next} /></Providers>)
  }
}

const rowButton = (name) => screen.getByRole('button', { name })
const live = (container) => container.querySelector('.odc-conv-live')
const ISO = /\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2})?/

describe('ConversationListUI · head', () => {
  it('names the pane «Conversations» as a heading', () => {
    renderUI()
    expect(screen.getByRole('heading', { level: 2, name: 'Conversations' })).toBeInTheDocument()
  })

  it('shows the scope as a «Show» control with Active and All, the current one pressed', () => {
    renderUI({ scope: 'all' })
    const group = screen.getByRole('group', { name: 'Show' })
    expect(within(group).getByRole('button', { name: 'Active' })).toHaveAttribute('aria-pressed', 'false')
    expect(within(group).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('asks the host for the other scope', async () => {
    const user = userEvent.setup()
    const { props } = renderUI({ scope: 'active' })
    await user.click(screen.getByRole('button', { name: 'All' }))
    expect(props.onScopeChange).toHaveBeenCalledTimes(1)
    expect(props.onScopeChange).toHaveBeenCalledWith('all')
  })

  it('shows the current sort in the trigger of the «Sort by» menu, named with both', () => {
    const { unmount } = renderUI({ sort: 'last_direct_message_at' })
    expect(screen.getByRole('button', { name: 'Sort by: Newest message' })).toHaveTextContent('Newest message')
    unmount()
    renderUI({ sort: 'id' })
    expect(screen.getByRole('button', { name: 'Sort by: Order number' })).toHaveTextContent('Order number')
  })

  it('offers the two sorts as radios, the current one checked, and reports the other', async () => {
    const user = userEvent.setup()
    const { props } = renderUI({ sort: 'last_direct_message_at' })
    await user.click(screen.getByRole('button', { name: 'Sort by: Newest message' }))
    const menu = await screen.findByRole('menu')
    const radios = within(menu).getAllByRole('menuitemradio')
    expect(radios.map(item => item.textContent)).toEqual(['Newest message', 'Order number'])
    expect(radios.map(item => item.getAttribute('aria-checked'))).toEqual(['true', 'false'])
    await user.click(within(menu).getByRole('menuitemradio', { name: 'Order number' }))
    expect(props.onSortChange).toHaveBeenCalledTimes(1)
    expect(props.onSortChange).toHaveBeenCalledWith('id')
  })
})

describe('ConversationListUI · rows', () => {
  it('draws the customer, the order number in mono, the relative time, the status and the unread count in one row', () => {
    renderUI({ orderList: list([makeOrder(42, { unread_direct_count: 3 })]) })
    const row = rowButton('Ada Lovelace, Order number 42, 3 unread messages')
    expect(within(row).getByText('Ada Lovelace')).toBeInTheDocument()
    const figure = row.querySelector('.odc-figure')
    expect(figure).toHaveTextContent(/^42$/)
    expect(figure.parentElement.textContent).toMatch(/·\s*#42$/)
    expect(within(row).getByText('5 minutes ago')).toBeInTheDocument()
    const status = within(row).getByText('Accepted by business').closest('.odc-status')
    expect(status).toHaveAttribute('data-family', 'progress')
    expect(row.querySelector('.odc-count')).toHaveTextContent(/^3$/)
  })

  it('is a list of items, each with one native button of type button', () => {
    renderUI({ orderList: list([makeOrder(1), makeOrder(2), makeOrder(3)]) })
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(3)
    items.forEach(item => {
      const buttons = item.querySelectorAll('button')
      expect(buttons).toHaveLength(1)
      expect(buttons[0]).toHaveAttribute('type', 'button')
    })
  })

  it('shows the family of each status', () => {
    renderUI({ orderList: list([makeOrder(1, { status: 0 }), makeOrder(2, { status: 11 }), makeOrder(3, { status: 2 }), makeOrder(4, { status: 14 })]) })
    const family = (id) => rowButton(new RegExp(`Order number ${id}\\b`)).querySelector('.odc-status').getAttribute('data-family')
    expect([1, 2, 3, 4].map(family)).toEqual(['pending', 'done', 'cancel', 'review'])
  })

  it('says «Reservation» for a reservation that is a preorder, as the cards do', () => {
    renderUI({ orderList: list([makeOrder(5, { delivery_type: 9, status: 13 }), makeOrder(6, { delivery_type: 1, status: 13 })]) })
    expect(within(rowButton(/Order number 5\b/)).getByText('Reservation')).toBeInTheDocument()
    expect(within(rowButton(/Order number 6\b/)).getByText('Preorder')).toBeInTheDocument()
  })

  it('draws the business only when the host asks for it', () => {
    const { unmount } = renderUI({ showBusiness: true })
    expect(within(rowButton(/Order number 42/)).getByText('Fast Bite')).toBeInTheDocument()
    unmount()
    renderUI({ showBusiness: false })
    expect(screen.queryByText('Fast Bite')).toBeNull()
  })

  it('counts the messages of people first (unread_direct_count), and unread_count only when it is undefined', () => {
    renderUI({
      orderList: list([
        makeOrder(1, { unread_direct_count: 2, unread_count: 8 }),
        makeOrder(2, { unread_direct_count: undefined, unread_count: 5 }),
        makeOrder(3, { unread_direct_count: 0, unread_count: 4 }),
        makeOrder(4, { unread_direct_count: 0, unread_count: 0 })
      ])
    })
    const countOf = (id) => rowButton(new RegExp(`Order number ${id}\\b`)).querySelector('.odc-count')?.textContent ?? null
    expect([1, 2, 3, 4].map(countOf)).toEqual(['2', '5', null, null])
  })

  it('names the row with the customer, the order number and the unread phrase only when there is one', () => {
    renderUI({
      orderList: list([
        makeOrder(1, { unread_direct_count: 1 }),
        makeOrder(2, { unread_direct_count: 6 }),
        makeOrder(3)
      ])
    })
    expect(rowButton('Ada Lovelace, Order number 1, 1 unread message')).toBeInTheDocument()
    expect(rowButton('Ada Lovelace, Order number 2, 6 unread messages')).toBeInTheDocument()
    expect(rowButton('Ada Lovelace, Order number 3')).toBeInTheDocument()
  })

  it('says «Customer» when the order has no customer name', () => {
    renderUI({ orderList: list([makeOrder(9, { customer: { name: '', lastname: null } })]) })
    const row = rowButton('Customer, Order number 9')
    expect(within(row).getByText('Customer')).toBeInTheDocument()
  })

  it('uses the external id when change_order_id is on and the order has one', () => {
    setConfigs({ change_order_id: { value: '1' } })
    renderUI({ orderList: list([makeOrder(11, { external_id: 'EXT-77' }), makeOrder(12, { external_id: null })]) })
    expect(rowButton('Ada Lovelace, Order number EXT-77').querySelector('.odc-figure')).toHaveTextContent('EXT-77')
    expect(rowButton('Ada Lovelace, Order number 12').querySelector('.odc-figure')).toHaveTextContent('12')
  })

  it('keeps the order id when change_order_id is off, even with an external id', () => {
    setConfigs({ change_order_id: { value: '0' } })
    renderUI({ orderList: list([makeOrder(13, { external_id: 'EXT-78' })]) })
    expect(rowButton('Ada Lovelace, Order number 13')).toBeInTheDocument()
    expect(screen.queryByText('EXT-78')).toBeNull()
  })

  it('says «No messages yet» muted when the order has no last message (scope «All»)', () => {
    renderUI({ scope: 'all', orderList: list([makeOrder(20, { last_direct_message_at: null })]) })
    const row = rowButton('Ada Lovelace, Order number 20')
    const muted = within(row).getByText('No messages yet')
    expect(muted).toHaveClass('odc-muted')
    expect(muted).not.toHaveAttribute('title')
  })

  it.each([
    ['America/Chicago', 300, '5 minutes ago', '08 Oct 2026 06:55'],
    ['Pacific/Auckland', -780, '5 minutes ago', '09 Oct 2026 00:55']
  ])('reads the UTC time of the API as UTC in %s (W1-QB1-01): relative in the row, absolute in the title', (tz, offset, relative, absolute) => {
    setZone(tz, offset)
    renderUI({ orderList: list([makeOrder(30, { last_direct_message_at: '2026-10-08 11:55:00' })]) })
    const time = within(rowButton('Ada Lovelace, Order number 30')).getByText(relative)
    expect(time).toHaveAttribute('title', absolute)
  })

  it('shows nothing in ISO format', () => {
    const { container } = renderUI({
      showBusiness: true,
      scope: 'all',
      orderList: list([makeOrder(1, { unread_direct_count: 2 }), makeOrder(2, { last_direct_message_at: null }), makeOrder(3, { last_direct_message_at: '2026-10-07 23:40:28' })])
    })
    expect(container.textContent).not.toMatch(ISO)
    container.querySelectorAll('[title]').forEach(element => expect(element.getAttribute('title')).not.toMatch(ISO))
    container.querySelectorAll('[aria-label]').forEach(element => expect(element.getAttribute('aria-label')).not.toMatch(ISO))
  })
})

describe('ConversationListUI · selection', () => {
  it('marks only the selected row: aria-current and data-selected', () => {
    renderUI({ selectedId: 2, orderList: list([makeOrder(1), makeOrder(2)]) })
    const selected = rowButton('Ada Lovelace, Order number 2')
    const other = rowButton('Ada Lovelace, Order number 1')
    expect(selected).toHaveAttribute('aria-current', 'true')
    expect(selected).toHaveAttribute('data-selected')
    expect(other).not.toHaveAttribute('aria-current')
    expect(other).not.toHaveAttribute('data-selected')
  })

  it('marks the orders whose chat has ended with data-ended, and nothing else about them', () => {
    renderUI({ orderList: list([...CHAT_ENDED_STATUSES.map((status, index) => makeOrder(100 + index, { status })), makeOrder(200, { status: 3 })]) })
    CHAT_ENDED_STATUSES.forEach((status, index) => {
      const row = rowButton(new RegExp(`Order number ${100 + index}\\b`))
      expect(row, `status ${status}`).toHaveAttribute('data-ended')
      expect(row).not.toBeDisabled()
    })
    expect(rowButton(/Order number 200\b/)).not.toHaveAttribute('data-ended')
  })

  it('a click selects the order as a choice of the user', async () => {
    const user = userEvent.setup()
    const orders = [makeOrder(1), makeOrder(2)]
    const { props } = renderUI({ orderList: list(orders) })
    await user.click(rowButton('Ada Lovelace, Order number 2'))
    expect(props.onSelect).toHaveBeenCalledTimes(1)
    expect(props.onSelect).toHaveBeenCalledWith(orders[1], { byUser: true })
  })

  it('selects with the keyboard (Enter) as a choice of the user', async () => {
    const user = userEvent.setup()
    const orders = [makeOrder(1), makeOrder(2)]
    const { props } = renderUI({ orderList: list(orders) })
    rowButton('Ada Lovelace, Order number 1').focus()
    await user.keyboard('{Enter}')
    expect(props.onSelect).toHaveBeenCalledWith(orders[0], { byUser: true })
  })

  describe('autoSelectFirst', () => {
    it('selects the first order once, not as a choice of the user', () => {
      const orders = [makeOrder(1), makeOrder(2)]
      const { props, update } = renderUI({ autoSelectFirst: true, orderList: list(orders) })
      expect(props.onSelect).toHaveBeenCalledTimes(1)
      expect(props.onSelect).toHaveBeenCalledWith(orders[0], { byUser: false })
      update({ pagination: { currentPage: 1, pageSize: 10, total: 2 } })
      update({ pagination: { currentPage: 1, pageSize: 10, total: 2 } })
      expect(props.onSelect).toHaveBeenCalledTimes(1)
    })

    it('does nothing when something is selected, when it is off, while it loads or when the list is empty', () => {
      const orders = [makeOrder(1)]
      const selected = renderUI({ autoSelectFirst: true, selectedId: 9, orderList: list(orders) })
      const off = renderUI({ autoSelectFirst: false, orderList: list(orders) })
      const loading = renderUI({ autoSelectFirst: true, orderList: list(orders, { loading: true }) })
      const empty = renderUI({ autoSelectFirst: true, orderList: list([]) })
      for (const view of [selected, off, loading, empty]) expect(view.props.onSelect).not.toHaveBeenCalled()
    })

    it('selects again after a new load, once per load', () => {
      const first = [makeOrder(1), makeOrder(2)]
      const second = [makeOrder(7), makeOrder(8)]
      const { props, update } = renderUI({ autoSelectFirst: true, orderList: list(first) })
      update({ orderList: list(first, { loading: true }) })
      expect(props.onSelect).toHaveBeenCalledTimes(1)
      update({ orderList: list(second) })
      update({ orderList: list(second) })
      expect(props.onSelect).toHaveBeenCalledTimes(2)
      expect(props.onSelect).toHaveBeenLastCalledWith(second[0], { byUser: false })
    })
  })

  describe('onOrdersChange', () => {
    it('hands the live orders to the host on every change of the list, and only then', () => {
      const first = [makeOrder(1)]
      const second = [makeOrder(1, { status: 11 }), makeOrder(3)]
      const { props, update } = renderUI({ orderList: list(first) })
      expect(props.onOrdersChange).toHaveBeenCalledTimes(1)
      expect(props.onOrdersChange).toHaveBeenLastCalledWith(first)
      update({ pagination: { currentPage: 1, pageSize: 10, total: 5 } })
      expect(props.onOrdersChange).toHaveBeenCalledTimes(1)
      update({ orderList: list(second) })
      expect(props.onOrdersChange).toHaveBeenCalledTimes(2)
      expect(props.onOrdersChange).toHaveBeenLastCalledWith(second)
    })
  })
})

describe('ConversationListUI · pagination and messages outside the page (6A)', () => {
  it('pages with the controller pagination: next page asks getPageOrders(pageSize, page)', async () => {
    const user = userEvent.setup()
    const { props } = renderUI({ pagination: { currentPage: 1, pageSize: 10, total: 25 } })
    const nav = screen.getByRole('navigation', { name: 'Pagination' })
    await user.click(within(nav).getByRole('button', { name: 'Next page' }))
    expect(props.getPageOrders).toHaveBeenCalledTimes(1)
    expect(props.getPageOrders).toHaveBeenCalledWith(10, 2)
  })

  // tanda P: 10, 25 and 50, as main and the other lists of the dashboard
  it('offers 10, 25 and 50 per page and asks for the page that keeps the first item in view', async () => {
    const user = userEvent.setup()
    const { props } = renderUI({ pagination: { currentPage: 3, pageSize: 10, total: 100 } })
    await user.click(screen.getByRole('button', { name: 'Items per page 10' }))
    const sizes = (await screen.findAllByRole('menuitemradio')).map(option => option.textContent)
    expect(sizes).toEqual(['10', '25', '50'])
    await user.click(screen.getByRole('menuitemradio', { name: '25' }))
    // the first item of page 3 at 10 per page is the 21st: at 25 per page it is on page 1
    expect(props.getPageOrders).toHaveBeenCalledWith(25, 1)
  })

  it('does not forward the page P/Pagination asks for when the total dropped under the held page (the controller steps back by itself)', () => {
    const { props } = renderUI({ pagination: { currentPage: 4, pageSize: 10, total: 25 } })
    expect(props.getPageOrders).not.toHaveBeenCalled()
  })

  it('shows a notice with a button to the first page when messages arrived outside page 1', async () => {
    const user = userEvent.setup()
    const { props } = renderUI({ outsideMessages: 1, pagination: { currentPage: 2, pageSize: 10, total: 25 } })
    const notice = screen.getByText('1 new message on the first page').closest('[role="status"]')
    expect(notice).toHaveAttribute('data-tone', 'info')
    await user.click(within(notice).getByRole('button', { name: 'Go to first page' }))
    expect(props.getPageOrders).toHaveBeenCalledTimes(1)
    expect(props.getPageOrders).toHaveBeenCalledWith(10, 1)
  })

  it('counts the messages in the plural', () => {
    renderUI({ outsideMessages: 3, pagination: { currentPage: 2, pageSize: 10, total: 25 } })
    expect(screen.getByText('3 new messages on the first page')).toBeInTheDocument()
  })

  it('has no notice on page 1 (the controller inserts the order) nor with no messages outside', () => {
    const first = renderUI({ outsideMessages: 2, pagination: { currentPage: 1, pageSize: 10, total: 25 } })
    expect(screen.queryByText(/new messages? on the first page/)).toBeNull()
    first.unmount()
    renderUI({ outsideMessages: 0, pagination: { currentPage: 2, pageSize: 10, total: 25 } })
    expect(screen.queryByText(/new messages? on the first page/)).toBeNull()
  })
})

describe('ConversationListUI · announcement (6A)', () => {
  it('has one polite live region from the start, empty', () => {
    const { container } = renderUI()
    const regions = container.querySelectorAll('.odc-conv-live')
    expect(regions).toHaveLength(1)
    expect(regions[0]).toHaveAttribute('aria-live', 'polite')
    expect(regions[0]).toHaveClass('odc-sr-only')
    expect(regions[0]).toBeEmptyDOMElement()
  })

  it('announces a new message of another order, with the author and the order', () => {
    const { container } = renderUI({ selectedId: 42, arrival: { orderId: 7, at: 1, authorName: 'Grace Hopper', fromOutside: true } })
    expect(live(container)).toHaveTextContent('New message from Grace Hopper, order 7')
  })

  it('says the number the person sees (the external id) when the order is in the list', () => {
    setConfigs({ change_order_id: { value: '1' } })
    const { container } = renderUI({
      selectedId: 42,
      orderList: list([makeOrder(42), makeOrder(7, { external_id: 'EXT-7' })]),
      arrival: { orderId: 7, at: 1, authorName: 'Grace Hopper', fromOutside: false }
    })
    expect(live(container)).toHaveTextContent('New message from Grace Hopper, order EXT-7')
  })

  it('does not announce the open conversation: it has its own log', () => {
    const { container } = renderUI({ selectedId: 7, arrival: { orderId: 7, at: 1, authorName: 'Grace Hopper', fromOutside: false } })
    expect(live(container)).toBeEmptyDOMElement()
  })

  it('announces each new arrival and goes quiet when the person opens that order', () => {
    const { container, update } = renderUI({ selectedId: 42, arrival: { orderId: 7, at: 1, authorName: 'Grace Hopper', fromOutside: true } })
    update({ arrival: { orderId: 8, at: 2, authorName: 'Alan Turing', fromOutside: false } })
    expect(live(container)).toHaveTextContent('New message from Alan Turing, order 8')
    update({ selectedId: 8, arrival: { orderId: 8, at: 2, authorName: 'Alan Turing', fromOutside: false } })
    expect(live(container)).toBeEmptyDOMElement()
  })
})

// redesign messages R1 (Q-03): «Go to first page» removes its own notice, so the focus would fall on <body>. It goes to the list region
// when the button is pressed, and to the first row when page 1 is in.
describe('ConversationListUI · focus after «Go to first page» (Q-03)', () => {
  const OUTSIDE = () => ({ outsideMessages: 2, pagination: { currentPage: 2, pageSize: 10, total: 25 }, orderList: list([makeOrder(11), makeOrder(12)]) })
  const PAGE_ONE = () => ({ outsideMessages: 0, pagination: { currentPage: 1, pageSize: 10, total: 25 }, orderList: list([makeOrder(1), makeOrder(2)]) })
  const goToFirstPage = (user) => user.click(screen.getByRole('button', { name: 'Go to first page' }))

  it('names the list region «Conversations» and lets the script focus it', () => {
    renderUI(OUTSIDE())
    const region = screen.getByRole('region', { name: 'Conversations' })
    expect(region).toHaveAttribute('tabindex', '-1')
    expect(region).toBe(document.querySelector('.odc-conv-list'))
  })

  it('puts the focus on the list region as soon as the button is pressed: never on <body>', async () => {
    const user = userEvent.setup()
    const { props } = renderUI(OUTSIDE())
    await goToFirstPage(user)
    expect(props.getPageOrders).toHaveBeenCalledWith(10, 1)
    expect(screen.getByRole('region', { name: 'Conversations' })).toHaveFocus()
  })

  it('keeps it there while page 1 loads and moves it to the first row when the rows are in; the notice is gone and focus is not on <body>', async () => {
    const user = userEvent.setup()
    const { update } = renderUI(OUTSIDE())
    await goToFirstPage(user)
    update({ orderList: list([], { loading: true }) })
    expect(screen.getByRole('region', { name: 'Conversations' })).toHaveFocus()
    update(PAGE_ONE())
    expect(screen.queryByText(/new messages? on the first page/)).toBeNull()
    expect(rowButton('Ada Lovelace, Order number 1')).toHaveFocus()
    expect(document.body).not.toHaveFocus()
  })

  it('goes straight to the first row when page 1 arrives without a loading phase in between', async () => {
    const user = userEvent.setup()
    const { update } = renderUI(OUTSIDE())
    await goToFirstPage(user)
    update(PAGE_ONE())
    expect(rowButton('Ada Lovelace, Order number 1')).toHaveFocus()
  })

  it('does not take the focus from the old rows of page 2 while the controller has not started loading', async () => {
    const user = userEvent.setup()
    const { update } = renderUI(OUTSIDE())
    await goToFirstPage(user)
    update({ pagination: { currentPage: 2, pageSize: 10, total: 26 } })
    expect(screen.getByRole('region', { name: 'Conversations' })).toHaveFocus()
  })

  it('moves the focus once: a later update of the list leaves it where the person put it', async () => {
    const user = userEvent.setup()
    const { update } = renderUI(OUTSIDE())
    await goToFirstPage(user)
    update(PAGE_ONE())
    const second = rowButton('Ada Lovelace, Order number 2')
    second.focus()
    update({ orderList: list([makeOrder(1), makeOrder(2, { unread_direct_count: 1 })]) })
    expect(second).toHaveFocus()
    expect(rowButton(/Order number 1\b/)).not.toHaveFocus()
  })

  it('leaves the focus on the region when page 1 has no rows', async () => {
    const user = userEvent.setup()
    const { update } = renderUI(OUTSIDE())
    await goToFirstPage(user)
    update({ ...PAGE_ONE(), orderList: list([]) })
    expect(screen.getByRole('region', { name: 'Conversations' })).toHaveFocus()
  })
})

// redesign messages R1 (P-01): the load of /messages is reported to analytics under the module «messages», as main did through
// getOrdersAnalyticsModule({ isMessagesView: true }).
describe('ConversationListUI · analytics (P-01)', () => {
  it('tracks the load of the orders under the messages module, once', () => {
    renderUI({ orderList: list([], { loading: true }) })
    expect(mocks.tracked).toHaveBeenCalled()
    expect(mocks.tracked.mock.calls.at(-1)[0]).toEqual({ loading: true, error: null, module: 'messages', action: 'load_orders', once: true })
  })

  it('passes the error of a failed load', () => {
    renderUI({ orderList: list([], { error: ['Network down'] }) })
    expect(mocks.tracked.mock.calls.at(-1)[0]).toEqual({ loading: false, error: ['Network down'], module: 'messages', action: 'load_orders', once: true })
  })
})

// redesign messages R1 (P-02): with isUseQuery the page and its size are written to the URL once the total is known (as OrdersCards does)
describe('ConversationListUI · page in the URL, write (P-02)', () => {
  it('writes page and pageSize after a load, with isUseQuery', () => {
    renderUI({ isUseQuery: true, pagination: { currentPage: 2, pageSize: 20, total: 45 } })
    expect(mocks.addQuery).toHaveBeenCalledTimes(1)
    expect(mocks.addQuery).toHaveBeenCalledWith({ page: 2, pageSize: 20 })
  })

  it('writes again when the page changes', () => {
    const { update } = renderUI({ isUseQuery: true, pagination: { currentPage: 2, pageSize: 20, total: 45 } })
    update({ pagination: { currentPage: 3, pageSize: 20, total: 45 } })
    expect(mocks.addQuery).toHaveBeenLastCalledWith({ page: 3, pageSize: 20 })
  })

  it('writes nothing while the total is not known, nor without isUseQuery', () => {
    renderUI({ isUseQuery: true, pagination: { currentPage: 1, pageSize: 10, total: null } })
    renderUI({ isUseQuery: true, pagination: { currentPage: 1, pageSize: 10 } })
    renderUI({ isUseQuery: false, pagination: { currentPage: 2, pageSize: 20, total: 45 } })
    renderUI({ pagination: { currentPage: 2, pageSize: 20, total: 45 } })
    expect(mocks.addQuery).not.toHaveBeenCalled()
  })
})

describe('ConversationListUI · states', () => {
  it('draws 6 skeleton rows while it loads, as tall as a row, and says it is busy', () => {
    const { container } = renderUI({ orderList: list([], { loading: true }) })
    const skeletons = container.querySelectorAll('.odc-conv-row[data-skeleton]')
    expect(skeletons).toHaveLength(6)
    skeletons.forEach(row => expect(row.closest('li')).not.toBeNull())
    expect(container.querySelector('.odc-conv-list')).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('button', { name: /Order number/ })).toBeNull()
    expect(screen.getByText('Loading')).toHaveClass('odc-sr-only')
  })

  it('has no empty state while it loads', () => {
    renderUI({ orderList: list([], { loading: true }) })
    expect(screen.queryByText('No active conversations')).toBeNull()
  })

  it('scope «Active» with nothing: says so and offers «Show all», which asks the host for «all»', async () => {
    const user = userEvent.setup()
    const { props } = renderUI({ scope: 'active', orderList: list([]) })
    expect(screen.getByText('No active conversations')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show all' }))
    expect(props.onScopeChange).toHaveBeenCalledWith('all')
  })

  it('scope «All» with nothing: «No orders», with no action', () => {
    renderUI({ scope: 'all', orderList: list([]) })
    expect(screen.getByText('No orders')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Show all' })).toBeNull()
  })

  it.each([
    ['a search', { searchValue: 'zzz' }],
    ['a filter', { filterValues: { statuses: [3], businessIds: [] } }]
  ])('with %s and nothing found in scope «All»: «No results» and how to go on', (_name, narrowing) => {
    renderUI({ scope: 'all', orderList: list([]), ...narrowing })
    expect(screen.getByText('No results')).toBeInTheDocument()
    expect(screen.getByText('Try another search or clear the filters.')).toBeInTheDocument()
    expect(screen.queryByText('No orders')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Show all' })).toBeNull()
  })

  // redesign messages R1 (Q-04): «Active» only searches the active conversations, so «No results» there says where else to look
  it.each([
    ['a search', { searchValue: 'zzz' }],
    ['a filter', { filterValues: { statuses: [3], businessIds: [] } }]
  ])('with %s and nothing found in scope «Active»: «No results», why, and «Show all» that keeps the search', async (_name, narrowing) => {
    const user = userEvent.setup()
    const { props } = renderUI({ scope: 'active', orderList: list([]), ...narrowing })
    expect(screen.getByText('No results')).toBeInTheDocument()
    expect(screen.getByText('Only active conversations are searched. Ended orders are in All.')).toBeInTheDocument()
    expect(screen.queryByText('Try another search or clear the filters.')).toBeNull()
    expect(screen.queryByText('No active conversations')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Show all' }))
    expect(props.onScopeChange).toHaveBeenCalledTimes(1)
    expect(props.onScopeChange).toHaveBeenCalledWith('all')
    // the list only asks the host for the scope: the search and the filters are the host's and stay as they are
    expect(props.onScopeChange.mock.calls[0]).toHaveLength(1)
  })

  it('an error is an alert with a way to try again', async () => {
    const user = userEvent.setup()
    const { props } = renderUI({ orderList: list([], { error: ['Network down'] }), pagination: { currentPage: 2, pageSize: 10, total: 25 } })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('We couldn’t load the orders')
    await user.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(props.getPageOrders).toHaveBeenCalledWith(10, 2)
  })
})

describe('conversation-list.css', () => {
  const strip = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '')
  const css = strip(readFileSync(resolve(__dirname, '..', 'conversation-list.css'), 'utf8'))
  const tokens = strip(readFileSync(resolve(__dirname, '../../../../../../../../../brand/ordering.tokens.generated.css'), 'utf8')) +
    strip(readFileSync(resolve(__dirname, '../../../../../../../../../brand/candidates.css'), 'utf8'))

  const declaration = (selector, property) => {
    const escaped = selector.replace(/[.[\]()]/g, '\\$&')
    const rule = css.match(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm'))
    return rule?.[1].match(new RegExp(`(?:^|[;\\s])${property}:\\s*([^;]+);`))?.[1].trim()
  }
  // a CSS length as pixels, through var() and calc(a * b): enough for the values this file holds
  const px = (value) => {
    const variable = value.match(/^var\((--[\w-]+)\)$/)
    if (variable) {
      const next = tokens.match(new RegExp(`${variable[1]}:\\s*([^;]+);`))?.[1].trim()
      if (next === undefined) throw new Error(`no token ${variable[1]}`)
      return px(next)
    }
    const rem = value.match(/^([\d.]+)rem$/)
    if (rem) return Number(rem[1]) * 16
    const pixels = value.match(/^([\d.]+)px$/)
    if (pixels) return Number(pixels[1])
    throw new Error(`cannot read ${value}`)
  }
  const factor = (name) => Number(tokens.match(new RegExp(`${name}:\\s*([\\d.]+);`))[1])

  it('gives the row 64px of minimum height, read from the token it uses', () => {
    expect(px(declaration('.odc-conv-row', 'min-block-size'))).toBe(64)
  })

  it('holds the two lines and the padding inside those 64px', () => {
    const padding = px(declaration('.odc-conv-row', 'padding-block'))
    const nameLine = px('var(--od-x-type-ui-size)') * factor('--od-x-leading-ui')
    const statusLine = px('var(--od-x-type-ui-size)') * factor('--od-x-leading-ui')
    expect(2 * padding + nameLine + statusLine).toBeLessThanOrEqual(64)
  })

  it('draws the skeleton rows with the same class, so they have the same height', () => {
    const { container } = renderUI({ orderList: list([], { loading: true }) })
    container.querySelectorAll('li').forEach(item => expect(item.querySelector('.odc-conv-row')).not.toBeNull())
  })

  it('draws the selected row with the soft action background and a 3px bar at the inline start edge', () => {
    expect(declaration('.odc-conv-row[data-selected]', 'background')).toBe('var(--od-action-soft)')
    const bar = '.odc-conv-row[data-selected]::before'
    expect(declaration(bar, 'background')).toBe('var(--od-action)')
    expect(declaration(bar, 'inset-inline-start')).toBe('0')
    // the width is the two tokens added; read from them it is 3px
    expect(declaration(bar, 'inline-size')).toBe('calc(var(--od-x-indicator) + var(--od-x-hairline))')
    expect(px('var(--od-x-indicator)') + px('var(--od-x-hairline)')).toBe(3)
  })

  // redesign messages R1 (Q-03): the list region receives the focus from the script, so it shows the brand ring (inside, it is clipped by the pane)
  it('draws the brand focus ring on the list region, inset', () => {
    expect(declaration('.odc-conv-list:focus-visible', 'outline')).toBe('var(--od-focus-ring-width) solid var(--od-focus-ring-color)')
    expect(declaration('.odc-conv-list:focus-visible', 'outline-offset')).toBe('var(--od-x-focus-inset)')
  })

  it('uses logical properties only (right to left needs no second set of rules)', () => {
    expect(css).not.toMatch(/(?:^|[\s;{])(?:margin|padding|border)-(?:left|right)\b|(?:^|[\s;{])(?:left|right)\s*:|text-align:\s*(?:left|right)|border-(?:top|bottom)-(?:left|right)-radius|(?:^|[\s;{])(?:width|height|min-width|max-width|min-height|max-height)\s*:/)
  })
})

describe('ConversationList · wiring to the controller', () => {
  const FILTERS = { statuses: [], businessIds: [], driverIds: [] }
  const hostProps = (extra = {}) => ({
    scope: 'active',
    onScopeChange: vi.fn(),
    sort: 'last_direct_message_at',
    onSortChange: vi.fn(),
    selectedId: null,
    onSelect: vi.fn(),
    autoSelectFirst: false,
    onOrdersChange: vi.fn(),
    unreadResetSignal: null,
    showBusiness: false,
    searchValue: null,
    filterValues: FILTERS,
    driversList: { drivers: [] },
    franchisesList: { franchises: [] },
    propsToFetch: ['id', 'status'],
    ...extra
  })
  const renderWired = (extra) => {
    mocks.controllerState = {
      orderList: list([makeOrder(42)]),
      pagination: { currentPage: 1, pageSize: 10, total: 1 },
      getPageOrders: vi.fn(),
      outsideMessages: 0,
      arrival: null
    }
    const props = hostProps(extra)
    const view = render(<Providers><ConversationList {...props} /></Providers>)
    return { props, ...view, rerenderWired: (next) => view.rerender(<Providers><ConversationList {...props} {...next} /></Providers>) }
  }
  const lastCall = () => mocks.controllerCalls.at(-1)

  it('scope «Active», newest message: active statuses, only orders with messages, ordered by the last message', () => {
    renderWired({ scope: 'active', sort: 'last_direct_message_at' })
    const call = lastCall()
    expect(call.orderStatus).toBe(ACTIVE_ORDER_STATUSES)
    expect(call.withMessagesOnly).toBe(true)
    expect(call.orderBy).toBe('last_direct_message_at')
    expect(call.orderDirection).toBe('asc')
  })

  it('scope «All», order number: every status, with or without messages, newest order first', () => {
    renderWired({ scope: 'all', sort: 'id' })
    const call = lastCall()
    expect(call.orderStatus).toBe(ALL_ORDER_STATUSES)
    expect(call.withMessagesOnly).toBe(false)
    expect(call.orderBy).toBe('id')
    expect(call.orderDirection).toBe('desc')
  })

  it('follows the host when the scope and the sort change', () => {
    const { rerenderWired } = renderWired({ scope: 'active', sort: 'id' })
    expect(lastCall().orderStatus).toBe(ACTIVE_ORDER_STATUSES)
    rerenderWired({ scope: 'all', sort: 'last_direct_message_at' })
    expect(lastCall().orderStatus).toBe(ALL_ORDER_STATUSES)
    expect(lastCall().withMessagesOnly).toBe(false)
    expect(lastCall().orderBy).toBe('last_direct_message_at')
    expect(lastCall().orderDirection).toBe('asc')
  })

  it('opts in to the controller features of the inbox and keeps the dashboard session', () => {
    renderWired()
    const call = lastCall()
    expect(call.pullInOnMessage).toBe(true)
    expect(call.asDashboard).toBe(true)
    expect(call.useDefualtSessionManager).toBe(true)
    expect(call.paginationSettings).toEqual({ initialPage: 1, pageSize: 10, controlType: 'pages' })
    expect(call.UIComponent).toBe(ConversationListUI)
  })

  it('searches by every field unless search_box_enabled is off', () => {
    renderWired()
    const on = lastCall()
    ;['isSearchByOrderId', 'isSearchByCustomerName', 'isSearchByCustomerEmail', 'isSearchByCustomerPhone', 'isSearchByDriverName', 'isSearchByBusinessName']
      .forEach(flag => expect(on[flag], flag).toBe(true))
  })

  it('turns the search flags off with search_box_enabled = 0, except the business name, as OrdersDashboardList does', () => {
    setConfigs({ search_box_enabled: { value: '0' } })
    renderWired()
    const off = lastCall()
    ;['isSearchByOrderId', 'isSearchByCustomerName', 'isSearchByCustomerEmail', 'isSearchByCustomerPhone', 'isSearchByDriverName']
      .forEach(flag => expect(off[flag], flag).toBe(false))
    expect(off.isSearchByBusinessName).toBe(true)
  })

  it('passes through what the host gives: search, filters, lists, fields, the unread reset signal and the selection', () => {
    const host = hostProps({ searchValue: 'ada', unreadResetSignal: { orderId: 42, seq: 3 }, selectedId: 42, showBusiness: true })
    mocks.controllerState = { orderList: list([makeOrder(42)]), pagination: { currentPage: 1, pageSize: 10, total: 1 }, getPageOrders: vi.fn() }
    render(<Providers><ConversationList {...host} /></Providers>)
    const call = lastCall()
    expect(call.searchValue).toBe('ada')
    expect(call.filterValues).toBe(host.filterValues)
    expect(call.driversList).toBe(host.driversList)
    expect(call.franchisesList).toBe(host.franchisesList)
    expect(call.propsToFetch).toBe(host.propsToFetch)
    expect(call.unreadResetSignal).toEqual({ orderId: 42, seq: 3 })
    expect(call.selectedId).toBe(42)
    expect(call.showBusiness).toBe(true)
    expect(rowButton('Ada Lovelace, Order number 42')).toHaveAttribute('aria-current', 'true')
    expect(within(rowButton('Ada Lovelace, Order number 42')).getByText('Fast Bite')).toBeInTheDocument()
  })

  it('passes null as the unread reset signal when the host has none, so the controller does not look for an order', () => {
    const host = hostProps()
    delete host.unreadResetSignal
    mocks.controllerState = { orderList: list([]), pagination: { currentPage: 1, pageSize: 10, total: 0 }, getPageOrders: vi.fn() }
    render(<Providers><ConversationList {...host} /></Providers>)
    expect(lastCall().unreadResetSignal).toBeNull()
  })

  // redesign messages R2.2 (M-D12): the inbox is the opt-in consumer of unreadByAuthor, and it no longer uses orderIdForUnreadCountUpdate
  it('turns unreadByAuthor on for the controller, and does not give it an orderIdForUnreadCountUpdate', () => {
    mocks.controllerState = { orderList: list([]), pagination: { currentPage: 1, pageSize: 10, total: 0 }, getPageOrders: vi.fn() }
    render(<Providers><ConversationList {...hostProps()} /></Providers>)
    expect(lastCall().unreadByAuthor).toBe(true)
    expect(lastCall().orderIdForUnreadCountUpdate).toBeUndefined()
  })

  // redesign messages R1 (P-02): the initial page and size come from the query, with isUseQuery (as OrdersDashboardList does)
  it('reads page and pageSize from the query for the initial pagination, with isUseQuery', () => {
    mocks.entry = '/messages?page=3&pageSize=25'
    renderWired({ isUseQuery: true })
    expect(lastCall().paginationSettings).toEqual({ initialPage: 3, pageSize: 25, controlType: 'pages' })
  })

  // tanda P: a link or bookmark from main with pageSize=25 keeps 25; 20 is not a size the pager offers
  it('keeps pageSize=25 from a main link, and reads 20 as the default', () => {
    mocks.entry = '/messages?page=1&pageSize=25'
    renderWired({ isUseQuery: true })
    expect(lastCall().paginationSettings).toEqual({ initialPage: 1, pageSize: 25, controlType: 'pages' })
    mocks.entry = '/messages?page=1&pageSize=20'
    renderWired({ isUseQuery: true })
    expect(lastCall().paginationSettings).toEqual({ initialPage: 1, pageSize: 10, controlType: 'pages' })
  })

  it('ignores the query without isUseQuery', () => {
    mocks.entry = '/messages?page=3&pageSize=25'
    renderWired()
    expect(lastCall().paginationSettings).toEqual({ initialPage: 1, pageSize: 10, controlType: 'pages' })
  })

  it.each([
    ['page=abc&pageSize=xyz'],
    ['page=0&pageSize=0'],
    ['page=-2&pageSize=-10'],
    ['page=1.5&pageSize=7'],
    ['']
  ])('falls back on page 1 and 10 per page when the query holds %s', (queryText) => {
    mocks.entry = `/messages?${queryText}`
    renderWired({ isUseQuery: true })
    expect(lastCall().paginationSettings).toEqual({ initialPage: 1, pageSize: 10, controlType: 'pages' })
  })

  it('keeps one without the other: a page alone leaves the size at 10', () => {
    mocks.entry = '/messages?page=4'
    renderWired({ isUseQuery: true })
    expect(lastCall().paginationSettings).toEqual({ initialPage: 4, pageSize: 10, controlType: 'pages' })
  })

  it('the controls reach the host: scope, sort and selection', async () => {
    const user = userEvent.setup()
    const { props } = renderWired()
    await user.click(screen.getByRole('button', { name: 'All' }))
    expect(props.onScopeChange).toHaveBeenCalledWith('all')
    await user.click(rowButton('Ada Lovelace, Order number 42'))
    expect(props.onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 42 }), { byUser: true })
  })
})

describe('ConversationList · the real controller reloads from page 1 on a scope or sort change', () => {
  // every key of the filter context, empty: the controller does not load without keys
  const EMPTY_LISTS = ['groupTypes', 'groupTypesUnassigned', 'businessIds', 'driverIds', 'driverGroupIds', 'cityIds', 'statuses', 'deliveryTypes', 'paymethodIds', 'countryCode', 'currency', 'metafield', 'driverGroupBusinessIds', 'administratorIds']
  const EMPTY_VALUES = ['orderId', 'externalId', 'dateType', 'deliveryFromDatetime', 'deliveryEndDatetime', 'logisticStatus', 'assigned', 'customerName', 'customerEmail', 'customerCellphone', 'customerLastname', 'coupon', 'offerId', 'timeStatus']
  const FILTERS = Object.fromEntries([...EMPTY_LISTS.map(key => [key, []]), ...EMPTY_VALUES.map(key => [key, null])])

  class FakeXhr {
    open (method, url) { this.method = method; this.url = url; this.headers = {} }
    setRequestHeader (name, value) { this.headers[name] = value }
    abort () {}
    send () {
      requests.push(this)
      const params = new URL(this.url).searchParams
      const page = Number(params.get('page'))
      const pageSize = Number(params.get('page_size'))
      Promise.resolve().then(() => {
        this.status = 200
        this.response = JSON.stringify({
          error: false,
          result: [{ id: page * 100 + 1, status: 7, customer: { name: 'Ada', lastname: 'Lovelace' }, last_direct_message_at: '2026-10-08 11:55:00' }],
          pagination: { current_page: page, page_size: pageSize, total_pages: 3, total: 30, from: (page - 1) * pageSize + 1, to: page * pageSize }
        })
        this.onload()
      })
    }
  }

  const query = (xhr) => {
    const params = new URL(xhr.url).searchParams
    const where = JSON.parse(params.get('where'))
    return {
      page: params.get('page'),
      orderBy: params.get('orderBy'),
      statuses: where.conditions.find(condition => condition.attribute === 'status')?.value,
      messageCondition: where.conditions.find(condition => condition.attribute === 'last_direct_message_at')
    }
  }
  const settle = () => new Promise(resolve => setTimeout(resolve, 30))
  const element = (extra = {}) => (
    <Providers>
      <ConversationList
        scope='active'
        sort='last_direct_message_at'
        onScopeChange={() => {}}
        onSortChange={() => {}}
        onSelect={() => {}}
        filterValues={FILTERS}
        searchValue={null}
        {...extra}
      />
    </Providers>
  )

  beforeEach(() => {
    mocks.realController = true
    window.XMLHttpRequest = FakeXhr
  })

  it('first load: page 1, active statuses, the messages condition and the order by last message', async () => {
    render(element())
    await waitFor(() => expect(requests).toHaveLength(1))
    expect(query(requests[0])).toMatchObject({ page: '1', orderBy: 'last_direct_message_at', statuses: ACTIVE_ORDER_STATUSES })
    expect(query(requests[0]).messageCondition).toBeDefined()
    expect(await screen.findByRole('button', { name: 'Ada Lovelace, Order number 101' })).toBeInTheDocument()
  })

  it('a scope change from page 2 asks once for page 1 with the other statuses, and drops the messages condition for «All»', async () => {
    const user = userEvent.setup()
    const view = render(element())
    await waitFor(() => expect(requests).toHaveLength(1))
    await user.click(await screen.findByRole('button', { name: 'Next page' }))
    await waitFor(() => expect(requests).toHaveLength(2))
    expect(query(requests[1]).page).toBe('2')

    view.rerender(element({ scope: 'all' }))
    await waitFor(() => expect(requests).toHaveLength(3))
    await settle()
    expect(requests).toHaveLength(3)
    expect(query(requests[2])).toMatchObject({ page: '1', statuses: ALL_ORDER_STATUSES })
    expect(query(requests[2]).messageCondition).toBeUndefined()

    view.rerender(element({ scope: 'active' }))
    await waitFor(() => expect(requests).toHaveLength(4))
    await settle()
    expect(requests).toHaveLength(4)
    expect(query(requests[3])).toMatchObject({ page: '1', statuses: ACTIVE_ORDER_STATUSES })
    expect(query(requests[3]).messageCondition).toBeDefined()
  })

  it('a sort change from page 2 asks once for page 1 ordered the other way', async () => {
    const user = userEvent.setup()
    const view = render(element())
    await waitFor(() => expect(requests).toHaveLength(1))
    await user.click(await screen.findByRole('button', { name: 'Next page' }))
    await waitFor(() => expect(requests).toHaveLength(2))

    view.rerender(element({ sort: 'id' }))
    await waitFor(() => expect(requests).toHaveLength(3))
    await settle()
    expect(requests).toHaveLength(3)
    expect(query(requests[2])).toMatchObject({ page: '1', orderBy: '-id' })
  })
})

// redesign messages integration (live 1440): the status of line 2 shared its width with the time and count column, so a long
// status broke word by word («Accepted / by / Business») and the row grew to 96px. Line 2 spans to the end edge now; the time
// and the count sit together on line 1.
describe('conversation-list.css · line 2 spans the whole row', () => {
  const css = readFileSync(resolve(__dirname, '..', 'conversation-list.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const ruleOf = (selector) => {
    const start = css.indexOf(`${selector} {`)
    return start === -1 ? null : css.slice(start, css.indexOf('}', start))
  }
  it('places name, aside and meta in grid areas, with meta across the last two columns', () => {
    expect(ruleOf('.odc-conv-row')).toMatch(/grid-template-areas:\s*'avatar line aside'\s*'avatar meta meta'/)
    expect(ruleOf('.odc-conv-row:not([data-skeleton]) .odc-conv-body')).toMatch(/display:\s*contents/)
    expect(ruleOf('.odc-conv-meta')).toMatch(/grid-area:\s*meta/)
    expect(ruleOf('.odc-conv-aside')).toMatch(/flex-direction:\s*row/)
  })
})

// redesign messages FASE 3 (measure.mjs touch probe, 390): on a phone the sort wraps under the scope control with 8px between
// them, so their 44px touch areas crossed. The wrapped rows keep 16px apart below 768px.
describe('conversation-list.css · phone gap between the scope and the sort', () => {
  const css = readFileSync(resolve(__dirname, '..', 'conversation-list.css'), 'utf8')
  it('separates the wrapped controls by --od-space-4 below 768px', () => {
    const phone = css.slice(css.indexOf('@media (max-width: 767px) {'))
    const start = phone.indexOf('.odc-conv-controls {')
    expect(start).toBeGreaterThan(-1)
    expect(phone.slice(start, phone.indexOf('}', start))).toMatch(/row-gap:\s*var\(--od-space-4\)/)
  })
})
