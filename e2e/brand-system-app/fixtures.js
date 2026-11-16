import { expect, test } from '@playwright/test'

const APP_ORIGIN = 'http://127.0.0.1:3018'
const API_ROOT = '/fixture-api/v1/en/brand-fixture'
const appDocuments = new Set([
  '/',
  '/login',
  '/password/forgot',
  '/messages',
  '/orders',
  '/drivers-dashboard',
  '/delivery/drivers-companies',
  '/delivery/drivers-groups',
  '/delivery/drivers-list',
  '/stores/list',
  '/marketing/promotions-enterprise',
  '/settings/basic',
  '/profile'
])
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

const language = {
  id: 1,
  code: 'en',
  name: 'English',
  default: true,
  enabled: true,
  rtl: false
}

const fixtureResults = new Map([
  [`${API_ROOT}/validationfields`, []],
  // redesign W0-12 (T0-49, M-08): the Settings hub opens on the orders group, whose checkout fields panel reads these two
  [`${API_ROOT}/checkoutfields`, []],
  [`${API_ROOT}/validation_field_sites`, []],
  [`${API_ROOT}/languages`, [language]],
  [`${API_ROOT}/translations`, {}],
  [`${API_ROOT}/current`, { code: 'brand-fixture', name: 'Synthetic test tenant', status: 'active' }],
  [`${API_ROOT}/configs`, {}],
  [`${API_ROOT}/order_options`, { carts: [] }],
  [`${API_ROOT}/billing/subscriptions`, []],
  [`${API_ROOT}/billing/subscriptions/upgrade-offer`, { eligible: false }],
  [`${API_ROOT}/current/support`, { intercom: false }],
  [`${API_ROOT}/google_actions/status`, {}],
  [`${API_ROOT}/ai/agents`, []],
  [`${API_ROOT}/sites`, []],
  [`${API_ROOT}/builder/apps`, []],
  [`${API_ROOT}/plugins/key/braintree`, null],
  [`${API_ROOT}/orders`, []],
  [`${API_ROOT}/controls/orders`, {}],
  [`${API_ROOT}/users/${user.id}`, user],
  // `main` checks the stored session at boot (`SessionContext/sessionCheck.js`). The
  // synthetic session answers with the same user it signs in with.
  [`${API_ROOT}/users/me`, user],
  [`${API_ROOT}/business`, []],
  [`${API_ROOT}/countries`, []],
  [`${API_ROOT}/plugins`, []],
  [`${API_ROOT}/business_types`, []],
  [`${API_ROOT}/backoffice/businesses`, []],
  [`${API_ROOT}/offers`, []],
  [`${API_ROOT}/paymethods`, []],
  [`${API_ROOT}/config_categories`, []]
])

const populatedOrders = [
  {
    id: 910001,
    uuid: 'fixture-order-910001',
    external_id: 'FIXTURE-ORDER-001',
    status: 0,
    created_at: '2026-09-13 12:00:00',
    delivery_datetime: '2026-09-13 12:30:00',
    delivery_datetime_utc: '2026-09-13 17:30:00',
    delivery_type: 1,
    time_status: 'in_time',
    customer_id: 930001,
    products: [{
      id: 970001,
      code: 'FIXTURE-PRODUCT-001',
      name: 'Long synthetic product for order detail verification',
      quantity: 2,
      price: 8,
      total: 19,
      valid: true,
      valid_menu: true,
      valid_quantity: true,
      ingredients: [{ id: 980001, name: 'Long sliced onion ingredient', selected: false }],
      options: [{ id: 980002, name: 'Toppings', rank: 1, suboptions: [{ id: 980003, name: 'Olives', quantity: 2, position: 'left', half_price: 1.5, price: 3 }] }],
      comment: 'Keep this long operational product note visible.'
    }],
    payment_events: [],
    business_id: 920001,
    business: {
      id: 920001,
      name: 'Synthetic Store Alpha',
      slug: 'synthetic-store-alpha',
      logo: null,
      phone: '+15550100',
      email: 'operations-contact-with-a-very-long-name@example.invalid',
      address: '100 Very Long Operations Avenue, Suite 12345',
      city: { id: 940001, name: 'Fixture City' }
    },
    customer: {
      id: 930001,
      name: 'Fixture Customer',
      lastname: 'Longname',
      email: 'fixture.customer@example.invalid',
      cellphone: '+15550000000',
      address: '200 Another Very Long Customer Address, Apartment 98765',
      orders_count: 2
    },
    driver: null,
    summary: { subtotal: 20, subtotal_with_discount: 20, discount: 0, tax: 0, service_fee: 0, driver_tip: 0, total: 24.5 },
    currency: 'USD',
    logistic_status: 'pending',
    logistic_attemps: 0,
    priority: 0,
    unread_count: 0,
    unread_general_count: 0,
    unread_direct_count: 0
  },
  {
    id: 910002,
    uuid: 'fixture-order-910002',
    external_id: 'FIXTURE-ORDER-002',
    status: 1,
    created_at: '2026-09-13 12:05:00',
    delivery_datetime: '2026-09-13 12:45:00',
    delivery_datetime_utc: '2026-09-13 17:45:00',
    delivery_type: 2,
    time_status: 'in_time',
    business_id: 920002,
    business: {
      id: 920002,
      name: 'Synthetic Store Beta',
      slug: 'synthetic-store-beta',
      logo: null,
      city: { id: 940001, name: 'Fixture City' }
    },
    customer: {
      id: 930002,
      name: 'Fixture Guest',
      email: 'fixture.guest@example.invalid',
      cellphone: '+15550000001',
      orders_count: 0
    },
    driver: null,
    summary: { total: 18 },
    currency: 'USD',
    logistic_status: 'pending',
    logistic_attemps: 0,
    priority: 0,
    unread_count: 0,
    unread_general_count: 0,
    unread_direct_count: 0
  }
]

const populatedBusinesses = [
  {
    id: 920001,
    external_id: 'FIXTURE-STORE-001',
    name: 'Synthetic Store Alpha',
    slug: 'synthetic-store-alpha',
    enabled: true,
    featured: false,
    city_id: 940001,
    logo: null,
    header: null,
    reviews: { total: 4 }
  },
  {
    id: 920002,
    external_id: 'FIXTURE-STORE-002',
    name: 'Synthetic Store Beta',
    slug: 'synthetic-store-beta',
    enabled: true,
    featured: true,
    city_id: 940001,
    logo: null,
    header: null,
    reviews: { total: 3 }
  }
]

const populatedDrivers = [
  {
    id: 960001,
    name: 'Ada',
    lastname: 'Lovelace',
    enabled: true,
    available: true,
    busy: true,
    assigned_orders_count: 3,
    photo: null,
    location: { lat: 40.7744, lng: -73.9678 },
    last_location_at: '2026-09-15 13:45:00',
    reviews: { total: 5 },
    drivergroups: []
  },
  {
    id: 960002,
    name: 'Grace',
    lastname: 'Hopper with a long dispatch surname',
    enabled: true,
    available: true,
    busy: false,
    assigned_orders_count: 0,
    photo: null,
    location: '40.7812,-73.9665',
    last_location_at: '2026-09-15 13:48:00',
    reviews: { total: 4 },
    drivergroups: []
  },
  {
    id: 960003,
    name: 'Linh',
    lastname: 'Nguyễn',
    enabled: true,
    available: false,
    busy: false,
    assigned_orders_count: 1,
    photo: null,
    location: null,
    last_location_at: '2026-09-15 12:30:00',
    reviews: { total: 3 },
    drivergroups: []
  }
]

const populatedDriverCompanies = [
  {
    id: 965001,
    name: 'Long Fleet Company Name',
    limit: 20,
    priority: 1,
    timezone: 'America/Chicago',
    address: '100 Very Long Operations Avenue, Suite 12345',
    enabled: true,
    webhook_new_order: 'https://example.invalid/new-order',
    webhook_cancel_request: 'https://example.invalid/cancel',
    webhook_order_status_changed: 'https://example.invalid/status',
    schedule: [0, 1, 2, 3, 4, 5, 6].map(() => ({
      enabled: true,
      lapses: [{ open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 45 } }]
    }))
  },
  {
    id: 965002,
    name: 'Second Delivery Partner',
    limit: 8,
    priority: 0,
    timezone: 'Europe/Paris',
    address: '200 Partner Street',
    enabled: false,
    schedule: []
  }
]

const populatedFixtureResults = new Map(fixtureResults)
populatedFixtureResults.set(`${API_ROOT}/orders`, populatedOrders)
populatedFixtureResults.set(`${API_ROOT}/orders/910001/messages`, [])
// redesign messages FASE 3 (decision 2A): /messages loads the chat of the conversation a row selects, so the second order's log is read too
populatedFixtureResults.set(`${API_ROOT}/orders/910002/messages`, [])
populatedFixtureResults.set(`${API_ROOT}/orders/910001/metafields`, [])
populatedFixtureResults.set(`${API_ROOT}/controls/orders/910001`, { drivers: [], driver_companies: [] })
populatedFixtureResults.set(`${API_ROOT}/users`, populatedDrivers)
populatedFixtureResults.set(`${API_ROOT}/driver_companies`, populatedDriverCompanies)
populatedFixtureResults.set(`${API_ROOT}/business`, populatedBusinesses)
populatedFixtureResults.set(`${API_ROOT}/paymethods`, [
  { id: 971001, name: 'Cash', gateway: 'cash', enabled: true },
  { id: 971002, name: 'Card delivery', gateway: 'card_delivery', enabled: true }
])
populatedFixtureResults.set(`${API_ROOT}/drivergroups`, [
  {
    id: 975001,
    name: 'Downtown couriers',
    enabled: true,
    type: 0,
    drivers: [960001, 960002],
    administrators: [],
    logs: []
  },
  {
    id: 975002,
    name: 'Weekend delivery group',
    enabled: false,
    type: 0,
    drivers: [],
    administrators: [],
    logs: []
  },
  {
    id: 970001,
    name: 'Downtown weekend couriers',
    enabled: true,
    type: 0,
    drivers: [960001],
    administrators: [],
    logs: []
  }
])
populatedFixtureResults.set(`${API_ROOT}/drivergroups/975001`, {
  id: 975001,
  name: 'Downtown couriers',
  enabled: true,
  type: 0,
  drivers: [960001, 960002],
  administrators: [],
  logs: []
})
populatedFixtureResults.set(`${API_ROOT}/drivergroups/975002`, {
  id: 975002,
  name: 'Weekend delivery group',
  enabled: false,
  type: 0,
  drivers: [],
  administrators: [],
  logs: []
})
populatedFixtureResults.set(`${API_ROOT}/countries`, [{
  id: 950001,
  code: 'US',
  name: 'Fixture Country',
  enabled: true,
  cities: [{ id: 940001, name: 'Fixture City' }]
}])

const responseFor = result => ({
  error: false,
  result,
  pagination: {
    current_page: 1,
    total_pages: 1,
    total: 0
  }
})

const populatedResponseFor = result => ({
  ...responseFor(result),
  pagination: {
    current_page: 1,
    page_size: 10,
    total_pages: 1,
    total: Array.isArray(result) ? result.length : 0,
    from: Array.isArray(result) && result.length > 0 ? 1 : 0,
    to: Array.isArray(result) ? result.length : 0
  }
})

// main's StoreOnboardingGate asks `GET /business?params=id&page_size=1` whether the project has any store,
// and with none it replaces the route with the guided onboarding. Every scenario is a project that already went
// through it, as in main: that one probe answers one id. Every other read keeps its scenario's result.
const isOnboardingDiscovery = url =>
  url.pathname === `${API_ROOT}/business` && url.searchParams.get('params') === 'id' && url.searchParams.get('page_size') === '1'
const onboardedProject = [{ id: 1 }]

export async function installAppNetworkBoundary (context, { scenario = 'empty' } = {}) {
  if (!['empty', 'populated'].includes(scenario)) throw new Error(`Unknown app fixture scenario: ${scenario}`)
  const selectedResults = scenario === 'populated' ? populatedFixtureResults : fixtureResults
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

      if (!selectedResults.has(url.pathname)) {
        log.unknownFixtureReads.push(requestLabel)
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: true, result: ['unknown synthetic fixture endpoint'] })
        })
        return
      }

      log.fixtureReads.push(requestLabel)
      const result = isOnboardingDiscovery(url) ? onboardedProject : selectedResults.get(url.pathname)
      await route.fulfill({ json: scenario === 'populated' ? populatedResponseFor(result) : responseFor(result) })
      return
    }

    if (url.origin === APP_ORIGIN && method === 'GET' && (appDocuments.has(url.pathname) || localAssetPath(url.pathname))) {
      log.localAssets.push(requestLabel)
      await route.continue()
      return
    }

    if (url.origin === APP_ORIGIN && method === 'GET') {
      log.unknownLocalReads.push(requestLabel)
    } else if (method !== 'GET') {
      log.blockedWrites.push(requestLabel)
    } else {
      log.blockedExternal.push(requestLabel)
    }
    await route.abort('blockedbyclient')
  })

  await context.routeWebSocket(/.*/, socket => {
    log.blockedWebSockets.push(socket.url())
    socket.close()
  })

  return log
}

export async function installSyntheticSession (context, { authenticated }) {
  await context.addInitScript(({ authenticated, language, user }) => {
    window.__CONFIG__ = {
      project: 'brand-fixture',
      use_project_domain: false,
      use_project_subdomain: false,
      api: {
        url: 'http://127.0.0.1:3018/fixture-api',
        version: 'v1',
        language: 'en'
      },
      socket: { url: 'http://127.0.0.1:3018/fixture-socket' },
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
  }, { authenticated, language, user })
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

export { APP_ORIGIN, expect, test }
