import { expect, test } from './fixtures'

const fixtureUrl = (query = '') => `/scripts/brand-system/harness/delivery-2-index.html?${query}`

const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, value] of Object.entries(values)) document.documentElement.style.setProperty(`--od-type-${role}-size`, value)
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-type-${role}-size`)
}, roles)

for (const mode of ['light', 'dark']) {
  test(`Delivery-2 group families use governed ${mode} typography and native selection`, async ({ page }, testInfo) => {
    await page.goto(fixtureUrl(`mode=${mode}`))
    const surface = page.getByTestId('delivery-2-styles')

    await expect(surface.getByTestId('add-section-title')).toHaveCSS('font-size', '18px')
    await expect(surface.getByTestId('add-business-name')).toHaveCSS('font-size', '14px')
    await expect(surface.getByTestId('subsection-title')).toHaveCSS('font-size', '18px')
    await expect(surface.getByTestId('autoassign-title')).toHaveCSS('font-size', '22px')
    await expect(surface.getByTestId('autoassign-mode-caption')).toHaveCSS('font-size', '12px')
    await expect(surface.getByTestId('autoassign-distance-hint')).toHaveCSS('font-size', '12px')
    await expect(surface.getByTestId('driver-name')).toHaveCSS('font-size', '13px')
    await expect(surface.getByTestId('driver-email')).toHaveCSS('font-size', '12px')
    await expect(surface.getByTestId('details-title')).toHaveCSS('font-size', '22px')
    await expect(surface.getByTestId('zone-cell')).toHaveCSS('font-size', '14px')
    await expect(surface.getByTestId('zone-arrow')).toHaveCSS('font-size', '13px')
    await expect(surface.getByTestId('logs-column-header')).toHaveCSS('font-size', '12px')
    await expect(surface.getByTestId('logs-user-name')).toHaveCSS('font-size', '14px')
    await expect(surface.getByTestId('logs-event-type')).toHaveCSS('font-size', '13px')
    await expect(surface.getByTestId('logs-empty')).toHaveCSS('font-size', '18px')
    await expect(surface.getByTestId('logs-time')).toHaveCSS('font-size', '13px')
    await expect(surface.getByTestId('logs-time')).toHaveCSS('direction', 'ltr')
    expect(await surface.getByTestId('logs-time').evaluate(node => getComputedStyle(node).fontFamily)).toContain('JetBrains Mono')
    await expect(surface.getByTestId('orders-title')).toHaveCSS('font-size', '22px')
    await expect(surface.getByTestId('orders-maps-hint')).toHaveCSS('font-size', '12px')

    const accepted = surface.getByRole('radio', { name: 'Accepted by Business.' })
    const preparation = surface.getByRole('radio', { name: 'Preparation Completed' })
    await expect(preparation).toHaveAttribute('aria-checked', 'false')
    await expect(accepted).toHaveAttribute('tabindex', '0')
    await expect(preparation).toHaveAttribute('tabindex', '-1')
    await preparation.click()
    await expect(preparation).toHaveAttribute('aria-checked', 'true')
    await expect(preparation).toHaveAttribute('tabindex', '0')
    await expect(accepted).toHaveAttribute('tabindex', '-1')
    // The radiogroup moves selection with the arrow keys it advertises.
    await preparation.press('ArrowLeft')
    await expect(accepted).toHaveAttribute('aria-checked', 'true')
    await expect(accepted).toBeFocused()
    await accepted.press('End')
    await expect(preparation).toHaveAttribute('aria-checked', 'true')
    await preparation.press('Home')
    await expect(accepted).toHaveAttribute('aria-checked', 'true')

    const businesses = surface.getByRole('tab', { name: 'businesses' })
    await businesses.click()
    await expect(businesses).toHaveAttribute('aria-selected', 'true')

    const zoneOpen = surface.getByTestId('zone-open')
    await page.keyboard.press('Tab')
    await zoneOpen.focus()
    await expect(zoneOpen).toHaveCSS('outline-width', '2px')

    await page.screenshot({ path: testInfo.outputPath(`delivery-2-${mode}.png`), fullPage: true })
  })
}

test('Delivery-2 central roles propagate through every family and restore', async ({ page }, testInfo) => {
  await page.goto(fixtureUrl('mode=light'))
  const surface = page.getByTestId('delivery-2-styles')
  const checks = [
    [surface.getByTestId('add-section-title'), '24px'],
    [surface.getByTestId('add-business-name'), '19px'],
    [surface.getByTestId('add-paymethod-name'), '19px'],
    [surface.getByTestId('advanced-toggle-label'), '17px'],
    [surface.getByTestId('status-label-7'), '17px'],
    [surface.getByTestId('autoassign-title'), '28px'],
    [surface.getByTestId('autoassign-mode-caption'), '16px'],
    [surface.getByTestId('autoassign-forced-label'), '17px'],
    [surface.getByTestId('autoassign-distance-label'), '17px'],
    [surface.getByTestId('autoassign-distance-hint'), '16px'],
    [surface.getByTestId('autoassign-legend'), '17px'],
    [surface.getByTestId('group-business-name'), '19px'],
    [surface.getByTestId('group-company-name'), '19px'],
    [surface.getByTestId('driver-name'), '17px'],
    [surface.getByTestId('driver-email'), '16px'],
    [surface.getByTestId('driver-temporal'), '17px'],
    [surface.getByTestId('manager-name'), '17px'],
    [surface.getByTestId('manager-email'), '16px'],
    [surface.getByTestId('zone-field-label'), '17px'],
    [surface.getByTestId('zone-empty-copy'), '19px'],
    [surface.getByTestId('zone-column-header'), '16px'],
    [surface.getByTestId('zone-open'), '19px'],
    [surface.getByTestId('zone-add'), '17px'],
    [surface.getByTestId('details-title'), '28px'],
    [surface.getByTestId('details-menu-item'), '17px'],
    [surface.getByTestId('config-label-GROUP_ORDERS'), '19px'],
    [surface.getByTestId('logs-column-header'), '16px'],
    [surface.getByTestId('logs-user-name'), '19px'],
    [surface.getByTestId('logs-event-type'), '17px'],
    [surface.getByTestId('logs-see-changes'), '19px'],
    [surface.getByTestId('logs-time'), '18px'],
    [surface.getByTestId('logs-empty'), '24px'],
    [surface.getByTestId('orders-title'), '28px'],
    [surface.getByTestId('orders-field-label'), '17px'],
    [surface.getByTestId('orders-maps-label'), '17px'],
    [surface.getByTestId('orders-maps-hint'), '16px']
  ]

  await setRoleSizes(page, { title: '28px', 'section-title': '24px', content: '19px', secondary: '16px', control: '17px', 'control-value': '18px', identifier: '18px' })
  for (const [locator, size] of checks) await expect(locator).toHaveCSS('font-size', size)
  await page.screenshot({ path: testInfo.outputPath('delivery-2-propagated.png'), fullPage: true })

  await restoreRoleSizes(page, ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier'])
  await expect(surface.getByTestId('autoassign-title')).toHaveCSS('font-size', '22px')
  await expect(surface.getByTestId('logs-time')).toHaveCSS('font-size', '13px')
  await expect(surface.getByTestId('add-section-title')).toHaveCSS('font-size', '18px')

  // Reviewed glyph geometry stays local and is never repointed at a role.
  await expect(surface.getByTestId('zone-arrow')).toHaveCSS('font-size', '13px')
  await expect(surface.getByTestId('details-actions-glyph')).toHaveCSS('font-size', '20px')
  await expect(surface.getByTestId('config-glyph-GROUP_ORDERS')).toHaveCSS('font-size', '20px')
})

test.describe('Delivery-2 at 320px RTL coarse pointer and reduced motion', () => {
  test.use({ viewport: { width: 320, height: 900 }, hasTouch: true, isMobile: true })

  test('keeps group forms reachable while wide tables scroll internally', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(fixtureUrl('mode=dark&rtl=true&locale=ar'))
    const surface = page.getByTestId('delivery-2-styles')

    const documentGeometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(documentGeometry.document).toBeLessThanOrEqual(documentGeometry.viewport)

    for (const id of ['logs-table-scroll', 'zone-table-scroll']) {
      const geometry = await surface.getByTestId(id).evaluate(node => ({ clientWidth: node.clientWidth, scrollWidth: node.scrollWidth }))
      expect(geometry.scrollWidth, id).toBeGreaterThanOrEqual(geometry.clientWidth)
    }
    for (const id of ['group-add-form', 'autoassign', 'group-selection', 'group-details', 'group-orders']) {
      const geometry = await surface.getByTestId(id).evaluate(node => ({ clientWidth: node.clientWidth, scrollWidth: node.scrollWidth }))
      expect(geometry.scrollWidth, id).toBeLessThanOrEqual(geometry.clientWidth + 1)
    }

    // Logical properties mirror the reviewed inline spacing in RTL, while the
    // timestamp keeps its own LTR isolation and therefore its own inline end.
    await expect(surface.getByTestId('logs-event-type')).toHaveCSS('margin-right', '15px')
    await expect(surface.getByTestId('logs-event-type')).toHaveCSS('margin-left', '10px')
    await expect(surface.getByTestId('logs-time')).toHaveCSS('direction', 'ltr')
    await expect(surface.getByTestId('logs-time')).toHaveCSS('margin-right', '15px')
    await expect(surface.getByTestId('logs-time')).toHaveCSS('padding-left', '15px')
    await expect(surface.getByTestId('logs-time')).toHaveCSS('padding-right', '15px')

    for (const button of await surface.getByRole('button').all()) {
      const box = await button.boundingBox()
      const name = await button.getAttribute('data-testid') || await button.getAttribute('aria-label') || await button.textContent()
      const isProduct = await button.evaluate(element => element.classList.contains('odc-btn'))
      if (!isProduct) {
        expect(box.height, name).toBeGreaterThanOrEqual(44)
        continue
      }
      // redesign DG-R1 (decision 12): the zone map's «Clear shape» is now a Product button, 32px seen that reaches
      // 44px through a centered pseudo-element; as in all-in-one-appointments-styles, the check is a hit test over the 44px area
      const reach = await button.evaluate(element => {
        const rect = element.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        return [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]].map(([dx, dy]) => {
          const hit = document.elementFromPoint(cx + dx * 20.5, cy + dy * 20.5)
          return Boolean(hit) && (hit === element || element.contains(hit))
        })
      })
      expect(reach.every(Boolean), `${name} reaches 44px`).toBe(true)
    }
    for (const radio of await surface.getByRole('radio').all()) {
      const box = await radio.boundingBox()
      expect(box.height, 'order status radio').toBeGreaterThanOrEqual(44)
    }
    await page.screenshot({ path: testInfo.outputPath('delivery-2-dark-rtl-320.png'), fullPage: true })
  })
})
