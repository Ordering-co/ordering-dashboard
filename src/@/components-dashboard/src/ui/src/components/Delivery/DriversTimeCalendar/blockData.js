// redesign DT-B1 (DT-01, DT-02, DT-03, DT-09, DT-20, DT-21, DT-24): the pure data of the drivers' time calendar.
//
// Days are local strings `YYYY-MM-DD`; a range is `{ from, to }` of local days. Only `toRequestRange` and the bodies turn local time into
// UTC, and only at the moment of the request (DT-20). Day arithmetic goes through `moment.utc`, so it never depends on the zone or on
// a daylight-saving change; what needs the zone (midnight of a day in UTC, UTC → local) goes through utils/timeZone.
// A block is already in local time (`localBlocks`), with `start`/`end`/`break_*`/`until` as `YYYY-MM-DD HH:mm:ss`.
// «local» is the wall clock of `zone`, the chosen driver group's (the browser's when it has none, the default here).
import moment from 'moment'
import { RRule } from 'rrule'
import { browserTimeZone, clockIn, todayIn, utcToZone, zoneToUtc } from '../../../../../utils/timeZone'

/** Today in `zone`, `YYYY-MM-DD`. */
export const todayDay = (zone = browserTimeZone(), now = new Date()) => todayIn(zone, now)

const DAY = 'YYYY-MM-DD'
const DATETIME = 'YYYY-MM-DD HH:mm:ss'
const DAY_MINUTES = 1440
const RANGE_LIMIT_DAYS = 31
const DEFAULT_FIRST_HOUR = 8

const pad = (value) => String(value).padStart(2, '0')

/** `00:00` … `23:45` (96) and `23:59` at the end. */
export const QUARTERS = [
  ...Array.from({ length: 96 }, (_, index) => `${pad(Math.floor(index / 4))}:${pad((index % 4) * 15)}`),
  '23:59'
]

const dayMoment = (day) => moment.utc(day, DAY, true)
const addDays = (day, amount) => dayMoment(day).add(amount, 'days').format(DAY)

// ---------------------------------------------------------------- ranges

/** `'day'` is the day alone; `'week'` is the 7 days of the week that holds `day`, from `firstDayOfWeek` (0 Sunday … 6 Saturday). */
export const rangeOf = (kind, day, firstDayOfWeek = 0) => {
  if (kind !== 'week') return { from: day, to: day }
  const back = (dayMoment(day).day() - firstDayOfWeek + 7) % 7
  const from = addDays(day, -back)
  return { from, to: addDays(from, 6) }
}

/** Days included (`from` = `to` → 1). */
export const rangeLength = (range) => dayMoment(range.to).diff(dayMoment(range.from), 'days') + 1

/** One length of the range forward (1) or back (-1). */
export const shiftRange = (range, direction) => {
  const step = rangeLength(range) * direction
  return { from: addDays(range.from, step), to: addDays(range.to, step) }
}

/** Main's limit (`DriversTimeDisplay/index.js:156-157`): more than 31 days between the two ends. */
export const exceedsRangeLimit = (range) => dayMoment(range.to).diff(dayMoment(range.from), 'days') > RANGE_LIMIT_DAYS

export const daysOf = (range) => Array.from({ length: Math.max(rangeLength(range), 0) }, (_, index) => addDays(range.from, index))

/** The two UTC ends the API asks for: the start of the first local day and the end of the last (DT-20). */
export const toRequestRange = (range, zone = browserTimeZone()) => [
  zoneToUtc(`${range.from} 00:00:00`, zone),
  zoneToUtc(`${range.to} 23:59:59`, zone)
]

// ---------------------------------------------------------------- blocks

/** The API gives UTC; the calendar works in local time. Missing blocks are `[]` (DT-24). It does not touch the input. */
export const localBlocks = (blocks, zone = browserTimeZone()) => (Array.isArray(blocks)
  ? blocks.map(block => ({
    ...block,
    start: utcToZone(block.start, zone),
    end: utcToZone(block.end, zone),
    break_start: utcToZone(block.break_start, zone),
    break_end: utcToZone(block.break_end, zone),
    // `until` goes to the API in UTC (addBody/editBody), so it comes back local like the rest of the block
    until: utcToZone(block.until, zone)
  }))
  : [])

const dayOfDatetime = (datetime) => String(datetime ?? '').slice(0, 10)

/** The blocks that start on `day` — by full date, not by the day of the month (DT-09) — ordered by start. */
export const blocksOnDay = (blocks, day) => (Array.isArray(blocks) ? blocks : [])
  .filter(block => dayOfDatetime(block?.start) === day)
  .sort((a, b) => String(a.start).localeCompare(String(b.start)))

/** Minutes since 00:00 of a `YYYY-MM-DD HH:mm:ss` (or of an `HH:mm`). */
export const minutesOf = (datetime) => {
  const match = /(\d{1,2}):(\d{2})(?::\d{2})?\s*$/.exec(String(datetime ?? ''))
  return match ? Number(match[1]) * 60 + Number(match[2]) : 0
}

// Minutes of `datetime` counted from 00:00 of `day` (negative before it, beyond 1440 after it)
const minutesFromDay = (datetime, day) => {
  const dayShift = dayMoment(dayOfDatetime(datetime)).diff(dayMoment(day), 'days')
  return dayShift * DAY_MINUTES + minutesOf(datetime)
}
const clampDay = (minutes) => Math.min(Math.max(minutes, 0), DAY_MINUTES)

/** Minutes of the day that a block fills on `day`, clipped to [0, 1440]; a block that crosses midnight reaches the end of the day. */
export const blockSpan = (block, day) => ({
  start: clampDay(minutesFromDay(block.start, day)),
  end: clampDay(minutesFromDay(block.end, day)),
  breakStart: block.break_start ? clampDay(minutesFromDay(block.break_start, day)) : null,
  breakEnd: block.break_end ? clampDay(minutesFromDay(block.break_end, day)) : null
})

/** The hour the day view opens on: an hour before the first start of the day, `8` when nobody starts. */
export const firstHour = (users, day) => {
  const starts = (Array.isArray(users) ? users : [])
    .flatMap(user => blocksOnDay(user?.delivery_blocks, day))
    .map(block => minutesOf(block.start))
  if (!starts.length) return DEFAULT_FIRST_HOUR
  return Math.max(0, Math.floor(Math.min(...starts) / 60) - 1)
}

// ---------------------------------------------------------------- hours

/**
 * The hours the selects offer: every quarter and 23:59. As main (`DriversTimeDisplay/index.js:193-199,222`), up to today the
 * hours before the current one go, and in the current hour the quarters up to its minutes. `extra` (the hours of the block being
 * edited, `HH:mm`) are added when missing. Sorted, no repeats, `23:59` last.
 */
export const timeOptions = ({ day, now = new Date(), extra = [], zone = browserTimeZone() } = {}) => {
  const limited = day <= todayIn(zone, now)
  const { hour, minute: minutes } = clockIn(zone, now)
  const options = QUARTERS.filter(option => {
    if (!limited || option === '23:59') return true
    const [optionHour, optionMinutes] = option.split(':').map(Number)
    if (optionHour < hour) return false
    return !(optionHour === hour && optionMinutes <= minutes)
  })
  return [...new Set([...options, ...(extra || []).filter(Boolean)])].sort()
}

/** `09:00`, or `09:00 AM` with a 12-hour clock (`00:xx` → `12:xx AM`, `12:xx` → `12:xx PM`). */
export const formatClock = (hhmm, { is12 = false, am = 'AM', pm = 'PM' } = {}) => {
  if (!is12) return hhmm
  const [hours, minutes] = String(hhmm).split(':').map(Number)
  return `${pad(hours % 12 || 12)}:${pad(minutes)} ${hours < 12 ? am : pm}`
}

/** `HH:mm` of a `YYYY-MM-DD HH:mm:ss`. */
export const timeOf = (datetime) => {
  const match = /(\d{2}:\d{2})(?::\d{2})?\s*$/.exec(String(datetime ?? ''))
  return match ? match[1] : ''
}

// ---------------------------------------------------------------- repetition

const FREQ_NAMES = { [RRule.WEEKLY]: 'weekly', [RRule.DAILY]: 'daily' }
const FREQ_VALUES = { weekly: RRule.WEEKLY, daily: RRule.DAILY }

const rruleStamp = (datetime) => moment(datetime, DATETIME).utc().format('YYYYMMDD[T]HHmmss[Z]')

/**
 * The repetition of a block as the form shows it. The rule is read with its `DTSTART` (DT-21: main's precedence mistake read it
 * without) and the days come from the rule as written (`origOptions`): rrule fills the day of `DTSTART` into a weekly rule that
 * has none, and that day would show as marked. A daily rule gives `[]`, never `null`.
 */
export const ruleOf = (block) => {
  if (!block?.rrule) return { freq: null, byweekday: [] }
  const rule = block.rrule.includes('RRULE:') ? block.rrule : `RRULE:${block.rrule}`
  const parsed = RRule.fromString(block.start ? `DTSTART:${rruleStamp(block.start)}\n${rule}` : rule)
  const days = parsed.origOptions.byweekday
  return {
    freq: FREQ_NAMES[parsed.origOptions.freq] ?? null,
    byweekday: (Array.isArray(days) ? days : days == null ? [] : [days]).map(day => (typeof day === 'number' ? day : day.weekday))
  }
}

/** What goes to the API as `rrule` (as main, `RRULE:FREQ=WEEKLY;BYDAY=MO,WE`), `null` without frequency. */
export const buildRule = ({ freq, byweekday }) => (freq
  ? new RRule({ freq: FREQ_VALUES[freq], byweekday }).toString()
  : null)

/**
 * The line that says what the repetition does (DT-03). `dayName(index)` gets the rrule index of the day (0 Monday … 6 Sunday,
 * the one of `byweekday`) and gives its short name; `untilText` is the visible until date. `locale` only sets the «and» of the list.
 */
export const describeRule = (form, { t, dayName, untilText, locale = 'en' }) => {
  if (!form?.freq) return ''
  const days = [...(form.byweekday || [])].sort((a, b) => a - b).map(dayName)
  const list = days.length ? new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(days) : ''
  const sentence = form.freq === 'weekly'
    ? (days.length
        ? t('DRIVER_BLOCKS_REPEATS_WEEKLY', 'Repeats every week on _days_ until _date_')
        : t('DRIVER_BLOCKS_REPEATS_WEEKLY_SAME_DAY', 'Repeats every week until _date_'))
    : (days.length
        ? t('DRIVER_BLOCKS_REPEATS_DAILY_ON', 'Repeats every day on _days_ until _date_')
        : t('DRIVER_BLOCKS_REPEATS_DAILY', 'Repeats every day until _date_'))
  return sentence.replace('_days_', list).replace('_date_', untilText)
}

// ---------------------------------------------------------------- the form

/** The form of an existing block, opened on `day`. */
export const formFromBlock = (block, day) => {
  const { freq, byweekday } = ruleOf(block)
  return {
    name: block.name ?? '',
    description: block.description ?? '',
    day,
    start: timeOf(block.start),
    end: timeOf(block.end),
    showBreak: !!block.break_start,
    breakStart: block.break_start ? timeOf(block.break_start) : '',
    breakEnd: block.break_end ? timeOf(block.break_end) : '',
    freq,
    byweekday,
    untilDay: block.until ? dayOfDatetime(block.until) : day
  }
}

/** The form of a new block: starts at the pressed hour (or the first the select offers), ends at 23:59, until is the day (as main). */
export const emptyForm = ({ day, startTime, now = new Date(), zone }) => ({
  name: '',
  description: '',
  day,
  start: startTime || timeOptions({ day, now, zone })[0],
  end: '23:59',
  showBreak: false,
  // TODO(DT-B2): the spec gives no default break hours; they stay empty until the user picks them (timeErrors then asks for them)
  breakStart: '',
  breakEnd: '',
  freq: null,
  byweekday: [],
  untilDay: day
})

/** The errors of the hours, with main's keys (`CalendarDriversList:57-64`); `{}` when they are fine. */
export const timeErrors = (form) => {
  const errors = {}
  if (form.end <= form.start) errors.end = 'END_TIME_LATER'
  if (form.showBreak) {
    const { breakStart, breakEnd } = form
    if (!(breakStart > form.start && breakStart < form.end && breakStart < breakEnd)) errors.breakStart = 'BREAK_START_TIME_LATER'
    if (!(breakEnd > breakStart && breakEnd < form.end)) errors.breakEnd = 'BREAK_END_TIME_EARLY'
  }
  return errors
}

/** The dates «Until» accepts: from the day of the block to two months later (main, `DriversTimeDisplay/index.js:167-178`). */
export const untilBounds = (day) => ({ min: day, max: dayMoment(day).add(2, 'months').format(DAY) })
// where «Until» starts when a repetition is chosen on a new block, a month out (inside untilBounds)
export const defaultUntil = (day) => dayMoment(day).add(1, 'months').format(DAY)

// ---------------------------------------------------------------- the bodies

const stamp = (day, time, zone) => zoneToUtc(`${day} ${time}:00`, zone)

// What POST and PUT have in common: the hours in UTC, the rule, the break (both ends or none), name and description
const commonBody = (form, zone) => {
  const body = {
    start: stamp(form.day, form.start, zone),
    end: stamp(form.day, form.end, zone)
  }
  const rrule = buildRule(form)
  if (rrule) body.rrule = rrule
  if (form.showBreak) {
    body.break_start = stamp(form.day, form.breakStart, zone)
    body.break_end = stamp(form.day, form.breakEnd, zone)
  }
  if (form.name) body.name = form.name
  if (form.description) body.description = form.description
  return body
}

const untilOfDay = (day, zone) => zoneToUtc(`${day} 23:59:59`, zone)

/** The body of the `POST` of a new block; `until` always goes (the end of the until day), as main. */
export const addBody = (form, zone = browserTimeZone()) => ({ ...commonBody(form, zone), until: untilOfDay(form.untilDay, zone) })

/**
 * The body of the `PUT` of a block, with its propagation. Two changes from main: the break goes complete (DT-01), and a block that
 * repeats keeps the `until` it had (none if it had none) instead of the day of the repetition that was opened (DT-02). Without
 * repetition `until` is the day, as main.
 */
export const editBody = (form, block, propagation, zone = browserTimeZone()) => {
  const body = commonBody(form, zone)
  if (block?.rrule) {
    if (block.until) body.until = zoneToUtc(block.until, zone)
  } else {
    body.until = untilOfDay(form.untilDay, zone)
  }
  return { ...body, propagation }
}
