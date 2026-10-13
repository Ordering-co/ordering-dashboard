const SITE_PRIORITY = ['web_marketplace_26', 'website', 'ordering-react']

export const getSubscribedWebsiteProduct = (subscriptions = []) => {
  const hasFranchise = subscriptions.some(subscription => {
    if (!['active', 'trialing'].includes(subscription?.status)) return false
    const products = [
      ...(subscription?.plan?.plan?.products || []),
      ...(subscription?.plan?.products || []),
      ...(subscription?.products || [])
    ]
    return products.some(item => item?.enabled !== false && item?.product?.builder_product_unit === 'web_franchises_x')
  })
  return hasFranchise ? 'web_franchises_x' : 'web_marketplace_26'
}

const matchesSiteIdentifier = (site, identifier) =>
  site?.code === identifier || site?.type === identifier

const pickPreferredSite = (sites = [], isFranchise = false) =>
  (isFranchise ? ['franchiseweb', 'web_franchises_x'] : SITE_PRIORITY).reduce((found, id) =>
    found || sites.find(site => matchesSiteIdentifier(site, id))
  , null)

export const toHttpsUrl = (host, configurations) => {
  if (!host) return null
  const withSubdomain = host.replace?.('tryordering', configurations?.subdomain) || host
  return withSubdomain.startsWith('http') ? withSubdomain : `https://${withSubdomain}`
}

export const getDefaultTemporalSiteUrl = ({
  site,
  ordering,
  configurations,
  isDashboard = false,
  isFranchise = false,
  preserveExplicitSite = false
}) => {
  const project = ordering?.project
  const subdomain = configurations?.subdomain
  let host = `v26-${project}.${subdomain}.com`
  if (isDashboard) {
    host = `dashboard.${subdomain}.com`
  } else if (isFranchise) {
    host = `${project}.franchises.${subdomain}.com`
  }

  if (site?.temporal_domain) {
    const url = toHttpsUrl(site.temporal_domain, configurations)
    if (preserveExplicitSite) return url
    try {
      const temporalHost = new URL(url).hostname
      const platformHosts = [
        `${project}.${subdomain}.com`,
        `v26-${project}.${subdomain}.com`,
        `${project}.franchises.${subdomain}.com`
      ]
      if (!platformHosts.includes(temporalHost) || temporalHost === host) return url
    } catch {}
  }

  if (!project || !subdomain) return null

  return `https://${host}`
}

const hostKey = (url) =>
  String(url || '').replace(/^https?:\/\//i, '').replace(/\/$/, '').toLowerCase()

export const getPreferredSiteDestinations = ({ sites, configurations, ordering, websiteProduct = 'web_marketplace_26' }) => {
  if (!websiteProduct) return []
  const isFranchise = websiteProduct === 'web_franchises_x'
  const list = (Array.isArray(sites) ? sites : []).filter(site =>
    isFranchise || !(matchesSiteIdentifier(site, 'franchiseweb') || matchesSiteIdentifier(site, 'web_franchises_x'))
  )
  const sslReady = pickPreferredSite(
    list.filter(site => site?.domain && site?.ssl_process_status === 'ended'), isFranchise
  )
  const preferred = pickPreferredSite(list, isFranchise)
  const destinations = []
  const seen = new Set()

  const pushDestination = (key, labelKey, url) => {
    if (!url) return
    const keyHost = hostKey(url)
    if (!keyHost || seen.has(keyHost)) return
    seen.add(keyHost)
    destinations.push({ key, labelKey, url })
  }

  if (sslReady) {
    pushDestination('live', 'LIVE_WEBSITE', toHttpsUrl(sslReady.domain, configurations))
  }

  const temporaryUrl = getDefaultTemporalSiteUrl({
    site: preferred,
    ordering,
    configurations,
    isFranchise
  })

  pushDestination('temporary', 'TEMPORARY_WEBSITE', temporaryUrl)
  return destinations
}

export const getPreferredSiteUrl = ({ sites, configurations, ordering, websiteProduct }) => {
  const first = getPreferredSiteDestinations({ sites, configurations, ordering, websiteProduct })[0]
  return first?.url || null
}
