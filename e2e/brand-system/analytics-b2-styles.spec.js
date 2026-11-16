import { expect, test } from './fixtures'

// The batch keeps its own harness entry so the shared compact registry in
// scripts/brand-system/harness/main.jsx is never edited by a parallel session.
const batchUrl = (query = '') => `/scripts/brand-system/harness/analytics-b2.html?${query}`

const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']

// Reviewed role assignment for b2-analytics-charts: 18 migrated sites (the old chart cards of the reports pages were deleted).
//
// In ruleset order, because verify-spec-tables pairs entry i with rule i. Both this
// table and the fixture are GENERATED from the ruleset: the rows of this batch repeat
// the same card shape, and writing that out by hand across so many near-copies is how
// near-copies drift apart.
const ROLE_SIZES = [
  ['cs-customer-satisfaction-header-p', '18px'], // section-title
  ['cs-score-div-p', '14px'], // content
  ['do-chart-header-container-p', '18px'], // section-title
  ['do-chart-footer-container-h2', '22px'], // title
  ['do-chart-footer-container-p', '14px'], // content
  ['m-heat-map-toggle-wrap-root', '13px'], // control
  ['oas-orders-accept-spend-header-p', '18px'], // section-title
  ['oas-review-content-wrapper-p', '14px'], // content
  ['os-order-status-header-p', '18px'], // section-title
  ['os-order-status-footer-h2', '22px'], // title
  ['os-order-status-footer-p', '14px'], // content
  ['sl-analytics-spend-list-header-p', '18px'], // section-title
  ['sl-review-content-wrapper-p', '14px'], // content
  ['st-chart-header-container-p', '18px'], // section-title
  ['to-analytics-top-orders-header-p', '18px'], // section-title
  ['to-top-orders-content-p', '14px'], // content
  ['to-percent-container-root', '14px'], // content
  ['to-value-container-root', '14px'] // content
]

// Ten of the batch's twelve render here. The other two are dead CSS: a
// `TimeContentWrapper p` declaration that reaches no node the product renders, in the
// loading branch or in the loaded branch. An earlier version of this file
// mounted a `<p>` there so this table could assert 14px over it, which is a green
// assertion about a node that does not exist; the generator now drops a preservation
// whose own reason says no fixture can mount it.
//
// What stays: the glyph sizes, and the hero figure at 52px, preserved because no role
// in the governed scale covers it and migrating it would be a redesign rather than an
// adoption. The batch record carries the measurement behind that.
const PRESERVATIONS = [
  ['cs-action-block-svg', '16px'],
  ['cs-star-content-svg', '14px'],
  ['do-action-block-svg', '16px'],
  ['oas-time-content-wrapper-h1', '52px'],
  ['oas-review-block-svg', '32px'],
  ['os-action-block-svg', '16px'],
  ['sl-time-content-wrapper-h1', '52px'],
  ['sl-review-block-svg', '32px'],
  ['st-action-block-svg', '16px'],
  ['to-action-block-svg', '16px']
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
  test(`analytics-b2 keeps governed typography in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('analytics-b2-styles')
    for (const [testid, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
    }
    await page.screenshot({ path: testInfo.outputPath(`analytics-b2-${mode}.png`), fullPage: true })
  })
}

test('the card headers all resolve to one role', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('analytics-b2-styles')

  // The rows name this component several different ways -- ChartHeaderContainer,
  // OrderStatusHeader, ProductCategoryHeader, RegisterUsersHeader and so on -- and
  // they are all the card's title. Deciding them by NAME is how the tool reported
  // "no precedent" for triples that b1 had already settled; deciding them by job is
  // why they come out together.
  const headers = ROLE_SIZES.filter(([id]) => /header$|-p$/.test(id) && id.includes('header'))
  const sizes = new Set()
  for (const [testid] of headers) {
    sizes.add(await surface.getByTestId(testid).evaluate(node => getComputedStyle(node).fontSize))
  }
  expect(headers.length, 'the card headers are actually in the table').toBeGreaterThan(5)
  expect(sizes.size, 'every card header resolves to the same size').toBe(1)
})

test('the hero figure keeps its 52px when every role moves', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('analytics-b2-styles')

  // Preserved, not migrated. The largest size this adoption has ever migrated is
  // 28px; 52 -> 22 would be a 58% cut to the card's protagonist figure, which is a
  // redesign and not a typography adoption. If a display role is ever added, this is
  // the assertion that should start failing.
  const heroes = PRESERVATIONS.filter(([, size]) => size === '52px')
  expect(heroes.length, 'both hero figures are declared').toBe(2)
  await setRoleSizes(page, PROBE)
  for (const [testid] of heroes) {
    await expect(surface.getByTestId(testid), `${testid} ignores every role`).toHaveCSS('font-size', '52px')
  }
  await restoreRoleSizes(page, ROLES)
})

test('the declared preservations keep their literal size when every role moves', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('analytics-b2-styles')
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

test('central roles drive the real analytics-b2 styles and restore', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('analytics-b2-styles')

  // content and control-value both resolve to 14px today, so a site at that size
  // cannot be attributed to one role by size alone and is skipped rather than
  // asserted on a guess.
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

test('every converted chart action is a native button with a name', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('analytics-b2-styles')

  // Each of these was an `<svg onClick>`: not keyboard reachable and with no
  // accessible name, so not a control at all. b1 converted the first two of this
  // family; leaving the rest would have split one family across two batches.
  //
  // LITERAL locators, one per conversion, never a loop variable: a3 published a
  // conversion whose declared observation was built from a loop, so the expression it
  // named did not exist anywhere. verify-spec-tables requires the tagName assertion
  // specifically, because it is the one thing a styled div does not pass.
  //
  // AND WHAT THIS DOES NOT PROVE: the fixture mounts the shape written here, so it
  // cannot attest that the product's ten files were converted. That gap was
  // established in b1 by reverting one twin and watching everything stay green, and
  // it is still open. The batch record names the grep that does check the product.
  await expect(surface.getByTestId('cs-download-button')).toHaveJSProperty('tagName', 'BUTTON')
  await expect(surface.getByTestId('cs-download-button')).toHaveCount(1)
  await expect(surface.getByTestId('cs-download-button')).toHaveAttribute('type', 'button')
  await expect(surface.getByTestId('cs-download-button')).toHaveAttribute('aria-label', 'Download')
  await surface.getByTestId('cs-download-button').focus()
  await expect(surface.getByTestId('cs-download-button')).toBeFocused()

  await expect(surface.getByTestId('do-expand-button')).toHaveJSProperty('tagName', 'BUTTON')
  await expect(surface.getByTestId('do-expand-button')).toHaveCount(1)
  await expect(surface.getByTestId('do-expand-button')).toHaveAttribute('type', 'button')
  await expect(surface.getByTestId('do-expand-button')).toHaveAttribute('aria-label', 'Expand')
  await surface.getByTestId('do-expand-button').focus()
  await expect(surface.getByTestId('do-expand-button')).toBeFocused()

  await expect(surface.getByTestId('do-download-button')).toHaveJSProperty('tagName', 'BUTTON')
  await expect(surface.getByTestId('do-download-button')).toHaveCount(1)
  await expect(surface.getByTestId('do-download-button')).toHaveAttribute('type', 'button')
  await expect(surface.getByTestId('do-download-button')).toHaveAttribute('aria-label', 'Download CSV')
  await surface.getByTestId('do-download-button').focus()
  await expect(surface.getByTestId('do-download-button')).toBeFocused()

  await expect(surface.getByTestId('os-download-button')).toHaveJSProperty('tagName', 'BUTTON')
  await expect(surface.getByTestId('os-download-button')).toHaveCount(1)
  await expect(surface.getByTestId('os-download-button')).toHaveAttribute('type', 'button')
  await expect(surface.getByTestId('os-download-button')).toHaveAttribute('aria-label', 'Download CSV')
  await surface.getByTestId('os-download-button').focus()
  await expect(surface.getByTestId('os-download-button')).toBeFocused()

  await expect(surface.getByTestId('st-expand-button')).toHaveJSProperty('tagName', 'BUTTON')
  await expect(surface.getByTestId('st-expand-button')).toHaveCount(1)
  await expect(surface.getByTestId('st-expand-button')).toHaveAttribute('type', 'button')
  await expect(surface.getByTestId('st-expand-button')).toHaveAttribute('aria-label', 'Expand')
  await surface.getByTestId('st-expand-button').focus()
  await expect(surface.getByTestId('st-expand-button')).toBeFocused()

  await expect(surface.getByTestId('st-download-button')).toHaveJSProperty('tagName', 'BUTTON')
  await expect(surface.getByTestId('st-download-button')).toHaveCount(1)
  await expect(surface.getByTestId('st-download-button')).toHaveAttribute('type', 'button')
  await expect(surface.getByTestId('st-download-button')).toHaveAttribute('aria-label', 'Download CSV')
  await surface.getByTestId('st-download-button').focus()
  await expect(surface.getByTestId('st-download-button')).toBeFocused()

  await expect(surface.getByTestId('to-download-button')).toHaveJSProperty('tagName', 'BUTTON')
  await expect(surface.getByTestId('to-download-button')).toHaveCount(1)
  await expect(surface.getByTestId('to-download-button')).toHaveAttribute('type', 'button')
  await expect(surface.getByTestId('to-download-button')).toHaveAttribute('aria-label', 'Download CSV')
  await surface.getByTestId('to-download-button').focus()
  await expect(surface.getByTestId('to-download-button')).toBeFocused()
})

test('the wrapper button is a control and NOT a visible box', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('analytics-b2-styles')

  // The conversion turned an `<svg onClick>` into a real `<button>`, and a `<button>`
  // arrives with the browser's own chrome. Measured in this harness before the reset
  // existed: a 32x25 box with a 2px outset border and a grey fill, where the product
  // had shown a bare 16x16 icon. b1 shipped that, and nothing in the layer looked at
  // appearance, so nothing failed.
  //
  // `glyphButtonReset` removes the chrome. This is the assertion that would have
  // caught it, so it stays: the wrapper must measure exactly its glyph.
  for (const testid of [
    'cs-download-button',
    'do-expand-button',
    'do-download-button',
    'os-download-button',
    'st-expand-button',
    'st-download-button',
    'to-download-button'
  ]) {
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
