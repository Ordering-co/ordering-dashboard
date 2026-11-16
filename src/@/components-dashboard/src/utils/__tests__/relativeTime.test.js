// redesign drivers-dashboard B1 (decision 6: relative time of the last location)
import { describe, expect, it } from 'vitest'

import { formatRelativeTime, minutesSince, parseApiDateTime, toApiDateTime } from '../relativeTime'

const NOW = Date.UTC(2026, 9, 9, 12, 0, 0)
const en = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

describe('parseApiDateTime', () => {
  it('reads the API format as UTC', () => {
    expect(parseApiDateTime('2026-10-06 18:03:51').getTime()).toBe(Date.UTC(2026, 9, 6, 18, 3, 51))
  })

  it('reads ISO with and without zone as UTC', () => {
    expect(parseApiDateTime('2026-10-06T18:03:51Z').getTime()).toBe(Date.UTC(2026, 9, 6, 18, 3, 51))
    expect(parseApiDateTime('2026-10-06T18:03:51').getTime()).toBe(Date.UTC(2026, 9, 6, 18, 3, 51))
  })

  it('respects an explicit offset', () => {
    expect(parseApiDateTime('2026-10-06T18:03:51+02:00').getTime()).toBe(Date.UTC(2026, 9, 6, 16, 3, 51))
  })

  it('accepts a Date and a number', () => {
    const date = new Date(NOW)
    expect(parseApiDateTime(date).getTime()).toBe(NOW)
    expect(parseApiDateTime(NOW).getTime()).toBe(NOW)
  })

  it('returns null for empty or unparseable values', () => {
    expect(parseApiDateTime(null)).toBeNull()
    expect(parseApiDateTime(undefined)).toBeNull()
    expect(parseApiDateTime('')).toBeNull()
    expect(parseApiDateTime('garbage')).toBeNull()
    expect(parseApiDateTime(new Date('nope'))).toBeNull()
  })
})

describe('minutesSince', () => {
  it('counts whole minutes', () => {
    expect(minutesSince('2026-10-09 11:57:00', NOW)).toBe(3)
    expect(minutesSince('2026-10-09T11:57:00Z', NOW)).toBe(3)
    expect(minutesSince('2026-10-09 11:57:59', NOW)).toBe(2)
  })

  it('is never negative', () => {
    expect(minutesSince('2026-10-09 12:30:00', NOW)).toBe(0)
  })

  it('returns null when it does not parse', () => {
    expect(minutesSince(null, NOW)).toBeNull()
    expect(minutesSince('garbage', NOW)).toBeNull()
  })
})

describe('formatRelativeTime', () => {
  it('formats minutes, hours, days, months and years in the past', () => {
    expect(formatRelativeTime('2026-10-09 11:57:00', { now: NOW })).toBe(en.format(-3, 'minute'))
    expect(formatRelativeTime('2026-10-09 11:57:00', { now: NOW })).toBe('3 minutes ago')
    expect(formatRelativeTime('2026-10-09 09:00:00', { now: NOW })).toBe(en.format(-3, 'hour'))
    expect(formatRelativeTime('2026-10-07 12:00:00', { now: NOW })).toBe(en.format(-2, 'day'))
    expect(formatRelativeTime('2025-12-16 23:58:22', { now: NOW })).toBe(en.format(-10, 'month'))
    expect(formatRelativeTime('2024-01-01 00:00:00', { now: NOW })).toBe(en.format(-3, 'year'))
  })

  it('says now under 45 seconds', () => {
    expect(formatRelativeTime('2026-10-09 11:59:40', { now: NOW })).toBe(en.format(0, 'second'))
  })

  it('never goes below 1 in a unit', () => {
    expect(formatRelativeTime('2026-10-09 11:59:00', { now: NOW })).toBe(en.format(-1, 'minute'))
  })

  it('returns null when it does not parse', () => {
    expect(formatRelativeTime(null, { now: NOW })).toBeNull()
    expect(formatRelativeTime('', { now: NOW })).toBeNull()
    expect(formatRelativeTime('garbage', { now: NOW })).toBeNull()
  })

  it('follows the locale', () => {
    expect(formatRelativeTime('2026-10-09 11:57:00', { now: NOW, locale: 'es' })).toContain('hace')
  })

  it('does not throw with an invalid locale', () => {
    expect(() => formatRelativeTime('2026-10-09 11:57:00', { now: NOW, locale: 'xx-invalid-' })).not.toThrow()
    expect(formatRelativeTime('2026-10-09 11:57:00', { now: NOW, locale: 'xx-invalid-' })).toBe('3 minutes ago')
  })
})

// redesign drivers-dashboard B2 (DD-13)
describe('toApiDateTime', () => {
  it('writes a Date in the API shape, in UTC, and parses back to the same instant', () => {
    const date = new Date(Date.UTC(2026, 9, 9, 7, 4, 5))
    expect(toApiDateTime(date)).toBe('2026-10-09 07:04:05')
    expect(parseApiDateTime(toApiDateTime(date)).getTime()).toBe(date.getTime())
  })
})
