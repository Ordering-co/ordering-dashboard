/**
 * Order with Google (Google Actions Center, ) on a store. The API
 * decides each store's state (`google_actions_status`, api-core
 * docs/GOOGLE_ACTIONS_FEED.md); these helpers only read what it returns.
 */

/** Every state the API returns, in the order the screens show them. */
export const GOOGLE_ACTIONS_STATES = ['sent', 'ready', 'processing', 'skipped', 'not_activated']

/** The StatusBadge family of each state; `not_activated` is drawn as plain text. */
export const GOOGLE_ACTIONS_STATE_FAMILIES = { sent: 'done', ready: 'progress', processing: 'pending', skipped: 'cancel' }

/** The label of each state, with the translator `t` of useLanguage. */
export const getGoogleActionsStateLabels = (t) => ({
  sent: t('GOOGLE_ACTIONS_STATE_SENT', 'Sent to Google'),
  ready: t('GOOGLE_ACTIONS_STATE_READY', 'Ready · goes in the next upload'),
  processing: t('GOOGLE_ACTIONS_STATE_PROCESSING', 'Checking changes…'),
  skipped: t('GOOGLE_ACTIONS_STATE_SKIPPED', 'Not sent'),
  not_activated: t('GOOGLE_ACTIONS_STATE_NOT_ACTIVATED', 'Not activated')
})

/** The short label of each state, for a badge in a list or a figure (Connect › Order with Google, the store's Overview). */
export const getGoogleActionsBadgeLabels = (t) => ({
  sent: t('GOOGLE_ACTIONS_BADGE_SENT', 'Sent'),
  ready: t('GOOGLE_ACTIONS_BADGE_READY', 'Ready'),
  processing: t('GOOGLE_ACTIONS_BADGE_PROCESSING', 'Checking'),
  skipped: t('GOOGLE_ACTIONS_STATE_SKIPPED', 'Not sent'),
  not_activated: t('GOOGLE_ACTIONS_STATE_NOT_ACTIVATED', 'Not activated')
})

/** Why a store is not sent (`status_reason`), with the translator `t` of useLanguage. */
export const getGoogleActionsReasonLabels = (t) => ({
  disabled: t('GOOGLE_ACTIONS_REASON_DISABLED', 'The store is disabled.'),
  no_name: t('GOOGLE_ACTIONS_REASON_NO_NAME', 'The store has no name.'),
  no_url: t('GOOGLE_ACTIONS_REASON_NO_URL', 'The website has no https address for the store.'),
  no_location: t('GOOGLE_ACTIONS_REASON_NO_LOCATION', 'The store has no address or map location.'),
  no_service: t('GOOGLE_ACTIONS_REASON_NO_SERVICE', 'No enabled menu offers delivery or pickup, or no delivery zone has a fixed price.'),
  no_lead_time: t('GOOGLE_ACTIONS_REASON_NO_LEAD_TIME', 'The store has no delivery or pickup time. Google needs it for each service it shows.'),
  no_schedule: t('GOOGLE_ACTIONS_REASON_NO_SCHEDULE', 'The store has no weekly hours.'),
  no_currency: t('GOOGLE_ACTIONS_REASON_NO_CURRENCY', 'The project has no currency. Set it in Settings › Card payments (Stripe).')
})

/**
 * Where the currency sent to Google is set: the project's `stripe_currency`, not the store (the API reads only that config). Only
 * staff of level 0 open Settings.
 */
export const GOOGLE_ACTIONS_CURRENCY_SETTINGS_URL = '/settings?group=payments&category=stripe&focus=stripe_currency'

/**
 * Store section that fixes each reason the API gives for not sending a store. None for a reason no section edits: the
 * currency is the project's (GOOGLE_ACTIONS_CURRENCY_SETTINGS_URL), the address of a site is in the website, and a
 * disabled store is turned on from its header.
 */
export const GOOGLE_ACTIONS_REASON_SECTIONS = {
  no_name: 'store_details',
  no_location: 'store_details',
  no_currency: null,
  no_schedule: 'schedule',
  no_service: 'delivery_pickup_more',
  no_lead_time: 'delivery_pickup_more',
  no_url: null,
  disabled: null
}

/** The tab of that section (`&tab=`) that holds what is missing; none opens the section's first tab. */
export const GOOGLE_ACTIONS_REASON_TABS = {
  no_name: 'information',
  no_location: 'location'
}

/**
 * The state of GET/PUT business/{id}/google_actions, or of one store of the
 * business list (its `google_actions`, none when not activated), as the API
 * gives it. Null while there is nothing to show: a store that is not
 * activated in a project that cannot activate yet (`can_activate`).
 */
export const getGoogleActionsState = (data) => {
  if (!data) return null
  const state = data.google_actions_status || 'not_activated'
  if (state === 'not_activated' && data.can_activate === false) return null
  return state
}

/**
 * Whether the project's Google screens show: it can activate stores, or it
 * still has stores on Google that can be deactivated.
 */
export const isGoogleActionsVisible = (status) => {
  if (!status) return false
  if (status.can_activate) return true
  const counts = status.counts || {}
  return GOOGLE_ACTIONS_STATES.some(state => state !== 'not_activated' && (counts[state] || 0) > 0)
}

/**
 * The store link a site gives, as the API builds it: the custom domain when
 * its certificate is issued, else the site URL, plus business_url_template.
 * Null when the site has no https address or the store has no slug.
 */
export const getGoogleSiteUrl = (site, slug) => {
  if (!site || !slug) return null
  let base = null
  if (site.domain && site.ssl_status === 'issued') base = `https://${site.domain}`
  else if (site.url) base = site.url
  if (!base || !base.startsWith('https://')) return null
  const path = (site.business_url_template || ':business_slug').replace(':business_slug', slug)
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`.replace(/\/+$/, '')
}

/** Whether the site's link uses its own domain. */
export const isGoogleCustomDomain = (site) => !!(site?.domain && site?.ssl_status === 'issued')

/** The site to preselect: one with its own domain first, else the first with an https link. */
export const getDefaultGoogleSite = (sites, slug) => {
  const usable = (sites || []).filter(site => getGoogleSiteUrl(site, slug))
  return usable.find(isGoogleCustomDomain) || usable[0] || null
}

/** "Name Lastname" of who accepted the consent, or null. */
export const getGoogleConsentAuthor = (data) => {
  const user = data?.consented_by_user
  if (!user) return null
  return [user.name, user.lastname].filter(Boolean).join(' ') || null
}

/**
 * An API date as the `YYYY-MM-DD HH:mm:ss` UTC text `getTimeAgo` and `parseDate` (useUtils) read. The API sends ISO
 * strings with their zone, and the business list `Y-m-d H:i:s` in UTC. Null when missing or invalid.
 */
export const toGoogleActionsUtc = (value) => {
  if (!value) return null
  const text = String(value)
  const ms = Date.parse(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text) ? `${text.replace(' ', 'T')}Z` : text)
  if (Number.isNaN(ms)) return null
  const date = new Date(ms)
  const pad = (part) => String(part).padStart(2, '0')
  const day = [date.getUTCFullYear(), pad(date.getUTCMonth() + 1), pad(date.getUTCDate())].join('-')
  const time = [date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()].map(pad).join(':')
  return `${day} ${time}`
}
