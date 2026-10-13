import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../../index.js', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ user: null }],
  CODES: {}
}))

import { FINAL_ORDER_STATUSES, isFinalOrderStatusLocked } from '../index'

describe('isFinalOrderStatusLocked', () => {
  it('locks every final status for a business owner in quickiedelivery', () => {
    FINAL_ORDER_STATUSES.forEach(status => {
      expect(isFinalOrderStatusLocked('quickiedelivery', 2, status)).toBe(true)
    })
  })

  it('accepts the status as a string and matches the project case-insensitively', () => {
    expect(isFinalOrderStatusLocked('QuickieDelivery', 2, '12')).toBe(true)
  })

  it('does not lock in-progress statuses for a business owner', () => {
    [0, 7, 4, 8, 3, 9, 13].forEach(status => {
      expect(isFinalOrderStatusLocked('quickiedelivery', 2, status)).toBe(false)
    })
  })

  it('does not lock admins or driver managers', () => {
    expect(isFinalOrderStatusLocked('quickiedelivery', 0, 11)).toBe(false)
    expect(isFinalOrderStatusLocked('quickiedelivery', 5, 11)).toBe(false)
  })

  it('does not lock other projects', () => {
    expect(isFinalOrderStatusLocked('demo', 2, 11)).toBe(false)
    expect(isFinalOrderStatusLocked(undefined, 2, 11)).toBe(false)
  })
})
