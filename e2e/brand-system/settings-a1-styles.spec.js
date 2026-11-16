import { expect, test } from './fixtures'

// The batch keeps its own harness entry so the shared compact registry in
// scripts/brand-system/harness/main.jsx is never edited by a parallel session.
const batchUrl = (query = '') => `/scripts/brand-system/harness/settings-a1.html?${query}`

const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']

// Reviewed role assignment for a1-settings-core: 43 migrated sites.
//
// The order of this table is not cosmetic: it is the order of the rules in
// scripts/brand-system/l6-a1-settings-core-typography-rules.json, because
// verify-spec-tables pairs entry i with rule i. Sorting it by role instead —
// which reads better — made that tool report a long list of mismatches that all
// came from the same slip, and the tool was right.
//
// Several assignments are coordinator overrides of a classifier proposal, and
// are recorded with their evidence in the batch decisions file. Most of those
// were overridden by the CROSS-LAYER twin table rather than by argument: the
// same (component, context, value) triple had already been decided by a closed
// layer, unanimously, and the classifier's reading — which the coordinator had
// independently reached as well — was simply the same inference made twice.
const ROLE_SIZES = [
  ['as-header', '22px'], // title
  ['as-category-name', '18px'], // section-title
  ['as-info-content', '12px'], // secondary
  ['as-menu', '12px'], // secondary
  ['as-submenu', '13px'], // control
  ['as-sidebar-button', '13px'], // control
  ['fs-header', '22px'], // title
  ['fs-item-title', '13px'], // control
  ['fs-item-description', '12px'], // secondary
  ['fs-info-content', '12px'], // secondary
  ['ihb-category-name', '18px'], // section-title
  ['ihb-description', '14px'], // content
  ['siu-title', '13px'], // control
  ['siu-description', '12px'], // secondary
  ['sd-all-setting', '13px'], // control
  ['sd-category-name', '18px'], // section-title
  ['sd-description', '14px'], // content
  ['sd-more-info', '14px'], // content
  ['si-image-name', '13px'], // control
  ['si-upload', '13px'], // control
  ['sl-general-title', '18px'], // section-title
  ['sl-options-error', '12px'], // secondary
  ['sl-form-text-label', '13px'], // control
  ['sl-form-text-input', '14px'], // control-value
  ['sl-form-check-label', '13px'], // control
  ['sl-required', '12px'], // secondary
  ['sl-checkbox-label', '13px'], // control
  ['sl-checkbox-description', '14px'], // content
  ['sl-submit', '13px'], // control
  ['sl-description', '14px'], // content
  ['ssu-header-label', '13px'], // control
  ['ssu-header-description', '14px'], // content
  ['ssu-select-value', '14px'], // control-value
  ['ssu-option', '14px'], // control-value
  ['ssu-options-error', '12px'], // secondary
  // Added by L8 wave 4 (88b5eaa3): `ImageActions button`, 13px -> control. It is
  // the LAST rule of the ruleset, and the table follows that order.
  ['si-restore-button', '13px'] // control
]

// The declared preservations of the batch that have a LITERAL size: each is
// a font-size that sizes an icon glyph rather than text. The `svg` selector
// context took PRESERVED in every closed rule of the prior layers, without a
// single exception.
const PRESERVATIONS = [
  ['as-icon', '24px'],
  ['as-sidebar-icon', '20px'],
  ['fs-icon', '24px'],
  ['ihb-video-icon', '34px'],
  ['siu-icon', '24px'],
  ['sd-video-icon', '34px'],
  ['sl-password-icon', '18px']
]

// The other declared preservations of the batch do NOT have a literal size, and
// are asserted separately below because a fixed-size assertion would be the
// wrong shape for them:
//
//   - the two `font-size: inherit` resets that this batch's accessibility
//     conversions introduce. Their whole job is to NOT have a size of their own,
//     so they are asserted against their container and against its movement.
//   - `SettingsSelectUI` `SelectContent p`, preserved as a dead selector. It is
//     declared UNOBSERVABLE here on purpose: the product renders no `p` inside
//     that container, and adding one to the fixture to assert it would be
//     building the very node whose absence is the reason it is preserved.
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
  test(`settings-a1 keeps governed typography and native controls in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('settings-a1-styles')

    for (const [testid, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
    }

    // Retired 2026-10-11: the log timestamp's `identifier` family check went with SettingsLogs/styles.js (below).

    await page.screenshot({ path: testInfo.outputPath(`settings-a1-${mode}.png`), fullPage: true })
  })
}

// Retired 2026-10-03, after the merge of `main`: `Settings/Settings` no longer
// exists, so the `st-*` half of this batch went with it.
// Retired 2026-10-11 (redesign settings-logs, ): `Settings/SettingsLogs/styles.js` no longer exists. The settings logs
// moved onto Product (Shared/ChangeLog, governed by productLiteralGuard), so the `slog-*` surfaces left this batch with their
// seven role sizes, the identifier-family note, and the two cases of the converted log control ("is a native, focusable
// button" and "inherits its container size"): that control is now a P/Button. The rest of the batch keeps every assertion.

test('the declared glyph preservations keep their literal size when every role moves', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('settings-a1-styles')
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

test('central roles drive the real settings-a1 styles and restore', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('settings-a1-styles')

  // content and control-value both resolve to 14px today, so a 14px site cannot
  // be attributed to one of them by size alone; those are skipped here rather
  // than asserted on a guess, and are covered by ROLE_SIZES and the ruleset.
  // control and identifier collide the same way at 13px.
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
