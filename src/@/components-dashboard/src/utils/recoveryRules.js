/**
 * Pure helpers of the cart recovery rules page (`/cart-recovery/recovery-actions`).
 *
 * A rule (`event_rule`, type `abandoned_cart`) sends its messages `times[0]` seconds after the customer
 * last opened the cart (redesign/pages/recovery-actions/analysis.md section 3). Nothing here reads the
 * browser clock or the DOM; the formatting goes through `Intl` in the locale the caller passes.
 */

// redesign RA-B1 (decision 4; M-RA11): the wait as amount + unit
export const WAIT_UNITS = ['seconds', 'minutes', 'hours', 'days']
export const PAGE_SIZES = [10, 25, 50]
// redesign RA-B1 (decision 2): channels are asked per row, never more than this many at once
export const CHANNEL_CONCURRENCY = 6
// The API always paginates the channels of a rule and answers at most 50 per page (a bigger size falls back to 10)
export const CHANNELS_PAGE_SIZE = 50
// Hard stop for fetchAllPages, so a wrong `total_pages` can never loop for ever
export const MAX_PAGES = 20

const UNIT_SECONDS = { seconds: 1, minutes: 60, hours: 3600, days: 86400 }
// Singular names `Intl.NumberFormat` knows, from the largest to the smallest
const PARTS = [
  { unit: 'day', seconds: 86400 },
  { unit: 'hour', seconds: 3600 },
  { unit: 'minute', seconds: 60 },
  { unit: 'second', seconds: 1 }
]

const isWait = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0

// redesign R2-F2 (R1-10): `times` may come as JSON text ("[260]"), as the PUT sends it and the API may answer it.
// Text that is not a JSON list gives no list (the caller reads it as no wait).
const timesList = (times) => {
  if (Array.isArray(times)) return times
  if (typeof times !== 'string') return undefined
  try {
    const parsed = JSON.parse(times)
    return Array.isArray(parsed) ? parsed : undefined
  } catch (err) {
    return undefined
  }
}

/**
 * The first value of `rule.times` (a list, or JSON text of a list: "[260]") as a number; null when it is missing or not finite.
 */
export const ruleWait = (rule) => {
  const first = timesList(rule?.times)?.[0]
  if (first === null || first === undefined || first === '' || typeof first === 'boolean') return null
  const value = Number(first)
  return Number.isFinite(value) ? value : null
}

/**
 * Seconds -> the largest unit that represents the value exactly: 260 -> 260 seconds, 7200 -> 2 hours.
 * 0 is `{ 0, minutes }` and no value is `{ null, minutes }` (the unit the field shows when empty).
 */
export const splitWait = (seconds) => {
  if (!isWait(seconds)) return { amount: null, unit: 'minutes' }
  if (seconds === 0) return { amount: 0, unit: 'minutes' }
  for (const unit of ['days', 'hours', 'minutes']) {
    if (seconds % UNIT_SECONDS[unit] === 0) return { amount: seconds / UNIT_SECONDS[unit], unit }
  }
  return { amount: seconds, unit: 'seconds' }
}

/**
 * amount + unit -> seconds. The amount must be an integer >= 0 and the unit one of WAIT_UNITS; else null.
 */
export const toSeconds = (amount, unit) => {
  if (!Object.prototype.hasOwnProperty.call(UNIT_SECONDS, unit)) return null
  if (amount === null || amount === undefined || amount === '' || typeof amount === 'boolean') return null
  const value = Number(amount)
  if (!Number.isInteger(value) || value < 0) return null
  return value * UNIT_SECONDS[unit]
}

/**
 * Seconds -> parts without zeros: 260 -> 4 minute + 20 second; 0 -> 0 second; no value -> [].
 */
export const waitParts = (seconds) => {
  if (!isWait(seconds)) return []
  if (seconds === 0) return [{ value: 0, unit: 'second' }]
  const parts = []
  let rest = seconds
  for (const { unit, seconds: size } of PARTS) {
    const value = Math.floor(rest / size)
    if (value > 0) {
      parts.push({ value, unit })
      rest -= value * size
    }
  }
  return parts
}

/**
 * Seconds -> the wait in words, in `locale` ('4 min 20 sec', '2 days'). Without Intl: '4 minute 20 second'.
 * No value -> ''.
 */
export const formatWait = (seconds, locale) => {
  const parts = waitParts(seconds)
  if (!parts.length) return ''
  try {
    if (typeof Intl === 'undefined' || !Intl.NumberFormat || !Intl.ListFormat) throw new Error('no Intl')
    const texts = parts.map(({ value, unit }) => new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'short' }).format(value))
    return new Intl.ListFormat(locale, { type: 'unit', style: 'narrow' }).format(texts)
  } catch (err) {
    return parts.map(({ value, unit }) => `${value} ${unit}`).join(' ')
  }
}

/**
 * How many rules are on: `{ on, total }` (the same account open carts shows).
 */
export const countRulesOn = (rules) => {
  const list = Array.isArray(rules) ? rules : []
  return { on: list.filter(rule => rule?.enabled).length, total: list.length }
}

/**
 * The value of PAGE_SIZES nearest from above (11 -> 25, 999 -> 50); anything invalid is 10.
 */
export const clampPageSize = (value) => {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return PAGE_SIZES[0]
  const size = Number(value)
  if (!Number.isFinite(size) || size <= 0) return PAGE_SIZES[0]
  return PAGE_SIZES.find(option => option >= size) ?? PAGE_SIZES[PAGE_SIZES.length - 1]
}

/**
 * Runs `worker(item, index)` over `items` with at most `limit` in flight. The results keep the order of
 * `items`. Once `signal` is aborted nothing else is launched (the items not launched stay `undefined`);
 * what already runs finishes. The first error of a worker stops the launching and rejects.
 */
export const mapWithConcurrency = (items, limit, worker, { signal } = {}) => {
  const list = Array.from(items ?? [])
  const results = new Array(list.length)
  const size = Math.max(1, Math.floor(Number(limit)) || 1)
  let next = 0
  let failed = false

  const run = async () => {
    while (next < list.length && !failed && !signal?.aborted) {
      const index = next
      next += 1
      try {
        results[index] = await worker(list[index], index)
      } catch (err) {
        failed = true
        throw err
      }
    }
  }

  return Promise.all(Array.from({ length: Math.min(size, list.length) }, run)).then(() => results)
}

/**
 * Reads every page of a paginated list. `requestPage(page)` resolves the parsed JSON answer of that page (1-based).
 * It keeps asking while `pagination.current_page < pagination.total_pages`, up to `maxPages`; an answer without
 * `pagination` is a single page. Resolves `{ error: false, result: [...all items] }`, or the first failed answer as
 * `{ error: true, result: <api error> }`. An aborted `signal` rejects with an AbortError; a rejection of `requestPage`
 * (network) is left to the caller.
 */
export const fetchAllPages = async (requestPage, { signal, maxPages = MAX_PAGES } = {}) => {
  const items = []
  for (let page = 1; page <= maxPages; page += 1) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const content = await requestPage(page)
    if (content.error) return { error: true, result: content.result }
    if (Array.isArray(content.result)) items.push(...content.result)
    const pagination = content.pagination
    if (!pagination || !(pagination.current_page < pagination.total_pages)) break
  }
  return { error: false, result: items }
}
