import {
  buildNavigationEntries,
  buildSettingsHubEntries,
  buildStaticSettingsEntries,
  canOpenSettings
} from './commandPaletteCatalog'
import { buildOpenActionEntries, canOpenNavDestination } from './commandPaletteActions'
import { buildIntegrationEntries } from './commandPaletteIntegrations'
import { buildPaletteStorePath } from './businessDetailSections'
import { parseRecordId } from './commandPaletteBusinesses'
import { rankCommandEntries } from './commandPaletteSearch'
import { canOpenDashboardRoute, getDashboardNavSections, getDashboardRoleFlags } from './dashboardNavigation'

export const DASHBOARD_DESTINATION_LIMIT = 12
export const DASHBOARD_DESTINATION_QUERY_LIMIT = 200
export const DASHBOARD_DESTINATION_BUSINESS_QUERY_LIMIT = 120
export const DASHBOARD_DESTINATION_ID_LIMIT = 160
export const MAX_DASHBOARD_RECORD_ID = 2147483647

const noopT = (_key, fallback) => fallback

/** Build the same canonical local inventory used by CommandK. */
export const buildDashboardDestinationCatalog = ({
  t = noopT,
  user,
  configs = {},
  project,
  settingsHub = null,
  integrations = [],
  deliveryCompanies = [],
  builderApps = []
} = {}) => {
  const { level } = getDashboardRoleFlags(user)
  const navSections = getDashboardNavSections({ t, user, configs, project })
  const can = (url) => canOpenNavDestination({ sections: navSections, url, level })
  const canMyProducts = !!navSections.myProducts?.visible && canOpenDashboardRoute('/my-products', level)
  const settingsAllowed = canOpenSettings(user)
  const navigationEntries = buildNavigationEntries({ t, user, configs, project })
  const baseSettings = settingsAllowed ? buildStaticSettingsEntries({ t }) : []
  const hubEntries = settingsAllowed && settingsHub
    ? buildSettingsHubEntries({ t, hub: settingsHub })
    : []
  const hubIds = new Set(hubEntries.map(entry => entry.id))
  const settingsEntries = [
    ...baseSettings.filter(entry => !hubIds.has(entry.id)),
    ...hubEntries
  ]
  const integrationEntries = buildIntegrationEntries({
    t,
    can,
    integrations,
    deliveryCompanies,
    builderApps,
    canMyProducts
  })
  const actionEntries = [
    ...buildOpenActionEntries({ t, user, configs, project }),
    ...integrationEntries
  ]
  const entries = [...navigationEntries, ...settingsEntries, ...actionEntries].map(entry => ({
    ...entry,
    kind: entry.id.startsWith('settings-field:') || entry.id.startsWith('settings-task:')
      ? 'field'
      : entry.group === 'integrations' ? 'integration' : 'section'
  }))
  const byId = new Map()
  entries.forEach(entry => {
    if (entry?.id && !byId.has(entry.id)) byId.set(entry.id, entry)
  })
  return {
    entries,
    byId,
    navigationEntries,
    settingsEntries,
    actionEntries,
    dynamicIds: new Set([...hubEntries, ...integrationEntries].map(entry => entry.id)),
    navSections,
    can,
    level,
    settingsAllowed,
    businessesAllowed: can('/stores/list'),
    canMyProducts
  }
}

/** Resolve only an entry from the current catalog; never accept a path. */
export const resolveDashboardDestination = (catalog, id) => {
  if (!catalog?.byId || typeof id !== 'string') return null
  return catalog.byId.get(id) || null
}

export const normalizeDashboardSearchRequest = (request) => {
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('INVALID_SEARCH_REQUEST')
  if (Object.keys(request).some(key => !['query', 'destination_id', 'business_query', 'business_id', 'intent', 'use_current_business'].includes(key))) {
    throw new Error('INVALID_SEARCH_FIELD')
  }
  if (typeof request.query !== 'string') throw new Error('INVALID_QUERY')
  if (Object.prototype.hasOwnProperty.call(request, 'business_query') && typeof request.business_query !== 'string') {
    throw new Error('INVALID_BUSINESS_QUERY')
  }
  if (Object.prototype.hasOwnProperty.call(request, 'destination_id') && typeof request.destination_id !== 'string') {
    throw new Error('INVALID_DESTINATION_ID')
  }
  if (Object.prototype.hasOwnProperty.call(request, 'business_id') && !Number.isInteger(request.business_id)) {
    throw new Error('INVALID_BUSINESS_ID')
  }
  const query = request.query.trim()
  const businessQuery = Object.prototype.hasOwnProperty.call(request, 'business_query') ? request.business_query.trim() : undefined
  const destinationId = Object.prototype.hasOwnProperty.call(request, 'destination_id') ? request.destination_id.trim() : undefined
  const businessId = request.business_id
  if (request.intent !== undefined && !['feature', 'business', 'record'].includes(request.intent)) throw new Error('INVALID_SEARCH_INTENT')
  if (request.use_current_business !== undefined && typeof request.use_current_business !== 'boolean') throw new Error('INVALID_BUSINESS_CONTEXT')
  if (query.length > DASHBOARD_DESTINATION_QUERY_LIMIT) throw new Error('QUERY_TOO_LONG')
  if (businessQuery !== undefined && businessQuery.length > DASHBOARD_DESTINATION_BUSINESS_QUERY_LIMIT) throw new Error('BUSINESS_QUERY_TOO_LONG')
  if (destinationId !== undefined && destinationId.length > DASHBOARD_DESTINATION_ID_LIMIT) throw new Error('DESTINATION_ID_TOO_LONG')
  if (businessId !== undefined && (businessId < 1 || businessId > MAX_DASHBOARD_RECORD_ID)) throw new Error('INVALID_BUSINESS_ID')
  return { query, ...(businessQuery !== undefined ? { business_query: businessQuery } : {}), ...(destinationId !== undefined ? { destination_id: destinationId } : {}), ...(businessId !== undefined ? { business_id: businessId } : {}), ...(request.intent ? { intent: request.intent } : {}), ...(request.use_current_business !== undefined ? { use_current_business: request.use_current_business } : {}) }
}

const safeString = (value, max) => {
  const text = String(value ?? '').trim()
  return text ? text.slice(0, max) : undefined
}

export const toDashboardEnvelopeItem = (entry, { requiresBusiness = false, businessId, query } = {}) => {
  if (!entry?.id) return null
  const params = {}
  if (Number.isInteger(businessId) && businessId > 0 && businessId <= MAX_DASHBOARD_RECORD_ID) params.business_id = businessId
  if (query) params.query = String(query).slice(0, DASHBOARD_DESTINATION_QUERY_LIMIT)
  const item = {
    id: String(entry.id).slice(0, DASHBOARD_DESTINATION_ID_LIMIT),
    title: safeString(entry.title, 160) || String(entry.id).slice(0, 160)
  }
  const subtitle = safeString(entry.subtitle, 240)
  if (subtitle) item.subtitle = subtitle
  if (requiresBusiness || entry.requires === 'business') item.requires_business = true
  if (Object.keys(params).length) item.params = params
  if (entry.kind) item.kind = safeString(entry.kind, 40)
  if (entry.parent_id) item.parent_id = safeString(entry.parent_id, 160)
  return item
}

export const toDashboardEnvelope = ({ scope, revision, query = '', status = 'ok', items = [], errors = [] } = {}) => ({
  version: 1,
  scope: String(scope || ''),
  revision: String(revision || ''),
  query: String(query || '').slice(0, DASHBOARD_DESTINATION_QUERY_LIMIT),
  status: ['ok', 'partial', 'unavailable'].includes(status) ? status : 'unavailable',
  items: items.filter(Boolean).slice(0, DASHBOARD_DESTINATION_LIMIT).map(item => toDashboardEnvelopeItem(item, {
    requiresBusiness: item.requires_business,
    businessId: item.params?.business_id,
    query: item.params?.query
  })).filter(Boolean),
  errors: [...new Set(errors.filter(Boolean).map(error => String(error).slice(0, 160)))].slice(0, 8)
})

/**
 * Rebuild a browser-only path after authorization and current catalog checks.
 * The returned path is never sent over the assistant protocol.
 */
export const buildDashboardDestinationPath = (entry, business) => {
  if (!entry) return null
  if (entry.requires === 'business') return business?.id ? buildPaletteStorePath(entry, business) : null
  if (entry.id === 'nav:businesses' && business?.id) return buildPaletteStorePath({}, business)
  return typeof entry.path === 'string' ? entry.path : null
}

export const businessIdFromSearch = (request) =>
  Number.isInteger(request?.business_id) ? request.business_id : parseRecordId(request?.business_query)

export const rankDashboardEntries = (entries, query) =>
  rankCommandEntries(entries, query, { limit: DASHBOARD_DESTINATION_LIMIT })
