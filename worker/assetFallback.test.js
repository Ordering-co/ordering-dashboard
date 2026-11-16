import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const SHELL = '<!DOCTYPE html><html><head><title>Dashboard</title></head><body><div id="app"></div></body></html>'
const IMMUTABLE = 'public, max-age=31536000, immutable'

const assetLayer = (files = {}) => {
  const requested = []
  const fetch = async (request) => {
    const { pathname } = new URL(request.url)
    requested.push(pathname)
    if (pathname === '/') return new Response(SHELL, { headers: { 'content-type': 'text/html' } })
    const file = files[pathname]
    if (file) return new Response(file.body, { headers: { 'content-type': file.type } })
    return new Response(null, { status: 404, headers: pathname.startsWith('/assets/') ? { 'cache-control': IMMUTABLE } : {} })
  }
  return { fetch, requested }
}

const call = async (path, { accept = '*/*', host = 'dashboard.ordering.co', files, env = {} } = {}) => {
  vi.resetModules()
  const { default: worker } = await import('./index.js')
  const ASSETS = assetLayer(files)
  const response = await worker.fetch(
    new Request(`https://${host}${path}`, { headers: { accept } }),
    { ...env, ASSETS },
    { waitUntil () {} }
  )
  return { response, requested: ASSETS.requested }
}

afterEach(() => vi.unstubAllGlobals())

describe('a file that is not in the build', () => {
  it.each([
    '/assets/index-CxXs63fU.js',
    '/assets/index-CxXs63fU.css',
    '/assets/pdf.worker.min-CxXs63fU.mjs'
  ])('%s is a 404 that no browser keeps, never the dashboard page', async (path) => {
    const { response, requested } = await call(path)
    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('content-type') ?? '').not.toMatch(/text\/html/)
    expect(requested).not.toContain('/')
  })

  it('a request that does not ask for a page gets the same 404', async () => {
    const { response, requested } = await call('/nope', { accept: 'application/json' })
    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(requested).not.toContain('/')
  })
})

describe('a page of the dashboard', () => {
  it('a deep link gets the dashboard page with 200', async () => {
    const { response, requested } = await call('/orders?id=5', { accept: 'text/html' })
    expect(response.status).toBe(200)
    expect(await response.text()).toBe(SHELL)
    expect(requested).toContain('/')
  })

  it('a deep link with the runtime config gets the page the Worker fills, never cached', async () => {
    vi.stubGlobal('fetch', async () => new Response(null, { status: 503 }))
    vi.stubGlobal('HTMLRewriter', class { on () { return this } transform (response) { return response } })
    const files = { '/config.json': { body: JSON.stringify({ project: 'orderingplus', api: { url: 'https://api.test' } }), type: 'application/json' } }
    const { response, requested } = await call('/orders', {
      accept: 'text/html',
      host: 'localhost',
      files,
      env: { DISABLE_CACHE: 'true', PROJECT: 'orderingplus' }
    })
    expect(response.status).toBe(200)
    expect(await response.text()).toBe(SHELL)
    expect(response.headers.get('cache-control')).toMatch(/no-store/)
    expect(response.headers.get('X-Debug-Project')).toBe('orderingplus')
    expect(requested).toContain('/')
  })

  it('a file of the build is served as it is', async () => {
    const files = { '/assets/index-EEJ_GxpH.js': { body: 'export {}', type: 'text/javascript' } }
    const { response, requested } = await call('/assets/index-EEJ_GxpH.js', { files })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/javascript')
    expect(requested).toEqual(['/assets/index-EEJ_GxpH.js'])
  })
})

describe('wrangler.toml [assets]', () => {
  const toml = readFileSync(resolve(__dirname, '../wrangler.toml'), 'utf8')
  const assets = toml.match(/^\[assets\]\r?$\s*([\s\S]*?)(?=^\[|(?![\s\S]))/m)?.[1] ?? ''
  const headers = readFileSync(resolve(__dirname, '../public/_headers'), 'utf8')

  it('the asset layer never answers a missing file with the dashboard page', () => {
    expect(assets).toMatch(/^not_found_handling = "none"$/m)
  })

  it('a missing file reaches the Worker instead of taking the immutable cache of /assets/*', () => {
    expect(headers).toMatch(/^\/assets\/\*$[\s\S]*?Cache-Control: public, max-age=31536000, immutable/m)
    expect(assets).toMatch(/^run_worker_first = \["\/"\]$/m)
  })
})
