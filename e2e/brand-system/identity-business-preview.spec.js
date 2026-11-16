import { test, expect, fixtureUrl } from './fixtures'
import { orderingAssets } from '../../src/brand/assets'

const previewUrl = (query = '') => fixtureUrl(`surface=identity-business-preview&mode=light${query}`)

test('real desktop BusinessPreview loads the canonical complete logo at the retained 120 by 30 geometry', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 })
  await page.goto(previewUrl())
  const logo = page.getByAltText('Logotype', { exact: true })
  await expect(logo).toBeVisible()
  await expect(logo).toHaveAttribute('src', `${process.env.BRAND_HARNESS_PRODUCTION === '1' ? '/pilot' : ''}${orderingAssets.logos.light}`)
  await expect(logo).toHaveAttribute('width', '120px')
  await expect(logo).toHaveAttribute('height', '30px')
  await expect.poll(() => logo.evaluate(element => ({ complete: element.complete, naturalHeight: element.naturalHeight, naturalWidth: element.naturalWidth }))).toMatchObject({ complete: true })
  const natural = await logo.evaluate(element => ({ height: element.naturalHeight, width: element.naturalWidth }))
  expect(natural.width).toBeGreaterThan(0)
  expect(natural.height).toBeGreaterThan(0)
  const box = await logo.boundingBox()
  expect(box.width).toBe(120)
  expect(box.height).toBe(30)
  await expect(page.getByText('Identity fixture restaurant', { exact: true })).toBeVisible()
  await expect(page.getByText('Fixture product', { exact: true })).toBeVisible()
})

test('real desktop BusinessPreview retains the white-label gate and removes only the dashboard logo', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 })
  await page.goto(previewUrl('&whiteLabel=1'))
  await expect(page.getByAltText('Logotype', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Identity fixture restaurant', { exact: true })).toBeVisible()
  await expect(page.getByText('New York', { exact: true })).toBeVisible()
})

test('real BusinessPreview keeps the logo hidden at the original 650px boundary and in explicit mobile mode', async ({ page }) => {
  await page.setViewportSize({ width: 650, height: 800 })
  await page.goto(previewUrl())
  await expect(page.getByTestId('business-preview-mode')).toHaveText('desktop')
  await expect(page.getByAltText('Logotype', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Identity fixture restaurant', { exact: true })).toBeVisible()

  await page.setViewportSize({ width: 900, height: 800 })
  await page.goto(previewUrl('&view=mobile'))
  await expect(page.getByTestId('business-preview-mode')).toHaveText('mobile')
  await expect(page.getByAltText('Logotype', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Identity fixture restaurant', { exact: true })).toBeVisible()
})
