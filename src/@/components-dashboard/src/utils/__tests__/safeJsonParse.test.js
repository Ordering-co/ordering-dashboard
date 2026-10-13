import { describe, expect, it } from 'vitest'

import {
  getStoredLanguageCode,
  parseJsonArray,
  parseJsonObject,
  parseLogData,
  safeJsonParse
} from '../safeJsonParse'

describe('safeJsonParse', () => {
  it('returns fallback for empty or missing strings', () => {
    expect(safeJsonParse('', {})).toEqual({})
    expect(safeJsonParse(null, [])).toEqual([])
    expect(safeJsonParse(undefined, [])).toEqual([])
  })

  it('returns fallback for invalid JSON', () => {
    expect(safeJsonParse('{bad', [])).toEqual([])
    expect(safeJsonParse('[object Object]', { code: 'en' })).toEqual({ code: 'en' })
  })

  it('parses valid JSON', () => {
    expect(safeJsonParse('{"min_guests_reservation":1}', {})).toEqual({
      min_guests_reservation: 1
    })
    expect(safeJsonParse('[1,2]', [])).toEqual([1, 2])
  })

  it('passes through non-string values', () => {
    expect(safeJsonParse({ info_setup: '/setup' }, {})).toEqual({ info_setup: '/setup' })
    expect(safeJsonParse([5, 10], [])).toEqual([5, 10])
  })
})

describe('parseJsonArray', () => {
  it('returns an empty array when JSON is missing or not an array', () => {
    expect(parseJsonArray('')).toEqual([])
    expect(parseJsonArray('{bad')).toEqual([])
    expect(parseJsonArray('{"a":1}')).toEqual([])
  })

  it('returns the parsed array', () => {
    expect(parseJsonArray('[1,4]')).toEqual([1, 4])
  })
})

describe('getStoredLanguageCode', () => {
  it('returns en when storage is corrupt', () => {
    expect(getStoredLanguageCode('[object Object]')).toBe('en')
    expect(getStoredLanguageCode('')).toBe('en')
    expect(getStoredLanguageCode(null)).toBe('en')
  })

  it('reads code from a language object', () => {
    expect(getStoredLanguageCode('{"code":"es"}')).toBe('es')
  })
})

describe('parseJsonObject', () => {
  it('returns an empty object when JSON is missing or not an object', () => {
    expect(parseJsonObject('')).toEqual({})
    expect(parseJsonObject('[1]')).toEqual({})
    expect(parseJsonObject('true')).toEqual({})
  })

  it('returns the parsed object', () => {
    expect(parseJsonObject('{"min_guests_reservation":1}')).toEqual({
      min_guests_reservation: 1
    })
  })
})

describe('parseLogData', () => {
  it('returns object values for objects', () => {
    expect(parseLogData({ a: 1, b: 2 })).toEqual([1, 2])
  })

  it('parses a JSON string and does not throw on junk', () => {
    expect(parseLogData('{"a":1}')).toEqual({ a: 1 })
    expect(parseLogData('{bad')).toEqual([])
  })
})
