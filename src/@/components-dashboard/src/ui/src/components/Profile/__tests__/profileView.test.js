import { describe, expect, it } from 'vitest'

import {
  SESSIONS_PAGE_SIZE,
  countOtherSessions,
  levelLabel,
  pageSessions,
  sortSessionsNewestFirst
} from '../profileView'

// redesign (B2): the pure helpers of /profile.
const session = (id, createdAt, extra = {}) => ({ id, created_at: createdAt, valid_thru: '2027-10-10 02:16:00', current: false, ...extra })

describe('sortSessionsNewestFirst', () => {
  it('orders from the newest to the oldest, as the modal of main did', () => {
    const sorted = sortSessionsNewestFirst([
      session(1, '2026-10-10 02:00:00'),
      session(2, '2026-10-10 02:16:00'),
      session(3, '2026-10-09 23:59:59')
    ])
    expect(sorted.map(item => item.id)).toEqual([2, 1, 3])
  })

  it('never mutates its input (PF-05) and returns a copy', () => {
    const input = [session(1, '2026-10-10 02:00:00'), session(2, '2026-10-10 02:16:00')]
    const snapshot = [...input]
    const sorted = sortSessionsNewestFirst(input)
    expect(input).toEqual(snapshot)
    expect(input.map(item => item.id)).toEqual([1, 2])
    expect(sorted).not.toBe(input)
  })

  it('puts dates that cannot be read at the end, in their own order', () => {
    const sorted = sortSessionsNewestFirst([
      session(1, 'not a date'),
      session(2, '2026-10-10 02:00:00'),
      session(3, null),
      session(4, '2026-10-10 02:16:00'),
      session(5, undefined)
    ])
    expect(sorted.map(item => item.id)).toEqual([4, 2, 1, 3, 5])
  })

  it('keeps the input order between equal dates', () => {
    const sorted = sortSessionsNewestFirst([
      session(1, '2026-10-10 02:00:00'),
      session(2, '2026-10-10 02:00:00'),
      session(3, '2026-10-10 02:00:00')
    ])
    expect(sorted.map(item => item.id)).toEqual([1, 2, 3])
  })

  it.each([undefined, null, []])('gives an empty list for %s', (value) => {
    expect(sortSessionsNewestFirst(value)).toEqual([])
  })
})

describe('pageSessions', () => {
  const sorted = Array.from({ length: 23 }, (_, index) => ({ id: index + 1 }))

  it('uses a page size of 10', () => {
    expect(SESSIONS_PAGE_SIZE).toBe(10)
  })

  it('gives the slice of a page, counting pages from 1', () => {
    expect(pageSessions(sorted, 1, 10).map(item => item.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(pageSessions(sorted, 2, 10).map(item => item.id)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20])
    expect(pageSessions(sorted, 3, 10).map(item => item.id)).toEqual([21, 22, 23])
  })

  it('has no rows for 0 sessions and a single row for 11 sessions on the second page', () => {
    expect(pageSessions([], 1, 10)).toEqual([])
    const eleven = Array.from({ length: 11 }, (_, index) => ({ id: index }))
    expect(pageSessions(eleven, 1, 10)).toHaveLength(10)
    expect(pageSessions(eleven, 2, 10)).toHaveLength(1)
  })

  it('reads a page under 1 as the first page', () => {
    expect(pageSessions(sorted, 0, 10)).toHaveLength(10)
    expect(pageSessions(sorted, -3, 10)[0].id).toBe(1)
  })
})

describe('countOtherSessions', () => {
  it('counts the sessions that are not the current one, never N - 1', () => {
    expect(countOtherSessions([{ current: true }, { current: false }, {}])).toBe(2)
    // the current session may be missing from the list: all of them are others
    expect(countOtherSessions([{ current: false }, { current: false }, { current: false }])).toBe(3)
    expect(countOtherSessions([{ current: true }])).toBe(0)
    expect(countOtherSessions([])).toBe(0)
  })
})

describe('levelLabel', () => {
  const t = (_key, fallback) => fallback

  it.each([
    [0, 'Administrator'],
    [2, 'Business owner'],
    [5, 'Driver manager'],
    [8, 'Professional']
  ])('names level %s', (level, text) => {
    expect(levelLabel(t, level)).toBe(text)
  })

  it('asks for the keys the catalog already has', () => {
    const keys = []
    for (const level of [0, 2, 5, 8]) levelLabel((key, fallback) => { keys.push(key); return fallback }, level)
    expect(keys).toEqual(['ADMINISTRATOR', 'BUSINESS_OWNER', 'DRIVER_MANAGER', 'PROFESSIONAL'])
  })

  it.each([1, 3, 4, 7, 9, undefined, null, '8'])('has no label for %s', (level) => {
    expect(levelLabel(t, level)).toBeNull()
  })
})
