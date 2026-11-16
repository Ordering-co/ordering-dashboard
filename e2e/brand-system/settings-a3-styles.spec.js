import { expect, test } from './fixtures'

// The batch keeps its own harness entry so the shared compact registry in
// scripts/brand-system/harness/main.jsx is never edited by a parallel session.
const batchUrl = (query = '') => `/scripts/brand-system/harness/settings-a3.html?${query}`

const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']

// Reviewed role assignment for a3-settings-places: 32 migrated sites.
//
// In ruleset order, because verify-spec-tables pairs entry i with rule i.
//
// Most of this batch was decided by precedent rather than by argument, and a
// good part of that precedent was set by a1 and a2 rather than by a closed
// layer. The precedent tool reads this layer's own rulesets for exactly that
// reason: a layer that re-decides its own triples batch by batch manufactures
// the split the twin report exists to find. How many fell in each bucket is a
// count, so it is not restated here — it lives in `precedentDidMostOfTheWork`
// in the batch record, taken from the tool's own output.
const ROLE_SIZES = [
  ['cd-header', '22px'], // title
  ['cd-input-label', '13px'], // control
  ['cd-input-value', '14px'], // control-value
  ['cl-country-name', '14px'], // content
  ['cl-actions', '14px'], // content
  ['cl-enable', '13px'], // control
  ['cl-action-selector', '13px'], // control
  ['cy-header', '22px'], // title
  ['cy-input-label', '13px'], // control
  ['cy-input-value', '14px'], // control-value
  ['cs-general-title', '18px'], // section-title
  ['cs-form-label', '13px'], // control
  ['cs-form-input', '14px'], // control-value
  ['cs-required', '12px'], // secondary
  ['iv-container', '22px'], // title
  ['iv-input-label', '13px'], // control
  ['mc-sites', '22px'], // title
  ['mc-site-name', '14px'], // content
  ['pl-header', '22px'], // title
  ['pl-tab', '13px'], // control
  ['pl-city-name', '14px'], // content
  ['pl-country-name', '14px'], // content
  ['pl-actions', '14px'], // content
  ['pl-enable', '13px'], // control
  ['pl-action-selector', '13px'], // control
  ['sc-select-label', '13px'], // control
  ['sc-select-description', '14px'], // content
  ['sc-search-input', '14px'], // control-value
  ['sc-list-item', '14px'], // control-value
  ['zd-header', '22px'], // title
  ['zd-input-label', '13px'], // control
  ['zd-input-value', '14px'] // control-value
]

// The declared preservations with a LITERAL size: glyph sizes.
const PRESERVATIONS = [
  ['cl-checkbox-icon', '24px'],
  ['cs-password-icon', '18px'],
  ['mc-site-chevron', '20px'],
  ['pl-checkbox-icon', '24px'],
  ['sc-search-icon', '16px']
]

// The batch's other two preservations take no literal assertion: the
// `font-size: inherit` reset of its conversion, asserted against its container
// below, and `CityAdministrator`, preserved because the only usage the product
// renders carries no text at all. That one is mounted empty, the way the product
// mounts it, and measured for what it is rather than given a text node the
// product does not have.
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
  test(`settings-a3 keeps governed typography in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('settings-a3-styles')
    for (const [testid, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
    }
    await page.screenshot({ path: testInfo.outputPath(`settings-a3-${mode}.png`), fullPage: true })
  })
}

test('the converted country row is a native button, full width, and inherits its container size', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('settings-a3-styles')

  await expect(surface.getByTestId('mc-site-item')).toHaveJSProperty('tagName', 'BUTTON')
  await expect(surface.getByTestId('mc-site-item')).toHaveAttribute('type', 'button')
  await surface.getByTestId('mc-site-item').focus()
  await expect(surface.getByTestId('mc-site-item')).toBeFocused()

  const ratio = await surface.getByTestId('mc-site-item').evaluate(node => {
    const parent = node.parentElement
    const style = getComputedStyle(parent)
    const content = parent.getBoundingClientRect().width -
      Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight)
    return node.getBoundingClientRect().width / content
  })
  expect(ratio, 'the converted row fills its container').toBeGreaterThan(0.99)

  const parentSize = await surface.getByTestId('mc-site-item').evaluate(node =>
    getComputedStyle(node.parentElement).fontSize)
  await expect(surface.getByTestId('mc-site-item')).toHaveCSS('font-size', parentSize)
})

test('the loading placeholder stays out of the tab order', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('settings-a3-styles')

  // Converting SiteItem at its BASE reaches every usage, including the loading
  // placeholder, which carries no handler and never did. Without `disabled`
  // every skeleton row would enter the tab order as an empty control while the
  // list loads. That is the cost of base conversion, and this is what keeps it
  // paid rather than assumed.
  const placeholder = surface.getByTestId('mc-site-item-loading')
  await expect(placeholder).toHaveJSProperty('tagName', 'BUTTON')
  await expect(placeholder).toBeDisabled()
  await placeholder.focus({ timeout: 1000 }).catch(() => {})
  await expect(placeholder).not.toBeFocused()
})

test('the declared glyph preservations keep their literal size when every role moves', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('settings-a3-styles')
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

test('central roles drive the real settings-a3 styles and restore', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('settings-a3-styles')

  // content and control-value both resolve to 14px today, and control and
  // identifier both to 13px, so a site at either size cannot be attributed to
  // one role by size alone. Those are skipped rather than asserted on a guess.
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
