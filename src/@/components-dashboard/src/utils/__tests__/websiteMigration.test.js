import { describe, expect, it } from 'vitest'

import { daysSinceMigration, findLegacySiteOfType, getMyProductsSite, parseMigrationDate, shouldHideMigrated, shouldRedirectMigrated } from '../websiteMigration'

const NOW = Date.parse('2026-10-30T12:00:00Z')

describe('website migration', () => {
  it('reads the API’s UTC dates and ISO dates', () => {
    expect(parseMigrationDate('2026-10-19 10:00:00').toISOString()).toBe('2026-10-19T10:00:00.000Z')
    expect(parseMigrationDate('2026-10-19T10:00:00Z').toISOString()).toBe('2026-10-19T10:00:00.000Z')
    expect(parseMigrationDate('nope')).toBeNull()
    expect(parseMigrationDate(null)).toBeNull()
    expect(daysSinceMigration('2026-10-29 12:00:00', NOW)).toBe(1)
  })

  it('opens the Builder after 7 days and leaves My products after 15', () => {
    expect(shouldRedirectMigrated('2026-10-24 12:00:01', NOW)).toBe(false)
    expect(shouldRedirectMigrated('2026-10-23 12:00:00', NOW)).toBe(true)
    expect(shouldHideMigrated('2026-10-23 12:00:00', NOW)).toBe(false)
    expect(shouldHideMigrated('2026-10-15 12:00:00', NOW)).toBe(true)
    // Not migrated: nothing changes
    expect(shouldRedirectMigrated(null, NOW)).toBe(false)
    expect(shouldHideMigrated(undefined, NOW)).toBe(false)
  })

  it('finds the site behind a My products website entry by its code', () => {
    const sites = [{ id: 31, code: 'web_marketplace_26' }, { id: 41, code: 'website' }]
    expect(getMyProductsSite(sites, 'web').id).toBe(41)
    expect(getMyProductsSite(sites, 'web_marketplace_26').id).toBe(31)
    expect(getMyProductsSite(sites, 'web_dashboard_x')).toBeNull()
    expect(getMyProductsSite(undefined, 'web')).toBeNull()
  })

  it('takes by type only a legacy site, never a migrated one or a Builder product’s', () => {
    const builder = { id: 45, code: 'heroic-sky-igzdqm', type: 'web_marketplace_26', product_type: 'marketplace_website' }
    const migrated = { id: 32, code: 'old', type: 'web_marketplace_26', migrated_at: '2026-10-19 21:26:35' }
    const legacy = { id: 31, code: 'web_marketplace_26', type: 'web_marketplace_26' }
    expect(findLegacySiteOfType([builder, migrated, legacy], 'web_marketplace_26')).toBe(legacy)
    expect(findLegacySiteOfType([builder, migrated], 'web_marketplace_26')).toBeNull()
    expect(findLegacySiteOfType(undefined, 'web_marketplace_26')).toBeNull()
  })
})
