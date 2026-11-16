// redesign W0-9b (T0-37)
// `--locale <code>` for the live session: run the app in another language against the same
// English data, without writing anything to the project (M-02: never PUT /languages).
//
// The live guard only lets the English API prefix (`/<version>/en/<project>/`) through. When the
// app runs in `es`, it asks for `/<version>/es/<project>/...`. This module:
//   1. rewrites every API request under the locale prefix to the English one, BEFORE the guard
//      sees it (so the guard judges the rewritten URL, exactly as it judges English today);
//   2. answers the translations request of that language from the repo catalog
//      (i18n/translations.json), without touching the network;
//   3. counts what it did in `observed.locale`.
// The texts therefore come from the repo catalog, not from the live project's catalog.
//
// Pure functions below are pinned by src/__tests__/tools/liveLocale.test.js. `installLocale` is the
// only part that needs a Playwright context.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const readJson = relative => JSON.parse(readFileSync(resolve(repoRoot, relative), 'utf8'))

const i18nConfig = readJson('i18n/config.json')
export const SOURCE_LOCALE = i18nConfig.sourceLanguage
export const LOCALES = [i18nConfig.sourceLanguage, ...i18nConfig.supportedLocales]
export const TRANSLATION_PREFIX = i18nConfig.prefix // the app asks for DASHBOARD_<key>

export function assertLocale (locale) {
  if (!LOCALES.includes(locale)) {
    throw new Error(`Unknown locale "${locale}". Use one of: ${LOCALES.join(', ')}`)
  }
  return locale
}

// `--locale es` → 'es'; absent → null; `--locale` with no value or an unknown code throws.
export function localeFromArgv (argv) {
  const i = argv.indexOf('--locale')
  if (i === -1) return null
  const value = argv[i + 1]
  if (!value || value.startsWith('--')) throw new Error(`--locale needs a code: ${LOCALES.join(', ')}`)
  return assertLocale(value)
}

const prefixOf = ({ version, project }, locale) => `/${version}/${locale}/${project}/`

// → the URL with `/<version>/<locale>/<project>/` replaced by `/<version>/<to>/<project>/`.
// Anything else (other origin, other prefix, `en` itself) comes back untouched, byte for byte.
export function rewriteLocaleUrl (url, { apiOrigin, version, project, locale, to = SOURCE_LOCALE }) {
  assertLocale(locale)
  if (locale === to) return url
  const parsed = new URL(url)
  const from = prefixOf({ version, project }, locale)
  if (parsed.origin !== apiOrigin || !parsed.pathname.startsWith(from)) return url
  parsed.pathname = `${prefixOf({ version, project }, to)}${parsed.pathname.slice(from.length)}`
  return parsed.href
}

// The translations endpoint of that language (`/<version>/<locale>/<project>/translations`, no id).
// Path only: the caller decides what to do with each HTTP verb.
export function isTranslationsRequest (url, { apiOrigin, version, project, locale }) {
  assertLocale(locale)
  if (locale === SOURCE_LOCALE) return false
  const parsed = new URL(url)
  return parsed.origin === apiOrigin &&
    (parsed.pathname === `${prefixOf({ version, project }, locale)}translations` ||
      parsed.pathname === `${prefixOf({ version, project }, locale)}translations/`)
}

// Same body the API returns for `translations().asDictionary()`: { error, result: { KEY: text } }.
// The app looks keys up with the product prefix (DASHBOARD_<key>). Empty strings are left out:
// the app's `??` would show "" instead of the default text from the code.
export function translationsResponse (locale, catalog, { prefix = TRANSLATION_PREFIX } = {}) {
  assertLocale(locale)
  const result = {}
  for (const [key, entry] of Object.entries(catalog)) {
    const text = entry?.[locale]
    if (typeof text === 'string' && text !== '') result[`${prefix}${key}`] = text
  }
  return { error: false, result }
}

// The language object to keep in localStorage.language: the one GET /languages returns for that
// code (id, code, rtl, ...), as the session already does for English.
export function pickLanguage (languages, locale) {
  assertLocale(locale)
  const found = (languages || []).find(language => language.code === locale)
  if (!found) {
    throw new Error(`Locale "${locale}" is not in the project's GET /languages (${(languages || []).map(l => l.code).join(', ')})`)
  }
  return found
}

// Headers for the answers served from here, cross-origin to the local app.
export function corsHeaders (requestHeaders = {}) {
  return {
    'access-control-allow-origin': requestHeaders.origin || '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': requestHeaders['access-control-request-headers'] || '*',
    vary: 'Origin'
  }
}

export function loadCatalog () {
  return readJson(i18nConfig.catalogPath)
}

// Registers the rewrite/translations route on a Playwright context (or page). Playwright runs the
// LAST registered matching handler first, and `route.fallback({ url })` hands the request, with the
// new URL, to the handlers registered before: so call this AFTER the guard's `context.route`.
// Returns the counters, also exposed as `observed.locale`. `locale === 'en'` installs nothing.
export async function installLocale (context, { locale, apiOrigin, version, project, observed, catalog }) {
  assertLocale(locale)
  const stats = { locale, active: locale !== SOURCE_LOCALE, rewritten: 0, byMethod: {}, translations: 0, translationKeys: 0 }
  if (observed) observed.locale = stats
  if (!stats.active) return stats
  const opts = { apiOrigin, version, project, locale }
  const body = translationsResponse(locale, catalog || loadCatalog())
  stats.translationKeys = Object.keys(body.result).length
  const json = JSON.stringify(body)
  const isLocaleUrl = url => isTranslationsRequest(url.href, opts) || rewriteLocaleUrl(url.href, opts) !== url.href
  await context.route(isLocaleUrl, async route => {
    const request = route.request()
    const method = request.method().toUpperCase()
    if (isTranslationsRequest(request.url(), opts)) {
      if (method === 'GET') {
        stats.translations += 1
        return route.fulfill({ status: 200, contentType: 'application/json', headers: corsHeaders(request.headers()), body: json })
      }
      if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders(request.headers()) })
      // Any other verb falls through to the rewrite: the guard blocks the write as it does today.
    }
    const url = rewriteLocaleUrl(request.url(), opts)
    stats.rewritten += 1
    stats.byMethod[method] = (stats.byMethod[method] || 0) + 1
    return route.fallback({ url })
  })
  return stats
}
