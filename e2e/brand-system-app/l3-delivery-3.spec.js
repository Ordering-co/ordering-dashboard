import {
  expect,
  expectClosedBatchBoundary,
  installBatchNetworkBoundary,
  installBatchSession,
  test
} from './l3-delivery-3.fixtures'
import { tokens } from '../../src/brand/ordering.tokens.generated'

// redesign DL-R2: the drivers page is the Product redesign (P/PageHeader, P/DataTable or P/RecordCard on a phone, P/Checkbox,
// P/SectionNav). Its type roles are the Product scale (`--od-x-type-*-size`), the ones the page head and the table read.
const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, value] of Object.entries(values)) document.documentElement.style.setProperty(`--od-x-type-${role}-size`, value)
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-x-type-${role}-size`)
}, roles)

// Decision 12 (phone touch targets), the method of scripts/redesign/tools/touch-probe.mjs: elementFromPoint 21px from the centre on
// each side must land inside the control (itself or a descendant). Returns the sides that missed.
const missedReach = async locator => {
  await locator.scrollIntoViewIfNeeded()
  return locator.evaluate(element => {
    const rect = element.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const reach = 21
    const missed = []
    for (const [side, x, y] of [['up', cx, cy - reach], ['down', cx, cy + reach], ['left', cx - reach, cy], ['right', cx + reach, cy]]) {
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) { missed.push(`${side} (outside the viewport)`); continue }
      const hit = document.elementFromPoint(x, y)
      if (!hit || !(hit === element || element.contains(hit))) {
        const named = hit?.closest('button, a, [role]') ?? hit
        missed.push(`${side} -> ${named ? `${named.tagName.toLowerCase()}[${named.getAttribute('role') ?? ''}] ${named.getAttribute('aria-label') ?? named.textContent.trim().slice(0, 24)}` : 'nothing'}`)
      }
    }
    return missed
  })
}

for (const [name, viewport] of Object.entries({
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 }
})) {
  test.describe(name, () => {
    // a phone has a coarse pointer: that is what gives the controls their 44px area (decision 12)
    if (name === 'mobile') test.use({ hasTouch: true })

    test(`${name} Delivery-3 drivers list keeps roles, selection and filters governed`, async ({ context, page }, testInfo) => {
      test.setTimeout(120000)
      const network = await installBatchNetworkBoundary(context)
      await installBatchSession(context, { authenticated: true })
      const pageErrors = []
      page.on('pageerror', error => pageErrors.push(error.message))
      await page.setViewportSize(viewport)
      await page.goto('/delivery/drivers-list', { waitUntil: 'domcontentloaded' })

      const heading = page.getByRole('heading', { name: 'Drivers', exact: true })
      await expect(heading).toBeVisible({ timeout: 90000 })
      const accept = page.getByRole('button', { name: 'Accept', exact: true })
      const noticeVisible = await accept.last().waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false)
      if (noticeVisible) await accept.last().click()

      // the name of the driver: a cell of the table, the title of the card on a phone
      const driver = page.getByText('Ada Lovelace', { exact: true }).first()
      await expect(driver).toBeVisible()
      // P/PageHeader: the page title (22px) beside a list; in a narrow container (a phone) it takes the section role (18px)
      const headingSize = name === 'mobile' ? '18px' : '22px'
      const headingOverride = name === 'mobile' ? '26px' : '28px'
      await expect(heading).toHaveCSS('font-size', headingSize)
      await expect(driver).toHaveCSS('font-size', tokens.font.size.productContent)
      const writesBeforeInteractions = network.blockedWrites.length

      // The batch routes every readable size through the central roles.
      await setRoleSizes(page, { title: '28px', section: '26px', caption: '15px', ui: '16px', body: '19px' })
      await expect(heading).toHaveCSS('font-size', headingOverride)
      await expect(driver).toHaveCSS('font-size', '19px')
      const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
      expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)
      await restoreRoleSizes(page, ['title', 'section', 'caption', 'ui', 'body'])
      await expect(heading).toHaveCSS('font-size', headingSize)
      await expect(driver).toHaveCSS('font-size', tokens.font.size.productContent)

      // Selection is a real control that reports and toggles its state: P/Checkbox, role=checkbox, aria-checked.
      // On a phone «Select all» sits above the cards (the table header is not there) and the driver's checkbox is in its card.
      const selectAll = page.getByRole('checkbox', { name: 'Select all', exact: true })
      const selectDriver = page.getByRole('checkbox', { name: 'Select Ada Lovelace', exact: true })
      await expect(selectAll).toHaveAttribute('aria-checked', 'false')
      await expect(selectDriver).toHaveAttribute('aria-checked', 'false')
      if (name === 'mobile') {
        // decision 12: a 44px reach on a phone, measured with elementFromPoint at 21px from the centre
        expect(await missedReach(selectAll), 'Select all reaches 44px on a phone').toEqual([])
        expect(await missedReach(selectDriver), 'the card checkbox reaches 44px on a phone').toEqual([])
      } else {
        // redesign DL-R2 (decision 12, coordinator 2026-10-10): the target follows the pointer, as the owner fixed it. A fine pointer keeps
        // the P/Checkbox contract (24px, the WCAG 2.5.8 floor); a coarse pointer gets the 44px reach measured above with elementFromPoint.
        // The old 44x44 box was a property of the legacy <button>, not a rule.
        for (const control of [selectAll, selectDriver]) {
          const box = await control.boundingBox()
          expect(box.width).toBeGreaterThanOrEqual(24)
          expect(box.height).toBeGreaterThanOrEqual(24)
        }
      }
      await selectAll.click()
      await expect(selectAll).toHaveAttribute('aria-checked', 'true')
      await expect(selectDriver).toHaveAttribute('aria-checked', 'true')

      await selectDriver.click()
      await expect(selectDriver).toHaveAttribute('aria-checked', 'false')
      await expect(selectAll).toHaveAttribute('aria-checked', 'mixed')

      // Opening a driver keeps the existing query-string contract.
      await driver.click()
      await expect(page).toHaveURL(/(?:\?|&)id=960001(?:&|$)/)

      // The details navigation is P/SectionNav: a navigation (not a tablist) whose current section is marked. Beside a wide list it is a
      // list of buttons with aria-current; in a narrow panel (or on a phone) it is one selector whose radio item is checked.
      const sections = page.getByRole('navigation', { name: 'Driver sections' })
      await expect(sections).toBeVisible()
      const asList = (await sections.locator('button.odc-sectionnav-row').count()) > 0
      if (asList) {
        await expect(sections.getByRole('button', { name: 'Profile', exact: true })).toHaveAttribute('aria-current', 'page')
        await sections.getByRole('button', { name: 'Driver group', exact: true }).click()
        await expect(sections.getByRole('button', { name: 'Driver group', exact: true })).toHaveAttribute('aria-current', 'page')
        await expect(sections.getByRole('button', { name: 'Profile', exact: true })).not.toHaveAttribute('aria-current', 'page')
      } else {
        const trigger = sections.getByRole('button')
        await expect(trigger).toContainText('Profile')
        await trigger.click()
        await expect(page.getByRole('menuitemradio', { name: /^Profile/ })).toHaveAttribute('aria-checked', 'true')
        await page.getByRole('menuitemradio', { name: /^Driver group/ }).click()
        await expect(trigger).toContainText('Driver group')
      }
      await expect(page).toHaveURL(/(?:\?|&)tab=driver_group(?:&|$)/)
      await page.screenshot({ path: testInfo.outputPath(`${name}-delivery-3-drivers.png`), fullPage: true })

      expect(network.blockedWrites.length).toBe(writesBeforeInteractions)
      expect(pageErrors).toEqual([])
      expectClosedBatchBoundary(network)
    })
  })
}
