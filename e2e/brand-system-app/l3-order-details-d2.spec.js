import {
  expect,
  expectClosedNetworkBoundary,
  installAppNetworkBoundary,
  installSyntheticSession,
  test
} from './fixtures'
import { tokens } from '../../src/brand/ordering.tokens.generated'
import { expectTouchTarget } from '../touch-target'

const readLengthToken = (page, token) =>
  page.evaluate(name => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)), token)

const dismissReadOnlyNotices = async page => {
  const accept = page.getByRole('button', { name: 'Accept', exact: true })
  if (await accept.count()) await accept.last().click()
}

const dismissSyntheticConnectionNotice = async page => {
  const alert = page.getByRole('alert').filter({ has: page.getByRole('heading', { name: 'Connection issue' }) })
  if (await alert.count() && await alert.isVisible()) await alert.getByRole('button', { name: 'Close', exact: true }).click()
}

const openOrder = async page => {
  await page.goto('/orders', { waitUntil: 'domcontentloaded' })
  // redesign 5.6: a card on a phone (was `tbody tr` at every width), the table row on desktop.
  const orderRow = page.locator(page.viewportSize().width < 768 ? 'li.odc-order-card' : 'tbody tr').filter({ hasText: '910001' }).first()
  // redesign 5.3: the store column drops below the desktop width, so the row is ready when its status shows (any viewport).
  await expect(orderRow).toContainText('Pending', { timeout: 90000 })
  await dismissReadOnlyNotices(page)
  // redesign 5.3: the row shows `#910001` (no «Order No. 910001» text) and the whole row opens the panel.
  await orderRow.getByText('#910001', { exact: true }).click()
  await expect(page).toHaveURL(/(?:\?|&)id=910001(?:&|$)/)
  const detail = page.locator('#orderDetails')
  await expect(detail).toBeVisible()
  return detail
}

// redesign 5.3: 32px with a fine pointer, 44px with a coarse one (user decision 2026-10-06).
const defineOrderDetailD2Case = (name, viewport, pointer) => {
  test(`${name} order detail exposes D2 contact, message and custom-field states without writes`, async ({ context, page }, testInfo) => {
    test.setTimeout(120000)
    const network = await installAppNetworkBoundary(context, { scenario: 'populated' })
    await installSyntheticSession(context, { authenticated: true })
    await page.setViewportSize(viewport)
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))

    const detail = await openOrder(page)
    const writesBefore = network.blockedWrites.length

    // redesign 5.3: the pointer the variant claims must be the pointer the browser emulates, or the bar below proves nothing.
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(pointer === 'coarse')
    const targetToken = pointer === 'coarse' ? '--od-x-target-coarse' : '--od-x-control-height'
    const minimumTarget = await readLengthToken(page, targetToken)
    expect(minimumTarget, `${targetToken} must resolve to a pixel length`).toBeGreaterThan(0)
    expect(minimumTarget).toBe(pointer === 'coarse' ? 44 : 32)

    // redesign 5.3: there are no contact accordions (`Business: …` / `Customer: …` with aria-expanded). The Details tab
    // shows customer, address, business and its contact lines always in view, so the same facts are asserted without a click.
    await expect(detail.getByRole('tab', { name: 'Details', exact: true })).toHaveAttribute('aria-selected', 'true')
    const customerSection = detail.getByRole('region', { name: 'Customer', exact: true })
    const businessSection = detail.getByRole('region', { name: 'Business and driver', exact: true })
    await expect(customerSection.getByText('Fixture Customer Longname', { exact: true })).toBeVisible()
    await expect(customerSection.getByText('200 Another Very Long Customer Address, Apartment 98765', { exact: true })).toBeVisible()
    await expect(customerSection.getByRole('link', { name: 'fixture.customer@example.invalid', exact: true })).toBeVisible()
    await expect(businessSection.getByText('Synthetic Store Alpha', { exact: true })).toBeVisible()
    await expect(businessSection.getByRole('link', { name: 'operations-contact-with-a-very-long-name@example.invalid', exact: true })).toBeVisible()
    // redesign 5.3: Edit is a toggle (aria-pressed) instead of an accordion; it is only read here, saving would write.
    await expect(customerSection.getByRole('button', { name: 'Edit Customer', exact: true })).toHaveAttribute('aria-pressed', 'false')

    // redesign 5.3: «Message» in the customer section is the shortcut to the Chat tab (it replaces the header «Chat» button).
    const message = customerSection.getByRole('button', { name: 'Message Fixture Customer', exact: true })
    // redesign 5.3: no size bar on this sm icon button; it is 28px with a fine pointer by design (product.css: the 24px minimum), and the 32/44px bars below cover the default controls.
    await message.click()
    await expect(page).toHaveURL(/(?:\?|&)section=chat(?:&|$)/)
    const chatTab = detail.getByRole('tab', { name: 'Chat', exact: true })
    await expect(chatTab).toHaveAttribute('aria-selected', 'true')
    // redesign 5.3: Details owns no `?section=`: going back to it removes the query the Chat tab wrote.
    await detail.getByRole('tab', { name: 'Details', exact: true }).click()
    await expect(page).not.toHaveURL(/(?:\?|&)section=/)
    await expect(page).not.toHaveURL(/(?:\?|&)tab=/)
    await expect(page).toHaveURL(/(?:\?|&)id=910001(?:&|$)/)

    // redesign 5.3: Chat is a tab of the panel (role tab), not a header button.
    await chatTab.click()
    await expect(page).toHaveURL(/(?:\?|&)section=chat(?:&|$)/)
    // redesign 5.3: the recipients live in the panel (not a floating chat sheet), so they are scoped to it.
    const businessRecipient = detail.getByRole('button', { name: 'Business: Synthetic Store Alpha' })
    const customerRecipient = detail.getByRole('button', { name: 'Customer: Fixture Customer Longname' })
    await expect(businessRecipient).toHaveAttribute('aria-pressed', 'true')
    await expect(customerRecipient).toHaveAttribute('aria-pressed', 'true')
    await expect(detail.getByLabel('Insert image')).toBeVisible()
    // redesign 5.3: the send button is named «Send» (was «send») and is disabled while the message is empty.
    const send = detail.getByRole('button', { name: 'Send', exact: true })
    // redesign 5.3: 32px fine / 44px coarse (was 44px for every pointer).
    // redesign W0 T0-45 (W0-E-08, decision 12): the coarse 44px is 32px visible plus the 44×44 area (corners at ±21px), or 44px drawn (W0-D-08).
    const chips = [businessRecipient, customerRecipient]
    if (pointer === 'coarse') {
      for (const [label, target] of [['Send', send], ['Business recipient', businessRecipient], ['Customer recipient', customerRecipient]]) await expectTouchTarget(target, { label })
    } else {
      const sendBox = await send.boundingBox()
      expect(sendBox.width).toBeGreaterThanOrEqual(minimumTarget)
      expect(sendBox.height).toBeGreaterThanOrEqual(minimumTarget)
      for (const chip of chips) {
        const box = await chip.boundingBox()
        expect(box.height).toBeGreaterThanOrEqual(minimumTarget)
      }
    }

    // redesign 5.3: the recipient name is a control label (ui role, 13px), not content (was content, 14px); it follows `--od-x-type-ui-size`.
    const recipientName = businessRecipient.getByText('Synthetic Store Alpha', { exact: true })
    await expect(recipientName).toHaveCSS('font-size', tokens.font.size.productUi)
    await page.evaluate(() => document.documentElement.style.setProperty('--od-x-type-ui-size', '19px'))
    await expect(recipientName).toHaveCSS('font-size', '19px')
    await page.evaluate(() => document.documentElement.style.removeProperty('--od-x-type-ui-size'))
    await expect(recipientName).toHaveCSS('font-size', tokens.font.size.productUi)
    await page.screenshot({ path: testInfo.outputPath(`${name}-order-detail-chat.png`) })

    await dismissSyntheticConnectionNotice(page)
    // redesign 5.3: leaving Chat is selecting another tab (it was the lateral «Close»); the panel stays open on the same order.
    await detail.getByRole('tab', { name: 'Details', exact: true }).click()
    await expect(page).not.toHaveURL(/(?:\?|&)section=/)
    await expect(page).not.toHaveURL(/(?:\?|&)tab=/)
    await expect(page).toHaveURL(/(?:\?|&)id=910001(?:&|$)/)

    // redesign 5.3: «Options» is now «More actions» and «Custom fields» is one of its menuitems; it opens the Custom fields tab.
    await detail.getByRole('button', { name: 'More actions', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Custom fields', exact: true }).click()
    await expect(page).toHaveURL(/(?:\?|&)section=metafields(?:&|$)/)
    await expect(detail.getByRole('tab', { name: 'Custom fields', exact: true })).toHaveAttribute('aria-selected', 'true')
    // redesign 5.3: the fixture has no fields, so the tab shows its empty state and the add form (no «Custom Fields» heading at 18px).
    await expect(detail.getByText('No custom fields yet', { exact: true })).toBeVisible()
    const customFields = detail.getByRole('heading', { name: 'Add custom field', exact: true })
    await expect(customFields).toBeVisible()
    await expect(customFields).toHaveCSS('font-size', tokens.font.size.productUi)
    // redesign 5.3: the field has a visible label «Key» (getByRole name) and the form control is ui 13px with a fine pointer, lead 16px with a coarse one (was 14px).
    // redesign F3 (C3, 852fd29f) after QA E10 (6bb4c7d7): below 768px of screen the custom field inputs are 44px with
    // 16px type whatever the pointer, so a phone with a fine pointer gets the coarse size too.
    const phoneOrCoarse = pointer === 'coarse' || viewport.width < 768
    const keyField = detail.getByRole('textbox', { name: 'Key', exact: true })
    await expect(keyField).toHaveCSS('font-size', phoneOrCoarse ? '16px' : tokens.font.size.productUi)
    const keyBox = await keyField.boundingBox()
    expect(keyBox.height).toBeGreaterThanOrEqual(phoneOrCoarse ? await readLengthToken(page, '--od-x-target-coarse') : minimumTarget)
    await page.screenshot({ path: testInfo.outputPath(`${name}-order-detail-custom-fields.png`) })

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
  defineOrderDetailD2Case(name, viewport, 'fine')
}

// redesign 5.3: 32px with a fine pointer, 44px with a coarse one (user decision 2026-10-06).
test.describe('coarse pointer', () => {
  test.use({ hasTouch: true, isMobile: true })
  defineOrderDetailD2Case('mobile coarse-pointer', { width: 390, height: 844 }, 'coarse')
})
