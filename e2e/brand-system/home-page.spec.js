import { test, expect, fixtureUrl } from './fixtures'
import { tokens } from '../../src/brand/ordering.tokens.generated'

test.use({ timezoneId: 'UTC' })

const fixedTime = new Date('2026-09-15T00:00:00Z')
const homeUrl = (query = '') => {
  const values = new URLSearchParams('surface=home-page&mode=light&status=active&role=0')
  for (const [key, value] of new URLSearchParams(query)) values.set(key, value)
  return fixtureUrl(values.toString())
}
const opens = page => page.evaluate(() => globalThis.__OD_HOME_OPEN_CALLS__ || [])
const events = page => page.evaluate(() => globalThis.__OD_HOME_EVENTS__ || [])
const intercom = page => page.evaluate(() => globalThis.__OD_HOME_INTERCOM__ || [])
// redesign home F3: the requests the real Home controller made to the fake API, as `path?query`
const requests = page => page.evaluate(() => globalThis.__OD_HOME_REQUESTS__ || [])
const reportRequests = async page => (await requests(page)).filter(path => path.startsWith('/reports/'))
// redesign home F3: P/Chart paints a canvas, which cannot read `var()`: the spec resolves the token it reads
const chartToken = (page, name) => page.evaluate(token => getComputedStyle(document.querySelector('canvas').closest('figure')).getPropertyValue(token).trim(), name)
const rgb = hex => `rgb(${hex.slice(1).match(/../g).map(part => parseInt(part, 16)).join(', ')})`
const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number)
  .map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
const contrast = (first, second) => {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a)
  return (values[0] + 0.05) / (values[1] + 0.05)
}
const effectiveColors = locator => locator.evaluate(element => {
  let current = element
  let background = getComputedStyle(current).backgroundColor
  while (current.parentElement && ['transparent', 'rgba(0, 0, 0, 0)'].includes(background)) {
    current = current.parentElement
    background = getComputedStyle(current).backgroundColor
  }
  return { background, foreground: getComputedStyle(element).color }
})
const focusByKeyboard = async (page, target) => {
  for (let index = 0; index < 80 && !await target.evaluate(element => element === document.activeElement); index += 1) await page.keyboard.press('Tab')
  await expect(target).toBeFocused()
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: fixedTime })
  await page.clock.pauseAt(fixedTime)
  await page.addInitScript(() => {
    globalThis.__OD_HOME_CANVAS_TEXT__ = []
    const fillText = CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.fillText = function (...args) {
      globalThis.__OD_HOME_CANVAS_TEXT__.push({ font: this.font, color: this.fillStyle })
      return fillText.apply(this, args)
    }
    globalThis.__OD_HOME_OPEN_CALLS__ = []
    window.open = (...args) => {
      globalThis.__OD_HOME_OPEN_CALLS__.push(args)
      return { closed: false, focus: () => {} }
    }
  })
})

test('role 0 active home preserves populated reports, real Chart.js canvas, report event and two service URLs', async ({ page }) => {
  await page.goto(homeUrl())
  await page.clock.runFor(1000)
  await expect(page.getByText('Project Active', { exact: true })).toBeVisible()
  await expect(page.getByText('$1234.50', { exact: true })).toBeVisible()
  await expect(page.getByText('17', { exact: true })).toBeVisible()
  // redesign home F3 (this month sales is the month figure of main, now beside the 30-day total: 30 closed days (800.50) and today)
  // The month is the days of September up to yesterday (120 + 240.5 + 360) plus today's sales (1234.5)
  await expect(page.locator('.odc-trend-figure').filter({ hasText: 'This month sales' })).toContainText('$1955.00')
  await expect(page.locator('.odc-trend-figure').filter({ hasText: '30 days to yesterday' })).toContainText('$800.50')
  const chart = page.locator('canvas')
  await expect(chart).toBeVisible()
  const chartBox = await chart.boundingBox()
  expect(chartBox.width).toBeGreaterThan(0)
  expect(chartBox.height).toBeGreaterThan(0)
  const plotted = await page.evaluate(() => window.__OD_HOME_CHART__())
  // redesign home F3 (the chart is P/Chart: the line takes the resolved value of --od-x-chart-1, not '#2C7BE5'; a category axis, not 'time')
  const slot1 = await chartToken(page, '--od-x-chart-1')
  expect(slot1).not.toBe('')
  expect(plotted.borderColor).toBe(slot1)
  expect(plotted.cssVariables).toEqual([])
  expect(plotted.datasets.map(dataset => dataset.label)).toEqual(['Sales', 'Previous 30 days'])
  expect(plotted.datasets[1].borderColor).toBe(await chartToken(page, '--od-x-chart-comparison'))
  expect(plotted.datasets[1].borderDash).toEqual([4, 4])
  // redesign home F3 (30 closed days up to yesterday, one element per day, a day without a row is 0)
  expect(plotted.labels).toHaveLength(30)
  expect([plotted.labels[0], plotted.labels[29]]).toEqual(['Aug 16', 'Sep 14'])
  expect(plotted.data).toHaveLength(30)
  expect(plotted.data.flatMap((value, index) => value === 0 ? [] : [[index, value]])).toEqual([[4, 80], [16, 120], [23, 240.5], [29, 360]])
  expect(plotted.data.some(value => value === 0)).toBe(true)
  expect(plotted.datasets[1].data).toHaveLength(30)
  expect(plotted.datasets[1].data.flatMap((value, index) => value === 0 ? [] : [[index, value]])).toEqual([[3, 200], [24, 400.5]])

  // redesign home F3 (D5, HM-11: every report asks for the browser time zone; the windows are the local days of the fixed clock)
  const reports = await reportRequests(page)
  expect(reports.every(path => path.endsWith('&timezone=UTC'))).toBe(true)
  expect(reports.map(path => path.replace('&timezone=UTC', '')).sort()).toEqual([
    '/reports/orders?lapse=2026-09-08,2026-09-08',
    '/reports/orders?lapse=today',
    '/reports/orders_status?lapse=2026-09-08,2026-09-08',
    '/reports/orders_status?lapse=today',
    '/reports/sales?lapse=2026-07-17,2026-08-15',
    '/reports/sales?lapse=2026-08-16,2026-09-14',
    '/reports/sales?lapse=2026-09-08,2026-09-08',
    '/reports/sales?lapse=today'
  ])
  // redesign home F3 (D4: «Needs attention» counts read pagination.total of three /orders requests and one carts request)
  const counts = (await requests(page)).filter(path => /^\/(orders|carts\/dashboard)\?/.test(path))
  expect(counts.filter(path => path.startsWith('/orders?mode=dashboard') && path.includes('page_size=1'))).toHaveLength(3)
  expect(counts.filter(path => path.startsWith('/carts/dashboard') && path.includes('page_size=1'))).toHaveLength(1)
  const attention = page.getByRole('region', { name: 'Needs attention', exact: true })
  // redesign home R1 (Q-05): the deliveries row opens the In progress tab, where those orders are
  for (const [name, href] of [['4 Orders waiting for acceptance', '/orders?status=pending'], ['2 Late orders', '/orders?status=inProgress&late=1'], ['5 Deliveries waiting for a driver', '/deliveries?status=inProgress&unassigned=1'], ['6 Carts with a failed payment', '/cart-recovery/open-carts?view=paymentFailed']]) {
    await expect(attention.getByRole('link', { name, exact: true })).toHaveAttribute('href', href)
  }

  const reportsLink = page.getByRole('link', { name: 'See more reports', exact: true })
  await expect(reportsLink).toHaveAttribute('href', '/intelligence/business')
  // redesign home F3 (a click with a modifier keeps the browser behaviour and emits nothing; the plain click emits go_to_page once)
  await page.evaluate(() => document.addEventListener('click', event => event.preventDefault()))
  await reportsLink.dispatchEvent('click', { metaKey: true })
  expect(await events(page)).toEqual([])
  await reportsLink.click()
  await expect.poll(() => events(page)).toEqual([{ name: 'go_to_page', payload: { page: 'business_analytics' } }])

  const services = page.getByRole('region', { name: 'More Services', exact: true }).getByRole('link')
  await expect(services).toHaveCount(2)
  // main 39f0c6a6 turned the first card into the in-app Marketplace source-code entry
  // (/open-source-code, same tab, no rel); only the custom-work card keeps the external sales URL.
  const [sourceCode, customWork] = await services.all()
  await expect(sourceCode).toHaveText('View source code')
  await expect(sourceCode).toHaveAttribute('href', '/open-source-code')
  await expect(sourceCode).not.toHaveAttribute('target')
  await expect(sourceCode).not.toHaveAttribute('rel')
  await expect(customWork).toHaveAttribute('href', 'https://www.ordering.co/platform-demo-and-pricing')
  await expect(customWork).toHaveAttribute('target', '_blank')
  await expect(customWork).toHaveAttribute('rel', 'noopener noreferrer')
})

// redesign home F3 (new: a project without orders gets the setup guide and the guide asks for the stores, payment methods and drivers)
test('a project without sales or orders shows the setup guide, an all-clear and hides the guide in this browser only', async ({ page }) => {
  await page.goto(homeUrl('&data=empty'))
  await page.clock.runFor(1000)
  const guide = page.getByRole('region', { name: 'Set up your marketplace', exact: true })
  await expect(guide).toBeVisible()
  // a store and a menu exist; the zone, the payment method and the first order are missing: 2 of the 5 required steps
  await expect(guide.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '2 of 5 done')
  await expect(page.getByText('All clear: nothing is waiting for you.', { exact: true })).toBeVisible()
  const asked = await requests(page)
  expect(asked.some(path => path.startsWith('/business?mode=dashboard'))).toBe(true)
  expect(asked).toContain('/business/1/paymethods?params=sites,devices')
  expect(asked.some(path => path.startsWith('/users?'))).toBe(true)
  await guide.getByRole('button', { name: 'Hide guide', exact: true }).click()
  await expect(guide).toHaveCount(0)
  await page.getByRole('button', { name: 'Show setup guide', exact: true }).click()
  await expect(guide).toBeVisible()
})

test('project loading, no-status, active and past-due branches retain exact status behavior', async ({ page }) => {
  await page.goto(homeUrl('&status=loading'))
  await expect(page.getByText('Project Active', { exact: true })).toHaveCount(0)
  // redesign home F3 (the loading state is a P/Skeleton in the header, not react-loading-skeleton)
  await expect(page.locator('[data-slot=home-header] .odc-home-badge-skeleton .odc-skeleton')).toBeVisible()
  await expect(page.locator('[data-slot=home-header]')).toHaveAttribute('aria-busy', 'true')
  await expect(page.getByRole('button', { name: 'Visit my website', exact: true })).toHaveCount(0)

  await page.goto(homeUrl('&status=none'))
  // redesign home F3 (the «Welcome to Ordering.co!» card and «Our guide helps you…» are gone: the greeting is the h1; the clock is 00:00 UTC)
  await expect(page.getByRole('heading', { level: 1, name: 'Good morning, Alexandria Home Fixture With A Long Tenant Name', exact: true })).toBeVisible()
  await expect(page.getByText('Project Active', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Payment past due', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Visit my website', exact: true })).toHaveCount(0)

  await page.goto(homeUrl('&status=active'))
  await expect(page.getByText('Project Active', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Visit my website', exact: true })).toBeVisible()
  await expect(page.getByText(/suspended in the next/)).toHaveCount(0)

  await page.goto(homeUrl('&status=past_due'))
  // redesign home F3 (the badge says the short «Payment past due»; the long sentence of main is the notice, with its days)
  await expect(page.getByText('Payment past due', { exact: true })).toBeVisible()
  await expect(page.getByText('Project Active', { exact: true })).toHaveCount(0)
  await expect(page.getByText(/suspended in the next 3 days/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Visit my website', exact: true })).toBeVisible()
})

test('roles 0, 2 and 5 preserve More Services, visit-site and support gates including white-label', async ({ page }) => {
  await page.goto(homeUrl('&role=2'))
  await expect(page.getByRole('region', { name: 'More Services', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Visit my website', exact: true })).toHaveCount(0)
  await expect(page.getByText('Support', { exact: true })).toHaveCount(0)
  // redesign home F3 (D4, D7: a link and its count only where the destination is in the menu of that level: level 2 has no deliveries and no carts)
  const attentionRows = page.getByRole('region', { name: 'Needs attention', exact: true }).getByRole('link')
  await expect(attentionRows).toHaveText([/Orders waiting for acceptance/, /Late orders/])
  expect((await requests(page)).filter(path => path.startsWith('/carts/'))).toEqual([])

  await page.goto(homeUrl('&role=5'))
  await expect(page.getByRole('region', { name: 'More Services', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Visit my website', exact: true })).toBeVisible()
  await expect(page.getByText('Support', { exact: true })).toBeVisible()
  await expect(page.getByText('On-boarding Lessons', { exact: true })).toBeVisible()
  // redesign home F3 (D7: level 5 sees the deliveries row, but never the carts of level 0)
  await expect(attentionRows).toHaveText([/Orders waiting for acceptance/, /Late orders/, /Deliveries waiting for a driver/])
  expect((await requests(page)).filter(path => path.startsWith('/carts/'))).toEqual([])

  await page.goto(homeUrl('&role=0&whiteLabel=1'))
  await expect(page.getByRole('region', { name: 'More Services', exact: true })).toBeVisible()
  await expect(page.getByText('Support', { exact: true })).toBeVisible()
  await expect(page.getByText('On-boarding Lessons', { exact: true })).toHaveCount(0)

  await page.goto(homeUrl('&role=0&disableSupport=1'))
  await expect(page.getByRole('region', { name: 'More Services', exact: true })).toBeVisible()
  await expect(page.getByText('Support', { exact: true })).toHaveCount(0)
})

test('live and temporary website precedence, support URLs and collapsed-menu callback stay local and exact', async ({ page }) => {
  await page.goto(homeUrl('&site=live&collapsed=1'))
  await page.getByRole('button', { name: 'Visit my website', exact: true }).click()
  await expect.poll(() => opens(page)).toEqual([['https://live-shop.example.test', '_blank', 'noopener,noreferrer']])
  // redesign home F3 (the menu button sits beside the greeting, which is the h1 now, not the «Home» heading)
  const menu = page.getByRole('button', { name: 'Menu', exact: true })
  await menu.click()
  await expect(menu).toHaveCount(0)
  await expect(page.getByTestId('home-collapse-state')).toHaveText('false')
  await expect(page.getByTestId('home-collapse-calls')).toHaveText('[false]')

  await page.goto(homeUrl('&site=temporary'))
  await page.getByRole('button', { name: 'Visit my website', exact: true }).click()
  await page.getByRole('button', { name: 'Sales Contact', exact: true }).click()
  await page.getByRole('button', { name: 'Tech Support', exact: true }).click()
  await page.getByRole('button', { name: 'Schedule Today', exact: true }).click()
  await expect.poll(() => opens(page)).toEqual([
    ['https://temporary-shop.example.test', '_blank', 'noopener,noreferrer'],
    ['https://www.ordering.com/contact-ordering', '_blank', 'noopener,noreferrer'],
    ['https://support.ordering.com', '_blank', 'noopener,noreferrer'],
    ['https://calendly.com/luisana/group-onboarding-conference?month=2026-09', '_blank', 'noopener,noreferrer']
  ])
})

test('Intercom effects are captured locally with exact populated project and report context', async ({ page }) => {
  await page.goto(homeUrl())
  await expect.poll(async () => (await intercom(page)).length).toBe(2)
  expect(await intercom(page)).toEqual([
    { kind: 'hash', payload: { userId: 'home@example.com', token: 'fixture-home-token' } },
    {
      kind: 'settings',
      settings: {
        project_code: 'fixture-home',
        project_owner_id: 991,
        project_current_status: 'active',
        project_plan: 3,
        // n.º 13 (owner decision 13 B): the 30 closed days of the trend window with sales (today−30 … yesterday, so
        // 2026-08-20 comes in and today 2026-09-15 stays out), in the shape of main (array of { time, sales }). Was the current month.
        project_sales_last_30_days: [
          { time: '2026-08-20 00:00:00', sales: 80 },
          { time: '2026-09-01 00:00:00', sales: 120 },
          { time: '2026-09-08 00:00:00', sales: 240.5 },
          { time: '2026-09-14 00:00:00', sales: 360 }
        ],
        project_addons: [{ value: true }, { value: true }],
        user_hash: 'fixture-intercom-hash',
        company: { id: 91, name: 'fixture-home' }
      },
      user: {
        id: 81,
        level: 0,
        name: 'Alexandria Home Fixture With A Long Tenant Name',
        email: 'home@example.com',
        user_system_id: 991
      }
    }
  ])
  expect(await page.evaluate(() => globalThis.__OD_HOME_HUBSPOT__)).toBeUndefined()
})

for (const mode of ['light', 'dark']) {
  test(`home keeps readable ${mode} status, cards and real keyboard focus`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 820 })
    await page.goto(fixtureUrl(`surface=home-page&mode=${mode}&status=active&role=0`))
    await expect(page.locator('canvas')).toBeVisible()
    await page.clock.runFor(1000)
    const status = page.getByText('Project Active', { exact: true })
    const report = page.getByRole('link', { name: 'See more reports', exact: true })
    const service = page.getByRole('region', { name: 'More Services', exact: true }).getByRole('link').first()
    for (const target of [status, page.getByRole('paragraph').filter({ hasText: /^This month sales$/ }), service]) {
      const colors = await effectiveColors(target)
      expect.soft(contrast(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5)
    }
    await page.screenshot({ path: testInfo.outputPath(`home-${mode}-overview.png`), fullPage: false })
    await page.evaluate(() => document.activeElement?.blur())
    for (const target of [report, service]) {
      await focusByKeyboard(page, target)
      await expect(target).toHaveCSS('outline-color', rgb(tokens.theme[mode].semantic.action.focus))
      expect(parseFloat(await target.evaluate(element => getComputedStyle(element).outlineWidth))).toBeGreaterThanOrEqual(2)
    }
    await page.screenshot({ path: testInfo.outputPath(`home-${mode}.png`), fullPage: false })
  })
}

for (const width of [320, 390]) {
  test.describe(`home at ${width}px coarse pointer`, () => {
    test.use({ viewport: { width, height: 480 }, hasTouch: true, isMobile: true })
    test('RTL long content reflows and scrolled controls remain 44px and unobstructed', async ({ page }, testInfo) => {
      await page.goto(fixtureUrl('surface=home-page&mode=dark&rtl=true&locale=ar&status=past_due&role=0&collapsed=1'))
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      const home = page.getByTestId('home-page-fixture')
      await expect(home).toBeVisible()
      const controls = home.locator('button:visible, a:visible')
      await expect.poll(() => controls.count()).toBeGreaterThan(4)
      const reflow = await home.locator('[data-slot=home-page]').evaluate(element => ({ content: element.scrollWidth, viewport: element.clientWidth }))
      expect(reflow.content).toBeLessThanOrEqual(reflow.viewport)
      await page.screenshot({ path: testInfo.outputPath(`home-${width}-before.png`) })
      for (const control of await controls.all()) {
        await control.evaluate(element => element.scrollIntoView({ block: 'center' }))
        const box = await control.boundingBox()
        expect.soft(box.x).toBeGreaterThanOrEqual(0)
        expect.soft(box.x + box.width).toBeLessThanOrEqual(width)
        // redesign home F3 (a Product button is 32px seen and reaches 44px through a centered pseudo-element, as in all-in-one-appointments-styles:
        // for `.odc-btn` the check is a hit test over the 44px area (eight edge and corner points), for the other controls the box itself)
        const name = await control.getAttribute('aria-label') || await control.textContent()
        if (await control.evaluate(element => element.classList.contains('odc-btn'))) {
          expect.soft(await control.evaluate(element => {
            const rect = element.getBoundingClientRect()
            const cx = rect.left + rect.width / 2
            const cy = rect.top + rect.height / 2
            return [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]].map(([dx, dy]) => {
              const x = cx + dx * 20.5
              const y = cy + dy * 20.5
              // a point beyond the viewport edge cannot be hit-tested; a point owned by the hit area of the next control (stacked buttons
              // 8px apart overlap their 44px areas by 4px) is not content over the button
              if (y < 0 || y > innerHeight || x < 0 || x > innerWidth) return true
              const hit = document.elementFromPoint(x, y)
              return Boolean(hit) && (hit === element || element.contains(hit) || Boolean(hit.closest('a[href], button')))
            })
          }), `${name} reaches 44px`).toEqual(Array(8).fill(true))
        } else {
          expect.soft(box.height, name).toBeGreaterThanOrEqual(44)
        }
        expect.soft(await control.evaluate(element => {
          const rect = element.getBoundingClientRect()
          const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
          return hit === element || element.contains(hit)
        }), `${name} is unobstructed`).toBe(true)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      await page.screenshot({ path: testInfo.outputPath(`home-${width}-after.png`) })
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
    })
  })
}

test('home has readable chart annotations and preserves inherited feature icon sizes', async ({ page }, testInfo) => {
  await page.goto(fixtureUrl('surface=home-page&mode=dark&status=active&role=0'))
  await expect(page.locator('canvas')).toBeVisible()
  await page.clock.runFor(1000)
  const paint = await page.evaluate(() => ({ count: window.__OD_HOME_CANVAS_TEXT__.length, colors: [...new Set(window.__OD_HOME_CANVAS_TEXT__.map(item => item.color))], fonts: [...new Set(window.__OD_HOME_CANVAS_TEXT__.map(item => item.font))] }))
  expect(paint.count).toBeGreaterThan(0)
  // redesign home F3 (the canvas is named after the P/Chart label and described by its alternative table: the description is the table's caption,
  // and the table in the DOM carries the figures, now by short local dates)
  const accessibleChart = page.getByRole('img', { name: 'Sales, last 30 days', exact: true })
  await expect(accessibleChart).toHaveAccessibleDescription('Sales, last 30 days')
  const tableId = await accessibleChart.getAttribute('aria-describedby')
  const table = page.locator(`table[id="${tableId}"]`)
  // redesign home R1 (Q-08): the comparison series carries its own dates in a column of the table
  await expect(table.locator('thead th')).toHaveText(['Date', 'Sales', 'Previous 30 days · Date', 'Previous 30 days'])
  await expect(table.locator('tbody tr')).toHaveCount((await page.evaluate(() => window.__OD_HOME_CHART__().data)).length)
  await expect(table.locator('tbody tr').filter({ hasText: 'Sep 1' }).first()).toContainText('$120.00')
  await expect(table.locator('tbody tr').filter({ hasText: 'Sep 8' })).toContainText('$240.50')
  const colors = await effectiveColors(page.locator('canvas'))
  for (const color of paint.colors) {
    const normalized = color.startsWith('#') ? rgb(color.length === 4 ? `#${[...color.slice(1)].map(part => part + part).join('')}` : color) : color
    expect.soft(contrast(normalized, colors.background)).toBeGreaterThanOrEqual(4.5)
  }
  // redesign home F3 (P/Chart paints the dates in the brand sans, Inter, and the figures of the value axis in the brand mono, JetBrains Mono: both families are brand tokens)
  for (const font of paint.fonts) expect.soft(font).toMatch(/Inter|JetBrains Mono/)
  expect(paint.fonts.some(font => font.includes('Inter'))).toBe(true)
  expect(paint.fonts.some(font => font.includes('JetBrains Mono'))).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('home-chart-overview.png'), fullPage: false })
  // redesign home F3 (the old 44px feature illustrations are Product icons now: a --od-x-icon glyph inside a --od-x-control-height-lg tile; the
  // sizes are the resolved tokens, so the check follows the token and not a literal). (0013fc27, decision 4): the cards are
  // P/CatalogCard now, whose icon glyph is --od-x-icon-md (20px) in the same --od-x-control-height-lg tile, as /support; it is no longer
  // the default --od-x-icon (16px), and the glyph still has to be smaller than its tile.
  const icons = page.getByRole('region', { name: 'More Services', exact: true }).locator('svg')
  await expect(icons).toHaveCount(2)
  const sizes = await page.evaluate(() => {
    const style = getComputedStyle(document.querySelector('[data-slot=home-more-services]'))
    return {
      glyph: parseFloat(style.getPropertyValue('--od-x-icon-md')),
      base: parseFloat(style.getPropertyValue('--od-x-icon')),
      tile: parseFloat(style.getPropertyValue('--od-x-control-height-lg'))
    }
  })
  expect(sizes.glyph).toBeGreaterThan(sizes.base)
  expect(sizes.tile).toBeGreaterThan(sizes.glyph)
  for (const icon of await icons.all()) {
    const box = await icon.boundingBox()
    expect.soft(box.width).toBe(sizes.glyph)
    expect.soft(box.height).toBe(sizes.glyph)
    const tile = await icon.locator('xpath=..').boundingBox()
    expect.soft(tile.width).toBe(sizes.tile)
    expect.soft(tile.height).toBe(sizes.tile)
  }
  await icons.first().scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('home-card-icons.png'), fullPage: false })
})

test('home honors reduced motion changes without losing the chart data', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(homeUrl())
  await expect(page.locator('canvas')).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.__OD_HOME_CHART__()?.animationsDisabled)).toBe(true)
  const before = await page.evaluate(() => window.__OD_HOME_CHART__().data)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect.poll(() => page.evaluate(() => window.__OD_HOME_CHART__()?.animationsDisabled)).toBe(false)
  expect(await page.evaluate(() => window.__OD_HOME_CHART__().data)).toEqual(before)
})
