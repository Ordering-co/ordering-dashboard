// redesign DS-B2 (decision 6 | M-DS1, M-DS5): what the delivery services list reads from a company and from the configs the app
// already loaded. Pure: no React, no requests.
//
// A company of GET /driver_companies: { id, name, logo, enabled, plugin_id, plugin_root, plugin: { id, key, ... } | null,
// schedule, driver_groups: [{ id, ... }] }. The configs dictionary is `useConfig()[0].configs`: one object per key,
// `{ id?, key, value }`. The rows with a numeric `id` came from the API; the ones without come from the app's own defaults
// (ConfigContext `customConfigs`) and never belong to a plugin.

import { getVisibleSettingsConfigs } from '../../../../../utils/settingsCustomSections'

const cleanText = (value) => (value === null || value === undefined ? '' : String(value)).replace(/\s+/g, ' ').trim()

// The name the list draws; a company with none shows its id instead of an empty cell
export const providerName = (company) => cleanText(company?.name) || `#${company?.id}`

// The driver group the company works through (the list only ever reads the first one, as main)
export const groupOf = (company) => company?.driver_groups?.[0] ?? null

// The configs of one plugin, picked as K/DeliveryServiceDetails.getPluginInformation picks them: `key ilike %pluginKey%`
// (anywhere in the key, case-insensitive) and a numeric id. With no plugin key there is nothing to pick (an empty `%%` would
// match every config).
export const pluginConfigs = (configsDictionary, pluginKey) => {
  const needle = cleanText(pluginKey).toLowerCase()
  if (!needle || !configsDictionary || typeof configsDictionary !== 'object') return []
  return Object.values(configsDictionary).filter(config =>
    typeof config?.id === 'number' && String(config.key ?? '').toLowerCase().includes(needle)
  )
}

// As main: every VISIBLE config has a value (`!== ''`: a stored null or 0 is a value). A field the Settings hub hides behind
// its master cannot be filled, so it does not hold the provider back. With no configs there is nothing to fill: true.
export const credentialsComplete = (configs) => getVisibleSettingsConfigs(configs || []).every(config => config?.value !== '')

// not_installed (no plugin) · group_missing (no driver group) · credentials_incomplete · active / paused (company.enabled).
// `configs` is the dictionary; the plugin's own configs are picked from it by `company.plugin.key`.
export const providerStatus = (company, { configs } = {}) => {
  if (!company?.plugin_id) return 'not_installed'
  if (!groupOf(company)) return 'group_missing'
  if (!credentialsComplete(pluginConfigs(configs, company.plugin?.key))) return 'credentials_incomplete'
  return company.enabled ? 'active' : 'paused'
}

// `ACTIVE` is the catalog's own key; the other four are this page's. Literal t() calls, one per status, so the i18n
// scanner sees every key (playbook § i18n 5; a key kept in a data map reaches the catalog only in English, D-22).
// redesign DS-integration
const LABELS = {
  not_installed: t => t('DELIVERY_SERVICES_STATUS_NOT_INSTALLED', 'Not installed'),
  group_missing: t => t('DELIVERY_SERVICES_STATUS_GROUP_MISSING', 'Group missing'),
  credentials_incomplete: t => t('DELIVERY_SERVICES_STATUS_CREDENTIALS_INCOMPLETE', 'Credentials incomplete'),
  active: t => t('ACTIVE', 'Active'),
  paused: t => t('DELIVERY_SERVICES_STATUS_PAUSED', 'Paused')
}

// The families of Product/Status (STATUS_FAMILIES): all five exist, so no status borrows the nearest one
const FAMILIES = {
  not_installed: 'pending',
  group_missing: 'review',
  credentials_incomplete: 'review',
  active: 'done',
  paused: 'cancel'
}

export const statusLabel = (status, t) => {
  const label = LABELS[status]
  if (!label) throw new Error(`Unknown provider status: ${status}`)
  return label(t)
}

export const statusFamily = (status) => {
  const family = FAMILIES[status]
  if (!family) throw new Error(`Unknown provider status: ${status}`)
  return family
}

// The stores of the company's group, from the one request the controller makes (`groupsInfo.groups[groupId].business`, a list):
// the number, or null when it cannot say (no group, not loaded, or the group is not in the answer)
export const storesCount = (company, groupsInfo) => {
  const group = groupOf(company)
  if (!group) return null
  const business = groupsInfo?.groups?.[group.id]?.business
  return Array.isArray(business) ? business.length : null
}
