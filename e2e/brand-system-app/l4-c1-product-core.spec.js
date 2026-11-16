import { expect, test } from '@playwright/test'

// The batch runs its own application boundary on its own port so the shared
// 3018 fixtures stay untouched. GET only: no business write and no charge may
// leave this boundary, which is the L4 network gate.
const APP_ORIGIN = 'http://127.0.0.1:3079'
const appDocuments = new Set(['/login', '/stores/list', '/stores/products/synthetic-kitchen', '/stores/null'])
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
const PRODUCT = {
  id: 501,
  name: 'Synthetic Dish',
  price: 12.5,
  description: 'An invented dish for a fixture.',
  enabled: true,
  category_id: 401,
  images: null,
  sku: 'SYN-501',
  quantity: 10,
  inventoried: false,
  in_offer: false,
  offer_price: null,
  cost_price: 6,
  featured: false,
  upselling: false,
  extras: [],
  gallery: [],
  tags: [],
  ingredients: [],
  metafields: [],
  duration: 15,
  type: 'product'
}
const CATEGORY = { id: 401, name: 'Synthetic Category', enabled: true, rank: 1, products: [PRODUCT], subcategories: [] }

const seededResponse = pathname => {
  if (/\/business$/.test(pathname)) return withList([BUSINESS])
  if (/\/categories\/\d+\/products\/\d+$/.test(pathname)) return withOne(PRODUCT)
  if (/\/categories\/\d+\/products$/.test(pathname)) return withList([PRODUCT])
  if (/\/categories$/.test(pathname)) return withList([CATEGORY])
  if (/\/business\/[^/]+$/.test(pathname)) return withOne({ ...BUSINESS, categories: [CATEGORY] })
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
      api: { url: 'http://127.0.0.1:3079/fixture-api', version: 'v1', language: 'en' },
      socket: { url: 'http://127.0.0.1:3079/fixture-socket' },
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

// What this route reaches, stated precisely. The synthetic dataset now seeds a
// business, a category AND a product, so /stores/products/<slug> renders a real
// product row. That proves the fixture data reaches the product layer.
//
// It does NOT reach c1's own surfaces. ProductDetails opens as a side panel
// from a further interaction that this dataset does not complete: clicking the
// product row was tried and observed to add no new heading. The 66 c1 sites are
// proven in the harness fixture spec (e2e/brand-system/stores-c1-styles.spec.js,
// 6/6), including the 22-declaration storefront simulation and its probe.
//
// What IS asserted here is the b5 chrome this route paints around the product,
// because it is real migrated source and it is what the screen actually shows.
for (const [name, viewport] of Object.entries({
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 }
})) {
  test(`${name} seeded product renders over a closed boundary`, async ({ context, page }, testInfo) => {
    test.setTimeout(180000)
    const log = await installBatchNetworkBoundary(context)
    await installSyntheticSession(context)
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    await page.setViewportSize(viewport)

    await page.goto('/stores/products/synthetic-kitchen', { waitUntil: 'domcontentloaded' })
    const businessName = page.locator('h1', { hasText: 'Synthetic Kitchen' }).first()
    await expect(businessName).toBeVisible({ timeout: 90000 })
    const writesBeforeInteractions = log.blockedWrites.length

    // The seeded product reaches the screen.
    await expect(page.getByText('Synthetic Dish', { exact: false }).first()).toBeVisible()

    // redesign SP: the page head is P/PageHeader (its h1 holds the store button) and the tree's head is the
    // h2 «Categories». The h1 takes the title role (--od-x-type-title-size, 22px) and, under 600px of its own width (the
    // phone), the section role (18px); the h2 takes the section role (--od-x-type-section-size).
    const categoryHeading = page.locator('h2', { hasText: 'Categories' }).first()
    const titleSize = name === 'mobile' ? '18px' : '22px'
    await expect(businessName).toHaveCSS('font-size', titleSize)
    await expect(categoryHeading).toHaveCSS('font-size', '18px')

    if (name === 'mobile') {
      await page.evaluate(() => document.documentElement.style.setProperty('--od-x-type-section-size', '25px'))
      await expect(businessName).toHaveCSS('font-size', '25px')
      await expect(categoryHeading).toHaveCSS('font-size', '25px')
      await page.evaluate(() => document.documentElement.style.removeProperty('--od-x-type-section-size'))
    } else {
      await page.evaluate(() => {
        document.documentElement.style.setProperty('--od-x-type-title-size', '28px')
        document.documentElement.style.setProperty('--od-x-type-section-size', '25px')
      })
      await expect(businessName).toHaveCSS('font-size', '28px')
      await expect(categoryHeading).toHaveCSS('font-size', '25px')
      await page.evaluate(() => {
        for (const role of ['title', 'section']) document.documentElement.style.removeProperty(`--od-x-type-${role}-size`)
      })
    }
    await expect(businessName).toHaveCSS('font-size', titleSize)

    const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)

    await page.screenshot({ path: testInfo.outputPath(`l4-c1-products-${name}.png`), fullPage: true })

    expect(log.blockedWrites.length, 'reading this screen must not write').toBe(writesBeforeInteractions)
    expectClosedBoundary(log)
  })
}
