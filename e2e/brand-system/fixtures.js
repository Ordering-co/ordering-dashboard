import { test as base, expect } from '@playwright/test'
import { harnessOrigin, harnessSocketOrigin } from '../../scripts/brand-system/harness/runtime.cjs'

export async function installNetworkBoundary (context) {
  const unexpected = []
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    const pathname = process.env.BRAND_HARNESS_PRODUCTION === '1' && url.pathname.startsWith('/pilot/') ? url.pathname.slice('/pilot'.length) : url.pathname
    const staticPath = /^\/(scripts\/brand-system\/harness\/|src\/|node_modules\/|@vite\/|@id\/|@fs\/|@react-refresh$|brand\/ordering\/)/.test(pathname)
    const fixtureFlag = /^\/brand-fixture-flags\/[A-Z]{2}\.svg$/.test(pathname)
    const compiledAsset = process.env.BRAND_HARNESS_PRODUCTION === '1' && /^\/pilot\/assets\/[^/]+\.(js|css|woff2|svg|png)$/.test(url.pathname)
    if (url.origin === harnessOrigin && route.request().method() === 'GET' && (staticPath || compiledAsset || fixtureFlag || pathname === '/i18n/translations.json' || pathname === '/default-favicon.png')) return route.continue()
    unexpected.push(route.request().method() + ' ' + url.origin + url.pathname)
    await route.abort('blockedbyclient')
  })
  await context.routeWebSocket(/.*/, socket => {
    if (!socket.url().startsWith(harnessSocketOrigin)) {
      unexpected.push('WebSocket ' + socket.url())
      socket.close()
    } else socket.connectToServer()
  })
  return unexpected
}

export const test = base.extend({
  page: async ({ page, context }, use) => {
    const unexpected = await installNetworkBoundary(context)
    // fila 48: the self-hosted Inter arrives from the dev server after `load` on a cold Vite and re-wraps text, so a spec that
    // measures right after `goto` (feedback.spec.js reduced motion: a 33px shift between two reads) saw the layout move under it. Every
    // `goto` of the harness now also waits for the fonts the page asked for; a navigation that leaves no document keeps its own result.
    const goto = page.goto.bind(page)
    page.goto = async (...args) => {
      const response = await goto(...args)
      await page.evaluate(() => document.fonts?.ready).catch(() => {})
      return response
    }
    await use(page)
    expect(unexpected, 'fixture must never request external services or write data').toEqual([])
  }
})
export { expect }
export const fixtureUrl = (query = '') => `${process.env.BRAND_HARNESS_PRODUCTION === '1' ? '/pilot' : ''}/scripts/brand-system/harness/index.html?` + query
