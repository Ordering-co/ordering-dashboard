import { expect, test } from './fixtures'

// The batch keeps its own harness entry so the shared compact registry in
// scripts/brand-system/harness/main.jsx is never edited by a parallel session.
const batchUrl = (query = '') => `/scripts/brand-system/harness/loyalty-b3.html?${query}`

const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']

// Single viewport, confirmed rather than inherited: the ruleset
// (scripts/brand-system/l5-b3-loyalty-typography-rules.json) declares no
// preservation of a breakpoint override on top of a role, so there is no
// width at which any assertion here would differ.
const VIEWPORT = { width: 1280, height: 900 }

// Reviewed role assignment for b3-loyalty: 25 migrated sites (the 7 of GiftCardDetail and GiftCards left with ), in ruleset order,
// which is the order verify-spec-tables.mjs checks them in.
const ROLE_SIZES = [
  ['lld-level-name', '22px'],
  ['lld-action-selector-dropdown-item', '13px'],
  ['lld-form-controller-label', '13px'],
  ['lld-expiration-h2', '18px'],
  ['lld-checkbox-p', '13px'],
  ['pwbd-header-h1', '22px'],
  ['pwbd-points-redemption-h2', '18px'],
  ['pwbd-points-redemption-p', '13px'],
  ['pwbd-checkbox-p', '13px'],
  ['pwbd-points-accumulation-h2', '18px'],
  ['pwbd-points-accumulation-p', '14px'],
  ['pwbd-points-accumulation-span', '13px'],
  ['pwbd-toggle-p', '13px'],
  ['pwbd-expiration-h2', '18px'],
  ['pwbl-business-info-span', '14px'],
  ['pwbl-modified-span', '12px'],
  ['pwl-title', '22px'],
  ['pwl-level-name', '14px'],
  ['pwl-add-new-level-button', '13px'],
  ['rp-header-title-h1', '22px'],
  ['rp-loyalty-item-h5', '18px'],
  ['rp-loyalty-item-p', '12px'],
  ['rp-info-content', '12px'],
  ['w-title', '22px'],
  ['w-tab', '13px']
]

// The six preservations that can be observed. The other four render nothing a
// fixture could measure: their selector matches no node in the component's
// current markup — an upload icon with no inner span in the level-detail row,
// a payment-rules block whose markup is commented out, and a price class no
// node carries — which is said here rather than left as a silent gap between
// 10 preservations and 6 assertions. All six size an icon glyph, so no role may
// reach any of them. (The gift card ones left with .)
const PRESERVATIONS = [
  ['lld-action-selector-icon', '20px'],
  ['lld-checkbox-icon', '16px'],
  ['pwbd-checkbox-icon', '16px'],
  ['pwbl-modified-icon', '17px'],
  ['pwl-level-item-icon', '18px'],
  ['rp-icon-wrapper-icon', '24px']
]

const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, value] of Object.entries(values)) document.documentElement.style.setProperty(`--od-type-${role}-size`, value)
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-type-${role}-size`)
}, roles)

const PROBE = { title: '28px', 'section-title': '25px', content: '19px', secondary: '16px', control: '17px', 'control-value': '18px', identifier: '18px' }

for (const mode of ['light', 'dark']) {
  test(`loyalty-b3 keeps governed typography and native controls in ${mode}`, async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORT)
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('loyalty-b3-styles')

    for (const [testid, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
    }

    // Confirmed facts read from each row's index.js (not sizes the
    // coordinator has to supply), so these are asserted directly rather than
    // left as TODOs. Written out one by one instead of looped: a loop over
    // testids reads as no assertion at all to verify-spec-tables.mjs, which
    // ties each conversion the batch record declares to the expression the
    // record says observes it.
    const walletTab = surface.getByTestId('w-tab')
    await expect(walletTab).toHaveAttribute('type', 'button')
    await expect(walletTab).toHaveJSProperty('tagName', 'BUTTON')
    await expect(walletTab).toHaveAttribute('aria-pressed', 'true')

    const checkboxInner = surface.getByTestId('pwbl-checkbox-inner')
    await expect(checkboxInner).toHaveAttribute('type', 'button')
    await expect(checkboxInner).toHaveJSProperty('tagName', 'BUTTON')
    await expect(checkboxInner).toHaveAttribute('role', 'checkbox')
    await expect(checkboxInner).toHaveAttribute('aria-checked', 'true')

    await page.screenshot({ path: testInfo.outputPath(`loyalty-b3-${mode}.png`), fullPage: true })
  })
}

test('the declared preservations keep their literal size when every role moves', async ({ page }) => {
  await page.setViewportSize(VIEWPORT)
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('loyalty-b3-styles')
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

test('central roles drive the real loyalty-b3 styles and restore', async ({ page }) => {
  await page.setViewportSize(VIEWPORT)
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('loyalty-b3-styles')

  // A size is attributable to a role only when exactly one role resolves to it.
  // control-value and content both resolve to 14px, and control and identifier
  // both to 13px, so those sites are skipped here rather than attributed on a
  // guess. They are covered by the positional role table above and the ruleset.
  const expected = { '22px': '28px', '18px': '25px', '14px': null, '13px': null, '12px': '16px' }

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
