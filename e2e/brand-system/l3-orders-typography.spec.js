import { expect, fixtureUrl, test } from './fixtures'
import { tokens } from '../../src/brand/ordering.tokens.generated'

test('open Orders company selector follows and restores the central control-value role', async ({ page }) => {
  test.setTimeout(60000)
  await page.goto(fixtureUrl('surface=select-consumers&mode=light&fixtureUserLevel=0&firstSelect=true'))
  const company = page.getByTestId('company-single-consumer')
  const trigger = company.locator('[role="button"][aria-expanded], [role="combobox"]').first()

  await trigger.click()
  const value = company.getByRole('option').filter({ hasText: 'Orbit Delivery' }).locator('p').first()
  await expect(value).toBeVisible()
  await expect(value).toHaveCSS('font-size', tokens.font.size.productContent)

  await page.evaluate(() => document.documentElement.style.setProperty('--od-type-control-value-size', '18px'))
  await expect(value).toHaveCSS('font-size', '18px')
  await page.evaluate(() => document.documentElement.style.removeProperty('--od-type-control-value-size'))
  await expect(value).toHaveCSS('font-size', tokens.font.size.productContent)
})
