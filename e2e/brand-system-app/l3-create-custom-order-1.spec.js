import { expect, test } from '@playwright/test'

// The batch runs its own application boundary on its own port so the shared
// 3018 fixtures stay untouched while parallel L3 sessions run side by side.
const APP_ORIGIN = 'http://127.0.0.1:3044'
const appDocuments = new Set(['/login', '/orders'])
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
      await route.fulfill({ json: emptyEnvelope })
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
      api: { url: 'http://127.0.0.1:3044/fixture-api', version: 'v1', language: 'en' },
      socket: { url: 'http://127.0.0.1:3044/fixture-socket' },
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

const readLengthToken = (page, token) =>
  page.evaluate(name => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)), token)

// redesign 5.2 (decisión del usuario 2026-10-06): 32px con puntero fino, 44px con puntero grueso
const defineCreateCustomOrderCase = (name, viewport, pointer) => {
  test(`${name} create custom order opens the real details form with governed typography and native actions`, async ({ context, page }, testInfo) => {
    test.setTimeout(120000)
    const log = await installBatchNetworkBoundary(context)
    await installSyntheticSession(context)
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    await page.setViewportSize(viewport)
    await page.goto('/orders', { waitUntil: 'domcontentloaded' })

    // Dismiss the session notices so the application tree leaves aria-hidden.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const accept = page.getByRole('button', { name: 'Accept', exact: true }).last()
      const visible = await accept.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false)
      if (!visible) break
      await accept.click()
    }
    console.log(`${name} synthetic reads: ${[...new Set(log.fixtureReads)].length}; blocked writes at boot: ${log.blockedWrites.length}`)

    // redesign 5.5: the empty orders list offers the same action (5.2); the header button is the first in the page and the one this spec drives.
    const open = page.getByRole('button', { name: 'Create custom order', exact: true }).first()
    await expect(open).toBeVisible({ timeout: 90000 })
    // redesign 5.2 (decisión del usuario 2026-10-06): 32px con puntero fino, 44px con puntero grueso
    // The context must really emulate the pointer the variant claims, or the bar below proves nothing.
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(pointer === 'coarse')
    const targetToken = pointer === 'coarse' ? '--od-x-target-coarse' : '--od-x-control-height'
    const minimumHeight = await readLengthToken(page, targetToken)
    expect(minimumHeight, `${targetToken} must resolve to a pixel length`).toBeGreaterThan(0)
    if (pointer === 'coarse') expect(minimumHeight).toBe(44)
    expect((await open.boundingBox()).height).toBeGreaterThanOrEqual(minimumHeight)
    const writesBeforeInteractions = log.blockedWrites.length

    await open.click()

    const heading = page.getByRole('heading', { name: 'Create custom order', exact: true })
    await expect(heading).toBeVisible()
    await expect(heading).toHaveCSS('font-size', '22px')

    // Central roles drive the real panel, not local pixel values.
    // redesign 5.5: the title belongs to the Product Sheet, which reads the pilot role --od-x-type-title-size (22px),
    // not the legacy --od-type-title-size of the old sidebar; the assertion is the same: one role sets the size.
    await page.evaluate(() => document.documentElement.style.setProperty('--od-x-type-title-size', '28px'))
    await expect(heading).toHaveCSS('font-size', '28px')
    await page.evaluate(() => document.documentElement.style.removeProperty('--od-x-type-title-size'))
    await expect(heading).toHaveCSS('font-size', '22px')

    const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)

    await page.screenshot({ path: testInfo.outputPath(`${name}-create-custom-order-1.png`), fullPage: true })

    expect(log.blockedWrites.length, 'opening the form must not write').toBe(writesBeforeInteractions)
    expect(pageErrors).toEqual([])
    expectClosedBoundary(log)
  })
}

for (const [name, viewport] of Object.entries({
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 }
})) {
  defineCreateCustomOrderCase(name, viewport, 'fine')
}

// redesign 5.2 (decisión del usuario 2026-10-06): 32px con puntero fino, 44px con puntero grueso
test.describe('coarse pointer', () => {
  test.use({ hasTouch: true, isMobile: true })
  defineCreateCustomOrderCase('mobile coarse-pointer', { width: 390, height: 844 }, 'coarse')
})
