import { describe, expect, it } from 'vitest'
import { limitOrderSearchInput, numericSearchText } from '../orderSearchInput'

describe('orders search input', () => {
  it('keeps 822 and the API maximum, and drops anything bigger', () => {
    expect(limitOrderSearchInput('822')).toBe('822')
    expect(limitOrderSearchInput('2147483647')).toBe('2147483647')
    expect(limitOrderSearchInput('2147483648')).toBe('214748364')
    expect(limitOrderSearchInput('99999999999999999999999999990012312312312312863781263812312312')).toBe('999999999')
  })

  it('stops names and emails at 50 characters', () => {
    expect(limitOrderSearchInput('katie')).toBe('katie')
    expect(limitOrderSearchInput('a'.repeat(80))).toBe('a'.repeat(50))
  })

  it('uses ilike only for a number that fits, and skips text', () => {
    expect(numericSearchText('822')).toBe('822')
    expect(numericSearchText('2147483647')).toBe('2147483647')
    expect(numericSearchText('2147483648')).toBeNull()
    expect(numericSearchText('katie')).toBeNull()
  })
})
