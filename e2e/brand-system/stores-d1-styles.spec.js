import { expect, test } from './fixtures'

// Generated from scripts/brand-system/l4-d1-payment-methods-typography-rules.json.
// 6 of this batch's 8 sites are three declarations cloned across two
// payment gateways. That shortcut was VERIFIED before it was used, file by
// file: 2/2, 2/2, 2/2 and 1/1.
// Lot 5.9: removed the po-, poc-, pog- and pom- ids (the payments
// section moved to Product, those four styles.js are gone); ROLE_SIZES 36 -> 28,
// GLYPH_PRESERVATIONS 22 -> 14, TAB_OPTIONS 5 -> 2.
// Lot 5.10a: removed the pomp- and popp- ids and the posd-/posl-
// Header, dropdown, message and posl TabOption ids (Paypal and Mercado Pago lost
// their styles.js, Stripe direct keeps only TabOption/TabOptionName, Stripe link
// only Option); ROLE_SIZES 28 -> 19, GLYPH_PRESERVATIONS 14 -> 9, TAB_OPTIONS
// 2 -> 1, save-guard families 4 -> 1. The native-checkbox assertions that read
// posd-taboption-control now read posd-taboption-control.
// Lot 5.10b: removed the pocr-, poe- and posq- ids and the sg-poe-
// save-guard (Epayco, Credomatic and Square lost their styles.js, and so did
// PaymentOption); ROLE_SIZES 19 -> 7, GLYPH_PRESERVATIONS 9 -> 5, TITLE 6 -> 3,
// save-guard families 1 -> 0 (the save-guard test is removed with its only
// subject, Epayco's BodyContainer). The batch has 6 tests left instead of 7.
// Lot 5.11: removed the pmsc- ids (Stripe Connect lost its
// styles.js); ROLE_SIZES 7 -> 5, GLYPH_PRESERVATIONS 5 -> 3, TITLE 3 -> 2, CONTROL
// 3 -> 2. The batch keeps its 6 tests.
// PaymethodOptionPaypalExpress/styles.js and PaymethodOptionStripeRedirect/styles.js were deleted as dead code; pmpe-*, pmsr-* rows (ROLE_SIZES 5 -> 1, GLYPH_PRESERVATIONS 3 -> 1, TITLE 2 -> 0, CONTROL 2 -> 0) went with them. The batch keeps its 6 tests.
const batchUrl = (query = '') => `/scripts/brand-system/harness/stores-d1.html?${query}`
const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']
const PROBE = { title: '28px', 'section-title': '25px', content: '19px', secondary: '16px', control: '17px', 'control-value': '18px', identifier: '21px' }

const CONTROL_VALUE = [
  'posl-option-root'
]

const ROLE_SIZES = [
  ...CONTROL_VALUE.map(t => [t, '14px'])
]
const PROBED = new Map([
  ...CONTROL_VALUE.map(t => [t, PROBE['control-value']])
])

const GLYPH_PRESERVATIONS = [
  ['posd-taboption-svg', '20px']
]

const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, value] of Object.entries(values)) document.documentElement.style.setProperty(`--od-type-${role}-size`, value)
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-type-${role}-size`)
}, roles)

for (const mode of ['light', 'dark']) {
  test(`stores-d1 keeps governed typography across all remaining gateways in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('stores-d1-styles')
    expect(ROLE_SIZES.length, 'every migrated site must be asserted').toBe(1)
    for (const [testid, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
    }

    // The only conversion of this batch simulates a checkbox by drawing icons
    // by hand. Its aria-checked is bound to the same expression that picks the
    // icon, so the accessible state cannot drift from the visual one.
    const option = surface.getByTestId('posd-taboption-svg').first()
    const control = surface.getByTestId('posd-taboption-control').first()
    await expect(control).toHaveAttribute('type', 'button')
    await expect(control).toHaveAttribute('role', 'checkbox')
    await expect(control).toHaveAttribute('aria-checked', 'false')
    await expect(option).toHaveCSS('font-size', '20px')

    await page.screenshot({ path: testInfo.outputPath(`stores-d1-${mode}.png`), fullPage: true })
  })
}

test('the declared glyph preservations keep their literal size', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('stores-d1-styles')
  expect(GLYPH_PRESERVATIONS.length).toBe(1)
  for (const [testid, size] of GLYPH_PRESERVATIONS) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
  await setRoleSizes(page, PROBE)
  for (const [testid, size] of GLYPH_PRESERVATIONS) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
  await restoreRoleSizes(page, ROLES)
})

test('central roles drive all remaining gateways at once and restore', async ({ page }, testInfo) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('stores-d1-styles')
  expect(PROBED.size).toBe(ROLE_SIZES.length)
  await setRoleSizes(page, PROBE)
  for (const [testid, size] of PROBED) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
  await page.screenshot({ path: testInfo.outputPath('stores-d1-propagated.png'), fullPage: true })
  await restoreRoleSizes(page, ROLES)
  for (const [testid, size] of ROLE_SIZES) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
})

test.describe('stores-d1 at 320px RTL coarse pointer', () => {
  test.use({ viewport: { width: 320, height: 760 }, hasTouch: true, isMobile: true })

  test('keeps the converted option at 44px and does not overflow', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(batchUrl('mode=dark&rtl=true&locale=ar'))
    const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)
    const box = await page.getByTestId('stores-d1-styles').getByTestId('posd-taboption-control').first().boundingBox()
    expect(box.height).toBeGreaterThanOrEqual(44)
    await page.screenshot({ path: testInfo.outputPath('stores-d1-dark-rtl-320.png'), fullPage: true })
  })
})

// Every TabOption of this batch is the native checkbox button the product
// renders (`as='button' role='checkbox' aria-checked`). Read it from the
// browser's accessibility tree, scoped by gateway group. Only
// PaymentOptionStripeDirect still declares a TabOption (lot 5.10a retired
// PaymentOptionStripeLink's). Every fixture glyph is the empty box, so every
// state is exactly unchecked.
const TAB_OPTIONS = [
  ['payment-option-stripedirect-group', 'All sites']
]

test('every TabOption is a tabbable native checkbox in the accessibility tree', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('stores-d1-styles')
  for (const [group, name] of TAB_OPTIONS) {
    const checkbox = surface.getByTestId(group).getByRole('checkbox', { name, exact: true, checked: false })
    await expect(checkbox, group).toHaveCount(1)
    await checkbox.focus()
    await expect(checkbox, group).toBeFocused()
    expect(await checkbox.evaluate(e => e.tabIndex), group).toBe(0)
  }
})
