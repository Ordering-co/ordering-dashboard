import { test, expect, fixtureUrl } from './fixtures'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.open = (...args) => { globalThis.__OD_OUTBOUND_OPEN__ = args; return null }
  })
})

test('actual user detail personalization preserves image and contact destination without external writes', async ({ page }) => {
  await page.goto(fixtureUrl('surface=outbound-link-consumers&mode=light'))
  const scope = page.getByTestId('personalization-user-consumer')
  await expect(scope.getByRole('link', { name: 'send us your special wish.', exact: true })).toHaveAttribute('href', 'https://orderingco.typeform.com/to/qHPQtU')
  await expect(scope.locator('img')).toHaveAttribute('src', /personalization[^/]*\.svg/)
  await scope.getByRole('button', { name: 'Contact us', exact: true }).click()
  expect(await page.evaluate(() => globalThis.__OD_OUTBOUND_OPEN__)).toEqual(['https://orderingco.typeform.com/to/qHPQtU', '_blank', 'noopener,noreferrer'])
})

test('actual product description preserves customer text and generated hrefs with named target', async ({ page }) => {
  await page.goto(fixtureUrl('surface=outbound-link-consumers&mode=light'))
  const scope = page.getByTestId('product-description-consumer')
  await expect(scope).toContainText('Customer description: https://example.invalid/product and support@example.invalid remain customer text.')
  const web = scope.getByRole('link', { name: 'https://example.invalid/product', exact: true })
  await expect(web).toHaveAttribute('href', 'https://example.invalid/product')
  await expect(web).toHaveAttribute('target', 'blank')
  await expect(scope.getByRole('link', { name: 'support@example.invalid', exact: true })).toHaveCount(0)
})
