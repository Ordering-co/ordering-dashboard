import {
  expect,
  expectClosedNetworkBoundary,
  installAppNetworkBoundary,
  installSyntheticSession,
  test
} from './fixtures'
import { tokens } from '../../src/brand/ordering.tokens.generated'

// redesign 5.3: the panel reads the product type scale (`--od-x-type-*`, src/brand/candidates.css),
// not the Part 1 `--od-type-*-size` roles. control -> ui (13px), content -> body (14px).
const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, value] of Object.entries(values)) document.documentElement.style.setProperty(`--od-x-type-${role}-size`, value)
}, sizes)

const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-x-type-${role}-size`)
}, roles)

const readLengthToken = (page, token) =>
  page.evaluate(name => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)), token)

const dismissReadOnlyNotices = async page => {
  const accept = page.getByRole('button', { name: 'Accept', exact: true })
  if (await accept.count()) await accept.last().click()
}

// redesign 5.3: 32px with a fine pointer, 44px with a coarse one (user decision 2026-10-06).
const defineOrderDetailCase = (name, viewport, pointer) => {
  test(`${name} order detail preserves query ownership and renders the clone surface`, async ({ context, page }, testInfo) => {
    test.setTimeout(120000)
    const network = await installAppNetworkBoundary(context, { scenario: 'populated' })
    await installSyntheticSession(context, { authenticated: true })
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    await page.setViewportSize(viewport)
    await page.goto('/orders', { waitUntil: 'domcontentloaded' })

    // redesign 5.6: a card on a phone (was `tbody tr` at every width), the table row on desktop.
    const orderRow = page.locator(viewport.width < 768 ? 'li.odc-order-card' : 'tbody tr').filter({ hasText: '910001' }).first()
    // redesign 5.3: the store column drops below the desktop width, so the row is ready when its status shows (any viewport).
    await expect(orderRow).toContainText('Pending', { timeout: 90000 })
    await dismissReadOnlyNotices(page)
    // redesign 5.3: the row shows `#910001` (no «Order No. 910001» text) and the whole row opens the panel.
    await orderRow.getByText('#910001', { exact: true }).click()

    await expect(page).toHaveURL(/(?:\?|&)id=910001(?:&|$)/)
    const detail = page.locator('#orderDetails')
    await expect(detail).toBeVisible()
    const writesBefore = network.blockedWrites.length
    // redesign 5.3: the heading is `#910001` in mono (h2), not «Order No. 910001».
    const title = detail.getByRole('heading', { name: '#910001', exact: true })
    await expect(title).toBeVisible()
    // redesign 5.3: the identifier is the `.odc-mono` span of the heading (was `.order-identifier`).
    const identifier = title.locator('.odc-mono')
    expect(await identifier.evaluate(element => getComputedStyle(element).fontFamily)).toContain('JetBrains Mono')

    // redesign 5.3: the pointer the variant claims must be the pointer the browser emulates, or the bar below proves nothing.
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(pointer === 'coarse')
    const targetToken = pointer === 'coarse' ? '--od-x-target-coarse' : '--od-x-control-height'
    const minimumTarget = await readLengthToken(page, targetToken)
    expect(minimumTarget, `${targetToken} must resolve to a pixel length`).toBeGreaterThan(0)
    expect(minimumTarget).toBe(pointer === 'coarse' ? 44 : 32)

    // redesign 5.3: Print is a Menu (a trigger with aria-haspopup) whose items are `menuitem`s in a portal, not buttons inside the panel.
    const print = detail.getByRole('button', { name: 'Print', exact: true })
    await expect(print).toHaveAttribute('aria-haspopup', 'menu')
    await expect(print).toHaveAttribute('aria-expanded', 'false')
    const printTrigger = await print.boundingBox()
    expect(printTrigger.width).toBeGreaterThanOrEqual(minimumTarget)
    expect(printTrigger.height).toBeGreaterThanOrEqual(minimumTarget)
    await print.click()
    await expect(print).toHaveAttribute('aria-expanded', 'true')
    const normalPrint = page.getByRole('menuitem', { name: 'Normal', exact: true })
    await expect(page.getByRole('menuitem', { name: 'Ticket', exact: true })).toBeVisible()
    // redesign 5.3: the delivery time moved from the status block to the «Business time» fact of the Details tab.
    // redesign W0 T0-45 (W0-E-07, decision 13): the fixture has no `dates_general_format`, so `parseDate` paints the default 'DD MMM YYYY'
    // (the month is an Intl word, English here) and the 24h time: '2026-09-13 12:30' is '13 Sep 2026 12:30' (the business time keeps utc: false). No ISO.
    const statusCopy = detail.getByText('13 Sep 2026 12:30', { exact: true }).first()
    await expect(normalPrint).toBeVisible()
    await expect(normalPrint).toHaveCSS('font-size', tokens.font.size.productUi)
    await expect(statusCopy).toHaveCSS('font-size', tokens.font.size.productContent)
    await setRoleSizes(page, { ui: '17px', body: '19px' })
    await expect(normalPrint).toHaveCSS('font-size', '17px')
    await expect(statusCopy).toHaveCSS('font-size', '19px')
    for (const element of [normalPrint, statusCopy]) {
      const geometry = await element.evaluate(node => ({ clientHeight: node.clientHeight, scrollHeight: node.scrollHeight }))
      expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.clientHeight + 1)
    }
    // redesign 5.3: 32px fine / 44px coarse (was 44px for every pointer).
    const printTarget = await normalPrint.boundingBox()
    expect(printTarget.width).toBeGreaterThanOrEqual(minimumTarget)
    expect(printTarget.height).toBeGreaterThanOrEqual(minimumTarget)
    await restoreRoleSizes(page, ['ui', 'body'])
    await expect(normalPrint).toHaveCSS('font-size', tokens.font.size.productUi)
    await expect(statusCopy).toHaveCSS('font-size', tokens.font.size.productContent)
    await page.keyboard.press('Escape')
    await expect(print).toHaveAttribute('aria-expanded', 'false')
    await expect(print).toBeFocused()

    // redesign 5.3: «Clone order» moved from a button of the header into the «More actions» menu («Clone order…» item).
    await detail.getByRole('button', { name: 'More actions', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Clone order…', exact: true }).click()
    await expect(page).toHaveURL(/(?:\?|&)section=clone_order(?:&|$)/)
    // redesign 5.3: the clone surface is a Dialog named «Clone order». redesign fix-qa E5: the options are a radio
    // group now (they were toggle buttons with aria-pressed); the chosen one is the same, «Clone full order».
    const dialog = page.getByRole('dialog', { name: 'Clone order', exact: true })
    await expect(dialog).toBeVisible()
    const clone = dialog.getByRole('radio', { name: 'Clone full order', exact: true })
    await expect(clone).toBeChecked()
    await page.screenshot({ path: testInfo.outputPath(`${name}-order-detail-clone.png`) })

    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page).not.toHaveURL(/(?:\?|&)section=/)
    await expect(page).not.toHaveURL(/(?:\?|&)tab=/)
    await expect(page).toHaveURL(/(?:\?|&)id=910001(?:&|$)/)

    // redesign 5.3: no page overflow with the panel open (side by side at 1440, full screen at 390).
    const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)

    // redesign 5.3: on a phone the panel is full screen and closes with «Back to orders»; on desktop it keeps «Close».
    const leave = viewport.width < 768
      ? detail.getByRole('button', { name: 'Back to orders', exact: true })
      : detail.getByRole('button', { name: 'Close', exact: true })
    await leave.click()
    await expect(page).not.toHaveURL(/(?:\?|&)id=/)
    await expect(detail).toHaveCount(0)

    expect(network.blockedWrites.length).toBe(writesBefore)
    expect(pageErrors).toEqual([])
    expectClosedNetworkBoundary(network)
  })
}

for (const [name, viewport] of Object.entries({
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 }
})) {
  defineOrderDetailCase(name, viewport, 'fine')
}

// redesign 5.3: 32px with a fine pointer, 44px with a coarse one (user decision 2026-10-06).
test.describe('coarse pointer', () => {
  test.use({ hasTouch: true, isMobile: true })
  defineOrderDetailCase('mobile coarse-pointer', { width: 390, height: 844 }, 'coarse')
})
