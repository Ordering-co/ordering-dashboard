import { test, expect, fixtureUrl } from './fixtures'

const readState = async page => JSON.parse(await page.getByTestId('address-sidebar-state').textContent())
const readLocation = async page => JSON.parse(await page.getByTestId('address-location').textContent())
const sidebar = page => page.locator('#sideSlider')

test('AddressFieldsSetting preserves selection, field callbacks and outside exclusions', async ({ page }) => {
  await page.goto(fixtureUrl('surface=address-sidebar-consumer&mode=light'))
  const scope = page.getByTestId('address-sidebar-consumer')

  await scope.getByText('Marketplace App', { exact: true }).click()
  await expect(sidebar(page)).toBeVisible()
  await expect(sidebar(page)).toHaveCSS('width', '500px')
  await expect.poll(() => readState(page)).toMatchObject({ moveDistance: 500, selectedSiteId: 1 })
  expect(new URLSearchParams((await readLocation(page)).search).get('site')).toBe('1')

  await scope.getByText('Dashboard', { exact: true }).click()
  await expect(sidebar(page)).toBeVisible()
  await expect.poll(() => readState(page)).toMatchObject({ moveDistance: 500, selectedSiteId: 2 })
  expect(new URLSearchParams((await readLocation(page)).search).get('site')).toBe('2')

  await scope.getByText('Marketplace App', { exact: true }).click()
  const addressRow = sidebar(page).getByText('Address', { exact: true }).locator('..')
  const requiredSwitch = addressRow.locator('input[type="checkbox"]').first()
  await expect(requiredSwitch).toBeChecked()
  await addressRow.locator('label').first().click()
  await expect(requiredSwitch).not.toBeChecked()
  await expect.poll(async () => (await readState(page)).fieldEvents).toEqual([
    { changes: { required: false }, fieldId: 201, siteId: 1 }
  ])

  await addressRow.locator('label').last().click()
  await expect.poll(async () => (await readState(page)).fieldEvents).toEqual([
    { changes: { required: false }, fieldId: 201, siteId: 1 },
    { changes: { enabled: false }, fieldId: 201, siteId: 1 }
  ])

  await scope.getByRole('button', { name: 'Protected outer target', exact: true }).click()
  await expect(sidebar(page)).toBeVisible()
  expect((await readState(page)).selectedSiteId).toBe(1)

  await scope.getByRole('button', { name: 'Genuine outside target', exact: true }).click()
  await expect(sidebar(page)).not.toBeVisible()
  await expect.poll(() => readState(page)).toMatchObject({ moveDistance: 0, selectedSiteId: null })
  expect(new URLSearchParams((await readLocation(page)).search).has('site')).toBe(false)
})

test.describe('AddressFieldsSetting sidebar on mobile', () => {
  test.use({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true })

  test('keeps the real panel at viewport width without document overflow', async ({ page }, testInfo) => {
    await page.goto(fixtureUrl('surface=address-sidebar-consumer&mode=dark&rtl=true'))
    const scope = page.getByTestId('address-sidebar-consumer')
    await scope.getByText('Marketplace App', { exact: true }).click()
    await expect(sidebar(page)).toBeVisible()
    await expect(sidebar(page)).toHaveCSS('width', '390px')
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
    expect((await readState(page)).selectedSiteId).toBe(1)
    const close = sidebar(page).locator('button').first()
    const closeBox = await close.boundingBox()
    expect(closeBox.width).toBeGreaterThanOrEqual(44)
    expect(closeBox.height).toBeGreaterThanOrEqual(44)
    await page.screenshot({ path: testInfo.outputPath('address-fields-mobile.png') })
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
    await close.click()
    await expect(sidebar(page)).not.toBeVisible()
    await expect.poll(() => readState(page)).toMatchObject({ moveDistance: 0, selectedSiteId: null })
    const geometry = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, viewport: innerWidth }))
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewport)
  })
})

test('C3 target: AddressFieldsSetting freshly mounted details responds to desktop Escape', async ({ page }) => {
  await page.goto(fixtureUrl('surface=address-sidebar-consumer&mode=light'))
  await page.getByText('Marketplace App', { exact: true }).click()
  await expect(sidebar(page)).toHaveCSS('width', '500px')
  await page.keyboard.press('Escape')
  await expect(sidebar(page)).not.toBeVisible()
  await expect.poll(() => readState(page)).toMatchObject({ moveDistance: 0, selectedSiteId: null })
})
