import { test, expect, fixtureUrl } from './fixtures'

for (const width of [320, 390]) {
  test.describe(`recovery surfaces ${width}px`, () => {
    test.use({ viewport: { width, height: 400 }, hasTouch: true, isMobile: true })
    for (const fixtureCase of ['forgot', 'reset']) {
      test(`${fixtureCase} keeps RTL controls reachable in a short mobile viewport`, async ({ page }, testInfo) => {
        await page.emulateMedia({ colorScheme: 'dark' })
        await page.goto(fixtureUrl(`surface=auth-forms&case=${fixtureCase}&mode=dark&rtl=true&locale=ar`))
        // main's AuthLayout has no data-slot; the form column is the <main> nested in the fixture.
        const root = page.getByTestId('auth-forms-fixture').locator('main')
        await expect(root).toBeVisible()
        for (const logo of await root.locator('img').all()) {
          await expect.poll(() => logo.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true)
        }
        expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
        const controls = root.locator('input:visible, button:visible, a:visible')
        expect(await controls.count()).toBeGreaterThan(2)
        for (const control of await controls.all()) {
          await control.scrollIntoViewIfNeeded()
          const box = await control.boundingBox()
          expect.soft(box.x).toBeGreaterThanOrEqual(0)
          expect.soft(box.x + box.width).toBeLessThanOrEqual(width)
          expect.soft(box.width).toBeGreaterThanOrEqual(44)
          expect.soft(box.height).toBeGreaterThanOrEqual(44)
          expect.soft(await control.evaluate(element => {
            const rect = element.getBoundingClientRect()
            const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
            return hit === element || element.contains(hit)
          })).toBe(true)
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
        await page.screenshot({ path: testInfo.outputPath(`${fixtureCase}-${width}-short.png`), fullPage: false })
        expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      })
    }
  })
}
