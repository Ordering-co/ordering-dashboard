import {
  expect,
  expectClosedNetworkBoundary,
  installAppNetworkBoundary,
  installSyntheticSession,
  test
} from './fixtures'
import { tokens } from '../../src/brand/ordering.tokens.generated'

// redesign (DC-B5): /delivery/drivers-companies is the Product redesign (Delivery/DriversCompaniesDirectory: P/PageHeader,
// P/DataTable or P/RecordCardList on a phone, P/Checkbox, P/SplitView + P/RecordPanel with P/Tabs). Its type roles are the Product
// scale (`--od-x-type-*-size`), the ones the page head and the table read.
const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, value] of Object.entries(values)) document.documentElement.style.setProperty(`--od-x-type-${role}-size`, value)
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-x-type-${role}-size`)
}, roles)

for (const [name, viewport] of Object.entries({
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 }
})) {
  test.describe(name, () => {
    // a phone has a coarse pointer and shows the companies as cards (decision 12)
    if (name === 'mobile') test.use({ hasTouch: true })

    test(`${name} Delivery-1 company list keeps table, selection, query and tabs governed`, async ({ context, page }, testInfo) => {
      test.setTimeout(120000)
      const network = await installAppNetworkBoundary(context, { scenario: 'populated' })
      await installSyntheticSession(context, { authenticated: true })
      const pageErrors = []
      page.on('pageerror', error => pageErrors.push(error.message))
      await page.setViewportSize(viewport)
      await page.goto('/delivery/drivers-companies', { waitUntil: 'domcontentloaded' })

      const heading = page.getByRole('heading', { name: 'Delivery companies', exact: true })
      await expect(heading).toBeVisible({ timeout: 90000 })
      const accept = page.getByRole('button', { name: 'Accept', exact: true })
      const noticeVisible = await accept.last().waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false)
      if (noticeVisible) await accept.last().click()

      // P/PageHeader: the page title (22px) beside a list; in a narrow container (a phone) it takes the section role (18px).
      // The header says how many companies there are (the fixture has two).
      const headingSize = name === 'mobile' ? '18px' : '22px'
      const headingOverride = name === 'mobile' ? '26px' : '28px'
      await expect(heading).toHaveCSS('font-size', headingSize)
      await expect(page.getByText('2 companies', { exact: true })).toBeVisible()

      // the list: a table named «Delivery companies» with a row per company (data-row-id); on a phone the same list as cards
      let companyName
      if (name === 'mobile') {
        const cards = page.getByRole('list', { name: 'Delivery companies', exact: true })
        await expect(cards).toBeVisible()
        await expect(cards.getByRole('listitem')).toHaveCount(2)
        companyName = cards.getByText('Long Fleet Company Name', { exact: true })
      } else {
        const table = page.getByRole('table', { name: 'Delivery companies', exact: true })
        await expect(table).toBeVisible()
        await expect(table.getByRole('columnheader', { name: 'Company', exact: true })).toBeVisible()
        await expect(table.locator('[data-row-id]')).toHaveCount(2)
        await expect(table.locator('[data-row-id="965001"]')).toBeVisible()
        await expect(table.getByText('America/Chicago', { exact: true })).toBeVisible()
        companyName = table.locator('[data-row-id="965001"]').getByText('Long Fleet Company Name', { exact: true })
        await expect(table.getByRole('columnheader', { name: 'Company', exact: true })).toHaveCSS('font-size', tokens.font.size.productUi)
      }
      await expect(companyName).toBeVisible()
      await expect(companyName).toHaveCSS('font-size', tokens.font.size.productContent)
      const writesBeforeInteractions = network.blockedWrites.length

      // The page routes its readable sizes through the Product roles.
      await setRoleSizes(page, { title: '28px', section: '26px', body: '19px' })
      await expect(heading).toHaveCSS('font-size', headingOverride)
      await expect(companyName).toHaveCSS('font-size', '19px')
      const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
      expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)
      await restoreRoleSizes(page, ['title', 'section', 'body'])
      await expect(heading).toHaveCSS('font-size', headingSize)
      await expect(companyName).toHaveCSS('font-size', tokens.font.size.productContent)

      // Selection is a real control that reports and toggles its state: P/Checkbox, role=checkbox, aria-checked.
      const select = page.getByRole('checkbox', { name: 'Select Long Fleet Company Name', exact: true })
      await expect(select).toBeVisible()
      await expect(select).toHaveAttribute('aria-checked', 'false')
      await select.click()
      await expect(select).toHaveAttribute('aria-checked', 'true')
      await expect(page.getByText('1 selected', { exact: true })).toBeVisible()
      await select.click()
      await expect(select).toHaveAttribute('aria-checked', 'false')

      // Opening a company keeps the query-string contract: ?id=, and ?tab= from the tabs.
      await companyName.click()
      await expect(page).toHaveURL(/(?:\?|&)id=965001(?:&|$)/)
      const panel = page.locator('aside.odc-split-panel')
      await expect(panel).toBeVisible()
      await expect(panel.getByRole('heading', { name: 'Long Fleet Company Name', exact: true })).toBeVisible()
      const general = panel.getByRole('tab', { name: 'General', exact: true })
      await expect(general).toHaveAttribute('aria-selected', 'true')
      // P/Tabs: the arrows move the focus (roving tabindex) and Enter activates (activateOnFocus is off)
      await general.press('ArrowRight')
      const schedule = panel.getByRole('tab', { name: 'Schedule', exact: true })
      await expect(schedule).toBeFocused()
      await expect(general).toHaveAttribute('aria-selected', 'true')
      await schedule.press('Enter')
      await expect(schedule).toHaveAttribute('aria-selected', 'true')
      await expect(page).toHaveURL(/(?:\?|&)tab=schedule(?:&|$)/)
      await expect(panel.getByRole('tabpanel')).toBeVisible()
      await page.screenshot({ path: testInfo.outputPath(`${name}-delivery-1-company.png`), fullPage: true })

      // The way out is «Close» beside the list and «Back» on a phone
      await panel.getByRole('button', { name: name === 'mobile' ? 'Back' : 'Close', exact: true }).click()
      await expect(page).not.toHaveURL(/(?:\?|&)id=/)
      await expect(page).not.toHaveURL(/(?:\?|&)tab=/)
      await expect(panel).toBeHidden()

      // «Add driver company» opens the add panel in the same split view; Cancel closes it and the list is still there
      const addCompany = page.getByRole('button', { name: 'Add driver company', exact: true })
      await expect(addCompany).toBeVisible()
      await addCompany.click()
      const addPanel = page.locator('aside.odc-split-panel')
      await expect(addPanel.getByRole('heading', { name: 'Add driver company', exact: true })).toBeVisible()
      // the required fields carry «Required» in their name (P/Field requiredLabel)
      await expect(addPanel.getByRole('textbox', { name: 'Name Required', exact: true })).toBeVisible()
      await expect(addPanel.getByRole('textbox', { name: 'Webhook new order Required', exact: true })).toBeVisible()
      await addPanel.getByRole('button', { name: 'Cancel', exact: true }).click()
      await expect(addPanel).toBeHidden()
      await expect(companyName).toBeVisible()

      // Nothing scrolls sideways once everything rests
      await expect.poll(
        () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
        { message: 'the document does not scroll sideways', timeout: 5000 }
      ).toBeLessThanOrEqual(0)

      expect(network.blockedWrites.length).toBe(writesBeforeInteractions)
      expect(pageErrors).toEqual([])
      expectClosedNetworkBoundary(network)
    })
  })
}
