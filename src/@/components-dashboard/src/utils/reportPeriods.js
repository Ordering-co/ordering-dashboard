/**
 * Pure helpers of the period of /intelligence/reports: the ranges of the period pill and the labels the reports API
 * sends for each group of a table or a chart.
 *
 * Days are always the text 'YYYY-MM-DD'. Nothing here reads the clock (callers pass `today`) and nothing here writes a
 * date for the eye: the visible format is the project's (`parseDate`), so it belongs to the UI.
 *
 * What the API does (measured live, redesign/pages/intelligence-reports/evidence/audit-phase1.md, finding 1): it groups
 * by the length of the range, and sends one row per group that has data (the empty ones do not come):
 * - one date: `Hour 2026-10-05 09:00` (the hour moves with `timezone`)
 * - a few dates: `Day 2026-10-03`
 * - about a month: `Week 2026-39`; weeks start on SUNDAY and follow MySQL `WEEK(date, 0)`: week 1 is the one that starts
 *   on the first Sunday of the year, the days before it are week 0. The default range (3-10 Oct) brings weeks 39 and 40
 * - two months: `Month 2026-08`
 * - a year: `Year 2025`
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000
const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

const pad = (value, length = 2) => String(value).padStart(length, '0')

/** 'YYYY-MM-DD' -> UTC milliseconds of that midnight; null when the text is not a real day. */
const msOf = (day) => {
  const match = typeof day === 'string' ? DAY_PATTERN.exec(day) : null
  if (!match) return null
  const [year, month, date] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const ms = Date.UTC(year, month - 1, date)
  const real = new Date(ms)
  return real.getUTCFullYear() === year && real.getUTCMonth() === month - 1 && real.getUTCDate() === date ? ms : null
}

const dayOfMs = (ms) => new Date(ms).toISOString().slice(0, 10)

/** The day `amount` days away from `day` (negative goes back); null when `day` is not a day. */
const shift = (day, amount) => {
  const ms = msOf(day)
  return ms === null ? null : dayOfMs(ms + amount * MS_PER_DAY)
}

// redesign reports FA2 (D3, RP-07): the presets of the period pill, in the order of the screen
export const REPORT_RANGE_PRESETS = ['today', 'yesterday', 'last_7_days', 'last_30_days']

const PRESET_OFFSETS = {
  today: [0, 0],
  yesterday: [-1, -1],
  // redesign reports FA2 (D3): N closed days plus today so far: 8 dates for the 7 days, as main asks by default (AdvancedReports:24-30)
  last_7_days: [-7, 0],
  last_30_days: [-30, 0]
}

/** `{ from, to }` of a preset for the day `today`; null for a preset it does not know or a `today` that is not a day. */
export const presetRange = (preset, today) => {
  const offsets = PRESET_OFFSETS[preset]
  if (!offsets || msOf(today) === null) return null
  return { from: shift(today, offsets[0]), to: shift(today, offsets[1]) }
}

/** The preset a range matches for the day `today`, or null. */
export const presetOf = (from, to, today) => {
  if (!from || !to) return null
  return REPORT_RANGE_PRESETS.find((preset) => {
    const range = presetRange(preset, today)
    return !!range && range.from === from && range.to === to
  }) || null
}

/** The range of a report when it opens: the last 7 days plus today (8 dates). */
export const defaultRange = (today) => presetRange('last_7_days', today)

// ---------------------------------------------------------------------------------------------------------------------
// Labels of the API
// ---------------------------------------------------------------------------------------------------------------------

/** First Sunday of `year` (UTC ms): the day week 1 of MySQL `WEEK(date, 0)` starts. */
const firstSundayMs = (year) => {
  const january1 = Date.UTC(year, 0, 1)
  return january1 + ((7 - new Date(january1).getUTCDay()) % 7) * MS_PER_DAY
}

/** `{ start, end }` of week `number` of `year`, or null when that week does not exist. */
const weekOf = (year, number) => {
  if (msOf(`${pad(year, 4)}-01-01`) === null) return null
  const january1 = Date.UTC(year, 0, 1)
  const firstSunday = firstSundayMs(year)
  if (number === 0) {
    // the days before the first Sunday; there are none when the year starts on a Sunday
    return firstSunday === january1 ? null : { start: dayOfMs(january1), end: dayOfMs(firstSunday - MS_PER_DAY) }
  }
  const start = firstSunday + (number - 1) * 7 * MS_PER_DAY
  // week 53 of a year that has no 53rd Sunday would start next year: it does not exist
  if (new Date(start).getUTCFullYear() !== year) return null
  return { start: dayOfMs(start), end: dayOfMs(start + 6 * MS_PER_DAY) }
}

/** The label of the week (Sunday to Saturday) that holds the day `ms`: the number counts from the first Sunday of the year of that Sunday. */
const weekLabelOfMs = (ms) => {
  const sunday = ms - new Date(ms).getUTCDay() * MS_PER_DAY
  const year = new Date(sunday).getUTCFullYear()
  const number = Math.round((sunday - firstSundayMs(year)) / (7 * MS_PER_DAY)) + 1
  return `Week ${pad(year, 4)}-${pad(number)}`
}

const HOUR_PATTERN = /^Hour (\d{4}-\d{2}-\d{2}) ([01]\d|2[0-3]):([0-5]\d)$/
const DAY_LABEL_PATTERN = /^Day (\d{4}-\d{2}-\d{2})$/
const WEEK_PATTERN = /^Week (\d{4})-(\d{2})$/
const MONTH_PATTERN = /^Month (\d{4})-(\d{2})$/
const YEAR_PATTERN = /^Year (\d{4})$/

/**
 * The dates behind a label of the API: `{ unit, start, end, hour?, number? }` (`hour` is 'HH:MM' for `Hour`, `number` the
 * week number for `Week`), or null when the label is not one of the five forms above (case and spacing included).
 * A week is whole (Sunday to Saturday, even across the change of year): cut it to the report with `clipPeriod`.
 */
// redesign reports FA2 (D7, auditor 1)
export const parsePeriodLabel = (label) => {
  if (typeof label !== 'string') return null

  let match = HOUR_PATTERN.exec(label)
  if (match) {
    if (msOf(match[1]) === null) return null
    return { unit: 'hour', start: match[1], end: match[1], hour: `${match[2]}:${match[3]}` }
  }

  match = DAY_LABEL_PATTERN.exec(label)
  if (match) {
    return msOf(match[1]) === null ? null : { unit: 'day', start: match[1], end: match[1] }
  }

  match = WEEK_PATTERN.exec(label)
  if (match) {
    const number = Number(match[2])
    const week = weekOf(Number(match[1]), number)
    return week ? { unit: 'week', start: week.start, end: week.end, number } : null
  }

  match = MONTH_PATTERN.exec(label)
  if (match) {
    const year = Number(match[1])
    const month = Number(match[2])
    const start = `${match[1]}-${match[2]}-01`
    if (month < 1 || month > 12 || msOf(start) === null) return null
    return { unit: 'month', start, end: dayOfMs(Date.UTC(year, month, 0)) }
  }

  match = YEAR_PATTERN.exec(label)
  if (match) {
    return msOf(`${match[1]}-01-01`) === null ? null : { unit: 'year', start: `${match[1]}-01-01`, end: `${match[1]}-12-31` }
  }

  return null
}

/**
 * The same period with `start` and `end` cut to the range of the report. A period that does not touch the range (or null)
 * gives null: the caller then paints the label as it came.
 */
// redesign reports FA2 (D7, auditor 1)
export const clipPeriod = (period, from, to) => {
  if (!period) return null
  const start = msOf(from) !== null && period.start < from ? from : period.start
  const end = msOf(to) !== null && period.end > to ? to : period.end
  return start > end ? null : { ...period, start, end }
}

// ---------------------------------------------------------------------------------------------------------------------
// Series
// ---------------------------------------------------------------------------------------------------------------------

/** Every label of the groups that the range holds, in order. */
const groupLabels = {
  day: (fromMs, toMs) => {
    const labels = []
    for (let ms = fromMs; ms <= toMs; ms += MS_PER_DAY) labels.push(`Day ${dayOfMs(ms)}`)
    return labels
  },
  // one label per Sunday-to-Saturday week the range touches, numbered as the API does (the days of January before the
  // first Sunday are the last week of the year before: 2025-12-28 .. 2026-01-03 is `Week 2025-52`)
  week: (fromMs, toMs) => {
    const labels = []
    for (let ms = fromMs - new Date(fromMs).getUTCDay() * MS_PER_DAY; ms <= toMs; ms += 7 * MS_PER_DAY) labels.push(weekLabelOfMs(ms))
    return labels
  },
  month: (fromMs, toMs) => {
    const labels = []
    const last = new Date(toMs)
    const first = new Date(fromMs)
    let year = first.getUTCFullYear()
    let month = first.getUTCMonth()
    while (year < last.getUTCFullYear() || (year === last.getUTCFullYear() && month <= last.getUTCMonth())) {
      labels.push(`Month ${pad(year, 4)}-${pad(month + 1)}`)
      month += 1
      if (month > 11) { month = 0; year += 1 }
    }
    return labels
  }
}

const unknownLabels = (points) => points.map((point) => point?.label)

/**
 * The points of a chart (`[{ label, value }]`, as the API sent them) with a `value: 0` for each group of the range that
 * has no row (D7: the API does not send the empty groups, and a line would join groups that are not next to each other).
 * `unit` is 'day', 'week' or 'month'; the result goes in the order of the range.
 *
 * Returns `{ points, unknown }`. `unknown` is the list of the labels that are not a group of the range for that unit (not
 * recognised, another unit, outside the range, or repeated); empty when everything fit (check `unknown.length > 0`).
 * Of those points, the ones that are a real period of the same unit outside the range sit in their place in
 * time among the groups of the range; the rest are kept as they came at the end of `points`.
 * 'hour' and 'year' are not filled: the points that fit come in order of time. A missing list is an empty one.
 */
// redesign reports FA2 (D7, auditor 1)
export const fillSeries = (points, from, to, unit) => {
  const list = Array.isArray(points) ? points : []
  const fromMs = msOf(from)
  const toMs = msOf(to)

  if (unit === 'hour' || unit === 'year') {
    const recognised = []
    const rest = []
    list.forEach((point) => {
      const period = parsePeriodLabel(point?.label)
      if (period && period.unit === unit) recognised.push({ point, key: `${period.start} ${period.hour || ''}` })
      else rest.push(point)
    })
    recognised.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    return { points: [...recognised.map(item => item.point), ...rest], unknown: unknownLabels(rest) }
  }

  if (!groupLabels[unit] || fromMs === null || toMs === null || fromMs > toMs) {
    return { points: [...list], unknown: [] }
  }

  const labels = groupLabels[unit](fromMs, toMs)
  const inRange = new Set(labels)
  const sent = new Map()
  const rest = []
  list.forEach((point) => {
    const label = point?.label
    if (inRange.has(label) && !sent.has(label)) sent.set(label, point)
    else rest.push(point)
  })
  // redesign a group the API sent that is a real period of this unit but falls outside the range (e.g. `Week 2026-37` for a
  // range that starts on Sunday 2026-09-20: with Sunday weeks it is 13-09..19-09) carries data, so it is neither dropped nor left raw at the
  // end: it takes its place in time among the groups of the range. The week numbering of the API is pending backend, so we do
  // not guess which week of the range it "really" is. A repeated label (inside or outside the range), another unit or text that is no period stay at the end as they came.
  // review (low): a label outside the range that the API sends twice is treated as one inside: the first takes its place, the second goes
  // to the end (otherwise the same period was drawn twice in the line)
  const outside = []
  const tail = []
  const placed = new Set()
  rest.forEach((point) => {
    const period = parsePeriodLabel(point?.label)
    if (period && period.unit === unit && !inRange.has(point.label) && !placed.has(point.label)) {
      placed.add(point.label)
      outside.push({ point, start: period.start })
    } else tail.push(point)
  })
  const ordered = [
    ...labels.map(label => ({ point: sent.get(label) || { label, value: 0 }, start: parsePeriodLabel(label).start })),
    ...outside
  ]
  // stable: the groups of the range keep their order among themselves
  ordered.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
  return {
    points: [...ordered.map(item => item.point), ...tail],
    unknown: unknownLabels(rest)
  }
}
