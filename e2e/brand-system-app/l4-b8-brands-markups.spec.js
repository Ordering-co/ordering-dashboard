import { expect, test } from '@playwright/test'

// The batch runs its own application boundary on its own port so the shared
// 3018 fixtures stay untouched. GET only: no business write and no charge may
// leave this boundary, which is the L4 network gate.
const APP_ORIGIN = 'http://127.0.0.1:3083'
// '/stores/null' is a navigation the SPA itself makes from the incomplete
// synthetic dataset (a slug this fixture does not populate). It is a local GET
// for an application document: no external host, no write. It is named here
// rather than silently swallowed by the unknown-read bucket.
const appDocuments = new Set(['/login', '/stores/list', '/stores/brand', '/stores/markups', '/stores/null'])
const publicFiles = new Set(['/config.json', '/default-favicon.png', '/default-logo.png', '/env.js', '/favicon.ico', '/favicon.png', '/manifest.json'])
const localAssetPath = pathname =>
  /^\/(src\/|node_modules\/|i18n\/|@vite\/|@id\/|@fs\/|brand\/ordering\/)/.test(pathname) ||
  pathname === '/@react-refresh' ||
  publicFiles.has(pathname)

const user = {
  id: 999999,
  name: 'Synthetic',
  lastname: 'Operator',
  email: 'operator@example.invalid',
  level: 0,
  enabled: true
}
const language = { id: 1, code: 'en', name: 'English', default: true, enabled: true, rtl: false }

// Every synthetic read answers with a valid empty envelope. Nothing is written.
const emptyEnvelope = { error: false, result: [], pagination: { currentPage: 1, pageSize: 10, totalPages: 0, total: 0, from: 0, to: 0 } }

// One synthetic business, so the b5 surfaces (which all live INSIDE a business)
// are reachable at all. Everything is invented; nothing here is real data.
const BUSINESS = {
  id: 1,
  name: 'Synthetic Kitchen',
  slug: 'synthetic-kitchen',
  email: 'store@example.invalid',
  enabled: true,
  city_id: 1,
  address: '1 Example Street',
  location: { lat: 0, lng: 0 },
  timezone: 'UTC',
  ribbon: null,
  logo: null,
  header: null,
  types: [{ id: 1, name: 'Restaurant' }],
  delivery_time: '30min',
  pickup_time: '15min',
  featured: false,
  food: true,
  laundry: false,
  alcohol: false,
  groceries: false,
  use_business_schedule: false,
  schedule: [],
  owners: [],
  categories: []
}

const withList = rows => ({ error: false, result: rows, pagination: { currentPage: 1, pageSize: 10, totalPages: 1, total: rows.length, from: 1, to: rows.length } })
const withOne = row => ({ error: false, result: row })

// Seeded reads. Anything not named here still answers with the empty envelope.
const seededResponse = pathname => {
  if (/\/business$/.test(pathname)) return withList([BUSINESS])
  if (/\/business\/[^/]+$/.test(pathname)) return withOne(BUSINESS)
  return null
}

async function installBatchNetworkBoundary (context) {
  const log = { localAssets: [], fixtureReads: [], blockedExternal: [], blockedWrites: [], blockedWebSockets: [], unknownLocalReads: [] }
  await context.route('**/*', async route => {
    const request = route.request()
    const method = request.method()
    const url = new URL(request.url())
    const label = `${method} ${url.origin}${url.pathname}`

    if (url.origin === APP_ORIGIN && url.pathname.startsWith('/fixture-api/')) {
      if (method !== 'GET') {
        log.blockedWrites.push(label)
        await route.abort('blockedbyclient')
        return
      }
      log.fixtureReads.push(label)
      await route.fulfill({ json: seededResponse(url.pathname) ?? emptyEnvelope })
      return
    }
    if (url.origin === APP_ORIGIN && method === 'GET' && (appDocuments.has(url.pathname) || localAssetPath(url.pathname))) {
      log.localAssets.push(label)
      await route.continue()
      return
    }
    if (url.origin === APP_ORIGIN && method === 'GET') log.unknownLocalReads.push(label)
    else if (method !== 'GET') log.blockedWrites.push(label)
    else log.blockedExternal.push(label)
    await route.abort('blockedbyclient')
  })
  await context.routeWebSocket(/.*/, socket => {
    log.blockedWebSockets.push(socket.url())
    socket.close()
  })
  return log
}

async function installSyntheticSession (context) {
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
}

const BUSINESS_API_ROOT = `${APP_ORIGIN}/fixture-api/v1/en/brand-fixture`

const expectClosedBoundary = log => {
  expect(log.unknownLocalReads, 'only explicit application documents and local assets may reach Vite').toEqual([])
  expect(log.localAssets.length, 'the application must load local assets').toBeGreaterThan(0)
  expect(log.fixtureReads.length, 'the application must use synthetic API responses').toBeGreaterThan(0)
  // Boot-time third-party integration calls are blocked at the boundary; no
  // write may ever reach the business API root.
  expect(log.blockedWrites.filter(label => label.includes(BUSINESS_API_ROOT)), 'the batch must never write business data').toEqual([])
  expect(log.blockedWrites.every(label => !label.startsWith('GET '))).toBe(true)
  expect(log.blockedExternal.every(label => !label.includes(APP_ORIGIN))).toBe(true)
}

// /stores/brand is a top-level route that renders BusinessBrandListing, so this
// batch reaches its own surfaces directly. redesign SB-B2: since the
// redesign they are the Product page title and the table header (cards on a
// phone), driven by the Product roles instead of the b8 declarations.
//
// /stores/markups is deliberately NOT asserted here. It looks like a b8 route,
// but it renders Stores/Markups, a DIFFERENT component from b8's
// Stores/BusinessMarkups. Stores/Markups was part of the d2 batch of Wave D;
// it has since moved onto Product, its markup lives in
// Stores/Markups/markups-page.css and its styles.js is gone, so it is no
// longer a styled-components surface of any L4 batch. Verified by reading
// src/pages/Markups/index.js and Stores/Markups/index.js, not assumed.
for (const [name, viewport] of Object.entries({
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 }
})) {
  test(`${name} brand manager drives real b8 typography from the central roles`, async ({ context, page }, testInfo) => {
    test.setTimeout(180000)
    const log = await installBatchNetworkBoundary(context)
    await installSyntheticSession(context)
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    await page.setViewportSize(viewport)

    await page.goto('/stores/brand', { waitUntil: 'domcontentloaded' })
    // redesign SB-B2 (decision 1): the page is P/PageHeader + P/DataTable (P/RecordCardList under 768px). The title reads
    // `--od-x-type-title-size` (22px), or `--od-x-type-section-size` (18px) when the header is narrower than 600px. The fixture has no
    // brands: the table header reads `--od-x-type-ui-size` (13px); a phone has cards, not a table, so there the empty state's title
    // (`--od-x-type-body-size`, 14px) is the second surface.
    const heading = page.getByRole('heading', { level: 1, name: 'Brands' })
    await expect(heading).toBeVisible({ timeout: 90000 })
    const writesBeforeInteractions = log.blockedWrites.length

    const desktop = name === 'desktop'
    const titleRole = desktop ? '--od-x-type-title-size' : '--od-x-type-section-size'
    const titleSize = desktop ? '22px' : '18px'
    const secondary = desktop ? page.locator('th').first() : page.locator('.odc-state-title').first()
    const secondaryRole = desktop ? '--od-x-type-ui-size' : '--od-x-type-body-size'
    const secondarySize = desktop ? '13px' : '14px'
    await expect(secondary).toBeVisible()

    await expect(heading).toHaveCSS('font-size', titleSize)
    await expect(secondary).toHaveCSS('font-size', secondarySize)

    await page.evaluate(([role, second]) => {
      document.documentElement.style.setProperty(role, '28px')
      document.documentElement.style.setProperty(second, '16px')
    }, [titleRole, secondaryRole])
    await expect(heading).toHaveCSS('font-size', '28px')
    await expect(secondary).toHaveCSS('font-size', '16px')

    await page.evaluate((properties) => {
      for (const property of properties) document.documentElement.style.removeProperty(property)
    }, [titleRole, secondaryRole])
    await expect(heading).toHaveCSS('font-size', titleSize)
    await expect(secondary).toHaveCSS('font-size', secondarySize)

    const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)

    await page.screenshot({ path: testInfo.outputPath(`l4-b8-brand-${name}.png`), fullPage: true })

    expect(log.blockedWrites.length, 'reading this screen must not write').toBe(writesBeforeInteractions)
    expect(pageErrors).toEqual([])
    expectClosedBoundary(log)
  })
}
