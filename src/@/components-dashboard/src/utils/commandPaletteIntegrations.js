import { normalizeCommandText } from './commandPaletteSearch'

/**
 * Integrations loaded from the API. Pure, no React.
 *
 * Connect lists its providers from the API, so new ones appear without a
 * code change: `/third_party_integrations` (POS: `type === 'pos'`, Sales
 * channels: `type === 'sales_channel'`) and `/driver_companies` with
 * `owner_type = system` (Delivery services). The palette indexes them by
 * name with the same Connect page rules.
 */

export const INTEGRATION_TYPES = {
  pos: { url: '/connect/pos-menu', target: 'pos_menu', labelKey: 'CONNECT_POS_MENU', label: 'POS & Menu Sync', aliases: ['pos', 'punto de venta', 'integracion pos', 'sincronizar menu'] },
  sales_channel: { url: '/connect/sales-channels', target: 'sales_channels', labelKey: 'CONNECT_SALES_CHANNELS', label: 'Sales Channels', aliases: ['canal de venta', 'marketplace', 'integracion de ventas'] }
}

export const DELIVERY_SERVICES_URL = '/connect/delivery-services'
export const BUILDER_APPS_PATH = '/builder/apps'

export const buildDeliveryCompaniesUrl = (root) =>
  `${root}/driver_companies?where=${JSON.stringify([{ attribute: 'owner_type', value: 'system' }])}`

const slug = (value) => normalizeCommandText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const uniqueByName = (rows = []) => {
  const seen = new Set()
  return (Array.isArray(rows) ? rows : []).filter(row => {
    const name = String(row?.name || '').trim()
    if (!name || seen.has(slug(name))) return false
    seen.add(slug(name))
    return true
  })
}

/**
 * `can(url)`: the user sees and can open that Connect page.
 * POS and sales-channel integrations are per store: the palette asks for the
 * store, then opens its Connect panel. Delivery services open their page
 * with the company (`?id=`), which shows its panel or its setup notice.
 */
export const buildIntegrationEntries = ({
  t = (_key, fallback) => fallback,
  can = () => false,
  integrations = [],
  deliveryCompanies = [],
  builderApps = [],
  canMyProducts = false
} = {}) => {
  const entries = []
  const chooseStore = t('COMMAND_PALETTE_CHOOSE_STORE_HINT', 'Choose a store')

  Object.entries(INTEGRATION_TYPES).forEach(([type, config]) => {
    if (!can(config.url)) return
    const pageLabel = t(config.labelKey, config.label)
    uniqueByName((integrations || []).filter(item => item?.type === type)).forEach(item => {
      const name = String(item.name).trim()
      entries.push({
        id: `integration:${type}:${slug(name)}`,
        group: 'actions',
        title: name,
        subtitle: `${pageLabel} · ${chooseStore}`,
        aliases: [name, ...config.aliases, 'integracion', 'integration', 'connect'],
        keywords: [item.key, item.plugin?.key].filter(Boolean),
        icon: 'connect',
        logo: item.logo || null,
        requires: 'business',
        target: config.target
      })
    })
  })

  if (can(DELIVERY_SERVICES_URL)) {
    const pageLabel = t('CONNECT_DELIVERY_SERVICES', 'Delivery services')
    uniqueByName(deliveryCompanies).forEach(company => {
      if (company?.id === undefined || company?.id === null) return
      const name = String(company.name).trim()
      entries.push({
        id: `integration:delivery:${company.id}`,
        group: 'actions',
        title: name,
        subtitle: pageLabel,
        path: `${DELIVERY_SERVICES_URL}?id=${encodeURIComponent(company.id)}`,
        aliases: [name, 'servicio de entrega', 'empresa de reparto', 'delivery service', 'courier'],
        keywords: [company.plugin?.key].filter(Boolean),
        icon: 'connect',
        logo: company.logo || null
      })
    })
  }

  // My products › apps built in the app builder (`/my-products?id=`), the
  // same list the sidebar shows under My products
  if (canMyProducts) {
    const myProductsLabel = t('MY_PRODUCTS', 'My products')
    uniqueByName(builderApps).forEach(app => {
      if (app?.id === undefined || app?.id === null) return
      const name = String(app.name).trim()
      entries.push({
        id: `product-app:${app.id}`,
        group: 'navigation',
        title: name,
        subtitle: myProductsLabel,
        path: `/my-products?id=${encodeURIComponent(app.id)}`,
        aliases: [name, 'app', 'aplicacion', 'mis productos', 'my products'],
        icon: 'myProducts'
      })
    })
  }

  return entries
}
