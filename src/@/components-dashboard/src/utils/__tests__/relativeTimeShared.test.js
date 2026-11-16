// (P3): one relative-time calculation for the drivers dashboard and the MCP keys. Each caller keeps its own words: the two
// algorithms as they were before the merge are copied here, frozen, and every offset of the grid must read the same through the shared one.
import moment from 'moment'
import { describe, expect, it } from 'vitest'

import { formatRelativeSeconds, formatRelativeTime } from '../relativeTime'
import { formatMcpRelative } from '../../ui/src/components/Settings/McpTokens/utils'

const NOW = Date.UTC(2026, 9, 9, 12, 0, 0)
const LOCALES = ['en', 'es', 'fr', 'it', 'de', 'pt', 'da', 'nl', 'ar', 'el', 'bg', 'tr']

const rtfOf = (locale) => {
  try {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  } catch {
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  }
}

// utils/relativeTime.js › formatRelativeTime before , after parsing (past only)
const driversBefore = (date, now, locale) => {
  const formatter = rtfOf(locale)
  const seconds = Math.max(0, (now - date.getTime()) / 1000)
  const ago = (amount, unit) => formatter.format(-Math.max(1, Math.round(amount)), unit)
  if (seconds < 45) return formatter.format(0, 'second')
  if (seconds < 3600) return ago(seconds / 60, 'minute')
  if (seconds < 86400) return ago(seconds / 3600, 'hour')
  const days = seconds / 86400
  if (days < 30) return ago(days, 'day')
  if (days < 365) return ago(days / 30, 'month')
  return ago(days / 365, 'year')
}

// Settings/McpTokens/utils.js › formatMcpRelative before , after parsing (past and future)
const DAY = 86400
const mcpBefore = (date, now, locale) => {
  const seconds = Math.round((date.valueOf() - now) / 1000)
  const abs = Math.abs(seconds)
  const rtf = rtfOf(locale)
  if (abs < 60) return rtf.format(0, 'minute')
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute')
  if (abs < DAY) return rtf.format(Math.round(seconds / 3600), 'hour')
  if (abs < 60 * DAY) return rtf.format(Math.round(seconds / DAY), 'day')
  if (abs < 365 * DAY) return rtf.format(Math.round(seconds / (30 * DAY)), 'month')
  return rtf.format(Math.round(seconds / (365 * DAY)), 'year')
}

// Offsets in seconds around every threshold and every .5 rounding edge, both ways
const edges = [0, 1, 29, 30, 44, 45, 46, 59, 60, 61, 89, 90, 91, 149, 150, 151, 3599, 3600, 3601, 5399, 5400, 5401,
  86399, 86400, 86401, 129600, 129601, 30 * DAY - 1, 30 * DAY, 45 * DAY, 60 * DAY - 1, 60 * DAY, 75 * DAY, 364 * DAY,
  365 * DAY, 547 * DAY, 548 * DAY, 3 * 365 * DAY]
const toApi = (ms) => moment.utc(ms).format('YYYY-MM-DD HH:mm:ss')

describe('formatRelativeSeconds (P3)', () => {
  it('is the one calculation: «now» below a threshold, then minutes, hours, days, 30-day months and 365-day years', () => {
    expect(formatRelativeSeconds(-30)).toBe('now')
    expect(formatRelativeSeconds(-30, { nowBelow: 60, nowUnit: 'minute' })).toBe('this minute')
    expect(formatRelativeSeconds(-5 * 60)).toBe('5 minutes ago')
    expect(formatRelativeSeconds(7 * DAY, { round: 'signed' })).toBe('in 7 days')
    expect(formatRelativeSeconds(-45 * DAY)).toBe('2 months ago')
    expect(formatRelativeSeconds(-45 * DAY, { daysUpTo: 60 })).toBe('45 days ago')
    expect(formatRelativeSeconds(-DAY, { locale: 'es' })).toBe('ayer')
  })

  it('drivers dashboard: every offset and locale reads as before', () => {
    for (const locale of LOCALES) {
      for (const offset of edges) {
        const at = NOW - offset * 1000
        expect(formatRelativeTime(toApi(at), { now: NOW, locale }), `${locale} -${offset}s`).toBe(driversBefore(new Date(at), NOW, locale))
      }
      // a timestamp slightly ahead of the clock still reads as «now»
      expect(formatRelativeTime(toApi(NOW + 30000), { now: NOW, locale })).toBe(driversBefore(new Date(NOW + 30000), NOW, locale))
    }
  })

  it('MCP keys: every offset, past and future, and locale reads as before', () => {
    for (const locale of LOCALES) {
      for (const offset of edges) {
        for (const sign of [-1, 1]) {
          const at = NOW + sign * offset * 1000
          expect(formatMcpRelative(toApi(at), { now: NOW, locale }), `${locale} ${sign * offset}s`).toBe(mcpBefore(moment.utc(at), NOW, locale))
        }
      }
    }
  })
})
