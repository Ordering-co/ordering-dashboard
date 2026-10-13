const PLACEHOLDER_ASSETS = new Set([
  '/default-favicon.png',
  '/default-logo.png',
  '/favicon.png'
])

const configuredAsset = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  try {
    const path = raw.includes('://') ? new URL(raw).pathname : raw.split('?')[0]
    return path && !PLACEHOLDER_ASSETS.has(path) ? raw : ''
  } catch (_) {
    return raw
  }
}

export const hasCustomFavicon = (customFavicon) => !!configuredAsset(customFavicon)

export const resolveEffectiveFaviconPreview = (customFavicon, siteLogo) =>
  configuredAsset(customFavicon) || configuredAsset(siteLogo) || ''
