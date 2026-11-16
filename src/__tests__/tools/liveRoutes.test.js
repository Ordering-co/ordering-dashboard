// `--locale <code>` and `--synthetic-writes` together. The live session registers the guard first and then
// installApiRoutes; this drives that chain the way Playwright 1.63 does: the newest route runs first, `route.fallback()`
// hands the request to the next older one, `fallback({ url })` changes `request.url()` for the routes after it, and each
// route is matched against that current URL.
import { describe, expect, it } from 'vitest'
import { decide } from '../../../scripts/redesign/tools/live-guard.mjs'
import { installApiRoutes } from '../../../scripts/redesign/tools/live-routes.mjs'
import { compileFailRule, DEFAULT_FAIL_MESSAGE } from '../../../scripts/redesign/tools/live-synthetic.mjs'

const localOrigin = 'http://127.0.0.1:3061'
const apiOrigin = 'https://apiv4.ordering.co'
const version = 'v400'
const project = 'orderingv1'
const apiPrefix = `/${version}/en/${project}/`
const api = (locale, path) => `${apiOrigin}/${version}/${locale}/${project}/${path}`
const catalog = { KEEP_ORDER: { en: 'Keep order', es: 'Conservar pedido' } }

const session = async ({ locale, synthetic = true, fail = [] }) => {
  const handlers = []
  const traffic = { network: [], blocked: [] }
  const context = { on () {}, route: async (matcher, handler) => { handlers.unshift({ matcher, handler }) } }
  // the network guard, registered first
  await context.route('**/*', async route => {
    const request = route.request()
    const { allow } = decide({ method: request.method(), url: request.url(), localOrigin, apiOrigin, apiPrefix })
    traffic[allow ? 'network' : 'blocked'].push(`${request.method()} ${request.url()}`)
  })
  const rules = fail.map(compileFailRule)
  const fails = { rules, message: DEFAULT_FAIL_MESSAGE, status: 400 }
  const installed = await installApiRoutes(context, { locale, apiOrigin, apiPrefix, localOrigin, version, project, observed: {}, catalog, synthetic, fail: fails })
  const matches = (matcher, url) => matcher === '**/*' || matcher(new URL(url))
  const send = async (method, url, postData = '{}') => {
    const out = { fulfilled: null }
    let current = url
    let i = 0
    const route = {
      request: () => ({ method: () => method, url: () => current, postData: () => postData, headers: () => ({ 'content-type': 'application/json' }) }),
      fulfill: async options => { out.fulfilled = options },
      fallback: async (options = {}) => {
        if (options.url) current = options.url
        await next()
      }
    }
    const next = async () => {
      while (i < handlers.length && !matches(handlers[i].matcher, current)) i += 1
      const { handler } = handlers[i++]
      await handler(route)
    }
    await next()
    return out
  }
  return { send, traffic, installed }
}

const body = out => JSON.parse(out.fulfilled.body)

describe('live session routes: --locale with --synthetic-writes', () => {
  it('answers a write under the locale prefix locally and logs it; nothing reaches the network', async () => {
    const { send, traffic, installed } = await session({ locale: 'es' })
    const put = await send('PUT', api('es', 'users/72'), '{"name":"Ana"}')
    expect(put.fulfilled?.status).toBe(200)
    expect(body(put)).toEqual({ error: false, result: { name: 'Ana', id: 72 } })
    const post = await send('POST', api('es', 'users/72/products'), '{"product_id":5}')
    expect(body(post).result).toMatchObject({ product_id: 5, id: 990001 })
    const del = await send('DELETE', api('es', 'users/72/products/9'))
    expect(body(del)).toEqual({ error: false, result: {} })
    expect(traffic).toEqual({ network: [], blocked: [] })
    expect(installed.synthetic.log().map(entry => `${entry.method} ${entry.path}`)).toEqual(['PUT /users/72', 'POST /users/72/products', 'DELETE /users/72/products/9'])
  })

  it('applies --synthetic-fail to a write under the locale prefix', async () => {
    const { send, traffic } = await session({ locale: 'es', fail: [{ method: 'DELETE', pattern: '/users/:id/products/:pid' }] })
    const del = await send('DELETE', api('es', 'users/72/products/9'))
    expect(del.fulfilled.status).toBe(400)
    expect(body(del)).toEqual({ error: true, result: [DEFAULT_FAIL_MESSAGE] })
    expect(traffic).toEqual({ network: [], blocked: [] })
  })

  it('still sends reads to the network in English and still blocks what is never simulated', async () => {
    const { send, traffic } = await session({ locale: 'es' })
    expect((await send('GET', api('es', 'users/72'), null)).fulfilled).toBe(null)
    expect((await send('POST', api('es', 'orders/5/refund'))).fulfilled).toBe(null)
    expect(traffic).toEqual({ network: [`GET ${api('en', 'users/72')}`], blocked: [`POST ${api('en', 'orders/5/refund')}`] })
  })

  it('still answers the locale translations from the catalog', async () => {
    const { send, traffic } = await session({ locale: 'es' })
    const get = await send('GET', api('es', 'translations'), null)
    expect(body(get)).toEqual({ error: false, result: { DASHBOARD_KEEP_ORDER: 'Conservar pedido' } })
    expect(traffic).toEqual({ network: [], blocked: [] })
  })

  it('in English it behaves as before', async () => {
    const { send, traffic, installed } = await session({ locale: 'en' })
    await send('GET', api('en', 'users/72'), null)
    expect(body(await send('PUT', api('en', 'users/72'), '{"name":"Ana"}')).result).toEqual({ name: 'Ana', id: 72 })
    expect(traffic).toEqual({ network: [`GET ${api('en', 'users/72')}`], blocked: [] })
    expect(installed.locale).toMatchObject({ locale: 'en', active: false })
  })

  it('without --synthetic-writes a write under the locale prefix stays blocked by the guard', async () => {
    const { send, traffic, installed } = await session({ locale: 'es', synthetic: false })
    expect((await send('PUT', api('es', 'users/72'))).fulfilled).toBe(null)
    expect(traffic.blocked).toEqual([`PUT ${api('en', 'users/72')}`])
    expect(installed.synthetic).toBe(null)
  })
})
