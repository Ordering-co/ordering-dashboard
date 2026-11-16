/* eslint-disable import/first */
// (bugs H, W1-QA1-05): the empty tab names come from t('ORDERS_EMPTY_*', text) calls, so the key scanner
// sees them and the catalog translates them. A table of ['KEY', 'text'] pairs hid the four keys from i18n:verify.
import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ dictionary: {} }))

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useHistory: () => ({ replace: vi.fn(), location: { pathname: '/orders' } })
}))
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (key, text) => mocks.dictionary[key] ?? text],
  useConfig: () => [{ configs: {} }],
  useSession: () => [{ user: { level: 0 } }],
  useApi: () => [{ project: 'demo' }]
}))
vi.mock('../../OrdersTable', () => ({ OrdersTable: () => <div data-testid='table' /> }))
vi.mock('../../OrdersCards', () => ({ OrdersCards: () => <div data-testid='cards' /> }))
vi.mock('../../OrderStatusTypeSelector', () => ({ OrderStatusTypeSelector: () => null }))
vi.mock('../../OrderDelete', () => ({ OrderDelete: () => null }))
vi.mock('../../OrdersDashboardControls/styles', () => ({
  WrapOrderStatusTypeSelector: ({ children }) => <div>{children}</div>
}))
vi.mock('~/analytics/useTrackedLoadState', () => ({ useTrackedLoadState: () => {} }))

import { FilterValuesContext } from '../../../../contexts/FilterValuesContext'
import { OrdersListing } from '..'

const FILTERS = { orderId: null, statuses: [], businessIds: [], customerName: null }
const column = (order, visable = true) => ({ visable, title: '', className: '', draggable: false, colSpan: 1, order })

const renderTab = (groupStatus) => render(
  <FilterValuesContext.Provider value={[FILTERS, { handleFilterValues: vi.fn() }]}>
    <OrdersListing
      orderList={{ loading: false, orders: [] }}
      pagination={{ total: 0, currentPage: 1, pageSize: 10 }}
      ordersStatusGroup={groupStatus}
      groupStatus={groupStatus}
      orderListView='table'
      filterValues={FILTERS}
      handleChangeSearch={vi.fn()}
      handleChangeFilterValues={vi.fn()}
      allowColumns={{ slaBar: column(-2), orderNumber: column(-1), dateTime: column(0), total: column(15) }}
      setAllowColumns={vi.fn()}
      saveUserSettings={vi.fn()}
      selectedOrderIds={[]}
      setSelectedOrderIds={vi.fn()}
      handleChangeMultiOrdersStatus={vi.fn()}
      handleDeleteMultiOrders={vi.fn()}
      getPageOrders={vi.fn()}
    />
  </FilterValuesContext.Provider>
)

beforeEach(() => { mocks.dictionary = {}; window.localStorage.clear() })

describe('OrdersListing · the empty tab asks the catalog for its own key', () => {
  it.each([
    ['pending', 'ORDERS_EMPTY_PENDING', 'No pending orders'],
    ['inProgress', 'ORDERS_EMPTY_IN_PROGRESS', 'No in-progress orders'],
    ['completed', 'ORDERS_EMPTY_COMPLETED', 'No completed orders'],
    ['cancelled', 'ORDERS_EMPTY_CANCELLED', 'No cancelled orders']
  ])('%s: a translation of %s wins over the text of the code', (tab, key, text) => {
    mocks.dictionary = { [key]: `es:${key}` }
    renderTab(tab)
    expect(screen.getByText(`es:${key}`)).toBeInTheDocument()
    expect(screen.queryByText(text)).not.toBeInTheDocument()
  })

  it.each([
    ['pending', 'No pending orders'],
    ['inProgress', 'No in-progress orders'],
    ['completed', 'No completed orders'],
    ['cancelled', 'No cancelled orders']
  ])('%s without a translation says «%s»', (tab, text) => {
    renderTab(tab)
    expect(screen.getByText(text)).toBeInTheDocument()
  })
})
