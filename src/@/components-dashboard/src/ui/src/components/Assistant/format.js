import { orderStatus } from '../../utils'
import { describeRecordChange } from '../../../../contexts/AssistantContext/records'

/**
 * How the assistant shows a proposed change. api-ai sends raw API fields and
 * values; only the fields of the 9 writes the MCP allows can appear
 * (apiv4 docs/clasificacion-capas.csv, column mcp_admin_body).
 */

/** What an operation changes, from the prefix of its operation_id */
export const getRecordTypeLabel = (operationId, t) => {
  const entity = String(operationId || '').split('.')[0]
  const labels = {
    Business: t('ASSISTANT_RECORD_BUSINESS', 'Store'),
    Category: t('ASSISTANT_RECORD_CATEGORY', 'Category'),
    Product: t('ASSISTANT_RECORD_PRODUCT', 'Product'),
    Extra: t('ASSISTANT_RECORD_EXTRA', 'Extra'),
    ExtraOption: t('ASSISTANT_RECORD_EXTRA_OPTION', 'Extra option'),
    ExtraOptionSuboption: t('ASSISTANT_RECORD_EXTRA_SUBOPTION', 'Extra suboption'),
    Menu: t('ASSISTANT_RECORD_MENU', 'Menu'),
    Offer: t('ASSISTANT_RECORD_OFFER', 'Promotion'),
    Order: t('ASSISTANT_RECORD_ORDER', 'Order')
  }
  return labels[entity] || t('ASSISTANT_RECORD_OTHER', 'Record')
}

/** The id of the changed record, from the path params of the write */
export const getRecordId = (operationId, pathParams) => {
  const { id } = describeRecordChange({ operation_id: operationId, path_params: pathParams })
  return id ? String(id) : null
}

/** How a card names its record: the name the API gave, else `Product #45` */
export const getRecordName = (action, t) => {
  if (action?.record_name) return action.record_name
  const typeLabel = getRecordTypeLabel(action?.operation_id, t)
  const id = getRecordId(action?.operation_id, action?.path_params)
  return id ? `${typeLabel} #${id}` : typeLabel
}

export const getFieldLabel = (field, t) => {
  const labels = {
    enabled: t('ASSISTANT_FIELD_ENABLED', 'Enabled'),
    disabled_reason: t('ASSISTANT_FIELD_DISABLED_REASON', 'Disabled reason'),
    name: t('ASSISTANT_FIELD_NAME', 'Name'),
    description: t('ASSISTANT_FIELD_DESCRIPTION', 'Description'),
    about: t('ASSISTANT_FIELD_ABOUT', 'About'),
    schedule: t('ASSISTANT_FIELD_SCHEDULE', 'Schedule'),
    snooze_until: t('ASSISTANT_FIELD_SNOOZE_UNTIL', 'Paused until'),
    phone: t('ASSISTANT_FIELD_PHONE', 'Phone'),
    cellphone: t('ASSISTANT_FIELD_CELLPHONE', 'Cellphone'),
    whatsapp_number: t('ASSISTANT_FIELD_WHATSAPP_NUMBER', 'WhatsApp'),
    email: t('ASSISTANT_FIELD_EMAIL', 'Email'),
    rank: t('ASSISTANT_FIELD_RANK', 'Position'),
    price: t('ASSISTANT_FIELD_PRICE', 'Price'),
    offer_price: t('ASSISTANT_FIELD_OFFER_PRICE', 'Offer price'),
    in_offer: t('ASSISTANT_FIELD_IN_OFFER', 'On offer'),
    min: t('ASSISTANT_FIELD_MIN', 'Minimum'),
    max: t('ASSISTANT_FIELD_MAX', 'Maximum'),
    label: t('ASSISTANT_FIELD_LABEL', 'Label'),
    rate: t('ASSISTANT_FIELD_RATE', 'Discount'),
    rate_type: t('ASSISTANT_FIELD_RATE_TYPE', 'Discount type'),
    minimum: t('ASSISTANT_FIELD_MINIMUM', 'Minimum purchase'),
    max_discount: t('ASSISTANT_FIELD_MAX_DISCOUNT', 'Maximum discount'),
    start: t('ASSISTANT_FIELD_START', 'Starts'),
    end: t('ASSISTANT_FIELD_END', 'Ends'),
    coupon: t('ASSISTANT_FIELD_COUPON', 'Coupon'),
    limit: t('ASSISTANT_FIELD_LIMIT', 'Usage limit'),
    limit_per_user: t('ASSISTANT_FIELD_LIMIT_PER_USER', 'Limit per customer'),
    status: t('ASSISTANT_FIELD_STATUS', 'Status'),
    reject_reason: t('ASSISTANT_FIELD_REJECT_REASON', 'Reject reason'),
    reasons: t('ASSISTANT_FIELD_REASONS', 'Reasons'),
    comment: t('ASSISTANT_FIELD_COMMENT', 'Comment'),
    prepared_in: t('ASSISTANT_FIELD_PREPARED_IN', 'Preparation time')
  }
  // Nothing outside the allowlist should arrive; if it does, show it readable
  return labels[field] || String(field).replace(/_/g, ' ')
}

const BOOLEAN_FIELDS = ['enabled', 'in_offer']
const MONEY_FIELDS = ['price', 'offer_price', 'minimum', 'max_discount']
const DATE_FIELDS = ['snooze_until', 'start', 'end']

const DAY_KEYS = [
  ['SUNDAY_ABBREVIATION', 'Sun'],
  ['MONDAY_ABBREVIATION', 'Mon'],
  ['TUESDAY_ABBREVIATION', 'Tue'],
  ['WEDNESDAY_ABBREVIATION', 'Wed'],
  ['THURSDAY_ABBREVIATION', 'Thu'],
  ['FRIDAY_ABBREVIATION', 'Fri'],
  ['SATURDAY_ABBREVIATION', 'Sat']
]

const pad = (value) => String(value ?? 0).padStart(2, '0')

/**
 * One line per day of an Ordering schedule (index 0 is Sunday)
 * @returns {String[]|null} null when the value is not a schedule
 */
export const formatSchedule = (schedule, t) => {
  if (!Array.isArray(schedule) || schedule.length === 0) return null
  return schedule.map((day, index) => {
    const [key, fallback] = DAY_KEYS[index % 7]
    const dayName = t(key, fallback)
    const lapses = Array.isArray(day?.lapses) ? day.lapses : []
    if (!day?.enabled || lapses.length === 0) return `${dayName} ${t('ASSISTANT_CLOSED', 'closed')}`
    const hours = lapses.map(lapse => `${pad(lapse?.open?.hour)}:${pad(lapse?.open?.minute)}–${pad(lapse?.close?.hour)}:${pad(lapse?.close?.minute)}`)
    return `${dayName} ${hours.join(', ')}`
  })
}

const isEmpty = (value) => value === null || value === undefined || value === ''

/**
 * A field value as text
 * @param {String} field API field
 * @param {*} value raw value
 * @param {Object} helpers `{ t, parsePrice, parseDate, changes }`; `changes` lets `rate` read `rate_type`
 */
export const formatFieldValue = (field, value, { t, parsePrice, parseDate, changes = [] }) => {
  if (isEmpty(value)) return '—'

  if (BOOLEAN_FIELDS.includes(field)) {
    const on = value === true || value === 1 || value === '1' || value === 'true'
    return on ? t('YES', 'Yes') : t('NO', 'No')
  }
  if (MONEY_FIELDS.includes(field) && Number.isFinite(Number(value))) {
    return parsePrice ? parsePrice(Number(value)) : String(value)
  }
  if (DATE_FIELDS.includes(field)) {
    return parseDate ? parseDate(value) : String(value)
  }
  if (field === 'rate_type') {
    if (Number(value) === 1) return t('ASSISTANT_RATE_TYPE_PERCENTAGE', 'Percentage')
    if (Number(value) === 2) return t('ASSISTANT_RATE_TYPE_FIXED', 'Fixed amount')
  }
  if (field === 'rate' && Number.isFinite(Number(value))) {
    const rateType = changes.find(change => change.field === 'rate_type')?.after
    if (Number(rateType) === 1) return `${Number(value)}%`
  }
  if (field === 'status' && Number.isFinite(Number(value))) {
    const status = orderStatus.find(item => item.key === Number(value))
    if (status) return t(status.slug, status.value)
  }
  if (field === 'prepared_in' && Number.isFinite(Number(value))) {
    return `${Number(value)} ${t('MIN', 'min')}`
  }
  if (field === 'schedule') {
    const lines = formatSchedule(value, t)
    if (lines) return lines.join('\n')
  }
  if (Array.isArray(value)) return value.map(item => (typeof item === 'object' ? JSON.stringify(item) : String(item))).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/**
 * Seconds left to confirm a proposed change
 * @param {String} expiresAt ISO date
 * @param {Number} now ms
 */
export const getSecondsLeft = (expiresAt, now = Date.now()) => {
  const end = Date.parse(expiresAt)
  if (!Number.isFinite(end)) return null
  return Math.max(0, Math.floor((end - now) / 1000))
}

export const formatCountdown = (seconds) => `${Math.floor(seconds / 60)}:${pad(seconds % 60)}`

/**
 * What a card shows: the live status, with a proposal that ran out of time
 * already shown as expired
 */
export const getActionDisplayStatus = (action, now = Date.now()) => {
  if (!action) return null
  if (action.status === 'proposed' && getSecondsLeft(action.expires_at, now) === 0) return 'expired'
  return action.status
}

const toLocale = (code) => {
  const locale = typeof code === 'string' ? code.replace('_', '-') : undefined
  try {
    return Intl.DateTimeFormat.supportedLocalesOf(locale).length ? locale : undefined
  } catch {
    return undefined
  }
}

const dayOf = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

/**
 * When a reached usage limit lets the user write again, in their time zone:
 * today / tomorrow at a time, or a date and time
 * @param {String|null} retryAt ISO date
 * @param {Function} t translate
 * @param {String} [languageCode] Dashboard language (`es`, `pt_br`)
 * @param {Number} [now] ms
 */
export const formatRetryAt = (retryAt, t, languageCode, now = Date.now()) => {
  const at = new Date(retryAt)
  if (!retryAt || !Number.isFinite(at.getTime())) {
    return t('ASSISTANT_LIMIT_RETRY_LATER', 'You can use it again later.')
  }
  const locale = toLocale(languageCode)
  const time = at.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
  const days = Math.round((dayOf(at) - dayOf(new Date(now))) / 86400000)
  if (days <= 0) return t('ASSISTANT_LIMIT_RETRY_TODAY', 'You can use it again today at _time_.').replace('_time_', time)
  if (days === 1) return t('ASSISTANT_LIMIT_RETRY_TOMORROW', 'You can use it again tomorrow at _time_.').replace('_time_', time)
  const date = at.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
  return t('ASSISTANT_LIMIT_RETRY_DATE', 'You can use it again on _date_ at _time_.').replace('_date_', date).replace('_time_', time)
}
