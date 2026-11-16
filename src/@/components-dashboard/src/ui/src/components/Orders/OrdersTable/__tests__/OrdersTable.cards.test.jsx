/* eslint-disable import/first */
// redesign 5.6-A: below 768px of VIEWPORT the orders list is a list of cards, never a table; from 768px
// it stays the table even when its container is narrow (the desktop split view). A card opens the
// detail like a row does, and a pending order carries Reject… / Accept with the handler of the detail
// footer. The cell renderers are the table's own, so these tests also pin that both agree.
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  configs: {},
  viewOnly: false,
  level: 0,
  lockedStatuses: [],
  addQueryToUrl: vi.fn()
}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
  useUtils: () => [{
    parseDate: (date) => String(date),
    parsePrice: (value, { currency } = {}) => `${currency}${Number(value).toFixed(2)}`,
    optimizeImage: (url) => url,
    getTimeAgo: () => '12 min ago'
  }],
  useConfig: () => [{ configs: mocks.configs }],
  useSession: () => [{ user: { level: mocks.level } }],
  useApi: () => [{ project: 'demo' }]
}))
vi.mock('../../../../utils', () => ({
  getCurrenySymbol: () => '$',
  addQueryToUrl: (...args) => mocks.addQueryToUrl(...args),
  getOrderStatusPrefix: (status) => ({ 0: 'Pending', 1: 'Completed by admin', 7: 'Accepted by business' }[status] ?? `Status ${status}`),
  isFinalOrderStatusLocked: (_project, _level, status) => mocks.lockedStatuses.includes(status),
  getUserType: (type) => type === 'readOnlyAdmin' ? mocks.viewOnly : false
}))

import { ConfigFileContext } from '../../../../contexts/ConfigFileContext'
import { OrdersTable } from '..'

const column = (order, visable = true, extra = {}) => ({ visable, title: extra.title ?? '', className: '', draggable: false, colSpan: 1, order, ...extra })
const defaultColumns = () => ({
  slaBar: column(-2, true),
  orderNumber: column(-1),
  dateTime: column(0),
  status: column(2, true, { title: 'Status' }),
  business: column(6, true, { title: 'Business' }),
  customer: column(7, true, { title: 'Customer' }),
  driver: column(8, true, { title: 'Driver' }),
  total: column(15)
})

const makeOrder = (id, extra = {}) => ({
  id,
  status: 0,
  delivery_type: 1,
  delivery_datetime_utc: '2024-05-01 10:30:00',
  created_at: '2024-05-01 10:00:00',
  time_status: 'in_time',
  business: { name: 'Fast Bite', logo: 'logo.png', city: { name: 'New York' } },
  customer: { name: 'Grace', lastname: 'Okafor', cellphone: '555-0100', photo: 'grace.png', orders_count: 3 },
  summary: { total: 35.2 },
  currency: 'USD',
  ...extra
})

const baseProps = (extra = {}) => ({
  orderList: { loading: false, orders: [makeOrder(13792)] },
  pagination: { currentPage: 1, pageSize: 10, total: 1 },
  selectedOrderIds: [],
  groupStatus: 'pending',
  allowColumns: defaultColumns(),
  getPageOrders: vi.fn(),
  handleSelectedOrderIds: vi.fn(),
  setSelectedOrderIds: vi.fn(),
  handleOpenOrderDetail: vi.fn(),
  handleUpdateOrderStatus: vi.fn().mockResolvedValue({ error: false }),
  ...extra
})

const tree = (props) => (
  <ThemeProvider theme={{ colors: {} }}>
    <ConfigFileContext.Provider value={[{ app_internal_name: 'ordering' }]}>
      <OrdersTable {...props} />
    </ConfigFileContext.Provider>
  </ThemeProvider>
)

const renderTable = (extra = {}) => {
  const props = baseProps(extra)
  return { ...render(tree(props)), props }
}

// The cut of the batch: the viewport, not the container.
const media = { narrow: true, listeners: new Set() }
const installMatchMedia = () => {
  window.matchMedia = vi.fn((query) => ({
    get matches () { return media.narrow && query === '(max-width: 767px)' },
    media: query,
    addEventListener: (_type, listener) => media.listeners.add(listener),
    removeEventListener: (_type, listener) => media.listeners.delete(listener),
    addListener: (listener) => media.listeners.add(listener),
    removeListener: (listener) => media.listeners.delete(listener)
  }))
}

let observers = []
class MockResizeObserver {
  constructor (callback) {
    this.callback = callback
    observers.push(this)
  }

  observe () {}
  unobserve () {}
  disconnect () { observers = observers.filter(item => item !== this) }
}

beforeEach(() => {
  mocks.configs = {}
  mocks.viewOnly = false
  mocks.level = 0
  mocks.lockedStatuses = []
  mocks.addQueryToUrl.mockClear()
  media.narrow = true
  media.listeners.clear()
  observers = []
  installMatchMedia()
})
afterEach(() => {
  delete window.matchMedia
  vi.unstubAllGlobals()
})

const card = (id = 13792) => screen.getByRole('link', { name: `Order #${id}` }).closest('li')

describe('OrdersTable: cards or table', () => {
  it('draws cards, and no table, below 768px of viewport', () => {
    renderTable()
    expect(screen.queryByRole('table')).toBeNull()
    const list = screen.getByRole('list', { name: 'Orders list' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(1)
  })

  it('stays a table from 768px even when its container is narrow (desktop split view)', () => {
    media.narrow = false
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    renderTable()
    act(() => { observers.forEach(observer => observer.callback([{ contentRect: { width: 420 } }])) })
    expect(screen.getByRole('table', { name: 'Orders list' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Orders list' })).toBeNull()
  })

  it('follows the viewport when it crosses the cut', () => {
    media.narrow = false
    renderTable()
    expect(screen.getByRole('table')).toBeInTheDocument()
    act(() => {
      media.narrow = true
      media.listeners.forEach(listener => listener({ matches: true }))
    })
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByRole('list', { name: 'Orders list' })).toBeInTheDocument()
  })

  it('stays a table where there is no matchMedia (and in the lateral lists of a customer or a driver)', () => {
    delete window.matchMedia
    const { unmount } = renderTable()
    expect(screen.getByRole('table')).toBeInTheDocument()
    unmount()
    installMatchMedia()
    renderTable({ isSelectedOrders: true })
    expect(screen.getByRole('table')).toBeInTheDocument()
  })
})

describe('OrdersTable cards: content', () => {
  it('shows #id, the exact status, business → customer, SLA, age and total, like the table cells', () => {
    // (tanda Y): an open order keeps «On time» only while its ETA is ahead (the 2024 default has passed)
    const ahead = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ')
    renderTable({ orderList: { loading: false, orders: [makeOrder(13792, { delivery_datetime_utc: ahead, eta_time: 0 })] } })
    const view = within(card())
    expect(view.getByText('#13792')).toBeInTheDocument()
    expect(view.getByText('Pending')).toBeInTheDocument()
    expect(view.getByText('Fast Bite')).toBeInTheDocument()
    expect(view.getByText('Grace Okafor')).toBeInTheDocument()
    expect(view.getByText('On time')).toBeInTheDocument()
    expect(view.getByText('12 min ago')).toBeInTheDocument()
    // redesign W0-3a (T0-9, decisión 11a): the total is a figure; the status word beside it is not
    expect(view.getByText('$35.20')).toHaveClass('odc-figure')
    expect(view.getByText('Pending')).not.toHaveClass('odc-figure')
  })

  // redesign fix-qa E7: the card lost the driver and the delivery time (main's table showed both). Same
  // data as the Driver, ETA and date cells; «Unassigned» when a delivery has no driver; nothing for a pickup.
  it('shows the driver of a delivery, from the same data as the Driver column', () => {
    renderTable({ orderList: { loading: false, orders: [makeOrder(1, { driver: { name: 'Tom Rider', photo: 'tom.png' } })] } })
    expect(within(card(1)).getByText('Tom Rider')).toBeInTheDocument()
  })

  it('says Unassigned for a delivery without a driver, and says nothing about a driver for a pickup', () => {
    renderTable({ orderList: { loading: false, orders: [makeOrder(1), makeOrder(2, { delivery_type: 2 })] } })
    expect(within(card(1)).getByText('Unassigned')).toBeInTheDocument()
    expect(within(card(2)).queryByText('Unassigned')).toBeNull()
  })

  it('shows the delivery time, and the ETA next to it when the order has one', () => {
    renderTable({ orderList: { loading: false, orders: [makeOrder(1), makeOrder(2, { eta_time: 20 })] } })
    expect(within(card(1)).getByText('2024-05-01 10:30:00')).toBeInTheDocument()
    expect(within(card(1)).queryByText(/^ETA/)).toBeNull()
    expect(within(card(2)).getByText('2024-05-01 10:30:00')).toBeInTheDocument()
    // redesign F6g: the ETA time and date are isolated runs inside the line, so the line is read by its whole text
    expect(within(card(2)).getByText((_, node) => node.matches('.odc-order-card-when > span') && /^ETA 10:50/.test(node.textContent))).toBeInTheDocument()
  })

  // redesign W0-3a (T0-9, decisión 11a): in the card the hours are figures and the word «ETA» is not
  it('puts the delivery time and the ETA time of the card in mono, and not the ETA label', () => {
    renderTable({ orderList: { loading: false, orders: [makeOrder(2, { eta_time: 20 })] } })
    const view = within(card(2))
    expect(view.getByText('2024-05-01 10:30:00')).toHaveClass('odc-figure')
    const line = view.getByText((_, node) => node.matches('.odc-order-card-when > span') && /^ETA 10:50/.test(node.textContent))
    expect(line).not.toHaveClass('odc-figure')
    expect(line.querySelector('.odc-figure')).toHaveTextContent('10:50')
  })

  it('says the SLA in words, from the same renderer as the table', () => {
    renderTable({ orderList: { loading: false, orders: [makeOrder(1, { time_status: 'delayed', status: 7 })] } })
    expect(within(card(1)).getByText(/^Delayed/)).toBeInTheDocument()
  })

  it('shows the external id as the title when change_order_id is on and the order has one', () => {
    mocks.configs = { change_order_id: { value: '1' } }
    renderTable({ orderList: { loading: false, orders: [makeOrder(5, { external_id: 'EXT-77' })] } })
    expect(within(screen.getByRole('list')).getByText('EXT-77')).toBeInTheDocument()
  })

  it('truncates long names with the full text in title, and keeps one line', () => {
    const longBusiness = 'The Extraordinarily Long Named Burger and Barbecue House of Downtown'
    const longCustomer = 'Maximiliano Alejandro Fernández de la Vega y Montenegro'
    renderTable({
      orderList: {
        loading: false,
        orders: [makeOrder(9, { business: { name: longBusiness }, customer: { name: 'Maximiliano Alejandro', lastname: 'Fernández de la Vega y Montenegro' } })]
      }
    })
    expect(within(card(9)).getByText(longBusiness)).toHaveAttribute('title', longBusiness)
    expect(within(card(9)).getByText(longCustomer)).toHaveAttribute('title', longCustomer)
  })

  it('marks the open order and the arrival data like a row', () => {
    renderTable({ orderDetailId: 13792 })
    expect(card()).toHaveAttribute('aria-current', 'true')
  })

  it('keeps the pager of the table below the cards', () => {
    renderTable({ pagination: { currentPage: 2, pageSize: 10, total: 35 } })
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled()
    expect(screen.getByText(/Showing/).closest('.odc-orders-foot')).toHaveAttribute('data-cards')
  })
})

// (W1, owner decision 1 A): main had checkboxes, a page «Select all» and the bulk actions at every width. On a phone the
// cards get a «Select» mode (the bulk bar itself is OrdersListing's, see OrdersListing.cards.test.jsx).
describe('OrdersTable cards: select mode', () => {
  const threeOrders = () => ({
    orderList: { loading: false, orders: [makeOrder(1), makeOrder(2, { status: 1 }), makeOrder(3)] },
    pagination: { currentPage: 1, pageSize: 10, total: 3 }
  })

  it('draws no checkbox until Select is pressed, whatever else the card has', () => {
    renderTable(threeOrders())
    expect(screen.queryByRole('checkbox')).toBeNull()
    const select = screen.getByRole('button', { name: 'Select' })
    expect(select.tagName).toBe('BUTTON')
    expect(select).toHaveAttribute('type', 'button')
  })

  it('shows a checkbox named after the order, only on the selectable cards, and the page Select all', async () => {
    mocks.lockedStatuses = [1]
    renderTable(threeOrders())
    await userEvent.click(screen.getByRole('button', { name: 'Select' }))
    expect(within(card(1)).getByRole('checkbox', { name: 'Order 1' })).toBeInTheDocument()
    expect(within(card(3)).getByRole('checkbox', { name: 'Order 3' })).toBeInTheDocument()
    expect(within(card(2)).queryByRole('checkbox')).toBeNull()
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Select' })).toBeNull()
  })

  it('toggling a checkbox selects that order and does not open it', async () => {
    const { props } = renderTable(threeOrders())
    await userEvent.click(screen.getByRole('button', { name: 'Select' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Order 3' }))
    expect(props.handleSelectedOrderIds).toHaveBeenCalledTimes(1)
    expect(props.handleSelectedOrderIds).toHaveBeenCalledWith(3)
    expect(props.handleOpenOrderDetail).not.toHaveBeenCalled()
  })

  it('still opens the order when the card is tapped in Select mode', async () => {
    const { props } = renderTable(threeOrders())
    await userEvent.click(screen.getByRole('button', { name: 'Select' }))
    await userEvent.click(screen.getByRole('link', { name: 'Order #1' }))
    expect(props.handleOpenOrderDetail).toHaveBeenCalledTimes(1)
  })

  it('reflects the selection in the checkboxes and in Select all (some: mixed, all: checked)', async () => {
    mocks.lockedStatuses = [1]
    const { rerender, props } = renderTable({ ...threeOrders(), selectedOrderIds: [1] })
    expect(screen.getByRole('checkbox', { name: 'Order 1' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('checkbox', { name: 'Order 3' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAttribute('aria-checked', 'mixed')
    rerender(tree({ ...props, selectedOrderIds: [1, 3] }))
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAttribute('aria-checked', 'true')
  })

  it('Select all selects the unlocked orders of the page, and takes them off when they are all in', async () => {
    mocks.lockedStatuses = [1]
    const { props, rerender } = renderTable({ ...threeOrders(), selectedOrderIds: [99] })
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all' }))
    expect(props.setSelectedOrderIds).toHaveBeenLastCalledWith([99, 1, 3])
    rerender(tree({ ...props, selectedOrderIds: [99, 1, 3] }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all' }))
    expect(props.setSelectedOrderIds).toHaveBeenLastCalledWith([99])
  })

  it('Cancel clears the selection and leaves Select mode', async () => {
    const { props } = renderTable({ ...threeOrders(), selectedOrderIds: [1] })
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(props.setSelectedOrderIds).toHaveBeenCalledWith([])
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.getByRole('button', { name: 'Select' })).toBeInTheDocument()
  })

  it('opens Select mode by itself when a selection already exists (it came from the table)', () => {
    renderTable({ ...threeOrders(), selectedOrderIds: [3] })
    expect(screen.getByRole('checkbox', { name: 'Order 3' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('keeps the Reject and Accept actions of a pending card next to its checkbox', async () => {
    const { props } = renderTable(threeOrders())
    await userEvent.click(screen.getByRole('button', { name: 'Select' }))
    expect(within(card(1)).getByRole('button', { name: 'Accept order #1' })).toBeInTheDocument()
    await userEvent.click(within(card(1)).getByRole('button', { name: 'Accept order #1' }))
    expect(props.handleUpdateOrderStatus).toHaveBeenCalledWith({ id: 1, newStatus: 7 })
  })

  it('offers no Select while loading, with nothing to select, or in the lateral lists', () => {
    const { unmount } = renderTable({ orderList: { loading: true, orders: [] } })
    expect(screen.queryByRole('button', { name: 'Select' })).toBeNull()
    unmount()
    const empty = renderTable({ orderList: { loading: false, orders: [] }, pagination: { currentPage: 1, pageSize: 10, total: 0 } })
    expect(screen.queryByRole('button', { name: 'Select' })).toBeNull()
    empty.unmount()
    renderTable({ isSelectedOrders: true })
    expect(screen.queryByRole('button', { name: 'Select' })).toBeNull()
  })

  it('lets the footer keep clear of the selection bar while orders are selected (data-selecting)', () => {
    renderTable({ ...threeOrders(), selectedOrderIds: [1] })
    expect(screen.getByText(/Showing/).closest('.odc-orders-foot')).toHaveAttribute('data-selecting')
  })

  it('does not mark the footer as selecting with an empty selection', () => {
    renderTable(threeOrders())
    expect(screen.getByText(/Showing/).closest('.odc-orders-foot')).not.toHaveAttribute('data-selecting')
  })
})

describe('OrdersTable cards: opening the detail', () => {
  it('opens through the handler the rows use when the card link is clicked', async () => {
    const { props } = renderTable()
    await userEvent.click(screen.getByRole('link', { name: 'Order #13792' }))
    expect(props.handleOpenOrderDetail).toHaveBeenCalledTimes(1)
    expect(props.handleOpenOrderDetail).toHaveBeenCalledWith(props.orderList.orders[0], false, undefined)
  })

  it('opens when any part of the card is clicked', async () => {
    const { props } = renderTable()
    await userEvent.click(screen.getByText('Fast Bite'))
    expect(props.handleOpenOrderDetail).toHaveBeenCalledTimes(1)
  })

  it('opens with Enter on the focused card link, once', async () => {
    const { props } = renderTable()
    const user = userEvent.setup()
    // (W1, decision 1 A): the «Select» button sits above the cards, so it is the first stop
    await user.tab()
    expect(screen.getByRole('button', { name: 'Select' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('link', { name: 'Order #13792' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(props.handleOpenOrderDetail).toHaveBeenCalledTimes(1)
  })

  it('points the link at ?id= so it can also open in a new tab', () => {
    renderTable()
    expect(screen.getByRole('link', { name: 'Order #13792' }).getAttribute('href')).toMatch(/\?(.*&)?id=13792(&|$)/)
  })

  it('leaves a modified click to the browser (new tab)', () => {
    const { props } = renderTable()
    // jsdom cannot navigate: the browser's own action is cancelled after the card has had its say (and the
    // card must not have cancelled it first).
    const browserAction = vi.fn()
    const cancel = (event) => {
      browserAction(event.defaultPrevented)
      event.preventDefault()
    }
    document.addEventListener('click', cancel)
    fireEvent.click(screen.getByRole('link', { name: 'Order #13792' }), { ctrlKey: true })
    document.removeEventListener('click', cancel)
    expect(props.handleOpenOrderDetail).not.toHaveBeenCalled()
    expect(browserAction).toHaveBeenCalledWith(false)
  })
})

describe('OrdersTable cards: pending actions', () => {
  it('shows Reject… and Accept only on a pending order', () => {
    renderTable({ orderList: { loading: false, orders: [makeOrder(1), makeOrder(2, { status: 7 })] } })
    expect(within(card(1)).getByRole('button', { name: 'Reject order #1' })).toBeInTheDocument()
    expect(within(card(1)).getByRole('button', { name: 'Accept order #1' })).toBeInTheDocument()
    expect(within(card(2)).queryByRole('button')).toBeNull()
  })

  it('shows no actions to a view-only user', () => {
    mocks.viewOnly = true
    renderTable()
    expect(screen.queryByRole('button', { name: 'Accept order #13792' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Reject order #13792' })).toBeNull()
  })

  it('Accept sends status 7 through handleUpdateOrderStatus and does not open the card', async () => {
    const { props } = renderTable()
    await userEvent.click(screen.getByRole('button', { name: 'Accept order #13792' }))
    expect(props.handleUpdateOrderStatus).toHaveBeenCalledTimes(1)
    expect(props.handleUpdateOrderStatus).toHaveBeenCalledWith({ id: 13792, newStatus: 7 })
    expect(props.handleOpenOrderDetail).not.toHaveBeenCalled()
  })

  // redesign fix-qa E7 (owner, 2026-10-06): Reject from a card sends 2 (rejected by admin) for an admin
  // (level 0) and 5 (rejected by business) for everyone else; the dialog names the status it will set.
  it('Reject… sends nothing until the dialog is confirmed, then sends status 2 for an admin', async () => {
    const { props } = renderTable()
    await userEvent.click(screen.getByRole('button', { name: 'Reject order #13792' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Reject order #13792?' })
    expect(within(dialog).getByText('The order moves to Rejected by admin.')).toBeInTheDocument()
    expect(props.handleUpdateOrderStatus).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reject order' }))
    await waitFor(() => expect(props.handleUpdateOrderStatus).toHaveBeenCalledWith({ id: 13792, newStatus: 2 }))
    expect(props.handleUpdateOrderStatus).toHaveBeenCalledTimes(1)
    expect(props.handleOpenOrderDetail).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it.each([1, 2, 5])('Reject… sends status 5 for a user of level %i (not an admin)', async (level) => {
    mocks.level = level
    const { props } = renderTable()
    await userEvent.click(screen.getByRole('button', { name: 'Reject order #13792' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Reject order #13792?' })
    expect(within(dialog).getByText('The order moves to Rejected by business.')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reject order' }))
    await waitFor(() => expect(props.handleUpdateOrderStatus).toHaveBeenCalledWith({ id: 13792, newStatus: 5 }))
  })

  it('Keep order sends nothing and closes the dialog', async () => {
    const { props } = renderTable()
    await userEvent.click(screen.getByRole('button', { name: 'Reject order #13792' }))
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep order' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(props.handleUpdateOrderStatus).not.toHaveBeenCalled()
    expect(props.handleOpenOrderDetail).not.toHaveBeenCalled()
  })

  it('blocks a second press while the first one is in flight', async () => {
    let finish
    const handleUpdateOrderStatus = vi.fn(() => new Promise(_resolve => { finish = _resolve }))
    renderTable({ handleUpdateOrderStatus })
    const accept = screen.getByRole('button', { name: 'Accept order #13792' })
    await userEvent.click(accept)
    await userEvent.click(accept)
    expect(handleUpdateOrderStatus).toHaveBeenCalledTimes(1)
    await act(async () => finish({ error: false }))
  })
})

// redesign fix-qa C2: accepting or rejecting from a card no longer drops the `{ error }` of the API: the card
// says what the API said (inline, role=alert), and the message goes away with the next attempt.
describe('OrdersTable cards: a failed accept or reject', () => {
  it('says what the API said inside the card that failed, and in no other card', async () => {
    const handleUpdateOrderStatus = vi.fn().mockResolvedValue({ error: true, result: ['The order was already accepted by another user'] })
    renderTable({ handleUpdateOrderStatus, orderList: { loading: false, orders: [makeOrder(1), makeOrder(2)] } })
    await userEvent.click(screen.getByRole('button', { name: 'Accept order #1' }))
    const alert = await within(card(1)).findByRole('alert')
    expect(alert).toHaveTextContent('The order was already accepted by another user')
    expect(within(card(2)).queryByRole('alert')).toBeNull()
  })

  it('joins several messages and reads {message} objects too', async () => {
    const handleUpdateOrderStatus = vi.fn().mockResolvedValue({ error: true, result: ['First problem.', { message: 'Second problem.' }] })
    renderTable({ handleUpdateOrderStatus })
    await userEvent.click(screen.getByRole('button', { name: 'Accept order #13792' }))
    expect(await within(card()).findByRole('alert')).toHaveTextContent('First problem. Second problem.')
  })

  it('falls back to a plain sentence when the API gave no text', async () => {
    const handleUpdateOrderStatus = vi.fn().mockResolvedValue({ error: true })
    renderTable({ handleUpdateOrderStatus })
    await userEvent.click(screen.getByRole('button', { name: 'Accept order #13792' }))
    expect(await within(card()).findByRole('alert')).toHaveTextContent('We couldn’t change the status of the order.')
  })

  it('also reports a handler that throws', async () => {
    const handleUpdateOrderStatus = vi.fn().mockRejectedValue(new Error('Network down'))
    renderTable({ handleUpdateOrderStatus })
    await userEvent.click(screen.getByRole('button', { name: 'Accept order #13792' }))
    expect(await within(card()).findByRole('alert')).toHaveTextContent('Network down')
  })

  it('a rejection that fails closes the dialog and leaves the message on the card', async () => {
    const handleUpdateOrderStatus = vi.fn().mockResolvedValue({ error: true, result: ['Not allowed'] })
    renderTable({ handleUpdateOrderStatus })
    await userEvent.click(screen.getByRole('button', { name: 'Reject order #13792' }))
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reject order' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(await within(card()).findByRole('alert')).toHaveTextContent('Not allowed')
  })

  it('the next attempt clears the message; a success leaves none', async () => {
    const handleUpdateOrderStatus = vi.fn()
      .mockResolvedValueOnce({ error: true, result: ['Try later'] })
      .mockResolvedValueOnce({ error: false })
    renderTable({ handleUpdateOrderStatus })
    await userEvent.click(screen.getByRole('button', { name: 'Accept order #13792' }))
    expect(await within(card()).findByRole('alert')).toHaveTextContent('Try later')
    await userEvent.click(screen.getByRole('button', { name: 'Accept order #13792' }))
    await waitFor(() => expect(handleUpdateOrderStatus).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(within(card()).queryByRole('alert')).toBeNull())
  })

  it('a successful change shows no message', async () => {
    renderTable()
    await userEvent.click(screen.getByRole('button', { name: 'Accept order #13792' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Accept order #13792', busy: true })).toBeNull())
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('the message is danger text from the tokens, across both columns of the actions', () => {
    const css = readFileSync(resolve(__dirname, '../../../Shared/Product/record-card.css'), 'utf8') // redesign W1-1 (T1-1): the card stylesheet moved to Product
    const rule = css.match(/\.odc-order-card-error\s*\{([^}]*)\}/)
    expect(rule).not.toBeNull()
    expect(rule[1]).toMatch(/color:\s*var\(--od-danger-functional\)/)
    expect(rule[1]).toMatch(/grid-column:\s*1\s*\/\s*-1/)
  })
})

describe('OrdersTable cards: states', () => {
  it('loading is one skeleton card per row of the page (ten here), announced as busy', () => {
    const { container } = renderTable({ orderList: { loading: true, orders: [] } })
    expect(screen.queryByRole('table')).toBeNull()
    const list = container.querySelector('[aria-busy="true"]')
    expect(list).not.toBeNull()
    // redesign F4 (C20): as many as the page size, not a fixed three; the shape is pinned in OrdersTable.skeleton.test.jsx
    expect(list.querySelectorAll('[data-skeleton]')).toHaveLength(10)
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('empty is the EmptyState of the table', () => {
    renderTable({ orderList: { loading: false, orders: [] }, pagination: { currentPage: 1, pageSize: 10, total: 0 } })
    expect(screen.getByText('No orders')).toBeInTheDocument()
  })
})

describe('OrdersTable cards: stylesheet', () => {
  // redesign W1-1 (T1-1): the card structure is Product's record-card.css; what Orders adds (the pager under the cards) stays in order-card.css
  const readCss = () => ['../../../Shared/Product/record-card.css', '../order-card.css'].map(file => readFileSync(resolve(__dirname, file), 'utf8')).join('\n')

  it('uses the mobile gutter, the 44px area of the actions and 44px pager buttons', () => {
    const css = readCss()
    expect(css).toContain('--od-x-page-gutter-mobile')
    // redesign W0-3d3 (T0-12, decision 12): the actions keep their Button size and take Product's 44px area; the pager keeps its 44px box
    expect(css).not.toMatch(/odc-order-card-actions[^}]*--od-x-target-coarse/)
    expect(css).toMatch(/odc-orders-foot\[data-cards\][^}]*--od-x-target-coarse/)
  })

  it('gives the driver and the delivery time a row of their own that wraps instead of cutting them', () => {
    const css = readCss()
    expect(css).toMatch(/\.odc-order-card-logistics\s*\{[^}]*display:\s*flex[^}]*flex-wrap:\s*wrap/)
    expect(css).toMatch(/\.odc-order-card-driver\s*\{[^}]*min-inline-size:\s*0/)
  })

  it('uses logical properties only (RTL)', () => {
    const css = readCss()
    expect(css).not.toMatch(/(^|[\s;{])(margin|padding|border)-(left|right)\b/)
    expect(css).not.toMatch(/(^|[\s;{])(left|right)\s*:/)
    expect(css).not.toMatch(/text-align\s*:\s*(left|right)/)
  })
})
