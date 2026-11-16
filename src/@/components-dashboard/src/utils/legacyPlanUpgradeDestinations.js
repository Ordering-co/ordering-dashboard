// navigation destinations that offer an upgrade on legacy plan 581.
const ROUTES = [
  '/appointments',
  '/schools',
  '/all-in-one',
  '/delivery/drivers-companies',
  '/driver-store-status',
  '/delivery/drivers-time-display',
  '/stores/devices',
  '/stores/markups',
  '/builder',
  '/marketing/campaign',
  '/users/professionals',
  '/users/callcenter-agents',
  '/intelligence/business-payments',
  '/intelligence/reports',
  '/connect/delivery-services',
  '/connect/pos-menu',
  '/connect/importers',
  '/connect/sales-channels',
  '/connect/whatsapp-bots',
  '/settings/logs',
  '/open-source-code'
]

const SETTINGS_SECTIONS = new Set(['professional_signup', 'store_reservation', 'enterprise_orders_slas'])
export const isLegacyUpgradeSettingsSection = section => SETTINGS_SECTIONS.has(section)

export const isLegacyUpgradeDestination = (path = '') => {
  const [pathname, query = ''] = path.split('?')
  if (pathname === '/settings' || pathname === '/settings/') {
    return isLegacyUpgradeSettingsSection(new URLSearchParams(query).get('category'))
  }
  return ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`))
}
