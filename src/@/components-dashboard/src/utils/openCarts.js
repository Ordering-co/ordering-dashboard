/**
 * Pure helpers of the open carts queue (`/cart-recovery/open-carts`).
 *
 * The API gives `updated_at` in UTC as 'YYYY-MM-DD HH:mm:ss' and ignores the conditions
 * it does not know (city, delivery date, relations), so every query is built here with
 * attributes measured to filter (redesign/pages/open-carts/analysis.md section 3).
 * Nothing here reads the browser clock: callers pass `now`.
 */

// redesign OC-A (data contract)
export const CART_VIEWS = ['followUp', 'paymentFailed', 'live', 'all']
export const CART_STATUS = { OPEN: 0, PAYMENT_FAILED: 4 }
export const FOLLOW_UP_DAYS = 7
export const LIVE_MINUTES = 30
export const LIVE_POLL_MS = 60000
export const FOLLOW_UP_CAP = 100
export const DAY_FIGURES_CAP = 50
// The live view is not paginated: it shows the newest carts up to this cap
export const LIVE_CAP = 50
// redesign OC-integration: measured on orderingv1 (2026-10-09): /carts/dashboard answers pages of 10 when page_size > 50
export const API_PAGE_MAX = 50
export const DETAIL_CONCURRENCY = 10
export const MAILTO_MAX = 1800

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

const pad = (value, size = 2) => String(value).padStart(size, '0')

const isValidDate = (value) => value instanceof Date && !Number.isNaN(value.getTime())

/**
 * 'YYYY-MM-DD HH:mm:ss' (UTC, as the API writes it) -> Date. Also reads the 'T' separator.
 * Anything else answers null, never an invalid Date.
 */
export const parseApiUtc = (text) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(String(text ?? '').trim())
  if (!match) return null
  const [, year, month, day, hour, minute, second] = match.map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  return isValidDate(date) ? date : null
}

/** Date -> 'YYYY-MM-DD HH:mm:ss' in UTC. */
export const toApiUtc = (date) => {
  const value = date instanceof Date ? date : new Date(date)
  return `${pad(value.getUTCFullYear(), 4)}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())} ` +
    `${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:${pad(value.getUTCSeconds())}`
}

/** Local midnight (the administrator's browser time zone) of the day `now` falls in. */
export const startOfLocalDay = (now) => {
  const value = now instanceof Date ? now : new Date(now)
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

/** The digits of a search ('#18 3' -> '183'); '' when there are none. */
export const searchDigits = (text) => String(text ?? '').replace(/\D/g, '')

const updatedAtCondition = (condition, date) => ({
  attribute: 'updated_at',
  value: { condition, value: toApiUtc(date) }
})

/**
 * The conditions of `where` for a view plus the active search and filters, or null when
 * there are none. Cities are not here: the API ignores `city_id`, so the controller turns
 * them into `businessIds` first (M-3).
 */
export const buildCartsWhere = ({ view, search, businessIds, customerIds, lastActivity, now } = {}) => {
  const conditions = []
  const at = now instanceof Date ? now : new Date(now ?? Date.now())

  if (view === 'followUp') {
    conditions.push(updatedAtCondition('>=', new Date(at.getTime() - FOLLOW_UP_DAYS * DAY_MS)))
  } else if (view === 'paymentFailed') {
    // An array is the form measured to filter on `status` (analysis.md section 3)
    conditions.push({ attribute: 'status', value: [CART_STATUS.PAYMENT_FAILED] })
  } else if (view === 'live') {
    conditions.push(updatedAtCondition('>=', new Date(at.getTime() - LIVE_MINUTES * MINUTE_MS)))
  }

  const digits = searchDigits(search)
  if (digits) {
    conditions.push({ attribute: 'id', value: { condition: 'ilike', value: `%${digits}%` } })
  }
  if (Array.isArray(businessIds) && businessIds.length) {
    conditions.push({ attribute: 'business_id', value: businessIds })
  }
  if (Array.isArray(customerIds) && customerIds.length) {
    conditions.push({ attribute: 'user_id', value: customerIds })
  }
  if (isValidDate(lastActivity?.from)) conditions.push(updatedAtCondition('>=', lastActivity.from))
  if (isValidDate(lastActivity?.to)) conditions.push(updatedAtCondition('<=', lastActivity.to))

  return conditions.length ? conditions : null
}

/** '/carts/dashboard?orderBy=…&page=…&page_size=…&params=…&where=<encoded JSON>' (parts that are absent are left out). */
export const buildCartsPath = ({ page = 1, pageSize = 10, orderBy, params, where } = {}) => {
  const query = []
  if (orderBy) query.push(`orderBy=${orderBy}`)
  query.push(`page=${page}`, `page_size=${pageSize}`)
  if (params) query.push(`params=${params}`)
  if (where) query.push(`where=${encodeURIComponent(JSON.stringify(where))}`)
  return `/carts/dashboard?${query.join('&')}`
}

const clean = (value) => (typeof value === 'string' ? value.trim() : '')

/**
 * Who the cart belongs to. `cart.user` comes with the list; the address is the user's
 * (merged by the controller from `cart.address.address`) or the cart's own.
 */
export const contactOf = (cart) => {
  const user = cart?.user || {}
  const name = [user.name, user.middle_name, user.lastname, user.second_lastname]
    .map(clean)
    .filter(Boolean)
    .join(' ') || null
  const email = clean(user.email) || null
  const phone = clean(user.cellphone) || clean(user.phone) || null
  const address = clean(user.address) || clean(cart?.address?.address) || null
  return {
    name,
    email,
    phone,
    address,
    hasContact: Boolean(email || phone),
    isGuest: !name && !email && !phone
  }
}

/**
 * The first `max` products of a cart detail as `{ quantity, name }` and how many are left.
 * The products of the list carry no names: they answer null.
 */
export const summarizeItems = (products, max = 2) => {
  if (!Array.isArray(products)) return null
  if (products.length === 0) return { items: [], more: 0 }
  const named = products.filter(product => product && clean(product.name))
  if (named.length === 0) return null
  const items = named.slice(0, Math.max(0, max)).map(product => ({
    quantity: product.quantity ?? 1,
    name: clean(product.name)
  }))
  return { items, more: named.length - items.length }
}

// A `details` entry is `{ loading, error, cart }`; the helpers also take the detail cart itself
const unwrapDetail = (entry) => {
  if (!entry || typeof entry !== 'object') return null
  if ('cart' in entry) return entry.cart || null
  return entry
}

/** The value of a cart: its detail total (never negative), or null while there is no detail. */
export const cartTotal = (detail) => {
  const cart = unwrapDetail(detail)
  if (!cart) return null
  const total = Number(cart.total)
  return Number.isFinite(total) && total >= 0 ? total : 0
}

const timeOf = (cart) => parseApiUtc(cart?.updated_at)?.getTime() ?? 0

/**
 * Follow-up queue: two bands by age (last 24 hours, earlier) and, inside each, the failed
 * payments first, then the highest total (carts without a detail last), then the most recent.
 * A band with no carts is left out.
 */
export const rankFollowUp = (carts, detailsById, now) => {
  const limit = (now instanceof Date ? now : new Date(now ?? Date.now())).getTime() - DAY_MS
  const failed = (cart) => (cart?.status === CART_STATUS.PAYMENT_FAILED ? 1 : 0)
  const totals = new Map()
  const totalOf = (cart) => {
    if (!totals.has(cart)) totals.set(cart, cartTotal(detailsById?.[cart.id]))
    return totals.get(cart)
  }

  const compare = (a, b) => {
    if (failed(a) !== failed(b)) return failed(b) - failed(a)
    const totalA = totalOf(a)
    const totalB = totalOf(b)
    if (totalA !== totalB) {
      if (totalA === null) return 1
      if (totalB === null) return -1
      return totalB - totalA
    }
    return timeOf(b) - timeOf(a)
  }

  const recent = []
  const earlier = []
  ;(Array.isArray(carts) ? carts : []).forEach(cart => {
    (timeOf(cart) >= limit ? recent : earlier).push(cart)
  })

  return [
    { key: 'last24h', carts: recent.sort(compare) },
    { key: 'earlier', carts: earlier.sort(compare) }
  ].filter(group => group.carts.length > 0)
}

/** The views a cart belongs to right now (they do not exclude each other). */
export const viewsOfCart = (cart, now) => {
  const at = (now instanceof Date ? now : new Date(now ?? Date.now())).getTime()
  const age = at - timeOf(cart)
  const views = ['all']
  if (age <= FOLLOW_UP_DAYS * DAY_MS) views.push('followUp')
  if (cart?.status === CART_STATUS.PAYMENT_FAILED) views.push('paymentFailed')
  if (age <= LIVE_MINUTES * MINUTE_MS) views.push('live')
  return views
}

/**
 * `mailto:<email>?subject=…&body=…`. The address keeps its `@`; subject and body are
 * percent-encoded with `encodeURIComponent`.
 */
export const buildMailtoHref = ({ email, subject, body } = {}) => {
  const query = []
  if (subject) query.push(`subject=${encodeURIComponent(subject)}`)
  if (body) query.push(`body=${encodeURIComponent(body)}`)
  const address = encodeURIComponent(email || '').replace(/%40/g, '@')
  return `mailto:${address}${query.length ? `?${query.join('&')}` : ''}`
}

const defaultFormatLine = ({ quantity, name }) => `${quantity}× ${name}`

/**
 * The text of an email about a cart. `maxLength` bounds the whole `mailto:` link built from
 * it without the recipient (`buildMailtoHref({ subject, body }).length`), so the caller leaves
 * room for the address. The lines that do not fit are replaced by `moreLabel(n)`.
 */
export const buildCartEmail = ({
  subject = '',
  greeting = '',
  items = [],
  totalLine = '',
  signOff = '',
  moreLabel = (count) => `+${count} more items`,
  formatLine = defaultFormatLine,
  maxLength = MAILTO_MAX
} = {}) => {
  const lines = (items || []).map(item => formatLine(item))
  const compose = (count) => {
    const kept = lines.slice(0, count)
    const omitted = lines.length - count
    if (omitted > 0) kept.push(moreLabel(omitted))
    return [greeting, kept.join('\n'), totalLine, signOff].filter(Boolean).join('\n\n')
  }
  const fits = (body) => buildMailtoHref({ subject, body }).length <= maxLength

  for (let count = lines.length; count >= 0; count--) {
    const body = compose(count)
    if (fits(body)) return { subject, body }
  }

  // Not even the fixed parts fit: cut the text itself, whole characters at a time
  const chars = Array.from(compose(0))
  while (chars.length && !fits(`${chars.join('')}…`)) chars.pop()
  return { subject, body: chars.length ? `${chars.join('')}…` : '' }
}

/** Copies text to the clipboard. false when the browser allows neither way. */
export const copyText = async (text) => {
  const value = String(text ?? '')
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText && globalThis.isSecureContext !== false) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch (error) {
    // falls through to the selection copy
  }
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false
  const field = document.createElement('textarea')
  try {
    field.value = value
    field.setAttribute('readonly', '')
    field.style.position = 'fixed'
    field.style.opacity = '0'
    document.body.appendChild(field)
    field.select()
    return Boolean(document.execCommand('copy'))
  } catch (error) {
    return false
  } finally {
    if (field.parentNode) field.parentNode.removeChild(field)
  }
}
