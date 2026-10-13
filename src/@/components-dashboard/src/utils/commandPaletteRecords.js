import { normalizeCommandText } from './commandPaletteSearch'
import { parseRecordId } from './commandPaletteBusinesses'

/**
 * Order and user search for the command palette. Pure.
 *
 * Uses the admin list endpoints the Orders and Users pages use (`/orders`
 * with `mode=dashboard`, `/users`), so the API applies project, role and
 * store access. Results open the record's existing detail panel (`?id=`).
 *
 * The SDK does not encode query values, so `ilike` values are encoded here
 * like the Stores search (see commandPaletteBusinesses.js).
 *
 * Two modes, chosen per project and entity (commandPaletteSearchMode.js):
 *
 * - `extended` (default): orders by number, customer name, last name, email
 *   or phone, or store name; users by id, name, email or phone; newest first.
 * - `safe`: for projects where an extended search was too slow. api-core runs
 *   a COUNT(*) with the same filters on every list request, and the order
 *   customer/store snapshots (`order_customer`, `order_business`) have no
 *   text index, so millions of orders mean full scans. Orders are looked up
 *   by exact number only (primary key); users keep every field and send no
 *   `orderBy`, which could make Postgres walk the primary key backwards.
 *   Order text goes to the Orders listing through the hand-off.
 *
 * In both modes users need three characters (the `users` trigram indexes
 * need three) and the hooks send one request at a time per section.
 */

export const RECORD_SEARCH_LIMIT = 5
/** Minimum text length and debounce per entity and mode (numbers always search). */
export const RECORD_SEARCH_MODES = {
  orders: { extended: { minQuery: 2, debounceMs: 260 }, safe: { minQuery: 2, debounceMs: 400 } },
  users: { extended: { minQuery: 3, debounceMs: 400 }, safe: { minQuery: 3, debounceMs: 400 } }
}
/** An extended search slower than this switches the project to safe mode. */
export const RECORD_SEARCH_SLOW_MS = 5000

export const getRecordSearchMode = (entity, extended = true) =>
  RECORD_SEARCH_MODES[entity][extended === false ? 'safe' : 'extended']

export const ORDER_SEARCH_PARAMS = ['id', 'status', 'created_at', 'customer', 'business']
export const USER_SEARCH_PARAMS = ['id', 'name', 'lastname', 'email', 'cellphone', 'country_phone_code', 'level', 'photo', 'enabled']

/** Where each user level opens, and how it is named. Admin-only listings. */
export const USER_LEVEL_DESTINATIONS = {
  0: { route: '/users/admins', labelKey: 'ADMINISTRATOR', label: 'Administrator', listKey: 'ADMINS', list: 'Admins' },
  2: { route: '/users/business-owners', labelKey: 'BUSINESS_OWNER', label: 'Business owner', listKey: 'BUSINESS_OWNERS', list: 'Business owners' },
  3: { route: '/users/customers', labelKey: 'CUSTOMER', label: 'Customer', listKey: 'CUSTOMERS', list: 'Customers' },
  4: { route: '/delivery/drivers-list', labelKey: 'DRIVER', label: 'Driver', listKey: 'DRIVERS', list: 'Drivers' },
  5: { route: '/delivery/drivers-managers', labelKey: 'DRIVER_MANAGER', label: 'Driver manager', listKey: 'DRIVERS_MANAGERS', list: 'Drivers managers' },
  8: { route: '/users/professionals', labelKey: 'PROFESSIONAL', label: 'Professional', listKey: 'PROFESSIONALS', list: 'Professionals' },
  9: { route: '/users/callcenter-agents', labelKey: 'CALL_CENTER_AGENT', label: 'Call center agent', listKey: 'CALL_CENTER_AGENTS', list: 'Call Center Agents' }
}

export const buildOrderDetailPath = (orderId) => `/orders?id=${encodeURIComponent(orderId)}`
export const buildUserDetailPath = (level, userId) => {
  const destination = USER_LEVEL_DESTINATIONS[level]
  return destination ? `${destination.route}?id=${encodeURIComponent(userId)}` : null
}

const PHONE_PATTERN = /^\+?[\d\s().-]+$/
const EMAIL_PATTERN = /@/
/** Shortest digit run worth matching against a phone number. */
const MIN_PHONE_DIGITS = 4
/** From this length a plain number reads as a phone first (ids are shorter). */
const PHONE_FIRST_DIGITS = 7

const ilike = (attribute, term) => ({
  attribute,
  value: { condition: 'ilike', value: encodeURIComponent(`%${term}%`) }
})

/**
 * How a query reads: an id, a phone, an email or text. A plain number is
 * both an id and part of a phone ("5512" may be either), so it keeps both:
 * short ones read as an id first, long ones as a phone first. `id` is null
 * when the number is too big to be an id.
 */
export const classifyRecordQuery = (query) => {
  const term = String(query ?? '').replace(/\s+/g, ' ').trim()
  if (!term) return null
  const digits = term.replace(/\D/g, '')
  if (/^\d+$/.test(term)) {
    return { kind: term.length >= PHONE_FIRST_DIGITS ? 'phone' : 'number', term, digits, id: parseRecordId(term) }
  }
  if (EMAIL_PATTERN.test(term)) return { kind: 'email', term }
  if (PHONE_PATTERN.test(term) && digits.length >= MIN_PHONE_DIGITS) return { kind: 'phone', term, digits }
  const [first, ...rest] = term.split(' ')
  return { kind: 'text', term, first, rest: rest.join(' ') }
}

/**
 * Phone numbers are stored without the country code and formatting: match
 * the national part (last 10 digits) of what was typed.
 */
const phoneDigits = (digits) => digits.slice(-10)

/** Person fields shared by users and order customers. */
const personConditions = (parsed) => {
  if (parsed.kind === 'number') {
    return parsed.digits.length >= MIN_PHONE_DIGITS ? [ilike('cellphone', phoneDigits(parsed.digits))] : []
  }
  if (parsed.kind === 'phone') return [ilike('cellphone', phoneDigits(parsed.digits))]
  if (parsed.kind === 'email') return [ilike('email', parsed.term)]
  const conditions = [ilike('name', parsed.term), ilike('lastname', parsed.term), ilike('email', parsed.term)]
  if (parsed.rest) {
    // "Ana López": first name and last name together
    conditions.push({ conditions: [ilike('name', parsed.first), ilike('lastname', parsed.rest)], conector: 'AND' })
  }
  return conditions
}

const nested = (relation, conditions) => ({ attribute: relation, conditions })

/**
 * Orders. Extended: exact number, the customer's name, last name, email or
 * phone, or the store name. Safe: the exact number only (primary key).
 */
export const buildOrderSearchWhere = (query, { extended = true } = {}) => {
  const parsed = classifyRecordQuery(query)
  if (!parsed) return null
  if (!extended) {
    return parsed.id ? { conditions: [{ attribute: 'id', value: parsed.id }], conector: 'AND' } : null
  }
  if (parsed.kind !== 'number' && parsed.term.length < getRecordSearchMode('orders', extended).minQuery) return null
  const conditions = []
  if (parsed.id) conditions.push({ attribute: 'id', value: parsed.id })
  personConditions(parsed).forEach(condition => {
    // Nested relation conditions are joined with AND: one relation per OR branch
    if (condition.conector === 'AND') conditions.push(nested('customer', condition.conditions))
    else conditions.push(nested('customer', [condition]))
  })
  if (parsed.kind === 'text') conditions.push(nested('business', [ilike('name', parsed.term)]))
  return conditions.length ? { conditions, conector: 'OR' } : null
}

/** Whether the palette searches orders for this query in this mode. */
export const canSearchOrderQuery = (query, { extended = true } = {}) => buildOrderSearchWhere(query, { extended }) !== null

/**
 * Users: exact id for a number, name, last name, email or phone. `levels`
 * limits the search to the user types the person can open. Text needs three
 * characters in both modes.
 */
export const buildUserSearchWhere = (query, levels = [], { extended = true } = {}) => {
  const parsed = classifyRecordQuery(query)
  if (!parsed || !levels.length) return null
  if (parsed.kind !== 'number' && parsed.term.length < getRecordSearchMode('users', extended).minQuery) return null
  const anyOf = [...personConditions(parsed)]
  if (parsed.id) anyOf.unshift({ attribute: 'id', value: parsed.id })
  if (!anyOf.length) return null
  return {
    conditions: [
      { attribute: 'level', value: levels },
      { conditions: anyOf, conector: 'OR' }
    ],
    conector: 'AND'
  }
}

const withQuery = (base, { params, limit, where, extra = '' }) =>
  `${base}?page=1&page_size=${limit}&params=${params.join(',')}${extra}${where ? `&where=${JSON.stringify(where)}` : ''}`

export const buildOrderSearchUrl = (root, query, { extended = true, limit = RECORD_SEARCH_LIMIT } = {}) =>
  withQuery(`${root}/orders`, {
    params: ORDER_SEARCH_PARAMS,
    limit,
    where: buildOrderSearchWhere(query, { extended }),
    extra: extended ? '&mode=dashboard&orderBy=-id' : '&mode=dashboard'
  })

export const buildUserSearchUrl = (root, query, levels, { extended = true, limit = RECORD_SEARCH_LIMIT } = {}) =>
  withQuery(`${root}/users`, {
    params: USER_SEARCH_PARAMS,
    limit,
    where: buildUserSearchWhere(query, levels, { extended }),
    extra: extended ? '&orderBy=-id' : ''
  })

/** Order detail is not opened from the URL for drivers managers (OrdersManager). */
export const canSearchOrders = ({ level, canOpenOrders }) => !!canOpenOrders && (level === 0 || level === 2)

/** User types whose listing this person can open. Users listings are admin pages. */
export const getSearchableUserLevels = ({ level, can = () => false }) => {
  if (level !== 0) return []
  return Object.entries(USER_LEVEL_DESTINATIONS)
    .filter(([, destination]) => can(destination.route))
    .map(([userLevel]) => Number(userLevel))
}

const fullName = (person) => [person?.name, person?.lastname].filter(Boolean).join(' ').trim()

const formatPhone = (person) => {
  if (!person?.cellphone) return ''
  return person.country_phone_code ? `+${person.country_phone_code} ${person.cellphone}` : String(person.cellphone)
}

const isEnabled = (value) => value === undefined || value === null || value === true || value === 1 || value === '1' || value === 'true'

/**
 * Orders as palette items, exact id first, then the API order (newest).
 * `statusLabel(status)` names the status; the UI layer owns that list.
 */
export const toOrderItems = (orders = [], query = '', { t = (_key, fallback) => fallback, statusLabel = () => '', limit = RECORD_SEARCH_LIMIT } = {}) => {
  const term = String(query ?? '').trim()
  return (Array.isArray(orders) ? orders : [])
    .filter(order => order && order.id !== undefined && order.id !== null)
    .map((order, index) => ({ order, index, rank: String(order.id) === term ? 0 : 1 }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, limit)
    .map(({ order }) => ({
      id: `order:${order.id}`,
      group: 'orders',
      title: t('COMMAND_PALETTE_ORDER_TITLE', 'Order #_id_').replace('_id_', order.id),
      subtitle: [fullName(order.customer), order.business?.name, statusLabel(order.status)].filter(Boolean).join(' · '),
      path: buildOrderDetailPath(order.id),
      icon: 'orders',
      remount: true
    }))
}

/**
 * Users as palette items, exact id first, then exact or prefix name match.
 * Users whose type has no listing for this person are dropped.
 */
export const toUserItems = (users = [], query = '', { t = (_key, fallback) => fallback, levels = [], limit = RECORD_SEARCH_LIMIT } = {}) => {
  const term = normalizeCommandText(query)
  const rank = (user) => {
    if (String(user.id) === term) return 0
    const name = normalizeCommandText(fullName(user))
    if (name === term) return 1
    if (name.startsWith(term)) return 2
    return 3
  }
  return (Array.isArray(users) ? users : [])
    .filter(user => user && user.id !== undefined && user.id !== null && USER_LEVEL_DESTINATIONS[user.level] && levels.includes(user.level))
    .map((user, index) => ({ user, index, rank: rank(user) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, limit)
    .map(({ user }) => {
      const destination = USER_LEVEL_DESTINATIONS[user.level]
      return {
        id: `user:${user.id}`,
        group: 'users',
        title: fullName(user) || user.email || `#${user.id}`,
        subtitle: [t(destination.labelKey, destination.label), user.email, formatPhone(user)].filter(Boolean).join(' · '),
        path: buildUserDetailPath(user.level, user.id),
        icon: 'users',
        logo: user.photo || null,
        badge: isEnabled(user.enabled) ? null : t('INACTIVE', 'Inactive'),
        remount: true
      }
    })
}
