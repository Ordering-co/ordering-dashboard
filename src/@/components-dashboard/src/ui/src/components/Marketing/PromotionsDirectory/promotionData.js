import moment from 'moment'

// redesign PE-B1 (decisions 3, 4, 8, 9; PE-01, PE-02, PE-04): the pure side of the promotions list. No React, no context.
// Every word goes through the `t` the caller passes, one LITERAL `t()` call per word (never a built key), and a value the API
// sends that we do not know is shown as a word or a dash, never as a guess.
// The records come from `GET offers` (fields: C/components/EnterprisePromotionList `propsToFetch`).

// The dates of an offer are wall-clock strings with no zone: read them as such, in the same naive local frame as `now`
// (never `new Date(string)`, which Safari refuses). A value in any other shape is not a date and decides nothing.
const API_DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss'

const readDate = (value) => {
  if (typeof value !== 'string' || value === '') return null
  const parsed = moment(value, API_DATE_FORMAT, true)
  return parsed.isValid() ? parsed : null
}

/** Is the stored flag «on»? `false`, `0`, `'0'`, `'false'`, `null`, `undefined` and an empty value are not. */
export const isPromotionEnabled = (value) => ![false, 0, '0', 'false', null, undefined, ''].includes(value)

/**
 * `'off' | 'scheduled' | 'ended' | 'active'`. The switch is checked FIRST: a disabled promotion whose dates have passed is Off,
 * not Ended. A valid start later than `now` is scheduled; a valid end earlier than `now` is ended; an empty or invalid date
 * never decides (no start = already started, no end = never ends), and a date equal to `now` is still inside.
 *
 * «Active» means on and within its dates. It does NOT look at schedules, limits, order types or customer conditions: a promotion
 * that is Active here can still not apply to a given order.
 */
export const promotionStatusKey = (promotion, now = new Date()) => {
  if (!promotion || !isPromotionEnabled(promotion.enabled)) return 'off'
  const current = moment(now)
  const start = readDate(promotion.start)
  const end = readDate(promotion.end)
  if (start && start.isAfter(current)) return 'scheduled'
  if (end && end.isBefore(current)) return 'ended'
  return 'active'
}

// The families of P/Status as the campaigns page uses them (M/CampaignDirectory/campaignData.js): running is progress, the rest quiet
const STATUS_BY_KEY = {
  active: { family: 'progress', label: (t) => t('ACTIVE', 'Active') },
  scheduled: { family: 'pending', label: (t) => t('PROMOTION_STATUS_SCHEDULED', 'Scheduled') },
  ended: { family: 'done', label: (t) => t('PROMOTION_STATUS_ENDED', 'Ended') },
  off: { family: 'pending', label: (t) => t('PROMOTION_STATUS_OFF', 'Off') }
}

/** What the table, the card and the panel say about a promotion: `{ key, family, label }`. `family` is always one of P/Status's. */
export const promotionStatus = (promotion, t, now) => {
  const key = promotionStatusKey(promotion, now)
  return { key, family: STATUS_BY_KEY[key].family, label: STATUS_BY_KEY[key].label(t) }
}

const TARGET_LABELS = {
  1: (t) => t('MOBILE_FRONT_SUB_TOTAL', 'Subtotal'),
  2: (t) => t('DELIVERY_FEE', 'Delivery fee'),
  3: (t) => t('BUSINESS_SERVICE_FEE', 'Service fee')
}

/** What a promotion discounts (`target`). A target we do not know is shown as it came, as a string, as main did. */
export const promotionTargetLabel = (target, t) => {
  const label = TARGET_LABELS[Number(target)]
  if (label) return label(t)
  return target === null || target === undefined ? '' : String(target)
}

/** How a promotion is applied (`type` and `auto`): exactly the mapping of main's advanced list. */
export const promotionAppliesLabel = (promotion, t) => {
  if (promotion?.type === 1) {
    return promotion?.auto ? t('AUTOMATIC_DISCOUNT', 'Automatic discount') : t('DISCOUNT', 'Discount')
  }
  return promotion?.auto ? t('AUTOMATIC_COUPON', 'Automatic coupon') : t('COUPON', 'Coupon')
}

const hasNumber = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))

// 15, 12.5 (never 15.00): at most two decimals, none when whole
const percentText = (rate) => `${Number(Number(rate).toFixed(2))}%`

// «_rate_ off» -> [{ figure }, { text: ' off' }]: split on the placeholder so the figure is its own part (the UI sets it in `.odc-figure`)
const fillTemplate = (template, values) => template
  .split(/(_[a-z]+_)/)
  .filter(part => part !== '')
  .map(part => {
    const name = part.match(/^_([a-z]+)_$/)?.[1]
    return name && values[name] !== undefined ? { figure: values[name] } : { text: part }
  })

// Two texts side by side are one text
const joinTexts = (parts) => parts.reduce((out, part) => {
  const last = out[out.length - 1]
  if ('text' in part && last && 'text' in last) last.text += part.text
  else out.push({ ...part })
  return out
}, [])

/**
 * The benefit of a promotion as parts `[{ text } | { figure }]`, so the UI can set each figure in `.odc-figure`:
 * «15% off · min £30», «Free delivery», «£5 off service fee». A rate that is missing or not a number, or a rate type we do not
 * know, has no benefit: `[]` (the UI shows a dash). The minimum shows when above zero; the cap only for a percent.
 */
export const promotionBenefit = (promotion, { t, parsePrice }) => {
  if (!promotion || !hasNumber(promotion.rate)) return []
  const rateType = Number(promotion.rate_type)
  if (rateType !== 1 && rateType !== 2) return []
  const target = Number(promotion.target)
  const rate = rateType === 1 ? percentText(promotion.rate) : parsePrice(promotion.rate)

  let parts
  if (target === 2 && rateType === 1 && Number(promotion.rate) >= 100) {
    parts = [{ text: t('PROMOTION_BENEFIT_FREE_DELIVERY', 'Free delivery') }]
  } else if (target === 2) {
    parts = fillTemplate(t('PROMOTION_BENEFIT_OFF_DELIVERY', '_rate_ off delivery fee'), { rate })
  } else if (target === 3) {
    parts = fillTemplate(t('PROMOTION_BENEFIT_OFF_SERVICE', '_rate_ off service fee'), { rate })
  } else {
    parts = fillTemplate(t('PROMOTION_BENEFIT_OFF', '_rate_ off'), { rate })
  }

  if (Number(promotion.minimum) > 0) {
    parts.push({ text: ' · ' }, ...fillTemplate(t('PROMOTION_BENEFIT_MINIMUM', 'min _amount_'), { amount: parsePrice(promotion.minimum) }))
  }
  if (rateType === 1 && Number(promotion.max_discount) > 0) {
    parts.push({ text: ' · ' }, ...fillTemplate(t('PROMOTION_BENEFIT_MAXIMUM', 'max _amount_'), { amount: parsePrice(promotion.max_discount) }))
  }
  return joinTexts(parts)
}

/**
 * `{ start, end }` as people read them: each valid date through `parseDate` (the project's format, day only, local wall time:
 * `utc: false`, as the list always read them), `null` for an empty or invalid one. Never ISO.
 */
export const promotionDates = (promotion, parseDate) => {
  const written = (value) => (readDate(value) ? parseDate(value, { utc: false, dateOnly: true }) : null)
  return { start: written(promotion?.start), end: written(promotion?.end) }
}

// As main (`Number(a.rank) - Number(b.rank)`): a rank that is null, missing, empty or not a number counts as 0, so it goes first
const rankOf = (promotion) => {
  const number = Number(promotion?.rank ?? 0)
  return Number.isNaN(number) ? 0 : number
}

/** The promotions in the order of their priority (`rank`, ascending, empty as 0 so first, like main), in a NEW array: main sorted its state in place. Stable. */
export const sortByRank = (promotions) => (
  (Array.isArray(promotions) ? promotions : [])
    .map((promotion, index) => ({ promotion, index, rank: rankOf(promotion) }))
    .sort((a, b) => (a.rank === b.rank ? a.index - b.index : (a.rank < b.rank ? -1 : 1)))
    .map(item => item.promotion)
)
