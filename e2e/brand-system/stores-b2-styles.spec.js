import { expect, test } from './fixtures'

const batchUrl = (query = '') => `/scripts/brand-system/harness/stores-b2.html?${query}`
const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']
const PROBE = { title: '28px', 'section-title': '25px', content: '19px', secondary: '16px', control: '17px', 'control-value': '18px', identifier: '21px' }

// BusinessAdd/OtherDetails/styles.js was deleted as dead code; other-details-* rows (15 -> 13 role sizes) went with it.
// Reviewed role assignment for b2-business-add-wizard.
const ROLE_SIZES = [
  ['business-details-heading', '18px'],
  ['business-details-form-label', '13px'],
  ['business-details-form-label-required', '13px'],
  ['business-details-form-select', '14px'],
  ['business-details-form-autocomplete-input', '14px'],
  ['business-details-map-label', '13px'],
  ['business-details-map-place-id', '13px']
]

const GLYPH_PRESERVATIONS = []

// BusinessPreview is a MINIATURE SIMULATION of the customer-facing marketplace
// storefront inside a 270x540 phone mockup, not a dashboard surface. Every one
// of its declarations is preserved as a simulation contract, so no role may
// reach any of them. The sizes below are the literal ones at the default
// viewport, where the file's @media (min-width: 1024px) overrides apply.
const SIMULATION_PRESERVATIONS = [
  ['preview-address-label', '12px'],
  ['preview-moment-label', '12px'],
  ['preview-order-type-label', '12px'],
  ['preview-cart-count', '12px'],
  ['preview-business-name', '20px'],
  ['preview-business-type', '12px'],
  ['preview-preorder-label', '12px'],
  ['preview-preorder-dot', '12px'],
  ['preview-detail-fee', '12px'],
  ['preview-review-icon', '15px'],
  ['preview-review-count', '12px'],
  ['preview-detail-dot', '12px'],
  ['preview-more-detail-icon', '20px'],
  ['preview-category-tab', '12px'],
  ['preview-card-name', '12px'],
  ['preview-card-price', '12px'],
  ['preview-card-off-price', '13px'],
  ['preview-card-description', '10px'],
  ['preview-sold-out-badge', '10px'],
  ['preview-category-title', '18px'],
  ['preview-empty-cart-icon', '35px'],
  ['preview-empty-cart-text', '12px'],
  ['preview-empty-cart-total', '14px'],
  ['preview-empty-cart-button', '12px'],
  ['preview-mobile-cart-total', '14px']
]

const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, value] of Object.entries(values)) document.documentElement.style.setProperty(`--od-type-${role}-size`, value)
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-type-${role}-size`)
}, roles)

for (const mode of ['light', 'dark']) {
  test(`stores-b2 keeps governed typography and native controls in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('stores-b2-styles')

    for (const [testid, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
    }

    // The Google place id is the second real identifier in L4, so it also takes
    // the mono family, not just the size.
    const placeIdFamily = await surface.getByTestId('business-details-map-place-id').evaluate(element => getComputedStyle(element).fontFamily)
    expect(placeIdFamily).toContain('JetBrains Mono')

    await page.screenshot({ path: testInfo.outputPath(`stores-b2-${mode}.png`), fullPage: true })
  })
}

test('the glyph preservations keep their literal size', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('stores-b2-styles')
  for (const [testid, size] of GLYPH_PRESERVATIONS) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
  await setRoleSizes(page, PROBE)
  for (const [testid, size] of GLYPH_PRESERVATIONS) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
  await restoreRoleSizes(page, ROLES)
})

test('no role reaches the BusinessPreview storefront simulation', async ({ page }, testInfo) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('stores-b2-styles')

  for (const [testid, size] of SIMULATION_PRESERVATIONS) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }

  // This is the load-bearing assertion of the batch's scope decision: moving
  // EVERY role must leave the whole simulation untouched.
  await setRoleSizes(page, PROBE)
  for (const [testid, size] of SIMULATION_PRESERVATIONS) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
  // Capture ONLY the simulation region. A full-page shot here came out
  // byte-identical to the propagation screenshot, which is a duplicate and
  // carries no evidence.
  await surface.getByTestId('preview-simulation').screenshot({ path: testInfo.outputPath('stores-b2-simulation-under-probe.png') })
  await restoreRoleSizes(page, ROLES)
})

test('central roles drive the real stores-b2 styles and restore', async ({ page }, testInfo) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('stores-b2-styles')

  const CONTROL = ['business-details-form-label', 'business-details-form-label-required', 'business-details-map-label']
  const CONTROL_VALUE = ['business-details-form-select', 'business-details-form-autocomplete-input']
  const CONTENT = []
  const SECONDARY = []
  const SECTION = ['business-details-heading']
  const TITLE = []
  const IDENTIFIER = ['business-details-map-place-id']
  const probed = new Map([
    ...CONTROL.map(t => [t, '17px']),
    ...CONTROL_VALUE.map(t => [t, '18px']),
    ...CONTENT.map(t => [t, '19px']),
    ...SECONDARY.map(t => [t, '16px']),
    ...SECTION.map(t => [t, '25px']),
    ...TITLE.map(t => [t, '28px']),
    ...IDENTIFIER.map(t => [t, '21px'])
  ])
  expect(probed.size, 'every migrated site must be probed').toBe(ROLE_SIZES.length)

  await setRoleSizes(page, PROBE)
  for (const [testid, size] of probed) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
  await page.screenshot({ path: testInfo.outputPath('stores-b2-propagated.png'), fullPage: true })

  await restoreRoleSizes(page, ROLES)
  for (const [testid, size] of ROLE_SIZES) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
})

// (2.5-A): the 320px RTL coarse-pointer test only asserted 44px on the deleted price-level and paymethod buttons (BusinessAdd/OrderTypePriceLevel, PaymentMethods), so it is gone with them.
