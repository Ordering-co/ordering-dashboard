import { canOpenDashboardRoute, getDashboardNavSections, getDashboardRoleFlags } from './dashboardNavigation'
import { BUSINESS_PALETTE_SECTIONS, getPaletteBusinessSections } from './businessDetailSections'
import { buildSettingsPath } from './settingsRedirects'
import { buildPageActionEntries } from './commandPalettePageActions'
import { buildCreateActionEntries } from './commandPaletteCreateActions'

/**
 * "Open" actions of the command palette. Pure, no React.
 *
 * Panels, tabs and modals that the dashboard already opens from its URL
 * (inventory in docs/COMMAND_PALETTE.md). Each action is gated by the
 * destination page the user can open. Actions that need a store first carry
 * `requires: 'business'`: the palette asks for the store before navigating,
 * so it never opens an incomplete form. No action creates or edits anything.
 */

const ORDER_STATUS_ACTIONS = [
  { status: 'pending', labelKey: 'COMMAND_PALETTE_ORDERS_PENDING', label: 'Pending orders', aliases: ['ordenes pendientes', 'pedidos pendientes', 'nuevas', 'pending'] },
  { status: 'inProgress', labelKey: 'COMMAND_PALETTE_ORDERS_IN_PROGRESS', label: 'Orders in progress', aliases: ['ordenes en curso', 'en progreso', 'en preparacion', 'activas'] },
  { status: 'completed', labelKey: 'COMMAND_PALETTE_ORDERS_COMPLETED', label: 'Completed orders', aliases: ['ordenes completadas', 'entregadas', 'finalizadas'] },
  { status: 'cancelled', labelKey: 'COMMAND_PALETTE_ORDERS_CANCELLED', label: 'Cancelled orders', aliases: ['ordenes canceladas', 'rechazadas', 'canceled'] }
]

const DEVELOPER_PANELS = [
  { id: 'apiKeys', labelKey: 'KEYS', label: 'Api Keys', aliases: ['claves api', 'api keys', 'llaves', 'tokens', 'api'] },
  { id: 'webhooks', labelKey: 'WEBHOOKS', label: 'Webhooks', aliases: ['webhooks globales', 'eventos', 'notificaciones http'] },
  { id: 'plugins', labelKey: 'PLUGINS', label: 'Plugins', aliases: ['plugins', 'extensiones', 'complementos'] },
  { id: 'mcpTokens', labelKey: 'MCP_TITLE', label: 'MCP (Claude Code & Codex)', aliases: ['mcp', 'claude', 'codex', 'ia', 'ai', 'claves mcp'] }
]

const AD_BANNER_POSITIONS = [
  { key: 'web_home_page', labelKey: 'WEB_HOME', label: 'Web home', aliases: ['banner inicio web', 'home banner'] },
  { key: 'web_business_listing', labelKey: 'WEB_BUSINESS_LISTING', label: 'Web business listing', aliases: ['banner listado web'] },
  { key: 'web_business_page', labelKey: 'WEB_BUSINESS_PAGE', label: 'Web business page', aliases: ['banner pagina de tienda web'] },
  { key: 'app_home_page', labelKey: 'APP_HOME_PAGE', label: 'App home page', aliases: ['banner inicio app'] },
  { key: 'app_business_listing', labelKey: 'APP_BUSINESS_LISTING', label: 'App business listing', aliases: ['banner listado app'] },
  { key: 'app_business_page', labelKey: 'APP_BUSINESS_PAGE', label: 'App business page', aliases: ['banner pagina de tienda app'] }
]

const ADVANCED_REPORTS = [
  { id: 1, labelKey: 'DISTANCE', label: 'Distance', aliases: ['distancia'] },
  { id: 2, labelKey: 'DISTANCE_STORE_CUSTOMER', label: 'Distance in KM from the store to customer', aliases: ['distancia tienda cliente'] },
  { id: 3, labelKey: 'DISTANCE_STORE_CUSTOMER_RANGE_KM', label: 'Distance in KM from the store to customer (Range KM)', aliases: ['rango km'] },
  { id: 4, labelKey: 'SERVICE_TIMES', label: 'Service Times', aliases: ['tiempos de servicio'] },
  { id: 5, labelKey: 'DETAIL_COMPLETED_ORDERS', label: 'Detail of the completed orders of each delivery agency', aliases: ['ordenes completadas por agencia'] },
  { id: 6, labelKey: 'NUMBER_ORDERS_SPECIFIC_RANGE', label: 'Number of orders within a specific range', aliases: ['cantidad de ordenes por rango'] },
  { id: 7, labelKey: 'DRIVER_SCHEDULE', label: 'Driver schedule', aliases: ['horario de repartidores'] },
  { id: 8, labelKey: 'ORDER_STATUS_TEXT', label: 'Order status', aliases: ['estado de ordenes'] },
  { id: 9, labelKey: 'HEAT_MAP_WITH', label: 'Heat map with', aliases: ['mapa de calor', 'heatmap'] },
  { id: 10, labelKey: 'DRIVER_DISTANCE', label: 'Driver distance', aliases: ['distancia de repartidores'] },
  { id: 11, labelKey: 'DRIVER_TIME', label: 'Driver Time', aliases: ['tiempo de repartidores'] },
  { id: 12, labelKey: 'TOP_DRIVERS', label: 'Top drivers', aliases: ['mejores repartidores'] },
  { id: 13, labelKey: 'ORDERS', label: 'Orders', aliases: ['reporte de ordenes', 'orders report'] },
  { id: 14, labelKey: 'SALES', label: 'Sales', aliases: ['ventas', 'reporte de ventas', 'sales report'] },
  { id: 15, labelKey: 'REGISTER_USERS', label: 'Register users', aliases: ['usuarios registrados', 'registros'] },
  { id: 16, labelKey: 'CUSTOMER_SATISFACTION', label: 'Customer safisfaction', aliases: ['satisfaccion', 'customer satisfaction'] },
  { id: 17, labelKey: 'PAYMETHOD_SALES', label: 'Paymethod sales', aliases: ['ventas por metodo de pago'] },
  { id: 18, labelKey: 'AVERAGE_SALES', label: 'Average sales', aliases: ['ticket promedio', 'ventas promedio'] },
  { id: 19, labelKey: 'GENERAL_SALES', label: 'General sales', aliases: ['ventas generales'] },
  { id: 20, labelKey: 'TOP_SELLING_AND_CATEOGRY', label: 'Top selling and category', aliases: ['mas vendidos', 'top productos', 'best sellers'] },
  { id: 21, labelKey: 'SLA_ORDERS', label: 'SLA orders', aliases: ['sla', 'ordenes sla'] }
]

const INVOICE_TYPES = [
  { key: 'business', labelKey: 'COMMAND_PALETTE_INVOICE_BUSINESS', label: 'Store invoices', aliases: ['facturas de tiendas', 'facturas de negocios'] },
  { key: 'driver', labelKey: 'COMMAND_PALETTE_INVOICE_DRIVER', label: 'Driver invoices', aliases: ['facturas de repartidores'] }
]

const REVIEW_TABS = [
  { key: 'business', labelKey: 'COMMAND_PALETTE_REVIEWS_BUSINESS', label: 'Store reviews', aliases: ['resenas de tiendas', 'opiniones de negocios'] },
  { key: 'drivers', labelKey: 'COMMAND_PALETTE_REVIEWS_DRIVERS', label: 'Driver reviews', aliases: ['resenas de repartidores'] },
  { key: 'customers', labelKey: 'COMMAND_PALETTE_REVIEWS_CUSTOMERS', label: 'Customer reviews', aliases: ['resenas de clientes'] },
  { key: 'products', labelKey: 'COMMAND_PALETTE_REVIEWS_PRODUCTS', label: 'Product reviews', aliases: ['resenas de productos'] }
]

const isOn = (config) => config?.value === true || config?.value === 1 || config?.value === '1'

/** Same rule as the Add store button (BusinessesListing `allowBusinessRegister`) */
const canRegisterStores = ({ user, configs }) =>
  !configs?.allow_business_owner_register_business || user?.level !== 2 || isOn(configs.allow_business_owner_register_business)

const STORES_LIST_ACTIONS = [
  { key: 'inactive', labelKey: 'COMMAND_PALETTE_INACTIVE_STORES', label: 'Inactive stores', path: '/stores/list?active=false', aliases: ['tiendas inactivas', 'negocios desactivados', 'disabled stores'] },
  { key: 'importers', labelKey: 'IMPORTERS', label: 'Importers', path: '/stores/list?header=importers', aliases: ['importar csv', 'importar tiendas', 'importar productos', 'csv'] },
  { key: 'sync-deliverect', labelKey: 'COMMAND_PALETTE_SYNC_DELIVERECT', label: 'Sync with Deliverect', path: '/stores/list?header=sync&tab=deliverect', aliases: ['deliverect', 'sincronizar', 'sync'] },
  { key: 'sync-itsacheckmate', labelKey: 'COMMAND_PALETTE_SYNC_ITSACHECKMATE', label: 'Sync with ItsaCheckmate', path: '/stores/list?header=sync&tab=itsacheckmate', aliases: ['itsacheckmate', 'checkmate', 'sincronizar', 'sync'] },
  { key: 'add', labelKey: 'ADD_NEW_STORE', label: 'Add new store', path: '/stores/add', aliases: ['crear tienda', 'nueva tienda', 'agregar negocio', 'create store'], when: canRegisterStores }
]

const findNavItem = (sections, url) => {
  for (const section of Object.values(sections)) {
    const item = section.items.find(menu => menu.url === url)
    if (item) return { section, item }
  }
  return null
}

export const canOpenNavDestination = ({ sections, url, level }) => {
  const found = findNavItem(sections, url)
  return !!found && found.section.visible && !!found.item.enabled && canOpenDashboardRoute(url, level)
}

const withQuery = (path, params) => `${path}?${new URLSearchParams(params).toString()}`

/**
 * Every open action the user can reach. `requires: 'business'` actions carry
 * `section` and are completed with `buildBusinessDetailPath`.
 */
export const buildOpenActionEntries = ({ t = (_key, fallback) => fallback, user, configs = {}, project } = {}) => {
  const { level, isReadOnly } = getDashboardRoleFlags(user)
  const sections = getDashboardNavSections({ t, user, configs, project })
  const can = (url) => canOpenNavDestination({ sections, url, level })
  const entries = []
  const add = (entry) => entries.push({ group: 'actions', ...entry })

  if (can('/orders')) {
    const ordersLabel = t('ORDERS', 'Orders')
    ORDER_STATUS_ACTIONS.forEach(action => add({
      id: `action:orders-${action.status}`,
      title: t(action.labelKey, action.label),
      subtitle: ordersLabel,
      path: withQuery('/orders', { status: action.status }),
      aliases: action.aliases,
      icon: 'orders'
    }))
  }

  if (can('/stores/list')) {
    const storeLabel = t('STORE', 'Store')
    const storesLabel = t('STORES', 'Stores')
    const sectionLabels = Object.fromEntries(BUSINESS_PALETTE_SECTIONS
      .filter(section => !section.tab)
      .map(section => [section.key, t(section.labelKey, section.label)]))
    getPaletteBusinessSections({ user, configs, project })
      .filter(section => !section.navUrl || can(section.navUrl))
      .forEach(section => {
        const label = t(section.labelKey, section.label)
        add({
          id: `action:business-${section.key}`,
          title: section.tab ? `${sectionLabels[section.section]} › ${label}` : label,
          subtitle: `${storeLabel} · ${t('COMMAND_PALETTE_CHOOSE_STORE_HINT', 'Choose a store')}`,
          aliases: section.aliases,
          keywords: ['tienda', 'negocio', 'store', 'business'],
          icon: 'stores',
          requires: 'business',
          section: section.detailOnly || section.target ? undefined : (section.section || section.key),
          tab: section.tab,
          target: section.target
        })
      })

    STORES_LIST_ACTIONS
      .filter(action => !action.when || action.when({ user, configs }))
      .forEach(action => add({
        id: `action:stores-${action.key}`,
        title: t(action.labelKey, action.label),
        subtitle: storesLabel,
        path: action.path,
        aliases: action.aliases,
        icon: 'stores'
      }))
  }

  if (level === 0 && !isReadOnly && canOpenDashboardRoute('/settings', level)) {
    const developersLabel = `${t('SETTINGS', 'Settings')} › ${t('API_AND_INTEGRATIONS', 'API & integrations')}`
    DEVELOPER_PANELS.forEach(panel => add({
      id: `action:settings-${panel.id}`,
      title: t(panel.labelKey, panel.label),
      subtitle: developersLabel,
      path: buildSettingsPath({ group: 'developers', category: 'developers', id: panel.id }),
      aliases: panel.aliases,
      icon: 'settings'
    }))
  }

  if (can('/marketing/ad-banners')) {
    const bannersLabel = t('AD_BANNERS', 'Ad banners')
    AD_BANNER_POSITIONS.forEach(position => add({
      id: `action:banner-${position.key}`,
      title: t(position.labelKey, position.label),
      subtitle: bannersLabel,
      path: withQuery('/marketing/ad-banners', { position: position.key }),
      aliases: [...position.aliases, 'banner', 'banners', 'anuncio'],
      icon: 'marketing'
    }))
  }

  if (can('/intelligence/reports')) {
    const reportsLabel = t('ENTERPRISE_REPORTS', 'Enterprise reports')
    ADVANCED_REPORTS.forEach(report => add({
      id: `action:report-${report.id}`,
      title: t(report.labelKey, report.label),
      subtitle: reportsLabel,
      path: withQuery('/intelligence/reports', { id: report.id }),
      aliases: [...report.aliases, 'reporte', 'informe', 'report'],
      icon: 'intelligence',
      boost: -1
    }))
  }

  if (can('/intelligence/invoice')) {
    const invoiceLabel = t('INVOICE_MANAGER', 'Invoice manager')
    INVOICE_TYPES.forEach(invoice => add({
      id: `action:invoice-${invoice.key}`,
      title: t(invoice.labelKey, invoice.label),
      subtitle: invoiceLabel,
      path: withQuery('/intelligence/invoice', { invoice: invoice.key }),
      aliases: [...invoice.aliases, 'facturas', 'invoices'],
      icon: 'intelligence'
    }))
  }

  if (can('/intelligence/reviews')) {
    const reviewsLabel = t('REVIEWS_MANAGER', 'Reviews manager')
    REVIEW_TABS.forEach(tab => add({
      id: `action:reviews-${tab.key}`,
      title: t(tab.labelKey, tab.label),
      subtitle: reviewsLabel,
      path: withQuery('/intelligence/reviews', { tab: tab.key }),
      aliases: [...tab.aliases, 'resenas', 'reviews'],
      icon: 'intelligence'
    }))
  }

  buildPageActionEntries({ t, can, user, configs }).forEach(entry => entries.push(entry))
  buildCreateActionEntries({ t, can, user, configs }).forEach(entry => entries.push(entry))

  return entries
}
