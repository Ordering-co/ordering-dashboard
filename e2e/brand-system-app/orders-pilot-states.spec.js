// Rare states of the redesigned /orders list (orders pilot, batch 5.2) on the real app
// with a synthetic API: 100 orders with long names, first run, no results, a failing
// API and a socket that never connects. Screenshots go to test-results/ (not versioned).
//   pnpm exec playwright test --config scripts/brand-system/playwright.app.config.mjs orders-pilot-states
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { APP_ORIGIN, expect, installAppNetworkBoundary, installSyntheticSession, test } from './fixtures'
import { expectTouchTarget } from '../touch-target'

// redesign W0 T0-45 (W0-E-10): the screenshots used to go to the dated evidence of the pilot (redesign/pilot-orders/after/states/, relative to
// the cwd), and a run from the repo root overwrote it. They go to the git-ignored test-results/ of the repo whatever the cwd. The assertions
// do not read these files.
const OUT = resolve(__dirname, '../../test-results/brand-system-app/orders-pilot-states')
mkdirSync(OUT, { recursive: true })
const ORDERS_PATH = '/fixture-api/v1/en/brand-fixture/orders'

const GROUPS = {
  pending: [0, 13],
  inProgress: [7, 8, 4, 9, 3, 14, 18, 19, 20, 21, 22, 23, 24, 25, 26],
  completed: [1, 11, 15],
  cancelled: [2, 5, 6, 10, 12, 16, 17]
}
const ALL_STATUSES = Object.values(GROUPS).flat()
const pad = n => String(n).padStart(2, '0')
const stamp = minutesFromNow => {
  const date = new Date(Date.now() + minutesFromNow * 60000)
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:00`
}

// 100 synthetic orders: every status, every SLA, long business, customer and driver names.
const syntheticOrders = Array.from({ length: 100 }, (_, index) => {
  const status = ALL_STATUSES[index % ALL_STATUSES.length]
  const open = [...GROUPS.pending, ...GROUPS.inProgress].includes(status)
  const longName = index % 7 === 0
  return {
    id: 920100 + index,
    uuid: `fixture-order-${920100 + index}`,
    status,
    created_at: stamp(-90 - index),
    delivery_datetime: stamp(open ? 30 - index : -600 - index),
    delivery_datetime_utc: stamp(open ? 30 - index : -600 - index),
    eta_time: 0,
    delivery_type: index % 3 === 0 ? 2 : 1,
    time_status: ['in_time', 'at_risk', 'delayed'][index % 3],
    business_id: 920001,
    business: { id: 920001, name: longName ? 'Synthetic Store With A Deliberately Long Operating Name' : 'Synthetic Store Alpha', logo: null, city: { id: 940001, name: 'Fixture City' } },
    customer: { id: 930001 + index, name: longName ? 'Maximiliana Alexandra' : 'Fixture', lastname: longName ? 'Van Der Berg-Oyelaran' : `Customer ${index}`, email: `c${index}@example.invalid`, cellphone: `+1555000${pad(index)}`, orders_count: index % 4 },
    driver: index % 2 ? { id: 960001, name: longName ? 'Bartholomew Oluwaseun' : 'Fixture Driver', lastname: longName ? 'Montgomery-Achterberg' : '', cellphone: '+15550009999' } : null,
    summary: { total: 12 + index * 1.37 },
    currency: 'USD',
    logistic_status: 0,
    logistic_attemps: index % 3,
    priority: 0,
    unread_count: 0,
    unread_general_count: 0,
    unread_direct_count: 0
  }
})

const statusesOf = where => {
  const found = []
  const walk = node => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (node && typeof node === 'object') {
      if (node.attribute === 'status' && Array.isArray(node.value)) found.push(...node.value)
      Object.values(node).forEach(walk)
    }
  }
  try { walk(JSON.parse(where)) } catch {}
  return found
}

// Serves /orders from `orders` honouring the status group, the search and the page.
const serveOrders = async (context, { orders = syntheticOrders, fail = false } = {}) => {
  await context.route(url => url.origin === APP_ORIGIN && url.pathname === ORDERS_PATH, async route => {
    if (route.request().method() !== 'GET') return route.abort('blockedbyclient')
    if (fail) return route.fulfill({ status: 500, json: { error: true, result: ['Synthetic server error'] } })
    const url = new URL(route.request().url())
    const statuses = statusesOf(url.searchParams.get('where') || '[]')
    const search = /ilike/.test(url.searchParams.get('where') || '') ? 'search' : ''
    const matching = (search ? [] : orders).filter(order => !statuses.length || statuses.includes(order.status))
    const page = Number(url.searchParams.get('page') || 1)
    const size = Number(url.searchParams.get('page_size') || 10)
    const result = matching.slice((page - 1) * size, page * size)
    return route.fulfill({
      json: {
        error: false,
        result,
        pagination: { current_page: page, page_size: size, total_pages: Math.max(1, Math.ceil(matching.length / size)), total: matching.length, from: result.length ? (page - 1) * size + 1 : 0, to: (page - 1) * size + result.length }
      }
    })
  })
}

const openOrders = async (page, path = '/orders?status=inProgress') => {
  await page.goto(path)
  await page.getByRole('tablist', { name: /order status/i }).waitFor({ timeout: 90000 })
  const accept = page.getByRole('button', { name: 'Accept', exact: true })
  if (await accept.count()) await accept.first().click()
}

const noPageOverflow = async page => {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }))
  expect(scroll, 'the page itself never scrolls sideways').toBeLessThanOrEqual(width)
}

for (const [name, viewport, extra] of [['desktop', { width: 1440, height: 900 }, {}], ['mobile', { width: 390, height: 844 }, { isMobile: true, hasTouch: true }]]) {
  test.describe(`${name} orders list rare states`, () => {
    test.use({ viewport, ...extra })

    test(`${name}: 100 orders with long names stay readable and paginate`, async ({ context, page }) => {
      await installAppNetworkBoundary(context, { scenario: 'populated' })
      await serveOrders(context)
      await installSyntheticSession(context, { authenticated: true })
      await openOrders(page)
      const tab = page.getByRole('tab', { name: /in progress/i })
      await expect(tab).toContainText(String(syntheticOrders.filter(o => GROUPS.inProgress.includes(o.status)).length))
      if (name === 'desktop') {
        await expect(page.locator('tbody tr[data-row-id]')).toHaveCount(10)
        await expect(page.getByText(/Showing 1–10 of \d+/)).toBeVisible()
        // redesign fix-qa C2 (coordinator decision, replaces C6's «Total visible without scrolling»): on the full-width
        // list no column steps aside by width; the table scrolls sideways and the order column stays in place, as in main.
        const scroller = page.locator('.odc-table-scroll').first()
        for (const header of ['Business', 'Customer', 'Driver', 'Advanced logistics', 'Group order', 'Total']) {
          await expect(page.getByRole('columnheader', { name: header, exact: true }), `${header} is not hidden by width`).toHaveCount(1)
        }
        expect(await scroller.evaluate(node => node.scrollWidth - node.clientWidth), 'the table has more than the window shows').toBeGreaterThan(1)
        const orderHeader = page.locator('thead th.odc-orders-col-sticky')
        const before = await orderHeader.boundingBox()
        await scroller.evaluate(node => { node.scrollLeft = node.scrollWidth })
        const after = await orderHeader.boundingBox()
        expect(Math.abs(after.x - before.x), 'the order column stays in place while the table scrolls').toBeLessThanOrEqual(1)
        const total = await page.getByRole('columnheader', { name: 'Total', exact: true }).boundingBox()
        const box = await scroller.boundingBox()
        expect(total.x + total.width, 'Total is reachable by scrolling').toBeLessThanOrEqual(box.x + box.width + 1)
        expect(total.x, 'Total is reachable by scrolling').toBeGreaterThanOrEqual(box.x)
      }
      if (name === 'mobile') {
        // redesign 5.6: below 768px the list is cards (no table), ten per page, with the pager under them.
        await expect(page.locator('li.odc-order-card[data-row-id]')).toHaveCount(10)
        await expect(page.locator('table:visible')).toHaveCount(0)
        await expect(page.getByText(/Showing 1–10 of \d+/)).toBeVisible()
      }
      await noPageOverflow(page)
      await page.screenshot({ path: `${OUT}/${name}-many-long-names.png`, fullPage: false })
    })

    test(`${name}: first run says there are no orders yet, without an illustration`, async ({ context, page }) => {
      await installAppNetworkBoundary(context, { scenario: 'populated' })
      await serveOrders(context, { orders: [] })
      await installSyntheticSession(context, { authenticated: true })
      await openOrders(page, '/orders?status=pending')
      await expect(page.locator('.odc-state')).toBeVisible()
      await expect(page.locator('.odc-state img')).toHaveCount(0)
      await noPageOverflow(page)
      await page.screenshot({ path: `${OUT}/${name}-empty.png` })
    })

    test(`${name}: a failing API shows what failed and a way to try again`, async ({ context, page }) => {
      await installAppNetworkBoundary(context, { scenario: 'populated' })
      await serveOrders(context, { fail: true })
      await installSyntheticSession(context, { authenticated: true })
      await openOrders(page)
      await expect(page.getByRole('alert').filter({ hasText: /couldn.t load the orders/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /try again/i })).toBeVisible()
      await noPageOverflow(page)
      await page.screenshot({ path: `${OUT}/${name}-error.png` })
    })

    test(`${name}: a socket that never connects is visible and actionable`, async ({ context, page }) => {
      await installAppNetworkBoundary(context, { scenario: 'populated' })
      await serveOrders(context)
      await installSyntheticSession(context, { authenticated: true })
      await openOrders(page)
      // The boundary closes every WebSocket: the live status must say so in words.
      await expect(page.getByText(/reconnecting|connecting/i).first()).toBeVisible()
      await noPageOverflow(page)
      await page.screenshot({ path: `${OUT}/${name}-reconnecting.png` })
    })
  })
}

// redesign 5.6: /orders below 768px is a list of cards. At 320 and 390 nothing leaves the page (long business and customer
// names truncate inside the card), and the pending card's actions are 44px targets with a coarse pointer.
for (const width of [320, 390]) {
  test.describe(`mobile ${width}px orders cards`, () => {
    test.use({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true })

    // No element of a card may stick out of the card, and the card never out of the page.
    const cardsStayInside = async page => {
      const stray = await page.evaluate(() => {
        const found = []
        for (const card of document.querySelectorAll('li.odc-order-card')) {
          const box = card.getBoundingClientRect()
          if (box.right > innerWidth + 1) found.push(`card ${card.dataset.rowId} ends at ${box.right}`)
          for (const child of card.querySelectorAll('*')) {
            const rect = child.getBoundingClientRect()
            if (rect.width && rect.right > box.right + 1) found.push(`card ${card.dataset.rowId} ${child.className || child.tagName} ends at ${rect.right} > ${box.right}`)
          }
        }
        return found
      })
      expect(stray, 'nothing inside a card sticks out of it').toEqual([])
    }

    test(`mobile ${width}px: long names stay inside cards, no table, no sideways page`, async ({ context, page }) => {
      await installAppNetworkBoundary(context, { scenario: 'populated' })
      await serveOrders(context)
      await installSyntheticSession(context, { authenticated: true })
      await openOrders(page)
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      const cards = page.locator('li.odc-order-card[data-row-id]')
      await expect(cards).toHaveCount(10)
      await expect(page.locator('table:visible')).toHaveCount(0)
      await expect(page.getByRole('table')).toHaveCount(0)
      await cardsStayInside(page)
      await noPageOverflow(page)
      // Pending is where the first synthetic order lives, with the long names and the two actions: the widest card.
      await openOrders(page, '/orders?status=pending')
      const long = page.locator('li.odc-order-card[data-row-id="920100"]')
      await expect(long).toContainText('#920100')
      await expect(long.locator('[title*="Deliberately Long"]').first()).toBeAttached()
      await expect(page.locator('table:visible')).toHaveCount(0)
      await cardsStayInside(page)
      await noPageOverflow(page)
      await page.screenshot({ path: `${OUT}/mobile-${width}-cards.png` })
    })

    test(`mobile ${width}px: the pending card's actions are 44px targets`, async ({ context, page }) => {
      await installAppNetworkBoundary(context, { scenario: 'populated' })
      await serveOrders(context)
      await installSyntheticSession(context, { authenticated: true })
      await openOrders(page, '/orders?status=pending')
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      await expect(page.locator('table:visible')).toHaveCount(0)
      const pending = page.locator('li.odc-order-card[data-row-id="920100"]')
      await expect(pending).toBeVisible()
      const reject = pending.getByRole('button', { name: 'Reject order #920100', exact: true })
      const accept = pending.getByRole('button', { name: 'Accept order #920100', exact: true })
      for (const action of [reject, accept]) {
        await expect(action).toBeVisible()
        const box = await action.boundingBox()
        // redesign W0 T0-45 (W0-E-08, decision 12): the action is 32px visible or more with the 44×44 area (corners at ±21px), or 44 drawn.
        await expectTouchTarget(action, { label: 'card action' })
        expect(box.x + box.width, 'action inside the page').toBeLessThanOrEqual(width)
      }
      // The other pending status (13) is a card without actions: only status 0 is accepted or rejected from the list.
      const preorder = page.locator('li.odc-order-card[data-row-id="920101"]')
      await expect(preorder).toBeVisible()
      await expect(preorder.getByRole('button')).toHaveCount(0)
      await cardsStayInside(page)
      await noPageOverflow(page)
      await page.screenshot({ path: `${OUT}/mobile-${width}-pending-cards.png` })
    })
  })
}
