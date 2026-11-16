import { expect, test } from './fixtures'

const batchUrl = (query = '') => `/scripts/brand-system/harness/stores-b3.html?${query}`
const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']
const PROBE = { title: '28px', 'section-title': '25px', content: '19px', secondary: '16px', control: '17px', 'control-value': '18px', identifier: '21px' }

// 5.1a, 5.1b, 5.2, 5.3, 5.4 and 5.15b: BusinessInformation, BusinessInfoSettingList, BusinessCategoryInfoSettingList, BusinessEmail, BusinessLocation, BusinessImages, BusinessVideos and BusinessFrontLayout were rewritten on Product; their harness nodes are gone.
// 5.16: BusinessWhiteLabel was rewritten on Product; its white-label- nodes are gone, so the secondary and section roles have no site left here.
const CONTROL = ['business-place-dropdown-item', 'business-place-name-label', 'place-group-dropdown-item', 'place-group-name-label', 'place-group-check-label', 'place-group-list-check-label']
// BusinessCustomFields was rewritten on S/MetaFieldsEditor (5.16, ); its custom-fields- nodes are gone, so the control-value and content roles have no site left here.
const CONTROL_VALUE = []
const CONTENT = []
const SECONDARY = []
const SECTION = []
const TITLE = ['business-detail-info-heading', 'business-place-header-title', 'place-group-header-title', 'place-group-list-header-title']

const CANONICAL = { control: '13px', 'control-value': '14px', content: '14px', secondary: '12px', 'section-title': '18px', title: '22px' }
const ROLE_SIZES = [
  ...CONTROL.map(t => [t, CANONICAL.control]),
  ...CONTROL_VALUE.map(t => [t, CANONICAL['control-value']]),
  ...CONTENT.map(t => [t, CANONICAL.content]),
  ...SECONDARY.map(t => [t, CANONICAL.secondary]),
  ...SECTION.map(t => [t, CANONICAL['section-title']]),
  ...TITLE.map(t => [t, CANONICAL.title])
]

const GLYPH_PRESERVATIONS = [
  ['business-place-action-icon', '20px'],
  ['place-group-action-icon', '20px'],
  ['place-group-check-icon', '16px'],
  ['place-group-item-icon', '16px'],
  ['place-group-list-check-icon', '16px'],
  ['place-group-list-item-icon', '16px']
]

const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, value] of Object.entries(values)) document.documentElement.style.setProperty(`--od-type-${role}-size`, value)
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-type-${role}-size`)
}, roles)

for (const mode of ['light', 'dark']) {
  test(`stores-b3 keeps governed typography and native controls in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('stores-b3-styles')

    for (const [testid, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
    }

    // Native, separated actions: the controls this batch converted (the category tab, the images and videos delete actions)
    // left with their styles.js (), and none of the four styles.js still mounted declares a focus style,
    // so the aria-pressed and keyboard-focus checks have no subject left here.

    await page.screenshot({ path: testInfo.outputPath(`stores-b3-${mode}.png`), fullPage: true })
  })
}

test('the six declared glyph preservations keep their literal size', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('stores-b3-styles')
  for (const [testid, size] of GLYPH_PRESERVATIONS) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
  await setRoleSizes(page, PROBE)
  for (const [testid, size] of GLYPH_PRESERVATIONS) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
  await restoreRoleSizes(page, ROLES)
})

test('central roles drive the real stores-b3 styles and restore', async ({ page }, testInfo) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('stores-b3-styles')
  const probed = new Map([
    ...CONTROL.map(t => [t, PROBE.control]),
    ...CONTROL_VALUE.map(t => [t, PROBE['control-value']]),
    ...CONTENT.map(t => [t, PROBE.content]),
    ...SECONDARY.map(t => [t, PROBE.secondary]),
    ...SECTION.map(t => [t, PROBE['section-title']]),
    ...TITLE.map(t => [t, PROBE.title])
  ])
  expect(probed.size, 'every migrated site must be probed').toBe(ROLE_SIZES.length)

  await setRoleSizes(page, PROBE)
  for (const [testid, size] of probed) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
  await page.screenshot({ path: testInfo.outputPath('stores-b3-propagated.png'), fullPage: true })

  await restoreRoleSizes(page, ROLES)
  for (const [testid, size] of ROLE_SIZES) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
})

test.describe('stores-b3 at 320px RTL coarse pointer', () => {
  test.use({ viewport: { width: 320, height: 760 }, hasTouch: true, isMobile: true })

  test('keeps the batch surfaces reflowed', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(batchUrl('mode=dark&rtl=true&locale=ar'))

    // The category tab's and the videos delete action's 44px checks left with their styles.js ().
    const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)

    await page.screenshot({ path: testInfo.outputPath('stores-b3-dark-rtl-320.png'), fullPage: true })
  })
})
