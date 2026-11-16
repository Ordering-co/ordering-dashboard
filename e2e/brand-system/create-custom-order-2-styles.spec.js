import { expect, test } from './fixtures'

// The shared registry in main.jsx belongs to `integrate`, so this batch mounts
// its fixture through its own entry on the same harness server and boundary.
const fixtureUrl = (query = '') => `/scripts/brand-system/harness/create-custom-order-2.html?${query}`

const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, value] of Object.entries(values)) document.documentElement.style.setProperty(`--od-type-${role}-size`, value)
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-type-${role}-size`)
}, roles)

const ROLE_SIZES = [
  ['product-name', '22px'],
  ['product-total', '22px'],
  ['tax-title', '22px'],
  ['saved-places-title', '22px'],
  ['product-section-title', '18px'],
  ['product-price', '18px'],
  ['tax-section-title', '18px'],
  ['option-title', '18px'],
  ['business-select-label', '18px'],
  ['saved-places-copy', '18px'],
  ['stripe-warning', '14px'],
  ['stripe-card-number', '14px'],
  ['elements-error', '14px'],
  ['product-meta', '14px'],
  ['product-offer-price', '14px'],
  ['product-tag-name', '14px'],
  ['ingredient-name', '14px'],
  ['suboption-name', '14px'],
  ['customer-copy', '14px'],
  ['customer-option', '14px'],
  ['customer-address-copy', '14px'],
  ['business-option-name', '14px'],
  ['cart-product-name', '14px'],
  ['card-title', '14px'],
  ['card-price', '14px'],
  ['suboption-quantity', '14px'],
  ['suboption-price', '14px'],
  ['stripe-add-card', '13px'],
  ['method-stripe', '13px'],
  ['product-limit', '13px'],
  ['option-flag', '13px'],
  ['business-select-control', '13px'],
  ['products-select-control', '13px'],
  ['redirect-select', '13px'],
  ['option-title-note', '12px'],
  ['customer-results-note', '12px'],
  ['customer-address-action', '12px'],
  ['card-sold-out', '12px'],
  ['card-ribbon', '12px'],
  ['card-off-price', '12px'],
  ['card-description', '12px'],
  ['weight-pieces', '12px']
]

for (const mode of ['light', 'dark']) {
  test(`create-custom-order-2 payment, product and customer surfaces use governed ${mode} roles and native actions`, async ({ page }, testInfo) => {
    await page.goto(fixtureUrl(`mode=${mode}`))
    const surface = page.getByTestId('create-custom-order-2-styles')

    for (const [id, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(id), id).toHaveCSS('font-size', size)
    }

    // Selection, deletion and the add action are separate native controls.
    const method = surface.getByRole('button', { name: 'cash' })
    await expect(method).toHaveAttribute('aria-pressed', 'false')
    await method.click()
    await expect(method).toHaveAttribute('aria-pressed', 'true')

    await expect(surface.getByRole('button', { name: 'Delete card' })).toBeVisible()
    await expect(surface.getByRole('button', { name: 'Add new card' })).toBeVisible()
    await expect(surface.getByRole('button', { name: 'Change customer' })).toBeVisible()
    await expect(surface.getByRole('button', { name: 'Remove customer' })).toBeVisible()

    const ingredient = surface.getByRole('button', { name: 'Cheddar cheese' })
    await expect(ingredient).toHaveAttribute('aria-pressed', 'true')
    await ingredient.click()
    await expect(ingredient).toHaveAttribute('aria-pressed', 'false')

    const half = surface.getByRole('button', { name: 'left', exact: true })
    await half.click()
    await expect(half).toHaveAttribute('aria-pressed', 'true')

    const addCard = surface.getByRole('button', { name: 'Add new card' })
    await addCard.focus()
    await expect(addCard).toBeFocused()

    // Without a reduced-motion preference the search spinner really animates.
    await expect(surface.getByTestId('customer-spinner').locator('svg')).toHaveCSS('animation-duration', '1.85s')

    await page.screenshot({ path: testInfo.outputPath(`create-custom-order-2-${mode}.png`), fullPage: true })
  })
}

test('create-custom-order-2 central roles propagate through every family and restore', async ({ page }, testInfo) => {
  await page.goto(fixtureUrl('mode=light'))
  const surface = page.getByTestId('create-custom-order-2-styles')

  await setRoleSizes(page, { title: '28px', 'section-title': '24px', content: '19px', secondary: '16px', control: '17px', 'control-value': '18px' })
  const propagated = { '22px': '28px', '18px': '24px', '14px': '19px', '13px': '17px', '12px': '16px' }
  for (const [id, size] of ROLE_SIZES) {
    const expected = ['suboption-quantity', 'suboption-price'].includes(id) ? '18px' : propagated[size]
    await expect(surface.getByTestId(id), id).toHaveCSS('font-size', expected)
  }
  await page.screenshot({ path: testInfo.outputPath('create-custom-order-2-propagated.png'), fullPage: true })

  await restoreRoleSizes(page, ['title', 'section-title', 'content', 'secondary', 'control', 'control-value'])
  await expect(surface.getByTestId('product-name')).toHaveCSS('font-size', '22px')
  await expect(surface.getByTestId('stripe-card-number')).toHaveCSS('font-size', '14px')
  await expect(surface.getByTestId('method-stripe')).toHaveCSS('font-size', '13px')
})

test.describe('create-custom-order-2 at 320px RTL coarse pointer and reduced motion', () => {
  test.use({ viewport: { width: 320, height: 900 }, hasTouch: true, isMobile: true })

  test('keeps the checkout families reachable with 44px native actions', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(fixtureUrl('mode=dark&rtl=true&locale=ar'))
    const surface = page.getByTestId('create-custom-order-2-styles')

    await expect(surface.getByTestId('customer-spinner').locator('svg')).toHaveCSS('animation-duration', '0s')
    await expect(surface.getByTestId('stripe-card-delete')).toHaveCSS('transition-duration', '0s')

    const documentGeometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(documentGeometry.document).toBeLessThanOrEqual(documentGeometry.viewport)

    // One pixel absorbs sub-pixel rounding of percentage widths. The product-card
    // ribbon keeps its reviewed 3px corner overhang (right/left: -3px), so the tax
    // section carries that larger documented tolerance; the document never scrolls.
    for (const id of ['payment-methods', 'stripe-cards', 'product-form', 'customer-section', 'cart-products', 'tax-information']) {
      const geometry = await surface.getByTestId(id).evaluate(node => ({ clientWidth: node.clientWidth, scrollWidth: node.scrollWidth }))
      expect(geometry.scrollWidth, id).toBeLessThanOrEqual(geometry.clientWidth + (id === 'tax-information' ? 3 : 1))
    }

    for (const button of await surface.getByRole('button').all()) {
      const name = (await button.getAttribute('aria-label')) || (await button.textContent())
      const box = await button.boundingBox()
      expect(box.height, name).toBeGreaterThanOrEqual(44)
    }

    await page.screenshot({ path: testInfo.outputPath('create-custom-order-2-dark-rtl-320.png'), fullPage: true })
  })
})
