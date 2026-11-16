import { expect, test } from '@playwright/test'

// The batch runs its own application boundary on its own port so the shared
// 3018 fixtures stay untouched. GET only: no business write and no charge may
// leave this boundary, which is the L4 network gate.
const APP_ORIGIN = 'http://127.0.0.1:3092'
const appDocuments = new Set(['/login', '/stores/list'])
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

// main's StoreOnboardingGate (dev build, 127.0.0.1, level 0) asks `GET /business?params=id&page_size=1` whether
// the project has any store, and with none it replaces the route with the guided onboarding. The scenario is a project
// that already went through it, as in main: that one probe answers one id. Every other read, the listing's included,
// stays the empty envelope.
const isOnboardingDiscovery = url =>
  /\/business$/.test(url.pathname) && url.searchParams.get('params') === 'id' && url.searchParams.get('page_size') === '1'
const onboardedProject = { error: false, result: [{ id: 1 }], pagination: { currentPage: 1, pageSize: 1, totalPages: 1, total: 1, from: 1, to: 1 } }

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
      await route.fulfill({ json: isOnboardingDiscovery(url) ? onboardedProject : emptyEnvelope })
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
      api: { url: 'http://127.0.0.1:3092/fixture-api', version: 'v1', language: 'en' },
      socket: { url: 'http://127.0.0.1:3092/fixture-socket' },
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
  test(`${name} stores listing boots and drives its title from the central role; b4 delivery and schedule panels need a business row that the empty synthetic dataset does not provide`, async ({ context, page }, testInfo) => {
    test.setTimeout(120000)
    const log = await installBatchNetworkBoundary(context)
    await installSyntheticSession(context)
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    await page.setViewportSize(viewport)
    const isPhone = viewport.width < 600

    await page.goto('/stores/list', { waitUntil: 'domcontentloaded' })
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const accept = page.getByRole('button', { name: 'Accept', exact: true }).last()
      const visible = await accept.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false)
      if (!visible) break
      await accept.click()
    }
    console.log(`${name} synthetic reads: ${[...new Set(log.fixtureReads)].length}; blocked writes at boot: ${log.blockedWrites.length}`)

    const writesBeforeInteractions = log.blockedWrites.length

    // The listing itself renders; b4 delivery and schedule panels open from a business row,
    // and with an empty synthetic dataset there is no row to open. That is
    // asserted rather than assumed, so the spec records what this route really
    // reaches. The b3 typography is verified in the harness fixture spec
    // (e2e/brand-system/stores-b4-styles.spec.js, 5/5).
    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible({ timeout: 90000 })
    // redesign SL-F3 (stores-list): the title is the h1 of P/PageHeader (`.odc-pagehead-title`), driven by the Product role
    // `--od-x-type-title-size` (22px) and, when the header's own container is under 600px wide (a phone), by
    // `--od-x-type-section-size` (18px). Was: legacy `--od-type-title-size` at 22px on both viewports. Same intent: the real
    // title follows the central role, and the 28px override must be seen on screen.
    const titleRole = isPhone ? '--od-x-type-section-size' : '--od-x-type-title-size'
    const titleSize = isPhone ? '18px' : '22px'
    await expect(heading).toHaveClass(/odc-pagehead-title/)
    await expect(heading).toHaveCSS('font-size', titleSize)

    await page.evaluate(role => document.documentElement.style.setProperty(role, '28px'), titleRole)
    await expect(heading).toHaveCSS('font-size', '28px')
    await page.evaluate(role => document.documentElement.style.removeProperty(role), titleRole)
    await expect(heading).toHaveCSS('font-size', titleSize)

    const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)

    // NO screenshot here, deliberately. This route reaches no b4 surface: the
    // detail panels need a business row and the synthetic dataset is empty, so
    // the rendered screen is the same /stores/list that b1 already captured.
    // A shot of it came out byte-identical to b1's and would be
    // indistinguishable from a reused capture, which is exactly what the
    // evidence rules forbid. The b3 surfaces are captured in the harness
    // fixture spec instead.

    expect(log.blockedWrites.length, 'reading this screen must not write').toBe(writesBeforeInteractions)
    expect(pageErrors).toEqual([])
    expectClosedBoundary(log)
  })
}
