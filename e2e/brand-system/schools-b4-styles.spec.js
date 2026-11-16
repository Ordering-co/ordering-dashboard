import { expect, test } from './fixtures'

// The batch keeps its own harness entry so the shared compact registry in
// scripts/brand-system/harness/main.jsx is never edited by a parallel session.
const batchUrl = (query = '') => `/scripts/brand-system/harness/schools-b4.html?${query}`

const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']

// Single viewport, confirmed rather than inherited: the ruleset
// (scripts/brand-system/l5-b4-schools-typography-rules.json) declares no
// preservation of a breakpoint override on top of a role, so there is no
// width at which any assertion here would differ.
const VIEWPORT = { width: 1280, height: 900 }

// Reviewed role assignment for b4-schools: 16 migrated sites (removed the 8 of SchoolPrintLabels/styles.js with the file), in ruleset order,
// which is the order verify-spec-tables.mjs checks them in.
//
// The tab entry is worth reading carefully. That control was ALREADY a native
// button before this batch; what it gained was an explicit type and the selected
// state in the accessibility tree. Nothing here converted an element, and the
// fixture mounts it as the button it always was.
const ROLE_SIZES = [
  ['sch-schools-title', '22px'],
  ['sch-schools-header-actions-button', '13px'],
  ['sch-text-button', '13px'],
  ['sch-school-module-panel-title', '22px'],
  ['sch-school-module-panel-text', '14px'],
  ['sch-school-module-panel-actions-button', '13px'],
  ['sch-tab', '13px'],
  ['sch-toolbar-label', '13px'],
  ['sch-toolbar-select', '14px'],
  ['sch-table-td', '14px'],
  ['sch-form-grid-label', '13px'],
  ['sch-form-grid-select', '14px'],
  ['sch-form-actions-button', '13px'],
  ['sch-chip', '12px'],
  ['sch-report-card-h3', '18px'],
  ['sch-report-card-p', '14px']
]

// No preservation is left: the zoom glyph it pinned went with SchoolPrintLabels/styles.js (; the zoom buttons are P/IconButton).

const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, value] of Object.entries(values)) document.documentElement.style.setProperty(`--od-type-${role}-size`, value)
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-type-${role}-size`)
}, roles)

const PROBE = { title: '28px', 'section-title': '25px', content: '19px', secondary: '16px', control: '17px', 'control-value': '18px', identifier: '18px' }

for (const mode of ['light', 'dark']) {
  test(`schools-b4 keeps governed typography and native controls in ${mode}`, async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORT)
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('schools-b4-styles')

    for (const [testid, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
    }

    // Confirmed fact read from SchoolsManagement/index.js (not a size the
    // coordinator has to supply), so it is asserted directly rather than
    // left as a TODO. Tab was already `styled.button` in the product before
    // this batch; what the batch added is `type='button'` and
    // `aria-pressed`, which express the selected state in the accessibility
    // tree — not an element conversion. verify-spec-tables.mjs ties each
    // conversion the batch record declares to the expression the record says
    // observes it, and it matches that expression literally, which is why
    // this is spelled out rather than folded into a loop.
    const tab = surface.getByTestId('sch-tab')
    await expect(tab).toHaveAttribute('type', 'button')
    await expect(tab).toHaveJSProperty('tagName', 'BUTTON')
    await expect(tab).toHaveAttribute('aria-pressed', 'true')

    await page.screenshot({ path: testInfo.outputPath(`schools-b4-${mode}.png`), fullPage: true })
  })
}

test('central roles drive the real schools-b4 styles and restore', async ({ page }) => {
  await page.setViewportSize(VIEWPORT)
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('schools-b4-styles')

  // A size is attributable to a role only when exactly one role resolves to it.
  // control-value and content both resolve to 14px, and control and identifier
  // both to 13px, so those sites are skipped here rather than attributed on a
  // guess. They are covered by the positional role table above and the ruleset.
  const expected = { '22px': '28px', '18px': '25px', '14px': null, '13px': null, '12px': '16px' }

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
