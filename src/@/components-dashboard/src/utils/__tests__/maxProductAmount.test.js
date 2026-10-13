import { describe, expect, it } from 'vitest'
import { DEFAULT_MAX_PRODUCT_AMOUNT, getMaxProductAmount } from '../maxProductAmount'

const withValue = (value) => ({ max_product_amount: { key: 'max_product_amount', value } })

describe('getMaxProductAmount', () => {
  it.each([
    ['5', 5],
    [' 5 ', 5],
    ['1000', 1000],
    [5, 5]
  ])('accepts the positive integer %j', (value, expected) => {
    expect(getMaxProductAmount(withValue(value))).toBe(expected)
  })

  it.each([
    [''],
    ['abc'],
    ['0'],
    ['-5'],
    ['3.7'],
    ['5abc'],
    ['1e3'],
    ['Infinity'],
    [0],
    [-5],
    [3.7],
    [NaN],
    [Infinity],
    [null],
    [undefined],
    [true],
    [{}]
  ])('falls back to the default for the invalid value %j', (value) => {
    expect(getMaxProductAmount(withValue(value))).toBe(DEFAULT_MAX_PRODUCT_AMOUNT)
  })

  it('falls back to the default when the config is missing or malformed', () => {
    expect(getMaxProductAmount({})).toBe(DEFAULT_MAX_PRODUCT_AMOUNT)
    expect(getMaxProductAmount(undefined)).toBe(DEFAULT_MAX_PRODUCT_AMOUNT)
    expect(getMaxProductAmount({ max_product_amount: null })).toBe(DEFAULT_MAX_PRODUCT_AMOUNT)
    expect(getMaxProductAmount({ max_product_amount: '5' })).toBe(DEFAULT_MAX_PRODUCT_AMOUNT)
  })
})
