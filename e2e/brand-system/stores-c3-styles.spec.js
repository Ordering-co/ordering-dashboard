import { expect, test } from './fixtures'

// Generated from scripts/brand-system/l4-c3-product-media-tags-ingredients-typography-rules.json.
const batchUrl = (query = '') => `/scripts/brand-system/harness/stores-c3.html?${query}`
const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']
const PROBE = { title: '28px', 'section-title': '25px', content: '19px', secondary: '16px', control: '17px', 'control-value': '18px', identifier: '21px' }

const TITLE = [
  'pg-prodcutgallerycontainer-h1',
  'pv-prodcutvideoscontainer-h1',
  'psg-container-h2',
  'pi-header-h1',
  'pid-header-h1',
  'ptd-header-h1'
]
const CONTENT = [
  'psg-infowrapper-h3',
  'pi-ingredientoption-root',
  'ptl-producttagwrapper-span-tag-name'
]
const SECONDARY = [
  'pg-uploadimageiconcontainer-p',
  'psg-infowrapper-p'
]
const CONTROL = [
  'pg-dropdownwrapper-div-div-dropdown-item',
  'pv-addnewvideo-button',
  'pv-galleryitem-button',
  'pid-actionselectorwrapper-div-div-dropdown-item',
  'pid-inputwrapper-label',
  'ptd-uploadimageicon-span',
  'ptd-formcontroller-label',
  'ptd-actionselectorwrapper-div-div-dropdown-item',
  'ptl-selectbuttongroup-button'
]
const CONTROL_VALUE = [
  'pg-galleryitembottom-input',
  'pv-addnewvideo-input'
]
const IDENTIFIER = [
  'pv-galleryurl-root'
]

const ROLE_SIZES = [
  ...TITLE.map(t => [t, '22px']),
  ...CONTENT.map(t => [t, '14px']),
  ...SECONDARY.map(t => [t, '12px']),
  ...CONTROL.map(t => [t, '13px']),
  ...CONTROL_VALUE.map(t => [t, '14px']),
  ...IDENTIFIER.map(t => [t, '13px'])
]
const PROBED = new Map([
  ...TITLE.map(t => [t, PROBE.title]),
  ...CONTENT.map(t => [t, PROBE.content]),
  ...SECONDARY.map(t => [t, PROBE.secondary]),
  ...CONTROL.map(t => [t, PROBE.control]),
  ...CONTROL_VALUE.map(t => [t, PROBE['control-value']]),
  ...IDENTIFIER.map(t => [t, PROBE.identifier])
])

const GLYPH_PRESERVATIONS = [
  ['pg-uploadimageiconcontainer-svg', '50px'],
  ['pg-dropdownwrapper-button-svg', '20px'],
  ['psg-iconwrapper-svg', '24px'],
  ['pi-ingredientoption-svg', '13px'],
  ['pid-actionselectorwrapper-button-svg', '20px'],
  ['ptd-actionselectorwrapper-button-svg', '20px'],
  ['ptl-tagimagewrapper-svg', '16px']
]

const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, value] of Object.entries(values)) document.documentElement.style.setProperty(`--od-type-${role}-size`, value)
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-type-${role}-size`)
}, roles)

for (const mode of ['light', 'dark']) {
  test(`stores-c3 keeps governed typography and its native row in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('stores-c3-styles')
    expect(ROLE_SIZES.length, 'every migrated site must be asserted').toBe(23)
    for (const [testid, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
    }

    const row = surface.getByTestId('pi-ingredientoption-root').first()
    await expect(row).toHaveAttribute('type', 'button')
    await expect(row).toHaveAttribute('aria-pressed', 'false')
    await row.focus()
    await expect(row).toHaveCSS('outline-width', '2px')

    await page.screenshot({ path: testInfo.outputPath(`stores-c3-${mode}.png`), fullPage: true })
  })
}

test('the identifier role paints a monospaced technical value', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const url = page.getByTestId('stores-c3-styles').getByTestId('pv-galleryurl-root').first()

  // This is the THIRD user of the identifier role in all of L4, and the first
  // new one since b2. The role exists for bare technical values, and this node
  // holds nothing but a raw video URL. Asserting the family matters as much as
  // the size: identifier is the only role that changes typeface.
  await expect(url).toHaveCSS('font-size', '13px')
  const family = await url.evaluate(node => getComputedStyle(node).fontFamily)
  expect(family.toLowerCase(), 'identifier must resolve to the monospaced family').toMatch(/mono/)

  await setRoleSizes(page, PROBE)
  await expect(url).toHaveCSS('font-size', '21px')
  await restoreRoleSizes(page, ROLES)
  await expect(url).toHaveCSS('font-size', '13px')
})

test('the declared glyph preservations keep their literal size', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('stores-c3-styles')
  expect(GLYPH_PRESERVATIONS.length).toBe(7)
  for (const [testid, size] of GLYPH_PRESERVATIONS) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
  await setRoleSizes(page, PROBE)
  for (const [testid, size] of GLYPH_PRESERVATIONS) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
  await restoreRoleSizes(page, ROLES)
})

test('central roles drive the real stores-c3 styles and restore', async ({ page }, testInfo) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('stores-c3-styles')
  expect(PROBED.size).toBe(ROLE_SIZES.length)
  await setRoleSizes(page, PROBE)
  for (const [testid, size] of PROBED) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
  await page.screenshot({ path: testInfo.outputPath('stores-c3-propagated.png'), fullPage: true })
  await restoreRoleSizes(page, ROLES)
  for (const [testid, size] of ROLE_SIZES) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
})

test.describe('stores-c3 at 320px RTL coarse pointer', () => {
  test.use({ viewport: { width: 320, height: 760 }, hasTouch: true, isMobile: true })

  test('keeps the converted row at 44px and does not overflow', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(batchUrl('mode=dark&rtl=true&locale=ar'))
    const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)
    const box = await page.getByTestId('stores-c3-styles').getByTestId('pi-ingredientoption-root').first().boundingBox()
    expect(box.height).toBeGreaterThanOrEqual(44)
    await page.screenshot({ path: testInfo.outputPath('stores-c3-dark-rtl-320.png'), fullPage: true })
  })
})
