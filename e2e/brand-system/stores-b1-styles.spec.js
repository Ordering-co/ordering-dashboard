import { expect, test } from './fixtures'

// The batch keeps its own harness entry so the shared compact registry in
// scripts/brand-system/harness/main.jsx is never edited by a parallel session.
const batchUrl = (query = '') => `/scripts/brand-system/harness/stores-b1.html?${query}`

const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']
const PROBE = { title: '28px', 'section-title': '25px', content: '19px', secondary: '16px', control: '17px', 'control-value': '18px', identifier: '21px' }

// Reviewed role assignment for b1-business-listing-filters.
// control 13px, controlValue and content 14px, secondary 12px, title 22px.
// the old list pieces (BusinessesList, BusinessesListingHeader, BusinessFilterGroup, BusinessTypeFilter UI, BusinessSummary,
// BusinessDelete, BusinessSupport) were deleted as dead code; their 16 sites (ROLE_SIZES 20 -> 4) and the four glyph preservations went with them.
// BusinessActiveStateFilter (no production consumer) was deleted; its tab site (ROLE_SIZES 4 -> 3) and its native-button, focus-ring and 44px checks went with it.
// 5.16: BusinessLogs was rewritten on Product and its styles.js is gone; its seven business-logs- sites (ROLE_SIZES 27 -> 20) are no longer mounted here.
const ROLE_SIZES = [
  ['select-header-option-name', '14px'],
  ['select-header-option-city', '12px'],
  ['select-header-pagination-button', '13px']
]

const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, value] of Object.entries(values)) document.documentElement.style.setProperty(`--od-type-${role}-size`, value)
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-type-${role}-size`)
}, roles)

for (const mode of ['light', 'dark']) {
  test(`stores-b1 keeps governed typography and native controls in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('stores-b1-styles')

    for (const [testid, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
    }

    // view-method-button retired with BusinessesListing's ViewMethodButton (a63b5d4a);
    // the redesigned card/list toggle is asserted in e2e/brand-system-app/l4-b1.
    // active-state-filter-tab (native action + focus ring) retired with BusinessActiveStateFilter (dead code).

    await page.screenshot({ path: testInfo.outputPath(`stores-b1-${mode}.png`), fullPage: true })
  })
}

test('central roles drive the real stores-b1 styles and restore', async ({ page }, testInfo) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('stores-b1-styles')

  // Each testid is probed against the role it actually took, never inferred
  // from today's pixel value: content and controlValue both render at 14px.
  const CONTROL = ['select-header-pagination-button']
  const CONTENT = ['select-header-option-name']
  const SECONDARY = ['select-header-option-city']
  const probed = new Map([
    ...CONTROL.map(t => [t, '17px']),
    ...CONTENT.map(t => [t, '19px']),
    ...SECONDARY.map(t => [t, '16px'])
  ])
  expect(probed.size, 'every migrated site must be probed').toBe(ROLE_SIZES.length)

  await setRoleSizes(page, PROBE)
  for (const [testid, size] of probed) {
    await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
  }
  await page.screenshot({ path: testInfo.outputPath('stores-b1-propagated.png'), fullPage: true })

  // Reversible: removing the overrides restores every canonical value.
  await restoreRoleSizes(page, ROLES)
  for (const [testid, size] of ROLE_SIZES) {
    await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
  }
})

test.describe('stores-b1 at 320px RTL coarse pointer and reduced motion', () => {
  test.use({ viewport: { width: 320, height: 760 }, hasTouch: true, isMobile: true })

  test('keeps the batch surfaces reflowed', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(batchUrl('mode=dark&rtl=true&locale=ar'))

    const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)

    await page.screenshot({ path: testInfo.outputPath('stores-b1-dark-rtl-320.png'), fullPage: true })
  })
})
