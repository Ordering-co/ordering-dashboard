import { expect, test } from '@playwright/test'

// The batch runs its own application boundary on its own port so the shared
// 3018 fixtures stay untouched. GET only: no business write and no charge may
// leave this boundary, which is the L4 network gate.
const APP_ORIGIN = 'http://127.0.0.1:3099'
// '/stores/null' is a navigation the SPA itself makes from the incomplete
// synthetic dataset (a slug this fixture does not populate). It is a local GET
// for an application document: no external host, no write. It is named here
// rather than silently swallowed by the unknown-read bucket.
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
      api: { url: 'http://127.0.0.1:3099/fixture-api', version: 'v1', language: 'en' },
      socket: { url: 'http://127.0.0.1:3099/fixture-socket' },
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

// What this route really reaches, stated plainly: opening a business row with
// ?id=1 renders the store editor (BusinessDetails), whose section list offers
// four b6 entry points (Ordering channels, QR Codes, Sales channels, Webhooks).
// Choosing one is not exercised here: those sections need a business payload
// far richer than this synthetic row (sites, channels, configs), and the seeded
// dataset answers those reads with empty envelopes. The b6 harness fixture
// (e2e/brand-system/stores-b6-styles.spec.js) was retired by its
// last styled surfaces were dead code and the l4-b6 typography ruleset is empty.
const B6_ENTRIES = ['Ordering channels', 'QR Codes', 'Sales channels', 'Webhooks']

for (const [name, viewport] of Object.entries({
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 }
})) {
  test(`${name} business detail panel exposes the b6 entry points over a closed boundary`, async ({ context, page }, testInfo) => {
    test.setTimeout(180000)
    const log = await installBatchNetworkBoundary(context)
    await installSyntheticSession(context)
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    await page.setViewportSize(viewport)
    const isPhone = viewport.width < 768

    await page.goto('/stores/list?id=1', { waitUntil: 'domcontentloaded' })
    // redesign SL-F2: the store name is the editor header's `h2.odc-se-title` (StoreEditorHeader), no longer
    // an h1 of the old BusinessSummary. Same intent: the panel's own title shows the business.
    const businessName = page.locator('h2.odc-se-title', { hasText: 'Synthetic Kitchen' })
    await expect(businessName).toBeVisible({ timeout: 90000 })
    const writesBeforeInteractions = log.blockedWrites.length

    // redesign SL-F2: the b6 entry points are sections of the editor's P/SectionNav («Store sections»,
    // storeSections.js), no longer buttons of the old BusinessSummary menu. Scoping to that nav keeps what the redesign 5.1
    // note guarded: the sidebar's collapsed Connect › «Sales channels» link is not the panel's entry. Exactly one each,
    // visible: as rows of the list on a desktop, as radio items of the compact selector on a phone (SectionNav turns
    // into one selector under 600px of its own width and 768px of viewport).
    const sectionNav = page.getByRole('navigation', { name: 'Store sections', exact: true })
    await expect(sectionNav).toBeVisible()
    await expect(page.locator('.odc-sectionnav')).toHaveAttribute('data-mode', isPhone ? 'selector' : 'list')
    if (isPhone) {
      const selector = sectionNav.getByRole('button', { name: 'Section Overview', exact: true })
      await expect(selector).toHaveCount(1)
      await selector.click()
      for (const entry of B6_ENTRIES) {
        const panelEntry = page.getByRole('menuitemradio', { name: entry, exact: true })
        await expect(panelEntry, entry).toHaveCount(1)
        await expect(panelEntry, entry).toBeVisible()
      }
      await page.keyboard.press('Escape')
      await expect(page.getByRole('menuitemradio', { name: B6_ENTRIES[0], exact: true })).toHaveCount(0)
    } else {
      for (const entry of B6_ENTRIES) {
        const panelEntry = sectionNav.getByRole('button', { name: entry, exact: true })
        await expect(panelEntry, entry).toHaveCount(1)
        await expect(panelEntry, entry).toBeVisible()
      }
    }

    // redesign SL-F2: `.odc-se-title` reads the Product role `--od-x-type-title-size` (22px at both widths),
    // no longer the legacy `--od-type-title-size`. Same intent: the real title follows its central role, and the 28px
    // override must be seen on screen.
    await expect(businessName).toHaveCSS('font-size', '22px')
    await page.evaluate(() => document.documentElement.style.setProperty('--od-x-type-title-size', '28px'))
    await expect(businessName).toHaveCSS('font-size', '28px')
    await page.evaluate(() => document.documentElement.style.removeProperty('--od-x-type-title-size'))
    await expect(businessName).toHaveCSS('font-size', '22px')

    const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)

    await page.screenshot({ path: testInfo.outputPath(`l4-b6-detail-${name}.png`), fullPage: true })

    expect(log.blockedWrites.length, 'reading this screen must not write').toBe(writesBeforeInteractions)
    expect(pageErrors).toEqual([])
    expectClosedBoundary(log)
  })
}

// redesign stores 5.15a: Ordering channels and QR Codes open on this synthetic row too. The fixture project resolves a
// temporary site, so the store's one address (useStoreWebsiteUrl) is https://v26-brand-fixture.orderingplus.com/store/synthetic-kitchen:
// every widget snippet is copyable and carries it (G5-04, G5-08), and a QR code opens it with the order type, its link shown with
// «Copy link» (G5-07). GET only, as above: nothing is copied to a server and nothing is written.
const STORE_ADDRESS = 'https://v26-brand-fixture.orderingplus.com/store/synthetic-kitchen'

test('desktop Ordering channels and QR Codes use the store address and copy it, over a closed boundary', async ({ context, page }) => {
  test.setTimeout(180000)
  const log = await installBatchNetworkBoundary(context)
  await installSyntheticSession(context)
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 900 })

  await page.goto('/stores/list?id=1&section=ordering_channels&tab=widgets', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('tablist', { name: 'Extensions' })).toBeVisible({ timeout: 90000 })
  await expect(page.getByRole('tab', { name: 'Widgets' })).toHaveAttribute('aria-selected', 'true')
  for (const name of ['Copy button code', 'Copy popup script', 'Copy inline script', 'Copy .htaccess rules']) {
    await expect(page.getByRole('button', { name }), name).toBeEnabled()
  }
  await expect(page.getByRole('textbox', { name: '3* Insert at the end of the body tag' })).toHaveValue(new RegExp(`h\\.src="${STORE_ADDRESS}"`))
  await expect(page.getByRole('textbox', { name: '3* Insert at the end of the body tag' })).toHaveAttribute('readonly', '')

  await page.getByRole('tab', { name: 'Custom slug' }).click()
  await expect(page.getByRole('textbox', { name: 'Slug' })).toHaveValue('synthetic-kitchen')
  await expect(page).toHaveURL(/tab=custom_slug/)

  await page.goto('/stores/list?id=1&section=publishing', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { level: 1, name: 'QR Codes' })).toBeVisible({ timeout: 90000 })
  await page.getByRole('button', { name: 'QR Code for Delivery' }).click()
  await page.getByRole('button', { name: 'Generate Code' }).click()
  await expect(page.getByText(`${STORE_ADDRESS}?order_type=1`, { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy link' })).toBeEnabled()

  const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
  expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)
  // the shell's own Intercom hash POST on each boot is blocked like every write; nothing else may try to write
  expect(log.blockedWrites.filter(label => !label.endsWith('/system/integrations/intercom/hash'))).toEqual([])
  expect(pageErrors).toEqual([])
  expectClosedBoundary(log)
})
