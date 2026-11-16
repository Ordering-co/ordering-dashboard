/**
 * Pure helpers of /intelligence/business: the period behind a `lapse`, the comparison plan, the chart
 * series, durations and the CSV files.
 *
 * Nothing here reads the clock, the network or React: callers pass `now` (`zonedNow` is the one that reads `Intl`).
 * Measured behaviour of the reports API (redesign/pages/intelligence-business/analysis.md section 2):
 * - the presets are N closed days plus today so far (`last_7_days` = today-7 .. today, 8 dates);
 * - the rows come by hour for one date, by day for 2 to 31 dates and by month for 32 or more;
 * - an hourly row carries the hour where it CLOSES (`14:00:00` is 13:00 to 14:00) and the last hour of a day
 *   arrives as `D+1 00:00:00`; the daily rows inherit that shift (the last hour of day `to` arrives on `to + 1`).
 *
 * `sumRows`, `averageTicket` and `percentChange` stay in `homeMetrics.js` (the controller imports them from there);
 * they are not re-exported here because `homeMetrics.dailySeries` depends on `bucketSeries`.
 */

const pad = (value) => String(value).padStart(2, '0')

/** Date -> 'YYYY-MM-DD' in the browser's local time. */
const toLocalDay = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/** 'YYYY-MM-DD' -> [year, month, date] numbers (month 1-12), read from the text itself. */
const partsOf = (day) => String(day).slice(0, 10).split('-').map(Number)

const rowsOf = (rows) => (Array.isArray(rows) ? rows : [])

const RANGE_PATTERN = /^(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})$/

// redesign bi FA1 (D4: the four presets of main, in the order of the screen)
export const REPORT_PRESETS = ['today', 'yesterday', 'last_7_days', 'last_30_days']

/** The local day `n` days away from `day` (negative goes back); built from its parts, so a clock change never shifts it. */
export const shiftDay = (day, n) => {
  const [year, month, date] = partsOf(day)
  return toLocalDay(new Date(year, month - 1, date + n))
}

/** Number of dates from `from` to `to`, both included. */
export const daysBetween = (from, to) => {
  const [fromYear, fromMonth, fromDate] = partsOf(from)
  const [toYear, toMonth, toDate] = partsOf(to)
  const millisecondsPerDay = 24 * 60 * 60 * 1000
  return Math.round((Date.UTC(toYear, toMonth - 1, toDate) - Date.UTC(fromYear, fromMonth - 1, fromDate)) / millisecondsPerDay) + 1
}

/**
 * A `Date` whose LOCAL fields (`getFullYear`, `getMonth`, `getDate`, `getHours`, `getMinutes`) are the wall clock of `timeZone`
 * at the instant `now`. `periodOf` and `comparisonPlan` read the local fields, so handing them this date makes «today» the day
 * of the zone the user picked, not the day of the browser. An empty or invalid zone gives `now` as it is.
 * Pure but for `Intl`.
 */
// redesign bi R1 (F1: the time zone the user picked decides the day of the period and the comparison)
export const zonedNow = (timeZone, now = new Date()) => {
  if (!timeZone) return now
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric'
    }).formatToParts(now)
    const read = (type) => Number(parts.find(part => part.type === type)?.value)
    const fields = ['year', 'month', 'day', 'hour', 'minute', 'second'].map(read)
    if (fields.some(Number.isNaN)) return now
    const [year, month, day, hour, minute, second] = fields
    const wall = new Date(year, month - 1, day, hour, minute, second)
    // redesign (row 71 Q-10): when the zone's wall hour falls in a clock change of the browser's zone (it does not exist
    // there), `new Date` moves it one hour forward. No `Date` can hold that hour in its local fields, so the date keeps the day and
    // minutes and its `getHours` answers the hour of the zone: `comparisonPlan` reads `now.getHours()`. Outside the gap it is a plain Date.
    if (wall.getHours() !== hour) Object.defineProperty(wall, 'getHours', { value: () => hour, configurable: true })
    return wall
  } catch (error) {
    // RangeError: the zone is not an IANA name this runtime knows
    return now
  }
}

// redesign bi FA1 (D2, D7, auditor 1, 3: the dates a lapse covers and how the API groups its rows)
export const periodOf = (lapse, now = new Date()) => {
  const today = toLocalDay(now)
  let from = today
  let to = today
  if (lapse === 'yesterday') {
    from = shiftDay(today, -1)
    to = from
  } else if (lapse === 'last_7_days') {
    from = shiftDay(today, -7)
  } else if (lapse === 'last_30_days') {
    from = shiftDay(today, -30)
  } else {
    const range = RANGE_PATTERN.exec(String(lapse ?? ''))
    if (range) {
      from = range[1]
      to = range[2]
      if (from > to) [from, to] = [to, from]
    }
  }
  const days = daysBetween(from, to)
  let granularity = 'month'
  if (from === to) granularity = 'hour'
  else if (days <= 31) granularity = 'day'
  return { from, to, days, includesToday: from <= today && today <= to, granularity }
}

// redesign bi FA1 (D2, auditor 1: what each lapse is compared with, and with which requests)
export const comparisonPlan = (lapse, now = new Date()) => {
  const period = periodOf(lapse, now)
  const today = toLocalDay(now)
  const yesterday = shiftDay(today, -1)

  if (period.includesToday && period.from === period.to) {
    return { mode: 'byNow', previous: `${yesterday},${yesterday}`, hour: now.getHours() }
  }
  if (period.includesToday) {
    // Only the closed days compare: today is still being written, so a percentage against a full period would be biased
    const days = daysBetween(period.from, yesterday)
    return {
      mode: 'closed',
      current: `${period.from},${yesterday}`,
      previous: `${shiftDay(period.from, -days)},${shiftDay(period.from, -1)}`,
      days
    }
  }
  return {
    mode: 'previous',
    previous: `${shiftDay(period.from, -period.days)},${shiftDay(period.from, -1)}`,
    days: period.days
  }
}

/** {day, hour} read from the text of a row's `time` ('YYYY-MM-DD HH:mm:ss'), or null when it has no date. */
const readTime = (row) => {
  const match = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}))?/.exec(String(row?.time ?? ''))
  return match ? { day: match[1], hour: match[2] === undefined ? 0 : Number(match[2]) } : null
}

const valueOf = (row, key) => Number(row?.[key]) || 0

/**
 * The hour of 0..23 where an hourly row STARTS, given the day the rows describe.
 * `HH:00` closes the hour `HH - 1`; `D 00:00` is the first hour; `D+1 00:00` (and anything later) is the last one.
 */
const startHourOf = ({ day, hour }, base) => {
  if (day > base) return 23
  if (day < base || hour === 0) return 0
  return hour - 1
}

const rangeOfMonths = (from, to) => {
  const [fromYear, fromMonth] = partsOf(from)
  const [toYear, toMonth] = partsOf(to)
  const months = []
  for (let year = fromYear, month = fromMonth; year < toYear || (year === toYear && month <= toMonth);) {
    months.push(`${year}-${pad(month)}`)
    if (month === 12) {
      year += 1
      month = 1
    } else {
      month += 1
    }
  }
  return months
}

/**
 * The series of a report on the axis the page draws, as `[{ bucket, value }]`.
 * Every row is counted, so the sum of the series is the sum of `key` over the rows with a readable `time`
 * (a row outside the axis goes to its first or last element).
 * - `'hour'`: 24 elements, `bucket` 'YYYY-MM-DD HH' by the hour where the row starts.
 * - `'day'`: one element per date from `from` to `to`, 0 in the gaps; the `to + 1` row is added to `to`.
 * - `'month'`: one element per month from `from` to `to`, `bucket` 'YYYY-MM'.
 */
// redesign bi FA1 (D7, BI-01, BI-22, auditor 3)
export const bucketSeries = (rows, key, period) => {
  const { from, to, granularity } = period
  const readable = rowsOf(rows).map(row => ({ time: readTime(row), value: valueOf(row, key) })).filter(row => row.time)

  let buckets
  let indexOf
  if (granularity === 'hour') {
    buckets = Array.from({ length: 24 }, (_, hour) => `${from} ${pad(hour)}`)
    indexOf = ({ time }) => startHourOf(time, from)
  } else if (granularity === 'month') {
    buckets = rangeOfMonths(from, to)
    // A month outside the axis goes to the nearest end
    const first = buckets[0]
    const last = buckets[buckets.length - 1]
    indexOf = ({ time }) => {
      const month = time.day.slice(0, 7)
      if (month < first) return 0
      if (month > last) return buckets.length - 1
      return buckets.indexOf(month)
    }
  } else {
    const count = Math.max(daysBetween(from, to), 0)
    buckets = Array.from({ length: count }, (_, index) => shiftDay(from, index))
    indexOf = ({ time }) => {
      if (time.day <= from) return 0
      if (time.day >= to) return buckets.length - 1
      return daysBetween(from, time.day) - 1
    }
  }

  const values = buckets.map(() => 0)
  if (buckets.length) readable.forEach(row => { values[indexOf(row)] += row.value })
  return buckets.map((bucket, index) => ({ bucket, value: values[index] }))
}

/**
 * Adds the hourly rows of one day that started at or before `hour` (0-23), for «yesterday by this time».
 * `day` is the day the rows describe; without it, the earliest date among the rows.
 * `D+1 00:00` is the end of the day (hour 24), so it only counts at 23.
 */
// redesign bi FA1 (D2, auditor 1)
export const sumByNow = (rows, key, hour, day) => {
  const readable = rowsOf(rows).map(row => ({ time: readTime(row), value: valueOf(row, key) })).filter(row => row.time)
  if (!readable.length) return 0
  const base = day || readable.reduce((earliest, row) => (row.time.day < earliest ? row.time.day : earliest), readable[0].time.day)
  return readable.reduce((total, row) => (startHourOf(row.time, base) <= hour ? total + row.value : total), 0)
}

/** Seconds (number or text) -> `{ hours, minutes, seconds }` whole numbers, rounded to the second; null when not a non-negative number. */
// redesign bi FA1 (BI-11, D3)
export const splitDuration = (seconds) => {
  const isNumber = typeof seconds === 'number'
  const isText = typeof seconds === 'string' && seconds.trim() !== ''
  if (!isNumber && !isText) return null
  const total = Math.round(Number(seconds))
  if (!Number.isFinite(total) || total < 0) return null
  return {
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60
  }
}

/** One CSV cell: the value as it is, unless it holds a comma, a quote or a line break; then in double quotes with the quotes doubled. */
// redesign bi FA1 (BI-16)
export const csvCell = (value) => {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * The CSV text with the shape `main` writes: the header as «A, B» and every row as `value,value,` (trailing comma kept).
 * Only the quoting of the values with commas, quotes or line breaks changes.
 */
// redesign bi FA1 (BI-16, P8: the shape of the file is the one people may already import)
export const toCsv = (header, rows) => {
  let csv = `${rowsOf(header).map(csvCell).join(', ')}\n`
  rowsOf(rows).forEach((row) => {
    rowsOf(row).forEach((value) => { csv += `${csvCell(value)},` })
    csv += '\n'
  })
  return csv
}

/** Downloads `csv` as `fileName` the way `main` does: BOM + text as a data URL on a clicked link. */
export const downloadCsv = (fileName, csv) => {
  const link = document.createElement('a')
  link.download = fileName
  const blob = new Blob(['﻿', csv], { type: 'text/csv' })
  const reader = new FileReader()
  reader.readAsDataURL(blob)
  reader.onload = () => {
    link.href = reader.result
    link.click()
  }
}
