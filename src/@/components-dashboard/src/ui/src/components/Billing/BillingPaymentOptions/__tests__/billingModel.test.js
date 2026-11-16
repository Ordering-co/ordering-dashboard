import { describe, expect, it } from 'vitest'

import {
  BILLING_NOTICE_KEY,
  otherPastDueCount,
  peekBillingResult,
  pickSubscription,
  rememberBillingResult,
  subscriptionSummary,
  takeBillingResult,
  toMessages,
  upgradePrices
} from '../billingModel'

// redesign BM-A (M-BM2, M-BM17, M-BM18, M-BM20): the pure rules behind the billing dialog.
const sub = (id, status, planId, extra = {}) => ({ id, status, plan: { plan: { id: planId, name: `Plan ${planId}` } }, ...extra })

const memoryStorage = () => {
  const map = new Map()
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)) },
    removeItem: key => { map.delete(key) },
    map
  }
}

const brokenStorage = () => {
  const fail = () => { throw new Error('SecurityError') }
  return { getItem: fail, setItem: fail, removeItem: fail }
}

describe('pickSubscription', () => {
  const subscriptions = [sub(1, 'active', 10), sub(2, 'past_due', 20), sub(3, 'past_due', 30)]

  it('pays the first past_due subscription as main does', () => {
    expect(pickSubscription({ subscriptions, isUpgrade: false, upgradePlanIds: [] }).id).toBe(2)
  })

  it('on upgrade takes the first active subscription', () => {
    expect(pickSubscription({ subscriptions, isUpgrade: true, upgradePlanIds: [] }).id).toBe(1)
  })

  it('on upgrade also matches a subscription of one of the upgrade plans, whatever its status', () => {
    const list = [sub(5, 'trialing', 11), sub(6, 'past_due', 99)]
    expect(pickSubscription({ subscriptions: list, isUpgrade: true, upgradePlanIds: [99] }).id).toBe(6)
  })

  it('ignores the upgrade plan ids when it is not an upgrade', () => {
    const list = [sub(5, 'trialing', 99)]
    expect(pickSubscription({ subscriptions: list, isUpgrade: false, upgradePlanIds: [99] })).toBeNull()
  })

  it('returns null with no match, no list or no plan ids', () => {
    expect(pickSubscription({ subscriptions: [], isUpgrade: false })).toBeNull()
    expect(pickSubscription({ subscriptions: undefined, isUpgrade: true })).toBeNull()
    expect(pickSubscription({ subscriptions: [sub(1, 'trialing', 1)], isUpgrade: true })).toBeNull()
  })

  it('skips empty entries', () => {
    expect(pickSubscription({ subscriptions: [undefined, null, sub(2, 'past_due', 2)], isUpgrade: false }).id).toBe(2)
  })
})

describe('subscriptionSummary', () => {
  it('reads name, amount and interval of a recurring price', () => {
    const subscription = { ...sub(1, 'past_due', 10), plan: { plan: { name: 'Pro' }, price: { type: 'recurring', interval: 'month', amount: 599 } } }
    expect(subscriptionSummary(subscription)).toEqual({ name: 'Pro', amount: 599, interval: 'month' })
  })

  it('falls back to the subscription interval', () => {
    const subscription = { interval: 'year', plan: { plan: { name: 'Pro' }, price: { type: 'recurring', amount: 100 } } }
    expect(subscriptionSummary(subscription)).toEqual({ name: 'Pro', amount: 100, interval: 'year' })
  })

  it('never invents an amount for tiered or usage prices', () => {
    for (const type of ['tiered', 'usage', 'per_unit']) {
      const subscription = { plan: { plan: { name: 'Pro' }, price: { type, interval: 'month', amount: 599 } } }
      expect(subscriptionSummary(subscription)).toEqual({ name: 'Pro', amount: null })
    }
  })

  it('never invents an amount without price or with a non numeric one', () => {
    expect(subscriptionSummary({ plan: { plan: { name: 'Pro' } } })).toEqual({ name: 'Pro', amount: null })
    expect(subscriptionSummary({ plan: { plan: { name: 'Pro' }, price: { type: 'recurring', amount: null } } })).toEqual({ name: 'Pro', amount: null })
    expect(subscriptionSummary({ plan: { plan: { name: 'Pro' }, price: { type: 'recurring', amount: 'abc' } } })).toEqual({ name: 'Pro', amount: null })
  })

  it('survives a missing subscription', () => {
    expect(subscriptionSummary(undefined)).toEqual({ name: null, amount: null })
    expect(subscriptionSummary(null)).toEqual({ name: null, amount: null })
  })
})

describe('upgradePrices', () => {
  it('returns monthly and annual with the per month amount', () => {
    expect(upgradePrices({ prices: { monthly: { amount: 599 }, annual: { amount: 5990 } } })).toEqual({
      monthly: { amount: 599 },
      annual: { amount: 5990, perMonth: 5990 / 12 }
    })
  })

  it('leaves the missing ones as null', () => {
    expect(upgradePrices({ prices: { monthly: { amount: 599 } } })).toEqual({ monthly: { amount: 599 }, annual: null })
    expect(upgradePrices({ prices: { annual: { amount: 120 } } })).toEqual({ monthly: null, annual: { amount: 120, perMonth: 10 } })
    expect(upgradePrices({})).toEqual({ monthly: null, annual: null })
    expect(upgradePrices(undefined)).toEqual({ monthly: null, annual: null })
  })

  it('treats a price without a numeric amount as missing', () => {
    expect(upgradePrices({ prices: { monthly: { amount: null }, annual: {} } })).toEqual({ monthly: null, annual: null })
  })
})

describe('toMessages', () => {
  it('normalises every shape the API and fetch give', () => {
    expect(toMessages('Card declined')).toEqual(['Card declined'])
    expect(toMessages(['A', 'B'])).toEqual(['A', 'B'])
    expect(toMessages([{ message: 'A' }, 'B'])).toEqual(['A', 'B'])
    expect(toMessages({ message: 'A' })).toEqual(['A'])
    expect(toMessages(new TypeError('Failed to fetch'))).toEqual(['Failed to fetch'])
  })

  it('returns an empty list for nothing', () => {
    expect(toMessages(null)).toEqual([])
    expect(toMessages(undefined)).toEqual([])
    expect(toMessages({})).toEqual([])
    expect(toMessages([null, undefined])).toEqual([])
  })
})

describe('otherPastDueCount', () => {
  it('counts the past_due subscriptions besides the one being paid', () => {
    const subscriptions = [sub(1, 'past_due', 1), sub(2, 'past_due', 2), sub(3, 'active', 3), sub(4, 'past_due', 4)]
    expect(otherPastDueCount({ subscriptions, targetId: 1 })).toBe(2)
    expect(otherPastDueCount({ subscriptions, targetId: undefined })).toBe(3)
  })

  it('is zero without a list', () => {
    expect(otherPastDueCount({ subscriptions: undefined, targetId: 1 })).toBe(0)
    expect(otherPastDueCount({ subscriptions: [sub(1, 'past_due', 1)], targetId: 1 })).toBe(0)
  })
})

describe('billing notice (survives the reload)', () => {
  it('remembers, peeks without removing, then takes once', () => {
    const storage = memoryStorage()
    rememberBillingResult('paid', storage)
    expect(storage.map.get(BILLING_NOTICE_KEY)).toBe('paid')
    expect(peekBillingResult(storage)).toBe('paid')
    expect(peekBillingResult(storage)).toBe('paid')
    expect(takeBillingResult(storage)).toBe('paid')
    expect(takeBillingResult(storage)).toBeNull()
    expect(peekBillingResult(storage)).toBeNull()
  })

  it('accepts only paid and upgraded', () => {
    const storage = memoryStorage()
    rememberBillingResult('upgraded', storage)
    expect(peekBillingResult(storage)).toBe('upgraded')
    rememberBillingResult('hacked', storage)
    expect(peekBillingResult(storage)).toBe('upgraded')
    storage.setItem(BILLING_NOTICE_KEY, '<img onerror=x>')
    expect(peekBillingResult(storage)).toBeNull()
    expect(takeBillingResult(storage)).toBeNull()
    expect(storage.map.has(BILLING_NOTICE_KEY)).toBe(false)
  })

  it('never throws when storage throws', () => {
    const storage = brokenStorage()
    expect(() => rememberBillingResult('paid', storage)).not.toThrow()
    expect(peekBillingResult(storage)).toBeNull()
    expect(takeBillingResult(storage)).toBeNull()
  })

  it('never throws when storage is missing', () => {
    expect(() => rememberBillingResult('paid', undefined)).not.toThrow()
    expect(() => rememberBillingResult('paid', null)).not.toThrow()
    expect(peekBillingResult(null)).toBeNull()
    expect(takeBillingResult(null)).toBeNull()
  })
})
