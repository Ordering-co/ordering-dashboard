import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

import {
  expect,
  expectClosedNetworkBoundary,
  installAppNetworkBoundary,
  installSyntheticSession,
  test
} from './fixtures'

const viewports = {
  desktop: { width: 1440, height: 1000 },
  mobile: { width: 390, height: 844 }
}

const anonymousRoutes = [
  // redesign W0-12 (T0-49, M-08): the sign-in screen names itself with t('LOGIN_PAGE_TITLE', 'Sign in to your dashboard'),
  // the level-1 heading of LoginForm/index.js:282 (no «Welcome!» any more). The synthetic API sends no catalog, so the code fallback paints.
  { path: '/login', heading: 'Sign in to your dashboard' },
  { path: '/password/forgot', heading: 'Forgot your password?' }
]

const authenticatedRoutes = [
  // redesign 5.2 (df9ce417): the orders list header names the page with a real level-1 heading, not a visual <p>.
  { path: '/orders', heading: 'Orders list' },
  // With no stores, BusinessesListing opens main's «Add new store» modal over the list (isNoBusinessesModal), which hides
  // the page from the accessibility tree. The check closes it, as a user would, before reading the heading.
  { path: '/stores/list', heading: 'Stores', noBusinessesModal: true },
  { path: '/marketing/promotions-enterprise', heading: 'Promotions' },
  // redesign W0-12 (T0-49, M-08): «Basic settings» is a legacy URL. It still loads as a document (so the fixtures allow it) and
  // <SettingsLegacyRedirect> (App.js:651, pages/Settings/LegacyRedirect.js) sends it to the Settings hub at /settings?group=...
  // (utils/settingsRedirects.js:15). The hub names itself with the level-1 heading t('SETTINGS', 'Settings') (SettingsHub/index.js:305 and :350).
  // The group in the query is not pinned: with the synthetic empty catalog the hub has no «platform» group and rewrites the query to the first one
  // (SettingsHub/index.js:137-153).
  { path: '/settings/basic', heading: 'Settings', redirectsToHub: true },
  // redesign /profile is the Product page; its level-1 heading is the PageHeader title t('PROFILE', 'Profile').
  // «Sessions» is now the level-2 title of the sessions card (it would still match), so the row names the page itself.
  { path: '/profile', heading: 'Profile' }
]

async function expectRouteReady (page, route) {
  if (route.redirectsToHub) {
    await expect(page).toHaveURL(url => url.pathname === '/settings' && url.searchParams.has('group'), { timeout: 90000 })
  }

  if (route.noBusinessesModal) {
    const modal = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Add new store', exact: true }) })
    await expect(modal).toBeVisible({ timeout: 90000 })
    await modal.getByRole('button', { name: /close/i }).click()
    await expect(modal).toBeHidden()
  }

  if (route.heading) {
    await expect(page.getByRole('heading', { name: route.heading, exact: true })).toBeVisible({ timeout: 90000 })
    return
  }

  await expect(page.locator('p').filter({ hasText: new RegExp(`^${route.visualTitle}$`, 'i') })).toBeVisible({ timeout: 90000 })
}

async function dismissReadOnlyNotices (page) {
  const accept = page.getByRole('button', { name: 'Accept', exact: true })
  if (await accept.count()) await accept.last().click()
}

async function expectStableMobileShell (page, viewport) {
  if (viewport.width >= 768) return

  await expect.poll(async () => page.locator('#side_bar').evaluate(element => Math.round(element.getBoundingClientRect().x))).toBeLessThanOrEqual(-viewport.width + 1)
  const geometry = await page.evaluate(() => {
    const sideBar = document.querySelector('#side_bar')
    const main = sideBar?.nextElementSibling?.getBoundingClientRect()
    return {
      viewportWidth: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      mainLeft: main?.left,
      mainRight: main?.right
    }
  })
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth)
  expect(geometry.mainLeft).toBeGreaterThanOrEqual(0)
  expect(geometry.mainRight).toBeLessThanOrEqual(geometry.viewportWidth)
}

async function expectLocalTheme (page) {
  await page.evaluate(() => document.fonts.ready)
  const theme = await page.evaluate(() => ({
    bodyFont: getComputedStyle(document.body).fontFamily,
    background: getComputedStyle(document.documentElement).getPropertyValue('--od-bg').trim(),
    localFontLoaded: [...document.fonts].some(font => font.family === 'Ordering Inter Local' && font.status === 'loaded'),
    remoteFontStylesheet: [...document.querySelectorAll('link[rel="stylesheet"]')].some(link => link.href.includes('fonts.googleapis.com'))
  }))

  expect(theme.bodyFont).toContain('Ordering Inter Local')
  expect(theme.background).toBe('#FFFFFF')
  expect(theme.localFontLoaded).toBe(true)
  expect(theme.remoteFontStylesheet).toBe(false)
}

async function captureNonEmptyPage (page, testInfo, name, touch) {
  const bodyText = (await page.locator('body').innerText()).trim()
  const bounds = await page.locator('body').boundingBox()
  expect(bodyText.length).toBeGreaterThan(20)
  expect(bounds?.width).toBeGreaterThan(300)
  expect(bounds?.height).toBeGreaterThan(100)

  const path = testInfo.outputPath(`${name}.png`)
  await mkdir(dirname(path), { recursive: true })
  expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(touch)
  const screenshot = await page.screenshot({ path, fullPage: !touch })
  expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(touch)
  expect(screenshot.byteLength).toBeGreaterThan(10000)
}

for (const [viewportName, viewport] of Object.entries(viewports)) {
  test.describe(`${viewportName} input platform`, () => {
    test.use({ viewport, hasTouch: viewportName === 'mobile', isMobile: viewportName === 'mobile' })

    for (const route of anonymousRoutes) {
      test(`${viewportName} ${route.path} renders the real anonymous screen with local theme`, async ({ context, page }, testInfo) => {
        const network = await installAppNetworkBoundary(context)
        await installSyntheticSession(context, { authenticated: false })
        await page.setViewportSize(viewport)
        const pageErrors = []
        page.on('pageerror', error => pageErrors.push(error.message))

        await page.goto(route.path, { waitUntil: 'domcontentloaded' })
        expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(viewportName === 'mobile')
        await expectRouteReady(page, route)
        await expectLocalTheme(page)
        await captureNonEmptyPage(page, testInfo, `${viewportName}-${route.path.replaceAll('/', '-') || 'root'}`, viewportName === 'mobile')

        expect(pageErrors).toEqual([])
        expectClosedNetworkBoundary(network)
      })
    }

    for (const route of authenticatedRoutes) {
      test(`${viewportName} ${route.path} renders the real authenticated screen with synthetic reads`, async ({ context, page }, testInfo) => {
        const network = await installAppNetworkBoundary(context)
        await installSyntheticSession(context, { authenticated: true })
        await page.setViewportSize(viewport)
        const pageErrors = []
        page.on('pageerror', error => pageErrors.push(error.message))

        await page.goto(route.path, { waitUntil: 'domcontentloaded' })
        expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(viewportName === 'mobile')
        await expectRouteReady(page, route)
        await dismissReadOnlyNotices(page)
        await expectStableMobileShell(page, viewport)
        await expectLocalTheme(page)
        await captureNonEmptyPage(page, testInfo, `${viewportName}-${route.path.replaceAll('/', '-') || 'root'}`, viewportName === 'mobile')

        expect(pageErrors).toEqual([])
        expectClosedNetworkBoundary(network)
      })
    }
  })
}
