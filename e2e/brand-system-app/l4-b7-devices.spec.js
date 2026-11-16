import { expect, test } from '@playwright/test'

// The batch runs its own application boundary on its own port so the shared
// 3018 fixtures stay untouched. GET only: no business write and no charge may
// leave this boundary, which is the L4 network gate.
const APP_ORIGIN = 'http://127.0.0.1:3091'
// '/stores/null' is a navigation the SPA itself makes from the incomplete
// synthetic dataset (a slug this fixture does not populate). It is a local GET
// for an application document: no external host, no write. It is named here
// rather than silently swallowed by the unknown-read bucket.
const appDocuments = new Set(['/login', '/stores/list', '/stores/devices', '/stores/null'])
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
// redesign stores devices: one synthetic device, so /stores/devices draws its table (an empty list draws the
// empty state, with no column header to measure). Invented, like BUSINESS.
const DEVICE = { id: 1, name: 'Synthetic kiosk', code: 'SYN123', business_id: 1, user_id: null, business: BUSINESS, user: null }

const seededResponse = pathname => {
  if (/\/devices$/.test(pathname)) return withList([DEVICE])
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
  await context.addInitScript(({ language, user, origin }) => {
    // The init script also runs in frames the boundary aborts (the Sync video
    // iframe becomes an opaque error document) where storage is denied: seed
    // only the application's own documents.
    if (location.origin !== origin) return
    window.__CONFIG__ = {
      project: 'brand-fixture',
      use_project_domain: false,
      use_project_subdomain: false,
      api: { url: 'http://127.0.0.1:3091/fixture-api', version: 'v1', language: 'en' },
      socket: { url: 'http://127.0.0.1:3091/fixture-socket' },
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
  }, { language, user, origin: APP_ORIGIN })
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

// /stores/devices is a top-level route, so unlike b5 and b6 this batch reaches
// its own surfaces without needing a business row: BusinessDeviceListing's (Product since )
// page heading (title) and its table column headers (secondary) are real,
// migrated b7 declarations rendered by the application itself.
for (const [name, viewport] of Object.entries({
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 }
})) {
  test(`${name} devices listing drives real b7 typography from the central roles`, async ({ context, page }, testInfo) => {
    test.setTimeout(180000)
    const log = await installBatchNetworkBoundary(context)
    await installSyntheticSession(context)
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    await page.setViewportSize(viewport)

    await page.goto('/stores/devices', { waitUntil: 'domcontentloaded' })
    const heading = page.locator('h1', { hasText: 'Devices' }).first()
    await expect(heading).toBeVisible({ timeout: 90000 })
    const writesBeforeInteractions = log.blockedWrites.length

    // redesign stores devices: the title is the h1 of P/PageHeader, driven by the Product role
    // `--od-x-type-title-size` (22px) and, when the header's own container is under 600px wide (a phone), by
    // `--od-x-type-section-size` (18px). Below 768px the list is P/RecordCardList (no table): the column header is measured
    // on desktop only, a `th` of P/DataTable driven by `--od-x-type-ui-size` (13px). Was: the legacy h1 and th at 22px and
    // 12px from `--od-type-title-size` and `--od-type-secondary-size`. Same intent: the real roles drive the real surfaces.
    const isPhone = name === 'mobile'
    const titleRole = isPhone ? '--od-x-type-section-size' : '--od-x-type-title-size'
    const titleSize = isPhone ? '18px' : '22px'
    const columnHeader = isPhone ? null : page.locator('.odc-table thead th').first()
    if (columnHeader) await expect(columnHeader).toBeVisible()

    await expect(heading).toHaveCSS('font-size', titleSize)
    if (columnHeader) await expect(columnHeader).toHaveCSS('font-size', '13px')

    await page.evaluate((role) => {
      document.documentElement.style.setProperty(role, '28px')
      document.documentElement.style.setProperty('--od-x-type-ui-size', '16px')
    }, titleRole)
    await expect(heading).toHaveCSS('font-size', '28px')
    if (columnHeader) await expect(columnHeader).toHaveCSS('font-size', '16px')

    await page.evaluate((role) => {
      for (const property of [role, '--od-x-type-ui-size']) document.documentElement.style.removeProperty(property)
    }, titleRole)
    await expect(heading).toHaveCSS('font-size', titleSize)
    if (columnHeader) await expect(columnHeader).toHaveCSS('font-size', '13px')

    const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)

    await page.screenshot({ path: testInfo.outputPath(`l4-b7-devices-${name}.png`), fullPage: true })

    expect(log.blockedWrites.length, 'reading this screen must not write').toBe(writesBeforeInteractions)
    expect(pageErrors).toEqual([])
    expectClosedBoundary(log)
  })
}

// The Sync panel (redesign stores 3.D, ) is mounted by URL, as the
// application itself does: /stores/list?header=sync opens it and ?tab= picks
// the provider. It is read-only here: pressing a tab only rewrites the query
// string. The third-party hosts (the HubSpot form and the YouTube iframe) are
// answered by the blockedExternal guard; none of them may be reached without
// the user pressing «Send Form», which this test never does.
const HUBSPOT_FORM = /^https:\/\/share\.hsforms\.com\//
for (const [name, viewport] of Object.entries({
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 }
})) {
  test(`${name} sync panel opens by URL on ItsaCheckmate, switches tab in the URL and never leaves for the form`, async ({ context, page }, testInfo) => {
    test.setTimeout(180000)
    const log = await installBatchNetworkBoundary(context)
    await installSyntheticSession(context)
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    await page.setViewportSize(viewport)

    await page.goto('/stores/list?header=sync&tab=itsacheckmate', { waitUntil: 'domcontentloaded' })
    const itsacheckmate = page.getByRole('tab', { name: 'ItsaCheckmate' })
    const deliverect = page.getByRole('tab', { name: 'Deliverect' })
    await expect(itsacheckmate).toBeVisible({ timeout: 90000 })
    await expect(itsacheckmate).toHaveAttribute('aria-selected', 'true')
    await expect(deliverect).toHaveAttribute('aria-selected', 'false')
    const writesBeforeInteractions = log.blockedWrites.length

    // «Send Form» is one link that opens the form in a new tab, not a button.
    const sendForm = page.getByRole('link', { name: 'Send Form' })
    await expect(sendForm).toBeVisible()
    await expect(sendForm).toHaveAttribute('target', '_blank')
    await expect(sendForm).toHaveAttribute('href', HUBSPOT_FORM)
    await expect(sendForm).toHaveAttribute('rel', /noopener/)

    // The video is a click-to-play facade: no frame in the panel, and nothing asked of YouTube, until Play is pressed
    // (loading='lazy' alone does not hold Chromium back from a frame within ~1250px).
    await expect(page.getByRole('button', { name: 'Play video: ItsaCheckmate video' })).toBeVisible()
    await expect(page.locator('iframe')).toHaveCount(0)

    // Pressing the other provider only rewrites the query string.
    await deliverect.click()
    await expect(deliverect).toHaveAttribute('aria-selected', 'true')
    await expect(itsacheckmate).toHaveAttribute('aria-selected', 'false')
    await expect.poll(() => new URL(page.url()).searchParams.get('tab')).toBe('deliverect')
    const basicSendForm = page.getByRole('link', { name: 'Send Form' })
    await expect(basicSendForm).toHaveAttribute('target', '_blank')
    await expect(basicSendForm).toHaveAttribute('href', HUBSPOT_FORM)

    const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)

    await page.screenshot({ path: testInfo.outputPath(`l4-b7-sync-${name}.png`), fullPage: true })

    expect(log.blockedWrites.length, 'reading and switching tabs must not write').toBe(writesBeforeInteractions)

    // Nothing was asked of YouTube (frame or thumbnail) through the whole visit, up to here.
    const isYoutube = label => /youtube\.com|ytimg\.com|youtube-nocookie\.com|img\.youtube\.com/.test(label)
    expect(log.blockedExternal.filter(isYoutube), 'YouTube is only reached by pressing Play').toEqual([])

    // Pressing Play on the Deliverect video mounts its frame with autoplay=1 (the request itself is answered by the boundary).
    await page.getByRole('button', { name: 'Play video: Deliverect video' }).click()
    const frame = page.locator('iframe[title="Deliverect video"]')
    await expect(frame).toHaveCount(1)
    await expect(frame).toHaveAttribute('src', /^https:\/\/www\.youtube\.com\/embed\/_v8nPmW_E-0\?.*autoplay=1/)
    await expect(page.locator('iframe')).toHaveCount(1)
    expect(log.blockedExternal.filter(label => label.includes('hsforms.com')), 'the form is only reached by pressing «Send Form»').toEqual([])
    expect(pageErrors).toEqual([])
    expectClosedBoundary(log)
  })
}
