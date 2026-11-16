// redesign stores 2.F
// Pure helpers of the snooze dialog. The API speaks UTC as `YYYY-MM-DD HH:mm:ss`: it is read and written by parts, because
// `new Date('YYYY-MM-DD HH:mm:ss')` is local in Chrome and Invalid in Safari, and the ISO text of a Date is never shown
// in this product. «Until…» is the person's local day and time, or, with a `timeZone` (bugs C, the store editor passes
// the store's), the day and time on that zone's clock.

export const DURATION_HOURS = [1, 2, 4, 6, 12]

const HOUR_MS = 60 * 60 * 1000
const API_DATE = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/

const pad = (value, length = 2) => String(value).padStart(length, '0')

/** The instant (ms) the API value means, read as UTC; null for an empty or unreadable value. */
export const parseApiUtc = (value) => {
  const parts = API_DATE.exec(String(value ?? '').trim())
  if (!parts) return null
  const [, year, month, day, hour, minute, second] = parts.map(Number)
  const time = Date.UTC(year, month - 1, day, hour, minute, second || 0)
  return Number.isNaN(time) ? null : time
}

/** True when the API value is after `now` (ms). */
export const isFutureApi = (value, now = Date.now()) => {
  const time = parseApiUtc(value)
  return time !== null && time > now
}

/** An instant written for the API: UTC by parts, `YYYY-MM-DD HH:mm:ss`. */
export const formatApiUtc = (date) => {
  const day = `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
  return `${day} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
}

/** `now` (ms) plus N hours, for the API. */
export const addHoursToApi = (now, hours) => formatApiUtc(new Date(now + hours * HOUR_MS))

/** The local day of a date as `YYYY-MM-DD` (what P/DatePicker reads and writes). */
export const localDayOf = (date) => `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const splitDay = (day) => /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day ?? ''))?.slice(1).map(Number) ?? null
const splitTime = (time) => /^(\d{1,2}):(\d{1,2})$/.exec(String(time ?? ''))?.slice(1).map(Number) ?? null

/** A local day (`YYYY-MM-DD`) and time (`H:M`, what P/TimeField writes) as a Date, or null when either is missing. */
export const localDateFrom = (day, time) => {
  const dayParts = splitDay(day)
  const timeParts = splitTime(time)
  if (!dayParts || !timeParts) return null
  return new Date(dayParts[0], dayParts[1] - 1, dayParts[2], timeParts[0], timeParts[1])
}

// ── redesign bugs C: a time zone's clock, by parts (Intl), without the browser's zone ──

/** `timeZone` when Intl knows it, else undefined (the caller then uses the browser's clock, as before). */
export const knownTimeZone = (timeZone) => {
  if (typeof timeZone !== 'string' || !timeZone) return undefined
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(0)
    return timeZone
  } catch (error) {
    if (error instanceof RangeError) return undefined
    throw error
  }
}

const zoneParts = (time, timeZone) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(new Date(time))
  const part = (type) => Number(parts.find(item => item.type === type)?.value)
  return { year: part('year'), month: part('month'), day: part('day'), hour: part('hour') % 24, minute: part('minute'), second: part('second') }
}

// how far ahead of UTC the zone's clock is at the instant (ms)
const zoneOffset = (time, timeZone) => {
  const wall = zoneParts(time, timeZone)
  return Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second) - Math.floor(time / 1000) * 1000
}

/** The clock of `timeZone` at the instant (ms), written like the API (`YYYY-MM-DD HH:mm:ss`), to be shown as it is. */
export const zonedStampOf = (time, timeZone) => {
  const wall = zoneParts(time, timeZone)
  return `${pad(wall.year, 4)}-${pad(wall.month)}-${pad(wall.day)} ${pad(wall.hour)}:${pad(wall.minute)}:${pad(wall.second)}`
}

/** The day (`YYYY-MM-DD`) of the instant (ms) on the clock of `timeZone`. */
export const zonedDayOf = (time, timeZone) => zonedStampOf(time, timeZone).slice(0, 10)

/** A day and time on the clock of `timeZone` as the instant (ms) it names, summer time included; null when incomplete. */
const zonedInstantFrom = (day, time, timeZone) => {
  const dayParts = splitDay(day)
  const timeParts = splitTime(time)
  if (!dayParts || !timeParts) return null
  const wall = Date.UTC(dayParts[0], dayParts[1] - 1, dayParts[2], timeParts[0], timeParts[1])
  const first = wall - zoneOffset(wall, timeZone)
  return wall - zoneOffset(first, timeZone)
}

// the instant (ms) of a day and time: on the clock of `timeZone`, or the browser's without one
const instantFrom = (day, time, timeZone) => (timeZone
  ? zonedInstantFrom(day, time, timeZone)
  : (localDateFrom(day, time)?.getTime() ?? null))

/** «Until…» for the API: the day and time (local, or on the clock of `timeZone`) as UTC, or null when it is not complete. */
export const untilToApi = (day, time, timeZone) => {
  const instant = instantFrom(day, time, timeZone)
  return instant === null ? null : formatApiUtc(new Date(instant))
}

/** True when the day and time (local, or on the clock of `timeZone`) are complete and after `now` (ms). */
export const isFutureUntil = (day, time, now = Date.now(), timeZone) => {
  const instant = instantFrom(day, time, timeZone)
  return instant !== null && instant > now
}

/** Where «Until…» starts: tomorrow at the next full hour (minutes 00), on the browser's clock or on the clock of `timeZone`. */
export const defaultUntil = (now = Date.now(), timeZone) => {
  if (timeZone) {
    const wall = zoneParts(now, timeZone)
    const next = new Date(Date.UTC(wall.year, wall.month - 1, wall.day + 1, wall.hour + 1, 0, 0, 0))
    return { day: `${pad(next.getUTCFullYear(), 4)}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`, time: `${next.getUTCHours()}:0` }
  }
  const date = new Date(now)
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, date.getHours() + 1, 0, 0, 0)
  return { day: localDayOf(next), time: `${next.getHours()}:0` }
}

/** True when two instants (ms) fall on the same day: the browser's, or that of `timeZone`. */
export const isSameLocalDay = (a, b, timeZone) => (timeZone
  ? zonedDayOf(a, timeZone) === zonedDayOf(b, timeZone)
  : localDayOf(new Date(a)) === localDayOf(new Date(b)))
