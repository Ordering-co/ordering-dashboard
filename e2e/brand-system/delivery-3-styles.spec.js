import { expect, test } from './fixtures'

// The batch owns its own harness entry; the shared compact registry is not
// touched here. integrate/ folds the surface into main.jsx from the batch
// integration notes and can then switch this helper to the shared fixtureUrl.
const delivery3Url = (query = '') => `/scripts/brand-system/harness/delivery-3.html?${query}`

const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, value] of Object.entries(values)) document.documentElement.style.setProperty(`--od-type-${role}-size`, value)
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-type-${role}-size`)
}, roles)

for (const mode of ['light', 'dark']) {
  test(`Delivery-3 families use governed ${mode} roles and separated native actions`, async ({ page }, testInfo) => {
    await page.goto(delivery3Url(`mode=${mode}`))
    const surface = page.getByTestId('delivery-3-styles')

    // Readable text resolves through the central roles, never a local size.
    await expect(surface.getByTestId('groups-title')).toHaveCSS('font-size', '22px')
    await expect(surface.getByTestId('groups-td')).toHaveCSS('font-size', '12px')
    await expect(surface.getByTestId('group-name')).toHaveCSS('font-size', '12px')
    await expect(surface.getByTestId('group-manager')).toHaveCSS('font-size', '13px')
    await expect(surface.getByTestId('group-manager-mail')).toHaveCSS('font-size', '12px')
    await expect(surface.getByTestId('group-enable')).toHaveCSS('font-size', '12px')
    await expect(surface.getByTestId('group-border')).toHaveCSS('font-size', '12px')
    await expect(surface.getByTestId('paymethod-copy')).toHaveCSS('font-size', '14px')
    await expect(surface.getByTestId('zone-title')).toHaveCSS('font-size', '22px')
    await expect(surface.getByTestId('busy-title')).toHaveCSS('font-size', '22px')
    await expect(surface.getByTestId('busy-label')).toHaveCSS('font-size', '13px')
    await expect(surface.getByTestId('step-number')).toHaveCSS('font-size', '13px')
    await expect(surface.getByTestId('step-copy')).toHaveCSS('font-size', '14px')
    await expect(surface.getByTestId('add-user-title')).toHaveCSS('font-size', '22px')
    await expect(surface.getByTestId('assign-group')).toHaveCSS('font-size', '14px')

    // Every converted control is a real button that reports its pressed state.
    const selectAll = surface.getByRole('button', { name: 'Select all' }).first()
    await expect(selectAll).toHaveAttribute('aria-pressed', 'false')
    await selectAll.click()
    await expect(selectAll).toHaveAttribute('aria-pressed', 'true')

    const drivers = surface.getByRole('tab', { name: 'drivers', exact: true })
    await expect(drivers).toHaveAttribute('aria-selected', 'false')
    await expect(drivers).toHaveAttribute('tabindex', '-1')
    await drivers.click()
    await expect(drivers).toHaveAttribute('aria-selected', 'true')
    await expect(drivers).toHaveAttribute('tabindex', '0')
    await expect(surface.getByTestId('zone-panel')).toHaveText('Zone drivers')

    // Keyboard focus stays visible on the batch controls. The Tab press puts
    // Chromium in keyboard modality so programmatic focus reports focus-visible.
    await page.keyboard.press('Tab')
    for (const control of [selectAll, surface.getByTestId('gps-button')]) {
      await control.focus()
      await expect(control).toHaveCSS('outline-width', '2px')
      await expect(control).toHaveCSS('outline-style', 'solid')
    }

    await page.screenshot({ path: testInfo.outputPath(`delivery-3-${mode}.png`), fullPage: true })
  })
}

test('Delivery-3 central roles propagate through every family and restore', async ({ page }, testInfo) => {
  await page.goto(delivery3Url('mode=light'))
  const surface = page.getByTestId('delivery-3-styles')
  const checks = [
    [surface.getByTestId('groups-title'), '28px'],
    [surface.getByTestId('groups-td'), '16px'],
    [surface.getByTestId('group-manager'), '17px'],
    [surface.getByTestId('paymethod-copy'), '19px'],
    [surface.getByTestId('zone-title'), '28px'],
    [surface.getByTestId('busy-title'), '28px'],
    [surface.getByTestId('busy-label'), '17px'],
    [surface.getByTestId('step-copy'), '19px'],
    [surface.getByTestId('add-user-title'), '28px']
  ]

  await setRoleSizes(page, { title: '28px', 'section-title': '24px', content: '19px', secondary: '16px', control: '17px', 'control-value': '18px', identifier: '18px' })
  for (const [locator, size] of checks) await expect(locator).toHaveCSS('font-size', size)
  await page.screenshot({ path: testInfo.outputPath('delivery-3-propagated.png'), fullPage: true })

  await restoreRoleSizes(page, ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier'])
  await expect(surface.getByTestId('groups-title')).toHaveCSS('font-size', '22px')
  await expect(surface.getByTestId('group-manager-mail')).toHaveCSS('font-size', '12px')
})

test.describe('Delivery-3 at 320px RTL coarse pointer and reduced motion', () => {
  test.use({ viewport: { width: 320, height: 760 }, hasTouch: true, isMobile: true })

  test('keeps forms reachable, wide tables scrolling internally and motion stilled', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(delivery3Url('mode=dark&rtl=true&locale=ar'))
    const surface = page.getByTestId('delivery-3-styles')

    for (const id of ['groups-motion-surface']) {
      await expect(surface.getByTestId(id)).toHaveCSS('transition-duration', '0s')
    }

    const documentGeometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(documentGeometry.document).toBeLessThanOrEqual(documentGeometry.viewport)

    for (const id of ['groups-table-scroll']) {
      const geometry = await surface.getByTestId(id).evaluate(node => ({ clientWidth: node.clientWidth, scrollWidth: node.scrollWidth }))
      expect(geometry.scrollWidth, id).toBeGreaterThanOrEqual(geometry.clientWidth)
    }
    for (const id of ['user-forms', 'gps', 'mark-as-busy']) {
      const geometry = await surface.getByTestId(id).evaluate(node => ({ clientWidth: node.clientWidth, scrollWidth: node.scrollWidth }))
      expect(geometry.scrollWidth, id).toBeLessThanOrEqual(geometry.clientWidth + 1)
    }
    for (const button of await surface.getByRole('button').all()) {
      const box = await button.boundingBox()
      const label = await button.getAttribute('aria-label') || await button.textContent()
      expect(box.width, label).toBeGreaterThanOrEqual(44)
      expect(box.height, label).toBeGreaterThanOrEqual(44)
    }
    await page.screenshot({ path: testInfo.outputPath('delivery-3-dark-rtl-320.png'), fullPage: true })
  })
})
