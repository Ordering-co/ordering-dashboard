import { describe, expect, it } from 'vitest'
import {
  PAYOUT_RULE_DEFAULTS,
  getPayoutRuleExample,
  isSamePayoutRule,
  toPayoutRuleForm,
  toPayoutRulePayload,
  validatePayoutRuleForm
} from '../payoutRuleHelpers'

describe('payoutRuleHelpers', () => {
  it('starts a scope without a rule from the contract defaults', () => {
    expect(toPayoutRuleForm('platform', null)).toEqual({ fixed: '0', percentage: '0', percentage_base: 'subtotal' })
    expect(toPayoutRuleForm('driver', null)).toMatchObject({
      order_type: 'fixed',
      delivery_fee_percentage: '100',
      tip_percentage: '100',
      additional_fixed: '0',
      additional_percentage: '0'
    })
  })

  it('reads a saved rule into strings, field by field', () => {
    expect(toPayoutRuleForm('platform', { fixed: 1.5, percentage: 10, percentage_base: 'total' }))
      .toEqual({ fixed: '1.5', percentage: '10', percentage_base: 'total' })
  })

  it('accepts what the API accepts', () => {
    expect(validatePayoutRuleForm('platform', { fixed: '1000000', percentage: '99.99', percentage_base: 'total' })).toEqual({})
    expect(validatePayoutRuleForm('driver', PAYOUT_RULE_DEFAULTS.driver)).toEqual({})
  })

  it('refuses what the API would refuse', () => {
    expect(validatePayoutRuleForm('platform', { fixed: '1.234', percentage: '100.01', percentage_base: 'tip' }))
      .toEqual({ fixed: 'amount', percentage: 'percentage', percentage_base: 'option' })
    expect(validatePayoutRuleForm('platform', { fixed: '-1', percentage: '', percentage_base: 'subtotal' }))
      .toEqual({ fixed: 'amount', percentage: 'percentage' })
    expect(validatePayoutRuleForm('platform', { fixed: '1000000.01', percentage: '1e1', percentage_base: 'subtotal' }))
      .toEqual({ fixed: 'amount', percentage: 'percentage' })
  })

  it('sends every field of the scope, numbers as numbers', () => {
    expect(toPayoutRulePayload('driver', { ...PAYOUT_RULE_DEFAULTS.driver, order_fixed: ' 3.50 ', tip_percentage: '80' })).toEqual({
      order_type: 'fixed',
      order_fixed: 3.5,
      order_percentage: 0,
      order_base: 'subtotal',
      delivery_fee_percentage: 100,
      tip_percentage: 80,
      additional_fixed: 0,
      additional_percentage: 0,
      additional_base: 'subtotal'
    })
  })

  it('tells a changed form from the saved rule', () => {
    const rule = { fixed: 1, percentage: 10, percentage_base: 'subtotal' }
    expect(isSamePayoutRule('platform', { fixed: '1.00', percentage: '10', percentage_base: 'subtotal' }, rule)).toBe(true)
    expect(isSamePayoutRule('platform', { fixed: '1.5', percentage: '10', percentage_base: 'subtotal' }, rule)).toBe(false)
    expect(isSamePayoutRule('platform', { fixed: '1', percentage: '10', percentage_base: 'total' }, rule)).toBe(false)
    expect(isSamePayoutRule('platform', { fixed: '', percentage: '10', percentage_base: 'subtotal' }, rule)).toBe(false)
    // Nothing is saved yet: the defaults on screen still have to be saved
    expect(isSamePayoutRule('platform', PAYOUT_RULE_DEFAULTS.platform, null)).toBe(false)
  })

  it('works out the example order as the API would: 20.00 in products, 3.00 delivery fee, 2.00 tip', () => {
    expect(getPayoutRuleExample('driver', PAYOUT_RULE_DEFAULTS.driver)).toEqual({
      parts: { order: 0, delivery_fee: 300, tip: 200, extra_fixed: 0, extra_percentage: 0 },
      total: 500
    })
    expect(getPayoutRuleExample('driver', {
      ...PAYOUT_RULE_DEFAULTS.driver,
      order_type: 'percentage',
      order_percentage: '10',
      order_base: 'subtotal',
      tip_percentage: '50',
      additional_fixed: '1',
      additional_percentage: '2',
      additional_base: 'total'
    })).toEqual({
      parts: { order: 200, delivery_fee: 300, tip: 100, extra_fixed: 100, extra_percentage: 50 },
      total: 750
    })
    expect(getPayoutRuleExample('platform', { fixed: '1', percentage: '10', percentage_base: 'subtotal' }))
      .toEqual({ parts: { fixed: 100, percentage: 200 }, total: 300 })
    // Half a cent goes up: 12.5% of 3.00 is 37.5 cents
    expect(getPayoutRuleExample('driver', { ...PAYOUT_RULE_DEFAULTS.driver, delivery_fee_percentage: '12.5' }).parts.delivery_fee).toBe(38)
  })

  it('leaves the example without a total while a value cannot be read', () => {
    const example = getPayoutRuleExample('driver', { ...PAYOUT_RULE_DEFAULTS.driver, tip_percentage: '150' })
    expect(example.parts.tip).toBeNull()
    expect(example.parts.delivery_fee).toBe(300)
    expect(example.total).toBeNull()
  })
})
