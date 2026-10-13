/**
 * Pure helpers for the "extend your free trial" offer.
 *
 * Free trials are 3 days by default. Booking a call before the trial
 * ends extends it to `config.days` (14) total from the trial start. These helpers
 * decide when to show the offer, build the Calendly URL, and parse Calendly's
 * postMessage events for the inline embed — with no React/DOM dependency so they
 * are trivial to unit test.
 */

export const TRIAL_EXTENSION_DAY_MS = 24 * 60 * 60 * 1000
export const DEFAULT_TRIAL_EXTENSION_DAYS = 14
export const CALENDLY_ORIGIN = 'https://calendly.com'
export const CALENDLY_MIN_HEIGHT = 320
export const CALENDLY_MAX_HEIGHT = 20000

const CALENDLY_HOST_PATTERN = /(^|\.)calendly\.com$/i

/**
 * The booking URL is embedded in the authenticated dashboard and prefilled with the owner's
 * name and email. Only https Calendly hosts are accepted, matching the postMessage origin check.
 */
export const isCalendlyBookingUrl = (baseUrl) => {
  if (!baseUrl || typeof baseUrl !== 'string') return false
  try {
    const url = new URL(baseUrl)
    return url.protocol === 'https:' && CALENDLY_HOST_PATTERN.test(url.hostname)
  } catch (error) {
    return false
  }
}

/**
 * Only the billing owner (project admin holding the subscription) is offered the extension.
 */
export const isBillingOwner = (user) => Boolean(user && user.level === 0 && user.user_system_id)

// `Y-m-d H:i:s` (api-core) or naive ISO `Y-m-dTH:i:s[.u]` (billing-api): no zone designator.
const NAIVE_DATE_TIME_PATTERN = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)$/
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const SPACE_SEPARATED_PATTERN = /^(\d{4}-\d{2}-\d{2}) (\d{2}:)/

/**
 * Parses a date-ish value into epoch millis, or null when unusable.
 *
 * The APIs send trial dates in UTC without a zone designator (`2026-10-02 12:00:00` from
 * api-core, `2026-10-02T12:00:00` from billing-api). `new Date()` would read those as the
 * browser's *local* time, shifting the trial end by the visitor's UTC offset, so strings
 * without an explicit `Z`/offset are parsed as UTC. Numbers (epoch millis) and Date
 * instances are accepted as-is.
 */
export const parseDateValue = (value) => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (value instanceof Date) {
    const time = value.getTime()
    return Number.isFinite(time) ? time : null
  }
  if (typeof value !== 'string') return null

  let text = value.trim()
  if (!text) return null

  const naive = text.match(NAIVE_DATE_TIME_PATTERN)
  if (naive) {
    text = `${naive[1]}T${naive[2]}Z`
  } else if (DATE_ONLY_PATTERN.test(text)) {
    text = `${text}T00:00:00Z`
  } else {
    // Zoned value written with a space separator (`2026-10-02 12:00:00+02:00`).
    text = text.replace(SPACE_SEPARATED_PATTERN, '$1T$2')
  }

  const time = new Date(text).getTime()
  return Number.isFinite(time) ? time : null
}

/**
 * Truthy check for project config / runtime flags, which arrive as booleans, numbers or
 * strings ('1', 'true'). '0', 'false' and '' are false.
 */
export const isEnabledFlag = (value) => {
  if (value === true || value === 1) return true
  if (typeof value === 'string') return ['1', 'true', 'yes'].includes(value.trim().toLowerCase())
  return false
}

/**
 * White-label deployments never see the offer: the deployment flag `is_white_label`
 * (src/config.json, merged with the Worker's `window.__CONFIG__`).
 *
 * The project config `white_label_module` is deliberately NOT an exclusion. It hides
 * Ordering-branded UI from the customer's own business users, while the offer only goes to
 * the billing owner (Ordering's direct customer). Trial plans ship with it on, so excluding
 * it would hide the offer from every trial.
 */
export const isWhiteLabelProject = ({ isWhiteLabel } = {}) => isEnabledFlag(isWhiteLabel)

/**
 * Whole days left until `trialEndTime`, floored at 0. Rounds up so "a few hours left" reads as 1 day.
 */
export const getTrialDaysRemaining = (trialEndTime, now = Date.now()) => {
  if (!Number.isFinite(trialEndTime)) return 0
  return Math.max(0, Math.ceil((trialEndTime - now) / TRIAL_EXTENSION_DAY_MS))
}

/**
 * Days left of an active free trial (`status: 'trialing'` with `trial_end` in the future),
 * or null when there is no active trial. Dates are parsed as UTC, like the offer.
 */
export const getActiveTrialDaysRemaining = (trialSubscription, now = Date.now()) => {
  if (!trialSubscription || trialSubscription.status !== 'trialing') return null
  const trialEnd = parseDateValue(trialSubscription.trial_end)
  if (trialEnd === null || trialEnd <= now) return null
  return getTrialDaysRemaining(trialEnd, now)
}

/**
 * Eligibility for the trial-extension offer.
 *
 * available = config.enabled && https calendly booking_url && !whiteLabel && isBillingOwner(user) &&
 *   trialSubscription && trial_end > now && (trial_end - start_date) < days * TRIAL_EXTENSION_DAY_MS && !booked
 *
 * When `start_date` is missing, duration is treated as unknown and does not block the offer
 * (the `booked` flag is what makes the offer disappear permanently once the trial is extended).
 */
export const getTrialExtensionEligibility = ({
  config,
  user,
  trialSubscription,
  booked = false,
  whiteLabel = false,
  now = Date.now()
} = {}) => {
  const enabled = isEnabledFlag(config?.enabled) && isCalendlyBookingUrl(config?.booking_url)
  const totalDays = Number(config?.days) > 0 ? Number(config.days) : DEFAULT_TRIAL_EXTENSION_DAYS

  const trialEnd = parseDateValue(trialSubscription?.trial_end)
  const startDate = parseDateValue(trialSubscription?.start_date)

  const isTrialing = Boolean(trialSubscription) && trialSubscription.status === 'trialing' && trialEnd !== null
  const trialActive = isTrialing && trialEnd > now

  let underDurationCap = true
  if (trialActive && startDate !== null) {
    const durationMs = trialEnd - startDate
    underDurationCap = durationMs < totalDays * TRIAL_EXTENSION_DAY_MS
  }

  const available = Boolean(
    enabled &&
    !whiteLabel &&
    isBillingOwner(user) &&
    trialActive &&
    underDurationCap &&
    !booked
  )

  return {
    available,
    daysRemaining: trialActive ? getTrialDaysRemaining(trialEnd, now) : 0,
    trialEnd: isTrialing ? trialEnd : null
  }
}

/**
 * Normalizes a color to a 6-digit lowercase hex string without '#', or null when it isn't one.
 * Calendly's `primary_color`/`text_color`/`background_color` params only accept 6-digit hex.
 */
export const normalizeHexColor = (value) => {
  if (typeof value !== 'string') return null
  const hex = value.trim().replace(/^#/, '')
  return /^[0-9a-f]{6}$/i.test(hex) ? hex.toLowerCase() : null
}

/**
 * Builds a Calendly booking URL with attribution + appearance params.
 * Pass `embedDomain` for the inline iframe variant (adds embed_domain/embed_type); omit it
 * for the "open in a new tab" fallback link. Params with an empty/missing value are omitted.
 */
export const buildTrialExtensionBookingUrl = ({
  baseUrl,
  user,
  project,
  source = 'dashboard',
  embedDomain,
  primaryColor,
  textColor,
  backgroundColor
} = {}) => {
  if (!isCalendlyBookingUrl(baseUrl)) return ''

  let url
  try {
    url = new URL(baseUrl)
  } catch (error) {
    return ''
  }

  const name = `${user?.name || ''} ${user?.lastname || ''}`.trim()

  const entries = [
    ['name', name],
    ['email', user?.email],
    ['utm_source', source],
    ['utm_medium', 'trial_extension'],
    ['utm_campaign', 'free_trial'],
    ['utm_content', project?.code],
    ['hide_event_type_details', '1'],
    ['hide_gdpr_banner', '1'],
    ['primary_color', normalizeHexColor(primaryColor)],
    ['text_color', normalizeHexColor(textColor)],
    ['background_color', normalizeHexColor(backgroundColor)],
    ['embed_domain', embedDomain],
    ['embed_type', embedDomain ? 'Inline' : '']
  ]

  entries.forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    url.searchParams.set(key, String(value))
  })

  return url.toString()
}

/**
 * Clamps a Calendly-reported height (e.g. "711px") to a sane pixel number, or null when unusable.
 */
export const clampCalendlyHeight = (rawHeight) => {
  const height = Number.parseFloat(String(rawHeight))
  if (!Number.isFinite(height)) return null
  if (height < CALENDLY_MIN_HEIGHT || height > CALENDLY_MAX_HEIGHT) return null
  return Math.ceil(height)
}

/**
 * Parses a `window.message` event from the Calendly inline embed. Returns null unless the
 * event is genuinely from the embedded Calendly iframe (origin + source window match).
 */
export const parseCalendlyMessage = (event, iframeWindow) => {
  if (!event || event.origin !== CALENDLY_ORIGIN) return null
  if (!iframeWindow || event.source !== iframeWindow) return null

  const type = event.data && event.data.event
  if (typeof type !== 'string' || !type.startsWith('calendly.')) return null

  const payload = event.data.payload

  if (type === 'calendly.page_height') {
    return { type, height: clampCalendlyHeight(payload?.height), payload }
  }

  return { type, payload }
}
