import { test, expect, fixtureUrl } from './fixtures'

test('real SettingsImage retains crop payload, config ID and closes its modal after saving', async ({ page }) => {
  await page.goto(fixtureUrl('surface=media-consumers&mode=light'))
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 240
    canvas.height = 160
    const context = canvas.getContext('2d')
    context.fillStyle = '#266df0'
    context.fillRect(0, 0, 240, 160)
    context.fillStyle = '#ffffff'
    context.fillRect(40, 40, 80, 80)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  await page.locator('input[type=file]').setInputFiles({ name: 'customer.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
  await expect(page.locator('.cropper-container')).toBeVisible()
  await expect.poll(() => page.locator('.cropper-canvas').evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Crop', exact: true }).click()
  await expect.poll(() => page.evaluate(() => globalThis.__OD_MEDIA_CONSUMER_SAVES__?.length || 0)).toBe(1)
  const saved = await page.evaluate(() => globalThis.__OD_MEDIA_CONSUMER_SAVES__[0])
  expect(saved.id).toBe(701)
  expect(Object.keys(saved.value)).toEqual(['image'])
  expect(saved.value.image).toMatch(/^data:image\/png;base64,/)
  await expect(page.locator('.cropper-container')).toHaveCount(0)
  await expect(page.getByTestId('media-settings-consumer').locator('img[alt="config image"]')).toHaveAttribute('src', saved.value.image)
})
