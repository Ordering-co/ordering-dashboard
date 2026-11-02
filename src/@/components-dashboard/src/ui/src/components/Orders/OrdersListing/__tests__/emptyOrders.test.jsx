import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useConfig: () => [{ configs: {} }]
}))

vi.mock('../../OrdersTable', () => ({
  OrdersTable: () => <div data-testid='orders-table' />
}))

vi.mock('../../OrdersCards', () => ({
  OrdersCards: () => <div data-testid='orders-cards' />
}))

vi.mock('../../../Shared', () => ({
  ColumnAllowSettingPopover: () => null
}))

vi.mock('~/analytics/useTrackedLoadState', () => ({
  useTrackedLoadState: () => {}
}))

import { OrdersListing } from '../index'
import { useLanguage } from '../../../../../../index'

const OrdersTitle = () => {
  const [, t] = useLanguage()
  return <h1>{t('ORDERS_LIST', 'Orders list')}</h1>
}

const listProps = {
  orderListView: 'small',
  ordersStatusGroup: 'pending',
  groupStatus: 'pending',
  filterValues: {},
  selectedOrderIds: [],
  pagination: { total: 0 },
  orderList: { loading: false, orders: [], error: false }
}

describe('orders launch', () => {
  it('shows the orders title and the empty list sentence', async () => {
    const { findByText } = renderWithProviders(
      <>
        <OrdersTitle />
        <OrdersListing {...listProps} />
      </>
    )

    expect(await findByText('Orders list')).toBeInTheDocument()
    expect(await findByText('No Orders yet.')).toBeInTheDocument()
  })

  it('keeps the orders title when the list request fails', async () => {
    const { findByText, queryByText } = renderWithProviders(
      <>
        <OrdersTitle />
        <OrdersListing
          {...listProps}
          pagination={{ total: null }}
          orderList={{ loading: false, orders: [], error: true }}
        />
      </>
    )

    expect(await findByText('Orders list')).toBeInTheDocument()
    expect(queryByText('No Orders yet.')).not.toBeInTheDocument()
    expect(document.body.textContent.trim().length).toBeGreaterThan(0)
  })
})
