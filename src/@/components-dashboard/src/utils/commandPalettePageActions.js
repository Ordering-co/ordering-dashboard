import { canOpenDashboardRoute } from './dashboardNavigation'
import { SETTINGS_HUB_PATH } from './settingsRedirects'

/**
 * Page-level "Open" actions of the command palette (full coverage).
 * Pure. Every entry is a fixed URL the page already reads (tabs, views and
 * filters), gated by the page the user can open. See
 * docs/COMMAND_PALETTE_COVERAGE.md for the inventory behind each row.
 */

const STATUS_TABS = [
  { status: 'pending', labelKey: 'PENDING', label: 'Pending', aliases: ['pendientes'] },
  { status: 'inProgress', labelKey: 'IN_PROGRESS', label: 'In progress', aliases: ['en curso', 'en progreso'] },
  { status: 'completed', labelKey: 'COMPLETED', label: 'Completed', aliases: ['completadas', 'entregadas'] },
  { status: 'cancelled', labelKey: 'CANCELLED', label: 'Cancelled', aliases: ['canceladas'] }
]

const STATUS_PAGES = [
  { url: '/deliveries', labelKey: 'DELIVERY_DASHBOARD', label: 'Deliveries dashboard', aliases: ['entregas'] },
  { url: '/all-in-one', labelKey: 'ALL_IN_ONE', label: 'All in one', aliases: ['todo en uno'] }
]

const INVOICE_TABS = [
  { invoice: 'business', tab: 'payment_methods', parentKey: 'COMMAND_PALETTE_INVOICE_BUSINESS', parent: 'Store invoices', labelKey: 'PAYMENT_METHODS', label: 'Payment methods', aliases: ['facturas por metodo de pago'] },
  { invoice: 'business', tab: 'order_type', parentKey: 'COMMAND_PALETTE_INVOICE_BUSINESS', parent: 'Store invoices', labelKey: 'ORDER_TYPE', label: 'Delivery Type', aliases: ['facturas por tipo de orden'] },
  { invoice: 'driver', tab: 'payment_methods', parentKey: 'COMMAND_PALETTE_INVOICE_DRIVER', parent: 'Driver invoices', labelKey: 'PAYMENT_METHODS', label: 'Payment methods', aliases: ['facturas de repartidores por metodo de pago'] }
]

const PROMOTION_VIEWS = [
  { view: 'journeys', labelKey: 'QUICK_OFFERS', label: 'Quick offers', aliases: ['ofertas rapidas', 'plantillas de promocion', 'primera compra', 'te extranamos', 'journeys'] },
  { view: 'advanced_offers', labelKey: 'ADVANCED_OFFERS', label: 'Advanced offers', aliases: ['ofertas avanzadas', 'cupones', 'promociones avanzadas'] }
]

const GIFT_CARD_TABS = [
  { status: 'pending', labelKey: 'ORDER_PENDING', label: 'Pending', aliases: ['tarjetas de regalo pendientes'] },
  { status: 'activated', labelKey: 'REDEEMED', label: 'Redeemed', aliases: ['tarjetas de regalo canjeadas', 'redimidas'] }
]

const INACTIVE_USER_LISTS = [
  { url: '/users/customers', labelKey: 'CUSTOMERS', label: 'Customers', aliases: ['clientes inactivos', 'clientes desactivados'] },
  { url: '/users/business-owners', labelKey: 'BUSINESS_OWNERS', label: 'Business Owners', aliases: ['duenos inactivos'] },
  { url: '/users/callcenter-agents', labelKey: 'CALL_CENTER_AGENTS', label: 'Call Center Agents', aliases: ['agentes inactivos'] },
  { url: '/users/admins', labelKey: 'ADMINS', label: 'Admins', aliases: ['administradores inactivos'] },
  { url: '/users/professionals', labelKey: 'PROFESSIONALS', label: 'Professionals', aliases: ['profesionales inactivos'] }
]

const ECOMMERCE_REPORTS = [
  { id: 1, labelKey: 'USERS', label: 'Users', aliases: ['reporte de usuarios'] },
  { id: 2, labelKey: 'DISCOUNT_DASHBOARD', label: 'Discount dashboard', aliases: ['descuentos', 'reporte de descuentos'] },
  { id: 3, labelKey: 'DASHBOARD_WITH_STORE_MAP', label: 'Dashboard with store map', aliases: ['mapa de tiendas'] },
  { id: 4, labelKey: 'REAL_TIME', label: 'Real time', aliases: ['tiempo real', 'en vivo'] }
]

const LANGUAGE_PRODUCT_TYPES = [
  { value: 'website', labelKey: 'TYPE_WEBSITE', label: 'Website' },
  { value: 'ordering_app', labelKey: 'TYPE_ORDERING_APP', label: 'Ordering App' },
  { value: 'dashboard', labelKey: 'TYPE_DASHBOARD', label: 'Dashboard' },
  { value: 'franchise_app', labelKey: 'TYPE_FRANCHISE_APP', label: 'Franchise App' },
  { value: 'franchise_web', labelKey: 'TYPE_FRANCHISE_WEB', label: 'Franchise Web' },
  { value: 'api', labelKey: 'TYPE_API', label: 'API' },
  { value: 'business_app', labelKey: 'TYPE_BUSINESS_APP', label: 'Business App' },
  { value: 'driver_app', labelKey: 'TYPE_DRIVER_APP', label: 'Driver App' },
  { value: 'kiosk_app', labelKey: 'TYPE_KIOSK_APP', label: 'Kiosk App' }
]

const withQuery = (path, params) => `${path}?${new URLSearchParams(params).toString()}`

/**
 * `can(url)`: the user sees and can open that page (sidebar rule + guard).
 */
export const buildPageActionEntries = ({ t = (_key, fallback) => fallback, can = () => false, user } = {}) => {
  const level = user?.level
  const isReadOnly = !!(user?.readOnlyAdmin || user?.readOnlyDeliveryManager || user?.readOnlyBusinessOwner || user?.viewOnlyBusinessOwner)
  const entries = []
  const add = (entry) => entries.push({ group: 'actions', ...entry })

  STATUS_PAGES.filter(page => can(page.url)).forEach(page => {
    const pageLabel = t(page.labelKey, page.label)
    STATUS_TABS.forEach(tab => add({
      id: `action:status-${page.url.slice(1)}-${tab.status}`,
      title: `${pageLabel} › ${t(tab.labelKey, tab.label)}`,
      path: withQuery(page.url, { status: tab.status }),
      aliases: [...page.aliases, ...tab.aliases],
      icon: 'delivery',
      boost: -1
    }))
  })

  if (can('/intelligence/invoice')) {
    INVOICE_TABS.forEach(tab => add({
      id: `action:invoice-${tab.invoice}-${tab.tab}`,
      title: `${t(tab.parentKey, tab.parent)} › ${t(tab.labelKey, tab.label)}`,
      subtitle: t('INVOICE_MANAGER', 'Invoice manager'),
      path: withQuery('/intelligence/invoice', { invoice: tab.invoice, tab: tab.tab }),
      aliases: [...tab.aliases, 'facturas', 'invoices'],
      icon: 'intelligence'
    }))
  }

  if (can('/intelligence/reviews')) {
    add({
      id: 'action:reviews-professionals',
      title: t('COMMAND_PALETTE_REVIEWS_PROFESSIONALS', 'Professional reviews'),
      subtitle: t('REVIEWS_MANAGER', 'Reviews manager'),
      path: withQuery('/intelligence/reviews', { tab: 'professionals' }),
      aliases: ['resenas de profesionales', 'reviews', 'resenas'],
      icon: 'intelligence'
    })
  }

  if (can('/marketing/promotions-enterprise')) {
    PROMOTION_VIEWS.forEach(view => add({
      id: `action:promotions-${view.view}`,
      title: t(view.labelKey, view.label),
      subtitle: t('MARKETING', 'Marketing'),
      path: withQuery('/marketing/promotions-enterprise', { view: view.view }),
      aliases: [...view.aliases, 'promociones', 'ofertas', 'promotions'],
      icon: 'marketing'
    }))
  }

  if (can('/gift-cards')) {
    const giftCardsLabel = t('GIFT_CARD_MANAGER', 'Gift card manager')
    GIFT_CARD_TABS.forEach(tab => add({
      id: `action:gift-cards-${tab.status}`,
      title: `${giftCardsLabel} › ${t(tab.labelKey, tab.label)}`,
      path: withQuery('/gift-cards', { status: tab.status }),
      aliases: [...tab.aliases, 'tarjetas de regalo', 'gift cards'],
      icon: 'orders'
    }))
  }

  const inactiveLabel = t('INACTIVE', 'Inactive')
  INACTIVE_USER_LISTS.filter(list => can(list.url)).forEach(list => add({
    id: `action:inactive-${list.url.split('/').pop()}`,
    title: `${t(list.labelKey, list.label)} › ${inactiveLabel}`,
    subtitle: t('USERS', 'Users'),
    path: withQuery(list.url, { enabled: 'inactive' }),
    aliases: [...list.aliases, 'inactivos', 'desactivados', 'inactive'],
    icon: 'users'
  }))

  // Ecommerce reports has no sidebar item: same rule as the other admin reports
  if (can('/intelligence/reports') && canOpenDashboardRoute('/intelligence/ecommerce_reports', level) && !isReadOnly) {
    const ecommerceLabel = t('COMMAND_PALETTE_ECOMMERCE_REPORTS', 'Ecommerce reports')
    add({
      id: 'action:ecommerce-reports',
      title: ecommerceLabel,
      subtitle: t('REPORTS', 'Reports'),
      path: '/intelligence/ecommerce_reports',
      aliases: ['reportes de ecommerce', 'ecommerce', 'reportes'],
      icon: 'intelligence'
    })
    ECOMMERCE_REPORTS.forEach(report => add({
      id: `action:ecommerce-report-${report.id}`,
      title: t(report.labelKey, report.label),
      subtitle: ecommerceLabel,
      path: withQuery('/intelligence/ecommerce_reports', { id: report.id }),
      aliases: [...report.aliases, 'reporte', 'ecommerce'],
      icon: 'intelligence',
      boost: -1
    }))
  }

  if (level === 0 && !isReadOnly && canOpenDashboardRoute(SETTINGS_HUB_PATH, level)) {
    const translationsLabel = `${t('SETTINGS', 'Settings')} › ${t('TRANSLATIONS', 'Translations')}`
    LANGUAGE_PRODUCT_TYPES.forEach(type => add({
      id: `action:translations-${type.value}`,
      title: `${t('TRANSLATIONS', 'Translations')} › ${t(type.labelKey, type.label)}`,
      subtitle: translationsLabel,
      path: withQuery(SETTINGS_HUB_PATH, { group: 'languages', category: 'language_manager', product_type: type.value }),
      aliases: ['traducciones', 'textos', 'idioma', 'translations'],
      icon: 'settings',
      // The translations screen reads product_type on mount only
      remount: true,
      boost: -1
    }))
  }

  return entries
}
