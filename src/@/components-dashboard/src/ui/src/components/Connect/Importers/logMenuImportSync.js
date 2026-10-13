/**
 * Connect Importers ↔ Supabase menu_import_sync_events.
 * Upsert after success; fetch for modal prefill. Failures never block UX.
 */

const ORDERING_PLUS_REF_RE = /^ordering-plus:\/\/([^/]+)\/(.+)$/

export const getMenuImportSyncLogUrl = () => {
  const explicit = (import.meta.env.VITE_MENU_IMPORT_SYNC_LOG_URL || '').trim()
  if (explicit) return explicit.replace(/\/$/, '')

  const base = (import.meta.env.VITE_SUPABASE_URL || '').trim()
  if (!base) return ''
  return `${base.replace(/\/$/, '')}/functions/v1/menu-import-sync-log`
}

export const resolveMenuImportSourceUrl = (source, params = {}) => {
  if (source === 'doordash') {
    return String(params.doordashUrl || '').trim() || null
  }
  if (source === 'ubereats') {
    return String(params.url || '').trim() || null
  }
  if (source === 'ordering') {
    const url = String(params.url || '').trim()
    if (url) return url
    const projectId = String(params.orderingPlusProjectId || params.project || '').trim()
    const segment = String(params.orderingBusinessSegment || '').trim()
    if (projectId && segment) {
      return `ordering-plus://${projectId}/${segment}`
    }
  }
  return null
}

/** @returns {{ url: string, orderingPlusProjectId: string, orderingBusinessSegment: string }} */
export const parseStoredSourceUrl = (sourceUrl) => {
  const raw = String(sourceUrl || '').trim()
  if (!raw) {
    return { url: '', orderingPlusProjectId: '', orderingBusinessSegment: '' }
  }
  const match = raw.match(ORDERING_PLUS_REF_RE)
  if (match) {
    return {
      url: '',
      orderingPlusProjectId: match[1],
      orderingBusinessSegment: match[2]
    }
  }
  return { url: raw, orderingPlusProjectId: '', orderingBusinessSegment: '' }
}

const buildCommonHeaders = (anon, orderingToken) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${anon}`,
  apikey: anon,
  'x-finitless-token': orderingToken
})

const getClientConfig = () => {
  const url = getMenuImportSyncLogUrl()
  const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()
  return { url, anon }
}

/**
 * @param {{
 *   token: string,
 *   businessId: number|string,
 *   project: string,
 *   source: string,
 *   orderingApiBaseUrl: string
 * }} args
 * @returns {Promise<object|null>}
 */
export const fetchMenuImportSync = async ({
  token,
  businessId,
  project,
  source,
  orderingApiBaseUrl
}) => {
  const { url, anon } = getClientConfig()
  const orderingToken = String(token || '').trim()
  const projectTrim = String(project || '').trim()
  const sourceTrim = String(source || '').trim()
  const apiBase = String(orderingApiBaseUrl || '').trim()

  if (!url || !anon || !orderingToken || !projectTrim || !sourceTrim || !apiBase || businessId == null) {
    return null
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildCommonHeaders(anon, orderingToken),
      body: JSON.stringify({
        action: 'get',
        business_id: Number(businessId),
        project: projectTrim,
        source: sourceTrim,
        ordering_api_base_url: apiBase
      })
    })
    if (!response.ok) return null
    const data = await response.json().catch(() => null)
    return data?.event ?? null
  } catch {
    return null
  }
}

/**
 * @param {{
 *   token: string,
 *   source: string,
 *   params: Record<string, unknown>
 * }} args
 */
export const logMenuImportSync = ({ token, source, params }) => {
  const { url, anon } = getClientConfig()
  const orderingToken = String(token || '').trim()
  const project = String(params?.project || '').trim()
  const orderingApiBaseUrl = String(params?.orderingApiBaseUrl || '').trim()
  const businessIds = Array.isArray(params?.businessIds) ? params.businessIds : []
  const businessId = businessIds[0]

  if (!url || !anon || !orderingToken || !project || !orderingApiBaseUrl || businessId == null) {
    return
  }

  const payload = {
    action: 'upsert',
    business_id: Number(businessId),
    project,
    source,
    ordering_api_base_url: orderingApiBaseUrl
  }

  if (source === 'gloriafood') {
    const restaurantKey = String(params?.gloriafoodRestaurantKey || '').trim()
    const masterKey = String(params?.gloriafoodMasterKey || '').trim()
    if (!restaurantKey || !masterKey) return
    payload.gloriafood_restaurant_key = restaurantKey
    payload.gloriafood_master_key = masterKey
  } else {
    const sourceUrl = resolveMenuImportSourceUrl(source, params)
    if (!sourceUrl) return
    payload.source_url = sourceUrl
  }

  try {
    void fetch(url, {
      method: 'POST',
      headers: buildCommonHeaders(anon, orderingToken),
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => {})
  } catch {
    // ignore
  }
}
