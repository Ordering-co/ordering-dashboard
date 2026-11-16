// redesign stores 5.14 (E3; S-7…S-11): the pure rules of the promotion form. No React, no text of its own except what `t`
// is asked for. The form holds the values the user sees:
//   image        the stored URL, or the data URL of the file just picked
//   name, description, coupon
//   start, end   stamps `YYYY-MM-DD HH:mm:ss` (the API's), or null
//   type         1 Discount, 2 Coupon
//   rate_type    1 Percentage, 2 Fixed amount
//   rate, minimum, limit   numbers, or null when empty
//   sponsor
//   and, with the advanced offers module: auto, public, condition_type, target, stackable
// The defaults of a new promotion are the ones `main` set (BusinessPromotionForm:183-211).

export const TYPE_DISCOUNT = 1
export const TYPE_COUPON = 2
export const RATE_PERCENTAGE = 1
export const RATE_FIXED = 2

/** The fields the user can change, in the order of the form (S-7). `dates` is `start` and `end` together. */
export const FIELD_ORDER = [
  'image',
  'name',
  'description',
  'dates',
  'type',
  'coupon',
  'public',
  'auto',
  'target',
  'rate_type',
  'rate',
  'minimum',
  'limit',
  'stackable',
  'sponsor'
]

const present = (value) => value !== null && value !== undefined && value !== ''

/** A number, or null when there is nothing to read (a blank, a missing value). A text that is not a number stays NaN. */
const toNumber = (value) => (present(value) ? Number(value) : null)

/** The day (`YYYY-MM-DD`) of a stored stamp, or null. */
export const dayOfStamp = (stamp) => (typeof stamp === 'string' && stamp.length >= 10 ? stamp.slice(0, 10) : null)

const isNewPromotion = (promotion) => !promotion || Object.keys(promotion).length === 0

/** The form of a stored promotion, or the defaults of a new one (an empty object, as the controller gets it). */
export const promotionToForm = (promotion, { advanced = false } = {}) => {
  if (isNewPromotion(promotion)) {
    return {
      image: null,
      name: '',
      description: '',
      coupon: '',
      start: null,
      end: null,
      type: TYPE_COUPON,
      rate_type: RATE_FIXED,
      rate: 0,
      minimum: null,
      limit: null,
      sponsor: 'business',
      ...(advanced ? { auto: false, public: true, condition_type: 1, target: 1, stackable: false } : {})
    }
  }
  return {
    image: promotion.image || null,
    name: promotion.name ?? '',
    description: promotion.description ?? '',
    coupon: promotion.coupon ?? '',
    start: promotion.start || null,
    end: promotion.end || null,
    type: promotion.type,
    rate_type: promotion.rate_type,
    rate: toNumber(promotion.rate),
    minimum: toNumber(promotion.minimum),
    limit: toNumber(promotion.limit),
    sponsor: promotion.sponsor ?? 'business',
    ...(advanced
      ? {
          auto: !!promotion.auto,
          public: !!promotion.public,
          condition_type: promotion.condition_type ?? 1,
          target: promotion.target ?? 1,
          stackable: !!promotion.stackable
        }
      : {})
  }
}

/**
 * What cannot be saved, by key: `name`, `coupon`, `dates`, `rate`, `minimum`, `limit`, each with its message.
 * Rules (S-8): a name; a code for a coupon; both dates and the end not before the start (the day is compared); a value above 0 and, in
 * percent, at most 100; a minimum empty or 0 or more; a limit empty or a whole number of 0 or more.
 *
 * `stored` (optional) is the baseline the form started from (`promotionToForm` of the stored promotion); a new promotion passes nothing
 * and every rule applies. For an existing one, `main` only checked the name and the code, so a promotion saved elsewhere with values
 * these rules refuse (no dates, dates the wrong way round, a value of 0, a percentage above 100) must stay editable (R-05): the `dates`,
 * `rate`, `minimum` and `limit` rules hold only for what the user changed (`rate` also when the rate type changed). Whatever the user
 * touches is held to the full rule; what was stored and left alone is not re-judged.
 */
export const validatePromotion = (form, t, stored) => {
  const errors = {}
  if (!String(form.name ?? '').trim()) errors.name = t('NAME_IS_REQUIRED', 'Name is required')
  if (form.type === TYPE_COUPON && !String(form.coupon ?? '').trim()) {
    errors.coupon = t('VALIDATION_ERROR_COUPON_REQUIRED', 'The field Coupon is required')
  }
  const touched = stored ? changedKeys(form, stored) : null
  const check = (...keys) => !stored || keys.some(key => touched.includes(key))
  const checkDates = check('dates')
  const checkRate = check('rate', 'rate_type')

  const start = dayOfStamp(form.start)
  const end = dayOfStamp(form.end)
  if (checkDates) {
    if (!start || !end) errors.dates = t('STORES_PROMOTION_DATES_REQUIRED', 'Select the start and end dates.')
    else if (end < start) errors.dates = t('DATE_RANGE_ORDER', 'The start date must not be after the end date.')
  }

  const rate = form.rate
  if (!checkRate) {
    // the stored value is left alone
  } else if (!present(rate) || !Number.isFinite(Number(rate)) || Number(rate) <= 0) {
    errors.rate = t('STORES_PROMOTION_VALUE_REQUIRED', 'Enter a value greater than 0.')
  } else if (form.rate_type === RATE_PERCENTAGE && Number(rate) > 100) {
    errors.rate = t('STORES_PROMOTION_PERCENT_MAX', 'A percentage can\'t be more than 100.')
  }
  if (check('minimum') && present(form.minimum) && !(Number.isFinite(Number(form.minimum)) && Number(form.minimum) >= 0)) {
    errors.minimum = t('STORES_PROMOTION_MINIMUM_INVALID', 'The minimum purchase must be 0 or more.')
  }
  if (check('limit') && present(form.limit) && !(Number.isInteger(Number(form.limit)) && Number(form.limit) >= 0)) {
    errors.limit = t('STORES_PROMOTION_LIMIT_INVALID', 'The limit must be a whole number, 0 or more.')
  }
  return errors
}

/**
 * The form after the user applied a range in the popover (days `YYYY-MM-DD`, or null). The start is `00:00:00` and the end `23:59:59`,
 * as `main` sent them (S-9); a day that did not change keeps the stamp it had in the baseline, so a stored `17:34:00` survives and the
 * dates count as untouched.
 */
export const applyDateRange = (form, baseline, { from, to }) => ({
  ...form,
  start: from ? (from === dayOfStamp(baseline.start) ? baseline.start : `${from} 00:00:00`) : null,
  end: to ? (to === dayOfStamp(baseline.end) ? baseline.end : `${to} 23:59:59`) : null
})

const sameNumber = (a, b) => {
  if (!present(a) && !present(b)) return true
  if (!present(a) || !present(b)) return false
  return Number(a) === Number(b)
}

const FIELD_CHANGED = {
  image: (form, baseline) => (form.image || null) !== (baseline.image || null),
  name: (form, baseline) => String(form.name ?? '').trim() !== String(baseline.name ?? '').trim(),
  description: (form, baseline) => String(form.description ?? '') !== String(baseline.description ?? ''),
  dates: (form, baseline) => (form.start || null) !== (baseline.start || null) || (form.end || null) !== (baseline.end || null),
  type: (form, baseline) => form.type !== baseline.type,
  // a field that is not on screen for the chosen type is not a change the user made
  coupon: (form, baseline) => form.type === TYPE_COUPON && String(form.coupon ?? '').trim() !== String(baseline.coupon ?? '').trim(),
  public: (form, baseline) => form.type === TYPE_COUPON && form.public !== baseline.public,
  auto: (form, baseline) => form.type === TYPE_DISCOUNT && form.auto !== baseline.auto,
  target: (form, baseline) => form.target !== baseline.target,
  rate_type: (form, baseline) => form.rate_type !== baseline.rate_type,
  rate: (form, baseline) => !sameNumber(form.rate, baseline.rate),
  minimum: (form, baseline) => !sameNumber(form.minimum, baseline.minimum),
  limit: (form, baseline) => !sameNumber(form.limit, baseline.limit),
  stackable: (form, baseline) => form.stackable !== baseline.stackable,
  sponsor: (form, baseline) => form.sponsor !== baseline.sponsor
}

/** The fields the user changed, in the order of the form; `dates` stands for `start` and `end`. */
export const changedKeys = (form, baseline) => FIELD_ORDER.filter(key => FIELD_CHANGED[key](form, baseline))

const numberOrNull = (value) => (present(value) ? Number(value) : null)

// how each field is written into a request
const FIELD_BODY = {
  image: (form) => ({ image: form.image }),
  name: (form) => ({ name: String(form.name ?? '').trim() }),
  description: (form) => ({ description: form.description ?? '' }),
  dates: (form) => ({ start: form.start, end: form.end }),
  type: (form) => ({ type: form.type }),
  coupon: (form) => ({ coupon: String(form.coupon ?? '').trim() }),
  public: (form) => ({ public: !!form.public }),
  auto: (form) => ({ auto: !!form.auto }),
  target: (form) => ({ target: form.target }),
  rate_type: (form) => ({ rate_type: form.rate_type }),
  rate: (form) => ({ rate: numberOrNull(form.rate) }),
  minimum: (form) => ({ minimum: numberOrNull(form.minimum) }),
  limit: (form) => ({ limit: numberOrNull(form.limit) }),
  stackable: (form) => ({ stackable: !!form.stackable }),
  sponsor: (form) => ({ sponsor: form.sponsor })
}

/**
 * What the API gets. An edit sends only what changed (as `main` did); dates that were not touched are not sent. A new promotion sends
 * its defaults plus what was written: what was left empty (description, image, minimum, limit, the code of a discount) is left out.
 * Call it with a form that has no field errors.
 */
export const buildPromotionBody = (form, baseline, { isNew = false, advanced = false } = {}) => {
  if (!isNew) {
    return changedKeys(form, baseline).reduce((body, key) => ({ ...body, ...FIELD_BODY[key](form) }), {})
  }
  const body = {
    name: String(form.name ?? '').trim(),
    type: form.type,
    rate_type: form.rate_type,
    rate: numberOrNull(form.rate),
    sponsor: form.sponsor
  }
  if (String(form.description ?? '') !== '') body.description = form.description
  if (form.image) body.image = form.image
  if (form.start) body.start = form.start
  if (form.end) body.end = form.end
  if (form.type === TYPE_COUPON) body.coupon = String(form.coupon ?? '').trim()
  if (present(form.minimum)) body.minimum = Number(form.minimum)
  if (present(form.limit)) body.limit = Number(form.limit)
  if (advanced) {
    body.auto = !!form.auto
    body.public = !!form.public
    body.condition_type = form.condition_type ?? 1
    body.target = form.target ?? 1
    body.stackable = !!form.stackable
  }
  return body
}
