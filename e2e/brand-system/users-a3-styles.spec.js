import { expect, test } from './fixtures'

// The batch keeps its own harness entry so the shared compact registry in
// scripts/brand-system/harness/main.jsx is never edited by a parallel session.
const batchUrl = (query = '') => `/scripts/brand-system/harness/users-a3.html?${query}`

const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']

// Reviewed role assignment for a3-users-professionals. control 13px,
// controlValue and content 14px, secondary 12px, sectionTitle 18px, title 22px.
const ROLE_SIZES = [
  ['occupation-select-legacy-select', '14px'],
  ['occupation-select-legacy-header', '14px'],
  ['occupation-select-legacy-option', '13px'],
  ['occupation-select-option', '14px'],
  ['occupations-filter-button', '13px'],
  ['business-item-name', '14px'],
  ['category-tree-node-category-label', '13px'],
  ['category-tree-node-product-label', '13px'],
  ['professional-detail-name', '22px'],
  ['professional-detail-action-dropdown-item', '13px'],
  ['professional-detail-sidebar-title', '22px'],
  ['professional-list-table-header-cell', '14px'],
  ['professional-list-info-secondary', '12px'],
  ['professional-list-info-primary', '14px'],
  ['professional-list-email', '14px'],
  ['professional-list-enable-label', '13px'],
  ['professional-list-verified-badge', '12px'],
  ['professional-schedule-daterange-title', '18px'],
  ['professional-schedule-daterange-description', '12px'],
  ['professional-schedule-range-item-label-days', '13px'],
  ['professional-schedule-range-item-label-indefinite', '13px'],
  ['professional-schedule-schedule-title', '18px'],
  ['professional-services-title', '22px']
]

// The six declared glyph preservations keep their literal size.
const GLYPH_PRESERVATIONS = [
  ['business-item-chevron-icon', '18px'],
  ['business-item-check-icon', '16px'],
  ['category-tree-node-checkbox-icon', '18px'],
  ['professional-detail-action-toggle-icon', '20px'],
  ['professional-list-checkbox-icon', '16px'],
  ['professional-list-verified-icon', '12px']
]

const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, value] of Object.entries(values)) document.documentElement.style.setProperty(`--od-type-${role}-size`, value)
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-type-${role}-size`)
}, roles)

const PROBE = { title: '28px', 'section-title': '25px', content: '19px', secondary: '16px', control: '17px', 'control-value': '18px', identifier: '21px' }

for (const mode of ['light', 'dark']) {
  test(`users-a3 keeps governed typography and native controls in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('users-a3-styles')

    for (const [testid, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
    }
    // The table body cell shares the grouped td, th declaration.
    await expect(surface.getByTestId('professional-list-table').locator('td').first()).toHaveCSS('font-size', '14px')

    // Native, separated actions: the four surfaces this batch converted.
    const rowCheckbox = surface.getByTestId('professional-list-checkbox-wrapper')
    await expect(rowCheckbox).toHaveAttribute('type', 'button')
    await expect(rowCheckbox).toHaveAttribute('role', 'checkbox')
    await expect(rowCheckbox).toHaveAttribute('aria-checked', 'false')

    const productCheckbox = surface.getByTestId('category-tree-node-checkbox-wrapper')
    await expect(productCheckbox).toHaveAttribute('type', 'button')
    await expect(productCheckbox).toHaveAttribute('role', 'checkbox')

    // Keyboard focus, not a pointer, must paint the governed 2px focus ring.
    await rowCheckbox.focus()
    await expect(rowCheckbox).toBeFocused()
    await expect(rowCheckbox).toHaveCSS('outline-width', '2px')
    await expect(rowCheckbox).toHaveCSS('outline-style', 'solid')

    await page.screenshot({ path: testInfo.outputPath(`users-a3-${mode}.png`), fullPage: true })
  })
}

test('the six declared glyph preservations keep their literal size', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('users-a3-styles')
  for (const [testid, size] of GLYPH_PRESERVATIONS) {
    await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
  }

  // Moving every role must NOT move a glyph: that is what "preservation" means.
  await setRoleSizes(page, PROBE)
  for (const [testid, size] of GLYPH_PRESERVATIONS) {
    await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
  }
  await restoreRoleSizes(page, ROLES)
})

test('central roles drive the real users-a3 styles and restore', async ({ page }, testInfo) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('users-a3-styles')

  // Each testid is probed against the role it actually took, never inferred
  // from today's pixel value: content and controlValue both render at 14px.
  const probed = new Map([
    ['occupation-select-legacy-select', '18px'], ['occupation-select-legacy-header', '18px'],
    ['occupation-select-option', '18px'],
    ['occupation-select-legacy-option', '17px'], ['occupations-filter-button', '17px'],
    ['category-tree-node-category-label', '17px'], ['category-tree-node-product-label', '17px'],
    ['professional-detail-action-dropdown-item', '17px'], ['professional-list-enable-label', '17px'],
    ['professional-schedule-range-item-label-days', '17px'], ['professional-schedule-range-item-label-indefinite', '17px'],
    ['professional-detail-name', '28px'],
    ['professional-detail-sidebar-title', '28px'], ['professional-services-title', '28px'],
    ['business-item-name', '19px'], ['professional-list-table-header-cell', '19px'],
    ['professional-list-info-primary', '19px'], ['professional-list-email', '19px'],
    ['professional-list-info-secondary', '16px'], ['professional-list-verified-badge', '16px'],
    ['professional-schedule-daterange-description', '16px'],
    ['professional-schedule-daterange-title', '25px'], ['professional-schedule-schedule-title', '25px']
  ])
  expect(probed.size, 'every migrated site must be probed').toBe(ROLE_SIZES.length)

  await setRoleSizes(page, PROBE)
  for (const [testid, size] of probed) {
    await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
  }
  await page.screenshot({ path: testInfo.outputPath('users-a3-propagated.png'), fullPage: true })

  // Reversible: removing the overrides restores every canonical value.
  await restoreRoleSizes(page, ROLES)
  for (const [testid, size] of ROLE_SIZES) {
    await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
  }
})

test.describe('users-a3 at 320px RTL coarse pointer and reduced motion', () => {
  test.use({ viewport: { width: 320, height: 760 }, hasTouch: true, isMobile: true })

  test('keeps the batch surfaces reflowed with 44px actions', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(batchUrl('mode=dark&rtl=true&locale=ar'))
    const surface = page.getByTestId('users-a3-styles')

    const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)

    for (const id of ['occupations-filter-container', 'business-item-container', 'professional-detail-user-name-wrapper', 'professional-schedule-daterange-wrapper', 'professional-services-container']) {
      const sizes = await surface.getByTestId(id).evaluate(element => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }))
      expect(sizes.scrollWidth, id).toBeLessThanOrEqual(sizes.clientWidth + 1)
    }

    for (const id of ['professional-list-checkbox-wrapper', 'category-tree-node-checkbox-wrapper']) {
      const box = await surface.getByTestId(id).boundingBox()
      expect(box.width, id).toBeGreaterThanOrEqual(44)
      expect(box.height, id).toBeGreaterThanOrEqual(44)
    }

    await page.screenshot({ path: testInfo.outputPath('users-a3-dark-rtl-320.png'), fullPage: true })
  })
})
