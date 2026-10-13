import {
  canOpenDashboardRoute,
  getDashboardFooterLinks,
  getDashboardNavSections,
  getDashboardRoleFlags
} from './dashboardNavigation'
import {
  SETTINGS_GROUPS,
  SETTINGS_SEARCH_ALIASES,
  SETTINGS_SPECIAL_SCREENS,
  listVisibleSettingsTasks,
  findSettingsConfigLocation
} from './settingsIa'
import { getSettingsConfigCopy } from './settingsCustomSections'
import { buildSettingsPath } from './settingsRedirects'

/**
 * Command palette catalog. Pure, no React.
 *
 * Every entry maps to an explicit route (or route plus query) built from the
 * same sources the dashboard already uses: sidebar sections, route guards,
 * the Settings hub catalog and its focus links. Nothing is scraped from the
 * DOM. Aliases are search terms in English and Spanish, not UI copy.
 *
 * Entry: `{ id, group, title, subtitle?, path, aliases?, keywords?, icon?, boost? }`
 */

export const COMMAND_GROUPS = {
  navigation: { key: 'navigation', labelKey: 'COMMAND_PALETTE_GROUP_NAVIGATION', label: 'Navigation' },
  settings: { key: 'settings', labelKey: 'COMMAND_PALETTE_GROUP_SETTINGS', label: 'Settings' },
  actions: { key: 'actions', labelKey: 'COMMAND_PALETTE_GROUP_ACTIONS', label: 'Open' },
  businesses: { key: 'businesses', labelKey: 'COMMAND_PALETTE_GROUP_BUSINESSES', label: 'Stores' },
  orders: { key: 'orders', labelKey: 'COMMAND_PALETTE_GROUP_ORDERS', label: 'Orders' },
  users: { key: 'users', labelKey: 'COMMAND_PALETTE_GROUP_USERS', label: 'Users' },
  records: { key: 'records', labelKey: 'COMMAND_PALETTE_GROUP_RECORDS', label: 'Search in' },
  recent: { key: 'recent', labelKey: 'COMMAND_PALETTE_GROUP_RECENT', label: 'Recent' },
  suggestions: { key: 'suggestions', labelKey: 'COMMAND_PALETTE_GROUP_SUGGESTIONS', label: 'Suggestions' }
}

/** Search aliases per sidebar `pageName`. */
export const NAV_ALIASES = {
  home: ['inicio', 'home', 'dashboard', 'resumen', 'overview'],
  orders: ['ordenes', 'pedidos', 'orders', 'order list', 'lista de ordenes'],
  open_carts: ['carritos abiertos', 'carritos', 'abandoned carts', 'cart'],
  messages: ['mensajes', 'chat', 'inbox', 'conversaciones'],
  gift_cards: ['tarjetas de regalo', 'gift cards', 'giftcards'],
  appointments: ['citas', 'reservas', 'agenda', 'bookings', 'calendar'],
  deliveries: ['entregas', 'repartos', 'deliveries', 'envios'],
  drivers_dashboard: ['tablero de repartidores', 'mapa de repartidores', 'drivers map', 'conductores'],
  all_in_one: ['todo en uno', 'all in one', 'mapa'],
  delivery_drivers: ['repartidores', 'conductores', 'drivers', 'riders', 'mensajeros'],
  drivers_managers: ['gerentes de repartidores', 'administradores de repartidores', 'driver managers'],
  drivers_groups: ['grupos de repartidores', 'grupos de entrega', 'driver groups'],
  driver_store_status: ['estado de repartidores', 'estado tienda repartidor', 'driver status'],
  drivers_time_display: ['tiempos de repartidores', 'driver times'],
  drivers_companies: ['empresas de reparto', 'companias de entrega', 'delivery companies'],
  businesses: ['tiendas', 'negocios', 'comercios', 'restaurantes', 'stores', 'businesses', 'locales'],
  store: ['productos', 'menu', 'catalogo', 'products', 'items', 'categorias'],
  brand: ['marcas', 'brands', 'franquicias'],
  devices: ['dispositivos', 'devices', 'kiosko', 'tablets', 'pos'],
  markups: ['recargos', 'margenes', 'markups', 'sobreprecio'],
  // Provider names are the integrations each Connect page offers today
  connect_overview: ['connect', 'integraciones', 'conectar', 'integrations'],
  delivery_services: ['servicios de entrega', 'delivery services', 'doordash', 'doordash drive', 'uber direct', 'lalamove', 'picker express'],
  pos_menu: ['pos', 'sincronizar menu', 'menu sync', 'punto de venta', 'deliverect', 'itsacheckmate', 'checkmate'],
  importers: ['importadores', 'importar', 'import', 'importar menu', 'doordash', 'uber eats', 'ubereats', 'gloriafood', 'ordering.co'],
  sales_channels: ['canales de venta', 'sales channels', 'marketplaces', 'doordash', 'uber eats', 'ubereats'],
  customers: ['clientes', 'usuarios', 'customers', 'users', 'compradores'],
  business_owners: ['duenos de negocio', 'propietarios', 'business owners', 'owners'],
  callcenter_agents: ['agentes', 'call center', 'centro de llamadas'],
  admins: ['administradores', 'admins', 'managers', 'equipo'],
  professionals: ['profesionales', 'professionals', 'staff', 'empleados'],
  enterprise_promotions: ['promociones', 'ofertas', 'cupones', 'descuentos', 'promotions', 'coupons', 'offers'],
  ad_banners: ['banners', 'anuncios', 'publicidad', 'ads'],
  recovery_actions: ['recuperacion de carritos', 'cart recovery', 'reglas'],
  campaign: ['campanas', 'campaigns', 'email marketing', 'notificaciones push', 'sms'],
  business_analytics: ['reportes de negocio', 'analiticas', 'estadisticas', 'analytics', 'ventas', 'sales'],
  invoice: ['facturas', 'invoices', 'facturacion'],
  drivers_analytics: ['reportes de entrega', 'delivery reports'],
  reviews: ['resenas', 'opiniones', 'calificaciones', 'reviews', 'ratings'],
  reports: ['reportes avanzados', 'informes', 'enterprise reports'],
  business_payment_reports: ['reportes de pagos', 'pagos a negocios', 'payouts', 'payment reports'],
  ordering_website: ['sitio web', 'pagina web', 'website', 'web'],
  ordering_website_2: ['sitio web 2', 'website 2'],
  dashboard: ['tema del dashboard', 'colores del dashboard', 'dashboard theme', 'apariencia'],
  franchises_website: ['sitio de franquicias', 'franchises'],
  schools: ['escuelas', 'colegios', 'schools'],
  builder: ['builder', 'constructor', 'mis apps', 'aplicaciones', 'apps moviles', 'app de repartidores', 'mobile apps'],
  logs: ['registros', 'auditoria', 'logs', 'historial de cambios', 'audit'],
  settings: ['configuracion', 'ajustes', 'settings', 'preferencias'],
  free_products: ['descargas gratis', 'free downloads', 'recursos'],
  open_source_code: ['codigo fuente', 'source code', 'open source code', 'download source code', 'descargar codigo fuente'],
  purchase_addons: ['apps', 'addons', 'complementos', 'tienda de apps', 'marketplace'],
  profile: ['perfil', 'mi cuenta', 'profile', 'account', 'contrasena']
}

/** Search aliases per Settings group key. */
export const SETTINGS_GROUP_ALIASES = {
  platform: ['plataforma', 'moneda', 'currency', 'formato', 'distancia', 'comisiones', 'terminos'],
  orders: ['ordenes', 'pedidos', 'checkout', 'pago final', 'tipos de orden', 'order types', 'programados'],
  payments: ['pagos', 'payments', 'metodos de pago', 'tarjetas', 'stripe', 'billetera', 'wallet', 'pasarela'],
  notifications: ['notificaciones', 'correos', 'emails', 'email', 'push', 'smtp', 'alertas', 'avisos'],
  languages: ['idiomas', 'traducciones', 'languages', 'translations', 'lenguaje'],
  locations: ['ubicaciones', 'paises', 'ciudades', 'mapas', 'google maps', 'countries', 'cities', 'mercados'],
  security: ['seguridad', 'login', 'inicio de sesion', 'captcha', 'contrasena', 'password', 'otp'],
  drivers: ['repartidores', 'conductores', 'drivers', 'asignacion', 'auto asignacion'],
  website: ['sitio web', 'paginas', 'website', 'pages', 'canales'],
  developers: ['desarrolladores', 'api', 'webhooks', 'plugins', 'integraciones', 'developers', 'mcp'],
  dashboard: ['dashboard', 'panel', 'soporte', 'widget'],
  more: ['otros', 'mas', 'more']
}

/** Search aliases per Settings section key (API category or special screen). */
export const SETTINGS_SECTION_ALIASES = {
  stripe: ['tarjetas', 'pagos con tarjeta', 'stripe'],
  pro_preorder: ['programar', 'preorden', 'pedidos programados', 'scheduled'],
  email_configs: ['correos', 'alertas por correo', 'emails'],
  notification: ['notificaciones push', 'push', 'onesignal', 'firebase'],
  pro_white_labeling: ['remitente', 'smtp', 'correo saliente', 'email sender'],
  pro_payments: ['apple pay', 'google pay', 'billeteras'],
  basic_order_types: ['tipos de orden', 'delivery', 'pickup', 'recoger', 'para llevar'],
  basic_maps: ['mapas', 'google maps', 'maps'],
  google_maps: ['mapas', 'google maps', 'api key de mapas'],
  enterprise_orders_slas: ['sla', 'tiempos limite', 'deadlines'],
  addon_points_and_levels: ['puntos', 'lealtad', 'loyalty', 'niveles', 'recompensas'],
  addon_cash_wallet_and_refunds: ['billetera', 'reembolsos', 'wallet', 'refunds'],
  addon_gift_cards: ['tarjetas de regalo', 'gift cards'],
  addon_catering: ['catering', 'eventos'],
  store_reservation: ['reservas', 'reservaciones', 'reservations'],
  user_information: ['campos del checkout', 'formulario', 'checkout fields'],
  checkout_fields: ['invitado', 'guest checkout', 'campos invitado'],
  language_manager: ['traducciones', 'textos', 'translations'],
  languages: ['idiomas disponibles', 'languages'],
  developers: ['api', 'webhooks', 'api keys', 'claves api', 'plugins', 'integraciones', 'mcp'],
  api_usage: ['limites de api', 'uso de api', 'rate limit', '429'],
  places: ['paises', 'ciudades', 'countries', 'cities'],
  multi_country: ['multipais', 'multi pais', 'multi country'],
  sites: ['canales de venta', 'sitios', 'sales channels'],
  pages: ['paginas', 'paginas web', 'cms', 'pages'],
  custom_order: ['ordenes personalizadas', 'custom orders'],
  // Integration categories: search by provider name
  pro_integrations: ['analiticas', 'tracking', 'pixel', 'google analytics', 'facebook pixel', 'intercom'],
  google_analytics: ['google analytics', 'ga4', 'analiticas'],
  facebook_pixel: ['facebook pixel', 'meta pixel', 'pixel'],
  intercom: ['intercom', 'chat de soporte'],
  enterprise_integrations: ['integraciones', 'segment', 'spoonity'],
  segment: ['segment'],
  spoonity: ['spoonity', 'lealtad'],
  twilio: ['twilio', 'sms', 'otp', 'codigo por sms'],
  apple_login: ['apple', 'sign in with apple', 'login con apple'],
  facebook: ['facebook', 'login con facebook'],
  google: ['google', 'login con google', 'google sign in'],
  addon_stripe_connect: ['stripe connect', 'pagos a negocios', 'split payments'],
  global_apple_pay: ['apple pay'],
  global_google_pay: ['google pay'],
  addon_delivery_companies: ['empresas de reparto', 'delivery companies']
}

const defaultT = (_key, fallback) => fallback

const translateCopy = (t, copy = {}, fallback = '') => t(copy.labelKey, copy.label || fallback)

/**
 * Sidebar destinations and footer routes the user can open.
 */
export const buildNavigationEntries = ({ t = defaultT, user, configs = {}, project } = {}) => {
  const { level } = getDashboardRoleFlags(user)
  const sections = getDashboardNavSections({ t, user, configs, project })
  const entries = []

  Object.values(sections).forEach(section => {
    if (!section.visible) return
    section.items.forEach(item => {
      if (!item.enabled) return
      if (item.pageName !== 'home' && !canOpenDashboardRoute(item.url, level)) return
      entries.push({
        id: `nav:${item.pageName}`,
        group: COMMAND_GROUPS.navigation.key,
        title: item.title,
        subtitle: section.title !== item.title ? section.title : undefined,
        path: item.url,
        aliases: NAV_ALIASES[item.pageName] || [],
        icon: section.key,
        pageName: item.pageName
      })
    })
  })

  getDashboardFooterLinks({ t, user }).forEach(item => {
    if (!item.enabled || !canOpenDashboardRoute(item.url, level)) return
    entries.push({
      id: `nav:${item.pageName}`,
      group: COMMAND_GROUPS.navigation.key,
      title: item.title,
      path: item.url,
      aliases: NAV_ALIASES[item.pageName] || [],
      icon: item.pageName,
      pageName: item.pageName
    })
  })

  return entries
}

export const canOpenSettings = (user) => {
  const { level, isReadOnly } = getDashboardRoleFlags(user)
  return level === 0 && !isReadOnly && canOpenDashboardRoute('/settings', level)
}

const getGroupLabel = (t, group) => t(group.labelKey, group.label)

/**
 * Settings groups and special screens. Always available (no request): they
 * exist in every project. Used while the hub catalog loads or if it fails.
 */
export const buildStaticSettingsEntries = ({ t = defaultT } = {}) => {
  const settingsLabel = t('SETTINGS', 'Settings')
  const groups = SETTINGS_GROUPS.filter(group => group.key !== 'more')
  const groupLabels = Object.fromEntries(groups.map(group => [group.key, getGroupLabel(t, group)]))
  return [
    ...groups.map(group => ({
      id: `settings-group:${group.key}`,
      group: COMMAND_GROUPS.settings.key,
      title: groupLabels[group.key],
      subtitle: settingsLabel,
      path: buildSettingsPath({ group: group.key }),
      aliases: SETTINGS_GROUP_ALIASES[group.key] || [],
      keywords: [t(group.descriptionKey, group.description)],
      icon: 'settings',
      boost: 1
    })),
    ...SETTINGS_SPECIAL_SCREENS.map(screen => ({
      id: `settings-section:${screen.key}`,
      group: COMMAND_GROUPS.settings.key,
      title: t(screen.labelKey, screen.label),
      subtitle: `${settingsLabel} › ${groupLabels[screen.group] || ''}`,
      path: buildSettingsPath({ group: screen.group, category: screen.key }),
      aliases: SETTINGS_SECTION_ALIASES[screen.key] || [],
      icon: 'settings'
    }))
  ]
}

/**
 * Sections, fields and suggested tasks of a built hub (`buildSettingsHub`).
 * A field opens the canonical hub editor with `?focus=` on that field.
 */
export const buildSettingsHubEntries = ({ t = defaultT, hub = [] } = {}) => {
  const groups = Array.isArray(hub) ? hub : []
  const settingsLabel = t('SETTINGS', 'Settings')
  const entries = []
  groups.forEach(group => {
    const groupLabel = getGroupLabel(t, group)
    ;(group.sections || []).forEach(section => {
      const sectionLabel = translateCopy(t, section.copy, section.category?.name || section.key)
      entries.push({
        id: `settings-section:${section.key}`,
        group: COMMAND_GROUPS.settings.key,
        title: sectionLabel,
        subtitle: `${settingsLabel} › ${groupLabel}`,
        path: buildSettingsPath({ group: group.key, category: section.key }),
        aliases: [...(SETTINGS_SECTION_ALIASES[section.key] || []), section.category?.name].filter(Boolean),
        keywords: [section.key],
        icon: 'settings'
      })
      ;(section.category?.configs || []).forEach(config => {
        if (!config?.key) return
        const copy = getSettingsConfigCopy(config)
        const label = copy ? t(copy.labelKey, copy.label) : (config.name || config.key)
        entries.push({
          id: `settings-field:${config.key}`,
          parent_id: `settings-section:${section.key}`,
          group: COMMAND_GROUPS.settings.key,
          title: label,
          subtitle: `${groupLabel} › ${sectionLabel}`,
          path: buildSettingsPath({ group: group.key, category: section.key, focus: config.key }),
          aliases: [...(SETTINGS_SEARCH_ALIASES[config.key] || []), config.name].filter(Boolean),
          keywords: [config.key, config.description].filter(Boolean),
          icon: 'field',
          boost: -1
        })
      })
    })
  })

  listVisibleSettingsTasks(groups).forEach(task => {
    const location = findSettingsConfigLocation(groups, task.configKey)
    if (!location) return
    entries.push({
      id: `settings-task:${task.key}`,
      parent_id: `settings-section:${location.sectionKey}`,
      group: COMMAND_GROUPS.settings.key,
      title: t(task.labelKey, task.label),
      subtitle: settingsLabel,
      path: buildSettingsPath({ group: location.groupKey, category: location.sectionKey, focus: task.configKey }),
      aliases: SETTINGS_SEARCH_ALIASES[task.configKey] || [],
      icon: 'settings',
      boost: 1
    })
  })

  return entries
}
