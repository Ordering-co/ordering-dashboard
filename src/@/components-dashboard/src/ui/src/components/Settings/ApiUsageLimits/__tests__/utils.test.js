import { describe, expect, it } from 'vitest'
import {
  formatUsageDuration,
  getUsageErrorMessage,
  getUsageSecondsLeft,
  humanizeUsageName,
  matchesUsageSearch,
  parseUsageScope,
  sortUsageLimits
} from '../utils'

describe('parseUsageScope', () => {
  it('reads every scope family', () => {
    expect(parseUsageScope('*')).toEqual({ type: 'project' })
    expect(parseUsageScope('http:POST auth')).toEqual({ type: 'http', method: 'POST', path: '/auth' })
    expect(parseUsageScope('http:get /users/:id')).toEqual({ type: 'http', method: 'GET', path: '/users/:id' })
    expect(parseUsageScope('resource:sms')).toEqual({ type: 'resource', name: 'sms' })
    expect(parseUsageScope('custom:bulk_imports')).toEqual({ type: 'custom', name: 'bulk_imports' })
  })

  it('keeps unknown scopes as they come', () => {
    expect(parseUsageScope('queue:orders')).toEqual({ type: 'unknown', name: 'queue:orders' })
    expect(parseUsageScope('whatever')).toEqual({ type: 'unknown', name: 'whatever' })
    expect(parseUsageScope(null)).toEqual({ type: 'unknown', name: '' })
  })
})

describe('sortUsageLimits', () => {
  it('puts exceeded first, then warning, then ok', () => {
    const sorted = sortUsageLimits([
      { scope: 'a', status: 'ok' },
      { scope: 'b', status: 'exceeded' },
      { scope: 'c', status: 'warning' },
      { scope: 'd', status: null }
    ])
    expect(sorted.map(limit => limit.scope)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('keeps the same scope together, shortest window first', () => {
    const sorted = sortUsageLimits([
      { scope: 'resource:email', key: 'project', window: 'day', status: 'ok' },
      { scope: '*', key: 'project', window: 'day', status: 'ok' },
      { scope: 'http:POST auth', key: 'project', window: 'minute', status: 'ok' },
      { scope: '*', key: 'project', window: 'hour', status: 'ok' },
      { scope: '*', key: 'client', window: 'minute', status: 'ok' },
      { scope: '*', key: 'project', window: 'minute', status: 'ok' }
    ])
    expect(sorted.map(limit => `${limit.scope} ${limit.window} ${limit.key}`)).toEqual([
      '* minute project',
      '* minute client',
      '* hour project',
      '* day project',
      'http:POST auth minute project',
      'resource:email day project'
    ])
  })

  it('does not mutate the input', () => {
    const limits = [{ status: 'ok' }, { status: 'exceeded' }]
    sortUsageLimits(limits)
    expect(limits[0].status).toBe('ok')
  })
})

describe('getUsageSecondsLeft', () => {
  const now = Date.parse('2026-09-17T10:03:43Z')

  it('uses reset_at when it parses', () => {
    expect(getUsageSecondsLeft({ reset_at: '2026-09-17T10:04:00Z', reset_in: 99 }, now, now)).toBe(17)
  })

  it('falls back to reset_in minus the time since the response', () => {
    expect(getUsageSecondsLeft({ reset_in: 20 }, now + 5000, now)).toBe(15)
  })

  it('never goes below zero and returns null without data', () => {
    expect(getUsageSecondsLeft({ reset_at: '2026-09-17T10:00:00Z' }, now, now)).toBe(0)
    expect(getUsageSecondsLeft({}, now, now)).toBeNull()
  })
})

describe('formatUsageDuration', () => {
  it('shows the two largest units', () => {
    expect(formatUsageDuration(17)).toBe('17 s')
    expect(formatUsageDuration(185)).toBe('3 min 5 s')
    expect(formatUsageDuration(7300)).toBe('2 h 1 min')
    expect(formatUsageDuration(900000)).toBe('10 d 10 h')
    expect(formatUsageDuration(3600)).toBe('1 h')
    expect(formatUsageDuration(0)).toBe('0 s')
  })

  it('uses the translated units', () => {
    expect(formatUsageDuration(90061, { d: 'j', h: 'h', min: 'mn', s: 's' })).toBe('1 j 1 h')
  })
})

describe('helpers', () => {
  it('humanizes names', () => {
    expect(humanizeUsageName('bulk_imports')).toBe('Bulk imports')
    expect(humanizeUsageName('')).toBe('')
  })

  it('reads API error payloads', () => {
    expect(getUsageErrorMessage('Unauthorized')).toBe('Unauthorized')
    expect(getUsageErrorMessage(['A', 'B'])).toBe('A, B')
    expect(getUsageErrorMessage({ error_codes: ['usage_limits.include_invalid'] })).toBe('usage_limits.include_invalid')
    expect(getUsageErrorMessage(null)).toBeNull()
  })
})

describe('matchesUsageSearch', () => {
  const card = ['Whole project', 'All API requests', 'per hour', 'requests', 'Near the limit', 'Per app', 'Alert only', '*', 'app', 'hour', 'soft', 'warning']
  const endpoint = ['POST /auth', 'Endpoint', 'per minute', 'requests', 'OK', 'Blocks when exceeded', 'http:POST auth', 'project', 'minute', 'hard', 'ok']
  const email = ['Emails', 'Resource', 'per day', 'units', 'OK', 'resource:email', 'day', 'soft']

  it('matches everything with an empty query', () => {
    expect(matchesUsageSearch('', card)).toBe(true)
    expect(matchesUsageSearch('   ', card)).toBe(true)
  })

  it('matches substrings, ignoring case and accents', () => {
    expect(matchesUsageSearch('PROJ', card)).toBe(true)
    expect(matchesUsageSearch('/auth', endpoint)).toBe(true)
    expect(matchesUsageSearch('proyécto', ['proyecto'])).toBe(true)
  })

  it('matches abbreviations as in-order letters of a word', () => {
    expect(matchesUsageSearch('prj', card)).toBe(true)
    expect(matchesUsageSearch('endpt', endpoint)).toBe(true)
  })

  it('tolerates small typos', () => {
    expect(matchesUsageSearch('emial', email)).toBe(true)
    expect(matchesUsageSearch('minuet', endpoint)).toBe(true)
    expect(matchesUsageSearch('exceded', endpoint)).toBe(true)
  })

  it('needs every term to match', () => {
    expect(matchesUsageSearch('post minute', endpoint)).toBe(true)
    expect(matchesUsageSearch('post day', endpoint)).toBe(false)
    expect(matchesUsageSearch('sms', email)).toBe(false)
  })
})
