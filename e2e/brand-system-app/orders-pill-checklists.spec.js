// redesign fix-qa D1: the pill popovers of /orders (Status, Driver, Driver group) opened and then ignored every click.
// The popover registers an overlay layer, which creates the shared host `#app-modals` (a fixed, full-screen layer);
// the popup mounted in `body`, under that host, so the host took the clicks. jsdom has no hit testing, so the unit
// tests passed. This spec measures it in the real app with the synthetic API: the row under the pointer belongs to
// the popup, a real click checks it, the pill counts it, the chip shows it, and the orders request carries the filter.
//   pnpm exec playwright test --config scripts/brand-system/playwright.app.config.mjs orders-pill-checklists
//
// redesign F1b: the same spec also covers D-05 (the Date and Business pills filter in their own popover and never open
// the Filters sheet), D-06 (the bar is one row; a pill that does not fit is opened from «+N»; opening an order does not
// move the table) and D-11 (one click outside an open popover closes it and reaches the next pill).
import {
  expect,
  installAppNetworkBoundary,
  installSyntheticSession,
  test
} from './fixtures'

// Reads only (the boundary blocks every write): the three filters of `filter_order_options`, and the lists the
// driver and driver group checklists need, registered after the shared boundary so they take precedence.
const openOrders = async (context, page, viewport) => {
  await installAppNetworkBoundary(context, { scenario: 'populated' })
  await context.route('**/fixture-api/**/configs*', route => route.fulfill({
    json: {
      error: false,
      result: { filter_order_options: { key: 'filter_order_options', value: 'driver|driver_group|external_id' } }
    }
  }))
  await context.route('**/fixture-api/**/controls/orders?*', route => route.fulfill({
    json: {
      error: false,
      result: {
        cities: [],
        drivers: [
          { id: 960001, name: 'Ada', lastname: 'Lovelace', enabled: true, photo: null },
          { id: 960002, name: 'Grace', lastname: 'Hopper', enabled: true, photo: null }
        ],
        driver_groups: [],
        assignable_driver_groups: [{ id: 975001, name: 'Downtown couriers' }, { id: 970001, name: 'Weekend couriers' }],
        paymethods: [],
        businesses: [{ id: 920001, name: 'Fast Bite', logo: null }, { id: 920002, name: 'Green Bowl', logo: null }],
        administrators: []
      }
    }
  }))
  await context.route('**/fixture-api/**/orders/910001/logs*', route => route.fulfill({ json: { error: false, result: [] } }))
  await installSyntheticSession(context, { authenticated: true })
  await page.setViewportSize(viewport)
  const filtered = []
  page.on('request', request => {
    const url = decodeURIComponent(request.url())
    if (/\/orders\?/.test(url) && /where=/.test(url)) filtered.push(url)
  })
  await page.goto('/orders', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('tbody tr, .odc-order-card').filter({ hasText: '910001' }).first()).toContainText('Pending', { timeout: 90000 })
  const accept = page.getByRole('button', { name: 'Accept', exact: true })
  if (await accept.count()) await accept.last().click()
  return filtered
}

// The element under the middle of the first row, asked the way a pointer asks it.
const rowIsOnTop = (row) => row.evaluate(element => {
  const { x, y, width, height } = element.getBoundingClientRect()
  const hit = document.elementFromPoint(x + width / 2, y + height / 2)
  return Boolean(hit) && element.closest('[role="dialog"]').contains(hit)
})

// redesign F1b (D-06): a pill that does not fit the one row is parked and lives in the «+N» menu. A user opens it from
// there, so does this spec; a pill that is in the row is just clicked.
const OVERFLOW = '[data-filterbar-overflow]'
// redesign F6c-2 (0d110482): a pill with a value is named with it («Driver Ada Lovelace»), so it is found by its label.
const pillButton = (page, name) => page.locator('.odc-filterbar-filters button')
  .filter({ has: page.locator('.odc-pill-label', { hasText: new RegExp(`^${name}$`) }) })
const openPill = async (page, name) => {
  const pill = pillButton(page, name)
  if (await pill.isVisible()) {
    await pill.click()
    return
  }
  await page.locator(OVERFLOW).click()
  await page.getByRole('menuitem', { name: new RegExp(`^${name}`) }).click()
}
// The pill says its value, in the row or, when it is parked, in the «+N» menu (and «+N» is marked active).
// redesign F6d-1, F6e-1 (Q3-02, Q4-01): while its popover is open a parked pill stays parked (the popover is anchored
// to it), and when the popover closes a pill with a value takes a place in the row if there is room. So the value is
// read with the popover closed: the pill in the row, or «+N» marked active and listing it with its value.
const expectPillValue = async (page, counted, label) => {
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: label, exact: true })).toHaveCount(0)
  const pill = page.getByRole('button', { name: counted })
  const more = page.locator(`${OVERFLOW}[data-active]`)
  await expect(pill.first().or(more)).toBeVisible()
  if (await pill.first().isVisible()) return
  await more.click()
  await expect(page.getByRole('menuitem', { name: new RegExp(`^${label}`) })).toHaveAccessibleDescription(/\S/)
  await page.keyboard.press('Escape')
}

// The popover was closed to read the value: open it again from wherever the pill is now, the row or «+N».
const ensureOpen = async (page, popup, label) => {
  if (await popup.isVisible()) return
  await openPill(page, label)
  await expect(popup).toBeVisible()
}

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'phone', width: 390, height: 844 }
]) {
  test.describe(`Orders pill checklists on a ${viewport.name} viewport`, () => {
    test(`a click on a row of Status, Driver and Driver group checks it and filters the list (${viewport.name})`, async ({ context, page }) => {
      test.setTimeout(180000)
      const filtered = await openOrders(context, page, viewport)
      const cases = [
        // redesign F6c-2 (0d110482, one value format): one status reads as its name («Status Preorder»), not a count
        { pill: 'Status', attribute: 'status', counted: /^Status \S/, chip: /Status/ },
        { pill: 'Driver', attribute: 'driver_id', counted: /^Driver (?!group)\S/, chip: /Driver: / },
        { pill: 'Driver group', attribute: 'driver_group', counted: /^Driver group \S/, chip: /Driver group: / }
      ]
      for (const { pill, attribute, counted, chip } of cases) {
        await openPill(page, pill)
        const popup = page.getByRole('dialog', { name: pill, exact: true })
        await expect(popup).toBeVisible()
        const rows = popup.getByRole('checkbox')
        await expect(rows.first()).toBeVisible()
        // the red line: the shared host `#app-modals` on top of the popup took the pointer
        expect(await rowIsOnTop(rows.first()), `${pill}: the row is the element under the pointer`).toBe(true)
        const before = filtered.length
        // Status: the first row is what the tab already holds, so the second one changes the filter
        const row = pill === 'Status' ? rows.nth(1) : rows.first()
        await row.click({ timeout: 10000 })
        await expect(row).toHaveAttribute('aria-checked', 'true')
        await expect.poll(() => filtered.slice(before).some(url => url.includes(attribute)), { message: `${pill}: the orders request carries ${attribute}` }).toBe(true)
        if (pill !== 'Status') await expect(page.getByRole('list', { name: 'Active filters' })).toContainText(chip)
        await expectPillValue(page, counted, pill)
        await ensureOpen(page, popup, pill)
        // and it unchecks
        await row.click()
        await expect(row).toHaveAttribute('aria-checked', 'false')
        await page.keyboard.press('Escape')
        await expect(popup).toHaveCount(0)
      }
    })
  })
}

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'phone', width: 390, height: 844 }
]) {
  test.describe(`Date and Business pills on a ${viewport.name} viewport (D-05, D-11)`, () => {
    test(`Business filters from its own checklist, without the Filters sheet (${viewport.name})`, async ({ context, page }) => {
      test.setTimeout(180000)
      const filtered = await openOrders(context, page, viewport)
      await openPill(page, 'Business')
      const popup = page.getByRole('dialog', { name: 'Business', exact: true })
      await expect(popup).toBeVisible()
      await expect(page.getByRole('dialog', { name: 'Filters', exact: true })).toHaveCount(0)
      const rows = popup.getByRole('checkbox')
      await expect(rows).toHaveCount(2)
      expect(await rowIsOnTop(rows.first()), 'the row is the element under the pointer').toBe(true)
      const before = filtered.length
      await rows.first().click({ timeout: 10000 })
      await expect(rows.first()).toHaveAttribute('aria-checked', 'true')
      await expect.poll(() => filtered.slice(before).some(url => url.includes('business_id')), { message: 'the orders request carries business_id' }).toBe(true)
      await expect(page.getByRole('list', { name: 'Active filters' })).toContainText('Business: Fast Bite')
      await expectPillValue(page, /^Business Fast Bite/, 'Business')
      await ensureOpen(page, popup, 'Business')
      await popup.getByRole('button', { name: 'Clear', exact: true }).click()
      await expect(rows.first()).toHaveAttribute('aria-checked', 'false')
      await page.keyboard.press('Escape')
      await expect(popup).toHaveCount(0)
    })

    test(`Date filters from its own date range, without the Filters sheet (${viewport.name})`, async ({ context, page }) => {
      test.setTimeout(180000)
      const filtered = await openOrders(context, page, viewport)
      await openPill(page, 'Date')
      const popup = page.getByRole('dialog', { name: 'Select a date', exact: true })
      await expect(popup).toBeVisible()
      await expect(page.getByRole('dialog', { name: 'Filters', exact: true })).toHaveCount(0)
      const before = filtered.length
      // «Yesterday» sets both bounds, so the request carries the end bound, which no default filter does
      await popup.getByRole('button', { name: 'Yesterday', exact: true }).click()
      await expect.poll(() => filtered.slice(before).some(url => url.includes('delivery_datetime') && url.includes('"<="')), { message: 'the orders request carries the end of the date range' }).toBe(true)
      await expectPillValue(page, /^Date Yesterday/, 'Date')
      await expect(page.getByRole('list', { name: 'Active filters' })).toContainText('Date: Yesterday')
    })

    test(`one click outside an open popover closes it and opens the next pill (${viewport.name})`, async ({ context, page }) => {
      test.setTimeout(180000)
      await openOrders(context, page, viewport)
      await page.getByRole('button', { name: 'Driver', exact: true }).click()
      const driver = page.getByRole('dialog', { name: 'Driver', exact: true })
      await expect(driver).toBeVisible()
      // the click lands on the pill under the pointer: the shared host must not take it
      // redesign F6f-1 (Q5-01, Q5-02, b16f8db8): the row holds the room of «Filters N» and «Clear filters», so at 1440 Business
      // is in «+N»; the next pill in the row, Driver group, is the one clicked.
      await page.getByRole('button', { name: 'Driver group', exact: true }).click()
      await expect(page.getByRole('dialog', { name: 'Driver group', exact: true })).toBeVisible()
      await expect(driver).toHaveCount(0)
      // and a click on the page closes the popover and reaches what is under it: the search field gets the focus
      await page.getByRole('searchbox', { name: /Search by order number/ }).click()
      await expect(page.getByRole('dialog', { name: 'Driver group', exact: true })).toHaveCount(0)
      await expect(page.getByRole('searchbox', { name: /Search by order number/ })).toBeFocused()
    })
  })
}

test.describe('the bar is one row with «+N» (D-06)', () => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }]) {
    test(`opening an order does not change the bar: one row, same height, the table keeps its place under it (${viewport.width})`, async ({ context, page }) => {
      test.setTimeout(180000)
      await openOrders(context, page, viewport)
      const bar = page.getByRole('group', { name: 'Order filters' })
      const barBox = () => bar.evaluate(node => {
        const box = node.getBoundingClientRect()
        const table = document.querySelector('table').getBoundingClientRect()
        return { top: Math.round(box.top), height: Math.round(box.height), tableTop: Math.round(table.top), gap: Math.round(table.top - box.bottom) }
      })
      const before = await barBox()
      // the first order opens in the split panel and the list narrows
      await page.locator('tbody tr').filter({ hasText: '910001' }).first().click()
      await expect(page).toHaveURL(/[?&]id=910001/)
      // let the panel finish its 180ms entry and the bar its measure
      await page.waitForTimeout(800)
      const open = await barBox()
      expect(open.height, 'the bar kept its height').toBe(before.height)
      expect(Math.abs(open.gap - before.gap), 'the table keeps its place under the bar').toBeLessThanOrEqual(1)
      // One row: every control of the bar that is drawn shares one line, with the pills that did not fit in «+N».
      const tops = await bar.locator('.odc-filterbar-start :is(.odc-search, .odc-pill, .odc-btn)').evaluateAll(nodes => nodes
        .filter(node => node.getBoundingClientRect().width > 0 && getComputedStyle(node).visibility !== 'hidden')
        .map(node => Math.round(node.getBoundingClientRect().top + node.getBoundingClientRect().height / 2)))
      expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(2)
      await expect(page.locator(OVERFLOW)).toBeVisible()
      // The page head above the bar is another component: at 1440 nothing above the bar moves either.
      if (viewport.width >= 1440) expect(Math.abs(open.tableTop - before.tableTop), 'the table did not move').toBeLessThanOrEqual(1)
    })
  }

  test('a pill in «+N» opens its own popover from there and filters', async ({ context, page }) => {
    test.setTimeout(180000)
    const filtered = await openOrders(context, page, { width: 900, height: 800 })
    const more = page.locator('[data-filterbar-overflow]')
    await expect(more).toBeVisible()
    await more.click()
    await page.getByRole('menuitem', { name: /^Business/ }).click()
    const popup = page.getByRole('dialog', { name: 'Business', exact: true })
    await expect(popup).toBeVisible()
    // it opens under «+N» (the viewport may shift it sideways, but it still sits under the button), not where the parked pill is
    const box = await popup.boundingBox()
    const anchor = await more.boundingBox()
    expect(box.y).toBeGreaterThanOrEqual(anchor.y + anchor.height)
    expect(box.y).toBeLessThanOrEqual(anchor.y + anchor.height + 24)
    expect(box.x).toBeLessThanOrEqual(anchor.x + anchor.width)
    expect(box.x + box.width).toBeGreaterThanOrEqual(anchor.x)
    const before = filtered.length
    await popup.getByRole('checkbox').first().click()
    await expect.poll(() => filtered.slice(before).some(url => url.includes('business_id'))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(popup).toHaveCount(0)
    // redesign Q2-06 (0d110482), F6d-1: with a value, Business takes a place in the row when its popover closes (if there
    // is room), and the focus goes back to the pill where it is now (resolveOpener): the pill in the row, or «+N» while
    // it is still parked. Never to <body> or to an invisible node.
    await expect.poll(() => page.evaluate(() => {
      const active = document.activeElement
      if (!active || active === document.body || active.closest('[data-overflowed]')) return 'lost'
      const unit = [...document.querySelectorAll('.odc-filterbar-filters > *')].find(node => /^Business/.test(node.textContent.trim()))
      if (!unit) return 'no Business pill'
      if (unit.hasAttribute('data-overflowed')) return active.hasAttribute('data-filterbar-overflow') ? 'ok' : 'parked, focus elsewhere'
      return unit.contains(active) ? 'ok' : 'in the row, focus elsewhere'
    })).toBe('ok')
  })
})

test('the Filters sheet answers its fields on a phone (bottom sheet): a delivery type is picked and applied', async ({ context, page }) => {
  test.setTimeout(180000)
  const filtered = await openOrders(context, page, { width: 390, height: 844 })
  await page.getByRole('button', { name: /^Filters/ }).first().click()
  const sheet = page.getByRole('dialog', { name: 'Filters' })
  await expect(sheet).toBeVisible()
  await sheet.getByText('Select delivery type', { exact: true }).click()
  await page.getByRole('option').first().click()
  const before = filtered.length
  await sheet.getByRole('button', { name: 'Apply' }).click()
  await expect.poll(() => filtered.slice(before).some(url => url.includes('delivery_type')), { message: 'the orders request carries delivery_type' }).toBe(true)
  await expect(page.getByRole('list', { name: 'Active filters' })).toContainText('Delivery type: Delivery')
})
