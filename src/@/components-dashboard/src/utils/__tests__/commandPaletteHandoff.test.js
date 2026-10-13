import { describe, expect, it } from 'vitest'
import {
  buildOrdersSearchPath,
  buildRecordHandoffEntries,
  buildUsersSearchPath,
  buildUserTypeHandoffEntries,
  classifyUserSearchQuery,
  sanitizeListingSearch
} from '../commandPaletteHandoff'

describe('listing search paths', () => {
  it('carries the query with ?q=', () => {
    expect(buildOrdersSearchPath('Pizza & co')).toBe('/orders?q=Pizza+%26+co')
    expect(buildUsersSearchPath('  ana  ')).toBe('/users/customers?q=ana')
    expect(buildOrdersSearchPath('')).toBe('/orders')
  })

  it('sanitizes and caps the query', () => {
    expect(sanitizeListingSearch('  a   b ')).toBe('a b')
    expect(sanitizeListingSearch('x'.repeat(200))).toHaveLength(120)
    expect(sanitizeListingSearch(null)).toBe('')
  })
})

describe('classifyUserSearchQuery', () => {
  it('sends phones to the search box', () => {
    expect(classifyUserSearchQuery('+1 (305) 555-0101')).toEqual({ searchValue: '+1 (305) 555-0101' })
  })

  it('sends emails and names to the matching filters', () => {
    expect(classifyUserSearchQuery('ana@example.com')).toEqual({ filters: { email: 'ana@example.com' } })
    expect(classifyUserSearchQuery('Ana')).toEqual({ filters: { name: 'Ana' } })
    expect(classifyUserSearchQuery('Ana María López')).toEqual({ filters: { name: 'Ana', lastname: 'María López' } })
  })

  it('ignores empty queries', () => {
    expect(classifyUserSearchQuery(' ')).toBeNull()
  })
})

describe('buildRecordHandoffEntries', () => {
  it('offers both listings to admins and never as records', () => {
    const entries = buildRecordHandoffEntries({ query: 'ana', user: { level: 0 } })
    expect(entries.map(entry => entry.id)).toEqual(['handoff:orders', 'handoff:users', 'handoff:settings'])
    expect(entries[2].path).toBe('/settings?q=ana')
    expect(entries[0].title).toBe('Search “ana” in Orders')
    expect(entries[1].path).toBe('/users/customers?q=ana')
    expect(entries.every(entry => entry.group === 'records')).toBe(true)
  })

  it('turns the Users hand-off into one entry per user type found', () => {
    const entries = buildRecordHandoffEntries({ query: 'ana', user: { level: 0 }, userLevels: [4, 3, 4, 0] })
    expect(entries.map(entry => [entry.id, entry.path])).toEqual([
      ['handoff:orders', '/orders?q=ana'],
      ['handoff:users:4', '/delivery/drivers-list?q=ana'],
      ['handoff:users:3', '/users/customers?q=ana'],
      ['handoff:users:0', '/users/admins?q=ana'],
      ['handoff:settings', '/settings?q=ana']
    ])
    expect(entries[1].title).toBe('Search “ana” in Drivers')
  })

  it('keeps the generic Users hand-off when no user was found', () => {
    expect(buildUserTypeHandoffEntries({ query: 'ana', userLevels: [] })).toEqual([])
    expect(buildRecordHandoffEntries({ query: 'ana', user: { level: 0 }, userLevels: [] }).map(entry => entry.id)).toContain('handoff:users')
  })

  it('offers only Orders to business owners and nothing for an empty query', () => {
    expect(buildRecordHandoffEntries({ query: 'ana', user: { level: 2 } }).map(entry => entry.id)).toEqual(['handoff:orders'])
    expect(buildRecordHandoffEntries({ query: ' ', user: { level: 0 } })).toEqual([])
  })
})
