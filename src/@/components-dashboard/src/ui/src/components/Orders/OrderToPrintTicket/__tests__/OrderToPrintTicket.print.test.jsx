/* eslint-disable import/first */
import React from 'react'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useConfig: () => [{ configs: {} }],
  useLanguage: () => [null, (_key, fallback) => fallback],
  useUtils: () => [{
    parseDate: value => value,
    parseNumber: value => value,
    parsePrice: (value, { currency } = {}) => `${currency ?? '$'}${Number(value ?? 0).toFixed(2)}`
  }]
}))

vi.mock('../../../../utils', () => ({
  getCurrenySymbol: () => '$',
  verifyDecimals: value => value,
  getTaxAmount: tax => tax?.summary?.tax ?? 0,
  getTaxesByTarget: () => [],
  getTaxKey: (_tax, index) => index,
  shouldShowTaxBillRow: () => true,
  shouldShowTaxRate: () => true,
  getFeeAmount: fee => fee?.summary?.fee ?? 0,
  getFeeKey: (_fee, index) => index,
  shouldShowFeeItem: () => true,
  shouldShowFeeRateDetails: () => true
}))

import { OrderToPrintTicket } from '..'
// Copy decision 4 (user, 2026-10-06): shared labels in sentence case; only the names these tests look up changed.

describe('OrderToPrintTicket print contract', () => {
  it('preserves ticket data order while separating long customer fields and keeping printable rows intact', () => {
    const order = {
      id: 84,
      status: 1,
      delivery_type: 1,
      delivery_datetime: '2026-09-15 10:30',
      currency: 'USD',
      paymethod: { name: 'Cash' },
      customer: {
        name: 'Ada',
        middle_name: 'Byron',
        lastname: 'Lovelace',
        second_lastname: 'Operations',
        email: 'a-very-long-customer-address@example-marketplace.test',
        cellphone: 'primary',
        phone: 'secondary',
        address: '100 Extremely Long Operations Avenue, Suite 123456789',
        internal_number: 'Unit 987654321',
        zipcode: '12345'
      },
      business: {
        name: 'Tenant restaurant',
        email: 'restaurant@example.test',
        address: '200 Business Road'
      },
      products: [{
        id: 9,
        quantity: 1,
        name: 'Long product name that must wrap on a narrow receipt',
        price: 10,
        total: 10,
        ingredients: [{ id: 1, name: 'Onion', selected: false }],
        options: [],
        comment: 'Keep this printable comment with the product'
      }],
      taxes: [],
      fees: [],
      offers: [],
      tax_type: 2,
      tax: 0,
      service_fee: 0,
      summary: {
        subtotal: 10,
        discount: 0,
        tax: 0,
        service_fee: 0,
        driver_tip: 0,
        total: 10
      }
    }

    renderWithProviders(
      <OrderToPrintTicket order={order} getOrderStatus={() => ({ value: 'Pending' })} />
    )

    const document = screen.getByRole('document', { hidden: true })
    expect(screen.getByRole('heading', { name: 'Order No. 84', hidden: true })).toBeInTheDocument()
    const customerDetails = screen.getByText(/Full Name: Ada Byron Lovelace Operations/)
    expect(customerDetails.innerHTML).toContain('Mobile Phone: secondary<br>Full Addres')
    expect(customerDetails.innerHTML).toContain('Unit 987654321<br>Zipcode')
    expect(document).toHaveTextContent('No Onion')
    expect(document).toHaveTextContent('Comment: Keep this printable comment with the product')

    const subtotal = screen.getByText('Subtotal')
    expect(getComputedStyle(subtotal).width).toBe('70%')
    expect(getComputedStyle(document).fontFamily).toContain('arial')
    expect(getComputedStyle(document).overflowWrap).toBe('anywhere')
  })
})
