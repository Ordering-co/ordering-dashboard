import { BUILDER_ALLOWED_LEVELS, canAccessBuilder, canAccessSchoolsPage, getConnectVisualAccess, SCHOOLS_ALLOWED_LEVELS } from './dashboardFeatureAccess'
import { SIDEBAR_NAV_ORDER, orderSidebarItems } from './sidebarNavOrder'

/**
 * Dashboard navigation.
 *
 * One definition of the sidebar sections and their role / addon rules. The
 * sidebar renders it and the command palette searches it, so a destination is
 * never offered in one place and hidden in the other. Pure, no React.
 */

const CONNECT_BUSINESS_OWNER_PAGES = ['pos_menu']
const getConnectLevels = (pageName) => CONNECT_BUSINESS_OWNER_PAGES.includes(pageName) ? [0, 2] : [0]

/**
 * Levels allowed by each `ProtectedRoute` in `src/App.js`. Keep in sync: the
 * test `dashboardNavigation.test.js` reads App.js and fails on drift.
 */
export const DASHBOARD_ROUTE_LEVELS = {
  '/orders': [0, 2, 5],
  '/deliveries': [0, 2, 5],
  '/drivers-dashboard': [0, 5],
  '/driver-store-status': [0, 5],
  '/all-in-one': [0, 2, 5],
  '/appointments': [0, 2],
  '/schools': SCHOOLS_ALLOWED_LEVELS,
  '/messages': [0, 2],
  '/stores/list': [0, 2],
  '/stores/products': [0, 2],
  '/stores/brand': [0],
  '/stores/devices': [0],
  '/stores/add': [0, 2],
  '/connect/overview': getConnectLevels('connect_overview'),
  '/connect/delivery-services': getConnectLevels('delivery_services'),
  '/connect/importers': getConnectLevels('importers'),
  '/connect/pos-menu': getConnectLevels('pos_menu'),
  '/connect/sales-channels': getConnectLevels('sales_channels'),
  '/users/customers': [0],
  '/users/business-owners': [0],
  '/users/callcenter-agents': [0],
  '/users/admins': [0],
  '/users/professionals': [0, 2, 5],
  '/intelligence/business': [0, 2],
  '/intelligence/drivers': [0],
  '/intelligence/invoice': [0],
  '/intelligence/reviews': [0],
  '/intelligence/reports': [0],
  '/intelligence/ecommerce_reports': [0],
  '/intelligence/business-payments': [0, 2],
  '/delivery/drivers-list': [0, 5, 2],
  '/delivery/drivers-managers': [0],
  '/delivery/drivers-companies': [0],
  '/delivery/drivers-groups': [0, 5],
  '/delivery/drivers-time-display': [0, 5],
  '/marketing/promotions-enterprise': [0],
  '/marketing/campaign': [0],
  '/marketing/ad-banners': [0],
  '/stores/markups': [0],
  '/gift-cards': [0],
  '/cart-recovery/open-carts': [0],
  '/cart-recovery/recovery-actions': [0],
  '/my-products/ordering-website': [0],
  '/my-products/ordering-website-2': [0],
  '/my-products/franchises-website': [0],
  '/my-products/dashboard': [0],
  '/my-products': [0],
  '/builder': BUILDER_ALLOWED_LEVELS,
  '/settings': [0],
  '/settings/logs': [0],
  '/free-downloads': [0],
  '/open-source-code': [0, 2],
  '/purchase/addons': [0],
  '/support': [0],
  '/ordering-products': [0],
  '/profile': [0, 2, 5, 8]
}

/**
 * Longest registered route that prefixes `path` (query string ignored).
 */
export const getDashboardRouteLevels = (path = '') => {
  const pathname = String(path || '').split('?')[0]
  if (DASHBOARD_ROUTE_LEVELS[pathname]) return DASHBOARD_ROUTE_LEVELS[pathname]
  const match = Object.keys(DASHBOARD_ROUTE_LEVELS)
    .filter(route => pathname.startsWith(`${route}/`))
    .sort((a, b) => b.length - a.length)[0]
  return match ? DASHBOARD_ROUTE_LEVELS[match] : null
}

/**
 * `true` when the route guard lets `level` in. Unknown routes are denied so a
 * new page is never offered before its guard is registered here.
 */
export const canOpenDashboardRoute = (path, level) => {
  const levels = getDashboardRouteLevels(path)
  return !!levels && levels.includes(level)
}

/**
 * Read-only flags as `getUserType` reads them, from a session user object.
 */
export const getDashboardRoleFlags = (user = {}) => {
  const readOnlyBusinessOwner = !!user?.readOnlyBusinessOwner || !!user?.viewOnlyBusinessOwner
  const readOnlyDeliveryManager = !!user?.readOnlyDeliveryManager
  const readOnlyAdmin = !!user?.readOnlyAdmin
  return {
    level: user?.level,
    readOnlyBusinessOwner,
    readOnlyDeliveryManager,
    readOnlyAdmin,
    isReadOnly: readOnlyBusinessOwner || readOnlyDeliveryManager || readOnlyAdmin
  }
}

const BUSINESS_OWNER_INTELLIGENCE_IDS = [1, 6]

/**
 * Sidebar sections. Each section has `visible` (the accordion is shown) and
 * `items` (sub menus with `enabled`). Item titles are translated with `t`.
 */
export const getDashboardNavSections = ({ t = (_key, fallback) => fallback, user, configs = {}, project } = {}) => {
  const { level, readOnlyAdmin, readOnlyDeliveryManager, readOnlyBusinessOwner, isReadOnly } = getDashboardRoleFlags(user)
  const {
    showConnectTab,
    connectOverview,
    connectDeliveryServices,
    connectPosMenuSync,
    connectImporters,
    connectSalesChannels,
    marketingCampaigns
  } = getConnectVisualAccess({ configs })
  const intelligenceEnabled = (id) => level === 2 ? BUSINESS_OWNER_INTELLIGENCE_IDS.includes(id) : true

  const orders = [
    { id: 1, title: t('ORDERS_LIST', 'Orders list'), pageName: 'orders', url: '/orders', enabled: true },
    {
      id: 4,
      title: t('OPEN_CARTS', 'Open carts'),
      pageName: 'open_carts',
      url: '/cart-recovery/open-carts',
      enabled: level === 0 && !isReadOnly
    },
    {
      id: 5,
      title: t('MESSAGES', 'Messages'),
      pageName: 'messages',
      url: '/messages',
      enabled: level !== 5 || !(readOnlyAdmin || readOnlyBusinessOwner)
    },
    {
      id: 6,
      title: t('GIFT_CARD_MANAGER', 'Gift card manager'),
      pageName: 'gift_cards',
      url: '/gift-cards',
      enabled: level !== 2 && !(readOnlyAdmin || readOnlyBusinessOwner)
    },
    {
      id: 7,
      title: t('APPOINTMENTS', 'Appointments'),
      pageName: 'appointments',
      url: '/appointments',
      enabled: level !== 5
    }
  ]

  const delivery = [
    { id: 1, title: t('DELIVERY_DASHBOARD', 'Deliveries dashboard'), pageName: 'deliveries', url: '/deliveries', enabled: !(readOnlyAdmin || readOnlyDeliveryManager) },
    { id: 2, title: t('DRIVERS_DASHBOARD', 'Drivers Dashboard'), pageName: 'drivers_dashboard', url: '/drivers-dashboard', enabled: level !== 2 },
    { id: 3, title: t('ALL_IN_ONE', 'All in one'), pageName: 'all_in_one', url: '/all-in-one', enabled: !(readOnlyAdmin || readOnlyDeliveryManager) },
    { id: 4, title: t('DRIVERS', 'Drivers'), pageName: 'delivery_drivers', url: '/delivery/drivers-list', enabled: level === 5 || level === 0 },
    {
      id: 5,
      title: t('DRIVER_MANAGERS', 'Drivers manager'),
      pageName: 'drivers_managers',
      url: '/delivery/drivers-managers',
      enabled: level === 0 && !(readOnlyAdmin || readOnlyDeliveryManager)
    },
    {
      id: 6,
      title: t('DELIVERY_GROUPS', 'Delivery Groups'),
      pageName: 'drivers_groups',
      url: '/delivery/drivers-groups',
      enabled: (level === 5 || level === 0) && !(readOnlyAdmin || readOnlyDeliveryManager)
    },
    {
      id: 7,
      title: t('DRIVER_STORE_STATUS', 'Driver Store Status'),
      pageName: 'driver_store_status',
      url: '/driver-store-status',
      enabled: !(readOnlyAdmin || readOnlyDeliveryManager)
    },
    {
      id: 8,
      title: t('DRIVERS_TIME_DISPLAY', 'Drivers time display'),
      pageName: 'drivers_time_display',
      url: '/delivery/drivers-time-display',
      enabled: (level === 5 || level === 0) && !(readOnlyAdmin || readOnlyDeliveryManager)
    },
    {
      id: 9,
      title: t('DELIVERY_COMPANIES', 'Delivery companies'),
      pageName: 'drivers_companies',
      url: '/delivery/drivers-companies',
      enabled: level === 0 && !(readOnlyAdmin || readOnlyDeliveryManager)
    }
  ]

  const stores = [
    { id: 1, title: t('STORES', 'Stores'), pageName: 'businesses', url: '/stores/list', enabled: true },
    { id: 2, title: t('PRODUCTS', 'Products'), pageName: 'store', url: '/stores/products', enabled: true },
    { id: 3, title: t('BRANDS', 'Brands'), pageName: 'brand', url: '/stores/brand', enabled: level !== 2 },
    { id: 4, title: t('DEVICES', 'Devices'), pageName: 'devices', url: '/stores/devices', enabled: true },
    { id: 5, title: t('MARKUPS', 'Markups'), pageName: 'markups', url: '/stores/markups', enabled: level === 0 }
  ]

  const connect = [
    { id: 1, title: t('CONNECT_OVERVIEW', 'Overview'), pageName: 'connect_overview', url: '/connect/overview', enabled: connectOverview },
    { id: 2, title: t('CONNECT_DELIVERY_SERVICES', 'Delivery services'), pageName: 'delivery_services', url: '/connect/delivery-services', enabled: connectDeliveryServices },
    { id: 3, title: t('CONNECT_POS_MENU', 'POS & Menu Sync'), pageName: 'pos_menu', url: '/connect/pos-menu', enabled: connectPosMenuSync },
    { id: 4, title: t('CONNECT_IMPORTERS', 'Importers'), pageName: 'importers', url: '/connect/importers', enabled: connectImporters },
    { id: 5, title: t('CONNECT_SALES_CHANNELS', 'Sales Channels'), pageName: 'sales_channels', url: '/connect/sales-channels', enabled: connectSalesChannels }
  ].filter(menu => getConnectLevels(menu.pageName).includes(level))

  const users = [
    { id: 1, title: t('CUSTOMERS', 'Customers'), pageName: 'customers', url: '/users/customers', enabled: true },
    { id: 2, title: t('BUSINESS_OWNERS', 'Business Owners'), pageName: 'business_owners', url: '/users/business-owners', enabled: true },
    { id: 3, title: t('CALL_CENTER_AGENTS', 'Call Center Agents'), pageName: 'callcenter_agents', url: '/users/callcenter-agents', enabled: true },
    { id: 4, title: t('ADMINS', 'Admins'), pageName: 'admins', url: '/users/admins', enabled: true },
    { id: 5, title: t('PROFESSIONALS', 'Professionals'), pageName: 'professionals', url: '/users/professionals', enabled: true }
  ]

  const myProducts = [
    { id: 'web', title: t('ORDERING_WEBSITE', 'Ordering website'), pageName: 'ordering_website', url: '/my-products/ordering-website', enabled: !configs?.web_franchises_x?.value, type: 'noapi' },
    { id: 'web_marketplace_26', title: t('ORDERING_WEBSITE_2', 'Ordering website 2'), pageName: 'ordering_website_2', url: '/my-products/ordering-website-2', enabled: !!configs?.web_marketplace_26?.value, type: 'noapi' },
    { id: 'web_dashboard_x', title: t('ORDERING_DASHBOARD', 'Dashboard'), pageName: 'dashboard', url: '/my-products/dashboard', enabled: !!configs?.web_dashboard_x?.value, type: 'noapi' },
    { id: 'web_franchises_x', title: t('FRANCHISES_WEBSITE', 'Franchises website'), pageName: 'franchises_website', url: '/my-products/franchises-website', enabled: !!configs?.web_franchises_x?.value, type: 'noapi' }
  ]

  const intelligence = [
    { id: 1, title: t('BUSINESS_REPORTS', 'Business reports'), pageName: 'business_analytics', url: '/intelligence/business', enabled: intelligenceEnabled(1) },
    { id: 2, title: t('INVOICE_MANAGER', 'Invoice manager'), pageName: 'invoice', url: '/intelligence/invoice', enabled: intelligenceEnabled(2) },
    { id: 3, title: t('DELIVERY_REPORTS', 'Delivery reports'), pageName: 'drivers_analytics', url: '/intelligence/drivers', enabled: intelligenceEnabled(3) },
    { id: 4, title: t('REVIEWS_MANAGER', 'Reviews manager'), pageName: 'reviews', url: '/intelligence/reviews', enabled: intelligenceEnabled(4) },
    { id: 5, title: t('ENTERPRISE_REPORTS', 'Enterprise reports'), pageName: 'reports', url: '/intelligence/reports', enabled: intelligenceEnabled(5) },
    { id: 6, title: t('PAYMENT_REPORTS', 'Payment reports'), pageName: 'business_payment_reports', url: '/intelligence/business-payments', enabled: intelligenceEnabled(6) }
  ]

  const marketing = [
    { id: 1, title: t('ADVANCED_OFFERS', 'Advanced offers'), pageName: 'enterprise_promotions', url: '/marketing/promotions-enterprise', enabled: true },
    { id: 2, title: t('AD_BANNERS', 'Ad banners'), pageName: 'ad_banners', url: '/marketing/ad-banners', enabled: true },
    { id: 3, title: t('CART_RECOVERY_RULES', 'Cart recovery rules'), pageName: 'recovery_actions', url: '/cart-recovery/recovery-actions', enabled: true },
    { id: 5, title: t('CAMPAIGN', 'Campaign'), pageName: 'campaign', url: '/marketing/campaign', enabled: marketingCampaigns }
  ]

  const logs = [
    { id: 1, title: t('SETTINGS_LOGS', 'Settings logs'), pageName: 'logs', url: '/settings/logs', enabled: true }
  ]

  const notDriverOrPro = level !== 5 && level !== 8

  return {
    home: {
      key: 'home',
      title: t('HOME', 'Home'),
      visible: notDriverOrPro && !isReadOnly,
      items: [{ id: 'home', title: t('HOME', 'Home'), pageName: 'home', url: '/home', enabled: true }]
    },
    orders: {
      key: 'orders',
      title: t('ORDERS', 'Orders'),
      visible: level !== 8,
      items: orderSidebarItems(orders, SIDEBAR_NAV_ORDER.orders)
    },
    delivery: {
      key: 'delivery',
      title: t('DELIVERY', 'Delivery'),
      visible: level === 0 || level === 5,
      items: orderSidebarItems(delivery, SIDEBAR_NAV_ORDER.delivery)
    },
    stores: {
      key: 'stores',
      title: t('STORES', 'Stores'),
      visible: notDriverOrPro && !isReadOnly,
      items: orderSidebarItems(stores, SIDEBAR_NAV_ORDER.stores)
    },
    schools: {
      key: 'schools',
      title: t('SCHOOLS', 'Schools'),
      visible: canAccessSchoolsPage(level) && !isReadOnly,
      items: [{ id: 'schools', title: t('SCHOOLS', 'Schools'), pageName: 'schools', url: '/schools', enabled: true }]
    },
    connect: {
      key: 'connect',
      title: t('DASHBOARD_CONNECT', 'Connect'),
      visible: showConnectTab && notDriverOrPro && !isReadOnly && connect.some(menu => menu.enabled),
      items: orderSidebarItems(connect, SIDEBAR_NAV_ORDER.connect)
    },
    users: {
      key: 'users',
      title: t('USERS', 'Users'),
      visible: level === 0 && !isReadOnly,
      items: orderSidebarItems(users, SIDEBAR_NAV_ORDER.users)
    },
    marketing: {
      key: 'marketing',
      title: t('MARKETING', 'Marketing'),
      visible: level === 0 && !isReadOnly,
      items: orderSidebarItems(marketing, SIDEBAR_NAV_ORDER.marketing)
    },
    intelligence: {
      key: 'intelligence',
      title: t('REPORTS', 'Reports'),
      visible: notDriverOrPro && !isReadOnly,
      items: orderSidebarItems(intelligence, SIDEBAR_NAV_ORDER.intelligence)
    },
    myProducts: {
      key: 'myProducts',
      title: t('MY_PRODUCTS', 'My products'),
      visible: level === 0 && !isReadOnly,
      items: myProducts
    },
    builder: {
      key: 'builder',
      title: t('BUILDER', 'Builder'),
      visible: canAccessBuilder({ project, level }) && !isReadOnly,
      items: [{ id: 'builder', title: t('BUILDER', 'Builder'), pageName: 'builder', url: '/builder', enabled: true }]
    },
    logs: {
      key: 'logs',
      title: t('LOGS_AUDIT', 'Logs Audit'),
      visible: level === 0 && !isReadOnly,
      items: logs
    }
  }
}

/**
 * Footer shortcuts of the sidebar that are routes (not external links).
 */
export const getDashboardFooterLinks = ({ t = (_key, fallback) => fallback, user } = {}) => {
  const { level, isReadOnly } = getDashboardRoleFlags(user)
  return [
    {
      id: 'settings',
      title: t('SETTINGS', 'Settings'),
      pageName: 'settings',
      url: '/settings',
      enabled: level === 0 && !isReadOnly
    },
    {
      id: 'free_downloads',
      title: t('FREE_DOWNLOADS', 'Free downloads'),
      pageName: 'free_products',
      url: '/free-downloads',
      enabled: level === 0
    },
    {
      id: 'open_source_code',
      title: t('SOURCE_CODE_TITLE', 'Open Source Code'),
      pageName: 'open_source_code',
      url: '/open-source-code',
      enabled: [0, 2].includes(level)
    },
    {
      id: 'purchase_addons',
      title: t('APPS_AND_ADDONS', 'Apps & Addons'),
      pageName: 'purchase_addons',
      url: '/purchase/addons',
      enabled: level === 0 && !!user?.user_system_id && !isReadOnly
    },
    {
      id: 'profile',
      title: t('PROFILE', 'Profile'),
      pageName: 'profile',
      url: '/profile',
      enabled: true
    }
  ]
}
