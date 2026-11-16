// Audit 3 of batch 5.2 (header and filters of /orders) measured in the real app with the synthetic API:
// the pills never hide at 1280-1440, the table tools stay in a split view, Export keeps its size when it
// opens, the head wraps as one group, and the focus survives removing the last filter chip.
//   pnpm exec playwright test --config scripts/brand-system/playwright.app.config.mjs orders-pilot-audit3
import {
  expect,
  installAppNetworkBoundary,
  installSyntheticSession,
  test
} from './fixtures'

const openOrders = async (context, page, viewport, { panel = false } = {}) => {
  await installAppNetworkBoundary(context, { scenario: 'populated' })
  await installSyntheticSession(context, { authenticated: true })
  await page.setViewportSize(viewport)
  await page.goto('/orders', { waitUntil: 'domcontentloaded' })
  const row = page.locator('tbody tr').filter({ hasText: '910001' }).first()
  await expect(row).toContainText('Pending', { timeout: 90000 })
  const accept = page.getByRole('button', { name: 'Accept', exact: true })
  if (await accept.count()) await accept.last().click()
  if (panel) {
    await row.getByText('#910001', { exact: true }).click()
    await expect(page.locator('#orderDetails')).toBeVisible()
  }
}

const bar = page => page.getByRole('group', { name: 'Order filters' })

// redesign F1b (D-06, ad920cf0): the bar is one row and a pill that does not fit is parked in «+N» (mounted, invisible,
// out of the tab order) instead of being cut or stacked. Every pill in the row is whole, and «+N» counts the parked ones.
const pillsAreWhole = page => bar(page).locator('.odc-filterbar-filters').evaluate(node => {
  const box = node.getBoundingClientRect()
  const pills = [...node.children].filter(pill => getComputedStyle(pill).position !== 'fixed')
  const parked = pills.filter(pill => pill.hasAttribute('data-overflowed'))
  const plus = node.closest('.odc-filterbar').querySelector('[data-filterbar-overflow]')
  const plusShown = Boolean(plus) && getComputedStyle(plus).visibility !== 'hidden' && plus.getBoundingClientRect().width > 0
  return {
    room: node.scrollWidth - node.clientWidth,
    count: pills.length,
    whole: pills.filter(pill => !parked.includes(pill)).every(pill => {
      const rect = pill.getBoundingClientRect()
      return rect.width > 0 && rect.left >= box.left - 1 && rect.right <= box.right + 1
    }) && parked.every(pill => getComputedStyle(pill).visibility === 'hidden') &&
      (parked.length === 0 ? !plusShown : plusShown && plus.textContent.trim().startsWith(`+${parked.length}`))
  }
})

// The fixture project lists four pills, so the five-pill overflow of the audit is measured in the gallery
// (e2e/product-ui, six pills); here the real app is checked for the same outcome: nothing cut, nothing scrolling.
for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }]) {
  test(`${viewport.width}: every filter pill is whole in the bar (stacked when they do not fit in one row)`, async ({ context, page }) => {
    test.setTimeout(120000)
    await openOrders(context, page, viewport)
    const pills = await pillsAreWhole(page)
    expect(pills.count).toBeGreaterThan(3)
    expect(pills.room).toBeLessThanOrEqual(1)
    expect(pills.whole).toBe(true)
  })
}

test('1280 with the detail panel open: the table tools stay and the head keeps its actions together at the end', async ({ context, page }) => {
  test.setTimeout(120000)
  await openOrders(context, page, { width: 1280, height: 800 }, { panel: true })
  await expect(page.getByRole('button', { name: 'Manage columns' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Compact rows' })).toBeVisible()
  const search = await bar(page).locator('.odc-search').boundingBox()
  const columns = await page.getByRole('button', { name: 'Manage columns' }).boundingBox()
  expect(Math.abs((columns.y + columns.height / 2) - (search.y + search.height / 2)), 'tools share the search row').toBeLessThanOrEqual(2)
  const pills = await pillsAreWhole(page)
  expect(pills.whole).toBe(true)

  // The head: whatever wraps, the group ends the line, and Learn is never alone away from the actions.
  const head = await page.locator('.odc-page-head').evaluate(node => {
    const box = node.getBoundingClientRect()
    const rect = selector => {
      const found = node.querySelector(selector)
      if (!found) return null
      const inner = found.getBoundingClientRect()
      return { top: Math.round(inner.top), bottom: Math.round(inner.bottom), left: Math.round(inner.left), right: Math.round(inner.right) }
    }
    return {
      right: Math.round(box.right),
      group: rect('.odc-page-actions'),
      learn: rect('.learn-drop-down'),
      create: rect('[data-action="create"]'),
      exportAction: rect('[data-action="export"]')
    }
  })
  expect(head.group).not.toBeNull()
  expect(Math.abs(head.create.right - head.right), 'New order ends the line').toBeLessThanOrEqual(1)
  // Learn, when the user has it, sits inside the group: never on a line of its own above the others.
  if (head.learn) {
    expect(head.learn.left).toBeGreaterThanOrEqual(head.group.left)
    expect(head.learn.right).toBeLessThanOrEqual(head.group.right)
  }
  expect(head.exportAction.top).toBeGreaterThanOrEqual(head.group.top)
})

test('Export keeps its size and the page does not move when its menu opens', async ({ context, page }) => {
  test.setTimeout(120000)
  await openOrders(context, page, { width: 1440, height: 900 })
  const trigger = page.getByRole('button', { name: 'Export', exact: true })
  const measure = () => page.evaluate(() => {
    const button = [...document.querySelectorAll('[data-action="export"] button')].find(node => node.textContent.trim() === 'Export')
    const tabs = document.querySelector('.order_status_filter')
    return { height: button.getBoundingClientRect().height, width: button.getBoundingClientRect().width, tabsTop: tabs.getBoundingClientRect().top }
  })
  const closed = await measure()
  await trigger.click()
  await expect(page.getByRole('menu')).toBeVisible()
  const open = await measure()
  expect(open.height, 'the trigger keeps its height').toBe(closed.height)
  expect(open.width, 'the trigger keeps its width').toBe(closed.width)
  expect(open.tabsTop, 'the page does not move down').toBe(closed.tabsTop)
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
})

test('removing the last filter chip with the keyboard leaves the focus on Filters, not on the page', async ({ context, page }) => {
  test.setTimeout(120000)
  await openOrders(context, page, { width: 1440, height: 900 })
  await bar(page).getByRole('button', { name: 'SLA', exact: true }).click()
  await page.getByRole('menuitemradio', { name: 'On time' }).click()
  const remove = bar(page).getByRole('button', { name: 'Remove SLA filter' })
  await expect(remove).toBeVisible()
  await remove.focus()
  await page.keyboard.press('Enter')
  await expect(bar(page).getByRole('list', { name: 'Active filters' })).toHaveCount(0)
  await expect(bar(page).getByRole('button', { name: /^Filters/ })).toBeFocused()
})

test('only one Clear filters is visible on desktop', async ({ context, page }) => {
  test.setTimeout(120000)
  await openOrders(context, page, { width: 1440, height: 900 })
  await bar(page).getByRole('button', { name: 'SLA', exact: true }).click()
  await page.getByRole('menuitemradio', { name: 'On time' }).click()
  await expect(bar(page).getByRole('button', { name: 'Clear filters' })).toHaveCount(1)
})

test('the column manager opens with the focus on a checkbox, not on Reset', async ({ context, page }) => {
  test.setTimeout(120000)
  await openOrders(context, page, { width: 1440, height: 900 })
  await page.getByRole('button', { name: 'Manage columns' }).click()
  await expect(page.getByRole('dialog', { name: 'Columns' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('role'))).toBe('checkbox')
})
