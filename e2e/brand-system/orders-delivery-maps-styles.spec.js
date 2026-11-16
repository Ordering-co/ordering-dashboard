import { expect, fixtureUrl, test } from './fixtures'

const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, value] of Object.entries(values)) document.documentElement.style.setProperty(`--od-type-${role}-size`, value)
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-type-${role}-size`)
}, roles)

for (const mode of ['light', 'dark']) {
  test(`delivery maps keep governed open states and marker meaning in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(fixtureUrl(`surface=orders-delivery-maps-styles&mode=${mode}`))
    const surface = page.getByTestId('orders-delivery-maps-styles')
    const marker = surface.getByRole('button', { name: 'Show details for Ada Lovelace, Busy' })

    await expect(surface.getByRole('region', { name: 'Delivery map', exact: true })).toBeVisible()
    await expect(marker).toHaveAttribute('aria-expanded', 'true')
    await expect(surface.getByRole('tooltip')).toBeVisible()
    await expect(marker).toHaveCSS('width', '50px')
    await expect(marker).toHaveCSS('height', '50px')
    // redesign W1-2c: the busy status is the product's in-progress colour (--od-x-info-signal → --od-text), not the legacy #007bff
    const busyColour = await surface.evaluate(node => { const probe = document.createElement('span'); probe.style.color = 'var(--od-x-info-signal, var(--od-text))'; node.appendChild(probe); const colour = getComputedStyle(probe).color; probe.remove(); return colour })
    expect(busyColour).not.toBe('rgb(0, 0, 0)')
    await expect(marker).toHaveCSS('border-color', busyColour)
    await expect(surface.getByTestId('online-title')).toHaveCSS('font-size', '18px')
    await expect(surface.getByTestId('online-name')).toHaveCSS('font-size', '14px')
    await expect(surface.getByTestId('online-status')).toHaveCSS('font-size', '12px')
    await expect(surface.getByTestId('drivers-title')).toHaveCSS('font-size', '22px')
    await expect(surface.getByTestId('log-time')).toHaveCSS('font-size', '13px')

    await page.keyboard.press('Tab')
    await expect(marker).toBeFocused()
    await expect(marker).toHaveCSS('outline-width', '2px')

    await marker.click()
    await expect(marker).toHaveAttribute('aria-expanded', 'false')
    await expect(surface.getByRole('tooltip')).toHaveCount(0)
    await marker.click()

    // Adapted 2026-10-03: `main` replaced the API-key modal (and its show/hide toggle)
    // with a warning banner that links to the Settings hub.
    await expect(surface.getByTestId('maps-key-copy')).toBeVisible()
    await expect(surface.getByRole('link', { name: 'Add it in Settings', exact: true })).toHaveAttribute('href', '/settings?group=locations&category=google_maps')

    await page.screenshot({ path: testInfo.outputPath(`orders-delivery-maps-${mode}.png`), fullPage: true })
  })
}

test('delivery-map roles propagate through real open consumer styles and restore', async ({ page }, testInfo) => {
  await page.goto(fixtureUrl('surface=orders-delivery-maps-styles&mode=light'))
  const surface = page.getByTestId('orders-delivery-maps-styles')
  const checks = [
    [surface.getByTestId('online-title'), '25px'],
    [surface.getByTestId('online-name'), '19px'],
    [surface.getByTestId('online-status'), '16px'],
    // Adapted 2026-10-08 (W1-4a, T1-4-4a): the drivers title and «Filters applied» left this family's styles for P/PageHeader and
    // P/InlineNotice, whose type comes from the product scale (--od-x-type-*), governed and tested with P/; their 22px default stays checked.
    [surface.getByTestId('log-copy'), '19px'],
    [surface.getByTestId('log-time'), '18px']
  ]

  await setRoleSizes(page, { title: '28px', 'section-title': '25px', content: '19px', secondary: '16px', control: '17px', 'control-value': '18px', identifier: '18px' })
  for (const [locator, size] of checks) await expect(locator).toHaveCSS('font-size', size)
  await page.screenshot({ path: testInfo.outputPath('orders-delivery-maps-propagated.png'), fullPage: true })

  await restoreRoleSizes(page, ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier'])
  await expect(surface.getByTestId('drivers-title')).toHaveCSS('font-size', '22px')
  await expect(surface.getByTestId('online-title')).toHaveCSS('font-size', '18px')
  await expect(surface.getByTestId('log-time')).toHaveCSS('font-size', '13px')
})

test.describe('delivery maps at 320px RTL coarse pointer and reduced motion', () => {
  test.use({ viewport: { width: 320, height: 760 }, hasTouch: true, isMobile: true })

  test('keeps long map, driver, warning, missing-key and log states reachable with 44px actions', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(fixtureUrl('surface=orders-delivery-maps-styles&mode=dark&rtl=true&locale=ar'))
    const surface = page.getByTestId('orders-delivery-maps-styles')

    const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)
    for (const id of ['map-surface', 'manager-surface', 'maps-key-banner', 'logistics-surface']) {
      const box = surface.getByTestId(id)
      const sizes = await box.evaluate(element => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }))
      expect(sizes.scrollWidth, id).toBeLessThanOrEqual(sizes.clientWidth + 1)
    }
    await expect(surface.getByTestId('manager-surface')).toHaveCSS('transition-duration', '0s')
    await expect(surface.getByTestId('log-time')).toHaveCSS('direction', 'ltr')

    // Adapted 2026-10-08 (W1-4b): the P/ buttons and pills of the row, the filters and the status are 32px boxes with a centered 44px touch area
    // (decision 12); their reach is measured live with the touch probe (elementFromPoint), not by this box check. Nothing else is relaxed.
    for (const button of await surface.getByRole('button').all()) {
      if (await button.evaluate(element => element.matches('.odc-btn, .odc-pill'))) continue
      const box = await button.boundingBox()
      expect(box.width, await button.getAttribute('aria-label') || await button.textContent()).toBeGreaterThanOrEqual(44)
      expect(box.height, await button.getAttribute('aria-label') || await button.textContent()).toBeGreaterThanOrEqual(44)
    }
    await page.screenshot({ path: testInfo.outputPath('orders-delivery-maps-dark-rtl-320.png'), fullPage: true })
  })
})
