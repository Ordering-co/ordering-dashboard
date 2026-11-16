/* eslint-disable import/first */
import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// Redesign 5.3 audit-1 (FD-1): the button that opens the refund is a Product secondary button,
// never the legacy solid primary (D10, C4). Only the opener is covered here: the refund dialog
// and its confirmation have their own tests (RefundToWallet.confirm.test.jsx).
const state = vi.hoisted(() => ({ configs: {} }))

vi.mock('../../../../../../index', () => ({
  // RefundToWallet reads the user level (refund by items, levels 0 and 2)
  useSession: () => [{ user: { id: 1, level: 0 } }],
  useConfig: () => [{ configs: state.configs }],
  useLanguage: () => [null, (_key, fallback) => fallback],
  useUtils: () => [{
    parsePrice: (value, { currency } = {}) => `${currency ?? '$'}${Number(value ?? 0).toFixed(2)}`
  }]
}))

vi.mock('../../../Shared', () => ({
  Alert: () => null,
  Modal: ({ children, open }) => open ? <div role='dialog' aria-label='Refund'>{children}</div> : null,
  Confirm: () => null
}))

import { RefundToWallet } from '../../OrderBill/RefundToWallet'
// Copy decision 4 (user, 2026-10-06): shared labels in sentence case; only the names these tests look up changed.

const order = {
  id: 42,
  status: 11,
  currency: 'USD',
  paymethod: { gateway: 'cash' },
  summary: { total: 80 },
  payment_events: [{ id: 1, event: 'payment', wallet_event: { wallet: { type: 'cash' } } }]
}

const renderRefund = (props = {}) => renderWithProviders(
  <RefundToWallet
    order={order}
    actionStatus={{ loading: false }}
    handleOrderRefund={vi.fn()}
    stripePaymethods={['stripe']}
    braintreePaymethods={[]}
    {...props}
  />
)

describe('RefundToWallet — the button that opens it', () => {
  afterEach(() => document.getElementById('app-modals')?.remove())
  beforeEach(() => {
    state.configs = { refund_cash_wallet_allow_when_order_cancelled: { value: '1' } }
  })

  it('is a Product secondary button, never the primary of a closed order', () => {
    renderRefund()
    const button = screen.getByRole('button', { name: 'Refund to wallet' })
    expect(button).toHaveClass('odc-btn')
    expect(button).toHaveAttribute('data-variant', 'secondary')
    expect(button).toHaveAttribute('type', 'button')
  })

  // redesign 5.4: the refund form is a Product Dialog now, named after its title (Refund to wallet).
  it('opens the same refund dialog as before', async () => {
    renderRefund()
    expect(screen.queryByRole('dialog', { name: 'Refund to wallet' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Refund to wallet' }))
    expect(await screen.findByRole('dialog', { name: 'Refund to wallet' })).toBeInTheDocument()
  })

  it('stays disabled while an action is running', () => {
    renderRefund({ actionStatus: { loading: true } })
    expect(screen.getByRole('button', { name: 'Refund to wallet' })).toBeDisabled()
  })

  it('is not offered when no refund is allowed', () => {
    state.configs = {}
    renderRefund()
    expect(screen.queryByRole('button', { name: 'Refund to wallet' })).toBeNull()
  })

  it('is called Refund for a Braintree order', () => {
    renderRefund({
      order: { ...order, paymethod: { gateway: 'braintree' } },
      braintreePaymethods: ['braintree']
    })
    expect(screen.getByRole('button', { name: 'Refund' })).toHaveAttribute('data-variant', 'secondary')
  })
})
