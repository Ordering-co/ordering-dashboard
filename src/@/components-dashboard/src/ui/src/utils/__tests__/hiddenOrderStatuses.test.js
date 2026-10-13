import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../../index.js', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ user: null }],
  CODES: {}
}))

import { getHiddenOrderStatuses } from '../index'

describe('getHiddenOrderStatuses', () => {
  it('keeps pickup failed by driver and not picked up by customer available in quickiedelivery', () => {
    const hidden = getHiddenOrderStatuses('quickiedelivery')
    expect(hidden).not.toContain(10)
    expect(hidden).not.toContain(17)
  })

  it('still hides rejected by driver in quickiedelivery', () => {
    expect(getHiddenOrderStatuses('quickiedelivery')).toEqual([6])
  })

  it('matches the project case-insensitively', () => {
    expect(getHiddenOrderStatuses('QuickieDelivery')).toEqual([6])
  })

  it('does not hide statuses in other projects', () => {
    expect(getHiddenOrderStatuses('demo')).toEqual([])
    expect(getHiddenOrderStatuses(undefined)).toEqual([])
  })
})
