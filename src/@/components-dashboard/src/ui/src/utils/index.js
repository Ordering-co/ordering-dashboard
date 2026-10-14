import React, { useCallback, useRef } from 'react'
import { useActiveFeatureFlags } from 'posthog-js/react'
import FaCcMastercard from '@meronex/icons/fa/FaCcMastercard'
import FaCcVisa from '@meronex/icons/fa/FaCcVisa'
import FaCreditCard from '@meronex/icons/fa/FaCreditCard'
import moment from 'moment'
import { CURRENCY } from '../config/currency.js'
import {
  getDashboardFaviconUrl,
  getDashboardLogoUrl,
  getDashboardNotificationIconUrl as resolveDashboardNotificationIconUrl,
  isOfficialOrderingDashboardHost
} from '~/utils/dashboardBranding'

import { useLanguage, useSession, CODES } from '../../../index.js'
import { getLocalStorageItem } from '../../../webStrategy'

/**
 * Prefix root-relative public URLs with Vite `base` (subpath / CDN deploys).
 * Leaves absolute (http/https), data:, and blob: URLs unchanged.
 */
export function publicAssetUrl (path) {
  if (path == null || path === '') return path
  const s = String(path).trim()
  if (/^(https?:)?\/\//i.test(s) || s.startsWith('data:') || s.startsWith('blob:')) return s
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'
  const rel = s.replace(/^\//, '')
  if (!base || base === '/') return `/${rel}`
  const prefix = base.endsWith('/') ? base : `${base}/`
  return `${prefix}${rel}`
}

export function getDashboardNotificationIconUrl (configs, fallback) {
  return resolveDashboardNotificationIconUrl(configs, fallback)
}

export {
  getDashboardFaviconUrl,
  getDashboardLogoUrl,
  isOfficialOrderingDashboardHost
}

export const optimizeImage = (url, params, fallback) => {
  if (!url && fallback) return fallback
  params = params && params.length > 0 ? `,${params}` : ''
  if (url != null && url.indexOf('res.cloudinary.com') !== -1) {
    const parts = url.split('upload')
    url = `${parts[0]}upload/f_auto,q_auto${params}${parts[1]}`
  }
  return url
}

export const formatYearlyPrice = (props) => {
  const {
    isLgText = true,
    onlyAmount = false,
    yearlyPrice,
    t
  } = props

  const montlyPrice = yearlyPrice / 12
  return onlyAmount
    ? montlyPrice
    : isLgText
      ? t('PRICE_PLAN_ANNUAL', `/mo billed at ${parseBillingPrice(yearlyPrice)}/yr`)
      : parseBillingPrice(montlyPrice)
}

export const priceTypeDictionary = ({ type, t }) => {
  const dict = {
    monthly: t?.('MONTH', 'Month') ?? 'Month',
    annual: t?.('YEAR', 'Year') ?? 'Year'
  }
  return dict?.[type] ?? type
}

export const parseBillingPrice = (value, options = {}) => {
  const formatNumber = {
    decimal: options?.decimal || 2,
    separator: options?.separator || '.',
    thousand: options?.thousand || ',',
    currency: options?.currency || '$',
    currencyPosition: options?.currencyPosition || 'left',
    isTruncable: options?.isTruncable
  }
  let number = parseBillingNumber(value, formatNumber)
  if (formatNumber.currencyPosition?.toLowerCase() === 'left') {
    number = formatNumber.currency + number
  } else {
    number = number + formatNumber.currency
  }
  return number
}

export const parseBillingNumber = (value, options = {}) => {
  value = parseFloat(value) || 0
  const formatNumber = {
    decimal: options?.decimal || 2,
    separator: options?.separator || ',',
    thousand: options?.thousand || '.'
  }
  let number = value
  if (options?.isTruncable) {
    number = number.toString()
    const numberParts = number.split(formatNumber.separator)
    let decimalPart = numberParts[1] ?? ''
    decimalPart = decimalPart.padEnd(formatNumber.decimal, '0').substring(0, formatNumber.decimal)
    number = numberParts[0] + '.' + decimalPart
  } else {
    number = value % 1 !== 0
      ? value.toFixed(formatNumber.decimal)
      : number.toString()
  }
  number = number.toString()
  if (number.indexOf('.')) {
    number = number.replace('.', formatNumber.separator)
  } else if (number.indexOf(',')) {
    number = number.replace(',', formatNumber.separator)
  }
  const numberParts = number.split(formatNumber.separator)
  numberParts[0] = numberParts[0].replace(/(.)(?=(\d{3})+$)/g, '$1' + formatNumber.thousand)
  number = numberParts.join(formatNumber.separator)
  return number
}

export const getIconCard = (brand = '') => {
  const value = brand?.toLowerCase()
  switch (value) {
    case 'visa':
      return <FaCcVisa />
    case 'mastercard':
      return <FaCcMastercard />
    default:
      return <FaCreditCard />
  }
}
/**
 * Function to get unique id
 */
export const getUniqueId = () => {
  const dateString = Date.now().toString(36)
  const randomness = Math.random().toString(36).substr(2)
  return dateString + randomness
}

/**
 * Function to convert a string in string capitalized
 * @param {string} str string to capitalize
 */
export const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1)

export const fallbackLogisticEventsText = (key) => {
  const eventNames = {
    LOG_LOGISTIC_STARTED: '<strong>Logistic:</strong> Process started.',
    LOG_LOGISTIC_FINISHED: '<strong>Logistic:</strong> Process finished.',
    LOG_LOGISTIC_CANCELED: '<strong>Logistic:</strong> Process was canceled.',
    LOG_LOGISTIC_NOT_GROUPED: '<strong>Logistic:</strong> Order was not grouped.',
    LOG_LOGISTIC_ASSIGN_REQUEST_ACCEPTED: '<strong>Logistic:</strong> Request was accepted by driver _driver_.',
    LOG_LOGISTIC_ASSIGN_REQUEST_ACCEPTED_GROUP: '<strong>Logistic:</strong> Request was accepted with orders _orders_ by driver _driver_.',
    LOG_LOGISTIC_DRIVER_FOUND: '<strong>Logistic:</strong> Driver _driver_ found at _distance_.',
    LOG_LOGISTIC_REQUEST_AUTOREJECTED: '<strong>Logistic:</strong> Request of the driver _driver_ was auto-rejected by process.',
    LOG_LOGISTIC_REQUEST_AUTOREJECTED_GROUP: '<strong>Logistic:</strong> Request of the driver _driver_ was auto-rejected with orders _orders_ by process.',
    LOG_LOGISTIC_DRIVER_NOT_FOUND: '<strong>Logistic:</strong> Drivers was not found.',
    LOG_LOGISTIC_GROUPED: '<strong>Logistic:</strong> Order was grouped with orders _orders_.',
    LOG_LOGISTIC_ASSIGN_REQUEST_REJECTED: '<strong>Logistic:</strong> Request was rejected manually by driver _driver_.',
    LOG_LOGISTIC_ASSIGN_REQUEST_REJECTED_GROUP: '<strong>Logistic:</strong> Request was rejected manually with orders _orders_ by driver _driver_.',
    LOG_LOGISTIC_DRIVER_AUTOACCEPTED: '<strong>Logistic:</strong> Order was auto-assigned and auto-accepted by driver _driver_ at _distance_.',
    LOG_LOGISTIC_DRIVER_AUTOASSIGNED: '<strong>Logistic:</strong> Order was auto-assigned by driver _driver_ at _distance_.',
    LOG_LOGISTIC_DRIVER_GROUP_NOT_FOUND: '<strong>Logistic:</strong> Driver group was not found for _status_ status.',
    LOG_EVENT_UNKNOWN: '<strong>Logistic:</strong> Event _event_ is unknown.',
    LOG_LOGISTIC_GROUPED_TIME_DATA: '<strong>Logistic:</strong> Order was grouped with orders _orders_. Pickup distance between orders is _max_time_between_pickup_, delivery distance between orders is _max_time_between_delivery_, est. pickup time between orders is _pickup_distance_time_ and est. delivery time between orders is _delivery_distance_time_.',
    LOG_LOGISTIC_DRIVER_FOUND_GROUP: '<strong>Logistic:</strong> Driver <strong>_driver_</strong> found to the group at <strong>_distance_</strong>.',
    LOG_LOGISTIC_DRIVER_NOT_FOUND_GROUP: '<strong>Logistic:</strong> Drivers was not found to the group.',
    LOG_LOGISTIC_DRIVER_FOUND_IN_COVERAGE: '<strong>Logistic:</strong> Driver <strong>_driver_</strong> found to the order at <strong>_distance_</strong> in _coverage_ of coverage.',
    LOG_LOGISTIC_DRIVER_FOUND_IN_COVERAGE_GROUP: '<strong>Logistic:</strong> Driver <strong>_driver_</strong> found to the group at <strong>_distance_</strong> in _coverage_ of coverage.',
    LOG_LOGISTIC_DRIVER_FOUND_OUT_COVERAGE: '<strong>Logistic:</strong> Driver <strong>_driver_</strong> found to the order at <strong>_distance_</strong> out _coverage_ of coverage.',
    LOG_LOGISTIC_DRIVER_FOUND_OUT_COVERAGE_GROUP: '<strong>Logistic:</strong> Driver <strong>_driver_</strong> found to the group at <strong>_distance_</strong> out _coverage_ of coverage.',
    LOG_LOGISTIC_DRIVER_AUTOACCEPTED_GROUP: '<strong>Logistic:</strong> Order in group was auto-assigned and auto-accepted by driver _driver_ at _distance_.',
    LOG_LOGISTIC_MANUAL_DRIVER_ASSIGNMENT: '<strong>Logistic:</strong> Driver assigned manually.',
    LOG_LOGISTIC_EXPIRED: '<strong>Logistic:</strong> Logistic expired.<br /><strong>Reason:</strong>: _reason_.',
    LOG_LOGISTIC_RESOLVED: '<strong>Logistic:</strong> Logistic resolved.',
    LOG_LOGISTIC_RESET: '<strong>Logistic:</strong> Logistic reset.',
    LOG_LOGISTIC_ORDER_QUEUED: '<strong>Logistic:</strong> Order to queue.',
    LOG_LOGISTIC_DRIVER_COMPANY_NOT_FOUND: 'Driver company no found.',
    LOG_LOGISTIC_DRIVER_COMPANY_FOUND: 'Driver company <b>_driver_company_</b> found.',
    LOG_LOGISTIC_DRIVER_COMPANY_AUTOACCEPTED: 'Driver company <b>_driver_company_</b> auto-accepted.',
    LOG_LOGISTIC_DRIVER_COMPANY_REQUEST_CANCELED_UNSUCCESSFULLY: 'Request to <b>_driver_company_</b> was canceled unsuccessfully. (Attempt: _attempt_, Code: _code_).<br />Response: _response_',
    LOG_LOGISTIC_DRIVER_COMPANY_REQUEST_CANCELED_SUCCESSFULLY: 'Request to <b>_driver_company_</b> was canceled successfully. (Attempt: _attempt_, Code: _code_).<br />Response: _response_',
    LOG_LOGISTIC_DRIVER_COMPANY_REQUEST_NOT_CANCELED: 'Request to <b>_driver_company_</b> was not canceled for <code>_reason_</code>. (Attempt: _attempt_)',
    LOG_LOGISTIC_DRIVER_COMPANY_REQUEST_SENT_SUCCESSFULLY: 'Request to <b>_driver_company_</b> was sent successfully. (Attempt: _attempt_, Code: _code_).<br />Response: _response_',
    LOG_LOGISTIC_DRIVER_COMPANY_REQUEST_SENT_UNSUCCESSFULLY: 'Request to <b>_driver_company_</b> was sent unsuccessfully. (Attempt: _attempt_, Code: _code_).<br />Response: _response_',
    LOG_LOGISTIC_DRIVER_COMPANY_REQUEST_NOT_SENT: 'Request to <b>_driver_company_</b> was not sent for <code>_reason_</code>. (Attempt: _attempt_)',
    LOG_LOGISTIC_DRIVER_COMPANY_REQUEST_DRIVER_ACCEPTED: 'Request to <b>_driver_company_</b> was accepted by driver <b>_external_driver_</b>.',
    LOG_LOGISTIC_DRIVER_COMPANY_WAITING_FOR_DRIVERS: 'Waiting for drivers of <b>_driver_company_</b>.'
  }
  return eventNames[key] ?? capitalize(key.toLowerCase().replace(/_/g, ' '))
}

export const DriverTipsOptions = [0, 10, 15, 20, 25]

/**
 * Function to calculate time to scroll element
 * @param {*} t = current time
 * @param {*} b = start value
 * @param {*} c = change in value
 * @param {*} d = duration
 */
const easeInOutQuad = (t, b, c, d) => {
  t /= d / 2
  if (t < 1) return c / 2 * t * t + b
  t--
  return -c / 2 * (t * (t - 2) - 1) + b
}

/**
 * Function to do scroll of one element to another
 * @param {*} element = parent element
 * @param {*} to = position Top of child element
 * @param {*} duration = time to animation
 */
export const scrollTo = (element, to, duration) => {
  const start = element.scrollTop
  const change = to - start
  let currentTime = 0
  const increment = 20

  const animateScroll = () => {
    currentTime += increment
    const val = easeInOutQuad(currentTime, start, change, duration)
    element.scrollTop = val
    if (currentTime < duration && val > 0) {
      setTimeout(animateScroll, increment)
    }
  }
  animateScroll()
}

/**
 * Function to get formatted link to include in iframes
 * @param {string} url = youtube - vimeo link video
 */
export const formatUrlVideo = (url) => {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/
  const match = url.match(regExp)
  const id = (match && match[7].length === 11) ? match[7] : false
  return `https://www.youtube-nocookie.com/embed/${id}`
}

/**
 * Function to convert delivery time in minutes
 * @param {string} time business delivery time
 */
export const convertHoursToMinutes = (time) => {
  if (!time) return '0min'
  const [hour, minute] = time.split(':')
  const result = (parseInt(hour, 10) * 60) + parseInt(minute, 10)
  return `${result}min`
}

/**
 * Function to convert star rate in width to display
 * @param {int} qualification star rate or qualification
 */
export const getStarWidth = (qualification) => {
  if (qualification) {
    return qualification / 5 * 100 + '%'
  } else {
    return '0%'
  }
}

/**
 * Function to calculate differnece with current time in minutes
 * @param {string} time past time
 */
export const getAgoMinutes = (time) => {
  const totalMinutes = ((moment().utc() - moment(time)) / 1000 / 60).toFixed(0)
  const totalHours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes - totalHours * 60
  const days = Math.floor(totalHours / 24)
  const hours = totalHours - days * 24
  if (days > 0) {
    return `-${days} days ${hours}:${minutes} hrs`
  } else if (hours > 0) {
    return `-${hours}:${minutes} hrs`
  } else return `-00:${minutes} hrs`
}

/**
 * Function to transform bytes to kb
 * @param {number} bytes for transform
 *
 */
export const bytesConverter = bytes => {
  return Math.floor(bytes / 1024)
}

/**
 * The function `validImageSize` checks if the dimensions of an image file match the specified width
 * and height.
 */
export const validImageSize = async ({ width, height, file }) => {
  const img = new Image()
  img.src = URL.createObjectURL(file)

  try {
    await img.decode()
    return img.width === parseInt(width, 10) && img.height === parseInt(height, 10)
  } catch {
    return false
  } finally {
    URL.revokeObjectURL(img.src)
  }
}

/**
 * Function to get language settins by language code
 * @param {string} code // language code
 * @param {any} locales // language settings
 */
export const getLocale = (code, locales) => {
  let locale = locales?.[code]
  if (code === 'es-419-1' || code === 'es-419-2') locale = locales?.es
  if (code === 'zh-CN') locale = locales?.zhCN
  if (code === 'ar') locale = locales?.arSA
  if (code === 'kn') locale = locales?.ta
  if (code === 'km') locale = locales?.th
  if (!locale) return locales?.enUS
  return locale
}

/**
 * List of fields with correct order
 */
export const fieldsToSort = ['name', 'middle_name', 'lastname', 'second_lastname', 'email']

/**
  * Function to return a array sorted by certain fields
  * @param fields Array with right order
  * @param array Array to sort
  */
export const sortInputFields = ({ fields, values }) => {
  let fieldsBase = fields
  const fieldsSorted = []
  const fieldsArray = Array.isArray(values) ? values : Object.values(values)

  if (!fieldsBase) {
    fieldsBase = fieldsToSort
  }

  fieldsBase.forEach(f => {
    fieldsArray.forEach(field => {
      if (f === field.code) {
        fieldsSorted.push(field)
      }
    })
  })
  return fieldsSorted
}

/**
 * Function to covert seconds into remain hours
 * @param {Number} seconds
 */
export const getHours = (seconds) => {
  return (seconds * 1) / 3600 > 1 ? Math.floor((seconds * 1) / 3600) : 0
}

/**
 * Function to covert seconds into remain Minutes
 * @param {Number} seconds
 */
export const getMinutes = (seconds) => {
  return Math.floor((seconds - Math.floor(seconds / 3600) * 3600) / 60)
}

/**
 * Function to covert seconds into remain Seconds
 * @param {Number} seconds
 */
export const getSeconds = (seconds) => {
  const remain = seconds - Math.floor(seconds / 3600) * 3600
  return Math.floor(remain - Math.floor(remain / 60) * 60)
}

export const findExitingCode = (countryCode) => {
  const code = CODES.find(code => code.countryCode === (countryCode || '').toUpperCase())
  return code?.countryCode
}

export const findExitingCountryPhoneCode = (countryCode) => {
  const code = CODES.find(code => code.countryCode === (countryCode || '').toUpperCase())
  return code?.phoneCode
}

export {
  getTaxAmount,
  getTaxesByTarget,
  getTaxKey,
  shouldShowTaxRate,
  shouldShowTaxItem,
  shouldShowTaxBillRow
} from './taxBillUtils'

export {
  getFeeAmount,
  getFeeKey,
  shouldShowFeeRateDetails,
  shouldShowFeeItem
} from './feeBillUtils'

/**
 * Function to check if a number is decimal or not
 * @param {*} value number to check if decimal or not
 * @param {*} parser function fallback when is decimal
 * @returns string
 */
export const verifyDecimals = (value, parser) => {
  if (value % 1 === 0) {
    return value
  } else {
    return parser(value)
  }
}

/**
 * Fuctions to control the local storage
 */
export const getStorageItem = async (storageKey, isJson) => {
  return getLocalStorageItem(storageKey, isJson)
}
export const setStorageItem = async (key, val, isJson) => {
  const value = isJson ? JSON.stringify(val) : val
  await window.localStorage.setItem(key, value)
}
export const removeStorageItem = async (key) => {
  await window.localStorage.removeItem(key)
}

/**
 * Fuctions to convert formatted time from seconds
 */
export const convertHMS = (value) => {
  const sec = parseInt(value, 10) // convert value to number if it's string
  const absSec = Math.abs(sec)
  let hours = Math.floor(absSec / 3600) // get hours
  let minutes = Math.floor((absSec - (hours * 3600)) / 60) // get minutes
  let seconds = absSec - (hours * 3600) - (minutes * 60) //  get seconds
  // add 0 if value < 10; Example: 2 => 02
  if (hours < 10) { hours = '0' + hours }
  if (minutes < 10) { minutes = '0' + minutes }
  if (seconds < 10) { seconds = '0' + seconds }
  return sec < 0 ? '-' : '' + (hours === '00' ? '' : hours + ':') + minutes + ':' + seconds // Return is HH : MM : SS
}

/**
 * List shape for ribbon
 */
export const shape = {
  rectangle: 'rectangle',
  rectangleRound: 'rectangle_round',
  capsuleShape: 'capsule_shape'
}

/**
 * Function to check URL
 * @param {string} url URL of page
 * @param {string} fallback default URL
 */
export const checkPreSiteUrl = (url, fallback) => {
  if (!url) return fallback
  return url[0] === '/' ? url : `/${url}`
}

/**
 * Function to validate URL
 * @param {string} url URL of page
 */
export const checkValidUrlFormat = (url) => {
  if (!url) return
  const pattern = new RegExp('^(https?:\\/\\/)?' + // protocol
    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
    '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
    '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
    '(\\#[-a-z\\d_]*)?$', 'i') // fragment locator

  return pattern.test(url)
}

/**
 * default value for bitton
 */
export const ribbonValues = {
  color: '#0083FE',
  text: 'ribbon',
  shape: 'rectangle',
  enabled: false
}
/**
 * Format seconds to hh:mm:ss
 * @param {number} seconds
 */
export const formatSeconds = (seconds) => {
  // Hours, minutes and seconds
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  // Output like '1:01' or '4:03:59' or '123:03:59'
  let ret = ''
  if (hrs > 0) {
    ret += '' + hrs + ':' + (mins < 10 ? '0' : '')
  }
  ret += '' + mins + ':' + (secs < 10 ? '0' : '')
  ret += '' + secs
  return ret
}

/**
 * Function to check URL
 * @param {string} url URL of page
 * @param {string} fallback default URL
 */
export const checkSiteUrl = (url, fallback) => {
  if (!url) return fallback
  return url[url?.length - 1] === '/' ? url : `${url}/`
}

/**
 * function to manage review comment list
 * @param {number} param0 type of reviews to return
 * @returns object with reviews dictionary
 */
export const reviewCommentList = (type) => {
  const [, t] = useLanguage()

  const reviews = {
    1: {
      1: {
        title: t('CUSTOMER_QUICK_COMMENT_TITLE_1', 'What went wrong?'),
        list: [
          { key: 0, content: t('CUSTOMER_QUICK_COMMENT_1_0', 'Not handled with care') },
          { key: 1, content: t('CUSTOMER_QUICK_COMMENT_1_1', 'Poor communication') },
          { key: 2, content: t('CUSTOMER_QUICK_COMMENT_1_2', 'COVID-19 issue') },
          { key: 3, content: t('CUSTOMER_QUICK_COMMENT_1_3', "Didn't follow instructions") },
          { key: 4, content: t('CUSTOMER_QUICK_COMMENT_1_4', 'Rude') },
          { key: 5, content: t('CUSTOMER_QUICK_COMMENT_1_5', 'Not on-time') }
        ]
      },
      2: {
        title: t('CUSTOMER_QUICK_COMMENT_TITLE_2', 'What went wrong?'),
        list: [
          { key: 0, content: t('CUSTOMER_QUICK_COMMENT_2_0', 'Not handled with care') },
          { key: 1, content: t('CUSTOMER_QUICK_COMMENT_2_1', 'Poor communication') },
          { key: 2, content: t('CUSTOMER_QUICK_COMMENT_2_2', 'COVID-19 issue') },
          { key: 3, content: t('CUSTOMER_QUICK_COMMENT_2_3', "Didn't follow instructions") },
          { key: 4, content: t('CUSTOMER_QUICK_COMMENT_2_4', 'Rude') },
          { key: 5, content: t('CUSTOMER_QUICK_COMMENT_2_5', 'Not on-time') }
        ]
      },
      3: {
        title: t('CUSTOMER_QUICK_COMMENT_TITLE_3', 'What could have been better?'),
        list: [
          { key: 0, content: t('CUSTOMER_QUICK_COMMENT_3_0', 'Not handled with care') },
          { key: 1, content: t('CUSTOMER_QUICK_COMMENT_3_1', 'Poor communication') },
          { key: 2, content: t('CUSTOMER_QUICK_COMMENT_3_2', 'COVID-19 issue') },
          { key: 3, content: t('CUSTOMER_QUICK_COMMENT_3_3', "Didn't follow instructions") },
          { key: 4, content: t('CUSTOMER_QUICK_COMMENT_3_4', 'Rude') },
          { key: 5, content: t('CUSTOMER_QUICK_COMMENT_3_5', 'Not on-time') }
        ]
      },
      4: {
        title: t('CUSTOMER_QUICK_COMMENT_TITLE_4', ' Tell us more'),
        list: [
          { key: 0, content: t('CUSTOMER_QUICK_COMMENT_4_0', 'Not handled with care') },
          { key: 1, content: t('CUSTOMER_QUICK_COMMENT_4_1', 'Poor communication') },
          { key: 2, content: t('CUSTOMER_QUICK_COMMENT_4_2', 'COVID-19 issue') },
          { key: 3, content: t('CUSTOMER_QUICK_COMMENT_4_3', "Didn't follow instructions") },
          { key: 4, content: t('CUSTOMER_QUICK_COMMENT_4_4', 'Rude') },
          { key: 5, content: t('CUSTOMER_QUICK_COMMENT_4_5', 'Not on-time') }
        ]
      },
      5: {
        title: t('CUSTOMER_QUICK_COMMENT_TITLE_5', 'What went well?'),
        list: [
          { key: 0, content: t('CUSTOMER_QUICK_COMMENT_5_0', 'Good communication') },
          { key: 1, content: t('CUSTOMER_QUICK_COMMENT_5_1', 'Friendly') },
          { key: 2, content: t('CUSTOMER_QUICK_COMMENT_5_2', 'Above and beyond') }
        ]
      }
    }
  }

  return reviews[type]
}

export const orderStatus = [
  { key: 0, value: 'Pending Order', slug: 'PENDING_ORDER', percentage: 10 },
  { key: 1, value: 'Completed by admin', slug: 'COMPLETED_BY_ADMIN', percentage: 100 },
  { key: 2, value: 'Reject by admin', slug: 'REJECT_BY_ADMIN', percentage: 0 },
  { key: 3, value: 'Driver arrived by business', slug: 'DRIVER_IN_BUSINESS', percentage: 60 },
  { key: 4, value: 'Preparation Completed', slug: 'PREPARATION_COMPLETED', percentage: 20 },
  { key: 5, value: 'Reject by business', slug: 'REJECT_BY_BUSINESS', percentage: 0 },
  { key: 6, value: 'Reject by driver', slug: 'REJECT_BY_DRIVER', percentage: 0 },
  { key: 7, value: 'Accepted by business', slug: 'ACCEPTED_BY_BUSINESS', percentage: 15 },
  { key: 8, value: 'Accepted by driver', slug: 'ACCEPTED_BY_DRIVER', percentage: 40 },
  { key: 9, value: 'Pick up completed by driver', slug: 'PICK_UP_COMPLETED_BY_DRIVER', percentage: 70 },
  { key: 10, value: 'Pick up Failed by driver', slug: 'PICK_UP_FAILED_BY_DRIVER', percentage: 0 },
  { key: 11, value: 'Delivery completed by driver', slug: 'DELIVERY_COMPLETED_BY_DRIVER', percentage: 100 },
  { key: 12, value: 'Delivery Failed by driver', slug: 'DELIVERY_FAILED_BY_DRIVER', percentage: 0 },
  { key: 13, value: 'Preorder', slug: 'PREORDER', percentage: 0 },
  { key: 14, value: 'Order not ready', slug: 'ORDER_NOT_READY', percentage: 15 },
  { key: 15, value: 'Pickup completed by customer', slug: 'PICKUP_COMPLETED_BY_CUSTOMER', percentage: 100 },
  { key: 16, value: 'Canceled by customer', slug: 'CANCELED_BY_CUSTOMER', percentage: 0 },
  { key: 17, value: 'Not picked by customer', slug: 'NOT_PICKED_BY_CUSTOMER', percentage: 0 },
  { key: 18, value: 'Driver almost arrived to business', slug: 'DRIVER_ALMOST_ARRIVED_TO_BUSINESS', percentage: 50 },
  { key: 19, value: 'Driver almost arrived to customer', slug: 'DRIVER_ALMOST_ARRIVED_TO_CUSTOMER', percentage: 90 },
  { key: 20, value: 'Customer almost arrived to business', slug: 'CUSTOMER_ALMOST_ARRIVED_TO_BUSINESS', percentage: 90 },
  { key: 21, value: 'Customer arrived to business', slug: 'CUSTOMER_ARRIVED_TO_BUSINESS', percentage: 90 },
  { key: 22, value: 'Looking for driver', slug: 'ORDER_LOOKING_FOR_DRIVER', percentage: 30 },
  { key: 23, value: 'Driver on way', slug: 'ORDER_DRIVER_ON_WAY', percentage: 80 },
  { key: 24, value: 'Driver waiting for order', slug: 'ORDER_STATUS_DRIVER_WAITING_FOR_ORDER', percentage: 25 },
  { key: 25, value: 'Accepted by driver company', slug: 'ORDER_STATUS_ACCEPTED_BY_DRIVER_COMPANY', percentage: 15 },
  { key: 26, value: 'Driver arrived to customer', slug: 'ORDER_DRIVER_ARRIVED_CUSTOMER', percentage: 80 }
]

export const getOrderStatus = (status) => {
  const objectStatus = orderStatus.find((o) => o.key === status)
  return objectStatus && objectStatus
}

export const getOrderStatuPickUp = (status) => {
  const orderStatus = [
    { key: 0, value: 'Pending Order', slug: 'PENDING_ORDER', percentage: 10 },
    { key: 1, value: 'Completed by admin', slug: 'COMPLETED_BY_ADMIN', percentage: 100 },
    { key: 2, value: 'Reject by admin', slug: 'REJECT_BY_ADMIN', percentage: 0 },
    { key: 4, value: 'Preparation Completed', slug: 'PREPARATION_COMPLETED', percentage: 50 },
    { key: 5, value: 'Reject by business', slug: 'REJECT_BY_BUSINESS', percentage: 0 },
    { key: 7, value: 'Accepted by business', slug: 'ACCEPTED_BY_BUSINESS', percentage: 30 },
    { key: 13, value: 'Preorder', slug: 'PREORDER', percentage: 0 },
    { key: 14, value: 'Order not ready', slug: 'ORDER_NOT_READY', percentage: 30 },
    { key: 15, value: 'Pickup completed by customer', slug: 'PICKUP_COMPLETED_BY_CUSTOMER', percentage: 100 },
    { key: 16, value: 'Canceled by customer', slug: 'CANCELED_BY_CUSTOMER', percentage: 0 },
    { key: 17, value: 'Not picked by customer', slug: 'NOT_PICKED_BY_CUSTOMER', percentage: 0 },
    { key: 20, value: 'Customer almost arrived to business', slug: 'CUSTOMER_ALMOST_ARRIVED_TO_BUSINESS', percentage: 70 },
    { key: 21, value: 'Customer arrived to business', slug: 'CUSTOMER_ARRIVED_TO_BUSINESS', percentage: 90 }
  ]

  const objectStatus = orderStatus.find((o) => o.key === status)
  return objectStatus && objectStatus
}

/**
 * function to manage order reject comment list
 * @param {string} param0 type of orders to return
 * @returns object with orders dictionary
 */
export const orderRejectCommentList = (status) => {
  const messages = {
    6: [// on reject order
      'very_far_away',
      'driver_vehicle_incident',
      'destination_unreacheable',
      'unavailable_driver',
      'other'
    ],
    9: [// on force pickup status
      'forgot_complete_location',
      'not_internet_conection',
      'other'
    ],
    10: [// on pickup failed by driver
      'very_far_away',
      'driver_vehicle_incident',
      'destination_unreacheable',
      'store_closed',
      'unavailable_driver',
      'other'
    ],
    11: [// on force delivery status
      'forgot_complete_location',
      'not_internet_conection',
      'other'
    ],
    12: [// on delivery failed by driver
      'very_far_away',
      'driver_vehicle_incident',
      'destination_unreacheable',
      'recipient_unavailable',
      'incorrect_missing_items',
      'refused_damage',
      'other'
    ],
    14: [// on order not ready
      'store_recieve_order_late',
      'store_busy',
      'other'
    ]
  }

  if (!messages[parseInt(status)]) return []

  const list = messages[status].map((val, i) => ({ key: i, value: val, content: val }))

  return list
}

export const widgetURL = 'https://orderingweb.orderingplus/'

export const getCurrentDiffDays = (time) => {
  const current = moment().utc()
  const compared = moment(time)
  return compared.diff(current, 'days')
}

export const firstLetterCapital = (text) => {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

export const stringToSlug = str => {
  str = str.replace(/^\s+|\s+$/g, '') // trim
  str = str?.toLowerCase()

  // remove accents, swap ñ for n, etc
  const from = 'åàáãäâèéëêìíïîòóöôùúüûñç·/_,:;'
  const to = 'aaaaaaeeeeiiiioooouuuunc------'

  for (let i = 0, l = from.length; i < l; i++) {
    str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i))
  }

  str = str
    .replace(/[^a-z0-9 -]/g, '') // remove invalid chars
    .replace(/\s+/g, '_') // collapse whitespace and replace by -
    .replace(/-+/g, '_') // collapse dashes
    .replace(/^-+/, '') // trim - from start of text
    .replace(/-+$/, '') // trim - from end of text

  return str
}

export const getCurrenySymbol = (code) => {
  return CURRENCY?.[code]?.symbol ?? code
}

export const queryStringToObject = url => {
  const params = new URLSearchParams(url.split('?')[1])
  return Object.fromEntries(params)
}

export const addQueryToUrl = (newObj) => {
  const queryObj = queryStringToObject(location.href)
  for (const key in newObj) {
    queryObj[key] = newObj[key]
  }
  const query = new URLSearchParams(queryObj)
  history.replaceState(null, '', `${location.pathname}?${query}`)
  notifyUrlChange()
}

export const removeQueryToUrl = (removeKeys) => {
  const queryObj = queryStringToObject(location.href)
  for (const key of removeKeys) {
    delete queryObj[key]
  }
  if (Object.keys(queryObj).length) {
    const query = new URLSearchParams(queryObj)
    history.replaceState(null, '', `${location.pathname}?${query}`)
  } else {
    history.replaceState(null, '', `${location.pathname}`)
  }
  notifyUrlChange()
}

/** Fired after addQueryToUrl / removeQueryToUrl: replaceState does not reach react-router listeners */
export const URL_CHANGE_EVENT = 'dashboard:urlchange'

const notifyUrlChange = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(URL_CHANGE_EVENT))
}

export const TwelveHours = [
  '12:00 AM',
  '01:00 AM',
  '02:00 AM',
  '03:00 AM',
  '04:00 AM',
  '05:00 AM',
  '06:00 AM',
  '07:00 AM',
  '08:00 AM',
  '09:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '01:00 PM',
  '02:00 PM',
  '03:00 PM',
  '04:00 PM',
  '05:00 PM',
  '06:00 PM',
  '07:00 PM',
  '08:00 PM',
  '09:00 PM',
  '10:00 PM',
  '11:00 PM'
]

export const TwentyFourHours = [
  '00:00',
  '01:00',
  '02:00',
  '03:00',
  '04:00',
  '05:00',
  '06:00',
  '07:00',
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
  '21:00',
  '22:00',
  '23:00'
]

export const disableReasons = () => {
  const [, t] = useLanguage()
  const disableReasonDictionary = {
    SALE_DIVIATION: t('SALE_DIVIATION', 'Sale Diviation'),
    MOTORCYCLE_FAILURE: t('MOTORCYCLE_FAILURE', 'Motorcycle failure'),
    NO_DRIVERS: t('NO_DRIVERS', 'No drivers'),
    OVEN_FAILURE: t('OVEN_FAILURE', 'Oven failure'),
    EXCESS_ORDERS: t('EXCESS_ORDERS', 'Excess orders'),
    NO_ELECTRIC_POWER: t('NO_ELECTRIC_POWER', 'No electric power'),
    NO_GAS: t('NO_GAS', 'No gas'),
    CONECTION_FAILURE: t('CONECTION_FAILURE', 'Conection failure'),
    NO_WATER: t('NO_WATER', 'No water'),
    SYSTEM_FAILURE: t('SYSTEM_FAILURE', 'System failure'),
    STREETS_CLOSED: t('STREETS_CLOSED', 'Streets closed'),
    NO_SERVICE: t('NO_SERVICE', 'No service'),
    UNSAFETY: t('UNSAFETY', 'Unsafety'),
    MAINTENANCE_IN_STORE: t('MAINTENANCE_IN_STORE', 'Maintenance in store'),
    RAINING: t('RAINING', 'Raining'),
    STORE_EVENT: t('STORE_EVENT', 'Store event'),
    PROBLEM_WITH_POWER: t('PROBLEM_WITH_POWER', 'Problem with power'),
    DRIVER_ACCIDENT: t('DRIVER_ACCIDENT', 'Driver accident'),
    MAINTENANCE_SYSTEM_IN_STORE: t('MAINTENANCE_SYSTEM_IN_STORE', 'Maintenance system in store'),
    PROBLEM_WITH_GAS: t('PROBLEM_WITH_GAS', 'Problem with gas'),
    ROLLER_FAILURE: t('ROLLER_FAILURE', 'Roller failure'),
    WEATHER: t('WEATHER', 'Weather'),
    GAS_LEAK: t('GAS_LEAK', 'Gas leak'),
    MANIFESTATION: t('MANIFESTATION', 'Manifestation'),
    LACK_OF_STAFF: t('LACK_OF_STAFF', 'Lack of Staff'),
    MIXER_FAILURE: t('MIXER_FAILURE', 'Mixer failure'),
    AUTOMATICS: t('AUTOMATICS', 'Automatics'),
    PRODUCT_SHORTAGE: t('PRODUCT_SHORTAGE', 'Product shortage'),
    TERMINAL_FAILURES: t('TERMINAL_FAILURES', 'Terminal failures')
  }
  return disableReasonDictionary
}

export const getAttributeName = (key, { parseDate } = {}) => {
  const [, t] = useLanguage()
  const attributes = [
    { key: 'autoassign_amount_drivers', content: t('AUTO_ASSIGN_GROUP_ORDERS_TO_DRIVERS', 'Auto assign the order of group to this amount of drivers') },
    { key: 'orders_group_max_orders', content: t('MAX_NUMBER_ORDERS', 'Maximum Number of Orders') },
    { key: 'autoassign_autoaccept_by_driver', content: t('ORDER_CONFIRMED_ACCEPTED_BY_DRIVER', 'Accepted by Driver') },
    { key: 'orders_group_max_time_between', content: t('MAX_ORDER_TIME_BETWEEN', 'Maximum time between orders in seconds') },
    { key: 'orders_group_max_distance_between_pickup', content: t('MAX_DISTANCE_BETWEEN_BUSINESS', 'Maximum distance between businesses in meters') },
    { key: 'orders_group_max_distance_between_delivery', content: t('MAX_DISTANCE_BETWEEN_DELIVERY', 'Maximum distance between deliveries in meters') },
    { key: 'orders_group_use_maps_api', content: t('USE_MAPS_API', 'Use maps api') },
    { key: 'orders_group_max_time_between_pickup', content: t('MAX_DISTANCE_BETWEEN_BUSINESS', 'Maximum distance between businesses in meters') },
    { key: 'orders_group_max_time_between_delivery', content: t('MAX_DISTANCE_BETWEEN_DELIVERY', 'Maximum distance between deliveries in meters') },
    { key: 'autoassign_forced_assignment', content: t('AUTO_ASSIGN_FORCED_ASSIGNMENT', 'Forced assignment') },
    { key: 'autoassign_customer_max_distance_from_business', content: t('MAX_CUSTOMER_DISTANCE_FROM_BUSINESS', 'Max distance between customer and business') },
    { key: 'autoassign_initial_radius', content: t('INITIAL_RADIUS', 'Initial radius in meters') },
    { key: 'autoassign_increment_radius', content: t('INCREMENT_RADIUS', 'Radius increase in meters') },
    { key: 'autoassign_max_radius', content: t('MAX_RADIUS', 'Maximum radius in meters') },
    { key: 'autoassign_autoreject_time', content: t('AUTO_REJECT_ORDER_GROUP_AFTER', 'Auto reject Orders After') },
    { key: 'autoassign_max_orders', content: t('MAX_AMOUNT_ORDERS_PER_DRIVER', 'Maximum amount of orders per drivers') },
    { key: 'autoassign_max_in_pending', content: t('ORDER_PENDING', 'Pending') },
    { key: 'available', content: t('AVAILABLE', 'Available') },
    { key: 'enabled', content: t('ENABLED', 'Enabled') },
    { key: 'last_available_at', content: t('LAST_AVAILABLE_AT', 'Last available at') },
    { key: 'busy', content: t('BUSY', 'Busy') }
  ]
  const found = attributes.find(attribute => attribute.key === key)
  if (found) {
    return found.content
  } else {
    if (parseDate && moment(key).isValid()) {
      return parseDate(key)
    } else {
      return key
    }
  }
}

export const orderTypeList = (byNumber = false) => {
  const defaultOrderType = byNumber
    ? ['1', '2', '3', '4', '5', '6', '7', '8', '9']
    : ['delivery', 'pickup', 'eatin', 'curbside', 'drivethru', 'seatdelivery', 'catering_delivery', 'catering_pickup', 'reservation']

  return defaultOrderType
}

export const HIDDEN_ORDER_STATUSES_BY_PROJECT = {
  quickiedelivery: [6],
  delosi: [5, 6, 10, 12, 17]
}

const NO_HIDDEN_ORDER_STATUSES = []

export const getHiddenOrderStatuses = (project) => {
  const projectName = project?.toLowerCase?.() ?? ''
  const hideProject = Object.keys(HIDDEN_ORDER_STATUSES_BY_PROJECT).find(key => projectName.includes(key))
  return hideProject ? HIDDEN_ORDER_STATUSES_BY_PROJECT[hideProject] : NO_HIDDEN_ORDER_STATUSES
}

export const FINAL_ORDER_STATUSES = [1, 2, 5, 6, 10, 11, 12, 15, 16, 17]

export const FINAL_STATUS_LOCKED_LEVELS_BY_PROJECT = {
  quickiedelivery: [2]
}

export const isFinalOrderStatusLocked = (project, userLevel, status) => {
  const projectName = project?.toLowerCase?.() ?? ''
  const lockProject = Object.keys(FINAL_STATUS_LOCKED_LEVELS_BY_PROJECT).find(key => projectName.includes(key))
  if (!lockProject) return false
  if (!FINAL_STATUS_LOCKED_LEVELS_BY_PROJECT[lockProject].includes(userLevel)) return false
  return FINAL_ORDER_STATUSES.includes(parseInt(status))
}

export const getOrderStatusPrefix = (s, dictionary, prefixForVariable = '') => {
  if (!dictionary) return s

  const orderStatus = {
    0: dictionary?.[`${prefixForVariable}_PENDING` ?? 'PENDING'] ?? 'Pending',
    1: dictionary?.[`${prefixForVariable}_COMPLETED_BY_ADMIN` ?? 'COMPLETED_BY_ADMIN'] ?? 'Completed by admin',
    2: dictionary?.[`${prefixForVariable}_REJECTED` ?? 'REJECTED'] ?? 'Rejected',
    3: dictionary?.[`${prefixForVariable}_ORDER_STATUS_IN_BUSINESS` ?? 'ORDER_STATUS_IN_BUSINESS'] ?? 'Driver arrived to business',
    4: dictionary?.[`${prefixForVariable}_PREPARATION_COMPLETED` ?? 'PREPARATION_COMPLETED'] ?? 'Preparation Completed',
    5: dictionary?.[`${prefixForVariable}_REJECTED_BY_BUSINESS` ?? 'REJECTED_BY_BUSINESS'] ?? 'Rejected by business',
    6: dictionary?.[`${prefixForVariable}_REJECTED_BY_DRIVER` ?? 'REJECTED_BY_DRIVER'] ?? 'Rejected by Driver',
    7: dictionary?.[`${prefixForVariable}_ACCEPTED_BY_BUSINESS` ?? 'ACCEPTED_BY_BUSINESS'] ?? 'Accepted by business',
    8: dictionary?.[`${prefixForVariable}_ACCEPTED_BY_DRIVER` ?? 'ACCEPTED_BY_DRIVER'] ?? 'Accepted by driver',
    9: dictionary?.[`${prefixForVariable}_PICK_UP_COMPLETED_BY_DRIVER` ?? 'PICK_UP_COMPLETED_BY_DRIVER'] ?? 'Pick up completed by driver',
    10: dictionary?.[`${prefixForVariable}_PICK_UP_FAILED_BY_DRIVER` ?? 'PICK_UP_FAILED_BY_DRIVER'] ?? 'Pick up Failed by driver',
    11: dictionary?.[`${prefixForVariable}_DELIVERY_COMPLETED_BY_DRIVER` ?? 'DELIVERY_COMPLETED_BY_DRIVER'] ?? 'Delivery completed by driver',
    12: dictionary?.[`${prefixForVariable}_DELIVERY_FAILED_BY_DRIVER` ?? 'DELIVERY_FAILED_BY_DRIVER'] ?? 'Delivery Failed by driver',
    13: dictionary?.[`${prefixForVariable}_PREORDER` ?? 'PREORDER'] ?? 'PreOrder',
    14: dictionary?.[`${prefixForVariable}_ORDER_NOT_READY` ?? 'ORDER_NOT_READY'] ?? 'Order not ready',
    15: dictionary?.[`${prefixForVariable}_ORDER_PICKEDUP_COMPLETED_BY_CUSTOMER` ?? 'ORDER_PICKEDUP_COMPLETED_BY_CUSTOMER'] ?? 'Order picked up completed by customer',
    16: dictionary?.[`${prefixForVariable}_ORDER_STATUS_CANCELLED_BY_CUSTOMER` ?? 'ORDER_STATUS_CANCELLED_BY_CUSTOMER'] ?? 'Order cancelled by customer',
    17: dictionary?.[`${prefixForVariable}_ORDER_NOT_PICKEDUP_BY_CUSTOMER` ?? 'ORDER_NOT_PICKEDUP_BY_CUSTOMER'] ?? 'Order not picked up by customer',
    18: dictionary?.[`${prefixForVariable}_ORDER_DRIVER_ALMOST_ARRIVED_BUSINESS` ?? 'ORDER_DRIVER_ALMOST_ARRIVED_BUSINESS'] ?? 'Driver almost arrived to business',
    19: dictionary?.[`${prefixForVariable}_ORDER_DRIVER_ALMOST_ARRIVED_CUSTOMER` ?? 'ORDER_DRIVER_ALMOST_ARRIVED_CUSTOMER'] ?? 'Driver almost arrived to customer',
    20: dictionary?.[`${prefixForVariable}_ORDER_CUSTOMER_ALMOST_ARRIVED_BUSINESS` ?? 'ORDER_CUSTOMER_ALMOST_ARRIVED_BUSINESS'] ?? 'Customer almost arrived to business',
    21: dictionary?.[`${prefixForVariable}_ORDER_CUSTOMER_ARRIVED_BUSINESS` ?? 'ORDER_CUSTOMER_ARRIVED_BUSINESS'] ?? 'Customer arrived to business',
    22: dictionary?.[`${prefixForVariable}_ORDER_LOOKING_FOR_DRIVER` ?? 'ORDER_LOOKING_FOR_DRIVER'] ?? 'Looking for driver',
    23: dictionary?.[`${prefixForVariable}_ORDER_DRIVER_ON_WAY` ?? 'ORDER_DRIVER_ON_WAY'] ?? 'Driver on way',
    24: dictionary?.[`${prefixForVariable}_ORDER_STATUS_DRIVER_WAITING_FOR_ORDER` ?? 'ORDER_STATUS_DRIVER_WAITING_FOR_ORDER'] ?? 'Driver waiting for order',
    25: dictionary?.[`${prefixForVariable}_ORDER_STATUS_ACCEPTED_BY_DRIVER_COMPANY` ?? 'ORDER_STATUS_ACCEPTED_BY_DRIVER_COMPANY'] ?? 'Accepted by driver company',
    26: dictionary?.[`${prefixForVariable}_ORDER_DRIVER_ARRIVED_CUSTOMER` ?? 'ORDER_DRIVER_ARRIVED_CUSTOMER'] ?? 'Driver arrived to customer',
    50: dictionary?.[`${prefixForVariable}_DRIVER_ASSIGNED` ?? 'DRIVER_ASSIGNED'] ?? 'Driver assigned',
    51: dictionary?.[`${prefixForVariable}_DRIVER_CLOSE` ?? 'DRIVER_CLOSE'] ?? 'Driver is close',
    53: dictionary?.[`${prefixForVariable}_NEW_BUSINESS_OWNER_SIGNUP` ?? 'NEW_BUSINESS_OWNER_SIGNUP'] ?? 'New Business owner Signup',
    54: dictionary?.[`${prefixForVariable}_NEW_DRIVER_SIGNUP` ?? 'NEW_DRIVER_SIGNUP'] ?? 'New Driver owner Signup'
  }

  return orderStatus?.[Number(s)] ?? s
}

export const getCodeNames = (code, t) => {
  const codeNames = {
    app_marketplace_x: t('APP_MARKETPLACE_X', 'Marketplace App'),
    app_business_x: t('APP_BUSINESS_X', 'Business App'),
    app_driver_x: t('APP_DRIVER_X', 'Driver App'),
    app_franchises_x: t('APP_FRANCHISES_X', 'App Franchises'),
    web_dashboard_x: t('WEB_DASHBOARD_X', 'Dashboard'),
    web_franchises_x: t('WEB_FRANCHISES_X', 'Franchises')
  }
  return codeNames[code] ?? t(code.replace(/ /g, '_').toUpperCase(), capitalize(code.replace(/_/g, ' ').toLowerCase()))
}

export const learnOptionsValues = (key = [], t) => {
  const options = [
    {
      value: 'order_list_general_view',
      name: t('LEARN_ORDER_LIST_GENERAL_VIEW', 'Orders List | General Overview'),
      url: 'https://help.orderingplus.com/en/articles/9325259-orders-list-general-overview'
    },
    {
      value: 'order_details',
      name: t('LEARN_ORDER_DETAILS', 'Order Details'),
      url: 'https://help.orderingplus.com/en/articles/9325316-order-details'
    },
    {
      value: 'create_custom_order',
      name: t('LEARN_CREATE_CUSTOM_ORDER', 'Create Custom Order'),
      url: 'https://help.orderingplus.com/en/articles/9325240-create-custom-order'
    },
    {
      value: 'message_general_view',
      name: t('LEARN_MESSAGE_GENERAL_VIEW', 'Messages | General Overview'),
      url: 'https://help.orderingplus.com/en/articles/9331486-messages-general-overview'
    },
    {
      value: 'open_cart_general_view',
      name: t('LEARN_OPEN_CART_GENERAL_VIEW', 'Open Carts | General Overview'),
      url: 'https://help.orderingplus.com/en/articles/9331159-open-carts-general-overview'
    },
    {
      value: 'cart_details',
      name: t('LEARN_CART_DETAILS', 'Cart Details'),
      url: 'https://help.orderingplus.com/en/articles/9331161-cart-details'
    },
    {
      value: 'store_general_view',
      name: t('LEARN_STORE_GENERAL_VIEW', 'Stores | General Overview'),
      url: 'https://help.orderingplus.com/en/articles/9325323-stores-general-overview'
    },
    {
      value: 'store_details',
      name: t('LEARN_STORE_DETAILS', 'Store Details'),
      url: 'https://help.orderingplus.com/en/articles/9331516-store-details'
    },
    {
      value: 'store_schedule',
      name: t('LEARN_STORE_SCHEDULE', 'Schedule'),
      url: 'https://help.orderingplus.com/en/articles/9331755-schedule'
    },
    {
      value: 'store_menu',
      name: t('LEARN_STORE_MENU', 'Menu'),
      url: 'https://help.orderingplus.com/en/articles/9331760-menu'
    },
    {
      value: 'store_delivery_pickup',
      name: t('LEARN_STORE_DELIVERY_PICKUP', 'Delivery, pickup & more'),
      url: 'https://help.orderingplus.com/en/articles/9331803-delivery-pickup-more'
    },
    {
      value: 'store_notifications',
      name: t('LEARN_STORE_NOTIFICATIONS', 'Notifications'),
      url: 'https://help.orderingplus.com/en/articles/9331809-notifications'
    },
    {
      value: 'store_payment_methods',
      name: t('LEARN_STORE_PAYMENT_METHODS', 'Payment methods'),
      url: 'https://help.orderingplus.com/en/articles/9331812-payment-methods'
    },
    {
      value: 'store_tax_fees',
      name: t('LEARN_STORE_TAX_FEES', 'Tax & fees'),
      url: 'https://help.orderingplus.com/en/articles/9331818-tax-fees'
    },
    {
      value: 'store_promotions',
      name: t('LEARN_STORE_PROMOTIONS', 'Promotions'),
      url: 'https://help.orderingplus.com/en/articles/9331830-promotions'
    },
    {
      value: 'store_channels',
      name: t('LEARN_STORE_CHANNELS', 'Ordering Channels'),
      url: 'https://help.orderingplus.com/en/articles/9331837-ordering-channels'
    },
    {
      value: 'store_qr_codes',
      name: t('LEARN_STORE_QR_CODES', 'QR Codes'),
      url: 'https://help.orderingplus.com/en/articles/9331841-qr-codes'
    },
    {
      value: 'store_sales_channels',
      name: t('LEARN_STORE_SALES_CHANNELS', 'Sales Channels'),
      url: 'https://help.orderingplus.com/en/articles/9331847-sales-channels'
    },
    {
      value: 'store_layout',
      name: t('LEARN_STORE_LAYOUT', 'Layout'),
      url: 'https://help.orderingplus.com/en/articles/9331843-layout'
    },
    {
      value: 'store_webhooks',
      name: t('LEARN_STORE_WEBHOOKS', 'Webhooks'),
      url: 'https://help.orderingplus.com/en/articles/9331845-webhooks'
    },
    {
      value: 'categories_products_general_view',
      name: t('LEARN_CATEGORIES_PRODUCTS_GENERAL_VIEW', 'Categories & Products: General Overview'),
      url: 'https://help.orderingplus.com/en/articles/9331858-categories-products-general-overview'
    },
    {
      value: 'new_category',
      name: t('LEARN_NEW_CATEGORY', 'New Category'),
      url: 'https://help.orderingplus.com/en/articles/9331862-new-category'
    },
    {
      value: 'product_details_general_view',
      name: t('LEARN_PRODUCT_DETAILS_GENERAL_VIEW', 'Products Details | General Overview'),
      url: 'https://help.orderingplus.com/en/articles/9331863-products-details-general-overview'
    },
    {
      value: 'ingredients_properties',
      name: t('LEARN_INGREDIENTS_PROPERTIES', 'Ingredients/Properties'),
      url: 'https://help.orderingplus.com/en/articles/9331869-ingredients-properties'
    },
    {
      value: 'product_options',
      name: t('LEARN_PRODUCT_OPTIONS', 'Product options'),
      url: 'https://help.orderingplus.com/en/articles/9331887-product-options'
    },
    {
      value: 'product_images',
      name: t('LEARN_PRODUCT_IMAGES', 'Product images'),
      url: 'https://help.orderingplus.com/en/articles/9331934-product-images'
    },
    {
      value: 'product_video',
      name: t('LEARN_PRODUCT_IMAGES', 'Product video'),
      url: 'https://help.orderingplus.com/en/articles/9331951-product-video'
    },
    {
      value: 'importers',
      name: t('LEARN_IMPORTERS', 'Importers'),
      url: 'https://help.orderingplus.com/en/articles/9325325-importers'
    },
    {
      value: 'business_importer',
      name: t('LEARN_BUSINESS_IMPORTER', 'Business Importer'),
      url: 'https://help.orderingplus.com/en/articles/9336913-business-importer'
    },
    {
      value: 'category_importers',
      name: t('LEARN_CATEGORY_IMPORTERS', 'Category Importers'),
      url: 'https://help.orderingplus.com/en/articles/9368347-category-importers'
    },
    {
      value: 'products_importers',
      name: t('LEARN_PRODUCTS_IMPORTERS', 'Products Importers'),
      url: 'https://help.orderingplus.com/en/articles/9326613-products-importer'
    },
    {
      value: 'users_importers',
      name: t('LEARN_USERS_IMPORTERS', 'Users Importers'),
      url: 'https://help.orderingplus.com/en/articles/9406702-user-importers'
    },
    {
      value: 'creating_new_importer',
      name: t('LEARN_PRODUCT_IMAGES', 'Creating a new importer'),
      url: 'https://help.orderingplus.com/en/articles/9414628-creating-a-new-importer'
    },
    {
      value: 'import_full_menu',
      name: t('LEARN_IMPORT_FULL_MENU', 'Import Full Menu'),
      url: 'https://help.orderingplus.com/en/articles/9414967-import-full-menu-businesses-categories-products-product-options'
    },
    {
      value: 'import_orders',
      name: t('LEARN_IMPORT_ORDERS', 'Import Orders'),
      url: 'https://help.orderingplus.com/en/articles/9415009-import-orders'
    },
    {
      value: 'customers_general_view',
      name: t('LEARN_CUSTOMERS_GENERAL_VIEW', 'Customers | General Overview'),
      url: 'https://help.orderingplus.com/en/articles/9332356-customers-general-overview'
    },
    {
      value: 'customers_details',
      name: t('LEARN_CUSTOMERS_DETAILS', 'Customers Details'),
      url: 'https://help.orderingplus.com/en/articles/9332364-customers-details'
    },
    {
      value: 'business_owners_general_view',
      name: t('LEARN_BUSINESS_OWNERS_GENERAL_VIEW', 'Business Owners | General Overview'),
      url: 'https://help.orderingplus.com/en/articles/9332369-business-owners-general-overview'
    },
    {
      value: 'business_owner_details',
      name: t('LEARN_BUSINESS_OWNER_DETAILS', 'Business Owner Details'),
      url: 'https://help.orderingplus.com/en/articles/9332412-business-owner-details'
    },
    {
      value: 'managers_general_view',
      name: t('LEARN_MANAGERS_GENERAL_VIEW', 'Managers | General Overview'),
      url: 'https://help.orderingplus.com/en/articles/9332373-managers-general-overview'
    },
    {
      value: 'manager_details',
      name: t('LEARN_MANAGER_DETAILS', 'Manager Details'),
      url: 'https://help.orderingplus.com/en/articles/9332410-manager-details'
    },
    {
      value: 'business_reports',
      name: t('LEARN_BUSINESS_REPORTS', 'Business reports | General Overview'),
      url: 'https://help.orderingplus.com/en/articles/9332416-business-reports-general-overview'
    },
    {
      value: 'delivery_reports',
      name: t('LEARN_DELIVERY_REPORTS', 'Delivery Reports | General Overview'),
      url: 'https://help.orderingplus.com/en/articles/9367849-delivery-reports-general-overview'
    },
    {
      value: 'reviews_manager',
      name: t('LEARN_REVIEWS_MANAGER', 'Reviews Manager | General Overview'),
      url: 'https://help.orderingplus.com/en/articles/9367868-reviews-manager-general-overview'
    },
    {
      value: 'reviews_details',
      name: t('LEARN_REVIEWS_DETAILS', 'Reviews Details'),
      url: 'https://help.orderingplus.com/en/articles/9369521-reviews-details'
    },
    {
      value: 'invoice_manager',
      name: t('LEARN_INVOICE_MANAGER', 'Invoice manager | Business Owner'),
      url: 'https://help.orderingplus.com/en/articles/9332563-invoice-manager-business-owner'
    },
    {
      value: 'ordering_website_general_view',
      name: t('LEARN_WEBSITE_GENERAL_VIEW', 'Ordering Website | General Overview'),
      url: 'https://help.orderingplus.com/en/articles/9332579-ordering-website-general-overview'
    },
    {
      value: 'website_basic_settings',
      name: t('LEARN_WEBSITE_BASIC_SETTINGS', 'Basic Settings'),
      url: 'https://help.orderingplus.com/en/articles/9332721-basic-settings'
    },
    {
      value: 'website_advanced_settings',
      name: t('LEARN_WEBSITE_ADVANCED_SETTINGS', 'Advanced Settings'),
      url: 'https://help.orderingplus.com/en/articles/9332723-advanced-settings'
    },
    {
      value: 'website_widget',
      name: t('LEARN_WEBSITE_WIDGET', 'Ordering Widget'),
      url: 'https://help.orderingplus.com/en/articles/9332725-ordering-widget'
    },
    {
      value: 'ordering_app_advanced_settings',
      name: t('LEARN_ORDERING_APP_ADVANCED_SETTINGS', 'Advanced Settings'),
      url: 'https://help.orderingplus.com/en/articles/9367881-advanced-settings'
    },
    {
      value: 'ordering_app_resources',
      name: t('LEARN_ORDERING_APP_RESOURCES', 'App Resources'),
      url: 'https://help.orderingplus.com/en/articles/9367886-app-resources'
    },
    {
      value: 'settings_standard',
      name: t('LEARN_SETTINGS_STANDARD', 'Standard Settings'),
      url: 'https://help.orderingplus.com/en/collections/9439916-standard-settings'
    },
    {
      value: 'settings_cms',
      name: t('LEARN_ORDERING_CMS', 'CMS'),
      url: 'https://help.orderingplus.com/en/collections/9439917-cms'
    },
    {
      value: 'settings_pro',
      name: t('LEARN_ORDERING_PRO', 'Pro Settings'),
      url: 'https://help.orderingplus.com/en/collections/9472882-pro-settings'
    },
    {
      value: 'delivery_dashboard',
      name: t('LEARN_DELIVERY_DASHBOARD', 'Delivery Dashboard'),
      url: 'https://help.orderingplus.com/en/articles/9367719-delivery-dashboard'
    },
    {
      value: 'drivers_dashboard',
      name: t('LEARN_DELIVERY_DASHBOARD', 'Drivers Dashboard'),
      url: 'https://help.orderingplus.com/en/articles/9367725-drivers-dashboard'
    },
    {
      value: 'drivers_manager',
      name: t('LEARN_DELIVERY_MANAGER', 'Drivers Manager'),
      url: 'https://help.orderingplus.com/en/articles/9367737-drivers-manager'
    },
    {
      value: 'drivers_delivery_groups',
      name: t('LEARN_DELIVERY_GROUPS', 'Delivery Groups'),
      url: 'https://help.orderingplus.com/en/articles/9367740-delivery-groups'
    },
    {
      value: 'advance_logistics',
      name: t('LEARN_ADVANCED_LOGISTICS', 'Advanced Logistics'),
      url: 'https://help.orderingplus.com/en/articles/9367744-advanced-logistics'
    },
    {
      value: 'drivers_time_display',
      name: t('LEARN_DRIVERS_TIME_DISPLAY', 'Drivers Time Display'),
      url: 'https://help.orderingplus.com/en/articles/9375373-drivers-time-display'
    },
    {
      value: 'all_in_one',
      name: t('LEARN_ALL_IN_ONE', 'All In One'),
      url: 'https://help.orderingplus.com/en/articles/9375502-all-in-one'
    },
    {
      value: 'drivers',
      name: t('LEARN_DRIVERS', 'Drivers'),
      url: 'https://help.orderingplus.com/en/articles/9367734-drivers'
    },
    {
      value: 'driver_details',
      name: t('LEARN_DRIVER_DETAILS', 'Driver Details'),
      url: 'https://help.orderingplus.com/en/articles/9368486-driver-details'
    },
    {
      value: 'advanced_offers',
      name: t('LEARN_ADVANCED_OFFERS', 'Advanced Offers'),
      url: 'https://help.orderingplus.com/en/articles/9367753-advanced-offers'
    },
    {
      value: 'ad_banners',
      name: t('LEARN_AD_BANNERS', 'Ad Banners'),
      url: 'https://help.orderingplus.com/en/articles/9367810-ad-banners'
    },
    {
      value: 'cart_recovery',
      name: t('LEARN_CART_RECOVERY', 'Cart Recovery'),
      url: 'https://help.orderingplus.com/en/articles/9367817-cart-recovery'
    },
    {
      value: 'business_app_resources',
      name: t('LEARN_BUSINESS_APP_RESOURCES', 'Business App Resources'),
      url: 'https://help.orderingplus.com/en/articles/9336943-white-labeled-business-app'
    },
    {
      value: 'driver_app_resources',
      name: t('LEARN_DRIVER_APP_RESOURCES', 'Driver App Resources'),
      url: 'https://help.orderingplus.com/en/articles/9336949-white-labeled-driver-app'
    },
    {
      value: 'points_wallets_and_levels',
      name: t('LEARN_POINT_WALLET_AND_LEVELS', 'Points Wallet and Levels'),
      url: 'https://help.orderingplus.com/en/articles/9336671-loyalty-points-and-levels-general-overview'
    },
    {
      value: 'cash_wallets_and_refunds',
      name: t('LEARN_CASH_WALLETS_AND_REFUNDS', 'Cash wallets and refunds'),
      url: 'https://help.orderingplus.com/en/articles/9336892-cash-wallet'
    },
    {
      value: 'gift_card_settings',
      name: t('LEARN_GIFT_CARD_SETTINGS', 'Gift card settings'),
      url: 'https://help.orderingplus.com/en/articles/9336895-gift-card-solution'
    },
    {
      value: 'catering_settings',
      name: t('LEARN_CATERING_SETTINGS', 'Catering settings'),
      url: 'https://help.orderingplus.com/en/articles/9336929-catering-solution-preorders-and-lead-times'
    },
    {
      value: 'stripe_connect_settings',
      name: t('LEARN_STRIPE_CONNECT_SETTINGS', 'Stripe connect settings'),
      url: 'https://help.orderingplus.com/en/articles/9336935-marketplace-payments-with-stripe-connect'
    },
    {
      value: 'multi_business_settings',
      name: t('LEARN_MULTI_BUSINESS_SETTINGS', 'Multi business settings'),
      url: 'https://help.orderingplus.com/en/articles/9336901-multi-business-checkout'
    }
  ]
  return options.filter((option) => (key.includes(option.value)))
}

export const getOrderingSubdomains = () => {
  const orderingSubdomains = ['tryordering.com', 'ordering.co', 'orderingplus.com']
  return orderingSubdomains.some(subdomain => window.location.hostname.includes(subdomain))
}

export const getFeatureFlags = (key, forceEnable = false) => {
  const activeFeatures = useActiveFeatureFlags()
  return activeFeatures?.includes(key) || forceEnable
}

export {
  CONNECT_BUSINESS_OWNER_PAGES,
  POS_SETUP_CALL_PROVIDERS,
  POS_SETUP_CALL_URL,
  getConnectAllowedLevels,
  isCalendlyUrl,
  isSetupCallIntegration
} from './connectAccess'

export {
  SCHOOLS_ALLOWED_LEVELS,
  canAccessSchoolsPage,
  getConnectVisualAccess,
  isDashboardFeatureEnabled
} from './postHogVisualAccess'

export {
  getSettingsCategoryKeysToFetch,
  getSettingsGuestOrderTypeValues,
  getSettingsOrderTypeValues,
  getSettingsSitesWhere,
  shouldHideUpsellingConfig
} from '../../../utils/settingsAccess'

export const epaycoInputFields = [
  { label: 'RECEIVER_ID', name: 'receiver_id', isSandbox: false, type: 'number' },
  { label: 'RECEIVER_FEE_PERCENTAGE', name: 'receiver_fee_percentage', isSandbox: false, type: 'number' },
  { label: 'RECEIVER_FEE_FIXED', name: 'receiver_fee_fixed', isSandbox: false, type: 'number' }
]

export const epaycoSplitRecieveInputs = [
  { label: 'ID', name: 'id' },
  { label: 'TOTAL', name: 'total' },
  { label: 'IVA', name: 'iva' },
  { label: 'BASE_IVA', name: 'base_iva' },
  { label: 'FEE', name: 'fee' }]

export const usePreventDoubleClick = (callback, delay = 300) => {
  const clickTimeRef = useRef(0)

  const handleClick = useCallback((...args) => {
    const currentTime = new Date().getTime()
    if (currentTime - clickTimeRef.current < delay) {
      return
    }
    clickTimeRef.current = currentTime
    callback(...args)
  }, [callback, delay])

  return handleClick
}

export const parseTemplate = (template, variables, regex) => {
  if (!template) return ''
  return template.replace(regex, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match
  })
}

export const CloverIcon = () => (
  <svg width="46" height="46" viewBox="0 0 46 46" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g filter="url(#filter0_d_21829_12679)">
    <rect x="4" y="3" width="38" height="38" rx="7.6" fill="white"/>
    </g>
    <rect x="10" y="10" width="26" height="25" fill="url(#pattern0_21829_12679)"/>
    <defs>
    <filter id="filter0_d_21829_12679" x="0" y="0" width="46" height="46" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
    <feFlood floodOpacity="0" result="BackgroundImageFix"/>
    <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
    <feOffset dy="1"/>
    <feGaussianBlur stdDeviation="2"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0"/>
    <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_21829_12679"/>
    <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_21829_12679" result="shape"/>
    </filter>
    <pattern id="pattern0_21829_12679" patternContentUnits="objectBoundingBox" width="1" height="1">
    <use xlinkHref="#image0_21829_12679" transform="scale(0.00892857 0.00943396)"/>
    </pattern>
    <image id="image0_21829_12679" width="440" height="106" xlinkHref="data:image/png;base64,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"/>
    </defs>
  </svg>
)

export const connectedToArray = (fromSalesChannels, t) => {
  const optionsDefault =
  [
    {
      id: 1,
      logo: 'https://d3vj0kew82apqn.cloudfront.net/doordash-logo-transparent.png',
      text: t('DOORDASH', 'DoorDash'),
      connected: true,
      enabled: fromSalesChannels
    },
    {
      id: 2,
      logo: 'https://res.cloudinary.com/ordering2/image/upload/v1734639566/luisv4plus/pzdfyvb37unfpugnrkpv.png',
      text: t('UBER_EATS', 'Uber Eats'),
      enabled: fromSalesChannels
    },
    {
      id: 3,
      icon: <CloverIcon />,
      text: t('CLOVER_POS', 'Clover POS'),
      enabled: !fromSalesChannels
    }
  ]

  return optionsDefault.filter(option => option.enabled)
}

export const getUserType = (type = '') => {
  const [{ user }] = useSession()
  if (!type) return true
  if (type === 'readOnlyBusinessOwner') return !!user?.readOnlyBusinessOwner
  if (type === 'readOnlyAdmin') return !!user?.readOnlyAdmin
  if (type === 'readOnlyDeliveryManager') return !!user?.readOnlyDeliveryManager
  if (type === 'viewOnlyBusinessOwner') return !!user?.viewOnlyBusinessOwner

  return false
}
