/**
 * A legacy website moved to the new website (api-core `sites/{id}/migration`)
 * leaves My products in steps: its page shows the migrated message, after
 * `MIGRATION_REDIRECT_DAYS` it opens its Builder product straight away, and
 * after `MIGRATION_HIDE_DAYS` its My products entry is gone.
 */

export const MIGRATION_REDIRECT_DAYS = 7
export const MIGRATION_HIDE_DAYS = 15

const DAY_MS = 24 * 60 * 60 * 1000

/** A date the API sends (`2026-10-19 10:00:00`, UTC, or ISO) as a Date, or null. */
export const parseMigrationDate = (value) => {
  if (!value) return null
  const text = String(value).includes('T') ? String(value) : `${String(value).replace(' ', 'T')}Z`
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Whole and partial days since `migratedAt`; null when it isn't a date. */
export const daysSinceMigration = (migratedAt, now = Date.now()) => {
  const date = parseMigrationDate(migratedAt)
  return date ? (now - date.getTime()) / DAY_MS : null
}

/** Whether the migrated site's page should open its Builder product instead. */
export const shouldRedirectMigrated = (migratedAt, now = Date.now()) => {
  const days = daysSinceMigration(migratedAt, now)
  return days !== null && days >= MIGRATION_REDIRECT_DAYS
}

/** Whether the migrated site's My products entry is gone. */
export const shouldHideMigrated = (migratedAt, now = Date.now()) => {
  const days = daysSinceMigration(migratedAt, now)
  return days !== null && days >= MIGRATION_HIDE_DAYS
}

/** The site (`/sites`) behind a My products website entry, by its code. */
const MY_PRODUCTS_SITE_CODES = { web: 'website', web_marketplace_26: 'web_marketplace_26' }

export const getMyProductsSite = (sites = [], itemId) => {
  const code = MY_PRODUCTS_SITE_CODES[itemId]
  return code ? (sites || []).find(site => site?.code === code) || null : null
}

/**
 * The legacy site a My products website takes as its own by `type`: never a
 * migrated one, nor a Builder product's (`product_type`), whose code would
 * be changed to the page's.
 */
export const findLegacySiteOfType = (sites = [], type) =>
  (sites || []).find(site => site?.type === type && !site.migrated_at && !site.product_type) || null
