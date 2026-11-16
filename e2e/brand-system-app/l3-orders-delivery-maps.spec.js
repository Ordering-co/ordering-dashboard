import {
  expect,
  expectClosedNetworkBoundary,
  installAppNetworkBoundary,
  installSyntheticSession,
  test
} from './fixtures'
import { tokens } from '../../src/brand/ordering.tokens.generated'

const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, value] of Object.entries(values)) document.documentElement.style.setProperty(`--od-type-${role}-size`, value)
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-type-${role}-size`)
}, roles)

for (const [name, viewport] of Object.entries({
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 }
})) {
  test(`${name} drivers dashboard keeps filters, map fallback and the missing-key banner governed`, async ({ context, page }, testInfo) => {
    test.setTimeout(120000)
    const network = await installAppNetworkBoundary(context, { scenario: 'populated' })
    await installSyntheticSession(context, { authenticated: true })
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    await page.setViewportSize(viewport)
    await page.goto('/drivers-dashboard', { waitUntil: 'domcontentloaded' })

    const heading = page.getByRole('heading', { name: 'Drivers dashboard', exact: true })
    const map = page.getByRole('region', { name: 'Drivers map', exact: true })
    // Adapted 2026-10-08 (W1-4b): Online/Offline are P/Tabs tabs with their count as a badge, selected by aria-selected
    const online = page.getByRole('tab', { name: /^Online\s*2$/ })
    const offline = page.getByRole('tab', { name: /^Offline\s*1$/ })
    const driverName = page.getByText('Ada Lovelace', { exact: true })
    await expect(heading).toBeVisible({ timeout: 90000 })
    const accept = page.getByRole('button', { name: 'Accept', exact: true })
    const noticeVisible = await accept.last().waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false)
    if (noticeVisible) await accept.last().click()
    // Adapted 2026-10-09 (drivers-dashboard decision 7): below 1024px the list comes first and the map is behind «Map»; the map is
    // mounted when that view is chosen, then the list comes back for the rest of the checks.
    if (name === 'mobile') {
      await expect(driverName).toBeVisible()
      await page.getByRole('button', { name: 'Map', exact: true }).click()
      await expect(map).toBeVisible()
      await page.getByRole('button', { name: 'List', exact: true }).click()
    } else {
      await expect(map).toBeVisible()
    }
    await expect(online).toHaveAttribute('aria-selected', 'true')
    await expect(driverName).toBeVisible()
    // Adapted 2026-10-08 (W1-4a): the title is P/PageHeader's — the page title role (22px), the section role (18px) in a narrow
    // container (phone); its own governing token drives it (as on /appointments, W1-7), not the family's --od-type-title-size.
    const [headingRole, headingSize] = name === 'mobile' ? ['--od-x-type-section-size', '18px'] : ['--od-x-type-title-size', '22px']
    await expect(heading).toHaveCSS('font-size', headingSize)
    await expect(online).toHaveCSS('font-size', tokens.font.size.productUi)
    await expect(driverName).toHaveCSS('font-size', tokens.font.size.productContent)
    const writesBeforeInteractions = network.blockedWrites.length

    await page.evaluate(token => document.documentElement.style.setProperty(token, '28px'), headingRole)
    await expect(heading).toHaveCSS('font-size', '28px')
    await page.evaluate(token => document.documentElement.style.removeProperty(token), headingRole)
    await setRoleSizes(page, { title: '28px', control: '17px', content: '19px' })
    // Adapted 2026-10-08 (W1-4b): the Online tab is P/Tabs, typed by the product UI role (--od-x-type-ui-size), not the family's control role
    await expect(driverName).toHaveCSS('font-size', '19px')
    const propagatedGeometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(propagatedGeometry.document).toBeLessThanOrEqual(propagatedGeometry.viewport)
    await restoreRoleSizes(page, ['title', 'control', 'content'])
    await expect(heading).toHaveCSS('font-size', headingSize)
    await expect(online).toHaveCSS('font-size', tokens.font.size.productUi)
    await expect(driverName).toHaveCSS('font-size', tokens.font.size.productContent)

    await offline.click()
    await expect(offline).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByText('Linh Nguyễn', { exact: true })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`${name}-orders-delivery-dashboard.png`), fullPage: true })

    // Adapted 2026-10-03 to the behaviour of `main`: the API-key modal and its
    // show/hide disclosure are gone. A missing key now shows a warning banner whose
    // link opens the Settings hub on the Maps category, the one editor for project
    // configs. The synthetic project has no key, so the banner must be there.
    await expect(page.getByText('Google Maps API key is missing.', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Add it in Settings', exact: true })).toHaveAttribute('href', '/settings?group=locations&category=google_maps')

    await page.screenshot({ path: testInfo.outputPath(`${name}-orders-delivery-maps.png`), fullPage: true })
    expect(network.blockedWrites.length).toBe(writesBeforeInteractions)
    expect(pageErrors).toEqual([])
    expectClosedNetworkBoundary(network)
  })
}
