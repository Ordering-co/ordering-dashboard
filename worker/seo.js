import { stripAutologinTokenFromUrl } from '../src/utils/stripAutologinQuery.js'
import { isOfficialOrderingDashboardHost } from '../src/utils/sourceDownloadsProject.js'

const ORDERING_DOMAINS = ['tryordering.com', 'ordering.co', 'orderingplus.com']
export { isOfficialOrderingDashboardHost }

export const isOrderingHost = (hostname) => {
  if (!hostname) return false
  return ORDERING_DOMAINS.some(d => hostname.includes(d))
}

export const deriveProjectFromHost = (hostname, baseConfig) => {
  if (!hostname || !baseConfig) return baseConfig?.project ?? null

  let candidate = hostname.split('.').slice(0, 1).join('')
  if (candidate.startsWith('v26-') && hostname.endsWith('orderingplus.com')) {
    candidate = candidate.replace('v26-', '')
  }

  const orderingHost = isOrderingHost(hostname)
  if (baseConfig.use_project_subdomain && orderingHost) return candidate
  if (baseConfig.use_project_domain && !orderingHost) return '_'
  return baseConfig.project ?? null
}

/**
 * First path segment reserved for SPA / API — must stay in sync with React Router paths in src/App.js
 * plus shared marketplace segments from other Ordering frontends (safe superset).
 */
const RESERVED_SEGMENTS = new Set([
  'home',
  'order_types',
  'wallets',
  'signup_business',
  'signup-driver',
  'password',
  'reset_password',
  'account',
  'profile',
  'verify',
  'messages',
  'help',
  'search',
  'business_search',
  'promotions',
  'checkout',
  'multi-checkout',
  'multi-cart',
  'multi-orders',
  'orders',
  'pages',
  'favorite',
  'giftme-callback',
  'sessions',
  'store',
  'login',
  'reward',
  'deliveries',
  'drivers-dashboard',
  'all-in-one',
  'appointments',
  'stores',
  'connect',
  'users',
  'intelligence',
  'delivery',
  'marketing',
  'loyalty',
  'gift-cards',
  'gift-cards-settings',
  'catering',
  'multi-business-checkout',
  'stripe-connect',
  'reservations',
  'cart-recovery',
  'my-products',
  'settings',
  'all-settings',
  'purchase',
  'support',
  'ordering-products'
])

const buildBusinessSeoPath = (businessSlug, categoryParam, productParam) => {
  const biz = encodeURIComponent(businessSlug)
  if (categoryParam && productParam) {
    return `/seo/business/${biz}/category/${encodeURIComponent(categoryParam)}/product/${encodeURIComponent(productParam)}`
  }
  if (categoryParam) {
    return `/seo/business/${biz}/category/${encodeURIComponent(categoryParam)}`
  }
  return `/seo/business/${biz}`
}

export const mapSeoEndpoint = (pathname, searchParams) => {
  const segments = pathname.split('/').filter(Boolean).map(decodeURIComponent)
  const categoryParam = searchParams?.get('category') || null
  const productParam = searchParams?.get('product') || null

  if (segments.length === 0 || segments[0] === 'home') {
    return '/seo/general'
  }

  if (segments[0] === 'pages' && segments[1]) {
    return `/seo/pages/slug/${encodeURIComponent(segments[1])}`
  }

  if (segments[0] === 'store') {
    const rest = segments.slice(1)
    if (rest.length === 1) {
      return buildBusinessSeoPath(rest[0], categoryParam, productParam)
    }
    if (rest.length === 2) {
      return `/seo/business/${encodeURIComponent(rest[0])}/category/${encodeURIComponent(rest[1])}${productParam ? `/product/${encodeURIComponent(productParam)}` : ''}`
    }
    if (rest.length === 3) {
      return `/seo/business/${encodeURIComponent(rest[0])}/category/${encodeURIComponent(rest[1])}/product/${encodeURIComponent(rest[2])}`
    }
    return '/seo/general'
  }

  if (!RESERVED_SEGMENTS.has(segments[0])) {
    if (segments.length === 1) {
      return buildBusinessSeoPath(segments[0], categoryParam, productParam)
    }
    if (segments.length === 2) {
      return `/seo/business/${encodeURIComponent(segments[0])}/category/${encodeURIComponent(segments[1])}${productParam ? `/product/${encodeURIComponent(productParam)}` : ''}`
    }
    if (segments.length === 3) {
      return `/seo/business/${encodeURIComponent(segments[0])}/category/${encodeURIComponent(segments[1])}/product/${encodeURIComponent(segments[2])}`
    }
  }

  return '/seo/general'
}

const DEFAULT_SEO_TTL = 3600
const DEFAULT_FIRST_LOAD_TTL = 300
const DEFAULT_MAX_RESPONSE_BYTES = 2 * 1024 * 1024
const MAX_STRICT_CURRENT_RESPONSE_BYTES = 16 * 1024
const DEFAULT_SEO_TIMEOUT_MS = 3000
const DEFAULT_FIRST_LOAD_TIMEOUT_MS = 4000

const resolvePositiveInt = (value, fallback) => {
  const parsed = parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const CACHE_VERSION = 'v1'
const SEO_CACHE_KEY_BASE = `https://ordering-dashboard.internal/${CACHE_VERSION}`
export const ROUTER_CACHE_KEY_BASE = 'https://ordering-dashboard-router.internal'

const FIRST_LOAD_PARAMS = 'features,configs,site(name,code,domain,temporal_domain,type,deployment_provider_settings,business(name,slug),franchise(name,slug)),theme'

const buildSeoCacheKey = (hostname, seoPath) =>
  `${SEO_CACHE_KEY_BASE}/seo?host=${encodeURIComponent(hostname || '')}&path=${encodeURIComponent(seoPath || '')}`

const buildFirstLoadCacheKey = (origin) =>
  `${ROUTER_CACHE_KEY_BASE}/first-load?origin=${encodeURIComponent(origin || '')}`

const buildCurrentCacheKey = (project) =>
  `${SEO_CACHE_KEY_BASE}/current?project=${encodeURIComponent(project || '')}`

const isCacheDisabled = (env) => {
  if (!env) return false
  const v = typeof env.DISABLE_CACHE === 'string' ? env.DISABLE_CACHE.trim().toLowerCase() : env.DISABLE_CACHE
  return v === true || v === 'true' || v === '1'
}

const cacheRead = async (cacheKeyUrl, env) => {
  if (!cacheKeyUrl || isCacheDisabled(env)) return null
  try {
    const cached = await caches.default.match(new Request(cacheKeyUrl, { method: 'GET' }))
    if (!cached) return null
    return await cached.json()
  } catch (_) {
    return null
  }
}

const cacheWrite = (cacheKeyUrl, data, ttlSeconds, ctx, env) => {
  if (!cacheKeyUrl || !ctx || isCacheDisabled(env)) return
  const res = new Response(JSON.stringify(data), {
    headers: {
      'content-type': 'application/json',
      'cache-control': `public, s-maxage=${ttlSeconds}`
    }
  })
  ctx.waitUntil(caches.default.put(new Request(cacheKeyUrl, { method: 'GET' }), res))
}

const readJsonWithLimit = async (response, maxBytes) => {
  const contentLength = parseInt(response.headers.get('content-length') || '0', 10)
  if (contentLength > maxBytes) return null

  const text = await response.text()
  if (text.length > maxBytes) return null

  try {
    return JSON.parse(text)
  } catch (_) {
    return null
  }
}

const readJsonStreamWithByteLimit = async (response, maxBytes) => {
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    try { await response.body?.cancel() } catch (_) {}
    return null
  }
  if (!response.body) return null

  const reader = response.body.getReader()
  const chunks = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
    }
  } catch (_) {
    try { await reader.cancel() } catch (_) {}
    return null
  }

  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch (_) {
    return null
  }
}

export const buildOrderingApiHeaders = (config, origin, requestUrl) => {
  const headers = { accept: 'application/json' }
  if (config?.app_id) headers['x-app-x'] = config.app_id
  if (origin) headers.origin = origin
  if (requestUrl) headers.referer = stripAutologinTokenFromUrl(requestUrl)
  return headers
}

export const validateProjectViaCurrent = async (baseConfig, project, env, ctx, origin, requestUrl) => {
  if (!baseConfig?.api?.url || !project) return project ?? null

  const cacheKeyUrl = `${buildCurrentCacheKey(project)}&origin=${encodeURIComponent(origin || '')}`
  const cached = await cacheRead(cacheKeyUrl, env)
  if (cached?.code) return cached.code

  const base = baseConfig.api.url.replace(/\/$/, '')
  const version = baseConfig.api.version ?? 'v400'
  const language = baseConfig.api.language ?? 'en'
  const url = `${base}/${version}/${language}/${project}/current`

  try {
    const headers = buildOrderingApiHeaders(baseConfig, origin, requestUrl)

    const response = await fetch(url, {
      signal: AbortSignal.timeout(resolvePositiveInt(env.FIRST_LOAD_TIMEOUT_MS, DEFAULT_FIRST_LOAD_TIMEOUT_MS)),
      headers
    })
    if (!response.ok) {
      console.warn('validateProjectViaCurrent failed', { status: response.status, project, origin })
      return baseConfig.project ?? project
    }
    const json = await readJsonWithLimit(response, resolvePositiveInt(env.MAX_RESPONSE_BYTES, DEFAULT_MAX_RESPONSE_BYTES))
    if (!json || json.error || !json.result?.code) {
      console.warn('validateProjectViaCurrent returned invalid payload', { project, origin, hasJson: !!json, error: json?.error })
      return baseConfig.project ?? project
    }

    cacheWrite(cacheKeyUrl, { code: json.result.code }, resolvePositiveInt(env.FIRST_LOAD_TTL, DEFAULT_FIRST_LOAD_TTL), ctx, env)
    return json.result.code
  } catch (error) {
    console.warn('validateProjectViaCurrent threw', { project, origin, message: error?.message })
    return baseConfig.project ?? project
  }
}

/** Resolve a tenant for authenticated source-download routes without falling back to another project. */
export const validateProjectViaCurrentStrict = async (baseConfig, project, env, ctx, origin, requestUrl) => {
  if (!baseConfig?.api?.url || !project) return null

  const cacheKeyUrl = `${buildCurrentCacheKey(project)}&origin=${encodeURIComponent(origin || '')}`
  const cached = await cacheRead(cacheKeyUrl, env)
  if (typeof cached?.code === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(cached.code)) return cached.code

  const base = baseConfig.api.url.replace(/\/$/, '')
  const version = baseConfig.api.version ?? 'v400'
  const language = baseConfig.api.language ?? 'en'
  const url = `${base}/${version}/${language}/${project}/current`

  try {
    const headers = buildOrderingApiHeaders(baseConfig, origin, requestUrl)
    const response = await fetch(url, {
      signal: AbortSignal.timeout(resolvePositiveInt(env.FIRST_LOAD_TIMEOUT_MS, DEFAULT_FIRST_LOAD_TIMEOUT_MS)),
      headers,
      cache: 'no-store',
      redirect: 'manual'
    })
    if (response.status >= 300 && response.status < 400) return null
    if (!response.ok) return null
    const json = await readJsonStreamWithByteLimit(response, MAX_STRICT_CURRENT_RESPONSE_BYTES)
    const code = json?.result?.code
    if (!json || json.error || typeof code !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(code)) return null

    cacheWrite(cacheKeyUrl, { code }, resolvePositiveInt(env.FIRST_LOAD_TTL, DEFAULT_FIRST_LOAD_TTL), ctx, env)
    return code
  } catch (_) {
    return null
  }
}

const buildApiBase = (config) => {
  const base = config?.api?.url?.replace(/\/$/, '') ?? ''
  const version = config?.api?.version ?? 'v400'
  const language = config?.api?.language ?? 'en'
  const project = config?.project ?? ''
  return `${base}/${version}/${language}/${project}`
}

export const fetchSeo = async (config, seoPath, env, ctx, hostname) => {
  if (!config || !seoPath) return null

  const url = `${buildApiBase(config)}${seoPath}?type=advanced`
  const cacheKeyUrl = buildSeoCacheKey(hostname, seoPath)

  const cached = await cacheRead(cacheKeyUrl, env)
  if (cached) return cached

  try {
    const headers = { accept: 'application/json' }
    if (config.app_id) headers['x-app-x'] = config.app_id

    const response = await fetch(url, {
      signal: AbortSignal.timeout(resolvePositiveInt(env.SEO_TIMEOUT_MS, DEFAULT_SEO_TIMEOUT_MS)),
      headers
    })
    if (!response.ok) return null
    const json = await readJsonWithLimit(response, resolvePositiveInt(env.MAX_RESPONSE_BYTES, DEFAULT_MAX_RESPONSE_BYTES))
    if (!json || json.error || !json.result) return null

    cacheWrite(cacheKeyUrl, json.result, resolvePositiveInt(env.SEO_TTL, DEFAULT_SEO_TTL), ctx, env)
    return json.result
  } catch (_) {
    return null
  }
}

export const fetchFirstLoad = async (config, env, ctx, origin, requestUrl, routerCacheKey) => {
  if (!config) return null

  const cacheKeyUrl = routerCacheKey || buildFirstLoadCacheKey(origin)

  const cached = await cacheRead(cacheKeyUrl, env)
  if (cached) {
    if (cached.result) return cached.result
    return cached
  }

  const base = config?.api?.url?.replace(/\/$/, '') ?? ''
  const version = config?.api?.version ?? 'v400'
  const language = config?.api?.language ?? 'en'
  const params = encodeURIComponent(FIRST_LOAD_PARAMS)
  const urls = [`${base}/${version}/${language}/${config.project}/frontends/first_load?params=${params}`]

  const headers = buildOrderingApiHeaders(config, origin, requestUrl)

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(resolvePositiveInt(env.FIRST_LOAD_TIMEOUT_MS, DEFAULT_FIRST_LOAD_TIMEOUT_MS)),
        headers
      })
      if (!response.ok) {
        console.warn('fetchFirstLoad failed', { status: response.status, url, origin, project: config.project })
        continue
      }
      const json = await readJsonWithLimit(response, resolvePositiveInt(env.MAX_RESPONSE_BYTES, DEFAULT_MAX_RESPONSE_BYTES))
      if (!json || json.error || !json.result) {
        console.warn('fetchFirstLoad returned invalid payload', { url, origin, project: config.project, hasJson: !!json, error: json?.error })
        continue
      }

      cacheWrite(cacheKeyUrl, json, resolvePositiveInt(env.FIRST_LOAD_TTL, DEFAULT_FIRST_LOAD_TTL), ctx, env)
      return json.result
    } catch (error) {
      console.warn('fetchFirstLoad threw', { url, origin, project: config.project, message: error?.message })
    }
  }

  return null
}

export const getTitle = (seoData) => {
  const innerHtml = seoData?.title?.innerHtml
  if (typeof innerHtml === 'string' && innerHtml.length > 0) return innerHtml

  const metas = seoData?.metas
  if (!Array.isArray(metas)) return null
  const entry = metas.find(m => m?.name === 'title' && typeof m?.content === 'string')
  return entry?.content ?? null
}

export const escapeJsonForScript = (value) => {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

export const DEFAULT_DASHBOARD_TITLE = 'Ordering.co Dashboard'
const TITLE_META_KEYS = new Set(['title', 'og:title', 'twitter:title', 'og:site_name'])

/**
 * The dashboard's own name for the tab and link previews: the project's
 * `dashboard_title`, else the app name from config.json. Never the project's
 * website SEO title (that one names the marketplace, e.g. "OrderingPlus.com").
 */
export const getDashboardTitle = (firstLoad, baseConfig) => {
  const projectTitle = firstLoad?.configs?.dashboard_title?.value
  if (typeof projectTitle === 'string' && projectTitle.trim()) return projectTitle.trim()
  const appName = baseConfig?.app_name
  if (typeof appName === 'string' && appName.trim()) return appName.trim()
  return DEFAULT_DASHBOARD_TITLE
}

/** Same SEO data with every title meta (title, og:title, twitter:title, og:site_name) set to `title`. */
export const withDashboardTitle = (seoData, title) => {
  if (!seoData || typeof seoData !== 'object' || !Array.isArray(seoData.metas)) return seoData
  return {
    ...seoData,
    metas: seoData.metas.map(meta => {
      const key = meta?.name || meta?.property
      return meta && TITLE_META_KEYS.has(key) ? { ...meta, content: title } : meta
    })
  }
}
