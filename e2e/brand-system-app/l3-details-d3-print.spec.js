import {
  expect,
  expectClosedNetworkBoundary,
  installAppNetworkBoundary,
  installSyntheticSession,
  test
} from './fixtures'
import { tokens } from '../../src/brand/ordering.tokens.generated'

const readLengthToken = (page, token) =>
  page.evaluate(name => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)), token)

const dismissReadOnlyNotices = async page => {
  const accept = page.getByRole('button', { name: 'Accept', exact: true })
  if (await accept.count()) await accept.last().click()
}

// redesign 5.3: 32px with a fine pointer, 44px with a coarse one (user decision 2026-10-06).
const defineDetailsD3Case = (name, viewport, pointer) => {
  test(`${name} order detail keeps D3 bill, product disclosure and print ownership read-only`, async ({ context, page }, testInfo) => {
    test.setTimeout(120000)
    const network = await installAppNetworkBoundary(context, { scenario: 'populated' })
    await installSyntheticSession(context, { authenticated: true })
    await page.setViewportSize(viewport)
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    await page.goto('/orders', { waitUntil: 'domcontentloaded' })
    // redesign 5.6: a card on a phone (was `tbody tr` at every width), the table row on desktop.
    const row = page.locator(viewport.width < 768 ? 'li.odc-order-card' : 'tbody tr').filter({ hasText: '910001' }).first()
    // redesign 5.3: the store column drops below the desktop width, so the row is ready when its status shows (any viewport).
    await expect(row).toContainText('Pending', { timeout: 90000 })
    await dismissReadOnlyNotices(page)
    // redesign 5.3: the row shows `#910001` (no «Order No. 910001» text) and the whole row opens the panel.
    await row.getByText('#910001', { exact: true }).click()

    const detail = page.locator('#orderDetails')
    await expect(detail).toBeVisible()
    const writesBefore = network.blockedWrites.length

    // redesign 5.3: the pointer the variant claims must be the pointer the browser emulates, or the bar below proves nothing.
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(pointer === 'coarse')
    const targetToken = pointer === 'coarse' ? '--od-x-target-coarse' : '--od-x-control-height'
    const minimumTarget = await readLengthToken(page, targetToken)
    expect(minimumTarget, `${targetToken} must resolve to a pixel length`).toBeGreaterThan(0)
    expect(minimumTarget).toBe(pointer === 'coarse' ? 44 : 32)

    const bill = detail.getByRole('table', { name: 'Order bill' })
    const total = detail.getByRole('table', { name: 'Order total' })
    // redesign 5.3: bill rows are the ui role (13px, `.odt-bill table`), not 14px; the total keeps the section role (18px).
    await expect(bill.getByText('Subtotal')).toHaveCSS('font-size', tokens.font.size.productUi)
    await expect(total.getByText('Total')).toHaveCSS('font-size', '18px')

    // redesign 5.3: the compact item is a list line, not an accordion with an h3: its name is `.odt-item-title` (body role, 14px).
    const item = detail.getByRole('listitem').filter({ hasText: 'Long synthetic product for order detail verification' })
    const productName = item.locator('.odt-item-title')
    await expect(productName).toHaveText('Long synthetic product for order detail verification')
    await expect(productName).toHaveCSS('font-size', tokens.font.size.productContent)

    // redesign 5.3: there is no product disclosure any more (no Expand/Collapse button, no aria-expanded, no aria-hidden content):
    // the compact line shows the removed ingredient, the options and the note always, folded in one secondary line.
    await expect(detail.getByRole('button', { name: /^(Expand|Collapse) / })).toHaveCount(0)
    await expect(item.locator('[aria-hidden="true"]')).toHaveCount(0)
    const productDetails = item.locator('.odt-item-opt')
    await expect(productDetails).toBeVisible()
    await expect(productDetails).toContainText('No Long sliced onion ingredient')
    await expect(productDetails).toContainText('Toppings:')
    await expect(productDetails).toContainText('Keep this long operational product note visible.')
    // redesign 5.3: the details line is the ui role (13px), secondary to the name.
    await expect(productDetails).toHaveCSS('font-size', tokens.font.size.productUi)

    // redesign 5.3: the panel reads the product type scale (`--od-x-type-*`), not the Part 1 `--od-type-*-size` roles.
    // content -> body (product name), section-title -> section (total), control -> ui (bill rows and details line).
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--od-x-type-body-size', '19px')
      document.documentElement.style.setProperty('--od-x-type-section-size', '24px')
      document.documentElement.style.setProperty('--od-x-type-ui-size', '17px')
    })
    await expect(productName).toHaveCSS('font-size', '19px')
    await expect(total.getByText('Total')).toHaveCSS('font-size', '24px')
    await expect(bill.getByText('Subtotal')).toHaveCSS('font-size', '17px')
    await expect(productDetails).toHaveCSS('font-size', '17px')
    // The grown text must reflow, not clip.
    for (const element of [productName, productDetails, total.getByText('Total')]) {
      const geometry = await element.evaluate(node => ({ clientHeight: node.clientHeight, scrollHeight: node.scrollHeight }))
      expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.clientHeight + 1)
    }
    await page.evaluate(() => {
      document.documentElement.style.removeProperty('--od-x-type-body-size')
      document.documentElement.style.removeProperty('--od-x-type-section-size')
      document.documentElement.style.removeProperty('--od-x-type-ui-size')
    })
    await expect(productName).toHaveCSS('font-size', tokens.font.size.productContent)

    // redesign 5.3: Print is a Menu whose Normal and Ticket entries are `menuitem`s in a portal, not buttons inside the panel.
    const print = detail.getByRole('button', { name: 'Print', exact: true })
    await expect(print).toHaveAttribute('aria-haspopup', 'menu')
    await print.click()
    await expect(print).toHaveAttribute('aria-expanded', 'true')
    const normal = page.getByRole('menuitem', { name: 'Normal', exact: true })
    const ticket = page.getByRole('menuitem', { name: 'Ticket', exact: true })
    await expect(normal).toBeVisible()
    await expect(ticket).toBeVisible()
    // redesign 5.3: 32px fine / 44px coarse for the print entries.
    for (const entry of [normal, ticket]) {
      const box = await entry.boundingBox()
      expect(box.width).toBeGreaterThanOrEqual(minimumTarget)
      expect(box.height).toBeGreaterThanOrEqual(minimumTarget)
    }
    await page.keyboard.press('Escape')
    await expect(print).toHaveAttribute('aria-expanded', 'false')
    await expect(print).toBeFocused()
    await page.screenshot({ path: testInfo.outputPath(`${name}-details-d3.png`) })

    // redesign 5.3: no page overflow with the panel open.
    const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)

    expect(network.blockedWrites.length).toBe(writesBefore)
    expect(pageErrors).toEqual([])
    expectClosedNetworkBoundary(network)
  })
}

for (const [name, viewport] of Object.entries({
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 }
})) {
  defineDetailsD3Case(name, viewport, 'fine')
}

// redesign 5.3: 32px with a fine pointer, 44px with a coarse one (user decision 2026-10-06).
test.describe('coarse pointer', () => {
  test.use({ hasTouch: true, isMobile: true })
  defineDetailsD3Case('mobile coarse-pointer', { width: 390, height: 844 }, 'coarse')
})
