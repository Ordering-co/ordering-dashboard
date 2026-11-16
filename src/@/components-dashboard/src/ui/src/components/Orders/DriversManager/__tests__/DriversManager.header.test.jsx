/* eslint-disable import/first */
// redesign W1-4 (T1-4-4a): the head of /drivers-dashboard is P/PageHeader; Open menu (W1-D-2) is a P/IconButton; the search is
// P/SearchField with the old wait; «Filters applied» is in the flow; no legacy buttons/search/bootstrap-icons/meronex left.
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { act, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const state = vi.hoisted(() => {
  const listeners = {}
  return {
    isCollapse: false,
    mapsKey: 'key',
    search: '',
    location: '/drivers-dashboard',
    removeQuery: null,
    // redesign drivers-dashboard B4 (decisions 4, 5): a controller with the state the page reads (the chosen driver, its orders, the
    // drivers) and a socket whose events the tests fire
    stateful: false,
    board: null,
    setAssigned: null,
    setDrivers: null,
    listeners,
    socket: {
      on: (event, fn) => { (listeners[event] = listeners[event] || new Set()).add(fn) },
      off: (event, fn) => { listeners[event]?.delete(fn) }
    }
  }
})

vi.mock('../../../../../../index', () => {
  const StatefulController = ({ UIComponent, ...props }) => {
    const [selectedDriver, setSelectedDriver] = React.useState(null)
    const [assignedOrders, setAssignedOrders] = React.useState({ loading: false, error: null, orders: [] })
    const [driversList, setDriversList] = React.useState(props.driversList)
    state.setAssigned = setAssignedOrders
    state.setDrivers = (drivers) => setDriversList(previous => ({ ...previous, drivers }))
    return (
      <UIComponent
        {...props}
        driversList={driversList}
        selectedDriver={selectedDriver}
        setSelectedDriver={setSelectedDriver}
        assignedOrders={assignedOrders}
      />
    )
  }
  return {
    useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
    useConfig: () => [{ configs: { google_maps_api_key: { value: state.mapsKey } } }],
    useWebsocket: () => state.socket,
    DriversList: ({ UIComponent, ...props }) => (state.stateful ? <StatefulController UIComponent={UIComponent} {...props} /> : <UIComponent {...props} />)
  }
})
// (row 28): removeQueryToUrl writes to window.history, not to the router; a spy shows what the page took out of the address bar
vi.mock('../../../../utils', async (importOriginal) => ({ ...(await importOriginal()), removeQueryToUrl: (...args) => state.removeQuery(...args) }))
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: state.isCollapse }, { handleMenuCollapse: state.handleMenuCollapse }]
}))
// redesign drivers-dashboard B4: the board keeps the props the page gives it, so the suite can drive them
vi.mock('../../DriversDashboard', () => ({ DriversDashboard: (props) => { state.board = props; return <div data-testid='dashboard' /> } }))
vi.mock('../../ContactOrdersSheet', () => ({
  ContactOrdersSheet: ({ open, user, statusGroup, onClose }) => (
    open
      ? (
        <div role='dialog' data-user={user?.id} data-group={statusGroup}>
          <button type='button' onClick={onClose}>Close sheet</button>
        </div>
        )
      : null
  )
}))
// SearchBar: the legacy field stays mocked, so the old head renders and fails on the assertions, not on a missing export
vi.mock('../../../Shared', () => ({ LearnDropDown: () => <button type='button'>Learn</button>, SearchBar: () => <input name='search' className='od-search-bar' /> }))
vi.mock('../../OrderNotification', () => ({ OrderNotificationSlot: () => null }))
vi.mock('../../GoogleMapsApiKeySettingButton', () => ({ GoogleMapsApiKeySettingButton: () => <button type='button'>Maps key</button> }))
vi.mock('../../WebsocketStatus', () => ({ WebsocketStatus: () => <span data-testid='live'>Live</span> }))

import { DriversManager } from '../index'

const baseProps = () => ({
  onDriverRedirect: vi.fn(),
  handleChangeSearch: vi.fn(),
  searchValue: state.search,
  driversIsOnline: true,
  selectedDriver: null,
  setSelectedDriver: vi.fn(),
  driversList: { drivers: [{ id: 7, name: 'Ada' }], loading: false }
})

const renderManager = (overrides = {}) => renderWithProviders(<DriversManager {...baseProps()} {...overrides} />, { initialEntries: [state.location] })

beforeEach(() => {
  state.isCollapse = false
  state.mapsKey = 'key'
  state.search = ''
  state.location = '/drivers-dashboard'
  state.removeQuery = vi.fn()
  state.handleMenuCollapse = vi.fn()
  state.stateful = false
  state.board = null
  state.setAssigned = null
  state.setDrivers = null
  Object.keys(state.listeners).forEach(event => delete state.listeners[event])
})
afterEach(() => { vi.useRealTimers() })

describe('DriversManager head', () => {
  it('draws the title as the Product page header h1, in Title Case as main, with the live status and Learn', () => {
    const { container } = renderManager()
    const h1 = screen.getByRole('heading', { level: 1, name: 'Drivers dashboard' })
    expect(h1).toHaveClass('odc-pagehead-title')
    expect(container.querySelector('.odc-pagehead-lead')).toContainElement(screen.getByTestId('live'))
    expect(container.querySelector('.odc-pagehead-actions')).toContainElement(screen.getByRole('button', { name: 'Learn' }))
    expect(container.querySelector('#driverDashboard')).not.toBeNull()
  })

  // redesign tanda AB (O-3): with the search out of the head, nothing pushed the actions to their own line on a phone and
  // the title was squeezed beside the live status and Learn («Dash bo…» in Italian at 390). The title takes the row, as before.
  it('gives the title the whole row of a narrow head (wideTitle)', () => {
    const { container } = renderManager()
    expect(container.querySelector('.odc-pagehead-lead')).toHaveAttribute('data-wide-title')
  })

  it('keeps the maps-key button only without a key, in the same group', () => {
    const { container, unmount } = renderManager()
    expect(screen.queryByRole('button', { name: 'Maps key' })).toBeNull()
    unmount()
    state.mapsKey = ''
    const second = renderManager()
    expect(second.container.querySelector('.odc-pagehead-actions')).toContainElement(screen.getByRole('button', { name: 'Maps key' }))
    expect(container).toBeDefined()
  })

  it('W1-D-2: Open menu is a Product icon button with a name, only with the sidebar collapsed', () => {
    const { unmount } = renderManager()
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
    unmount()
    state.isCollapse = true
    renderManager()
    const menu = screen.getByRole('button', { name: 'Open menu' })
    expect(menu).toHaveClass('odc-btn')
    expect(menu).toHaveAttribute('data-icon-only')
    expect(menu).toHaveAttribute('title', 'Open menu')
    // the opener is PageHeader's `leading`, the first child of the lead block
    expect(menu.closest('.odc-pagehead-lead')?.firstElementChild).toBe(menu)
    expect(menu.querySelector('svg.lucide')).not.toBeNull()
    fireEvent.click(menu)
    expect(state.handleMenuCollapse).toHaveBeenCalledWith(false)
  })
})

describe('DriversManager search', () => {
  it('is the Product search field, named and with a placeholder', () => {
    const { container } = renderManager()
    const input = screen.getByRole('searchbox', { name: 'Search' })
    // redesign drivers-dashboard B4 (decision 3: the search covers the name and the phone, and the placeholder says so; the name stays «Search»)
    expect(input).toHaveAttribute('placeholder', 'Search by name or phone')
    expect(container.querySelector('.od-search-bar')).toBeNull()
  })

  // redesign tanda AB (O-3): the anatomy of /deliveries and /all-in-one: the search sits in the P/FilterBar under the head,
  // not at the top right of the head
  it('sits in the Product FilterBar under the head, not in the head actions', () => {
    const { container } = renderManager()
    const bar = screen.getByRole('group', { name: 'Driver filters' })
    expect(bar).toHaveClass('odc-filterbar')
    expect(bar.querySelector('.odc-filterbar-search')).toContainElement(screen.getByRole('searchbox', { name: 'Search' }))
    expect(container.querySelector('.odc-pagehead-actions .odc-search')).toBeNull()
    const head = container.querySelector('.odc-pagehead')
    expect(head.contains(bar)).toBe(false)
    expect(head.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('sends the text once, after the same 750ms wait as the old SearchBar', () => {
    vi.useFakeTimers()
    const props = baseProps()
    renderWithProviders(<DriversManager {...props} />, { initialEntries: [state.location] })
    const input = screen.getByRole('searchbox')
    fireEvent.change(input, { target: { value: 'a' } })
    fireEvent.change(input, { target: { value: 'ada' } })
    expect(props.handleChangeSearch).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(749) })
    expect(props.handleChangeSearch).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(props.handleChangeSearch).toHaveBeenCalledTimes(1)
    expect(props.handleChangeSearch).toHaveBeenCalledWith('ada')
  })

  it('clears at once with the X, without waiting', () => {
    state.search = 'ada'
    const props = baseProps()
    renderWithProviders(<DriversManager {...props} />, { initialEntries: [state.location] })
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(props.handleChangeSearch).toHaveBeenCalledWith('')
    expect(screen.getByRole('searchbox')).toHaveValue('')
  })

  it('shows a search set from outside (searchValue)', () => {
    state.search = 'ada'
    renderManager()
    expect(screen.getByRole('searchbox')).toHaveValue('ada')
  })
})

describe('DriversManager filter notice', () => {
  it('draws nothing without a search', () => {
    renderManager()
    expect(screen.queryByText('Filters applied. You may miss new orders.')).toBeNull()
  })

  it('with a search draws the notice in the flow (no absolute position) with the same text and Clear filters', () => {
    state.search = 'ada'
    const props = baseProps()
    const { container } = renderWithProviders(<DriversManager {...props} />, { initialEntries: [state.location] })
    const notice = screen.getByRole('status')
    expect(notice).toHaveClass('odc-notice')
    expect(notice).toHaveAttribute('data-tone', 'warning')
    expect(notice).toHaveTextContent('Filters applied. You may miss new orders.')
    expect(notice.querySelector('svg.lucide')).not.toBeNull()
    // in the flow: it is after the head and not inside it, and the container publishes the space it takes
    const head = container.querySelector('.odc-pagehead')
    expect(head.contains(notice)).toBe(false)
    // redesign tanda AB (O-3): and inside the filter bar, as the notice of /deliveries and /all-in-one
    expect(screen.getByRole('group', { name: 'Driver filters' })).toContainElement(notice)
    expect(container.querySelector('#driverDashboard')).toHaveAttribute('data-filtered')
    fireEvent.click(within(notice).getByRole('button', { name: 'Clear filters' }))
    expect(props.handleChangeSearch).toHaveBeenCalledWith('')
  })
})

// (row 26, drivers-dashboard P1, D-33): the group chosen on the board counts as a filter, like the search
describe('DriversManager filter notice · driver group', () => {
  it('gives the board an empty group choice and no notice', () => {
    const { container } = renderManager()
    expect(state.board.groupIds).toEqual([])
    expect(typeof state.board.onGroupIdsChange).toBe('function')
    expect(screen.queryByText('Filters applied. You may miss new orders.')).toBeNull()
    expect(container.querySelector('#driverDashboard')).not.toHaveAttribute('data-filtered')
  })

  it('with a group chosen draws the notice and marks the container as filtered', () => {
    const { container } = renderManager()
    act(() => { state.board.onGroupIdsChange([10]) })
    expect(state.board.groupIds).toEqual([10])
    expect(screen.getByRole('status')).toHaveTextContent('Filters applied. You may miss new orders.')
    expect(container.querySelector('#driverDashboard')).toHaveAttribute('data-filtered')
  })

  it('«Clear filters» clears the group', () => {
    const props = baseProps()
    const { container } = renderWithProviders(<DriversManager {...props} />, { initialEntries: [state.location] })
    act(() => { state.board.onGroupIdsChange([10, 20]) })
    fireEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Clear filters' }))
    expect(state.board.groupIds).toEqual([])
    expect(screen.queryByRole('status')).toBeNull()
    expect(container.querySelector('#driverDashboard')).not.toHaveAttribute('data-filtered')
    expect(props.handleChangeSearch).not.toHaveBeenCalled()
  })

  // (review L2): «Clear filters» lives in the notice, which unmounts when the filters clear: the focus must not fall to <body>
  it('«Clear filters» moves the focus to the search field when it clears the group', () => {
    renderManager()
    act(() => { state.board.onGroupIdsChange([10]) })
    const clear = within(screen.getByRole('status')).getByRole('button', { name: 'Clear filters' })
    clear.focus()
    fireEvent.click(clear)
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveFocus()
  })

  it('«Clear filters» moves the focus to the search field when it clears the search', () => {
    state.search = 'ada'
    renderManager()
    const clear = within(screen.getByRole('status')).getByRole('button', { name: 'Clear filters' })
    clear.focus()
    fireEvent.click(clear)
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveFocus()
  })

  it('«Clear filters» clears the search and the group together', () => {
    state.search = 'ada'
    const props = baseProps()
    renderWithProviders(<DriversManager {...props} />, { initialEntries: [state.location] })
    act(() => { state.board.onGroupIdsChange([10]) })
    fireEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Clear filters' }))
    expect(props.handleChangeSearch).toHaveBeenCalledWith('')
    expect(state.board.groupIds).toEqual([])
  })
})

// (row 28, driver-store-status P-1): /drivers-dashboard?groups=1,199 opens with the group filter already set
describe('DriversManager driver group from the URL (row 28)', () => {
  it('seeds the board with the groups of ?groups=, shows the notice and takes the param out of the URL', () => {
    state.location = '/drivers-dashboard?groups=1,199'
    const { container } = renderManager()
    expect(state.board.groupIds).toEqual([1, 199])
    expect(screen.getByRole('status')).toHaveTextContent('Filters applied. You may miss new orders.')
    expect(container.querySelector('#driverDashboard')).toHaveAttribute('data-filtered')
    expect(state.removeQuery).toHaveBeenCalledTimes(1)
    expect(state.removeQuery).toHaveBeenCalledWith(['groups'])
  })

  it('ignores invalid parts, and keeps ?id= out of what it removes', () => {
    state.location = '/drivers-dashboard?id=7&groups=abc,5,0'
    renderManager()
    expect(state.board.groupIds).toEqual([5])
    expect(state.removeQuery).toHaveBeenCalledWith(['groups'])
  })

  it('reads the param once: a later group change is not undone', () => {
    state.location = '/drivers-dashboard?groups=1'
    renderManager()
    act(() => { state.board.onGroupIdsChange([]) })
    expect(state.board.groupIds).toEqual([])
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('without the param nothing changes: no groups, no notice, nothing removed', () => {
    renderManager()
    expect(state.board.groupIds).toEqual([])
    expect(screen.queryByRole('status')).toBeNull()
    expect(state.removeQuery).not.toHaveBeenCalled()
  })

  it('with a ?groups= that holds no valid id, the board is unfiltered and the param still leaves', () => {
    state.location = '/drivers-dashboard?groups=x'
    renderManager()
    expect(state.board.groupIds).toEqual([])
    expect(screen.queryByRole('status')).toBeNull()
    expect(state.removeQuery).toHaveBeenCalledWith(['groups'])
  })
})

describe('DriversManager panel', () => {
  // redesign drivers-dashboard B4 (decision 5, DD-06): an incoming ?id= chooses the driver and waits for its orders before the sheet
  // opens, so the sheet lands on the tab of the group that holds them. The URL already says ?id=, so it is not written again.
  it('opens the sheet for an incoming ?id= once the chosen driver\'s orders load, and closes it through onDriverRedirect()', () => {
    state.stateful = true
    state.location = '/drivers-dashboard?id=7'
    const props = baseProps()
    renderWithProviders(<DriversManager {...props} />, { initialEntries: [state.location] })
    expect(state.board.selectedDriver).toMatchObject({ id: 7 })
    expect(screen.queryByRole('dialog')).toBeNull()
    act(() => { state.setAssigned({ loading: true, error: null, orders: [] }) })
    expect(screen.queryByRole('dialog')).toBeNull()
    act(() => { state.setAssigned({ loading: false, error: null, orders: [] }) })
    expect(screen.getByRole('dialog')).toHaveAttribute('data-user', '7')
    expect(props.onDriverRedirect).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Close sheet' }))
    expect(props.onDriverRedirect).toHaveBeenLastCalledWith()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('an incoming ?id= of a driver that is not in the list opens nothing', () => {
    state.stateful = true
    state.location = '/drivers-dashboard?id=99'
    renderWithProviders(<DriversManager {...baseProps()} />, { initialEntries: [state.location] })
    expect(state.board.selectedDriver).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('DriversManager · opening the orders sheet in its tab (decision 5, DD-06)', () => {
  const ada = { id: 7, name: 'Ada', assigned_orders_count: 2 }
  const renderStateful = (overrides = {}) => {
    state.stateful = true
    const props = baseProps()
    props.driversList = { drivers: [ada, { id: 8, name: 'Bea', assigned_orders_count: 1 }], loading: false }
    renderWithProviders(<DriversManager {...props} {...overrides} />, { initialEntries: [state.location] })
    return props
  }
  const load = (result) => {
    act(() => { state.setAssigned({ loading: true, error: null, orders: [] }) })
    act(() => { state.setAssigned({ loading: false, error: null, orders: [], ...result }) })
  }

  it('«n assigned orders» of a driver that is not chosen chooses it, writes the URL and waits with the button busy', () => {
    const props = renderStateful()
    act(() => { state.board.onOpenOrders(ada) })
    expect(state.board.selectedDriver).toMatchObject({ id: 7 })
    expect(props.onDriverRedirect).toHaveBeenCalledWith(7)
    expect(state.board.ordersOpeningId).toBe(7)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('does not open on the orders of the previous driver: the first render after choosing shows loading false', () => {
    renderStateful()
    act(() => { state.board.onOpenOrders(ada) })
    // the child effect runs before the controller\'s: loading is still false here, with the orders of whoever was chosen before
    act(() => { state.setAssigned({ loading: false, error: null, orders: [{ id: 1, status: 7 }] }) })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(state.board.ordersOpeningId).toBe(7)
  })

  it('opens in «In progress» when one of the orders is in progress', () => {
    renderStateful()
    act(() => { state.board.onOpenOrders(ada) })
    load({ orders: [{ id: 1, status: 0 }, { id: 2, status: 7 }] })
    expect(screen.getByRole('dialog')).toHaveAttribute('data-group', 'inProgress')
    expect(screen.getByRole('dialog')).toHaveAttribute('data-user', '7')
    expect(state.board.ordersOpeningId).toBeNull()
  })

  it('opens in «Pending» when the orders are only pending', () => {
    renderStateful()
    act(() => { state.board.onOpenOrders(ada) })
    load({ orders: [{ id: 1, status: 0 }, { id: 2, status: 13 }] })
    expect(screen.getByRole('dialog')).toHaveAttribute('data-group', 'pending')
  })

  it('opens with no group when the orders could not be loaded (the sheet opens in Pending as today)', () => {
    renderStateful()
    act(() => { state.board.onOpenOrders(ada) })
    load({ error: ['boom'] })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).not.toHaveAttribute('data-group')
  })

  it('opens at once with the group the panel gives it, without choosing or waiting', () => {
    const props = renderStateful()
    act(() => { state.board.onOpenOrders(ada, 'pending') })
    expect(screen.getByRole('dialog')).toHaveAttribute('data-group', 'pending')
    expect(props.onDriverRedirect).toHaveBeenCalledWith(7)
    expect(state.board.ordersOpeningId).toBeNull()
  })

  it('opens at once when the driver is already chosen and its orders are loaded', () => {
    renderStateful()
    act(() => { state.board.onSelectDriver(ada) })
    load({ orders: [{ id: 1, status: 8 }] })
    act(() => { state.board.onOpenOrders(ada) })
    expect(screen.getByRole('dialog')).toHaveAttribute('data-group', 'inProgress')
    expect(state.board.ordersOpeningId).toBeNull()
  })

  it('opens without a group after 8 seconds if the orders never finish', () => {
    vi.useFakeTimers()
    renderStateful()
    act(() => { state.board.onOpenOrders(ada) })
    act(() => { vi.advanceTimersByTime(7999) })
    expect(screen.queryByRole('dialog')).toBeNull()
    act(() => { vi.advanceTimersByTime(1) })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).not.toHaveAttribute('data-group')
    expect(state.board.ordersOpeningId).toBeNull()
  })

  it('does not open if the person chooses another driver while it waits', () => {
    renderStateful()
    act(() => { state.board.onOpenOrders(ada) })
    act(() => { state.board.onSelectDriver({ id: 8, name: 'Bea' }) })
    load({ orders: [{ id: 1, status: 7 }] })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(state.board.ordersOpeningId).toBeNull()
  })

  it('an event of the socket that rebuilds the drivers does not reopen an ?id= that was already attended', () => {
    state.location = '/drivers-dashboard?id=7'
    renderStateful()
    load({ orders: [{ id: 1, status: 7 }] })
    expect(screen.getByRole('dialog')).toHaveAttribute('data-group', 'inProgress')
    fireEvent.click(screen.getByRole('button', { name: 'Close sheet' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    // the location still says ?id=7 here (onDriverRedirect is a spy), as it would for the instant before the URL changes
    act(() => { state.setDrivers([{ ...ada, assigned_orders_count: 3 }, { id: 8, name: 'Bea' }]) })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('the × of the panel lets go of the chosen driver', () => {
    renderStateful()
    act(() => { state.board.onSelectDriver(ada) })
    expect(state.board.selectedDriver).toMatchObject({ id: 7 })
    act(() => { state.board.onClosePanel() })
    expect(state.board.selectedDriver).toBeNull()
  })
})

describe('DriversManager · the clock and the orders of the chosen driver (decisions 4, 6)', () => {
  it('gives the board a clock that moves every minute', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-09T12:00:00Z'))
    renderManager()
    const first = state.board.now
    expect(first).toBe(Date.parse('2026-10-09T12:00:00Z'))
    act(() => { vi.advanceTimersByTime(59999) })
    expect(state.board.now).toBe(first)
    act(() => { vi.advanceTimersByTime(1) })
    expect(state.board.now).toBe(first + 60000)
  })

  it('stops the clock when it unmounts', () => {
    vi.useFakeTimers()
    const { unmount } = renderManager()
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('update_order changes the status of an order of the chosen driver on the board, and nothing else', () => {
    state.stateful = true
    renderWithProviders(<DriversManager {...baseProps()} />, { initialEntries: [state.location] })
    act(() => { state.board.onSelectDriver({ id: 7, name: 'Ada' }) })
    const orders = [{ id: 11, status: 0 }, { id: 12, status: 7 }]
    act(() => { state.setAssigned({ loading: false, error: null, orders }) })
    act(() => { state.listeners.update_order.forEach(fn => fn({ id: 11, status: 7 })) })
    expect(state.board.assignedOrders.orders).toEqual([{ id: 11, status: 7 }, { id: 12, status: 7 }])
    // an order that is not the driver's is ignored
    act(() => { state.listeners.update_order.forEach(fn => fn({ id: 99, status: 1 })) })
    expect(state.board.assignedOrders.orders.map(order => order.id)).toEqual([11, 12])
    expect(orders[0].status).toBe(0)
  })

  it('a reload of the orders brings the good statuses and drops the ones the socket put', () => {
    state.stateful = true
    renderWithProviders(<DriversManager {...baseProps()} />, { initialEntries: [state.location] })
    act(() => { state.board.onSelectDriver({ id: 7, name: 'Ada' }) })
    act(() => { state.setAssigned({ loading: false, error: null, orders: [{ id: 11, status: 0 }] }) })
    act(() => { state.listeners.update_order.forEach(fn => fn({ id: 11, status: 7 })) })
    expect(state.board.assignedOrders.orders[0].status).toBe(7)
    act(() => { state.setAssigned({ loading: false, error: null, orders: [{ id: 11, status: 0 }] }) })
    expect(state.board.assignedOrders.orders[0].status).toBe(0)
  })

  it('stops listening to update_order when it unmounts', () => {
    state.stateful = true
    const { unmount } = renderWithProviders(<DriversManager {...baseProps()} />, { initialEntries: [state.location] })
    expect(state.listeners.update_order.size).toBe(1)
    unmount()
    expect(state.listeners.update_order.size).toBe(0)
  })
})

describe('DriversManager source', () => {
  const dir = path.resolve(__dirname, '..')
  // the import lines only: the comments say what was replaced
  const code = fs.readFileSync(path.join(dir, 'index.js'), 'utf8').split('\n').filter(line => /^\s*(import|\} from)/.test(line)).join('\n')
  const styles = fs.readFileSync(path.join(dir, 'styles.js'), 'utf8')

  it('has no legacy buttons, legacy SearchBar, bootstrap-icons or meronex left', () => {
    expect(code).not.toMatch(/react-bootstrap-icons|@meronex\/icons|styles\/Buttons|\bSearchBar\b/)
  })

  it('has no absolute-positioned notice and no px literal for the head in the styles', () => {
    expect(styles).not.toMatch(/position:\s*absolute/)
    expect(styles).not.toMatch(/top:\s*50px/)
  })
})
