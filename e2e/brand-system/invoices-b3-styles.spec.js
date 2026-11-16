import { expect, test } from './fixtures'

// The batch keeps its own harness entry so the shared compact registry in
// scripts/brand-system/harness/main.jsx is never edited by a parallel session.
const batchUrl = (query = '') => `/scripts/brand-system/harness/invoices-b3.html?${query}`

const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']

// Reviewed role assignment for b3-invoices-pdf: 22 migrated sites (the old invoice catalog and side panel were deleted).
//
// In ruleset order, because verify-spec-tables pairs entry i with rule i. Both this
// table and the fixture are GENERATED from the ruleset, and the generator's `--check`
// refuses a fixture that is not what the ruleset derives today.
const ROLE_SIZES = [
  ['bpid-download-button-root', '13px'], // control
  ['bpid-error-wrapper-root', '14px'], // content
  ['bpr-header-container-h1', '22px'], // title
  ['bpr-payment-history-section-h3', '18px'], // section-title
  ['bpr-payment-history-section-p', '12px'], // secondary
  ['bpr-business-name-wrapper-h1', '18px'], // section-title
  ['bpr-table-thtd', '14px'], // content
  ['bpr-empty-state-p', '14px'], // content
  ['bpr-view-mode-card-h3', '14px'], // content
  ['bpr-view-mode-card-p', '12px'], // secondary
  ['bpr-method-selector-wrapper-label', '18px'], // section-title
  ['bpr-method-selector-wrapper-select', '14px'], // control-value
  ['bpr-calendar-section-label', '18px'], // section-title
  ['bpr-year-selector-span', '14px'], // control-value
  ['bpr-month-card-root', '13px'], // control
  ['bpr-period-info-text-spanlabel', '12px'], // secondary
  ['bpr-period-info-text-spandates', '14px'], // control-value
  ['bpr-download-button-root', '13px'], // control
  ['bpr-calendar-hint-root', '14px'], // content
  ['bpr-tab-button-root', '13px'], // control
  ['bpr-pagination-wrapper-span', '14px'], // content
  ['esr-action-button-root', '13px'] // control
]

// 19 of the batch's 20 render here. The other one is not mountable by any fixture,
// for a reason the ruleset itself states: a `font-size: inherit` reset or a JSX inline
// style, which declares no size of its own or is not a rendered styled declaration.
//
// Most of the rows below are the A4 invoice document, preserved as a unit.
const PRESERVATIONS = [
  ['bpid-detail-container-root', '12px'],
  ['bpid-detail-header-h1', '20px'],
  ['bpid-detail-header-p', '12px'],
  ['bpid-period-label-root', '10px'],
  ['bpid-period-value-root', '13px'],
  ['bpid-summary-label-root', '10px'],
  ['bpid-summary-value-root', '16px'],
  ['bpid-section-title-root', '14px'],
  ['bpid-day-title-root', '12px'],
  ['bpid-data-table-root', '11px'],
  ['bpid-fee-group-root', '11px'],
  ['bpid-fee-name-root', '11px'],
  ['bpid-fee-amount-root', '11px'],
  ['bpid-count-label-root', '10px'],
  ['bpid-totals-label-root', '11px'],
  ['bpid-totals-value-root', '11px'],
  ['bpid-transfer-row-span', '13px'],
  ['bpid-invoice-footer-root', '10px'],
  ['bpr-business-name-wrapper-h1svg', '0.7em']
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
  test(`invoices-b3 keeps governed typography in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('invoices-b3-styles')
    for (const [testid, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
    }
    await page.screenshot({ path: testInfo.outputPath(`invoices-b3-${mode}.png`), fullPage: true })
  })
}

test('the A4 invoice document ignores the governed scale entirely', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('invoices-b3-styles')

  // This is the batch's central decision, and it is asserted rather than described.
  // The document is preserved as a unit -- not because a CSS variable could not
  // reach it (it could: react-to-print's copyStyles rebuilds every <style> from
  // sheet.cssRules, measured) but because eleven of its sizes are 10px and 11px,
  // below the floor of a scale whose smallest role is 12px, and migrating only the
  // half that fits would desynchronise every label/value pair on one sheet.
  const document_ = PRESERVATIONS.filter(([testid]) => testid.startsWith('bpid-'))
  expect(document_.length, 'the document is the bulk of this table').toBeGreaterThan(15)
  await setRoleSizes(page, PROBE)
  for (const [testid, size] of document_) {
    await expect(surface.getByTestId(testid), `${testid} ignores every role`).toHaveCSS('font-size', size)
  }
  await restoreRoleSizes(page, ROLES)
})

// One of the preserved sizes is NOT a literal: the chevron of the business selector
// is `0.7em`, deliberately relative to the `h1` it sits in -- and that `h1` IS
// migrated, to section-title. So the glyph moves when the scale moves, by design.
// Asserting it alongside the fixed sizes claimed the opposite, and the run said so:
// expected 0.7em, received 12.6px. It gets its own assertion below instead.
const LITERAL = PRESERVATIONS.filter(([, size]) => size.endsWith('px'))
const RELATIVE = PRESERVATIONS.filter(([, size]) => !size.endsWith('px'))

test('the declared preservations keep their literal size when every role moves', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('invoices-b3-styles')
  for (const [testid, size] of LITERAL) {
    await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
  }
  await setRoleSizes(page, PROBE)
  for (const [testid, size] of LITERAL) {
    await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
  }
  await restoreRoleSizes(page, ROLES)
  for (const [testid, size] of LITERAL) {
    await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
  }
})

test('the relative glyph tracks its heading instead of a literal', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('invoices-b3-styles')

  expect(RELATIVE.length, 'this batch has exactly one relative preservation').toBe(1)
  const [testid] = RELATIVE[0]
  const ratio = () => surface.getByTestId(testid).evaluate(node =>
    Number.parseFloat(getComputedStyle(node).fontSize) /
    Number.parseFloat(getComputedStyle(node.parentElement).fontSize))

  // POLLED, not read once. The glyph's own rule carries `transition: 0.2s ease-in-out`,
  // so when the role moves its font-size ANIMATES to the new value. A single read right
  // after the change catches it mid-flight: the first version of this test did exactly
  // that and reported 0.504, which is 12.6 over 25 -- the old size against the new
  // parent. That is not the glyph refusing to follow its heading, it is a measurement
  // taken before the transition finished, and the difference matters because one of
  // those two readings would have been published as a fact about the product.
  await expect.poll(ratio, { message: 'the glyph is 0.7 of its h1' }).toBeCloseTo(0.7, 2)
  await setRoleSizes(page, PROBE)
  await expect.poll(ratio, { message: 'and stays 0.7 of it once the transition settles' }).toBeCloseTo(0.7, 2)
  await restoreRoleSizes(page, ROLES)
})

test('central roles drive the real invoices-b3 styles and restore', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('invoices-b3-styles')

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
  const surface = page.getByTestId('invoices-b3-styles')
  const surfaceFont = await surface.evaluate(node => getComputedStyle(node).fontFamily)

  // Six styled.div carrying `cursor: pointer` became styled.button at their BASE, so
  // every usage is reached. THREE of the six remain here (the other pages' tabs went
  // with the old invoice side panel); `InvoiceItemContainer` is not, and not by
  // oversight: its only typography site is the `font-size: inherit` the conversion
  // itself added, which declares no size of its own, so the fixture has nothing to
  // mount it by.
  //
  // LITERAL locators, one per conversion, never a loop variable. a3 published a
  // conversion whose declared observation was built from a loop, so the expression the
  // record named existed nowhere; b1 hit the same shape. The first version of THIS test
  // did it again -- `for (const testid of [...])` -- and verify-spec-tables named all
  // five. Third time for the same defect, which is why it is written down here.
  //
  // The leak to check alongside the tag is the USER AGENT's chrome, not any border at
  // all: ViewModeCard draws its own 2px card outline and always did. What a converted
  // button must not pick up is the browser's grey fill and its 13.33px system font.
  await expect(surface.getByTestId('bpr-view-mode-card-wrap')).toHaveJSProperty('tagName', 'BUTTON')
  await expect(surface.getByTestId('bpr-view-mode-card-wrap')).toHaveAttribute('type', 'button')
  await expect(surface.getByTestId('bpr-view-mode-card-wrap')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await surface.getByTestId('bpr-view-mode-card-wrap').focus()
  await expect(surface.getByTestId('bpr-view-mode-card-wrap')).toBeFocused()
  expect(await fontOf(page, 'bpr-view-mode-card-wrap'), 'bpr-view-mode-card-wrap keeps the surface font').toBe(surfaceFont)

  await expect(surface.getByTestId('bpr-tab-button-root')).toHaveJSProperty('tagName', 'BUTTON')
  await expect(surface.getByTestId('bpr-tab-button-root')).toHaveAttribute('type', 'button')
  await expect(surface.getByTestId('bpr-tab-button-root')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await surface.getByTestId('bpr-tab-button-root').focus()
  await expect(surface.getByTestId('bpr-tab-button-root')).toBeFocused()
  expect(await fontOf(page, 'bpr-tab-button-root'), 'bpr-tab-button-root keeps the surface font').toBe(surfaceFont)

  await expect(surface.getByTestId('bpr-month-card-root')).toHaveJSProperty('tagName', 'BUTTON')
  await expect(surface.getByTestId('bpr-month-card-root')).toHaveAttribute('type', 'button')
  await expect(surface.getByTestId('bpr-month-card-root')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await surface.getByTestId('bpr-month-card-root').focus()
  await expect(surface.getByTestId('bpr-month-card-root')).toBeFocused()
  expect(await fontOf(page, 'bpr-month-card-root'), 'bpr-month-card-root keeps the surface font').toBe(surfaceFont)
})
