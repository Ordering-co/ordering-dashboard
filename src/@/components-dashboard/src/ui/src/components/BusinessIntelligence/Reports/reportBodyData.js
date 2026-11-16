import { pivotLayout } from '../AnalyticsKit/pivotFormat'
import { fillSeries, parsePeriodLabel } from '../../../../../utils/reportPeriods'

// redesign reports FC2 (D6, D7, D11, D12; RP-04, RP-14; auditor 1, 13): what the bodies of the reports read from the data of the API. No React and no
// text: the page writes every word and every date (the translator and the formats of the project are the UI's). Each function takes the `data`
// the hook hands over (`result.data` / `result.data1`) and gives back plain data, so a body is a view of what these return.

/** `P/Chart` takes six colors at most (`--od-x-chart-1…6`): a seventh series is a table, never a color that does not exist (D12, P8). */
export const MAX_SERIES = 6

const list = value => (Array.isArray(value) ? value : [])

// redesign (row 6, intelligence-reports P8, D-32): which series ADD UP, so the smaller ones can be grouped in «Other» without lying.
// Counts and money do (orders, sales, new users: the sum of the rest is a real figure); averages, percentages, durations and ratios do not
// (the sum of two averages is nothing), so those stay a notice and the table. The bars say it by what their columns hold (`value_refers`);
// the line reports, by their id: 13 orders, 14 sales and 15 new users by channel are counts and money.
const ADDITIVE_REFERS = new Set(['quantity', 'money', 'count'])
const ADDITIVE_LINE_REPORTS = new Set([13, 14, 15])

/**
 * `series` ([{ id, label, data }]) cut to `limit` for a chart that only has that many colors: the `limit - 1` with the largest total (the sum of their
 * points; a tie keeps the order they came in) and one more, `otherLabel`, that adds up all the rest at each point (a gap only where every grouped
 * series has none). Nothing is lost: the sum of the chart is the sum of the series. Up to `limit` series come back as they are.
 */
export const groupSmallSeries = (series, otherLabel, limit = MAX_SERIES) => {
  if (series.length <= limit) return series
  const totalOf = item => list(item.data).reduce((sum, value) => sum + (toNumber(value) ?? 0), 0)
  const ranked = series.map((item, position) => ({ item, position, total: totalOf(item) })).sort((a, b) => b.total - a.total || a.position - b.position)
  const kept = ranked.slice(0, limit - 1).map(entry => entry.item)
  const rest = ranked.slice(limit - 1).map(entry => entry.item)
  const points = rest.reduce((most, item) => Math.max(most, list(item.data).length), 0)
  const data = Array.from({ length: points }, (_, index) => {
    const values = rest.map(item => toNumber(list(item.data)[index])).filter(value => value !== null)
    // eight decimals take away the noise of adding money in floating point (0.1 + 0.2)
    return values.length === 0 ? null : Number(values.reduce((sum, value) => sum + value, 0).toFixed(8))
  })
  return [...kept, { id: 'series-other', label: otherLabel, data }]
}

/** A number, or null when the value is not one (an empty cell, text). */
export const toNumber = (value) => {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

// ── tables ──────────────────────────────────────────────────────────────────────────────────────────────────────────
export const bodyRows = content => list(content?.body?.rows).filter(Array.isArray)

/** The table has rows to paint and to download. */
export const hasTableRows = content => bodyRows(content).length > 0

const spanOf = cell => Math.max(1, Number(cell?.colspan) || 1)

// the cells of a row with the column each one starts at (the colspan moves the next one)
const place = (row) => {
  let column = 0
  return list(row).map((cell) => {
    const placed = { cell, start: column, span: spanOf(cell) }
    column += placed.span
    return placed
  })
}

const cellAt = (placedRow, column) => placedRow.find(({ start }) => start === column)?.cell

// The columns that are series of the bar chart of main, by the `value_refers` of their cells (BI/ReportsBusinessDistance:57-92,
// BI/ReportsOrderDistance:54-89). Report 1 plots the average distance of each period; report 2 plots the percentage of each period (main
// chose them by the parity of the column, 2.D1: here it is the data that says which one they are).
const BAR_COLUMNS = { 1: 'average', 2: 'percentage' }

/**
 * What the bar chart of reports 1 and 2 draws, from the table: `labels` are the cells that name the row (the store, the distance range),
 * and each series is a column of figures: `{ id, group, values }` with `group` the text of the header of its period (the first header row
 * that holds it). A value that is not a number is null (the chart leaves a gap).
 * `additive`: the series add up (see `ADDITIVE_REFERS`); the averages of report 1 and the percentages of report 2 do not.
 * @returns {{ labels: *[], series: { id: string, group: *, values: (number|null)[] }[], additive: boolean }}
 */
export const barModel = (report, content) => {
  const refers = BAR_COLUMNS[report?.id]
  const rows = bodyRows(content).map(place)
  if (!refers || rows.length === 0) return { labels: [], series: [], additive: false }
  const labelColumn = pivotLayout(content).rowHeaderColumn
  const groups = place(list(content?.header?.rows)[0])
  const series = rows[0]
    .filter(({ cell }) => cell?.value_refers === refers)
    .map(({ start }) => ({
      id: `bar-${start}`,
      group: groups.find(item => start >= item.start && start < item.start + item.span)?.cell?.value,
      values: rows.map(row => toNumber(cellAt(row, start)?.value))
    }))
  return { labels: rows.map(row => cellAt(row, labelColumn)?.value), series, additive: ADDITIVE_REFERS.has(refers) }
}

// the decimals of the bars of reports 1 and 2 (`series` as `SeriesChart` takes them, `[{ data }]`). Two, as main's table,
// unless the tallest bar is so small that two would write every mark of the axis the same (averages of 0.00047 km gave «0.00 km» on
// each one): then one more than the first figure of that bar, at most 10. The peak is a fold, not `Math.max(...values)`, which throws on
// very long reports (review r1).
export const barDecimals = (series) => {
  const peak = series.reduce((top, item) => list(item?.data).reduce((most, value) => {
    const size = Math.abs(Number(value))
    return Number.isFinite(size) && size > most ? size : most
  }, top), 0)
  return peak > 0 ? Math.min(10, Math.max(2, Math.ceil(-Math.log10(peak)) + 1)) : 2
}

// the zeros past the second decimal say nothing («0.00010» is «0.0001»); the first two stay, as main writes km
export const trimDecimals = text => text.replace(/(\D\d{2}\d*?)0+$/, '$1')

/**
 * The table of a chart that has too many series: rows are the periods, columns the series. It has the shape of the API's tables, so
 * `PivotTable` paints it (the text of the periods and the names are already written by the caller).
 */
export const seriesTable = ({ xHeader, labels, series }) => ({
  header: { rows: [[{ value: xHeader, colspan: 1 }, ...series.map(item => ({ value: item.label, colspan: 1 }))]] },
  body: {
    rows: labels.map((text, index) => [
      { value: text, colspan: 1, value_unit: 'text', value_refers: 'name' },
      ...series.map(item => ({ value: item.data[index], colspan: 1, value_unit: 'number', value_refers: 'quantity' }))
    ])
  },
  footer: { rows: [] }
})

// ── line charts (13, 14, 15) ────────────────────────────────────────────────────────────────────────────────────────
// `dataset.dataset` has two shapes: reports 13 and 14 send `{ label, data: [{ x, y }] }`; report 15 sends a list of
// `{ label, data }` where `data` is a list or an object with numeric keys (`{ 1: { x, y } }`) (l4).
const pointsOf = data => (Array.isArray(data) ? data : Object.values(data && typeof data === 'object' ? data : {})).filter(point => point && point.x != null)

/**
 * The series of a line chart as the API sent them: `labels` are the groups of the period in the order they came (the list of the API
 * and then any point that is not in it), and each series is `{ id, label, unknown, points: [{ x, y }], values: { [label]: number } }`.
 * `unknown` marks the channel the API calls «unknow». `total` is the sum of the points of the first series (13, 14: what main added up).
 * `additive`: the series add up (orders, sales, new users; see `ADDITIVE_LINE_REPORTS`), so a chart with too many may group the small ones in «Other».
 * @returns {{ labels: string[], series: object[], total: number, empty: boolean, additive: boolean }}
 */
export const lineModel = (reportId, data) => {
  const dataset = data?.dataset?.dataset
  const raw = reportId === 15
    ? list(dataset).map(item => ({ label: item?.label, data: item?.data }))
    : [{ label: dataset?.label, data: dataset?.data }]
  const series = raw.map((item, index) => {
    const points = pointsOf(item.data)
    const values = {}
    points.forEach((point) => { values[point.x] = Number(point.y) || 0 })
    return {
      id: `series-${index}`,
      label: item.label,
      unknown: String(item.label ?? '').trim().toLowerCase() === 'unknow',
      points,
      values
    }
  })
  const labels = list(data?.dataset?.x?.labels).filter(label => label != null).map(String)
  series.forEach(item => item.points.forEach((point) => { if (!labels.includes(String(point.x))) labels.push(String(point.x)) }))
  const total = (series[0]?.points || []).reduce((sum, point) => sum + (Number(point.y) || 0), 0)
  return { labels, series, total, empty: series.every(item => item.points.length === 0), additive: ADDITIVE_LINE_REPORTS.has(reportId) }
}

/**
 * The axis of a line chart (D7): the labels of the groups of the range with a 0 where the API sent none (it sends no empty group, and a line would
 * join groups that are not next to each other), in the order of time. Labels that are not periods of the API stay as they came.
 * @returns {{ labels: string[], unit: string|null }}
 */
export const buildAxis = (labels, from, to) => {
  const unit = labels.map(parsePeriodLabel).find(Boolean)?.unit || null
  if (!unit) return { labels: [...labels], unit: null }
  const { points } = fillSeries(labels.map(label => ({ label, value: 0 })), from, to, unit)
  return { labels: points.map(point => point.label), unit }
}

// ── rankings and satisfaction ───────────────────────────────────────────────────────────────────────────────────────
/** The rows `{ x, y, info? }` of a ranking (12, 20): `dataset.dataset.data`. */
export const rankingRows = data => list(data?.dataset?.dataset?.data).filter(Boolean)

const SCORE_NAMES = { quality: 'quality', delivery: 'delivery', service: 'service', package: 'package', api_general: 'general', general: 'general' }

/**
 * The satisfaction of report 16: the rows of `dataset.dataset[0].data` (`{ x: 'Quality', y: '5.00' }`) and the scores the kit paints
 * (`Quality` → `quality` … `API_GENERAL` → `general`; the text «5.00» is a number). `hasScores`: some note is above 0 (the kit paints no row otherwise).
 * @returns {{ rows: object[], scores: Record<string, number>, hasScores: boolean }}
 */
export const satisfactionModel = (data) => {
  const rows = list(list(data?.dataset?.dataset)[0]?.data).filter(Boolean)
  const scores = {}
  rows.forEach((row) => {
    const key = SCORE_NAMES[String(row.x ?? '').trim().toLowerCase()]
    const score = toNumber(row.y)
    if (key && score !== null) scores[key] = score
  })
  return { rows, scores, hasScores: Object.values(scores).some(score => score > 0) }
}

/** The key of the category the API sends (`API_GENERAL` → `general`), or null when it is none of the five. */
export const satisfactionKey = category => SCORE_NAMES[String(category ?? '').trim().toLowerCase()] || null

// ── the schedule of the drivers (7) ─────────────────────────────────────────────────────────────────────────────────
// The API writes the times in the zone of the request (`timezone`): a text without offset is the clock of that zone. An instant (Z, +01:00) is
// converted to the clock of that zone, never to the one of the browser (inventory A 7.D4). Every time here is the «wall clock» as UTC
// milliseconds, so the arithmetic does not depend on the browser's zone or on its changes of hour.
const WALL = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/
const OFFSET = /(?:Z|[+-]\d{2}:?\d{2})$/i

const wallOfInstant = (instant, timeZone) => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || 'UTC',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).formatToParts(new Date(instant))
    const part = type => Number(parts.find(item => item.type === type)?.value)
    return Date.UTC(part('year'), part('month') - 1, part('day'), part('hour') % 24, part('minute'), part('second'))
  } catch (error) {
    // a zone the runtime does not know: the instant as it is
    return instant
  }
}

/** The clock of `timeZone` at the moment `text` says, as UTC milliseconds; null when `text` is not a time. */
export const wallMs = (text, timeZone) => {
  if (typeof text !== 'string') return null
  const value = text.trim()
  if (OFFSET.test(value) && WALL.test(value)) {
    const instant = Date.parse(value.replace(' ', 'T'))
    return Number.isFinite(instant) ? wallOfInstant(instant, timeZone) : null
  }
  const match = WALL.exec(value)
  if (!match) return null
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6] || 0))
}

const pad2 = number => String(number).padStart(2, '0')

/** 'YYYY-MM-DD HH:mm:ss' of a wall clock in milliseconds: what `parseDate` reads (with `utc: false`). It is data for `parseDate`, never what the eye reads. */
export const wallText = (ms) => {
  const date = new Date(ms)
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())} ${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(date.getUTCSeconds())}`
}

// The four datasets of main, in its order: the line of the API, and whether the range is the state itself or its complement.
const TIMELINE_SETS = [
  { key: 'REPORT_HEADER_AVAILABLE', on: true },
  { key: 'REPORT_HEADER_AVAILABLE', on: false },
  { key: 'REPORT_HEADER_BUSY', on: true },
  { key: 'REPORT_HEADER_BUSY', on: false }
]

/**
 * The shifts of report 7 as main draws them (BI/ReportsDriverSchedule:45-72): four datasets (Available, Not available, Busy, Not busy) of
 * floating bars `{ y: driver, x: [from, to] }`, the times in seconds from the start of the day (`data.from`). `base` is that start as a wall
 * clock; `sets[i]` the points of dataset i; `drivers` the names in order of appearance; `size` the number of points.
 * @returns {{ base: number|null, sets: { y: string, x: number[] }[][], drivers: string[], size: number, maxSeconds: number }}
 */
export const timelineModel = (data, timeZone) => {
  const base = wallMs(data?.from, timeZone)
  const sets = TIMELINE_SETS.map(() => [])
  const drivers = []
  if (base === null) return { base, sets, drivers, size: 0, maxSeconds: 0 }
  let maxSeconds = 0
  list(data?.data).forEach((entry) => {
    const name = entry?.metadata?.name
    if (!drivers.includes(name)) drivers.push(name)
    list(entry?.lines).forEach((line) => {
      list(line?.ranges).forEach((range) => {
        const index = TIMELINE_SETS.findIndex(set => set.key === line?.label_key && set.on === Boolean(range?.value))
        const from = wallMs(range?.from, timeZone)
        const to = wallMs(range?.to, timeZone)
        if (index === -1 || from === null || to === null) return
        const x = [(from - base) / 1000, (to - base) / 1000]
        maxSeconds = Math.max(maxSeconds, x[1])
        sets[index].push({ y: name, x })
      })
    })
  })
  return { base, sets, drivers, size: sets.reduce((sum, set) => sum + set.length, 0), maxSeconds }
}

// ── the image of a chart ────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Saves the image of the `<canvas>` inside `container` as `fileName` (D11: reports 1, 2 and 7 keep the PNG of main). Nothing when there is none.
 */
export const downloadCanvasImage = (container, fileName) => {
  const canvas = container?.querySelector?.('canvas')
  if (!canvas || typeof canvas.toDataURL !== 'function') return
  const link = document.createElement('a')
  link.href = canvas.toDataURL('image/png')
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
