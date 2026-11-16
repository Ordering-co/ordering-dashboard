/* eslint-disable import/first */
// redesign 5.6-A: under 768px of viewport the list is a list of cards (OrdersTable draws them). Cards
// have the table tools (density, columns) out; the selection bar is the table's own (W1): the cards have
// a Select mode. The error and empty states are the same EmptyState the table has. From 768px nothing changes.
import React from 'react'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useHistory: () => ({ replace: vi.fn(), location: { pathname: '/orders' } })
}))
const mocks = vi.hoisted(() => ({ level: 0, configs: {} }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, text) => text],
  useConfig: () => [{ configs: mocks.configs }],
  useSession: () => [{ user: { level: mocks.level } }],
  useApi: () => [{ project: 'demo' }]
}))
vi.mock('../../OrdersTable', () => ({ OrdersTable: () => <div data-testid='table' /> }))
vi.mock('../../OrdersCards', () => ({ OrdersCards: () => <div data-testid='cards' /> }))
vi.mock('../../OrderStatusTypeSelector', () => ({ OrderStatusTypeSelector: () => <button type='button'>Change status</button> }))
vi.mock('../../OrderDelete', () => ({ OrderDelete: () => <button type='button'>Delete</button> }))
vi.mock('../../OrdersDashboardControls/styles', () => ({
  WrapOrderStatusTypeSelector: ({ children }) => <div>{children}</div>
}))
vi.mock('~/analytics/useTrackedLoadState', () => ({ useTrackedLoadState: () => {} }))

import { FilterValuesContext } from '../../../../contexts/FilterValuesContext'
import { OrdersListing } from '..'

const EMPTY_FILTERS = { orderId: null, statuses: [], businessIds: [], customerName: null }
const media = { narrow: true }

const renderListing = (extra = {}) => {
  const props = {
    orderList: { loading: false, orders: [{ id: 1 }] },
    pagination: { total: 1, currentPage: 1, pageSize: 10 },
    ordersStatusGroup: 'pending',
    groupStatus: 'pending',
    orderListView: 'table',
    filterValues: EMPTY_FILTERS,
    searchValue: null,
    handleChangeSearch: vi.fn(),
    handleChangeFilterValues: vi.fn(),
    allowColumns: {},
    setAllowColumns: vi.fn(),
    saveUserSettings: vi.fn(),
    selectedOrderIds: [1],
    setSelectedOrderIds: vi.fn(),
    handleChangeMultiOrdersStatus: vi.fn(),
    handleDeleteMultiOrders: vi.fn(),
    getPageOrders: vi.fn(),
    ...extra
  }
  const view = render(
    <FilterValuesContext.Provider value={[EMPTY_FILTERS, { handleFilterValues: vi.fn() }]}>
      <OrdersListing {...props} />
    </FilterValuesContext.Provider>
  )
  return { props, ...view }
}

beforeEach(() => {
  mocks.level = 0
  mocks.configs = {}
  media.narrow = true
  window.localStorage.clear()
  window.matchMedia = vi.fn((query) => ({
    get matches () { return media.narrow && query === '(max-width: 767px)' },
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {}
  }))
})
afterEach(() => {
  delete window.matchMedia
  document.getElementById('orders-list-tools')?.remove()
})

describe('OrdersListing in cards mode', () => {
  // (W1, owner decision 1 A): the cards have a Select mode and the SAME bulk bar as the table, with the same rules.
  it('shows the selection bar when the selection holds orders, with Change status and Delete', () => {
    renderListing()
    expect(screen.getByText('1 selected')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Clear selection' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Change status' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy()
  })

  it('shows no bar while nothing is selected', () => {
    renderListing({ selectedOrderIds: [] })
    expect(screen.queryByText(/selected$/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Clear selection' })).toBeNull()
  })

  it('gives a driver manager (level 5) neither action without the batch-status config, as the table does', () => {
    mocks.level = 5
    renderListing()
    expect(screen.getByText('1 selected')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Change status' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
  })

  it('gives a driver manager Change status, and still no Delete, when the batch-status config is on', () => {
    mocks.level = 5
    mocks.configs = { allow_driver_manager_batch_update_order_status: { value: '1' } }
    renderListing()
    expect(screen.getByRole('button', { name: 'Change status' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
  })

  it('has no bar in /all-in-one, which passes no bulk handlers, even on a phone', () => {
    renderListing({ handleChangeMultiOrdersStatus: undefined, handleDeleteMultiOrders: undefined })
    expect(screen.queryByText('1 selected')).toBeNull()
  })

  it('has no bar in the lateral list of a customer or a driver, which keeps its table', () => {
    renderListing({ isSelectedOrders: true })
    expect(screen.queryByText('1 selected')).toBeNull()
  })

  it('keeps the selection bar from 768px', () => {
    media.narrow = false
    renderListing()
    expect(screen.getByText('1 selected')).toBeTruthy()
  })

  it('leaves out the table tools (density, columns), which a card does not have', () => {
    renderListing()
    expect(screen.queryByRole('button', { name: 'Compact rows' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Manage columns' })).toBeNull()
  })

  it('keeps the table tools from 768px', () => {
    media.narrow = false
    renderListing()
    expect(screen.getByRole('button', { name: 'Compact rows' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Manage columns' })).toBeTruthy()
  })

  it('keeps the table, its tools and its selection in the lateral list of a customer or a driver', () => {
    renderListing({ isSelectedOrders: true })
    expect(screen.getByRole('button', { name: 'Compact rows' })).toBeTruthy()
  })

  it('shows the same error state as the table, with the same retry', () => {
    const { props } = renderListing({ orderList: { loading: false, orders: [], error: ['boom'] }, pagination: { total: 0, currentPage: 2, pageSize: 25 } })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('We couldn’t load the orders')
    screen.getByRole('button', { name: 'Try again' }).click()
    expect(props.getPageOrders).toHaveBeenCalledWith(25, 2)
  })

  it('shows the same empty state as the table', () => {
    renderListing({ orderList: { loading: false, orders: [] }, pagination: { total: 0, currentPage: 1, pageSize: 10 } })
    expect(screen.getByText('No pending orders')).toBeTruthy()
  })
})
