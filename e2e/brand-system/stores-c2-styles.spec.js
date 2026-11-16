import { expect, test } from './fixtures'

// Generated from scripts/brand-system/l4-c2-product-extras-suboptions-typography-rules.json.
const batchUrl = (query = '') => `/scripts/brand-system/harness/stores-c2.html?${query}`
const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']
const PROBE = { title: '28px', 'section-title': '25px', content: '19px', secondary: '16px', control: '17px', 'control-value': '18px', identifier: '21px' }

const TITLE = [
  'pex-header-h1',
  'pex-extraoptioneditcontainer-h2',
  'peod-header-h1',
  'peo-header-input',
  'pemf-metatitle-root',
  'peomf-metatitle-root',
  'pesmf-metatitle-root']
const SECTION = [
  'peod-modifieroptionscontainer-h2'
]
const CONTENT = [
  'pemf-metacontainer-meta-type',
  'pemf-roundborder-root',
  'peomf-metacontainer-meta-type',
  'peomf-roundborder-root',
  'pesmf-metacontainer-meta-type',
  'pesmf-roundborder-root',
  'pex-optionnamewrapper-span-name',
  'pex-details-root',
  'peof-selectboxgroup-p',
  'peo-optionnamecontainer-root-14',
  'peo-minimumpurchase-root-14',
  'peo-maxpurchase-root-14'
]
const SECONDARY = [
  'peo-optionnamecontainer-root-12',
  'peo-minimumpurchase-root-12',
  'peo-maxpurchase-root-12'
]
const CONTROL = [
  'pex-formcontrol-label',
  'peod-actionselectorwrapper-div-div-dropdown-item',
  'peod-inputwrapper-label',
  'peof-inputwrapper-label',
  'peof-enablewrapper-span',
  'peof-checkboxwrapper-label',
  'peo-actionselectorwrapper-div-div-dropdown-item',
  'pes-inputwrapper-label',
  'pes-enablewrapper-span',
  'pes-actionselectorwrapper-div-div-dropdown-item'
]
const CONTROL_VALUE = [
  'pemf-metaaddcontainer-input',
  'peomf-metaaddcontainer-input',
  'pesmf-metaaddcontainer-input',
  'peo-addoptionform-input'
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

const GLYPH_PRESERVATIONS = [
  ['pemf-metacontainer-meta-value-svg', '20px'],
  ['peomf-metacontainer-meta-value-svg', '20px'],
  ['pesmf-metacontainer-meta-value-svg', '20px'],
  ['pex-morecontainer-svg', '20px'],
  ['pex-optionnamewrapper-button-svg', '14px'],
  ['pex-details-svg', '13px'],
  ['peod-actionselectorwrapper-button-svg', '20px'],
  ['peod-actionscontainer-svg', '16px'],
  ['peof-actionscontainer-svg', '16px'],
  ['peo-optionimage-svg', '20px'],
  ['peo-actionselectorwrapper-button-svg', '20px'],
  ['peo-arrowwrpper-svg', '13px'],
  ['pes-actionscontainer-svg', '16px'],
  ['pes-actionselectorwrapper-button-svg', '20px']
]

// The three UploadImageIcon icons size themselves inside a ternary on the
// `small` prop, which the engine cannot classify, so they are preserved. The
// fixture mounts BOTH branches so both stay observable: 32px without the prop
// and 16px with it. In ProductExtraOptionForm the small branch is dead in the
// product; in the other two it is live.
const TERNARY_ICONS = [
  'peod-uploadimageicon-dyn',
  'peof-uploadimageicon-dyn',
  'pes-uploadimageicon-dyn'
]

const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, value] of Object.entries(values)) document.documentElement.style.setProperty(`--od-type-${role}-size`, value)
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-type-${role}-size`)
}, roles)

for (const mode of ['light', 'dark']) {
  test(`stores-c2 keeps governed typography in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('stores-c2-styles')
    expect(ROLE_SIZES.length, 'every migrated site must be asserted').toBe(37)
    for (const [testid, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
    }
    await page.screenshot({ path: testInfo.outputPath(`stores-c2-${mode}.png`), fullPage: true })
  })
}

test('the declared preservations keep their literal size', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('stores-c2-styles')
  expect(GLYPH_PRESERVATIONS.length + TERNARY_ICONS.length).toBe(17)

  for (const [testid, size] of GLYPH_PRESERVATIONS) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
  // Both branches of every ternary icon.
  for (const testid of TERNARY_ICONS) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', '32px')
    await expect(surface.getByTestId(`${testid}-small`).first(), `${testid}-small`).toHaveCSS('font-size', '16px')
  }

  await setRoleSizes(page, PROBE)
  for (const [testid, size] of GLYPH_PRESERVATIONS) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
  for (const testid of TERNARY_ICONS) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', '32px')
    await expect(surface.getByTestId(`${testid}-small`).first(), `${testid}-small`).toHaveCSS('font-size', '16px')
  }
  await restoreRoleSizes(page, ROLES)
})

test('central roles drive the real stores-c2 styles and restore', async ({ page }, testInfo) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('stores-c2-styles')
  expect(PROBED.size).toBe(ROLE_SIZES.length)
  await setRoleSizes(page, PROBE)
  for (const [testid, size] of PROBED) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
  await page.screenshot({ path: testInfo.outputPath('stores-c2-propagated.png'), fullPage: true })
  await restoreRoleSizes(page, ROLES)
  for (const [testid, size] of ROLE_SIZES) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
})

test.describe('stores-c2 at 320px RTL', () => {
  test.use({ viewport: { width: 320, height: 760 }, hasTouch: true, isMobile: true })

  test('does not overflow', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(batchUrl('mode=dark&rtl=true&locale=ar'))
    const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)
    await page.screenshot({ path: testInfo.outputPath('stores-c2-dark-rtl-320.png'), fullPage: true })
  })
})
