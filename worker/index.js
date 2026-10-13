import {
  mapSeoEndpoint,
  fetchSeo,
  fetchFirstLoad,
  getTitle,
  getDashboardTitle,
  withDashboardTitle,
  escapeJsonForScript,
  deriveProjectFromHost,
  validateProjectViaCurrent,
  validateProjectViaCurrentStrict,
  isOfficialOrderingDashboardHost
} from './seo.js'
import { sanitizeRouterCacheKey } from './sanitizeRouterCacheKey.js'
import { handleSourceDownloadsRequest, sourceRequestPreflight } from './sourceDownloads.js'
import { isValidSourceProjectSlug, SOURCE_PROJECT_HEADER } from '../src/utils/sourceDownloadsProject.js'

const ASSET_EXTENSIONS = /\.(js|css|map|svg|png|jpe?g|webp|gif|ico|woff2?|ttf|eot|json|txt|xml|mp4|webm|avif)$/i

/** Prefix public assets with the persisted deployment base. */
const defaultAssetPath = (env, path) => {
  const raw = String(
    env?.ASSET_BASE_PATH ||
    env?.ASSET_BASE_URL ||
    env?.VITE_ASSET_BASE ||
    env?.VITE_ASSET_BASE_URL ||
    ''
  ).trim().replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return raw ? `${raw}${p}` : p
}

let cachedBaseConfig = null

export const resolveBoolEnv = (value, fallback) => {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return fallback
  const v = value.trim().toLowerCase()
  if (v === 'true' || v === '1') return true
  if (v === 'false' || v === '0') return false
  return fallback
}

export const mergeBaseConfigWithEnv = (baseConfig = {}, env = {}) => ({
  ...baseConfig,
  app_id: env.APP_ID || baseConfig.app_id,
  api: {
    url: env.API_URL || baseConfig.api?.url,
    version: env.API_VERSION || baseConfig.api?.version,
    language: env.API_LANGUAGE || baseConfig.api?.language
  },
  socket: {
    ...(baseConfig.socket || {}),
    ...(env.SOCKET_URL ? { url: env.SOCKET_URL } : {})
  },
  use_project_subdomain: resolveBoolEnv(env.USE_PROJECT_SUBDOMAIN, baseConfig.use_project_subdomain),
  use_project_domain: resolveBoolEnv(env.USE_PROJECT_DOMAIN, baseConfig.use_project_domain),
  posthog_analytics_enabled: resolveBoolEnv(
    env.POSTHOG_ANALYTICS_ENABLED,
    baseConfig.posthog_analytics_enabled
  )
})

export const buildRuntimeConfig = (config, { siteId, disablePoweredBy, franchiseSlug } = {}) => ({
  project: config.project,
  app_id: config.app_id,
  site_id: siteId,
  api: config.api,
  socket: config.socket,
  use_project_subdomain: config.use_project_subdomain,
  use_project_domain: config.use_project_domain,
  posthog_analytics_enabled: config.posthog_analytics_enabled,
  disable_powered_by: disablePoweredBy,
  ...(franchiseSlug !== null && franchiseSlug !== undefined && { franchiseSlug })
})

const loadBaseConfig = async (env, origin) => {
  if (cachedBaseConfig) return cachedBaseConfig

  let baseConfig = {}
  try {
    const request = new Request(new URL('/config.json', origin).toString())
    const response = await env.ASSETS.fetch(request)
    if (response.ok) {
      baseConfig = await response.json()
    }
  } catch (_) {}

  const merged = mergeBaseConfigWithEnv(baseConfig, env)

  if (!merged.api.url) return null

  cachedBaseConfig = merged
  return cachedBaseConfig
}

const isPreviewHost = (hostname) => {
  if (!hostname) return false
  return hostname.endsWith('.workers.dev') || hostname === 'localhost' || hostname.startsWith('127.0.0.1')
}

const resolveConfigForRequest = async (env, ctx, hostname, baseConfig, origin, requestUrl) => {
  if (isPreviewHost(hostname)) {
    const fallbackProject = env.PROJECT || baseConfig?.project
    if (!fallbackProject) return null
    return { ...baseConfig, project: fallbackProject }
  }

  let project = deriveProjectFromHost(hostname, baseConfig)
  if (env.PROJECT && !project) project = env.PROJECT

  if (baseConfig?.use_project_domain) {
    project = await validateProjectViaCurrent(baseConfig, project, env, ctx, origin, requestUrl)
  }

  if (!project) project = env.PROJECT || baseConfig?.project
  if (!project) return null

  return { ...baseConfig, project }
}

const isHtmlRequest = (request, url) => {
  if (ASSET_EXTENSIONS.test(url.pathname)) return false
  const accept = request.headers.get('accept') || ''
  if (!accept.includes('text/html') && !accept.includes('*/*') && accept !== '') return false
  return true
}

const isSourceDownloadsPath = (pathname) =>
  pathname === '/api/source-catalog' ||
  pathname.startsWith('/api/source-catalog/') ||
  pathname === '/api/source-downloads' ||
  pathname.startsWith('/api/source-downloads/')

const sourceServiceUnavailable = () => new Response(JSON.stringify({
  error: { code: 'source_downloads_unavailable', message: 'Source downloads are temporarily unavailable.' }
}), {
  status: 503,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'private, no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer'
  }
})

const sourceProjectSelectionInvalid = () => new Response(JSON.stringify({
  error: { code: 'invalid_project_selection', message: 'A valid dashboard project selection is required.' }
}), {
  status: 400,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'private, no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer'
  }
})

const resolveSourceConfigForRequest = async (env, ctx, hostname, baseConfig, origin, requestUrl, selectedProject) => {
  if (isOfficialOrderingDashboardHost(hostname)) return { ...baseConfig, project: selectedProject }

  let project = deriveProjectFromHost(hostname, baseConfig)
  if (env.PROJECT && !project) project = env.PROJECT
  if (!project) project = env.PROJECT || baseConfig?.project
  if (!project) return null

  // Authenticated source endpoints must fail closed when a custom domain cannot be
  // mapped to its own project. The SEO resolver intentionally falls back for page uptime.
  if (baseConfig?.use_project_domain) {
    project = await validateProjectViaCurrentStrict(baseConfig, project, env, ctx, origin, requestUrl)
    if (!project) return null
  }
  return { ...baseConfig, project }
}

const removedMetasHandler = {
  element (element) {
    element.remove()
  }
}

const buildInjectionHandler = (seoData, firstLoad, runtimeConfig, pageSpecificTitle) => ({
  element (element) {
    if (runtimeConfig) {
      const payload = escapeJsonForScript(runtimeConfig)
      element.append(`<script>window.__CONFIG__ = ${payload};</script>`, { html: true })
    }

    if (firstLoad) {
      const payload = escapeJsonForScript(firstLoad)
      element.append(`<script>window.__FIRST_LOAD__ = ${payload};</script>`, { html: true })
    }

    if (pageSpecificTitle) {
      const payload = escapeJsonForScript({ title: pageSpecificTitle })
      element.append(`<script>window.__SEO__ = ${payload};</script>`, { html: true })
    }

    if (seoData?.metas && Array.isArray(seoData.metas)) {
      for (const meta of seoData.metas) {
        if (!meta || typeof meta.content === 'undefined' || meta.content === null) continue
        const content = String(meta.content)
        if (meta.name && meta.name !== 'title') {
          element.append(`<meta name="${escapeAttr(meta.name)}" content="${escapeAttr(content)}">`, { html: true })
        } else if (meta.property) {
          element.append(`<meta property="${escapeAttr(meta.property)}" content="${escapeAttr(content)}">`, { html: true })
        }
      }
    }

    if (seoData?.links && Array.isArray(seoData.links)) {
      let faviconIdAssigned = false
      for (const link of seoData.links) {
        if (!link || typeof link !== 'object' || !link.rel || !link.href) continue
        const linkWithId = (!faviconIdAssigned && link.rel === 'icon' && !link.id)
          ? { ...link, id: 'favicon' }
          : link
        if (linkWithId.id === 'favicon') faviconIdAssigned = true
        const attrs = Object.entries(linkWithId)
          .filter(([, v]) => v !== null && typeof v !== 'undefined' && typeof v !== 'object')
          .map(([k, v]) => `${escapeAttr(k)}="${escapeAttr(String(v))}"`)
          .join(' ')
        element.append(`<link ${attrs}>`, { html: true })
      }
    }
  }
})

const escapeAttr = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')

const isSafeRel = (rel) => /^[a-zA-Z0-9_-]+$/.test(rel)

const titleHandler = (newTitle) => ({
  element (element) {
    element.setInnerContent(newTitle)
  }
})

export default {
  async fetch (request, env, ctx) {
    const url = new URL(request.url)

    if (isSourceDownloadsPath(url.pathname)) {
      const preflight = sourceRequestPreflight(request)
      if (preflight) return preflight
      const selectedProject = request.headers.get(SOURCE_PROJECT_HEADER)
      if (isOfficialOrderingDashboardHost(url.hostname)
        ? !isValidSourceProjectSlug(selectedProject)
        : selectedProject !== null) return sourceProjectSelectionInvalid()
      const baseConfig = await loadBaseConfig(env, url.origin)
      if (!baseConfig) return sourceServiceUnavailable()
      const config = await resolveSourceConfigForRequest(env, ctx, url.hostname, baseConfig, url.origin, request.url, selectedProject)
      if (!config) return sourceServiceUnavailable()
      return handleSourceDownloadsRequest(request, env, config)
    }

    if (!isHtmlRequest(request, url)) {
      return env.ASSETS.fetch(request)
    }

    const baseConfig = await loadBaseConfig(env, url.origin)
    if (!baseConfig) {
      return env.ASSETS.fetch(request)
    }

    const config = await resolveConfigForRequest(env, ctx, url.hostname, baseConfig, url.origin, request.url)
    if (!config) {
      return env.ASSETS.fetch(request)
    }

    const seoPath = mapSeoEndpoint(url.pathname, url.searchParams)
    const routerCacheKey = sanitizeRouterCacheKey(request.headers.get('x-router-first-load-cache-key'), url.origin)

    const firstLoad = await fetchFirstLoad(config, env, ctx, url.origin, request.url, routerCacheKey)

    const seoConfig = firstLoad?.site?.code
      ? { ...config, app_id: firstLoad.site.code }
      : config

    let processedFirstLoad = firstLoad
    if (resolveBoolEnv(env.DISABLE_POWERED_BY, false) && firstLoad?.configs?.powered_by_ordering_module) {
      processedFirstLoad = {
        ...firstLoad,
        configs: {
          ...firstLoad.configs,
          powered_by_ordering_module: {
            ...firstLoad.configs.powered_by_ordering_module,
            value: false
          }
        }
      }
    }

    const seoData = await fetchSeo(seoConfig, seoPath, env, ctx, url.hostname)

    const response = await env.ASSETS.fetch(request)

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html')) {
      return response
    }

    const siteId = firstLoad?.site?.id
    const disablePoweredBy = resolveBoolEnv(env.DISABLE_POWERED_BY, false)
    const websiteThemeComponents = processedFirstLoad?.theme?.my_products?.components?.website_theme?.components
    const themeFranchiseId = websiteThemeComponents?.franchise_id ?? null

    const runtimeConfig = buildRuntimeConfig(seoConfig, {
      siteId,
      disablePoweredBy,
      franchiseSlug: themeFranchiseId
    })

    const seoTitle = getTitle(seoData)
    const siteName = processedFirstLoad?.theme?.my_products?.components?.website_settings?.components?.values?.name
    const pageSpecificTitle = seoPath !== '/seo/general' && seoTitle && seoTitle !== siteName ? seoTitle : null
    // The tab and link previews name the dashboard, not the project's website
    const newTitle = getDashboardTitle(processedFirstLoad, baseConfig)

    const officialOrderingHost = isOfficialOrderingDashboardHost(url.hostname)
    // Without a project favicon every host shows the Ordering.co favicon
    const defaultFaviconUrl = defaultAssetPath(env, '/favicon.png')
    const tenantFaviconUrl = processedFirstLoad?.configs?.dashboard_favicon?.value || defaultFaviconUrl
    const faviconRels = new Set(['icon', 'shortcut-icon', 'apple-touch-icon'])
    const seoLinks = [...(seoData?.links || [])].filter(link =>
      !officialOrderingHost || !faviconRels.has(String(link?.rel))
    )
    const hasTabIcon = seoLinks.some(l => l && String(l.rel) === 'icon' && l.href)
    let enrichedLinks = [...seoLinks]
    if (!hasTabIcon && tenantFaviconUrl) {
      enrichedLinks = [
        ...enrichedLinks,
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: tenantFaviconUrl, id: 'favicon' },
        { rel: 'shortcut-icon', type: 'image/png', href: tenantFaviconUrl },
        { rel: 'apple-touch-icon', type: 'image/png', href: tenantFaviconUrl }
      ]
    }
    const enrichedSeoData = seoData && typeof seoData === 'object'
      ? { ...withDashboardTitle(seoData, newTitle), links: enrichedLinks }
      : { links: enrichedLinks }

    const linkRels = new Set(
      (enrichedSeoData?.links || [])
        .map(l => l?.rel)
        .filter(r => typeof r === 'string' && isSafeRel(r))
    )

    const rewriter = new HTMLRewriter()
      .on('meta[name="description"]', removedMetasHandler)
      .on('meta[name="author"]', removedMetasHandler)
      .on('meta[name="generator"]', removedMetasHandler)
      .on('meta[property^="og:"]', removedMetasHandler)
      .on('meta[name^="og:"]', removedMetasHandler)
      .on('meta[name^="twitter:"]', removedMetasHandler)
      .on('head', buildInjectionHandler(enrichedSeoData, processedFirstLoad, runtimeConfig, pageSpecificTitle))

    for (const rel of linkRels) {
      rewriter.on(`link[rel="${rel}"]`, removedMetasHandler)
    }

    if (newTitle) {
      rewriter.on('title', titleHandler(newTitle))
    }

    const transformed = rewriter.transform(response)
    const finalResponse = new Response(transformed.body, transformed)
    finalResponse.headers.set('cache-control', 'private, no-store, no-cache, must-revalidate, max-age=0')
    finalResponse.headers.set('cdn-cache-control', 'no-store')
    finalResponse.headers.set('X-Debug-Config-Resolved', config ? 'yes' : 'no')
    finalResponse.headers.set('X-Debug-Project', config?.project || 'none')
    finalResponse.headers.set('X-Debug-FirstLoad-Fetched', firstLoad ? 'yes' : 'no')
    finalResponse.headers.set('X-Debug-Hostname', url.hostname)
    return finalResponse
  }
}
