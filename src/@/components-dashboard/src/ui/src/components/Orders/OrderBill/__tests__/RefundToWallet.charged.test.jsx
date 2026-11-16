/* eslint-disable import/first */
import React from 'react'
import { fireEvent, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  // RefundToWallet reads the user level (refund by items, levels 0 and 2)
  useSession: () => [{ user: { id: 1, level: 0 } }],
  useConfig: () => [{
    configs: {
      refund_cash_wallet_allow_when_order_cancelled: { value: '1' }
    }
  }],
  useLanguage: () => [null, (_key, fallback) => fallback],
  useUtils: () => [{
    parsePrice: (value, { currency } = {}) => `${currency ?? '$'}${Number(value ?? 0).toFixed(2)}`
  }]
}))

vi.mock('../../../Shared', () => ({
  Alert: () => null,
  Modal: ({ children, open }) => open ? <div role='dialog' aria-label='Refund'>{children}</div> : null,
  // Same public surface as the shared Confirm: open, title, children, accept/cancel text and handlers.
  Confirm: ({ open, title, children, acceptText, cancelText, onAccept, onCancel }) => open
    ? (
      <div role='alertdialog' aria-label={title}>
        {children}
        <button type='button' onClick={onCancel}>{cancelText}</button>
        <button type='button' onClick={onAccept}>{acceptText}</button>
      </div>
      )
    : null
}))

import { RefundToWallet } from '../RefundToWallet'

afterEach(() => document.getElementById('app-modals')?.remove())

// redesign fix-qa E9: «Charged» is what was paid. An order with no payment event (cash not yet collected) has
// an order total, not a charge; the refund is still offered under the same conditions as before.
const unpaidCash = {
  id: 43,
  currency: 'USD',
  paymethod: { gateway: 'cash' },
  summary: { total: 42.81 },
  payment_events: []
}

const paidCash = {
  ...unpaidCash,
  payment_events: [{ id: 1, event: 'payment', wallet_event: { wallet: { type: 'cash' } } }]
}

const openDialog = async (order) => {
  renderWithProviders(
    <RefundToWallet
      order={order}
      actionStatus={{ loading: false }}
      handleOrderRefund={vi.fn()}
      stripePaymethods={['stripe']}
      braintreePaymethods={[]}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: 'Refund to wallet' }))
  return screen.findByRole('dialog', { name: 'Refund to wallet' })
}

describe('RefundToWallet summary line', () => {
  it('still offers the refund on an order with no payment event', async () => {
    const dialog = await openDialog(unpaidCash)
    expect(dialog).toBeInTheDocument()
  })

  it('an order with no payment event says «Order total», not «Charged»', async () => {
    const dialog = await openDialog(unpaidCash)
    const summary = within(dialog).getByText(/Order total: \$42\.81/)
    expect(summary).toHaveTextContent('Already refunded: $0.00')
    expect(within(dialog).queryByText(/Charged/)).toBeNull()
  })

  it('an order without payment_events at all says «Order total» too', async () => {
    const dialog = await openDialog({ ...unpaidCash, payment_events: undefined })
    expect(within(dialog).getByText(/Order total: \$42\.81/)).toBeInTheDocument()
    expect(within(dialog).queryByText(/Charged/)).toBeNull()
  })

  it('a refund event alone is not a charge', async () => {
    const dialog = await openDialog({ ...unpaidCash, payment_events: [{ id: 2, event: 'refund', amount: 5 }] })
    expect(within(dialog).getByText(/Order total: \$42\.81/)).toHaveTextContent('Already refunded: $5.00')
    expect(within(dialog).queryByText(/Charged/)).toBeNull()
  })

  it('an order with a payment event says «Charged»', async () => {
    const dialog = await openDialog(paidCash)
    expect(within(dialog).getByText(/Charged: \$42\.81/)).toBeInTheDocument()
    expect(within(dialog).queryByText(/Order total/)).toBeNull()
  })
})
