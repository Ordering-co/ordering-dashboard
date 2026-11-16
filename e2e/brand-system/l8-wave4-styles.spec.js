import { expect, test } from './fixtures'

// The batch keeps its own harness entry so the shared compact registry in
// scripts/brand-system/harness/main.jsx is never edited by a parallel session.
const batchUrl = (query = '') => `/scripts/brand-system/harness/l8-wave4.html?${query}`

const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']

// L8 wave 4 classifies literals that `main` added inside rows that were already
// adopted. The values below are the coordinator's DECISIONS. They are NOT applied
// in the product code yet, so the sites that change are expected to fail until
// the rewrite lands: that is what makes this table a specification and not a
// recording of the present.
//
// Column 3 is the role the site takes, or 'preserve' for a literal that stays.
//
// Lot 5.9: removed w4-gateway-status-p, w4-gateway-status-a and
// w4-install-action (PaymentOptionGlobal and BusinessPaymentMethods moved to
// Product, their styles.js are gone); DECIDED 15 -> 12, ROLE_SITES 12 -> 9.
//
// (2.5-A): removed w4-disabled-text (Stores/BusinessAdd/DeliveryZone
// `DisabledText`; /stores/add moved to Product and its styles.js is gone);
// DECIDED 12 -> 11, ROLE_SITES 9 -> 8.
//
// (main sync, ): removed w4-continue-glyph (Stores/RestaurantSelectGuide
// `ButtonWrapper`; main deleted the component with its flow); DECIDED 11 -> 10,
// PRESERVATIONS 3 -> 2, ROLE_SITES stays 8.
//
// NOT IN THIS TABLE: w4-empty-help (Settings/CustomOrder `EmptyHelp`, 13px today,
// decided `content` 14px). `EmptyHelp` is a `styled.p` declared in
// CustomOrder/index.js and is not exported, so the fixture does not mount it
// (duplicating its CSS would measure the copy). Coordinator decision (L8 Ola 4):
// the product is not changed to export it just for a fixture; the site is held by
// the l6-a2 typography rule `…emptyhelp-root-13px…` and its guard, both verified.
const DECIDED = [
  ['w4-unavailable-notice', '14px', 'content'],
  ['w4-category-header', '13px', 'control'],
  ['w4-category-meta', '12px', 'secondary'],
  ['w4-warning-banner', '14px', 'content'],
  ['w4-tracking-option', '14px', 'control-value'],
  ['w4-tracking-option-small', '12px', 'secondary'],
  ['w4-image-actions-button', '13px', 'control'],
  ['w4-ai-badge', '12px', 'secondary'],
  ['w4-integration-chevron', '18px', 'preserve'],
  ['w4-integration-compact-icon', '16px', 'preserve']
]

const ROLE_SITES = DECIDED.filter(([, , role]) => role !== 'preserve')
const PRESERVATIONS = DECIDED.filter(([, , role]) => role === 'preserve')

const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, size] of Object.entries(values)) {
    document.documentElement.style.setProperty(`--od-type-${role}-size`, size)
  }
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-type-${role}-size`)
}, roles)

// Every role moved to a size none of them has by default, and all distinct, so a
// site that moves can be attributed to ITS role by size alone.
const PROBE = { title: '28px', 'section-title': '25px', content: '19px', secondary: '16px', control: '17px', 'control-value': '20px', identifier: '23px' }

for (const mode of ['light', 'dark']) {
  test(`l8-wave4 sites measure their decided size in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('l8-wave4-styles')

    for (const [testid, size] of DECIDED) {
      await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
    }

    await page.screenshot({ path: testInfo.outputPath(`l8-wave4-${mode}.png`), fullPage: true })
  })
}

test('central roles drive the l8-wave4 role sites and restore, and preservations do not move', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('l8-wave4-styles')

  await setRoleSizes(page, PROBE)
  for (const [testid, , role] of ROLE_SITES) {
    await expect(surface.getByTestId(testid), `${testid} follows ${role}`).toHaveCSS('font-size', PROBE[role])
  }
  for (const [testid, size] of PRESERVATIONS) {
    await expect(surface.getByTestId(testid), `${testid} is preserved`).toHaveCSS('font-size', size)
  }

  await restoreRoleSizes(page, ROLES)
  for (const [testid, size] of DECIDED) {
    await expect(surface.getByTestId(testid), `${testid} restores`).toHaveCSS('font-size', size)
  }
})
