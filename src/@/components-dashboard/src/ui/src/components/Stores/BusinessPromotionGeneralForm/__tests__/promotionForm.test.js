// redesign stores 5.14 (E3, S-8/S-9/S-10): the pure rules of the promotion form. The defaults of a new promotion are the
// ones of `main` (BusinessPromotionForm:183-211); the body of an edit carries only what changed; the dates the user does not touch are
// not sent, so a stored time (17:34:00) survives.
import { describe, expect, it } from 'vitest'
import {
  applyDateRange,
  buildPromotionBody,
  changedKeys,
  dayOfStamp,
  promotionToForm,
  validatePromotion
} from '../promotionForm'

const t = (_key, fallback) => fallback

const STORED = {
  id: 5,
  name: 'Ten off',
  description: 'Weekend',
  image: 'https://cdn.example.test/p.png',
  start: '2026-03-01 17:34:00',
  end: '2026-03-31 17:34:59',
  type: 2,
  coupon: 'TEN',
  rate_type: 1,
  rate: 10,
  minimum: 20,
  limit: 0,
  enabled: true
}

const ADVANCED_STORED = {
  ...STORED,
  auto: false,
  public: true,
  target: 2,
  condition_type: 1,
  stackable: true,
  sponsor: 'platform'
}

const valid = (overrides = {}) => ({
  ...promotionToForm({}, { advanced: false }),
  name: 'Ten off',
  coupon: 'TEN',
  start: '2026-03-01 00:00:00',
  end: '2026-03-31 23:59:59',
  rate: 10,
  ...overrides
})

describe('promotionToForm', () => {
  it('a new promotion carries the defaults of main without the advanced module', () => {
    const form = promotionToForm({}, { advanced: false })
    expect(form).toMatchObject({ type: 2, rate_type: 2, rate: 0, sponsor: 'business', name: '', coupon: '', description: '', image: null, start: null, end: null, minimum: null, limit: null })
    expect(form).not.toHaveProperty('auto')
    expect(form).not.toHaveProperty('target')
  })

  it('a new promotion carries the extra defaults with the advanced module', () => {
    expect(promotionToForm({}, { advanced: true })).toMatchObject({
      type: 2, rate_type: 2, rate: 0, sponsor: 'business', auto: false, public: true, condition_type: 1, target: 1, stackable: false
    })
  })

  it('an undefined or null promotion is a new one', () => {
    expect(promotionToForm(undefined, { advanced: false }).type).toBe(2)
    expect(promotionToForm(null, { advanced: false }).name).toBe('')
  })

  it('a stored promotion reads as it is stored, numbers as numbers', () => {
    const form = promotionToForm({ ...STORED, rate: '12.5', minimum: '20', limit: null }, { advanced: false })
    expect(form).toMatchObject({ name: 'Ten off', coupon: 'TEN', type: 2, rate_type: 1, rate: 12.5, minimum: 20, limit: null, start: '2026-03-01 17:34:00', end: '2026-03-31 17:34:59' })
  })

  it('reads the advanced fields of a stored promotion only with the module', () => {
    expect(promotionToForm(ADVANCED_STORED, { advanced: true })).toMatchObject({ auto: false, public: true, target: 2, stackable: true, sponsor: 'platform', condition_type: 1 })
    expect(promotionToForm(ADVANCED_STORED, { advanced: false })).not.toHaveProperty('target')
  })
})

describe('validatePromotion (S-8)', () => {
  it('a complete promotion has no error', () => {
    expect(validatePromotion(valid(), t)).toEqual({})
  })

  it('the name is required, and spaces are not a name', () => {
    expect(validatePromotion(valid({ name: '' }), t)).toEqual({ name: 'Name is required' })
    expect(validatePromotion(valid({ name: '   ' }), t)).toHaveProperty('name')
  })

  it('the code is required for a coupon and not for a discount', () => {
    expect(validatePromotion(valid({ coupon: '' }), t)).toHaveProperty('coupon')
    expect(validatePromotion(valid({ type: 1, coupon: '' }), t)).toEqual({})
  })

  it('both dates are required', () => {
    expect(validatePromotion(valid({ start: null }), t)).toHaveProperty('dates')
    expect(validatePromotion(valid({ end: null }), t)).toHaveProperty('dates')
    expect(validatePromotion(valid({ start: null, end: null }), t)).toHaveProperty('dates')
  })

  it('the end may be the same day as the start, never before it (the day is compared, not the time)', () => {
    expect(validatePromotion(valid({ start: '2026-03-10 17:34:00', end: '2026-03-10 09:00:00' }), t)).toEqual({})
    expect(validatePromotion(valid({ start: '2026-03-10 00:00:00', end: '2026-03-09 23:59:59' }), t)).toEqual({ dates: 'The start date must not be after the end date.' })
  })

  it('the value is required and above 0', () => {
    for (const rate of [null, 0, -1, Number.NaN]) {
      expect(validatePromotion(valid({ rate }), t)).toHaveProperty('rate')
    }
    expect(validatePromotion(valid({ rate: 0.5 }), t)).toEqual({})
  })

  it('a percentage is at most 100, a fixed amount is not capped', () => {
    expect(validatePromotion(valid({ rate_type: 1, rate: 100 }), t)).toEqual({})
    expect(validatePromotion(valid({ rate_type: 1, rate: 100.01 }), t)).toHaveProperty('rate')
    expect(validatePromotion(valid({ rate_type: 2, rate: 500 }), t)).toEqual({})
  })

  it('the minimum is empty or 0 or more', () => {
    expect(validatePromotion(valid({ minimum: null }), t)).toEqual({})
    expect(validatePromotion(valid({ minimum: 0 }), t)).toEqual({})
    expect(validatePromotion(valid({ minimum: -1 }), t)).toHaveProperty('minimum')
  })

  it('the limit is empty or a whole number of 0 or more', () => {
    expect(validatePromotion(valid({ limit: null }), t)).toEqual({})
    expect(validatePromotion(valid({ limit: 0 }), t)).toEqual({})
    expect(validatePromotion(valid({ limit: 3 }), t)).toEqual({})
    expect(validatePromotion(valid({ limit: 2.5 }), t)).toHaveProperty('limit')
    expect(validatePromotion(valid({ limit: -1 }), t)).toHaveProperty('limit')
  })

  it('reports every wrong field at once, by key', () => {
    const errors = validatePromotion(valid({ name: '', coupon: '', start: null, rate: 0, minimum: -1, limit: 1.5 }), t)
    expect(Object.keys(errors).sort()).toEqual(['coupon', 'dates', 'limit', 'minimum', 'name', 'rate'])
  })

  it('a new promotion with the default value 0 cannot be saved until a value is written (S-10)', () => {
    const form = { ...promotionToForm({}, { advanced: false }), name: 'x', coupon: 'X', start: '2026-03-01 00:00:00', end: '2026-03-02 23:59:59' }
    expect(validatePromotion(form, t)).toHaveProperty('rate')
  })
})

describe('validatePromotion for a stored promotion (R-05)', () => {
  // saved in another project without dates and with value 0: `main` only checked the name and the code
  const BARE = { ...STORED, start: null, end: null, rate: 0 }
  const bareBaseline = () => promotionToForm(BARE, { advanced: false })
  const check = (overrides) => validatePromotion({ ...bareBaseline(), ...overrides }, t, bareBaseline())

  it('does not ask for dates or a value that were never there, while they are not touched', () => {
    expect(check({})).toEqual({})
    expect(check({ description: 'New words' })).toEqual({})
  })

  it('still asks for the name and the code', () => {
    expect(check({ name: '' })).toEqual({ name: 'Name is required' })
    expect(check({ coupon: '' })).toHaveProperty('coupon')
  })

  it('asks for both dates as soon as one is set', () => {
    expect(check({ start: '2026-03-01 00:00:00' })).toEqual({ dates: 'Select the start and end dates.' })
    expect(check({ end: '2026-03-31 23:59:59' })).toHaveProperty('dates')
    expect(check({ start: '2026-03-01 00:00:00', end: '2026-03-31 23:59:59' })).toEqual({})
    expect(check({ start: '2026-03-10 00:00:00', end: '2026-03-09 23:59:59' })).toEqual({ dates: 'The start date must not be after the end date.' })
  })

  it('asks for a value above 0 as soon as the value is touched, and caps a percentage', () => {
    expect(check({ rate: null })).toHaveProperty('rate')
    expect(check({ rate: 5 })).toEqual({})
    expect(check({ rate: -1 })).toHaveProperty('rate')
    expect(check({ rate_type: 1, rate: 101 })).toHaveProperty('rate')
    expect(check({ rate_type: 1 })).toEqual({})
  })

  it('keeps asking for the dates and the value of a promotion that had them', () => {
    const baseline = promotionToForm(STORED, { advanced: false })
    expect(validatePromotion({ ...baseline, start: null, end: null }, t, baseline)).toHaveProperty('dates')
    expect(validatePromotion({ ...baseline, end: null }, t, baseline)).toHaveProperty('dates')
    expect(validatePromotion({ ...baseline, rate: 0 }, t, baseline)).toHaveProperty('rate')
    expect(validatePromotion({ ...baseline, rate: null }, t, baseline)).toHaveProperty('rate')
    expect(validatePromotion(baseline, t, baseline)).toEqual({})
  })

  it('leaves stored values the rules refuse alone while untouched, and judges them once touched', () => {
    const baseline = promotionToForm({ ...STORED, start: '2026-03-10 00:00:00', end: '2026-03-09 23:59:59' }, { advanced: false })
    expect(validatePromotion(baseline, t, baseline)).toEqual({})
    expect(validatePromotion({ ...baseline, description: 'New words' }, t, baseline)).toEqual({})
    expect(validatePromotion({ ...baseline, end: '2026-03-08 23:59:59' }, t, baseline)).toEqual({ dates: 'The start date must not be after the end date.' })
    const over = promotionToForm({ ...STORED, rate_type: 1, rate: 150 }, { advanced: false })
    expect(validatePromotion({ ...over, name: 'Renamed' }, t, over)).toEqual({})
    expect(validatePromotion({ ...over, rate: 120 }, t, over)).toHaveProperty('rate')
  })

  it('a new promotion (no stored one) still needs dates and a value above 0', () => {
    const blank = promotionToForm({}, { advanced: false })
    const form = { ...blank, name: 'x', coupon: 'X' }
    expect(Object.keys(validatePromotion(form, t)).sort()).toEqual(['dates', 'rate'])
    expect(Object.keys(validatePromotion(form, t, undefined)).sort()).toEqual(['dates', 'rate'])
  })
})

describe('dayOfStamp', () => {
  it('takes the day of a stored stamp', () => {
    expect(dayOfStamp('2026-03-01 17:34:00')).toBe('2026-03-01')
    expect(dayOfStamp('2026-03-01T17:34:00.000Z')).toBe('2026-03-01')
    expect(dayOfStamp(null)).toBeNull()
    expect(dayOfStamp('')).toBeNull()
  })
})

describe('applyDateRange (S-9)', () => {
  const baseline = promotionToForm(STORED, { advanced: false })

  it('a new range is 00:00:00 to 23:59:59, as main sent it', () => {
    const form = applyDateRange(baseline, baseline, { from: '2026-04-01', to: '2026-04-05' })
    expect(form).toMatchObject({ start: '2026-04-01 00:00:00', end: '2026-04-05 23:59:59' })
  })

  it('a day that did not change keeps its stored time (17:34)', () => {
    const form = applyDateRange(baseline, baseline, { from: '2026-03-01', to: '2026-04-05' })
    expect(form.start).toBe('2026-03-01 17:34:00')
    expect(form.end).toBe('2026-04-05 23:59:59')
  })

  it('an emptied range is null', () => {
    const form = applyDateRange(baseline, baseline, { from: null, to: null })
    expect(form).toMatchObject({ start: null, end: null })
  })

  it('does not touch the other fields', () => {
    expect(applyDateRange(baseline, baseline, { from: '2026-04-01', to: '2026-04-05' }).name).toBe('Ten off')
  })
})

describe('changedKeys', () => {
  const baseline = promotionToForm(STORED, { advanced: false })

  it('nothing changed, nothing listed', () => {
    expect(changedKeys({ ...baseline }, baseline)).toEqual([])
  })

  it('lists the changed fields in the order of the form, dates as one field', () => {
    const form = { ...baseline, rate: 15, name: 'Fifteen', start: '2026-04-01 00:00:00', end: '2026-04-30 23:59:59', limit: 4 }
    expect(changedKeys(form, baseline)).toEqual(['name', 'dates', 'rate', 'limit'])
  })

  it('the name is compared without its edge spaces', () => {
    expect(changedKeys({ ...baseline, name: ' Ten off ' }, baseline)).toEqual([])
  })

  it('an empty minimum and a missing one are the same', () => {
    const none = promotionToForm({ ...STORED, minimum: null }, { advanced: false })
    expect(changedKeys({ ...none, minimum: null }, none)).toEqual([])
    expect(changedKeys({ ...none, minimum: 0 }, none)).toEqual(['minimum'])
  })

  it('the code does not count while the promotion is a discount, nor does show-in-cart / automatic outside their type', () => {
    const advanced = promotionToForm(ADVANCED_STORED, { advanced: true })
    expect(changedKeys({ ...advanced, type: 1, coupon: 'OTHER', public: false }, advanced)).toEqual(['type'])
    expect(changedKeys({ ...advanced, auto: true }, advanced)).toEqual([])
    expect(changedKeys({ ...advanced, public: false }, advanced)).toEqual(['public'])
  })

  it('counts the advanced fields: target, stackable and sponsor', () => {
    const advanced = promotionToForm(ADVANCED_STORED, { advanced: true })
    expect(changedKeys({ ...advanced, target: 3, stackable: false, sponsor: 'business' }, advanced)).toEqual(['target', 'stackable', 'sponsor'])
  })

  it('the image counts when a new one is picked', () => {
    expect(changedKeys({ ...baseline, image: 'data:image/png;base64,AAAA' }, baseline)).toEqual(['image'])
  })
})

describe('buildPromotionBody', () => {
  it('an edit sends only what changed, numbers as numbers', () => {
    const baseline = promotionToForm(STORED, { advanced: false })
    const form = { ...baseline, name: ' Fifteen ', rate: 15, limit: 4 }
    expect(buildPromotionBody(form, baseline, { isNew: false, advanced: false })).toEqual({ name: 'Fifteen', rate: 15, limit: 4 })
  })

  it('an edit that changes nothing sends nothing', () => {
    const baseline = promotionToForm(STORED, { advanced: false })
    expect(buildPromotionBody({ ...baseline }, baseline, { isNew: false, advanced: false })).toEqual({})
  })

  it('dates that were not touched are not sent, and the stored time survives', () => {
    const baseline = promotionToForm(STORED, { advanced: false })
    const body = buildPromotionBody({ ...baseline, name: 'Other' }, baseline, { isNew: false, advanced: false })
    expect(body).toEqual({ name: 'Other' })
    expect(body).not.toHaveProperty('start')
    expect(body).not.toHaveProperty('end')
  })

  it('changed dates are sent as start and end', () => {
    const baseline = promotionToForm(STORED, { advanced: false })
    const form = applyDateRange(baseline, baseline, { from: '2026-04-01', to: '2026-04-05' })
    expect(buildPromotionBody(form, baseline, { isNew: false, advanced: false })).toEqual({ start: '2026-04-01 00:00:00', end: '2026-04-05 23:59:59' })
  })

  it('a cleared minimum or limit is sent as null, a cleared description as an empty text', () => {
    const baseline = promotionToForm(STORED, { advanced: false })
    expect(buildPromotionBody({ ...baseline, minimum: null, limit: null, description: '' }, baseline, { isNew: false, advanced: false }))
      .toEqual({ minimum: null, limit: null, description: '' })
  })

  it('switching a coupon to a discount sends the type and not the code', () => {
    const baseline = promotionToForm(STORED, { advanced: false })
    expect(buildPromotionBody({ ...baseline, type: 1, coupon: 'NEW' }, baseline, { isNew: false, advanced: false })).toEqual({ type: 1 })
  })

  it('a new image goes as the data URL', () => {
    const baseline = promotionToForm(STORED, { advanced: false })
    expect(buildPromotionBody({ ...baseline, image: 'data:image/png;base64,AAAA' }, baseline, { isNew: false, advanced: false })).toEqual({ image: 'data:image/png;base64,AAAA' })
  })

  it('a new promotion sends the defaults of main plus what was written', () => {
    const baseline = promotionToForm({}, { advanced: false })
    const form = {
      ...baseline,
      name: ' Welcome ',
      coupon: 'HELLO',
      start: '2026-05-01 00:00:00',
      end: '2026-05-31 23:59:59',
      rate: 7
    }
    expect(buildPromotionBody(form, baseline, { isNew: true, advanced: false })).toEqual({
      name: 'Welcome',
      type: 2,
      coupon: 'HELLO',
      rate_type: 2,
      rate: 7,
      sponsor: 'business',
      start: '2026-05-01 00:00:00',
      end: '2026-05-31 23:59:59'
    })
  })

  it('a new promotion with the advanced module also sends its defaults', () => {
    const baseline = promotionToForm({}, { advanced: true })
    const form = { ...baseline, name: 'Auto', type: 1, start: '2026-05-01 00:00:00', end: '2026-05-31 23:59:59', rate: 5, rate_type: 1, minimum: 10, limit: 100, description: 'Hi' }
    expect(buildPromotionBody(form, baseline, { isNew: true, advanced: true })).toEqual({
      name: 'Auto',
      description: 'Hi',
      type: 1,
      rate_type: 1,
      rate: 5,
      minimum: 10,
      limit: 100,
      sponsor: 'business',
      auto: false,
      public: true,
      condition_type: 1,
      target: 1,
      stackable: false,
      start: '2026-05-01 00:00:00',
      end: '2026-05-31 23:59:59'
    })
  })

  it('a new promotion leaves out what was left empty (description, image, minimum, limit)', () => {
    const baseline = promotionToForm({}, { advanced: false })
    const body = buildPromotionBody({ ...baseline, name: 'x', coupon: 'X', rate: 1, start: '2026-05-01 00:00:00', end: '2026-05-02 23:59:59' }, baseline, { isNew: true, advanced: false })
    for (const key of ['description', 'image', 'minimum', 'limit', 'auto', 'target']) expect(body).not.toHaveProperty(key)
  })
})
