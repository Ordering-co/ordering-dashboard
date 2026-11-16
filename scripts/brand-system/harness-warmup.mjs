// fila 48 (W0-T-05): the harness dev server compiles a fixture's module graph on its first request, so on a cold Vite
// the first spec of each surface spent its 5s `expect` waiting for the compile, and a different spec failed on every full run.
// This global setup opens every surface the specs ask for once, before the first spec, so each spec meets a warm server and keeps
// Playwright's default limits (a longer global limit would also hide a real slow regression). The production build needs none.
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { harnessOrigin } from './harness/runtime.cjs'

const ENTRY = `${harnessOrigin}/scripts/brand-system/harness/index.html`
const PARALLEL = 4

// Every `surface` a spec asks for or main.jsx branches on (the page without one is warmed too)
export const harnessSurfaces = (...sources) => [...new Set(sources.flatMap(source => [
  ...[...source.matchAll(/surface=([a-z0-9-]+)/g)].map(match => match[1]),
  ...[...source.matchAll(/query\.get\('surface'\) === '([^']+)'/g)].map(match => match[1])
]))].sort()

export default async function warmHarness () {
  if (process.env.BRAND_HARNESS_PRODUCTION === '1') return
  const read = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
  const specs = readdirSync(fileURLToPath(new URL('../../e2e/brand-system/', import.meta.url))).filter(name => /\.js$/.test(name)).map(name => read(`../../e2e/brand-system/${name}`))
  const urls = [ENTRY, ...harnessSurfaces(read('./harness/main.jsx'), ...specs).map(surface => `${ENTRY}?surface=${encodeURIComponent(surface)}`)]
  const started = Date.now()
  const browser = await chromium.launch()
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' })
    // Same boundary as the specs: only the harness origin is reached; anything else is dropped, never fetched
    await context.route(url => url.origin !== harnessOrigin, route => route.abort())
    const queue = [...urls]
    const failed = []
    await Promise.all(Array.from({ length: PARALLEL }, async () => {
      const page = await context.newPage()
      for (let url = queue.shift(); url; url = queue.shift()) {
        // networkidle: the surface's dynamic import and everything it pulls in have been served (and so compiled)
        await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 }).catch(error => failed.push(`${url}: ${error.message.split('\n')[0]}`))
      }
      await page.close()
    }))
    console.log(`brand harness warm-up: ${urls.length} surfaces in ${Math.round((Date.now() - started) / 1000)}s${failed.length ? `; not warmed: ${failed.join('; ')}` : ''}`)
  } finally {
    await browser.close()
  }
}
