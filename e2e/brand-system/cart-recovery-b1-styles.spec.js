import { expect, test } from './fixtures'

// The batch keeps its own harness entry so the shared compact registry in
// scripts/brand-system/harness/main.jsx is never edited by a parallel session.
const batchUrl = (query = '') => `/scripts/brand-system/harness/cart-recovery-b1.html?${query}`

const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']

// The batch has a single width breakpoint, and it matters to where each table is
// asserted. NARROW is below it and WIDE is above it.
const NARROW = { width: 560, height: 900 }
const WIDE = { width: 1280, height: 900 }

// Reviewed role assignment for b1-open-carts-selectors: 15 migrated sites, in
// ruleset order, which is the order verify-spec-tables.mjs checks them in.
//
// The table is asserted at the NARROW viewport, and not by preference. The
// ContentInfo h3 in it also carries a preserved breakpoint override of the same
// declaration, so above the breakpoint that node renders at the preserved
// literal rather than at its role. Asserting the role at a wide viewport would
// be asserting the override and calling it the role.
const ROLE_SIZES = [
  ['ocb-table', '14px'],
  ['ocb-table-total-tr', '14px'],
  ['ocb-table-payments-th', '18px'],
  ['pia-content-info-h3', '14px'],
  ['pia-accordion-text', '14px'],
  ['pia-product-comment-h3', '14px'],
  ['pia-product-info-h3', '14px'],
  ['pia-product-info-p', '13px'],
  ['pia-product-error-span', '14px'],
  ['pia-product-price-span', '13px'],
  ['pia-product-select', '14px'],
  ['pia-product-options-p', '12px'],
  ['pia-product-options-li-span', '12px'],
  ['pia-schedule-info-wrapper-h3', '14px'],
  ['pia-schedule-info-span', '13px']
]

// The three preservations that can be observed. The other one renders nothing a
// fixture could measure: its selector matches no node in the component's
// current markup, which is said here rather than left as a silent gap between
// 4 preservations and 3 assertions. (redesign OC-integration: the selection
// counter WrapperIndicator left with the rewritten OpenCartListing styles, and
// its preservation left the ruleset with it.)
//
// These are asserted at the WIDE viewport, because one of them is not a
// glyph. It is the preserved breakpoint override of the same ContentInfo h3
// that the role table above migrates, and below the breakpoint that node
// correctly renders at its role instead.
const PRESERVATIONS = [
  ['pia-content-info-icon', '20px'],
  ['pia-content-info-h3', '18px'],
  ['pia-product-actions-edit-icon', '20px']
]

const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, value] of Object.entries(values)) document.documentElement.style.setProperty(`--od-type-${role}-size`, value)
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-type-${role}-size`)
}, roles)

const PROBE = { title: '28px', 'section-title': '25px', content: '19px', secondary: '16px', control: '17px', 'control-value': '18px', identifier: '18px' }

for (const mode of ['light', 'dark']) {
  test(`cart-recovery-b1 keeps governed typography in ${mode}`, async ({ page }, testInfo) => {
    await page.setViewportSize(NARROW)
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('cart-recovery-b1-styles')

    for (const [testid, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
    }

    await page.screenshot({ path: testInfo.outputPath(`cart-recovery-b1-${mode}.png`), fullPage: true })
  })
}

test('the declared preservations keep their literal size when every role moves', async ({ page }) => {
  await page.setViewportSize(WIDE)
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('cart-recovery-b1-styles')
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

test('central roles drive the real cart-recovery-b1 styles and restore', async ({ page }) => {
  await page.setViewportSize(NARROW)
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('cart-recovery-b1-styles')

  // A size is attributable to a role only when exactly one role resolves to it.
  // Two pairs share a size in this batch — control-value with content at 14px,
  // and control with identifier at 13px — so those sites are skipped here rather
  // than attributed on a guess. They are covered by the positional role table
  // above and by the ruleset. a3 hit the same wall at 14px; b1 hits it twice
  // because `identifier` finally has users, all of them dictated by the L3 twin.
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
