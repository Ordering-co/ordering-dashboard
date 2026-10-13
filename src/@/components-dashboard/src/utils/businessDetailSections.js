import { PAYMENT_PLUGIN_CATALOG } from './paymentPluginCatalog'

/**
 * Business detail menu rules (`/stores/list?id=&section=`). Pure, no React.
 *
 * Shared by BusinessSummary (the side menu) and the command palette, so a
 * section is only offered where the menu shows it.
 */

export const EATSTREET_PROJECTS = ['eatstreet', 'eatstreetstaging']
export const SELECTED_ACCESS_SECTION_KEYS = ['delivery_pickup_more', 'payment_methods']

export const isSelectedAccessUser = (user) => user?.level !== 0 && user?.selected_access === true

/**
 * Same result as `isEnabled(key)` in BusinessSummary.
 */
export const isBusinessSectionEnabled = (key, {
  isAdmin = false,
  isSelectedAccessRole = false,
  project,
  configs = {},
  hasSpoonity = false
} = {}) => {
  if (isSelectedAccessRole) return SELECTED_ACCESS_SECTION_KEYS.includes(key)
  const eatstreetExclusions = EATSTREET_PROJECTS.includes(project) ? ['tax_fees', 'layout', 'webhooks', 'logs'] : []
  if (!isAdmin && eatstreetExclusions.includes(key)) return false
  if (configs?.white_label_module?.value) return !['personalization', 'sales_channels'].includes(key)
  if (isAdmin) return true
  const itemsExcluded = hasSpoonity
    ? ['publishing', 'personalization', 'markups', ...eatstreetExclusions]
    : ['publishing', 'spoonity_key', 'personalization', 'markups', ...eatstreetExclusions]
  return !itemsExcluded.includes(key)
}

const isConfigOn = (config) => {
  const value = config?.value
  return value === true || value === 1 || value === '1' || value === 'true'
}

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
  { key: 'custom_fields', labelKey: 'CUSTOM_FIELDS', label: 'Custom fields', aliases: ['campos personalizados', 'metafields'], when: ({ configs }) => isConfigOn(configs?.show_metafields) },
  { key: 'webhooks', labelKey: 'WEBHOOKS', label: 'Webhooks', aliases: ['webhooks', 'integraciones'] },
  { key: 'logs', labelKey: 'LOGS', label: 'Logs', aliases: ['registros', 'historial', 'auditoria'] },
  { key: 'publishing', labelKey: 'QR_CODES', label: 'QR Codes', aliases: ['codigos qr', 'qr', 'mesas'], adminOnly: true },
  { key: 'business_fees', labelKey: 'BUSINESS_FEES', label: 'Business Fees', aliases: ['comisiones del negocio', 'cargos'], adminOnly: true },
  { key: 'markups', labelKey: 'MARKUPS', label: 'Markups', aliases: ['recargos', 'margenes'], adminOnly: true },
  // A button on the store detail, not a section: the palette opens the detail
  // and the person presses it (it starts the Clover sign-in on another site)
  { key: 'connect_clover', labelKey: 'CONNECT_CLOVER', label: 'Connect clover', aliases: ['clover', 'conectar clover', 'clover pos', 'sincronizar clover'], adminOnly: true, detailOnly: true },
  { key: 'sales_channels', labelKey: 'SALES_CHANNELS', label: 'Sales channels', aliases: ['canales de venta', 'facebook', 'instagram', 'tiktok', 'google my business', 'redes sociales'] },
  { key: 'layout', labelKey: 'LAYOUT', label: 'Layout', aliases: ['diseno', 'plantilla', 'vista', 'food', 'groceries'] },
  { key: 'business_payment_account', labelKey: 'BUSINESS_PAYMENT_ACCOUNT', label: 'Business Payment Account', aliases: ['cuenta de pago', 'cuenta bancaria', 'payouts', 'stripe connect'] },
  { key: 'white_label', labelKey: 'WHITE_LABEL', label: 'White Label', aliases: ['marca blanca', 'sitio propio', 'white label'], adminOnly: true, when: ({ configs, project }) => isConfigOn(configs?.whitelabel_stores_sites) || WHITE_LABEL_STORE_PROJECTS.includes(project) },
  { key: 'reservations', labelKey: 'RESERVATIONS', label: 'Reservations', aliases: ['reservas', 'reservaciones', 'mesas'], when: ({ configs }) => configs?.reservation_enabled?.value === '1' && !!configs?.web_marketplace_26?.value },
  // Fixed tabs inside a section (`&tab=`): same gate as their section, plus the tab's own rule
  { key: 'store_details:owner', section: 'store_details', tab: 'owner', labelKey: 'OWNER_ID', label: 'Owner', aliases: ['dueno', 'propietario', 'owner'], when: ({ user }) => user?.level !== 2 },
  { key: 'store_details:categories', section: 'store_details', tab: 'categories', labelKey: 'CATEGORIES', label: 'Categories', aliases: ['categorias del negocio', 'tipo de negocio', 'business type'] },
  { key: 'store_details:location', section: 'store_details', tab: 'location', labelKey: 'LOCATION', label: 'Location', aliases: ['ubicacion', 'direccion', 'mapa', 'address'] },
  { key: 'store_details:agents', section: 'store_details', tab: 'agents', labelKey: 'AGENTS', label: 'Agents', aliases: ['agentes', 'call center'], when: ({ isRestricted }) => !isRestricted },
  { key: 'store_details:images', section: 'store_details', tab: 'images', labelKey: 'IMAGES', label: 'Images', aliases: ['imagenes', 'fotos', 'galeria', 'logo', 'portada', 'header'] },
  { key: 'store_details:videos', section: 'store_details', tab: 'videos', labelKey: 'VIDEOS', label: 'Videos', aliases: ['videos'] },
  { key: 'store_details:seo_options', section: 'store_details', tab: 'seo_options', labelKey: 'SEO_OPTIONS', label: 'SEO Options', aliases: ['seo', 'meta', 'google'] },
  { key: 'menu:shared_menus', section: 'menu', tab: 'shared_menus', labelKey: 'SHARED_MENUS', label: 'Shared menus', aliases: ['menus compartidos', 'shared menus'] },
  { key: 'delivery_pickup_more:delivery', section: 'delivery_pickup_more', tab: 'delivery', labelKey: 'DELIVERY', label: 'Delivery', aliases: ['zonas de entrega', 'zona de reparto', 'delivery zones', 'costo de envio', 'radio'] },
  { key: 'delivery_pickup_more:pickup', section: 'delivery_pickup_more', tab: 'pickup', labelKey: 'PICKUP', label: 'Pickup', aliases: ['recoger', 'para llevar', 'retiro en tienda'] },
  { key: 'delivery_pickup_more:driver_delivery_group', section: 'delivery_pickup_more', tab: 'driver_delivery_group', labelKey: 'DRIVER_DELIVERY_GROUP', label: 'Driver Delivery Group', aliases: ['grupo de repartidores', 'driver group'], when: ({ isRestricted }) => !isRestricted },
  { key: 'delivery_pickup_more:advanced_eta', section: 'delivery_pickup_more', tab: 'advanced_eta', labelKey: 'ADVANCED_ETA', label: 'Advanced ETA', aliases: ['tiempo estimado', 'eta', 'tiempo de entrega'] },
  { key: 'ordering_channels:custom_slug', section: 'ordering_channels', tab: 'custom_slug', labelKey: 'CUSTOM_SLUG', label: 'Custom slug', aliases: ['slug', 'url de la tienda', 'enlace'], when: ({ isRestricted }) => !isRestricted },
  { key: 'ordering_channels:widgets', section: 'ordering_channels', tab: 'widgets', labelKey: 'WIDGETS', label: 'Widgets', aliases: ['widget', 'boton de pedido', 'embed'] },
  // Not on the detail: the store's products page (by slug) and its Connect panels
  { key: 'pos_menu', target: 'pos_menu', labelKey: 'CONNECT_POS_MENU', label: 'POS & Menu Sync', aliases: ['pos', 'sincronizar menu', 'menu sync', 'punto de venta', 'deliverect', 'itsacheckmate', 'checkmate'], navUrl: '/connect/pos-menu' },
  { key: 'store_sales_channels', target: 'sales_channels', labelKey: 'CONNECT_SALES_CHANNELS', label: 'Sales Channels', aliases: ['canales de venta', 'integraciones de venta', 'marketplaces'], navUrl: '/connect/sales-channels' },
  { key: 'business_payments', target: 'business_payments', labelKey: 'PAYMENT_REPORTS', label: 'Payment reports', aliases: ['reportes de pagos', 'pagos a la tienda', 'payouts', 'facturas de la tienda'], navUrl: '/intelligence/business-payments' },
  { key: 'products_page', target: 'products', labelKey: 'CATEGORIES_AND_PRODUCTS', label: 'Categories & products', aliases: ['productos de la tienda', 'menu de la tienda', 'categorias', 'catalogo'] }
]

/** Projects where store White Label is on without the config (BusinessSummary) */
export const WHITE_LABEL_STORE_PROJECTS = ['luisv4plus', 'eatstreetstaging']

/** EatStreet store owners see fewer tabs (useBusinessOwnerRestriction) */
export const isRestrictedBusinessOwner = ({ user, project } = {}) =>
  EATSTREET_PROJECTS.includes(project) && user?.level !== 0

/**
 * Palette business sections the user can open, with the menu rules applied.
 */
export const getPaletteBusinessSections = ({ user, configs = {}, project } = {}) => {
  const isAdmin = user?.level === 0
  const isSelectedAccessRole = isSelectedAccessUser(user)
  const isRestricted = isRestrictedBusinessOwner({ user, project })
  return BUSINESS_PALETTE_SECTIONS.filter(section => {
    if (section.adminOnly && !isAdmin) return false
    if (section.when && !section.when({ configs, user, project, isRestricted })) return false
    // Pages outside the detail follow their own menu (checked by the caller with navUrl)
    if (section.target) return !isSelectedAccessRole
    return isBusinessSectionEnabled(section.section || section.key, { isAdmin, isSelectedAccessRole, project, configs })
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
