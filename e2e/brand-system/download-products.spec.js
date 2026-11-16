import { test, expect, fixtureUrl } from './fixtures'
import { tokens } from '../../src/brand/ordering.tokens.generated'

const productNames = ['Store App 2.0', 'Driver App 2.0', 'POS 2.0', process.env.BRAND_DOWNLOADS_BASELINE === '1' ? 'Ordering Kiosk 2.0' : 'Ordering.co Kiosk 2.0', 'Call Center 2.0']
const isBaseline = process.env.BRAND_DOWNLOADS_BASELINE === '1'
const purchasedRows = page => page.locator('.purchased-product-row')
const rowTitle = row => isBaseline ? row.locator('h3') : row.locator('.od-download-product-detail-action')
const rowTitles = async rows => Promise.all((await rows.all()).map(row => rowTitle(row).textContent()))
const details = page => isBaseline ? page.locator('#sideSlider .description').locator('..') : page.locator('[data-slot="download-product-details"]')
const sidebar = page => page.locator('#sideSlider')
// SideBar opens by animating its width (BarContainer `transition: 0.3s`, the width set in an effect after mount).
// Measured mid-transition, the panel action sat squeezed off-screen (x=-24, 44px wide) in 20 of 90 runs. Measure the opened layout.
const sidebarOpened = page => expect.poll(() => sidebar(page).evaluate(element => element.style.width !== '' && element.getAnimations().length === 0)).toBe(true)
// main replaced the free list with a static three-product catalog: cards are <li>, download actions are <a> links.
const freeCards = page => page.getByRole('list').getByRole('listitem')
const freeLinks = scope => scope.getByRole('link')
const openCalls = page => page.evaluate(() => globalThis.__OD_DOWNLOAD_OPEN_CALLS__ || [])
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
  for (let index = 0; index < 100 && !await target.evaluate(element => element === document.activeElement); index += 1) await page.keyboard.press('Tab')
  await expect(target).toBeFocused()
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    globalThis.__OD_DOWNLOAD_OPEN_CALLS__ = []
    window.open = (...args) => {
      globalThis.__OD_DOWNLOAD_OPEN_CALLS__.push(args)
      return { closed: false, focus: () => {} }
    }
    document.addEventListener('click', event => {
      if (event.target.closest?.('a[target="_blank"]')) event.preventDefault()
    }, true)
  })
})

test('Free downloads catalog preserves three-card order, exact store and web links and no sidebar selection', async ({ page }) => {
  await page.goto(fixtureUrl('surface=download-products&list=free&mode=light&tenant=ordering'))
  await expect(page.getByRole('heading', { level: 1, name: 'Free downloads', exact: true })).toBeVisible()
  const cards = freeCards(page)
  await expect(cards).toHaveCount(3)
  expect(await page.getByRole('heading', { level: 2 }).allTextContents()).toEqual(['Driver App', 'Business App', 'Call Center'])
  await expect(page.getByText('By Ordering', { exact: true })).toHaveCount(3)
  await expect(page.getByText(/Kiosk|POS|2\.0/)).toHaveCount(0)
  const links = freeLinks(cards)
  await expect(links).toHaveCount(5)
  expect(await links.evaluateAll(elements => elements.map(link => [link.getAttribute('aria-label'), link.getAttribute('href')]))).toEqual([
    // (ba6099c2c): without a country Apple sends each user to their own storefront
    ['App Store · Driver App', 'https://apps.apple.com/app/driver-app-v26/id6526462318'],
    ['Google Play · Driver App', 'https://play.google.com/store/apps/details?id=com.orderingplus.driverapp'],
    ['App Store · Business App', 'https://apps.apple.com/app/business-app-v26/id6526502488'],
    ['Google Play · Business App', 'https://play.google.com/store/apps/details?id=com.orderingplus.storeapp'],
    ['Open Call Center', 'https://callcenter.orderingplus.com/signin']
  ])
  for (const link of await links.all()) {
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  }
  await expect(page.getByRole('button', { name: /menu/i })).toHaveCount(0)
  // redesign FD-A (D3): no «Free» badge on the cards and no brand note at the bottom
  await expect(page.getByText('Free', { exact: true })).toHaveCount(0)
  await expect(page.getByText('These products use the Ordering brand.')).toHaveCount(0)
  // The catalog is static: neither a card nor its title opens a product sidebar.
  await page.getByRole('heading', { name: 'Business App', exact: true }).click()
  await cards.first().click({ position: { x: 4, y: 4 } })
  await expect(sidebar(page)).toHaveCount(0)
  await expect(page.locator('[data-slot="download-product-details"]')).toHaveCount(0)
})

// Retired 2026-10-03 after the merge of main: 'Free row selection ... mouseup close boundaries' tested the free-list row selection, HTML details sidebar and its mouseup close boundaries. The free catalog is now static (no rows, no details sidebar); the no-sidebar behaviour is asserted in the catalog case above. Purchased details keep the same boundaries below.

test('Purchased products preserve order and exact window.open calls while purchase actions never select rows', async ({ page }) => {
  await page.goto(fixtureUrl('surface=download-products&list=purchased&mode=light&tenant=tenantco'))
  await expect(purchasedRows(page)).toHaveCount(5)
  expect(await rowTitles(purchasedRows(page))).toEqual(productNames)
  const actions = page.locator('.purchase-btn button')
  await expect(actions).toHaveCount(9)
  await actions.first().click()
  await expect(sidebar(page)).toHaveCount(0)
  await actions.last().click()
  await expect(sidebar(page)).toHaveCount(0)
  await expect.poll(() => openCalls(page)).toEqual([
    ['https://apps.tenantco.com/store/marketplace?category=306&product=1717', '_blank', 'noopener,noreferrer'],
    ['https://apps.tenantco.com/store/marketplace?category=306&product=1792', '_blank', 'noopener,noreferrer']
  ])
})

test('Purchased details preserve HTML, selected state, panel purchase and the same mouseup boundaries', async ({ page }) => {
  await page.goto(fixtureUrl('surface=download-products&list=purchased&mode=light&tenant=ordering'))
  const driver = purchasedRows(page).nth(1)
  await rowTitle(driver).click()
  let panel = details(page)
  await expect(panel).toContainText('Driver App 2.0')
  await expect(panel.locator('sub')).toContainText('delivered in less than 5 working days')
  if (!isBaseline) await expect(driver).toHaveAttribute('data-selected', '')
  const panelPurchase = isBaseline ? panel.locator('button').first() : panel.locator('.od-purchased-product-action').first()
  await panelPurchase.click()
  await expect.poll(() => openCalls(page)).toEqual([
    ['https://apps.ordering.com/store/marketplace?category=306&product=1718', '_blank', 'noopener,noreferrer']
  ])
  await page.locator('body').dispatchEvent('mouseup')
  await expect(panel).toBeVisible()
  await driver.dispatchEvent('mouseup')
  await expect(panel).toBeVisible()
  await page.getByRole('heading', { name: 'Purchased Products', exact: true }).dispatchEvent('mouseup')
  await expect(panel).toHaveCount(0)

  await rowTitle(driver).click()
  panel = details(page)
  await sidebar(page).getByRole('button', { name: 'Close', exact: true }).click()
  await expect(panel).toHaveCount(0)
})

// redesign FD-A (D2): the harness resolves `useApi` to harness/download-products-language.jsx (vite.config.mjs), which
// always answers the project 'fixture-downloads'. The empty-project case is covered by the unit test.
test('Free downloads shows the project code with a Copy button inside the sign-in note', async ({ page }) => {
  await page.goto(fixtureUrl('surface=download-products&list=free&mode=light&tenant=ordering'))
  const note = page.getByRole('note')
  await expect(note).toContainText('Sign in with your project and Ordering account.')
  await expect(note.getByText('Project code', { exact: true })).toBeVisible()
  await expect(note.locator('code')).toHaveText('fixture-downloads')
  await expect(note.getByRole('button', { name: 'Copy project code' })).toBeVisible()
})

test('collapsed opener forwards false and every tenant image is a loaded local asset', async ({ page }) => {
  await page.goto(fixtureUrl('surface=download-products&list=free&mode=light&collapsed=1'))
  const opener = isBaseline
    ? page.getByRole('heading', { name: 'Free products', exact: true }).locator('..').locator('button')
    : page.getByRole('button', { name: 'Open menu', exact: true })
  await expect(opener).toBeVisible()
  await opener.click()
  await expect(page.getByTestId('download-collapse-state')).toHaveText('false')
  await expect(page.getByTestId('download-collapse-calls')).toHaveText('[false]')
  const images = page.getByTestId('download-products-fixture').locator('img')
  await expect(images).toHaveCount(3)
  for (const image of await images.all()) {
    await expect(image).toHaveJSProperty('complete', true)
    expect(await image.evaluate(element => element.naturalWidth)).toBeGreaterThan(0)
  }
})

for (const mode of ['light', 'dark']) {
  test(`download lists keep readable ${mode} rows, Ordering.co detail copy and real keyboard actions`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1100, height: 820 })
    await page.goto(fixtureUrl(`surface=download-products&list=free&mode=${mode}`))
    const title = page.getByRole('heading', { level: 2, name: 'Driver App', exact: true })
    const outbound = page.getByRole('link', { name: 'App Store · Driver App', exact: true })
    for (const target of [page.getByRole('heading', { level: 1, name: 'Free downloads', exact: true }), title, outbound]) {
      const colors = await effectiveColors(target)
      expect.soft(contrast(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5)
    }
    await page.evaluate(() => document.activeElement?.blur())
    await focusByKeyboard(page, outbound)
    await expect(outbound).toHaveCSS('outline-style', 'solid')
    await expect(outbound).toHaveCSS('outline-width', '2px')
    const outline = await outbound.evaluate(element => getComputedStyle(element).outlineColor)
    const outlineBackground = await effectiveColors(outbound)
    expect.soft(contrast(outline, outlineBackground.background)).toBeGreaterThanOrEqual(3)
    await expect(sidebar(page)).toHaveCount(0)

    await page.goto(fixtureUrl(`surface=download-products&list=purchased&mode=${mode}`))
    const purchased = page.locator('.od-download-product-detail-action').first()
    const purchase = page.locator('.purchase-btn button').first()
    let targetColors = await effectiveColors(purchased)
    expect.soft(contrast(targetColors.foreground, targetColors.background)).toBeGreaterThanOrEqual(4.5)
    await focusByKeyboard(page, purchased)
    await expect(purchased).toHaveCSS('outline-color', rgb(tokens.theme[mode].semantic.action.focus))
    await page.keyboard.press('Enter')
    const panel = page.locator('[data-slot="download-product-details"]')
    const colors = await effectiveColors(panel.locator('.description'))
    expect.soft(contrast(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5)
    await sidebar(page).getByRole('button', { name: 'Close', exact: true }).click()
    targetColors = await effectiveColors(purchase)
    expect.soft(contrast(targetColors.foreground, targetColors.background)).toBeGreaterThanOrEqual(4.5)
    await focusByKeyboard(page, purchase)
    await expect(purchase).toHaveCSS('outline-color', rgb(tokens.theme[mode].semantic.action.focus))
    await page.screenshot({ path: testInfo.outputPath(`download-products-${mode}.png`), fullPage: false })
  })
}

for (const width of [320, 390]) {
  test.describe(`download products at ${width}px coarse pointer`, () => {
    test.use({ viewport: { width, height: 760 }, hasTouch: true, isMobile: true })
    test('RTL free catalog reflows and purchased scrollport retains native touch movement, with 44px actions', async ({ page }, testInfo) => {
      // Free: main's static catalog has no horizontal scrollport; it must reflow inside the viewport.
      await page.goto(fixtureUrl('surface=download-products&list=free&mode=dark&rtl=true&locale=ar'))
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      await expect(page.locator('[data-slot="free-products-scrollport"]')).toHaveCount(0)
      // decision 12: a link is SEEN at 32px and its touch AREA is 44x44 (the ::after). The area is what a finger hits, so it is
      // measured by hit-testing, and the 12px gap keeps the areas of two neighbours from crossing.
      const hits = (link, offset) => link.evaluate((element, dy) => {
        const rect = element.getBoundingClientRect()
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2 + dy)
        return hit === element || element.contains(hit)
      }, offset)
      const boxes = []
      for (const link of await freeLinks(freeCards(page)).all()) {
        await link.scrollIntoViewIfNeeded()
        const box = await link.boundingBox()
        expect(box.height).toBeGreaterThanOrEqual(32)
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.x + box.width).toBeLessThanOrEqual(width)
        expect(await hits(link, 0)).toBe(true)
        // 6px above and below the visible 32px box is inside the 44px area (only when the link is one line tall)
        if (box.height <= 32.5) {
          expect(await hits(link, -(box.height / 2 + 5))).toBe(true)
          expect(await hits(link, box.height / 2 + 5)).toBe(true)
        }
        const area = { x: box.x + box.width / 2 - Math.max(box.width, 44) / 2, y: box.y + box.height / 2 - Math.max(box.height, 44) / 2, width: Math.max(box.width, 44), height: Math.max(box.height, 44) }
        for (const other of boxes) {
          const overlaps = area.x < other.x + other.width && other.x < area.x + area.width && area.y < other.y + other.height && other.y < area.y + area.height
          expect(overlaps).toBe(false)
        }
        boxes.push(area)
      }
      await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('direction', 'rtl')
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      await page.screenshot({ path: testInfo.outputPath(`download-free-${width}.png`) })

      for (const list of ['purchased']) {
        await page.goto(fixtureUrl(`surface=download-products&list=${list}&mode=dark&rtl=true&locale=ar`))
        expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
        const scrollport = page.locator(`[data-slot="${list}-products-scrollport"]`)
        await scrollport.scrollIntoViewIfNeeded()
        const before = await scrollport.evaluate(element => ({ clientWidth: element.clientWidth, scrollLeft: element.scrollLeft, scrollWidth: element.scrollWidth }))
        expect(before.scrollWidth).toBeGreaterThan(before.clientWidth)
        expect(before.scrollLeft).toBe(0)
        await page.screenshot({ path: testInfo.outputPath(`download-${list}-${width}-before.png`) })
        const box = await scrollport.boundingBox()
        const cdp = await page.context().newCDPSession(page)
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width * 0.25, y: box.y + box.height / 2 }] })
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width * 0.75, y: box.y + box.height / 2 }] })
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        await expect.poll(() => scrollport.evaluate(element => element.scrollLeft)).toBeLessThan(0)
        const action = page.locator('.purchase-btn button').first()
        await action.scrollIntoViewIfNeeded()
        const actionBox = await action.boundingBox()
        expect(actionBox.width).toBeGreaterThanOrEqual(44)
        expect(actionBox.height).toBeGreaterThanOrEqual(44)
        const detail = page.locator('.od-download-product-detail-action').first()
        await detail.scrollIntoViewIfNeeded()
        const detailBox = await detail.boundingBox()
        expect(detailBox.height).toBeGreaterThanOrEqual(44)
        await detail.click()
        await sidebarOpened(page)
        const panel = page.locator('[data-slot="download-product-details"]')
        const panelAction = panel.locator('.od-purchased-product-action').first()
        await panelAction.scrollIntoViewIfNeeded()
        const panelBox = await panelAction.boundingBox()
        expect(panelBox.width).toBeGreaterThanOrEqual(44)
        expect(panelBox.height).toBeGreaterThanOrEqual(44)
        expect(await panelAction.evaluate(element => {
          const rect = element.getBoundingClientRect()
          const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
          return hit === element || element.contains(hit)
        })).toBe(true)
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
        await page.screenshot({ path: testInfo.outputPath(`download-${list}-${width}-after.png`) })
        expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      }
    })
  })
}

for (const mode of ['light', 'dark']) {
  test(`download menu action and text-only purchased detail are accessible in ${mode}`, async ({ page }) => {
    await page.goto(fixtureUrl(`surface=download-products&list=purchased&mode=${mode}&collapsed=1`))
    await expect.soft(page.getByRole('button', { name: 'Menu', exact: true })).toBeVisible()
    await page.locator('.od-download-product-detail-action').last().click()
    const action = page.locator('#sideSlider .od-purchased-product-action')
    await expect(action).toHaveText('Call Center 2.0')
    const colors = await effectiveColors(action)
    expect(contrast(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5)
  })
}
