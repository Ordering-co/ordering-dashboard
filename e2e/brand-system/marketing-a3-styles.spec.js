import { expect, test } from './fixtures'

// The batch keeps its own harness entry so the shared compact registry in
// scripts/brand-system/harness/main.jsx is never edited by a parallel session.
const batchUrl = (query = '') => `/scripts/brand-system/harness/marketing-a3.html?${query}`

const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']

// Reviewed role assignment for a3-banners-journeys: 61 migrated sites.
// Two assignments here are coordinator overrides of the classifier's proposal,
// both recorded with their evidence in the batch decisions file. PageBanner's
// BannersHeader stays at secondary rather than jumping to an 18px sectionTitle
// that no 12px declaration has taken in two closed layers, and
// PromotionJourneysListing's ProductPickerHeader h4 stays at control so it does
// not end up the same size as the h3 directly above it.
const ROLE_SIZES = [
  ['pos-title', '13px'],
  ['pos-description', '12px'],
  ['ad-header', '22px'],
  ['ad-info-content', '12px'],
  ['bdbiz-business', '12px'],
  ['bd-header', '22px'],
  ['bd-tab', '13px'],
  ['bd-upload-image-icon', '14px'],
  ['bd-form-controller', '13px'],
  ['bd-action-selector', '13px'],
  ['bd-businesses', '14px'],
  ['sbp-accordion-item', '13px'],
  ['bid-header', '22px'],
  ['bid-drop-down', '13px'],
  ['bid-upload-image-icon', '12px'],
  ['bid-form-controller', '13px'],
  ['bid-select', '14px'],
  ['bid-business-name', '13px'],
  ['bid-option', '12px'],
  ['bid-option-2', '14px'],
  ['pb-header', '22px'],
  ['pb-banners-header', '12px'],
  ['pb-banner-title-conatiner', '13px'],
  ['pb-enable', '13px'],
  ['pb-add-new-banner', '13px'],
  ['pb-info-content', '12px'],
  ['pj-hero', '22px'],
  ['pj-hero-2', '14px'],
  ['pj-template-content', '18px'],
  ['pj-template-content-2', '14px'],
  ['pj-template-meta', '12px'],
  ['pj-section', '18px'],
  ['pj-section-2', '14px'],
  ['pj-promotion-card', '18px'],
  ['pj-promotion-card-2', '14px'],
  ['pj-status', '12px'],
  ['pj-promotion-action', '13px'],
  ['pj-promotion-pagination', '13px'],
  ['pj-builder-header', '18px'],
  ['pj-builder-header-2', '14px'],
  ['pj-field', '13px'],
  ['pj-field-2', '14px'],
  ['pj-field-hint', '12px'],
  ['pj-error-text', '12px'],
  ['pj-scope-box', '18px'],
  ['pj-scope-box-2', '14px'],
  ['pj-scope-mode-button', '13px'],
  ['pj-business-option', '13px'],
  ['pj-choice-group', '13px'],
  ['pj-scope-hint', '12px'],
  ['pj-check-grid', '13px'],
  ['pj-product-picker-header', '13px'],
  ['pj-product-picker-header-2', '12px'],
  ['pj-product-selection-count', '12px'],
  ['pj-product-picker-search', '14px'],
  ['pj-product-option', '13px'],
  ['pj-product-picker-empty', '14px'],
  ['pj-product-picker-load-more', '13px'],
  ['pj-action-button', '13px'],
  ['pj-api-error', '14px'],
  ['pj-empty-state', '14px']
]

// The five preservations that can be observed. All five size an icon glyph, so
// no role may reach them. The batch's other six are `font: inherit` resets on
// native buttons and fields: they declare no size of their own, so there is
// nothing for a fixture to assert, which is said here rather than left as a
// silent gap between 11 preservations and 5 assertions.
const PRESERVATIONS = [
  ['pos-icon', '24px'],
  ['bd-upload-icon', '55px'],
  ['bd-action-icon', '20px'],
  ['bid-dropdown-icon', '20px'],
  ['bid-upload-icon', '55px']
]

const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, value] of Object.entries(values)) document.documentElement.style.setProperty(`--od-type-${role}-size`, value)
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-type-${role}-size`)
}, roles)

const PROBE = { title: '28px', 'section-title': '25px', content: '19px', secondary: '16px', control: '17px', 'control-value': '18px', identifier: '18px' }

for (const mode of ['light', 'dark']) {
  test(`marketing-a3 keeps governed typography and native controls in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('marketing-a3-styles')

    for (const [testid, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
    }

    // The banner tab strip is a native button after this batch's conversion.
    const tab = surface.getByTestId('bd-tab')
    await expect(tab).toHaveAttribute('type', 'button')
    await expect(tab).toHaveJSProperty('tagName', 'BUTTON')
    await tab.focus()
    await expect(tab).toBeFocused()
    await expect(tab).toHaveCSS('outline-width', '2px')
    await expect(tab).toHaveCSS('outline-style', 'solid')

    await page.screenshot({ path: testInfo.outputPath(`marketing-a3-${mode}.png`), fullPage: true })
  })
}

test('the declared glyph preservations keep their literal size when every role moves', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('marketing-a3-styles')
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

test('central roles drive the real marketing-a3 styles and restore', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('marketing-a3-styles')

  // content and control-value both resolve to 14px today, so a 14px site cannot
  // be attributed to one of them by size alone; those are skipped here rather
  // than asserted on a guess, and are covered by ROLE_SIZES and the ruleset.
  const expected = { '22px': '28px', '18px': '25px', '14px': null, '12px': '16px', '13px': '17px' }

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
