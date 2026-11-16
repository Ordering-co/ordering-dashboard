import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

// the time zone a page shows its hours in (the store's, the driver group's, the user's) and the conversions it needs.
// A day is 'YYYY-MM-DD'; a datetime is 'YYYY-MM-DD HH:mm:ss', in UTC (as the API writes it) or as the wall clock of a zone.
// Strings are parsed without a format on purpose: dayjs.utc(value, [formats]) with customParseFormat reads them as local (W1-6).

const DAY = 'YYYY-MM-DD'
const DATETIME = 'YYYY-MM-DD HH:mm:ss'

export const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

const isZone = (zone) => {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: zone })
    return true
  } catch (err) {
    return false
  }
}

/** `{ zone, fallback }`: the entity's IANA zone when it has a valid one, else the browser's with `fallback: true`. */
export const resolveTimeZone = (zone) => {
  const name = typeof zone === 'string' ? zone.trim() : ''
  return name && isZone(name) ? { zone: name, fallback: false } : { zone: browserTimeZone(), fallback: true }
}

/** The day `now` is in `zone`. */
export const todayIn = (zone, now = new Date()) => dayjs(now).tz(zone).format(DAY)

/** `{ hour, minute }` of `now` on the clock of `zone`. */
export const clockIn = (zone, now = new Date()) => {
  const time = dayjs(now).tz(zone)
  return { hour: time.hour(), minute: time.minute() }
}

/** `day` moved by `amount` days (calendar arithmetic, no zone involved). */
export const addDays = (day, amount) => dayjs.utc(day).add(amount, 'day').format(DAY)

/** A UTC datetime of the API as the wall clock of `zone`; null stays null. */
export const utcToZone = (datetime, zone) => (datetime ? dayjs.utc(datetime).tz(zone).format(DATETIME) : null)

/** A wall clock of `zone` as the UTC datetime the API takes. */
export const zoneToUtc = (datetime, zone) => dayjs.tz(datetime, zone).utc().format(DATETIME)

/** The wall clock of `zone` as a browser Date with the same digits, for calendars that only draw local Dates. */
export const zoneWallDate = (datetime, zone) => {
  const [day, time = '00:00:00'] = utcToZone(datetime, zone).split(' ')
  const [year, month, date] = day.split('-').map(Number)
  const [hours, minutes, seconds] = time.split(':').map(Number)
  return new Date(year, month - 1, date, hours, minutes, seconds)
}

/** `now` on the wall clock of `zone`, as a browser Date with the same digits (the «today» of those calendars). */
export const nowWallDate = (zone, now = new Date()) => zoneWallDate(dayjs(now).utc().format(DATETIME), zone)

/** The line a page writes next to its hours: «Times in America/Bogota», or that it fell back to the browser's zone. */
export const timeZoneNote = ({ zone, fallback }, t) => (fallback
  ? t('TIMES_IN_BROWSER_TIME_ZONE', 'Times in _zone_, your browser’s time zone (none is set here)')
  : t('TIMES_IN_TIME_ZONE', 'Times in _zone_')
).replace('_zone_', zone)
