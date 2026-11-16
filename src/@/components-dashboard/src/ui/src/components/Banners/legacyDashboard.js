// An optional, time-limited notice for installations migrating to a new dashboard.

// The previous dashboard only accepts a session from the URL for these levels (AutologinParams/autologinSession.js).
export const LEGACY_DASHBOARD_LEVELS = [0, 2, 5, 8]

// The time zone the end date is written in for the person reading it (Ordering works on US Central time).
export const LEGACY_DASHBOARD_TIME_ZONE = 'America/Chicago'

const parseEnd = (value) => {
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : time
}

// Only a usable HTTPS target is eligible. Ignore malformed links and embedded credentials.
const getLegacyDestination = (baseUrl) => {
  if (typeof baseUrl !== 'string' || !baseUrl) return null
  try {
    const target = new URL(baseUrl)
    if (target.protocol !== 'https:' || target.username || target.password) return null
    return new URL('/', target.origin)
  } catch {
    return null
  }
}

// The notice is opt-in, expires and appears only on the configured source hosts.
export const isLegacyDashboardNoticeActive = (config, { hostname, now = Date.now() } = {}) => {
  if (config?.enabled !== true || !getLegacyDestination(config.url)) return false
  const end = parseEnd(config.ends_at)
  if (end == null || now >= end) return false
  const hosts = Array.isArray(config.hosts) ? config.hosts : []
  return hosts.includes(hostname)
}

// Session transfer additionally requires a trusted origin authorized at build time.
export const buildLegacyDashboardUrl = (baseUrl, { project, token, trustedOrigin } = {}) => {
  const url = getLegacyDestination(baseUrl)
  if (!url) return null
  if (url.origin === trustedOrigin && project && token) {
    url.searchParams.set('project', project)
    url.searchParams.set('token', token)
  }
  return url.toString()
}

// The last day the notice shows, as the calendar day of `ends_at` in Central time ("2026-12-09 00:00:00"), ready for the project's
// `parseDate` (dateOnly, utc false) so the visible date follows `dates_general_format` like every other date (decision 13).
export const legacyDashboardLastDay = (endsAt) => {
  const end = parseEnd(endsAt)
  if (end == null) return null
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: LEGACY_DASHBOARD_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(end))
  const part = type => parts.find(item => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')} 00:00:00`
}
