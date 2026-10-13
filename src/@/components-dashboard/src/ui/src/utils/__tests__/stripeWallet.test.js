import { describe, expect, it, vi } from 'vitest'
import {
  getWalletCompleteStatus,
  mapWalletPaymentMethod,
  settleWalletPayment,
  toStripeAmountCents
} from '../stripeWallet'

const paymentMethod = {
  id: 'pm_123',
  type: 'card',
  card: {
    brand: 'visa',
    last4: '4242'
  }
}

describe('toStripeAmountCents', () => {
  it('rounds common float totals instead of flooring a cent away', () => {
    expect(toStripeAmountCents(19.99)).toBe(1999)
    expect(toStripeAmountCents(10.1)).toBe(1010)
    expect(toStripeAmountCents(0.1)).toBe(10)
  })

  it('keeps whole-dollar amounts exact', () => {
    expect(toStripeAmountCents(10)).toBe(1000)
  })
})

describe('mapWalletPaymentMethod', () => {
  it('maps a Stripe paymentmethod event payload for checkout', () => {
    expect(mapWalletPaymentMethod(paymentMethod)).toEqual({
      brand: 'visa',
      last4: '4242',
      id: 'pm_123',
      type: 'card',
      source_id: 'pm_123',
      card: {
        brand: 'visa',
        last4: '4242'
      }
    })
  })

  it('returns null when the payment method is missing', () => {
    expect(mapWalletPaymentMethod(null)).toBe(null)
  })
})

describe('getWalletCompleteStatus', () => {
  it('is success only for a completed place', () => {
    expect(getWalletCompleteStatus({ error: false, result: { id: 1 } })).toBe('success')
    expect(getWalletCompleteStatus({ error: true, result: ['failed'] })).toBe('fail')
    expect(getWalletCompleteStatus(null)).toBe('fail')
  })
})

describe('settleWalletPayment', () => {
  it('waits for placeOrder and reports fail when checkout errors', async () => {
    const placeOrder = vi.fn().mockResolvedValue({ error: true, result: ['failed'] })

    const outcome = await settleWalletPayment({
      paymentMethod,
      placeOrder
    })

    expect(placeOrder).toHaveBeenCalledTimes(1)
    expect(outcome.complete).toBe('fail')
    expect(outcome.shouldCancel).toBe(false)
  })

  it('does not report success until placeOrder resolves', async () => {
    let resolvePlace
    let settled = false
    const placeOrder = vi.fn(() => new Promise(resolve => {
      resolvePlace = resolve
    }))

    const pending = settleWalletPayment({ paymentMethod, placeOrder }).then(outcome => {
      settled = true
      return outcome
    })
    await Promise.resolve()
    expect(placeOrder).toHaveBeenCalledTimes(1)
    expect(settled).toBe(false)

    resolvePlace({ error: false, result: { uuid: 'cart-1' } })
    await expect(pending).resolves.toMatchObject({
      complete: 'success',
      shouldCancel: true
    })
    expect(settled).toBe(true)
  })

  it('reports fail when placeOrder throws', async () => {
    const outcome = await settleWalletPayment({
      paymentMethod,
      placeOrder: vi.fn().mockRejectedValue(new Error('network'))
    })

    expect(outcome.complete).toBe('fail')
    expect(outcome.shouldCancel).toBe(false)
  })
})
