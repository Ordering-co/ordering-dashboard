const CATALOG_KEY = 'source-distributions/catalog.json'
const STORAGE_PREFIX = 'source-distributions'
const MAX_CATALOG_BYTES = 1024 * 1024
const MAX_IDENTITY_BYTES = 16 * 1024
const IDENTITY_TIMEOUT_MS = 5000
const ALLOWED_LEVELS = new Set([0])
const ALLOWED_PRODUCT_ID = 'website-marketplace'
const VERSION_PATTERN = /^v\d{4}\.\d{2}\.\d{2}\.\d{6}$/
const SHA_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i
const SHA256_PATTERN = /^[a-f0-9]{64}$/i
const FILENAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}\.zip$/i
const LOCALE_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/

const responseHeaders = {
  'cache-control': 'private, no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer'
}

const jsonResponse = (status, code, message) => new Response(JSON.stringify({
  error: { code, message }
}), {
  status,
  headers: {
    ...responseHeaders,
    'content-type': 'application/json; charset=utf-8'
  }
})

const notFound = () => jsonResponse(404, 'not_found', 'The requested source download was not found.')
const unavailable = (code = 'source_downloads_unavailable') => jsonResponse(
  503,
  code,
  'Source downloads are temporarily unavailable.'
)

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isNonEmptyString = (value, max = 4096) => typeof value === 'string' && value.trim().length > 0 && value.length <= max

const apiMeUrl = (config) => {
  const apiUrl = config?.api?.url
  const version = config?.api?.version || 'v400'
  const language = config?.api?.language || 'en'
  const project = config?.project
  if (!isNonEmptyString(apiUrl, 2048) || !isNonEmptyString(version, 32) || !isNonEmptyString(language, 16) || !isNonEmptyString(project, 128)) return null

  let parsedApiUrl
  try {
    parsedApiUrl = new URL(apiUrl)
  } catch (_) {
    return null
  }
  const localHttp = ['localhost', '127.0.0.1', '[::1]'].includes(parsedApiUrl.hostname)
  if (parsedApiUrl.protocol !== 'https:' && !(localHttp && parsedApiUrl.protocol === 'http:')) return null

  const base = apiUrl.replace(/\/+$/, '')
  return `${base}/${encodeURIComponent(version)}/${encodeURIComponent(language)}/${encodeURIComponent(project)}/users/me?params=id,level,enabled`
}

const readJsonLimited = async (response, maxBytes) => {
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > maxBytes) return null
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

const verifyBearer = async (request, config, fetchImpl) => {
  const authorization = request.headers.get('authorization') || ''
  const match = /^Bearer\s+([^\s,]+)$/i.exec(authorization)
  if (!match) return { response: jsonResponse(401, 'authentication_required', 'A valid dashboard session is required.') }

  const url = apiMeUrl(config)
  if (!url) return { response: unavailable('identity_service_unavailable') }
  const headers = {
    accept: 'application/json',
    authorization: `Bearer ${match[1]}`
  }
  if (isNonEmptyString(config?.app_id, 256)) headers['x-app-x'] = config.app_id

  let upstream
  try {
    upstream = await fetchImpl(url, {
      method: 'GET',
      headers,
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(IDENTITY_TIMEOUT_MS)
    })
  } catch (_) {
    return { response: unavailable('identity_service_unavailable') }
  }

  if (upstream.status >= 300 && upstream.status < 400) {
    return { response: unavailable('identity_service_unavailable') }
  }
  if (upstream.status === 401) {
    return { response: jsonResponse(401, 'invalid_session', 'A valid dashboard session is required.') }
  }
  if (!upstream.ok) return { response: unavailable('identity_service_unavailable') }

  const payload = await readJsonLimited(upstream, MAX_IDENTITY_BYTES)
  const user = payload?.result
  if (!isRecord(payload) || payload.error !== false || !isRecord(user) ||
      (typeof user.id !== 'string' && typeof user.id !== 'number') ||
      (typeof user.id === 'string' && !user.id.trim()) ||
      !Number.isInteger(user.level) || typeof user.enabled !== 'boolean') {
    return { response: unavailable('identity_response_invalid') }
  }
  if (!user.enabled || !ALLOWED_LEVELS.has(user.level)) {
    return { response: jsonResponse(403, 'forbidden', 'This account cannot access source downloads.') }
  }
  return { user }
}

/** Reject anonymous and URL-token requests before resolving any tenant or reading storage. */
export const sourceRequestPreflight = request => {
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.searchParams.has('token') || url.searchParams.has('access_token')) return notFound()
  if (!/^Bearer\s+([^\s,]+)$/i.test(request.headers.get('authorization') || '')) {
    return jsonResponse(401, 'authentication_required', 'A valid dashboard session is required.')
  }
  return null
}

const localizedRecord = (value) => {
  if (!isRecord(value)) return null
  const result = {}
  for (const [locale, text] of Object.entries(value)) {
    if (!LOCALE_PATTERN.test(locale) || typeof text !== 'string' || text.length > 256 * 1024) return null
    result[locale] = text
  }
  return result
}

const versionMatchesPublishedAt = (version, publishedAt) => {
  const timestamp = Date.parse(publishedAt)
  if (!Number.isFinite(timestamp)) return false
  const fixedCst = new Date(timestamp - (6 * 60 * 60 * 1000))
  const date = [
    String(fixedCst.getUTCFullYear()).padStart(4, '0'),
    String(fixedCst.getUTCMonth() + 1).padStart(2, '0'),
    String(fixedCst.getUTCDate()).padStart(2, '0')
  ].join('.')
  const time = [
    String(fixedCst.getUTCHours()).padStart(2, '0'),
    String(fixedCst.getUTCMinutes()).padStart(2, '0'),
    String(fixedCst.getUTCSeconds()).padStart(2, '0')
  ].join('')
  return version === `v${date}.${time}`
}

const sanitizeProduct = (value) => {
  if (!isRecord(value) || value.id !== ALLOWED_PRODUCT_ID ||
      value.name !== 'Website Marketplace' ||
      !VERSION_PATTERN.test(value.version || '') ||
      !isNonEmptyString(value.publishedAt, 64) ||
      !/(?:Z|[+-]\d{2}:\d{2})$/.test(value.publishedAt) ||
      !versionMatchesPublishedAt(value.version, value.publishedAt) ||
      value.timezone !== 'UTC-06:00' ||
      !SHA_PATTERN.test(value.sourceSha || '') ||
      !Array.isArray(value.submodules) || value.submodules.length < 1 || value.submodules.length > 20 ||
      !isRecord(value.license) || !isNonEmptyString(value.license.id, 120) ||
      !isNonEmptyString(value.license.text, 64 * 1024) ||
      !isRecord(value.artifact) || value.artifact.filename !== `${value.id}-${value.version}.zip` ||
      !FILENAME_PATTERN.test(value.artifact.filename || '') ||
      !Number.isSafeInteger(value.artifact.sizeBytes) || value.artifact.sizeBytes <= 0 ||
      !SHA256_PATTERN.test(value.artifact.sha256 || '')) return null

  const descriptionByLocale = localizedRecord(value.descriptionByLocale)
  const instructionsByLocale = localizedRecord(value.instructionsByLocale)
  if (!descriptionByLocale || !instructionsByLocale) return null

  const submodules = []
  for (const submodule of value.submodules) {
    if (!isRecord(submodule) || !isNonEmptyString(submodule.path, 512) ||
        submodule.path.startsWith('/') || submodule.path.split('/').includes('..') ||
        !SHA_PATTERN.test(submodule.sha || '')) return null
    submodules.push({ path: submodule.path, sha: submodule.sha })
  }

  return {
    id: value.id,
    name: value.name,
    descriptionByLocale,
    version: value.version,
    publishedAt: value.publishedAt,
    timezone: value.timezone,
    sourceSha: value.sourceSha,
    submodules,
    license: { id: value.license.id, text: value.license.text },
    instructionsByLocale,
    artifact: {
      filename: value.artifact.filename,
      sizeBytes: value.artifact.sizeBytes,
      sha256: value.artifact.sha256.toLowerCase()
    }
  }
}

const sanitizeCatalog = (value) => {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.products) || value.products.length > 100) return null
  const products = []
  const seen = new Set()
  for (const rawProduct of value.products) {
    const product = sanitizeProduct(rawProduct)
    if (!product) return null
    const releaseKey = `${product.id}\0${product.version}`
    if (seen.has(releaseKey)) return null
    seen.add(releaseKey)
    products.push(product)
  }
  return { schemaVersion: 1, products }
}

const readCatalog = async (bucket) => {
  if (!bucket || typeof bucket.get !== 'function') return { response: unavailable('catalog_unavailable') }
  let object
  try {
    object = await bucket.get(CATALOG_KEY)
  } catch (error) {
    return { response: unavailable(error?.code === 'unsafe_fixture_config' ? 'unsafe_fixture_config' : 'catalog_unavailable') }
  }
  if (!object || !Number.isSafeInteger(object.size) || object.size < 1 || object.size > MAX_CATALOG_BYTES || !object.body) {
    return { response: unavailable('catalog_unavailable') }
  }
  const payload = await readJsonLimited(new Response(object.body, {
    headers: { 'content-length': String(object.size) }
  }), MAX_CATALOG_BYTES)
  const catalog = sanitizeCatalog(payload)
  return catalog ? { catalog } : { response: unavailable('catalog_invalid') }
}

const digestHex = (value) => {
  if (!(value instanceof ArrayBuffer) && !ArrayBuffer.isView(value)) return null
  const bytes = value instanceof ArrayBuffer
    ? new Uint8Array(value)
    : new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

export const getPrivateArtifactKey = (product) =>
  `${STORAGE_PREFIX}/${product.id}/${product.version}/${product.id}-${product.version}.zip`

const catalogResponse = (catalog) => new Response(JSON.stringify(catalog), {
  status: 200,
  headers: {
    ...responseHeaders,
    'content-type': 'application/json; charset=utf-8'
  }
})

const downloadResponse = async (bucket, product) => {
  if (!bucket || typeof bucket.get !== 'function') return unavailable('artifact_unavailable')

  let object
  try {
    object = await bucket.get(getPrivateArtifactKey(product))
  } catch (error) {
    return unavailable(error?.code === 'unsafe_fixture_config' ? 'unsafe_fixture_config' : 'artifact_unavailable')
  }
  if (!object || !object.body || object.size !== product.artifact.sizeBytes) {
    return unavailable('artifact_unavailable')
  }

  const storedSha256 = digestHex(object.checksums?.sha256)
  if (!storedSha256 || storedSha256.toLowerCase() !== product.artifact.sha256) {
    return unavailable('artifact_integrity_failed')
  }
  const customSha256 = object.customMetadata?.sha256
  if (typeof customSha256 !== 'string' || !SHA256_PATTERN.test(customSha256) ||
      customSha256.toLowerCase() !== product.artifact.sha256) {
    return unavailable('artifact_integrity_failed')
  }

  return new Response(object.body, {
    status: 200,
    headers: {
      ...responseHeaders,
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${product.artifact.filename}"`,
      'content-length': String(object.size)
    }
  })
}

/** Route source-download requests after the caller resolves API/project config from the request host. */
export const handleSourceDownloadsRequest = async (request, env, config, fetchImpl = fetch) => {
  const url = new URL(request.url)
  const preflight = sourceRequestPreflight(request)
  if (preflight) return preflight

  const auth = await verifyBearer(request, config, fetchImpl)
  if (auth.response) return auth.response

  if (url.pathname === '/api/source-catalog') {
    const result = await readCatalog(env?.SOURCE_DOWNLOADS)
    return result.catalog ? catalogResponse(result.catalog) : result.response
  }

  const match = /^\/api\/source-downloads\/([a-z0-9-]+)\/([^/]+)$/.exec(url.pathname)
  if (!match) return notFound()
  let version
  try {
    version = decodeURIComponent(match[2])
  } catch (_) {
    return notFound()
  }
  if (version.includes('/') || version.includes('\\')) return notFound()

  const result = await readCatalog(env?.SOURCE_DOWNLOADS)
  if (!result.catalog) return result.response
  const product = result.catalog.products.find(item => item.id === match[1] && item.version === version)
  if (!product) return notFound()
  return downloadResponse(env.SOURCE_DOWNLOADS, product)
}

export const sourceDownloadsConstants = Object.freeze({
  catalogKey: CATALOG_KEY,
  allowedLevels: [0],
  allowedProductId: ALLOWED_PRODUCT_ID,
  storagePrefix: STORAGE_PREFIX
})
