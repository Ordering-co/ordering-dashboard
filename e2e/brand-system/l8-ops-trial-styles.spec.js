import { expect, test } from './fixtures'

// The batch keeps its own harness entry so the shared compact registry in
// scripts/brand-system/harness/main.jsx is never edited by a parallel session.
const batchUrl = (query = '') => `/scripts/brand-system/harness/l8-ops-trial.html?${query}`

const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']

// Role assignment for l8-ops-trial (L8 3.3): 13 sites, the default size of the
// role each rule of l8-ops-trial-typography-rules.json names in `replace`.
//
// The order of this table is the order of the rules in that file, because
// verify-spec-tables pairs entry i with rule i.
//
// These sizes are what the batch must measure AFTER the migration. Before it,
// several of these fail by design (the sites still carry 16px, 15px, 20px...);
// that failure is the test doing its job, not a fixture defect.
const ROLE_SIZES = [
  ['sf-header-title', '18px'], // section-title
  ['sf-checkbox-label', '13px'], // control
  ['sf-description', '12px'], // secondary
  ['sf-timezone-label', '13px'], // control
  ['sf-select', '14px'], // control-value
  ['sf-list-wrapper', '14px'], // control-value
  ['bc-title', '22px'], // title
  ['bc-section-title', '18px'], // section-title
  ['bc-empty-state', '14px'], // content
  ['ce-status-text', '14px'], // content
  ['ce-secondary-link', '13px'], // control
  ['hc-title', '18px'], // section-title
  ['hc-description', '14px'] // content
]

// `content` and `control-value` both default to 14px, so size alone cannot say
// which role drives a 14px site. These two take `control-value`; every other
// 14px site takes `content`. Both lists come from the `replace` of the rules.
const CONTROL_VALUE_IDS = ['sf-select', 'sf-list-wrapper']

const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, size] of Object.entries(values)) {
    document.documentElement.style.setProperty(`--od-type-${role}-size`, size)
  }
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-type-${role}-size`)
}, roles)

const PROBE = { title: '28px', 'section-title': '25px', content: '19px', secondary: '16px', control: '17px', 'control-value': '18px', identifier: '18px' }
const probed = (testid, size) => {
  if (CONTROL_VALUE_IDS.includes(testid)) return PROBE['control-value']
  return { '22px': PROBE.title, '18px': PROBE['section-title'], '14px': PROBE.content, '12px': PROBE.secondary, '13px': PROBE.control }[size]
}

for (const mode of ['light', 'dark']) {
  test(`l8-ops-trial keeps governed typography in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('l8-ops-trial-styles')

    for (const [testid, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
    }

    await page.screenshot({ path: testInfo.outputPath(`l8-ops-trial-${mode}.png`), fullPage: true })
  })
}

test('central roles drive the real l8-ops-trial styles and restore', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('l8-ops-trial-styles')

  await setRoleSizes(page, PROBE)
  for (const [testid, size] of ROLE_SIZES) {
    await expect(surface.getByTestId(testid), `${testid} moves with its role`).toHaveCSS('font-size', probed(testid, size))
  }

  await restoreRoleSizes(page, ROLES)
  for (const [testid, size] of ROLE_SIZES) {
    await expect(surface.getByTestId(testid), `${testid} restores`).toHaveCSS('font-size', size)
  }
})

test.describe('l8-ops-trial at 320px RTL coarse pointer', () => {
  test.use({ viewport: { width: 320, height: 900 }, hasTouch: true, isMobile: true })

  test('does not overflow horizontally', async ({ page }, testInfo) => {
    await page.goto(batchUrl('mode=dark&rtl=true&locale=ar'))
    const surface = page.getByTestId('l8-ops-trial-styles')
    await expect(surface).toBeVisible()

    const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)

    const box = await surface.evaluate(node => ({ clientWidth: node.clientWidth, scrollWidth: node.scrollWidth }))
    expect(box.scrollWidth, 'l8-ops-trial-styles').toBeLessThanOrEqual(box.clientWidth + 1)

    await page.screenshot({ path: testInfo.outputPath('l8-ops-trial-dark-rtl-320.png'), fullPage: true })
  })
})
