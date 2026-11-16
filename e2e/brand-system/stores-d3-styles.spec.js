import { expect, test } from './fixtures'

// Generated from scripts/brand-system/l4-d3-importers-single-guides-typography-rules.json.
// Last batch of L4.
// Lot 3.C: removed the if-, ijf-, il- and ilg- ids (ImporterForm, ImporterJobForm, ImportersList and ImportersListing moved to Product, their styles.js are gone); ROLE_SIZES 71 -> 50.
// (main sync, ): removed the rsg-, spg- and umg- ids and the L8 1.3 (P2-4) skip-action focus/hit-area tests (RestaurantSelectGuide, SelectPosGuide and UploadMenuGuide were deleted by main with their flows); ROLE_SIZES 50 -> 31, GLYPH_PRESERVATIONS 7 -> 2.
// removed the ihc- and sb- ids (ImporterHelpContent and SingleBusiness deleted as dead code) and the glyph test (its two
// preservations were sb-); ROLE_SIZES 31 -> 22, GLYPH_PRESERVATIONS 2 -> 0.
const batchUrl = (query = '') => `/scripts/brand-system/harness/stores-d3.html?${query}`
const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']
const PROBE = { title: '28px', 'section-title': '25px', content: '19px', secondary: '16px', control: '17px', 'control-value': '18px', identifier: '21px' }

const TITLE = [
  'bif-title-h2',
  'wb-turtorialendcontainier-h1',
  'wb-firststorecontainer-h1'
]
const SECTION = []
const CONTENT = [
  'sbp-businessgeneralinfo-div-product-name',
  'sbp-infoblock-div',
  'bif-conditiontitle-root',
  'bif-conditions-li',
  'bif-imageissue-p',
  'bif-imageissue-ul-li',
  'wb-firststorecontainer-p'
]
const SECONDARY = [
  'sbp-infoblock-div-product-description'
]
const CONTROL = [
  'sbce-categoryenablewrapper-span-14',
  'sbce-categoryenablewrapper-span-12',
  'sbce-actionselectorwrapper-dropdown-item',
  'sbp-businessenablewrapper-span',
  'sbsc-accordionitem-div-span',
  'sbpl-accordionitem-div-span'
]
const CONTROL_VALUE = []

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

// The three responsive pairs. Each is ONE node whose size changed with the
// viewport: 20/24 and 14/16. The 1.3.0 scale has a SINGLE size per role and
// does not model breakpoints, so adopting the role collapses the step. That is
// what adopting a fixed scale means, and it is asserted here rather than
// hidden: at 1280px and at 375px the node must show the SAME role size.
const RESPONSIVE_COLLAPSED = [
  ['bif-title-h2', 'title'],
  ['bif-conditiontitle-root', 'content'],
  ['bif-conditions-li', 'content']
]

const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, value] of Object.entries(values)) document.documentElement.style.setProperty(`--od-type-${role}-size`, value)
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-type-${role}-size`)
}, roles)

for (const mode of ['light', 'dark']) {
  test(`stores-d3 keeps governed typography in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('stores-d3-styles')
    expect(ROLE_SIZES.length, 'every migrated site must be asserted').toBe(22)
    for (const [testid, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
    }

    await page.screenshot({ path: testInfo.outputPath(`stores-d3-${mode}.png`), fullPage: true })
  })
}

test('the responsive step is collapsed onto one role size', async ({ page }) => {
  const expected = { title: '22px', content: '14px' }

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(batchUrl('mode=light'))
  const wide = page.getByTestId('stores-d3-styles')
  for (const [testid, role] of RESPONSIVE_COLLAPSED) {
    await expect(wide.getByTestId(testid).first(), `${testid} at 1280px`).toHaveCSS('font-size', expected[role])
  }

  await page.setViewportSize({ width: 375, height: 760 })
  const narrow = page.getByTestId('stores-d3-styles')
  for (const [testid, role] of RESPONSIVE_COLLAPSED) {
    await expect(narrow.getByTestId(testid).first(), `${testid} at 375px`).toHaveCSS('font-size', expected[role])
  }
})

test('central roles drive the real stores-d3 styles and restore', async ({ page }, testInfo) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('stores-d3-styles')
  expect(PROBED.size).toBe(ROLE_SIZES.length)
  await setRoleSizes(page, PROBE)
  for (const [testid, size] of PROBED) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
  await page.screenshot({ path: testInfo.outputPath('stores-d3-propagated.png'), fullPage: true })
  await restoreRoleSizes(page, ROLES)
  for (const [testid, size] of ROLE_SIZES) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
})

test.describe('stores-d3 at 320px RTL coarse pointer', () => {
  test.use({ viewport: { width: 320, height: 760 }, hasTouch: true, isMobile: true })

  test('does not overflow', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(batchUrl('mode=dark&rtl=true&locale=ar'))
    const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)
    await page.screenshot({ path: testInfo.outputPath('stores-d3-dark-rtl-320.png'), fullPage: true })
  })
})
