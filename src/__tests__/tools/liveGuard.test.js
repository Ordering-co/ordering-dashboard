// redesign W0-9a (T0-36)
import { describe, expect, it } from 'vitest'
import { decide, SIDE_EFFECT_PATTERNS } from '../../../scripts/redesign/tools/live-guard.mjs'
import settings from '../../config.json'

// redesign assistant: every request of the assistant client (AssistantContext/client.js)
const ASSISTANT_CALLS = [
  ['GET', '/status'],
  ['POST', '/notice'],
  ['GET', '/conversations/c1'],
  ['DELETE', '/conversations/c1'],
  ['POST', '/messages'],
  ['POST', '/actions/confirm'],
  ['POST', '/actions/cancel'],
  ['POST', '/dashboard-search/results']
]

const localOrigin = 'http://127.0.0.1:3031'
const apiOrigin = 'https://apiv4.ordering.co'
const apiPrefix = '/v400/en/orderingv1/'
const call = (method, url) => decide({ method, url, localOrigin, apiOrigin, apiPrefix })
const api = path => `${apiOrigin}${apiPrefix}${path}`

// Every GET with side effects: [endpoint, name of the rule that must block it].
// Removing a rule from the module turns its rows red.
const SIDE_EFFECTS = [
  ['orders/123/messages/456/read', 'chat-read-mark'],
  ['orders/123/messages/456/read/', 'chat-read-mark'],
  ['business_payment_reports/download', 'payment-reports-download'],
  ['business_payment_invoices/payment_history', 'payment-history'],
  ['backoffice/schools/9/reports/attendance.xlsx', 'school-reports'],
  ['backoffice/schools/9/reports/attendance.pdf', 'school-reports'],
  ['backoffice/schools/9/labels.pdf', 'school-labels'],
  ['billing/paymethods/requirements', 'paymethods-requirements'],
  ['integrations/internal/tokens/current', 'internal-token-current'],
  ['integrations/internal/tokens/current/', 'internal-token-current'],
  ['users/7/google/permissions/request?token=abc', 'google-permissions-request'],
  ['builder/apps/5/downloads', 'builder-app-downloads'],
  // redesign my-products: the artifact files themselves (the QR and «Download» links of a build)
  ['builder/apps/5/downloads/android/release/apk', 'builder-app-downloads'],
  ['builder/apps/5/downloads/ios/ad-hoc/ipa', 'builder-app-downloads'],
  // B2: Builder's «Download» of a build mints a signed link that lasts 15 minutes (builderApi getBuilderBuildDownload)
  ['dashboard/builder/products/31/apps/310/builds/77/download', 'builder-build-download'],
  ['dashboard/builder/products/31/apps/310/builds/77/download/', 'builder-build-download'],
  ['franchises/1/sites/current', 'white-label-site-current'],
  ['business/41/sites/current/', 'white-label-site-current'],
  ['orders_v2.csv', 'generic-csv'],
  ['whatever/report.xlsx', 'generic-xlsx'],
  ['whatever/report.pdf', 'generic-pdf'],
  ['whatever/download', 'generic-download'],
  ['whatever/downloads', 'generic-download'],
  ['orders/export', 'generic-export'],
  ['orders/exports/12', 'generic-export']
]

describe('live session guard: GETs with side effects', () => {
  it.each(SIDE_EFFECTS)('blocks GET %s with rule %s', (path, name) => {
    expect(call('GET', api(path))).toEqual({ allow: false, reason: 'side-effect', pattern: name })
  })

  it('every named rule has at least one endpoint in the list above', () => {
    const covered = new Set(SIDE_EFFECTS.map(([, name]) => name))
    expect(SIDE_EFFECT_PATTERNS.map(({ name }) => name).filter(name => !covered.has(name))).toEqual([])
  })

  it('rule names are unique', () => {
    const names = SIDE_EFFECT_PATTERNS.map(({ name }) => name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('blocks a side-effect endpoint even on OPTIONS', () => {
    expect(call('OPTIONS', api('orders/123/messages/456/read')).allow).toBe(false)
  })

  // fila 45: the server reads `%64` as `d` and `//` as `/`, so a side effect written that way is the same GET
  it.each([
    ['business_payment_reports/%64ownload', 'payment-reports-download'],
    ['business_payment_reports//download', 'payment-reports-download'],
    ['orders_v2%2Ecsv', 'generic-csv'],
    ['orders/%2565xports', 'generic-export'],
    ['franchises/1/sites/%63urrent', 'white-label-site-current'],
    // review r1 #1: a `%2F` inside a one-segment id must not split it and slip past a `[^/]+` rule
    ['franchises/a%2Fb/sites/current', 'white-label-site-current'],
    ['business/a%252Fb/sites/current', 'white-label-site-current'],
    ['users/7%2F8/google/permissions/request', 'google-permissions-request']
  ])('blocks GET %s, written another way, with rule %s', (path, name) => {
    expect(call('GET', api(path))).toEqual({ allow: false, reason: 'side-effect', pattern: name })
  })
})

describe('live session guard: what still passes', () => {
  it.each([
    ['orders'],
    ['orders/123'],
    ['orders/123/messages'], // reading the chat does not mark it read
    ['users'],
    ['languages']
  ])('allows GET %s as api-read', path => {
    expect(call('GET', api(path))).toEqual({ allow: true, reason: 'api-read' })
  })

  it('allows OPTIONS under the API prefix', () => {
    expect(call('OPTIONS', api('orders'))).toEqual({ allow: true, reason: 'api-read' })
  })

  it('allows the login POST', () => {
    expect(call('POST', api('auth'))).toEqual({ allow: true, reason: 'login' })
  })

  it('allows local GET and HEAD', () => {
    expect(call('GET', `${localOrigin}/orders`)).toEqual({ allow: true, reason: 'local' })
    expect(call('HEAD', `${localOrigin}/assets/app.js`)).toEqual({ allow: true, reason: 'local' })
  })
})

describe('live session guard: what stays blocked', () => {
  it('blocks any other POST as a write', () => {
    expect(call('POST', api('orders'))).toEqual({ allow: false, reason: 'write' })
    expect(call('POST', api('integrations/intercom/hash'))).toEqual({ allow: false, reason: 'write' })
    // the Google Calendar link now starts with a POST; the rule of the GET it replaces still names it
    expect(call('POST', api('users/7/google/permissions/request'))).toEqual({ allow: false, reason: 'side-effect', pattern: 'google-permissions-request' })
  })

  it.each(['PUT', 'PATCH', 'DELETE'])('blocks %s under the API prefix as a write', method => {
    expect(call(method, api('orders/123'))).toEqual({ allow: false, reason: 'write' })
  })

  it('blocks a local POST', () => {
    expect(call('POST', `${localOrigin}/anything`)).toEqual({ allow: false, reason: 'write' })
  })

  it('blocks the login path on any other verb or origin', () => {
    expect(call('PUT', api('auth')).allow).toBe(false)
    // fila 45: only the exact login path passes; another spelling of it is a write
    expect(call('POST', api('/auth'))).toEqual({ allow: false, reason: 'write' })
    expect(call('POST', api('%61uth'))).toEqual({ allow: false, reason: 'write' })
    expect(call('POST', `https://other.example${apiPrefix}auth`)).toEqual({ allow: false, reason: 'third-party' })
  })

  it('blocks third parties', () => {
    expect(call('GET', 'https://www.googletagmanager.com/gtm.js')).toEqual({ allow: false, reason: 'third-party' })
    expect(call('POST', 'https://api.onesignal.com/players')).toEqual({ allow: false, reason: 'third-party' })
  })

  // redesign assistant: api-ai applies changes to the project (POST /actions/confirm), so every call of
  // the assistant client, reads included, is a blocked third party; a live session serves it from a fixture instead.
  it('blocks the assistant (api-ai) under every verb, /actions/confirm included', () => {
    const ai = `${new URL(settings.ai_api.url).origin}/projects/orderingv1/ai/assistant`
    expect(new URL(settings.ai_api.url).origin).not.toBe(new URL(settings.api.url).origin)
    for (const [method, path] of ASSISTANT_CALLS) {
      expect(call(method, `${ai}${path}`)).toEqual({ allow: false, reason: 'third-party' })
    }
  })

  it('the API prefix matters: a .pdf or a GET outside the prefix is a third party, not a side effect', () => {
    expect(call('GET', `${apiOrigin}/v400/es/orderingv1/orders`)).toEqual({ allow: false, reason: 'third-party' })
    expect(call('GET', `${apiOrigin}/v400/en/otherproject/report.pdf`)).toEqual({ allow: false, reason: 'third-party' })
    expect(call('GET', 'https://cdn.example.com/files/report.pdf')).toEqual({ allow: false, reason: 'third-party' })
  })
})
