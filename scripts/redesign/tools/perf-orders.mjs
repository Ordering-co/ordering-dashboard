// Performance of /orders on the production build (locally with synthetic data).
// Serves dist/ with `vite preview` on 127.0.0.1:3018 (the synthetic-API origin of
// e2e/brand-system-app/fixtures.js), signs in with the synthetic session, loads /orders
// with the populated fixture N times and reports the median LCP, plus the JS of the route.
//
//   pnpm build && node scripts/redesign/tools/perf-orders.mjs --runs 7 --out .local/orders-performance.json
import { spawn } from 'node:child_process'
import { gzipSync } from 'node:zlib'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { installAppNetworkBoundary, installSyntheticSession } from '../../../e2e/brand-system-app/fixtures.js'

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`)
  return index > -1 ? process.argv[index + 1] : fallback
}
const runs = Number(arg('runs', '7'))
const out = arg('out', '')
const shot = arg('shot', '')
const root = process.cwd()

const preview = spawn('node', ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '3018', '--strictPort'], { cwd: root, stdio: 'pipe' })
const stop = () => preview.kill('SIGTERM')
process.on('exit', stop)
await new Promise((resolveReady, reject) => {
  const timer = setTimeout(() => reject(new Error('vite preview did not start')), 30000)
  preview.stdout.on('data', chunk => { if (String(chunk).includes('3018')) { clearTimeout(timer); resolveReady() } })
  preview.on('exit', code => reject(new Error(`vite preview exited ${code}`)))
})

const browser = await chromium.launch()
const samples = []
let jsBytes = null
let lcpElement = null
for (let run = 0; run < runs; run += 1) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
  await installSyntheticSession(context, { authenticated: true })
  await installAppNetworkBoundary(context, { scenario: 'populated' })
  // The fixture boundary serves the dev server's module paths; the production build loads /assets/*.
  await context.route(url => url.origin === 'http://127.0.0.1:3018' && url.pathname.startsWith('/assets/'), route => route.continue())
  const page = await context.newPage()
  const scripts = new Map()
  page.on('response', async response => {
    const url = new URL(response.url())
    if (url.pathname.endsWith('.js') && url.origin === 'http://127.0.0.1:3018') scripts.set(url.pathname, true)
  })
  await page.addInitScript(() => {
    window.__lcp = 0
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        window.__lcp = entry.startTime
        const node = entry.element
        window.__lcpNode = node ? `${node.tagName.toLowerCase()}${node.className && typeof node.className === 'string' ? '.' + node.className.split(' ').slice(0, 2).join('.') : ''} "${(node.textContent || '').trim().slice(0, 40)}"` : null
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true })
  })
  await page.goto('http://127.0.0.1:3018/orders', { waitUntil: 'load' })
  await page.locator('#orderTable, [data-pilot-orders-list], table').first().waitFor({ timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(1500)
  // LCP is final once the user interacts; read it before any input.
  const lcp = await page.evaluate(() => window.__lcp)
  samples.push(Math.round(lcp))
  if (shot && run === 0) await page.screenshot({ path: shot })
  if (run === 0) lcpElement = await page.evaluate(() => window.__lcpNode)
  if (jsBytes === null) {
    const files = [...scripts.keys()].map(path => resolve(root, 'dist', path.replace(/^\//, '')))
    const raw = files.reduce((sum, file) => sum + readFileSync(file).length, 0)
    const gzip = files.reduce((sum, file) => sum + gzipSync(readFileSync(file)).length, 0)
    jsBytes = { files: files.length, raw, gzip }
  }
  await context.close()
}
await browser.close()
stop()

const sorted = [...samples].sort((a, b) => a - b)
const result = {
  measuredAt: new Date().toISOString(),
  route: '/orders',
  viewport: '1440x900',
  runs,
  lcpMs: { median: sorted[Math.floor(sorted.length / 2)], samples },
  lcpElement,
  js: jsBytes
}
console.log(JSON.stringify(result, null, 2))
if (out) {
  mkdirSync(dirname(resolve(root, out)), { recursive: true })
  writeFileSync(resolve(root, out), `${JSON.stringify(result, null, 2)}\n`)
}
process.exit(0)
