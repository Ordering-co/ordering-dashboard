import dayjs from 'dayjs'
import { USERS_FILTER_INITIAL_VALUES } from '../../../../../components/UsersFilter'

// redesign UC-B3 (decisions 2 and 3; M-C7): the pure side of the customers filter bar. No React, no context.
// `multiFilterValues` belongs to K/UsersList, which turns every key that is not `null` into a condition of the API, so the bar
// only ever writes COMPLETE objects (`completeFilterValues`) and a chip exists for every key that makes a condition.
// redesign BO-B2 (promotion): moved from CustomersDirectory/customerFilters.js; the customers list re-exports it from there.

const DATETIME = 'YYYY-MM-DD HH:mm:ss'
const DAY = 'YYYY-MM-DD'

const initialValues = () => JSON.parse(JSON.stringify(USERS_FILTER_INITIAL_VALUES))

/** The fields of the «Filters» sheet (the other values have a pill in the bar). */
export const SHEET_KEYS = ['id', 'externalId', 'name', 'lastname', 'email', 'ordersCount']

/** The presets of the Sign-up date pill, in the order they are offered. */
export const SIGN_UP_PRESETS = ['today', 'yesterday', 'last7', 'last30']

// Days back from today, as K/UsersFilter.handleChangeDateType writes them (the start of that day)
const DAYS_BACK = { today: 0, yesterday: 1, last7: 7, last30: 30 }

const DATE_KEYS = ['dateType', 'deliveryFromDatetime', 'deliveryEndDatetime']

const OPERATORS = { eq: '=', gt: '>', lt: '<', ge: '>=', le: '<=' }

// redesign UC-B3: own keys. The shared TODAY / LAST_7_DAYS carry typos in the runtime catalog of some projects (OC-Q1-06).
export const signUpPresetsOf = (t) => [
  { value: 'default', label: t('ANY', 'Any') },
  { value: 'today', label: t('CUSTOMERS_RANGE_TODAY', 'Today') },
  { value: 'yesterday', label: t('CUSTOMERS_RANGE_YESTERDAY', 'Yesterday') },
  { value: 'last7', label: t('CUSTOMERS_RANGE_LAST_7_DAYS', 'Last 7 days') },
  { value: 'last30', label: t('CUSTOMERS_RANGE_LAST_30_DAYS', 'Last 30 days') }
]

/**
 * The complete filter object after `change`: the initial values, the current ones, the change. A key that is `undefined`
 * (the controller leaves one when a date is cleared) goes back to its initial value: `undefined` is not `null`, and the
 * controller would send it as a condition.
 */
export const completeFilterValues = (current, change) => {
  const merged = { ...initialValues(), ...(current || {}), ...(change || {}) }
  const initial = initialValues()
  // the object and the list are never shared with the caller's: a later edit of one must not reach the other
  if (merged.ordersCount) merged.ordersCount = { ...merged.ordersCount }
  if (Array.isArray(merged.cityIds)) merged.cityIds = [...merged.cityIds]
  Object.keys(merged).forEach(key => {
    if (merged[key] === undefined) merged[key] = initial[key] ?? null
  })
  return merged
}

const hasText = (value) => value !== null && value !== undefined && String(value).trim() !== ''
const isDigitsId = (value) => parseInt(value, 10) > 0
const isSet = (value) => value !== null && value !== undefined && value !== ''

// One predicate per key, the same ones K/UsersList uses to turn a value into a condition (`:298-460`)
const ACTIVE = {
  id: isDigitsId,
  externalId: isDigitsId,
  name: hasText,
  lastname: hasText,
  email: hasText,
  cellphone: hasText,
  countryPhoneCode: isSet,
  ordersCount: (value) => isSet(value?.value),
  phoneVerified: isSet,
  emailVerified: isSet,
  loyaltyLevel: isSet,
  enabled: isSet,
  userType: isSet,
  cityIds: (value) => Array.isArray(value) && value.length > 0
}

const isActiveKey = (values, key) => ACTIVE[key](values[key])

// The sign-up date is three keys: it is on when it holds a start or an end
const hasSignUp = (values) => isSet(values.deliveryFromDatetime) || isSet(values.deliveryEndDatetime)

// The order the chips are drawn in: the sheet fields, the pills, then the keys only ⌘K can seed
const CHIP_ORDER = [
  'id', 'externalId', 'name', 'lastname', 'email', 'ordersCount',
  'phoneVerified', 'emailVerified', 'dateType', 'loyaltyLevel',
  'cellphone', 'countryPhoneCode', 'enabled', 'cityIds', 'userType'
]

const isChipActive = (values, key) => (key === 'dateType' ? hasSignUp(values) : isActiveKey(values, key))

/** How many fields of the «Filters» sheet hold a value: the count of its button. `sheetKeys` are the fields the sheet shows. */
export const sheetActiveCount = (multiFilterValues, sheetKeys = SHEET_KEYS) => {
  const values = completeFilterValues(multiFilterValues)
  return sheetKeys.filter(key => isActiveKey(values, key)).length
}

/** True when the search, the Orders control or any multi filter narrows the list. */
export const hasActiveFilters = ({ searchValue, orderFilterValue, multiFilterValues } = {}) => {
  if (hasText(searchValue)) return true
  if (orderFilterValue !== null && orderFilterValue !== undefined) return true
  const values = completeFilterValues(multiFilterValues)
  return CHIP_ORDER.some(key => isChipActive(values, key))
}

const dayOf = (datetime) => (isSet(datetime) ? String(datetime).slice(0, 10) : null)

/**
 * What the Sign-up date pill and its chip say: the preset's name, or the days of the range in the project format. `''` for none.
 */
export const signUpText = (multiFilterValues, { t, formatDate }) => {
  const values = completeFilterValues(multiFilterValues)
  if (!hasSignUp(values)) return ''
  const preset = signUpPresetsOf(t).find(item => item.value === values.dateType && SIGN_UP_PRESETS.includes(item.value))
  if (preset) return preset.label
  const from = dayOf(values.deliveryFromDatetime)
  const to = dayOf(values.deliveryEndDatetime)
  if (from && to) return `${formatDate(from)} – ${formatDate(to)}`
  if (from) return `${t('FROM', 'From')} ${formatDate(from)}`
  return `${t('TO', 'To')} ${formatDate(to)}`
}

const yesNo = (value, t) => (value ? t('YES', 'Yes') : t('NO', 'No'))

const userTypeName = (value, t) => ({
  0: t('ADMINISTRATOR', 'Administrator'),
  1: t('CITY_MANAGER', 'City manager'),
  2: t('BUSINESS_OWNER', 'Business owner'),
  3: t('USER', 'User'),
  9: t('CALL_CENTER_AGENT', 'Call center agent')
}[value] ?? String(value))

/**
 * One chip per active value, as `[{ key, label }]`. `key` is the key of `multiFilterValues` the chip clears (the three date
 * keys are one chip, keyed `dateType`). `loyaltyLevels` is `{ loading, levels: [{ id, name }] }`; `formatDate(day)` writes a
 * `YYYY-MM-DD` day in the project format.
 */
export const activeFilterChips = (multiFilterValues, { t, loyaltyLevels, formatDate }) => {
  const values = completeFilterValues(multiFilterValues)
  const levels = Array.isArray(loyaltyLevels?.levels) ? loyaltyLevels.levels : []
  const labels = {
    id: t('ID', 'ID'),
    externalId: t('EXTERNAL_ID', 'External ID'),
    name: t('NAME', 'Name'),
    lastname: t('LAST_NAME', 'Last name'),
    email: t('EMAIL', 'Email'),
    ordersCount: t('AMOUNT_OF_ORDERS', 'Amount of orders'),
    phoneVerified: t('PHONE_VERIFIED', 'Phone verified'),
    emailVerified: t('EMAIL_VERIFIED', 'Email verified'),
    dateType: t('SIGN_UP_DATE', 'Sign up date'),
    loyaltyLevel: t('LOYALTY_LEVEL', 'Loyalty level'),
    cellphone: t('PHONE_NUMBER', 'Phone number'),
    countryPhoneCode: t('COUNTRY_PHONE_CODE', 'Country phone code'),
    enabled: t('STATUS', 'Status'),
    cityIds: t('CITIES', 'Cities'),
    userType: t('USER_TYPE', 'User type')
  }
  const valueOf = {
    ordersCount: () => `${OPERATORS[values.ordersCount.condition] ?? '='} ${values.ordersCount.value}`,
    phoneVerified: () => yesNo(values.phoneVerified, t),
    emailVerified: () => yesNo(values.emailVerified, t),
    dateType: () => signUpText(values, { t, formatDate }),
    loyaltyLevel: () => levels.find(level => String(level.id) === String(values.loyaltyLevel))?.name ?? String(values.loyaltyLevel),
    countryPhoneCode: () => `+${values.countryPhoneCode}`,
    enabled: () => (values.enabled ? t('ACTIVE', 'Active') : t('INACTIVE', 'Inactive')),
    cityIds: () => String(values.cityIds.length),
    userType: () => userTypeName(values.userType, t)
  }
  return CHIP_ORDER
    .filter(key => isChipActive(values, key))
    .map(key => ({ key, label: `${labels[key]}: ${valueOf[key] ? valueOf[key]() : values[key]}` }))
}

/**
 * The complete object with one key back to its initial value. The three date keys go together, whichever of them is named;
 * the amount of orders goes back to an empty number and the = operator.
 */
export const clearFilterKey = (multiFilterValues, key) => {
  const next = completeFilterValues(multiFilterValues)
  const initial = initialValues()
  const keys = DATE_KEYS.includes(key) ? DATE_KEYS : [key]
  keys.forEach(item => { next[item] = initial[item] })
  return next
}

/** The sheet's own fields (`sheetKeys`) back to empty (the pills keep their values). */
export const clearSheetFields = (multiFilterValues, sheetKeys = SHEET_KEYS) => sheetKeys.reduce((values, key) => clearFilterKey(values, key), completeFilterValues(multiFilterValues))

/**
 * The date keys of a preset of the Sign-up date pill, as K/UsersFilter.handleChangeDateType writes them: `default` («Any») and
 * `term` hold no days; a preset sets the start only. The end goes back to null too: the controller keeps the end it had, and a
 * stale end of an earlier custom range would cut the preset («Today» would stop on the 5th).
 */
export const signUpPresetToValues = (preset, now = dayjs()) => {
  if (preset === 'default' || preset === 'term') return { dateType: preset, deliveryFromDatetime: null, deliveryEndDatetime: null }
  if (!(preset in DAYS_BACK)) return {}
  const start = dayjs(now).subtract(DAYS_BACK[preset], 'day').startOf('day').format(DATETIME)
  return { dateType: preset, deliveryFromDatetime: start, deliveryEndDatetime: null }
}

/**
 * The date keys of a custom range (`YYYY-MM-DD` days or null), as the date selector writes them today: `term`, the start at
 * 00:00:00 and the end at 23:59:59. No days is «Any».
 */
export const rangeToValues = (fromDay, toDay) => {
  if (!fromDay && !toDay) return signUpPresetToValues('default')
  return {
    dateType: 'term',
    deliveryFromDatetime: fromDay ? `${dayjs(fromDay, DAY).format(DAY)} 00:00:00` : null,
    deliveryEndDatetime: toDay ? `${dayjs(toDay, DAY).format(DAY)} 23:59:59` : null
  }
}
