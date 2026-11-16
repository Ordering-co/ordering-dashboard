import moment from 'moment'

/**
 * Pure helpers shared by the orders table: the SLA timer (`getDelayMinutes`)
 * and the ETA column both start from the same reference instant,
 * `delivery_datetime_utc` (or `delivery_datetime` shifted by the legacy CDT
 * offset) plus `eta_time` minutes.
 */

// Legacy offset the SLA timer has always applied to `delivery_datetime`
// (no UTC variant on the order) to bring it to UTC.
const CDT_TO_UTC_OFFSET_MINUTES = 300

// redesign W0-4a (T0-13, decision 13): this is data (the SLA timer and the ETA are computed from it), not
// something painted. parseDate without outputFormat now follows dates_general_format, which is for people and
// may be '03/04/2026 3:30 pm'; moment cannot read that back. So every caller of the helpers below (the table, the
// cards and the detail) gets the machine format unless it passes its own options.
const ETA_PARSE_OPTIONS = { outputFormat: 'YYYY-MM-DD HH:mm:ss' }
export const MACHINE_PARSE_OPTIONS = ETA_PARSE_OPTIONS

// redesign tramo A r2 (W0-PA1-04)
// The SLA timer and the delay (OrdersTable, OrdersCards, DetailsTab) read the delivery at the minute, as main did
// (parseDate without outputFormat gave 'YYYY-MM-DD HH:mm', which cuts the seconds). With seconds, a delivery at 15:30:45 seen
// at 15:30:10 read «00:01» where main read «00:00». The ETA column keeps MACHINE_PARSE_OPTIONS: it only paints hh:mm.
export const SLA_PARSE_OPTIONS = { outputFormat: 'YYYY-MM-DD HH:mm' }

/**
 * Delivery reference (local time string produced by `parseDate`) of an order.
 */
export const getOrderDeliveryReference = (order, parseDate, parseOptions = MACHINE_PARSE_OPTIONS) => {
  const cdtToutc = moment(order?.delivery_datetime)
    .add(CDT_TO_UTC_OFFSET_MINUTES, 'minutes')
    .format('YYYY-MM-DD HH:mm:ss')
  return order?.delivery_datetime_utc
    ? parseDate(order?.delivery_datetime_utc, parseOptions)
    : parseDate(cdtToutc, parseOptions)
}

/**
 * Moment of `delivery reference + eta_time minutes`. Same math the SLA timer
 * uses: targetMin = delivery_datetime + eta_time - now().
 */
export const getOrderEtaMoment = (order, parseDate, parseOptions = MACHINE_PARSE_OPTIONS) => {
  const _delivery = getOrderDeliveryReference(order, parseDate, parseOptions)
  return moment(_delivery).add(order?.eta_time, 'minutes')
}

const hasEtaMinutes = (etaTime) => {
  if (etaTime === null || etaTime === undefined || etaTime === '' || typeof etaTime === 'boolean') return false
  const minutes = Number(etaTime)
  // 0 minutes is not an estimate: treated as "no ETA".
  return Number.isFinite(minutes) && minutes > 0
}

/**
 * ETA moment for display, or null when the order has no usable `eta_time` or
 * no delivery date.
 */
export const getOrderEta = (order, { parseDate }) => {
  if (!hasEtaMinutes(order?.eta_time)) return null
  if (!order?.delivery_datetime_utc && !order?.delivery_datetime) return null
  const eta = getOrderEtaMoment(order, parseDate, MACHINE_PARSE_OPTIONS)
  return eta.isValid() ? eta : null
}

/**
 * Parts of the ETA cell: `time` always, `date` only when the estimate is not
 * today (the date part of the project's dates_general_format: without the year when it is this year, with it
 * when it is another year; W0-4a, decision 13). Returns null when
 * there is no ETA. Two parts so the cell can stack them, like the order cell.
 *
 * The time is formatted here, not with `useUtils().parseTime`: that helper
 * re-parses an "HH:mm" string as UTC and, in the running app, answers
 * "invalid format" for it. `formatTime` is the project's `format_time`
 * config ('12' or '24', default '24'), the same switch parseTime reads.
 *
 * @param {object} order
 * @param {{ parseDate: Function, formatTime?: string, now?: object }} options
 */
export const formatOrderEta = (order, { parseDate, formatTime = '24', now } = {}) => {
  const eta = getOrderEta(order, { parseDate })
  if (!eta) return null
  const time = eta.format(String(formatTime) === '12' ? 'hh:mm A' : 'HH:mm')
  const reference = now ? moment(now) : moment()
  if (eta.isSame(reference, 'day')) return { time, date: null }
  // The estimate is already a local moment: hand it to parseDate as local machine text and let the project's format paint it.
  const date = parseDate(eta.format(MACHINE_PARSE_OPTIONS.outputFormat), {
    utc: false,
    dateOnly: true,
    omitYear: eta.isSame(reference, 'year')
  })
  return { time, date }
}
