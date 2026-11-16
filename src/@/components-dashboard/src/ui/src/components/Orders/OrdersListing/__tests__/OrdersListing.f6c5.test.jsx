/* eslint-disable import/first */
// redesign F6c-5: the list says when the Status sub-filter is what empties it (Q2-01), says how a selection that
// outlives the page is made of (Q2-11), and the column manager names its columns the same way whatever the catalog says (Q2-17).
import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ level: 0, configs: {}, catalog: {} }))

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useHistory: () => ({ replace: vi.fn(), location: { pathname: '/orders' } })
}))
vi.mock('../../../../../../index', () => ({
  // `catalog` plays the API dictionary, which wins over the default text of a key it knows
  useLanguage: () => [{}, (key, text) => mocks.catalog[key] ?? text],
  useConfig: () => [{ configs: mocks.configs }],
  useSession: () => [{ user: { level: mocks.level } }],
  useApi: () => [{ project: 'demo' }]
}))
vi.mock('../../OrdersTable', () => ({ OrdersTable: () => <div data-testid='table' /> }))
vi.mock('../../OrdersCards', () => ({ OrdersCards: () => <div data-testid='cards' /> }))
vi.mock('../../OrderStatusTypeSelector', () => ({
  OrderStatusTypeSelector: (props) => (
    <button type='button' onClick={() => props.handleChangeMultiOrdersStatus(7)}>Change status</button>
  )
}))
vi.mock('../../OrderDelete', () => ({
  OrderDelete: (props) => <button type='button' onClick={props.handleDeleteMultiOrders}>Delete</button>
}))
vi.mock('../../OrdersDashboardControls/styles', () => ({
  WrapOrderStatusTypeSelector: ({ children }) => <div>{children}</div>
}))
vi.mock('~/analytics/useTrackedLoadState', () => ({ useTrackedLoadState: () => {} }))

import { FilterValuesContext } from '../../../../contexts/FilterValuesContext'
import { OrdersListing } from '..'

const EMPTY_FILTERS = { orderId: null, statuses: [], businessIds: [], customerName: null }
const PENDING_ALL = [0, 13]

const column = (order, visable = true, extra = {}) => ({ visable, title: extra.title ?? '', className: '', draggable: false, colSpan: 1, order, ...extra })
const defaultColumns = () => ({
  slaBar: column(-2, true),
  orderNumber: column(-1),
  dateTime: column(0),
  externalId: column(1, false),
  status: column(2),
  agent: column(3, false),
  cartGroupId: column(4),
  driverGroupId: column(5),
  business: column(6),
  customer: column(7),
  driver: column(8),
  advanced: column(9),
  cloned: column(10),
  timer: column(11),
  eta: column(12),
  channel: column(13, false),
  pod: column(14),
  total: column(15)
})

const renderListing = ({ filters = EMPTY_FILTERS, ...rest } = {}) => {
  const handleFilterValues = vi.fn()
  const props = {
    orderList: { loading: false, orders: [] },
    pagination: { total: 0, currentPage: 1, pageSize: 10 },
    ordersStatusGroup: 'pending',
    groupStatus: 'pending',
    orderListView: 'table',
    filterValues: filters,
    searchValue: null,
    handleChangeSearch: vi.fn(),
    handleChangeFilterValues: vi.fn(),
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
  return { props, handleFilterValues, ...view }
}

const page = (...ids) => ({
  orderList: { loading: false, orders: ids.map(id => ({ id })) },
  pagination: { total: ids.length, currentPage: 1, pageSize: 10 }
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.level = 0
  mocks.configs = {}
  mocks.catalog = {}
  window.localStorage.clear()
})
afterEach(() => { document.getElementById('orders-list-tools')?.remove() })

describe('F6c-5 · Q2-01 · the Status sub-filter is a filter for the empty list', () => {
  it('says no orders match, and offers Clear filters, when only the Status sub-filter is narrowing', () => {
    renderListing({ selectedSubOrderStatus: { pending: [13] }, handleSelectedSubOrderStatus: vi.fn() })
    expect(screen.getByText('No orders match these filters')).toBeTruthy()
    expect(screen.queryByText('No pending orders')).toBeNull()
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeTruthy()
  })

  it('Clear filters brings the Status sub-filter back to every status of the tab', () => {
    const handleSelectedSubOrderStatus = vi.fn()
    renderListing({ selectedSubOrderStatus: { pending: [13], inProgress: [7] }, handleSelectedSubOrderStatus })
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(handleSelectedSubOrderStatus).toHaveBeenCalledWith({ pending: PENDING_ALL, inProgress: [7] })
  })

  it('every status of the tab selected is no filter: the tab says it is empty', () => {
    renderListing({ selectedSubOrderStatus: { pending: PENDING_ALL }, handleSelectedSubOrderStatus: vi.fn() })
    expect(screen.getByText('No pending orders')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull()
  })

  it('the first-run message never stands in for a narrowed list', () => {
    const ordersAmountByStatus = { pending: 0, inProgress: 0, completed: 0, cancelled: 0 }
    renderListing({ ordersAmountByStatus, selectedSubOrderStatus: { pending: [0] } })
    expect(screen.queryByText('No orders yet')).toBeNull()
    expect(screen.getByText('No orders match these filters')).toBeTruthy()
  })

  it('still clears the other filters with the same button', () => {
    const handleSelectedSubOrderStatus = vi.fn()
    const filters = { ...EMPTY_FILTERS, customerName: 'ana' }
    const { handleFilterValues } = renderListing({ filters, selectedSubOrderStatus: { pending: [0] }, handleSelectedSubOrderStatus })
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(handleFilterValues).toHaveBeenCalled()
    expect(handleSelectedSubOrderStatus).toHaveBeenCalledTimes(1)
  })
})

describe('F6c-5 · Q2-11 · a selection that outlives the page says so', () => {
  const bar = () => screen.getByRole('region', { name: 'Actions for selected orders' })

  it('with every selected order on the page it only counts them', () => {
    renderListing({ ...page(1, 2, 3), selectedOrderIds: [1, 2] })
    expect(within(bar()).getByRole('status')).toHaveTextContent(/^2 selected$/)
  })

  it('says how many selected orders are on other pages', () => {
    renderListing({ ...page(11, 12, 13), selectedOrderIds: [1, 2, 3] })
    expect(within(bar()).getByRole('status')).toHaveTextContent('3 selected · 3 on other pages')
  })

  it('counts only the ones that are not on this page', () => {
    renderListing({ ...page(11, 12, 13), selectedOrderIds: [11, 1, 2] })
    expect(within(bar()).getByRole('status')).toHaveTextContent('3 selected · 2 on other pages')
  })

  it('says «1 on another page» in the singular', () => {
    renderListing({ ...page(11, 12), selectedOrderIds: [11, 1] })
    expect(within(bar()).getByRole('status')).toHaveTextContent('2 selected · 1 on another page')
  })

  it('each bulk action names how many orders it will act on', () => {
    renderListing({ ...page(11), selectedOrderIds: [1, 2, 3] })
    expect(within(bar()).getByRole('group', { name: 'Change status of 3 orders' })).toBeTruthy()
    expect(within(bar()).getByRole('group', { name: 'Delete 3 orders' })).toBeTruthy()
  })

  it('uses the singular for one order', () => {
    renderListing({ ...page(11), selectedOrderIds: [1] })
    expect(within(bar()).getByRole('group', { name: 'Change status of 1 order' })).toBeTruthy()
    expect(within(bar()).getByRole('group', { name: 'Delete 1 order' })).toBeTruthy()
  })
})

describe('F6c-5 · Q2-17 · column names are the same whatever the catalog says', () => {
  const labels = async () => {
    const user = userEvent.setup()
    renderListing(page(1))
    await user.click(screen.getByRole('button', { name: 'Manage columns' }))
    const dialog = await screen.findByRole('dialog', { name: 'Manage columns' })
    return within(dialog).getAllByRole('checkbox').map(box => box.textContent)
  }

  it('writes them in sentence case, with the acronyms as acronyms', async () => {
    expect(await labels()).toEqual([
      'Order number', 'Date and time', 'External ID', 'Status', 'Agent', 'Group order', 'Driver group ID', 'Business',
      'Customer', 'Driver', 'Advanced logistics', 'Cloned', 'SLA timer', 'ETA', 'Channel', 'POD', 'Total'
    ])
  })

  it('does not take the casing of the API catalog for these five', async () => {
    mocks.catalog = {
      INVOICE_ORDER_NO: 'Order No',
      EXTERNAL_ID: 'External Id',
      EXPORT_DRIVER_GROUP_ID: 'Driver Group Id',
      PODS: 'Pod',
      SLA_TIMER: 'SLA’s timer'
    }
    const names = await labels()
    ;['Order number', 'External ID', 'Driver group ID', 'POD', 'SLA timer'].forEach(name => expect(names).toContain(name))
    ;['Order No', 'External Id', 'Driver Group Id', 'Pod', 'SLA’s timer'].forEach(name => expect(names).not.toContain(name))
  })
})
