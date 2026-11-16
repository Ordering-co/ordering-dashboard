import { describe, expect, it } from 'vitest'

import {
  businessRating,
  businessScores,
  defaultCsvRange,
  isLiked,
  productRating,
  ratingOf,
  reviewBreakdown,
  reviewCount,
  reviewsCsvRequest,
  userRating
} from '../reviewsData'

// redesign reviews FB (D4, D9, RV-02, RV-03): the pure data helpers of /intelligence/reviews

const ROOT = 'https://api.test/v400/en/dev'

const decodeUrl = (url) => {
  const [base, search] = url.split('?')
  const params = new URLSearchParams(search)
  return {
    base,
    keys: [...params.keys()],
    business_id: params.get('business_id'),
    user_id: params.get('user_id'),
    where: JSON.parse(params.get('where'))
  }
}

const createdAt = (condition, value) => ({ attribute: 'created_at', value: { condition, value } })

describe('ratingOf', () => {
  it.each([
    [4.94, 4.94],
    [5, 5],
    ['4.5', 4.5],
    [0.1, 0.1],
    [0, null],
    ['0', null],
    ['0.00', null],
    [null, null],
    [undefined, null],
    ['', null],
    ['  ', null],
    [NaN, null],
    [Infinity, null],
    [-1, null],
    ['abc', null],
    [true, null],
    [[], null],
    [{}, null]
  ])('ratingOf(%j) is %j', (value, expected) => {
    expect(ratingOf(value)).toBe(expected)
  })
})

describe('businessRating, userRating and productRating', () => {
  it('read the note of each kind of row', () => {
    expect(businessRating({ reviews: { total: 4.94 } })).toBe(4.94)
    expect(userRating({ qualification: 4.5 })).toBe(4.5)
    expect(productRating({ reviews: { total: '3.2' } })).toBe(3.2)
  })

  it.each([
    [undefined],
    [null],
    [{}],
    [{ reviews: null }],
    [{ reviews: { total: 0 } }],
    [{ qualification: null }]
  ])('give null when there is no note (%j)', (row) => {
    expect(businessRating(row)).toBeNull()
    expect(userRating(row)).toBeNull()
    expect(productRating(row)).toBeNull()
  })

  it('read the field of its own kind only', () => {
    expect(businessRating({ qualification: 5 })).toBeNull()
    expect(userRating({ reviews: { total: 5 } })).toBeNull()
  })
})

describe('reviewCount', () => {
  it.each([
    [{ reviews: { reviews_count: 63, reviews: [{}, {}] } }, 63],
    [{ reviews: { reviews_count: 0, reviews: [{}, {}] } }, 0],
    [{ reviews: { reviews: [{}, {}, {}] } }, 3],
    [{ reviews: { reviews_count: '63', reviews: [{}] } }, 1],
    [{ reviews: { reviews: [] } }, 0],
    [{ reviews: { reviews: null } }, null],
    [{ reviews: {} }, null],
    [{ reviews: null }, null],
    [{}, null],
    [undefined, null]
  ])('reviewCount(%j) is %j', (business, expected) => {
    expect(reviewCount(business)).toBe(expected)
  })
})

describe('businessScores', () => {
  it('maps the notes of the business to the scores of SatisfactionScores', () => {
    expect(businessScores({ total: 4.94, quality: 5, delivery: 4.8, service: '4.9', package: 0, reviews: [] })).toEqual({
      general: 4.94,
      quality: 5,
      delivery: 4.8,
      service: '4.9',
      package: 0
    })
  })

  it('does not throw without reviews', () => {
    expect(businessScores(undefined)).toEqual({
      general: undefined,
      quality: undefined,
      delivery: undefined,
      service: undefined,
      package: undefined
    })
  })
})

describe('reviewBreakdown', () => {
  it('lists the four notes in order', () => {
    expect(reviewBreakdown({ quality: 5, delivery: 4, service: 3, package: 2, total: 3.5 })).toEqual([
      { id: 'quality', value: 5 },
      { id: 'delivery', value: 4 },
      { id: 'service', value: 3 },
      { id: 'package', value: 2 }
    ])
  })

  it('leaves out the notes that are not a number > 0', () => {
    expect(reviewBreakdown({ quality: 5, delivery: 0, service: null, package: '4' })).toEqual([
      { id: 'quality', value: 5 },
      { id: 'package', value: 4 }
    ])
  })

  it.each([[undefined], [null], [{}], [{ quality: 0 }]])('is empty for %j', (review) => {
    expect(reviewBreakdown(review)).toEqual([])
  })
})

describe('isLiked', () => {
  it.each([
    [{ qualification: 5 }, true],
    [{ qualification: 4 }, false],
    [{ qualification: '5' }, false],
    [{ qualification: null }, false],
    [{}, false],
    [undefined, false]
  ])('isLiked(%j) is %j', (review, expected) => {
    expect(isLiked(review)).toBe(expected)
  })
})

describe('defaultCsvRange', () => {
  it('goes from 30 days ago to today, in local time', () => {
    expect(defaultCsvRange(new Date(2026, 9, 9, 15, 30))).toEqual({ from: '2026-09-09', to: '2026-10-09' })
  })

  it('crosses month and year boundaries', () => {
    expect(defaultCsvRange(new Date(2026, 0, 15, 0, 5))).toEqual({ from: '2025-12-16', to: '2026-01-15' })
  })

  it('pads month and day', () => {
    expect(defaultCsvRange(new Date(2026, 2, 5, 23, 59))).toEqual({ from: '2026-02-03', to: '2026-03-05' })
  })

  it('does not change the date it receives', () => {
    const now = new Date(2026, 9, 9, 15, 30)
    defaultCsvRange(now)
    expect(now).toEqual(new Date(2026, 9, 9, 15, 30))
  })

  it('uses the current day by default', () => {
    const { from, to } = defaultCsvRange()
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(to).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(from < to).toBe(true)
  })
})

describe('reviewsCsvRequest', () => {
  const range = { from: '2026-09-09', to: '2026-10-09' }

  it('business tab, one business: business_id first, then where with both dates', () => {
    const { url, filename } = reviewsCsvRequest({ tab: 'business', root: ROOT, businessId: 12, ...range })
    expect(url.startsWith(`${ROOT}/business/business_reviews_delivery.csv?business_id=12&where=`)).toBe(true)
    const decoded = decodeUrl(url)
    expect(decoded.base).toBe(`${ROOT}/business/business_reviews_delivery.csv`)
    expect(decoded.keys).toEqual(['business_id', 'where'])
    expect(decoded.business_id).toBe('12')
    expect(decoded.where).toEqual([
      createdAt('>=', '2026-09-09 00:00:00'),
      createdAt('<=', '2026-10-09 23:59:59')
    ])
    expect(filename).toBe('business_reviews_delivery_2026-09-09_2026-10-09.csv')
  })

  it('business tab, all businesses: no business_id', () => {
    const { url, filename } = reviewsCsvRequest({ tab: 'business', root: ROOT, ...range })
    const decoded = decodeUrl(url)
    expect(decoded.keys).toEqual(['where'])
    expect(decoded.business_id).toBeNull()
    expect(decoded.where).toHaveLength(2)
    expect(filename).toBe('business_reviews_delivery_2026-09-09_2026-10-09.csv')
  })

  it('business tab ignores the driver', () => {
    const { url } = reviewsCsvRequest({ tab: 'business', root: ROOT, driverId: 7, ...range })
    expect(decodeUrl(url).keys).toEqual(['where'])
  })

  it('drivers tab, one driver: user_id, then where with type 1 and both dates', () => {
    const { url, filename } = reviewsCsvRequest({ tab: 'drivers', root: ROOT, driverId: 7, ...range })
    const decoded = decodeUrl(url)
    expect(decoded.base).toBe(`${ROOT}/users/user_reviews.csv`)
    expect(decoded.keys).toEqual(['user_id', 'where'])
    expect(decoded.user_id).toBe('7')
    expect(decoded.where).toEqual([
      { attribute: 'type', value: 1 },
      createdAt('>=', '2026-09-09 00:00:00'),
      createdAt('<=', '2026-10-09 23:59:59')
    ])
    expect(filename).toBe('driver_reviews_2026-09-09_2026-10-09.csv')
  })

  it.each([['all'], [undefined], [null], ['']])('drivers tab with driver %j: no user_id', (driverId) => {
    const { url } = reviewsCsvRequest({ tab: 'drivers', root: ROOT, driverId, ...range })
    const decoded = decodeUrl(url)
    expect(decoded.keys).toEqual(['where'])
    expect(decoded.user_id).toBeNull()
    expect(decoded.where[0]).toEqual({ attribute: 'type', value: 1 })
  })

  it('drivers tab ignores the business', () => {
    const { url } = reviewsCsvRequest({ tab: 'drivers', root: ROOT, businessId: 12, ...range })
    expect(decodeUrl(url).keys).toEqual(['where'])
  })

  it('leaves out the condition of a missing date, as main', () => {
    const onlyFrom = decodeUrl(reviewsCsvRequest({ tab: 'business', root: ROOT, from: '2026-09-09' }).url)
    expect(onlyFrom.where).toEqual([createdAt('>=', '2026-09-09 00:00:00')])
    const onlyTo = decodeUrl(reviewsCsvRequest({ tab: 'drivers', root: ROOT, to: '2026-10-09' }).url)
    expect(onlyTo.where).toEqual([{ attribute: 'type', value: 1 }, createdAt('<=', '2026-10-09 23:59:59')])
    const none = decodeUrl(reviewsCsvRequest({ tab: 'business', root: ROOT }).url)
    expect(none.where).toEqual([])
  })

  it('builds the exact query string of main', () => {
    const { url } = reviewsCsvRequest({ tab: 'drivers', root: ROOT, driverId: 7, ...range })
    const params = new URLSearchParams()
    params.append('user_id', 7)
    params.append('where', JSON.stringify([
      { attribute: 'type', value: 1 },
      { attribute: 'created_at', value: { condition: '>=', value: '2026-09-09 00:00:00' } },
      { attribute: 'created_at', value: { condition: '<=', value: '2026-10-09 23:59:59' } }
    ]))
    expect(url).toBe(`${ROOT}/users/user_reviews.csv?${params.toString()}`)
  })
})
