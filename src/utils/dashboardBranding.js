import { publicAssetUrl } from './publicAssetUrl'

const OFFICIAL_ORDERING_DASHBOARD_HOSTS = new Set([
  'dashboard.orderingplus.com',
  'dashboard.tryordering.com',
  'dashboard.ordering.co',
  'dashboardcf.orderingplus.com'
])

export const ORDERING_FAVICON = '/favicon.png'

const currentHostname = () =>
  typeof window === 'undefined' ? '' : window.location.hostname

/**
 * Official Ordering.co dashboard hosts. Used by analytics and the Worker;
 * branding no longer depends on it.
 */
export const isOfficialOrderingDashboardHost = (hostname = currentHostname()) =>
  OFFICIAL_ORDERING_DASHBOARD_HOSTS.has(String(hostname).toLowerCase())

/*
 * Branding defaults: a project's own logo and favicon (Settings › My products
 * › Dashboard) always win. Without them, every host shows the Ordering.co
 * brand (logo variant chosen by the caller for its field, favicon, icon).
 */

export const getDashboardLogoUrl = (configs, orderingLogo) => publicAssetUrl(
  configs?.dashboard_logo?.value || orderingLogo
)

export const getDashboardFaviconUrl = (configs) => publicAssetUrl(
  configs?.dashboard_favicon?.value || ORDERING_FAVICON
)

export const getDashboardNotificationIconUrl = (configs, orderingIcon) => publicAssetUrl(
  configs?.dashboard_favicon?.value ||
  configs?.dashboard_logo?.value ||
  orderingIcon
)
