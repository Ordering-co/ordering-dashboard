/**
 * Settings hub routes and legacy URL redirects.
 * Pure helpers, no React.
 */

export const SETTINGS_HUB_PATH = '/settings'
export const SETTINGS_HUB_MOBILE_MAX = 767

/**
 * Old Settings (and addon settings) paths mapped to the hub query.
 * `/settings/logs` is not listed: that page stays under Logs Audit.
 */
export const SETTINGS_LEGACY_REDIRECTS = {
  '/all-settings': { group: null, category: null },
  '/settings/basic': { group: 'platform', category: null },
  '/settings/standard': { group: 'orders', category: 'user_information' },
  '/settings/operation': { group: 'orders', category: null },
  '/settings/pro': { group: 'notifications', category: null },
  '/settings/plugin': { group: 'developers', category: null },
  '/settings/enterprise': { group: 'drivers', category: null },
  '/settings/pages': { group: 'website', category: 'pages' },
  '/settings/places': { group: 'locations', category: 'places' },
  '/settings/integrations': { group: 'developers', category: 'developers' },
  '/settings/language': { group: 'languages', category: 'language_manager' },
  '/loyalty/rewards-programs': { group: 'payments', category: 'addon_points_and_levels' },
  '/loyalty/wallets-refunds': { group: 'payments', category: 'addon_cash_wallet_and_refunds' },
  '/gift-cards-settings': { group: 'payments', category: 'addon_gift_cards' },
  '/catering': { group: 'orders', category: 'addon_catering' },
  '/multi-business-checkout': { group: 'orders', category: 'addon_multi_business_checkout' },
  '/stripe-connect': { group: 'payments', category: 'addon_stripe_connect' },
  '/reservations': { group: 'orders', category: 'store_reservation' }
}

export const buildSettingsPath = ({ group, category, q, id, focus, view } = {}) => {
  const params = new URLSearchParams()
  if (group) params.set('group', group)
  if (category) params.set('category', category)
  if (q) params.set('q', q)
  if (id) params.set('id', id)
  if (focus) params.set('focus', focus)
  if (view) params.set('view', view)
  const query = params.toString()
  return query ? `${SETTINGS_HUB_PATH}?${query}` : SETTINGS_HUB_PATH
}

export const isSettingsHubPath = (pathname = '') => pathname === SETTINGS_HUB_PATH

/**
 * Builds the hub URL for a legacy path. Incoming `?category=` (special screen
 * key or numeric id) wins over the default target category.
 */
export const getSettingsRedirectPath = (pathname, search = '') => {
  const target = SETTINGS_LEGACY_REDIRECTS[pathname]
  if (!target) return null
  const incoming = new URLSearchParams(String(search || '').replace(/^\?/, ''))
  const incomingCategory = incoming.get('category')
  const incomingGroup = incoming.get('group')
  return buildSettingsPath({
    group: incomingGroup || target.group,
    category: incomingCategory || target.category,
    q: incoming.get('q') || null
  })
}
