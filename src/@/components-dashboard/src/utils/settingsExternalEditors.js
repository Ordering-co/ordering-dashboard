/**
 * Paths and status helpers for Settings editors that used to live on
 * other tabs.
 */
import { buildSettingsPath } from './settingsRedirects'

export const SETTINGS_SLA_PATH = buildSettingsPath({
  group: 'orders',
  category: 'enterprise_orders_slas'
})

export const SETTINGS_MAPS_PATH = buildSettingsPath({
  group: 'locations',
  category: 'google_maps'
})

export const PAYMENT_GATEWAY_SETTINGS = {
  stripe: { group: 'payments', category: 'stripe' },
  computop: { group: 'developers', category: 'plugin_computop' }
}

const CREDENTIAL_KEY_RE = /(secret|private|api_key|apikey|token|password|publishable)/i

export const getPaymentGatewaySettingsPath = (gateway) => {
  const key = String(gateway || '').toLowerCase()
  const target = PAYMENT_GATEWAY_SETTINGS[key] || { group: 'payments', category: key || 'stripe' }
  return buildSettingsPath(target)
}

export const getPaymentGatewayKeyStatus = ({ gateway, configs = {} } = {}) => {
  const prefix = String(gateway || '').toLowerCase().replace(/-/g, '_')
  if (!prefix) return { configured: false, keys: [] }

  const list = Object.values(configs || {}).filter(Boolean)
  const related = list.filter(config => {
    const key = String(config.key || '').toLowerCase()
    return key === prefix || key.startsWith(`${prefix}_`)
  })
  const credentialKeys = related.filter(config => CREDENTIAL_KEY_RE.test(config.key || ''))
  const pool = credentialKeys.length ? credentialKeys : related
  const configured = pool.some(config => String(config.value ?? '').trim() !== '')
  return {
    configured,
    keys: pool.map(config => config.key)
  }
}
