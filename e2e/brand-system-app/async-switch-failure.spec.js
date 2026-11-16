import { expect, test } from '@playwright/test'

import { overlapProbe } from '../../scripts/redesign/tools/overlap-probe.mjs'

// redesign when the save of a row switch (P/AsyncSwitch) fails, its danger notice must not be painted over the
// switch or the figure beside it. The live sweep saw it on /stores/brand, /stores/markups and /stores/list (912) in the «dirty»
// state; its baseline missed it because synthetic writes never fail. Here every write is aborted at the boundary, as the live
// guard does, so the switch fails with «Failed to fetch», and the overlap probe of the sweep must find no pair at 1440, 1280 and 912.
// Synthetic data only: nothing here is real, and no write leaves the browser.
const APP_ORIGIN = 'http://127.0.0.1:3083'
const appDocuments = new Set(['/login', '/stores/list', '/stores/brand', '/stores/markups'])
const publicFiles = new Set(['/config.json', '/default-favicon.png', '/default-logo.png', '/env.js', '/favicon.ico', '/favicon.png', '/manifest.json'])
const localAssetPath = pathname =>
  /^\/(src\/|node_modules\/|i18n\/|@vite\/|@id\/|@fs\/|brand\/ordering\/)/.test(pathname) ||
  pathname === '/@react-refresh' ||
  publicFiles.has(pathname)

const user = { id: 999999, name: 'Synthetic', lastname: 'Operator', email: 'operator@example.invalid', level: 0, enabled: true }
const language = { id: 1, code: 'en', name: 'English', default: true, enabled: true, rtl: false }
const emptyEnvelope = { error: false, result: [], pagination: { currentPage: 1, pageSize: 10, totalPages: 0, total: 0, from: 0, to: 0 } }
const withList = rows => ({ error: false, result: rows, pagination: { currentPage: 1, pageSize: 10, page_size: 10, totalPages: 1, total: rows.length, from: 1, to: rows.length } })

const ids = [1, 2, 3]
const BUSINESSES = ids.map(id => ({
  id,
  name: `Synthetic Kitchen ${id}`,
  slug: `synthetic-kitchen-${id}`,
  email: `store${id}@example.invalid`,
  enabled: true,
  featured: false,
  city_id: 1,
  address: `${id} Example Street`,
  location: { lat: 0, lng: 0 },
  timezone: 'UTC',
  logo: null,
  header: null,
  types: [],
  owners: [],
  categories: []
}))
const BRANDS = ids.map(id => ({ id, name: `Synthetic Brand ${id}`, slug: `synthetic-brand-${id}`, enabled: true, logo: null }))
const MARKUPS = ids.map(id => ({
  id,
  name: `Synthetic Markup ${id}`,
  enabled: true,
  business_id: null,
  rules: { products: { markup_type: 'percentage', markup_value: 10 }, suboptions: { markup_type: 'percentage', markup_value: 5 } }
}))

const seededResponse = pathname => {
  if (/\/(business|backoffice\/businesses)$/.test(pathname)) return withList(BUSINESSES)
  if (/\/franchises$/.test(pathname)) return withList(BRANDS)
  if (/\/markups$/.test(pathname)) return withList(MARKUPS)
  return null
}

async function installBoundary (context) {
  const log = { writes: [], unknownLocalReads: [] }
  await context.route('**/*', async route => {
    const request = route.request()
    const method = request.method()
    const url = new URL(request.url())
    if (url.origin === APP_ORIGIN && url.pathname.startsWith('/fixture-api/')) {
      // every write fails as a network error, like a write the live guard blocks
      if (method !== 'GET') {
        log.writes.push(`${method} ${url.pathname}`)
        await route.abort('blockedbyclient')
        return
      }
      await route.fulfill({ json: seededResponse(url.pathname) ?? emptyEnvelope })
      return
    }
    if (url.origin === APP_ORIGIN && method === 'GET' && (appDocuments.has(url.pathname) || localAssetPath(url.pathname))) {
      await route.continue()
      return
    }
    if (url.origin === APP_ORIGIN && method === 'GET') log.unknownLocalReads.push(url.pathname)
    await route.abort('blockedbyclient')
  })
  await context.routeWebSocket(/.*/, socket => socket.close())
  await context.addInitScript(({ language, user }) => {
    window.__CONFIG__ = {
      project: 'brand-fixture',
      use_project_domain: false,
      use_project_subdomain: false,
      api: { url: 'http://127.0.0.1:3083/fixture-api', version: 'v1', language: 'en' },
      socket: { url: 'http://127.0.0.1:3083/fixture-socket' },
      billing_url: '',
      google_maps_key: '',
      google_tag_manager: '',
      posthog_api_key: '',
      posthog_analytics_enabled: false
    }
    localStorage.clear()
    localStorage.setItem('project', 'brand-fixture')
    localStorage.setItem('language', JSON.stringify(language))
    localStorage.setItem('token', 'synthetic-not-a-credential')
    localStorage.setItem('user', JSON.stringify(user))
  }, { language, user })
  return log
}

// The switch pressed in each page: the first row's (a notice that hangs down, over the next row) and the last row's (it opens upward).
const PAGES = [
  { path: '/stores/brand', switchName: /^Enable Synthetic Brand/ },
  { path: '/stores/markups', switchName: /^Enabled: Synthetic Markup/ },
  { path: '/stores/list', switchName: /^Featured/ }
]

for (const { path, switchName } of PAGES) {
  for (const width of [1440, 1280, 912]) {
    test(`${path} at ${width}: a failed switch save paints its notice over nothing`, async ({ context, page }, testInfo) => {
      test.setTimeout(180000)
      const log = await installBoundary(context)
      await page.setViewportSize({ width, height: 900 })
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      const switches = page.getByRole('switch', { name: switchName })
      await expect(switches).toHaveCount(3, { timeout: 90000 })

      const initial = await page.evaluate(overlapProbe, { samples: 50 })
      expect(initial.pairs, 'initial').toEqual([])

      const startOf = async index => Math.round((await switches.nth(index).boundingBox()).x)
      const before = [await startOf(0), await startOf(2)]
      for (const index of [0, 2]) await switches.nth(index).click()
      await expect(page.locator('.odc-async-switch-notice[role="alert"]')).toHaveCount(2)
      // the notice does not push the switch along its cell: it stays where the column puts it
      expect([await startOf(0), await startOf(2)], 'the switch keeps its place in the row').toEqual(before)
      const dirty = await page.evaluate(overlapProbe, { samples: 50 })
      await page.screenshot({ path: testInfo.outputPath(`failed-switch-${path.split('/').pop()}-${width}.png`) })
      expect(dirty.pairs, 'dirty: a failed save').toEqual([])
      // the page does not grow sideways for the notice
      const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
      expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)

      expect(log.writes.length, 'the presses tried to save').toBeGreaterThan(0)
      expect(log.unknownLocalReads).toEqual([])
    })
  }
}
