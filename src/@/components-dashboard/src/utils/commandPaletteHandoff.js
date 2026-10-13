import { canOpenDashboardRoute, getDashboardNavSections, getDashboardRoleFlags } from './dashboardNavigation'
import { buildSettingsPath } from './settingsRedirects'
import { USER_LEVEL_DESTINATIONS } from './commandPaletteRecords'

/**
 * Orders and users hand-offs for the command palette. Pure.
 *
 * "Search <query> in Orders / Users" carries the query to that listing with
 * `?q=`; the listing applies it to its own search box or filters. The palette
 * also shows the first matching orders and users (commandPaletteRecords.js);
 * these hand-offs stay the way to see every result.
 */

export const LISTING_SEARCH_PARAM = 'q'
export const LISTING_SEARCH_MAX_LENGTH = 120

export const sanitizeListingSearch = (value) =>
  String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, LISTING_SEARCH_MAX_LENGTH)

const withSearch = (path, query) => {
  const value = sanitizeListingSearch(query)
  if (!value) return path
  const params = new URLSearchParams()
  params.set(LISTING_SEARCH_PARAM, value)
  return `${path}?${params.toString()}`
}

export const buildOrdersSearchPath = (query) => withSearch('/orders', query)
export const buildUsersSearchPath = (query) => withSearch('/users/customers', query)

const PHONE_PATTERN = /^\+?[\d\s().-]+$/
const EMAIL_PATTERN = /@/

/**
 * Where a customers listing should put a carried query. The customers search
 * box only matches the phone, so other shapes go to the matching filter:
 * - phone-like → `{ searchValue }`
 * - email → `{ filters: { email } }`
 * - text → `{ filters: { name, lastname? } }` (first word, then the rest)
 */
export const classifyUserSearchQuery = (query) => {
  const value = sanitizeListingSearch(query)
  if (!value) return null
  const digits = value.replace(/\D/g, '')
  if (PHONE_PATTERN.test(value) && digits.length >= 3) return { searchValue: value }
  if (EMAIL_PATTERN.test(value)) return { filters: { email: value } }
  const [name, ...rest] = value.split(' ')
  return { filters: rest.length ? { name, lastname: rest.join(' ') } : { name } }
}

const isNavItemOpen = (sections, sectionKey, url, level) => {
  const section = sections[sectionKey]
  const item = section?.items?.find(menu => menu.url === url)
  return !!section?.visible && !!item?.enabled && canOpenDashboardRoute(url, level)
}

export const RECORD_HANDOFFS = [
  {
    key: 'orders',
    sectionKey: 'orders',
    route: '/orders',
    labelKey: 'COMMAND_PALETTE_SEARCH_IN_ORDERS',
    label: 'Search “_query_” in Orders',
    buildPath: buildOrdersSearchPath
  },
  {
    key: 'users',
    sectionKey: 'users',
    route: '/users/customers',
    labelKey: 'COMMAND_PALETTE_SEARCH_IN_USERS',
    label: 'Search “_query_” in Users',
    buildPath: buildUsersSearchPath
  }
]

/**
 * "Search <query> in <list>" for the user types the palette found, newest
 * type first. `userLevels` are the levels of the matching users, already
 * limited to the listings this person can open. Empty → no entries (the
 * generic Users hand-off stays).
 */
export const buildUserTypeHandoffEntries = ({ t = (_key, fallback) => fallback, query, userLevels = [] } = {}) => {
  const value = sanitizeListingSearch(query)
  if (!value) return []
  return [...new Set(userLevels)]
    .filter(level => USER_LEVEL_DESTINATIONS[level])
    .map(level => {
      const destination = USER_LEVEL_DESTINATIONS[level]
      return {
        id: `handoff:users:${level}`,
        group: 'records',
        title: t('COMMAND_PALETTE_SEARCH_IN_LIST', 'Search “_query_” in _list_')
          .replace('_query_', value)
          .replace('_list_', t(destination.listKey, destination.list)),
        path: withSearch(destination.route, value),
        icon: 'users',
        handoff: 'users'
      }
    })
}

/**
 * Hand-off entries for a non empty query, only for listings the user can open.
 * With `userLevels` (types of the users found), the Users hand-off becomes one
 * entry per type, each landing on its own listing.
 */
export const buildRecordHandoffEntries = ({ t = (_key, fallback) => fallback, query, user, configs = {}, userLevels = [] } = {}) => {
  const value = sanitizeListingSearch(query)
  if (!value) return []
  const { level } = getDashboardRoleFlags(user)
  const sections = getDashboardNavSections({ t, user, configs })
  const typeHandoffs = buildUserTypeHandoffEntries({ t, query: value, userLevels })
  return RECORD_HANDOFFS
    .filter(handoff => isNavItemOpen(sections, handoff.sectionKey, handoff.route, level))
    .flatMap(handoff => handoff.key === 'users' && typeHandoffs.length ? typeHandoffs : [handoff])
    .map(handoff => handoff.group
      ? handoff
      : ({
          id: `handoff:${handoff.key}`,
          group: 'records',
          title: t(handoff.labelKey, handoff.label).replace('_query_', value),
          path: handoff.buildPath(value),
          icon: handoff.key,
          handoff: handoff.key
        }))
    .concat(canSearchSettings(user)
      ? [{
          id: 'handoff:settings',
          group: 'records',
          title: t('COMMAND_PALETTE_SEARCH_IN_SETTINGS', 'Search “_query_” in Settings').replace('_query_', value),
          path: buildSettingsPath({ q: value }),
          icon: 'settings',
          handoff: 'settings'
        }]
      : [])
}

/** The Settings hub search (`/settings?q=`): editing admins only */
const canSearchSettings = (user) => {
  const { level, isReadOnly } = getDashboardRoleFlags(user)
  return level === 0 && !isReadOnly && canOpenDashboardRoute('/settings', level)
}
