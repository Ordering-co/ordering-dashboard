import { test, expect, fixtureUrl } from './fixtures'
import { orderingAssets as rawAssets } from '../../src/brand/assets'

const assetPath = path => `${process.env.BRAND_HARNESS_PRODUCTION === '1' ? '/pilot' : ''}${path}`
const resolveAssets = value => typeof value === 'string' ? assetPath(value) : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveAssets(item)]))
const orderingAssets = resolveAssets(rawAssets)

const state = async page => JSON.parse(await page.getByTestId('identity-state').textContent())
const defaults = async page => JSON.parse(await page.getByTestId('identity-defaults').textContent())
const expectedDefaults = {
  logotype: orderingAssets.logos.light,
  logotypeInvert: orderingAssets.logos.onDark,
  isotype: orderingAssets.symbols.light,
  isotypeInvert: orderingAssets.symbols.dark,
  logoPdf: orderingAssets.logos.print
}

test('real identity defaults preserve five compatibility paths and resolve an official Light logo once', async ({ page }) => {
  await page.goto(fixtureUrl('surface=identity&mode=light'))
  expect(await defaults(page)).toEqual(expectedDefaults)
  for (const value of Object.values(await defaults(page))) {
    expect(value).toMatch(/^\/(?:pilot\/)?brand\/ordering\/1\.3\.0\/assets\//)
    expect(value).not.toContain('/brand/ordering/1.3.0/brand/ordering/')
  }
  await expect.poll(() => state(page)).toMatchObject({
    hostname: 'dashboard.ordering.co',
    isOfficial: true,
    mode: 'light',
    resolved: {
      favicon: assetPath('/favicon.png'),
      logo: orderingAssets.logos.light,
      notification: orderingAssets.symbols.light
    },
    themeLogo: orderingAssets.logos.light
  })
  await expect(page.getByTestId('identity-host')).toHaveText('dashboard.ordering.co')
})

test('all approved lockups and contained symbols load real files with complete natural geometry', async ({ page }) => {
  await page.goto(fixtureUrl('surface=identity&mode=light'))
  const approved = page.getByRole('region', { name: 'Approved identity assets', exact: true })
  const images = approved.locator('img')
  await expect(images).toHaveCount(7)
  for (const image of await images.all()) {
    await expect.poll(() => image.evaluate(element => ({ complete: element.complete, height: element.naturalHeight, width: element.naturalWidth }))).toMatchObject({ complete: true })
    const natural = await image.evaluate(element => ({ height: element.naturalHeight, width: element.naturalWidth }))
    expect(natural.width).toBeGreaterThan(0)
    expect(natural.height).toBeGreaterThan(0)
  }
  for (const image of await approved.locator('.identity-lockup img').all()) {
    const box = await image.boundingBox()
    expect(box.width).toBeLessThanOrEqual(150)
    expect(box.height).toBeLessThanOrEqual(80)
  }
  for (const image of await approved.locator('.identity-symbol img').all()) {
    const box = await image.boundingBox()
    expect(box.width).toBe(44)
    expect(box.height).toBe(44)
  }
  await expect(approved.getByText('Full color on Light', { exact: true }).locator('xpath=preceding-sibling::*[1]')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(approved.getByText('Reversed on Dark', { exact: true }).locator('xpath=preceding-sibling::*[1]')).toHaveCSS('background-color', 'rgb(21, 27, 38)')
})

// Retired 2026-10-03 after the merge of main: the client-side icon sync (five governed head link roles) was removed; App.js now sets the favicon itself and the favicon default is /favicon.png (covered by the resolver assertions below).

test('same mount preserves mode, tenant override, custom fallback, clear and official restoration precedence', async ({ page }) => {
  await page.goto(fixtureUrl('surface=identity&mode=light'))
  await page.getByRole('button', { name: 'Toggle identity mode', exact: true }).click()
  await expect.poll(() => state(page)).toMatchObject({ mode: 'dark', themeLogo: orderingAssets.logos.dark, resolved: { logo: orderingAssets.logos.dark } })

  await page.getByRole('button', { name: 'Apply tenant identity', exact: true }).click()
  const configuredLogo = (await state(page)).configs.dashboard_logo.value
  expect(configuredLogo).toMatch(process.env.BRAND_HARNESS_PRODUCTION === '1' ? /^\/pilot\/assets\/logotype-[^/]+\.svg$/ : /^\/src\/assets\/images\/ordering-lockup-color\.svg$/)
  await expect.poll(() => page.getByAltText('Current resolved dashboard logo').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true)
  await expect.poll(() => state(page)).toMatchObject({
    resolved: {
      favicon: orderingAssets.appIcons.small,
      logo: configuredLogo,
      notification: orderingAssets.appIcons.small
    }
  })

  await page.getByRole('button', { name: 'Use custom host', exact: true }).click()
  await expect.poll(() => state(page)).toMatchObject({ hostname: 'tenant.example.com', isOfficial: false, resolved: { logo: configuredLogo } })
  await page.getByRole('button', { name: 'Clear tenant identity', exact: true }).click()
  await expect.poll(() => state(page)).toMatchObject({
    configs: {},
    hostname: 'tenant.example.com',
    isOfficial: false,
    resolved: { favicon: assetPath('/favicon.png'), logo: orderingAssets.logos.dark, notification: orderingAssets.symbols.light }
  })
  // main: a custom host without tenant identity shows the governed Ordering.co brand, not a neutral placeholder.
  await expect(page.getByTestId('identity-neutral-logo')).toHaveCount(0)

  await page.getByRole('button', { name: 'Use official host', exact: true }).click()
  await expect.poll(() => state(page)).toMatchObject({
    hostname: 'dashboard.ordering.co',
    isOfficial: true,
    resolved: { favicon: assetPath('/favicon.png'), logo: orderingAssets.logos.dark, notification: orderingAssets.symbols.light }
  })
})

test('real Helmet title and description no longer carry a powered-by suffix, with or without the worker disable switch', async ({ page }) => {
  // main removed the powered-by suffix from HelmetTags; the worker switch must not change title or description.
  await page.goto(fixtureUrl('surface=identity&mode=light'))
  await expect(page).toHaveTitle('Identity Console - Identity fixture')
  await expect(page.locator('head meta[name="description"]')).toHaveAttribute('content', 'Identity fixture description.')
  await page.getByRole('button', { name: 'Disable powered by', exact: true }).click()
  await expect(page.getByTestId('identity-state')).toContainText('"poweredDisabled":true')
  await expect(page).toHaveTitle('Identity Console - Identity fixture')
  await expect(page.locator('head meta[name="description"]')).toHaveAttribute('content', 'Identity fixture description.')
  await page.getByRole('button', { name: 'Enable powered by', exact: true }).click()
  await expect(page.getByTestId('identity-state')).toContainText('"poweredDisabled":false')
  await expect(page).toHaveTitle('Identity Console - Identity fixture')
  await expect(page.locator('head meta[name="description"]')).toHaveAttribute('content', 'Identity fixture description.')
})

for (const mode of ['light', 'dark']) {
  test(`identity ${mode} fields and controls remain readable and use the governed mode logo`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1100, height: 800 })
    await page.goto(fixtureUrl(`surface=identity&mode=${mode}`))
    await expect.poll(() => state(page)).toMatchObject({
      mode,
      themeLogo: mode === 'dark' ? orderingAssets.logos.dark : orderingAssets.logos.light
    })
    const current = page.getByAltText('Current resolved dashboard logo')
    await expect(current).toHaveAttribute('src', mode === 'dark' ? orderingAssets.logos.dark : orderingAssets.logos.light)
    await expect(current).toHaveJSProperty('complete', true)
    expect(await current.evaluate(element => element.naturalWidth)).toBeGreaterThan(0)
    await page.screenshot({ path: testInfo.outputPath(`identity-${mode}.png`), fullPage: true })
  })
}

for (const width of [320, 390]) {
  test.describe(`identity at ${width}px coarse pointer`, () => {
    test.use({ viewport: { width, height: 760 }, hasTouch: true, isMobile: true })
    test('real lockups, symbols and controls stay inside the viewport', async ({ page }, testInfo) => {
      await page.goto(fixtureUrl('surface=identity&mode=dark&rtl=true'))
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      for (const control of await page.locator('.identity-controls button').all()) {
        const box = await control.boundingBox()
        expect.soft(box.x).toBeGreaterThanOrEqual(0)
        expect.soft(box.x + box.width).toBeLessThanOrEqual(width)
        expect.soft(box.height).toBeGreaterThanOrEqual(44)
      }
      for (const image of await page.getByRole('region', { name: 'Approved identity assets' }).locator('img').all()) {
        const box = await image.boundingBox()
        expect.soft(box.x).toBeGreaterThanOrEqual(0)
        expect.soft(box.x + box.width).toBeLessThanOrEqual(width)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      await page.screenshot({ path: testInfo.outputPath(`identity-${width}.png`) })
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
    })
  })
}
