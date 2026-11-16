import settings from '~/config'
import { PAYMENT_PLUGIN_CATALOG } from './paymentPluginCatalog'

/**
 * Business detail menu rules (`/stores/list?id=&section=`). Pure, no React.
 *
 * Shared by BusinessSummary (the side menu) and the command palette, so a
 * section is only offered where the menu shows it.
 */

export const SELECTED_ACCESS_SECTION_KEYS = ['delivery_pickup_more', 'payment_methods']

export const isSelectedAccessUser = (user) => user?.level !== 0 && user?.selected_access === true

/**
 * Same result as `isEnabled(key)` in BusinessSummary.
 */
export const isBusinessSectionEnabled = (key, {
  isAdmin = false,
  isSelectedAccessRole = false,
  configs = {},
  hasSpoonity = false
} = {}) => {
  if (isSelectedAccessRole) return SELECTED_ACCESS_SECTION_KEYS.includes(key)
  if (configs?.white_label_module?.value) return !['personalization', 'sales_channels'].includes(key)
  if (isAdmin) return true
  const itemsExcluded = hasSpoonity
    ? ['publishing', 'personalization', 'markups']
    : ['publishing', 'spoonity_key', 'personalization', 'markups']
  return !itemsExcluded.includes(key)
}

// redesign stores 4.A (decisions 2 and 11): the one source of the store editor's sections. The menu
// (`Stores/BusinessDetails/storeSections.js`), the body (`StoreSectionBody` and the shell's deep link) and the palette read
// it, so a section is offered and opened by the same rules.
//
// Three rules:
// - the menu's level and role rules (`isSectionInRoleMenu`), as BusinessSummary had them in main;
// - plus whether the project or the store has the section on (`isStoreSectionInMenu`): the menu and the palette;
// - who may open it by address (`canAccessBusinessSection`, `canOpenStoreSection`): the level rules decision 11 names and,
//   since bug batch C, every role rule of the menu (the selected access role). A
//   `?section=` or `?tab=` outside them lands on the Overview with a notice. The config rules stay in the menu only: a
//   section the project or the store has off still opens by address, as in main.

/** A project config read as on/off: `'1'` or `true` is on; `'0'`, `false`, empty or missing is off. */
const isConfigOn = (config) => config?.value === '1' || config?.value === true || config?.value === 1
/** A project config turned off on purpose: `'0'`, `false` or `0` (not a missing or unset one). */
const isConfigOff = (config) => config?.value === '0' || config?.value === false || config?.value === 0

/** Sections only level 0 opens */
export const ADMIN_SECTION_KEYS = ['publishing', 'configs', 'markups', 'business_fees', 'white_label']
/**
 * Keys with no level or role rule: the menu gates them by config alone, and `places` stays reachable by URL as today
 * (decision 8; `places` comes back with lot 5.17). `support` and `personalization` were deleted (decision 8,
 * n.º 22); a link with one of them opens the Overview (`isStoreSectionKey`).
 */
const CONFIG_ONLY_SECTION_KEYS = ['reservations', 'spoonity_key', 'places']

/** Groups of the editor's navigation, in order (decision 2). Their titles are translated in `storeSections.js`. */
export const STORE_SECTION_GROUPS = ['store', 'orders', 'payments', 'channels', 'integrations']

/**
 * The editor's sections in navigation order, each with its group (decision 2). Same keys and labels as the flat list of
 * BusinessSummary; only the order changes (Notifications goes with orders, Custom fields with the store).
 */
export const STORE_SECTION_DEFS = [
  { key: 'overview', group: 'store', labelKey: 'STORE_OVERVIEW', label: 'Overview' },
  { key: 'store_details', group: 'store', labelKey: 'STORE_DETAILS', label: 'Store details' },
  { key: 'schedule', group: 'store', labelKey: 'SCHEDULE', label: 'Schedule' },
  { key: 'custom_fields', group: 'store', labelKey: 'CUSTOM_FIELDS', label: 'Custom fields' },
  { key: 'menu', group: 'orders', labelKey: 'MENU_V21', label: 'Menu' },
  { key: 'delivery_pickup_more', group: 'orders', labelKey: 'DELIVERY_PICKUP_MORE', label: 'Delivery, pickup & more' },
  { key: 'preorder', group: 'orders', labelKey: 'PREORDERS_SETTING', label: 'Preorders and lead times' },
  { key: 'reservations', group: 'orders', labelKey: 'RESERVATIONS', label: 'Reservations' },
  { key: 'notifications', group: 'orders', labelKey: 'NOTIFICATIONS', label: 'Notifications' },
  { key: 'places', group: 'orders', labelKey: 'PLACES', label: 'Places' },
  { key: 'payment_methods', group: 'payments', labelKey: 'PAYMENTS_METHODS', label: 'Payment methods' },
  { key: 'tax_fees', group: 'payments', labelKey: 'TAX_AND_FEES', label: 'Tax & fees' },
  { key: 'promotions', group: 'payments', labelKey: 'PROMOTIONS', label: 'Promotions' },
  { key: 'markups', group: 'payments', labelKey: 'MARKUPS', label: 'Markups' },
  { key: 'business_fees', group: 'payments', labelKey: 'BUSINESS_FEES_TITLE', label: 'Business fees' },
  { key: 'business_payment_account', group: 'payments', labelKey: 'BUSINESS_PAYMENT_ACCOUNT_TITLE', label: 'Business payment account' },
  { key: 'ordering_channels', group: 'channels', labelKey: 'ORDERING_CHANNELS', label: 'Ordering channels' },
  { key: 'publishing', group: 'channels', labelKey: 'QR_CODES', label: 'QR Codes' },
  { key: 'sales_channels', group: 'channels', labelKey: 'SALES_CHANNELS_TITLE', label: 'Sales channels' },
  { key: 'google_actions', group: 'channels', labelKey: 'ORDER_WITH_GOOGLE', label: 'Order with Google' },
  { key: 'layout', group: 'channels', labelKey: 'LAYOUT', label: 'Layout' },
  { key: 'white_label', group: 'channels', labelKey: 'WHITE_LABEL', label: 'White Label' },
  { key: 'webhooks', group: 'integrations', labelKey: 'WEBHOOKS', label: 'Webhooks' },
  { key: 'configs', group: 'integrations', labelKey: 'INTEGRATIONS_SETTINGS', label: 'Integrations settings' },
  { key: 'spoonity_key', group: 'integrations', labelKey: 'SPOONITY_KEY', label: 'Spoonity key' },
  { key: 'logs', group: 'integrations', labelKey: 'LOGS', label: 'Logs' }
]

/**
 * Whether the editor has the section: a key of `STORE_SECTION_DEFS`. Any other `?section=` opens the Overview. White
 * Label too while main hides it for every project (WHITE_LABEL_SITES_ENABLED): an old link is not this account's missing access.
 */
export const isStoreSectionKey = (key) => (key !== 'white_label' || WHITE_LABEL_SITES_ENABLED) && STORE_SECTION_DEFS.some(def => def.key === key)

/**
 * Who is looking, as the rules read it. `user` is the session user; `project` is `ordering.project`.
 */
export const getSectionAccess = ({ user, project } = {}) => ({
  isAdmin: user?.level === 0,
  level: user?.level,
  isSelectedAccessRole: isSelectedAccessUser(user),
  project
})

/**
 * Who may open the section by address (decision 11): level 0 for business fees, markups and the three sections the body
 * already kept for it (QR codes, integrations settings, white label); not the selected access role for the business
 * payment account. redesign bugs C: and, for every other key, the menu's role rules (`isSectionInRoleMenu`),
 * so a copied link opens what the menu gives that person and nothing else. No level gains or loses a menu entry.
 */
export const canAccessBusinessSection = (key, access = {}) => {
  const { isAdmin = false, isSelectedAccessRole = false } = access
  // main, while White Label sites are hidden, a link to the section does not open it either (main left its body empty)
  if (key === 'white_label' && !WHITE_LABEL_SITES_ENABLED) return false
  if (ADMIN_SECTION_KEYS.includes(key)) return isAdmin
  if (key === 'business_payment_account') return !isSelectedAccessRole
  return isSectionInRoleMenu(key, access)
}

/**
 * The menu's level and role rules: same result as `isEnabled` plus the role checks of BusinessSummary in main (except QR
 * Codes, see `isStoreSectionInMenu`). Config is not looked at.
 */
export const isSectionInRoleMenu = (key, { isAdmin = false, isSelectedAccessRole = false } = {}) => {
  if (key === 'overview') return true
  // Same order as the menu of main: these three never looked at the role
  if (key === 'business_fees' || key === 'white_label') return isAdmin
  if (key === 'business_payment_account') return !isSelectedAccessRole
  if (CONFIG_ONLY_SECTION_KEYS.includes(key)) return true
  if (isSelectedAccessRole) return SELECTED_ACCESS_SECTION_KEYS.includes(key)
  if (ADMIN_SECTION_KEYS.includes(key)) return isAdmin
  return true
}

/**
 * Tabs with their own rule inside a section (`?section=&tab=`), as the section's strip hides them (and the palette with
 * it). Any other tab follows its section.
 */
// main: the EatStreet owner restriction is gone, so agents, driver delivery group and custom slug follow their section.
export const canAccessBusinessSectionTab = (section, tab, { level } = {}) => {
  if (!tab) return true
  if (section === 'store_details' && tab === 'owner') return level !== 2
  return true
}

// tanda P: sections reachable by URL only (decision 8 of Stores; places waits for ). The menu never lists them,
// not even while one is open by its address.
export const URL_ONLY_SECTION_KEYS = ['places']

/**
 * Whether the editor's menu lists the section: who may open it, and whether the project or the store has it on. Same
 * result as the flat list of BusinessSummary in main, except QR Codes, which the body only ever drew for level 0 (it
 * used to show up for every level with `white_label_module` and open an empty body, G1-26).
 *
 * `menu`: `configs` (project configs map), `hasSpoonity` (the store has `spoonity_integration_api_key`) and
 * `hasBusinessConfigSections` (the store has integration settings) and `googleActionsVisible` (the project shows Order
 * with Google: `useGoogleActionsVisibility`, ).
 */
export const isStoreSectionInMenu = (key, access = {}, { configs = {}, hasSpoonity = false, hasBusinessConfigSections = false, googleActionsVisible = false } = {}) => {
  if (!isSectionInRoleMenu(key, access) || !canAccessBusinessSection(key, access)) return false
  switch (key) {
    // redesign bugs C: on/off. BusinessSummary read it as truthy, so a project with `'0'` still listed it
    case 'custom_fields': return isConfigOn(configs?.show_metafields)
    case 'sales_channels': return !configs?.white_label_module?.value
    case 'reservations': return configs?.reservation_enabled?.value === '1' && !!configs?.web_marketplace_26?.value
    case 'spoonity_key': return !!hasSpoonity
    case 'configs': return !!hasBusinessConfigSections
    // only while the project can activate stores on Google or still has some there
    case 'google_actions': return !!googleActionsVisible
    // main, White Label sites are hidden while WHITE_LABEL_SITES_ENABLED is false
    case 'white_label': return WHITE_LABEL_SITES_ENABLED && isWhiteLabelSiteConfigured(access.project, configs?.whitelabel_stores_sites)
    case 'places':
      return false
    default: return true
  }
}

/**
 * redesign bugs C (): whether the editor's «⋯» offers «Custom fields». Not to a role whose menu has no
 * Custom fields, and not on a project that turned `show_metafields` off (`'0'`, `false`). A project with no such config, or one
 * whose value is unset (null, empty), keeps the shortcut, as main had it (its menu entry needs the config on).
 */
export const isCustomFieldsShortcutOffered = (access = {}, configs = {}) =>
  canAccessBusinessSection('custom_fields', access) && !isConfigOff(configs?.show_metafields)

/** The tabs whose rule the deep link follows (decision 11). `custom_slug` is not one: its section already opens on Widgets. */
const DEEP_LINK_GUARDED_TABS = ['store_details:owner', 'store_details:agents', 'delivery_pickup_more:driver_delivery_group']

/**
 * Whether the deep link `?section=&tab=` opens for this person. The editor's shell asks it before it opens a section;
 * when it says no, it shows the Overview with a notice instead.
 */
export const canOpenStoreSection = ({ section, tab } = {}, access = {}) =>
  canAccessBusinessSection(section, access) &&
  (!DEEP_LINK_GUARDED_TABS.includes(`${section}:${tab}`) || canAccessBusinessSectionTab(section, tab, access))

/**
 * Per-store and per-brand White Label sites (`/business/{id}/sites/current`,
 * `/franchises/{id}/sites/current`) are hidden: the store section, the brand
 * tab and the palette entry. Set to true to show them again.
 */
export const WHITE_LABEL_SITES_ENABLED = false

/**
 * Sections the palette can open once a business is chosen. Each one needs a
 * business id; the palette asks for it before navigating. Sections that also
 * depend on the business record (Spoonity, integrations, reservations) are
 * left out: the menu decides those after the business loads.
 */
export const BUSINESS_PALETTE_SECTIONS = [
  { key: 'store_details', labelKey: 'STORE_DETAILS', label: 'Store details', aliases: ['editar negocio', 'datos del negocio', 'informacion', 'nombre', 'logo', 'direccion', 'edit store', 'store info'] },
  { key: 'schedule', labelKey: 'SCHEDULE', label: 'Schedule', aliases: ['horario', 'horarios', 'horas', 'apertura', 'cierre', 'opening hours', 'hours'] },
  { key: 'menu', labelKey: 'MENU_V21', label: 'Menu', aliases: ['menu', 'menus', 'carta'] },
  { key: 'delivery_pickup_more', labelKey: 'DELIVERY_PICKUP_MORE', label: 'Delivery, pickup & more', aliases: ['zonas de entrega', 'zona de reparto', 'delivery zones', 'recoger', 'pickup', 'envio', 'tiempo de entrega'] },
  { key: 'notifications', labelKey: 'NOTIFICATIONS', label: 'Notifications', aliases: ['notificaciones', 'avisos', 'alertas'] },
  { key: 'payment_methods', labelKey: 'PAYMENTS_METHODS', label: 'Payment methods', aliases: ['metodos de pago', 'pagos', 'formas de pago', 'paymethods', 'pasarela de pago', 'stripe', 'paypal', 'square', 'braintree', 'efectivo', 'cash', ...PAYMENT_PLUGIN_CATALOG.map(plugin => plugin.name)] },
  { key: 'tax_fees', labelKey: 'TAX_AND_FEES', label: 'Tax & fees', aliases: ['impuestos', 'tarifas', 'comisiones', 'iva', 'taxes', 'fees'] },
  { key: 'promotions', labelKey: 'PROMOTIONS', label: 'Promotions', aliases: ['promociones', 'ofertas', 'descuentos'] },
  { key: 'ordering_channels', labelKey: 'ORDERING_CHANNELS', label: 'Ordering channels', aliases: ['canales', 'slug', 'widgets', 'url de la tienda'] },
  { key: 'preorder', labelKey: 'PREORDERS_SETTING', label: 'Preorders and lead times', aliases: ['preordenes', 'anticipacion', 'lead time'] },
  { key: 'custom_fields', labelKey: 'CUSTOM_FIELDS', label: 'Custom fields', aliases: ['campos personalizados', 'metafields'] },
  { key: 'webhooks', labelKey: 'WEBHOOKS', label: 'Webhooks', aliases: ['webhooks', 'integraciones'] },
  { key: 'logs', labelKey: 'LOGS', label: 'Logs', aliases: ['registros', 'historial', 'auditoria'] },
  { key: 'publishing', labelKey: 'QR_CODES', label: 'QR Codes', aliases: ['codigos qr', 'qr', 'mesas'] },
  { key: 'business_fees', labelKey: 'BUSINESS_FEES_TITLE', label: 'Business fees', aliases: ['comisiones del negocio', 'cargos'] },
  { key: 'markups', labelKey: 'MARKUPS', label: 'Markups', aliases: ['recargos', 'margenes'] },
  // A button on the store detail, not a section: the palette opens the detail
  // and the person presses it (it starts the Clover sign-in on another site)
  { key: 'connect_clover', labelKey: 'CONNECT_CLOVER', label: 'Connect clover', aliases: ['clover', 'conectar clover', 'clover pos', 'sincronizar clover'], adminOnly: true, detailOnly: true },
  { key: 'sales_channels', labelKey: 'SALES_CHANNELS_TITLE', label: 'Sales channels', aliases: ['canales de venta', 'facebook', 'instagram', 'tiktok', 'google my business', 'redes sociales'] },
  // offered while the project shows Order with Google (`googleActionsVisible`)
  { key: 'google_actions', labelKey: 'ORDER_WITH_GOOGLE', label: 'Order with Google', aliases: ['pedir con google', 'activar en google', 'google actions', 'actions center', 'boton pedir en linea', 'order online'] },
  { key: 'layout', labelKey: 'LAYOUT', label: 'Layout', aliases: ['diseno', 'plantilla', 'vista', 'food', 'groceries'] },
  { key: 'business_payment_account', labelKey: 'BUSINESS_PAYMENT_ACCOUNT_TITLE', label: 'Business payment account', aliases: ['cuenta de pago', 'cuenta bancaria', 'payouts', 'stripe connect'] },
  { key: 'white_label', labelKey: 'WHITE_LABEL', label: 'White Label', aliases: ['marca blanca', 'sitio propio', 'white label'] },
  { key: 'reservations', labelKey: 'RESERVATIONS', label: 'Reservations', aliases: ['reservas', 'reservaciones', 'mesas'] },
  // Fixed tabs inside a section (`&tab=`): same gate as their section, plus the tab's own rule
  { key: 'store_details:owner', section: 'store_details', tab: 'owner', labelKey: 'OWNER_ID', label: 'Owner', aliases: ['dueno', 'propietario', 'owner'] },
  { key: 'store_details:categories', section: 'store_details', tab: 'categories', labelKey: 'CATEGORIES', label: 'Categories', aliases: ['categorias del negocio', 'tipo de negocio', 'business type'] },
  { key: 'store_details:location', section: 'store_details', tab: 'location', labelKey: 'LOCATION', label: 'Location', aliases: ['ubicacion', 'direccion', 'mapa', 'address'] },
  { key: 'store_details:agents', section: 'store_details', tab: 'agents', labelKey: 'AGENTS', label: 'Agents', aliases: ['agentes', 'call center'] },
  { key: 'store_details:images', section: 'store_details', tab: 'images', labelKey: 'IMAGES', label: 'Images', aliases: ['imagenes', 'fotos', 'galeria', 'logo', 'portada', 'header'] },
  { key: 'store_details:videos', section: 'store_details', tab: 'videos', labelKey: 'VIDEOS', label: 'Videos', aliases: ['videos'] },
  { key: 'store_details:seo_options', section: 'store_details', tab: 'seo_options', labelKey: 'SEO_OPTIONS', label: 'SEO Options', aliases: ['seo', 'meta', 'google'] },
  { key: 'menu:shared_menus', section: 'menu', tab: 'shared_menus', labelKey: 'SHARED_MENUS', label: 'Shared menus', aliases: ['menus compartidos', 'shared menus'] },
  { key: 'delivery_pickup_more:delivery', section: 'delivery_pickup_more', tab: 'delivery', labelKey: 'DELIVERY', label: 'Delivery', aliases: ['zonas de entrega', 'zona de reparto', 'delivery zones', 'costo de envio', 'radio'] },
  { key: 'delivery_pickup_more:pickup', section: 'delivery_pickup_more', tab: 'pickup', labelKey: 'PICKUP', label: 'Pickup', aliases: ['recoger', 'para llevar', 'retiro en tienda'] },
  { key: 'delivery_pickup_more:driver_delivery_group', section: 'delivery_pickup_more', tab: 'driver_delivery_group', labelKey: 'DRIVER_DELIVERY_GROUP', label: 'Driver Delivery Group', aliases: ['grupo de repartidores', 'driver group'] },
  { key: 'delivery_pickup_more:advanced_eta', section: 'delivery_pickup_more', tab: 'advanced_eta', labelKey: 'ADVANCED_ETA', label: 'Advanced ETA', aliases: ['tiempo estimado', 'eta', 'tiempo de entrega'] },
  { key: 'ordering_channels:custom_slug', section: 'ordering_channels', tab: 'custom_slug', labelKey: 'CUSTOM_SLUG', label: 'Custom slug', aliases: ['slug', 'url de la tienda', 'enlace'] },
  { key: 'ordering_channels:widgets', section: 'ordering_channels', tab: 'widgets', labelKey: 'WIDGETS', label: 'Widgets', aliases: ['widget', 'boton de pedido', 'embed'] },
  // Not on the detail: the store's products page (by slug) and its Connect panels
  { key: 'pos_menu', target: 'pos_menu', labelKey: 'CONNECT_POS_MENU', label: 'POS & Menu Sync', aliases: ['pos', 'sincronizar menu', 'menu sync', 'punto de venta', 'deliverect', 'itsacheckmate', 'checkmate'], navUrl: '/connect/pos-menu' },
  { key: 'store_sales_channels', target: 'sales_channels', labelKey: 'CONNECT_SALES_CHANNELS', label: 'Sales Channels', aliases: ['canales de venta', 'integraciones de venta', 'marketplaces'], navUrl: '/connect/sales-channels' },
  { key: 'business_payments', target: 'business_payments', labelKey: 'PAYMENT_REPORTS', label: 'Payment reports', aliases: ['reportes de pagos', 'pagos a la tienda', 'payouts', 'facturas de la tienda'], navUrl: '/intelligence/business-payments' },
  { key: 'products_page', target: 'products', labelKey: 'CATEGORIES_AND_PRODUCTS', label: 'Categories & products', aliases: ['productos de la tienda', 'menu de la tienda', 'categorias', 'catalogo'] }
]

export const isWhiteLabelSiteConfigured = (project, config) => {
  if (config?.value === '1' || config?.value === true) return true
  const projects = settings.dashboard_project_allowlists?.white_label_sites
  return typeof project === 'string' && project !== '' && Array.isArray(projects) && projects.includes(project)
}

/**
 * Palette business sections the user can open, with the menu rules applied.
 */
export const getPaletteBusinessSections = ({ user, configs = {}, project, googleActionsVisible = false } = {}) => {
  const access = getSectionAccess({ user, project })
  return BUSINESS_PALETTE_SECTIONS.filter(section => {
    // Pages outside the detail follow their own menu (checked by the caller with navUrl)
    if (section.target) return !access.isSelectedAccessRole
    // A button on the Overview, not a section
    if (section.detailOnly) return !section.adminOnly || access.isAdmin
    // redesign stores 4.A: the editor's menu rules, and the tab's own rule for a fixed tab
    const key = section.section || section.key
    return isStoreSectionInMenu(key, access, { configs, googleActionsVisible }) && canAccessBusinessSectionTab(key, section.tab, access)
  })
}

/**
 * Where a store action lands once the store is chosen: the detail (with
 * `section` and `tab`), the store's products page, or its Connect panel.
 */
export const buildPaletteStorePath = (entry = {}, business = {}) => {
  const id = business.id
  if (entry.target === 'products' && business.slug) return `/stores/products/${encodeURIComponent(business.slug)}`
  if (entry.target === 'pos_menu') return `/connect/pos-menu?id=${encodeURIComponent(id)}`
  if (entry.target === 'sales_channels') return `/connect/sales-channels?id=${encodeURIComponent(id)}`
  if (entry.target === 'business_payments') return `/intelligence/business-payments?business_id=${encodeURIComponent(id)}`
  const params = new URLSearchParams()
  params.set('id', String(id))
  if (entry.section) params.set('section', entry.section)
  if (entry.tab) params.set('tab', entry.tab)
  return `/stores/list?${params.toString()}`
}
