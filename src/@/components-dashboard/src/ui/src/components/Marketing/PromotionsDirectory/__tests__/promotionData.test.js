// redesign PE-B1 (decisions 3, 4, 8, 9; PE-01, PE-02, PE-04): the pure side of the promotions list. No React, no context.
// A fixed `now` in every status test: the status depends on the clock and a test must not.
import { describe, expect, it, vi } from 'vitest'

import {
  isPromotionEnabled,
  promotionAppliesLabel,
  promotionBenefit,
  promotionDates,
  promotionStatus,
  promotionStatusKey,
  promotionTargetLabel,
  sortByRank
} from '../promotionData'

const t = (_key, text) => text
// a stand-in for parsePrice with a visible currency, so a figure is told from a plain number
const parsePrice = (value) => `£${Number(value).toFixed(2)}`

// 10 Oct 2026, 12:00 local wall time (the dates of an offer are naive wall-clock strings)
const NOW = new Date(2026, 9, 10, 12, 0, 0)
const on = { enabled: true }

describe('promotionStatusKey', () => {
  it.each([false, 0, '0', null, undefined])('a promotion with enabled %j is off', (enabled) => {
    expect(promotionStatusKey({ enabled }, NOW)).toBe('off')
  })

  it('a disabled promotion whose dates have passed is Off, not Ended (the switch is checked first)', () => {
    expect(promotionStatusKey({ enabled: 0, start: '2026-01-01 00:00:00', end: '2026-02-01 23:59:59' }, NOW)).toBe('off')
    expect(promotionStatusKey({ enabled: false, start: '2027-01-01 00:00:00' }, NOW)).toBe('off')
  })

  it('a start in the future is scheduled', () => {
    expect(promotionStatusKey({ ...on, start: '2026-10-11 00:00:00', end: '2026-12-31 23:59:59' }, NOW)).toBe('scheduled')
  })

  it('an end in the past is ended', () => {
    expect(promotionStatusKey({ ...on, start: '2026-01-01 00:00:00', end: '2026-10-09 23:59:59' }, NOW)).toBe('ended')
  })

  it('on and inside its dates is active', () => {
    expect(promotionStatusKey({ ...on, start: '2026-10-01 00:00:00', end: '2026-10-31 23:59:59' }, NOW)).toBe('active')
  })

  it('no end date never ends: active', () => {
    expect(promotionStatusKey({ ...on, start: '2026-10-01 00:00:00', end: null }, NOW)).toBe('active')
    expect(promotionStatusKey({ ...on, start: '2026-10-01 00:00:00' }, NOW)).toBe('active')
  })

  it('no start date is already started: active', () => {
    expect(promotionStatusKey({ ...on, start: null, end: '2026-12-31 23:59:59' }, NOW)).toBe('active')
    expect(promotionStatusKey(on, NOW)).toBe('active')
  })

  it('an invalid or empty date never decides', () => {
    expect(promotionStatusKey({ ...on, start: 'soon', end: 'never' }, NOW)).toBe('active')
    expect(promotionStatusKey({ ...on, start: '', end: '' }, NOW)).toBe('active')
    expect(promotionStatusKey({ ...on, start: '2026-10-01', end: '31/12/2026' }, NOW)).toBe('active') // not the format of the API
  })

  it('a start or an end equal to now is active (the boundary is inside)', () => {
    expect(promotionStatusKey({ ...on, start: '2026-10-10 12:00:00' }, NOW)).toBe('active')
    expect(promotionStatusKey({ ...on, end: '2026-10-10 12:00:00' }, NOW)).toBe('active')
    expect(promotionStatusKey({ ...on, end: '2026-10-10 11:59:59' }, NOW)).toBe('ended')
    expect(promotionStatusKey({ ...on, start: '2026-10-10 12:00:01' }, NOW)).toBe('scheduled')
  })

  it('a missing promotion is off', () => {
    expect(promotionStatusKey(undefined, NOW)).toBe('off')
    expect(promotionStatusKey(null, NOW)).toBe('off')
  })
})

describe('isPromotionEnabled', () => {
  it('reads the stored flag the way the status does', () => {
    expect([true, 1, '1', 'true'].map(isPromotionEnabled)).toEqual([true, true, true, true])
    expect([false, 0, '0', 'false', null, undefined, ''].map(isPromotionEnabled)).toEqual([false, false, false, false, false, false, false])
  })
})

describe('promotionStatus', () => {
  it('gives a family of P/Status and a word for each key', () => {
    const at = (promotion) => promotionStatus(promotion, t, NOW)
    expect(at({ ...on })).toEqual({ key: 'active', family: 'progress', label: 'Active' })
    expect(at({ ...on, start: '2027-01-01 00:00:00' })).toEqual({ key: 'scheduled', family: 'pending', label: 'Scheduled' })
    expect(at({ ...on, end: '2026-01-01 00:00:00' })).toEqual({ key: 'ended', family: 'done', label: 'Ended' })
    expect(at({ enabled: false })).toEqual({ key: 'off', family: 'pending', label: 'Off' })
  })

  it('asks the translator with a literal key for each word', () => {
    const keys = []
    const spy = (key, text) => { keys.push(key); return text }
    promotionStatus({ ...on }, spy, NOW)
    promotionStatus({ ...on, start: '2027-01-01 00:00:00' }, spy, NOW)
    promotionStatus({ ...on, end: '2026-01-01 00:00:00' }, spy, NOW)
    promotionStatus({ enabled: 0 }, spy, NOW)
    expect(keys).toEqual(['ACTIVE', 'PROMOTION_STATUS_SCHEDULED', 'PROMOTION_STATUS_ENDED', 'PROMOTION_STATUS_OFF'])
  })
})

describe('promotionTargetLabel', () => {
  it('names the three targets', () => {
    expect(promotionTargetLabel(1, t)).toBe('Subtotal')
    expect(promotionTargetLabel(2, t)).toBe('Delivery fee')
    expect(promotionTargetLabel(3, t)).toBe('Service fee')
  })

  it('uses the keys the advanced list used', () => {
    const keys = []
    const spy = (key, text) => { keys.push(key); return text }
    ;[1, 2, 3].forEach(target => promotionTargetLabel(target, spy))
    expect(keys).toEqual(['MOBILE_FRONT_SUB_TOTAL', 'DELIVERY_FEE', 'BUSINESS_SERVICE_FEE'])
  })

  it('an unknown target is the raw value as a string, as today', () => {
    expect(promotionTargetLabel(9, t)).toBe('9')
    expect(promotionTargetLabel(null, t)).toBe('')
    expect(promotionTargetLabel(undefined, t)).toBe('')
  })
})

describe('promotionAppliesLabel', () => {
  it('is the mapping of main: type 1 is a discount, anything else a coupon, and auto makes it automatic', () => {
    expect(promotionAppliesLabel({ type: 1, auto: true }, t)).toBe('Automatic discount')
    expect(promotionAppliesLabel({ type: 1, auto: false }, t)).toBe('Discount')
    expect(promotionAppliesLabel({ type: 2, auto: true }, t)).toBe('Automatic coupon')
    expect(promotionAppliesLabel({ type: 2, auto: false }, t)).toBe('Coupon')
    expect(promotionAppliesLabel({ type: 2 }, t)).toBe('Coupon')
    expect(promotionAppliesLabel({}, t)).toBe('Coupon')
  })

  it('the discount word is the capitalized one of the catalog, not the lower-case default of main', () => {
    const asked = []
    promotionAppliesLabel({ type: 1 }, (key, text) => { asked.push([key, text]); return text })
    expect(asked).toEqual([['DISCOUNT', 'Discount']])
  })
})

describe('promotionBenefit', () => {
  const benefit = (promotion) => promotionBenefit(promotion, { t, parsePrice })

  it('a percent off the subtotal: the figure is its own part', () => {
    expect(benefit({ rate_type: 1, rate: 15, target: 1 })).toEqual([{ figure: '15%' }, { text: ' off' }])
  })

  it('writes the percent without trailing zeros', () => {
    expect(benefit({ rate_type: 1, rate: '15.00', target: 1 })[0]).toEqual({ figure: '15%' })
    expect(benefit({ rate_type: 1, rate: '12.5', target: 1 })[0]).toEqual({ figure: '12.5%' })
    expect(benefit({ rate_type: 1, rate: 12.50, target: 1 })[0]).toEqual({ figure: '12.5%' })
  })

  it('a fixed amount is written by parsePrice', () => {
    expect(benefit({ rate_type: 2, rate: 5, target: 1 })).toEqual([{ figure: '£5.00' }, { text: ' off' }])
  })

  it('100% off the delivery fee is Free delivery, only text', () => {
    expect(benefit({ rate_type: 1, rate: 100, target: 2 })).toEqual([{ text: 'Free delivery' }])
    expect(benefit({ rate_type: 1, rate: '100.00', target: 2 })).toEqual([{ text: 'Free delivery' }])
  })

  it('Free delivery keeps the minimum that goes with it', () => {
    expect(benefit({ rate_type: 1, rate: 100, target: 2, minimum: 20 })).toEqual([
      { text: 'Free delivery · min ' },
      { figure: '£20.00' }
    ])
  })

  it('100% off the subtotal or the service fee is not Free delivery', () => {
    expect(benefit({ rate_type: 1, rate: 100, target: 1 })).toEqual([{ figure: '100%' }, { text: ' off' }])
    expect(benefit({ rate_type: 1, rate: 100, target: 3 })).toEqual([{ figure: '100%' }, { text: ' off service fee' }])
  })

  it('10% off the delivery fee and an amount off the service fee name what they apply to', () => {
    expect(benefit({ rate_type: 1, rate: 10, target: 2 })).toEqual([{ figure: '10%' }, { text: ' off delivery fee' }])
    expect(benefit({ rate_type: 2, rate: 5, target: 3 })).toEqual([{ figure: '£5.00' }, { text: ' off service fee' }])
    // a fixed amount on the delivery fee is not the free-delivery case, whatever the number
    expect(benefit({ rate_type: 2, rate: 100, target: 2 })).toEqual([{ figure: '£100.00' }, { text: ' off delivery fee' }])
  })

  it('a minimum adds «· min <amount>» and only when it is above zero', () => {
    expect(benefit({ rate_type: 1, rate: 15, target: 1, minimum: 30 })).toEqual([
      { figure: '15%' },
      { text: ' off · min ' },
      { figure: '£30.00' }
    ])
    expect(benefit({ rate_type: 1, rate: 15, target: 1, minimum: 0 })).toEqual([{ figure: '15%' }, { text: ' off' }])
    expect(benefit({ rate_type: 1, rate: 15, target: 1, minimum: null })).toEqual([{ figure: '15%' }, { text: ' off' }])
    expect(benefit({ rate_type: 1, rate: 15, target: 1, minimum: '0.00' })).toEqual([{ figure: '15%' }, { text: ' off' }])
  })

  it('a cap adds «· max <amount>» for a percent only', () => {
    expect(benefit({ rate_type: 1, rate: 15, target: 1, max_discount: 10 })).toEqual([
      { figure: '15%' },
      { text: ' off · max ' },
      { figure: '£10.00' }
    ])
    expect(benefit({ rate_type: 2, rate: 5, target: 1, max_discount: 10 })).toEqual([{ figure: '£5.00' }, { text: ' off' }])
  })

  it('minimum and cap together, in that order', () => {
    expect(benefit({ rate_type: 1, rate: 15, target: 1, minimum: 30, max_discount: 10 })).toEqual([
      { figure: '15%' },
      { text: ' off · min ' },
      { figure: '£30.00' },
      { text: ' · max ' },
      { figure: '£10.00' }
    ])
  })

  it('a rate that is missing or not a number has no benefit (the table shows a dash)', () => {
    expect(benefit({ rate_type: 1, target: 1 })).toEqual([])
    expect(benefit({ rate_type: 1, rate: null, target: 1 })).toEqual([])
    expect(benefit({ rate_type: 1, rate: '', target: 1 })).toEqual([])
    expect(benefit({ rate_type: 1, rate: 'ten', target: 1 })).toEqual([])
    expect(benefit({ rate_type: 2, rate: undefined, target: 1, minimum: 30 })).toEqual([])
    expect(benefit(undefined)).toEqual([])
  })

  it('an unknown rate type has no benefit rather than a guess', () => {
    expect(benefit({ rate_type: 9, rate: 5, target: 1 })).toEqual([])
  })

  it('a rate of zero is still a rate', () => {
    expect(benefit({ rate_type: 1, rate: 0, target: 1 })).toEqual([{ figure: '0%' }, { text: ' off' }])
  })

  it('asks the translator with literal keys, keeping the placeholder out of the text', () => {
    const keys = []
    const spy = (key, text) => { keys.push(key); return text }
    promotionBenefit({ rate_type: 1, rate: 15, target: 1, minimum: 30, max_discount: 10 }, { t: spy, parsePrice })
    promotionBenefit({ rate_type: 1, rate: 10, target: 2 }, { t: spy, parsePrice })
    promotionBenefit({ rate_type: 1, rate: 10, target: 3 }, { t: spy, parsePrice })
    promotionBenefit({ rate_type: 1, rate: 100, target: 2 }, { t: spy, parsePrice })
    expect(keys).toEqual([
      'PROMOTION_BENEFIT_OFF', 'PROMOTION_BENEFIT_MINIMUM', 'PROMOTION_BENEFIT_MAXIMUM',
      'PROMOTION_BENEFIT_OFF_DELIVERY',
      'PROMOTION_BENEFIT_OFF_SERVICE',
      'PROMOTION_BENEFIT_FREE_DELIVERY'
    ])
  })

  it('a translation that moves the placeholder moves the figure with it', () => {
    const swapped = (key, text) => (key === 'PROMOTION_BENEFIT_OFF' ? 'Descuento de _rate_' : text)
    expect(promotionBenefit({ rate_type: 1, rate: 15, target: 1 }, { t: swapped, parsePrice })).toEqual([
      { text: 'Descuento de ' },
      { figure: '15%' }
    ])
  })
})

describe('promotionDates', () => {
  it('writes each valid date through parseDate, day only, in local wall time, and never as ISO', () => {
    const parseDate = vi.fn((value) => `shown(${value})`)
    const dates = promotionDates({ start: '2026-10-01 00:00:00', end: '2026-10-31 23:59:59' }, parseDate)
    expect(dates).toEqual({ start: 'shown(2026-10-01 00:00:00)', end: 'shown(2026-10-31 23:59:59)' })
    expect(parseDate).toHaveBeenCalledTimes(2)
    expect(parseDate).toHaveBeenNthCalledWith(1, '2026-10-01 00:00:00', { utc: false, dateOnly: true })
    expect(parseDate).toHaveBeenNthCalledWith(2, '2026-10-31 23:59:59', { utc: false, dateOnly: true })
  })

  it('an empty, missing or invalid date is null and parseDate is not asked', () => {
    const parseDate = vi.fn(() => 'x')
    expect(promotionDates({ start: null, end: '' }, parseDate)).toEqual({ start: null, end: null })
    expect(promotionDates({}, parseDate)).toEqual({ start: null, end: null })
    expect(promotionDates({ start: 'soon', end: '31/12/2026' }, parseDate)).toEqual({ start: null, end: null })
    expect(promotionDates(undefined, parseDate)).toEqual({ start: null, end: null })
    expect(parseDate).not.toHaveBeenCalled()
  })

  it('one date may be set without the other', () => {
    const parseDate = (value) => `shown(${value})`
    expect(promotionDates({ start: '2026-10-01 00:00:00', end: null }, parseDate)).toEqual({ start: 'shown(2026-10-01 00:00:00)', end: null })
  })
})

describe('sortByRank', () => {
  it('sorts by rank ascending, in a new array', () => {
    const list = [{ id: 1, rank: 3 }, { id: 2, rank: 1 }, { id: 3, rank: 2 }]
    const before = list.map(item => item.id)
    const sorted = sortByRank(list)
    expect(sorted.map(item => item.id)).toEqual([2, 3, 1])
    expect(sorted).not.toBe(list)
    expect(list.map(item => item.id)).toEqual(before) // main sorted the state in place
  })

  it('puts a null, missing, empty or non-numeric rank first, as 0 (as main: Number(rank) - Number(rank))', () => {
    const sorted = sortByRank([{ id: 1, rank: null }, { id: 2, rank: 5 }, { id: 3 }, { id: 4, rank: 1 }, { id: 5, rank: '' }, { id: 6, rank: 'x' }])
    expect(sorted.map(item => item.id)).toEqual([1, 3, 5, 6, 4, 2])
  })

  it('keeps the order of the API among equal and null ranks', () => {
    const sorted = sortByRank([{ id: 1, rank: null }, { id: 2, rank: 2 }, { id: 3, rank: null }, { id: 4, rank: 2 }, { id: 5, rank: null }])
    expect(sorted.map(item => item.id)).toEqual([1, 3, 5, 2, 4])
  })

  it('reads a rank that comes as text', () => {
    expect(sortByRank([{ id: 1, rank: '10' }, { id: 2, rank: '2' }]).map(item => item.id)).toEqual([2, 1])
  })

  it('is safe with no list', () => {
    expect(sortByRank(undefined)).toEqual([])
    expect(sortByRank(null)).toEqual([])
  })
})
