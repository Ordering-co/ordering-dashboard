// the address of /settings/logs. It is read once and written only here; a page or a log replaces the entry.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseSettingsLogsQuery, writeFilters, writePage, writeRecord } from '../settingsLogsQuery'

const search = () => Object.fromEntries(new URLSearchParams(window.location.search))

beforeEach(() => window.history.replaceState(null, '', '/settings/logs'))
afterEach(() => window.history.replaceState(null, '', '/'))

describe('parseSettingsLogsQuery', () => {
  it('reads page, size, the open log and the filters', () => {
    expect(parseSettingsLogsQuery('?page=2&pageSize=20&id=541&config=851,852&author=7&from=2026-10-01&to=2026-10-02')).toEqual({
      page: 2,
      pageSize: 20,
      id: 541,
      filters: { configIds: [851, 852], authorIds: [7], from: '2026-10-01', to: '2026-10-02' }
    })
  })

  it('an empty or broken address is page 1 of 10, nothing open, no filters', () => {
    const empty = { page: 1, pageSize: 10, id: null, filters: { configIds: [], authorIds: [], from: null, to: null } }
    expect(parseSettingsLogsQuery('')).toEqual(empty)
    expect(parseSettingsLogsQuery('?page=0&pageSize=-1&id=abc&config=x,,0&author=&from=yesterday&to=2026-1-2')).toEqual(empty)
  })

  it('a repeated id counts once', () => {
    expect(parseSettingsLogsQuery('?config=5,5,6').filters.configIds).toEqual([5, 6])
  })
})

describe('the writers', () => {
  it('a page keeps the filters and the open log', () => {
    window.history.replaceState(null, '', '/settings/logs?config=851&id=3')
    writePage(2, 10)
    expect(search()).toEqual({ config: '851', id: '3', page: '2', pageSize: '10' })
  })

  it('new filters drop the old ones and the page, and keep the size', () => {
    window.history.replaceState(null, '', '/settings/logs?page=4&pageSize=10&config=851&author=7')
    writeFilters({ configIds: [], authorIds: [8, 9], from: '2026-10-01', to: null })
    expect(search()).toEqual({ pageSize: '10', author: '8,9', from: '2026-10-01' })
    writeFilters({ configIds: [], authorIds: [], from: null, to: null })
    expect(search()).toEqual({ pageSize: '10' })
  })

  it('a log opens and closes in ?id= without adding history entries', () => {
    const length = window.history.length
    writeRecord(541)
    expect(search()).toEqual({ id: '541' })
    writeRecord(null)
    expect(window.location.search).toBe('')
    expect(window.history.length).toBe(length)
  })
})
