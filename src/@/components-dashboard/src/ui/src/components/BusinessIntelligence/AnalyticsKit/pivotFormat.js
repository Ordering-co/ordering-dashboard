import { parsePeriodLabel } from '../../../../../utils/reportPeriods'
import { orderStatusLabel } from './reportFormat'

// redesign reports FB1 (D6, D8; RP-03, RP-05, RP-13, RP-16; auditor 2, 9, 10): what the cells and the headers of the report tables say.
// No state and no React. The host gives the formatters (`fmt = { t, parsePrice, parseNumber, parseDate }`, the ones of useLanguage and
// useUtils); nothing here writes a date, a currency or a decimal separator of its own. Every call to the translator is literal, with
// its key and its default text, because the i18n scanner only sees literals (RP-03: asking it for the API's own value with no
// default text paints `DASHBOARD_…`).

const DASH = '—'
const MINUS = '−' // U+2212, the sign of a negative duration

const EMPTY = Object.freeze({ text: DASH, figure: false, empty: true })

const own = (object, key) => Boolean(object) && Object.prototype.hasOwnProperty.call(object, key)

// ── durations ──────────────────────────────────────────────────────────────────────────────────────────────────────
const SECONDS_IN = { day: 86400, hour: 3600, minute: 60 }

/**
 * A duration in seconds as text with a sign and days (redesign reports FB1, D8, auditor 9, 10): 157581 → «1 d 19 h»,
 * −4439 → «−1 h 13 min», 432 → «7 min 12 s», 0 → «0 s». It truncates like `formatDuration` of reportFormat.js (the first unit that is
 * not zero and the one after it; a unit that is zero is left out). No duration (`null`, `''`, NaN, text) is `null`; the caller
 * decides what to paint. It returns text: the consumer puts it in a `.odc-figure`.
 * @param {(key: string, fallback: string) => string} t from useLanguage()
 * @param {number|string|null} seconds
 */
export const formatDurationSigned = (t, seconds) => {
  const isNumber = typeof seconds === 'number'
  const isText = typeof seconds === 'string' && seconds.trim() !== ''
  if (!isNumber && !isText) return null
  const value = Math.round(Number(isText ? seconds.trim() : seconds))
  if (!Number.isFinite(value)) return null
  const total = Math.abs(value)
  const days = Math.floor(total / SECONDS_IN.day)
  const hours = Math.floor((total % SECONDS_IN.day) / SECONDS_IN.hour)
  const minutes = Math.floor((total % SECONDS_IN.hour) / SECONDS_IN.minute)
  const secs = total % SECONDS_IN.minute
  // abbreviations, so there is no plural: one key each, with the number as a placeholder
  const units = [
    { amount: days, text: () => t('ENTERPRISE_REPORT_DURATION_DAYS', '_n_ d') },
    { amount: hours, text: () => t('BUSINESS_REPORTS_DURATION_HOURS', '_n_ h') },
    { amount: minutes, text: () => t('BUSINESS_REPORTS_DURATION_MINUTES', '_n_ min') },
    { amount: secs, text: () => t('BUSINESS_REPORTS_DURATION_SECONDS', '_n_ s') }
  ]
  const first = units.findIndex(unit => unit.amount > 0)
  if (first === -1) return units[3].text().replace('_n_', () => '0')
  const text = units
    .slice(first, first + 2)
    .filter(unit => unit.amount > 0)
    .map(unit => unit.text().replace('_n_', () => String(unit.amount)))
    .join(' ')
  return value < 0 ? `${MINUS}${text}` : text
}

// ── text of the cells ──────────────────────────────────────────────────────────────────────────────────────────────
// The statuses the API sends in a text cell (report 21).
// redesign `CANCELLED` is a shared key that other screens fill with «cancelled» (lower case), which read badly next to «Completed»;
// BI has a key of its own so the report writes both in sentence case.
const STATUS_TEXTS = {
  COMPLETED: t => t('COMPLETED', 'Completed'),
  CANCELLED: t => t('ENTERPRISE_REPORT_STATUS_CANCELLED', 'Cancelled')
}

const RANGE = /^Between\s+(-?\d+(?:\.\d+)?)\s+to\s+(-?\d+(?:\.\d+)?)$/
// redesign the last range of report 2 comes open, «More than 5», in km and without a unit
const OPEN_RANGE = /^More than\s+(-?\d+(?:\.\d+)?)$/

// redesign (row 4, intelligence-reports P4, D-30): the distances of the reports are written in the unit of the project. The API sends
// kilometres (report 1, the ranges of report 2) or metres (report 10); only «MI» changes them. Same rule and same factor as `parseDistance` (UtilsContext).
const MILES_PER_KM = 0.621371

/** 'MI' or 'KM', as `parseDistance` decides it: a `distance_unit` value wins (`distance_unit_km` '1' is the default km), anything but «MI» (any case) is km. */
export const distanceUnitOf = configs => {
  const unit = configs?.distance_unit?.value
  return unit && String(unit).toUpperCase() === 'MI' ? 'MI' : 'KM'
}

/** Kilometres in `unit` ('MI' converts, anything else is km); a missing value stays missing. */
export const kmToUnit = (km, unit) => (unit === 'MI' && km !== null && km !== undefined ? km * MILES_PER_KM : km)

// «1.5» in the number format of the project when the host gives `parseNumber`; whole numbers and a host without it keep the token
const rangeEnd = (token, parseNumber) => {
  const decimals = token.includes('.') ? token.split('.')[1].length : 0
  return parseNumber && decimals > 0 ? parseNumber(token, { decimal: decimals }) : token
}

// the end of a range in miles: two decimals at most, the zeros that say nothing left out («1.00» is «1»)
const rangeEndMiles = (token, parseNumber) => {
  const miles = Math.round(Number(token) * MILES_PER_KM * 100) / 100
  const text = miles.toFixed(2).replace(/\.?0+$/, '')
  const decimals = text.includes('.') ? text.split('.')[1].length : 0
  return parseNumber && decimals > 0 ? parseNumber(miles, { decimal: decimals }) : text
}

/**
 * The text of a text cell that comes from the API with a value we know (redesign reports FB1, D8, auditor 2):
 * `COMPLETED` / `CANCELLED` by their keys, «Between A to B» as «A–B km», «More than A» as «More than A km» (or mi) and «Others». Anything else comes as it arrives.
 * @param {*} value
 * @param {(key: string, fallback: string) => string} t from useLanguage()
 * @param {(value: *, options?: object) => string} [parseNumber] from useUtils(): writes the decimals of a range with the project format
 * @param {string} [distanceUnit] 'MI' writes the ranges (kilometres in the API) as «A–B mi» and «More than A mi»; anything else keeps km
 */
export const cellText = (value, t, parseNumber, distanceUnit) => {
  const text = value === null || value === undefined ? '' : String(value)
  if (own(STATUS_TEXTS, text)) return STATUS_TEXTS[text](t)
  const range = RANGE.exec(text)
  if (range && distanceUnit === 'MI') return `${rangeEndMiles(range[1], parseNumber)}–${rangeEndMiles(range[2], parseNumber)} ${t('MI', 'mi')}`
  if (range) {
    return t('ENTERPRISE_REPORT_DISTANCE_RANGE', '_from_–_to_ km')
      .replace('_from_', () => rangeEnd(range[1], parseNumber))
      .replace('_to_', () => rangeEnd(range[2], parseNumber))
  }
  const open = OPEN_RANGE.exec(text)
  if (open && distanceUnit === 'MI') return t('ENTERPRISE_REPORT_DISTANCE_MORE_THAN_MI', 'More than _n_ mi').replace('_n_', () => rangeEndMiles(open[1], parseNumber))
  if (open) return t('ENTERPRISE_REPORT_DISTANCE_MORE_THAN_KM', 'More than _n_ km').replace('_n_', () => rangeEnd(open[1], parseNumber))
  if (text === 'Others') return t('ENTERPRISE_REPORT_OTHERS', 'Others')
  return text
}

// ── cells ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const NUMERIC_UNITS = new Set(['number', 'quantity', 'km', 'currency', 'seconds', 'meter', 'count'])

// The value as a number, or NaN when the cell is not a number. A cell typed `text` never is; a text is a number only under a numeric unit.
const numberOf = (value, unit) => {
  if (unit === 'text') return NaN
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN
  if (typeof value === 'string' && NUMERIC_UNITS.has(unit)) return Number(value.trim())
  return NaN
}

const textCell = (text, fmt) => ({ text: cellText(text, fmt.t, fmt.parseNumber, fmt.distanceUnit), figure: false, empty: false })

/**
 * The text of one cell `{ value, value_unit, value_refers }` of a report table (redesign reports FB1, D8). The order decides:
 * empty → the rule of the column of the registry (`report.columns[value_refers]`: `count`, `km2`, `meterToKm`) → `value_unit`
 * (`currency`, `seconds`, `meter`) → `value_refers` (`percentage`, `average`, `id`) → numbers → text.
 * `figure` is true for everything numeric (the consumer paints it in an isolated `.odc-figure`); `empty` for the dash.
 * @param {object} cell
 * @param {{ report?: { columns?: Record<string, string> }, fmt: { t: Function, parsePrice: Function, parseNumber: Function, distanceUnit?: 'KM'|'MI' } }} options
 * @returns {{ text: string, figure: boolean, empty: boolean }}
 */
export const formatCell = (cell, { report, fmt } = {}) => {
  const host = {
    t: fmt?.t || ((key, text) => text),
    parsePrice: fmt?.parsePrice || (value => String(value)),
    parseNumber: fmt?.parseNumber || (value => String(value)),
    distanceUnit: fmt?.distanceUnit === 'MI' ? 'MI' : 'KM'
  }
  const value = cell?.value
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) return EMPTY

  const unit = cell.value_unit
  const refers = cell.value_refers
  const number = numberOf(value, unit)
  // a text, or a number that did not read: the text as it is (known values translated)
  if (Number.isNaN(number)) return textCell(value, host)

  const figure = text => ({ text, figure: true, empty: false })
  const plain = () => figure(Number.isInteger(number) ? String(number) : host.parseNumber(number))
  // a distance in km with two decimals; in a miles project it is converted and carries its unit (a km cell has none, as before)
  const distance = (km) => {
    const text = host.parseNumber(kmToUnit(km, host.distanceUnit), { decimal: 2 })
    return figure(host.distanceUnit === 'MI' ? `${text} ${host.t('MI', 'mi')}` : text)
  }

  // 1. the rule of the column of the registry, keyed by value_refers (A1)
  const rule = own(report?.columns, refers) ? report.columns[refers] : undefined
  if (rule === 'count') return plain()
  if (rule === 'km2') return distance(number)
  if (rule === 'meterToKm') return distance(number / 1000)

  // 2. value_unit
  if (unit === 'currency') return figure(host.parsePrice(value))
  if (unit === 'seconds') return figure(formatDurationSigned(host.t, number))
  if (unit === 'meter') return distance(number / 1000)

  // 3. value_refers
  if (refers === 'percentage') return figure(`${Number.isInteger(number) ? number : host.parseNumber(number)}%`)
  if (refers === 'average') return figure(host.parseNumber(number))
  if (refers === 'id') return figure(String(value))

  // 4. numbers: the whole number as it is, the decimals through the project format
  return plain()
}

// ── headers ────────────────────────────────────────────────────────────────────────────────────────────────────────
const SPEND_SPAN = /^API_REPORT_HEADER_SPEND_(\d+)_TO_(\d+)$/

// (3) the keys the API sends instead of a text. They pass to keys of their own (D8); the average ticket keeps the one of Business.
const KNOWN_HEADERS = {
  API_REPORT_HEADER_ORDERS_PARTICIPATION: t => t('ENTERPRISE_REPORT_HEADER_ORDERS_SHARE', 'Share of orders'),
  API_REPORT_HEADER_SALES_PARTICIPATION: t => t('ENTERPRISE_REPORT_HEADER_SALES_SHARE', 'Share of sales'),
  API_REPORT_HEADER_REJECTED: t => t('ENTERPRISE_REPORT_HEADER_REJECTED', 'Rejected'),
  API_REPORT_HEADER_REJECTED_PERCENTAGE: t => t('ENTERPRISE_REPORT_HEADER_REJECTED_PERCENTAGE', 'Rejected (%)'),
  API_REPORT_HEADER_AVERAGE_TICKET: t => t('BUSINESS_REPORTS_AVERAGE_TICKET', 'Average ticket'),
  API_REPORT_HEADER_TOTAL_VS_IDEAL: t => t('ENTERPRISE_REPORT_HEADER_TOTAL_VS_IDEAL', 'Total vs ideal'),
  API_REPORT_HEADER_RANK: t => t('ENTERPRISE_REPORT_HEADER_RANK', 'Rank'),
  API_REPORT_HEADER_IN_TIME: t => t('ENTERPRISE_REPORT_HEADER_ON_TIME', 'On time'),
  API_REPORT_HEADER_AT_RISK: t => t('ENTERPRISE_REPORT_HEADER_AT_RISK', 'At risk'),
  API_REPORT_HEADER_DELAYED: t => t('ENTERPRISE_REPORT_HEADER_DELAYED', 'Delayed'),
  API_GENERAL: t => t('ENTERPRISE_REPORT_HEADER_GENERAL', 'General')
}

// (4) the markers the API sends where a column name goes (lower case: the match ignores case)
const MARKER_HEADERS = {
  'report header sites': t => t('SITE', 'Site'),
  'report header order types': t => t('ORDER_TYPE', 'Order type'),
  'report header payment method': t => t('PAYMENT_METHOD', 'Payment method'),
  'report header driver times': t => t('DRIVER', 'Driver'),
  'report header status': t => t('STATUS', 'Status'),
  'report header date/time': t => t('DATE', 'Date'),
  'report header users': t => t('USERS', 'Users'),
  'report header category': t => t('CATEGORY', 'Category'),
  'report header qualification': t => t('ENTERPRISE_REPORT_HEADER_SCORE', 'Score'),
  'report header quantity': t => t('QUANTITY', 'Quantity'),
  'report header products': t => t('PRODUCT', 'Product')
}

// (5) the English texts the API sends, by the key that already exists with that text; the two without a key have one of their own
const ENGLISH_HEADERS = {
  orders: t => t('ORDERS', 'Orders'),
  sales: t => t('SALES', 'Sales'),
  name: t => t('NAME', 'Name'),
  id: t => t('ID', 'ID'),
  distance: t => t('DISTANCE', 'Distance'),
  percentage: t => t('PERCENTAGE', 'Percentage'),
  business: t => t('BUSINESS', 'Business'),
  businesses: t => t('BUSINESSES', 'Businesses'),
  drivers: t => t('DRIVERS', 'Drivers'),
  franchises: t => t('WEB_FRANCHISES_X', 'Franchises'),
  'last name': t => t('LAST_NAME', 'Last name'),
  total: t => t('TOTAL', 'Total'),
  'driver company': t => t('DRIVER_COMPANY', 'Driver company'),
  'driver companies': t => t('DRIVER_COMPANIES', 'Driver companies'),
  'average distance': t => t('ENTERPRISE_REPORT_HEADER_AVERAGE_DISTANCE', 'Average distance'),
  'time between business acceptance and delivery completion': t => t('ENTERPRISE_REPORT_HEADER_ACCEPTANCE_TO_DELIVERY', 'Time between business acceptance and delivery completion')
}

/**
 * The text of a header cell of a report table (redesign reports FB1, D8; RP-03, RP-05; auditor 2, 9). In this order:
 * (1) a period label → `periodText(period, label)`, which the UI writes with the project's dates; (2) `API_REPORT_HEADER_SPEND_a_TO_b` →
 * the names of the two statuses, «a → b», without saying whether it is an average or a sum (P5); (3) the known `API_REPORT_HEADER_*`
 * keys; (4) the markers («Report header sites» → «Site»); (5) the English texts of the API that have a key; (6) anything else as it
 * arrives. It never asks `t` for a key without its default text.
 * @param {*} value
 * @param {{ t: Function, statusLabel?: (status: number) => string, periodText?: (period: object, label: string) => string }} options
 */
export const headerText = (value, { t, statusLabel, periodText } = {}) => {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (text.trim() === '') return ''
  const key = text.trim()

  const period = parsePeriodLabel(key)
  if (period) return periodText ? periodText(period, text) : text

  const span = SPEND_SPAN.exec(key)
  if (span) {
    const name = statusLabel || (status => orderStatusLabel(t, status))
    return t('ENTERPRISE_REPORT_STATUS_SPAN', '_from_ → _to_')
      .replace('_from_', () => name(Number(span[1])))
      .replace('_to_', () => name(Number(span[2])))
  }

  if (own(KNOWN_HEADERS, key)) return KNOWN_HEADERS[key](t)
  const lower = key.toLowerCase()
  if (own(MARKER_HEADERS, lower)) return MARKER_HEADERS[lower](t)
  if (own(ENGLISH_HEADERS, lower)) return ENGLISH_HEADERS[lower](t)
  return text
}

// ── layout of the table ────────────────────────────────────────────────────────────────────────────────────────────
// The cells that say what the row is (D9, auditor 5): they stay in place while the table scrolls sideways.
const IDENTITY_REFERS = new Set(['id', 'business', 'franchise', 'driver', 'driver_company', 'name', 'site', 'order_type', 'status'])

const spanOf = cell => Math.max(1, Number(cell?.colspan) || 1)
const rowsOf = section => (Array.isArray(section?.rows) ? section.rows : [])

/**
 * Where the pinned columns, the row header and the separators of a report table are (redesign reports FB1, D6, D9; auditor 5).
 * `fixedCount`: the columns that identify the row, the leading cells of the first row of the body with a `value_refers` of the list
 * (id, business, franchise, driver, driver_company, name, site, order_type, status), or the first column when there is none.
 * `rowHeaderColumn`: the column of the cell that names the row (the first of them that is not an id). `groupStarts`: the columns, after the
 * pinned ones, where a cell of the first header row starts (the groups of periods). `columnCount`: the widest row.
 * @returns {{ columnCount: number, fixedCount: number, rowHeaderColumn: number, groupStarts: number[] }}
 */
export const pivotLayout = (content) => {
  const header = rowsOf(content?.header)
  const body = rowsOf(content?.body)
  const footer = rowsOf(content?.footer)

  const columnCount = Math.max(
    1,
    ...[...header, ...body, ...footer].map(row => (Array.isArray(row) ? row.reduce((sum, cell) => sum + spanOf(cell), 0) : 0))
  )

  const first = Array.isArray(body[0]) ? body[0] : []
  let fixedCount = 0
  let rowHeaderColumn = null
  for (const cell of first) {
    if (!IDENTITY_REFERS.has(cell?.value_refers)) break
    if (rowHeaderColumn === null && cell.value_refers !== 'id') rowHeaderColumn = fixedCount
    fixedCount += spanOf(cell)
  }
  if (fixedCount === 0) fixedCount = first.length > 0 ? spanOf(first[0]) : 1

  const groupStarts = []
  let column = 0
  for (const cell of Array.isArray(header[0]) ? header[0] : []) {
    if (column >= fixedCount) groupStarts.push(column)
    column += spanOf(cell)
  }

  return { columnCount, fixedCount, rowHeaderColumn: rowHeaderColumn ?? 0, groupStarts }
}
