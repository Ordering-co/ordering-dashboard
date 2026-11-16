/* eslint-disable import/first */
// redesign W0-3a (T0-9, decisión 11a): the amounts of the bill (rows, total, payments) are figures: mono with tabular
// digits through `odc-figure`, on the node that holds the amount. The label cell beside it is a label and never gets it.
import React from 'react'
import { screen, within } from '@testing-library/react'
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

const rowOf = (label) => screen.getByText(label).closest('tr')

describe('OrderBill · amounts are figures (W0-3a, T0-9)', () => {
  it('puts odc-figure on the amount cell of every bill row and not on the label cell', () => {
    mount()
    ;[['Subtotal', '€ 200.50'], ['Tax', '€ 12.30'], ['Service fee', '€ 4.25'], ['Driver tip', '€ 5.00'], ['Delivery Fee', '€ 3.00']].forEach(([label, amount]) => {
      const row = rowOf(label)
      const cells = within(row).getAllByRole('cell')
      expect(cells[0], label).not.toHaveClass('odc-figure')
      expect(cells[1], label).toHaveClass('odc-figure')
      expect(cells[1], label).toHaveTextContent(amount)
    })
  })

  it('puts it on the total amount and not on the «Total» label', () => {
    mount()
    const cells = within(rowOf('Total')).getAllByRole('cell')
    expect(cells[0]).not.toHaveClass('odc-figure')
    expect(cells[1]).toHaveClass('odc-figure')
    expect(cells[1]).toHaveTextContent('€ 217.05')
  })

  it('puts it on the amount of a payment, and not on the method name or the status badge beside it', () => {
    const { container } = mount()
    const row = container.querySelector('.odt-pay-row')
    expect(row.querySelector('.odt-pay-amount')).toHaveClass('odc-figure')
    expect(row.querySelector('.odt-pay-amount')).toHaveTextContent('€ 217.05')
    expect(row.querySelector('.odt-pay-name')).not.toHaveClass('odc-figure')
    expect(within(row).getByText('Paid').closest('.odc-figure')).toBeNull()
  })

  it('keeps the estimated total of a custom order a figure, with its «~», and its label out of it', () => {
    mount({ order: order({ declared_value: 25, summary: { total: 10, subtotal: 10 } }) })
    const declared = within(rowOf('Declared value')).getAllByRole('cell')
    expect(declared[0]).not.toHaveClass('odc-figure')
    expect(declared[1]).toHaveClass('odc-figure')
    const cells = within(rowOf('Estimated Total')).getAllByRole('cell')
    expect(cells[0]).not.toHaveClass('odc-figure')
    expect(cells[1]).toHaveClass('odc-figure')
    expect(cells[1]).toHaveTextContent('~ € 35.00')
  })
})
