import { writeFileSync } from 'node:fs'
import { test, expect, fixtureUrl } from './fixtures'

test('canonical print PNG is converted through the real invoice logo pipeline', async ({ page }) => {
  await page.goto(fixtureUrl('surface=identity-pdf&mode=light'))
  await expect(page.getByTestId('logo-status')).toHaveText('ready')
  await expect(page.getByTestId('logo-prefix')).toHaveText(/^data:image\/png;base64,/)
  const logos = page.locator('section img')
  await expect(logos).toHaveCount(2)
  for (const logo of await logos.all()) await expect(logo).toHaveAttribute('src', /^data:image\/png;base64,/)
})

test('business and driver renderers preserve exact synthetic invoice content', async ({ page }) => {
  await page.goto(fixtureUrl('surface=identity-pdf&mode=light'))
  await expect(page.getByLabel('Business invoice renderer')).toContainText('Invoice for Fixture Business')
  await expect(page.getByLabel('Driver invoice renderer')).toContainText('Invoice for Fixture Driver')
  for (const renderer of [page.getByLabel('Business invoice renderer'), page.getByLabel('Driver invoice renderer')]) {
    await expect(renderer).toContainText('7001')
    await expect(renderer).toContainText('$21.00')
    await expect(renderer).toContainText('Fixture note')
  }
})

test('real HTML builder keeps one safe logo and request helper emits the exact backend payload', async ({ page }, testInfo) => {
  await page.goto(fixtureUrl('surface=identity-pdf&mode=light'))
  await expect(page.getByTestId('logo-status')).toHaveText('ready')
  await expect.poll(() => page.getByTestId('exact-pdf-html').inputValue()).toContain('<!DOCTYPE html>')
  const html = await page.getByTestId('exact-pdf-html').inputValue()
  expect((html.match(/<img\b/g) || []).length).toBe(1)
  expect(html).toContain('<img src="data:image/png;base64,')
  expect(html).toContain('Fixture Business')

  await page.getByRole('button', { name: 'Capture PDF request' }).click()
  await expect.poll(async () => JSON.parse(await page.getByTestId('pdf-request-capture').textContent())?.filename).toBe('fixture.pdf')
  const capture = JSON.parse(await page.getByTestId('pdf-request-capture').textContent())
  expect(capture.filename).toBe('fixture.pdf')
  expect(capture.blobType).toBe('application/pdf')
  expect(capture.request.url).toBe('/fixture-api/pdf/html')
  expect(capture.request.options.method).toBe('POST')
  expect(capture.request.options.headers.Authorization).toBe('Bearer fixture-token')
  const payload = JSON.parse(capture.request.options.body)
  expect(payload.with_doctype).toBe(0)
  expect(payload.html).toBe(html)
  writeFileSync(testInfo.outputPath('business-invoice.html'), html)
  const driverHtml = await page.getByTestId('exact-driver-pdf-html').inputValue()
  expect(driverHtml).toContain('Fixture Driver')
  writeFileSync(testInfo.outputPath('driver-invoice.html'), driverHtml)
})
