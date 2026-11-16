/* eslint-disable import/first */
// redesign F6c (Q2-28): the «Refund to wallet» button that is disabled says why, in words next to it (a disabled button
// shows no tooltip to a keyboard or a touch user). The reasons are the ones that already disabled it.
import React from 'react'
import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  // RefundToWallet reads the user level (refund by items, levels 0 and 2)
  useSession: () => [{ user: { id: 1, level: 0 } }],
  useConfig: () => [{ configs: { refund_cash_wallet_allow_when_order_cancelled: { value: '1' } } }],
  useLanguage: () => [null, (_key, fallback) => fallback],
  useUtils: () => [{ parsePrice: (value) => `$${Number(value ?? 0).toFixed(2)}` }]
}))

vi.mock('../../../Shared', () => ({ Alert: () => null, Modal: () => null, Confirm: () => null }))

import { RefundToWallet } from '../RefundToWallet'

afterEach(() => document.getElementById('app-modals')?.remove())

const base = {
  id: 42,
  currency: 'USD',
  paymethod: { gateway: 'cash' },
  summary: { total: 35.5 },
  payment_events: [{ id: 1, event: 'payment', wallet_event: { wallet: { type: 'cash' } } }]
}

const renderRefund = (order, actionStatus = { loading: false }) => renderWithProviders(
  <RefundToWallet
    order={{ ...base, ...order }}
    actionStatus={actionStatus}
    handleOrderRefund={vi.fn()}
    stripePaymethods={['stripe']}
    braintreePaymethods={[]}
  />
)

const button = () => screen.getByRole('button', { name: 'Refund to wallet' })

describe('RefundToWallet: why the button is disabled', () => {
  // redesign F6d (Q3-08): the hint says what was refunded (the real amount, and the method when the event names it) instead of
  // «already fully refunded», which read as a contradiction next to a «Refund» that is still active
  it('says what was refunded when the refunds add up to the total', () => {
    renderRefund({ payment_events: [...base.payment_events, { id: 2, event: 'refund', amount: 35.5 }] })
    expect(button()).toBeDisabled()
    const hint = screen.getByText('Refunded: $35.50')
    expect(button()).toHaveAttribute('aria-describedby', hint.id)
  })

  it('names the method of the refund when the event has one', () => {
    renderRefund({ payment_events: [...base.payment_events, { id: 2, event: 'refund', amount: 35.5, wallet_event: { wallet: { type: 'cash' } } }] })
    expect(screen.getByText('Refunded to Cash wallet: $35.50')).toBeInTheDocument()
  })

  it('keeps the old sentence when no refund event says anything (a zero-total order)', () => {
    renderRefund({ summary: { total: 0 }, total: 0 })
    expect(screen.getByText('This order is already fully refunded.')).toBeInTheDocument()
  })

  it('says it was refunded through the provider for a card order that already has refund data', () => {
    renderRefund({ paymethod: { gateway: 'stripe' }, refund_data: 'partially_refunded', payment_events: [...base.payment_events, { id: 2, event: 'refund', amount: 10 }] })
    expect(button()).toBeDisabled()
    const hint = screen.getByText('This order was refunded through its payment provider.')
    expect(button()).toHaveAttribute('aria-describedby', hint.id)
  })

  it('says nothing while it is only busy (a request is running)', () => {
    renderRefund({}, { loading: true })
    expect(button()).toBeDisabled()
    expect(screen.queryByText(/already|refunded through/i)).toBeNull()
    expect(button()).not.toHaveAttribute('aria-describedby')
  })

  it('has no hint when the button works', () => {
    renderRefund({})
    expect(button()).toBeEnabled()
    expect(screen.queryByText(/already fully refunded/)).toBeNull()
    expect(button()).not.toHaveAttribute('aria-describedby')
  })
})
