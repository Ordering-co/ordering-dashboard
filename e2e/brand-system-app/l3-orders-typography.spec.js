import {
  expect,
  expectClosedNetworkBoundary,
  installAppNetworkBoundary,
  installSyntheticSession,
  test
} from './fixtures'
import { tokens } from '../../src/brand/ordering.tokens.generated'

// redesign 5.2: the Orders tabs and cells no longer consume the `productUi` / `productContent`
// roles (--od-type-control-size / --od-type-content-size). They read the C1 candidates
// --od-x-type-ui-size (13px, tabs and controls) and --od-x-type-body-size (14px, cells), both in rem.
const UI_SIZE = '--od-x-type-ui-size'
const BODY_SIZE = '--od-x-type-body-size'

const setTypeSizes = (page, sizes) => page.evaluate(values => {
  for (const [property, value] of Object.entries(values)) {
    document.documentElement.style.setProperty(property, value)
  }
}, sizes)

const restoreTypeSizes = (page, properties) => page.evaluate(values => {
  for (const property of values) document.documentElement.style.removeProperty(property)
}, properties)

// redesign 5.6: below 768px /orders is a list of cards (li.odc-order-card), not a table: the «row» of a viewport is its own element.
const rowSelectorFor = viewport => viewport.width < 768 ? 'li.odc-order-card' : 'tbody tr'

for (const [name, viewport] of Object.entries({
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 }
})) {
  test(`${name} Orders list typography follows central roles and restores canonical values`, async ({ context, page }) => {
    test.setTimeout(90000)
    const network = await installAppNetworkBoundary(context, { scenario: 'populated' })
    await installSyntheticSession(context, { authenticated: true })
    await page.setViewportSize(viewport)
    await page.goto('/orders', { waitUntil: 'domcontentloaded' })

    // redesign 5.6: the order is a card on a phone (was `tbody tr` at every width); desktop keeps the table row.
    const rowSelector = rowSelectorFor(viewport)
    const orderRow = page.locator(rowSelector).filter({ hasText: '910001' }).first()
    // redesign 5.2: the business column is dropped under 1100px, so rows load on the status, which every width keeps.
    await expect(orderRow).toContainText('Pending', { timeout: 90000 })
    const accept = page.getByRole('button', { name: 'Accept', exact: true })
    if (await accept.count()) await accept.last().click()

    // redesign 5.2: the control is the first status tab (role=tab); the content cell is the locked
    // order-number cell, present at every width (the store cell is not, under 1100px).
    const control = page.locator('.order_status_filter').getByRole('tab').first()
    // redesign 5.6: on a card the content role is the `#910001` link (body size, same 14px as the order-number cell).
    const content = viewport.width < 768
      ? orderRow.getByRole('link').filter({ hasText: '#910001' })
      : orderRow.locator('td').filter({ hasText: '#910001' }).first()
    await expect(control).toHaveCSS('font-size', tokens.font.size.productUi)
    await expect(content).toHaveCSS('font-size', tokens.font.size.productContent)
    // The candidates are declared in rem and still measure 13px and 14px on the 16px root.
    const scale = await page.evaluate(({ ui, body }) => {
      const root = getComputedStyle(document.documentElement)
      return { rootFontSize: root.fontSize, ui: root.getPropertyValue(ui).trim(), body: root.getPropertyValue(body).trim() }
    }, { ui: UI_SIZE, body: BODY_SIZE })
    expect(scale.rootFontSize).toBe('16px')
    expect(scale.ui).toBe('0.8125rem')
    expect(parseFloat(scale.ui) * 16).toBe(parseFloat(tokens.font.size.productUi))
    expect(scale.body).toBe('0.875rem')
    expect(parseFloat(scale.body) * 16).toBe(parseFloat(tokens.font.size.productContent))
    const canonicalGeometry = await page.evaluate(({ controlSelector, rowSelector }) => {
      const control = document.querySelector(controlSelector)
      // redesign 5.6: the row selector is the card on a phone.
      const row = [...document.querySelectorAll(rowSelector)].find(element => element.textContent.includes('910001'))
      return {
        controlHeight: control.getBoundingClientRect().height,
        rowHeight: row.getBoundingClientRect().height,
        viewportWidth: innerWidth,
        documentWidth: document.documentElement.scrollWidth
      }
    }, { controlSelector: '.order_status_filter [role="tab"]', rowSelector })
    // redesign 5.2: with isMobile an overflowing page makes innerWidth grow to the document width, so the
    // comparison against innerWidth could pass vacuously. Both the canonical and the enlarged page are
    // compared with the viewport that was set (soft here, so the type checks below still run).
    expect.soft(canonicalGeometry.documentWidth, `canonical document scrollWidth vs the ${viewport.width}px viewport`).toBeLessThanOrEqual(viewport.width)

    // redesign 5.6: the card's total is the second body-role text of the card; it grows with the same token.
    const cardTotal = viewport.width < 768 ? orderRow.locator('.odc-order-card-total') : null
    if (cardTotal) await expect(cardTotal).toHaveCSS('font-size', tokens.font.size.productContent)

    await setTypeSizes(page, { [UI_SIZE]: '17px', [BODY_SIZE]: '19px' })
    await expect(control).toHaveCSS('font-size', '17px')
    await expect(content).toHaveCSS('font-size', '19px')
    if (cardTotal) await expect(cardTotal).toHaveCSS('font-size', '19px')
    const expandedGeometry = await page.evaluate(({ controlSelector, rowSelector }) => {
      const control = document.querySelector(controlSelector)
      // redesign 5.6: the row selector is the card on a phone.
      const row = [...document.querySelectorAll(rowSelector)].find(element => element.textContent.includes('910001'))
      return {
        controlHeight: control.getBoundingClientRect().height,
        controlClipping: control.scrollHeight - control.clientHeight,
        rowHeight: row.getBoundingClientRect().height,
        rowClipping: row.scrollHeight - row.clientHeight,
        viewportWidth: innerWidth,
        documentWidth: document.documentElement.scrollWidth
      }
    }, { controlSelector: '.order_status_filter [role="tab"]', rowSelector })
    expect(expandedGeometry.controlHeight).toBeGreaterThanOrEqual(canonicalGeometry.controlHeight)
    expect(expandedGeometry.rowHeight).toBeGreaterThanOrEqual(canonicalGeometry.rowHeight)
    expect(expandedGeometry.controlClipping).toBeLessThanOrEqual(1)
    expect(expandedGeometry.rowClipping).toBeLessThanOrEqual(1)
    expect(expandedGeometry.documentWidth, `enlarged document scrollWidth vs the ${viewport.width}px viewport`).toBeLessThanOrEqual(viewport.width)
    expect(expandedGeometry.viewportWidth, 'layout viewport did not grow').toBe(viewport.width)

    await restoreTypeSizes(page, [UI_SIZE, BODY_SIZE])
    await expect(control).toHaveCSS('font-size', tokens.font.size.productUi)
    await expect(content).toHaveCSS('font-size', tokens.font.size.productContent)
    if (cardTotal) await expect(cardTotal).toHaveCSS('font-size', tokens.font.size.productContent)
    expectClosedNetworkBoundary(network)
  })
}
