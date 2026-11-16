import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

import {
  expect,
  expectClosedNetworkBoundary,
  installAppNetworkBoundary,
  installSyntheticSession,
  test
} from './fixtures'
import { expectTouchTarget } from '../touch-target'

const viewports = {
  desktop: { width: 1440, height: 1000 },
  mobile: { width: 390, height: 844 }
}

const parseRgb = color => color.match(/[\d.]+/g).slice(0, 3).map(Number)
const luminance = color => parseRgb(color).map(value => value / 255)
  .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
const contrast = (foreground, background) => {
  const a = luminance(foreground)
  const b = luminance(background)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

async function effectiveColors (locator) {
  return locator.evaluate(element => {
    // redesign 5.2: a Product Checkbox is transparent; what is seen is its drawn box. Unchecked, that is
    // the box border on the box fill (WCAG 1.4.11); checked, the check mark on the filled box.
    const box = element.querySelector('.odc-checkbox-box')
    if (box) {
      const boxStyle = getComputedStyle(box)
      const mark = box.querySelector('svg')
      return { foreground: mark ? getComputedStyle(mark).color : boxStyle.borderTopColor, background: boxStyle.backgroundColor }
    }
    const foregroundTarget = element.querySelector('svg') || element
    const foreground = getComputedStyle(foregroundTarget).color
    let background = 'rgba(0, 0, 0, 0)'
    let current = element
    while (current) {
      const candidate = getComputedStyle(current).backgroundColor
      const values = candidate.match(/[\d.]+/g)?.map(Number) || []
      if (candidate !== 'transparent' && (values.length === 3 || values[3] > 0.99)) {
        background = candidate
        break
      }
      current = current.parentElement
    }
    return { foreground, background }
  })
}

async function expectButtonUsable (page, button, { touch, insetFocus = false, softFocusOffset = false }) {
  await expect(button).toBeVisible()
  const box = await button.boundingBox()
  expect(box.width).toBeGreaterThan(0)
  expect(box.height).toBeGreaterThan(0)
  if (touch) {
    // redesign W0 T0-45 (W0-E-08, decision 12): 32px visible or more with the 44×44 area (corners at ±21px), or 44 drawn (W0-D-08).
    await expectTouchTarget(button, { label: await button.getAttribute('aria-label') || await button.textContent() })
  }
  const colors = await effectiveColors(button)
  expect(contrast(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5)
  await page.keyboard.press('Tab')
  await button.focus()
  expect(await button.evaluate(element => element.matches(':focus-visible'))).toBe(true)
  await expect(button).toHaveCSS('outline-width', '2px', { timeout: 5000 })
  await expect(button).toHaveCSS('outline-style', 'solid', { timeout: 5000 })
  // redesign 5.2: the Product Tabs and SelectionBar draw the same 2px ring inside the control
  // (--od-x-focus-inset = minus the ring width, C3), because their clipping container would cut an outer ring.
  // redesign 5.2: the Product Checkbox draws its ring at offset 0 (checkbox.css), not at the 2px offset
  // this spec requires. That is a wrapper decision, not an approved change of the ring, so the
  // assertion is NOT relaxed: it is soft, which keeps it red with its measure while the rest runs.
  const offset = expect.configure({ soft: softFocusOffset })
  await offset(button).toHaveCSS('outline-offset', insetFocus ? '-2px' : '2px', { timeout: 5000 })
}

async function expectNoHorizontalPageOverflow (page, { soft = false } = {}) {
  const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
  // redesign 5.2: with isMobile, an overflowing page makes innerWidth grow to the document width, so the
  // old comparison could pass vacuously; the page must also still be the viewport that was set.
  const configured = page.viewportSize().width
  const check = expect.configure({ soft })
  check(geometry.document, `document scrollWidth vs the ${configured}px viewport`).toBeLessThanOrEqual(configured)
  check(geometry.viewport, 'layout viewport did not grow').toBe(configured)
}

async function captureEvidence (page, testInfo, name, touch) {
  const path = testInfo.outputPath(`${name}.png`)
  await mkdir(dirname(path), { recursive: true })
  expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(touch)
  const screenshot = await page.screenshot({ path, fullPage: !touch })
  expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(touch)
  expect(screenshot.byteLength).toBeGreaterThan(10000)
}

async function dismissReadOnlyNotices (page) {
  const accept = page.getByRole('button', { name: 'Accept', exact: true })
  if (await accept.count()) await accept.last().click()
}

for (const [viewportName, viewport] of Object.entries(viewports)) {
  test.describe(`${viewportName} populated Button consumers`, () => {
    test.use({ viewport, hasTouch: viewportName === 'mobile', isMobile: viewportName === 'mobile' })

    test(`${viewportName} Orders renders rows and cancels delete confirmation without writes`, async ({ context, page }, testInfo) => {
      const network = await installAppNetworkBoundary(context, { scenario: 'populated' })
      await installSyntheticSession(context, { authenticated: true })
      const pageErrors = []
      page.on('pageerror', error => pageErrors.push(error.message))

      await page.goto('/orders', { waitUntil: 'domcontentloaded' })
      // redesign 5.6: below 768px /orders lists cards (li.odc-order-card), not table rows; desktop keeps `tbody tr`.
      const orderRow = page.locator(viewportName === 'mobile' ? 'li.odc-order-card' : 'tbody tr').filter({ hasText: '910001' }).first()
      await expect(orderRow).toContainText('Pending', { timeout: 90000 })
      // redesign 5.2: the table drops its low-priority columns by width (business under 1100px,
      // customer under 900px), so the store and customer names are asserted where they render.
      if (viewportName === 'desktop') {
        await expect(orderRow).toContainText('Synthetic Store Alpha')
        await expect(orderRow).toContainText('Fixture Customer')
      }
      await dismissReadOnlyNotices(page)
      // redesign 5.2: soft and early, so a page-level horizontal scroll is reported with its measure
      // instead of only as a later click that the overflowing mobile layout blocks.
      await expectNoHorizontalPageOverflow(page, { soft: true })
      // redesign 5.2: the status filter is a Product Tabs (role=tab, aria-selected), not buttons with aria-pressed.
      const statusTab = page.locator('.order_status_filter').getByRole('tab').first()
      await expect(statusTab).toHaveAttribute('type', 'button')
      await expect(statusTab).toHaveAttribute('aria-selected', 'true')
      await expectButtonUsable(page, statusTab, { touch: viewportName === 'mobile', insetFocus: true })
      const createButton = page.getByRole('button', { name: 'Create custom order', exact: true })
      await expectButtonUsable(page, createButton, { touch: viewportName === 'mobile' })
      const createHeightBefore = (await createButton.boundingBox()).height

      const writesBefore = network.blockedWrites.length
      if (viewportName === 'desktop') {
        const rowSelection = orderRow.locator('.orderCheckBox')
        // redesign 5.2: the row selector is a Product Checkbox (role=checkbox, aria-checked) that keeps the orderCheckBox class.
        await expect(rowSelection).toHaveAttribute('role', 'checkbox')
        await expect(rowSelection).toHaveAttribute('aria-checked', 'false')
        await expectButtonUsable(page, rowSelection, { touch: viewportName === 'mobile', softFocusOffset: true })
        await rowSelection.focus()
        await rowSelection.press('Space')
        await expect(rowSelection).toHaveAttribute('aria-checked', 'true')
        // redesign 5.2: checked, the mark must read on the filled box at the same 4.5:1.
        const checkedColors = await effectiveColors(rowSelection)
        expect(contrast(checkedColors.foreground, checkedColors.background)).toBeGreaterThanOrEqual(4.5)
        // redesign 5.2: bulk Delete lives in the selection bar on both viewports and is named "Delete…"
        // (the approved prototype's label); on mobile it used to be an unnamed sibling of Create.
        const deleteButton = page.getByRole('button', { name: /^Delete…?$/ })
        // redesign 5.2: the selection bar clips its content, so its buttons draw the ring inside (selection-bar.css).
        await expectButtonUsable(page, deleteButton, { touch: viewportName === 'mobile', insetFocus: true })
        await deleteButton.click()
        // redesign fix-qa E5: the password confirmation is a Product dialog that names what is deleted
        // («Delete 1 order?») and closes with Cancel.
        const confirm = page.getByRole('dialog', { name: /^Delete (1 order|\d+ orders|the selected orders)\?$/ })
        await expect(confirm).toBeVisible()
        await confirm.getByRole('button', { name: 'Cancel', exact: true }).click()
        await expect(confirm).toHaveCount(0)
      } else {
        // redesign 5.6: a phone lists cards and has no row selection or bulk Delete (the selection bar does not appear below 768px).
        // The pending card's own actions are the mobile consumers of Button here: each is a 44px target with the same contrast
        // and ring, and rejecting only asks first, so cancelling the confirmation writes nothing.
        const rejectButton = orderRow.getByRole('button', { name: 'Reject order #910001', exact: true })
        const acceptButton = orderRow.getByRole('button', { name: 'Accept order #910001', exact: true })
        await expectButtonUsable(page, rejectButton, { touch: true })
        await expectButtonUsable(page, acceptButton, { touch: true })
        await rejectButton.click()
        await expect(page.getByRole('heading', { name: 'Reject order #910001?', exact: true })).toBeVisible()
        const keepButton = page.getByRole('button', { name: 'Keep order', exact: true })
        await expectButtonUsable(page, keepButton, { touch: true })
        await keepButton.click()
        await expect(page.getByRole('heading', { name: 'Reject order #910001?', exact: true })).toHaveCount(0)
      }
      await expectButtonUsable(page, createButton, { touch: viewportName === 'mobile' })
      const selectedGeometry = await createButton.evaluate(element => ({
        height: element.getBoundingClientRect().height,
        hiddenHeight: element.scrollHeight - element.clientHeight,
        hiddenWidth: element.scrollWidth - element.clientWidth,
        siblingIndex: [...element.parentElement.children].indexOf(element)
      }))
      // redesign 5.2: the page header buttons are the governed control height (32px) on a fine pointer;
      // 44px is the coarse-pointer target (C3). The floor is read from the tokens, and the button must not
      // shrink after selecting and cancelling (the regression this assertion guards).
      const createFloor = await page.evaluate(({ mobile }) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(mobile ? '--od-x-target-coarse' : '--od-x-control-height')), { mobile: viewportName === 'mobile' })
      expect(createFloor).toBe(viewportName === 'mobile' ? 44 : 32)
      expect(selectedGeometry.height, 'Create custom order target after selection and cancellation').toBeGreaterThanOrEqual(createFloor)
      expect(selectedGeometry.height, 'Create custom order does not shrink after selection and cancellation').toBeGreaterThanOrEqual(createHeightBefore - 0.5)
      expect(selectedGeometry.hiddenHeight, 'Create custom order text must not clip vertically').toBeLessThanOrEqual(1)
      expect(selectedGeometry.hiddenWidth, 'Create custom order text must not clip horizontally').toBeLessThanOrEqual(1)
      expect(selectedGeometry.siblingIndex, 'Create custom order keeps its first action position').toBe(0)
      expect(network.blockedWrites.length).toBe(writesBefore)
      await expectNoHorizontalPageOverflow(page, { soft: true })
      await captureEvidence(page, testInfo, `${viewportName}-orders-populated-buttons`, viewportName === 'mobile')

      // redesign 5.2: the third tab is Completed; Enter selects it and aria-selected replaces aria-pressed.
      const completedTab = page.locator('.order_status_filter').getByRole('tab').nth(2)
      await expect(completedTab).toContainText('Completed')
      await completedTab.focus()
      await completedTab.press('Enter')
      await expect(completedTab).toHaveAttribute('aria-selected', 'true')
      await expect(page).toHaveURL(/status=completed/)

      expect(pageErrors).toEqual([])
      expectClosedNetworkBoundary(network)
    })

    // redesign stores 1.C: /stores/list is the Product list now. The filter modal became pills in the filter bar
    // (S/StoresList/StoresFilters.jsx), and below 768px the rows are cards (RecordCardList, li.odc-order-card). The test keeps
    // what it measured: the header buttons usable, a filter control opened and dismissed without choosing anything, no write,
    // no horizontal overflow, and the touch target on the phone (decision 12: 32px drawn with the 44×44 area, or 44 drawn).
    test(`${viewportName} Stores renders rows and cancels a filter popover without writes`, async ({ context, page }, testInfo) => {
      const network = await installAppNetworkBoundary(context, { scenario: 'populated' })
      await installSyntheticSession(context, { authenticated: true })
      const pageErrors = []
      page.on('pageerror', error => pageErrors.push(error.message))

      await page.goto('/stores/list', { waitUntil: 'domcontentloaded' })
      const storeRow = page.locator(viewportName === 'mobile' ? 'li.odc-order-card' : 'tbody tr').filter({ hasText: 'Synthetic Store Alpha' }).first()
      await expect(storeRow).toContainText('Fixture City', { timeout: 90000 })
      await dismissReadOnlyNotices(page)
      for (const name of ['Refresh', 'Add new store', 'Sync']) {
        // «Add new store» is twice: the primary button of the header and the link under the list; the header one is measured
        await expectButtonUsable(page, page.getByRole('button', { name, exact: true }).first(), { touch: viewportName === 'mobile' })
      }

      const writesBefore = network.blockedWrites.length
      const filters = page.getByRole('group', { name: 'Store filters' })
      const cityPill = filters.getByRole('button', { name: 'City', exact: true })
      await expectButtonUsable(page, cityPill, { touch: viewportName === 'mobile' })
      await cityPill.click()
      const popover = page.getByRole('dialog', { name: 'City' })
      await expect(popover).toBeVisible()
      await expect(popover.getByRole('checkbox', { name: 'Fixture City' })).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(popover).toHaveCount(0)
      await expect(cityPill).toBeFocused()
      // nothing was chosen: no chip, no «Clear filters»
      await expect(page.getByRole('list', { name: 'Active filters' })).toHaveCount(0)
      expect(network.blockedWrites.length).toBe(writesBefore)
      await expectNoHorizontalPageOverflow(page)
      await captureEvidence(page, testInfo, `${viewportName}-stores-populated-buttons`, viewportName === 'mobile')

      expect(pageErrors).toEqual([])
      expectClosedNetworkBoundary(network)
    })
  })
}
