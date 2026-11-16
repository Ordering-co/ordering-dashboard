import { expect, test } from '@playwright/test'

// The batch runs its own application boundary on its own port so the shared
// 3018 fixtures stay untouched. GET only: no business write and no charge may
// leave this boundary, which is the L4 network gate.
const APP_ORIGIN = 'http://127.0.0.1:3097'
const appDocuments = new Set(['/login', '/stores/list', '/stores/products/synthetic-kitchen'])
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
      api: { url: 'http://127.0.0.1:3097/fixture-api', version: 'v1', language: 'en' },
      socket: { url: 'http://127.0.0.1:3097/fixture-socket' },
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

// Unlike b1-b4, the b5 surfaces all live INSIDE a business, so an empty
// synthetic dataset reaches none of them. One invented business row is seeded
// above, which makes /stores/products/<slug> render real b5 markup:
// BusinessProductsListing's business-name heading (title), its category
// heading (sectionTitle) and its breadcrumb (secondary).
for (const [name, viewport] of Object.entries({
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 }
})) {
  test(`${name} business products screen drives real b5 typography from the central roles`, async ({ context, page }, testInfo) => {
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

    // redesign SP: the category tree's head is the h2 «Categories» (it was «Business category»)
    const categoryHeading = page.locator('h2', { hasText: 'Categories' }).first()
    await expect(categoryHeading).toBeVisible()

    // Breadcrumb is NOT asserted here. BusinessProductsListing renders it only
    // once a concrete category is selected, and the seeded business carries no
    // categories, so this route never paints it. Its secondary role is proven
    // in the harness fixture spec instead (e2e/brand-system/stores-b5-styles.spec.js).

    // redesign SP: the page head is P/PageHeader. Its h1 takes the title role (22px) and, under 600px of its own
    // width (the phone), the section role (18px); the tree's h2 takes the section role. The chevron of the store button is a
    // 16px icon of the icon scale (it was a glyph at 0.7em of the heading).
    const titleRole = name === 'mobile' ? 'section' : 'title'
    const titleSize = name === 'mobile' ? '18px' : '22px'
    await expect(businessName).toHaveCSS('font-size', titleSize)
    await expect(categoryHeading).toHaveCSS('font-size', '18px')

    const nameIcon = businessName.locator('svg').first()
    const iconCount = await nameIcon.count()
    if (iconCount) await expect(nameIcon).toHaveCSS('width', '16px')

    await page.evaluate(role => {
      document.documentElement.style.setProperty(`--od-x-type-${role}-size`, '28px')
    }, titleRole)
    await expect(businessName).toHaveCSS('font-size', '28px')
    await page.evaluate(role => {
      document.documentElement.style.removeProperty(`--od-x-type-${role}-size`)
    }, titleRole)
    await expect(businessName).toHaveCSS('font-size', titleSize)
    await expect(categoryHeading).toHaveCSS('font-size', '18px')

    const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)

    await page.screenshot({ path: testInfo.outputPath(`l4-b5-products-${name}.png`), fullPage: true })

    expect(log.blockedWrites.length, 'reading this screen must not write').toBe(writesBeforeInteractions)
    expect(pageErrors).toEqual([])
    expectClosedBoundary(log)
  })
}
