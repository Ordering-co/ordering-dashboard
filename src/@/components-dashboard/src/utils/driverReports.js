import { daysBetween } from './businessReports'

// redesign drivers FB (D6, DR-03, DR-19, phase-1 audit): the pure derivations of the reports of /intelligence/drivers.
// The controller computes them once; the UI only paints them. None of them mutates its input.

const DAY = /^(\d{4}-\d{2}-\d{2})/

/** The `YYYY-MM-DD` a text starts with, or null. */
const dayOf = (value) => {
  const match = DAY.exec(String(value ?? ''))
  return match ? match[1] : null
}

/** The `x` of a chart point as `YYYY-MM-DD HH:mm:ss`: a point without seconds, or only a day, is completed. */
const timeOf = (x) => {
  const text = String(x ?? '')
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(text)) return `${text}:00`
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text} 00:00:00`
  return text
}

/** The exact text of a label (`at`, `time`) or null when there is none: it is never reduced to a day. */
const labelOf = (value) => {
  if (value === null || value === undefined) return null
  const text = String(value)
  return text === '' ? null : text
}

const byLabel = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

/**
 * Seconds of an average of the reports of times (a number or a numeric text), or null when there is none.
 * A negative average is null too (DR-19): a negative duration is never painted.
 */
export const secondsOf = (value) => {
  let seconds = null
  if (typeof value === 'number') seconds = value
  else if (typeof value === 'string' && value.trim() !== '') seconds = Number(value)
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null
}

/**
 * Every series of `driver_orders_v2` (`dataset.dataset` is an object `{ label, data: [{ x, y }] }`) or `driver_sales_v2` (an array of
 * those) as `[{ label, rows: [{ time, [valueKey] }] }]`, one entry per series. Anything else gives [].
 */
export const seriesOfChartReport = (result, valueKey) => {
  const dataset = result?.dataset?.dataset
  const list = Array.isArray(dataset) ? dataset : [dataset]
  return list
    .filter(series => series && typeof series === 'object')
    .map(series => ({
      label: series.label ?? '',
      rows: Array.isArray(series.data) ? series.data.map(point => ({ time: timeOf(point?.x), [valueKey]: Number(point?.y) })) : []
    }))
}

/**
 * Rows `{ time, [valueKey] }` of the FIRST series (as `main` does for the totals and the CSV). An array of rows is returned as it comes;
 * anything else gives [].
 */
export const rowsOfChartReport = (result, valueKey) => {
  if (Array.isArray(result)) return result
  return seriesOfChartReport(result, valueKey)[0]?.rows ?? []
}

/**
 * The range a chart report covers, from `result.dataset.x.from` / `.x.to` (their day part): `hour` when it is one day, `month` when it
 * spans more than 31 days (both ends counted, like `daysBetween`), `day` otherwise. Null when the response carries no readable range.
 */
export const periodOfChartReport = (result) => {
  const from = dayOf(result?.dataset?.x?.from)
  const to = dayOf(result?.dataset?.x?.to)
  if (!from || !to) return null
  let granularity = 'day'
  if (from === to) granularity = 'hour'
  else if (daysBetween(from, to) > 31) granularity = 'month'
  return { from, to, granularity }
}

/** `[{ at, time }]` as a map exact `at` -> seconds; the first entry of an `at` wins and an entry without `at` is skipped. */
const secondsByAt = (entries) => {
  const byAt = new Map()
  if (!Array.isArray(entries)) return byAt
  entries.forEach((entry) => {
    const at = labelOf(entry?.at)
    if (at !== null && !byAt.has(at)) byAt.set(at, secondsOf(entry?.time))
  })
  return byAt
}

/**
 * For `{ available: [{ at, time }], not_available: [...] }` and `{ busy, not_busy }`: one `{ at, first, second }` per `at` of either list,
 * joined by the exact `at` (an hour in Today/Yesterday, a day in 2-31 days, a month beyond) and ordered by it (DR-03).
 * An `at` that is only in one list carries null in the other.
 */
export const pairsByAt = (result, firstKey, secondKey) => {
  const first = secondsByAt(result?.[firstKey])
  const second = secondsByAt(result?.[secondKey])
  return [...new Set([...first.keys(), ...second.keys()])]
    .sort()
    .map(at => ({ at, first: first.get(at) ?? null, second: second.get(at) ?? null }))
}

/** Seconds with their sign (a number or a numeric text), or null when there is none: the charts draw a negative day as `main` did. */
const signedSecondsOf = (value) => {
  let seconds = null
  if (typeof value === 'number') seconds = value
  else if (typeof value === 'string' && value.trim() !== '') seconds = Number(value)
  return Number.isFinite(seconds) ? seconds : null
}

/**
 * The rows of `drivers_spend_times` as `{ at, accept, pickup, delivery, complete }` in seconds (null when missing), ordered by the exact
 * `time`. A negative value keeps its sign (auditor 6): the chart writes it with `formatDurationSigned`.
 */
export const spendSeries = (rows) => {
  if (!Array.isArray(rows)) return []
  return rows
    .map(row => ({
      at: labelOf(row?.time),
      accept: signedSecondsOf(row?.accept_spend),
      pickup: signedSecondsOf(row?.pickup_spend),
      delivery: signedSecondsOf(row?.delivery_spend),
      complete: signedSecondsOf(row?.complete_spend)
    }))
    .filter(item => item.at !== null)
    .sort((a, b) => byLabel(a.at, b.at))
}

const numberOrZero = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

/**
 * The rows of `drivers_top_orders` as `{ id, name, count, percent, duplicate }`, in the order of the API.
 * `duplicate` is true when another driver of the list has the same name (without the spaces at the sides).
 */
export const topDriverItems = (rows) => {
  if (!Array.isArray(rows)) return []
  const nameOf = (row) => String(row?.name ?? '').trim()
  const seen = new Map()
  rows.forEach((row) => {
    const name = nameOf(row)
    if (name) seen.set(name, (seen.get(name) || 0) + 1)
  })
  return rows.map(row => ({
    id: row?.id ?? row?.driver_id ?? null,
    name: String(row?.name ?? ''),
    count: numberOrZero(row?.orders_count),
    percent: numberOrZero(row?.orders_percentage),
    duplicate: seen.get(nameOf(row)) > 1
  }))
}
