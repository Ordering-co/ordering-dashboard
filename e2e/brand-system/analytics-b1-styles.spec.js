import { expect, test } from './fixtures'

// The batch keeps its own harness entry so the shared compact registry in
// scripts/brand-system/harness/main.jsx is never edited by a parallel session.
const batchUrl = (query = '') => `/scripts/brand-system/harness/analytics-b1.html?${query}`

const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']

// Reviewed role assignment for b1-analytics-filters: 8 migrated sites (the filters of the old reports pages were deleted with it).
//
// In ruleset order, because verify-spec-tables pairs entry i with rule i. The table
// is GENERATED from the ruleset, as every batch since a4, and the generator refuses
// a testid the fixture does not mount or a testid used twice.
//
// This is the layer's earliest batch in `BusinessIntelligence`, and what is NOT in
// this table matters as much as what is: the Chart.js tick sizes of the chart twins
// are painted inside a `<canvas>`, so no CSS variable governs them and they are not
// typographic sites at all. The batch record carries the evidence.
const ROLE_SIZES = [
  ['av-header', '18px'], // section-title
  ['bt-header', '18px'], // section-title
  ['df-parent-label', '14px'], // control-value
  ['df-child-label', '14px'], // control-value
  ['df-select-button', '13px'], // control
  ['da-header', '22px'], // title
  ['da-filter', '13px'], // control
  ['gl-message', '14px'] // content
]

// The declared preservations, all glyphs: a font-size on an `svg` sizes an icon,
// not readable text. Every batch of Wave A reached the same conclusion for every
// `svg` it met, and this batch meets no exception either.
const PRESERVATIONS = [
  ['av-action-icon', '16px'],
  ['bt-action-icon', '16px'],
  ['df-parent-icon', '24px'],
  ['df-child-icon', '24px'],
  ['df-select-icon', '20px'],
  ['da-calendar-icon', '16px']
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
  test(`analytics-b1 keeps governed typography in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('analytics-b1-styles')
    for (const [testid, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
    }
    await page.screenshot({ path: testInfo.outputPath(`analytics-b1-${mode}.png`), fullPage: true })
  })
}

test('the two chart twins were converted identically', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('analytics-b1-styles')

  // `AnalyticsAvailableTimes` and `AnalyticsBusyTimes` carry identical markup at
  // identical line numbers. Their chart action icons used to hold the onClick
  // themselves -- an `<svg onClick>` is not keyboard reachable and has no accessible
  // name -- and this batch wrapped them in real buttons in BOTH.
  //
  // What this test does and does NOT do, because the first version of this comment
  // claimed more than it can deliver: it asserts the SHAPE the conversion produces,
  // mounted here. It cannot see the product's own `index.js`, so it cannot tell you
  // that both twins were really converted. That was checked by reverting ONE twin in
  // the source and re-running everything: this spec stayed green, `verify-consistent-
  // conversions` stayed green, and `verify-rendered-selectors` stayed green. The
  // section 4 detector tracks styled components rendered through `as=`, and this
  // conversion wraps an icon in a plain `<button>`; `ActionBlock`'s rule is a
  // descendant `svg`, which still reaches the glyph through the new button, so no
  // selector relationship changed either. The batch record carries that gap as a
  // declared limitation with the command that reproduces the twin check.
  // LITERAL locators, one per twin, not a loop variable: a3 published a conversion
  // whose declared observation was built from a loop and no tool could find the
  // expression it named. `verify-spec-tables` caught the same shape here.
  // `verify-spec-tables` requires a declared native-control conversion to be observed
  // by exactly this assertion, which is the one that proves the node IS a button
  // rather than merely looks like one.
  await expect(surface.getByTestId('av-action-button')).toHaveJSProperty('tagName', 'BUTTON')
  await expect(surface.getByTestId('av-action-button')).toHaveCount(1)
  await expect(surface.getByTestId('av-action-button')).toHaveAttribute('type', 'button')
  await expect(surface.getByTestId('av-action-button')).toHaveAttribute('aria-label', 'Expand')
  await surface.getByTestId('av-action-button').focus()
  await expect(surface.getByTestId('av-action-button')).toBeFocused()

  await expect(surface.getByTestId('bt-action-button')).toHaveJSProperty('tagName', 'BUTTON')
  await expect(surface.getByTestId('bt-action-button')).toHaveCount(1)
  await expect(surface.getByTestId('bt-action-button')).toHaveAttribute('type', 'button')
  await expect(surface.getByTestId('bt-action-button')).toHaveAttribute('aria-label', 'Expand')
  await surface.getByTestId('bt-action-button').focus()
  await expect(surface.getByTestId('bt-action-button')).toBeFocused()

  // And the glyph rule still reaches the icon through the new button, because
  // `ActionBlock`'s selector is a descendant `svg`, not a direct child.
  await expect(surface.getByTestId('av-action-icon')).toHaveCSS('font-size', '16px')
  await expect(surface.getByTestId('bt-action-icon')).toHaveCSS('font-size', '16px')
})

test('the two filter labels of the driver tree share one role', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('analytics-b1-styles')

  // Siblings at 15px whose click handlers sit in different places: on the node, on an
  // ancestor, and on a sibling. They are option labels of a filter, so they take one
  // role; splitting them by where the handler happens to live would separate nodes
  // that do the same job.
  const sizes = []
  for (const testid of ['df-parent-label', 'df-child-label']) {
    sizes.push(await surface.getByTestId(testid).evaluate(node => getComputedStyle(node).fontSize))
  }
  expect(new Set(sizes).size, 'the filter labels resolve to one size').toBe(1)

  // And `control` would have been FALSE for the child label, which carries no handler
  // at all: its row is selected by clicking the sibling checkbox.
  await expect(surface.getByTestId('df-child-label')).toHaveCSS('font-size', '14px')
})

test('the declared glyph preservations keep their literal size when every role moves', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('analytics-b1-styles')
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

test('central roles drive the real analytics-b1 styles and restore', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('analytics-b1-styles')

  // content and control-value both resolve to 14px today, so a site at that size
  // cannot be attributed to one role by size alone and is skipped rather than
  // asserted on a guess. control is not skipped: identifier, which would collide
  // with it at 13px, does not appear in this batch.
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

test('the wrapper button is a control and NOT a visible box', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('analytics-b1-styles')

  // The conversion turned an `<svg onClick>` into a real `<button>`, and a `<button>`
  // arrives with the browser's own chrome. Measured in this harness before the reset
  // existed: a 32x25 box with a 2px outset border and a grey fill, where the product
  // had shown a bare 16x16 icon. b1 shipped that, and nothing in the layer looked at
  // appearance, so nothing failed.
  //
  // `glyphButtonReset` removes the chrome. This is the assertion that would have
  // caught it, so it stays: the wrapper must measure exactly its glyph.
  for (const testid of ['av-action-button', 'bt-action-button']) {
    const button = surface.getByTestId(testid)
    await expect(button, `${testid} has no border`).toHaveCSS('border-top-width', '0px')
    await expect(button, `${testid} has no fill`).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expect(button, `${testid} has no padding`).toHaveCSS('padding-top', '0px')
    const box = await button.evaluate(node => {
      const wrapper = node.getBoundingClientRect()
      const glyph = node.querySelector('svg').getBoundingClientRect()
      return { wrapper: [wrapper.width, wrapper.height], glyph: [glyph.width, glyph.height] }
    })
    expect(box.wrapper, `${testid} measures exactly its glyph`).toEqual(box.glyph)
  }
})
