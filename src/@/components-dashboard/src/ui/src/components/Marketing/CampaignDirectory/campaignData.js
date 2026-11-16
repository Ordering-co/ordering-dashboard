// redesign CA-B3 (decisions 1 and 2; M-CA6, M-CA7, auditor #2, #8, #9, #16): the pure side of the campaigns directory. No React, no context.
// Every word goes through the `t` the caller passes, one LITERAL `t()` call per value (a map of functions, never a built key), and a
// value the API sends that we do not know is shown as a word («Other», «Unknown», «—»), never as the raw text.

// Own property only: a raw value such as `constructor` must not find a function on the prototype of the map
const own = (map, key) => typeof key === 'string' && Object.prototype.hasOwnProperty.call(map, key)

const NONE = '—'

/** The three channels `main` lets you create (M/CampaignDetailGeneral: whatsapp, webhook and popup are `enabled: false` there). */
export const CREATABLE_CHANNELS = ['email', 'sms', 'notification']

// The channels the list can hold, creatable first. The Channel pill offers all of them: the API may return the other three.
const FILTER_CHANNELS = [...CREATABLE_CHANNELS, 'whatsapp', 'webhook', 'popup']

/**
 * Whether the orders and the revenue of a campaign are known. An email is attributed through its tagged links and a push
 * notification (stored as «notification») through the customer opening it in the app. SMS and the other channels carry nothing the
 * storefront can send back, so the API answers 0 for them and the figure would be a lie: they read «N/A».
 */
export const hasOrderStats = (campaign) => ['email', 'notification'].includes(campaign?.contact_type)

/** The two audiences of a campaign. */
export const AUDIENCE_TYPES = ['fixed', 'dynamic']

const CHANNEL_LABELS = {
  email: (t) => t('EMAIL', 'Email'),
  sms: (t) => t('SMS', 'SMS'),
  notification: (t) => t('PUSH_NOTIFICATION', 'Push notification'),
  // WHATSAPP says «Whatsapp» in the catalog: the brand is written WhatsApp
  whatsapp: (t) => t('CAMPAIGNS_CHANNEL_WHATSAPP', 'WhatsApp'),
  webhook: (t) => t('WEBHOOK', 'Webhook'),
  popup: (t) => t('POPUP', 'Popup')
}

/** The name of a channel (`contact_type`). Never the raw value. */
export const channelLabel = (t, type) => (
  own(CHANNEL_LABELS, type) ? CHANNEL_LABELS[type](t) : t('CAMPAIGNS_CHANNEL_UNKNOWN', 'Other')
)

const AUDIENCE_LABELS = {
  fixed: (t) => t('FIXED', 'Fixed'),
  dynamic: (t) => t('DYNAMIC', 'Dynamic')
}

/** The name of an audience (`audience_type`); «—» when the campaign has none. Never the raw value. */
export const audienceLabel = (t, type) => (own(AUDIENCE_LABELS, type) ? AUDIENCE_LABELS[type](t) : NONE)

// The status of a campaign that is not a dynamic one: its raw `status`, as a family of P/Status and a word
const STATUS_BY_RAW = {
  ended: { family: 'done', label: (t) => t('CAMPAIGNS_STATUS_ENDED', 'Ended') },
  scheduled: { family: 'pending', label: (t) => t('CAMPAIGNS_STATUS_SCHEDULED', 'Scheduled') },
  pending: { family: 'pending', label: (t) => t('PENDING', 'Pending') },
  draft: { family: 'pending', label: (t) => t('DRAFT', 'Draft') }
}

const isEnabled = (value) => value === true || value === 1 || value === '1' || value === 'true'

/**
 * What the table, the card and the panel say about a campaign: `{ family, label, toggle }`. `family` is always one of P/Status's
 * STATUS_FAMILIES (the component throws on any other). A dynamic that is not ended is `toggle: true`: its Active/Paused comes from
 * `enabled`, not from `status`, and the row draws the Switch with that label.
 */
export const campaignStatus = (campaign, t) => {
  const unknown = { family: 'pending', label: t('CAMPAIGNS_STATUS_UNKNOWN', 'Unknown'), toggle: false }
  if (!campaign || typeof campaign !== 'object' || Array.isArray(campaign)) return unknown
  const { status } = campaign
  if (status === 'ended') return { family: STATUS_BY_RAW.ended.family, label: STATUS_BY_RAW.ended.label(t), toggle: false }
  if (campaign.audience_type === 'dynamic') {
    return isEnabled(campaign.enabled)
      ? { family: 'progress', label: t('ACTIVE', 'Active'), toggle: true }
      : { family: 'pending', label: t('CAMPAIGNS_STATUS_PAUSED', 'Paused'), toggle: true }
  }
  if (!own(STATUS_BY_RAW, status)) return unknown
  return { family: STATUS_BY_RAW[status].family, label: STATUS_BY_RAW[status].label(t), toggle: false }
}

/** The `scheduled_at` of a campaign (a `YYYY-MM-DD HH:mm:ss` string), or null. */
export const scheduledAt = (campaign) => {
  const value = campaign?.scheduled_at
  return typeof value === 'string' && value !== '' ? value : null
}

/**
 * A stored date as the project writes it (date and time), or null. `utc: false`: `scheduled_at` and `end_at` are written as local
 * wall time without a zone (RangeCalendar), so the default `utc: true` of `parseDate` would shift them (auditor #2).
 */
export const formatWhen = (value, parseDate) => {
  if (typeof value !== 'string' || value === '' || typeof parseDate !== 'function') return null
  return parseDate(value, { utc: false })
}

// redesign CA-R1 (live check): a count in the number format of the person's language, with that language's own grouping rule (CLDR):
// English «1,240»; Spanish does not group four digits («1240») but does five («12.400»). Forcing the grouping would break that rule.
const countFormat = (locale) => {
  const options = { maximumFractionDigits: 0 }
  try {
    return new Intl.NumberFormat(locale || undefined, options)
  } catch (error) {
    return new Intl.NumberFormat(undefined, options) // a code the runtime does not know still writes the number
  }
}

/**
 * A count as the person reads numbers («1,240» in English, «1.240» in Spanish). `null`/`undefined` give `null`, so the caller keeps its
 * N/A and «no count» paths; anything that is not a number reads 0. Format at render: plural choice still uses the number.
 */
export const formatCount = (value, locale) => (
  value === null || value === undefined ? null : countFormat(locale).format(Number(value) || 0)
)

const parseJson = (value) => {
  try {
    return JSON.parse(value)
  } catch (error) {
    return undefined
  }
}

/** The conditions (rules) of a campaign as an array: the API sends an array or its JSON text (auditor #16). Anything else is `[]`. */
export const asConditions = (value) => {
  const list = typeof value === 'string' ? parseJson(value) : value
  return Array.isArray(list) ? list : []
}

/** The `contact_data` of a campaign as an object: the API sends an object or its JSON text (auditor #16). Anything else is `{}`. */
export const asContactData = (value) => {
  const data = typeof value === 'string' ? parseJson(value) : value
  return data && typeof data === 'object' && !Array.isArray(data) ? data : {}
}

/** The rules a campaign's audience can hold, in the order they are offered. `kind`: a count of orders, or a date. */
export const RULE_TYPES = [
  { type: 'orders_count', kind: 'count', label: (t) => t('CAMPAIGNS_RULE_ORDERS', 'Orders') },
  { type: 'user_created_at', kind: 'date', label: (t) => t('CAMPAIGNS_RULE_SIGN_UP', 'Sign-up date') },
  { type: 'user_last_order_at', kind: 'date', label: (t) => t('CAMPAIGNS_RULE_LAST_ORDER', 'Last order date') },
  { type: 'user_last_open_cart_at', kind: 'date', label: (t) => t('OPEN_CARTS', 'Open carts') }
]

const hasValue = (value) => value !== null && value !== undefined && value !== ''

// `$` in a replacement is special for String.replace: a function keeps the figure as it is
const fill = (text, values) => Object.keys(values).reduce((out, name) => out.replace(`_${name}_`, () => values[name]), text)

/**
 * One rule as a line: `{ label, text, values }`, written «label: text» by the caller (`Orders: more than 2`). `values` are the figures
 * the text holds, in order, so the caller can put each in an `odc-figure`. `condition` is the API shape: `{ type, condition: '>'|'<',
 * value }` for a count or `{ type, date_condition: '<'|'><', date, max_date }` for a date. `formatDate(value)` writes a stored date in
 * the project format. An operator or a value we do not know is «—» (the label stays); a type we do not know is «Rule: —».
 */
export const ruleSummary = (t, condition, formatDate) => {
  const rule = RULE_TYPES.find(item => item.type === condition?.type)
  if (!rule) return { label: t('CAMPAIGNS_RULE_UNKNOWN', 'Rule'), text: NONE, values: [] }
  const label = rule.label(t)
  const unknown = { label, text: NONE, values: [] }

  if (rule.kind === 'count') {
    if (!hasValue(condition.value)) return unknown
    const value = String(condition.value)
    if (condition.condition === '>') return { label, text: fill(t('CAMPAIGNS_RULE_MORE_THAN', 'more than _value_'), { value }), values: [value] }
    if (condition.condition === '<') return { label, text: fill(t('CAMPAIGNS_RULE_LESS_THAN', 'less than _value_'), { value }), values: [value] }
    return unknown
  }

  if (typeof formatDate !== 'function' || !hasValue(condition.date)) return unknown
  const from = formatDate(condition.date)
  if (!from) return unknown
  if (condition.date_condition === '<') return { label, text: fill(t('CAMPAIGNS_RULE_BEFORE', 'before _value_'), { value: from }), values: [from] }
  if (condition.date_condition === '><') {
    const to = hasValue(condition.max_date) ? formatDate(condition.max_date) : null
    if (!to) return unknown
    return { label, text: fill(t('CAMPAIGNS_RULE_BETWEEN', 'between _from_ and _to_'), { from, to }), values: [from, to] }
  }
  return unknown
}

/**
 * The options of the Channel and Audience pills, as `{ id, name }` for ChecklistPopover. No Status: the raw `status` does not match
 * what the table shows for a dynamic (Active/Paused come from `enabled`), so a Status filter would mislead (auditor #8).
 */
export const filterOptions = (t) => ({
  channel: FILTER_CHANNELS.map(id => ({ id, name: channelLabel(t, id) })),
  audience: AUDIENCE_TYPES.map(id => ({ id, name: audienceLabel(t, id) }))
})
