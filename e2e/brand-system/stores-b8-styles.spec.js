import { expect, test } from './fixtures'

// Lot 5.9: removed the pm- ids (BusinessPaymentMethods moved to
// Product, its styles.js is gone); ROLE_SIZES 99 -> 95, GLYPH_PRESERVATIONS 17 -> 15.
// Lot 5.11: removed the pa- and wl- ids (BusinessPaymentAccount and
// BusinessWalletsList moved onto Product pieces, their styles.js are gone);
// ROLE_SIZES 95 -> 79, GLYPH_PRESERVATIONS 15 -> 14, NATIVE 7 -> 6, AS_PRESSED
// 4 -> 3. The batch keeps its 5 tests.
// Lot 5.12: removed the tf- ids (BusinessTaxAndFees moved onto
// Product wrappers, its styles.js is gone); ROLE_SIZES 79 -> 72,
// GLYPH_PRESERVATIONS 14 -> 13. The batch keeps its 5 tests.
// Lot 5.13: removed the ff-, fe- and mk- ids (BusinessFeeForm,
// BusinessFees and BusinessMarkups moved onto Product pieces, their styles.js
// are gone); ROLE_SIZES 72 -> 47, GLYPH_PRESERVATIONS 13 -> 9, NATIVE 6 -> 4,
// AS_CHECKBOX removed (both of its controls went with their subjects). The batch
// keeps its 5 tests.
// Lot 5.14: removed the pc-, pg- and pl- ids (BusinessPromotionCustomFields,
// BusinessPromotionGeneralForm and BusinessPromotionList moved onto Product pieces,
// their styles.js are gone); ROLE_SIZES 47 -> 23, GLYPH_PRESERVATIONS 9 -> 5,
// NATIVE 4 -> 3, AS_PRESSED 3 -> 2. The batch keeps its 5 tests.
// This spec is GENERATED from the batch ruleset, not written by hand: with 110
// migrated declarations, transcribing them by hand is how role tables drift
// from the rules they are supposed to prove. Every testid, role and canonical
// size below comes straight from
// scripts/brand-system/l4-b8-business-payments-brands-promos-typography-rules.json.
const batchUrl = (query = '') => `/scripts/brand-system/harness/stores-b8.html?${query}`
const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']
const PROBE = { title: '28px', 'section-title': '25px', content: '19px', secondary: '16px', control: '17px', 'control-value': '18px', identifier: '21px' }

const TITLE = [
  'bl-headertitlecontainer-h1',
  'bl-detailheder-div-first-child-span',
  'spd-header-h1',
  'sp-header-h1'
]
const SECTION = [
  'bb-noselectedbrand-root'
]
const CONTENT = [
  'bb-businessname-root',
  'bl-brandbody-td',
  'bl-infoblock-p',
  'sp-userinfo-h3'
]
const SECONDARY = [
  'bl-brandlisttable-thead-th',
  'sp-userinfo-p'
]
const CONTROL = [
  'bg-label-root',
  'bg-switchwrapper-span',
  'bg-colorwrapper-label',
  'bg-shapewrapper-label',
  'bl-enablewrapper-span',
  'bl-tab-root-14',
  'bl-tab-root-12',
  'bl-actionselectorwrapper-select-list-list-wrapper-div',
  'spd-actionselectorwrapper-div-div-dropdown-item',
  'sp-addbtn-root',
  'bg-uploadimageicon-span'
]
const CONTROL_VALUE = [
  'bg-formcontrol-input'
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

// The 5 declared glyph preservations. A role must never reach any of them.
const GLYPH_PRESERVATIONS = [
  ['bg-shapeboxwrapper-svg', '16px'],
  ['bl-actionselectorwrapper-select-div-first-child-svg', '20px'],
  ['spd-actionselectorwrapper-button-svg', '20px'],
  ['sp-professionalitemcontainer-svg', '18px'],
  ['sp-checkwrapper-span-svg', '16px']
]

// The 3 controls this batch made native.
const NATIVE = [
  'bl-tab-root-14',
  'bl-tab-root-12',
  'sp-addbtn-root'
]
const AS_PRESSED = {
  'bl-tab-root-14': 'true',
  'bl-tab-root-12': 'false'
}

const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, value] of Object.entries(values)) document.documentElement.style.setProperty(`--od-type-${role}-size`, value)
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-type-${role}-size`)
}, roles)

for (const mode of ['light', 'dark']) {
  test(`stores-b8 keeps governed typography and native controls in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('stores-b8-styles')

    expect(ROLE_SIZES.length, 'every migrated site must be asserted').toBe(23)
    for (const [testid, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
    }

    for (const id of NATIVE) {
      await expect(surface.getByTestId(id).first(), id).toHaveAttribute('type', 'button')
    }
    for (const [id, pressed] of Object.entries(AS_PRESSED)) {
      await expect(surface.getByTestId(id).first(), id).toHaveAttribute('aria-pressed', pressed)
    }

    const tab = surface.getByTestId('bl-tab-root-14').first()
    await tab.focus()
    await expect(tab).toBeFocused()
    await expect(tab).toHaveCSS('outline-width', '2px')
    await expect(tab).toHaveCSS('outline-style', 'solid')

    await page.screenshot({ path: testInfo.outputPath(`stores-b8-${mode}.png`), fullPage: true })
  })
}

test('the 5 declared glyph preservations keep their literal size', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('stores-b8-styles')
  for (const [testid, size] of GLYPH_PRESERVATIONS) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
  await setRoleSizes(page, PROBE)
  for (const [testid, size] of GLYPH_PRESERVATIONS) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
  await restoreRoleSizes(page, ROLES)
})

test('central roles drive the real stores-b8 styles and restore', async ({ page }, testInfo) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('stores-b8-styles')
  expect(PROBED.size, 'every migrated site must be probed').toBe(ROLE_SIZES.length)

  await setRoleSizes(page, PROBE)
  for (const [testid, size] of PROBED) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
  await page.screenshot({ path: testInfo.outputPath('stores-b8-propagated.png'), fullPage: true })

  await restoreRoleSizes(page, ROLES)
  for (const [testid, size] of ROLE_SIZES) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
})

test.describe('stores-b8 at 320px RTL coarse pointer', () => {
  test.use({ viewport: { width: 320, height: 760 }, hasTouch: true, isMobile: true })

  test('keeps the converted controls at 44px and does not overflow', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(batchUrl('mode=dark&rtl=true&locale=ar'))
    const surface = page.getByTestId('stores-b8-styles')

    const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)

    for (const id of NATIVE) {
      const box = await surface.getByTestId(id).first().boundingBox()
      expect(box.width, id).toBeGreaterThanOrEqual(44)
      expect(box.height, id).toBeGreaterThanOrEqual(44)
    }

    await page.screenshot({ path: testInfo.outputPath('stores-b8-dark-rtl-320.png'), fullPage: true })
  })
})
