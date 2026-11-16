/* eslint-disable import/first */
// redesign F6d-3 (Q3-08): an order refunded to the wallet kept «Refund to wallet» disabled with «This order is already
// fully refunded.» while «Refund» (Stripe, main's `canRefundPayment` rule, unchanged) stayed active right below. Which
// buttons are enabled is not touched; the words are: the hint says what happened (method and amount from the refund events)
// and the confirmation of «Refund» tells the operator about the previous refund before they confirm.
import React from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  // RefundToWallet reads the user level (refund by items, levels 0 and 2)
  useSession: () => [{ user: { id: 1, level: 0 } }],
  useConfig: () => [{ configs: { refund_cash_wallet_allow_when_order_cancelled: { value: '1' } } }],
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

const walletRefund = { id: 3, event: 'refund', amount: 217.05, wallet_event: { wallet: { type: 'cash' } } }

const order = (extra = {}) => ({
  id: 13601,
  currency: 'EUR',
  delivery_type: 1,
  products: [{ id: 1, type: 'food' }],
  paymethod: { gateway: 'stripe', name: 'Stripe' },
  summary: { total: 217.05, subtotal: 217.05, discount: 0, tax: 0, service_fee: 0 },
  taxes: [],
  fees: [],
  offers: [],
  payment_events: [
    { id: 1, event: 'payment', amount: 217.05, paymethod: { gateway: 'stripe', name: 'Stripe' } },
    walletRefund
  ],
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

describe('Refunded to the wallet, the panel says what happened (Q3-08)', () => {
  it('writes the hint from the refund events: method and amount, not «already fully refunded»', () => {
    mount()
    const hint = screen.getByText('Refunded to Cash wallet: € 217.05')
    expect(screen.getByRole('button', { name: 'Refund to wallet' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Refund to wallet' })).toHaveAttribute('aria-describedby', hint.id)
    expect(screen.queryByText('This order is already fully refunded.')).toBeNull()
  })

  it('adds up the refunds of one method and lists each method', () => {
    mount({
      order: order({
        payment_events: [
          { id: 1, event: 'payment', amount: 217.05, paymethod: { gateway: 'stripe', name: 'Stripe' } },
          { ...walletRefund, id: 3, amount: 100 },
          { ...walletRefund, id: 4, amount: 17.05 },
          { id: 5, event: 'refund', amount: 100, paymethod: { gateway: 'stripe', name: 'Stripe' } }
        ]
      })
    })
    expect(screen.getByText('Refunded to Cash wallet: € 117.05 · Refunded to Stripe: € 100.00')).toBeInTheDocument()
  })

  it('leaves which buttons are enabled to main: «Refund» stays active after a wallet refund', () => {
    mount()
    expect(screen.getByRole('button', { name: 'Refund' })).toBeEnabled()
  })

  it('makes the «Refund» confirmation mention the previous refund, with amount and method', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('button', { name: 'Refund' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Refund order #13601?' })
    expect(within(confirm).getByText('The payment is refunded to the customer’s card. This can’t be undone.')).toBeInTheDocument()
    expect(within(confirm).getByText('This order was already refunded: Cash wallet € 217.05. Check it before you refund again.')).toBeInTheDocument()
    expect(within(confirm).getByRole('button', { name: 'Refund € 217.05' })).toBeInTheDocument()
  })

  it('says nothing about a previous refund when there is none', async () => {
    const user = userEvent.setup()
    mount({ order: order({ payment_events: [{ id: 1, event: 'payment', amount: 217.05, paymethod: { gateway: 'stripe', name: 'Stripe' } }] }) })
    await user.click(screen.getByRole('button', { name: 'Refund' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Refund order #13601?' })
    expect(within(confirm).queryByText(/already refunded/)).toBeNull()
  })

  it('tells about the previous refund in the partial refund dialog of a plugin too', async () => {
    const user = userEvent.setup()
    mount({
      order: order({ paymethod: { gateway: 'provider_x', name: 'Provider X' } }),
      getPluginRefundProvider: gateway => gateway === 'provider_x' ? { partial: true } : null
    })
    await user.click(screen.getByRole('button', { name: 'Refund' }))
    const dialog = await screen.findByRole('dialog', { name: 'Refund order #13601' })
    expect(within(dialog).getByText('This order was already refunded: Cash wallet € 217.05. Check it before you refund again.')).toBeInTheDocument()
  })
})
