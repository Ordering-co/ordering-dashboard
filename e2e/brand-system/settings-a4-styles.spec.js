import { expect, test } from './fixtures'

// The batch keeps its own harness entry so the shared compact registry in
// scripts/brand-system/harness/main.jsx is never edited by a parallel session.
const batchUrl = (query = '') => `/scripts/brand-system/harness/settings-a4.html?${query}`

const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']

// Reviewed role assignment for a4-settings-integrations: 76 migrated sites.
//
// In ruleset order, because verify-spec-tables pairs entry i with rule i. This
// table was GENERATED from that ruleset rather than typed, for the reason the
// batch record gives under `theSpecTableIsGeneratedNotTyped`: most of the
// connector files in this batch are near-copies of each other, and a table
// typed by hand across near-copies is how identical triples end up carrying
// different roles.
const ROLE_SIZES = [
  ['ak-header', '22px'], // title
  ['ak-th', '14px'], // content
  ['ak-dropdown', '13px'], // control
  ['bc-container-all-setting', '13px'], // control
  ['bc-header', '22px'], // title
  ['bc-th', '14px'], // content
  ['bc-dropdown', '13px'], // control
  ['bc-add-new', '13px'], // control
  ['bc-all-setting', '13px'], // control
  ['bc-description', '14px'], // content
  ['bc-tab', '13px'], // control
  ['bc-paragraph-h3', '18px'], // section-title
  ['bc-paragraph-p', '14px'], // content
  ['bc-paragraph-span', '14px'], // content
  ['bc-paragraph-a', '13px'], // control
  ['dl-container-all-setting', '13px'], // control
  ['dl-header', '22px'], // title
  ['dl-header-button', '12px'], // secondary
  ['dl-th', '14px'], // content
  ['dl-dropdown', '13px'], // control
  ['dl-add-new', '13px'], // control
  ['dl-all-setting', '13px'], // control
  ['dl-description', '14px'], // content
  ['dl-tab', '13px'], // control
  ['dl-get-started-h2', '18px'], // section-title
  ['dl-get-started-p', '12px'], // secondary
  ['dd-container-all-setting', '13px'], // control
  ['dd-header', '22px'], // title
  ['dd-th', '14px'], // content
  ['dd-dropdown', '13px'], // control
  ['dd-add-new', '13px'], // control
  ['dd-all-setting', '13px'], // control
  ['dd-description', '14px'], // content
  ['dd-tab', '13px'], // control
  ['dd-paragraph-h2', '18px'], // section-title
  ['dd-paragraph-p', '14px'], // content
  ['dd-paragraph-span', '14px'], // content
  ['dd-paragraph-a', '13px'], // control
  ['il-header', '22px'], // title
  ['il-category-h2', '18px'], // section-title
  ['il-item-title', '13px'], // control
  ['il-item-description', '12px'], // secondary
  ['il-tab', '13px'], // control
  ['ic-container-all-setting', '13px'], // control
  ['ic-header', '22px'], // title
  ['ic-header-button', '12px'], // secondary
  ['ic-th', '14px'], // content
  ['ic-dropdown', '13px'], // control
  ['ic-add-new', '13px'], // control
  ['ic-description', '14px'], // content
  ['ic-description-sub-header', '14px'], // content
  ['ic-description-menu-item', '14px'], // content
  ['ic-tab', '13px'], // control
  ['ic-get-started-h2', '18px'], // section-title
  ['ic-get-started-p', '12px'], // secondary
  ['lm-container-all-setting', '13px'], // control
  ['lm-header', '22px'], // title
  ['lm-header-button', '12px'], // secondary
  ['lm-th', '14px'], // content
  ['lm-dropdown', '13px'], // control
  ['lm-add-new', '13px'], // control
  ['lm-all-setting', '13px'], // control
  ['lm-description', '14px'], // content
  ['lm-tab', '13px'], // control
  ['lm-paragraph-h2', '18px'], // section-title
  ['lm-paragraph-p', '14px'], // content
  ['lm-paragraph-span', '14px'], // content
  ['lm-paragraph-a', '13px'], // control
  ['pl-header', '22px'], // title
  ['pl-th', '12px'], // secondary
  ['pl-td', '14px'], // content
  ['pl-enable', '13px'], // control
  ['pl-action-selector', '13px'], // control
  ['wh-header', '22px'], // title
  ['wh-th', '14px'], // content
  ['wh-dropdown', '13px'] // control
]

// Seven of the 76 rules are ONE declaration under a multi-selector — `tr > th,
// td` in the four *ListTable copies, and `th, td` in WebhookListTable. The table
// above names the `th` of each, because one rule is one site and the table must
// pair with the ruleset one to one. The `td` half is measured here: it is the
// same declaration, so if it ever stops matching, the pair diverges.
const MULTI_SELECTOR_TWINS = [
  ['ak-th', 'ak-td'],
  ['bc-th', 'bc-td'],
  ['dl-th', 'dl-td'],
  ['dd-th', 'dd-td'],
  ['ic-th', 'ic-td'],
  ['lm-th', 'lm-td'],
  ['wh-th', 'wh-td']
]

// The declared preservations of this batch, each with its literal size, all of
// them an icon glyph of IntegrationListing rather than readable text. The three
// preservations that can be observed, in ruleset order: the card icon's
// glyph, the chevron of the stacked row (a direct child of the container) and the
// compact icon's glyph. The values were MEASURED in the browser against the real
// styled components, not copied from the ruleset.
const PRESERVATIONS = [
  ['il-icon', '24px'],
  ['il-chevron', '18px'],
  ['il-icon-compact', '16px']
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
  test(`settings-a4 keeps governed typography in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('settings-a4-styles')
    for (const [testid, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
    }
    await page.screenshot({ path: testInfo.outputPath(`settings-a4-${mode}.png`), fullPage: true })
  })
}

test('both halves of every multi-selector rule move together', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('settings-a4-styles')

  for (const [th, td] of MULTI_SELECTOR_TWINS) {
    const thSize = await surface.getByTestId(th).evaluate(node => getComputedStyle(node).fontSize)
    await expect(surface.getByTestId(td), `${td} shares the declaration of ${th}`).toHaveCSS('font-size', thSize)
  }

  await setRoleSizes(page, PROBE)
  for (const [th, td] of MULTI_SELECTOR_TWINS) {
    const thSize = await surface.getByTestId(th).evaluate(node => getComputedStyle(node).fontSize)
    await expect(surface.getByTestId(td), `${td} still shares it under probe`).toHaveCSS('font-size', thSize)
  }
  await restoreRoleSizes(page, ROLES)
})

test('the dead exports of this batch are measurable where they are mounted', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('settings-a4-styles')

  // ApiKeysListTable, DropdownButtonWrapper, AddNewButton and AllSetting are
  // exported by the connector files and rendered by none of them. This layer
  // migrates a dead EXPORT and preserves a dead SELECTOR, and the difference is
  // exactly this assertion: an export can be mounted, so its migration can be
  // measured; a selector inside a live component cannot be reached at all.
  const dead = [
    ['bc-th', '14px'], ['bc-dropdown', '13px'], ['bc-add-new', '13px'], ['bc-all-setting', '13px'],
    ['dl-th', '14px'], ['dl-dropdown', '13px'], ['dl-add-new', '13px'], ['dl-all-setting', '13px'],
    ['dd-th', '14px'], ['dd-dropdown', '13px'], ['dd-add-new', '13px'], ['dd-all-setting', '13px']
  ]
  for (const [testid, size] of dead) {
    await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
  }
  await setRoleSizes(page, PROBE)
  for (const [testid, size] of dead) {
    const moved = size === '14px' ? '19px' : '17px'
    await expect(surface.getByTestId(testid), `${testid} is genuinely on its role`).toHaveCSS('font-size', moved)
  }
  await restoreRoleSizes(page, ROLES)
})

test('the declared glyph preservations keep their literal size when every role moves', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('settings-a4-styles')
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

test('central roles drive the real settings-a4 styles and restore', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('settings-a4-styles')

  // Unlike a1 through a3, this batch skips nothing. It uses five roles —
  // title, section-title, content, secondary and control — and neither
  // control-value nor identifier appears in it, so no two roles collide on a
  // size here and every one of the 76 sites can be attributed to its role by
  // moving that role alone.
  const expected = { '22px': '28px', '18px': '25px', '14px': '19px', '12px': '16px', '13px': '17px' }

  await setRoleSizes(page, PROBE)
  for (const [testid, size] of ROLE_SIZES) {
    await expect(surface.getByTestId(testid), `${testid} moves with its role`).toHaveCSS('font-size', expected[size])
  }
  await restoreRoleSizes(page, ROLES)
  for (const [testid, size] of ROLE_SIZES) {
    await expect(surface.getByTestId(testid), `${testid} restores`).toHaveCSS('font-size', size)
  }
})
