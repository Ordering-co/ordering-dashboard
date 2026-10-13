import { it, expect, vi, afterEach } from 'vitest'
import { EventEmitter } from 'node:events'
import { createStorefrontServer, publicPreviewPath, validateStorefrontSource, storefrontPreviewPlugin } from '../../scripts/storefrontPreviewServer.mjs'
const source = { url: 'https://tenant.orderingplus.com', apiRoot: 'https://api.orderingplus.com/v400/es/tenant', code: 'website' }
it('binds the installed official project source and rejects credentials, redirects and arbitrary hosts', () => {
  expect(validateStorefrontSource(source).project).toBe('tenant')
  for (const url of ['http://tenant.orderingplus.com', 'https://other.orderingplus.com', 'https://tenant.orderingplus.com.evil.test', 'https://user:password@tenant.orderingplus.com', 'https://127.0.0.1', 'https://tenant.orderingplus.com?key=secret']) expect(() => validateStorefrontSource({ ...source, url })).toThrow()
  expect(() => validateStorefrontSource({ ...source, apiRoot: 'https://private.test/v400/es/tenant' })).toThrow()
})
it('allows only bounded public native metadata paths and queries', () => {
  expect(publicPreviewPath('/theme', 'es')).toBe('/theme')
  for (const path of ['/users', '/business', '/configs/192', '/orders', '//evil.test/theme', '/theme?mode=dashboard', '/theme?token=secret']) expect(() => publicPreviewPath(path, 'es')).toThrow()
  expect(() => publicPreviewPath('/theme', '../private')).toThrow()
})
it('serves the real installed module and stylesheet, isolated from admin credentials, with GET-only forwarding and teardown', async () => {
  const fetcher = vi.fn(async url => new Response(url.endsWith('/') ? '<html><head><script src="https://tracking.test/a.js"></script><script type="module" src="/assets/native.js"></script><link href="/assets/native.css" rel="stylesheet"></head><body><div id="root"></div></body></html>' : '{"error":false,"result":[]}', { headers: { 'Content-Type': url.endsWith('/') ? 'text/html' : 'application/json' } }))
  const preview = await createStorefrontServer(source, 'http://127.0.0.1:3012', { fetcher })
  try {
    const page = await fetch(`${preview.origin}/store/onboarding_preview`)
    const html = await page.text()
    expect(html).toContain('/assets/native.css')
    expect(html).toContain('"modules":["/assets/native.js"]')
    expect(html).not.toContain('tracking.test')
    expect(page.headers.get('content-security-policy')).toContain("connect-src 'self'")
    expect((await fetch(`${preview.origin}/__api?path=%2Ftheme&lang=es`)).status).toBe(200)
    const [, options] = fetcher.mock.calls.at(-1)
    expect(options.headers).toEqual({ 'X-App-X': 'website', 'X-INTERNAL-PRODUCT-X': 'website', 'Content-Type': 'application/json' })
    expect(options.redirect).toBe('error')
    const calls = fetcher.mock.calls.length
    for (const method of ['POST', 'PUT', 'DELETE']) expect((await fetch(`${preview.origin}/__api?path=%2Ftheme&lang=es`, { method })).status).toBe(405)
    expect((await fetch(`${preview.origin}/__api?path=%2Fusers&lang=es`)).status).toBe(502)
    expect((await fetch(`${preview.origin}/src/config.json`)).status).toBe(404)
    expect(fetcher.mock.calls).toHaveLength(calls)
  } finally { preview.close() }
  await expect(fetch(`${preview.origin}/store/onboarding_preview`)).rejects.toThrow()
})

it('supports the same IPv6 localhost parent as the onboarding eligibility contract', async () => {
  const preview = await createStorefrontServer(source, 'http://[::1]:3012', { fetcher: vi.fn() })
  expect(preview.origin).toMatch(/^http:\/\/127\.0\.0\.1:/)
  preview.close()
})

it('allows only the matching official installed franchise host', () => {
  expect(validateStorefrontSource({ ...source, code: 'web_franchises_x', url: 'https://tenant.franchises.orderingplus.com' })).toMatchObject({ project: 'tenant', code: 'web_franchises_x' })
  for (const url of ['https://other.franchises.orderingplus.com', 'https://tenant.franchises.orderingplus.com.evil.test']) expect(() => validateStorefrontSource({ ...source, code: 'web_franchises_x', url })).toThrow()
})

const pluginHarness = options => {
  vi.stubEnv('VITEST', '')
  let handler
  const lifecycle = new EventEmitter()
  storefrontPreviewPlugin(options).configureServer({ httpServer: lifecycle, middlewares: { use: (_path, middleware) => { handler = middleware } } })
  const request = (url, body) => ({ method: 'POST', url, headers: { host: '127.0.0.1:3012', origin: 'http://127.0.0.1:3012' }, async * [Symbol.asyncIterator] () { yield Buffer.from(JSON.stringify(body)) } })
  const send = async (url, body) => {
    const response = { status: null, value: null, writeHead (status) { this.status = status }, end (value) { this.value = JSON.parse(value) } }
    await handler(request(url, body), response)
    return response
  }
  return { send, close: () => lifecycle.emit('close') }
}
afterEach(() => vi.unstubAllEnvs())

it('caps simultaneous real plugin boots at four and restores capacity after release or rejected creation', async () => {
  const plugin = pluginHarness()
  try {
    const responses = await Promise.all(Array.from({ length: 8 }, () => plugin.send('/boot', source)))
    const accepted = responses.filter(response => response.status === 200)
    expect(accepted).toHaveLength(4)
    expect(responses.filter(response => response.status === 400)).toHaveLength(4)
    for (const response of accepted) await plugin.send('/release', { channel: response.value.channel })
    expect((await plugin.send('/boot', { ...source, url: 'https://evil.test' })).status).toBe(400)
    const reused = await Promise.all(Array.from({ length: 4 }, () => plugin.send('/boot', source)))
    expect(reused.map(response => response.status)).toEqual([200, 200, 200, 200])
  } finally { plugin.close() }
})

it('rejects new preview boots after the Vite owner closes', async () => {
  const plugin = pluginHarness()
  plugin.close()
  try { expect((await plugin.send('/boot', source)).status).toBe(400) } finally { plugin.close() }
})

it('closes a listener that finishes booting after the Vite owner closes', async () => {
  let resolvePreview
  const createPreview = vi.fn(() => new Promise(resolve => { resolvePreview = resolve }))
  const preview = { origin: 'http://127.0.0.1:54321', channel: 'pending-channel', close: vi.fn() }
  const plugin = pluginHarness({ createPreview })
  try {
    const boot = plugin.send('/boot', source)
    await vi.waitFor(() => expect(createPreview).toHaveBeenCalledOnce())
    plugin.close()
    resolvePreview(preview)
    expect((await boot).status).toBe(400)
    expect(preview.close).toHaveBeenCalledOnce()
    expect((await plugin.send('/boot', source)).status).toBe(400)
    expect(createPreview).toHaveBeenCalledOnce()
  } finally { plugin.close() }
})

it('expires plugin sessions and clears expiry timers on release and owner shutdown', async () => {
  vi.useFakeTimers()
  const previews = []
  const createPreview = vi.fn(async () => {
    const preview = { origin: 'http://127.0.0.1:54321', channel: `channel-${previews.length}`, close: vi.fn() }
    previews.push(preview)
    return preview
  })
  const plugin = pluginHarness({ createPreview })
  try {
    const boots = await Promise.all(Array.from({ length: 4 }, () => plugin.send('/boot', source)))
    expect(vi.getTimerCount()).toBe(4)
    await plugin.send('/release', { channel: boots[0].value.channel })
    expect(vi.getTimerCount()).toBe(3)
    expect(previews[0].close).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(10 * 60 * 1000)
    expect(vi.getTimerCount()).toBe(0)
    for (const preview of previews) expect(preview.close).toHaveBeenCalledOnce()
    expect((await plugin.send('/boot', source)).status).toBe(200)
    plugin.close()
    expect(previews[4].close).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  } finally { plugin.close(); vi.useRealTimers() }
})
