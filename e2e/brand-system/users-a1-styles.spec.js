import { expect, test } from './fixtures'

// The batch keeps its own harness entry so the shared compact registry in
// scripts/brand-system/harness/main.jsx is never edited by a parallel session.
const batchUrl = (query = '') => `/scripts/brand-system/harness/users-a1.html?${query}`

const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']

// Reviewed role assignment for a1-users-core. control 13px, controlValue and
// content 14px, secondary 12px, title 22px. Both states of a Tab take control,
// following the delivery-1 and delivery-2 precedent.
const ROLE_SIZES = [
  ['active-state-tab-active', '13px'],
  ['active-state-tab-inactive', '13px'],
  ['details-menu-tab-active', '13px'],
  ['details-menu-tab-inactive', '13px'],
  ['add-form-title', '22px'],
  ['details-user-name-text', '22px'],
  ['details-verified', '12px'],
  ['filter-control-label', '13px'],
  ['filter-control-value', '14px'],
  ['filter-range-select-head', '14px'],
  ['filter-option', '14px'],
  ['filter-switch-label', '13px'],
  ['driver-zone-restriction-copy', '14px'],
  ['form-select-control', '14px'],
  ['form-select-list', '12px'],
  ['meta-type', '14px'],
  ['meta-add-input', '14px'],
  ['meta-round-border', '14px'],
  ['meta-empty', '14px'],
  ['type-selector-option', '14px'],
  ['listing-header-title', '22px'],
  ['listing-header-info-content', '12px']
]

// The five declared glyph preservations keep their literal size: they size an
// icon, not readable text, so a role must NOT reach them.
const GLYPH_PRESERVATIONS = [
  ['details-verified-icon', '12px'],
  ['details-action-icon', '20px'],
  ['toggle-password', '24px'],
  ['meta-value-icon', '16px'],
  ['profile-camera-icon', '16px']
]

const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, value] of Object.entries(values)) document.documentElement.style.setProperty(`--od-type-${role}-size`, value)
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-type-${role}-size`)
}, roles)

for (const mode of ['light', 'dark']) {
  test(`users-a1 keeps governed typography and native controls in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('users-a1-styles')

    for (const [testid, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
    }

    // Native, separated actions: every control is a real button with a name.
    const activeTab = surface.getByTestId('active-state-tab-active')
    const inactiveTab = surface.getByTestId('active-state-tab-inactive')
    await expect(activeTab).toHaveAttribute('type', 'button')
    await expect(activeTab).toHaveAttribute('aria-pressed', 'true')
    await expect(inactiveTab).toHaveAttribute('aria-pressed', 'false')

    const detailsMenuActive = surface.getByTestId('details-menu-tab-active')
    await expect(detailsMenuActive).toHaveAttribute('type', 'button')
    await expect(detailsMenuActive).toHaveAttribute('aria-pressed', 'true')
    await expect(surface.getByTestId('details-menu-tab-inactive')).toHaveAttribute('aria-pressed', 'false')

    const actionsButton = surface.getByRole('button', { name: 'User actions' })
    await expect(actionsButton).toHaveAttribute('type', 'button')
    await expect(actionsButton).toHaveAttribute('aria-haspopup', 'true')
    await expect(actionsButton).toHaveAttribute('aria-expanded', 'false')

    await expect(surface.getByRole('button', { name: 'Show password' })).toHaveAttribute('type', 'button')
    await expect(surface.getByRole('button', { name: 'Open filters' })).toHaveAttribute('type', 'button')

    // Keyboard focus, not a pointer, must paint the governed 2px focus ring.
    await activeTab.focus()
    await expect(activeTab).toBeFocused()
    await expect(activeTab).toHaveCSS('outline-width', '2px')
    await expect(activeTab).toHaveCSS('outline-style', 'solid')

    await page.screenshot({ path: testInfo.outputPath(`users-a1-${mode}.png`), fullPage: true })
  })
}

test('the five declared glyph preservations keep their literal size', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('users-a1-styles')
  for (const [testid, size] of GLYPH_PRESERVATIONS) {
    await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
  }

  // Moving every role must NOT move a glyph: that is what "preservation" means.
  await setRoleSizes(page, { title: '28px', 'section-title': '25px', content: '19px', secondary: '16px', control: '17px', 'control-value': '18px', identifier: '18px' })
  for (const [testid, size] of GLYPH_PRESERVATIONS) {
    await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
  }
  await restoreRoleSizes(page, ROLES)
})

test('central roles drive the real users-a1 styles and restore', async ({ page }, testInfo) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('users-a1-styles')
  const probe = { title: '28px', 'section-title': '25px', content: '19px', secondary: '16px', control: '17px', 'control-value': '18px', identifier: '18px' }
  const expected = { '22px': '28px', '18px': '25px', '14px': null, '12px': '16px', '13px': '17px' }

  await setRoleSizes(page, probe)
  // content and controlValue both render at 14px today, so they are asserted
  // per testid against the role each one actually took, not by size lookup.
  const propagated = new Map(ROLE_SIZES.map(([testid, size]) => [testid, expected[size]]))
  propagated.set('filter-control-value', '18px')
  propagated.set('filter-range-select-head', '18px')
  propagated.set('filter-option', '18px')
  propagated.set('form-select-control', '18px')
  propagated.set('meta-add-input', '18px')
  propagated.set('type-selector-option', '18px')
  propagated.set('driver-zone-restriction-copy', '19px')
  propagated.set('meta-type', '19px')
  propagated.set('meta-round-border', '19px')
  propagated.set('meta-empty', '19px')

  for (const [testid, size] of propagated) {
    await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
  }
  await page.screenshot({ path: testInfo.outputPath('users-a1-propagated.png'), fullPage: true })

  // Reversible: removing the overrides restores every canonical value.
  await restoreRoleSizes(page, ROLES)
  for (const [testid, size] of ROLE_SIZES) {
    await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
  }
})

test.describe('users-a1 at 320px RTL coarse pointer and reduced motion', () => {
  test.use({ viewport: { width: 320, height: 760 }, hasTouch: true, isMobile: true })

  test('keeps the batch surfaces reflowed with 44px actions', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(batchUrl('mode=dark&rtl=true&locale=ar'))
    const surface = page.getByTestId('users-a1-styles')

    const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)

    for (const id of ['active-state-filter', 'details-menu', 'details-header', 'filter-group', 'meta-fields', 'listing-header-title-container']) {
      const sizes = await surface.getByTestId(id).evaluate(element => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }))
      expect(sizes.scrollWidth, id).toBeLessThanOrEqual(sizes.clientWidth + 1)
    }

    // The controls this batch made native must meet the governed 44x44
    // minimum under a coarse pointer.
    for (const id of ['active-state-tab-active', 'active-state-tab-inactive', 'details-menu-tab-active', 'details-menu-tab-inactive']) {
      const box = await surface.getByTestId(id).boundingBox()
      expect(box.width, id).toBeGreaterThanOrEqual(44)
      expect(box.height, id).toBeGreaterThanOrEqual(44)
    }

    await page.screenshot({ path: testInfo.outputPath('users-a1-dark-rtl-320.png'), fullPage: true })
  })
})
