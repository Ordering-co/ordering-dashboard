import { expect, test } from './fixtures'

// The batch keeps its own harness entry so the shared compact registry in
// scripts/brand-system/harness/main.jsx is never edited by a parallel session.
const batchUrl = (query = '') => `/scripts/brand-system/harness/settings-a5.html?${query}`

const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']

// Reviewed role assignment for a5-settings-language-whitelabel: 29 migrated sites (38 before deleted the
// SiteSettingDetails and SitesAuthSettings styles).
//
// In ruleset order, because verify-spec-tables pairs entry i with rule i. The
// table is GENERATED from the ruleset, as in a4, and for the same reason: this
// batch also carries near-copies — `PickerExpress` against the connector family
// a4 closed, and the SettingsMenuOption* pair against each other (the
// Purchase* pair left this batch with its styles.js: redesign ; SiteSettingDetails and SitesAuthSettings, with theirs: ) — and a hand-typed table across near-copies is how identical
// triples end up carrying different roles.
const ROLE_SIZES = [
  ['cms-header', '22px'], // title
  ['cms-th', '12px'], // secondary
  ['cms-td', '14px'], // content
  ['cms-enable', '13px'], // control
  ['cms-action', '13px'], // control
  ['lm-header', '22px'], // title
  ['lm-select-trigger', '14px'], // control-value
  ['lm-option', '14px'], // control-value
  ['lm-selector-option', '14px'], // control-value
  ['ls-container', '22px'], // title
  ['ls-field-row', '13px'], // control
  ['ls-field-name', '13px'], // control
  ['ts-th', '12px'], // secondary
  ['ts-td', '14px'], // content
  ['tt-th', '12px'], // secondary
  ['tt-td', '14px'], // content
  ['pe-container-all-setting', '13px'], // control
  ['pe-header', '22px'], // title
  ['pe-header-button', '12px'], // secondary
  ['pe-th', '14px'], // content
  ['pe-dropdown', '13px'], // control
  ['pe-add-new', '13px'], // control
  ['pe-all-setting', '13px'], // control
  ['pe-description', '14px'], // content
  ['pe-tab', '13px'], // control
  ['pe-paragraph-h2', '18px'], // section-title
  ['pe-paragraph-p', '14px'], // content
  ['pe-paragraph-span', '14px'], // content
  ['pe-paragraph-a', '13px'] // control
]

// Two of the batch's five preservations can be observed (four of ten before deleted the SiteSettingDetails
// and SitesAuthSettings styles), and they are the
// glyph ones: a font-size on an `svg` sizes an icon, not readable text. The rest
// match no node in the component's current markup, so no fixture can measure
// them without inventing the node, and the batch record names each with the
// evidence that it is unreachable.
const PRESERVATIONS = [
  ['lm-view-icon', '16px'],
  ['ls-field-default-icon', '20px']
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
  test(`settings-a5 keeps governed typography in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('settings-a5-styles')
    for (const [testid, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
    }
    await page.screenshot({ path: testInfo.outputPath(`settings-a5-${mode}.png`), fullPage: true })
  })
}

test('the select trigger selector reaches the node the real select renders', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('settings-a5-styles')

  // This is the site two classifiers disagreed about. One read only
  // `LegacySelect.jsx:191`, where the ROOT falls back to `select-wrapper`, and
  // concluded the `.select` selector was dead. The `select` token is on
  // `HeaderItem`, which the trigger is rendered with. If a future refactor moves
  // the token off the trigger, this assertion is what notices — the size would
  // silently fall back to the inherited one instead.
  for (const testid of ['lm-select-trigger']) {
    await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', '14px')
    const hasToken = await surface.getByTestId(testid).evaluate(node => node.parentElement.classList.contains('select'))
    expect(hasToken, `${testid} hangs off a node carrying the \`select\` token`).toBe(true)
  }

  await setRoleSizes(page, PROBE)
  for (const testid of ['lm-select-trigger']) {
    await expect(surface.getByTestId(testid), `${testid} is genuinely on control-value`).toHaveCSS('font-size', '18px')
  }
  await restoreRoleSizes(page, ROLES)
})

test('the field row keeps its header branch, which is the only place its rule lives', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('settings-a5-styles')

  // `FieldContainer`'s `> div` rule sits inside `isHeader && css\`...\``. a2 found
  // this by measuring 16px and believing it: without the prop the rule does not
  // exist and the browser reports its own default.
  await expect(surface.getByTestId('ls-field-row')).toHaveCSS('font-size', '13px')
  await setRoleSizes(page, { control: '17px' })
  await expect(surface.getByTestId('ls-field-row'), 'the row moves with control, so the branch is really mounted').toHaveCSS('font-size', '17px')
  await restoreRoleSizes(page, ROLES)
})

test('the declared glyph preservations keep their literal size when every role moves', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('settings-a5-styles')
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

test('central roles drive the real settings-a5 styles and restore', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('settings-a5-styles')

  // content and control-value both resolve to 14px today, so a site at that size
  // cannot be attributed to one role by size alone and is skipped rather than
  // asserted on a guess. control is not skipped here: identifier, the role that
  // would collide with it at 13px, does not appear in this batch.
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
