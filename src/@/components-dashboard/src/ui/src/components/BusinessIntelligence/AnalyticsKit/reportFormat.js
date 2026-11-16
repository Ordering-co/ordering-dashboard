import { splitDuration } from '../../../../../utils/businessReports'

const DASH = '—'

// redesign bi FC (BI-12, D8): the names of the order statuses, by the keys and texts that already exist in `ui/src/utils/orderStatus.js`
// (`slug` is the key, `value` the default text; the status number is the index of that list). One literal t() call per status,
// so the i18n scanner sees every key. A status that is not here is not an error: it reads «Status N».
const STATUS_LABELS = {
  0: t => t('PENDING_ORDER', 'Pending Order'),
  1: t => t('COMPLETED_BY_ADMIN', 'Completed by admin'),
  2: t => t('REJECT_BY_ADMIN', 'Reject by admin'),
  3: t => t('DRIVER_IN_BUSINESS', 'Driver arrived by business'),
  4: t => t('PREPARATION_COMPLETED', 'Preparation completed'),
  5: t => t('REJECT_BY_BUSINESS', 'Reject by business'),
  6: t => t('REJECT_BY_DRIVER', 'Reject by driver'),
  7: t => t('ACCEPTED_BY_BUSINESS', 'Accepted by business'),
  8: t => t('ACCEPTED_BY_DRIVER', 'Accepted by driver'),
  9: t => t('PICK_UP_COMPLETED_BY_DRIVER', 'Pick up completed by driver'),
  10: t => t('PICK_UP_FAILED_BY_DRIVER', 'Pick up failed by driver'),
  11: t => t('DELIVERY_COMPLETED_BY_DRIVER', 'Delivery completed by driver'),
  12: t => t('DELIVERY_FAILED_BY_DRIVER', 'Delivery failed by driver'),
  13: t => t('PREORDER', 'Preorder'),
  14: t => t('ORDER_NOT_READY', 'Order not ready'),
  15: t => t('PICKUP_COMPLETED_BY_CUSTOMER', 'Pickup completed by customer'),
  16: t => t('CANCELED_BY_CUSTOMER', 'Canceled by customer'),
  17: t => t('NOT_PICKED_BY_CUSTOMER', 'Not picked by customer'),
  18: t => t('DRIVER_ALMOST_ARRIVED_TO_BUSINESS', 'Driver almost arrived to business'),
  19: t => t('DRIVER_ALMOST_ARRIVED_TO_CUSTOMER', 'Driver almost arrived to customer'),
  20: t => t('CUSTOMER_ALMOST_ARRIVED_TO_BUSINESS', 'Customer almost arrived to business'),
  21: t => t('CUSTOMER_ARRIVED_TO_BUSINESS', 'Customer arrived to business'),
  22: t => t('ORDER_LOOKING_FOR_DRIVER', 'Looking for driver'),
  23: t => t('ORDER_DRIVER_ON_WAY', 'Driver on way'),
  24: t => t('ORDER_STATUS_DRIVER_WAITING_FOR_ORDER', 'Driver waiting for order'),
  25: t => t('ORDER_STATUS_ACCEPTED_BY_DRIVER_COMPANY', 'Accepted by driver company'),
  26: t => t('ORDER_DRIVER_ARRIVED_CUSTOMER', 'Driver arrived to customer')
}

// A status number from the API, as a number. An empty value is not 0 (Pending Order), so it is not a number here.
const toStatusNumber = (status) => {
  if (typeof status === 'number') return status
  if (typeof status === 'string' && status.trim() !== '') return Number(status)
  return NaN
}

/**
 * The translated name of an order status (redesign bi FC, BI-12, D8). Unknown ones read «Status N»; `main` threw on them in the CSV.
 * @param {(key: string, fallback: string) => string} t from useLanguage()
 * @param {number|string} status the status number the reports API sends
 */
export const orderStatusLabel = (t, status) => {
  const number = toStatusNumber(status)
  if (Number.isInteger(number) && Object.prototype.hasOwnProperty.call(STATUS_LABELS, number)) return STATUS_LABELS[number](t)
  return t('BUSINESS_REPORTS_STATUS_N', 'Status _number_').replace('_number_', String(status))
}

/**
 * A duration in seconds as text, at most two units and the largest first: «5 h 45 min», «45 min 5 s», «6 s», «0 s» (redesign bi FC, D3, D8).
 * A unit that is zero is left out (an exact hour is «1 h»). No duration reads «—». It returns text; the consumer puts it in a `.odc-figure`.
 * @param {(key: string, fallback: string) => string} t from useLanguage()
 * @param {number|string|null} seconds
 */
export const formatDuration = (t, seconds) => {
  const parts = splitDuration(seconds)
  if (!parts) return DASH
  const { hours, minutes, seconds: secs } = parts
  // abbreviations, so there is no plural: one key each, with the number as a placeholder
  const units = [
    { amount: hours, text: () => t('BUSINESS_REPORTS_DURATION_HOURS', '_n_ h') },
    { amount: minutes, text: () => t('BUSINESS_REPORTS_DURATION_MINUTES', '_n_ min') },
    { amount: secs, text: () => t('BUSINESS_REPORTS_DURATION_SECONDS', '_n_ s') }
  ]
  const first = units.findIndex(unit => unit.amount > 0)
  if (first === -1) return units[2].text().replace('_n_', '0')
  return units
    .slice(first, first + 2)
    .filter(unit => unit.amount > 0)
    .map(unit => unit.text().replace('_n_', String(unit.amount)))
    .join(' ')
}
