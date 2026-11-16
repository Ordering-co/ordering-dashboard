/* eslint-disable import/first */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  // RefundToWallet reads the user level (refund by items, levels 0 and 2)
  useSession: () => [{ user: { id: 1, level: 0 } }],
  useConfig: () => [{ configs: {} }],
  useLanguage: () => [null, (_key, fallback) => fallback],
  useUtils: () => [{
    parseNumber: value => value,
    parsePrice: (value, { currency } = {}) => `${currency ?? '$'}${Number(value ?? 0).toFixed(2)}`
  }]
}))

vi.mock('../../../Shared', () => ({
  Alert: () => null,
  Confirm: ({ open, acceptText, onAccept }) => open
    ? <button type='button' onClick={onAccept}>{acceptText}</button>
    : null,
  FeeBillRows: () => null,
  Modal: ({ children, open }) => open ? <div role='dialog'>{children}</div> : null,
  TaxBillRows: () => null
}))

vi.mock('../../OrderBill/RefundToWallet', () => ({ RefundToWallet: () => <div data-testid='refund-to-wallet' /> }))

import { OrderBill } from '../../OrderBill'
// Copy decision 4 (user, 2026-10-06): shared labels in sentence case; only the names these tests look up changed.

const order = (patch = {}) => ({
  id: 42,
  currency: 'USD',
  delivery_type: 1,
  products: [{ id: 1, type: 'food' }],
  paymethod: { gateway: 'stripe', name: 'Stripe' },
  summary: { total: 80, subtotal: 70, discount: 0, tax: 0, service_fee: 0, delivery_price: 10 },
  taxes: [],
  fees: [],
  offers: [],
  payment_events: [{ id: 5, event: 'payment', amount: 80, paymethod: { gateway: 'stripe', name: 'Stripe' } }],
  ...patch
})

const renderBill = (patch, props = {}) => renderWithProviders(
  <OrderBill variant='panel' order={order(patch)} actionStatus={{ loading: false }} {...props} />
)

afterEach(() => document.getElementById('app-modals')?.remove())

describe('OrderBill variant panel', () => {
  it('keeps the same rows, the same calculations and an accessible total', () => {
    renderBill()
    const bill = screen.getByRole('table', { name: 'Order bill' })
    expect(within(bill).getByText('Subtotal').closest('tr')).toHaveTextContent('$70.00')
    expect(within(bill).getByText('Delivery Fee').closest('tr')).toHaveTextContent('$10.00')
    const total = screen.getByRole('table', { name: 'Order total' })
    expect(total).toHaveTextContent('Total')
    expect(total).toHaveTextContent('$80.00')
  })

  it('is not the legacy container (no styled-components wrapper class), so print is untouched', () => {
    const { container } = renderBill()
    expect(container.querySelector('.odt-bill')).not.toBeNull()
  })

  it('shows the payment as a row with a done badge and no NOT PREPAID prefix', () => {
    renderBill()
    const pay = screen.getByRole('group', { name: 'Payments' })
    expect(within(pay).getByText('Stripe')).toBeInTheDocument()
    expect(within(pay).getByText('Paid')).toBeInTheDocument()
    expect(pay.querySelector('[data-family="done"]')).not.toBeNull()
    expect(within(pay).getByText('$80.00')).toBeInTheDocument()
  })

  it('cash on delivery is "Not prepaid" as a pending badge, never Paid', () => {
    renderBill({
      paymethod: { gateway: 'cash', name: 'Cash' },
      cash: 100,
      payment_events: [{ id: 6, event: 'payment', amount: 80, paymethod: { gateway: 'cash', name: 'Cash' } }]
    })
    const pay = screen.getByRole('group', { name: 'Payments' })
    expect(within(pay).getByText('Cash')).toBeInTheDocument()
    expect(within(pay).getByText('Not prepaid')).toBeInTheDocument()
    expect(within(pay).queryByText('Paid')).toBeNull()
    expect(pay.querySelector('[data-family="pending"]')).not.toBeNull()
    expect(pay.textContent).not.toMatch(/NOT PREPAID:/i)
  })

  it('says Refunded once a refund event exists and the order is not only partially refunded', () => {
    renderBill({
      refund_data: 'refunded',
      payment_events: [
        { id: 5, event: 'payment', amount: 80, paymethod: { gateway: 'stripe', name: 'Stripe' } },
        { id: 9, event: 'refund', amount: 80, paymethod: { gateway: 'stripe', name: 'Stripe' } }
      ]
    })
    const pay = screen.getByRole('group', { name: 'Payments' })
    expect(within(pay).getByText('Refunded')).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Refund' })).toHaveTextContent('$80.00')
  })

  it('shows the transaction id inside the payment block', () => {
    renderBill({ pay_data: 'pi_123' })
    expect(within(screen.getByRole('group', { name: 'Payments' })).getByText('pi_123')).toBeInTheDocument()
  })

  // redesign 5.4: the confirmation is a ConfirmDialog (the Shared mock above is no longer reached): it is
  // found as an alert dialog and its button reads verb + amount instead of Accept. Same single call.
  it('keeps RefundToWallet and the Stripe refund button in the payment block with the same confirmation', async () => {
    const handleRefundPaymentsStripe = vi.fn()
    renderBill({}, { handleRefundPaymentsStripe })
    const pay = screen.getByRole('group', { name: 'Payments' })
    expect(within(pay).getByTestId('refund-to-wallet')).toBeInTheDocument()
    const refund = within(pay).getByRole('button', { name: 'Refund' })
    expect(refund).toHaveAttribute('data-variant', 'secondary')
    fireEvent.click(refund)
    expect(handleRefundPaymentsStripe).not.toHaveBeenCalled()
    fireEvent.click(within(await screen.findByRole('alertdialog', { name: 'Refund order #42?' })).getByRole('button', { name: 'Refund $80.00' }))
    expect(handleRefundPaymentsStripe).toHaveBeenCalledTimes(1)
  })

  it('offers no refund to a read-only user', () => {
    renderBill({}, { viewOnly: true })
    expect(screen.queryByTestId('refund-to-wallet')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Refund' })).toBeNull()
  })

  it('moves delivery preference, comment, spot and vehicle out of the bill', () => {
    renderBill({ comment: 'Leave it', spot_number: '7', vehicle: { type: 'car', model: 'X' } })
    expect(screen.queryByRole('table', { name: 'Delivery preference' })).toBeNull()
    expect(screen.queryByRole('table', { name: 'Comment' })).toBeNull()
    expect(screen.queryByRole('table', { name: 'Vehicle' })).toBeNull()
  })

  it('the default variant still renders those tables (print keeps using it)', () => {
    renderWithProviders(
      <OrderBill order={order({ comment: 'Leave it' })} actionStatus={{ loading: false }} />
    )
    expect(screen.getByRole('table', { name: 'Delivery preference' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Comment' })).toBeInTheDocument()
  })
})
