import { expect, test } from './fixtures'

// The batch keeps its own harness entry so the shared compact registry in
// scripts/brand-system/harness/main.jsx is never edited by a parallel session.
const batchUrl = (query = '') => `/scripts/brand-system/harness/settings-a2.html?${query}`

const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']

// Reviewed role assignment for a2-settings-fields: 42 migrated sites.
//
// In ruleset order, because verify-spec-tables pairs entry i with rule i.
//
// The batch's ruleset carries six more rules than this table, and the gap is
// declared rather than silent: `Settings/CustomOrder` has no styles.js and keeps
// its styled components inside `index.js` without exporting them, so no fixture
// can mount them — and importing that file to reach them would pull the SDK into
// a typography harness. The batch record names all six in `unobservableRules`.
//
// The h1 rule this batch settles for the whole layer, used in BOTH directions
// here: an h1 that is the only heading of its screen takes `title`; an h1 that
// coexists with its screen's heading takes `section-title`. The
// *FieldsDetailsContainer headings are of that kind, verified by opening the
// JSX and confirming the list heading stays mounted while the panel opens.
const ROLE_SIZES = [
  ['af-header', '22px'], // title
  ['af-site-name', '14px'], // content
  ['af-details', '18px'], // section-title
  ['af-field-row', '13px'], // control
  ['af-field-name', '13px'], // control
  ['cf-header', '22px'], // title
  ['cf-site-name', '14px'], // content
  ['cf-details', '18px'], // section-title
  ['cf-field-row', '13px'], // control
  ['cf-field-name', '13px'], // control
  ['chf-header', '22px'], // title
  ['chf-site-name', '14px'], // content
  ['chf-details', '18px'], // section-title
  ['chf-field-row', '13px'], // control
  ['chf-field-name', '13px'], // control
  ['dol-name', '14px'], // content
  ['dol-city', '14px'], // content
  ['dol-country', '14px'], // content
  ['dol-actions', '14px'], // content
  ['dol-enable', '13px'], // control
  ['dol-action-selector', '13px'], // control
  ['es-accordion-title', '18px'], // section-title
  ['es-select-label', '13px'], // control
  ['es-select-value', '14px'], // control-value
  ['es-option', '14px'], // control-value
  ['gcf-select-label', '13px'], // control
  ['gcf-select-value', '14px'], // control-value
  ['gcf-option', '14px'], // control-value
  ['gcf-field-row', '13px'], // control
  ['gcf-field-name', '13px'], // control
  ['gcf-title', '22px'], // title
  ['gcf-info-content', '12px'], // secondary
  ['ii-container', '22px'], // title
  ['ii-input-label', '13px'], // control
  ['il-container', '22px'], // title
  ['il-input-label', '13px'], // control
  ['il-checkbox-label', '13px'], // control
  ['ns-accordion-title', '18px'], // section-title
  ['ns-title-label', '13px'], // control
  ['pf-header', '22px'], // title
  ['pf-input-label', '13px'], // control
  ['pf-short-label', '13px'] // control
]

// The declared preservations with a LITERAL size: glyph sizes, plus the internal
// heading of the HTML editor supplied by a vendor.
const PRESERVATIONS = [
  ['af-site-chevron', '20px'],
  ['cf-site-chevron', '20px'],
  ['chf-site-chevron', '20px'],
  ['dol-checkbox-icon', '24px'],
  ['ii-close-icon', '14px'],
  ['pf-editor-heading', '36px'],
  ['pf-camera-icon', '18px']
]

// The batch's other three preservations are the `font-size: inherit` resets of
// its accessibility conversions. They have no size of their own by design, so
// they are asserted against their container instead, below.
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
  test(`settings-a2 keeps governed typography in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('settings-a2-styles')

    for (const [testid, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
    }

    await page.screenshot({ path: testInfo.outputPath(`settings-a2-${mode}.png`), fullPage: true })
  })
}

test('the three converted site rows are native buttons that keep their full width', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('settings-a2-styles')

  await expect(surface.getByTestId('af-site-item')).toHaveJSProperty('tagName', 'BUTTON')
  await expect(surface.getByTestId('af-site-item')).toHaveAttribute('type', 'button')
  await expect(surface.getByTestId('cf-site-item')).toHaveJSProperty('tagName', 'BUTTON')
  await expect(surface.getByTestId('cf-site-item')).toHaveAttribute('type', 'button')
  await expect(surface.getByTestId('chf-site-item')).toHaveJSProperty('tagName', 'BUTTON')
  await expect(surface.getByTestId('chf-site-item')).toHaveAttribute('type', 'button')

  await surface.getByTestId('af-site-item').focus()
  await expect(surface.getByTestId('af-site-item')).toBeFocused()

  // The width assertion is the point of this test, not decoration. A div in a
  // column fills its container and a button shrinks to its content, and losing
  // that is the precise regression the deferred wave warns about. Each row is
  // measured against its own parent rather than against a number, so the test
  // still means something if the fixture's layout changes.
  for (const testid of ['af-site-item', 'cf-site-item', 'chf-site-item']) {
    // Against the parent's CONTENT box, not its border box. The first version
    // divided by `getBoundingClientRect().width`, which includes the container's
    // padding, and reported 0.9625 for a row that does fill its container — the
    // fixture's 24px gutters, not a shrunken button. An assertion that fails for
    // the wrong reason is worth no more than one that passes for the wrong one.
    const ratio = await surface.getByTestId(testid).evaluate(node => {
      const parent = node.parentElement
      const style = getComputedStyle(parent)
      const content = parent.getBoundingClientRect().width -
        Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight)
      return node.getBoundingClientRect().width / content
    })
    expect(ratio, `${testid} fills its container`).toBeGreaterThan(0.99)
  }
})

test('the converted rows still inherit their container size instead of the user agent default', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('settings-a2-styles')

  // Their two children declare their own sizes, so nothing visible depends on
  // this today. It is asserted anyway, and against the CONTAINER rather than a
  // literal: the reset is what keeps the converted node hanging off the system's
  // size instead of the user agent's, and a fixed-size assertion would pass even
  // if the `inherit` were replaced by a number.
  for (const testid of ['af-site-item', 'cf-site-item', 'chf-site-item']) {
    const parent = await surface.getByTestId(testid).evaluate(node =>
      getComputedStyle(node.parentElement).fontSize)
    await expect(surface.getByTestId(testid), `${testid} inherits its container`).toHaveCSS('font-size', parent)
  }
})

test('the declared glyph preservations keep their literal size when every role moves', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('settings-a2-styles')
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

test('central roles drive the real settings-a2 styles and restore', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('settings-a2-styles')

  // content and control-value both resolve to 14px today, and control and
  // identifier both to 13px, so a site at either size cannot be attributed to one
  // role by size alone. Those are skipped rather than asserted on a guess, and
  // are covered by ROLE_SIZES and the ruleset.
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
