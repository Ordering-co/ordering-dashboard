export const randomString = (length = 10, alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') => {
  let result = ''
  const charactersLength = alphabet.length
  for (let i = 0; i < length; i++) {
    result += alphabet.charAt(Math.floor(Math.random() * charactersLength))
  }
  return result
}

export const flatArray = arr => [].concat(...arr)

export const deepEqual = (object1, object2) => {
  const keys1 = Object.keys(object1)
  const keys2 = Object.keys(object2)

  if (keys1.length !== keys2.length) {
    return false
  }

  for (const key of keys1) {
    const val1 = object1[key]
    const val2 = object2[key]
    const areObjects = isObject(val1) && isObject(val2)
    if ((areObjects && !deepEqual(val1, val2)) || (!areObjects && val1 !== val2)) {
      return false
    }
  }

  return true
}

const isObject = (object) => {
  return object != null && typeof object === 'object'
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
    .replace(/\s+/g, '_') // collapse whitespace and replace by _
    .replace(/-+/g, '_') // collapse dashes
    .replace(/^-+/, '') // trim - from start of text
    .replace(/-+$/, '') // trim - from end of text

  return str
}

/**
 * Function to transform degree to radian
 * @param {number} value for transform
 *
 */
export const convertToRadian = (value) => {
  return value * Math.PI / 180
}

/**
 * Function to calculate distance
 * @param {*} lat1 lat from fist point
 * @param {*} lon1 lon from fist point
 * @param {*} lat2 lat from second point
 * @param {*} lon2 lon from second point
 */

export const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371 // km
  const dLat = convertToRadian(lat2 - lat1)
  const dLon = convertToRadian(lon2 - lon1)
  const curLat1 = convertToRadian(lat1)
  const curLat2 = convertToRadian(lat2)
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(curLat1) * Math.cos(curLat2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
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
 * Normalizes deprecated timezone names to their modern IANA equivalents
 * @param {string} timezone - The timezone identifier to normalize
 * @returns {string} The normalized timezone identifier
 *
 * IANA renamed Europe/Kiev to Europe/Kyiv in release 2022b (August 11, 2022).
 * The old name remains as a Link (alias) for backward compatibility, but the
 * canonical name is now Europe/Kyiv.
 *
 * Reference: https://data.iana.org/time-zones/tzdb/NEWS
 */
export const normalizeTimezone = (timezone) => {
  if (!timezone) return timezone

  const timezoneMap = {
    'Europe/Kiev': 'Europe/Kyiv'
  }

  return timezoneMap[timezone] || timezone
}

/**
 * Mirrors site.logo into site.header when logo changes or header is empty.
 * Production SEO uses site.header for og:image; owners upload Site logo to site.logo.
 */
export const applySiteLogoHeaderSync = (changes = {}, site = {}) => {
  const siteChanges = { ...changes }
  const logo = siteChanges.logo ?? site?.logo
  if (logo && (siteChanges.logo !== undefined || !site?.header)) {
    siteChanges.header = logo
  }
  return siteChanges
}

export const CONFIG_CATEGORIES_VERSION = 'v2'

export const ORDER_STATUS_REGRESSION_ERROR_CODE = 'order.status_regression'

export const isOrderStatusRegressionError = (errorCodes) => {
  if (!Array.isArray(errorCodes)) return true
  return errorCodes.includes(ORDER_STATUS_REGRESSION_ERROR_CODE)
}

export { getStoredLanguageCode, parseJsonArray, parseJsonObject, parseLogData, safeJsonParse } from './safeJsonParse'
