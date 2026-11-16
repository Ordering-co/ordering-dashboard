// redesign stores 3.B, P-2: the status of a store is the server's `open` (it already knows the schedule, the exceptions
// and the timezone); the times beside it come from `today`, read at the clock of the store's own timezone, never the browser's.
// Pure: no React, no dayjs, no requests.

const END_OF_DAY = 23 * 60 + 59 // the last minute a lapse can close at

const isClock = (clock) => Number.isFinite(clock?.hour) && Number.isFinite(clock?.minute)
const toMinutes = (clock) => clock.hour * 60 + clock.minute

// The minutes since midnight at `now` in `timeZone`, or null when the zone is missing or not an IANA name.
const minutesIn = (timeZone, now) => {
  if (typeof timeZone !== 'string' || !timeZone) return null
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)
    const hour = Number(parts.find(part => part.type === 'hour')?.value)
    const minute = Number(parts.find(part => part.type === 'minute')?.value)
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
    return (hour % 24) * 60 + minute
  } catch (error) {
    if (error instanceof RangeError) return null
    throw error
  }
}

// A lapse holds `now` from its open (inside) to its close (outside); one that closes at or before it opens crosses midnight.
const holds = (lapse, minutes) => {
  const from = toMinutes(lapse.open)
  const to = toMinutes(lapse.close)
  return to <= from ? (minutes >= from || minutes < to) : (minutes >= from && minutes < to)
}

/**
 * What the Open now cell of a store row says. `business` is a row of the list: `open` (boolean, from the server), `today`
 * (`{ enabled, lapses: [{ open: { hour, minute }, close: { hour, minute } }] }` or null) and `timezone` (IANA).
 *
 * `null` when the row has no boolean `open`, and for a disabled store (`enabled === false`): the server says `open` from the
 * schedule alone, but a disabled store takes no orders (review r1 #1). Otherwise `{ open }` and, when the lapses of today allow
 * it, `closes` (open: the close of the lapse that holds now), `allDay` (open, in a lapse from 00:00 to 23:59: the schedule's way
 * of saying 24 hours, review r1 #2) or `opens` (closed: the earliest open still ahead today); times are `{ hour, minute }`. A
 * missing or invalid timezone gives the status without times.
 */
export const storeOpenNow = (business, now = new Date()) => {
  if (typeof business?.open !== 'boolean' || business.enabled === false) return null
  const { open } = business
  const minutes = minutesIn(business.timezone, now)
  if (minutes == null) return { open }

  const lapses = (business.today?.enabled === false ? [] : (business.today?.lapses || []))
    .filter(lapse => isClock(lapse?.open) && isClock(lapse?.close))

  if (open) {
    const current = lapses.find(lapse => holds(lapse, minutes))
    if (!current) return { open }
    if (toMinutes(current.open) === 0 && toMinutes(current.close) >= END_OF_DAY) return { open, allDay: true }
    return { open, closes: { hour: current.close.hour, minute: current.close.minute } }
  }

  const ahead = lapses
    .filter(lapse => toMinutes(lapse.open) > minutes)
    .sort((a, b) => toMinutes(a.open) - toMinutes(b.open))[0]
  return ahead ? { open, opens: { hour: ahead.open.hour, minute: ahead.open.minute } } : { open }
}

/**
 * A clock as text: 'HH:mm' in 24 hours (zero-padded) or 'h:mm AM/PM' in 12 ('9:05 AM', '12:00 PM', '12:30 AM', '11:59 PM').
 * With a `locale` (the dashboard's language code), the 12-hour mark is that language's («11:59 p. m.» in es), always with
 * Latin digits like the rest of the figures (review r1 #4); 24 hours never depends on the language.
 */
export const formatClock = ({ hour, minute }, is12Hours = false, locale) => {
  const mm = String(minute).padStart(2, '0')
  if (is12Hours && locale) {
    try {
      return new Intl.DateTimeFormat(`${locale}-u-nu-latn`, { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' })
        .format(new Date(Date.UTC(2000, 0, 1, hour, minute)))
    } catch (error) {
      if (!(error instanceof RangeError)) throw error
    }
  }
  if (!is12Hours) return `${String(hour).padStart(2, '0')}:${mm}`
  const suffix = hour >= 12 ? 'PM' : 'AM'
  return `${hour % 12 || 12}:${mm} ${suffix}`
}
