import { describe, expect, it } from 'vitest'

import {
  buildOrderPlacedForViaHtml,
  getOrderPlacedDatetimeHtml,
  getOrderPlacedViaCopy
} from '../orderPlacedHistory'

describe('getOrderPlacedViaCopy', () => {
  it('uses OTHER when app_id is missing', () => {
    expect(getOrderPlacedViaCopy(null)).toEqual({
      key: 'OTHER',
      fallback: 'Other'
    })
    expect(getOrderPlacedViaCopy(undefined)).toEqual({
      key: 'OTHER',
      fallback: 'Other'
    })
  })

  it('does not throw when app_id is missing', () => {
    expect(() => getOrderPlacedViaCopy(null)).not.toThrow()
  })

  it('builds a translation key and fallback from app_id', () => {
    expect(getOrderPlacedViaCopy('ordering_app')).toEqual({
      key: 'ORDERING_APP',
      fallback: 'Ordering app'
    })
  })
})

describe('getOrderPlacedDatetimeHtml', () => {
  it('wraps the utc datetime when it is present', () => {
    expect(getOrderPlacedDatetimeHtml({
      deliveryDatetimeUtc: '2026-01-01T12:00:00Z',
      parseUtcDate: () => 'Jan 1, 12:00 PM',
      parseLocalDate: () => 'should not run'
    })).toBe('<b>Jan 1, 12:00 PM</b>')
  })

  it('wraps the local datetime when utc is missing', () => {
    expect(getOrderPlacedDatetimeHtml({
      deliveryDatetimeUtc: null,
      parseUtcDate: () => 'should not run',
      parseLocalDate: () => 'Jan 1, 7:00 AM'
    })).toBe('<b>Jan 1, 7:00 AM</b>')
  })
})

describe('buildOrderPlacedForViaHtml', () => {
  it('fills the template without evaluating a missing app_id', () => {
    const via = getOrderPlacedViaCopy(null)
    expect(buildOrderPlacedForViaHtml({
      template: 'Order placed for _for_ via _via_.',
      deliveryDatetimeUtc: '2026-01-01T12:00:00Z',
      parseUtcDate: () => 'Jan 1',
      parseLocalDate: () => 'local',
      viaLabel: via.fallback
    })).toBe('Order placed for <b>Jan 1</b> via <b>Other</b>.')
  })
})
