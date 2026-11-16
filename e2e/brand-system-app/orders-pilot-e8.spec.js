// Fix batch E8 (hands-on review items 18-20, 28-30) measured in the real app with the synthetic API: 44px targets on a
// phone-width viewport, the account's language menu, the focus that no longer falls to <body>, Reload in Activity with
// every filter, Collapse keeping the tab, the foot not stretching when the order opens as a page, the expand button's
// name, the Skip to content link and the rail submenu's title.
//   pnpm exec playwright test --config scripts/brand-system/playwright.app.config.mjs orders-pilot-e8
import {
  expect,
  installAppNetworkBoundary,
  installSyntheticSession,
  test
} from './fixtures'
import { expectTouchTarget } from '../touch-target'

const openOrders = async (context, page, viewport) => {
  await installAppNetworkBoundary(context, { scenario: 'populated' })
  // The shared fixture has no logistics log for the order (it answers 404 with a string, which the Activity feed cannot
  // read): an empty one, registered after the boundary so it takes precedence. A read, like every other here.
  await context.route('**/fixture-api/**/orders/910001/logs*', route => route.fulfill({ json: { error: false, result: [] } }))
  await installSyntheticSession(context, { authenticated: true })
  await page.setViewportSize(viewport)
  await page.goto('/orders', { waitUntil: 'domcontentloaded' })
  const row = page.locator('tbody tr, .odc-order-card').filter({ hasText: '910001' }).first()
  await expect(row).toContainText('Pending', { timeout: 90000 })
  return row
}

const heights = (page, selector) => page.evaluate(selector => [...document.querySelectorAll(selector)]
  .filter(node => node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0)
  .map(node => ({
    name: (node.getAttribute('aria-label') || node.textContent || node.getAttribute('placeholder') || node.className).trim().slice(0, 30),
    width: Math.round(node.getBoundingClientRect().width),
    height: Math.round(node.getBoundingClientRect().height)
  })), selector)

const tooSmall = list => list.filter(item => item.height < 44 || item.width < 44)

// ── 44px with a mouse at the phone width (the review measured 30-32px) ──
test('phone width with a fine pointer: the page head, the pills, the search and the Filters button are 44px', async ({ context, page }) => {
  test.setTimeout(120000)
  await openOrders(context, page, { width: 390, height: 844 })
  expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), 'a mouse, not a touch screen').toBe(false)
  const head = await heights(page, '.odc-page-head button')
  expect(head.length).toBeGreaterThan(2)
  expect(tooSmall(head), 'page head').toEqual([])
  const names = head.map(item => item.name)
  expect(names).toContain('More actions')
  const bar = await heights(page, '.odc-filterbar .odc-pill, .odc-filterbar .odc-search, .odc-filterbar .odc-search-input, .odc-filterbar button')
  expect(bar.length).toBeGreaterThan(3)
  expect(tooSmall(bar.map(item => ({ ...item, width: 44 }))), 'filter bar').toEqual([])
})

test('phone width with a fine pointer: the rows of an action menu and the foot status selector are 44px', async ({ context, page }) => {
  test.setTimeout(120000)
  await openOrders(context, page, { width: 390, height: 844 })
  await page.getByRole('button', { name: 'More actions' }).first().click()
  await expect(page.getByRole('menu')).toBeVisible()
  const rows = await heights(page, '[role="menu"] [role="menuitem"]')
  expect(rows.length).toBeGreaterThan(0)
  expect(rows.map(row => row.height)).toEqual(rows.map(() => 44))
  await page.keyboard.press('Escape')
  await page.locator('.odc-order-card-link, .odc-order-card').filter({ hasText: '910001' }).first().click()
  await expect(page.locator('.odt-foot')).toBeVisible()
  // redesign W0 T0-45 (W0-E-08, decision 12): the foot of the panel is a skeleton until the order loads (it has `.odt-foot` too), so the
  // real selector is awaited before it is measured; then 32px visible with the 44×44 area (corners at ±21px), or 44 drawn.
  await expect(page.locator('.odt-foot-selector .od-first-select-trigger')).toHaveCount(1)
  await expectTouchTarget(page.locator('.odt-foot-selector .od-first-select-trigger'), { label: 'foot status selector' })
  const rest = page.locator('.odt-foot > .odc-btn')
  expect(await rest.count()).toBeGreaterThan(0)
  for (const button of await rest.all()) await expectTouchTarget(button, { label: 'foot button' })
})

test.describe('the same targets with a coarse pointer', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  test('stay 44px', async ({ context, page }) => {
    test.setTimeout(120000)
    await openOrders(context, page, { width: 390, height: 844 })
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
    expect(tooSmall(await heights(page, '.odc-page-head button')), 'page head').toEqual([])
    expect(tooSmall(await heights(page, '.odc-filterbar .odc-pill, .odc-filterbar .odc-search')).filter(item => item.height < 44)).toEqual([])
  })
})

// The account's language menu needs a project with two or more enabled languages: the synthetic project has one, so it
// is measured in the shell harness (e2e/brand-system/shell-navigation.spec.js › «language popup …»).

// ── Skip to content ──
test('Skip to content is the first Tab stop, shows on focus and takes the focus to the page title', async ({ context, page }) => {
  test.setTimeout(120000)
  await openOrders(context, page, { width: 1440, height: 900 })
  await page.evaluate(() => document.activeElement?.blur())
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Skip to content' })
  await expect(skip).toBeFocused()
  const box = await skip.boundingBox()
  expect(box.width).toBeGreaterThan(40)
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.y).toBeGreaterThanOrEqual(0)
  await page.keyboard.press('Enter')
  await expect(page.locator('h1').first()).toBeFocused()
  expect(new URL(page.url()).hash).toBe('')
  // Out of focus it is out of sight.
  const away = await skip.evaluate(node => node.getBoundingClientRect().width)
  expect(away).toBeLessThanOrEqual(1)
})

// ── The rail's submenu names its section ──
test('a section menu of the collapsed sidebar starts with its section title', async ({ context, page }) => {
  test.setTimeout(120000)
  await openOrders(context, page, { width: 1440, height: 900 })
  const collapse = page.getByRole('button', { name: 'Collapse sidebar' })
  if (await collapse.count()) await collapse.click()
  await expect(page.locator('#side_bar')).toHaveAttribute('data-rail', '')
  await page.locator('.odc-nav-rail-btn').first().click()
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  const title = await menu.evaluate(node => ({ attr: node.getAttribute('data-title'), content: getComputedStyle(node, '::before').content }))
  expect(title.attr).toBeTruthy()
  expect(title.content).toBe(`"${title.attr}"`)
})

// ── The detail panel ──
const openPanel = async (context, page, viewport) => {
  const row = await openOrders(context, page, viewport)
  await row.getByText('#910001', { exact: true }).click()
  await expect(page.locator('#orderDetails')).toBeVisible()
  await expect(page.locator('.odt-foot')).toBeVisible()
}
const panelTab = page => page.locator('.odc-od-tabs [role="tab"][aria-selected="true"]')

test('Reload is in Activity with every filter', async ({ context, page }) => {
  test.setTimeout(120000)
  await openPanel(context, page, { width: 1440, height: 900 })
  await page.locator('.odc-od-tabs').getByRole('tab', { name: /^Activity/ }).click()
  for (const filter of ['All', 'Status', 'Logistics', 'Payments']) {
    await page.locator('#orderDetails').getByRole('button', { name: filter, exact: true }).click()
    await expect(page.locator('#orderDetails').getByRole('button', { name: 'Reload', exact: true }), filter).toBeVisible()
  }
})

// From 768 to 1279px the panel is a sheet over the list and opening it as a page mounts it somewhere else (the panel
// remounts); the old instance is still leaving for a moment, so each step waits until there is one panel.
for (const width of [1440, 1100]) {
  test(`${width}: Open as page and Back to split view keep the tab the order was on`, async ({ context, page }) => {
    test.setTimeout(120000)
    await openPanel(context, page, { width, height: 900 })
    const one = () => expect(page.locator('#orderDetails')).toHaveCount(1)
    await page.locator('.odc-od-tabs').getByRole('tab', { name: /^Activity/ }).click()
    await expect(panelTab(page)).toContainText('Activity')
    await page.getByRole('button', { name: 'Open as page', exact: true }).click()
    await expect(page.locator('.odc-split')).toHaveAttribute('data-expanded', '')
    await one()
    await expect(panelTab(page)).toContainText('Activity')
    await page.getByRole('button', { name: 'Back to split view', exact: true }).click()
    await expect(page.locator('.odc-split')).not.toHaveAttribute('data-expanded', '')
    await one()
    await expect(panelTab(page)).toContainText('Activity')
    // Same from Chat.
    await page.locator('.odc-od-tabs').getByRole('tab', { name: /^Chat/ }).click()
    await page.getByRole('button', { name: 'Open as page', exact: true }).click()
    await expect(page.locator('.odc-split')).toHaveAttribute('data-expanded', '')
    await one()
    await page.getByRole('button', { name: 'Back to split view', exact: true }).click()
    await expect(page.locator('.odc-split')).not.toHaveAttribute('data-expanded', '')
    await one()
    await expect(panelTab(page)).toContainText('Chat')
  })
}

test('opened as a page the foot buttons keep their size and the expand button names where it goes', async ({ context, page }) => {
  test.setTimeout(120000)
  await openPanel(context, page, { width: 1440, height: 900 })
  await expect(page.getByRole('button', { name: 'Click to expand' })).toHaveCount(0)
  const sizes = () => page.evaluate(() => [...document.querySelectorAll('.odt-foot > .odc-btn')].map(node => Math.round(node.getBoundingClientRect().width)))
  const split = await sizes()
  expect(split.length).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Open as page', exact: true }).click()
  await expect(page.locator('#orderDetails')).toHaveAttribute('data-expanded', '')
  const wide = await sizes()
  for (const width of wide) expect(width, 'the buttons do not stretch across the screen').toBeLessThanOrEqual(240)
  // redesign F6e (Q4-07, 30ed7fa0): as a page, the foot's hairline still crosses the page but its content follows the
  // 960px column of the Details body (an end padding takes the rest), so the actions sit at the end of that content box.
  const foot = await page.evaluate(() => {
    const node = document.querySelector('.odt-foot')
    const frame = node.getBoundingClientRect()
    const contentEnd = frame.right - parseFloat(getComputedStyle(node).paddingRight)
    const last = [...document.querySelectorAll('.odt-foot > .odc-btn')].pop().getBoundingClientRect()
    return { gap: Math.round(contentEnd - last.right), contentWidth: Math.round(contentEnd - frame.left) }
  })
  expect(foot.gap, 'the actions sit at the end of the foot').toBeLessThanOrEqual(40)
  expect(foot.gap).toBeGreaterThanOrEqual(0)
  expect(foot.contentWidth, 'the foot content follows the 960px column').toBeLessThanOrEqual(960 + 2 * 24)
})

// ── Focus ──
test('after printing, the focus goes back to the Print trigger, not <body> (headless Chromium prints nothing; react-to-print still runs its after-print step)', async ({ context, page }) => {
  test.setTimeout(120000)
  await openPanel(context, page, { width: 1440, height: 900 })
  const print = page.locator('#orderDetails').getByRole('button', { name: 'Print', exact: true })
  await print.click()
  await page.getByRole('menuitem', { name: 'Normal', exact: true }).click()
  // react-to-print builds a hidden iframe, focuses it and prints after 500ms, then removes it.
  await expect(page.locator('iframe#printWindow')).toHaveCount(0, { timeout: 15000 })
  await expect(print).toBeFocused()
})
