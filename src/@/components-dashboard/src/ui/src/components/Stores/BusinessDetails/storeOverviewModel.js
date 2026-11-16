// redesign stores 4.B (decision 3): what the Overview of the store editor says, from the request the editor
// already makes (plus `snooze_until`). Pure: no React, no requests.

import { parseApiUtc } from '../SnoozeComponent/utils'
import { formatClock } from '../StoresList/storeOpenNow'

const isClock = (clock) => Number.isFinite(clock?.hour) && Number.isFinite(clock?.minute)

/**
 * Today's opening hours as text («9:00 AM–2:00 PM, 6:00 PM–11:00 PM»), in the store's own clock as the server sends them;
 * `null` when the store is closed all day today (`today.enabled === false` or no valid lapse), `undefined` without `today`.
 */
export const todayHoursText = (today, is12Hours, locale) => {
  if (!today) return undefined
  if (today.enabled === false) return null
  const lapses = (today.lapses || []).filter(lapse => isClock(lapse?.open) && isClock(lapse?.close))
  if (!lapses.length) return null
  return lapses.map(lapse => `${formatClock(lapse.open, is12Hours, locale)}–${formatClock(lapse.close, is12Hours, locale)}`).join(', ')
}

/**
 * A preparation time of the API («2:0», «0:20», «1:05») as «2:00», «0:20», «1:05»; `null` when it is not «H:M».
 */
export const durationText = (value) => {
  const match = /^\s*(\d+):(\d{1,2})\s*$/.exec(String(value ?? ''))
  if (!match) return null
  return `${Number(match[1])}:${match[2].padStart(2, '0')}`
}

const countOf = (list, predicate) => (Array.isArray(list) ? list.filter(predicate).length : null)

/**
 * The figures of the summary, in order. Each is `{ id, section, value, warn }`:
 * - `menus`: `{ available, total }` (`available_menus_count` of `menus_count`); `warn` when none is available.
 * - `zones`: `num_zones`.
 * - `times`: `{ delivery, pickup }` as «H:MM» (either may be null).
 * - `paymethods`: the payment methods turned on; `warn` when there is none.
 * - `promotions`: the promotions turned on.
 * - `rating`: `{ total, count }` from `reviews`, or `{ count: 0 }`.
 * A figure the store does not carry (the field is missing) is left out.
 */
export const overviewFacts = (business = {}) => {
  const facts = []
  if (Number.isFinite(business.menus_count)) {
    const available = Number.isFinite(business.available_menus_count) ? business.available_menus_count : business.menus_count
    facts.push({ id: 'menus', section: 'menu', value: { available, total: business.menus_count }, warn: available === 0 })
  }
  if (Number.isFinite(business.num_zones)) {
    facts.push({ id: 'zones', section: 'delivery_pickup_more', value: business.num_zones, warn: false })
  }
  const delivery = durationText(business.delivery_time)
  const pickup = durationText(business.pickup_time)
  if (delivery || pickup) {
    facts.push({ id: 'times', section: 'delivery_pickup_more', value: { delivery, pickup }, warn: false })
  }
  const paymethods = countOf(business.paymethods, paymethod => paymethod?.enabled)
  if (paymethods != null) facts.push({ id: 'paymethods', section: 'payment_methods', value: paymethods, warn: paymethods === 0 })
  const promotions = countOf(business.offers, offer => offer?.enabled)
  if (promotions != null) facts.push({ id: 'promotions', section: 'promotions', value: promotions, warn: false })
  if (business.reviews && typeof business.reviews === 'object') {
    const count = Array.isArray(business.reviews.reviews) ? business.reviews.reviews.length : 0
    const total = Number(business.reviews.total)
    facts.push({ id: 'rating', section: null, value: { total: count > 0 && Number.isFinite(total) ? total : null, count }, warn: false })
  }
  return facts
}

/**
 * When a snooze ends, in the store's own clock (the hours of today beside it are in that clock too): «Oct 10, 7:08 PM», with
 * Latin digits, in 12 or 24 hours like the project. `null` for a value it cannot read or a missing or invalid timezone (the
 * caller then says it in the person's clock, as the Snooze dialog does).
 */
export const snoozeUntilText = (value, timeZone, is12Hours, locale) => {
  const time = parseApiUtc(value)
  if (time == null || typeof timeZone !== 'string' || !timeZone) return null
  try {
    return new Intl.DateTimeFormat(`${locale || 'en'}-u-nu-latn`, {
      timeZone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: !!is12Hours
    }).format(new Date(time))
  } catch (error) {
    if (error instanceof RangeError) return null
    throw error
  }
}

/**
 * Letters, numbers and «_». Main's slug field let only letters and numbers be typed; redesign bugs C: the add makes
 * slugs with «_» from the name (`stringToSlug`), and the editor refused them, so such a store could not be saved.
 */
export const isValidSlug = (slug) => /^[0-9a-zA-Z_]+$/.test(slug)
