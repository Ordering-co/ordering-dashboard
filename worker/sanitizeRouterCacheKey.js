import { ROUTER_CACHE_KEY_BASE } from './seo.js'

export const sanitizeRouterCacheKey = (rawKey, requestOrigin) => {
  if (typeof rawKey !== 'string' || rawKey.length > 1024) return null
  try {
    const parsed = new URL(rawKey)
    if (parsed.origin !== ROUTER_CACHE_KEY_BASE) return null
    return parsed.searchParams.get('origin') === requestOrigin ? rawKey : null
  } catch (_) {
    return null
  }
}
