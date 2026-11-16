import { expect, test } from './fixtures'

// The batch keeps its own harness entry so the shared compact registry in
// scripts/brand-system/harness/main.jsx is never edited by a parallel session.
const batchUrl = (query = '') => `/scripts/brand-system/harness/create-custom-order-1.html?${query}`

const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, value] of Object.entries(values)) document.documentElement.style.setProperty(`--od-type-${role}-size`, value)
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-type-${role}-size`)
}, roles)

for (const mode of ['light', 'dark']) {
  test(`Create custom order batch 1 families use governed ${mode} states and separated actions`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('create-custom-order-1-styles')

    await expect(surface.getByTestId('details-title')).toHaveCSS('font-size', '22px')
    await expect(surface.getByTestId('details-section-title')).toHaveCSS('font-size', '18px')
    await expect(surface.getByTestId('details-field-hint')).toHaveCSS('font-size', '12px')
    await expect(surface.getByTestId('details-radio-label')).toHaveCSS('font-size', '13px')
    await expect(surface.getByTestId('order-type-title')).toHaveCSS('font-size', '18px')
    await expect(surface.getByTestId('order-type-value')).toHaveCSS('font-size', '14px')
    await expect(surface.getByTestId('order-type-option')).toHaveCSS('font-size', '14px')
    await expect(surface.getByTestId('tips-copy')).toHaveCSS('font-size', '14px')
    await expect(surface.getByTestId('tip-10')).toHaveCSS('font-size', '13px')
    await expect(surface.getByTestId('tips-label')).toHaveCSS('font-size', '13px')
    await expect(surface.getByTestId('bill-row')).toHaveCSS('font-size', '14px')
    await expect(surface.getByTestId('bill-total')).toHaveCSS('font-size', '18px')
    await expect(surface.getByTestId('bill-loyalty')).toHaveCSS('font-size', '14px')
    await expect(surface.getByTestId('checkout-warning')).toHaveCSS('font-size', '22px')
    // Wide viewports keep the flag on the content role; the narrow step below stays secondary.
    await expect(surface.getByTestId('checkout-flag')).toHaveCSS('font-size', '14px')
    // At >=1200px the place-order total steps up to the section-title role.
    await expect(surface.getByTestId('checkout-total')).toHaveCSS('font-size', '18px')
    await expect(surface.getByTestId('cash-label')).toHaveCSS('font-size', '13px')
    await expect(surface.getByTestId('cash-error')).toHaveCSS('font-size', '14px')
    await expect(surface.getByTestId('card-input')).toHaveCSS('font-size', '14px')
    await expect(surface.getByTestId('card-zipcode')).toHaveCSS('font-size', '14px')
    await expect(surface.getByTestId('card-error')).toHaveCSS('font-size', '14px')

    // Operational state colors follow the governed mode, not a pinned hex.
    const dangerColor = mode === 'dark' ? 'rgb(255, 107, 107)' : 'rgb(201, 41, 41)'
    await expect(surface.getByTestId('cash-error')).toHaveCSS('color', dangerColor)
    await expect(surface.getByTestId('card-error')).toHaveCSS('color', dangerColor)
    await expect(surface.getByTestId('checkout-flag')).toHaveCSS('color', dangerColor)
    await expect(surface.getByTestId('map-surface')).toHaveCSS('background-color', mode === 'dark' ? 'rgb(33, 34, 36)' : 'rgb(246, 247, 247)')
    // The provider-mounted gift card action follows the governed button surface.
    await expect(surface.getByTestId('square-action')).toHaveCSS('background-color', mode === 'dark' ? 'rgb(23, 24, 26)' : 'rgb(255, 255, 255)')
    await expect(surface.getByTestId('square-action')).toHaveCSS('color', mode === 'dark' ? 'rgb(255, 255, 255)' : 'rgb(11, 12, 13)')

    // Tip selection and the order mode switch stay native pressed buttons.
    const tip = surface.getByTestId('tip-15')
    await expect(tip).toHaveAttribute('aria-pressed', 'false')
    await tip.click()
    await expect(tip).toHaveAttribute('aria-pressed', 'true')
    await expect(surface.getByTestId('tip-10')).toHaveAttribute('aria-pressed', 'false')

    const orderByTotal = surface.getByRole('button', { name: 'Order by total' })
    await orderByTotal.click()
    await expect(orderByTotal).toHaveAttribute('aria-pressed', 'true')

    const removeOffer = surface.getByRole('button', { name: /^Delete / })
    await page.keyboard.press('Tab')
    await removeOffer.focus()
    await expect(removeOffer).toHaveCSS('outline-width', '2px')

    await page.screenshot({ path: testInfo.outputPath(`create-custom-order-1-${mode}.png`), fullPage: true })
  })
}

test('Create custom order batch 1 central roles propagate through every family and restore', async ({ page }, testInfo) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('create-custom-order-1-styles')
  const checks = [
    [surface.getByTestId('details-title'), '28px'],
    [surface.getByTestId('details-section-title'), '24px'],
    [surface.getByTestId('details-field-hint'), '16px'],
    [surface.getByTestId('details-radio-label'), '17px'],
    [surface.getByTestId('order-type-title'), '24px'],
    [surface.getByTestId('order-type-value'), '18px'],
    [surface.getByTestId('order-type-option'), '19px'],
    [surface.getByTestId('tips-copy'), '19px'],
    [surface.getByTestId('tip-10'), '17px'],
    [surface.getByTestId('tips-label'), '17px'],
    [surface.getByTestId('bill-row'), '19px'],
    [surface.getByTestId('bill-total'), '24px'],
    [surface.getByTestId('bill-loyalty'), '19px'],
    [surface.getByTestId('checkout-warning'), '28px'],
    [surface.getByTestId('checkout-flag'), '19px'],
    [surface.getByTestId('checkout-total'), '24px'],
    [surface.getByTestId('cash-label'), '17px'],
    [surface.getByTestId('cash-error'), '19px'],
    [surface.getByTestId('card-input'), '18px'],
    [surface.getByTestId('card-zipcode'), '18px'],
    [surface.getByTestId('card-error'), '19px']
  ]

  await setRoleSizes(page, { title: '28px', 'section-title': '24px', content: '19px', secondary: '16px', control: '17px', 'control-value': '18px' })
  for (const [locator, size] of checks) await expect(locator).toHaveCSS('font-size', size)
  await page.screenshot({ path: testInfo.outputPath('create-custom-order-1-propagated.png'), fullPage: true })

  await restoreRoleSizes(page, ['title', 'section-title', 'content', 'secondary', 'control', 'control-value'])
  await expect(surface.getByTestId('details-title')).toHaveCSS('font-size', '22px')
  await expect(surface.getByTestId('cash-label')).toHaveCSS('font-size', '13px')
  await expect(surface.getByTestId('order-type-value')).toHaveCSS('font-size', '14px')
})

test.describe('Create custom order batch 1 at 320px RTL coarse pointer and reduced motion', () => {
  test.use({ viewport: { width: 320, height: 900 }, hasTouch: true, isMobile: true })

  test('keeps checkout forms reachable while wide bill rows scroll internally', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(batchUrl('mode=dark&rtl=true&locale=ar'))
    const surface = page.getByTestId('create-custom-order-1-styles')

    await expect(surface.getByTestId('tip-10')).toHaveCSS('transition-duration', '0s')
    await expect(surface.getByTestId('checkout-flag')).toHaveCSS('font-size', '12px')
    await expect(surface.getByTestId('checkout-total')).toHaveCSS('font-size', '14px')
    await expect(surface.getByTestId('cash-label')).toHaveCSS('font-size', '13px')

    const documentGeometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(documentGeometry.document).toBeLessThanOrEqual(documentGeometry.viewport)

    for (const id of ['details-family', 'order-type-family', 'tips-family', 'bill-family', 'checkout-family', 'payment-family']) {
      const geometry = await surface.getByTestId(id).evaluate(node => ({ clientWidth: node.clientWidth, scrollWidth: node.scrollWidth }))
      expect(geometry.scrollWidth, id).toBeLessThanOrEqual(geometry.clientWidth + 1)
    }

    for (const button of await surface.getByRole('button').all()) {
      const box = await button.boundingBox()
      const name = await button.getAttribute('aria-label') || await button.textContent()
      expect(box.width, name).toBeGreaterThanOrEqual(44)
      expect(box.height, name).toBeGreaterThanOrEqual(44)
    }

    await page.screenshot({ path: testInfo.outputPath('create-custom-order-1-dark-rtl-320.png'), fullPage: true })
  })
})
