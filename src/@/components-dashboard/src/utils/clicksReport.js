import dayjs from 'dayjs'
import { normalizeTimezone } from './index'
import { toCsv } from './businessReports'

/**
 * Data of the clicks report of /intelligence/ecommerce_reports (the `tracking_events` endpoint).
 * Pure: the request string, the rows of each chart and the CSV. Same request as `main`
 * (`EcommerceAnalitycs`), which stays untouched.
 */

// redesign ecommerce FC (D6): the keys of `result.click` of the API, in the order of main (RealTime/index.js:86-128)
export const CLICK_TYPES = ['Business', 'Product', 'Category']

const day = (value) => dayjs(value).format('YYYY-MM-DD')

/**
 * Query string of the request, in the same order and format as `EcommerceAnalitycs.paramsForAPI`.
 * `from`/`to` arrive as YYYY-MM-DD and go as `<day> 00:00:00` / `<day> 23:59:59`, like `RealTime`.
 * `drivers` and `driver_groups_ids` are never sent: they are always null in `main` on this screen.
 */
// redesign ecommerce FC (D8): not buildReportParams (other keys: businesses, app_id, no *_ids)
export const buildClicksParams = (filters) => {
  let params = `timezone=${normalizeTimezone(filters?.timeZone)}`
  if (filters?.from) params = `${params}&from=${day(filters.from)} 00:00:00`
  if (filters?.to) params = `${params}&to=${day(filters.to)} 23:59:59`
  if (filters?.businessIds && filters.businessIds.length > 0) params = `${params}&businesses=${filters.businessIds.toString()}`
  if (filters?.app_id && filters.app_id !== 'all') params = `${params}&app_id=${filters.app_id}`
  if (filters?.franchises_id) params = `${params}&franchises_id=${JSON.stringify(filters.franchises_id)}`
  // the country of the stores (clicksFilters)
  if (filters?.country_code) params = `${params}&country_code=${encodeURIComponent(filters.country_code)}`
  return params
}

/**
 * What this report sends of the filters of the page. The stores picked for reports 1 to 3 do not travel
 * (the country only empties them), so `businessIds` is null. `countryCode` is the page's country: api-core filters
 * tracking_events by it.
 */
// redesign ecommerce FC (D5): stores of 1-3 do not reach clicks
export const clicksFilters = (filters, countryCode) => ({
  from: filters?.from,
  to: filters?.to,
  timeZone: filters?.timeZone,
  franchises_id: filters?.franchises_id,
  app_id: filters?.app_id,
  businessIds: null,
  ...(countryCode ? { country_code: countryCode } : {})
})

/**
 * (option B): no client records clicks on categories yet (the marketplace only sends Business and Product), so
 * their card, always empty, is left out until the answer brings some. `rows` is `{ [type]: clickRows(...) }`.
 */
export const shownClickTypes = (rows) => CLICK_TYPES.filter(type => type !== 'Category' || rows?.Category?.length > 0)

/**
 * Rows of one chart: a sorted copy of `data.click[type]` (total descending, ties keep the order they came in)
 * as `{ id, name, value }`. `data` is what the API returns: `{ click: { Business: [...] } }` or `[]`.
 */
export const clickRows = (data, type) => {
  const list = data?.click?.[type]
  if (!Array.isArray(list)) return []
  return list
    .map((item, index) => ({
      id: item?.object_id ?? index,
      name: item?.name,
      value: Number(item?.total) || 0
    }))
    .sort((a, b) => b.value - a.value)
}

export const clicksTotal = (rows) => (rows || []).reduce((sum, row) => sum + row.value, 0)

/** CSV of one type. The header of the first column is the literal of `main` (D7): it is not translated. */
export const clicksCsv = (type, rows, t) => (
  toCsv([`CLICKS OF ${type.toUpperCase()}`, t('CLICKS', 'Clicks')], (rows || []).map(row => [row.name, row.value]))
)

export const clicksFileName = (type, now = Date.now()) => `clicks_${type.toLowerCase()}_${now}.csv`
