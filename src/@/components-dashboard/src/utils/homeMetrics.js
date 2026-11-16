/**
 * Pure helpers of the Home page figures (`/home`): day windows, sums, series, the three
 * `/orders` counts of «Needs attention» and the setup guide steps.
 *
 * Nothing here reads the clock, the network or React: callers pass `now`.
 * Measured behaviour of the reports API (redesign/pages/home/analysis.md section 6):
 * a one-day range answers by hour, up to 31 days by day, more than 31 days by month,
 * so the 30-day window and the 30 before it are two separate requests.
 */
import { ORDER_STATUS_FAMILIES } from '../ui/src/utils/orderStatusFamily'
import { buildCartsPath, buildCartsWhere } from './openCarts'
import { bucketSeries } from './businessReports'

const pad = (value) => String(value).padStart(2, '0')

/** Date -> 'YYYY-MM-DD' in the browser's local time. */
const toLocalDay = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/** 'YYYY-MM-DD' -> local Date at midnight (no UTC parsing, so no day shift). */
const fromLocalDay = (day) => {
  const [year, month, date] = String(day).slice(0, 10).split('-').map(Number)
  return new Date(year, month - 1, date)
}

const shiftDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)

// redesign home FB (D5, HM-11: every window is the administrator's local day)
export const getHomeDays = (now = new Date()) => {
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return {
    today: toLocalDay(base),
    lastWeekDay: toLocalDay(shiftDays(base, -7)),
    // redesign home FB (auditor 8: 30 closed days up to yesterday against the 30 before)
    trendFrom: toLocalDay(shiftDays(base, -30)),
    trendTo: toLocalDay(shiftDays(base, -1)),
    previousFrom: toLocalDay(shiftDays(base, -60)),
    previousTo: toLocalDay(shiftDays(base, -31)),
    monthStart: toLocalDay(new Date(base.getFullYear(), base.getMonth(), 1)),
    hour: now.getHours()
  }
}

const rowsOf = (rows) => (Array.isArray(rows) ? rows : [])

export const sumRows = (rows, key) => rowsOf(rows).reduce((total, row) => total + (Number(row?.[key]) || 0), 0)

/** The `HH` of a 'YYYY-MM-DD HH:mm:ss' text, read from the text itself (no Date), or null. */
const hourOfRow = (row) => {
  const match = /^\d{4}-\d{2}-\d{2}[ T](\d{2})/.exec(String(row?.time ?? ''))
  return match ? Number(match[1]) : null
}

// redesign home FB (D2: «last Thursday at this hour»; approximate to the hour, the buckets can be one hour off)
export const sumUntilHour = (rows, key, hour) => rowsOf(rows).reduce((total, row) => {
  const rowHour = hourOfRow(row)
  if (rowHour === null || rowHour > hour) return total
  return total + (Number(row?.[key]) || 0)
}, 0)

// redesign home FB (HM-01: one element per requested day; a day with no row is 0 only inside the requested range)
export const dailySeries = (rows, from, to, key) => {
  // redesign bi FA1 (BI-22: the same count as Business Intelligence; the API stamps the last hour of day `to` on `to` + 1, which `bucketSeries` adds to `to`)
  // HM-01 stays: a row before `from` or after `to` + 1 is not part of the requested range, so it is not drawn
  const lastRowDay = toLocalDay(shiftDays(fromLocalDay(to), 1))
  const inRange = rowsOf(rows).filter((row) => {
    const day = String(row?.time ?? '').slice(0, 10)
    return day >= from && day <= lastRowDay
  })
  return bucketSeries(inRange, key, { from, to, granularity: 'day' }).map(({ bucket, value }) => ({ day: bucket, value }))
}

// redesign home FB (D2: the cancelled family of the order statuses)
export const countCancelled = (statusRows) => rowsOf(statusRows).reduce((total, row) => (
  ORDER_STATUS_FAMILIES.cancel.includes(Number(row?.status)) ? total + (Number(row?.orders) || 0) : total
), 0)

// redesign home FB (HM-16): sales and orders share a base: both with the cancelled orders, or both without them
export const averageTicket = (sales, orders) => (Number(orders) > 0 ? Number(sales) / Number(orders) : null)

export const percentChange = (current, previous) => (
  Number(previous) > 0 ? ((Number(current) - Number(previous)) / Number(previous)) * 100 : null
)

// redesign home FB (D4, auditor 3)
// `googleNotShown` is not counted by the Home's requests: its count is the project's Google status (`skipped`)
export const HOME_ATTENTION_KEYS = ['pending', 'late', 'waitingDriver', 'failedCarts', 'googleNotShown']

// Same block the Orders tab without an order type filter sends (DashboardOrdersList/index.js:206-232), so the count matches the tab
const hasItemsBlock = () => ({
  conector: 'OR',
  conditions: [
    { attribute: 'has_items', value: { condition: '=', value: true } },
    { attribute: 'cloned_order_id', value: { condition: '!=', value: null } },
    { attribute: 'delivery_type', value: { condition: '=', value: 9 } }
  ]
})

const OPEN_STATUSES = [
  ...ORDER_STATUS_FAMILIES.pending,
  ...ORDER_STATUS_FAMILIES.progress,
  ...ORDER_STATUS_FAMILIES.review
]
const WAITING_DRIVER_STATUSES = [7, 4, 14, 22]

// redesign home FB (D4, auditor 3: each count carries its own scope and the has_items block)
export const buildAttentionWhere = (key) => {
  let conditions
  if (key === 'pending') {
    conditions = [{ attribute: 'status', value: [0, 13] }]
  } else if (key === 'late') {
    conditions = [
      { attribute: 'status', value: OPEN_STATUSES },
      { attribute: 'time_status', value: 'delayed' }
    ]
  } else if (key === 'waitingDriver') {
    conditions = [
      { attribute: 'status', value: WAITING_DRIVER_STATUSES },
      { attribute: 'delivery_type', value: { condition: '=', value: 1 } },
      { attribute: 'driver_id', value: { condition: '=', value: null } },
      { attribute: 'driver_company_id', value: { condition: '=', value: null } }
    ]
  } else {
    return null
  }
  return { conditions: [hasItemsBlock(), ...conditions], conector: 'AND' }
}

/** The path of the cart count (page_size 1, read `pagination.total`). */
export const buildFailedCartsPath = () => buildCartsPath({
  page: 1,
  pageSize: 1,
  where: buildCartsWhere({ view: 'paymentFailed' })
})

// redesign home FB (D4: where each row of «Needs attention» leads)
export const HOME_ATTENTION_PATHS = {
  pending: '/orders?status=pending',
  // (D-22): the page opens already filtered: «Late» on (?late=1) and «Unassigned» on (?unassigned=1). They are seeds that
  // the page reads once and removes from the address bar (ordersUrlSearch.js › getOrdersUrlFilterPatch)
  late: '/orders?status=inProgress&late=1',
  // redesign home R1 (Q-05): the Deliveries tab reads ?status=; without it the row opened Pending, which the count excludes
  waitingDriver: '/deliveries?status=inProgress&unassigned=1',
  failedCarts: '/cart-recovery/open-carts?view=paymentFailed',
  // Connect › Order with Google opens filtered on the stores Google is not showing (?state= is read once)
  googleNotShown: '/connect/order-with-google?state=skipped'
}

const hasAnyEnabled = (paymethodsByBusiness) => {
  const lists = Array.isArray(paymethodsByBusiness)
    ? paymethodsByBusiness
    : Object.values(paymethodsByBusiness || {})
  return lists.some(list => rowsOf(list).some(paymethod => paymethod?.enabled === true))
}

// redesign home FB (D9, auditor 10: required steps count; drivers and own domain are optional and only for level 0)
export const evaluateSetupGuide = ({ level, businesses, paymethodsByBusiness, driversTotal, sites } = {}) => {
  const stores = rowsOf(businesses)
  const steps = [
    { id: 'store', done: stores.length > 0, optional: false },
    { id: 'menu', done: stores.some(store => Number(store?.menus_count) > 0), optional: false },
    { id: 'zone', done: stores.some(store => Array.isArray(store?.zones) && store.zones.length > 0), optional: false },
    { id: 'payment', done: hasAnyEnabled(paymethodsByBusiness), optional: false },
    // The guide is only drawn on projects without orders, so the first order is never done here
    { id: 'first_order', done: false, optional: false }
  ]
  if (Number(level) === 0) {
    steps.push(
      { id: 'drivers', done: Number(driversTotal) > 0, optional: true },
      { id: 'domain', done: rowsOf(sites).some(site => site?.domain && site?.ssl_process_status === 'ended'), optional: true }
    )
  }
  const required = steps.filter(step => !step.optional)
  return {
    steps,
    doneCount: required.filter(step => step.done).length,
    requiredCount: required.length
  }
}
