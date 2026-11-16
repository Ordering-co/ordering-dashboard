import { test, expect, fixtureUrl } from './fixtures'

test('isolated fixture renders actual boot and unrelated page with no service access', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(fixtureUrl('density=full'))
  await expect(page.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  await expect(page.getByTestId('boot-chart')).toBeVisible()
  await page.goto(fixtureUrl('surface=control'))
  await expect(page.getByRole('heading', { name: "This page isn't available", level: 1 })).toBeVisible()
  expect(errors).toEqual([])
})
