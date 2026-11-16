// Batch-scoped copy of the synthetic application boundary. It keeps the same
// contract as e2e/brand-system-app/fixtures.js (GET-only synthetic reads, no
// business writes, no external origin) on the Delivery-2 port, and adds the
// driver-group reads this batch needs. The shared file stays untouched; the
// fragment to fold in is recorded in the batch integration notes.
import { expect, test } from '@playwright/test'

const APP_PORT = 3042
const APP_ORIGIN = `http://127.0.0.1:${APP_PORT}`
const API_ROOT = '/fixture-api/v1/en/brand-fixture'
const appDocuments = new Set(['/login', '/delivery/drivers-groups'])
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

const businesses = [
  { id: 920001, name: 'Synthetic Store Alpha', slug: 'synthetic-store-alpha', enabled: true, logo: null },
  { id: 920002, name: 'Synthetic Store Beta', slug: 'synthetic-store-beta', enabled: true, logo: null }
]

const drivers = [
  { id: 960001, name: 'Ada', lastname: 'Lovelace', enabled: true, available: true, level: 4, photo: null, drivergroups: [] },
  { id: 960002, name: 'Grace', lastname: 'Hopper with a long dispatch surname', enabled: true, available: true, level: 4, photo: null, drivergroups: [] }
]

const driverCompanies = [
  { id: 965001, name: 'Long Fleet Company Name', enabled: true },
  { id: 965002, name: 'Second Delivery Partner', enabled: false }
]

const paymethods = [
  { id: 971001, name: 'Cash', gateway: 'cash', enabled: true },
  { id: 971002, name: 'Card delivery', gateway: 'card_delivery', enabled: true }
]

const driverGroup = {
  id: 975001,
  name: 'Downtown couriers',
  enabled: true,
  type: 0,
  priority: 0,
  administrator_id: null,
  autoassign_type: 1,
  autoassign_amount_drivers: 1,
  autoassign_forced_assignment: false,
  autoassign_autoaccept_by_driver: false,
  autoassign_autoassign_driver: false,
  autoassign_initial_radius: 500,
  autoassign_increment_radius: 500,
  autoassign_max_radius: 5000,
  autoassign_customer_max_distance_from_business: 1500,
  autoreject_after_expiration: false,
  orders_group_start_in_status: 7,
  orders_group_max_orders: 2,
  orders_group_use_maps_api: false,
  driver_available_max_distance: null,
  drivers: drivers.map(driver => driver.id),
  business: businesses.map(business => business.id),
  paymethods: paymethods.map(paymethod => paymethod.id),
  driver_companies: [],
  logs: []
}

const secondDriverGroup = { ...driverGroup, id: 975002, name: 'Weekend delivery group', enabled: false }

const results = new Map([
  // `main` checks the stored session at boot (`SessionContext/sessionCheck.js`), as in the shared fixture.
  [`${API_ROOT}/users/me`, user],
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
  [`${API_ROOT}/users/${user.id}`, user],
  [`${API_ROOT}/users`, drivers],
  [`${API_ROOT}/business`, businesses],
  [`${API_ROOT}/backoffice/businesses`, businesses],
  [`${API_ROOT}/business_types`, []],
  [`${API_ROOT}/countries`, []],
  [`${API_ROOT}/offers`, []],
  [`${API_ROOT}/paymethods`, paymethods],
  [`${API_ROOT}/config_categories`, []],
  // the shell reads the AI agents at boot; none here
  [`${API_ROOT}/ai/agents`, []],
  [`${API_ROOT}/driver_companies`, driverCompanies],
  [`${API_ROOT}/drivergroups`, [driverGroup, secondDriverGroup]],
  [`${API_ROOT}/drivergroups/${driverGroup.id}`, driverGroup],
  [`${API_ROOT}/drivergroups/${secondDriverGroup.id}`, secondDriverGroup]
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

export async function installAppNetworkBoundary (context) {
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
      if (!results.has(url.pathname)) {
        log.unknownFixtureReads.push(requestLabel)
        await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: true, result: ['unknown synthetic fixture endpoint'] }) })
        return
      }
      log.fixtureReads.push(requestLabel)
      await route.fulfill({ json: responseFor(results.get(url.pathname)) })
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

export async function installSyntheticSession (context, { authenticated }) {
  await context.addInitScript(({ authenticated, language, user, origin }) => {
    window.__CONFIG__ = {
      project: 'brand-fixture',
      use_project_domain: false,
      use_project_subdomain: false,
      api: { url: `${origin}/fixture-api`, version: 'v1', language: 'en' },
      socket: { url: `${origin}/fixture-socket` },
      billing_url: '',
      google_maps_key: '',
      google_tag_manager: '',
      posthog_api_key: '',
      posthog_analytics_enabled: false
    }
    localStorage.clear()
    localStorage.setItem('project', 'brand-fixture')
    localStorage.setItem('language', JSON.stringify(language))
    if (authenticated) {
      localStorage.setItem('token', 'synthetic-not-a-credential')
      localStorage.setItem('user', JSON.stringify(user))
    }
  }, { authenticated, language, user, origin: APP_ORIGIN })
}

export function expectClosedNetworkBoundary (log) {
  expect(log.unknownFixtureReads, 'every API read must have an explicit synthetic fixture').toEqual([])
  expect(log.unknownLocalReads, 'only explicit application documents and local assets may reach Vite').toEqual([])
  expect(log.localAssets.length, 'the application must load local assets').toBeGreaterThan(0)
  expect(log.fixtureReads.length, 'the application must use synthetic API responses').toBeGreaterThan(0)
  expect(log.localAssets.every(label => label.startsWith(`GET ${APP_ORIGIN}/`))).toBe(true)
  expect(log.fixtureReads.every(label => label.startsWith(`GET ${APP_ORIGIN}/fixture-api/`))).toBe(true)
  expect(log.blockedWrites.every(label => !label.startsWith('GET '))).toBe(true)
  expect(log.blockedExternal.every(label => !label.includes(APP_ORIGIN))).toBe(true)
}

export { APP_ORIGIN, driverGroup, expect, test }
