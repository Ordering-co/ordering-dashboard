import { test, expect, fixtureUrl } from './fixtures'
import { tokens } from '../../src/brand/ordering.tokens.generated'
import { touchTargetProblems } from '../touch-target'

const isBaseline = process.env.BRAND_MESSAGES_BASELINE === '1'
const receipts = page => page.evaluate(() => globalThis.__OD_MESSAGES_RECEIPTS__ || [])
const controllers = page => page.evaluate(() => globalThis.__OD_MESSAGES_CONTROLLER_PROPS__ || [])
const lateral = page => page.evaluate(() => globalThis.__OD_MESSAGES_LATERAL__ || [])
const contactActions = page => isBaseline ? page.locator('.driver_orders') : page.locator('.od-chat-orders-action')
const contactPages = page => isBaseline ? page.locator('button').filter({ has: page.locator('svg') }).last().locator('..').locator('button') : page.locator('.od-chat-page-action')
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
// redesign messages FASE 3 (decisions 1A, 3A): the page is the inbox. Its controls: the Active / All SegmentedControl in .odc-conv-scope, the sort Menu,
// the rows (.odi-list li button) and the composer of the shared order chat (.odt-chat-composer).
const scopeButton = (page, name) => page.locator('.odc-conv-scope').getByRole('button', { name, exact: true })
const sortTrigger = page => page.getByRole('button', { name: /^Sort by:/ })
const conversationRows = page => page.locator('.odi-list li button')
const focusByKeyboard = async (page, target) => {
  for (let index = 0; index < 100 && !await target.evaluate(element => element === document.activeElement); index += 1) await page.keyboard.press('Tab')
  await expect(target).toBeFocused()
}

test('Messages listing is the inbox: no Orders tab, exact controller/header props and two sort choices', async ({ page }) => {
  await page.goto(fixtureUrl('surface=messages-shell&view=listing&mode=light'))
  // redesign messages FASE 3 (decision 1A): the «Orders» tab is gone, the page is the conversation list and the open conversation
  await expect(page.getByRole('heading', { name: 'Conversations', exact: true })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Orders', exact: true })).toHaveCount(0)
  await expect(page.getByText('Contacts', { exact: true })).toHaveCount(0)
  // redesign messages FASE 3 (decision 3A): Active / All replaces the old Newest / Order number segmented control; Active is chosen
  await expect(scopeButton(page, 'Active')).toHaveAttribute('aria-pressed', 'true')
  await expect(scopeButton(page, 'All')).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('button', { name: 'Newest', exact: true })).toHaveCount(0)
  // redesign messages FASE 3 (decision 1A): the sort is a menu with the same two choices, Newest message being the current one
  await expect(sortTrigger(page)).toHaveAccessibleName('Sort by: Newest message')
  await sortTrigger(page).click()
  await expect(page.getByRole('menuitemradio', { name: 'Newest message', exact: true })).toBeVisible()
  await expect(page.getByRole('menuitemradio', { name: 'Order number', exact: true })).toBeVisible()
  await expect(page.getByRole('menuitemradio')).toHaveCount(2)
  await page.keyboard.press('Escape')
  await expect.poll(async () => (await controllers(page)).filter(value => value.kind === 'orders').length).toBe(1)
  expect((await controllers(page)).find(value => value.kind === 'orders')).toMatchObject({
    driversPropsToFetch: ['id', 'name', 'lastname', 'location', 'enabled', 'available', 'busy', 'driver_groups.name', 'driver_groups.id', 'assigned_orders_count', 'last_order_assigned_at', 'last_location_at', 'cellphone', 'photo', 'qualification']
  })
  const header = await page.evaluate(() => globalThis.__OD_MESSAGES_HEADER__)
  expect(header).toMatchObject({ hideTour: true, isDisableControl: true, title: 'Messages' })
  expect(header.learnOptions).toEqual([{
    value: 'message_general_view',
    // User decision 7 (2026-10-06): Learn options in sentence case.
    name: 'Messages | General overview',
    url: 'https://help.orderingplus.com/en/articles/9331486-messages-general-overview'
  }])
})

test('listing selection forwards copied order, unread, header filters and sort/scope state to real children', async ({ page }) => {
  await page.goto(fixtureUrl('surface=messages-shell&view=listing&mode=light'))
  const list = () => page.evaluate(() => globalThis.__OD_MESSAGES_CONVERSATIONS__)
  await expect.poll(async () => (await list())?.scope).toBe('active')
  expect(await list()).toMatchObject({ scope: 'active', sort: 'last_direct_message_at', orderBy: 'last_direct_message_at', withMessagesOnly: true, pullInOnMessage: true, unreadByAuthor: true, unreadResetSignal: null })
  // redesign messages FASE 3 (decision 1A): the sort menu hands the list controller the order number sort
  await sortTrigger(page).click()
  await page.getByRole('menuitemradio', { name: 'Order number', exact: true }).click()
  await expect.poll(async () => (await list()).sort).toBe('id')
  expect(await list()).toMatchObject({ orderBy: 'id' })
  // redesign messages FASE 3 (decision 3A): All reloads the list without the «with messages» and active-status limits
  await scopeButton(page, 'All').click()
  await expect.poll(async () => (await list()).scope).toBe('all')
  // redesign messages FASE 3 (decision 2A): a click on a row selects that order: the header and the chat follow it, the list keeps it marked
  await conversationRows(page).nth(1).click()
  await expect(conversationRows(page).nth(1)).toHaveAttribute('aria-current', 'true')
  await expect(page.locator('[data-slot="conversation-header"]').getByText('#502')).toBeVisible()
  await expect.poll(() => page.evaluate(() => globalThis.__OD_MESSAGES_CHAT__?.orderId)).toBe(502)
  // redesign messages FASE 3 (decision 9A): a click engages the chat, which reads on interaction
  expect(await page.evaluate(() => ({ readPolicy: globalThis.__OD_MESSAGES_CHAT__.readPolicy, engaged: globalThis.__OD_MESSAGES_CHAT__.engaged, layout: globalThis.__OD_MESSAGES_CHAT__.layout })))
    .toEqual({ readPolicy: 'interaction', engaged: true, layout: 'standalone' })
  // the chat's unread callback reaches the list controller, as «Mark unread handled» did. since /messages round 2 (M-08,
  // 9edf455d) it travels as { orderId, seq }: the chat calls it with null and then with the id, and a second read of the same
  // conversation must reset the counts again, so every read is a new seq and null changes nothing
  await page.evaluate(() => { globalThis.__OD_MESSAGES_CHAT__.handleUpdateOrderForUnreadCount(null); globalThis.__OD_MESSAGES_CHAT__.handleUpdateOrderForUnreadCount(502) })
  await expect.poll(async () => (await list()).unreadResetSignal).toEqual({ orderId: 502, seq: 1 })
  await page.evaluate(() => { globalThis.__OD_MESSAGES_CHAT__.handleUpdateOrderForUnreadCount(null); globalThis.__OD_MESSAGES_CHAT__.handleUpdateOrderForUnreadCount(502) })
  await expect.poll(async () => (await list()).unreadResetSignal).toEqual({ orderId: 502, seq: 2 })
  await page.getByRole('button', { name: 'Header search', exact: true }).click()
  await page.getByRole('button', { name: 'Header filter', exact: true }).click()
  await page.getByRole('button', { name: 'Set late status', exact: true }).click()
  await expect.poll(async () => (await receipts(page)).filter(value => ['search', 'filters'].includes(value.kind)).length).toBe(2)
  expect((await receipts(page)).filter(value => ['search', 'filters'].includes(value.kind))).toEqual([
    { kind: 'search', value: 'fixture search' },
    { kind: 'filters', value: { status: 'completed' } }
  ])
  await expect.poll(async () => (await list()).timeStatus).toBe('late')
})

test('real query helpers open, deepen and close order details from the conversation header while mobile body overflow follows state', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 760 })
  await page.goto(fixtureUrl('surface=messages-shell&view=listing&mode=light&id=777'))
  await expect(page.getByText('Order detail 777', { exact: true })).toBeVisible()
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')
  await page.getByRole('button', { name: 'Close order details', exact: true }).click()
  await expect(page.getByText('Order detail 777', { exact: true })).toHaveCount(0)
  await expect(page.locator('body')).toHaveCSS('overflow', 'auto')
  expect(new URL(page.url()).searchParams.has('id')).toBe(false)

  // redesign messages FASE 3 (decision 8A): on a phone the list comes first; a row opens the full-screen conversation and its header's «View order»
  // opens the order panel (it was the card's «Open details» button)
  await conversationRows(page).first().click()
  await page.getByRole('button', { name: 'View order', exact: true }).click()
  expect(new URL(page.url()).searchParams.get('id')).toBe('501')
  await page.getByRole('button', { name: 'Open nested order 502', exact: true }).click()
  expect(new URL(page.url()).searchParams.get('id')).toBe('502')
  const detailCalls = await page.evaluate(() => globalThis.__OD_MESSAGES_ORDER_DETAILS__)
  expect(detailCalls.at(-1)).toMatchObject({ open: true, orderId: 502, orderReference: true, driversCount: 2 })
})

test('contact chats preserve loading ten, empty state, forced controller props, disabled driver and lateral payloads', async ({ page }) => {
  await page.goto(fixtureUrl('surface=messages-shell&view=contacts&state=loading&mode=light'))
  if (isBaseline) await expect(page.locator('.react-loading-skeleton')).toHaveCount(30)
  else await expect(page.locator('[data-slot="chat-list-row"]')).toHaveCount(10)
  await page.goto(fixtureUrl('surface=messages-shell&view=contacts&state=empty&mode=light'))
  await expect(contactActions(page)).toHaveCount(0)
  await page.goto(fixtureUrl('surface=messages-shell&view=contacts&state=populated&mode=light'))
  await expect(contactActions(page)).toHaveCount(2)
  const userController = (await controllers(page)).find(value => value.kind === 'users')
  expect(userController).toMatchObject({
    defaultUserTypesSelected: [4],
    propsToFetch: ['name', 'lastname', 'photo', 'assigned_orders_count'],
    searchFlags: [true, true, true, undefined, undefined, undefined]
  })
  if (isBaseline) await expect(contactActions(page).first()).toHaveCSS('pointer-events', 'none')
  else await expect(contactActions(page).first()).toBeDisabled()
  await contactActions(page).nth(1).click()
  await expect(page.getByText(/Orders for Driver With three assigned orders/)).toBeVisible()
  await expect.poll(async () => (await lateral(page)).length).toBe(1)
  expect((await lateral(page))[0]).toMatchObject({ isDriver: true, open: true, sameReference: true, userId: 202 })
  await page.getByRole('button', { name: 'Close lateral orders', exact: true }).click()
  const pages = contactPages(page)
  await expect(pages).toHaveCount(2)
  await pages.last().click()
  await expect.poll(async () => (await receipts(page)).filter(value => value.kind === 'getUsers').length).toBe(1)
  expect((await receipts(page)).find(value => value.kind === 'getUsers')).toEqual({ kind: 'getUsers', args: [false, true] })

  await page.goto(fixtureUrl('surface=messages-shell&view=contacts&contact=customer&state=populated&mode=light'))
  await expect(contactActions(page).first()).toBeEnabled()
  await contactActions(page).first().click()
  await expect.poll(async () => (await lateral(page)).length).toBe(1)
  expect((await lateral(page))[0]).toMatchObject({ isCustomer: true, open: true, sameReference: true, userId: 301 })
})

test('business chats preserve loading, empty, page boundary load-more and business lateral props', async ({ page }) => {
  await page.goto(fixtureUrl('surface=messages-shell&view=businesses&state=loading&mode=light'))
  if (isBaseline) await expect(page.locator('.react-loading-skeleton')).toHaveCount(30)
  else await expect(page.locator('[data-slot="chat-list-row"]')).toHaveCount(10)
  await page.goto(fixtureUrl('surface=messages-shell&view=businesses&state=empty&mode=light'))
  await expect(page.locator('.od-chat-orders-action')).toHaveCount(0)
  await page.goto(fixtureUrl('surface=messages-shell&view=businesses&state=populated&mode=light'))
  await expect(page.getByText('1-10 of 25', { exact: true })).toBeVisible()
  const businessController = (await controllers(page)).find(value => value.kind === 'businesses')
  expect(businessController).toMatchObject({ asDashboard: true, initialPageSize: 50, loadMorePageSize: 10, searchFlags: [undefined, undefined, undefined, true, true, true] })
  await expect(page.getByText('1-10 of 25', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Next page', exact: true }).click()
  await expect(page.getByText('11-20 of 25', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Next page', exact: true }).click()
  await expect(page.getByText('21-25 of 25', { exact: true })).toBeVisible()
  await expect.poll(async () => (await receipts(page)).filter(value => value.kind === 'loadMoreBusinesses').length).toBe(1)
  const businessAction = isBaseline ? page.locator('.driver_orders').first() : page.locator('.od-chat-orders-action').first()
  await businessAction.click()
  await expect.poll(async () => (await lateral(page)).length).toBe(1)
  expect((await lateral(page))[0]).toMatchObject({ businessId: 421, isBusiness: true, open: true, sameReference: true })
})

// redesign tramo B r1 fixes (W1-QB1-02): from 1024px the page is a column as tall as the window and the conversation takes what the header
// leaves, so the text field and the pager are never pushed under the fold by a header taller than main's (calc(100vh - 105px)).
for (const [width, height] of [[1440, 900], [1280, 900], [1024, 900]]) {
  test(`the conversation fills what the header leaves at ${width}x${height}, however tall the header is`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto(fixtureUrl('surface=messages-shell&view=listing&mode=light'))
    const container = page.locator('[data-slot="messages-listing"]')
    await expect(container).toBeVisible()
    const measure = () => container.evaluate(element => {
      const content = element.lastElementChild
      const box = element.getBoundingClientRect()
      const inner = content.getBoundingClientRect()
      const style = getComputedStyle(element)
      return {
        display: style.display,
        direction: style.flexDirection,
        containerHeight: Math.round(box.height),
        // the room the content may take: the container's bottom edge less its bottom padding
        limit: Math.round(box.bottom - parseFloat(style.paddingBottom)),
        contentBottom: Math.round(inner.bottom),
        contentHeight: Math.round(inner.height),
        scrolls: element.scrollHeight - element.clientHeight
      }
    })
    const normal = await measure()
    expect(normal).toMatchObject({ display: 'flex', direction: 'column', containerHeight: height })
    expect(normal.contentBottom).toBeLessThanOrEqual(normal.limit)
    // it fills: the content ends at the limit, not short of it
    expect(normal.limit - normal.contentBottom).toBeLessThanOrEqual(1)
    expect(normal.scrolls).toBe(0)

    // a header 120px taller: the content gives the room back instead of overflowing
    await container.locator('[data-testid="messages-header"]').evaluate(element => { element.style.height = `${element.getBoundingClientRect().height + 120}px` })
    const taller = await measure()
    expect(taller.contentHeight).toBeLessThan(normal.contentHeight)
    expect(taller.contentBottom).toBeLessThanOrEqual(taller.limit)
    expect(taller.limit - taller.contentBottom).toBeLessThanOrEqual(1)
    expect(taller.scrolls).toBe(0)
  })
}

test('below 1024px the page keeps its natural height; on a phone the list is the page and a row opens the conversation over it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 760 })
  await page.goto(fixtureUrl('surface=messages-shell&view=listing&mode=light'))
  const container = page.locator('[data-slot="messages-listing"]')
  await expect(container).toBeVisible()
  expect(await container.evaluate(element => getComputedStyle(element).display)).toBe('block')
  // redesign messages FASE 3 (decision 8A): the old «column-reverse» (chat under the list) is gone; the list comes first and alone,
  // the conversation is a full-screen layer that a tap on a row opens
  const inbox = page.locator('.odi-inbox')
  await expect(inbox).toHaveAttribute('data-phone', '')
  await expect(page.locator('[data-pane="conversation"]')).toHaveCount(0)
  await conversationRows(page).first().click()
  const pane = page.locator('[data-pane="conversation"]')
  await expect(pane).toBeVisible()
  expect(await pane.evaluate(element => { const box = element.getBoundingClientRect(); return { position: getComputedStyle(element).position, x: box.x, y: box.y, width: box.width, height: box.height } }))
    .toEqual({ position: 'fixed', x: 0, y: 0, width: 390, height: 760 })
  // the composer is inside that screen, not under the fold
  const composerBox = await page.locator('.odt-chat-composer').boundingBox()
  expect(composerBox.y + composerBox.height).toBeLessThanOrEqual(760)
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page.locator('[data-pane="conversation"]')).toHaveCount(0)
})

for (const mode of ['light', 'dark']) {
  test(`message shells keep readable ${mode} controls and real keyboard focus`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1100, height: 800 })
    await page.goto(fixtureUrl(`surface=messages-shell&view=listing&mode=${mode}`))
    // redesign messages FASE 3 (decision 3A): the Orders tab (and its underline) is gone; the Active / All SegmentedControl is the control at the
    // top of the list. Active is chosen; the sort menu trigger, a row and the composer are the other controls the page owns.
    await expect(scopeButton(page, 'Active')).toHaveAttribute('aria-pressed', 'true')
    const newest = scopeButton(page, 'Active')
    const orderNumber = scopeButton(page, 'All')
    // redesign W1-6 (T1-6-4): P/SegmentedControl is one tab stop with a roving focus: Tab reaches the first option, ArrowRight the next
    await focusByKeyboard(page, newest)
    for (const target of [newest, orderNumber]) {
      if (target === orderNumber) await page.keyboard.press('ArrowRight')
      await expect(target).toBeFocused()
      const colors = await effectiveColors(target)
      expect.soft(contrast(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5)
      await expect(target).toHaveCSS('outline-color', rgb(tokens.theme[mode].semantic.action.focus))
    }
    // redesign messages FASE 3 (decision 1A): the same contrast and a real focus ring on the sort menu, a conversation row and the composer's field and Send
    const row = conversationRows(page).first()
    const composer = page.locator('.odt-chat-composer')
    await expect(composer).toBeVisible()
    for (const target of [sortTrigger(page), row, composer.getByRole('textbox'), composer.getByRole('button', { name: 'Send', exact: true })]) {
      await target.scrollIntoViewIfNeeded()
      if (await target.isDisabled()) continue
      await focusByKeyboard(page, target)
      const colors = await effectiveColors(target)
      expect.soft(contrast(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5)
      await expect(target).toHaveCSS('outline-color', rgb(tokens.theme[mode].semantic.action.focus))
    }
    await page.screenshot({ path: testInfo.outputPath(`messages-listing-${mode}.png`), fullPage: false })
    for (const view of ['contacts', 'businesses']) {
      await page.goto(fixtureUrl(`surface=messages-shell&view=${view}&state=populated&mode=${mode}`))
      const orders = page.locator('.od-chat-orders-action').nth(1)
      await expect(orders).toBeVisible()
      const colors = await effectiveColors(orders)
      expect.soft(contrast(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5)
      await focusByKeyboard(page, orders)
      await expect(orders).toHaveCSS('outline-color', rgb(tokens.theme[mode].semantic.action.focus))
      await page.screenshot({ path: testInfo.outputPath(`messages-${view}-${mode}.png`), fullPage: false })
    }
  })
}

for (const width of [320, 390]) {
  test.describe(`message shells at ${width}px coarse pointer`, () => {
    test.use({ viewport: { width, height: 760 }, hasTouch: true, isMobile: true })
    test('RTL lists reflow with 44px touch actions and viewport screenshots', async ({ page }, testInfo) => {
      for (const view of ['listing', 'contacts', 'businesses']) {
        await page.goto(fixtureUrl(`surface=messages-shell&view=${view}&state=populated&mode=dark&rtl=true&locale=ar`))
        expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
        const root = view === 'listing' ? page.locator('[data-slot="messages-listing"]') : page.locator(`[data-slot="chat-${view}"]`)
        await expect(root).toBeVisible()
        // redesign messages FASE 3 (decisions 1A, 3A, 8A): the listing's controls are the Active / All options, the sort menu trigger and the rows
        const actions = view === 'listing' ? root.locator('.odc-conv-scope button, .odc-conv-controls > button, .odi-list li button') : root.locator('.od-chat-orders-action:enabled, .od-chat-page-action:enabled, [data-slot="pagination"] button:enabled')
        // redesign tramo B r1 fixes (W1-PB1-06): a loop over nothing passes; the listing has Active, All, the sort trigger and the 10 rows of the first page (13), the others have actions too
        expect(await actions.count(), `${view} has controls to measure`).toBeGreaterThan(0)
        // redesign messages FASE 3 (decision 2A): 13 on the first page (the Pagination is measured with the contact lists' pager below)
        if (view === 'listing') expect(await actions.count()).toBe(13)
        for (const action of await actions.all()) {
          await action.scrollIntoViewIfNeeded()
          const box = await action.boundingBox()
          expect.soft(box.x).toBeGreaterThanOrEqual(0)
          expect.soft(box.x + box.width).toBeLessThanOrEqual(width)
          // redesign messages FASE 3 (decision 12): the sort trigger is a Product Button: 32px drawn with its 44x44 area as a pseudo-element (W0-3d), measured
          // the way every other Button of the app is (e2e/touch-target.js: four corners of the 44x44 area by elementFromPoint). Rows are drawn 44 or more and
          // keep the box measure. redesign deliveries-followups W1-D-25: the Active / All options (P/SegmentedControl) are 32 drawn with the
          // same 44x44 area now, so they are measured like the Button.
          if (await action.evaluate(element => element.classList.contains('odc-btn') || element.classList.contains('odc-seg-btn'))) {
            expect.soft(await touchTargetProblems(action), `${view} ${await action.textContent()}: 44x44 touch area`).toEqual([])
          } else {
            expect.soft(box.width).toBeGreaterThanOrEqual(44)
            expect.soft(box.height).toBeGreaterThanOrEqual(44)
          }
          const hit = await action.evaluate(element => { const box = element.getBoundingClientRect(); const target = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2); return { matches: element.contains(target), label: element.textContent, disabled: element.disabled, box: { x: box.x, y: box.y, width: box.width, height: box.height }, target: target?.outerHTML.slice(0, 400) } })
          // Disabled AutoScroll arrows deliberately allow pointer events through to the underlying action.
          if (!hit.disabled) expect(hit.matches, JSON.stringify(hit)).toBe(true)
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
        if (view === 'listing') {
          // redesign messages FASE 3 (decision 8A): a row opens the full-screen conversation; its Back, View order and composer controls keep the same bar
          await page.screenshot({ path: testInfo.outputPath(`messages-${view}-${width}.png`) })
          await conversationRows(page).first().click()
          const phoneControls = page.locator('.odi-pane').locator('button.odc-btn:not([disabled]):visible, .odt-chat-composer .odt-chat-chip:visible, .odt-chat-composer .odt-chat-input:visible')
          expect(await phoneControls.count(), 'the conversation has controls to measure').toBeGreaterThan(3)
          // the recipient chips are a strip that scrolls sideways by design (activity-tab.css, touch media): the strip, not each chip, stays inside the screen
          for (const container of ['.odt-chat-composer', '.odt-chat-recipients', '.odt-chat-row']) {
            const containerBox = await page.locator(container).boundingBox()
            expect.soft(containerBox.x, `${container} starts inside the screen`).toBeGreaterThanOrEqual(0)
            expect.soft(containerBox.x + containerBox.width, `${container} ends inside the screen`).toBeLessThanOrEqual(width)
          }
          for (const control of await phoneControls.all()) {
            await control.scrollIntoViewIfNeeded()
            const controlBox = await control.boundingBox()
            const isChip = await control.evaluate(element => element.classList.contains('odt-chat-chip'))
            if (!isChip) {
              expect.soft(controlBox.x, await control.textContent()).toBeGreaterThanOrEqual(0)
              expect.soft(controlBox.x + controlBox.width, await control.textContent()).toBeLessThanOrEqual(width)
            }
            expect.soft(await touchTargetProblems(control), `conversation control «${await control.textContent()}» ${await control.getAttribute('class')}`).toEqual([])
          }
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
          await page.screenshot({ path: testInfo.outputPath(`messages-${view}-conversation-${width}.png`) })
          expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
          continue
        }
        await page.screenshot({ path: testInfo.outputPath(`messages-${view}-${width}.png`) })
        expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      }
    })
  })
}

for (const mode of ['light', 'dark']) {
  test(`contact pagination pressed SVG remains readable in ${mode}`, async ({ page }) => {
    await page.goto(fixtureUrl(`surface=messages-shell&view=contacts&state=populated&mode=${mode}`))
    const next = page.getByRole('button', { name: 'Next page', exact: true })
    await page.mouse.move(0, 0)
    await focusByKeyboard(page, next)
    await page.keyboard.down('Space')
    try {
      await expect(next).toHaveJSProperty('disabled', false)
      expect(await next.evaluate(element => element.matches(':active'))).toBe(true)
      const foreground = await next.locator('svg').evaluate(element => getComputedStyle(element).color)
      const { background } = await effectiveColors(next)
      expect(contrast(foreground, background), `${foreground} on ${background}`).toBeGreaterThanOrEqual(3)
    } finally {
      await page.keyboard.up('Space')
    }
  })
}
