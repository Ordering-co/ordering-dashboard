import { expect, fixtureUrl, test } from './fixtures'

const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, value] of Object.entries(values)) document.documentElement.style.setProperty(`--od-type-${role}-size`, value)
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-type-${role}-size`)
}, roles)

for (const mode of ['light', 'dark']) {
  test(`Delivery-1 families use governed ${mode} states and separated actions`, async ({ page }, testInfo) => {
    await page.goto(fixtureUrl(`surface=delivery-1-styles&mode=${mode}`))
    const surface = page.getByTestId('delivery-1-styles')

    // redesign W1-8: the store status title and table moved to P/PageHeader and P/DataTable (gallery and their own specs)
    // redesign driver-store-status (decision 1): its KPI cards became P/Metric (gallery and its own tests)
    await expect(surface.getByTestId('log-time')).toHaveCSS('font-size', '13px')
    await expect(surface.getByTestId('log-time')).toHaveCSS('direction', 'ltr')
    expect(await surface.getByTestId('log-time').evaluate(node => getComputedStyle(node).fontFamily)).toContain('JetBrains Mono')

    await page.screenshot({ path: testInfo.outputPath(`delivery-1-${mode}.png`), fullPage: true })
  })
}

test('Delivery-1 central roles propagate through all representative families and restore', async ({ page }, testInfo) => {
  await page.goto(fixtureUrl('surface=delivery-1-styles&mode=light'))
  const surface = page.getByTestId('delivery-1-styles')
  const checks = [
    [surface.getByTestId('log-content'), '19px'],
    [surface.getByTestId('log-time'), '18px'],
    [surface.getByTestId('logs-empty'), '24px']
  ]

  await setRoleSizes(page, { title: '28px', 'section-title': '24px', content: '19px', secondary: '16px', control: '17px', 'control-value': '18px', identifier: '18px' })
  for (const [locator, size] of checks) await expect(locator).toHaveCSS('font-size', size)
  await page.screenshot({ path: testInfo.outputPath('delivery-1-propagated.png'), fullPage: true })

  await restoreRoleSizes(page, ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier'])
  await expect(surface.getByTestId('log-time')).toHaveCSS('font-size', '13px')
})

test.describe('Delivery-1 at 320px RTL coarse pointer and reduced motion', () => {
  test.use({ viewport: { width: 320, height: 760 }, hasTouch: true, isMobile: true })

  test('keeps forms and long values reachable while wide tables scroll internally', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(fixtureUrl('surface=delivery-1-styles&mode=dark&rtl=true&locale=ar'))
    const surface = page.getByTestId('delivery-1-styles')

    const documentGeometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(documentGeometry.document).toBeLessThanOrEqual(documentGeometry.viewport)

    for (const id of ['logs-table-scroll']) {
      const geometry = await surface.getByTestId(id).evaluate(node => ({ clientWidth: node.clientWidth, scrollWidth: node.scrollWidth }))
      expect(geometry.scrollWidth, id).toBeGreaterThanOrEqual(geometry.clientWidth)
    }
    for (const id of ['groups-family']) {
      const geometry = await surface.getByTestId(id).evaluate(node => ({ clientWidth: node.clientWidth, scrollWidth: node.scrollWidth }))
      expect(geometry.scrollWidth, id).toBeLessThanOrEqual(geometry.clientWidth + 1)
    }
    for (const button of await surface.getByRole('button').all()) {
      const box = await button.boundingBox()
      expect(box.width, await button.getAttribute('aria-label') || await button.textContent()).toBeGreaterThanOrEqual(44)
      expect(box.height, await button.getAttribute('aria-label') || await button.textContent()).toBeGreaterThanOrEqual(44)
    }
    await page.screenshot({ path: testInfo.outputPath('delivery-1-dark-rtl-320.png'), fullPage: true })
  })
})
