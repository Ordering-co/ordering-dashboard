import { test, expect, fixtureUrl } from './fixtures'
import { orderingAssets } from '../../src/brand/assets'

for (const fixtureCase of ['login', 'forgot', 'reset']) {
  test(`${fixtureCase} respects an explicit tenant logo in the real auth surface`, async ({ page }) => {
    const logo = orderingAssets.logos.onLight
    await page.goto(fixtureUrl(`surface=auth-forms&case=${fixtureCase}&logo=${encodeURIComponent(logo)}`))
    // main's AuthLayout renders the tenant logo twice: in the brand panel and in the mobile header.
    const images = page.getByTestId('auth-forms-fixture').locator('img')
    const prefix = process.env.BRAND_HARNESS_PRODUCTION === '1' ? '/pilot' : ''
    await expect(images).toHaveCount(2)
    for (const image of await images.all()) {
      await expect(image).toHaveAttribute('src', `${prefix}${logo}`)
      await expect.poll(() => image.evaluate(element => element.complete && element.naturalWidth > 0)).toBe(true)
    }
  })
}
