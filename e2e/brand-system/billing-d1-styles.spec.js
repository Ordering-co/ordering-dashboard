import { expect, test } from './fixtures'

// The batch keeps its own harness entry so the shared compact registry in
// scripts/brand-system/harness/main.jsx is never edited by a parallel session.
const batchUrl = (query = '') => `/scripts/brand-system/harness/billing-d1.html?${query}`

const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']

// Reviewed role assignment for d1-billing-ordering-products: 25 migrated sites (the 6 of BillingPaymentOptions/styles.js left with ).
// removed the opd-, opg-, opl- and sth- ids (the /ordering-products route moved onto Product with its own CSS; OrderingProductsListing, OrderingProductDetails, OrderingProductGeneralDetails and SiteTheme styles.js are gone); ROLE_SIZES 25 -> 5, glyph preservations 3 -> 2. The UploadImageIcon two-sizes test (opg-upload-small and opg-upload-default) goes with its subject.
// row 82 (c20fb1151, re-pinned in 8de92b008) moved two sites from span/div to native buttons:
// ActionsContent `div` -> `button` and CardItemActionsWrapper `span > svg` -> `> button > svg`. Same rules, sizes and
// roles; the ids follow testidFor (stp-actions-content-button, stp-card-item-actions-wrapper-buttonsvg), and the last
// test asserts both are real <button>s, so a fixture that slid back to a div or span fails instead of passing on 16px.
//
// In ruleset order, because verify-spec-tables pairs entry i with rule i. Both this
// table and the fixture are GENERATED from the ruleset.
//
// This fixture mounts STYLES. It imports styles.js and never an index.js, so
// @stripe/react-stripe-js is not loaded, no iframe is created and nothing in this
// batch can reach a payment provider.
const ROLE_SIZES = [
  ['scf-error-message-root', '14px'], // content
  ['stp-option-stripe-container-alinkspantext', '12px'], // secondary
  ['stp-card-item-content-span', '14px'], // content
  ['stp-actions-content-button', '13px'], // control
  ['stp-error-message-root', '14px'] // content
]

// The declared preservations with a LITERAL size. In this batch they are all glyphs.
const PRESERVATIONS = [
  ['stp-option-stripe-container-alinksvg', '12px'],
  ['stp-card-item-actions-wrapper-buttonsvg', '20px']
]

const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, size] of Object.entries(values)) {
    document.documentElement.style.setProperty(`--od-type-${role}-size`, size)
  }
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-type-${role}-size`)
}, roles)

const PROBE = { title: '28px', 'section-title': '25px', content: '19px', secondary: '16px', control: '17px', 'control-value': '18px', identifier: '18px' }

for (const mode of ['light', 'dark']) {
  test(`billing-d1 keeps governed typography in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('billing-d1-styles')
    for (const [testid, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
    }
    await page.screenshot({ path: testInfo.outputPath(`billing-d1-${mode}.png`), fullPage: true })
  })
}

test('the declared preservations keep their literal size when every role moves', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('billing-d1-styles')
  for (const [testid, size] of PRESERVATIONS) {
    await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
  }
  await setRoleSizes(page, PROBE)
  for (const [testid, size] of PRESERVATIONS) {
    await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
  }
  await restoreRoleSizes(page, ROLES)
  for (const [testid, size] of PRESERVATIONS) {
    await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
  }
})

test('central roles drive the real billing-d1 styles and restore', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('billing-d1-styles')

  // content and control-value both resolve to 14px today, and control and identifier
  // both to 13px, so a site at either size cannot be attributed to one role by size
  // alone. Those are skipped rather than asserted on a guess.
  const expected = { '22px': '28px', '18px': '25px', '14px': null, '12px': '16px', '13px': null }

  await setRoleSizes(page, PROBE)
  for (const [testid, size] of ROLE_SIZES) {
    const moved = expected[size]
    if (!moved) continue
    await expect(surface.getByTestId(testid), `${testid} moves with its role`).toHaveCSS('font-size', moved)
  }
  await restoreRoleSizes(page, ROLES)
  for (const [testid, size] of ROLE_SIZES) {
    await expect(surface.getByTestId(testid), `${testid} restores`).toHaveCSS('font-size', size)
  }
})

test('the Stripe card menu sites are native buttons, as PaymentCard renders them', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('billing-d1-styles')
  await expect(surface.getByTestId('stp-actions-content-button')).toHaveJSProperty('tagName', 'BUTTON')
  await expect(surface.getByTestId('stp-actions-content-button')).toHaveAttribute('role', 'menuitem')
  await expect(surface.getByTestId('stp-card-item-actions-wrapper-button')).toHaveJSProperty('tagName', 'BUTTON')
})
