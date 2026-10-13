import { normalizeCommandText } from './commandPaletteSearch'

/**
 * Business search for the command palette. Pure, no React.
 *
 * Uses the admin listing contract (`GET /business?mode=dashboard`), the same
 * one the Stores list uses, so the API applies project, role and business
 * access. It never uses the public `/search` endpoint, which filters by
 * delivery zone, location and schedule.
 */

export const BUSINESS_SEARCH_LIMIT = 8
export const BUSINESS_SEARCH_PARAMS = ['id', 'name', 'slug', 'enabled', 'logo', 'address']
/** The backoffice list does not project `address` (see DashboardBusinessList). */
export const BACKOFFICE_BUSINESS_SEARCH_PARAMS = ['id', 'name', 'slug', 'enabled', 'logo']
export const BUSINESS_SEARCH_DEBOUNCE_MS = 220
export const BUSINESS_SEARCH_CACHE_TTL_MS = 60 * 1000

/** Eatstreet admins list stores through the backoffice endpoint (see DashboardBusinessList). */
export const BACKOFFICE_BUSINESS_PROJECTS = ['eatstreet', 'eatstreetstaging']

export const shouldUseBackofficeBusinessSearch = ({ project, level } = {}) =>
  BACKOFFICE_BUSINESS_PROJECTS.includes(project) && level === 0

/** Largest id the API accepts: ids are 32-bit integers and a bigger one fails the whole request. */
export const MAX_RECORD_ID = 2147483647

/** The query as a record id, or `null` when it is not one (text, or a number too big to be an id). */
export const parseRecordId = (query) => {
  const term = String(query ?? '').trim()
  if (!/^\d+$/.test(term)) return null
  const id = Number(term)
  return id > 0 && id <= MAX_RECORD_ID ? id : null
}

const ilike = (attribute, term) => ({
  attribute,
  // The SDK does not encode query values: encode here like the Stores list.
  value: { condition: 'ilike', value: encodeURIComponent(`%${term}%`) }
})

/**
 * `where` for a name, slug or exact id search. `null` for an empty query
 * (the first page of the businesses the user can access).
 */
export const buildBusinessSearchWhere = (query) => {
  const term = String(query ?? '').trim()
  if (!term) return null
  const conditions = [ilike('name', term), ilike('slug', term)]
  const id = parseRecordId(term)
  if (id !== null) conditions.push({ attribute: 'id', value: id })
  return { conditions, conector: 'OR' }
}

export const buildBackofficeBusinessSearchUrl = (root, query, limit = BUSINESS_SEARCH_LIMIT) => {
  const where = buildBusinessSearchWhere(query)
  const whereParam = where ? `&where=${JSON.stringify(where)}` : ''
  return `${root}/backoffice/businesses?params=${BACKOFFICE_BUSINESS_SEARCH_PARAMS.join(',')}&page=1&page_size=${limit}${whereParam}`
}

const isEnabled = (value) => value === true || value === 1 || value === '1' || value === 'true'

/**
 * Keeps the minimal projection and orders: exact id, exact name, name prefix,
 * then the API order. Drops rows without an id.
 */
export const rankBusinessResults = (businesses = [], query = '', limit = BUSINESS_SEARCH_LIMIT) => {
  const term = normalizeCommandText(query)
  const rank = (business) => {
    if (!term) return 3
    if (String(business.id) === term) return 0
    const name = normalizeCommandText(business.name)
    if (name === term) return 1
    if (name.startsWith(term)) return 2
    return 3
  }
  return (Array.isArray(businesses) ? businesses : [])
    .filter(business => business && business.id !== undefined && business.id !== null)
    .map((business, index) => ({
      id: business.id,
      name: business.name || '',
      slug: business.slug || '',
      address: business.address || '',
      logo: business.logo || null,
      enabled: isEnabled(business.enabled),
      rank: rank(business),
      index
    }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, limit)
    .map(({ rank, index, ...business }) => business)
}

/**
 * Detail of a business through the Stores list flow (`?id=`), optionally on a
 * detail section (`?section=`).
 */
export const buildBusinessDetailPath = (businessId, { section, ...extra } = {}) => {
  const params = new URLSearchParams()
  params.set('id', String(businessId))
  if (section) params.set('section', section)
  Object.entries(extra).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  })
  return `/stores/list?${params.toString()}`
}
