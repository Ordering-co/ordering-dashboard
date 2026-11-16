import { expect, fixtureUrl, test } from './fixtures'
import { expectTouchTarget } from '../touch-target'

const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, value] of Object.entries(values)) document.documentElement.style.setProperty(`--od-type-${role}-size`, value)
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-type-${role}-size`)
}, roles)

const openProduct = async surface => {
  await surface.getByTestId('product-surface').locator('button[aria-expanded="false"]').first().click()
}
const openRefund = async (page, surface) => {
  await surface.getByTestId('refund-surface').getByRole('button').first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

for (const mode of ['light', 'dark']) {
  test(`D3 bill, product and refund use governed ${mode} states`, async ({ page }, testInfo) => {
    await page.goto(fixtureUrl(`surface=details-d3-styles&mode=${mode}`))
    const surface = page.getByTestId('details-d3-styles')
    await openProduct(surface)

    await expect(surface.getByRole('table', { name: 'Order bill' }).getByText('Subtotal')).toHaveCSS('font-size', '14px')
    await expect(surface.getByRole('table', { name: 'Order total' }).getByText('Total')).toHaveCSS('font-size', '18px')
    await expect(surface.getByRole('heading', { name: 'Long custom pizza name for operations and narrow reflow' })).toHaveCSS('font-size', '14px')
    await expect(surface.getByText('26', { exact: true })).toHaveCSS('font-size', '13px')
    const expand = surface.getByRole('button', { name: /Collapse Long custom pizza/ })
    await page.keyboard.press('Tab')
    await expand.focus()
    await expect(expand).toHaveCSS('outline-width', '2px')
    await openRefund(page, surface)
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Refund' })).toHaveCSS('font-size', '18px')
    const totalMode = page.getByRole('dialog').getByRole('radio', { name: 'Refund all' })
    const amountMode = page.getByRole('dialog').getByRole('radio', { name: 'Refund only an amount' })
    await expect(totalMode.locator('..').locator('span')).toHaveCSS('font-size', '13px')
    await totalMode.focus()
    await page.keyboard.press('ArrowDown')
    await expect(amountMode).toBeChecked()
    await expect(amountMode).toBeFocused()
    await page.screenshot({ path: testInfo.outputPath(`details-d3-${mode}.png`), fullPage: true })
  })
}

test('D3 central roles propagate through the open bill, product and refund families and restore', async ({ page }, testInfo) => {
  await page.goto(fixtureUrl('surface=details-d3-styles&mode=light'))
  const surface = page.getByTestId('details-d3-styles')
  await openProduct(surface)
  const surfaceChecks = [
    [surface.getByRole('table', { name: 'Order bill' }).getByText('Subtotal'), '19px'],
    [surface.getByRole('table', { name: 'Order total' }).getByText('Total'), '24px'],
    [surface.getByRole('heading', { name: 'Long custom pizza name for operations and narrow reflow' }), '19px'],
    [surface.getByText('26', { exact: true }), '18px']
  ]
  const dialogChecks = [
    [page.getByRole('dialog').getByRole('heading', { name: 'Refund' }), '24px'],
    [page.getByRole('dialog').getByRole('radio', { name: 'Refund all' }).locator('..').locator('span'), '17px']
  ]

  await setRoleSizes(page, { content: '19px', control: '17px', 'control-value': '18px', secondary: '16px', 'section-title': '24px', identifier: '18px' })
  // redesign 5.4-B (85fc7bcd): the refund dialog is a Product Dialog; its title reads the pilot role
  // --od-x-type-section-size (18px, as section-title did). The assertion is the same: one role sets the size.
  await page.evaluate(() => document.documentElement.style.setProperty('--od-x-type-section-size', '24px'))
  for (const [locator, size] of surfaceChecks) await expect(locator).toHaveCSS('font-size', size)
  // redesign 5.4-B, user decision 5.2 (2026-10-06): a Product Button (the Refund trigger) is the control-height token
  // with a fine pointer (32px) and 44px with a coarse one (the 320px coarse-pointer case below); the icon buttons keep 44px.
  const controlHeight = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--od-x-control-height')))
  expect(controlHeight, '--od-x-control-height must resolve to a pixel length').toBeGreaterThan(0)
  for (const button of await surface.getByRole('button').all()) {
    const box = await button.boundingBox()
    const minimum = await button.evaluate(node => node.classList.contains('odc-btn')) ? controlHeight : 44
    expect(box.width, await button.getAttribute('aria-label') || await button.textContent()).toBeGreaterThanOrEqual(minimum)
    expect(box.height, await button.getAttribute('aria-label') || await button.textContent()).toBeGreaterThanOrEqual(minimum)
  }
  await openRefund(page, surface)
  for (const [locator, size] of dialogChecks) await expect(locator).toHaveCSS('font-size', size)
  await page.screenshot({ path: testInfo.outputPath('details-d3-propagated.png'), fullPage: true })

  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click()
  await restoreRoleSizes(page, ['content', 'control', 'control-value', 'secondary', 'section-title', 'identifier'])
  await page.evaluate(() => document.documentElement.style.removeProperty('--od-x-type-section-size'))
  await expect(surface.getByRole('table', { name: 'Order bill' }).getByText('Subtotal')).toHaveCSS('font-size', '14px')
  await expect(surface.getByText('26', { exact: true })).toHaveCSS('font-size', '13px')
})

test.describe('D3 at 320px RTL coarse pointer and reduced motion', () => {
  test.use({ viewport: { width: 320, height: 760 }, hasTouch: true, isMobile: true })

  test('keeps long open product/refund data reachable without page overflow', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(fixtureUrl('surface=details-d3-styles&mode=dark&rtl=true&locale=ar'))
    const surface = page.getByTestId('details-d3-styles')
    await openProduct(surface)
    await expect(surface.getByTestId('product-surface').locator('button[aria-expanded="true"] svg')).toHaveCSS('transition-duration', '0s')
    for (const family of ['bill-surface', 'product-surface']) {
      const box = surface.getByTestId(family)
      const geometry = await box.evaluate(element => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }))
      expect(geometry.scrollWidth, family).toBeLessThanOrEqual(geometry.clientWidth + 1)
    }
    // redesign user decision 5.2: with a coarse pointer every target, the Product Button «Refund» included, is 44px.
    // redesign W0 T0-45 (W0-E-08, decision 12): a phone gives every target 32px visible and the 44×44 area (corners at ±21px); the
    // controls that keep 44px drawn (W0-D-08) pass by their own box.
    for (const button of await surface.getByRole('button').all()) {
      await expectTouchTarget(button, { label: await button.getAttribute('aria-label') || await button.textContent() })
    }
    await openRefund(page, surface)
    const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)
    await page.screenshot({ path: testInfo.outputPath('details-d3-dark-rtl-320.png'), fullPage: true })
  })
})
