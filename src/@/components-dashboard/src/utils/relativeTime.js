// redesign drivers-dashboard B1 (decision 6: relative time of the last location)
// Pure helpers, no React and no translations. The API sends UTC datetimes as
// 'YYYY-MM-DD HH:mm:ss'; engines read that shape differently, so it is
// normalised to ISO with a 'Z' before parsing.

const API_DATETIME = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?(Z|[+-]\d{2}(:?\d{2})?)?$/i
const HAS_ZONE = /(Z|[+-]\d{2}(:?\d{2})?)$/i

const toValidDate = (date) => (Number.isNaN(date.getTime()) ? null : date)

/** Parses an API datetime (UTC), an ISO string, a Date or a ms number. Returns a Date or null. */
export const parseApiDateTime = (value) => {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return toValidDate(new Date(value.getTime()))
  if (typeof value === 'number') return Number.isFinite(value) ? toValidDate(new Date(value)) : null
  if (typeof value !== 'string') return null

  const text = value.trim()
  if (!API_DATETIME.test(text)) return null
  const hasTime = /[ T]\d{2}:/.test(text)
  if (!hasTime) return toValidDate(new Date(`${text}T00:00:00Z`))
  const iso = text.replace(' ', 'T')
  // Without a zone the API means UTC
  return toValidDate(new Date(HAS_ZONE.test(iso.slice(11)) ? iso : `${iso}Z`))
}

/** Whole minutes (floor) from value to now. null if it does not parse; never negative. */
export const minutesSince = (value, now = Date.now()) => {
  const date = parseApiDateTime(value)
  if (!date) return null
  return Math.max(0, Math.floor((now - date.getTime()) / 60000))
}

const buildFormatter = (locale) => {
  try {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  } catch (error) {
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  }
}

const DAY = 86400

/**
 * (P3): the one relative-time calculation of the dashboard. `seconds` is signed (negative is the past). Under `nowBelow`
 * seconds it says «now» in `nowUnit` («now» for 'second', «this minute» for 'minute'); then minutes, hours, days up to `daysUpTo`, months
 * of 30 days and years of 365. `round: 'magnitude'` rounds the size and keeps the sign (a .5 goes away from zero); `'signed'` rounds the
 * signed value (Math.round: a .5 goes up). The callers' options keep each one's words as they were.
 */
export const formatRelativeSeconds = (seconds, { locale = 'en', nowBelow = 45, nowUnit = 'second', daysUpTo = 30, round = 'magnitude' } = {}) => {
  const formatter = buildFormatter(locale)
  const abs = Math.abs(seconds)
  const sign = seconds < 0 ? -1 : 1
  const say = (unitSeconds, unit) => {
    const value = round === 'signed'
      ? Math.round(seconds / unitSeconds)
      : sign * Math.max(1, Math.round(abs / unitSeconds))
    return formatter.format(value, unit)
  }
  if (abs < nowBelow) return formatter.format(0, nowUnit)
  if (abs < 3600) return say(60, 'minute')
  if (abs < DAY) return say(3600, 'hour')
  if (abs < daysUpTo * DAY) return say(DAY, 'day')
  if (abs < 365 * DAY) return say(30 * DAY, 'month')
  return say(365 * DAY, 'year')
}

/** «3 minutes ago» in the given locale. null if value does not parse. */
export const formatRelativeTime = (value, { now = Date.now(), locale = 'en' } = {}) => {
  const date = parseApiDateTime(value)
  if (!date) return null
  // A timestamp slightly ahead of the clock (skew) reads as «now», never as the future
  return formatRelativeSeconds(-Math.max(0, (now - date.getTime()) / 1000), { locale })
}

const pad = (value) => String(value).padStart(2, '0')

// redesign drivers-dashboard B2 (DD-13): a Date in the API's own shape, UTC 'YYYY-MM-DD HH:mm:ss' (a machine value, never shown as is)
export const toApiDateTime = (date = new Date()) => (
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
  `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
)
