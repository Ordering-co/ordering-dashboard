// redesign W0-9d (T0-39)
import { describe, expect, it } from 'vitest'
import { compileFailRule, DEFAULT_FAIL_MESSAGE, failFromArgv, failureResponse, FALLBACK_USER, installSyntheticWrites, matchFailRule, MAX_BASES, missingProbeUrl, NEVER_SIMULATE, parseBody, sessionUserFrom, shouldSynthesize, summarizeBody, syntheticResponse } from '../../../scripts/redesign/tools/live-synthetic.mjs'
import { MESSAGE_RECORD_KEYS } from '../../../scripts/redesign/tools/fake-socket.mjs'
import { decide } from '../../../scripts/redesign/tools/live-guard.mjs'
import settings from '../../config.json'

const localOrigin = 'http://127.0.0.1:3031'
const apiOrigin = 'https://apiv4.ordering.co'
const apiPrefix = '/v400/en/orderingv1/'
const ctx = { localOrigin, apiOrigin, apiPrefix }
const api = path => `${apiOrigin}${apiPrefix}${path}`
const call = (method, url) => shouldSynthesize({ method, url }, ctx)

// Writes that must NEVER be simulated: [method, endpoint, name of the rule that stops them].
// Removing a rule from NEVER_SIMULATE turns its rows red.
const NEVER = [
  ['POST', 'auth/sms/twilio', 'auth'],
  ['POST', 'auth/sms/twilio/verify', 'auth'],
  ['PUT', 'auth', 'auth'],
  ['POST', 'orders/123/refund', 'refunds'],
  ['POST', 'payments/stripe/refund', 'refunds'],
  ['POST', 'payments/stripe/cards', 'payments'],
  ['POST', 'business_payment_accounts', 'payments'],
  ['POST', 'business_payment_invoices', 'payments'],
  ['PUT', 'billing/subscriptions/4', 'billing'],
  ['POST', 'billing/subscriptions/addons', 'billing'],
  ['DELETE', 'users/7/paymethods/9', 'paymethods'],
  ['PUT', 'business/5/paymethods/2', 'paymethods'],
  ['POST', 'users/7/wallets/3/events', 'wallet-events'],
  ['POST', 'marketing_campaigns/8/send', 'campaign-send'],
  ['POST', 'campaigns/8/send', 'campaign-send'],
  ['POST', 'notifications', 'notifications'],
  ['POST', 'users/7/notifications/1', 'notifications'],
  ['POST', 'users/7/send', 'send'],
  ['POST', 'orders/3/send_email', 'send'],
  ['POST', 'menus/4/sync_products', 'sync'],
  ['POST', 'users/7/google/calendar/sync', 'sync'],
  ['POST', 'business/5/third_party_integrations/2/start', 'third-party-integrations'],
  ['POST', 'integrations/internal/tokens', 'third-party-integrations'],
  ['PUT', 'languages/2', 'languages'],
  ['POST', 'languages', 'languages'],
  ['DELETE', 'languages/2', 'languages']
]

describe('live synthetic writes: what is simulated', () => {
  it.each([
    ['PUT', 'orders/123'],
    ['PATCH', 'orders/123'],
    ['POST', 'business'],
    ['POST', 'orders/123/messages'],
    ['DELETE', 'business/5/categories/9'],
    ['PUT', 'orders/123?mode=dashboard']
  ])('%s %s is synthesized', (method, path) => {
    expect(call(method, api(path))).toMatchObject({ synthesize: true, reason: 'synthetic', rule: 'api-write' })
  })

  it('a PUT to an order echoes the body, with the id of the path and the fields of the last real GET', () => {
    const body = { status: 7, driver_id: 12 }
    expect(syntheticResponse('PUT', '/orders/123', body)).toEqual({ error: false, result: { status: 7, driver_id: 12, id: 123 } })
    expect(syntheticResponse('PUT', '/orders/123', body, { base: { id: 123, uuid: 'u', status: 0, products: [1] } }))
      .toEqual({ error: false, result: { id: 123, uuid: 'u', status: 7, products: [1], driver_id: 12 } })
  })

  it('a POST creates with an id and echoes the body', () => {
    expect(syntheticResponse('POST', '/business', { name: 'Test shop' }, { id: 990005 })).toEqual({ error: false, result: { name: 'Test shop', id: 990005 } })
    expect(syntheticResponse('POST', '/business', { name: 'x' }).result.id).toBe(990001)
  })

  it('a DELETE answers with an empty result', () => {
    expect(syntheticResponse('DELETE', '/business/5/categories/9')).toEqual({ error: false, result: {} })
  })

  it('a POST to a conversation answers with a whole message: the chat draws its author, can_see and created_at (W1-QB1-07)', () => {
    const user = { id: 42, name: 'Ada', lastname: 'Admin', level: 0 }
    const { error, result } = syntheticResponse('POST', '/orders/13929/messages', { comment: 'hola', type: 2, can_see: '3,0' }, { id: 990011, user, now: Date.UTC(2026, 9, 8, 3, 4, 5) })
    expect(error).toBe(false)
    for (const key of MESSAGE_RECORD_KEYS) expect(result, key).toHaveProperty(key)
    expect(result).toMatchObject({ id: 990011, order_id: 13929, type: 2, comment: 'hola', can_see: '3,0', author_id: 42, author: user, read: true, source: null })
    expect(result).toMatchObject({ created_at: '2026-10-08 03:04:05', updated_at: '2026-10-08 03:04:05' })
    // what the chat does with it
    expect(() => result.can_see.includes(2)).not.toThrow()
    expect(`${result.author.name} ${result.author.lastname}`).toBe('Ada Admin')
  })

  it('a POST to a conversation takes now in UTC and a synthetic author when none is given', () => {
    const { result } = syntheticResponse('POST', '/orders/5/messages', { comment: 'x', type: 2 })
    expect(result.author).toEqual(FALLBACK_USER)
    expect(result.author_id).toBe(FALLBACK_USER.id)
    expect(result.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    expect(result.can_see).toBe('3,0,2')
    expect(syntheticResponse('POST', '/orders/5/messages/', { comment: 'x' }).result.order_id).toBe(5)
  })

  it('an image message keeps its upload in source and not as `file`', () => {
    const data = 'data:image/png;base64,AAAA'
    const { result } = syntheticResponse('POST', '/orders/5/messages', { comment: '', type: 3, can_see: '3,0,2', file: data })
    expect(result).toMatchObject({ type: 3, source: data, comment: '' })
    expect(result).not.toHaveProperty('file')
    expect(syntheticResponse('POST', '/orders/5/messages', { type: 3, file: 'synthetic-file' }).result.source).toMatch(/^data:image\/png/)
  })

  it('only the conversation of an order gets the message shape; any other POST still echoes the body', () => {
    expect(syntheticResponse('POST', '/orders/5/messages/9/read', { a: 1 }, { id: 3 })).toEqual({ error: false, result: { a: 1, id: 3 } })
    expect(syntheticResponse('POST', '/business/5/messages', { a: 1 }, { id: 3 })).toEqual({ error: false, result: { a: 1, id: 3 } })
  })

  // (T-1): the API updates with POST /<resource>/:id (the SDK's save() with an id); only POST /<collection> creates
  it('a POST to a record updates it: the last real GET with the sent fields, the id of the path, no new id (T-1)', () => {
    const base = { id: 72, name: 'Ana', lastname: 'Driver', enabled: true, level: 4 }
    expect(syntheticResponse('POST', '/users/72', { enabled: false }, { id: 990005, base }))
      .toEqual({ error: false, result: { id: 72, name: 'Ana', lastname: 'Driver', enabled: false, level: 4 } })
    expect(syntheticResponse('POST', '/users/72', { enabled: false }, { id: 990005 })).toEqual({ error: false, result: { enabled: false, id: 72 } })
    expect(syntheticResponse('POST', '/business/5/configs/12/', { value: '1' }, { id: 990005 }).result.id).toBe(12)
    expect(syntheticResponse('POST', '/users/72/drivergroups', { driver_group_ids: [] }, { id: 990005 }).result.id).toBe(990005)
  })

  // (T-2): the dashboard sends lists and objects as JSON text; the API answers them with their own type
  const group = { id: 3, name: 'North', type: 0, administrators: [{ id: 70, name: 'Ana' }], drivers: [{ id: 5, name: 'Bo' }], settings: { a: 1 }, description: 'plain' }

  it('a field sent as JSON text comes back with the type it has in the record (T-2)', () => {
    const { result } = syntheticResponse('PUT', '/drivergroups/3', { administrators: '[70,72]', settings: '{"a":2}' }, { base: group })
    expect(result.administrators).toEqual([{ id: 70, name: 'Ana' }, { id: 72 }])
    expect(result.settings).toEqual({ a: 2 })
    expect(result.drivers).toEqual(group.drivers)
    expect(result.id).toBe(3)
    expect(syntheticResponse('POST', '/drivergroups/3', { drivers: '[5]' }, { base: group }).result.drivers).toEqual([{ id: 5, name: 'Bo' }])
    expect(syntheticResponse('PUT', '/x/1', { tags: '[3]' }, { base: { id: 1, tags: [1, 2] } }).result.tags).toEqual([3])
  })

  it('over an empty list, the other records of the collection tell whether its items are records (T-2, seen live)', () => {
    const empty = { ...group, id: 4, administrators: [] }
    const siblings = [{ id: 3, administrators: [{ id: 72, name: 'Aaliyah' }, { id: 70, name: 'Ana' }] }, { id: 9, administrators: 'not a list' }]
    expect(syntheticResponse('PUT', '/drivergroups/4', { administrators: '[72,71]' }, { base: empty, siblings }).result.administrators)
      .toEqual([{ id: 72, name: 'Aaliyah' }, { id: 71 }])
    // fila 46 (T-4): with nothing known about the items, a field the dashboard reads as records is records
    expect(syntheticResponse('PUT', '/drivergroups/4', { administrators: '[72]' }, { base: empty }).result.administrators).toEqual([{ id: 72 }])
    expect(syntheticResponse('PUT', '/drivergroups/4', { drivers: '[5]' }, { base: { ...empty, drivers: [] } }).result.drivers).toEqual([{ id: 5 }])
    // only those fields of that collection: elsewhere an empty list with nothing known stays as sent
    expect(syntheticResponse('PUT', '/x/4', { administrators: '[72]' }, { base: { id: 4, administrators: [] } }).result.administrators).toEqual([72])
    expect(syntheticResponse('PUT', '/drivergroups/4', { administrators: '[72]' }, { base: empty, siblings: [{ id: 3, administrators: [1, 2] }] }).result.administrators).toEqual([72])
    expect(syntheticResponse('PUT', '/drivergroups/4', { ghost: '[72]' }, { base: empty, siblings: [{ id: 3, ghost: [{ id: 72 }] }] }).result.ghost).toBe('[72]')
  })

  it('an emptied list sent as null comes back as an empty list; other fields keep what was sent (T-2)', () => {
    expect(syntheticResponse('PUT', '/drivergroups/3', { administrators: null }, { base: group }).result.administrators).toEqual([])
    expect(syntheticResponse('PUT', '/drivergroups/3', { settings: null }, { base: group }).result.settings).toBe(null)
    expect(syntheticResponse('PUT', '/drivergroups/3', { description: '[1]' }, { base: group }).result.description).toBe('[1]')
    expect(syntheticResponse('PUT', '/drivergroups/3', { administrators: 'not json' }, { base: group }).result.administrators).toBe('not json')
    expect(syntheticResponse('PUT', '/drivergroups/3', { administrators: '{"a":1}' }, { base: group }).result.administrators).toBe('{"a":1}')
    expect(syntheticResponse('PUT', '/drivergroups/3', { administrators: '[72]' }).result.administrators).toBe('[72]')
  })

  it('refuses to build a response for a read', () => {
    expect(() => syntheticResponse('GET', '/orders')).toThrow(/not a write/)
  })
})

describe('live synthetic writes: what is not simulated', () => {
  it('does not touch the login', () => {
    expect(call('POST', api('auth'))).toMatchObject({ synthesize: false, reason: 'login' })
  })

  it('does not touch third parties, nor other hosts under any verb', () => {
    expect(call('POST', 'https://api.stripe.com/v1/charges')).toMatchObject({ synthesize: false, reason: 'third-party' })
    expect(call('PUT', `${apiOrigin}/v400/en/otherproject/orders/1`)).toMatchObject({ synthesize: false, reason: 'third-party' })
    expect(call('POST', 'https://maps.googleapis.com/maps/api/js')).toMatchObject({ synthesize: false, reason: 'third-party' })
  })

  // redesign assistant: a synthetic confirm would claim the assistant changed the project
  it('does not simulate the assistant (api-ai): /actions/confirm stays a blocked third party', () => {
    const ai = `${new URL(settings.ai_api.url).origin}/projects/orderingv1/ai/assistant`
    for (const path of ['/actions/confirm', '/actions/cancel', '/messages', '/notice']) {
      expect(call('POST', `${ai}${path}`)).toMatchObject({ synthesize: false, reason: 'third-party' })
    }
  })

  it('does not touch a write to the local dev server', () => {
    expect(call('POST', `${localOrigin}/anything`)).toMatchObject({ synthesize: false, reason: 'local' })
  })

  it('leaves the reads to the guard', () => {
    expect(call('GET', api('orders'))).toMatchObject({ synthesize: false, reason: 'not-a-write' })
    expect(call('OPTIONS', api('orders/1'))).toMatchObject({ synthesize: false, reason: 'not-a-write' })
  })

  it('leaves the GETs with side effects blocked, with the guard\'s rule name', () => {
    expect(call('GET', api('orders/123/messages/456/read'))).toEqual({ synthesize: false, reason: 'side-effect', rule: 'chat-read-mark', path: '/orders/123/messages/456/read' })
    expect(call('GET', api('orders_v2.csv'))).toMatchObject({ synthesize: false, reason: 'side-effect', rule: 'generic-csv' })
  })

  it.each(NEVER)('%s %s is not simulated (rule %s)', (method, path, name) => {
    expect(call(method, api(path))).toMatchObject({ synthesize: false, reason: 'never-simulate', rule: name })
  })

  it('every rule of NEVER_SIMULATE has a reason and at least one endpoint in the list above', () => {
    for (const { name, reason } of NEVER_SIMULATE) {
      expect(reason, name).toBeTruthy()
      expect(NEVER.some(row => row[2] === name), name).toBe(true)
    }
  })

  it('a rule never swallows a plain resource that only looks similar', () => {
    for (const path of ['business/5/paymentsx', 'orders/1/sendable', 'users/7/walletsx', 'business/5/languagesx']) {
      expect(call('PUT', api(path)).synthesize, path).toBe(true)
    }
  })

  // fila 45 (note 6): the server reads `//auth` or `/%61uth` as /auth, so the rules run on that
  // reading; the answer keeps the path as it was sent. (`/x/../auth` never gets here: the URL parser resolves it.)
  it.each([
    ['POST', '/auth', 'auth'],
    ['POST', '%61uth', 'auth'],
    ['POST', '%2561uth', 'auth'],
    ['POST', '%2Fauth', 'auth'],
    ['POST', 'AUTH/sms/twilio', 'auth'],
    ['POST', 'auth%2Fsms/twilio', 'auth'],
    ['POST', 'orders/123/%72efund', 'refunds'],
    ['POST', 'users/7//wallets/3/%65vents', 'wallet-events'],
    // review r1 #2: a decoded `%2F` inside a segment, and dot segments that only appear once decoded
    ['POST', 'users/7/wallets/1%2F2/events', 'wallet-events'],
    ['POST', 'x%2F..%2Fauth', 'auth'],
    ['POST', 'x/%252e%252e/auth', 'auth'],
    ['PUT', '/languages/2', 'languages']
  ])('%s %s, written another way, is still not simulated (rule %s)', (method, path, name) => {
    expect(call(method, api(path))).toMatchObject({ synthesize: false, reason: 'never-simulate', rule: name, path: `/${path}` })
  })

  it('reading the path like the server does never turns a plain write into a rule', () => {
    for (const path of ['business//5', 'business/%35', 'orders/1/%2E/comments']) {
      expect(call('PUT', api(path)).synthesize, path).toBe(true)
    }
  })
})

describe('live synthetic writes: bodies', () => {
  it('parses JSON, urlencoded and multipart', () => {
    expect(parseBody('{"a":1}', 'application/json')).toEqual({ a: 1 })
    expect(parseBody('a=1&b=x', 'application/x-www-form-urlencoded')).toEqual({ a: '1', b: 'x' })
    const multipart = '--B\r\nContent-Disposition: form-data; name="name"\r\n\r\nShop\r\n--B\r\nContent-Disposition: form-data; name="logo"; filename="a.png"\r\nContent-Type: image/png\r\n\r\nBINARY\r\n--B--\r\n'
    const parsed = parseBody(multipart, 'multipart/form-data; boundary=B')
    expect(parsed.name).toBe('Shop')
    expect(parsed.logo).toMatch(/^data:image\/png/)
    expect(parseBody(null)).toEqual({})
  })

  it('the registry keeps a short body with secrets and files redacted', () => {
    expect(summarizeBody({ name: 'x'.repeat(200), password: 'hunter2', api_key: 'k', logo: 'data:image/png;base64,AAA', tags: [1, 2], meta: { a: 1 }, qty: 3 }))
      .toEqual({ name: `${'x'.repeat(80)}…`, password: '[redacted]', api_key: '[redacted]', logo: '[file]', tags: '[array 2]', meta: '[object]', qty: 3 })
  })
})

describe('live synthetic writes: wiring on a context', () => {
  const fakeContext = () => {
    const handlers = []
    const listeners = []
    return {
      handlers,
      listeners,
      on (event, handler) { listeners.push({ event, handler }) },
      route: async (matcher, handler) => { handlers.push({ matcher, handler }) }
    }
  }
  const fakeRoute = (method, url, postData, headers = {}) => {
    const out = { fulfilled: null, fellBack: false }
    return {
      out,
      request: () => ({ method: () => method, url: () => url, postData: () => postData, headers: () => headers }),
      fulfill: async options => { out.fulfilled = options },
      fallback: async () => { out.fellBack = true }
    }
  }

  it('answers a PUT itself, with CORS headers, and records it; sends a refund on to the guard', async () => {
    const context = fakeContext()
    const synthetic = await installSyntheticWrites(context, ctx)
    const { matcher, handler } = context.handlers[0]
    expect(matcher(new URL(api('orders/1')))).toBe(true)
    expect(matcher(new URL('https://api.stripe.com/v1/charges'))).toBe(false)

    const put = fakeRoute('PUT', api('orders/123'), '{"status":7,"password":"p"}', { origin: localOrigin, 'content-type': 'application/json' })
    await handler(put)
    expect(put.out.fellBack).toBe(false)
    expect(put.out.fulfilled.status).toBe(200)
    expect(put.out.fulfilled.headers['access-control-allow-origin']).toBe(localOrigin)
    expect(JSON.parse(put.out.fulfilled.body)).toEqual({ error: false, result: { status: 7, password: 'p', id: 123 } })

    const refund = fakeRoute('POST', api('orders/123/refund'), '{}')
    await handler(refund)
    expect(refund.out.fellBack).toBe(true)
    expect(refund.out.fulfilled).toBe(null)

    expect(synthetic.count()).toBe(1)
    expect(synthetic.log()).toEqual([expect.objectContaining({ method: 'PUT', path: '/orders/123', body: { status: 7, password: '[redacted]' } })])
  })

  it('gives each POST its own id', async () => {
    const context = fakeContext()
    await installSyntheticWrites(context, ctx)
    const { handler } = context.handlers[0]
    const first = fakeRoute('POST', api('business'), '{"name":"a"}', { 'content-type': 'application/json' })
    const second = fakeRoute('POST', api('business'), '{"name":"b"}', { 'content-type': 'application/json' })
    await handler(first)
    await handler(second)
    expect(JSON.parse(first.out.fulfilled.body).result.id).toBe(990001)
    expect(JSON.parse(second.out.fulfilled.body).result.id).toBe(990002)
  })

  // redesign B1c (W1-QB1-07): the author of what the session sends is the session's own user, learnt from the login answer
  const fakeResponse = (method, url, json, status = 200) => ({ status: () => status, request: () => ({ method: () => method }), url: () => url, json: async () => json })
  const answerOf = route => JSON.parse(route.out.fulfilled.body)

  it('a send is answered with a whole message authored by the user of the login (W1-QB1-07)', async () => {
    const context = fakeContext()
    const synthetic = await installSyntheticWrites(context, ctx)
    const { handler } = context.handlers[0]
    const onResponse = context.listeners.find(({ event }) => event === 'response').handler
    expect(synthetic.user()).toEqual(FALLBACK_USER)

    await onResponse(fakeResponse('POST', api('auth'), { error: false, result: { id: 7, name: 'Sample', lastname: 'Test', level: 0, session: { access_token: 'SECRET-TOKEN' }, email: 'a@b.invalid' } }))
    expect(synthetic.user()).toEqual({ id: 7, name: 'Sample', lastname: 'Test', level: 0 })
    expect(JSON.stringify(synthetic.user())).not.toMatch(/SECRET|a@b/)

    const post = fakeRoute('POST', api('orders/13929/messages'), '{"comment":"hola","type":2,"can_see":"3,0,2"}', { origin: localOrigin, 'content-type': 'application/json' })
    await handler(post)
    const { result } = answerOf(post)
    expect(result).toMatchObject({ id: 990001, order_id: 13929, author_id: 7, author: { id: 7, name: 'Sample', lastname: 'Test', level: 0 }, comment: 'hola', can_see: '3,0,2', type: 2 })
    expect(result.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    for (const key of MESSAGE_RECORD_KEYS) expect(result, key).toHaveProperty(key)
  })

  it('before any login the author is the synthetic one, and a user can be given', async () => {
    const context = fakeContext()
    await installSyntheticWrites(context, ctx)
    const post = fakeRoute('POST', api('orders/5/messages'), '{"comment":"x","type":2}', { 'content-type': 'application/json' })
    await context.handlers[0].handler(post)
    expect(answerOf(post).result.author).toEqual(FALLBACK_USER)

    const given = { id: 9, name: 'Given', lastname: 'User', level: 1 }
    const second = fakeContext()
    const synthetic = await installSyntheticWrites(second, { ...ctx, user: given })
    const again = fakeRoute('POST', api('orders/5/messages'), '{"comment":"x","type":2}', { 'content-type': 'application/json' })
    await second.handlers[0].handler(again)
    expect(synthetic.user()).toEqual(given)
    expect(answerOf(again).result.author_id).toBe(9)
  })

  it('a login answer that is not a user, or a failed one, does not change who the session is', async () => {
    const context = fakeContext()
    const synthetic = await installSyntheticWrites(context, { ...ctx, user: { id: 3, name: 'A', lastname: 'B', level: 0 } })
    const onResponse = context.listeners.find(({ event }) => event === 'response').handler
    await onResponse(fakeResponse('POST', api('auth'), { error: true, result: ['Invalid'] }))
    await onResponse(fakeResponse('POST', api('auth'), { error: false, result: { session: {} } }))
    await onResponse(fakeResponse('POST', api('auth'), { error: false, result: { id: 8, name: 'X', lastname: 'Y', level: 0 } }, 401))
    await onResponse(fakeResponse('PUT', api('auth'), { error: false, result: { id: 8, name: 'X', lastname: 'Y', level: 0 } }))
    expect(synthetic.user().id).toBe(3)
  })

  // redesign stores 1.0: --synthetic-fail answers a matching write as the API does when it fails
  const failOpts = (rules, extra = {}) => ({ ...ctx, fail: { rules: rules.map(compileFailRule), ...extra } })

  it('without fail rules the write succeeds; with one, the same write fails with the chosen message', async () => {
    const plain = fakeContext()
    await installSyntheticWrites(plain, ctx)
    const ok = fakeRoute('POST', api('business/41'), '{"name":"a"}', { origin: localOrigin, 'content-type': 'application/json' })
    await plain.handlers[0].handler(ok)
    expect(answerOf(ok)).toEqual({ error: false, result: { name: 'a', id: 41 } }) // POST /business/:id updates the store, it keeps its id

    const context = fakeContext()
    const synthetic = await installSyntheticWrites(context, failOpts([{ method: 'POST', pattern: '/business/:id' }], { message: 'The name is taken' }))
    const failed = fakeRoute('POST', api('business/41'), '{"name":"a","password":"p"}', { origin: localOrigin, 'content-type': 'application/json' })
    await context.handlers[0].handler(failed)
    expect(failed.out.fellBack).toBe(false)
    expect(failed.out.fulfilled.status).toBe(400) // the API answers its failures with a 4xx (401 "Permission denied" seen live)
    expect(failed.out.fulfilled.headers['access-control-allow-origin']).toBe(localOrigin)
    expect(answerOf(failed)).toEqual({ error: true, result: ['The name is taken'] })
    expect(synthetic.count()).toBe(0)
    expect(synthetic.failed()).toBe(1)
    expect(synthetic.log()).toEqual([expect.objectContaining({ method: 'POST', path: '/business/41', outcome: 'synthetic-fail', rule: 'POST /business/:id', message: 'The name is taken', body: { name: 'a', password: '[redacted]' } })])
  })

  it('a failure keeps the default message and status unless given, and does not spend a POST id', async () => {
    const context = fakeContext()
    await installSyntheticWrites(context, failOpts([{ method: 'PUT', pattern: '/business/:id' }]))
    const { handler } = context.handlers[0]
    const put = fakeRoute('PUT', api('business/41'), '{}')
    await handler(put)
    expect(answerOf(put)).toEqual({ error: true, result: [DEFAULT_FAIL_MESSAGE] })
    const post = fakeRoute('POST', api('business'), '{"name":"b"}', { 'content-type': 'application/json' })
    await handler(post)
    expect(answerOf(post).result.id).toBe(990001)

    const coded = fakeContext()
    await installSyntheticWrites(coded, failOpts([{ method: '*', pattern: '/business/*' }], { status: 500 }))
    const del = fakeRoute('DELETE', api('business/41/categories/9'), '')
    await coded.handlers[0].handler(del)
    expect(del.out.fulfilled.status).toBe(500)
  })

  it('only the matching method and path fail; the rest is synthesized as before', async () => {
    const context = fakeContext()
    const synthetic = await installSyntheticWrites(context, failOpts([{ method: 'POST', pattern: '/business/:id' }]))
    const { handler } = context.handlers[0]
    const others = [
      fakeRoute('PUT', api('business/41'), '{}'),
      fakeRoute('POST', api('business'), '{}'),
      fakeRoute('POST', api('business/41/taxes'), '{}'),
      fakeRoute('POST', api('orders/41'), '{}')
    ]
    for (const route of others) {
      await handler(route)
      expect(answerOf(route).error).toBe(false)
    }
    expect(synthetic.failed()).toBe(0)
    expect(synthetic.count()).toBe(4)
  })

  it('a write the guard keeps blocked can be forced to fail locally, but the login and /auth never (D1)', async () => {
    const context = fakeContext()
    await installSyntheticWrites(context, failOpts([{ method: '*', pattern: '*' }]))
    const { handler } = context.handlers[0]
    const paymethod = fakeRoute('PUT', api('business/41/paymethods/2'), '{"enabled":false}')
    await handler(paymethod)
    expect(paymethod.out.fellBack).toBe(false)
    expect(answerOf(paymethod).error).toBe(true)

    for (const [method, path] of [['POST', 'auth'], ['POST', 'auth/sms/twilio'], ['PUT', 'auth'], ['POST', '/auth'], ['POST', '%61uth']]) {
      const route = fakeRoute(method, api(path), '{}')
      await handler(route)
      expect(route.out.fellBack, `${method} ${path}`).toBe(true)
      expect(route.out.fulfilled).toBe(null)
    }
    const read = fakeRoute('GET', api('business/41'), null)
    await handler(read)
    expect(read.out.fellBack).toBe(true)
    const sideEffect = fakeRoute('POST', api('orders/exports'), '{}')
    await handler(sideEffect)
    expect(sideEffect.out.fellBack).toBe(true)
  })

  // The live session's chain: the guard is registered first, the synthetic handler after it, and Playwright runs
  // the newest route first; route.fallback() hands the request to the next older one.
  const chain = async fail => {
    const handlers = []
    const traffic = { network: [], blocked: [] }
    const context = { on () {}, route: async (matcher, handler) => { handlers.unshift({ matcher, handler }) } }
    await context.route(() => true, async route => {
      const request = route.request()
      const { allow } = decide({ method: request.method(), url: request.url(), ...ctx })
      if (allow) traffic.network.push(`${request.method()} ${request.url()}`)
      else traffic.blocked.push(`${request.method()} ${request.url()}`)
    })
    await installSyntheticWrites(context, fail ? failOpts(fail) : ctx)
    const send = async (method, url, postData = '{}') => {
      const out = { fulfilled: null }
      let i = 0
      const route = {
        request: () => ({ method: () => method, url: () => url, postData: () => postData, headers: () => ({}) }),
        fulfill: async options => { out.fulfilled = options },
        fallback: async () => { await next() }
      }
      const next = async () => {
        while (i < handlers.length && !handlers[i].matcher(new URL(url))) i += 1
        const { handler } = handlers[i++]
        await handler(route)
      }
      await next()
      return out
    }
    return { send, traffic }
  }

  it('with the guard behind it, a forced failure of a blocked write sends nothing out and never fakes a success (D1)', async () => {
    const before = await chain(null)
    expect((await before.send('PUT', api('business/41/paymethods/2'))).fulfilled).toBe(null)
    expect(before.traffic).toEqual({ network: [], blocked: [`PUT ${api('business/41/paymethods/2')}`] })

    const forced = await chain([{ method: 'PUT', pattern: '/business/:id/paymethods/:pm' }])
    const answer = await forced.send('PUT', api('business/41/paymethods/2'))
    expect(JSON.parse(answer.fulfilled.body).error).toBe(true)
    const other = await forced.send('POST', api('business/41/paymethods'))
    expect(other.fulfilled).toBe(null) // not targeted: still blocked, still no synthetic success
    await forced.send('GET', api('business/41'), null)
    expect(forced.traffic).toEqual({ network: [`GET ${api('business/41')}`], blocked: [`POST ${api('business/41/paymethods')}`] })
  })

  // lists are where most records are read (GET /users?…, GET /drivergroups?params=…), so they also give a base
  const json = () => ({ 'content-type': 'application/json' })
  const users = [{ id: 72, name: 'Ana', lastname: 'Driver', enabled: true, level: 4 }, { id: 73, name: 'Bo', enabled: true, level: 4 }]

  it('a POST to a record of a list answers the whole record with its id, and does not spend a POST id (T-1)', async () => {
    const context = fakeContext()
    const synthetic = await installSyntheticWrites(context, ctx)
    const { handler } = context.handlers[0]
    const onResponse = context.listeners.find(({ event }) => event === 'response').handler
    await onResponse(fakeResponse('GET', api('users?page=1&where=[]'), { error: false, result: users, pagination: { total: 2 } }))

    const toggle = fakeRoute('POST', api('users/72'), '{"enabled":false}', json())
    await handler(toggle)
    expect(answerOf(toggle)).toEqual({ error: false, result: { id: 72, name: 'Ana', lastname: 'Driver', enabled: false, level: 4 } })
    const again = fakeRoute('POST', api('users/72'), '{"busy":true}', json())
    await handler(again)
    expect(answerOf(again).result).toEqual({ id: 72, name: 'Ana', lastname: 'Driver', enabled: false, level: 4, busy: true })

    const create = fakeRoute('POST', api('users'), '{"name":"New"}', json())
    await handler(create)
    expect(answerOf(create).result).toEqual({ name: 'New', id: 990001 })
    expect(synthetic.log().map(({ method, path }) => `${method} ${path}`)).toEqual(['POST /users/72', 'POST /users/72', 'POST /users'])
  })

  it('a list adds its fields to what a GET of the record already gave; the GET of the record replaces it', async () => {
    const context = fakeContext()
    await installSyntheticWrites(context, ctx)
    const { handler } = context.handlers[0]
    const onResponse = context.listeners.find(({ event }) => event === 'response').handler
    await onResponse(fakeResponse('GET', api('users/72'), { error: false, result: { id: 72, name: 'Ana', email: 'x@y.invalid' } }))
    await onResponse(fakeResponse('GET', api('users/?params=id,name'), { error: false, result: [{ id: 72, name: 'Ana B' }, 'not a record', { name: 'no id' }] }))
    const first = fakeRoute('PUT', api('users/72'), '{}', json())
    await handler(first)
    expect(answerOf(first).result).toEqual({ id: 72, name: 'Ana B', email: 'x@y.invalid' })

    await onResponse(fakeResponse('GET', api('users/72'), { error: false, result: { id: 72, name: 'Ana C' } }))
    await onResponse(fakeResponse('GET', api('users'), { error: true, result: [{ id: 72, name: 'error' }] }))
    await onResponse(fakeResponse('GET', api('users'), { error: false, result: [{ id: 72, name: 'not 200' }] }, 500))
    const second = fakeRoute('PUT', api('users/72'), '{}', json())
    await handler(second)
    expect(answerOf(second).result).toEqual({ id: 72, name: 'Ana C' })
  })

  // fila 46: K/PaymentOptionWallet stores the answer as the cart (`carts['businessId:' + result.business_id]`)
  it('a wallet put on or taken off a cart answers with the cart the session read, or fails when it read none', async () => {
    const context = fakeContext()
    const synthetic = await installSyntheticWrites(context, ctx)
    const { handler } = context.handlers[0]
    const onResponse = context.listeners.find(({ event }) => event === 'response').handler
    const cart = { uuid: 'c-41', business_id: 41, total: 12.5, products: [{ id: 1 }] }
    await onResponse(fakeResponse('GET', api('order_options?business_id=41'), { error: false, result: { carts: [cart], type: 1 } }))

    const select = fakeRoute('POST', api('carts/c-41/wallets'), JSON.stringify({ wallet_id: 9, user_id: 7 }), json())
    await handler(select)
    expect(answerOf(select)).toEqual({ error: false, result: cart })
    const unselect = fakeRoute('DELETE', api('carts/c-41/wallets/9'), JSON.stringify({ user_id: 7 }), json())
    await handler(unselect)
    expect(answerOf(unselect)).toEqual({ error: false, result: cart })

    const opened = { uuid: 'c-42', business_id: 42, user_id: 7 }
    await onResponse(fakeResponse('GET', api('carts/c-42?user_id=7'), { error: false, result: opened }))
    const other = fakeRoute('POST', api('carts/c-42/wallets'), '{}', json())
    await handler(other)
    expect(answerOf(other).result).toEqual(opened)

    const unknown = fakeRoute('POST', api('carts/c-99/wallets'), '{}', json())
    await handler(unknown)
    expect(unknown.out.fulfilled.status).toBe(400)
    expect(answerOf(unknown)).toEqual({ error: true, result: [expect.stringContaining('c-99')] })
    expect(synthetic.count()).toBe(3)
    expect(synthetic.log().map(entry => entry.outcome)).toEqual(['synthetic-cart', 'synthetic-cart', 'synthetic-cart', 'synthetic-cart-unknown'])
  })

  it('Managed groups: the list of groups gives the base and administrators come back as records (T-2)', async () => {
    const context = fakeContext()
    await installSyntheticWrites(context, ctx)
    const { handler } = context.handlers[0]
    const onResponse = context.listeners.find(({ event }) => event === 'response').handler
    const groups = [{ id: 3, name: 'North', type: 0, administrators: [{ id: 70, name: 'Ana' }], drivers: [] }]
    await onResponse(fakeResponse('GET', api('drivergroups?params=name,drivers,administrators,type&where=[]'), { error: false, result: groups }))

    const check = fakeRoute('PUT', api('drivergroups/3'), JSON.stringify({ administrators: JSON.stringify([70, 72]) }), json())
    await handler(check)
    const { result } = answerOf(check)
    expect(result).toEqual({ id: 3, name: 'North', type: 0, administrators: [{ id: 70, name: 'Ana' }, { id: 72 }], drivers: [] })
    expect(result.administrators.find(admin => Number(admin.id) === 72)).toEqual({ id: 72 })

    const uncheck = fakeRoute('PUT', api('drivergroups/3'), JSON.stringify({ administrators: JSON.stringify([70]) }), json())
    await handler(uncheck)
    expect(answerOf(uncheck).result.administrators).toEqual([{ id: 70, name: 'Ana' }])
  })

  it('Managed groups: checking a group nobody manages yet answers the manager as a record (T-2, seen live)', async () => {
    const context = fakeContext()
    await installSyntheticWrites(context, ctx)
    const { handler } = context.handlers[0]
    const onResponse = context.listeners.find(({ event }) => event === 'response').handler
    const groups = [{ id: 3, administrators: [{ id: 72, name: 'Aaliyah' }] }, { id: 199, name: 'Caledon', administrators: [] }]
    await onResponse(fakeResponse('GET', api('drivergroups?params=name,drivers,administrators,type'), { error: false, result: groups }))
    await onResponse(fakeResponse('GET', api('business/1/products/199'), { error: false, result: { id: 199, administrators: [{ id: 72, name: 'Other collection' }] } }))

    const check = fakeRoute('PUT', api('drivergroups/199'), JSON.stringify({ administrators: '[72]' }), json())
    await handler(check)
    expect(answerOf(check).result).toEqual({ id: 199, name: 'Caledon', administrators: [{ id: 72, name: 'Aaliyah' }] })

    // only the same collection counts: 71 is a record in another collection, not among the groups' administrators
    await onResponse(fakeResponse('GET', api('business/1/products/200'), { error: false, result: { id: 200, administrators: [{ id: 71, name: 'Other collection' }] } }))
    const other = fakeRoute('PUT', api('drivergroups/199'), JSON.stringify({ administrators: '[71]' }), json())
    await handler(other)
    expect(answerOf(other).result.administrators).toEqual([{ id: 71 }])
  })

  // (review): lists bring many records, so the bases have a cap and the least recently seen go first
  it('keeps at most MAX_BASES bases and drops the one seen longest ago', async () => {
    expect(MAX_BASES).toBe(500)
    const context = fakeContext()
    await installSyntheticWrites(context, ctx)
    const { handler } = context.handlers[0]
    const onResponse = context.listeners.find(({ event }) => event === 'response').handler
    const page = Array.from({ length: MAX_BASES }, (_, i) => ({ id: i + 1, name: `u${i + 1}` }))
    await onResponse(fakeResponse('GET', api('users?page=1'), { error: false, result: page }))
    await onResponse(fakeResponse('GET', api('users/1'), { error: false, result: { id: 1, name: 'seen again' } }))
    await onResponse(fakeResponse('GET', api('users?page=2'), { error: false, result: [{ id: MAX_BASES + 1, name: 'new' }] }))
    const put = async id => {
      const route = fakeRoute('PUT', api(`users/${id}`), '{}', json())
      await handler(route)
      return answerOf(route).result
    }
    expect(await put(1)).toEqual({ id: 1, name: 'seen again' })
    expect(await put(3)).toEqual({ id: 3, name: 'u3' })
    expect(await put(MAX_BASES + 1)).toEqual({ id: MAX_BASES + 1, name: 'new' })
    expect(await put(2)).toEqual({ id: 2 }) // the oldest one left (last: this PUT stores a base of its own)
  })

  it('a POST whose last segment is not a number is still a creation, with a synthetic id', async () => {
    const context = fakeContext()
    await installSyntheticWrites(context, ctx)
    const { handler } = context.handlers[0]
    const route = fakeRoute('POST', api('carts/ab12-cd34/place'), '{"a":1}', json())
    await handler(route)
    expect(answerOf(route).result).toEqual({ a: 1, id: 990001 })
  })
})

describe('live synthetic writes: forced failures (--synthetic-fail)', () => {
  it.each([
    ['/business/:id', '/business/41', true],
    ['business/:id', '/business/41/', true],
    ['/business/:id', '/business', false],
    ['/business/:id', '/business/41/taxes', false],
    ['/business/:id/taxes/:tax', '/business/41/taxes/3', true],
    ['/business/*', '/business/41/taxes/3', true],
    ['/business/*', '/businesses/41', false],
    ['*', '/anything/at/all', true],
    ['/business/41', '/business/412', false],
    ['/business.v2/:id', '/businessXv2/1', false],
    ['/Business/:id', '/business/41', true],
    ['/business/:id', '/x/business/41', false],
    ['/business/:id', '/business/41/x', false]
  ])('%s matches %s: %s', (pattern, path, expected) => {
    expect(compileFailRule({ method: 'POST', pattern }).test(path)).toBe(expected)
  })

  it.each(['/business*', '/a*b', '/**', '/business/*/taxes'])('refuses %s: * is only the last whole segment', pattern => {
    expect(() => compileFailRule({ method: 'POST', pattern })).toThrow(/last whole segment/)
  })

  it('a rule matches its method only, or any write with *', () => {
    const rules = [compileFailRule({ method: 'post', pattern: '/business/:id' }), compileFailRule({ method: '*', pattern: '/users/:id' })]
    expect(matchFailRule(rules, 'POST', '/business/41')).toMatchObject({ method: 'POST', pattern: '/business/:id' })
    expect(matchFailRule(rules, 'PUT', '/business/41')).toBe(null)
    expect(matchFailRule(rules, 'DELETE', '/users/7')).toMatchObject({ method: '*' })
    expect(matchFailRule([], 'POST', '/business/41')).toBe(null)
  })

  it('reads the flags from argv: repeatable rule, message and status', () => {
    const argv = ['node', 'live-session.mjs', '--synthetic-writes', '--synthetic-fail', 'POST', '/business/:id', '--synthetic-fail', 'put', '/business/:id/taxes/:tax', '--synthetic-fail-message', 'No way', '--synthetic-fail-status', '422']
    const fail = failFromArgv(argv)
    expect(fail.rules.map(({ method, pattern }) => `${method} ${pattern}`)).toEqual(['POST /business/:id', 'PUT /business/:id/taxes/:tax'])
    expect(fail).toMatchObject({ message: 'No way', status: 422 })
    expect(failFromArgv(['node', 'x', '--synthetic-writes'])).toEqual({ rules: [], message: DEFAULT_FAIL_MESSAGE, status: 400 })
  })

  it('refuses a rule without --synthetic-writes, a read, a missing pattern or a bad status', () => {
    expect(() => failFromArgv(['node', 'x', '--synthetic-fail', 'POST', '/business/:id'])).toThrow(/--synthetic-writes/)
    expect(() => failFromArgv(['node', 'x', '--synthetic-writes', '--synthetic-fail', 'GET', '/business/:id'])).toThrow(/method/)
    expect(() => failFromArgv(['node', 'x', '--synthetic-writes', '--synthetic-fail', 'POST'])).toThrow(/pattern/)
    expect(() => failFromArgv(['node', 'x', '--synthetic-writes', '--synthetic-fail', 'POST', '--port'])).toThrow(/pattern/)
    const rule = ['node', 'x', '--synthetic-writes', '--synthetic-fail', 'POST', '/a']
    for (const status of ['abc', '200', '204', '302', '399', '600']) {
      expect(() => failFromArgv([...rule, '--synthetic-fail-status', status]), status).toThrow(/4xx or 5xx/)
    }
    expect(failFromArgv([...rule, '--synthetic-fail-status', '400']).status).toBe(400)
    expect(failFromArgv([...rule, '--synthetic-fail-status', '599']).status).toBe(599)
    expect(() => failFromArgv([...rule, '--synthetic-fail-message', '--synthetic-writes'])).toThrow(/needs a text/)
    expect(() => failFromArgv([...rule, '--synthetic-fail-message'])).toThrow(/needs a text/)
    expect(() => failFromArgv(['node', 'x', '--synthetic-writes', '--synthetic-fail-status', '500'])).toThrow(/need a --synthetic-fail rule/)
    expect(() => failFromArgv(['node', 'x', '--synthetic-writes', '--synthetic-fail-message', 'x'])).toThrow(/need a --synthetic-fail rule/)
  })

  it('answers in the API\'s failure shape', () => {
    expect(failureResponse('Nope')).toEqual({ error: true, result: ['Nope'] })
  })
})

describe('live synthetic writes: who the session is', () => {
  it('keeps only id, name, lastname and level of a login answer, and nothing from an answer that is not a user', () => {
    expect(sessionUserFrom({ error: false, result: { id: 1, name: 'Ordering', lastname: 'Admin ', level: 0, session: { access_token: 't' } } }))
      .toEqual({ id: 1, name: 'Ordering', lastname: 'Admin ', level: 0 })
    expect(sessionUserFrom({ error: false, result: { id: 2 } })).toEqual({ id: 2, name: '', lastname: '', level: 0 })
    expect(sessionUserFrom({ error: true, result: { id: 1 } })).toBe(null)
    expect(sessionUserFrom({ error: false, result: { id: 'x' } })).toBe(null)
    expect(sessionUserFrom({ error: false, result: [] })).toBe(null)
    expect(sessionUserFrom(null)).toBe(null)
  })
})

// what the session wrote is read back by the GETs that follow, as the API would answer them had the write
// reached it. The GET still goes out (it is a read the guard lets through); its answer is patched before the app sees it.
describe('live synthetic writes: the session reads back what it wrote', () => {
  const json = () => ({ 'content-type': 'application/json' })
  const setup = async (opts = ctx) => {
    const handlers = []
    const listeners = []
    const context = { on (event, handler) { listeners.push({ event, handler }) }, route: async (matcher, handler) => { handlers.push({ matcher, handler }) } }
    const synthetic = await installSyntheticWrites(context, opts)
    const { handler } = handlers[0]
    const onResponse = listeners.find(({ event }) => event === 'response').handler
    const network = []
    // the real API behind route.fetch(): `server(url)` → { status, json }
    let server = () => ({ status: 200, json: { error: false, result: [] } })
    const serve = fn => { server = fn }
    const send = async (method, path, postData = null) => {
      const out = { fulfilled: null, fellBack: false, aborted: false }
      const route = {
        request: () => ({ method: () => method, url: () => api(path), postData: () => postData, headers: () => ({ ...json(), origin: localOrigin }) }),
        fulfill: async options => { out.fulfilled = options },
        fallback: async () => { out.fellBack = true },
        abort: async () => { out.aborted = true },
        fetch: async ({ url } = {}) => {
          const target = url || api(path)
          network.push(target)
          const { status = 200, json: body, text } = server(target) // `text`: a body that is not JSON
          const parse = async () => { if (text !== undefined) throw new SyntaxError('Unexpected token <'); return body }
          return { status: () => status, headers: () => ({ 'content-type': 'application/json' }), json: parse, text: async () => text ?? JSON.stringify(body) }
        }
      }
      await handler(route)
      return out
    }
    // what the app receives: the patched JSON, the fetched response as is, or a local body
    const bodyOf = async ({ fulfilled }) => fulfilled.json ?? (fulfilled.body !== undefined ? JSON.parse(fulfilled.body) : await fulfilled.response.json())
    const statusOf = ({ fulfilled }) => fulfilled.status ?? fulfilled.response.status()
    const read = async (path, result, status = 200) => onResponse({ status: () => status, request: () => ({ method: () => 'GET' }), url: () => api(path), json: async () => ({ error: false, result }) })
    return { synthetic, send, serve, network, bodyOf, statusOf, read }
  }
  const olivia = { id: 34, name: 'Olivia', lastname: 'Bennett', enabled: true, level: 3 }
  const liam = { id: 35, name: 'Liam', lastname: 'Carter', enabled: true, level: 3 }
  const activeCustomers = 'users?page=1&page_size=10&params=name,lastname,enabled,level&where={"conditions":[{"attribute":"enabled","value":true},{"attribute":"level","value":[3]}],"conector":"AND"}'

  it('without a synthetic write on the record or its collection, a GET goes on to the guard untouched', async () => {
    const { send, network } = await setup()
    expect((await send('GET', 'users?page=1')).fellBack).toBe(true)
    await send('POST', 'drivergroups/3', '{"name":"x"}')
    expect((await send('GET', 'users?page=1')).fellBack).toBe(true)
    expect((await send('GET', 'users/34')).fellBack).toBe(true)
    expect((await send('GET', 'drivergroups/4')).fellBack).toBe(true)
    expect(network).toEqual([])
  })

  it('a customer turned off leaves the Active list, whose total drops; without a filter it comes back off', async () => {
    const { send, serve, network, bodyOf } = await setup()
    await send('POST', 'users/34', '{"enabled":false}')
    serve(() => ({ json: { error: false, result: [olivia, liam], pagination: { total: 12, page: 1 } } }))
    const active = await send('GET', activeCustomers)
    expect(active.fellBack).toBe(false)
    expect(await bodyOf(active)).toEqual({ error: false, result: [liam], pagination: { total: 11, page: 1 } })
    expect(network).toEqual([api(activeCustomers)])

    const all = await send('GET', 'users?page=1&params=name,lastname,enabled,level')
    expect((await bodyOf(all)).result).toEqual([{ ...olivia, enabled: false }, liam])
    expect((await bodyOf(all)).pagination).toEqual({ total: 12, page: 1 })
  })

  it('the GET of the record brings the written fields over the real answer, never a field it does not bring (a password included)', async () => {
    const { send, serve, bodyOf } = await setup()
    await send('POST', 'users/34', '{"enabled":false}')
    await send('PUT', 'users/34', '{"name":"Olivia B","password":"p","nickname":"never read back"}')
    serve(() => ({ json: { error: false, result: { ...olivia, email: 'o@b.invalid' } } }))
    expect(await bodyOf(await send('GET', 'users/34?params=name,enabled,email'))).toEqual({ error: false, result: { ...olivia, email: 'o@b.invalid', enabled: false, name: 'Olivia B' } })
  })

  it('a real answer that is an error comes through as is', async () => {
    const { send, serve, bodyOf } = await setup()
    await send('POST', 'users/34', '{"enabled":false}')
    serve(() => ({ status: 401, json: { error: true, result: ['Permission denied'] } }))
    const denied = await send('GET', 'users/34')
    expect(await bodyOf(denied)).toEqual({ error: true, result: ['Permission denied'] })
  })

  it('Managed groups: a group checked without a base comes back with the manager as a record of the real list', async () => {
    const { send, serve, bodyOf } = await setup()
    await send('PUT', 'drivergroups/199', JSON.stringify({ administrators: '[72]' }))
    await send('PUT', 'drivergroups/232', JSON.stringify({ administrators: null }))
    serve(() => ({
      json: {
        error: false,
        result: [
          { id: 3, name: 'North', administrators: [{ id: 72, name: 'Aaliyah' }] },
          { id: 199, name: 'Caledon', administrators: [] },
          { id: 232, name: 'Prishtina', administrators: [{ id: 72, name: 'Aaliyah' }] }
        ]
      }
    }))
    const { result } = await bodyOf(await send('GET', 'drivergroups?params=name,administrators'))
    expect(result).toEqual([
      { id: 3, name: 'North', administrators: [{ id: 72, name: 'Aaliyah' }] },
      { id: 199, name: 'Caledon', administrators: [{ id: 72, name: 'Aaliyah' }] },
      { id: 232, name: 'Prishtina', administrators: [] }
    ])
  })

  it('writes add up, and a forced failure is not remembered', async () => {
    const { send, serve, bodyOf } = await setup({ ...ctx, fail: { rules: [compileFailRule({ method: 'PUT', pattern: '/users/:id' })] } })
    await send('POST', 'users/34', '{"enabled":false}')
    await send('POST', 'users/34', '{"lastname":"B."}')
    await send('PUT', 'users/34', '{"name":"failed"}')
    await send('PUT', 'users/35', '{"name":"failed"}')
    serve(() => ({ json: { error: false, result: [olivia, liam] } }))
    expect((await bodyOf(await send('GET', 'users'))).result).toEqual([{ ...olivia, enabled: false, lastname: 'B.' }, liam])
    expect((await send('GET', 'users/35')).fellBack).toBe(true)
  })

  it('a deleted record leaves the lists, and its GET answers as the API does for an id that does not exist', async () => {
    const { send, serve, network, bodyOf, statusOf, read } = await setup()
    await read('business/5/categories/9', { id: 9, name: 'Drinks' }) // the session read a category by id: a plain read
    await send('DELETE', 'business/5/categories/9')
    await send('DELETE', 'business/5/categories/10')
    serve(url => url.endsWith('/999999999')
      ? { status: 400, json: { error: true, result: ['Category not found'] } }
      : { json: { error: false, result: [{ id: 8 }, { id: 9 }, { id: 10 }], pagination: { total: 3 } } })
    expect(await bodyOf(await send('GET', 'business/5/categories?page=1'))).toEqual({ error: false, result: [{ id: 8 }], pagination: { total: 1 } })

    const gone = await send('GET', 'business/5/categories/9')
    expect(statusOf(gone)).toBe(400)
    expect(await bodyOf(gone)).toEqual({ error: true, result: ['Category not found'] })
    const other = await send('GET', 'business/5/categories/10?mode=dashboard')
    expect(statusOf(other)).toBe(400)
    expect(await bodyOf(other)).toEqual({ error: true, result: ['Category not found'] })
    // one probe per collection and session, and never the deleted id itself
    expect(network.filter(url => url.includes('/999999999'))).toEqual([api('business/5/categories/999999999')])
    expect(network.some(url => /categories\/(?:9|10)(?:\?|$)/.test(url))).toBe(false)
  })

  it('a deleted record of a collection never read by id answers a generic 400 and asks nothing', async () => {
    const { send, network, bodyOf, statusOf, read } = await setup()
    await read('users/34', olivia, 500) // a failed read does not count
    await send('DELETE', 'users/34')
    const gone = await send('GET', 'users/34')
    expect(statusOf(gone)).toBe(400)
    expect((await bodyOf(gone)).error).toBe(true)
    expect(network).toEqual([])
  })

  it('the probe of a missing record goes through the guard: a blocked one is never asked', () => {
    expect(missingProbeUrl(api('business/5/categories/9?mode=dashboard'), ctx)).toBe(api('business/5/categories/999999999?mode=dashboard'))
    expect(missingProbeUrl(api('builder/apps/1/downloads/7'), ctx)).toBe(null) // the guard blocks the downloads
    expect(missingProbeUrl(api('business/5/categories'), ctx)).toBe(null) // not a record
  })

  it('a created record answers its own GET locally, and later writes to it add up', async () => {
    const { send, network, bodyOf } = await setup()
    await send('POST', 'users', '{"name":"New","level":3}')
    await send('PUT', 'users/990001', '{"lastname":"Person"}')
    const own = await send('GET', 'users/990001')
    expect(await bodyOf(own)).toEqual({ error: false, result: { name: 'New', level: 3, id: 990001, lastname: 'Person' } })
    expect(network).toEqual([])
  })

  it('a GET the guard blocks is never fetched, even with a synthetic write in its collection (review)', async () => {
    const { send, network } = await setup()
    await send('PUT', 'business/5/downloads/7', '{"name":"x"}') // synthesized: the downloads rule only hits the end of a path
    const list = await send('GET', 'business/5/downloads?page=1')
    expect(list.fellBack).toBe(true)
    expect(network).toEqual([])
  })

  it('a real GET that fails aborts like a network failure; a body that is not JSON comes through as is (review)', async () => {
    const { send, serve } = await setup()
    await send('POST', 'users/34', '{"enabled":false}')
    serve(() => { throw new Error('net::ERR_CONNECTION_RESET') })
    expect((await send('GET', 'users/34')).aborted).toBe(true)
    const plain = await setup()
    await plain.send('POST', 'users/34', '{"enabled":false}')
    plain.serve(() => ({ text: '<html>Bad gateway</html>' }))
    const out = await plain.send('GET', 'users/34')
    expect(out.fulfilled.json).toBe(undefined)
    expect(await out.fulfilled.response.text()).toBe('<html>Bad gateway</html>')
  })

  it('a form field sent as text comes back with the type the real record has: booleans and numbers (review)', async () => {
    const { send, serve, bodyOf } = await setup()
    const form = '--b\r\nContent-Disposition: form-data; name="enabled"\r\n\r\nfalse\r\n--b\r\nContent-Disposition: form-data; name="position"\r\n\r\n4\r\n--b\r\nContent-Disposition: form-data; name="slug"\r\n\r\n12\r\n--b--'
    await send('POST', 'pages/7', form)
    serve(() => ({ json: { error: false, result: [{ id: 7, enabled: true, position: 1, slug: 'home' }] } }))
    expect((await bodyOf(await send('GET', 'pages'))).result).toEqual([{ id: 7, enabled: false, position: 4, slug: '12' }])
  })

  it('a list of ids sent as a JSON array (not text) comes back as records of the real list (review)', async () => {
    const { send, serve, bodyOf } = await setup()
    await send('PUT', 'drivergroups/9', '{"administrators":[72]}')
    serve(() => ({ json: { error: false, result: [{ id: 3, administrators: [{ id: 72, name: 'Aaliyah' }] }, { id: 9, administrators: [] }] } }))
    expect((await bodyOf(await send('GET', 'drivergroups'))).result[1]).toEqual({ id: 9, administrators: [{ id: 72, name: 'Aaliyah' }] })
  })

  // What it does not cover: each case goes through untouched (tracker.md › Límites)
  describe('what is left as the real API answers', () => {
    it('a created record is not added to any list (where it sits and whether the filters take it is the server\'s)', async () => {
      const { send } = await setup()
      await send('POST', 'users', '{"name":"New","level":3}')
      expect((await send('GET', 'users?page=1')).fellBack).toBe(true)
    })

    it('a record that now meets the filter is not added (Olivia does not appear in the Inactive list)', async () => {
      const { send, serve, bodyOf } = await setup()
      await send('POST', 'users/34', '{"enabled":false}')
      serve(() => ({ json: { error: false, result: [{ ...liam, enabled: false }] } }))
      expect((await bodyOf(await send('GET', 'users?where=[{"attribute":"enabled","value":false}]'))).result).toEqual([{ ...liam, enabled: false }])
    })

    it.each([
      ['OR', '{"conditions":[{"attribute":"enabled","value":true}],"conector":"OR"}'],
      ['nested conditions', '{"conditions":[{"conditions":[{"attribute":"enabled","value":true}],"conector":"AND"}],"conector":"AND"}'],
      ['not JSON', 'enabled=true']
    ])('a filter with %s is not evaluated: the record stays, with what was written', async (_, where) => {
      const { send, serve, bodyOf } = await setup()
      await send('POST', 'users/34', '{"enabled":false}')
      serve(() => ({ json: { error: false, result: [olivia] } }))
      expect((await bodyOf(await send('GET', `users?where=${where}`))).result).toEqual([{ ...olivia, enabled: false }])
    })

    it('a condition with an operator is not evaluated: the record stays, with what was written', async () => {
      const { send, serve, bodyOf } = await setup()
      await send('POST', 'users/34', '{"name":"Liv"}')
      serve(() => ({ json: { error: false, result: [olivia] } }))
      const where = '[{"attribute":"name","value":{"condition":"like","value":"%Oli%"}}]'
      expect((await bodyOf(await send('GET', `users?where=${where}`))).result).toEqual([{ ...olivia, name: 'Liv' }])
    })

    it('a condition on a field the session did not write is the server\'s: the record stays', async () => {
      const { send, serve, bodyOf } = await setup()
      await send('POST', 'users/34', '{"enabled":false}')
      serve(() => ({ json: { error: false, result: [olivia] } }))
      expect((await bodyOf(await send('GET', 'users?where=[{"attribute":"level","value":[4]}]'))).result).toEqual([{ ...olivia, enabled: false }])
    })

    it('a record embedded in another resource keeps the real value', async () => {
      const { send, serve, bodyOf } = await setup()
      await send('POST', 'users/72', '{"enabled":false}')
      const groups = [{ id: 3, name: 'North', administrators: [{ id: 72, enabled: true }] }]
      serve(() => ({ json: { error: false, result: groups } }))
      expect((await send('GET', 'drivergroups')).fellBack).toBe(true)
      await send('PUT', 'drivergroups/3', '{"name":"North 2"}') // even when the list is read back for its own write
      expect((await bodyOf(await send('GET', 'drivergroups'))).result).toEqual([{ id: 3, name: 'North 2', administrators: [{ id: 72, enabled: true }] }])
    })

    it('a write to a path without a numeric id is not read back', async () => {
      const { send } = await setup()
      await send('PUT', 'business/5/schedule', '{"open":false}')
      await send('POST', 'carts/ab12-cd34/place', '{"a":1}')
      expect((await send('GET', 'business/5/schedule')).fellBack).toBe(true)
      expect((await send('GET', 'business/5')).fellBack).toBe(true)
    })
  })
})
