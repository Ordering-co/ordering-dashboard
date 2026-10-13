import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  CALENDLY_MAX_HEIGHT,
  CALENDLY_MIN_HEIGHT,
  CALENDLY_ORIGIN,
  buildTrialExtensionBookingUrl,
  clampCalendlyHeight,
  getActiveTrialDaysRemaining,
  getTrialDaysRemaining,
  getTrialExtensionEligibility,
  isBillingOwner,
  isCalendlyBookingUrl,
  isEnabledFlag,
  isWhiteLabelProject,
  normalizeHexColor,
  parseCalendlyMessage,
  parseDateValue
} from '../trialExtension'

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = new Date('2026-01-10T00:00:00.000Z').getTime()

const baseConfig = { enabled: true, booking_url: 'https://calendly.com/orderingteam/ordering-demo', days: 14 }
const owner = { level: 0, user_system_id: 123, name: 'Ada', lastname: 'Lovelace', email: 'ada@example.com' }

describe('isBillingOwner', () => {
  it('requires level 0 and a user_system_id', () => {
    expect(isBillingOwner(owner)).toBe(true)
    expect(isBillingOwner({ level: 0 })).toBe(false)
    expect(isBillingOwner({ level: 2, user_system_id: 1 })).toBe(false)
    expect(isBillingOwner(null)).toBe(false)
    expect(isBillingOwner(undefined)).toBe(false)
  })
})

describe('parseDateValue', () => {
  it('parses ISO strings and rejects garbage', () => {
    expect(parseDateValue('2026-01-01T00:00:00.000Z')).toBe(new Date('2026-01-01T00:00:00.000Z').getTime())
    expect(parseDateValue(null)).toBeNull()
    expect(parseDateValue(undefined)).toBeNull()
    expect(parseDateValue('')).toBeNull()
    expect(parseDateValue('not-a-date')).toBeNull()
  })
})

describe('parseDateValue timezone handling (dates from the API are UTC without a zone)', () => {
  const originalTz = process.env.TZ
  const EXPECTED = Date.UTC(2026, 9, 2, 12, 0, 0)

  beforeEach(() => {
    // A non-UTC zone with a non-zero offset on the test date: a naive `new Date(value)` would
    // read the API values as local time and be off by the offset.
    process.env.TZ = 'America/Los_Angeles'
  })

  afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ
    else process.env.TZ = originalTz
  })

  it('runs under a non-UTC timezone', () => {
    expect(new Date(EXPECTED).getTimezoneOffset()).not.toBe(0)
  })

  it('parses the api-core `Y-m-d H:i:s` format as UTC', () => {
    expect(parseDateValue('2026-10-02 12:00:00')).toBe(EXPECTED)
  })

  it('parses a naive ISO string (billing-api) as UTC', () => {
    expect(parseDateValue('2026-10-02T12:00:00')).toBe(EXPECTED)
    expect(parseDateValue('2026-10-02T12:00:00.000000')).toBe(EXPECTED)
    expect(parseDateValue('2026-10-02T12:00')).toBe(EXPECTED)
  })

  it('keeps an explicit Z or offset as given', () => {
    expect(parseDateValue('2026-10-02T12:00:00Z')).toBe(EXPECTED)
    expect(parseDateValue('2026-10-02T12:00:00.000Z')).toBe(EXPECTED)
    expect(parseDateValue('2026-10-02T14:00:00+02:00')).toBe(EXPECTED)
    expect(parseDateValue('2026-10-02T07:00:00-0500')).toBe(EXPECTED)
    expect(parseDateValue('2026-10-02 14:00:00+02:00')).toBe(EXPECTED)
  })

  it('parses a date-only value as UTC midnight', () => {
    expect(parseDateValue('2026-10-02')).toBe(Date.UTC(2026, 9, 2))
  })

  it('accepts epoch millis and Date instances unchanged', () => {
    expect(parseDateValue(EXPECTED)).toBe(EXPECTED)
    expect(parseDateValue(new Date(EXPECTED))).toBe(EXPECTED)
    expect(parseDateValue(Number.NaN)).toBeNull()
    expect(parseDateValue(new Date('invalid'))).toBeNull()
    expect(parseDateValue({})).toBeNull()
    expect(parseDateValue('   ')).toBeNull()
  })

  it('computes eligibility and days left from UTC API dates, not local time', () => {
    const now = Date.UTC(2026, 9, 1, 12, 0, 0)
    const result = getTrialExtensionEligibility({
      config: baseConfig,
      user: owner,
      trialSubscription: { status: 'trialing', start_date: '2026-09-29 12:00:00', trial_end: '2026-10-02 12:00:00' },
      now
    })
    expect(result.trialEnd).toBe(EXPECTED)
    expect(result.daysRemaining).toBe(1)
    expect(result.available).toBe(true)

    // One minute after the UTC trial end the offer is gone, whatever the browser's zone.
    expect(getTrialExtensionEligibility({
      config: baseConfig,
      user: owner,
      trialSubscription: { status: 'trialing', start_date: '2026-09-29 12:00:00', trial_end: '2026-10-02 12:00:00' },
      now: EXPECTED + 60 * 1000
    }).available).toBe(false)
  })
})

describe('isEnabledFlag', () => {
  it('accepts boolean, numeric and string truthy flags', () => {
    expect(isEnabledFlag(true)).toBe(true)
    expect(isEnabledFlag(1)).toBe(true)
    expect(isEnabledFlag('1')).toBe(true)
    expect(isEnabledFlag('true')).toBe(true)
    expect(isEnabledFlag(' TRUE ')).toBe(true)
  })

  it('treats falsy-looking strings and other values as disabled', () => {
    expect(isEnabledFlag(false)).toBe(false)
    expect(isEnabledFlag(0)).toBe(false)
    expect(isEnabledFlag('0')).toBe(false)
    expect(isEnabledFlag('false')).toBe(false)
    expect(isEnabledFlag('')).toBe(false)
    expect(isEnabledFlag(null)).toBe(false)
    expect(isEnabledFlag(undefined)).toBe(false)
  })
})

describe('isWhiteLabelProject', () => {
  it('is true for the deployment flag is_white_label', () => {
    expect(isWhiteLabelProject({ isWhiteLabel: true })).toBe(true)
    expect(isWhiteLabelProject({ isWhiteLabel: '1' })).toBe(true)
  })

  it('ignores the white_label_module project config (trial plans ship with it on)', () => {
    expect(isWhiteLabelProject({ configs: { white_label_module: { value: '1' } } })).toBe(false)
    expect(isWhiteLabelProject({ configs: { white_label_module: { value: true } } })).toBe(false)
  })

  it('is false otherwise', () => {
    expect(isWhiteLabelProject()).toBe(false)
    expect(isWhiteLabelProject({ isWhiteLabel: false })).toBe(false)
    expect(isWhiteLabelProject({ isWhiteLabel: '0' })).toBe(false)
  })
})

describe('getTrialDaysRemaining', () => {
  it('rounds up remaining time and floors at 0', () => {
    expect(getTrialDaysRemaining(NOW + DAY_MS * 2.5, NOW)).toBe(3)
    expect(getTrialDaysRemaining(NOW + 1000, NOW)).toBe(1)
    expect(getTrialDaysRemaining(NOW - DAY_MS, NOW)).toBe(0)
    expect(getTrialDaysRemaining(null, NOW)).toBe(0)
  })
})

describe('getActiveTrialDaysRemaining', () => {
  const trial = { status: 'trialing', start_date: '2026-10-01T12:35:54', trial_end: '2026-10-04T12:35:54' }
  const now = new Date('2026-10-01T15:00:00.000Z').getTime()

  it('returns the days left of a running trial, parsing naive dates as UTC', () => {
    expect(getActiveTrialDaysRemaining(trial, now)).toBe(3)
    expect(getActiveTrialDaysRemaining({ ...trial, trial_end: '2026-10-04 12:35:54' }, Date.UTC(2026, 9, 4, 11))).toBe(1)
  })

  it('returns null without an active trial', () => {
    expect(getActiveTrialDaysRemaining(null, now)).toBeNull()
    expect(getActiveTrialDaysRemaining({ ...trial, status: 'active' }, now)).toBeNull()
    expect(getActiveTrialDaysRemaining({ ...trial, trial_end: null }, now)).toBeNull()
    expect(getActiveTrialDaysRemaining(trial, Date.UTC(2026, 9, 4, 12, 35, 54))).toBeNull()
  })
})

describe('getTrialExtensionEligibility', () => {
  const trialingSubscription = {
    status: 'trialing',
    start_date: new Date(NOW - DAY_MS).toISOString(),
    trial_end: new Date(NOW + DAY_MS * 2).toISOString()
  }

  it('is available for a billing owner mid-trial, under the duration cap', () => {
    const result = getTrialExtensionEligibility({
      config: baseConfig,
      user: owner,
      trialSubscription: trialingSubscription,
      now: NOW
    })
    expect(result.available).toBe(true)
    expect(result.daysRemaining).toBe(2)
    expect(result.trialEnd).toBe(parseDateValue(trialingSubscription.trial_end))
  })

  it('is unavailable when the feature is disabled or missing a booking_url', () => {
    expect(getTrialExtensionEligibility({
      config: { ...baseConfig, enabled: false },
      user: owner,
      trialSubscription: trialingSubscription,
      now: NOW
    }).available).toBe(false)

    expect(getTrialExtensionEligibility({
      config: { ...baseConfig, booking_url: '' },
      user: owner,
      trialSubscription: trialingSubscription,
      now: NOW
    }).available).toBe(false)
  })

  it('is unavailable for a non billing-owner user', () => {
    expect(getTrialExtensionEligibility({
      config: baseConfig,
      user: { level: 2, user_system_id: 1 },
      trialSubscription: trialingSubscription,
      now: NOW
    }).available).toBe(false)
  })

  it('is unavailable without a trialing subscription', () => {
    expect(getTrialExtensionEligibility({
      config: baseConfig,
      user: owner,
      trialSubscription: null,
      now: NOW
    }).available).toBe(false)

    expect(getTrialExtensionEligibility({
      config: baseConfig,
      user: owner,
      trialSubscription: { ...trialingSubscription, status: 'active' },
      now: NOW
    }).available).toBe(false)
  })

  it('is unavailable once trial_end has passed', () => {
    expect(getTrialExtensionEligibility({
      config: baseConfig,
      user: owner,
      trialSubscription: { ...trialingSubscription, trial_end: new Date(NOW - 1000).toISOString() },
      now: NOW
    }).available).toBe(false)
  })

  it('disappears once the trial has already been extended to (near) the full duration', () => {
    // start_date 14 days before trial_end: this trial has already been extended.
    const extended = {
      status: 'trialing',
      start_date: new Date(NOW - DAY_MS * 13).toISOString(),
      trial_end: new Date(NOW + DAY_MS).toISOString()
    }
    expect(getTrialExtensionEligibility({
      config: baseConfig,
      user: owner,
      trialSubscription: extended,
      now: NOW
    }).available).toBe(false)
  })

  it('still offers the extension when start_date is missing (duration unknown)', () => {
    const noStartDate = { status: 'trialing', trial_end: new Date(NOW + DAY_MS).toISOString() }
    expect(getTrialExtensionEligibility({
      config: baseConfig,
      user: owner,
      trialSubscription: noStartDate,
      now: NOW
    }).available).toBe(true)
  })

  it.each([
    [13.5, true],
    [14 - 1 / DAY_MS, true],
    [14, false],
    [15, false]
  ])('uses the exact total duration for a %s-day trial', (duration, available) => {
    const result = getTrialExtensionEligibility({
      config: baseConfig,
      user: owner,
      trialSubscription: {
        status: 'trialing',
        start_date: new Date(NOW - DAY_MS).toISOString(),
        trial_end: new Date(NOW - DAY_MS + duration * DAY_MS).toISOString()
      },
      now: NOW
    })
    expect(result.available).toBe(available)
  })

  it('is unavailable once booked, even if otherwise eligible', () => {
    expect(getTrialExtensionEligibility({
      config: baseConfig,
      user: owner,
      trialSubscription: trialingSubscription,
      booked: true,
      now: NOW
    }).available).toBe(false)
  })

  it('is never available for a white-label project', () => {
    expect(getTrialExtensionEligibility({
      config: baseConfig,
      user: owner,
      trialSubscription: trialingSubscription,
      whiteLabel: true,
      now: NOW
    }).available).toBe(false)
  })

  it('is available on a production trial (naive UTC billing-api dates, 3-day trial)', () => {
    const productionTrial = { status: 'trialing', start_date: '2026-10-01T12:35:54', trial_end: '2026-10-04T12:35:54' }
    const now = new Date('2026-10-01T15:00:00.000Z').getTime()
    const result = getTrialExtensionEligibility({
      config: baseConfig,
      user: owner,
      trialSubscription: productionTrial,
      whiteLabel: isWhiteLabelProject({ isWhiteLabel: false, configs: { white_label_module: { value: true } } }),
      now
    })
    expect(result.available).toBe(true)
    expect(result.daysRemaining).toBe(3)
    expect(result.trialEnd).toBe(Date.UTC(2026, 9, 4, 12, 35, 54))
  })

  it('falls back to the default 14-day cap when config.days is missing', () => {
    const result = getTrialExtensionEligibility({
      config: { enabled: true, booking_url: baseConfig.booking_url },
      user: owner,
      trialSubscription: trialingSubscription,
      now: NOW
    })
    expect(result.available).toBe(true)
  })
})

describe('normalizeHexColor', () => {
  it('accepts 6-digit hex with or without a leading #', () => {
    expect(normalizeHexColor('#2C7BE5')).toBe('2c7be5')
    expect(normalizeHexColor('2C7BE5')).toBe('2c7be5')
  })

  it('rejects non 6-digit values', () => {
    expect(normalizeHexColor('#333')).toBeNull()
    expect(normalizeHexColor('#FFF')).toBeNull()
    expect(normalizeHexColor('not-a-color')).toBeNull()
    expect(normalizeHexColor(null)).toBeNull()
    expect(normalizeHexColor(undefined)).toBeNull()
  })
})

describe('buildTrialExtensionBookingUrl', () => {
  const baseArgs = {
    baseUrl: 'https://calendly.com/orderingteam/ordering-demo',
    user: owner,
    project: { code: 'acme-project' },
    source: 'dashboard'
  }

  it('builds the fallback (non-embed) link with attribution + appearance params', () => {
    const href = buildTrialExtensionBookingUrl(baseArgs)
    const url = new URL(href)
    expect(url.searchParams.get('name')).toBe('Ada Lovelace')
    expect(url.searchParams.get('email')).toBe('ada@example.com')
    expect(url.searchParams.get('utm_source')).toBe('dashboard')
    expect(url.searchParams.get('utm_medium')).toBe('trial_extension')
    expect(url.searchParams.get('utm_campaign')).toBe('free_trial')
    expect(url.searchParams.get('utm_content')).toBe('acme-project')
    expect(url.searchParams.get('hide_event_type_details')).toBe('1')
    expect(url.searchParams.get('hide_gdpr_banner')).toBe('1')
    expect(url.searchParams.has('embed_domain')).toBe(false)
    expect(url.searchParams.has('embed_type')).toBe(false)
  })

  it('adds embed_domain + embed_type only for the iframe variant', () => {
    const href = buildTrialExtensionBookingUrl({ ...baseArgs, embedDomain: 'dashboard.orderingplus.com' })
    const url = new URL(href)
    expect(url.searchParams.get('embed_domain')).toBe('dashboard.orderingplus.com')
    expect(url.searchParams.get('embed_type')).toBe('Inline')
  })

  it('adds appearance colors only when they are valid 6-digit hex', () => {
    const href = buildTrialExtensionBookingUrl({
      ...baseArgs,
      primaryColor: '#2C7BE5',
      textColor: '#333',
      backgroundColor: '#FFFFFF'
    })
    const url = new URL(href)
    expect(url.searchParams.get('primary_color')).toBe('2c7be5')
    expect(url.searchParams.has('text_color')).toBe(false)
    expect(url.searchParams.get('background_color')).toBe('ffffff')
  })

  it('omits params with an empty value (e.g. missing name/email/project code)', () => {
    const href = buildTrialExtensionBookingUrl({
      baseUrl: baseArgs.baseUrl,
      user: {},
      project: {},
      source: 'dashboard'
    })
    const url = new URL(href)
    expect(url.searchParams.has('name')).toBe(false)
    expect(url.searchParams.has('email')).toBe(false)
    expect(url.searchParams.has('utm_content')).toBe(false)
  })

  it('returns an empty string without a baseUrl', () => {
    expect(buildTrialExtensionBookingUrl({ user: owner })).toBe('')
  })

  it('returns an empty string for an invalid baseUrl', () => {
    expect(buildTrialExtensionBookingUrl({ baseUrl: 'not a url', user: owner })).toBe('')
  })

  it('refuses a non-Calendly host so the dashboard never embeds it or prefills the owner email there', () => {
    expect(isCalendlyBookingUrl('https://calendly.com/orderingteam/ordering-demo')).toBe(true)
    expect(isCalendlyBookingUrl('https://evil.example/calendly.com')).toBe(false)
    expect(isCalendlyBookingUrl('http://calendly.com/orderingteam/ordering-demo')).toBe(false)
    expect(buildTrialExtensionBookingUrl({
      ...baseArgs,
      baseUrl: 'https://evil.example/phish'
    })).toBe('')
    expect(getTrialExtensionEligibility({
      config: { ...baseConfig, booking_url: 'https://evil.example/phish' },
      user: owner,
      trialSubscription: {
        status: 'trialing',
        start_date: new Date(NOW - DAY_MS).toISOString(),
        trial_end: new Date(NOW + DAY_MS * 2).toISOString()
      },
      now: NOW
    }).available).toBe(false)
  })
})

describe('clampCalendlyHeight', () => {
  it('parses a CSS length string and rounds up', () => {
    expect(clampCalendlyHeight('711.2px')).toBe(712)
    expect(clampCalendlyHeight('900px')).toBe(900)
  })

  it('rejects out-of-range or non-numeric values', () => {
    expect(clampCalendlyHeight(`${CALENDLY_MIN_HEIGHT - 1}px`)).toBeNull()
    expect(clampCalendlyHeight(`${CALENDLY_MAX_HEIGHT + 1}px`)).toBeNull()
    expect(clampCalendlyHeight('not-a-height')).toBeNull()
    expect(clampCalendlyHeight(undefined)).toBeNull()
  })

  it('accepts the boundary values', () => {
    expect(clampCalendlyHeight(`${CALENDLY_MIN_HEIGHT}px`)).toBe(CALENDLY_MIN_HEIGHT)
    expect(clampCalendlyHeight(`${CALENDLY_MAX_HEIGHT}px`)).toBe(CALENDLY_MAX_HEIGHT)
  })
})

describe('parseCalendlyMessage', () => {
  const iframeWindow = {}

  it('ignores events from a different origin', () => {
    const event = { origin: 'https://evil.example', source: iframeWindow, data: { event: 'calendly.event_scheduled' } }
    expect(parseCalendlyMessage(event, iframeWindow)).toBeNull()
  })

  it('ignores events whose source is not the embed iframe window', () => {
    const event = { origin: CALENDLY_ORIGIN, source: {}, data: { event: 'calendly.event_scheduled' } }
    expect(parseCalendlyMessage(event, iframeWindow)).toBeNull()
  })

  it('ignores non-Calendly message shapes', () => {
    const event = { origin: CALENDLY_ORIGIN, source: iframeWindow, data: { event: 'something.else' } }
    expect(parseCalendlyMessage(event, iframeWindow)).toBeNull()
    expect(parseCalendlyMessage({ origin: CALENDLY_ORIGIN, source: iframeWindow, data: {} }, iframeWindow)).toBeNull()
    expect(parseCalendlyMessage(null, iframeWindow)).toBeNull()
  })

  it('parses calendly.page_height with a clamped height', () => {
    const event = {
      origin: CALENDLY_ORIGIN,
      source: iframeWindow,
      data: { event: 'calendly.page_height', payload: { height: '711px' } }
    }
    expect(parseCalendlyMessage(event, iframeWindow)).toEqual({
      type: 'calendly.page_height',
      height: 711,
      payload: { height: '711px' }
    })
  })

  it('parses calendly.event_scheduled and other calendly.* events without a height', () => {
    const payload = { event: { uri: 'https://api.calendly.com/scheduled_events/123' } }
    const event = { origin: CALENDLY_ORIGIN, source: iframeWindow, data: { event: 'calendly.event_scheduled', payload } }
    expect(parseCalendlyMessage(event, iframeWindow)).toEqual({ type: 'calendly.event_scheduled', payload })
  })
})
