import { expect, test } from '@playwright/test'

// The batch runs its own application boundary on its own port so the shared
// 3018 fixtures stay untouched. GET only: no business write and no charge may
// leave this boundary, which is the L4 network gate.
const APP_ORIGIN = 'http://127.0.0.1:3074'
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
      api: { url: 'http://127.0.0.1:3074/fixture-api', version: 'v1', language: 'en' },
      socket: { url: 'http://127.0.0.1:3074/fixture-socket' },
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
  test(`${name} stores listing renders the real adopted b1 surfaces with governed typography`, async ({ context, page }, testInfo) => {
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

    // BusinessesListingHeader owns the screen title, a b1 row (now StoresHeader > P/PageHeader, see the SL-F1 marks below).
    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible({ timeout: 90000 })
    // redesign SL-F1 (stores-list): the title is the h1 of P/PageHeader (`.odc-pagehead-title`), driven by the Product role
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

    // BusinessActiveStateFilter is one of the six controls this batch turned
    // into native buttons. Keyboard reachability is the point of the change.
    // redesign SL-F1 (stores-list): Active / Inactive are now the `P/Tabs` of StoresHeader (Base UI tablist "Status"). A tab is
    // still a native <button type="button"> in the tab order, but its state is `aria-selected` (role tab), no longer
    // `aria-pressed` (role button), and the text role is `--od-x-type-ui-size`: 13px, the same value the old assertion had.
    const activeTab = page.getByRole('tab', { name: 'Active', exact: true })
    await expect(activeTab).toBeVisible({ timeout: 90000 })
    await expect(activeTab).toHaveJSProperty('tagName', 'BUTTON')
    await expect(activeTab).toHaveAttribute('type', 'button')
    await expect(activeTab).toHaveAttribute('aria-selected', /true|false/)
    await expect(activeTab).toHaveCSS('font-size', '13px')
    await activeTab.focus()
    await expect(activeTab).toBeFocused()

    // The view-method toggles were icon-only divs with no accessible name.
    // redesign SL-F1 (stores-list): they are the options of `P/SegmentedControl` (Base UI Toggle, still role button with
    // `aria-pressed`) named «List view» / «Card view». Unchanged assertion; the control stays a button at 1440 and 390 (en).
    const cardView = page.getByRole('button', { name: 'Card view' })
    await expect(cardView).toHaveAttribute('aria-pressed', /true|false/)

    const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)

    await page.screenshot({ path: testInfo.outputPath(`${name}-stores-b1.png`), fullPage: true })

    expect(log.blockedWrites.length, 'reading this screen must not write').toBe(writesBeforeInteractions)
    expect(pageErrors).toEqual([])
    expectClosedBoundary(log)
  })
}
