/* eslint-disable import/first */
import React from 'react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  // RefundToWallet reads the user level (refund by items, levels 0 and 2)
  useSession: () => [{ user: { id: 1, level: 0 } }],
  useConfig: () => [{ configs: {} }],
  useLanguage: () => [null, (_key, fallback) => fallback],
  useUtils: () => [{
    parseNumber: value => value,
    parsePrice: value => `$${Number(value ?? 0).toFixed(2)}`
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

import { OrderBill } from '..'
import { RefundToWallet } from '../RefundToWallet'

const actionStatus = { loading: false }

describe('OrderBill refund accessibility and payloads', () => {
  it('submits the unchanged partial provider amount through named native controls', () => {
    const handleRefundPaymentsPlugin = vi.fn()
    const order = {
      id: 42,
      currency: 'USD',
      delivery_type: 2,
      products: [{ id: 1, type: 'food' }],
      paymethod: { gateway: 'provider_x' },
      summary: { total: 80, subtotal: 80, discount: 0, tax: 0, service_fee: 0 },
      taxes: [],
      fees: [],
      offers: [],
      payment_events: []
    }

    renderWithProviders(
      <OrderBill
        order={order}
        actionStatus={actionStatus}
        getPluginRefundProvider={() => ({ partial: true })}
        handleRefundPaymentsPlugin={handleRefundPaymentsPlugin}
      />
    )

    expect(screen.getByRole('table', { name: 'Order bill' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Refund' }))

    const dialog = screen.getByRole('dialog')
    const totalMode = within(dialog).getByRole('radio', { name: 'Refund all' })
    const amountMode = within(dialog).getByRole('radio', { name: 'Refund only an amount' })
    expect(totalMode).toHaveAttribute('tabindex', '0')
    expect(amountMode).toHaveAttribute('tabindex', '-1')
    fireEvent.keyDown(totalMode, { key: 'ArrowDown' })
    expect(amountMode).toBeChecked()
    expect(amountMode).toHaveAttribute('tabindex', '0')
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Amount' }), { target: { value: '25.5' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Refund' }))

    expect(handleRefundPaymentsPlugin).toHaveBeenCalledTimes(1)
    expect(handleRefundPaymentsPlugin).toHaveBeenCalledWith(25.5)
    expect(dialog.querySelector('div[onClick], span[onClick]')).toBeNull()
  })

  // the picker refunds whole products with a quantity; add-ons are not offered
  it('keeps the Braintree item-refund payload and exposes every item control by name', async () => {
    const handleOrderRefund = vi.fn()
    const order = {
      id: 77,
      currency: 'USD',
      paymethod: { gateway: 'braintree' },
      summary: { total: 44 },
      payment_events: [{
        id: 91,
        event: 'payment',
        paymethod: { gateway: 'braintree', name: 'Braintree' }
      }],
      products: [{
        id: 12,
        name: 'Build your own pizza',
        quantity: 2,
        options: [{
          id: 4,
          name: 'Toppings',
          suboptions: [{
            id: 6,
            order_product_option_suboption_id: 306,
            name: 'Extra cheese',
            quantity: 2
          }]
        }]
      }]
    }

    renderWithProviders(
      <RefundToWallet
        order={order}
        actionStatus={actionStatus}
        handleOrderRefund={handleOrderRefund}
        stripePaymethods={['stripe', 'stripe_connect']}
        braintreePaymethods={['braintree']}
      />
    )

    const openRefund = await screen.findByRole('button', { name: 'Refund' })
    fireEvent.click(openRefund)
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Refund types' }))
    fireEvent.click(within(dialog).getByRole('option', { name: 'Braintree' }))
    const totalMode = within(dialog).getByRole('radio', { name: 'Refund all' })
    const amountMode = within(dialog).getByRole('radio', { name: 'Refund only an amount' })
    const itemsMode = within(dialog).getByRole('radio', { name: 'Refund specific items' })
    fireEvent.keyDown(totalMode, { key: 'ArrowDown' })
    expect(amountMode).toBeChecked()
    fireEvent.keyDown(amountMode, { key: 'ArrowDown' })
    expect(itemsMode).toBeChecked()
    expect([totalMode, amountMode, itemsMode].filter(control => control.tabIndex === 0)).toHaveLength(1)

    expect(within(dialog).queryByRole('button', { name: 'Expand Build your own pizza' })).toBeNull()
    expect(within(dialog).queryByRole('checkbox', { name: 'Refund Extra cheese' })).toBeNull()
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Refund Build your own pizza' }))
    fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Qty Build your own pizza' }), { target: { value: '1' } })
    // redesign 5.4: the form of the wallet refund submits with Continue (the plugin's partial dialog keeps Refund).
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }))
    expect(handleOrderRefund).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: 'Refund 1 item' }))

    await waitFor(() => {
      expect(handleOrderRefund).toHaveBeenCalledWith({
        version: 'v2',
        transfer_to: 'source',
        order_payment_event_id: 91,
        mode: 'items',
        items: [{ order_product_id: 12, quantity: 1 }]
      })
    })
  })
})
