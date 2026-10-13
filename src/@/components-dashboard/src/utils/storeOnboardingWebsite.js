import { getDefaultTemporalSiteUrl } from '../ui/src/utils/getPreferredSiteUrl'

export const isOnboardingFranchise = site => site?.type === 'franchiseweb' || site?.code === 'web_franchises_x' || ['franchise', 'single_store'].includes(site?.websiteType)
const isMarketplace = site => !isOnboardingFranchise(site) && (['website', 'web_marketplace_26', 'ordering-react'].includes(site?.code) || site?.websiteType === 'marketplace')

export const onboardingWebsiteCandidates = (sites, { websiteProduct = null } = {}) => {
  const list = Array.isArray(sites) ? sites : []
  if (websiteProduct === 'web_franchises_x') return list.filter(isOnboardingFranchise)
  if (websiteProduct === 'web_marketplace_26') return list.filter(isMarketplace)
  return []
}
const safeUrl = host => {
  if (!host || typeof host !== 'string' || (/^[a-z]+:/i.test(host) && !/^https?:\/\//i.test(host))) return null
  try {
    const url = new URL(/^https?:\/\//i.test(host) ? host : `https://${host}`)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href.replace(/\/$/, '') : null
  } catch { return null }
}
export const onboardingWebsiteUrl = (site, { root, websiteProduct } = {}) => {
  const live = site.ssl_process_status === 'ended' && safeUrl(site.domain)
  if (live) return live
  let api
  try { api = new URL(root) } catch {}
  const match = api?.hostname === 'api.orderingplus.com' && api.pathname.match(/^\/v\d+\/[a-z]{2}(?:-[a-z]{2})?\/([a-z0-9_-]+)\/?$/i)
  const franchise = websiteProduct === 'web_franchises_x' || isOnboardingFranchise(site)
  if (match) {
    const temporal = getDefaultTemporalSiteUrl({ site: { temporal_domain: site.temporal_domain || site.url }, ordering: { project: match[1] }, configurations: { subdomain: 'orderingplus' }, isFranchise: franchise })
    return safeUrl(temporal)
  }
  return safeUrl(site.temporal_domain) || safeUrl(site.url)
}
