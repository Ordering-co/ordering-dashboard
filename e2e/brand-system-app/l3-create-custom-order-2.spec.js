import { expect, test } from '@playwright/test'
import { tokens } from '../../src/brand/ordering.tokens.generated'

// The shared fixtures module is pinned to the Delivery-1 app origin and belongs
// to `integrate`, so this batch carries its own closed boundary on its own port.
const APP_ORIGIN = 'http://127.0.0.1:3045'
const API_ROOT = '/fixture-api/v1/en/brand-fixture'

const appDocuments = new Set(['/login', '/orders'])
const publicFiles = new Set([
  '/config.json',
  '/default-favicon.png',
  '/default-logo.png',
  '/env.js',
  '/favicon.ico',
  '/favicon.png',
  '/manifest.json'
])
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

const businesses = [{
  id: 920001,
  name: 'Synthetic Store Alpha',
  slug: 'synthetic-store-alpha',
  enabled: true,
  logo: null,
  header: null,
  city_id: 940001,
  reviews: { total: 4 }
}]

const customers = [{
  id: 930001,
  name: 'Fixture',
  lastname: 'Customer',
  email: 'fixture.customer@example.invalid',
  cellphone: '5550000000',
  phone: '5550000000',
  photo: null,
  enabled: true,
  addresses: []
}]

const fixtureResults = new Map([
  [`${API_ROOT}/validationfields`, []],
  [`${API_ROOT}/languages`, [language]],
  [`${API_ROOT}/translations`, {}],
  [`${API_ROOT}/current`, { code: 'brand-fixture', name: 'Synthetic test tenant', status: 'active' }],
  [`${API_ROOT}/configs`, {}],
  [`${API_ROOT}/order_options`, { carts: [] }],
  [`${API_ROOT}/billing/subscriptions`, []],
  [`${API_ROOT}/sites`, []],
  [`${API_ROOT}/builder/apps`, []],
  [`${API_ROOT}/plugins`, []],
  [`${API_ROOT}/plugins/key/braintree`, null],
  [`${API_ROOT}/orders`, []],
  [`${API_ROOT}/controls/orders`, {}],
  // The session check at boot reads /users/me since main's 818baeff (it used to read /order_options).
  [`${API_ROOT}/users/me`, user],
  [`${API_ROOT}/users/${user.id}`, user],
  [`${API_ROOT}/users`, customers],
  [`${API_ROOT}/business`, businesses],
  [`${API_ROOT}/countries`, []],
  [`${API_ROOT}/business_types`, []],
  [`${API_ROOT}/backoffice/businesses`, businesses],
  [`${API_ROOT}/offers`, []],
  [`${API_ROOT}/paymethods`, []],
  [`${API_ROOT}/config_categories`, []],
  [`${API_ROOT}/carts`, []]
])

const responseFor = result => ({
  error: false,
  result,
  pagination: {
    current_page: 1,
    page_size: 10,
    total_pages: 1,
    total: Array.isArray(result) ? result.length : 0,
    from: Array.isArray(result) && result.length > 0 ? 1 : 0,
    to: Array.isArray(result) ? result.length : 0
  }
})

async function installAppNetworkBoundary (context) {
  const log = {
    localAssets: [],
    fixtureReads: [],
    blockedExternal: [],
    blockedWrites: [],
    blockedWebSockets: [],
    unknownLocalReads: [],
    unknownFixtureReads: []
  }

  await context.route('**/*', async route => {
    const request = route.request()
    const method = request.method()
    const url = new URL(request.url())
    const requestLabel = `${method} ${url.origin}${url.pathname}`

    if (url.origin === APP_ORIGIN && url.pathname.startsWith('/fixture-api/')) {
      if (method !== 'GET') {
        log.blockedWrites.push(requestLabel)
        await route.abort('blockedbyclient')
        return
      }
      if (!fixtureResults.has(url.pathname)) {
        log.unknownFixtureReads.push(requestLabel)
        await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: true, result: ['unknown synthetic fixture endpoint'] }) })
        return
      }
      log.fixtureReads.push(requestLabel)
      await route.fulfill({ json: responseFor(fixtureResults.get(url.pathname)) })
      return
    }

    if (url.origin === APP_ORIGIN && method === 'GET' && (appDocuments.has(url.pathname) || localAssetPath(url.pathname))) {
      log.localAssets.push(requestLabel)
      await route.continue()
      return
    }

    if (url.origin === APP_ORIGIN && method === 'GET') log.unknownLocalReads.push(requestLabel)
    else if (method !== 'GET') log.blockedWrites.push(requestLabel)
    else log.blockedExternal.push(requestLabel)
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
      api: { url: 'http://127.0.0.1:3045/fixture-api', version: 'v1', language: 'en' },
      socket: { url: 'http://127.0.0.1:3045/fixture-socket' },
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

function expectClosedNetworkBoundary (log) {
  expect(log.unknownFixtureReads, 'every API read must have an explicit synthetic fixture').toEqual([])
  expect(log.unknownLocalReads, 'only explicit application documents and local assets may reach Vite').toEqual([])
  expect(log.localAssets.length, 'the application must load local assets').toBeGreaterThan(0)
  expect(log.fixtureReads.length, 'the application must use synthetic API responses').toBeGreaterThan(0)
  expect(log.blockedWrites.every(label => !label.startsWith('GET '))).toBe(true)
  expect(log.blockedExternal.every(label => !label.includes(APP_ORIGIN))).toBe(true)
}

const readLengthToken = (page, token) =>
  page.evaluate(name => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)), token)

for (const [name, viewport] of Object.entries({
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 }
})) {
  // Scope note: reaching the business, product and payment panes requires creating a
  // cart, which is a business write and is blocked by this boundary on purpose. The
  // real-app coverage therefore stops at the customer step; PaymentOptions,
  // PaymentOptionStripe, ProductForm, ProductOptionSubOption and SingleProductCard are
  // covered against their real styled surfaces by the 3035 harness spec.
  test(`${name} custom order customer step exposes native separated actions with governed roles`, async ({ context, page }, testInfo) => {
    test.setTimeout(120000)
    const network = await installAppNetworkBoundary(context)
    await installSyntheticSession(context)
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    await page.setViewportSize(viewport)
    await page.goto('/orders', { waitUntil: 'domcontentloaded' })

    // redesign 5.5: the empty orders list offers the same action (5.2); the header button is the first in the page and the one this spec drives.
    const open = page.getByRole('button', { name: 'Create custom order', exact: true }).first()
    await expect(open).toBeVisible({ timeout: 90000 })

    // The orders page opens a sound notice dialog; dismiss it before interacting.
    const accept = page.getByRole('button', { name: 'Accept', exact: true })
    const noticeVisible = await accept.last().waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false)
    if (noticeVisible) await accept.last().click()

    const writesBeforeInteractions = network.blockedWrites.length
    await open.click()

    const customerHeading = page.getByRole('heading', { name: 'Customer', exact: true })
    await expect(customerHeading).toBeVisible({ timeout: 90000 })

    // The phone search field carries an accessible name and the create action is
    // a separate native button, not a click handler on generic markup.
    // redesign F6c (Q2-28): the field is a combobox over its suggestions (arrows, aria-activedescendant).
    const phone = page.getByRole('combobox', { name: 'Phone number', exact: true })
    await expect(phone).toBeVisible()
    const newUser = page.getByRole('button', { name: 'New user', exact: true }).first()
    await expect(newUser).toBeVisible()
    // redesign 5.5-B (decisión del usuario 5.2, 2026-10-06): 32px con puntero fino, 44px con puntero grueso.
    // This context has a fine pointer, so the bar is the control-height token, read from the page and not typed here.
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(false)
    const minimumHeight = await readLengthToken(page, '--od-x-control-height')
    expect(minimumHeight, '--od-x-control-height must resolve to a pixel length').toBeGreaterThan(0)
    const newUserBox = await newUser.boundingBox()
    expect(newUserBox.height).toBeGreaterThanOrEqual(minimumHeight)

    // copy fix (QA): clearer wording for the phone search lead.
    const copy = page.getByText('Search for the customer by phone number.', { exact: true })
    await expect(copy).toHaveCSS('font-size', tokens.font.size.productContent)

    // Selecting a customer is a read; it must expose change and remove as two
    // separate native actions instead of one nested inside the other.
    await phone.fill('5550000000')
    // redesign F6c (Q2-28): each suggestion is a native button with role «option» inside the listbox.
    const suggestion = page.getByRole('listbox', { name: 'Customer suggestions' }).getByRole('option', { name: /Fixture Customer/ }).first()
    await expect(suggestion).toHaveJSProperty('tagName', 'BUTTON')
    await expect(suggestion).toBeVisible({ timeout: 30000 })
    await expect(suggestion).toHaveCSS('min-height', '44px')
    await suggestion.click()

    // A customer without a saved address auto-opens the Delivery address list.
    // redesign 5.5-B: it is a view of the same step now (one panel level, C8), not a sidebar stacked on it,
    // and it is left with its own «Back» (the Sheet's «Close» would ask to discard the whole order).
    const addressSidebar = page.locator('#address_list')
    if (await addressSidebar.count() > 0) {
      await addressSidebar.getByRole('button', { name: 'Back', exact: true }).click()
      await expect(addressSidebar).toHaveCount(0)
    }

    const changeCustomer = page.getByRole('button', { name: /Change customer/ })
    const removeCustomer = page.getByRole('button', { name: 'Remove customer', exact: true })
    await expect(changeCustomer).toBeVisible()
    await expect(removeCustomer).toBeVisible()
    expect(await changeCustomer.evaluate(node => node.querySelector('button') === null)).toBe(true)
    // redesign 5.5-B (decisión del usuario 5.2): same fine-pointer bar as «New user».
    const removeBox = await removeCustomer.boundingBox()
    expect(removeBox.height).toBeGreaterThanOrEqual(minimumHeight)
    await removeCustomer.click()
    await expect(page.getByRole('combobox', { name: 'Phone number', exact: true })).toBeVisible()

    // redesign 5.5-B: the step text reads the pilot role --od-x-type-body-size (14px, as productContent did), not the
    // legacy --od-type-content-size of the old styled block; the assertion is the same: one role sets the size.
    await page.evaluate(() => document.documentElement.style.setProperty('--od-x-type-body-size', '19px'))
    await expect(copy).toHaveCSS('font-size', '19px')
    await page.evaluate(() => document.documentElement.style.removeProperty('--od-x-type-body-size'))
    await expect(copy).toHaveCSS('font-size', tokens.font.size.productContent)

    const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)

    await page.screenshot({ path: testInfo.outputPath(`${name}-create-custom-order-2.png`), fullPage: true })

    // Every control this batch renders inside the real sidebar is a native action with
    // an accessible name. The nested Delivery address sidebar belongs to another batch
    // and is excluded. The total is asserted too, so an empty match cannot pass.
    const sidebarActions = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('#custom_order_details button')].filter(node => !node.closest('#address_list'))
      return {
        total: nodes.length,
        nameless: nodes.filter(node => !(node.textContent || '').trim() && !node.getAttribute('aria-label') && !node.getAttribute('aria-labelledby') && !node.getAttribute('title')).length
      }
    })
    expect(sidebarActions.total).toBeGreaterThan(0)
    expect(sidebarActions.nameless, 'every action in the custom order sidebar needs an accessible name').toBe(0)

    expect(pageErrors, 'the adopted surfaces must not raise runtime errors').toEqual([])
    expect(network.blockedWrites.length, 'no interaction may attempt a business write').toBe(writesBeforeInteractions)
    // Vite's dev socket and the synthetic order socket are the only sockets attempted; both stay local and closed.
    expect(network.blockedWebSockets.filter(url => !url.includes('127.0.0.1:3045'))).toEqual([])
    expectClosedNetworkBoundary(network)
  })
}
