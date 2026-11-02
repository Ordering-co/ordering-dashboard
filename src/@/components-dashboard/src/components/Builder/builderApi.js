// Raw-fetch wrappers for the project Builder endpoints (not wrapped by the SDK).
// Base: {root}/{backoffice internal_name}/builder, e.g. /v400/en/development/dashboard/builder
import { parseRecordId } from '../../utils/commandPaletteBusinesses'

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
  appNotFound: 'app.not_found',
  // A website with its own domain can't leave active, or move between draft and archived
  domainConfigured: 'product.domain_configured'
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
      missing: body?.missing,
      // Each problem of a theme by path (theme.invalid): `[{ path, code }]`
      errors: body?.errors,
      // The limit a theme image broke: file.invalid_type, file.too_large,
      // file.dimensions_too_large, file.too_many_pixels
      formats: body?.formats,
      maxBytes: body?.max_bytes,
      maxSide: body?.max_side,
      maxPixels: body?.max_pixels
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
 * status is refused with `product.incomplete` while an app misses something;
 * any other move of a website with its own domain, with
 * `product.domain_configured` until the domain is removed.
 */
export const updateBuilderProductStatus = (ordering, token, productId, productStatus) =>
  request(`${getBuilderBaseUrl(ordering)}/products/${encodeURIComponent(productId)}/status`, {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify({ product_status: productStatus })
  })

/**
 * Renames the product (the site); the app's name in the stores is separate.
 * A website also takes here what it shows, whatever its theme: its scope, one
 * store (`businessId`) or one franchise (`franchiseId`), null for neither, and
 * its `settings` (`site` of its schema), merged key by key, a null taking a
 * key's default back. Only what is given is sent; `name` always is.
 */
export const updateBuilderProduct = (ordering, token, productId, { name, businessId, franchiseId, settings }) =>
  request(`${getBuilderBaseUrl(ordering)}/products/${encodeURIComponent(productId)}`, {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify({
      name,
      ...(businessId !== undefined ? { business_id: businessId } : {}),
      ...(franchiseId !== undefined ? { franchise_id: franchiseId } : {}),
      ...(settings !== undefined ? { settings } : {})
    })
  })

/*
 * What a website's scope is picked from (its "Website type"): the project's
 * stores and franchises, a page at a time, searched on the server.
 */

/** Rows per page of the scope pickers; the backoffice lists take up to 100. */
export const BUILDER_SCOPE_PAGE_SIZE = 20

/** What a picker row shows: its name, slug and logo, and whether it is enabled. */
export const BUILDER_SCOPE_FIELDS = ['id', 'name', 'slug', 'logo', 'enabled']

/** {root}/{backoffice internal_name}, e.g. /v400/en/development/dashboard (`dashboard|backoffice|admin`). */
const backofficeUrl = (ordering) => `${ordering.root}/${ordering.appInternalName || 'dashboard'}`

/**
 * Where the franchises are listed and read: `GET /{internal_name}/franchises`,
 * always paged like `/{internal_name}/businesses` (up to 100 a page), with the
 * same `params`, `where` and `orderBy`; a missing one answers 404
 * `franchise.not_found`.
 */
export const getBuilderScopeFranchisesUrl = (ordering) => `${backofficeUrl(ordering)}/franchises`

/**
 * The `where` of a picker: the enabled ones, and with a search, those whose
 * name or slug has it, or whose id it is.
 */
export const buildScopeWhere = (search) => {
  const conditions = [{ attribute: 'enabled', value: true }]
  const text = String(search ?? '').trim()
  if (text) {
    const matches = [
      { attribute: 'name', value: { condition: 'ilike', value: `%${text}%` } },
      { attribute: 'slug', value: { condition: 'ilike', value: `%${text}%` } }
    ]
    const id = parseRecordId(text)
    if (id !== null) matches.push({ attribute: 'id', value: id })
    conditions.push({ conditions: matches, conector: 'OR' })
  }
  return { conditions, conector: 'AND' }
}

const scopeListQuery = ({ page = 1, pageSize = BUILDER_SCOPE_PAGE_SIZE, search } = {}) => new URLSearchParams({
  params: BUILDER_SCOPE_FIELDS.join(','),
  page: String(Math.max(1, page)),
  page_size: String(Math.min(Math.max(1, pageSize), BUILDER_SCOPE_PAGE_SIZE)),
  orderBy: 'name',
  where: JSON.stringify(buildScopeWhere(search))
}).toString()

const scopeItemQuery = () => new URLSearchParams({ params: BUILDER_SCOPE_FIELDS.join(',') }).toString()

/**
 * A page of the project's enabled stores, by name, `GET /{internal_name}/businesses`
 * (backoffice, forced pagination). Answers `result` and `pagination`
 * (`current_page`, `page_size`, `total_pages`, `total`).
 */
export const listBuilderScopeBusinesses = (ordering, token, options) =>
  request(`${backofficeUrl(ordering)}/businesses?${scopeListQuery(options)}`, { method: 'GET', headers: jsonHeaders(token) })

/** One store by its id, enabled or not, for a scope that isn't on a loaded page. */
export const getBuilderScopeBusiness = (ordering, token, businessId) =>
  request(`${backofficeUrl(ordering)}/businesses/${encodeURIComponent(businessId)}?${scopeItemQuery()}`, { method: 'GET', headers: jsonHeaders(token) })

/** A page of the project's enabled franchises, by name (see getBuilderScopeFranchisesUrl). */
export const listBuilderScopeFranchises = (ordering, token, options) =>
  request(`${getBuilderScopeFranchisesUrl(ordering)}?${scopeListQuery(options)}`, { method: 'GET', headers: jsonHeaders(token) })

/** One franchise by its id, enabled or not (see getBuilderScopeFranchisesUrl). */
export const getBuilderScopeFranchise = (ordering, token, franchiseId) =>
  request(`${getBuilderScopeFranchisesUrl(ordering)}/${encodeURIComponent(franchiseId)}?${scopeItemQuery()}`, { method: 'GET', headers: jsonHeaders(token) })

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

/** Most themes a website keeps (`theme.limit` past it). */
export const BUILDER_THEMES_MAX = 5

const themesUrl = (ordering, productId) => `${productUrl(ordering, productId)}/themes`
const themeUrl = (ordering, productId, themeId) => `${themesUrl(ordering, productId)}/${encodeURIComponent(themeId)}`

/**
 * The schema the website's themes follow and the common `format`: token
 * names, `fonts` (id → family), and the `derived_colors` and
 * `derived_roles` the API works out by itself, which the editor hides.
 */
export const getBuilderThemeSchema = (ordering, token, productId) =>
  request(`${productUrl(ordering, productId)}/theme/schema`, { method: 'GET', headers: jsonHeaders(token) })

/**
 * The website's themes, the active one first: `{ id, name, active, version,
 * preset: { id, name, version } | null, has_draft, updated_at, upgraded_from }`.
 * A version 1 theme is the one made with the previous editor; `upgraded_from`
 * names the version of the schema a theme was saved with while it is shown
 * converted to the current one.
 */
export const listBuilderThemes = (ordering, token, productId) =>
  listAllPages(themesUrl(ordering, productId), token)

/** A new inactive theme from `blank`, the `current` one or a `preset` (`presetId`). */
export const createBuilderTheme = (ordering, token, productId, { name, source, presetId }) =>
  request(themesUrl(ordering, productId), {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(source === 'preset' ? { name, source, preset_id: presetId } : { name, source })
  })

/**
 * A theme with what the project changed (`values`, `draft_values`) and how
 * it looks (`resolved`: the draft over the schema's defaults, aliases resolved).
 * Saved with another version of the schema (an earlier one, or a later one
 * the website went back from), it comes converted to
 * `schema_version`: `upgraded_from` names the one it was saved with until it
 * saves, and `upgrade_dropped` the paths converting it lost. `invalid`
 * (`[{ path, code }]`) is what it saved that this version no longer takes,
 * which saving drops; but a number out of its range (`.out_of_range`), which
 * comes at the closest limit and saves there.
 */
export const getBuilderTheme = (ordering, token, productId, themeId) =>
  request(themeUrl(ordering, productId, themeId), { method: 'GET', headers: jsonHeaders(token) })

export const renameBuilderTheme = (ordering, token, productId, themeId, name) =>
  request(themeUrl(ordering, productId, themeId), {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify({ name })
  })

/** Only an inactive theme (`theme.active` otherwise). */
export const deleteBuilderTheme = (ordering, token, productId, themeId) =>
  request(themeUrl(ordering, productId, themeId), { method: 'DELETE', headers: jsonHeaders(token) })

/**
 * Merges `values` (partial, like the theme) over the draft; a null takes
 * the default back. Refused with `theme.invalid` and `errors` by path. A
 * theme shown converted saves converted, even with no `values`.
 */
export const saveBuilderThemeDraft = (ordering, token, productId, themeId, values) =>
  request(`${themeUrl(ordering, productId, themeId)}/draft`, {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify({ values })
  })

/**
 * The theme resolved with `values` (partial changes over the draft, a null
 * taking a default back) without saving them: `{ resolved, sources }`, where
 * `sources` says by path where a value that isn't the schema's default comes
 * from (own, inherited, identity, derived). Refused like the draft.
 */
export const resolveBuilderTheme = (ordering, token, productId, themeId, values) =>
  request(`${themeUrl(ordering, productId, themeId)}/resolve`, {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({ values })
  })

export const discardBuilderThemeDraft = (ordering, token, productId, themeId) =>
  request(`${themeUrl(ordering, productId, themeId)}/draft`, { method: 'DELETE', headers: jsonHeaders(token) })

/** The draft becomes the values; an active theme shows them on the website. */
export const publishBuilderTheme = (ordering, token, productId, themeId) =>
  request(`${themeUrl(ordering, productId, themeId)}/publish`, { method: 'POST', headers: jsonHeaders(token) })

/** Makes it the website's theme; the others stop being active. */
export const activateBuilderTheme = (ordering, token, productId, themeId) =>
  request(`${themeUrl(ordering, productId, themeId)}/activate`, { method: 'POST', headers: jsonHeaders(token) })

/** Puts the preset's values in the draft: all of them, or one `section` (`tokens.color`…). */
/** The most paths one reset takes (`sections`); they apply together or not at all. */
export const BUILDER_RESET_MAX = 500

/**
 * Takes the theme back to its preset: a path (`section`), several in one
 * write (a list, up to BUILDER_RESET_MAX), or with neither the whole theme.
 */
export const resetBuilderTheme = (ordering, token, productId, themeId, section = null) =>
  request(`${themeUrl(ordering, productId, themeId)}/reset`, {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(Array.isArray(section) ? { sections: section } : section ? { section } : {})
  })

/**
 * Uploads the file of `images.<key>` (a key of the schema's `images`) and
 * answers its `{ url }`, to set in the draft. Checked against the key's
 * formats and the limits of the schema's `format.images`.
 */
export const uploadBuilderThemeImage = (ordering, token, productId, themeId, key, file) => {
  const body = new FormData()
  body.append('key', key)
  body.append('file', file)
  return request(`${themeUrl(ordering, productId, themeId)}/images`, {
    method: 'POST',
    headers: authHeaders(token),
    body
  })
}

/** The presets a website of this type can start from: `{ id, code, name, version, preview }`. */
export const listBuilderThemePresets = (ordering, token, productId) =>
  request(`${getBuilderBaseUrl(ordering)}/theme_presets?${new URLSearchParams({ product_id: String(productId), page: '1', page_size: String(BUILDER_PAGE_SIZE_MAX) }).toString()}`, {
    method: 'GET',
    headers: jsonHeaders(token)
  })

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
