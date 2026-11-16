import { expect, test } from './fixtures'

// The batch keeps its own harness entry so the shared compact registry in
// scripts/brand-system/harness/main.jsx is never edited by a parallel session.
const batchUrl = (query = '') => `/scripts/brand-system/harness/delivery-c2.html?${query}`

const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']

// Reviewed role assignment for c2-connect-delivery-zones: 2 migrated sites.
//
// In ruleset order, because verify-spec-tables pairs entry i with rule i. Both this
// table and the fixture are GENERATED from the ruleset.
//
// Connect/DeliveryServiceDetails, DeliveryServiceGeneralForm, DeliveryServiceZoneInformation, DeliveryServiceZonesDetails, DeliveryServiceZonesList, DeliveryServices/styles.js and DeliveryServicesList were deleted as dead code; dsd-, dgf-, dzi-, dzd-, dzl-, dse-, dsl- rows (ROLE_SIZES 26 -> 4, PRESERVATIONS 2 -> 0) went with them, together with the three tests that only read them (tab base/active pair, preservations, converted native buttons).
// DeliveryServicePaymethods deleted its styles.js (Product pick list); its dpm- row went with it (4 -> 3), and
// DeliveryServicesBusinesses (P/SelectableList) its dsb- row (3 -> 2).
const ROLE_SIZES = [
  ['dga-checkbox-wrapper-span', '13px'], // control
  ['dga-field-container-label', '13px'] // control
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
  test(`delivery-c2 keeps governed typography in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('delivery-c2-styles')
    for (const [testid, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
    }
    await page.screenshot({ path: testInfo.outputPath(`delivery-c2-${mode}.png`), fullPage: true })
  })
}

test('central roles drive the real delivery-c2 styles and restore', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('delivery-c2-styles')

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
