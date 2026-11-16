import { expect, test } from './fixtures'

// The batch keeps its own harness entry so the shared compact registry in
// scripts/brand-system/harness/main.jsx is never edited by a parallel session.
const batchUrl = (query = '') => `/scripts/brand-system/harness/users-a2.html?${query}`

const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']

// Reviewed role assignment for a2-users-customers. control 13px, controlValue
// and content 14px, secondary 12px, sectionTitle 18px, title 22px,
// identifier 13px in the mono family.
const ROLE_SIZES = [
  ['cash-wallet-title', '22px'],
  ['cash-wallet-tab-active', '13px'],
  ['cash-wallet-tab-inactive', '13px'],
  ['wallet-balance-amount', '22px'],
  ['wallet-balance-currency', '12px'],
  ['cash-wallet-details-section-title', '18px'],
  ['cash-wallet-details-form-label', '13px'],
  ['cash-wallet-details-form-input', '14px'],
  ['cash-wallet-details-form-textarea', '14px'],
  ['customer-name', '22px'],
  ['customer-verified', '12px'],
  ['customer-action-dropdown-item', '13px'],
  ['customer-option-menu-label', '13px'],
  ['points-wallet-title', '22px'],
  ['points-balance', '22px'],
  ['points-balance-label', '12px'],
  ['equal-wrapper', '22px'],
  ['level-wrapper-title', '18px'],
  ['points-tab-active', '13px'],
  ['points-tab-inactive', '13px'],
  ['loyalty-level-title', '18px'],
  ['loyalty-level-name', '22px'],
  ['points-section-title', '18px'],
  ['points-form-label', '13px'],
  ['points-form-input', '14px'],
  ['points-form-textarea', '14px'],
  ['transaction-header', '14px'],
  ['transaction-description', '12px'],
  ['transaction-code', '13px'],
  ['verified-status-filter-button', '13px']
]

// The five declared glyph preservations keep their literal size: they size an
// icon, not readable text, so a role must NOT reach them.
const GLYPH_PRESERVATIONS = [
  ['customer-verified-icon', '12px'],
  ['customer-action-icon', '20px'],
  ['customer-option-menu-icon', '16px'],
  ['transaction-icon', '6px'],
  ['verified-status-filter-icon', '20px']
]

const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, value] of Object.entries(values)) document.documentElement.style.setProperty(`--od-type-${role}-size`, value)
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-type-${role}-size`)
}, roles)

for (const mode of ['light', 'dark']) {
  test(`users-a2 keeps governed typography and native controls in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('users-a2-styles')

    for (const [testid, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
    }

    // The transaction code is the one identifier of this wave, so it also takes
    // the mono family, not just the size.
    const codeFamily = await surface.getByTestId('transaction-code').evaluate(element => getComputedStyle(element).fontFamily)
    expect(codeFamily).toContain('JetBrains Mono')

    // Native, separated actions: five surfaces this batch converted.
    for (const [active, inactive] of [['cash-wallet-tab-active', 'cash-wallet-tab-inactive'], ['points-tab-active', 'points-tab-inactive']]) {
      await expect(surface.getByTestId(active)).toHaveAttribute('type', 'button')
      await expect(surface.getByTestId(active)).toHaveAttribute('aria-pressed', 'true')
      await expect(surface.getByTestId(inactive)).toHaveAttribute('aria-pressed', 'false')
    }
    const optionMenu = surface.getByTestId('customer-option-menu')
    await expect(optionMenu).toHaveAttribute('type', 'button')
    await expect(optionMenu).toHaveAttribute('aria-pressed', 'false')

    // Keyboard focus, not a pointer, must paint the governed 2px focus ring.
    const tab = surface.getByTestId('cash-wallet-tab-active')
    await tab.focus()
    await expect(tab).toBeFocused()
    await expect(tab).toHaveCSS('outline-width', '2px')
    await expect(tab).toHaveCSS('outline-style', 'solid')

    await page.screenshot({ path: testInfo.outputPath(`users-a2-${mode}.png`), fullPage: true })
  })
}

test('the five declared glyph preservations keep their literal size', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('users-a2-styles')
  for (const [testid, size] of GLYPH_PRESERVATIONS) {
    await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
  }

  // Moving every role must NOT move a glyph: that is what "preservation" means.
  await setRoleSizes(page, { title: '28px', 'section-title': '25px', content: '19px', secondary: '16px', control: '17px', 'control-value': '18px', identifier: '21px' })
  for (const [testid, size] of GLYPH_PRESERVATIONS) {
    await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
  }
  await restoreRoleSizes(page, ROLES)
})

test('central roles drive the real users-a2 styles and restore', async ({ page }, testInfo) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('users-a2-styles')

  // Each testid is probed against the role it actually took, not by looking the
  // role up from today's pixel value: content and controlValue share 14px.
  const probed = new Map([
    ['cash-wallet-title', '28px'], ['points-wallet-title', '28px'], ['wallet-balance-amount', '28px'],
    ['points-balance', '28px'], ['equal-wrapper', '28px'], ['loyalty-level-name', '28px'], ['customer-name', '28px'],
    ['cash-wallet-details-section-title', '25px'], ['level-wrapper-title', '25px'],
    ['loyalty-level-title', '25px'], ['points-section-title', '25px'],
    ['transaction-header', '19px'],
    ['wallet-balance-currency', '16px'], ['customer-verified', '16px'],
    ['points-balance-label', '16px'], ['transaction-description', '16px'],
    ['cash-wallet-tab-active', '17px'], ['cash-wallet-tab-inactive', '17px'],
    ['points-tab-active', '17px'], ['points-tab-inactive', '17px'],
    ['cash-wallet-details-form-label', '17px'], ['points-form-label', '17px'],
    ['customer-action-dropdown-item', '17px'], ['customer-option-menu-label', '17px'],
    ['verified-status-filter-button', '17px'],
    ['cash-wallet-details-form-input', '18px'], ['cash-wallet-details-form-textarea', '18px'],
    ['points-form-input', '18px'], ['points-form-textarea', '18px'],
    ['transaction-code', '21px']
  ])
  expect(probed.size, 'every migrated site must be probed').toBe(ROLE_SIZES.length)

  await setRoleSizes(page, { title: '28px', 'section-title': '25px', content: '19px', secondary: '16px', control: '17px', 'control-value': '18px', identifier: '21px' })
  for (const [testid, size] of probed) {
    await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
  }
  await page.screenshot({ path: testInfo.outputPath('users-a2-propagated.png'), fullPage: true })

  // Reversible: removing the overrides restores every canonical value.
  await restoreRoleSizes(page, ROLES)
  for (const [testid, size] of ROLE_SIZES) {
    await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
  }
})

test.describe('users-a2 at 320px RTL coarse pointer and reduced motion', () => {
  test.use({ viewport: { width: 320, height: 760 }, hasTouch: true, isMobile: true })

  test('keeps the batch surfaces reflowed with 44px actions', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(batchUrl('mode=dark&rtl=true&locale=ar'))
    const surface = page.getByTestId('users-a2-styles')

    const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)

    for (const id of ['cash-wallet-container', 'cash-wallet-tabs', 'customer-header', 'points-wrapper', 'transaction-header', 'verified-status-filter']) {
      const sizes = await surface.getByTestId(id).evaluate(element => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }))
      expect(sizes.scrollWidth, id).toBeLessThanOrEqual(sizes.clientWidth + 1)
    }

    for (const id of ['cash-wallet-tab-active', 'cash-wallet-tab-inactive', 'points-tab-active', 'points-tab-inactive', 'customer-option-menu']) {
      const box = await surface.getByTestId(id).boundingBox()
      expect(box.width, id).toBeGreaterThanOrEqual(44)
      expect(box.height, id).toBeGreaterThanOrEqual(44)
    }

    await page.screenshot({ path: testInfo.outputPath('users-a2-dark-rtl-320.png'), fullPage: true })
  })
})
