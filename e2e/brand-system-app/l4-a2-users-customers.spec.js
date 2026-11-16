import { expect, test } from '@playwright/test'

// The batch runs its own application boundary on its own port so the shared
// 3018 fixtures stay untouched. GET only: no business write and no charge may
// leave this boundary, which is the L4 network gate.
const APP_ORIGIN = 'http://127.0.0.1:3057'
const appDocuments = new Set(['/login', '/users/customers', '/users/admins'])
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
      // main's StoreOnboardingGate asks `GET /business?params=id&page_size=1` whether the project has any store and,
      // with none, replaces the route with the guided onboarding. The scenario is a project that already went through it: that
      // one probe answers one id. Every other read keeps the empty envelope.
      const onboardingProbe = url.pathname.endsWith('/business') && url.searchParams.get('params') === 'id' && url.searchParams.get('page_size') === '1'
      await route.fulfill({ json: onboardingProbe ? { ...emptyEnvelope, result: [{ id: 1 }] } : emptyEnvelope })
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
      api: { url: 'http://127.0.0.1:3057/fixture-api', version: 'v1', language: 'en' },
      socket: { url: 'http://127.0.0.1:3057/fixture-socket' },
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
  test(`${name} customers listing renders the real adopted a2 surfaces with governed typography`, async ({ context, page }, testInfo) => {
    test.setTimeout(120000)
    const log = await installBatchNetworkBoundary(context)
    await installSyntheticSession(context)
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    await page.setViewportSize(viewport)

    await page.goto('/users/customers', { waitUntil: 'domcontentloaded' })

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const accept = page.getByRole('button', { name: 'Accept', exact: true }).last()
      const visible = await accept.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false)
      if (!visible) break
      await accept.click()
    }
    console.log(`${name} synthetic reads: ${[...new Set(log.fixtureReads)].length}; blocked writes at boot: ${log.blockedWrites.length}`)

    // CustomersListing owns the order-count filter chips, which are a2 rows.
    const writesBeforeInteractions = log.blockedWrites.length
    // redesign UC-R2 (decision 3 / decision 1): the Orders control is a segmented control (button `No orders`); where its options do not
    // fit it is its native select (combobox `Orders`), and at 390px the 17px probe below makes it switch. Both read `--od-x-type-ui-size`.
    const chip = page.getByRole('button', { name: 'No orders', exact: true }).or(page.getByRole('combobox', { name: 'Orders', exact: true })).first() // redesign UC-R2 (decision 3 / decision 1)
    await expect(chip).toBeVisible({ timeout: 90000 })
    await expect(chip).toHaveCSS('font-size', '13px')

    // Central roles drive the real screen, not local pixel values.
    // redesign UC-R2 (decision 3 / decision 1): the segmented button (`.odc-seg-btn`) reads `--od-x-type-ui-size`
    await page.evaluate(() => document.documentElement.style.setProperty('--od-x-type-ui-size', '17px')) // redesign UC-R2 (decision 3 / decision 1)
    await expect(chip).toHaveCSS('font-size', '17px')
    await page.evaluate(() => document.documentElement.style.removeProperty('--od-x-type-ui-size')) // redesign UC-R2 (decision 3 / decision 1)
    await expect(chip).toHaveCSS('font-size', '13px')

    const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)

    await page.screenshot({ path: testInfo.outputPath(`${name}-users-a2.png`), fullPage: true })

    expect(log.blockedWrites.length, 'reading this screen must not write').toBe(writesBeforeInteractions)
    expect(pageErrors).toEqual([])
    expectClosedBoundary(log)
  })
}
