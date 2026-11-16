// redesign W0-10a (T0-40)
// perf-orders.mjs generalised to any route: JS bytes (raw and gzip) and median LCP of a production build.
// Same methods as perf-orders.mjs: synthetic session + populated fixtures of e2e/brand-system-app (no real
// login, no credentials, read-only: the fixture boundary aborts every write and every third party),
// 1440x900, no throttling, `vite preview` of a build, median LCP of N runs.
//
// Two JS figures per route, both read from the response bodies the page actually received:
//   firstPaint: scripts requested before the app's first paint, i.e. before #od-boot (the static loader of
//               index.html, which paints before any JS) leaves the DOM. Resource entry startTime < that moment.
//   total:      every script received once the page has loaded and settled (--settle ms after load).
//
//   one build:  node scripts/redesign/tools/perf-route.mjs --route /home --dist /abs/dist --runs 7 --out file.json
//   A/B:        node scripts/redesign/tools/perf-route.mjs --route /orders --a /abs/distA --b /abs/distB --runs 9
//   several:    --route /home,/orders,/stores/list   (comma list, one result per route)
//
// The previews run on 127.0.0.1:--port (default 4521, and 4522 for B), strictPort; the synthetic origin
// (http://127.0.0.1:3018 in fixtures.js) is mapped to them inside Chromium with --host-resolver-rules, so nothing
// listens on 3018 and no other port is touched. The tool only kills the previews it started.
import { spawn } from 'node:child_process'
import { gzipSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { APP_ORIGIN, installAppNetworkBoundary, installSyntheticSession } from '../../../e2e/brand-system-app/fixtures.js'

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`)
  return index > -1 ? process.argv[index + 1] : fallback
}
const routes = arg('route', '/orders').split(',').map(route => route.trim()).filter(Boolean)
const runs = Number(arg('runs', '7'))
const settle = Number(arg('settle', '1500'))
const out = arg('out', '')
const basePort = Number(arg('port', '4521'))
const root = process.cwd()
const distA = arg('a', arg('dist', ''))
const distB = arg('b', '')
if (!distA) {
  console.error('Usage: perf-route.mjs --route /home[,/orders] (--dist <abs dist> | --a <abs dist> --b <abs dist>) [--runs 7] [--settle 1500] [--port 4521] [--out file.json]')
  process.exit(2)
}

const previews = []
const stop = () => previews.forEach(preview => preview.kill('SIGTERM'))
process.on('exit', stop)
const startPreview = (dist, port) => new Promise((resolveReady, reject) => {
  const preview = spawn('node', ['node_modules/vite/bin/vite.js', 'preview', '--outDir', resolve(dist), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'pipe' })
  previews.push(preview)
  const timer = setTimeout(() => reject(new Error(`vite preview ${port} did not start`)), 30000)
  preview.stdout.on('data', chunk => { if (String(chunk).includes(String(port))) { clearTimeout(timer); resolveReady() } })
  preview.stderr.on('data', chunk => { if (/error|in use/i.test(String(chunk))) { clearTimeout(timer); reject(new Error(String(chunk).trim())) } })
  preview.on('exit', code => reject(new Error(`vite preview ${port} exited ${code}`)))
})

const builds = [{ label: distB ? 'A' : 'build', dist: distA, port: basePort }]
if (distB) builds.push({ label: 'B', dist: distB, port: basePort + 1 })
for (const build of builds) {
  await startPreview(build.dist, build.port)
  // Chromium maps the synthetic origin to this build's preview; the page still sees APP_ORIGIN.
  build.browser = await chromium.launch({ args: [`--host-resolver-rules=MAP 127.0.0.1:3018 127.0.0.1:${build.port}`] })
}

const median = values => { const sorted = [...values].sort((x, y) => x - y); return sorted[Math.floor(sorted.length / 2)] }
const sum = (items, key) => items.reduce((total, item) => total + item[key], 0)

async function runOnce (build, route) {
  const context = await build.browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
  await installSyntheticSession(context, { authenticated: true })
  const boundary = await installAppNetworkBoundary(context, { scenario: 'populated' })
  // Registered after the fixture boundary, so it wins: the production build loads /assets/* and any route is an SPA document.
  await context.route(url => url.origin === APP_ORIGIN && !url.pathname.startsWith('/fixture-api/') && !url.pathname.startsWith('/fixture-socket'), async route => {
    const request = route.request()
    if (request.method() === 'GET' && (request.isNavigationRequest() || /^\/(assets\/|brand\/|[^/]+\.(json|js|png|ico|svg|css)$)/.test(new URL(request.url()).pathname))) await route.continue()
    else await route.fallback()
  })
  const page = await context.newPage()
  const bodies = new Map()
  const pending = []
  page.on('response', response => {
    const url = new URL(response.url())
    if (url.origin !== APP_ORIGIN || !url.pathname.endsWith('.js')) return
    pending.push(response.body().then(body => bodies.set(url.pathname, { raw: body.length, gzip: gzipSync(body).length })).catch(() => {}))
  })
  await page.addInitScript(() => {
    window.__lcp = 0
    window.__appPaint = null
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        window.__lcp = entry.startTime
        const node = entry.element
        window.__lcpNode = node ? `${node.tagName.toLowerCase()}${node.className && typeof node.className === 'string' ? '.' + node.className.split(' ').slice(0, 2).join('.') : ''} "${(node.textContent || '').trim().slice(0, 40)}"` : null
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true })
    const watchBoot = () => {
      const boot = document.getElementById('od-boot')
      if (!boot) return false
      new MutationObserver((_, observer) => {
        if (!document.getElementById('od-boot')) { window.__appPaint = performance.now(); observer.disconnect() }
      }).observe(document.body, { childList: true, subtree: true })
      return true
    }
    document.addEventListener('DOMContentLoaded', () => { if (!watchBoot()) window.__appPaint = performance.now() })
  })
  await page.goto(`${APP_ORIGIN}${route}`, { waitUntil: 'load' })
  await page.waitForFunction(() => window.__appPaint !== null, null, { timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(settle)
  // LCP is final once the user interacts; read it before any input.
  const timing = await page.evaluate(() => ({
    lcp: window.__lcp,
    lcpNode: window.__lcpNode || null,
    appPaint: window.__appPaint,
    finalPath: location.pathname + location.search,
    resources: performance.getEntriesByType('resource').filter(entry => entry.initiatorType === 'script' || entry.name.endsWith('.js')).map(entry => ({ path: new URL(entry.name).pathname, start: entry.startTime }))
  }))
  await Promise.all(pending)
  const requested = timing.resources.filter(entry => bodies.has(entry.path))
  const toItem = entry => ({ path: entry.path, ...bodies.get(entry.path) })
  const all = [...bodies.keys()].map(path => ({ path, ...bodies.get(path) }))
  const first = timing.appPaint === null ? [] : requested.filter(entry => entry.start < timing.appPaint).map(toItem)
  await context.close()
  return {
    lcp: Math.round(timing.lcp),
    lcpNode: timing.lcpNode,
    appPaintMs: timing.appPaint === null ? null : Math.round(timing.appPaint),
    finalPath: timing.finalPath,
    firstPaint: { files: first.length, raw: sum(first, 'raw'), gzip: sum(first, 'gzip') },
    total: { files: all.length, raw: sum(all, 'raw'), gzip: sum(all, 'gzip') },
    jsFilesTotal: all.map(file => file.path).sort(),
    unknownFixtureReads: boundary.unknownFixtureReads.length,
    unknownFixtureEndpoints: [...new Set(boundary.unknownFixtureReads)],
    blockedWrites: boundary.blockedWrites.length,
    blockedWriteLabels: [...new Set(boundary.blockedWrites)]
  }
}

const results = []
for (const route of routes) {
  const perBuild = new Map(builds.map(build => [build.label, []]))
  // Interleaved: run i of every build before run i+1, so machine load drifts equally.
  for (let run = 0; run < runs; run += 1) {
    for (const build of builds) perBuild.get(build.label).push(await runOnce(build, route))
  }
  for (const build of builds) {
    const samples = perBuild.get(build.label)
    const lcps = samples.map(sample => sample.lcp)
    const last = samples[0]
    results.push({
      route,
      build: build.label,
      dist: build.dist,
      viewport: '1440x900',
      runs,
      settleMs: settle,
      lcpMs: { median: median(lcps), min: Math.min(...lcps), max: Math.max(...lcps), spread: Math.max(...lcps) - Math.min(...lcps), samples: lcps },
      lcpElement: last.lcpNode,
      appPaintMs: { median: median(samples.map(sample => sample.appPaintMs ?? 0)), samples: samples.map(sample => sample.appPaintMs) },
      finalPath: last.finalPath,
      js: { firstPaint: last.firstPaint, total: last.total },
      jsStable: new Set(samples.map(sample => `${sample.firstPaint.raw}/${sample.total.raw}`)).size === 1,
      jsFilesTotal: last.jsFilesTotal,
      unknownFixtureReads: last.unknownFixtureReads,
      unknownFixtureEndpoints: last.unknownFixtureEndpoints,
      blockedWrites: last.blockedWrites,
      blockedWriteLabels: last.blockedWriteLabels
    })
  }
}
for (const build of builds) await build.browser.close()
stop()

const report = { measuredAt: new Date().toISOString(), tool: 'scripts/redesign/tools/perf-route.mjs', results }
console.log(JSON.stringify(report, null, 2))
if (out) {
  mkdirSync(dirname(resolve(root, out)), { recursive: true })
  writeFileSync(resolve(root, out), `${JSON.stringify(report, null, 2)}\n`)
}
process.exit(0)
