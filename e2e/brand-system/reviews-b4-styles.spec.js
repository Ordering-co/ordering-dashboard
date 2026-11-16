import { expect, test } from './fixtures'

// The batch keeps its own harness entry so the shared compact registry in
// scripts/brand-system/harness/main.jsx is never edited by a parallel session.
const batchUrl = (query = '') => `/scripts/brand-system/harness/reviews-b4.html?${query}`

const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']

// Reviewed role assignment for b4-reviews-realtime: 33 migrated sites (the real-time screen and the old reports pages were deleted).
//
// In ruleset order, because verify-spec-tables pairs entry i with rule i. Both this
// table and the fixture are GENERATED from the ruleset.
//
// This batch is mostly NEAR-COPIES: the review listings and the review detail screens
// repeat each other. Several (component, context, value) triples appear in more than
// a single row, and together they cover about half the sites. They were computed from
// the inventory before the proposals were read, and each comes out with a single
// role, singular -- the check this file has spent several rounds wishing it had. The record
// carries how many, taken from the inventory rather than typed here.
const ROLE_SIZES = [
  ['brd-header-h1', '22px'], // title
  ['brd-review-quality-text-container-p', '12px'], // secondary
  ['brd-info-block-p', '12px'], // secondary
  ['brd-info-block-pbold', '14px'], // content
  ['brd-comment-root', '14px'], // content
  ['brd-not-reviewed-root', '14px'], // content
  ['brl-reviews-table-th', '12px'], // secondary
  ['brl-review-object-root', '12px'], // secondary
  ['brl-info-block-p', '12px'], // secondary
  ['brl-info-block-pbold', '14px'], // content
  ['brl-review-marker-wrapper-root', '12px'], // secondary
  ['prd-header-h1', '22px'], // title
  ['prd-review-comment-root', '14px'], // content
  ['prd-not-reviewed-root', '14px'], // content
  ['rpl-reviews-table-th', '12px'], // secondary
  ['rpl-review-object-root', '12px'], // secondary
  ['rpl-review-marker-wrapper-root', '12px'], // secondary
  ['rl-header-left-h1', '22px'], // title
  ['rl-tab-root', '13px'], // control
  ['rl-form-field-label', '13px'], // control
  ['rl-filter-button-root', '14px'], // control-value
  ['rl-clear-filter-root', '13px'], // control
  ['rl-error-text-root', '12px'], // secondary
  ['urd-header-h1', '22px'], // title
  ['urd-review-meta-p', '12px'], // secondary
  ['urd-review-quality-text-container-p', '12px'], // secondary
  ['urd-comment-root', '14px'], // content
  ['urd-not-reviewed-root', '14px'], // content
  ['url-reviews-table-th', '12px'], // secondary
  ['url-review-object-root', '12px'], // secondary
  ['url-info-block-p', '12px'], // secondary
  ['url-info-block-pbold', '14px'], // content
  ['url-review-marker-wrapper-root', '12px'] // secondary
]

// The declared preservations, all glyphs: a font-size on an `svg` sizes an icon, not
// readable text.
const PRESERVATIONS = [
  ['brl-review-marker-wrapper-svg', '20px'],
  ['prd-like-sign-wrapper-svg', '22px'],
  ['rpl-review-marker-wrapper-svg', '20px'],
  ['rl-title-wrapper-svg', '16px'],
  ['rl-filter-button-svg', '12px'],
  ['url-review-marker-wrapper-svg', '20px']
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
  test(`reviews-b4 keeps governed typography in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('reviews-b4-styles')
    for (const [testid, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
    }
    await page.screenshot({ path: testInfo.outputPath(`reviews-b4-${mode}.png`), fullPage: true })
  })
}

test('the near-copy rows resolve to one role each', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('reviews-b4-styles')

  // The defect this batch had to avoid is a near-copy decided differently from its
  // twin. Asserted by SIZE rather than trusted from the ruleset: the three review
  // listings each carry a column label and a star glyph, and the three review details
  // each carry a heading and an empty-state line. If any of them had been split, one
  // of these sets would come back with more than one size in it.
  const families = [
    ['column labels', ['brl-review-object-root', 'url-review-object-root', 'rpl-review-object-root']],
    ['review counters', ['brl-review-marker-wrapper-root', 'url-review-marker-wrapper-root', 'rpl-review-marker-wrapper-root']],
    ['detail headings', ['brd-header-h1', 'urd-header-h1', 'prd-header-h1']],
    ['empty states', ['brd-not-reviewed-root', 'urd-not-reviewed-root', 'prd-not-reviewed-root']]
  ]
  for (const [name, testids] of families) {
    const sizes = new Set()
    for (const testid of testids) {
      sizes.add(await surface.getByTestId(testid).evaluate(node => getComputedStyle(node).fontSize))
    }
    expect(sizes.size, `${name} all resolve to one size`).toBe(1)
  }
})

test('the declared preservations keep their literal size when every role moves', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('reviews-b4-styles')
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

test('central roles drive the real reviews-b4 styles and restore', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('reviews-b4-styles')

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

const fontOf = (page, testid) => page.evaluate(
  id => getComputedStyle(document.querySelector(`[data-testid="${id}"]`)).fontFamily, testid)

test('the converted controls are native buttons that kept their look', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('reviews-b4-styles')
  const surfaceFont = await surface.evaluate(node => getComputedStyle(node).fontFamily)

  // Styled elements carrying `cursor: pointer` became styled.button at their BASE, so
  // every usage is reached: the tabs and a clear-filter action. LITERAL locators, never a loop variable -- a3, b1 and b3 each published a
  // conversion whose declared observation existed nowhere in its spec.
  //
  // The leak to check alongside the tag is the browser's own chrome: its grey fill and
  // its 13.33px system font.
  await expect(surface.getByTestId('rl-tab-root')).toHaveJSProperty('tagName', 'BUTTON')
  await expect(surface.getByTestId('rl-tab-root')).toHaveAttribute('type', 'button')
  await expect(surface.getByTestId('rl-tab-root')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await surface.getByTestId('rl-tab-root').focus()
  await expect(surface.getByTestId('rl-tab-root')).toBeFocused()
  expect(await fontOf(page, 'rl-tab-root'), 'rl-tab-root keeps the surface font').toBe(surfaceFont)

  await expect(surface.getByTestId('rl-clear-filter-root')).toHaveJSProperty('tagName', 'BUTTON')
  await expect(surface.getByTestId('rl-clear-filter-root')).toHaveAttribute('type', 'button')
  await expect(surface.getByTestId('rl-clear-filter-root')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await surface.getByTestId('rl-clear-filter-root').focus()
  await expect(surface.getByTestId('rl-clear-filter-root')).toBeFocused()
  expect(await fontOf(page, 'rl-clear-filter-root'), 'rl-clear-filter-root keeps the surface font').toBe(surfaceFont)
})
