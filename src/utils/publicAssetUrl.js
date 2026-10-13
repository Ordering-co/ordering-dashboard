/**
 * Prefix root-relative public URLs with Vite `base` (subpath / CDN deploys).
 * Leaves absolute (http/https), data:, and blob: URLs unchanged.
 */
export function publicAssetUrl (path) {
  if (path == null || path === '') return path
  const s = String(path).trim()
  if (/^(https?:)?\/\//i.test(s) || s.startsWith('data:') || s.startsWith('blob:')) return s
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'
  const rel = s.replace(/^\//, '')
  if (!base || base === '/') return `/${rel}`
  const prefix = base.endsWith('/') ? base : `${base}/`
  return `${prefix}${rel}`
}
