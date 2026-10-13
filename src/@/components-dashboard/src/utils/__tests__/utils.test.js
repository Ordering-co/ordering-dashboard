import { describe, expect, it } from 'vitest'
import {
  applySiteLogoHeaderSync,
  convertToRadian,
  deepEqual,
  flatArray,
  getDistance,
  getUniqueId,
  isOrderStatusRegressionError,
  ORDER_STATUS_REGRESSION_ERROR_CODE,
  normalizeTimezone,
  randomString,
  stringToSlug
} from '../index'

describe('components-dashboard utils', () => {
  it('randomString respects length and alphabet', () => {
    expect(randomString(5, 'ab')).toHaveLength(5)
    expect(randomString(8, 'x')).toBe('xxxxxxxx')
  })

  it('flatArray flattens one level', () => {
    expect(flatArray([[1, 2], [3]])).toEqual([1, 2, 3])
  })

  it('deepEqual compares nested objects', () => {
    expect(deepEqual({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } })).toBe(true)
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false)
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
  })

  it('stringToSlug normalizes text', () => {
    expect(stringToSlug('  Hello World!  ')).toBe('hello_world')
    expect(stringToSlug('Café Niño')).toBe('cafe_nino')
  })

  it('convertToRadian and getDistance compute values', () => {
    expect(convertToRadian(180)).toBeCloseTo(Math.PI)
    const d = getDistance(0, 0, 0, 1)
    expect(d).toBeGreaterThan(100)
    expect(d).toBeLessThan(120)
  })

  it('getUniqueId returns a non-empty string', () => {
    expect(getUniqueId().length).toBeGreaterThan(5)
  })

  it('normalizeTimezone maps deprecated Kiev name', () => {
    expect(normalizeTimezone('Europe/Kiev')).toBe('Europe/Kyiv')
    expect(normalizeTimezone('America/New_York')).toBe('America/New_York')
    expect(normalizeTimezone('')).toBe('')
  })

  it('applySiteLogoHeaderSync mirrors logo into header when needed', () => {
    expect(applySiteLogoHeaderSync({ logo: 'a.png' }, {})).toEqual({
      logo: 'a.png',
      header: 'a.png'
    })
    expect(applySiteLogoHeaderSync({}, { logo: 'a.png', header: 'h.png' })).toEqual({})
    expect(applySiteLogoHeaderSync({}, { logo: 'a.png' })).toEqual({
      header: 'a.png'
    })
  })

  it('isOrderStatusRegressionError assumes regression when the API sends no error codes', () => {
    expect(isOrderStatusRegressionError(undefined)).toBe(true)
    expect(isOrderStatusRegressionError(null)).toBe(true)
  })

  it('isOrderStatusRegressionError trusts the error codes when the API sends them', () => {
    expect(isOrderStatusRegressionError([ORDER_STATUS_REGRESSION_ERROR_CODE])).toBe(true)
    expect(isOrderStatusRegressionError(['guest_access.expired', ORDER_STATUS_REGRESSION_ERROR_CODE])).toBe(true)
    expect(isOrderStatusRegressionError(['guest_access.expired'])).toBe(false)
    expect(isOrderStatusRegressionError([])).toBe(false)
  })
})
