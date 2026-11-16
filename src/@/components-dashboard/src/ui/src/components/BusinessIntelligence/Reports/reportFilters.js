import { defaultRange, parsePeriodLabel } from '../../../../../utils/reportPeriods'
import { shiftDay } from '../../../../../utils/dateRange'
import { normalizeTimezone } from '../../../../../utils'

// redesign reports FC1 (D4, D5; auditor 7): the rules of the filters the page of the 21 reports shares. Pure: nothing here reads the
// clock or the browser (the page passes `today` and the zone; only `filtersFromSearch` asks `Intl` whether a zone of the address exists), and no
// text is written here.

/**
 * The keys of the filters of the page that depend on a pill (the ones of the controller of `main`, AdvancedReports:27-40, without
 * `from`, `to` and `timeZone`). `driver_companies_ids` is one of them although no pill sets it (main never did): it always goes null.
 */
export const REPORT_FILTER_KEYS = ['businessIds', 'drivers_ids', 'franchises_id', 'driver_companies_ids', 'driver_groups_ids', 'delivery_types_ids', 'app_ids']

// pill → the key it writes (00-common.md); `period`, `day`, `zone` and `country` are not here: they are not ids
const PILL_KEY = {
  stores: 'businessIds',
  brand: 'franchises_id',
  driverGroup: 'driver_groups_ids',
  driver: 'drivers_ids',
  orderType: 'delivery_types_ids',
  channel: 'app_ids'
}

const hasPill = (report, pill) => Array.isArray(report?.pills) && report.pills.includes(pill)

/** The filters a page starts with: the last 7 days plus today (8 dates, as `main`), no filter and the zone of the browser. */
export const initialFilters = (today, timeZone) => ({
  ...defaultRange(today),
  businessIds: null,
  drivers_ids: null,
  franchises_id: null,
  driver_companies_ids: null,
  driver_groups_ids: null,
  delivery_types_ids: null,
  app_ids: null,
  timeZone
})

const orNull = (value) => (Array.isArray(value) ? (value.length > 0 ? value : null) : (value ?? null))

/**
 * What a report sends: the filters of the pills it has, and `null` for the rest (a value another report left on the page is not
 * this report's: D4). Report 7 asks for the one day of its own date picker (`scheduleDay`), whatever the range of the page is.
 */
export const effectiveFilters = (report, filters, scheduleDay) => {
  const sent = { from: filters.from, to: filters.to, timeZone: filters.timeZone }
  if (hasPill(report, 'day')) {
    sent.from = scheduleDay
    sent.to = scheduleDay
  }
  REPORT_FILTER_KEYS.forEach(key => { sent[key] = null })
  Object.entries(PILL_KEY).forEach(([pill, key]) => {
    if (hasPill(report, pill)) sent[key] = orNull(filters[key])
  })
  return sent
}

// A hidden value narrows nothing (D4): the one case is a report with a Stores pill and no Brand pill (21, 10), where the brand of the
// page would scope the list of stores through `franchises_id`.
const hidesBrand = (report) => hasPill(report, 'stores') && !hasPill(report, 'brand')

/** The filters the bar of the report is handed. */
export const barFilters = (report, filters) => (hidesBrand(report) ? { ...filters, franchises_id: null } : filters)

/** What the bar writes becomes the filters of the page; the brand the bar did not see stays the page's. */
export const mergeBarFilters = (report, current, next) => (hidesBrand(report) ? { ...next, franchises_id: current.franchises_id } : next)

/**
 * «Clear filters» of the page (D4): every filter key back to null, the ones of pills the report does not show too (the brand of a report
 * with no Brand pill, 21 and 10, is one of them), and the zone of the browser. `from` and `to` are not touched (the period has its own
 * control). The country is the page's own state and is set to '' next to this.
 */
// redesign reports R1 (Q-02)
export const clearedFilters = (current, timeZone) => ({
  ...current,
  ...Object.fromEntries(REPORT_FILTER_KEYS.map(key => [key, null])),
  timeZone
})

/** The country that narrows the lists of the bar: only where the report has the Country pill. */
export const barCountryCode = (report, countryCode) => (hasPill(report, 'country') ? countryCode : '')

/** `handleChangeCode` of `main` (AdvancedReports:42-45): the same code again takes the country away. */
export const nextCountryCode = (current, code) => (code === current ? '' : code)

// redesign (row 3, D-29): the period and the filters of a report travel in the address, to share a report as it is. The params
// are the ones of THAT report (the pills it has), written with `history.replace` by the page; the catalog carries none.
const PILL_PARAM = {
  stores: 'stores',
  brand: 'brands',
  driverGroup: 'groups',
  driver: 'drivers',
  orderType: 'types',
  channel: 'channels'
}

/** Every param of the address that is a filter, in the order they are written. */
export const REPORT_URL_PARAMS = ['from', 'to', 'day', 'stores', 'brands', 'groups', 'drivers', 'types', 'channels', 'country', 'zone']

const DAY_TEXT = /^\d{4}-\d{2}-\d{2}$/
// countries.code is free text and api-core takes up to 255 characters, so any code the pill can write is kept
const isCountryText = (value) => value.trim() !== '' && value.length <= 255
const ID_TEXT = /^[1-9]\d*$/

// a real day of the calendar: «2026-02-30» rolls over to another day when it is read, so it is not the same text written back
const realDay = (text) => (typeof text === 'string' && DAY_TEXT.test(text) && shiftDay(text, 0) === text ? text : null)

// a list of ids is valid whole or not at all: «1,a» is not «1»
const idsOf = (text) => {
  if (typeof text !== 'string' || text === '') return null
  const parts = text.split(',')
  if (!parts.every(part => ID_TEXT.test(part))) return null
  return Array.from(new Set(parts.map(Number)))
}

const realZone = (text) => {
  if (typeof text !== 'string' || text === '') return null
  try {
    new Intl.DateTimeFormat('en', { timeZone: text }) // eslint-disable-line no-new
    return text
  } catch (error) {
    return null
  }
}

/**
 * The params of the address for a report: its period (or the day of report 7), the ids of each pill it has (an empty list writes
 * nothing), the country where it has the Country pill, and the zone where it has the Zone pill and it is not the browser's.
 * Returns `{ param: text }`; the page writes them with `withFilterParams`.
 */
export const filtersToSearch = (report, filters, countryCode, scheduleDay, browserZone) => {
  const sent = effectiveFilters(report, filters, scheduleDay)
  const params = {}
  if (hasPill(report, 'day')) params.day = scheduleDay
  else {
    params.from = sent.from
    params.to = sent.to
  }
  Object.entries(PILL_PARAM).forEach(([pill, param]) => {
    const ids = sent[PILL_KEY[pill]]
    if (Array.isArray(ids) && ids.length > 0) params[param] = ids.join(',')
  })
  if (hasPill(report, 'country') && countryCode) params.country = countryCode
  const zone = normalizeTimezone(filters.timeZone)
  if (hasPill(report, 'zone') && zone && zone !== normalizeTimezone(browserZone)) params.zone = zone
  return params
}

/** The search of an address with the filter params of `params` and none of the old ones; the other params (`id`…) stay. '' or '?…'. */
export const withFilterParams = (search, params) => {
  const next = new URLSearchParams(search)
  REPORT_URL_PARAMS.forEach(key => next.delete(key))
  REPORT_URL_PARAMS.forEach(key => { if (params[key] !== undefined) next.set(key, params[key]) })
  const text = next.toString()
  return text ? `?${text}` : ''
}

/**
 * What a fresh load starts from: `initialFilters` with what the address says for `report` (the pills it has; no report, the catalog,
 * reads nothing). Each value is checked on its own and anything invalid keeps its default: dates `YYYY-MM-DD` that exist (a range needs both,
 * `from` not after `to`), ids whole positive numbers, a country that is not blank and has at most 255 characters, a zone the browser knows. Params it does not know are ignored.
 * Returns `{ filters, countryCode, scheduleDay }`.
 */
export const filtersFromSearch = (search, today, timeZone, report) => {
  const params = new URLSearchParams(search)
  const filters = initialFilters(today, timeZone)
  let countryCode = ''
  let scheduleDay = today
  if (!report) return { filters, countryCode, scheduleDay }

  if (hasPill(report, 'day')) {
    scheduleDay = realDay(params.get('day')) ?? today
  } else {
    const from = realDay(params.get('from'))
    const to = realDay(params.get('to'))
    if (from && to && from <= to) {
      filters.from = from
      filters.to = to
    }
  }
  Object.entries(PILL_PARAM).forEach(([pill, param]) => {
    if (!hasPill(report, pill)) return
    const ids = idsOf(params.get(param))
    if (ids) filters[PILL_KEY[pill]] = ids
  })
  if (hasPill(report, 'country') && isCountryText(params.get('country') ?? '')) countryCode = params.get('country').toUpperCase()
  const zone = hasPill(report, 'zone') ? realZone(params.get('zone')) : null
  if (zone) filters.timeZone = zone
  return { filters, countryCode, scheduleDay }
}

const NODE_LIMIT = 4000

/**
 * The unit (`hour`, `day`, `week`, `month`, `year`) of the first label of a period (`Week 2026-39`…) found anywhere in an answer of the
 * API, or null: how the API grouped it. It looks at a bounded number of nodes, so a long answer costs nothing.
 */
export const findPeriodUnit = (answer) => {
  const queue = [answer]
  let seen = 0
  for (let index = 0; index < queue.length && seen < NODE_LIMIT; index += 1) {
    const node = queue[index]
    seen += 1
    if (typeof node === 'string') {
      const period = parsePeriodLabel(node)
      if (period) return period.unit
    } else if (node && typeof node === 'object') {
      Object.values(node).forEach(child => queue.push(child))
    }
  }
  return null
}
