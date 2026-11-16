import { expect, test } from './fixtures'

const batchUrl = (query = '') => `/scripts/brand-system/harness/stores-b4.html?${query}`
const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']
const PROBE = { title: '28px', 'section-title': '25px', content: '19px', secondary: '16px', control: '17px', 'control-value': '18px', identifier: '21px' }

// 5.4: BusinessCateringDelivery, BusinessPreorderDetails and
// BusinessReservations were rewritten on Product, their harness nodes are gone.
// 5.7: so were BusinessDeliveryPickupMore, BusinessDeliveryDetails,
// BusinessPickupDetails, BusinessEta and BusinessDeliveryGroupsDetails.
// 5.8: so were BusinessDeliveryZoneDetails, BusinessDeliveryZoneInformation
// and BusinessDeliveryZoneList. Only BusinessSchedule is left in this harness.
const CONTROL = []
const TITLE = ['schedule-title']

const CANONICAL = { control: '13px', title: '22px' }
const ROLE_SIZES = [
  ...CONTROL.map(t => [t, CANONICAL.control]),
  ...TITLE.map(t => [t, CANONICAL.title])
]

const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, value] of Object.entries(values)) document.documentElement.style.setProperty(`--od-type-${role}-size`, value)
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-type-${role}-size`)
}, roles)

for (const mode of ['light', 'dark']) {
  test(`stores-b4 keeps governed typography and native controls in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('stores-b4-styles')

    for (const [testid, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
    }

    await page.screenshot({ path: testInfo.outputPath(`stores-b4-${mode}.png`), fullPage: true })
  })
}

test('central roles drive the real stores-b4 styles and restore', async ({ page }, testInfo) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('stores-b4-styles')
  const probed = new Map([
    ...CONTROL.map(t => [t, PROBE.control]),
    ...TITLE.map(t => [t, PROBE.title])
  ])
  expect(probed.size, 'every migrated site must be probed').toBe(ROLE_SIZES.length)

  await setRoleSizes(page, PROBE)
  for (const [testid, size] of probed) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
  await page.screenshot({ path: testInfo.outputPath('stores-b4-propagated.png'), fullPage: true })

  await restoreRoleSizes(page, ROLES)
  for (const [testid, size] of ROLE_SIZES) {
    await expect(surface.getByTestId(testid).first(), testid).toHaveCSS('font-size', size)
  }
})

test.describe('stores-b4 at 320px RTL coarse pointer', () => {
  test.use({ viewport: { width: 320, height: 760 }, hasTouch: true, isMobile: true })

  test('draws at 320px', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(batchUrl('mode=dark&rtl=true&locale=ar'))
    await page.screenshot({ path: testInfo.outputPath('stores-b4-dark-rtl-320.png'), fullPage: true })
  })
})
