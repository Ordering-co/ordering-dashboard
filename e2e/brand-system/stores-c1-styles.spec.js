import { expect, test } from './fixtures'

// Generated from scripts/brand-system/l4-c1-product-core-typography-rules.json,
// not written by hand. c1 is the first batch where a THIRD of the sites are
// preserved rather than migrated, so the role table and the preservation table
// both have to track the ruleset exactly.
const batchUrl = (query = '') => `/scripts/brand-system/harness/stores-c1.html?${query}`
const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']
const PROBE = { title: '28px', 'section-title': '25px', content: '19px', secondary: '16px', control: '17px', 'control-value': '18px', identifier: '21px' }

const TITLE = [
  'pdc-container-h1',
  'pmd-container-h1',
  'pmf-metatitle-root'
]
const SECTION = [
  'pdc-headertitlecontainer-h2'
]
const CONTENT = [
  'pmf-metacontainer-meta-type',
  'pmf-roundborder-root',
  'pmf-nometafield-root'
]
const SECONDARY = [
  'pdc-infowrapper-span'
]
const CONTROL = [
  'pda-propertyoption-label-first-child',
  'pda-labelcustom-root',
  'pda-priceperunit-label',
  'pdi-uploadimageicon-span',
  'pdi-inputwrapper-label',
  'pdi-inventorywrapper-span',
  'pdi-wrapper-span',
  'pdi-regularwrapper-span',
  'pdi-colorwrapper-label',
  'pdi-shapewrapper-label',
  'pmd-tab-root'
]
const CONTROL_VALUE = [
  'pda-option-root',
  'pda-optioncenter-root',
  'pda-weightwrapper-select',
  'pda-priceperunit-select',
  'pmf-metaaddcontainer-input-16',
  'pmf-metaaddcontainer-input-14'
]

const ROLE_SIZES = [
  ...TITLE.map(t => [t, '22px']),
  ...SECTION.map(t => [t, '18px']),
  ...CONTENT.map(t => [t, '14px']),
  ...SECONDARY.map(t => [t, '12px']),
  ...CONTROL.map(t => [t, '13px']),
  ...CONTROL_VALUE.map(t => [t, '14px'])
]
const PROBED = new Map([
  ...TITLE.map(t => [t, PROBE.title]),
  ...SECTION.map(t => [t, PROBE['section-title']]),
  ...CONTENT.map(t => [t, PROBE.content]),
  ...SECONDARY.map(t => [t, PROBE.secondary]),
  ...CONTROL.map(t => [t, PROBE.control]),
  ...CONTROL_VALUE.map(t => [t, PROBE['control-value']])
])

// Icon glyphs: a role must never reach them.
const GLYPH_PRESERVATIONS = [
  ['pdi-shapeboxwrapper-svg', '16px'],
  ['pmf-metacontainer-meta-value-svg', '20px']
]

// (main sync, ): the two hero preservations of the
// menu-import state screens (pst-importmenucontainer-h2 24px / -p 20px) were
// removed with Stores/ProductStep, which main deleted on purpose; glyph
// preservations 4 and total preservations 6 -> 4.
// ProductSummary was deleted as dead code; its 12 role sites (ps-, ROLE_SIZES 37 -> 25), the
// never-painting ps-rolwrapper-h4-20 node and its two glyph preservations (4 -> 2) went with it.

// The 22 declarations of ProductDesktopPreview. It renders a MINIATURE
// SIMULATION of the product modal the shopper sees, inside a Modal titled
// 'Preview', with a desktop/mobile toggle and a 325x650 phone frame, and with
// zero onChange handlers. Applying dashboard roles would destroy the fidelity
// the component exists to provide. Same contract as BusinessPreview in b2.
const SIMULATION_PRESERVATIONS = [
  ['pdp-modalheader-svg', '16px'],
  ['pdp-productinfo-h1', '20px'],
  ['pdp-productinfo-price-wrapper-span', '14px'],
  ['pdp-productinfo-price-wrapper-price-discount', '12px'],
  ['pdp-productinfo-p', '13px'],
  ['pdp-skucontent-h2', '16px'],
  ['pdp-skucontent-p', '14px'],
  ['pdp-sectiontitle-root', '14px'],
  ['pdp-tab-root', '12px'],
  ['pdp-ingredientcontainer-span', '12px'],
  ['pdp-optiontitle-root', '14px'],
  ['pdp-optiontitle-span-not-first-child', '12px'],
  ['pdp-optionflag-root', '12px'],
  ['pdp-iconcontrol-svg', '25px'],
  ['pdp-suoptiontext-root', '12px'],
  ['pdp-quantitycontrol-root', '12px'],
  ['pdp-quantitycontrol-svg', '16px'],
  ['pdp-positioncontrol-root', '18px'],
  ['pdp-positioncontrol-svg', '16px'],
  ['pdp-suboptionprice-root', '14px'],
  ['pdp-productactions-div-price', '14px'],
  ['pdp-productactions-button-add', '12px']
]

const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, value] of Object.entries(values)) document.documentElement.style.setProperty(`--od-type-${role}-size`, value)
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-type-${role}-size`)
}, roles)

for (const mode of ['light', 'dark']) {
  test(`stores-c1 keeps governed typography and its native tab in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('stores-c1-styles')

    expect(ROLE_SIZES.length, 'every OBSERVABLE migrated site must be asserted').toBe(25)
    for (const [testid, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
    }

    const tab = surface.getByTestId('pmd-tab-root').first()
    await expect(tab).toHaveAttribute('type', 'button')
    await expect(tab).toHaveAttribute('aria-pressed', 'true')
    await tab.focus()
    await expect(tab).toBeFocused()
    await expect(tab).toHaveCSS('outline-width', '2px')

    await page.screenshot({ path: testInfo.outputPath(`stores-c1-${mode}.png`), fullPage: true })
  })
}

test('glyph preservations keep their literal size', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('stores-c1-styles')
  const all = [...GLYPH_PRESERVATIONS]
  expect(all.length).toBe(2)
  for (const [testid, size] of all) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
  await setRoleSizes(page, PROBE)
  for (const [testid, size] of all) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
  await restoreRoleSizes(page, ROLES)
})

test('no role reaches the ProductDesktopPreview storefront simulation', async ({ page }, testInfo) => {
  await page.goto(batchUrl('mode=light'))
  const simulation = page.getByTestId('c1-storefront-simulation')
  await expect(simulation).toBeVisible()
  expect(SIMULATION_PRESERVATIONS.length, 'the whole simulation must be covered').toBe(22)

  for (const [testid, size] of SIMULATION_PRESERVATIONS) {
    await expect(simulation.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }

  // The load-bearing assertion: moving EVERY role must leave the simulation
  // untouched. That is what preserving it whole means.
  await setRoleSizes(page, PROBE)
  for (const [testid, size] of SIMULATION_PRESERVATIONS) {
    await expect(simulation.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
  await simulation.screenshot({ path: testInfo.outputPath('stores-c1-simulation-under-probe.png') })
  await restoreRoleSizes(page, ROLES)
})

test('central roles drive the real stores-c1 styles and restore', async ({ page }, testInfo) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('stores-c1-styles')
  expect(PROBED.size).toBe(ROLE_SIZES.length)

  await setRoleSizes(page, PROBE)
  for (const [testid, size] of PROBED) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
  await page.screenshot({ path: testInfo.outputPath('stores-c1-propagated.png'), fullPage: true })

  await restoreRoleSizes(page, ROLES)
  for (const [testid, size] of ROLE_SIZES) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
})

test.describe('stores-c1 at 320px RTL coarse pointer', () => {
  test.use({ viewport: { width: 320, height: 760 }, hasTouch: true, isMobile: true })

  test('keeps the converted tab at 44px', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(batchUrl('mode=dark&rtl=true&locale=ar'))
    const box = await page.getByTestId('stores-c1-styles').getByTestId('pmd-tab-root').first().boundingBox()
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
    await page.screenshot({ path: testInfo.outputPath('stores-c1-dark-rtl-320.png'), fullPage: true })
  })
})
