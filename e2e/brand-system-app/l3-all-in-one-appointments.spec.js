import { expect, test } from '@playwright/test'

// The batch runs its own application boundary on its own port so the shared
// 3018 fixtures stay untouched while parallel L3 sessions run side by side.
const APP_ORIGIN = 'http://127.0.0.1:3046'
const appDocuments = new Set(['/login', '/all-in-one', '/appointments'])
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

// redesign (as in fixtures.js): main's StoreOnboardingGate asks `GET /business?params=id&page_size=1`
// whether the project has any store, and with none it replaces the route with the guided onboarding. This project already
// went through it, as in main: that one probe answers one id. Every other read keeps the empty envelope.
const isOnboardingDiscovery = url =>
  url.pathname === '/fixture-api/v1/en/brand-fixture/business' && url.searchParams.get('params') === 'id' && url.searchParams.get('page_size') === '1'
const onboardedEnvelope = { ...emptyEnvelope, result: [{ id: 1 }], pagination: { currentPage: 1, pageSize: 1, totalPages: 1, total: 1, from: 1, to: 1 } }

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
      await route.fulfill({ json: isOnboardingDiscovery(url) ? onboardedEnvelope : emptyEnvelope })
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
      api: { url: 'http://127.0.0.1:3046/fixture-api', version: 'v1', language: 'en' },
      socket: { url: 'http://127.0.0.1:3046/fixture-socket' },
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

for (const [name, viewport] of Object.entries({
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 }
})) {
  test(`${name} all-in-one and appointments render the real adopted surfaces with governed typography`, async ({ context, page }, testInfo) => {
    test.setTimeout(120000)
    const log = await installBatchNetworkBoundary(context)
    await installSyntheticSession(context)
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    await page.setViewportSize(viewport)

    await page.goto('/appointments', { waitUntil: 'domcontentloaded' })

    // Dismiss the session notices so the application tree leaves aria-hidden.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const accept = page.getByRole('button', { name: 'Accept', exact: true }).last()
      const visible = await accept.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false)
      if (!visible) break
      await accept.click()
    }
    console.log(`${name} synthetic reads: ${[...new Set(log.fixtureReads)].length}; blocked writes at boot: ${log.blockedWrites.length}`)

    // Adapted 2026-10-11 (decision 1): the h1 says «Appointments», as the menu, ⌘K and the browser tab.
    const heading = page.getByRole('heading', { name: 'Appointments', exact: true })
    await expect(heading).toBeVisible({ timeout: 90000 })
    // redesign W1-7 (T1-7-4): the title is P/PageHeader's — the page title role (22px), the section role (18px)
    // in a narrow container (phone); the governing tokens still drive it, not local pixel values.
    const [role, size] = name === 'mobile' ? ['--od-x-type-section-size', '18px'] : ['--od-x-type-title-size', '22px']
    await expect(heading).toHaveCSS('font-size', size)
    await page.evaluate(token => document.documentElement.style.setProperty(token, '28px'), role)
    await expect(heading).toHaveCSS('font-size', '28px')
    await page.evaluate(token => document.documentElement.style.removeProperty(token), role)
    await expect(heading).toHaveCSS('font-size', size)

    // The synthetic configuration leaves the feature disabled, so the screen
    // must announce that state instead of rendering an empty calendar.
    await expect(page.getByText('The appointments feature is not enabled.')).toBeVisible()

    await page.goto('/all-in-one', { waitUntil: 'domcontentloaded' })
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const accept = page.getByRole('button', { name: 'Accept', exact: true }).last()
      const visible = await accept.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false)
      if (!visible) break
      await accept.click()
    }
    // The all-in-one header copy belongs to OrdersContentHeader, outside this
    // allowlist, so the batch anchors on the real text it renders.
    // Adapted 2026-10-11: 's decision 5 renamed the h1 from «Orders manager» to «All in one», as the menu,
    // ⌘K and the browser tab name it; the anchor is now that heading (a role, not only the text).
    await expect(page.getByRole('heading', { name: 'All in one', exact: true })).toBeVisible({ timeout: 90000 })
    // Boot-time integration calls are blocked at the boundary; from here on the
    // batch asserts that reading and dismissing add no write attempt at all.
    const writesBeforeInteractions = log.blockedWrites.length
    // The socket notice is expected behind the closed boundary; dismiss it so
    // the adopted layout is the visible surface.
    const closeNotice = page.getByRole('button', { name: 'Close', exact: true }).first()
    if (await closeNotice.isVisible().catch(() => false)) await closeNotice.click()
    // The adopted drivers column and orders column share the same row.
    // Adapted 2026-10-08 (W1-4b): Online/Offline is a P/Tabs tab with its count as a badge («Online 7»), not a pressed button «Online (7)»
    await expect(page.getByRole('tab', { name: /^Online/ })).toBeVisible()

    const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)

    await page.screenshot({ path: testInfo.outputPath(`${name}-all-in-one.png`), fullPage: true })

    expect(log.blockedWrites.length, 'reading these screens must not write').toBe(writesBeforeInteractions)
    expect(pageErrors).toEqual([])
    expectClosedBoundary(log)
  })
}
