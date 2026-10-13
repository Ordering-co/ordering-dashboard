import { getPreferredSiteUrl, toHttpsUrl } from './getPreferredSiteUrl'

export const TRACKING_DOMAIN_DEFAULT_KEY = 'default'
export const TRACKING_DOMAIN_OTHER_KEY = 'other'

const stripTrailingSlash = (value) => String(value || '').replace(/\/+$/, '')

const hostKey = (url) =>
  String(url || '').replace(/^https?:\/\//i, '').replace(/\/$/, '').toLowerCase()

export const LEGACY_TRACKING_DOMAIN_STORAGE_KEY = 'tracking_domain'

export const getTrackingDomainStorageKey = (project) => `tracking_domain:${project || 'default'}`

export const readStoredTrackingDomain = (storage, project) => {
  try {
    const stored = storage?.getItem(getTrackingDomainStorageKey(project))
    if (stored === TRACKING_DOMAIN_DEFAULT_KEY) return ''
    return stored || storage?.getItem(LEGACY_TRACKING_DOMAIN_STORAGE_KEY) || ''
  } catch (e) {
    return ''
  }
}

export const normalizeTrackingDomain = (value) => {
  const trimmed = String(value || '').trim()
  if (!trimmed) return null
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(withProtocol)
    if (!url.hostname) return null
    return stripTrailingSlash(`${url.origin}${url.pathname}`)
  } catch (e) {
    return null
  }
}

export const getDefaultTrackingDomain = ({ sites, configurations, ordering, websiteProduct = 'web_marketplace_26' } = {}) => {
  if (!ordering?.project || !configurations?.subdomain) return null
  const preferredSiteUrl = getPreferredSiteUrl({ sites, configurations, ordering, websiteProduct })
  return preferredSiteUrl ? stripTrailingSlash(preferredSiteUrl) : null
}

export const getTrackingDomainOptions = ({ sites, configurations, ordering, websiteProduct = 'web_marketplace_26' } = {}) => {
  const options = []
  const seen = new Set()

  const push = (key, url, site) => {
    const normalized = normalizeTrackingDomain(url)
    if (!normalized) return
    const host = hostKey(normalized)
    if (seen.has(host)) return
    seen.add(host)
    options.push({ key, url: normalized, site })
  }

  push(TRACKING_DOMAIN_DEFAULT_KEY, getDefaultTrackingDomain({ sites, configurations, ordering, websiteProduct }), null)

  const list = Array.isArray(sites) ? sites : []
  list.forEach((site, index) => {
    const id = site?.id ?? site?.code ?? index
    if (site?.domain) push(`site-${id}-domain`, toHttpsUrl(site.domain, configurations), site)
    if (site?.temporal_domain) push(`site-${id}-temporal`, toHttpsUrl(site.temporal_domain, configurations), site)
  })

  return options
}

export const findTrackingDomainOption = (options, url) => {
  const host = hostKey(url)
  if (!host) return null
  return (options || []).find(option => hostKey(option.url) === host) || null
}

export const getOrderTrackingUrl = ({ domain, order } = {}) => {
  if (!domain || !order?.uuid || !order?.hash_key) return null
  return `${domain}/orders/${order.uuid}?hash=${order.hash_key}`
}
