// Raw-fetch wrappers for the project Builder endpoints (not wrapped by the SDK).
// Base: {root}/{backoffice internal_name}/builder, e.g. /v400/en/development/dashboard/builder

/** App product types the Builder section lists and creates. */
export const BUILDER_APP_TYPES = ['marketplace_app', 'franchise_app', 'store_app', 'driver_app', 'kiosk_app']

/** Website product types: only their site, no base, app or build. */
export const BUILDER_WEB_TYPES = ['marketplace_website', 'franchise_website', 'dashboard']

/** Every type the section lists: apps and websites. */
export const BUILDER_PRODUCT_TYPES = [...BUILDER_APP_TYPES, ...BUILDER_WEB_TYPES]

export const BUILDER_PRODUCT_STATUSES = ['draft', 'active', 'archived']

export const BUILDER_PAGE_SIZE_MAX = 50

/** Error codes the API sends for module, access and record states. */
export const BUILDER_ERROR_CODES = {
  disabled: 'builder.disabled',
  unauthorized: 'auth:00',
  notFound: 'product.not_found',
  baseNotOffered: 'builder_base.not_offered',
  appNotFound: 'app.not_found'
}

const jsonHeaders = (token) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`
})

/** For multipart bodies: the browser sets the Content-Type with its boundary. */
const authHeaders = (token) => ({ Authorization: `Bearer ${token}` })

export const getBuilderBaseUrl = (ordering) =>
  `${ordering.root}/${ordering.appInternalName || 'dashboard'}/builder`

const request = async (url, options) => {
  try {
    const response = await fetch(url, options)
    let body = {}
    try {
      body = await response.json()
    } catch (err) {
      body = { error: true, result: [err.message] }
    }
    const error = !!body?.error || !response.ok
    return {
      status: response.status,
      error,
      result: body?.result,
      errorCodes: Array.isArray(body?.error_codes) ? body.error_codes : [],
      pagination: body?.pagination,
      // What a refusal lists as missing (build.blocked, product.incomplete)
      checks: body?.checks,
      // Where a domain's CNAME record must point (domain.cname_missing)
      cnameTarget: body?.cname_target,
      // What a product misses besides its apps' checks (product.incomplete), like `name`
      missing: body?.missing
    }
  } catch (err) {
    return { status: 0, error: true, result: [err.message], errorCodes: [] }
  }
}

/**
 * Standard `where` list: `name` ilike, and `product_type` / `product_status`
 * as `IN` lists. An empty search sends no name condition.
 */
export const buildProductsWhere = ({ search, productTypes = BUILDER_PRODUCT_TYPES, productStatuses } = {}) => {
  const conditions = []
  const text = String(search ?? '').trim()
  if (text) {
    conditions.push({ attribute: 'name', value: { condition: 'ilike', value: `%${text}%` } })
  }
  if (productTypes?.length) {
    conditions.push({ attribute: 'product_type', value: productTypes })
  }
  if (productStatuses?.length) {
    conditions.push({ attribute: 'product_status', value: productStatuses })
  }
  return conditions
}

/**
 * What the project can create: the app bases (`kind: 'app'`) and one entry
 * per website type (`kind: 'web'`, `id: null`). Without `kind` the API
 * answers only the apps, so it is always asked for both.
 */
export const getBuilderCatalog = (ordering, token) =>
  request(`${getBuilderBaseUrl(ordering)}/catalog?kind=app,web`, { method: 'GET', headers: jsonHeaders(token) })

export const listBuilderProducts = (ordering, token, { page = 1, pageSize = 10, search, productTypes, productStatuses } = {}) => {
  const query = new URLSearchParams({
    page: String(page),
    page_size: String(Math.min(pageSize, BUILDER_PAGE_SIZE_MAX)),
    where: JSON.stringify(buildProductsWhere({ search, productTypes, productStatuses }))
  })
  return request(`${getBuilderBaseUrl(ordering)}/products?${query.toString()}`, { method: 'GET', headers: jsonHeaders(token) })
}

export const getBuilderProduct = (ordering, token, productId) =>
  request(`${getBuilderBaseUrl(ordering)}/products/${encodeURIComponent(productId)}`, { method: 'GET', headers: jsonHeaders(token) })

/** An app from its base (`builderBaseId`) or a website from its `productType`, never both. */
export const createBuilderProduct = (ordering, token, { builderBaseId, productType, name }) =>
  request(`${getBuilderBaseUrl(ordering)}/products`, {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(builderBaseId ? { builder_base_id: builderBaseId, name } : { product_type: productType, name })
  })

/**
 * Moves a product to draft, active or archived. Going to active from another
 * status is refused with `product.incomplete` while an app misses something.
 */
export const updateBuilderProductStatus = (ordering, token, productId, productStatus) =>
  request(`${getBuilderBaseUrl(ordering)}/products/${encodeURIComponent(productId)}/status`, {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify({ product_status: productStatus })
  })

/** Renames the product (the site). The app's name in the stores is separate. */
export const updateBuilderProduct = (ordering, token, productId, { name }) =>
  request(`${getBuilderBaseUrl(ordering)}/products/${encodeURIComponent(productId)}`, {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify({ name })
  })

const productUrl = (ordering, productId) => `${getBuilderBaseUrl(ordering)}/products/${encodeURIComponent(productId)}`

/**
 * The product's push accounts: `{ firebase: { source, project_id, client_email } }`,
 * `source` being `site` (its own), `project` or null. The private key never comes back.
 */
export const getBuilderProductPush = (ordering, token, productId) =>
  request(`${productUrl(ordering, productId)}/push`, { method: 'GET', headers: jsonHeaders(token) })

/** Saves the product's own Firebase service account, the downloaded JSON as text. */
export const saveBuilderProductFirebase = (ordering, token, productId, serviceAccount) =>
  request(`${productUrl(ordering, productId)}/push/firebase`, {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({ service_account: serviceAccount })
  })

/** Drops the product's own Firebase account: its pushes go back to the project's. */
export const removeBuilderProductFirebase = (ordering, token, productId) =>
  request(`${productUrl(ordering, productId)}/push/firebase`, { method: 'DELETE', headers: jsonHeaders(token) })

/**
 * A website's domains: `{ temporal_domain, cname_target, own }`,
 * `own` being null or `{ name, status, error_code }` with `status`
 * `pending`, `active` or `error`. An app answers `product.not_web`.
 */
export const getBuilderProductDomain = (ordering, token, productId) =>
  request(`${productUrl(ordering, productId)}/domain`, { method: 'GET', headers: jsonHeaders(token) })

/**
 * Sets the website's own domain, or changes it: the previous one stops
 * serving it. Its CNAME record must already point to `cname_target`.
 */
export const saveBuilderProductDomain = (ordering, token, productId, domain) =>
  request(`${productUrl(ordering, productId)}/domain`, {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify({ domain })
  })

/** Drops the own domain: the website stays at its temporary one. */
export const removeBuilderProductDomain = (ordering, token, productId) =>
  request(`${productUrl(ordering, productId)}/domain`, { method: 'DELETE', headers: jsonHeaders(token) })

/** Sets up a failed domain again, once its CNAME record points here. */
export const verifyBuilderProductDomain = (ordering, token, productId) =>
  request(`${productUrl(ordering, productId)}/domain/verify`, { method: 'POST', headers: jsonHeaders(token) })

const appUrl = (ordering, productId, appId) =>
  `${getBuilderBaseUrl(ordering)}/products/${encodeURIComponent(productId)}/apps/${encodeURIComponent(appId)}`

/** Changes the fields sent ({name, description, version, package}); the rest stay. */
export const updateBuilderApp = (ordering, token, productId, appId, fields) =>
  request(appUrl(ordering, productId, appId), { method: 'PUT', headers: jsonHeaders(token), body: JSON.stringify(fields) })

/** Same fields for one platform; a field sent as null takes the app's again. */
export const updateBuilderAppPlatform = (ordering, token, productId, appId, platform, fields) =>
  request(`${appUrl(ordering, productId, appId)}/platforms/${encodeURIComponent(platform)}`, {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify(fields)
  })

/** What the next build of the app would get wrong, per platform. */
export const getBuilderAppChecks = (ordering, token, productId, appId) =>
  request(`${appUrl(ordering, productId, appId)}/checks`, { method: 'GET', headers: jsonHeaders(token) })

const buildsUrl = (ordering, productId, appId) => `${appUrl(ordering, productId, appId)}/builds`

/**
 * Asks for a build in a store mode: iOS `ad-hoc` or `app-store`, Android
 * `release` with `type` `assemble` (APK) or `bundle` (AAB). Answers the new
 * attempt, `pending`; `build.blocked` lists what is missing in `checks`.
 */
export const requestBuilderBuild = (ordering, token, productId, appId, { platform, mode, type }) =>
  request(buildsUrl(ordering, productId, appId), {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(platform === 'android' ? { platform, mode, type } : { platform, mode })
  })

/** The app's builds, newest first, by `platform` and `statuses` (any of them). */
export const listBuilderBuilds = (ordering, token, productId, appId, { page = 1, pageSize = 10, platform, statuses } = {}) => {
  const query = new URLSearchParams({
    page: String(page),
    page_size: String(Math.min(pageSize, BUILDER_PAGE_SIZE_MAX))
  })
  if (platform) query.set('platform', platform)
  if (statuses?.length) query.set('status', statuses.join(','))
  return request(`${buildsUrl(ordering, productId, appId)}?${query.toString()}`, { method: 'GET', headers: jsonHeaders(token) })
}

/**
 * Per platform: the latest attempt, the latest successful one and
 * `pending_changes`. It reads the storage, so it is asked for on opening
 * the detail and after changes, never from the list.
 */
export const getBuilderLatestBuilds = (ordering, token, productId, appId) =>
  request(`${buildsUrl(ordering, productId, appId)}/latest`, { method: 'GET', headers: jsonHeaders(token) })

/** The Jenkins log of an attempt, as plain text. */
export const getBuilderBuildLog = (ordering, token, productId, appId, attemptId) =>
  request(`${buildsUrl(ordering, productId, appId)}/${encodeURIComponent(attemptId)}/log`, { method: 'GET', headers: jsonHeaders(token) })

/** A link to the attempt's file that lasts 15 minutes: ask for it on click. */
export const getBuilderBuildDownload = (ordering, token, productId, appId, attemptId) =>
  request(`${buildsUrl(ordering, productId, appId)}/${encodeURIComponent(attemptId)}/download`, { method: 'GET', headers: jsonHeaders(token) })

/** Builds the attempt again with its own settings. Answers the new attempt. */
export const retryBuilderBuild = (ordering, token, productId, appId, attemptId) =>
  request(`${buildsUrl(ordering, productId, appId)}/${encodeURIComponent(attemptId)}/retry`, { method: 'POST', headers: jsonHeaders(token) })

/** Answers the attempt, cancelled. */
export const cancelBuilderBuild = (ordering, token, productId, appId, attemptId) =>
  request(`${buildsUrl(ordering, productId, appId)}/${encodeURIComponent(attemptId)}/cancel`, { method: 'POST', headers: jsonHeaders(token) })

/**
 * The public route that installs the latest ad hoc build on an iPhone. It
 * needs no session: opened on an iPhone it redirects to `itms-services`.
 */
export const getBuilderAdHocInstallUrl = (ordering, appId) =>
  `${ordering.root}/builder/apps/${encodeURIComponent(appId)}/downloads/ios/ad-hoc/ipa`

/**
 * Every page of a paginated app list. The API ignores a page_size over 50
 * (it falls back to 10), so pages are read at 50 until `total_pages`.
 */
const listAllPages = async (url, token, where) => {
  const items = []
  let page = 1
  let totalPages = 1
  do {
    const query = new URLSearchParams({ page: String(page), page_size: String(BUILDER_PAGE_SIZE_MAX) })
    if (where?.length) query.set('where', JSON.stringify(where))
    const response = await request(`${url}?${query.toString()}`, { method: 'GET', headers: jsonHeaders(token) })
    if (response.error) return response
    items.push(...(Array.isArray(response.result) ? response.result : []))
    totalPages = Number(response.pagination?.total_pages) || 1
    page += 1
  } while (page <= totalPages)
  return { status: 200, error: false, result: items, errorCodes: [] }
}

/** Colors, images, files and texts of the app, optionally of one `group`. */
export const listBuilderAppSettings = (ordering, token, productId, appId, { group } = {}) =>
  listAllPages(
    `${appUrl(ordering, productId, appId)}/settings`,
    token,
    group ? [{ attribute: 'group', value: group }] : null
  )

/** Sets a color or text setting. */
export const updateBuilderAppSetting = (ordering, token, productId, appId, settingId, value) =>
  request(`${appUrl(ordering, productId, appId)}/settings/${encodeURIComponent(settingId)}`, {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify({ value })
  })

/** Uploads the file of a file setting, checked against its `file_rules`. */
export const uploadBuilderAppSettingFile = (ordering, token, productId, appId, settingId, file) => {
  const body = new FormData()
  body.append('file', file)
  return request(`${appUrl(ordering, productId, appId)}/settings/${encodeURIComponent(settingId)}/file`, {
    method: 'POST',
    headers: authHeaders(token),
    body
  })
}

/** Back to the base's value or file. */
export const resetBuilderAppSetting = (ordering, token, productId, appId, settingId) =>
  request(`${appUrl(ordering, productId, appId)}/settings/${encodeURIComponent(settingId)}`, {
    method: 'DELETE',
    headers: jsonHeaders(token)
  })

export const listBuilderAppConstants = (ordering, token, productId, appId) =>
  listAllPages(`${appUrl(ordering, productId, appId)}/constants`, token)

export const updateBuilderAppConstant = (ordering, token, productId, appId, constantId, value) =>
  request(`${appUrl(ordering, productId, appId)}/constants/${encodeURIComponent(constantId)}`, {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify({ value })
  })

export const resetBuilderAppConstant = (ordering, token, productId, appId, constantId) =>
  request(`${appUrl(ordering, productId, appId)}/constants/${encodeURIComponent(constantId)}`, {
    method: 'DELETE',
    headers: jsonHeaders(token)
  })

/** Signing credentials. Passwords and files never come back, only `has_*`. */
export const getBuilderAppCredentials = (ordering, token, productId, appId) =>
  request(`${appUrl(ordering, productId, appId)}/credentials`, { method: 'GET', headers: jsonHeaders(token) })

/** Saves the fields given for one platform (texts and files); the rest stay. */
export const saveBuilderAppCredentials = (ordering, token, productId, appId, platform, fields) => {
  const body = new FormData()
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') body.append(key, value)
  })
  return request(`${appUrl(ordering, productId, appId)}/credentials/${encodeURIComponent(platform)}`, {
    method: 'POST',
    headers: authHeaders(token),
    body
  })
}

/**
 * Page-level state of a failed response: the module is off, the user can't
 * use it, or something else went wrong.
 */
export const getBuilderErrorKind = (response) => {
  if (!response?.error) return null
  const codes = response.errorCodes || []
  if (codes.includes(BUILDER_ERROR_CODES.disabled)) return 'disabled'
  if (codes.includes(BUILDER_ERROR_CODES.unauthorized) || response.status === 401) return 'no_access'
  if (codes.includes(BUILDER_ERROR_CODES.notFound) || codes.includes(BUILDER_ERROR_CODES.appNotFound) || response.status === 404) return 'not_found'
  return 'error'
}

/**
 * The failures of an edit that take the whole page down: the product or the
 * app is gone, or the module or the access is. A missing setting or constant
 * (also a 404) only fails that one change, so it gives null.
 */
export const getBuilderPageFailure = (response) => {
  if (!response?.error) return null
  const codes = response.errorCodes || []
  if (codes.includes(BUILDER_ERROR_CODES.disabled)) return 'disabled'
  if (codes.includes(BUILDER_ERROR_CODES.unauthorized) || response.status === 401) return 'no_access'
  if (codes.includes(BUILDER_ERROR_CODES.notFound) || codes.includes(BUILDER_ERROR_CODES.appNotFound)) return 'not_found'
  return null
}
