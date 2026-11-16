// redesign W0-9b (T0-37)
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  LOCALES, assertLocale, corsHeaders, installLocale, isTranslationsRequest, loadCatalog,
  localeFromArgv, pickLanguage, rewriteLocaleUrl, translationsResponse
} from '../../../scripts/redesign/tools/live-locale.mjs'
import { decide } from '../../../scripts/redesign/tools/live-guard.mjs'

const apiOrigin = 'https://apiv4.ordering.co'
const version = 'v400'
const project = 'orderingv1'
const opts = locale => ({ apiOrigin, version, project, locale })
const api = (locale, path) => `${apiOrigin}/${version}/${locale}/${project}/${path}`

describe('locale list', () => {
  it('is English plus the twelve-language set of i18n/config.json', () => {
    expect(LOCALES).toEqual(['en', 'es', 'fr', 'it', 'de', 'pt', 'da', 'nl', 'ar', 'el', 'bg', 'tr'])
    expect(LOCALES).toHaveLength(12)
  })
  it('throws on an unknown code', () => {
    expect(() => assertLocale('xx')).toThrow(/Unknown locale "xx"/)
    expect(() => rewriteLocaleUrl(api('en', 'orders'), opts('xx'))).toThrow(/Unknown locale/)
    expect(() => isTranslationsRequest(api('es', 'translations'), opts('xx'))).toThrow(/Unknown locale/)
    expect(() => translationsResponse('xx', {})).toThrow(/Unknown locale/)
    expect(() => pickLanguage([], 'xx')).toThrow(/Unknown locale/)
  })
  it('reads --locale from argv', () => {
    expect(localeFromArgv(['--port', '1'])).toBeNull()
    expect(localeFromArgv(['--locale', 'ar', '--fake-maps'])).toBe('ar')
    expect(() => localeFromArgv(['--locale'])).toThrow(/needs a code/)
    expect(() => localeFromArgv(['--locale', '--fake-maps'])).toThrow(/needs a code/)
    expect(() => localeFromArgv(['--locale', 'xx'])).toThrow(/Unknown locale/)
  })
})

describe('rewriteLocaleUrl', () => {
  it('moves the locale prefix to the English one and keeps path, query and hash', () => {
    expect(rewriteLocaleUrl(api('es', 'orders?where=%5B%5D&limit=20'), opts('es'))).toBe(api('en', 'orders?where=%5B%5D&limit=20'))
    expect(rewriteLocaleUrl(api('ar', 'orders/13861/messages'), opts('ar'))).toBe(api('en', 'orders/13861/messages'))
    expect(rewriteLocaleUrl(api('de', 'auth'), opts('de'))).toBe(api('en', 'auth'))
  })
  it('then the guard judges the rewritten URL, as it does for English', () => {
    const guard = url => decide({ method: 'GET', url, localOrigin: 'http://127.0.0.1:3031', apiOrigin, apiPrefix: `/${version}/en/${project}/` })
    const original = api('es', 'orders')
    expect(guard(original).allow).toBe(false)
    expect(guard(rewriteLocaleUrl(original, opts('es')))).toMatchObject({ allow: true, reason: 'api-read' })
    // A side-effect GET is still blocked after the rewrite.
    expect(guard(rewriteLocaleUrl(api('es', 'whatever/report.csv'), opts('es')))).toMatchObject({ allow: false, reason: 'side-effect' })
  })
  it('does not touch other routes, other locales or other origins', () => {
    const untouched = [
      api('en', 'orders'), // already English
      api('fr', 'orders'), // another locale than the active one
      `${apiOrigin}/${version}/es/otherproject/orders`, // another project
      `${apiOrigin}/v500/es/${project}/orders`, // another version
      `${apiOrigin}/${version}/es${project}/orders`, // no slash between segments
      `${apiOrigin}/health`,
      `https://example.com/${version}/es/${project}/orders`, // another origin
      'http://127.0.0.1:3031/assets/index.js'
    ]
    for (const url of untouched) expect(rewriteLocaleUrl(url, opts('es'))).toBe(url)
  })
  it("'en' rewrites nothing", () => {
    for (const url of [api('en', 'orders'), api('es', 'orders'), 'http://127.0.0.1:3031/']) {
      expect(rewriteLocaleUrl(url, opts('en'))).toBe(url)
    }
  })
})

describe('isTranslationsRequest', () => {
  it('matches the translations list of the active locale only', () => {
    expect(isTranslationsRequest(api('es', 'translations'), opts('es'))).toBe(true)
    expect(isTranslationsRequest(api('es', 'translations?mode=dictionary&version=v2'), opts('es'))).toBe(true)
    expect(isTranslationsRequest(api('es', 'translations/'), opts('es'))).toBe(true)
    expect(isTranslationsRequest(api('es', 'translations/12'), opts('es'))).toBe(false)
    expect(isTranslationsRequest(api('es', 'orders'), opts('es'))).toBe(false)
    expect(isTranslationsRequest(api('fr', 'translations'), opts('es'))).toBe(false)
    expect(isTranslationsRequest(api('en', 'translations'), opts('es'))).toBe(false)
    expect(isTranslationsRequest(`https://example.com/${version}/es/${project}/translations`, opts('es'))).toBe(false)
    expect(isTranslationsRequest(api('en', 'translations'), opts('en'))).toBe(false)
  })
})

describe('translationsResponse', () => {
  const catalog = loadCatalog()
  it('has the API dictionary shape, with the product prefix the app looks up', () => {
    const body = translationsResponse('es', { A: { en: 'a', es: 'ae' }, B: { en: 'b', es: '' }, C: { en: 'c' } })
    expect(body).toEqual({ error: false, result: { DASHBOARD_A: 'ae' } }) // empty/missing leave the code default
  })
  it('serves all 12 languages from the repo catalog', () => {
    for (const locale of LOCALES) {
      const { error, result } = translationsResponse(locale, catalog)
      expect(error).toBe(false)
      expect(Object.keys(result).length).toBeGreaterThan(4000)
    }
  })
  it('carries a known string in each language', () => {
    expect(translationsResponse('es', catalog).result.DASHBOARD_KEEP_ORDER).toBe('Conservar pedido')
    expect(translationsResponse('en', catalog).result.DASHBOARD_KEEP_ORDER).toBe('Keep order')
    expect(translationsResponse('es', catalog).result.DASHBOARD_ORDERS).toBe('Pedidos')
    expect(translationsResponse('fr', catalog).result.DASHBOARD_KEEP_ORDER).toBe(catalog.KEEP_ORDER.fr)
    expect(catalog.KEEP_ORDER.fr).toBeTruthy()
  })
  it('reads the same file the app tooling maintains', () => {
    expect(catalog).toEqual(JSON.parse(readFileSync('i18n/translations.json', 'utf8')))
  })
})

describe('pickLanguage', () => {
  const languages = [{ id: 1, code: 'en', rtl: false }, { id: 19, code: 'ar', rtl: true }]
  it('returns the language object GET /languages gave for that code', () => {
    expect(pickLanguage(languages, 'ar')).toEqual({ id: 19, code: 'ar', rtl: true })
  })
  it('throws when the project does not list it', () => {
    expect(() => pickLanguage(languages, 'es')).toThrow(/not in the project's GET \/languages \(en, ar\)/)
  })
})

describe('corsHeaders', () => {
  it('echoes the origin and the requested headers', () => {
    expect(corsHeaders({ origin: 'http://127.0.0.1:3031', 'access-control-request-headers': 'authorization,x-app-x' })).toMatchObject({
      'access-control-allow-origin': 'http://127.0.0.1:3031',
      'access-control-allow-headers': 'authorization,x-app-x'
    })
  })
})

// A minimal stand-in for a Playwright context: records the handler and lets the test drive requests.
const fakeRoute = (url, method = 'GET', headers = {}) => {
  const calls = {}
  return {
    calls,
    request: () => ({ url: () => url, method: () => method, headers: () => headers }),
    fulfill: async arg => { calls.fulfill = arg },
    fallback: async arg => { calls.fallback = arg }
  }
}
const install = async locale => {
  const registered = []
  const context = { route: async (matcher, handler) => { registered.push({ matcher, handler }) } }
  const observed = {}
  const catalog = { KEEP_ORDER: { en: 'Keep order', es: 'Conservar pedido' } }
  const stats = await installLocale(context, { locale, apiOrigin, version, project, observed, catalog })
  return { registered, observed, stats }
}

describe('installLocale', () => {
  it("installs nothing for 'en' and says so in observed.locale", async () => {
    const { registered, observed } = await install('en')
    expect(registered).toHaveLength(0)
    expect(observed.locale).toMatchObject({ locale: 'en', active: false, rewritten: 0 })
  })
  it('throws on an unknown code before registering anything', async () => {
    await expect(install('xx')).rejects.toThrow(/Unknown locale/)
  })
  it('only matches locale-prefixed API URLs and the locale translations', async () => {
    const { registered } = await install('es')
    const [{ matcher }] = registered
    expect(matcher(new URL(api('es', 'orders')))).toBe(true)
    expect(matcher(new URL(api('es', 'translations')))).toBe(true)
    expect(matcher(new URL(api('en', 'orders')))).toBe(false)
    expect(matcher(new URL('http://127.0.0.1:3031/orders'))).toBe(false)
  })
  it('rewrites to English and falls back to the guard, counting by method', async () => {
    const { registered, observed } = await install('es')
    const get = fakeRoute(api('es', 'orders?limit=1'))
    await registered[0].handler(get)
    expect(get.calls.fallback).toEqual({ url: api('en', 'orders?limit=1') })
    expect(get.calls.fulfill).toBeUndefined()
    const post = fakeRoute(api('es', 'auth'), 'POST')
    await registered[0].handler(post)
    expect(post.calls.fallback).toEqual({ url: api('en', 'auth') })
    expect(observed.locale).toMatchObject({ rewritten: 2, byMethod: { GET: 1, POST: 1 }, translations: 0 })
  })
  it('answers the translations GET from the catalog without the network, and its preflight', async () => {
    const { registered, observed } = await install('es')
    const get = fakeRoute(api('es', 'translations?mode=dictionary'), 'GET', { origin: 'http://127.0.0.1:3031' })
    await registered[0].handler(get)
    expect(get.calls.fallback).toBeUndefined()
    expect(get.calls.fulfill.status).toBe(200)
    expect(JSON.parse(get.calls.fulfill.body)).toEqual({ error: false, result: { DASHBOARD_KEEP_ORDER: 'Conservar pedido' } })
    expect(get.calls.fulfill.headers['access-control-allow-origin']).toBe('http://127.0.0.1:3031')
    const options = fakeRoute(api('es', 'translations'), 'OPTIONS', { origin: 'http://127.0.0.1:3031' })
    await registered[0].handler(options)
    expect(options.calls.fulfill.status).toBe(204)
    expect(observed.locale).toMatchObject({ translations: 1, translationKeys: 1, rewritten: 0 })
  })
  it('lets a translations write through to the rewrite, where the guard blocks it', async () => {
    const { registered } = await install('es')
    const put = fakeRoute(api('es', 'translations'), 'PUT')
    await registered[0].handler(put)
    expect(put.calls.fulfill).toBeUndefined()
    expect(put.calls.fallback).toEqual({ url: api('en', 'translations') })
    expect(decide({ method: 'PUT', url: api('en', 'translations'), localOrigin: 'http://127.0.0.1:3031', apiOrigin, apiPrefix: `/${version}/en/${project}/` })).toMatchObject({ allow: false, reason: 'write' })
  })
})
