/* eslint-disable import/first */
// (owner decision 9 of the parity audit, 2026-10-27): main showed the Transaction ID (`pay_data`) whenever the order had any
// payment event; the redesign showed it only with a `payment` event or a possible refund.
import React from 'react'
import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  // RefundToWallet reads the user level (refund by items, levels 0 and 2)
  useSession: () => [{ user: { id: 1, level: 0 } }],
  useConfig: () => [{ configs: {} }],
  useLanguage: () => [null, (_key, fallback) => fallback],
  useUtils: () => [{
    parseNumber: value => value,
    parsePrice: value => `€ ${Number(value ?? 0).toFixed(2)}`
  }]
}))

vi.mock('../../../Shared', () => ({
  Alert: () => null,
  Confirm: () => null,
  FeeBillRows: () => null,
  Modal: ({ children, open }) => open ? <div role='dialog' aria-label='legacy'>{children}</div> : null,
  TaxBillRows: () => null
}))

import { OrderBill } from '..'

const order = (extra = {}) => ({
  id: 13601,
  currency: 'EUR',
  delivery_type: 1,
  products: [{ id: 1, type: 'food' }],
  paymethod: { gateway: 'stripe', name: 'Stripe' },
  summary: { total: 217.05, subtotal: 200.5, discount: 0, tax: 12.3, service_fee: 4.25, driver_tip: 5, delivery_price: 3 },
  tax_type: 2,
  taxes: [],
  fees: [],
  offers: [],
  payment_events: [{ id: 1, event: 'payment', amount: 217.05, paymethod: { gateway: 'stripe', name: 'Stripe' } }],
  ...extra
})

afterEach(() => document.getElementById('app-modals')?.remove())

const mount = (props = {}) => renderWithProviders(
  <OrderBill
    variant='panel'
    order={order()}
    actionStatus={{ loading: false }}
    handleRefundPaymentsStripe={vi.fn()}
    handleRefundPaymentsPlugin={vi.fn()}
    {...props}
  />
)

describe('OrderBill · Transaction ID (main\'s rule)', () => {
  it('shows it with a payment event', () => {
    mount({ order: order({ pay_data: 'pi_123' }) })
    expect(screen.getByText('Transaction ID')).toBeInTheDocument()
    expect(screen.getByText('pi_123')).toBeInTheDocument()
  })

  it('shows it when the only payment event is not a «payment» (a refund, a wallet event), as main did', () => {
    mount({ order: order({ pay_data: 'pi_456', payment_events: [{ id: 2, event: 'refund', amount: 10, paymethod: { gateway: 'stripe', name: 'Stripe' } }] }) })
    expect(screen.getByText('Transaction ID')).toBeInTheDocument()
    expect(screen.getByText('pi_456')).toBeInTheDocument()
  })

  it('says BrainTree ID for a Braintree order', () => {
    mount({ order: order({ pay_data: 'bt_1', paymethod: { gateway: 'braintree', name: 'Braintree' }, payment_events: [{ id: 3, event: 'refund', amount: 5, paymethod: { gateway: 'braintree' } }] }) })
    expect(screen.getByText('BrainTree ID')).toBeInTheDocument()
  })

  it('is not there without payment events nor anything to refund, as in main', () => {
    mount({ order: order({ pay_data: 'cash_1', paymethod: { gateway: 'cash', name: 'Cash' }, payment_events: [] }) })
    expect(screen.queryByText('cash_1')).toBeNull()
  })
})
