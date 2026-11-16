/* eslint-disable import/first */
import React from 'react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
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
// Copy decision 4 (user, 2026-10-06): shared labels in sentence case; only the names these tests look up changed.
// redesign 5.4: the form and the confirmation are Product dialogs now (the Shared mock above is no longer
// reached). Only what is looked up changed: the form dialog is named after its title (Refund to wallet), its
// submit is Continue, the confirmation is named by its title (Refund $25.50?) and closes after its exit
// transition. Every assertion about the payload, the single call and the cancel is the same.
afterEach(() => document.getElementById('app-modals')?.remove())

const order = {
  id: 42,
  currency: 'USD',
  paymethod: { gateway: 'cash' },
  summary: { total: 80 },
  payment_events: [
    { id: 1, event: 'payment', wallet_event: { wallet: { type: 'cash' } } },
    { id: 2, event: 'refund', amount: 10 }
  ]
}

const openRefundForm = async () => {
  const handleOrderRefund = vi.fn()
  renderWithProviders(
    <RefundToWallet
      order={order}
      actionStatus={{ loading: false }}
      handleOrderRefund={handleOrderRefund}
      stripePaymethods={['stripe']}
      braintreePaymethods={[]}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: 'Refund to wallet' }))
  const dialog = await screen.findByRole('dialog', { name: 'Refund to wallet' })
  // The order already has a refund, so "Refund all" is disabled and the amount field is shown.
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Amount' }), { target: { value: '25.5' } })
  return { handleOrderRefund, dialog }
}

describe('RefundToWallet confirmation before moving money', () => {
  it('shows what was charged and already refunded above the form', async () => {
    const { dialog } = await openRefundForm()
    expect(within(dialog).getByText(/Charged: \$80\.00/)).toHaveTextContent('Already refunded: $10.00')
  })

  it('does not refund on submit: asks for confirmation naming the amount and destination', async () => {
    const { handleOrderRefund, dialog } = await openRefundForm()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }))

    const confirm = await screen.findByRole('alertdialog', { name: 'Refund $25.50?' })
    expect(within(confirm).getByText('Refund $25.50 to Cash wallet.')).toBeInTheDocument()
    expect(within(confirm).getByRole('button', { name: 'Refund $25.50' })).toBeInTheDocument()
    expect(handleOrderRefund).not.toHaveBeenCalled()
  })

  it('refunds once with the same payload only after accepting', async () => {
    const { handleOrderRefund, dialog } = await openRefundForm()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Refund $25.50?' })
    fireEvent.click(within(confirm).getByRole('button', { name: 'Refund $25.50' }))

    expect(handleOrderRefund).toHaveBeenCalledTimes(1)
    expect(handleOrderRefund).toHaveBeenCalledWith({ amount: 25.5, transfer_to: 'cash_wallet' })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('sends nothing when the confirmation is cancelled', async () => {
    const { handleOrderRefund, dialog } = await openRefundForm()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Refund $25.50?' })
    fireEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }))

    expect(handleOrderRefund).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })
})
