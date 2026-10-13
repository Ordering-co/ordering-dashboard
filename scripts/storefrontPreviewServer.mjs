import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { storefrontPreviewBridge } from './storefrontPreviewBridge.mjs'

const limit = 8 * 1024 * 1024
export const validateStorefrontSource = source => {
  const site = new URL(source.url)
  const api = new URL(source.apiRoot)
  const match = api.pathname.match(/^\/(v\d+)\/([a-z]{2}(?:-[a-z]{2})?)\/([a-z0-9_-]+)\/?$/i)
  if (site.protocol !== 'https:' || api.protocol !== 'https:' || api.hostname !== 'api.orderingplus.com' || !match || !['website', 'web_marketplace_26', 'web_franchises_x'].includes(source.code) || site.username || site.password || api.username || api.password || site.port || api.port || site.search || api.search || site.hash || api.hash || site.pathname !== '/') throw new Error('unsupported_storefront')
  const project = match[3]
  if (![`${project}.orderingplus.com`, `v26-${project}.orderingplus.com`, ...(source.code === 'web_franchises_x' ? [`${project}.franchises.orderingplus.com`] : [])].includes(site.hostname)) throw new Error('unsupported_storefront')
  return { url: site.origin, apiRoot: api.href.replace(/\/$/, ''), project, code: source.code }
}
export const publicPreviewPath = (path, language) => {
  const url = new URL(path, 'https://preview.invalid')
  if (!/^[a-z]{2}(?:-[a-z]{2})?$/i.test(language) || !['/sites/current', '/theme', '/configs', '/languages', '/countries', '/cities', '/paymethods'].includes(url.pathname) || path.length > 4096 || !path.startsWith('/') || path.startsWith('//')) throw new Error('blocked_preview_read')
  for (const key of url.searchParams.keys()) if (!['params', 'page', 'page_size', 'where', 'code', 'enabled'].includes(key)) throw new Error('blocked_preview_query')
  return url.pathname + url.search
}
const reply = (res, status, value, type = 'application/json') => {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  res.end(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value))
}
const boundedRead = async response => {
  if (!response.ok || Number(response.headers.get('content-length')) > limit) throw new Error('preview_read_failed')
  const chunks = []; let size = 0
  for await (const chunk of response.body) { size += chunk.length; if (size > limit) throw new Error('preview_read_too_large'); chunks.push(Buffer.from(chunk)) }
  return Buffer.concat(chunks)
}
export const createStorefrontServer = async (rawSource, parentOrigin, { fetcher = fetch } = {}) => {
  const source = validateStorefrontSource(rawSource)
  const parent = new URL(parentOrigin)
  if (parent.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(parent.hostname) || parentOrigin !== parent.origin) throw new Error('invalid_preview_parent')
  const channel = randomUUID()
  const cache = new Map(); let cacheSize = 0
  const read = async (url, headers) => {
    const response = await fetcher(url, { method: 'GET', headers, redirect: 'error', signal: AbortSignal.timeout(25000) })
    return { body: await boundedRead(response), type: response.headers.get('content-type') || 'application/octet-stream' }
  }
  const server = createServer(async (req, res) => {
    try {
      if (req.method !== 'GET') return reply(res, 405, { error: true })
      const url = new URL(req.url, 'http://preview.invalid')
      if (url.pathname === '/__api') {
        const path = publicPreviewPath(url.searchParams.get('path') || '', url.searchParams.get('lang') || '')
        const root = source.apiRoot.replace(/\/[a-z]{2}(?:-[a-z]{2})?\/([^/]+)$/i, `/${url.searchParams.get('lang')}/$1`)
        const data = await read(root + path, { 'X-App-X': source.code, 'X-INTERNAL-PRODUCT-X': 'website', 'Content-Type': 'application/json' })
        return reply(res, 200, data.body, 'application/json')
      }
      const page = url.pathname === '/store/onboarding_preview'
      if (!page && !(/^\/assets\/[a-z0-9_./-]+$/i.test(url.pathname) || /^\/[a-z0-9_-]+\.(png|jpg|jpeg|svg|webp|ico|woff2?|css)$/i.test(url.pathname))) return reply(res, 404, { error: true })
      if (url.pathname.includes('..') || url.pathname.includes('%') || url.search) return reply(res, 400, { error: true })
      const asset = page ? '/' : url.pathname
      let data = cache.get(asset)
      if (!data) {
        data = await read(source.url + asset)
        if (cacheSize + data.body.length < 16 * 1024 * 1024) { cache.set(asset, data); cacheSize += data.body.length }
      }
      if (!page) return reply(res, 200, data.body, data.type)
      const modules = []
      let html = data.body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, script => {
        const src = script.match(/\bsrc=["']([^"']+)["']/i)?.[1]
        if (/\btype=["']module["']/i.test(script) && /^\/assets\/[a-z0-9_.-]+\.js$/i.test(src || '')) modules.push(src)
        return ''
      }).replace(/<base\b[^>]*>/gi, '')
      if (!modules.length) throw new Error('missing_storefront_module')
      const config = JSON.stringify({ parentOrigin, channel, project: source.project, modules }).replace(/</g, '\\u003c')
      html = html.replace(/<head[^>]*>/i, head => `${head}<script nonce="${channel}">(${storefrontPreviewBridge.toString()})(${config})</script>`)
      res.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'self' 'nonce-${channel}'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https: data:; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors ${parentOrigin}`)
      reply(res, 200, html, 'text/html; charset=utf-8')
    } catch { reply(res, 502, { error: true, result: ['Preview read failed'] }) }
  })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const close = () => { clearTimeout(expiry); server.close(); server.closeAllConnections(); cache.clear() }
  const expiry = setTimeout(close, 10 * 60 * 1000); expiry.unref()
  return { origin: `http://127.0.0.1:${server.address().port}`, channel, close }
}

export const storefrontPreviewPlugin = ({ createPreview = createStorefrontServer } = {}) => ({
  name: 'local-storefront-preview',
  apply: 'serve',
  configureServer (vite) {
    if (process.env.VITEST) return
    const active = new Map()
    let pending = 0; let closed = false
    const release = channel => {
      const preview = active.get(channel)
      if (!preview) return
      clearTimeout(preview.expiry); preview.close(); active.delete(channel)
    }
    vite.httpServer?.once('close', () => { closed = true; for (const channel of active.keys()) release(channel) })
    vite.middlewares.use('/__onboarding-storefront', async (req, res) => {
      try {
        const parentOrigin = `http://${req.headers.host}`
        const parent = new URL(parentOrigin)
        if (!['127.0.0.1', 'localhost', '[::1]'].includes(parent.hostname) || req.headers.origin !== parentOrigin || req.method !== 'POST') return reply(res, 403, { error: true })
        const chunks = []; let size = 0
        for await (const chunk of req) { size += chunk.length; if (size > 4096) return reply(res, 413, { error: true }); chunks.push(chunk) }
        const body = JSON.parse(Buffer.concat(chunks).toString())
        if (req.url === '/release') { release(body.channel); return reply(res, 200, { released: true }) }
        if (req.url !== '/boot' || closed || active.size + pending >= 4) return reply(res, 400, { error: true })

        pending++
        try {
          const preview = await createPreview(body, parentOrigin)
          if (closed) { preview.close(); return reply(res, 400, { error: true }) }
          const expiry = setTimeout(() => release(preview.channel), 10 * 60 * 1000); expiry.unref()
          active.set(preview.channel, { ...preview, expiry })
          reply(res, 200, { origin: preview.origin, channel: preview.channel })
        } finally { pending-- }
      } catch { reply(res, 400, { error: true }) }
    })
  }
})
