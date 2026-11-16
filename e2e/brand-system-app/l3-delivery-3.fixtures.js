// Batch-scoped app boundary.
//
// The shared e2e/brand-system-app/fixtures.js pins APP_ORIGIN and the synthetic
// session to 127.0.0.1:3018, which the L3 isolation plan reserves for
// Delivery-1. This batch runs the application on its own port (3043), so it
// owns an equivalent boundary here instead of editing the shared module. The
// contract is the same: GET-only synthetic reads, no external origin, no
// business write ever reaches a server. The batch integration notes carry the
// exact change that lets integrate/ fold this back into the shared module.
import { expect, test } from '@playwright/test'

export const APP_PORT = 3043
export const APP_ORIGIN = `http://127.0.0.1:${APP_PORT}`
const API_ROOT = '/fixture-api/v1/en/brand-fixture'

const appDocuments = new Set(['/login', '/delivery/drivers-list'])
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

const drivers = [
  {
    id: 960001,
    name: 'Ada',
    lastname: 'Lovelace',
    email: 'ada.lovelace@example.invalid',
    cellphone: '5550100',
    enabled: true,
    available: true,
    busy: false,
    level: 4,
    assigned_orders_count: 3,
    photo: null,
    location: { lat: 40.7744, lng: -73.9678 },
    last_location_at: '2026-09-15 13:45:00',
    phone_verified: true,
    email_verified: true,
    driver_groups: [{ id: 970001, name: 'Downtown weekend couriers' }],
    drivergroups: [{ id: 970001, name: 'Downtown weekend couriers' }]
  },
  {
    id: 960002,
    name: 'Grace',
    lastname: 'Hopper with a long dispatch surname',
    email: 'grace.hopper@example.invalid',
    cellphone: '5550101',
    enabled: false,
    available: false,
    busy: true,
    level: 4,
    assigned_orders_count: 0,
    photo: null,
    location: { lat: 40.7812, lng: -73.9665 },
    last_location_at: '2026-09-15 13:48:00',
    phone_verified: false,
    email_verified: true,
    driver_groups: [],
    drivergroups: []
  }
]

const results = new Map([
  // Base bootstrap reads the shell performs before any batch surface renders.
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
  [`${API_ROOT}/orders`, []],
  [`${API_ROOT}/controls/orders`, {}],
  [`${API_ROOT}/users`, drivers],
  [`${API_ROOT}/drivergroups`, [{ id: 970001, name: 'Downtown weekend couriers', enabled: true, drivers: [960001], administrators: [], type: 0 }]],
  [`${API_ROOT}/business`, []],
  // `main` checks the stored session at boot (`SessionContext/sessionCheck.js`), as in the shared fixture.
  [`${API_ROOT}/users/me`, user],
  [`${API_ROOT}/countries`, []],
  [`${API_ROOT}/users/${user.id}`, user]
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

export async function installBatchNetworkBoundary (context) {
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
    const label = `${method} ${url.origin}${url.pathname}`

    if (url.origin === APP_ORIGIN && url.pathname.startsWith('/fixture-api/')) {
      if (method !== 'GET') {
        log.blockedWrites.push(label)
        await route.abort('blockedbyclient')
        return
      }
      if (!results.has(url.pathname)) {
        log.unknownFixtureReads.push(label)
        await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: true, result: ['unknown synthetic fixture endpoint'] }) })
        return
      }
      log.fixtureReads.push(label)
      // main's StoreOnboardingGate asks `GET /business?params=id&page_size=1` whether the project has any store and,
      // with none, replaces the route with the guided onboarding. The scenario is a project that already went through it: that
      // one probe answers one id. Every other read keeps the scenario result.
      const onboardingProbe = url.pathname === `${API_ROOT}/business` && url.searchParams.get('params') === 'id' && url.searchParams.get('page_size') === '1'
      await route.fulfill({ json: responseFor(onboardingProbe ? [{ id: 1 }] : results.get(url.pathname)) })
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

export async function installBatchSession (context, { authenticated }) {
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

export function expectClosedBatchBoundary (log) {
  expect(log.unknownFixtureReads, 'every API read must have an explicit synthetic fixture').toEqual([])
  expect(log.unknownLocalReads, 'only explicit application documents and local assets may reach Vite').toEqual([])
  expect(log.localAssets.length, 'the application must load local assets').toBeGreaterThan(0)
  expect(log.fixtureReads.length, 'the application must use synthetic API responses').toBeGreaterThan(0)
  expect(log.fixtureReads.every(label => label.startsWith(`GET ${APP_ORIGIN}/fixture-api/`))).toBe(true)
  expect(log.blockedWrites.every(label => !label.startsWith('GET ')), 'no business write may leave the boundary').toBe(true)
  expect(log.blockedExternal.every(label => !label.includes(APP_ORIGIN))).toBe(true)
}

export { expect, test }
