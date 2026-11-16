import { expect, test } from './fixtures'

const batchUrl = (query = '') => `/scripts/brand-system/harness/stores-b5.html?${query}`
const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']
const PROBE = { title: '28px', 'section-title': '25px', content: '19px', secondary: '16px', control: '17px', 'control-value': '18px', identifier: '21px' }

// 5.5a: BusinessMenu was rewritten on Product and its styles.js keeps only Tab and
// TabsContainer, so the harness nodes of Title, MeunItem, MenuName and SelectButtonGroup are gone
// (menu-title, menu-item-name, menu-select-all-button, and the glyph menu-item-chevron-icon; ROLE_SIZES 57 -> 54).
// 5.5b: BusinessMenuBasicOptions was rewritten on Product and its styles.js was deleted, so
// basic-field-name, basic-schedule-heading, basic-order-type(-label) and the glyph basic-order-type-icon are gone
// (ROLE_SIZES 54 -> 51).
// BusinessMenuChannels/styles.js and BusinessMenuOptions/styles.js were deleted as dead code; channels-*, menu-options-* rows (ROLE_SIZES 51 -> 47, glyphs 12 -> 10) went with them.
// BusinessMenu/styles.js was deleted as dead code; menu-tab row (ROLE_SIZES 47 -> 46, CONTROL 22 -> 21) went with it, along with its entries in the type/aria-pressed, focus-ring and 44px checks.
const CONTROL = ['tree-item-name', 'add-form-select-label', 'add-form-upload-icon-text', 'add-form-input-label', 'add-form-skip-button', 'cat-details-name-label', 'cat-details-parent-label', 'cat-details-dropdown-item', 'cat-info-name-label', 'cat-info-parent-label', 'cat-info-dropdown-item', 'cat-info-skip-button', 'cat-info-ribbon-switch-text', 'cat-info-color-label', 'cat-info-shape-label', 'shared-details-price-label', 'shared-details-switch-label', 'shared-details-extra-text', 'shared-details-option-text', 'shared-details-suboption-text', 'shared-products-item-text']
const CONTROL_VALUE = ['add-form-option', 'add-form-select-trigger', 'add-form-time-select', 'fields-add-value-input', 'categories-selected-text', 'categories-search-input', 'cat-details-name-input', 'cat-details-option', 'cat-info-name-input', 'cat-info-option']
const CONTENT = ['fields-meta-type', 'fields-round-border', 'fields-no-metafield', 'product-list-not-found']
const SECONDARY = ['product-list-header-cell', 'listing-breadcrumb']
const SECTION = ['categories-header-title', 'listing-category-heading', 'shared-details-searchbar-label']
const TITLE = ['fields-title', 'add-form-heading', 'cat-details-enable-text', 'cat-info-heading', 'listing-business-name-heading', 'shared-details-heading']

const CANONICAL = { control: '13px', 'control-value': '14px', content: '14px', secondary: '12px', 'section-title': '18px', title: '22px' }
const ROLE_SIZES = [
  ...CONTROL.map(t => [t, CANONICAL.control]),
  ...CONTROL_VALUE.map(t => [t, CANONICAL['control-value']]),
  ...CONTENT.map(t => [t, CANONICAL.content]),
  ...SECONDARY.map(t => [t, CANONICAL.secondary]),
  ...SECTION.map(t => [t, CANONICAL['section-title']]),
  ...TITLE.map(t => [t, CANONICAL.title])
]

// Icon glyphs. A role must never reach any of them.
const GLYPH_PRESERVATIONS = [
  ['tree-checkbox-icon', '18px'],
  ['fields-header-icon', '24px'],
  ['fields-meta-value-icon', '20px'],
  ['categories-search-icon', '18px'],
  ['cat-details-action-icon', '20px'],
  ['cat-info-action-icon', '20px'],
  ['cat-info-shape-icon', '16px'],
  ['listing-view-icon', '16px'],
  ['listing-view-batch-icon', '18px'],
  ['shared-products-item-icon', '13px']
]

const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, value] of Object.entries(values)) document.documentElement.style.setProperty(`--od-type-${role}-size`, value)
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-type-${role}-size`)
}, roles)

for (const mode of ['light', 'dark']) {
  test(`stores-b5 keeps governed typography and native controls in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('stores-b5-styles')

    expect(ROLE_SIZES.length, 'every migrated site must be asserted').toBe(46)
    for (const [testid, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
    }

    // categories-enable-text carries TWO font-size declarations on the same
    // node in source, 14px then 12px. Only the last one is observable, so the
    // migrated secondary role is what renders; the control role migrated onto
    // the first declaration can never be seen.
    await expect(surface.getByTestId('categories-enable-text')).toHaveCSS('font-size', '12px')

    // cat-info-enable-text declares 20px in styles.js, but its only real call
    // site puts an inline style={{ fontSize: 15 }} on the span, which wins.
    // The fixture preserves that override, so the declared role never paints.
    await expect(surface.getByTestId('cat-info-enable-text')).toHaveCSS('font-size', '15px')

    for (const id of ['add-form-skip-button', 'cat-info-skip-button']) {
      await expect(surface.getByTestId(id), id).toHaveAttribute('type', 'button')
    }

    await page.screenshot({ path: testInfo.outputPath(`stores-b5-${mode}.png`), fullPage: true })
  })
}

test('the icon glyph preservations keep their literal size', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('stores-b5-styles')
  for (const [testid, size] of GLYPH_PRESERVATIONS) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
  await setRoleSizes(page, PROBE)
  for (const [testid, size] of GLYPH_PRESERVATIONS) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
  await restoreRoleSizes(page, ROLES)
})

test('the em-relative icon tracks its heading instead of a role', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('stores-b5-styles')
  const icon = surface.getByTestId('listing-business-name-icon')

  // Declared as 0.7em, so it is 70% of the heading it sits in. The heading took
  // the title role, which is why this one is preserved rather than migrated:
  // an absolute role would destroy exactly the relationship the em expresses.
  await expect(surface.getByTestId('listing-business-name-heading')).toHaveCSS('font-size', '22px')
  await expect(icon).toHaveCSS('font-size', '15.4px')

  await setRoleSizes(page, PROBE)
  await expect(surface.getByTestId('listing-business-name-heading')).toHaveCSS('font-size', '28px')
  await expect(icon, 'the icon must follow its heading, at 70% of it').toHaveCSS('font-size', '19.6px')
  await restoreRoleSizes(page, ROLES)
})

test('central roles drive the real stores-b5 styles and restore', async ({ page }, testInfo) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('stores-b5-styles')
  const probed = new Map([
    ...CONTROL.map(t => [t, PROBE.control]),
    ...CONTROL_VALUE.map(t => [t, PROBE['control-value']]),
    ...CONTENT.map(t => [t, PROBE.content]),
    ...SECONDARY.map(t => [t, PROBE.secondary]),
    ...SECTION.map(t => [t, PROBE['section-title']]),
    ...TITLE.map(t => [t, PROBE.title])
  ])
  expect(probed.size, 'every migrated and observable site must be probed').toBe(ROLE_SIZES.length)

  await setRoleSizes(page, PROBE)
  for (const [testid, size] of probed) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
  await page.screenshot({ path: testInfo.outputPath('stores-b5-propagated.png'), fullPage: true })

  await restoreRoleSizes(page, ROLES)
  for (const [testid, size] of ROLE_SIZES) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
})

test.describe('stores-b5 at 320px RTL coarse pointer', () => {
  test.use({ viewport: { width: 320, height: 760 }, hasTouch: true, isMobile: true })

  test('keeps the converted controls at 44px', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(batchUrl('mode=dark&rtl=true&locale=ar'))
    const surface = page.getByTestId('stores-b5-styles')
    for (const id of ['add-form-skip-button', 'cat-info-skip-button']) {
      const box = await surface.getByTestId(id).first().boundingBox()
      expect(box.width, id).toBeGreaterThanOrEqual(44)
      expect(box.height, id).toBeGreaterThanOrEqual(44)
    }
    await page.screenshot({ path: testInfo.outputPath('stores-b5-dark-rtl-320.png'), fullPage: true })
  })
})

// The category-tree checkboxes were div/span with a mouse handler. They are native buttons
// now; read them from the accessibility tree.
// 5.5a: the menu row name (MenuName) and the open-menu row (MeunItem) were
// rewritten on Product, their harness nodes are gone, so their checks are gone with them.
test('the tree checkboxes are native controls reachable with Tab', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('stores-b5-styles')

  const category = surface.getByRole('checkbox', { name: 'Sandwiches', exact: true })
  await expect(category).toHaveCount(1)
  await expect(category).toHaveJSProperty('tagName', 'BUTTON')
  await expect(category).toHaveAttribute('aria-checked', 'mixed')
  const product = surface.getByRole('checkbox', { name: 'Club sandwich', exact: true, checked: true })
  await expect(product).toHaveCount(1)
  await expect(product).toHaveJSProperty('tagName', 'BUTTON')
  await expect(product).toHaveAttribute('aria-checked', 'true')
  await expect(surface.getByTestId('tree-checkbox-icon')).toHaveAttribute('aria-hidden', 'true')
  await expect(surface.getByTestId('tree-product-checkbox-icon')).toHaveAttribute('aria-hidden', 'true')

  // The category expander is a native button, a sibling of the category checkbox, whose
  // accessible name is the category and whose state is exact.
  const toggle = surface.getByRole('button', { name: 'Sandwiches', exact: true, expanded: true })
  await expect(toggle).toHaveCount(1)
  await expect(toggle).toHaveJSProperty('tagName', 'BUTTON')
  await expect(toggle).toHaveAttribute('type', 'button')
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(toggle).toHaveAttribute('aria-controls', await surface.getByTestId('tree-content').getAttribute('id'))
  await expect(surface.getByTestId('tree-toggle-icon')).toHaveAttribute('aria-hidden', 'true')
  expect(await toggle.evaluate((e, c) => e.contains(c) || c.contains(e), await category.elementHandle())).toBe(false)

  // Tab reaches each of them, and each wears the brand focus ring.
  for (const control of [category, toggle, product]) {
    expect(await control.evaluate(e => e.tabIndex)).toBe(0)
    await control.focus()
    await expect(control).toBeFocused()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Shift+Tab')
    await expect(control).toBeFocused()
    await expect(control).toHaveCSS('outline-width', '2px')
    await expect(control).toHaveCSS('outline-style', 'solid')
  }
})

test('stores-b5 collapsed tree category keeps its products out of the tab order until it opens', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('stores-b5-styles')
  const toggle = surface.getByTestId('tree-collapsed-toggle')
  const product = surface.getByTestId('tree-collapsed-product-checkbox')
  const focused = () => page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? document.activeElement?.tagName)

  await expect(toggle).toHaveJSProperty('tagName', 'BUTTON')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(surface.getByTestId('tree-collapsed-content')).toHaveAttribute('inert', '')
  await expect(surface.getByTestId('tree-collapsed-content')).toHaveCSS('max-height', '0px')

  // Tab walks category checkbox -> expander and does not go on into the products.
  await surface.getByTestId('tree-collapsed-category-checkbox').focus()
  await page.keyboard.press('Tab')
  expect(await focused()).toBe('tree-collapsed-toggle')
  await page.keyboard.press('Tab')
  expect(await focused()).not.toBe('tree-collapsed-product-checkbox')
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Shift+Tab')
  expect(await focused()).toBe('tree-collapsed-category-checkbox')
  await product.focus()
  expect(await focused()).not.toBe('tree-collapsed-product-checkbox')

  // Enter opens it: aria-expanded flips and Tab now enters the products.
  await toggle.focus()
  await page.keyboard.press('Enter')
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(surface.getByTestId('tree-collapsed-content')).not.toHaveAttribute('inert')
  await expect(toggle).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(product).toBeFocused()
})

test.describe('stores-b5 tree checkboxes with a coarse pointer', () => {
  test.use({ viewport: { width: 1280, height: 900 }, hasTouch: true, isMobile: false })

  test('grow the hit area to 44px without moving the visible box', async ({ page }) => {
    await page.goto(batchUrl('mode=light'))
    const surface = page.getByTestId('stores-b5-styles')
    for (const id of ['tree-category-checkbox', 'tree-category-toggle', 'tree-product-checkbox']) {
      const hit = await surface.getByTestId(id).evaluate(e => {
        const after = getComputedStyle(e, '::after')
        return { height: after.height, position: getComputedStyle(e).position }
      })
      expect(hit, id).toEqual({ height: '44px', position: 'relative' })
    }
    const checkbox = await surface.getByTestId('tree-product-checkbox').evaluate(e => getComputedStyle(e, '::after').width)
    expect(checkbox).toBe('44px')
  })
})
