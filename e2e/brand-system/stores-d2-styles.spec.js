import { expect, test } from './fixtures'

// Generated from scripts/brand-system/l4-d2-taxes-fees-markups-misc-typography-rules.json.
// Lot 3.C: removed the cml- ids (ChildMapplingList moved to Product, its styles.js is gone); ROLE_SIZES 46 -> 44.
// Lot 5.1b: removed the seo- ids (SeoOptions moved to Product, its styles.js is gone); ROLE_SIZES 44 -> 41, glyph preservations 3 -> 2.
// Lot 5.12: removed the etm- and cf- ids (EditTaxManager and CustomerFees moved onto Product wrappers, their styles.js and InputFields.js are gone); ROLE_SIZES 41 -> 29, glyph preservations 2 -> 1, native checkboxes 2 -> 1 (the cf- one goes with its subject).
// Lot 5.13: removed the mf- ids (MarkupForm moved onto Product pieces, its styles.js is gone); ROLE_SIZES 29 -> 25. Glyph preservations (1) and native checkboxes (1) are unchanged.
// Lot 5.16: removed the spk- ids (SpoonityApiKey moved onto Product wrappers, its styles.js is gone); ROLE_SIZES 25 -> 22. Glyph preservations (1) and native checkboxes (1) are unchanged.
// removed the mk- ids (the /stores/markups route moved onto Product with its own CSS, Markups/styles.js is gone); ROLE_SIZES 22 -> 12, glyph preservations 1 -> 0, native checkboxes 1 -> 0 (the mk- checkbox goes with its subject, and with it its focus-ring and 44px assertions); the 320px RTL overflow check stays.
const batchUrl = (query = '') => `/scripts/brand-system/harness/stores-d2.html?${query}`
const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']
const PROBE = { title: '28px', 'section-title': '25px', content: '19px', secondary: '16px', control: '17px', 'control-value': '18px', identifier: '21px' }

const TITLE = [
  'sd-container-h1',
  'bwl-headercontainer-h1'
]
const SECTION = [
  'bwl-sectiontitle-root'
]
const SECONDARY = [
  'bwl-headercontainer-p',
  'bwl-emptywrapper-root'
]
const CONTROL = [
  'sd-uploadimageicon-span',
  'sd-inputwrapper-label',
  'sd-selectwrapper-label',
  'sd-propertyoption-label'
]
const CONTROL_VALUE = [
  'sd-option-root',
  'sd-selectwrapper-div-div-first-child',
  'sd-timeblock-select'
]

const ROLE_SIZES = [
  ...TITLE.map(t => [t, '22px']),
  ...SECTION.map(t => [t, '18px']),
  ...SECONDARY.map(t => [t, '12px']),
  ...CONTROL.map(t => [t, '13px']),
  ...CONTROL_VALUE.map(t => [t, '14px'])
]
const PROBED = new Map([
  ...TITLE.map(t => [t, PROBE.title]),
  ...SECTION.map(t => [t, PROBE['section-title']]),
  ...SECONDARY.map(t => [t, PROBE.secondary]),
  ...CONTROL.map(t => [t, PROBE.control]),
  ...CONTROL_VALUE.map(t => [t, PROBE['control-value']])
])

const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, value] of Object.entries(values)) document.documentElement.style.setProperty(`--od-type-${role}-size`, value)
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-type-${role}-size`)
}, roles)

for (const mode of ['light', 'dark']) {
  test(`stores-d2 keeps governed typography in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('stores-d2-styles')
    expect(ROLE_SIZES.length, 'every migrated site must be asserted').toBe(12)
    for (const [testid, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
    }

    await page.screenshot({ path: testInfo.outputPath(`stores-d2-${mode}.png`), fullPage: true })
  })
}

test('central roles drive the real stores-d2 styles and restore', async ({ page }, testInfo) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('stores-d2-styles')
  expect(PROBED.size).toBe(ROLE_SIZES.length)
  await setRoleSizes(page, PROBE)
  for (const [testid, size] of PROBED) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
  await page.screenshot({ path: testInfo.outputPath('stores-d2-propagated.png'), fullPage: true })
  await restoreRoleSizes(page, ROLES)
  for (const [testid, size] of ROLE_SIZES) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
})

test.describe('stores-d2 at 320px RTL coarse pointer', () => {
  test.use({ viewport: { width: 320, height: 760 }, hasTouch: true, isMobile: true })

  test('does not overflow', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(batchUrl('mode=dark&rtl=true&locale=ar'))
    const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)
    await page.screenshot({ path: testInfo.outputPath('stores-d2-dark-rtl-320.png'), fullPage: true })
  })
})
