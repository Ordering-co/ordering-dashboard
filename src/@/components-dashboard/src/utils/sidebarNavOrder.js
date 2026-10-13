/**
 * Task-first sidebar order.
 *
 * Work boards first, then people, then organization, then secondary tools.
 * Unknown page names stay at the end in their original relative order.
 */

export const SIDEBAR_NAV_ORDER = {
  orders: ['orders', 'appointments', 'open_carts', 'messages', 'gift_cards'],
  delivery: [
    'deliveries',
    'drivers_dashboard',
    'all_in_one',
    'delivery_drivers',
    'drivers_managers',
    'drivers_groups',
    'drivers_companies',
    'driver_store_status',
    'drivers_time_display'
  ],
  stores: ['businesses', 'store', 'brand', 'devices', 'markups'],
  connect: ['connect_overview', 'delivery_services', 'pos_menu', 'importers', 'sales_channels'],
  users: ['customers', 'professionals', 'callcenter_agents', 'business_owners', 'admins'],
  intelligence: [
    'business_analytics',
    'drivers_analytics',
    'business_payment_reports',
    'reviews',
    'invoice',
    'reports'
  ],
  marketing: ['enterprise_promotions', 'campaign', 'ad_banners', 'recovery_actions']
}

/**
 * @param {Array<{ pageName?: string }>} items
 * @param {string[]} order
 * @returns {Array}
 */
export const orderSidebarItems = (items = [], order = []) => {
  const rank = new Map((order || []).map((pageName, index) => [pageName, index]))
  return [...(items || [])].sort((left, right) => {
    const leftRank = rank.has(left?.pageName) ? rank.get(left.pageName) : order.length
    const rightRank = rank.has(right?.pageName) ? rank.get(right.pageName) : order.length
    if (leftRank !== rightRank) return leftRank - rightRank
    return 0
  })
}
