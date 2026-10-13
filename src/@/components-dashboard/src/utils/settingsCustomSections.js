/**
 * Custom Settings sections.
 * Pure helpers: which configs belong to a custom block, copy, previews.
 */

import { parseJsonObject } from './safeJsonParse'

export const SETTINGS_CONFIG_COPY = {
  security_recaptcha_auth: {
    labelKey: 'SETTINGS_RECAPTCHA_LOGIN',
    label: 'Login'
  },
  security_recaptcha_signup: {
    labelKey: 'SETTINGS_RECAPTCHA_SIGNUP',
    label: 'Sign up'
  },
  security_recaptcha_order: {
    labelKey: 'SETTINGS_RECAPTCHA_ORDER',
    label: 'Online ordering'
  },
  security_recaptcha_site_key: {
    labelKey: 'SETTINGS_RECAPTCHA_SITE_KEY',
    label: 'Site key'
  },
  security_recaptcha_secret_key: {
    labelKey: 'SETTINGS_RECAPTCHA_SECRET_KEY',
    label: 'Secret key'
  },
  security_recaptcha_site_key_android: {
    labelKey: 'SETTINGS_RECAPTCHA_SITE_KEY_ANDROID',
    label: 'Android site key'
  },
  security_recaptcha_secret_key_android: {
    labelKey: 'SETTINGS_RECAPTCHA_SECRET_KEY_ANDROID',
    label: 'Android secret key'
  },
  security_recaptcha_site_key_ios: {
    labelKey: 'SETTINGS_RECAPTCHA_SITE_KEY_IOS',
    label: 'iOS site key'
  },
  security_recaptcha_secret_key_ios: {
    labelKey: 'SETTINGS_RECAPTCHA_SECRET_KEY_IOS',
    label: 'iOS secret key'
  },
  security_recaptcha_site_key_v3: {
    labelKey: 'SETTINGS_RECAPTCHA_SITE_KEY',
    label: 'Site key'
  },
  security_recaptcha_secret_key_v3: {
    labelKey: 'SETTINGS_RECAPTCHA_SECRET_KEY',
    label: 'Secret key'
  },
  security_recaptcha_score_v3: {
    labelKey: 'SETTINGS_RECAPTCHA_SCORE',
    label: 'Score threshold'
  },
  security_recaptcha_base_url: {
    labelKey: 'SETTINGS_RECAPTCHA_BASE_URL',
    label: 'Base URL'
  },
  reject_orders_enabled: {
    labelKey: 'SETTINGS_REJECT_BY_BUSINESS',
    label: 'Allow businesses to reject orders'
  },
  allow_driver_reject_order: {
    labelKey: 'SETTINGS_REJECT_BY_DRIVER',
    label: 'Allow drivers to reject assigned orders'
  },
  available_status_enabled: {
    labelKey: 'SETTINGS_DRIVER_AVAILABLE_STATUS',
    label: 'Let drivers set available or busy'
  },
  dates_general_format: {
    labelKey: 'SETTINGS_DATE_TIME_FORMAT',
    label: 'Date and time format'
  },
  max_days_preorder: {
    labelKey: 'SETTINGS_PREORDER_DEFAULT_DAYS',
    label: 'Default preorder window (days)',
    helpKey: 'SETTINGS_PREORDER_DEFAULT_DAYS_HELP',
    help: 'How far ahead customers can schedule an order when a type has no override.'
  },
  preorder_maximum_days: {
    labelKey: 'SETTINGS_PREORDER_BY_TYPE',
    label: 'Preorder window by order type'
  },
  notification_toast: {
    labelKey: 'SETTINGS_ORDER_ALERT_TOAST',
    label: 'Show a toast when a new order arrives'
  },
  notification_in_app_enabled: {
    labelKey: 'SETTINGS_ORDER_ALERT_IN_APP',
    label: 'Show an in-app order alert'
  },
  notification_in_app_position: {
    labelKey: 'SETTINGS_ORDER_ALERT_POSITION',
    label: 'In-app alert position'
  }
}

export const SETTINGS_CUSTOM_BLOCK_COPY = {
  date_time: {
    titleKey: 'SETTINGS_DATE_TIME_TITLE',
    title: 'Date and time',
    helpKey: 'SETTINGS_DATE_TIME_HELP',
    help: 'Used on the dashboard, invoices and scheduled orders. Scheduled orders hide the year.'
  },
  recaptcha: {
    titleKey: 'SETTINGS_RECAPTCHA_TITLE',
    title: 'reCAPTCHA',
    hideHeader: true
  },
  location_checks: {
    titleKey: 'SETTINGS_LOCATION_CHECKS_TITLE',
    title: 'Driver location checks',
    helpKey: 'SETTINGS_LOCATION_CHECKS_HELP',
    help: 'Require the driver to be nearby, with a recent GPS point, before these statuses.'
  },
  preorder_window: {
    titleKey: 'SETTINGS_PREORDER_WINDOW_TITLE',
    title: 'Preorder window',
    helpKey: 'SETTINGS_PREORDER_WINDOW_HELP',
    help: 'Set a default window, then override it per order type if needed.'
  },
  onesignal: {
    titleKey: 'SETTINGS_ONESIGNAL_TITLE',
    title: 'OneSignal apps',
    helpKey: 'SETTINGS_ONESIGNAL_HELP',
    help: 'App ID and REST API key for each Ordering app that sends push notifications.'
  },
  order_alerts: {
    titleKey: 'SETTINGS_ORDER_ALERTS_TITLE',
    title: 'Dashboard order alerts',
    helpKey: 'SETTINGS_ORDER_ALERTS_HELP',
    help: 'How the dashboard tells staff that a new order arrived.'
  },
  multi_checkout: {
    titleKey: 'SETTINGS_MULTI_CHECKOUT_TITLE',
    title: 'Delivery fee discount by cart',
    helpKey: 'SETTINGS_MULTI_CHECKOUT_HELP',
    help: 'Percent off the delivery fee for each cart in a multi-store checkout (0 to 100).'
  },
  reservation: {
    titleKey: 'SETTINGS_RESERVATION_TITLE',
    title: 'Reservation setting',
    helpKey: 'SETTINGS_RESERVATION_HELP',
    help: 'Default guest counts, booking window, late hold, and food preorder for reservations.'
  }
}

export const DATE_TIME_PRESETS = [
  'YYYY-MM-DD HH:mm:ss',
  'MM/DD/YYYY hh:mm A',
  'DD/MM/YYYY HH:mm',
  'DD MMM YYYY HH:mm'
]

export const DATE_TIME_CUSTOM_VALUE = '__custom__'

export const LOCATION_CHECK_STATUSES = [
  { status: 3, labelKey: 'SETTINGS_LOCATION_STATUS_3', label: 'Arrived at the store' },
  { status: 9, labelKey: 'SETTINGS_LOCATION_STATUS_9', label: 'Picked up' },
  { status: 11, labelKey: 'SETTINGS_LOCATION_STATUS_11', label: 'Delivered' },
  { status: 26, labelKey: 'SETTINGS_LOCATION_STATUS_26', label: 'Waiting for the customer' }
]

export const ONESIGNAL_APPS = [
  { idKey: 'onesignal_dashboardweb_id', secretKey: 'onesignal_dashboardweb_rest_api_key', labelKey: 'SETTINGS_ONESIGNAL_DASHBOARD', label: 'Dashboard' },
  { idKey: 'onesignal_orderingapp_id', secretKey: 'onesignal_orderingapp_rest_api_key', labelKey: 'SETTINGS_ONESIGNAL_CUSTOMER', label: 'Customer app' },
  { idKey: 'onesignal_businessapp_id', secretKey: 'onesignal_businessapp_rest_api_key', labelKey: 'SETTINGS_ONESIGNAL_BUSINESS', label: 'Business app' },
  { idKey: 'onesignal_deliveryapp_id', secretKey: 'onesignal_deliveryapp_rest_api_key', labelKey: 'SETTINGS_ONESIGNAL_DRIVER', label: 'Driver app' },
  { idKey: 'onesignal_orderingweb_id', secretKey: 'onesignal_orderingweb_rest_api_key', labelKey: 'SETTINGS_ONESIGNAL_WEB', label: 'Ordering website' }
]

export const MULTI_CHECKOUT_DISCOUNT_KEYS = [
  'multi_business_checkout_delivery_fee_discount_percentage_cart_1',
  'multi_business_checkout_delivery_fee_discount_percentage_cart_2',
  'multi_business_checkout_delivery_fee_discount_percentage_cart_3',
  'multi_business_checkout_delivery_fee_discount_percentage_cart_4',
  'multi_business_checkout_delivery_fee_discount_percentage_cart_5',
  'multi_business_checkout_delivery_fee_discount_percentage_cart_after_5'
]

export const MULTI_CHECKOUT_DISCOUNT_LABELS = {
  multi_business_checkout_delivery_fee_discount_percentage_cart_1: { labelKey: 'SETTINGS_MULTI_CART_1', label: 'Cart 1' },
  multi_business_checkout_delivery_fee_discount_percentage_cart_2: { labelKey: 'SETTINGS_MULTI_CART_2', label: 'Cart 2' },
  multi_business_checkout_delivery_fee_discount_percentage_cart_3: { labelKey: 'SETTINGS_MULTI_CART_3', label: 'Cart 3' },
  multi_business_checkout_delivery_fee_discount_percentage_cart_4: { labelKey: 'SETTINGS_MULTI_CART_4', label: 'Cart 4' },
  multi_business_checkout_delivery_fee_discount_percentage_cart_5: { labelKey: 'SETTINGS_MULTI_CART_5', label: 'Cart 5' },
  multi_business_checkout_delivery_fee_discount_percentage_cart_after_5: { labelKey: 'SETTINGS_MULTI_CART_AFTER_5', label: 'After 5' }
}

export const RECAPTCHA_V2_KEYS = [
  'security_recaptcha_site_key',
  'security_recaptcha_secret_key',
  'security_recaptcha_site_key_android',
  'security_recaptcha_secret_key_android',
  'security_recaptcha_site_key_ios',
  'security_recaptcha_secret_key_ios'
]

export const RECAPTCHA_V3_KEYS = [
  'security_recaptcha_site_key_v3',
  'security_recaptcha_secret_key_v3',
  'security_recaptcha_score_v3'
]

export const RECAPTCHA_REQUIRED_KEYS = {
  v2: ['security_recaptcha_site_key', 'security_recaptcha_secret_key'],
  v3: ['security_recaptcha_site_key_v3', 'security_recaptcha_secret_key_v3', 'security_recaptcha_score_v3']
}

export const RECAPTCHA_TYPE_OPTIONS = [
  { value: 'v2', labelKey: 'SETTINGS_RECAPTCHA_TYPE_V2', label: 'Version v2' },
  { value: 'v3', labelKey: 'SETTINGS_RECAPTCHA_TYPE_V3', label: 'Version v3' },
  { value: 'both', labelKey: 'SETTINGS_RECAPTCHA_TYPE_BOTH', label: 'Version v2 and version v3' }
]

export const normalizeRecaptchaType = (value) => {
  const raw = String(value || 'v2').toLowerCase().replace(/-/g, '_')
  if (raw === 'v2') return 'v2'
  if (raw === 'v3_only') return 'v3'
  if (raw === 'both') return 'both'
  if (raw === 'v3') return 'both'
  return 'v2'
}

export const persistRecaptchaType = (uiType) => {
  if (uiType === 'v2') return 'v2'
  if (uiType === 'v3') return 'v3_only'
  return 'v3'
}

export const recaptchaTypeAllowsV3 = (value) => {
  const mode = normalizeRecaptchaType(value)
  return mode === 'v3' || mode === 'both'
}

export const recaptchaTypeAllowsV2 = (value) => {
  const mode = normalizeRecaptchaType(value)
  return mode === 'v2' || mode === 'both'
}

export const isRecaptchaScoreValid = (value) => {
  if (value === '' || value == null) return false
  const score = Number(value)
  return Number.isFinite(score) && score >= 0 && score <= 1
}

export const getRecaptchaFieldGroups = (type) => {
  const mode = normalizeRecaptchaType(type)
  const groups = []
  if (mode === 'v2' || mode === 'both') {
    groups.push({
      id: 'v2',
      titleKey: 'SETTINGS_RECAPTCHA_V2_KEYS',
      title: 'v2',
      keys: RECAPTCHA_V2_KEYS
    })
  }
  if (mode === 'v3' || mode === 'both') {
    groups.push({
      id: 'v3',
      titleKey: 'SETTINGS_RECAPTCHA_V3_KEYS',
      title: 'v3',
      keys: RECAPTCHA_V3_KEYS
    })
  }
  return groups
}

const isFilledConfig = (config) => String(config?.value ?? '').trim() !== ''

export const isSettingsCredentialFilled = (config) => {
  const value = String(config?.value ?? '').trim()
  if (!value) return false
  const name = String(config?.name ?? '').trim()
  if (name && value.toLowerCase() === name.toLowerCase()) return false
  if (/^add your\s/i.test(value)) return false
  return true
}

export const getRecaptchaValidation = ({ type, configs = [] } = {}) => {
  const mode = normalizeRecaptchaType(type)
  const byKey = new Map((configs || []).filter(Boolean).map(config => [config.key, config]))
  const errors = {}
  const requiredKeys = [
    ...((mode === 'v2' || mode === 'both') ? RECAPTCHA_REQUIRED_KEYS.v2 : []),
    ...((mode === 'v3' || mode === 'both') ? RECAPTCHA_REQUIRED_KEYS.v3 : [])
  ]

  requiredKeys.forEach(key => {
    const config = byKey.get(key)
    if (!isFilledConfig(config)) {
      errors[key] = 'SETTINGS_RECAPTCHA_REQUIRED'
    }
  })

  if (mode === 'v3' || mode === 'both') {
    const score = byKey.get('security_recaptcha_score_v3')
    if (isFilledConfig(score) && !isRecaptchaScoreValid(score.value)) {
      errors.security_recaptcha_score_v3 = 'SETTINGS_RECAPTCHA_SCORE_RANGE'
    }
  }

  return {
    mode,
    errors,
    isValid: Object.keys(errors).length === 0
  }
}

export const PREORDER_TYPE_ORDER = [
  'delivery',
  'pickup',
  'eatin',
  'curbside',
  'driver_thru',
  'seat_delivery',
  'catering_delivery',
  'catering_pickup'
]

export const CATERING_PREORDER_TYPES = ['catering_delivery', 'catering_pickup']

export const PREORDER_TYPE_LABELS = {
  delivery: { labelKey: 'DELIVERY', label: 'Delivery' },
  pickup: { labelKey: 'PICKUP', label: 'Pickup' },
  eatin: { labelKey: 'EAT_IN', label: 'Eat in' },
  curbside: { labelKey: 'CURBSIDE', label: 'Curbside' },
  driver_thru: { labelKey: 'DRIVE_THRU', label: 'Drive thru' },
  seat_delivery: { labelKey: 'SEAT_DELIVERY', label: 'Seat delivery' },
  catering_delivery: { labelKey: 'CATERING_DELIVERY', label: 'Catering delivery' },
  catering_pickup: { labelKey: 'CATERING_PICKUP', label: 'Catering pickup' }
}

const locationKeys = LOCATION_CHECK_STATUSES.flatMap(({ status }) => ([
  `location_validation_enabled_status_${status}`,
  `location_validation_distance_status_${status}`,
  `location_validation_validity_status_${status}`
]))

export const SETTINGS_CUSTOM_BLOCKS = {
  date_time: {
    id: 'date_time',
    keys: ['dates_general_format', 'format_time', 'dates_moment_format']
  },
  recaptcha: {
    id: 'recaptcha',
    keys: [
      'security_recaptcha_type',
      'security_recaptcha_auth',
      'security_recaptcha_signup',
      'security_recaptcha_order',
      ...RECAPTCHA_V2_KEYS,
      ...RECAPTCHA_V3_KEYS,
      'security_recaptcha_base_url'
    ]
  },
  location_checks: {
    id: 'location_checks',
    keys: locationKeys
  },
  preorder_window: {
    id: 'preorder_window',
    keys: ['max_days_preorder', 'preorder_maximum_days']
  },
  onesignal: {
    id: 'onesignal',
    keys: ONESIGNAL_APPS.flatMap(app => [app.idKey, app.secretKey])
  },
  order_alerts: {
    id: 'order_alerts',
    keys: ['notification_in_app_enabled', 'notification_in_app_position', 'notification_toast']
  },
  multi_checkout: {
    id: 'multi_checkout',
    keys: MULTI_CHECKOUT_DISCOUNT_KEYS
  },
  reservation: {
    id: 'reservation',
    keys: ['reservation_setting']
  }
}

const keyToBlock = Object.values(SETTINGS_CUSTOM_BLOCKS).reduce((map, block) => {
  block.keys.forEach(key => { map[key] = block.id })
  return map
}, {})

export const getSettingsFocusId = (configKey) =>
  configKey ? `settings-focus-${configKey}` : ''

/**
 * Anchor of the custom block that renders `configKey`. `?focus=` lands here
 * when the field itself has no anchor (location checks, OneSignal, alerts…).
 */
export const getSettingsBlockFocusId = (configKey) => {
  const blockId = keyToBlock[configKey]
  return blockId ? `settings-block-${blockId}` : ''
}

export const SETTINGS_CONFIG_EFFECT = {
  allow_driver_reject_order: {
    helpKey: 'SETTINGS_EFFECT_DRIVERS_REJECT',
    help: 'When on, a driver can tap Reject after an order is assigned. When off, they must take it.'
  },
  reject_orders_enabled: {
    helpKey: 'SETTINGS_EFFECT_STORES_REJECT',
    help: 'When on, a store can reject an incoming order. When off, they must accept it.'
  },
  dates_general_format: {
    helpKey: 'SETTINGS_EFFECT_DATE_TIME',
    help: 'When set, dashboard, invoices and scheduled orders use this format. Scheduled orders still hide the year.'
  },
  driver_tip_options: {
    helpKey: 'SETTINGS_EFFECT_DRIVER_TIPS',
    help: 'When set, checkout shows these tip percents. When empty, customers do not see those presets.'
  },
  max_days_preorder: {
    helpKey: 'SETTINGS_EFFECT_PREORDER',
    help: 'When greater than 0, customers can schedule this many days ahead. When 0 or -1, scheduling is off.'
  },
  security_recaptcha_auth: {
    helpKey: 'SETTINGS_EFFECT_RECAPTCHA',
    help: 'When on, login asks for a reCAPTCHA check. When off, login skips that check.'
  },
  available_status_enabled: {
    helpKey: 'SETTINGS_EFFECT_DRIVER_AVAILABLE',
    help: 'When on, drivers can mark themselves available or busy. When off, they cannot change that status.'
  },
  autoassign_time_to_attempt_again: {
    helpKey: 'SETTINGS_EFFECT_AUTO_ASSIGN',
    help: 'When set, the platform waits this long, then tries auto-assignment again. When empty, it does not retry on that timer.'
  },
  assign_driver_enabled: {
    helpKey: 'SETTINGS_EFFECT_DRIVER_ASSIGN',
    help: 'When on, the platform can assign a driver to an order. When off, someone has to assign one by hand.'
  },
  stripe_publishable: {
    helpKey: 'SETTINGS_EFFECT_STRIPE',
    help: 'When both keys are set, card payments can run. When they are empty, Stripe checkout cannot charge.'
  }
}

export const getSettingsConfigCopy = (config = {}) => SETTINGS_CONFIG_COPY[config.key] || null

export const getCustomBlockCopy = (blockId) => SETTINGS_CUSTOM_BLOCK_COPY[blockId] || null

export const getCustomBlockId = (configKey) => keyToBlock[configKey] || null

export const isCustomBlockConfig = (configKey) => !!keyToBlock[configKey]

export const getActiveCustomBlocks = (configs = []) => {
  const present = new Set((configs || []).map(config => config?.key).filter(Boolean))
  return Object.values(SETTINGS_CUSTOM_BLOCKS)
    .filter(block => block.keys.some(key => present.has(key)))
    .map(block => block.id)
}

export const getVisibleRecaptchaKeys = (type) => {
  const versionKeys = getRecaptchaFieldGroups(type).flatMap(group => group.keys)
  return [
    'security_recaptcha_type',
    'security_recaptcha_auth',
    'security_recaptcha_signup',
    'security_recaptcha_order',
    ...versionKeys,
    'security_recaptcha_base_url'
  ]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const pad = (value) => String(value).padStart(2, '0')

export const formatWithDateTokens = (format = '', date = new Date(2026, 8, 14, 14, 30, 0)) => {
  const hours24 = date.getHours()
  const hours12 = hours24 % 12 || 12
  return String(format)
    .replace(/YYYY/g, String(date.getFullYear()))
    .replace(/MMM/g, MONTHS[date.getMonth()])
    .replace(/MM/g, pad(date.getMonth() + 1))
    .replace(/DD/g, pad(date.getDate()))
    .replace(/HH/g, pad(hours24))
    .replace(/hh/g, pad(hours12))
    .replace(/mm/g, pad(date.getMinutes()))
    .replace(/ss/g, pad(date.getSeconds()))
    .replace(/A/g, hours24 >= 12 ? 'PM' : 'AM')
}

export const getDateTimeFormats = (generalFormat) => {
  const safeFormat = (typeof generalFormat === 'string' && generalFormat.trim())
    ? generalFormat.trim()
    : 'YYYY-MM-DD HH:mm:ss'
  const timeMatch = safeFormat.match(/[Hh].*$/)
  const timeFormat = timeMatch ? timeMatch[0].trim() : 'HH:mm'
  const dateFormat = safeFormat.replace(/[HhmsaA:.\s]+$/g, '').trim() || 'YYYY-MM-DD'
  const preorderDateFormat = dateFormat
    .replace(/Y{2,4}[-/.\s]*/g, '')
    .replace(/[-/.]\s*Y{2,4}/g, '')
    .replace(/^[-/.\s]+|[-/.\s]+$/g, '')
    .trim() || dateFormat
  return {
    dateFormat,
    timeFormat,
    is12Hours: /h/.test(timeFormat),
    preorderDateFormat
  }
}

export const getDateTimeCompanionValues = (generalFormat) => {
  const formats = getDateTimeFormats(generalFormat)
  return {
    format_time: formats.is12Hours ? '12' : '24',
    dates_moment_format: `${formats.preorderDateFormat} ${formats.timeFormat}`.trim()
  }
}

export const getDateTimePreview = (format, date = new Date(2026, 8, 14, 14, 30, 0)) => {
  const { dateFormat, timeFormat, preorderDateFormat } = getDateTimeFormats(format)
  return {
    date: formatWithDateTokens(dateFormat, date),
    time: formatWithDateTokens(timeFormat, date),
    scheduled: formatWithDateTokens(preorderDateFormat, date)
  }
}

export const isDateTimePreset = (value) => DATE_TIME_PRESETS.includes(value)

export const findConfigsByKeys = (configs = [], keys = []) => {
  const byKey = new Map((configs || []).filter(Boolean).map(config => [config.key, config]))
  return keys.map(key => byKey.get(key)).filter(Boolean)
}

export const findConfigByKey = (configs = [], key) =>
  (configs || []).find(config => config?.key === key) || null

export const parseType6Value = (value = '') =>
  String(value || '')
    .split('|')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const [type, ...rest] = part.split(',')
      return { type, value: rest.join(',') }
    })

export const updateType6Value = (current, type, nextValue) => {
  const rows = parseType6Value(current)
  const exists = rows.some(row => row.type === type)
  const updated = exists
    ? rows.map(row => row.type === type ? { ...row, value: nextValue } : row)
    : [...rows, { type, value: nextValue }]
  return updated.map(row => `${row.type},${row.value}`).join('|')
}

export const getPreorderTypeRows = (value, { includeCatering = false } = {}) => {
  const parsed = parseType6Value(value)
  const byType = new Map(parsed.map(row => [row.type, row]))
  const types = PREORDER_TYPE_ORDER.filter(type =>
    includeCatering || !CATERING_PREORDER_TYPES.includes(type)
  )
  parsed.forEach(row => {
    if (!types.includes(row.type) && (includeCatering || !CATERING_PREORDER_TYPES.includes(row.type))) {
      types.push(row.type)
    }
  })
  return types.map(type => byType.get(type) || { type, value: '15' })
}

const SETTINGS_TYPE6_MINUTES_KEYS = [
  'preorder_lead_time',
  'preorder_slot_interval',
  'preorder_time_range'
]

export const getSettingsType6Unit = (configKey) => {
  if (typeof configKey === 'string' && configKey.endsWith('_days')) {
    return { labelKey: 'SETTINGS_PREORDER_DAYS', label: 'Days' }
  }
  if (SETTINGS_TYPE6_MINUTES_KEYS.includes(configKey)) {
    return { labelKey: 'MINUTES', label: 'Minutes' }
  }
  return { labelKey: 'SETTINGS_TYPE6_VALUE', label: 'Value' }
}

export const getSettingsType6TypeLabel = (type) => {
  if (PREORDER_TYPE_LABELS[type]) return PREORDER_TYPE_LABELS[type]
  const normalized = String(type || '').replace(/_/g, ' ')
  return {
    labelKey: `SETTINGS_ORDER_TYPE_${type || ''}`,
    label: normalized
  }
}

export const RESERVATION_SETTING_FIELDS = [
  { key: 'min_guests_reservation', type: 'number', labelKey: 'SETTINGS_RESERVATION_MIN_GUESTS', label: 'Minimum guests' },
  { key: 'max_guests_reservation', type: 'number', labelKey: 'SETTINGS_RESERVATION_MAX_GUESTS', label: 'Maximum guests' },
  { key: 'min_time_reserve_minutes', type: 'number', labelKey: 'SETTINGS_RESERVATION_MIN_ADVANCE', label: 'Minimum time in advance (minutes)' },
  { key: 'max_time_reserve_days', type: 'number', labelKey: 'SETTINGS_RESERVATION_MAX_ADVANCE', label: 'Maximum time in advance (days)' },
  { key: 'late_arrival_hold_minutes', type: 'number', labelKey: 'SETTINGS_RESERVATION_LATE_HOLD', label: 'Hold the table if the guest is late (minutes)' },
  { key: 'max_reservation_sites', type: 'number', labelKey: 'SETTINGS_RESERVATION_MAX_SITES', label: 'Max reservation sites' },
  { key: 'allow_preorder_reservation', type: 'boolean', labelKey: 'SETTINGS_RESERVATION_PREORDER', label: 'Allow food preorder when booking' }
]

export const parseReservationSettingValue = (value) => parseJsonObject(value)

const coerceReservationFieldValue = (field, nextValue, previous) => {
  if (field?.type === 'boolean') {
    return nextValue === true || nextValue === '1' || nextValue === 1
  }
  if (nextValue === '' || nextValue == null) return 0
  const numeric = Number(nextValue)
  return Number.isFinite(numeric) ? numeric : (previous ?? 0)
}

export const updateReservationSettingValue = (current, key, nextValue) => {
  const parsed = parseReservationSettingValue(current)
  const field = RESERVATION_SETTING_FIELDS.find(item => item.key === key)
  return JSON.stringify({
    ...parsed,
    [key]: coerceReservationFieldValue(field, nextValue, parsed[key])
  })
}

export const normalizeConfigOptions = (options) => {
  if (Array.isArray(options)) return options
  if (typeof options === 'string' && options.trim()) {
    try {
      const parsed = JSON.parse(options)
      return Array.isArray(parsed) ? parsed : []
    } catch (error) {
      return []
    }
  }
  return []
}

export const getConfigToggleValues = (config = {}) => {
  const options = normalizeConfigOptions(config.options)
  const on = options.find(option => /^(1|true|yes)$/i.test(String(option.value)))
  const off = options.find(option => /^(0|false|no)$/i.test(String(option.value)))
  return {
    on: on?.value ?? '1',
    off: off?.value ?? '0'
  }
}

export const isConfigOn = (config = {}) => {
  const { on } = getConfigToggleValues(config)
  return String(config.value).toLowerCase() === String(on).toLowerCase()
}

export const getRecaptchaSubmitErrorCodes = ({ type, configs = [] } = {}) => {
  const validation = getRecaptchaValidation({ type, configs })
  const enabled = ['security_recaptcha_auth', 'security_recaptcha_signup', 'security_recaptcha_order']
    .some(key => isConfigOn((configs || []).find(config => config?.key === key)))
  if (validation.errors.security_recaptcha_score_v3 === 'SETTINGS_RECAPTCHA_SCORE_RANGE') {
    return ['SETTINGS_RECAPTCHA_SCORE_RANGE']
  }
  if (enabled && !validation.isValid) {
    return ['SETTINGS_RECAPTCHA_ENABLE_INVALID']
  }
  return []
}

/**
 * Dependent fields (progressive disclosure).
 * A dependent config is rendered only while its master config matches.
 *   { key: masterKey }               master must be on (1 / true / yes)
 *   { key: masterKey, on: false }    master must be off
 *   { key: masterKey, values: [..] } master raw value must be in the list
 * Hidden fields are unmounted; their stored values are left untouched.
 * A master that is not part of the category configs never hides anything.
 */
const dependsOn = (key, on = true) => (on ? { key } : { key, on: false })

const dependAll = (keys, dependency) => Object.fromEntries(keys.map(key => [key, dependency]))

export const SETTINGS_FIELD_DEPENDENCIES = {
  // Security & login
  ...dependAll(['facebook_id', 'facebook_secret'], dependsOn('facebook_login_enabled')),
  ...dependAll([
    'google_login_client_id',
    'google_client_secret',
    'google_client_id',
    'google_login_auth_domain',
    'google_login_api_key',
    'google_login_ios_client_id'
  ], dependsOn('google_login_enabled')),
  ...dependAll([
    'apple_team_id',
    'apple_login_client_id',
    'apple_login_private_key',
    'apple_login_private_key_id',
    'apple_login_bundle_id'
  ], dependsOn('apple_login_enabled')),
  ...dependAll(['security_auth_attempts', 'security_auth_penalty'], dependsOn('security_auth_limit_enabled')),
  ...dependAll(['security_auth_ip_attempts', 'security_auth_ip_penalty'], dependsOn('security_auth_ip_limit_enabled')),
  ...dependAll(['forgot_password_rate_attempts', 'forgot_password_rate_minutes'], dependsOn('forgot_password_rate_enabled')),
  // Apps & developers
  intercom_api_key: dependsOn('intercom_enabled'),
  ...dependAll(['spoonity_vendor', 'spoonity_title'], dependsOn('spoonity_enabled')),
  // Orders & checkout
  ...dependAll(['max_days_preorder', 'preorder_maximum_days'], dependsOn('preorder_status_enabled')),
  allowed_order_types_guest_checkout: dependsOn('guest_checkout_enabled'),
  order_deadlines_delayed_time: dependsOn('order_deadlines_enabled'),
  ...dependAll([
    'multi_business_checkout_show_combined_delivery_fee',
    'multi_business_checkout_show_combined_driver_tip',
    'multi_business_checkout_progress_bar_style',
    'multi_business_checkout_coupon_input_style',
    'multi_business_checkout_remove_individual_buttons',
    ...MULTI_CHECKOUT_DISCOUNT_KEYS,
    'delivery_fee_free_multi_checkout'
  ], dependsOn('checkout_multi_business_enabled')),
  // Platform
  guest_uuid_max_days: dependsOn('guest_uuid_access'),
  terms_and_conditions_url: dependsOn('terms_and_conditions'),
  business_signup_enabled_default: dependsOn('business_signup_allow'),
  driver_signup_enabled_default: dependsOn('driver_signup_allow'),
  ...dependAll(['driver_tip_type', 'driver_tip_options'], dependsOn('driver_tip_use_custom')),
  // Drivers
  order_update_location_customer_distance: dependsOn('order_update_location_customer'),
  order_update_location_business_distance: dependsOn('order_update_location_business'),
  min_distance_driver_radio: dependsOn('use_distance_driver_radio'),
  // Emails & notifications
  notification_in_app_position: dependsOn('notification_in_app_enabled'),
  ...dependAll([
    'email_smtp_host',
    'email_smtp_username',
    'email_smtp_password',
    'email_smtp_encryption',
    'email_smtp_port'
  ], dependsOn('email_smtp_use_default', false)),
  // Payments: sandbox mode decides which key pair applies
  ...dependAll(['platform_store_logo', 'platform_store_name', 'platform_store_header', 'platform_store_giftcard_enabled'], dependsOn('platform_store_enabled')),
  ...dependAll(['stripe_publishable_sandbox', 'stripe_secret_sandbox'], dependsOn('stripe_sandbox')),
  ...dependAll(['stripe_publishable', 'stripe_secret'], dependsOn('stripe_sandbox', false)),
  ...dependAll(['global_apple_pay_publishable_sandbox', 'global_apple_pay_secret_sandbox'], dependsOn('global_apple_pay_sandbox')),
  ...dependAll(['global_apple_pay_publishable', 'global_apple_pay_secret'], dependsOn('global_apple_pay_sandbox', false)),
  ...dependAll(['global_google_pay_publishable_sandbox', 'global_google_pay_secret_sandbox'], dependsOn('global_google_pay_sandbox')),
  ...dependAll(['global_google_pay_publishable', 'global_google_pay_secret'], dependsOn('global_google_pay_sandbox', false)),
  stripe_connect_client_id_sandbox: dependsOn('stripe_connect_sandbox'),
  stripe_connect_client_id: dependsOn('stripe_connect_sandbox', false)
}

const MAX_DEPENDENCY_DEPTH = 5

export const isSettingsToggleOn = (value) =>
  /^(1|true|yes)$/i.test(String(value ?? '').trim())

export const getSettingsFieldDependency = (configKey) => (
  configKey && Object.prototype.hasOwnProperty.call(SETTINGS_FIELD_DEPENDENCIES, configKey)
    ? SETTINGS_FIELD_DEPENDENCIES[configKey]
    : null
)

export const isSettingsDependencyMet = (dependency, configs = []) => {
  if (!dependency) return true
  const master = findConfigByKey(configs, dependency.key)
  if (!master) return true
  if (Array.isArray(dependency.values)) {
    const current = String(master.value ?? '').trim()
    return dependency.values.some(value => String(value) === current)
  }
  return isSettingsToggleOn(master.value) === (dependency.on !== false)
}

export const isSettingsConfigVisible = (config, configs = []) =>
  isSettingsDependencyMet(getSettingsFieldDependency(config?.key), configs)

export const getVisibleSettingsConfigs = (configs = []) =>
  (configs || []).filter(config => config && isSettingsConfigVisible(config, configs))

/**
 * Some catalog rows ship instructional text as the stored value
 * ("Add your Facebook ID"). Show that text as the placeholder and keep the
 * input empty so the user is not editing a fake credential.
 */
export const getSettingsInputPresentation = (config = {}) => {
  const raw = config?.value ?? ''
  const value = String(raw).trim()
  const name = config?.name || config?.key || ''
  if (value && !isSettingsCredentialFilled(config)) {
    return { value: '', placeholder: value }
  }
  return { value: raw, placeholder: name }
}

export const resolveSettingsFocusKey = (focusKey, configs = []) => {
  let key = focusKey
  for (let depth = 0; key && depth < MAX_DEPENDENCY_DEPTH; depth++) {
    const dependency = getSettingsFieldDependency(key)
    if (!dependency || isSettingsDependencyMet(dependency, configs)) return key
    key = dependency.key
  }
  return key
}

export const applySettingsConfigCopy = (config = {}, t) => {
  const copy = getSettingsConfigCopy(config)
  const effect = SETTINGS_CONFIG_EFFECT[config.key]
  if (!copy && !effect) return config
  return {
    ...config,
    ...(copy
      ? {
          name: t ? t(copy.labelKey, copy.label) : copy.label,
          description: copy.help
            ? (t ? t(copy.helpKey, copy.help) : copy.help)
            : config.description
        }
      : {}),
    ...(effect
      ? { description: t ? t(effect.helpKey, effect.help) : effect.help }
      : {})
  }
}

export const getLeftoverSettingsConfigs = (configs = []) =>
  (configs || []).filter(config => config && !isCustomBlockConfig(config.key))

const customBlockConfigKeys = new Set(
  Object.values(SETTINGS_CUSTOM_BLOCKS).flatMap(block => block.keys)
)

// Leftover enable switches that belong above a custom block. Dependency
// masters are inferred. reservation_enabled is listed because the table
// stays visible when the switch is off.
const SETTINGS_CUSTOM_BLOCK_LEADING_KEYS = new Set([
  'reservation_enabled'
])

export const isSettingsCustomBlockMaster = (configKey) => {
  if (!configKey || customBlockConfigKeys.has(configKey)) return false
  if (SETTINGS_CUSTOM_BLOCK_LEADING_KEYS.has(configKey)) return true
  return Object.entries(SETTINGS_FIELD_DEPENDENCIES).some(([dependentKey, dependency]) => (
    dependency?.key === configKey && customBlockConfigKeys.has(dependentKey)
  ))
}

export const isSettingsValueDirty = (nextValue, savedValue) =>
  String(nextValue) !== String(savedValue)

export const mergeSettingsChanges = (changes, item, nextValue, savedValue) => {
  const next = [...(changes || [])]
  if (!item?.id) return next
  if (!isSettingsValueDirty(nextValue, savedValue)) {
    return next.filter(config => config.id !== item.id)
  }
  if (next.some(config => config.id === item.id)) {
    return next.map(config => (
      config.id === item.id ? { ...config, value: nextValue } : config
    ))
  }
  return [...next, { ...item, value: nextValue }]
}
