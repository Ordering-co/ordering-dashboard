// Audit 4 of batch 5.2 (header and filters of /orders) measured in the real app with the synthetic API:
// Learn is a menu of links (axe, arrows, 16px icon, icon-only head) and «Clear filters» has the control height.
// The «Select …» placeholders of the filters sheet are not here: with the synthetic API the sheet's pickers
// (BusinessesSelector, DriversGroupTypeSelector, PaymethodTypeSelector) throw on undefined lists, so that
// colour is covered by Orders/OrdersFilterGroup/__tests__/OrdersFilterGroup.audit4.test.jsx.
//   pnpm exec playwright test --config scripts/brand-system/playwright.app.config.mjs orders-pilot-audit4
import AxeBuilder from '@axe-core/playwright'

import {
  expect,
  installAppNetworkBoundary,
  installSyntheticSession,
  test
} from './fixtures'

const openOrders = async (context, page, viewport) => {
  await installAppNetworkBoundary(context, { scenario: 'populated' })
  await installSyntheticSession(context, { authenticated: true })
  await page.setViewportSize(viewport)
  await page.goto('/orders', { waitUntil: 'domcontentloaded' })
  const row = page.locator('tbody tr').filter({ hasText: '910001' }).first()
  await expect(row).toContainText('Pending', { timeout: 90000 })
  const accept = page.getByRole('button', { name: 'Accept', exact: true })
  if (await accept.count()) await accept.last().click()
}

const bar = page => page.getByRole('group', { name: 'Order filters' })
const seriousViolations = async (page, scope) => {
  const builder = new AxeBuilder({ page })
  if (scope) builder.include(scope)
  const { violations } = await builder.analyze()
  return violations
    .filter(violation => ['serious', 'critical'].includes(violation.impact))
    .map(violation => `${violation.id}: ${violation.nodes.map(node => node.target.join(' ')).join(' | ')}`)
}

test('Learn is a menu of links: named trigger, arrows, no listbox, no axe violation while open', async ({ context, page }) => {
  test.setTimeout(120000)
  await openOrders(context, page, { width: 1440, height: 900 })
  const trigger = page.getByRole('button', { name: 'Learn', exact: true })
  await expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
  await trigger.click()
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  await expect(page.getByRole('listbox')).toHaveCount(0)
  const items = menu.getByRole('menuitem')
  expect(await items.count()).toBeGreaterThan(0)
  // Every item names its article and says it opens in a new tab (icon and description).
  for (const item of await items.all()) {
    await expect(item).toHaveAccessibleDescription('opens in a new tab')
    await expect(item.locator('svg')).toHaveCount(1)
  }
  // Arrows move the focus; the items are not Tab stops (roving focus).
  await page.keyboard.press('ArrowDown')
  await expect(items.first()).toBeFocused()
  if (await items.count() > 1) {
    await page.keyboard.press('ArrowDown')
    await expect(items.nth(1)).toBeFocused()
  }
  expect(await items.evaluateAll(nodes => nodes.filter(node => node.tabIndex === 0).length)).toBeLessThanOrEqual(1)
  expect(await seriousViolations(page)).toEqual([])
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('Learn is a 16px icon with its text at the control height, and keeps a visible name below 700px of head', async ({ context, page }) => {
  test.setTimeout(120000)
  await openOrders(context, page, { width: 1440, height: 900 })
  const trigger = page.getByRole('button', { name: 'Learn', exact: true })
  const wide = await trigger.evaluate(node => {
    const icon = node.querySelector('svg').getBoundingClientRect()
    const label = node.querySelector('.od-learn-label').getBoundingClientRect()
    return { icon: [Math.round(icon.width), Math.round(icon.height)], height: Math.round(node.getBoundingClientRect().height), labelWidth: Math.round(label.width) }
  })
  expect(wide.icon).toEqual([16, 16])
  expect(wide.height).toBe(32)
  expect(wide.labelWidth).toBeGreaterThan(8)

  // A narrow window with the detail panel: the head measures under 700px and Learn keeps only its icon.
  await page.setViewportSize({ width: 800, height: 900 })
  await expect.poll(() => page.locator('.odc-page-head').evaluate(node => node.clientWidth)).toBeLessThan(700)
  const narrow = await trigger.evaluate(node => {
    const label = node.querySelector('.od-learn-label').getBoundingClientRect()
    return { labelWidth: Math.round(label.width), title: node.getAttribute('title') }
  })
  expect(narrow.labelWidth, 'the text is clipped, not removed').toBeLessThanOrEqual(1)
  // The name stays (the text is still there) and hovering shows it.
  await expect(trigger).toHaveAccessibleName('Learn')
  expect(narrow.title).toBe('Learn')
})

test('«Clear filters» in the bar is as tall as its neighbours (32px), not 28px', async ({ context, page }) => {
  test.setTimeout(120000)
  await openOrders(context, page, { width: 1440, height: 900 })
  await bar(page).getByRole('button', { name: 'SLA', exact: true }).click()
  await page.getByRole('menuitemradio', { name: 'On time' }).click()
  const clear = bar(page).locator('.odc-filterbar-clear').getByRole('button', { name: 'Clear filters' })
  await expect(clear).toBeVisible()
  const heights = await bar(page).evaluate(node => {
    const height = selector => Math.round(node.querySelector(selector).getBoundingClientRect().height)
    return { clear: height('.odc-filterbar-clear button'), filters: height('.odc-filterbar-more button'), search: height('.odc-search') }
  })
  expect(heights.clear).toBe(heights.filters)
  expect(heights.clear).toBe(heights.search)
})
