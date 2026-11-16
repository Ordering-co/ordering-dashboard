/* eslint-disable import/first */
// redesign 5.2: the list states are Product EmptyState / DataTable loading, and the list tools
// (sort text, density, columns) and the selection bar live here. The first three tests keep
// what the old empty-state tests protected, in the new markup.
import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ level: 0, configs: {}, tableProps: null, replace: vi.fn() }))

// redesign 5.2 audit-1: the first-run action asks the router for the same `?add=custom_order` the palette uses.
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useHistory: () => ({ replace: mocks.replace, location: { pathname: '/orders' } })
}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, text) => text],
  useConfig: () => [{ configs: mocks.configs }],
  useSession: () => [{ user: { level: mocks.level } }],
  // select all N: the list asks for the project to know if final orders are locked
  useApi: () => [{ project: 'demo' }]
}))
vi.mock('../../OrdersTable', () => ({
  OrdersTable: (props) => {
    mocks.tableProps = props
    return <div data-testid='table' />
  }
}))
vi.mock('../../OrdersCards', () => ({ OrdersCards: () => <div data-testid='cards' /> }))
vi.mock('../../OrderStatusTypeSelector', () => ({
  OrderStatusTypeSelector: (props) => (
    <button type='button' data-mode={props.mutiOrdersChange ? 'multi' : 'single'} onClick={() => props.handleChangeMultiOrdersStatus(7)}>Change status</button>
  )
}))
vi.mock('../../OrderDelete', () => ({
  OrderDelete: (props) => <button type='button' data-variant={props.triggerVariant} onClick={props.handleDeleteMultiOrders}>Delete</button>
}))
vi.mock('../../OrdersDashboardControls/styles', () => ({
  WrapOrderStatusTypeSelector: ({ children }) => <div>{children}</div>
}))
vi.mock('~/analytics/useTrackedLoadState', () => ({ useTrackedLoadState: () => {} }))

import { FilterValuesContext } from '../../../../contexts/FilterValuesContext'
import { OrdersListing } from '..'
import { ORDERS_AMOUNT_UNAVAILABLE } from '../../OrderStatusFilterBar'

const EMPTY_FILTERS = { orderId: null, statuses: [], businessIds: [], customerName: null }

const column = (order, visable = true, extra = {}) => ({ visable, title: extra.title ?? '', className: extra.className ?? 'keep-me', draggable: false, colSpan: 1, order, ...extra })

// Model of OrdersManage with the SLA column forced on.
const defaultColumns = (overrides = {}) => ({
  slaBar: column(-2, true),
  orderNumber: column(-1),
  dateTime: column(0),
  externalId: column(1, false, { title: 'External ID' }),
  status: column(2, true, { title: 'Status' }),
  agent: column(3, false, { title: 'Agent' }),
  cartGroupId: column(4, true, { title: 'Group order' }),
  driverGroupId: column(5, true, { title: 'Driver group ID' }),
  business: column(6, true, { title: 'Business' }),
  customer: column(7, true, { title: 'Customer' }),
  driver: column(8, true, { title: 'Driver' }),
  advanced: column(9, true, { title: 'Advanced logistics', colSpan: 3 }),
  cloned: column(10, true, { title: 'Cloned' }),
  timer: column(11, true, { title: 'SLA timer' }),
  eta: column(12, true, { title: 'ETA' }),
  channel: column(13, false, { title: 'Channel' }),
  pod: column(14, true, { title: 'Pod' }),
  total: column(15),
  ...overrides
})

const renderListing = ({ filters = EMPTY_FILTERS, searchValue = null, orderListView = 'table', ...rest } = {}) => {
  const handleFilterValues = vi.fn()
  const handleChangeSearch = vi.fn()
  const handleChangeFilterValues = vi.fn()
  const props = {
    orderList: { loading: false, orders: [] },
    pagination: { total: 0, currentPage: 1, pageSize: 10 },
    ordersStatusGroup: 'pending',
    groupStatus: 'pending',
    orderListView,
    filterValues: filters,
    searchValue,
    handleChangeSearch,
    handleChangeFilterValues,
    allowColumns: defaultColumns(),
    setAllowColumns: vi.fn(),
    saveUserSettings: vi.fn(),
    selectedOrderIds: [],
    setSelectedOrderIds: vi.fn(),
    handleChangeMultiOrdersStatus: vi.fn(),
    handleDeleteMultiOrders: vi.fn(),
    getPageOrders: vi.fn(),
    ...rest
  }
  const view = render(
    <FilterValuesContext.Provider value={[filters, { handleFilterValues }]}>
      <OrdersListing {...props} />
    </FilterValuesContext.Provider>
  )
  return { handleFilterValues, handleChangeSearch, handleChangeFilterValues, props, ...view }
}

const withOrders = { orderList: { loading: false, orders: [{ id: 1 }] }, pagination: { total: 1, currentPage: 1, pageSize: 10 } }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.level = 0
  mocks.configs = {}
  mocks.tableProps = null
  window.localStorage.clear()
})
afterEach(() => {
  vi.restoreAllMocks()
  document.getElementById('orders-list-tools')?.remove()
})

describe('OrdersListing empty state', () => {
  // redesign 5.2 audit-1: «No Orders yet.» became three cases (C10). Without tab counters the list
  // cannot claim it is the first time, so it only says its own tab is empty.
  it('says the tab is empty, in sentence case and without a full stop, when it has no counters to compare', () => {
    renderListing()
    expect(screen.getByText('No pending orders')).toBeTruthy()
    expect(screen.queryByText('No orders match these filters')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Create custom order' })).toBeNull()
  })

  // redesign 5.2 audit-1: the copy of the empty tab changed, so the negative assertion follows it.
  it('says no orders match when filters are active and clears them with the warning action', () => {
    const filters = { ...EMPTY_FILTERS, statuses: [1], customerName: 'ana' }
    const { handleFilterValues, handleChangeSearch, handleChangeFilterValues } = renderListing({ filters })
    expect(screen.getByText('No orders match these filters')).toBeTruthy()
    expect(screen.queryByText('No pending orders')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(handleFilterValues).toHaveBeenCalledWith({ orderId: null, statuses: [], businessIds: [], customerName: null })
    expect(handleChangeFilterValues).toHaveBeenCalledWith({})
    expect(handleChangeSearch).not.toHaveBeenCalled()
  })

  // redesign fix-qa E7 (main: OrdersListing:227-239): an empty result with filters also offers «Filters», which
  // opens the filter sheet, next to «Clear filters».
  it('offers Filters, which opens the filter sheet, next to Clear filters', () => {
    const setFilterModalOpen = vi.fn()
    renderListing({ filters: { ...EMPTY_FILTERS, statuses: [1] }, setFilterModalOpen })
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }))
    expect(setFilterModalOpen).toHaveBeenCalledWith(true)
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeTruthy()
  })

  it('has no Filters button where the page gives it no sheet to open (lateral lists)', () => {
    renderListing({ filters: { ...EMPTY_FILTERS, statuses: [1] } })
    expect(screen.queryByRole('button', { name: 'Filters' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeTruthy()
  })

  it('treats an active search as filters, names it, and clears the search text', () => {
    const { handleFilterValues, handleChangeSearch } = renderListing({ searchValue: 'zzz', orderListView: 'cards' })
    expect(screen.getByText('No orders match these filters')).toBeTruthy()
    expect(screen.getByText('Nothing matches “zzz”.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(handleChangeSearch).toHaveBeenCalledWith('')
    expect(handleFilterValues).not.toHaveBeenCalled()
  })

  // redesign 5.2 audit-1: the empty tab now says which tab is empty.
  it('draws the empty state with the filter icon when filters hide everything, and the inbox when the tab is empty', () => {
    const { container, unmount } = renderListing({ filters: { ...EMPTY_FILTERS, customerName: 'ana' } })
    expect(container.querySelector('.odc-state svg')).toBeTruthy()
    expect(screen.getByText('Try removing a filter.')).toBeTruthy()
    unmount()
    renderListing()
    expect(screen.getByText('No pending orders').closest('.odc-state')).toBeTruthy()
  })
})

// redesign 5.2 audit-1 (C10): the three empty cases. The counters are the ones of the status tabs.
describe('OrdersListing empty cases (audit 1)', () => {
  const ALL_ZERO = { pending: 0, inProgress: 0, completed: 0, cancelled: 0 }

  beforeEach(() => mocks.replace.mockClear())

  it('first time: every tab at zero and no filter or search says «No orders yet», one line and Create custom order', () => {
    const { container } = renderListing({ ordersAmountByStatus: ALL_ZERO })
    const state = container.querySelector('.odc-state')
    expect(within(state).getByText('No orders yet')).toBeTruthy()
    expect(within(state).getByText('New orders will appear here as they come in')).toBeTruthy()
    expect(within(state).getByRole('button', { name: 'Create custom order' })).toBeTruthy()
    expect(state.textContent).not.toMatch(/\.$/)
    expect(container.querySelector('.odc-state-action button')).toHaveAttribute('data-variant', 'secondary')
  })

  it('the first-time action opens what the header button opens: ?add=custom_order, keeping the rest of the query', async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, '', '/orders?status=pending&page=1')
    try {
      renderListing({ ordersAmountByStatus: ALL_ZERO })
      await user.click(screen.getByRole('button', { name: 'Create custom order' }))
      expect(mocks.replace).toHaveBeenCalledTimes(1)
      const target = mocks.replace.mock.calls[0][0]
      expect(target.pathname).toBe('/orders')
      expect(Object.fromEntries(new URLSearchParams(target.search))).toEqual({ status: 'pending', page: '1', add: 'custom_order' })
    } finally {
      window.history.replaceState(null, '', '/')
    }
  })

  it('first time, but only level 0 can create: the others get the text and no action', () => {
    mocks.level = 5
    renderListing({ ordersAmountByStatus: ALL_ZERO })
    expect(screen.getByText('No orders yet')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Create custom order' })).toBeNull()
  })

  it('first time inside a lateral bar (no page header to open the form from): no action', () => {
    renderListing({ ordersAmountByStatus: ALL_ZERO, isSelectedOrders: true })
    expect(screen.getByText('No orders yet')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Create custom order' })).toBeNull()
  })

  it.each([
    ['pending', 'No pending orders'],
    ['inProgress', 'No in-progress orders'],
    ['completed', 'No completed orders'],
    ['cancelled', 'No cancelled orders']
  ])('empty %s tab while other tabs have orders says «%s», without an action', (status, text) => {
    const { container } = renderListing({
      ordersStatusGroup: status,
      groupStatus: status,
      ordersAmountByStatus: { ...ALL_ZERO, [status === 'pending' ? 'completed' : 'pending']: 3 }
    })
    expect(screen.getByText(text)).toBeTruthy()
    expect(screen.queryByText('No orders yet')).toBeNull()
    expect(container.querySelector('.odc-state button')).toBeNull()
  })

  it('a counter that is still loading or could not load is not a zero: never the first-time case', () => {
    const { unmount } = renderListing({ ordersAmountByStatus: { ...ALL_ZERO, completed: null } })
    expect(screen.getByText('No pending orders')).toBeTruthy()
    unmount()
    renderListing({ ordersAmountByStatus: { ...ALL_ZERO, cancelled: ORDERS_AMOUNT_UNAVAILABLE } })
    expect(screen.getByText('No pending orders')).toBeTruthy()
    expect(screen.queryByText('No orders yet')).toBeNull()
  })

  it('with filters or a search the answer is still «No orders match», even with every counter at zero', () => {
    const { unmount } = renderListing({ ordersAmountByStatus: ALL_ZERO, filters: { ...EMPTY_FILTERS, customerName: 'ana' } })
    expect(screen.getByText('No orders match these filters')).toBeTruthy()
    expect(screen.queryByText('No orders yet')).toBeNull()
    unmount()
    renderListing({ ordersAmountByStatus: ALL_ZERO, searchValue: 'zzz' })
    expect(screen.getByText('No orders match these filters')).toBeTruthy()
  })

  it('a list without a status group (messages, deliveries) says plainly «No orders»', () => {
    renderListing({ ordersStatusGroup: undefined, groupStatus: undefined, isMessagesView: true })
    expect(screen.getByText('No orders')).toBeTruthy()
  })
})

describe('OrdersListing reports a failed load to the tab counter (audit 1)', () => {
  it('says the total is unavailable when the load fails, and the real total again once it recovers', () => {
    const setOrdersTotalAmount = vi.fn()
    const failed = { loading: false, orders: [], error: ['Network error'] }
    const { rerender, props } = renderListing({ orderList: failed, pagination: { currentPage: 1, pageSize: 10 }, setOrdersTotalAmount })
    expect(setOrdersTotalAmount).toHaveBeenLastCalledWith(ORDERS_AMOUNT_UNAVAILABLE)
    rerender(
      <FilterValuesContext.Provider value={[EMPTY_FILTERS, { handleFilterValues: vi.fn() }]}>
        <OrdersListing {...props} orderList={{ loading: false, orders: [{ id: 1 }] }} pagination={{ total: 7, currentPage: 1, pageSize: 10 }} />
      </FilterValuesContext.Provider>
    )
    expect(setOrdersTotalAmount).toHaveBeenLastCalledWith(7)
  })

  it('keeps reporting the number when a reload fails but the orders are still on screen', () => {
    const setOrdersTotalAmount = vi.fn()
    renderListing({
      orderList: { loading: false, orders: [{ id: 1 }], error: ['Network error'] },
      pagination: { total: 4, currentPage: 1, pageSize: 10 },
      setOrdersTotalAmount
    })
    expect(setOrdersTotalAmount).toHaveBeenLastCalledWith(4)
  })

  it('does not report anything while the total is not a number yet and nothing failed', () => {
    const setOrdersTotalAmount = vi.fn()
    renderListing({ orderList: { loading: true, orders: [] }, pagination: {}, setOrdersTotalAmount })
    expect(setOrdersTotalAmount).not.toHaveBeenCalled()
  })
})

describe('OrdersListing loading and error', () => {
  // redesign 5.2 audit-1: the copy of the empty tab changed, so the negative assertion follows it.
  it('shows the table (its own skeleton) while loading, never the empty state', () => {
    renderListing({ orderList: { loading: true, orders: [] }, pagination: {} })
    expect(screen.getByTestId('table')).toBeTruthy()
    expect(screen.queryByText('No pending orders')).toBeNull()
  })

  it('says it could not load and tries the current page again', async () => {
    const user = userEvent.setup()
    const { props } = renderListing({ orderList: { loading: false, orders: [], error: ['Network error'] }, pagination: { currentPage: 3, pageSize: 25 } })
    const alert = screen.getByRole('alert')
    expect(within(alert).getByText('We couldn’t load the orders')).toBeTruthy()
    expect(screen.queryByTestId('table')).toBeNull()
    await user.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(props.getPageOrders).toHaveBeenCalledWith(25, 3)
  })

  it('keeps showing the orders it already has when a reload fails', () => {
    renderListing({ ...withOrders, orderList: { loading: false, orders: [{ id: 1 }], error: ['Network error'] } })
    expect(screen.getByTestId('table')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('OrdersListing tools', () => {
  it('puts the tools in a row of their own when the filter bar slot does not exist', () => {
    const { container } = renderListing(withOrders)
    const row = container.querySelector('.odc-orders-tools-row')
    expect(row).toBeTruthy()
    expect(within(row).getByRole('button', { name: 'Compact rows' })).toBeTruthy()
    expect(within(row).getByRole('button', { name: 'Manage columns' })).toBeTruthy()
  })

  it('puts the tools in the filter bar slot when there is one, through a portal', () => {
    const slot = document.createElement('div')
    slot.id = 'orders-list-tools'
    document.body.appendChild(slot)
    const { container } = renderListing(withOrders)
    expect(within(slot).getByRole('button', { name: 'Compact rows' })).toBeTruthy()
    expect(within(slot).getByRole('button', { name: 'Manage columns' })).toBeTruthy()
    expect(container.querySelector('.odc-orders-tools-row')).toBeNull()
  })

  it('draws them only in the instance of the visible tab', () => {
    renderListing({ ...withOrders, ordersStatusGroup: 'completed', groupStatus: 'pending' })
    expect(screen.queryByRole('button', { name: 'Compact rows' })).toBeNull()
    expect(screen.queryByTestId('table')).toBeNull()
  })

  it('draws no tools for the card view', () => {
    renderListing({ ...withOrders, orderListView: 'cards' })
    expect(screen.queryByRole('button', { name: 'Manage columns' })).toBeNull()
  })

  // (owner decision 2, 2026-10-27): the order of in progress is a choice again, as main's newest first
  it('offers the order of in progress as a menu of two choices, and says which one is on', async () => {
    const user = userEvent.setup()
    const onInProgressSortChange = vi.fn()
    renderListing({ ...withOrders, orderBy: 'delivery_datetime', orderDirection: 'asc', inProgressSort: 'delivery', onInProgressSortChange })
    const trigger = screen.getByRole('button', { name: /Earliest delivery first/ })
    await user.click(trigger)
    const menu = await screen.findByRole('menu')
    expect(within(menu).getAllByRole('menuitemradio').map(item => item.textContent)).toEqual(['Earliest delivery first', 'Newest first'])
    expect(within(menu).getByRole('menuitemradio', { name: 'Earliest delivery first' })).toHaveAttribute('aria-checked', 'true')
    await user.click(within(menu).getByRole('menuitemradio', { name: 'Newest first' }))
    expect(onInProgressSortChange).toHaveBeenCalledWith('newest')
  })

  it('without the choice (other tabs, lateral lists) there is no sort control', () => {
    renderListing({ ...withOrders, orderBy: 'id', orderDirection: 'desc' })
    expect(screen.queryByRole('button', { name: /Earliest delivery first|Newest first/ })).toBeNull()
    expect(screen.queryByText('Earliest delivery first')).toBeNull()
  })

  it('gives the table the density, the columns and a way to report the columns it drops', () => {
    const allowColumns = defaultColumns()
    renderListing({ ...withOrders, allowColumns })
    expect(mocks.tableProps.density).toBe('comfortable')
    expect(mocks.tableProps.allowColumns).toBe(allowColumns)
    expect(typeof mocks.tableProps.onWidthHiddenChange).toBe('function')
  })
})

describe('OrdersListing density', () => {
  it('starts comfortable, switches to compact, and remembers it for the browser', async () => {
    const user = userEvent.setup()
    const { unmount } = renderListing(withOrders)
    const toggle = screen.getByRole('button', { name: 'Compact rows' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await user.click(toggle)
    expect(screen.getByRole('button', { name: 'Compact rows' })).toHaveAttribute('aria-pressed', 'true')
    expect(mocks.tableProps.density).toBe('compact')
    expect(window.localStorage.getItem('od.orders.density')).toBe('compact')
    unmount()
    renderListing(withOrders)
    expect(screen.getByRole('button', { name: 'Compact rows' })).toHaveAttribute('aria-pressed', 'true')
    expect(mocks.tableProps.density).toBe('compact')
    await user.click(screen.getByRole('button', { name: 'Compact rows' }))
    expect(window.localStorage.getItem('od.orders.density')).toBe('comfortable')
  })

  it('keeps working when the browser refuses to read or write the preference', async () => {
    const user = userEvent.setup()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    renderListing(withOrders)
    await user.click(screen.getByRole('button', { name: 'Compact rows' }))
    expect(screen.getByRole('button', { name: 'Compact rows' })).toHaveAttribute('aria-pressed', 'true')
    expect(mocks.tableProps.density).toBe('compact')
  })
})

// redesign F6d-4b (Q3-04): the controller starts with a default model (the SLA column and the timer off) and swaps it for the saved
// one; the list tells the table which of the two it is holding, so the table does not draw the default set first.
describe('OrdersListing tells the table whether the columns are the saved ones (Q3-04)', () => {
  it('says they are not while the model is the controller starting one (SLA and timer both off)', () => {
    renderListing({ ...withOrders, allowColumns: defaultColumns({ slaBar: column(-2, false), timer: column(11, false, { title: 'SLA timer' }) }) })
    expect(mocks.tableProps.columnsReady).toBe(false)
  })

  it.each([
    ['the SLA column is on', { slaBar: column(-2, true), timer: column(11, false, { title: 'SLA timer' }) }],
    ['the timer is on', { slaBar: column(-2, false), timer: column(11, true, { title: 'SLA timer' }) }],
    ['both are on', {}]
  ])('says they are once the controller has swapped it (%s)', (_name, overrides) => {
    renderListing({ ...withOrders, allowColumns: defaultColumns(overrides) })
    expect(mocks.tableProps.columnsReady).toBe(true)
  })
})

describe('OrdersListing column manager', () => {
  const openManager = async (user) => {
    await user.click(screen.getByRole('button', { name: 'Manage columns' }))
    return screen.findByRole('dialog', { name: 'Manage columns' })
  }
  const savedShape = (props) => JSON.parse(JSON.stringify(props.setAllowColumns.mock.calls.at(-1)[0]))

  it('lists the columns of today with their labels, in the saved order, and locks order and status (Total is free since )', async () => {
    const user = userEvent.setup()
    renderListing(withOrders)
    const dialog = await openManager(user)
    const labels = within(dialog).getAllByRole('checkbox').map(box => box.textContent)
    expect(labels).toEqual([
      // Copy decision 4 (user, 2026-10-06): «Order No.» reads «Order number».
      // redesign F6c: POD is an acronym (Q2-17), so it is not «Pod» in sentence case.
      'Order number', 'Date and time', 'External ID', 'Status', 'Agent', 'Group order', 'Driver group ID', 'Business',
      'Customer', 'Driver', 'Advanced logistics', 'Cloned', 'SLA timer', 'ETA', 'Channel', 'POD', 'Total'
    ])
    ;['Order number', 'Status'].forEach(label => expect(within(dialog).getByRole('checkbox', { name: new RegExp(`^${label}`) })).toBeDisabled())
    expect(within(dialog).getByRole('checkbox', { name: /^Total/ })).toBeEnabled()
    expect(within(dialog).getByRole('checkbox', { name: /^Agent/ })).toHaveAttribute('aria-checked', 'false')
    expect(within(dialog).getByRole('checkbox', { name: /^Business/ })).toHaveAttribute('aria-checked', 'true')
  })

  // redesign F6e-3 (P5-04): the SLA timer column only draws in Pending and In progress, but its checkbox is the one shared preference
  // (as in main): it can be changed from any tab, and outside those two the note says where it shows.
  it.each([['pending', false], ['inProgress', false], ['completed', true], ['cancelled', true]])(
    'SLA timer in the %s tab: enabled, and the note is shown is %s',
    async (status, noted) => {
      const user = userEvent.setup()
      renderListing({ ...withOrders, ordersStatusGroup: status, groupStatus: status })
      const dialog = await openManager(user)
      const box = within(dialog).getByRole('checkbox', { name: /^SLA timer/ })
      expect(box).not.toBeDisabled()
      expect(box).toHaveAttribute('aria-checked', 'true')
      if (noted) {
        expect(box).toHaveAccessibleDescription('Only shown in Pending and In progress')
      } else {
        expect(within(dialog).queryByText('Only shown in Pending and In progress')).toBeNull()
      }
    }
  )

  it.each(['completed', 'cancelled'])('saves the SLA timer preference when it is changed from the %s tab', async (status) => {
    const user = userEvent.setup()
    const { props } = renderListing({ ...withOrders, ordersStatusGroup: status, groupStatus: status })
    const dialog = await openManager(user)
    await user.click(within(dialog).getByRole('checkbox', { name: /^SLA timer/ }))
    expect(props.setAllowColumns).toHaveBeenCalledTimes(1)
    expect(savedShape(props).timer.visable).toBe(false)
    await waitFor(() => expect(props.saveUserSettings).toHaveBeenCalledTimes(1))
  })

  it('shows visibility with the same shape the controller saves: the whole map with visable and order', async () => {
    const user = userEvent.setup()
    const { props } = renderListing(withOrders)
    await openManager(user)
    await user.click(screen.getByRole('checkbox', { name: /^Agent/ }))
    expect(props.setAllowColumns).toHaveBeenCalledTimes(1)
    const next = savedShape(props)
    expect(next.agent).toEqual({ ...defaultColumns().agent, visable: true })
    // nothing else changed, titles and class names included
    expect({ ...next, agent: undefined }).toEqual({ ...defaultColumns(), agent: undefined })
    await waitFor(() => expect(props.saveUserSettings).toHaveBeenCalledTimes(1))
    expect(props.saveUserSettings).toHaveBeenCalledWith(next)
  })

  it('hides a column and saves it', async () => {
    const user = userEvent.setup()
    const { props } = renderListing(withOrders)
    await openManager(user)
    await user.click(screen.getByRole('checkbox', { name: /^Business/ }))
    expect(savedShape(props).business.visable).toBe(false)
    await waitFor(() => expect(props.saveUserSettings).toHaveBeenCalledTimes(1))
    expect(props.saveUserSettings.mock.calls[0][0].business.visable).toBe(false)
  })

  it('reorders by moving a column up: the two columns trade their order values', async () => {
    const user = userEvent.setup()
    const { props } = renderListing(withOrders)
    await openManager(user)
    await user.click(screen.getByRole('button', { name: 'Move Customer up' }))
    const next = savedShape(props)
    expect(next.customer.order).toBe(6)
    expect(next.business.order).toBe(7)
    // the SLA column is not in the manager and keeps its place
    expect(next.slaBar.order).toBe(-2)
    await waitFor(() => expect(props.saveUserSettings).toHaveBeenCalledWith(next))
  })

  it('saves once for a burst of changes (a drag moves the column many times)', async () => {
    const user = userEvent.setup()
    const { props } = renderListing(withOrders)
    await openManager(user)
    await user.click(screen.getByRole('button', { name: 'Move Customer up' }))
    await user.click(screen.getByRole('button', { name: 'Move Customer up' }))
    expect(props.setAllowColumns).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(props.saveUserSettings).toHaveBeenCalled())
    expect(props.saveUserSettings).toHaveBeenCalledTimes(1)
  })

  it('does not lose a pending save when the list goes away', async () => {
    const user = userEvent.setup()
    const { props, unmount } = renderListing(withOrders)
    await openManager(user)
    await user.click(screen.getByRole('checkbox', { name: /^Agent/ }))
    expect(props.saveUserSettings).not.toHaveBeenCalled()
    unmount()
    expect(props.saveUserSettings).toHaveBeenCalledTimes(1)
  })

  it('resets order and visibility to the defaults of the controller and keeps titles and classes', async () => {
    const user = userEvent.setup()
    const changed = defaultColumns({
      agent: column(3, true, { title: 'Agent' }),
      business: column(7, false, { title: 'Business' }),
      customer: column(6, true, { title: 'Customer' }),
      timer: column(11, false, { title: 'SLA timer' })
    })
    const { props } = renderListing({ ...withOrders, allowColumns: changed })
    await openManager(user)
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    const next = savedShape(props)
    expect(next.agent).toEqual({ ...changed.agent, visable: false, order: 3 })
    expect(next.business.visable).toBe(true)
    expect(next.business.order).toBe(6)
    expect(next.customer.order).toBe(7)
    expect(next.timer.visable).toBe(true)
    expect(next.business.className).toBe('keep-me')
    await waitFor(() => expect(props.saveUserSettings).toHaveBeenCalledWith(next))
  })

  it('says which columns the table dropped at this width', async () => {
    const user = userEvent.setup()
    renderListing(withOrders)
    act(() => mocks.tableProps.onWidthHiddenChange(['business']))
    const dialog = await openManager(user)
    const business = within(dialog).getByRole('checkbox', { name: /^Business/ })
    expect(business.closest('li')).toHaveTextContent('Hidden at this width')
    expect(within(dialog).getByRole('checkbox', { name: /^Customer/ }).closest('li')).not.toHaveTextContent('Hidden at this width')
  })

  it('with change_order_id on, the first entry is the date and there is no separate date toggle', async () => {
    const user = userEvent.setup()
    mocks.configs = { change_order_id: { value: '1' } }
    renderListing({
      ...withOrders,
      allowColumns: defaultColumns({ orderNumber: column(-1, false), dateTime: column(-1, true) })
    })
    const dialog = await openManager(user)
    const labels = within(dialog).getAllByRole('checkbox').map(box => box.textContent)
    expect(labels[0]).toBe('Date')
    expect(labels).not.toContain('Date and time')
    expect(within(dialog).getByRole('checkbox', { name: /^Date/ })).toBeDisabled()
  })

  // redesign fix-qa E7: with change_order_id on, the external id is what names the order (the number is not
  // shown), so a visible External ID column is locked like Order and Status.
  it('locks External ID while it is the identifier (change_order_id on and the column visible)', async () => {
    const user = userEvent.setup()
    mocks.configs = { change_order_id: { value: '1' } }
    renderListing({
      ...withOrders,
      allowColumns: defaultColumns({ orderNumber: column(-1, false), dateTime: column(-1, true), externalId: column(1, true, { title: 'External ID' }) })
    })
    const dialog = await openManager(user)
    expect(within(dialog).getByRole('checkbox', { name: /^External ID/ })).toBeDisabled()
  })

  it('leaves External ID free when the order number is the identifier', async () => {
    const user = userEvent.setup()
    renderListing({ ...withOrders, allowColumns: defaultColumns({ externalId: column(1, true, { title: 'External ID' }) }) })
    const dialog = await openManager(user)
    expect(within(dialog).getByRole('checkbox', { name: /^External ID/ })).toBeEnabled()
  })

  it('lets the user bring back a locked column that an older setting had hidden', async () => {
    const user = userEvent.setup()
    const { props } = renderListing({ ...withOrders, allowColumns: defaultColumns({ status: column(2, false) }) })
    const dialog = await openManager(user)
    const status = within(dialog).getByRole('checkbox', { name: /^Status/ })
    expect(status).toBeEnabled()
    await user.click(status)
    expect(savedShape(props).status.visable).toBe(true)
  })

  // (owner decision 1 of the parity audit, 2026-10-27): main let the user hide Total; Status stays locked
  it('lets the user hide Total, as main did, while Status stays locked', async () => {
    const user = userEvent.setup()
    const { props } = renderListing(withOrders)
    const dialog = await openManager(user)
    expect(within(dialog).getByRole('checkbox', { name: /^Status/ })).toBeDisabled()
    const total = within(dialog).getByRole('checkbox', { name: /^Total/ })
    expect(total).toBeEnabled()
    await user.click(total)
    expect(savedShape(props).total.visable).toBe(false)
  })
})

describe('OrdersListing selection bar', () => {
  it('draws no bar without a selection', () => {
    renderListing(withOrders)
    expect(screen.queryByRole('region', { name: 'Actions for selected orders' })).toBeNull()
  })

  it('counts the selected orders and offers the bulk actions with the same handlers as before', async () => {
    const user = userEvent.setup()
    const { props } = renderListing({ ...withOrders, selectedOrderIds: [1, 2, 3] })
    const bar = screen.getByRole('region', { name: 'Actions for selected orders' })
    expect(within(bar).getByRole('status')).toHaveTextContent('3 selected')
    expect(within(bar).getByRole('button', { name: 'Change status' })).toHaveAttribute('data-mode', 'multi')
    await user.click(within(bar).getByRole('button', { name: 'Change status' }))
    expect(props.handleChangeMultiOrdersStatus).toHaveBeenCalledWith(7)
    await user.click(within(bar).getByRole('button', { name: 'Delete' }))
    expect(props.handleDeleteMultiOrders).toHaveBeenCalledTimes(1)
  })

  it('clears the selection with the close button and with Escape', async () => {
    const user = userEvent.setup()
    const { props } = renderListing({ ...withOrders, selectedOrderIds: [1] })
    await user.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(props.setSelectedOrderIds).toHaveBeenCalledWith([])
    props.setSelectedOrderIds.mockClear()
    screen.getByRole('button', { name: 'Change status' }).focus()
    await user.keyboard('{Escape}')
    expect(props.setSelectedOrderIds).toHaveBeenCalledWith([])
  })

  it('hides delete and status change from a driver manager, unless the project allows the batch update', () => {
    mocks.level = 5
    const { unmount } = renderListing({ ...withOrders, selectedOrderIds: [1] })
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Change status' })).toBeNull()
    unmount()
    mocks.configs = { allow_driver_manager_batch_update_order_status: { value: '1' } }
    renderListing({ ...withOrders, selectedOrderIds: [1] })
    expect(screen.getByRole('button', { name: 'Change status' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
  })

  // redesign 5.2 polish: the bar asks OrderDelete for its Product trigger.
  it('asks OrderDelete for the selection trigger', () => {
    renderListing({ ...withOrders, selectedOrderIds: [1] })
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveAttribute('data-variant', 'selection')
  })

  // redesign fix-qa E7: /all-in-one has its own selection controls and passes no bulk handlers; a bar whose
  // actions throw is worse than none.
  it('draws no bar when the page gives no bulk handlers (/all-in-one has its own controls)', () => {
    renderListing({ ...withOrders, selectedOrderIds: [1, 2], handleChangeMultiOrdersStatus: undefined, handleDeleteMultiOrders: undefined })
    expect(screen.queryByRole('region', { name: 'Actions for selected orders' })).toBeNull()
  })

  it('offers only the action whose handler arrives', () => {
    renderListing({ ...withOrders, selectedOrderIds: [1], handleDeleteMultiOrders: undefined })
    const bar = screen.getByRole('region', { name: 'Actions for selected orders' })
    expect(within(bar).getByRole('button', { name: 'Change status' })).toBeTruthy()
    expect(within(bar).queryByRole('button', { name: 'Delete' })).toBeNull()
  })

  it('has no bar where orders cannot be selected (customer and driver detail)', () => {
    renderListing({ ...withOrders, selectedOrderIds: [1], isSelectedOrders: true })
    expect(screen.queryByRole('region', { name: 'Actions for selected orders' })).toBeNull()
  })
})
