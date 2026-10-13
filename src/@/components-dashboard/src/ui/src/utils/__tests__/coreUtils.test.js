/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, render, renderHook } from '@testing-library/react'

vi.mock('posthog-js/react', () => ({
  useActiveFeatureFlags: () => ['connectFeatureForPlanPro']
}))

vi.mock('../../../../index.js', () => ({
  CODES: [
    { countryCode: 'US', phoneCode: '+1' },
    { countryCode: 'MX', phoneCode: '+52' }
  ],
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ user: {} }],
  useConfig: () => [{ configs: { plan_pro: { value: true } } }]
}))

import {
  DriverTipsOptions,
  TwelveHours,
  TwentyFourHours,
  addQueryToUrl,
  bytesConverter,
  capitalize,
  checkPreSiteUrl,
  checkSiteUrl,
  checkValidUrlFormat,
  convertHMS,
  convertHoursToMinutes,
  disableReasons,
  epaycoInputFields,
  epaycoSplitRecieveInputs,
  fallbackLogisticEventsText,
  findExitingCode,
  findExitingCountryPhoneCode,
  firstLetterCapital,
  formatSeconds,
  formatUrlVideo,
  formatYearlyPrice,
  getAgoMinutes,
  getAttributeName,
  getCodeNames,
  getCurrenySymbol,
  getCurrentDiffDays,
  getDashboardNotificationIconUrl,
  getFeatureFlags,
  getHours,
  getIconCard,
  getLocale,
  getMinutes,
  getOrderStatuPickUp,
  getOrderStatus,
  getOrderStatusPrefix,
  getOrderingSubdomains,
  getSeconds,
  getStarWidth,
  getStorageItem,
  getUniqueId,
  getUserType,
  learnOptionsValues,
  optimizeImage,
  orderRejectCommentList,
  orderStatus,
  orderTypeList,
  parseBillingNumber,
  parseBillingPrice,
  parseTemplate,
  priceTypeDictionary,
  publicAssetUrl,
  queryStringToObject,
  removeQueryToUrl,
  removeStorageItem,
  reviewCommentList,
  ribbonValues,
  setStorageItem,
  shape,
  sortInputFields,
  stringToSlug,
  usePreventDoubleClick,
  validImageSize,
  verifyDecimals,
  widgetURL,
  CloverIcon,
  connectedToArray,
  scrollTo
} from '../index'

describe('core UI utility helpers', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('formats asset URLs and billing values', () => {
    expect(publicAssetUrl(null)).toBeNull()
    expect(publicAssetUrl('')).toBe('')
    expect(publicAssetUrl('/logo.svg')).toBe('/logo.svg')
    expect(publicAssetUrl('https://cdn.example/logo.svg')).toBe('https://cdn.example/logo.svg')
    expect(publicAssetUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc')
    expect(parseBillingNumber(1234.5)).toBe('1.234,50')
    expect(parseBillingNumber(10, { isTruncable: true, decimal: 2, separator: '.' })).toBe('10.00')
    expect(parseBillingPrice(1234.5, { decimal: 1, separator: '.', thousand: ',', currency: '€', currencyPosition: 'right' }))
      .toBe('1,234.5€')
    expect(parseBillingPrice(10, { currencyPosition: 'left', currency: '$' })).toBe('$10')
    expect(formatYearlyPrice({ yearlyPrice: 120, onlyAmount: true })).toBe(10)
    expect(formatYearlyPrice({
      yearlyPrice: 120,
      isLgText: true,
      t: (_k, fallback) => fallback
    })).toContain('/mo billed at')
    expect(formatYearlyPrice({
      yearlyPrice: 120,
      isLgText: false,
      t: (_k, fallback) => fallback
    })).toBe(parseBillingPrice(10))
    expect(priceTypeDictionary({ type: 'annual' })).toBe('Year')
    expect(priceTypeDictionary({ type: 'monthly' })).toBe('Month')
    expect(priceTypeDictionary({ type: 'custom' })).toBe('custom')
  })

  it('resolves dashboard notification icon fallbacks', () => {
    const fallback = '/assets/isotype.svg'

    expect(getDashboardNotificationIconUrl({
      dashboard_logo: { value: 'https://cdn.example/logo.png' },
      dashboard_favicon: { value: 'https://cdn.example/favicon.png' }
    }, fallback)).toBe('https://cdn.example/favicon.png')

    expect(getDashboardNotificationIconUrl({
      dashboard_favicon: { value: '' },
      dashboard_logo: { value: 'https://cdn.example/logo.png' }
    }, fallback)).toBe('https://cdn.example/logo.png')

    // jsdom runs on localhost, which uses the Ordering.co defaults
    expect(getDashboardNotificationIconUrl({
      dashboard_favicon: { value: '' },
      dashboard_logo: { value: '' }
    }, fallback)).toBe(fallback)

    expect(getDashboardNotificationIconUrl({}, fallback)).toBe(fallback)
  })

  it('optimizes images and formats display helpers', () => {
    expect(optimizeImage(null, '', '/fallback.png')).toBe('/fallback.png')
    expect(optimizeImage('https://res.cloudinary.com/demo/upload/v1/a.jpg', 'w_100'))
      .toBe('https://res.cloudinary.com/demo/upload/f_auto,q_auto,w_100/v1/a.jpg')
    expect(optimizeImage('https://cdn.example/a.jpg')).toBe('https://cdn.example/a.jpg')
    expect(capitalize('ada')).toBe('Ada')
    expect(firstLetterCapital('aDA')).toBe('Ada')
    expect(stringToSlug('  Café Niño!  ')).toBe('cafe_nino')
    expect(bytesConverter(2048)).toBe(2)
    expect(getStarWidth(0)).toBe('0%')
    expect(getStarWidth(4)).toBe('80%')
    expect(getHours(7200)).toBe(2)
    expect(getHours(100)).toBe(0)
    expect(getMinutes(3661)).toBe(1)
    expect(getSeconds(3661)).toBe(1)
    expect(verifyDecimals(4, v => v.toFixed(2))).toBe(4)
    expect(verifyDecimals(4.5, v => v.toFixed(2))).toBe('4.50')
    expect(getUniqueId().length).toBeGreaterThan(5)
    expect(DriverTipsOptions).toEqual([0, 10, 15, 20, 25])
    expect(shape.rectangle).toBe('rectangle')
    expect(ribbonValues.enabled).toBe(false)
    expect(widgetURL).toContain('orderingweb')
    expect(TwelveHours).toHaveLength(24)
    expect(TwentyFourHours).toHaveLength(24)
    expect(epaycoInputFields[0].name).toBe('receiver_id')
    expect(epaycoSplitRecieveInputs[0].name).toBe('id')
  })

  it('formats common display and time values', () => {
    expect(convertHoursToMinutes('')).toBe('0min')
    expect(convertHoursToMinutes('01:30')).toBe('90min')
    expect(convertHMS(65)).toBe('01:05')
    expect(convertHMS(-65)).toBe('-')
    expect(convertHMS(3661)).toBe('01:01:01')
    expect(formatSeconds(3661)).toBe('1:01:01')
    expect(formatSeconds(61)).toBe('1:01')
    expect(formatUrlVideo('https://youtu.be/dQw4w9WgXcQ')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(getAgoMinutes(new Date(Date.now() - 90 * 1000).toISOString())).toMatch(/hrs/)
    expect(getCurrentDiffDays(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString())).toBeGreaterThanOrEqual(1)
  })

  it('parses locale, collection, template, and feature-dependent values', () => {
    const locales = { enUS: 'English', es: 'Spanish', zhCN: 'Chinese', arSA: 'Arabic', ta: 'Tamil', th: 'Thai' }
    expect(getLocale('es-419-1', locales)).toBe('Spanish')
    expect(getLocale('zh-CN', locales)).toBe('Chinese')
    expect(getLocale('ar', locales)).toBe('Arabic')
    expect(getLocale('kn', locales)).toBe('Tamil')
    expect(getLocale('km', locales)).toBe('Thai')
    expect(getLocale('missing', locales)).toBe('English')
    expect(sortInputFields({ values: [{ code: 'email' }, { code: 'name' }] }))
      .toEqual([{ code: 'name' }, { code: 'email' }])
    expect(findExitingCode('us')).toBe('US')
    expect(findExitingCountryPhoneCode('mx')).toBe('+52')
    expect(parseTemplate('Hi {{name}}', { name: 'Ada' }, /{{(\w+)}}/g)).toBe('Hi Ada')
    expect(parseTemplate('', { name: 'Ada' }, /{{(\w+)}}/g)).toBe('')
    expect(orderTypeList(false, {}))
      .toEqual(['delivery', 'pickup', 'eatin', 'curbside', 'drivethru', 'seatdelivery', 'catering_delivery', 'catering_pickup', 'reservation'])
    expect(orderTypeList(false, { plan_pro: { value: true } }))
      .toEqual(['delivery', 'pickup', 'eatin', 'curbside', 'drivethru', 'seatdelivery', 'catering_delivery', 'catering_pickup', 'reservation'])
    expect(orderTypeList(true, {
      plan_enterprise: { value: true },
      addon_catering: { value: true },
      addon_reservation: { value: true }
    })).toContain('9')
    expect(getFeatureFlags('connectFeatureForPlanPro')).toBe(true)
    expect(getFeatureFlags('missing', true)).toBe(true)
  })

  it('covers order status, reject comments, and attribute helpers', () => {
    expect(orderStatus.length).toBeGreaterThan(20)
    expect(getOrderStatus(0).slug).toBe('PENDING_ORDER')
    expect(getOrderStatuPickUp(15).slug).toBe('PICKUP_COMPLETED_BY_CUSTOMER')
    expect(orderRejectCommentList(6)[0].value).toBe('very_far_away')
    expect(orderRejectCommentList(99)).toEqual([])
    expect(getOrderStatusPrefix(0, { _PENDING: 'Pending' }, '')).toBe('Pending')
    expect(getOrderStatusPrefix(999, { _PENDING: 'Pending' })).toBe(999)
    expect(getCodeNames('app_marketplace_x', (_k, f) => f)).toBe('Marketplace App')
    expect(getCodeNames('custom_code', (k, f) => f || k)).toBe('Custom code')
    expect(getAttributeName('enabled')).toBe('Enabled')
    expect(getAttributeName('unknown_key')).toBe('unknown_key')
    expect(getAttributeName('2020-01-01', { parseDate: (v) => `parsed:${v}` })).toContain('parsed:')
    expect(Object.keys(disableReasons()).length).toBeGreaterThan(10)
    expect(reviewCommentList(1)[5].title).toBe('What went well?')
    expect(fallbackLogisticEventsText('LOG_LOGISTIC_STARTED')).toContain('Process started')
    expect(fallbackLogisticEventsText('UNKNOWN_EVENT')).toBe('Unknown event')
  })

  it('covers URL, currency, storage, and query helpers', async () => {
    expect(checkPreSiteUrl(null, '/home')).toBe('/home')
    expect(checkPreSiteUrl('orders')).toBe('/orders')
    expect(checkPreSiteUrl('/orders')).toBe('/orders')
    expect(checkSiteUrl(null, 'https://a.com/')).toBe('https://a.com/')
    expect(checkSiteUrl('https://a.com')).toBe('https://a.com/')
    expect(checkValidUrlFormat('https://example.com/path')).toBe(true)
    expect(checkValidUrlFormat('')).toBeUndefined()
    expect(getCurrenySymbol('USD')).toBeTruthy()
    expect(getCurrenySymbol('ZZZ')).toBe('ZZZ')
    expect(queryStringToObject('https://x.com?a=1&b=2')).toEqual({ a: '1', b: '2' })

    addQueryToUrl({ id: '9' })
    expect(window.location.search).toContain('id=9')
    removeQueryToUrl(['id'])
    expect(window.location.search).toBe('')

    await setStorageItem('k', { a: 1 }, true)
    expect(await getStorageItem('k', true)).toEqual({ a: 1 })
    localStorage.setItem('invalid', '[object Object]')
    expect(await getStorageItem('invalid', true)).toBeNull()
    expect(localStorage.getItem('invalid')).toBeNull()
    await setStorageItem('plain', 'v')
    expect(await getStorageItem('plain')).toBe('v')
    await removeStorageItem('plain')
    expect(await getStorageItem('plain')).toBeNull()
  })

  it('covers learn options, user type, sales channels, and icons', () => {
    const t = (_k, fallback) => fallback
    expect(learnOptionsValues([], t)).toEqual([])
    expect(learnOptionsValues(['order_details', 'store_menu'], t).map(o => o.value))
      .toEqual(['order_details', 'store_menu'])

    const Probe = () => {
      const empty = getUserType()
      const readOnly = getUserType('readOnlyAdmin')
      return <div data-testid='user-type' data-empty={String(empty)} data-readonly={String(readOnly)} />
    }
    const { getByTestId } = render(<Probe />)
    expect(getByTestId('user-type')).toHaveAttribute('data-empty', 'true')
    expect(getByTestId('user-type')).toHaveAttribute('data-readonly', 'false')

    expect(connectedToArray(true, t).map(o => o.text)).toEqual(['DoorDash', 'Uber Eats'])
    expect(connectedToArray(false, t).map(o => o.text)).toEqual(['Clover POS'])
    expect(getOrderingSubdomains()).toBe(false)

    const { container: visa } = render(<>{getIconCard('visa')}</>)
    expect(visa.firstChild).toBeTruthy()
    const { container: mc } = render(<>{getIconCard('mastercard')}</>)
    expect(mc.firstChild).toBeTruthy()
    const { container: other } = render(<>{getIconCard('amex')}</>)
    expect(other.firstChild).toBeTruthy()
    render(<CloverIcon />)
    expect(document.querySelector('svg')).toBeTruthy()
  })

  it('scrolls elements and validates image size', async () => {
    vi.useFakeTimers()
    const element = { scrollTop: 0 }
    scrollTo(element, 100, 40)
    await act(async () => {
      vi.advanceTimersByTime(80)
    })
    expect(element.scrollTop).toBeGreaterThan(0)

    const decode = vi.fn().mockResolvedValue(undefined)
    global.URL.createObjectURL = vi.fn(() => 'blob:mock')
    global.URL.revokeObjectURL = vi.fn()
    class MockImage {
      constructor () {
        this.width = 100
        this.height = 50
        this.decode = decode
      }
    }
    global.Image = MockImage

    await expect(validImageSize({ width: 100, height: 50, file: new Blob() })).resolves.toBe(true)
    await expect(validImageSize({ width: 10, height: 10, file: new Blob() })).resolves.toBe(false)
  })

  it('prevents double clicks through the shared hook', () => {
    vi.useFakeTimers()
    const callback = vi.fn()
    const { result } = renderHook(() => usePreventDoubleClick(callback, 300))

    act(() => {
      result.current()
      result.current()
    })
    expect(callback).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(301)
      result.current()
    })
    expect(callback).toHaveBeenCalledTimes(2)
  })
})
