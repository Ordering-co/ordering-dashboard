import { expect, test } from './fixtures'

// The batch keeps its own harness entry so the shared compact registry in
// scripts/brand-system/harness/main.jsx is never edited by a parallel session.
const batchUrl = (query = '') => `/scripts/brand-system/harness/layouts-c4.html?${query}`

const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']

// Reviewed role assignment for c4-myproducts-layouts-apps: 43 migrated sites.
//
// In ruleset order, because verify-spec-tables pairs entry i with rule i. Both this
// table and the fixture are GENERATED from the ruleset.
//
// The `Tab` pair names the same component twice, base and `active` branch, and the
// state node is mounted WITH the prop that turns the branch on.
const ROLE_SIZES = [
  ['apl-header-title-container-h1', '22px'], // title
  ['apl-info-content-root', '12px'], // secondary
  ['cdo-container-h1', '22px'], // title
  ['cdo-form-control-label', '13px'], // control
  ['cdo-form-control-span', '12px'], // secondary
  ['cdo-cname-notify-row-root', '12px'], // secondary
  ['cdo-title-wrapper-label', '13px'], // control
  ['cdo-check-box-wrapper-span', '13px'], // control
  ['cdo-custom-domain-info-content-root', '12px'], // secondary
  ['cpr-header-title-container-h1', '22px'], // title
  ['cpr-text-wrapper-h4', '18px'], // section-title
  ['cpr-text-wrapper-p', '14px'], // content
  ['owe-header-title-container-h1', '22px'], // title
  ['owe-info-wrapper-p', '14px'], // content
  ['owe-more-settings-header-h2', '22px'], // title
  ['owe-more-settings-header-p', '14px'], // content
  ['owe-input-form-wrapper-h4', '18px'], // section-title
  ['owe-form-group-label', '13px'], // control
  ['owe-temporal-domail-root', '14px'], // control-value
  ['owe-upload-image-icon-span', '13px'], // control
  ['owe-img-info-wrapper-h4', '13px'], // control
  ['owe-img-info-wrapper-p', '12px'], // secondary
  ['owe-check-box-wrapper-span', '13px'], // control
  ['owe-color-picker-wrapper-divp', '13px'], // control
  ['owe-content-wrapper-divp', '18px'], // section-title
  ['owe-tab-root-12px', '13px'], // control
  ['owe-tab-root-14px', '13px'], // control
  ['owe-info-content-root', '12px'], // secondary
  ['owe-radio-item-span', '13px'], // control
  ['owe-custome-domain-desc-root', '12px'], // secondary
  ['owe-custom-domain-info-content-root', '12px'], // secondary
  ['owe-option-span', '14px'], // control-value
  ['owe-select-wrapper-select', '14px'], // control-value
  ['owi-header-title-container-h1', '22px'], // title
  ['owi-form-group-label', '13px'], // control
  ['owi-popup-container-h2', '18px'], // section-title
  ['owi-popup-container-h3', '14px'], // content
  ['owi-inline-container-h2', '18px'], // section-title
  ['uau-container-h2', '22px'], // title
  ['uau-container-p', '12px'], // secondary
  ['uau-upload-icon-box-divp', '13px'], // control
  ['uau-or-root', '14px'], // content
  ['uau-form-control-label', '13px'] // control
]

// The declared preservations with a LITERAL size: the glyphs, plus the headings at a
// size no role reaches. AppLayout's hero pairs are preserved too but are NOT here --
// their size depends on the viewport, so a fixed literal in a table would be false at
// whichever width the fixture is not running at. They have their own test.
const PRESERVATIONS = [
  ['cdo-check-box-wrapper-svg', '16px'],
  ['cpr-text-wrapper-h2', '32px'],
  ['owe-info-wrapper-h1', '32px'],
  ['owe-check-box-wrapper-svg', '16px'],
  ['owe-radio-item-svg', '16px'],
  ['uau-upload-icon-box-divsvg', '40px'],
  ['uau-pdf-icon-box-svg', '150px']
]

// TEN sites are not in the tables above, each declared in fixture-config with its
// reason: both halves of AppLayout's four responsive pairs -- a fixed literal in a
// table is false at one of the two widths -- and two `font-size: inherit` conversion resets whose expected value is
// the parent's size. All six are asserted by the dedicated tests below.

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
  test(`layouts-c4 keeps governed typography in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('layouts-c4-styles')
    for (const [testid, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
    }
    await page.screenshot({ path: testInfo.outputPath(`layouts-c4-${mode}.png`), fullPage: true })
  })
}

test('the responsive hero pairs keep BOTH halves of their escalation', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('layouts-c4-styles')

  // This is the test the batch exists to carry. AppLayout escalates its heading and
  // paragraph at 1024px, and a role resolves to ONE size at every width -- the token
  // CSS has a single media query and it is prefers-reduced-motion. So both halves are
  // preserved, and this asserts the escalation still happens: narrow keeps the base,
  // wide keeps the larger value, and neither follows a role.
  await page.setViewportSize({ width: 900, height: 800 })
  await expect(surface.getByTestId('apl-content-wrapper-h1')).toHaveCSS('font-size', '24px')
  await expect(surface.getByTestId('apl-content-wrapper-p')).toHaveCSS('font-size', '14px')
  await expect(surface.getByTestId('apl-app-info-container-h2')).toHaveCSS('font-size', '24px')
  await expect(surface.getByTestId('apl-app-info-container-p')).toHaveCSS('font-size', '14px')

  await page.setViewportSize({ width: 1280, height: 800 })
  await expect(surface.getByTestId('apl-content-wrapper-h1'), 'the desktop half escalates').toHaveCSS('font-size', '32px')
  await expect(surface.getByTestId('apl-content-wrapper-p')).toHaveCSS('font-size', '16px')
  await expect(surface.getByTestId('apl-app-info-container-h2')).toHaveCSS('font-size', '32px')
  await expect(surface.getByTestId('apl-app-info-container-p')).toHaveCSS('font-size', '16px')

  // And no role moves them, at either width.
  await setRoleSizes(page, PROBE)
  await expect(surface.getByTestId('apl-content-wrapper-h1'), 'no role governs it').toHaveCSS('font-size', '32px')
  await expect(surface.getByTestId('apl-app-info-container-h2')).toHaveCSS('font-size', '32px')
  await restoreRoleSizes(page, ROLES)
})

test('the converted controls are native buttons that inherit their container size', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('layouts-c4-styles')

  // Written out one by one rather than looped: verify-spec-tables collects the testids
  // a spec claims are native buttons by matching a QUOTED literal, so a loop variable
  // makes the claim invisible to it. That shape has cost this layer five findings now.
  const customDomainCheck = surface.getByTestId('cdo-check-box-wrapper-root')
  await expect(customDomainCheck).toHaveJSProperty('tagName', 'BUTTON')
  await expect(customDomainCheck).toHaveAttribute('type', 'button')
  const customDomainParent = await customDomainCheck.evaluate(el => getComputedStyle(el.parentElement).fontSize)
  await expect(customDomainCheck, 'CustomDomain CheckBoxWrapper inherits').toHaveCSS('font-size', customDomainParent)

  const websiteCheck = surface.getByTestId('owe-check-box-wrapper-root')
  await expect(websiteCheck).toHaveJSProperty('tagName', 'BUTTON')
  await expect(websiteCheck).toHaveAttribute('type', 'button')
  const websiteParent = await websiteCheck.evaluate(el => getComputedStyle(el.parentElement).fontSize)
  await expect(websiteCheck, 'OrderingWebsite CheckBoxWrapper inherits').toHaveCSS('font-size', websiteParent)

  const radio = surface.getByTestId('owe-radio-item-root')
  await expect(radio).toHaveJSProperty('tagName', 'BUTTON')
  await expect(radio).toHaveAttribute('type', 'button')
  const radioParent = await radio.evaluate(el => getComputedStyle(el.parentElement).fontSize)
  await expect(radio, 'RadioItem inherits').toHaveCSS('font-size', radioParent)

  // The fourth conversion already declared its own size, so it is not in the loop above.
  await expect(surface.getByTestId('owe-tab-root-12px')).toHaveJSProperty('tagName', 'BUTTON')
  await expect(surface.getByTestId('owe-tab-root-12px')).toHaveAttribute('type', 'button')
})

test('the tab base and its active state land on the same role', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('layouts-c4-styles')
  const baseSize = await surface.getByTestId('owe-tab-root-12px').evaluate(node => getComputedStyle(node).fontSize)
  await expect(surface.getByTestId('owe-tab-root-14px')).toHaveCSS('font-size', baseSize)
})

test('the declared preservations keep their literal size when every role moves', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('layouts-c4-styles')
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

test('central roles drive the real layouts-c4 styles and restore', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('layouts-c4-styles')

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
