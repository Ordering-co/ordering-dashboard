import { test, expect, fixtureUrl } from './fixtures'

for (const consumer of ['order-bill', 'custom-cart-bill', 'open-cart-bill']) {
  test(`${consumer} preserves fee and tax rows, rates and displayed amounts`, async ({ page }) => {
    await page.goto(fixtureUrl('surface=bill-row-consumers&mode=light'))
    const scope = page.getByTestId(consumer)
    for (const [name, amount] of [['Product tax', '$2.50'], ['Handling fee', '$3.20'], ['Order tax', '$0.50'], ['Delivery tax', '$1.00']]) {
      const row = scope.locator('tr').filter({ hasText: name })
      await expect(row).toHaveCount(1)
      await expect(row.locator('td').last()).toHaveText(amount)
    }
    await expect(scope.locator('tr').filter({ hasText: 'Handling fee' })).toContainText('($2.00 + 3%)')
    await expect(scope.locator('tr').filter({ hasText: 'Product tax' })).toContainText('(7.50%)')
  })
}

test('custom cart fee action opens the existing details modal with the original fee data', async ({ page }) => {
  await page.goto(fixtureUrl('surface=bill-row-consumers&mode=light'))
  const row = page.getByTestId('custom-cart-bill').locator('tr').filter({ hasText: 'Handling fee' })
  await row.locator('svg').click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog')).toContainText('Handling fee details')
})

test.describe('actual custom cart touch controls', () => {
  test.use({ viewport: { width: 320, height: 760 }, hasTouch: true, isMobile: true })
  test('fee action remains reachable inside the real legacy bill layout in RTL', async ({ page }) => {
    await page.goto(fixtureUrl('surface=bill-row-consumers&mode=dark&rtl=true&locale=ar'))
    const row = page.getByTestId('custom-cart-bill').locator('tr').filter({ hasText: 'Handling fee' })
    const action = row.getByRole('button')
    await action.scrollIntoViewIfNeeded()
    const box = await action.boundingBox()
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
    expect(await action.evaluate(element => {
      const rect = element.getBoundingClientRect()
      return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2))
    })).toBe(true)
    await action.tap()
    await expect(page.getByRole('dialog')).toContainText('Handling fee details')
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
  })
})
