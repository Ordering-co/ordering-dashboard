import { expect, test } from './fixtures'

// The batch keeps its own harness entry so the shared compact registry in
// scripts/brand-system/harness/main.jsx is never edited by a parallel session.
const batchUrl = (query = '') => `/scripts/brand-system/harness/importers-c3.html?${query}`

const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']

// Reviewed role assignment for c3-importers-myproducts-core: 17 migrated sites.
//
// Connect/Importers/GloriaFoodImportModal, Connect/Importers/MenuImportModal and Connect/ImportersPanel styles were deleted as dead code; gfi-, mim-, ipl- rows went with them, together with the $mono comparison, the ipl panel-tab pair and the step-numeral pseudo-element test that only read them.
// MyProducts/AppUI/styles.js and most of BasicAppSettings/styles.js were deleted as dead code; aui- and bas- rows went with them, together with the aui tab pair, the AppUI Tab native-button check and the ThemeContainerList media-query test.
//
// In ruleset order, because verify-spec-tables pairs entry i with rule i. Both this
// table and the fixture are GENERATED from the ruleset. A further migrated site is
// asserted by its own test rather than here, because a media query has no literal a
// table row could carry; fixture-config declares which sites those are and why.
//
// Some pairs below name the same component twice: a base declaration and what its
// conditional branch sets (`active`, `$active`, `$mono`). The state node is mounted
// WITH the prop that turns the branch on (`active`) -- without it both nodes render the
// base and any test comparing them compares a node with itself, which is how c2's
// equivalent test stayed green on the very defect it was written for.
const ROLE_SIZES = [
  ['dgl-logistics-container-label', '13px'], // control
  ['dgl-order-status-wrapper-span', '13px'], // control
  ['adv-box-layout-h1h2', '18px'], // section-title
  ['adv-box-layout-h3', '14px'], // content
  ['adv-hide-check-wrapper-span', '13px'], // control
  ['adv-form-control-label', '13px'], // control
  ['adv-select-wrapper-divdivfirstchild', '14px'], // control-value
  ['adv-option-root', '14px'], // control-value
  ['adv-font-weight-item-span', '13px'], // control
  ['adv-upload-image-icon-span', '13px'], // control
  ['adv-img-info-wrapper-h4', '13px'], // control
  ['adv-img-info-wrapper-p', '12px'], // secondary
  ['adv-favicon-hint-root', '14px'], // content
  ['adv-favicon-preview-hint-root', '12px'], // secondary
  ['bas-input-file-container-filedetailsp', '14px'], // content
  ['bas-input-file-container-droptitle', '18px'], // section-title
  ['cfo-header-h1', '22px'] // title
]

// The declared preservations with a LITERAL size: glyphs, the monogram tile and the
// skeleton container.
const PRESERVATIONS = [
  ['dgl-radio-button-svg', '16px'],
  ['adv-hide-check-wrapper-svg', '16px'],
  ['adv-font-weight-item-svg', '16px'],
  ['pbl-container-root', '16px']
]

// THREE sites of this batch are NOT in the two tables above, and each is declared in
// fixture-config with its reason. A table row becomes a `toHaveCSS` on a testid, and
// for these there is no literal such an assertion could carry:
//   - `HideCheckWrapper` and `FontWeightItem` declare `font-size: inherit`, whose
//     expected value is the PARENT's size, not a literal;
//   - `WrapperEditor .note-editor > .note-dropdown-menu > h1` is Summernote's own
//     markup, which this fixture never mounts.
// The first two are asserted by the dedicated native-button test below. The
// third is not asserted at all, and saying so is the point: there is no node to
// measure without booting a third-party editor.
// (The fifth, `LogsEmptySteps li > &::before`, went with ImportersPanel/styles.js.)

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
  test(`importers-c3 keeps governed typography in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('importers-c3-styles')
    for (const [testid, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
    }
    await page.screenshot({ path: testInfo.outputPath(`importers-c3-${mode}.png`), fullPage: true })
  })
}

test('the converted controls are native buttons that inherit their container size', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('importers-c3-styles')

  // Both conversions declared `font-size: inherit`, which is the Z3 reset. It has no
  // literal to assert, so it is asserted against the parent -- which is what `inherit`
  // actually promises.
  //
  // Written out one by one instead of looped ON PURPOSE. `verify-spec-tables` collects
  // the testids a spec claims are native buttons by matching a QUOTED literal, so a
  // `for (const testid of [...])` makes the claim invisible to it and the check silently
  // covers nothing. That exact shape has now cost this layer four separate findings
  // (a3, b1, b3, and this one), which is why it is not written that way here.
  const hideCheck = surface.getByTestId('adv-hide-check-wrapper-root')
  await expect(hideCheck).toHaveJSProperty('tagName', 'BUTTON')
  await expect(hideCheck).toHaveAttribute('type', 'button')
  const hideCheckParent = await hideCheck.evaluate(el => getComputedStyle(el.parentElement).fontSize)
  await expect(hideCheck, 'HideCheckWrapper inherits its container size').toHaveCSS('font-size', hideCheckParent)

  const fontWeight = surface.getByTestId('adv-font-weight-item-root')
  await expect(fontWeight).toHaveJSProperty('tagName', 'BUTTON')
  await expect(fontWeight).toHaveAttribute('type', 'button')
  const fontWeightParent = await fontWeight.evaluate(el => getComputedStyle(el.parentElement).fontSize)
  await expect(fontWeight, 'FontWeightItem inherits its container size').toHaveCSS('font-size', fontWeightParent)
})

test('the declared preservations keep their literal size when every role moves', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('importers-c3-styles')
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

test('central roles drive the real importers-c3 styles and restore', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('importers-c3-styles')

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
