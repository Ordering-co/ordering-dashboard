import { describe, expect, test } from 'vitest'

import { JOURNEY_TEMPLATES, getJourneyTemplate } from './journeyTemplates'
import {
  buildJourneyPayload,
  buildJourneySummary,
  buildJourneyUpdatePayload,
  getInitialJourneyForm,
  getJourneyChannelsStatus,
  getJourneyFormFromPromotion,
  getJourneyValueWithDefaultTime,
  getPromotionWorkspaceView,
  JOURNEY_VIEWS,
  setPromotionWorkspaceView,
  validateJourneyForm
} from './journeyUtils'

const validForm = templateKey => ({
  ...getInitialJourneyForm(templateKey),
  name: 'Test promotion',
  rate: templateKey === 'free_delivery' ? '100' : templateKey === 'buy_x_get_y' ? '1' : '15',
  minimum: templateKey === 'buy_x_get_y' ? '2' : '20',
  maxDiscount: '10',
  limitPerUser: '1',
  start: '2026-09-01T09:00',
  end: '2026-09-30T22:00',
  businesses: [10],
  allBusinesses: [10, 11, 12],
  sites: [3, 4],
  loyaltyLevels: templateKey === 'loyalty_reward' ? [4] : [],
  products: templateKey === 'buy_x_get_y' ? { 22: { id: 22, include: true } } : {},
  selectedBusinessId: templateKey === 'buy_x_get_y' ? 10 : '',
  scopeMode: templateKey === 'buy_x_get_y' ? 'selected' : 'all',
  schedule: templateKey === 'slow_hours'
    ? [{ enabled: true, lapses: [{ open: { hour: 14, minute: 0 }, close: { hour: 17, minute: 0 } }] }]
    : null,
  currencySymbol: '$',
  inactivityDays: templateKey === 'winback' ? '30' : ''
})

describe('promotion journey navigation', () => {
  test('opens Journeys by default and preserves legacy id deep links', () => {
    expect(getPromotionWorkspaceView('')).toBe(JOURNEY_VIEWS.JOURNEYS)
    expect(getPromotionWorkspaceView('?id=42')).toBe(JOURNEY_VIEWS.ADVANCED)
    expect(getPromotionWorkspaceView('?page=2&pageSize=25')).toBe(JOURNEY_VIEWS.ADVANCED)
    expect(getPromotionWorkspaceView('?view=journeys&id=42')).toBe(JOURNEY_VIEWS.JOURNEYS)
  })

  test('clears advanced-only query state when switching to Quick offers', () => {
    expect(setPromotionWorkspaceView('?page=2&pageSize=25&id=4', JOURNEY_VIEWS.JOURNEYS)).toBe('?view=journeys')
    expect(setPromotionWorkspaceView('?page=2', JOURNEY_VIEWS.ADVANCED, 9)).toBe('?page=2&view=advanced_offers&id=9')
  })
})
describe('promotion journey templates', () => {
  test('defaults the first selected start and end times without overriding later edits', () => {
    expect(getJourneyValueWithDefaultTime({ value: '2026-09-01', previousValue: '', type: 'start' })).toBe('2026-09-01T00:00')
    expect(getJourneyValueWithDefaultTime({ value: '2026-09-30', previousValue: '', type: 'end' })).toBe('2026-09-30T23:59')
    expect(getJourneyValueWithDefaultTime({ value: '2026-09-01T08:34', previousValue: '', type: 'start' })).toBe('2026-09-01T08:34')
    expect(getJourneyValueWithDefaultTime({ value: '2026-09-01T10:15', previousValue: '2026-09-01T00:00', type: 'start' })).toBe('2026-09-01T10:15')
  })

  test('prefills template decisions that should not be repeated', () => {
    const firstPurchase = getInitialJourneyForm('first_order')
    const freeDelivery = getInitialJourneyForm('free_delivery')
    expect(firstPurchase).toMatchObject({ name: 'First purchase', limitPerUser: 1, scopeMode: 'all', includeOptions: false })
    expect(freeDelivery).toMatchObject({ name: 'Free delivery', rate: 100 })
    expect(getInitialJourneyForm('slow_hours').name).toBe('Happy hour')
    expect(getInitialJourneyForm('winback').name).toBe('We miss you')
    expect(getInitialJourneyForm('buy_x_get_y')).toMatchObject({ minimum: 2, rate: 1 })
  })

  test('all eight templates build disabled offer payloads', () => {
    expect(JOURNEY_TEMPLATES).toHaveLength(8)
    JOURNEY_TEMPLATES.forEach(template => {
      const form = validForm(template.key)
      const errors = validateJourneyForm({ template, form, currencyAvailable: true, loyaltyAvailable: true })
      expect(errors).toEqual({})
      expect(buildJourneyPayload({ template, form })).toMatchObject({
        enabled: false,
        include_options: false
      })
    })
  })

  test('serializes the default promotion window through the end of the selected day', () => {
    const form = {
      ...validForm('first_order'),
      start: getJourneyValueWithDefaultTime({ value: '2026-09-01', previousValue: '', type: 'start' }),
      end: getJourneyValueWithDefaultTime({ value: '2026-09-30', previousValue: '', type: 'end' })
    }
    expect(buildJourneyPayload({ template: getJourneyTemplate('first_order'), form })).toMatchObject({
      start: '2026-09-01 00:00:00',
      end: '2026-09-30 23:59:59'
    })
  })

  test('distinguishes empty loaded sales channels from loading and failure states', () => {
    expect(getJourneyChannelsStatus({ sitesState: { sites: [], loading: false, error: null } })).toBe('ready')
    expect(getJourneyChannelsStatus({ sitesState: { sites: [], loading: true, error: null } })).toBe('loading')
    expect(getJourneyChannelsStatus({ sitesState: { sites: [], loading: false, error: ['Unavailable'] } })).toBe('error')
    expect(getJourneyChannelsStatus({ sitesState: { sites: [], loading: false, error: [] } })).toBe('ready')
    expect(getJourneyChannelsStatus({ promotionId: 42, sitesState: { loading: false, error: ['Unavailable'] } })).toBe('ready')
  })

  test('preflight only blocks sales channels while loading or after a load failure', () => {
    const template = getJourneyTemplate('first_order')
    const form = { ...validForm('first_order'), sites: [] }
    expect(validateJourneyForm({ template, form, channelsStatus: 'ready' }).channels).toBeUndefined()
    expect(validateJourneyForm({ template, form, channelsStatus: 'loading' }).channels).toContain('still loading')
    expect(validateJourneyForm({ template, form, channelsStatus: 'error' }).channels).toContain('could not be loaded')
  })

  test('first and second purchase use exact order counts', () => {
    const first = buildJourneyPayload({ template: getJourneyTemplate('first_order'), form: validForm('first_order') })
    const second = buildJourneyPayload({ template: getJourneyTemplate('second_order'), form: validForm('second_order') })
    expect(first).toMatchObject({ user_order_count: 0, user_order_count_condition: '=' })
    expect(second).toMatchObject({ user_order_count: 1, user_order_count_condition: '=' })
  })

  test('all businesses sends every available business id instead of an empty array', () => {
    const form = { ...validForm('first_order'), scopeMode: 'all', businesses: [] }
    const payload = buildJourneyPayload({ template: getJourneyTemplate('first_order'), form })
    expect(payload.businesses).toEqual([10, 11, 12])
  })

  test('template-specific fields map to existing offer fields', () => {
    const delivery = buildJourneyPayload({ template: getJourneyTemplate('free_delivery'), form: validForm('free_delivery') })
    const products = buildJourneyPayload({ template: getJourneyTemplate('buy_x_get_y'), form: validForm('buy_x_get_y') })
    const loyalty = buildJourneyPayload({ template: getJourneyTemplate('loyalty_reward'), form: validForm('loyalty_reward') })
    const slowHours = buildJourneyPayload({ template: getJourneyTemplate('slow_hours'), form: validForm('slow_hours') })
    const winback = buildJourneyPayload({ template: getJourneyTemplate('winback'), form: validForm('winback') })

    expect(delivery).toMatchObject({ target: 2, rate_type: 1, rate: 100 })
    expect(products.businesses).toEqual([10])
    expect(products).toMatchObject({ condition_type: 2, rate_type: 2, rate: 1, minimum: 2 })
    expect(products.products).toEqual([{ id: 22, include: true, is_condition: true }])
    expect(loyalty.loyalty_levels).toEqual([4])
    expect(JSON.parse(slowHours.schedule)[0].enabled).toBe(true)
    expect(winback.valid_from_after_user_last_order_minutes).toBe(43200)
    expect(winback).toMatchObject({ user_order_count: 0, user_order_count_condition: '>' })
  })

  test('maps the existing include_options rule in both payload directions', () => {
    const template = getJourneyTemplate('minimum_purchase')
    const payload = buildJourneyPayload({
      template,
      form: { ...validForm('minimum_purchase'), includeOptions: true }
    })
    expect(payload.include_options).toBe(true)

    const { form } = getJourneyFormFromPromotion({
      promotion: {
        name: 'Options included',
        condition_type: 1,
        target: 1,
        rate: 10,
        rate_type: 1,
        minimum: 20,
        include_options: 1,
        businesses: [{ id: 10 }]
      },
      allSiteIds: [3],
      allBusinessIds: [10]
    })
    expect(form.includeOptions).toBe(true)
  })

  test('forces product options off when rebuilding an existing Buy X, get Y payload', () => {
    const { template, form } = getJourneyFormFromPromotion({
      promotion: {
        name: 'Legacy options-included BOGO',
        condition_type: 2,
        target: 1,
        rate: 1,
        rate_type: 2,
        minimum: 2,
        include_options: 1,
        businesses: [{ id: 10 }],
        products: [{ id: 22, business_id: 10 }]
      },
      allBusinessIds: [10]
    })

    expect(template.key).toBe('buy_x_get_y')
    expect(form.includeOptions).toBe(true)
    expect(buildJourneyPayload({ template, form }).include_options).toBe(false)
  })

  test('preserves relationship names for selected products that are no longer in the catalog', () => {
    const { form } = getJourneyFormFromPromotion({
      promotion: {
        name: 'Archived selection',
        condition_type: 2,
        target: 1,
        rate: 1,
        rate_type: 2,
        minimum: 2,
        businesses: [{ id: 10 }],
        products: [{ id: 99, name: 'Archived burger', business_id: 10 }]
      },
      allBusinessIds: [10]
    })

    expect(form.products[99]).toMatchObject({ id: 99, include: true, name: 'Archived burger' })
  })

  test('preflight blocks missing commercial fields and unsafe dates', () => {
    const template = getJourneyTemplate('first_order')
    const form = { ...validForm('first_order'), rate: '', minimum: '', end: '2026-08-01T10:00', scopeMode: 'selected', businesses: [] }
    const errors = validateJourneyForm({ template, form, currencyAvailable: true, loyaltyAvailable: true })
    expect(errors).toMatchObject({ rate: expect.any(String), minimum: expect.any(String), end: expect.any(String), scope: expect.any(String) })
  })

  test('preflight blocks all-business offers until every business id is available', () => {
    const template = getJourneyTemplate('first_order')
    const errors = validateJourneyForm({
      template,
      form: { ...validForm('first_order'), scopeMode: 'all', allBusinesses: [] },
      currencyAvailable: true,
      loyaltyAvailable: true
    })
    expect(errors.scope.toLowerCase()).toContain('business')
  })

  test('Buy X, get Y requires one business and at least one product', () => {
    const template = getJourneyTemplate('buy_x_get_y')
    const errors = validateJourneyForm({
      template,
      form: { ...validForm('buy_x_get_y'), selectedBusinessId: '', businesses: [], products: {} },
      loyaltyAvailable: true
    })
    expect(errors).toMatchObject({ eligibilityBusiness: expect.any(String), eligibility: expect.any(String) })
  })

  test('Buy X, get Y only accepts whole quantities and keeps at least one paid item', () => {
    const template = getJourneyTemplate('buy_x_get_y')
    expect(validateJourneyForm({
      template,
      form: { ...validForm('buy_x_get_y'), minimum: '2.5', rate: '1' }
    })).toMatchObject({ minimum: expect.any(String) })
    expect(validateJourneyForm({
      template,
      form: { ...validForm('buy_x_get_y'), minimum: '2', rate: '2' }
    })).toMatchObject({ rate: expect.stringContaining('fewer') })
    expect(validateJourneyForm({
      template,
      form: { ...validForm('buy_x_get_y'), minimum: '3', rate: '1.5' }
    })).toMatchObject({ rate: expect.any(String) })
  })

  test('preflight rejects percentage benefits above 100', () => {
    const template = getJourneyTemplate('first_order')
    const errors = validateJourneyForm({ template, form: { ...validForm('first_order'), rate: '101' }, currencyAvailable: true, loyaltyAvailable: true })
    expect(errors.rate).toContain('100')
  })

  test('summary is deterministic and reflects the exact audience', () => {
    const form = validForm('second_order')
    expect(buildJourneySummary({ template: getJourneyTemplate('second_order'), form })).toContain('Customers with exactly 1 order')
    expect(buildJourneySummary({ template: getJourneyTemplate('second_order'), form })).toContain('15% off')
    expect(buildJourneySummary({ template: getJourneyTemplate('second_order'), form })).toContain('all businesses and sales channels')
  })

  test('summary names the fee target represented by the payload', () => {
    const deliveryForm = validForm('free_delivery')
    expect(buildJourneySummary({ template: getJourneyTemplate('free_delivery'), form: deliveryForm })).toContain('100% off delivery fee')

    const serviceFeeForm = { ...validForm('minimum_purchase'), target: 3, rateType: 2, rate: 5 }
    expect(buildJourneySummary({ template: getJourneyTemplate('minimum_purchase'), form: serviceFeeForm })).toContain('5 $ off service fee')
  })

  test('Buy X, get Y summary describes the same eligible product set as the payload', () => {
    const summary = buildJourneySummary({ template: getJourneyTemplate('buy_x_get_y'), form: validForm('buy_x_get_y') })
    expect(summary).toContain('When the cart contains 2 eligible items from 1 selected product(s)')
    expect(summary).toContain('1 of those eligible items become free at the selected store')
  })

  test('maps an existing promotion back into the Journeys editor', () => {
    const { template, form } = getJourneyFormFromPromotion({
      promotion: {
        id: 99,
        name: 'Welcome offer',
        rate: 20,
        rate_type: 1,
        minimum: 30,
        limit_per_user: 1,
        start: '2026-09-01 09:00:00',
        end: '2026-09-30 22:00:00',
        user_order_count: 0,
        user_order_count_condition: '=',
        businesses: [{ id: 10 }],
        sites: [{ id: 4 }]
      },
      allSiteIds: [3, 4],
      allBusinessIds: [10, 11]
    })
    expect(template.key).toBe('first_order')
    expect(form).toMatchObject({ name: 'Welcome offer', descriptionEdited: false, start: '2026-09-01T09:00', businesses: [10], allBusinesses: [10, 11], sites: [4], scopeMode: 'selected' })
  })

  test('preserves relationship exclusions represented by pivot.include', () => {
    const { form } = getJourneyFormFromPromotion({
      promotion: {
        name: 'Excluded product',
        condition_type: 2,
        rate: 1,
        rate_type: 2,
        minimum: 2,
        businesses: [{ id: 10 }],
        products: [{ id: 22, pivot: { include: 0 } }]
      },
      allBusinessIds: [10]
    })
    expect(form.products[22]).toMatchObject({ id: 22, include: false })
  })

  test('does not classify a missing order count as a first-purchase offer', () => {
    const { template } = getJourneyFormFromPromotion({
      promotion: {
        name: 'Generic offer',
        condition_type: 1,
        rate: 10,
        rate_type: 1,
        minimum: 20,
        user_order_count: null,
        user_order_count_condition: '=',
        businesses: [{ id: 10 }]
      },
      allBusinessIds: [10]
    })
    expect(template.key).toBe('minimum_purchase')
  })

  test('keeps every existing business when rebuilding Buy X, get Y', () => {
    const { template, form } = getJourneyFormFromPromotion({
      promotion: {
        name: 'Multi-store products',
        condition_type: 2,
        rate: 1,
        rate_type: 2,
        minimum: 2,
        businesses: [{ id: 10 }, { id: 11 }],
        products: [{ id: 22, business_id: 10 }]
      },
      allBusinessIds: [10, 11, 12]
    })
    expect(form.businesses).toEqual([10, 11])
    expect(buildJourneyPayload({ template, form }).businesses).toEqual([10, 11])
  })

  test('existing edits send only fields changed in Quick offers', () => {
    const payload = buildJourneyPayload({
      template: getJourneyTemplate('minimum_purchase'),
      form: validForm('minimum_purchase')
    })
    expect(buildJourneyUpdatePayload({
      payload,
      dirtyFields: { rate: true },
      descriptionEdited: false
    })).toEqual({ rate: 15, description: payload.description })
    expect(buildJourneyUpdatePayload({
      payload,
      dirtyFields: { name: true },
      descriptionEdited: false
    })).toEqual({ name: 'Test promotion' })
    expect(buildJourneyUpdatePayload({
      payload: { ...payload, include_options: false },
      dirtyFields: { name: true },
      requiredPayloadKeys: ['include_options']
    })).toMatchObject({ name: 'Test promotion', include_options: false })
  })

  test('site loading is not exposed as a customer decision or validation error', () => {
    const template = getJourneyTemplate('first_order')
    const errors = validateJourneyForm({ template, form: { ...validForm('first_order'), sites: [] } })
    expect(errors.sites).toBeUndefined()
  })

  test('recognizes an offer containing every available business as all businesses', () => {
    const { form } = getJourneyFormFromPromotion({
      promotion: {
        id: 100,
        name: 'All stores offer',
        rate: 10,
        rate_type: 1,
        minimum: 20,
        limit_per_user: 1,
        start: '2026-09-01 09:00:00',
        end: '2026-09-30 22:00:00',
        user_order_count: 0,
        user_order_count_condition: '=',
        businesses: [{ id: 10 }, { id: 11 }]
      },
      allSiteIds: [3],
      allBusinessIds: [10, 11]
    })
    expect(form.scopeMode).toBe('all')
  })

  test('maps an existing category-based Buy X, get Y offer without losing its configuration', () => {
    const { template, form } = getJourneyFormFromPromotion({
      promotion: {
        name: 'Legacy category offer',
        condition_type: 3,
        rate: 1,
        rate_type: 2,
        minimum: 2,
        businesses: [{ id: 10 }],
        categories: [{ id: 7, include: true }]
      },
      allSiteIds: [3],
      allBusinessIds: [10, 11]
    })
    expect(template.key).toBe('buy_x_get_y')
    expect(form).toMatchObject({ selectedBusinessId: 10, eligibilityKind: 'categories', businesses: [10] })
    expect(form.categories[7]).toMatchObject({ id: 7, include: true })
    expect(buildJourneyPayload({ template, form })).toMatchObject({
      condition_type: 3,
      rate_type: 2,
      categories: [{ id: 7, include: true, is_condition: true }]
    })
  })

  test('preserves hidden advanced rule fields when an existing offer is saved in Quick Offers', () => {
    const { template, form } = getJourneyFormFromPromotion({
      promotion: {
        name: 'Fixed service fee offer',
        auto: false,
        type: 1,
        condition_type: 1,
        target: 3,
        rate: 5,
        rate_type: 2,
        minimum: 20,
        limit_per_user: 2,
        stackable: true,
        businesses: [{ id: 10 }]
      },
      allSiteIds: [3],
      allBusinessIds: [10]
    })

    expect(template.key).toBe('minimum_purchase')
    expect(buildJourneyPayload({ template, form })).toMatchObject({
      auto: false,
      type: 1,
      condition_type: 1,
      target: 3,
      rate_type: 2,
      stackable: true
    })
  })

  test('does not classify a fixed delivery discount as free delivery', () => {
    const { template, form } = getJourneyFormFromPromotion({
      promotion: {
        name: 'Delivery credit',
        condition_type: 1,
        target: 2,
        rate: 100,
        rate_type: 2,
        minimum: 20,
        businesses: [{ id: 10 }]
      },
      allSiteIds: [3],
      allBusinessIds: [10]
    })

    expect(template.key).toBe('minimum_purchase')
    expect(buildJourneyPayload({ template, form })).toMatchObject({ target: 2, rate_type: 2 })
  })
})
