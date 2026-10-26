import { describe, it, expect } from 'vitest'
import { isItemsRefundAvailable, buildRefundItems, buildRefundRequest } from '../refundRequest'

const cashWallet = { value: 'cash_wallet' }
const pointsWallet = { value: 12 }
const stripe = { value: 13, isStripe: true }
const braintree = { value: 14, isBraintree: true }

describe('isItemsRefundAvailable', () => {
  it('allows any non-Stripe method for admins and business managers', () => {
    expect(isItemsRefundAvailable(cashWallet, 0)).toBe(true)
    expect(isItemsRefundAvailable(pointsWallet, 2)).toBe(true)
    expect(isItemsRefundAvailable(braintree, 0)).toBe(true)
  })

  it('hides it for Stripe, other roles and when no method is picked', () => {
    expect(isItemsRefundAvailable(stripe, 0)).toBe(false)
    expect(isItemsRefundAvailable(cashWallet, 5)).toBe(false)
    expect(isItemsRefundAvailable(undefined, 0)).toBe(false)
  })
})

describe('buildRefundItems', () => {
  it('sends quantities for whole products and only the picked add-ons otherwise', () => {
    expect(buildRefundItems({
      10: { quantity: 2, suboptions: {} },
      11: { quantity: 0, suboptions: { 501: 1, 502: '3' } },
      12: { quantity: 0, suboptions: {} }
    })).toEqual([
      { order_product_id: 10, quantity: 2 },
      {
        order_product_id: 11,
        suboptions: [
          { order_product_option_suboption_id: 501, quantity: 1 },
          { order_product_option_suboption_id: 502, quantity: 3 }
        ]
      }
    ])
  })
})

describe('buildRefundRequest', () => {
  const items = [{ order_product_id: 10, quantity: 1 }]

  it('uses v2 for items refunds to the cash wallet', () => {
    expect(buildRefundRequest({ option: cashWallet, mode: 'items', items, description: 'Sick day' })).toEqual({
      version: 'v2',
      mode: 'items',
      transfer_to: 'cash_wallet',
      items,
      description: 'Sick day'
    })
  })

  it('uses v2 for items refunds back to a points wallet payment', () => {
    expect(buildRefundRequest({ option: pointsWallet, mode: 'items', items })).toEqual({
      version: 'v2',
      mode: 'items',
      transfer_to: 'source',
      order_payment_event_id: 12,
      items
    })
  })

  it('keeps the legacy body for total and amount refunds outside Braintree', () => {
    expect(buildRefundRequest({ option: cashWallet, mode: 'total', orderTotal: 25 })).toEqual({
      amount: 25,
      transfer_to: 'cash_wallet'
    })
    expect(buildRefundRequest({ option: stripe, mode: 'amount', amount: 5, orderTotal: 25 })).toEqual({
      order_payment_event_id: 13,
      amount: 5,
      transfer_to: 'source'
    })
  })

  it('always uses v2 for Braintree', () => {
    expect(buildRefundRequest({ option: braintree, mode: 'total', orderTotal: 25 })).toEqual({
      version: 'v2',
      mode: 'total',
      transfer_to: 'source',
      order_payment_event_id: 14
    })
    expect(buildRefundRequest({ option: braintree, mode: 'amount', amount: 7 })).toMatchObject({ version: 'v2', mode: 'amount', amount: 7 })
  })
})
