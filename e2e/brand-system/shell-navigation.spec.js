// redesign 5.1 copy: labels in sentence case (C14), approved with the catalog sync on 2026-10-06.
import { test, expect, fixtureUrl } from './fixtures'
import translations from '../../i18n/translations.json'
import { tokens } from '../../src/brand/ordering.tokens.generated'
import { expectTouchTarget } from '../touch-target'

const url = ({ role = 0, path = '/orders', readOnly, extra = '' } = {}) => fixtureUrl(`surface=shell-navigation&mode=light&role=${role}&path=${encodeURIComponent(path)}${readOnly ? `&readonly=${readOnly}` : ''}${extra}`)
const sidebar = page => page.locator('#side_bar')
const topMenuPattern = /^(My website|Home|Orders|Delivery|Stores|Schools|Connect|Users|Marketing|Reports|My products)$/
const topControls = page => sidebar(page).getByRole('button').or(sidebar(page).getByRole('link')).filter({ hasText: topMenuPattern })
const controlTexts = async locator => (await locator.allInnerTexts()).map(value => value.replace(/\s+/g, ' ').trim()).filter(Boolean)
const emitted = page => page.evaluate(() => globalThis.__OD_SHELL_EVENTS__ || [])
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
// redesign 5.1: the section that contains the current route starts open (getCurrentSectionKey), so a click would close it. Open a disclosure only if it is closed.
const openSection = async button => {
  if (await button.getAttribute('aria-expanded') !== 'true') await button.click()
  await expect(button).toHaveAttribute('aria-expanded', 'true')
}
// redesign 5.1: the footer is one account row (#user_info); profile, language, help and Logout live in its popup (a portal outside the nav).
const accountTrigger = page => sidebar(page).locator('#user_info').getByRole('button', { name: /^Account: /u })
const accountPopup = page => page.locator('[data-slot="sidebar-account-popup"]')
const openAccount = async page => {
  await accountTrigger(page).click()
  await expect(accountPopup(page)).toBeVisible()
  return accountPopup(page)
}
const focusByKeyboard = async (page, target) => {
  for (let index = 0; index < 100 && !await target.evaluate(element => element === document.activeElement); index += 1) await page.keyboard.press('Tab')
  await expect(target).toBeFocused()
}

test('administrator navigation preserves exact route order, hrefs, active route and go_to_page payloads with modifiers', async ({ page }) => {
  await page.goto(url())
  await expect(topControls(page)).toHaveCount(11)
  expect(await controlTexts(topControls(page))).toEqual([
    // redesign 5.1: the flat list is now four labelled groups (getSidebarGroups), the order kept inside each; Schools now sits in Operate, My addons stays folded into My products.
    'Home', 'Orders', 'Delivery', 'Schools', 'Stores', 'My products', 'My website', 'Marketing', 'Users', 'Reports', 'Connect'
  ])
  // redesign 5.1: the same entries, now asserted by group: Operate, Catalog, Grow, Platform.
  for (const [group, entries] of Object.entries({
    Operate: ['Home', 'Orders', 'Delivery', 'Schools'],
    Catalog: ['Stores', 'My products', 'My website'],
    Grow: ['Marketing', 'Users', 'Reports'],
    Platform: ['Connect']
  })) expect(await controlTexts(sidebar(page).getByRole('group', { name: group, exact: true }).getByRole('button').or(sidebar(page).getByRole('group', { name: group, exact: true }).getByRole('link')).filter({ hasText: topMenuPattern }))).toEqual(entries)
  await expect(sidebar(page).getByRole('link', { name: 'Home', exact: true })).toHaveAttribute('href', '/home')
  await expect(sidebar(page).getByRole('link', { name: 'Schools', exact: true })).toHaveAttribute('href', '/schools')

  await openSection(sidebar(page).getByRole('button', { name: 'Orders', exact: true }))
  const orderLinks = sidebar(page).locator('a').filter({ hasText: /Orders list|Open carts|Messages|Gift card manager/ })
  expect(await controlTexts(orderLinks)).toEqual(['Orders list', 'Open carts', 'Messages', 'Gift card manager'])
  await expect(sidebar(page).getByRole('link', { name: 'Orders list', exact: true })).toHaveAttribute('href', '/orders')
  await sidebar(page).getByRole('link', { name: 'Orders list', exact: true }).click({ modifiers: ['Meta'] })
  await expect.poll(() => emitted(page)).toEqual([{ name: 'go_to_page', payload: { page: 'orders' } }])

  await openSection(sidebar(page).getByRole('button', { name: 'My products', exact: true }))
  // The app title keeps its own casing, as the old menu rendered `item.title` raw: SidebarMenu.jsx runs firstLetterCapital only over the Orders, Delivery, Marketing, Reports and Logs audit children, never over My products.
  await expect(sidebar(page).getByRole('link', { name: 'Fixture Builder Application', exact: true })).toHaveCount(1)
  const product = sidebar(page).locator('a[href="/my-products?id=701"]')
  await expect(product).toHaveAttribute('href', '/my-products?id=701')
  await product.click({ modifiers: ['Shift'] })
  await expect.poll(() => emitted(page)).toEqual([
    { name: 'go_to_page', payload: { page: 'orders' } },
    { name: 'go_to_page', payload: { page: 'products', state: { productId: 701, type: 'app' } } }
  ])
})

test('roles 2, 5, 8 and read-only admin preserve their exact top-level gates and restricted Connect submenu', async ({ page }) => {
  // redesign 5.1: same gates, now listed in group order (Operate, Catalog, Grow, Platform) instead of the flat order.
  const cases = [
    { role: 2, expected: ['Home', 'Orders', 'Schools', 'Stores', 'Reports', 'Connect'] },
    { role: 5, expected: ['Orders', 'Delivery'] },
    { role: 8, expected: [] },
    { role: 0, readOnly: 'admin', expected: ['Orders', 'Delivery', 'My website'] }
  ]
  for (const item of cases) {
    await page.goto(url(item))
    await expect(topControls(page)).toHaveCount(item.expected.length)
    expect(await controlTexts(topControls(page))).toEqual(item.expected)
    if (item.role === 2) {
      await openSection(sidebar(page).getByRole('button', { name: 'Connect', exact: true }))
      // The locator is case-insensitive so a casing change would still find the one link; the exact text stays strict: Connect children render raw ("POS & menu sync"), as the old menu did, because SidebarMenu.jsx does not run firstLetterCapital over them.
      const links = sidebar(page).locator('a').filter({ hasText: /Overview|Delivery services|POS & menu sync|Importers|Sales channels/i })
      expect(await controlTexts(links)).toEqual(['POS & menu sync'])
      await expect(links).toHaveAttribute('href', '/connect/pos-menu')
    }
  }
})

test('Layout keeps padding and shared collapse state while desktop collapse is callback-only', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(url({ path: '/home' }))
  const layout = page.getByTestId('shell-navigation-fixture').locator(':scope > div')
  await expect(layout).toHaveCSS('padding-top', '6px')
  await expect(page.getByTestId('shell-collapse-state')).toHaveText('false')
  // redesign 5.1: at >=1024px the header button is "Collapse sidebar" and calls handleMenuRail(true) (the icon rail), not handleMenuCollapse. The fixture's InfoShare provider has no handleMenuRail, so only "the shared collapse state is untouched" is observable here; the handleMenuRail(true) call is pinned in ShellNavigation.test.jsx.
  await expect(sidebar(page).getByRole('button', { name: 'Close', exact: true })).toHaveCount(0)
  await sidebar(page).getByRole('button', { name: 'Collapse sidebar', exact: true }).click()
  await expect(page.getByTestId('shell-collapse-state')).toHaveText('false')
  await expect(page.getByTestId('shell-collapse-calls')).toHaveText('[]')
  await expect(sidebar(page)).not.toHaveAttribute('data-collapsed')
})

test('Layout keeps shared collapse state while Close below 1024px is the callback', async ({ page }) => {
  // redesign 5.1: below 1024px there is no rail, so the header button stays "Close" and calls handleMenuCollapse(true): this is the old desktop-close assertion, at 800px.
  await page.setViewportSize({ width: 800, height: 800 })
  await page.goto(url({ path: '/home' }))
  await expect(page.getByTestId('shell-collapse-state')).toHaveText('true') // auto-collapse below 1024px
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
  await expect(page.getByTestId('shell-collapse-state')).toHaveText('false')
  await sidebar(page).getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByTestId('shell-collapse-state')).toHaveText('true')
  await expect(page.getByTestId('shell-collapse-calls')).toHaveText('[true,false,true]')
})

test('language selector preserves many, one and zero branches with callback arguments, and logout forwards once', async ({ page }) => {
  await page.goto(fixtureUrl('surface=shell-navigation&case=controls&mode=light'))
  const many = page.getByTestId('languages-many')
  const trigger = many.locator('[role="button"][aria-haspopup="listbox"]')
  await expect(trigger).toBeVisible()
  await trigger.click()
  await page.getByRole('option', { name: 'Spanish', exact: true }).click()
  await expect(page.getByTestId('language-calls')).toHaveText('[["es",true]]')
  await expect(page.getByTestId('languages-one')).toContainText('Spanish')
  await expect(page.getByTestId('languages-one').locator('[aria-haspopup="listbox"]')).toHaveCount(0)
  await expect(page.getByTestId('languages-zero').locator('[aria-haspopup="listbox"], svg')).toHaveCount(0)
  await page.getByTestId('logout-control').getByRole('button', { name: 'Log out', exact: true }).click()
  await expect(page.getByTestId('logout-calls')).toHaveText('1')
  expect(await page.evaluate(() => globalThis.__OD_SHELL_LOGOUTS__)).toBe(1)
})

for (const mode of ['light', 'dark']) {
  test(`shell navigation keeps readable ${mode} active links and real keyboard focus`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 820 })
    await page.goto(fixtureUrl(`surface=shell-navigation&mode=${mode}&role=0&path=${encodeURIComponent('/orders')}`))
    const nav = page.getByRole('navigation', { name: 'Menu', exact: true })
    const home = nav.getByRole('link', { name: 'Home', exact: true })
    // redesign 5.1: at 1280px the header button is "Collapse sidebar" (rail), not "Close"; `close` keeps its role in this test as the header button.
    const close = nav.getByRole('button', { name: 'Collapse sidebar', exact: true })
    const orders = nav.getByRole('button', { name: 'Orders', exact: true })
    await expect(nav).toBeVisible()
    await expect(topControls(page)).toHaveCount(11)
    const navIconPositions = []
    // redesign 5.1: a section row carries two svg (icon + chevron); the entry icon is the first.
    for (const item of [home, orders, nav.getByRole('button', { name: 'Delivery', exact: true }), nav.getByRole('button', { name: 'Stores', exact: true })]) navIconPositions.push((await item.locator('svg').first().boundingBox()).x)
    expect(Math.max(...navIconPositions) - Math.min(...navIconPositions)).toBeLessThanOrEqual(1)
    for (const target of [home, close, orders]) {
      await expect.poll(async () => {
        const colors = await effectiveColors(target)
        return contrast(colors.foreground, colors.background)
      }, { message: `Contrast: ${await target.getAttribute('aria-label') || await target.innerText()}` }).toBeGreaterThanOrEqual(4.5)
    }
    await expect(close.locator('svg')).toHaveAttribute('fill', 'none')
    await expect(close.locator('svg')).toHaveAttribute('stroke', 'currentColor')
    const iconColors = await effectiveColors(close.locator('svg'))
    expect.soft(contrast(iconColors.foreground, iconColors.background)).toBeGreaterThanOrEqual(3)
    await page.evaluate(() => document.activeElement?.blur())
    for (const target of [home, close]) {
      await focusByKeyboard(page, target)
      await expect(target).toHaveCSS('outline-color', rgb(tokens.theme[mode].semantic.action.focus))
    }
    await focusByKeyboard(page, orders)
    // redesign 5.1: /orders opens its own section, so Enter closes it and a second Enter opens it again; the keyboard still drives the disclosure.
    await expect(orders).toHaveAttribute('aria-expanded', 'true')
    await page.keyboard.press('Enter')
    await expect(orders).toHaveAttribute('aria-expanded', 'false')
    await page.keyboard.press('Enter')
    await expect(orders).toHaveAttribute('aria-expanded', 'true')
    const current = nav.getByRole('link', { name: 'Orders list', exact: true })
    // redesign 5.1: the old `data-active` marker is gone; `aria-current="page"` is the one active state (the parent section never carries it).
    await expect(current).toBeVisible()
    await expect(orders).not.toHaveAttribute('aria-current', /.*/)
    await expect(current).toHaveAttribute('aria-current', 'page')
    await expect(current).toHaveAttribute('href', '/orders')
    await page.screenshot({ path: testInfo.outputPath(`shell-navigation-${mode}.png`), fullPage: false })
  })
}

for (const width of [320, 390]) {
  test.describe(`shell navigation at ${width}px coarse pointer`, () => {
    test.use({ viewport: { width, height: 760 }, hasTouch: true, isMobile: true })
    test('RTL shared collapse opens, routes and closes with 44px non-overlapping actions', async ({ page }, testInfo) => {
      await page.goto(fixtureUrl(`surface=shell-navigation&mode=dark&rtl=true&locale=ar&role=0&path=${encodeURIComponent('/orders')}`))
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      await expect(page.getByTestId('shell-collapse-state')).toHaveText('true')
      await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
      await expect(page.getByTestId('shell-collapse-state')).toHaveText('false')
      const nav = page.getByRole('navigation', { name: translations.MENU?.ar || 'Menu', exact: true })
      await expect.poll(async () => {
        const rect = await nav.boundingBox()
        return rect.x >= -0.5 && rect.x + rect.width <= width + 0.5
      }).toBe(true)
      await page.screenshot({ path: testInfo.outputPath(`shell-navigation-${width}-before.png`) })
      const close = nav.getByRole('button', { name: translations.CLOSE?.ar || 'Close', exact: true })
      const orders = nav.getByRole('button', { name: translations.ORDERS?.ar || 'Orders', exact: true })
      await expect(orders).toBeVisible()
      for (const target of [close, orders]) {
        const box = await target.boundingBox()
        expect.soft(box.x).toBeGreaterThanOrEqual(0)
        expect.soft(box.x + box.width).toBeLessThanOrEqual(width)
      }
      // redesign W0 T0-45 (W0-E-08, decision 12): 32px visible with the 44×44 area (the corners at ±21px answer to the control), not 44 drawn.
      for (const [label, target] of [['close', close], ['orders', orders]]) await expectTouchTarget(target, { label: `shell navigation ${label} at ${width}px` })
      // redesign 5.1: /orders opens its own section, so open it only if it is closed.
      await openSection(orders)
      const orderLink = nav.getByRole('link', { name: translations.ORDERS_LIST?.ar || 'Orders list', exact: true })
      await expect(orderLink).toBeVisible()
      const linkBox = await orderLink.boundingBox()
      expect(linkBox.height).toBeGreaterThanOrEqual(44)
      await page.touchscreen.tap(linkBox.x + linkBox.width / 2, linkBox.y + linkBox.height / 2)
      await expect.poll(() => emitted(page)).toEqual([{ name: 'go_to_page', payload: { page: 'orders' } }])
      await expect(page.getByTestId('shell-collapse-state')).toHaveText('true')
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      await page.screenshot({ path: testInfo.outputPath(`shell-navigation-${width}-after.png`) })
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
    })
  })
}

test('closing navigation restores the opener and removes hidden descendants from tab navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 760 })
  await page.goto(url())
  const opener = page.getByRole('button', { name: 'Open navigation', exact: true })
  await expect(page.getByTestId('shell-collapse-state')).toHaveText('true')
  await opener.click()
  await sidebar(page).getByRole('button', { name: 'Close', exact: true }).click()
  await expect(opener).toBeFocused()
  await page.keyboard.press('Tab')
  expect(await sidebar(page).evaluate(element => element.contains(document.activeElement))).toBe(false)
})

test('short-height navigation keeps the account row and its logout reachable by native scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 320 })
  await page.goto(url())
  const nav = sidebar(page)
  await expect(nav).toBeVisible()
  const box = await nav.boundingBox()
  await page.mouse.move(box.x + box.width / 2, 180)
  await page.mouse.wheel(0, 2000)
  const reachable = element => {
    const rect = element.getBoundingClientRect()
    return rect.y >= 0 && rect.bottom <= innerHeight && element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2))
  }
  // redesign 5.1: the footer is one account row; Logout lives in its popup. Same reach predicate, applied to the row and then to Logout once the popup is open.
  await expect.poll(() => accountTrigger(page).evaluate(reachable)).toBe(true)
  const popup = await openAccount(page)
  const logout = popup.getByRole('button', { name: 'Log out', exact: true })
  await page.mouse.move(box.x + box.width + 40, 160)
  await page.mouse.wheel(0, 2000)
  await expect.poll(() => logout.evaluate(reachable)).toBe(true)
})

test('logo is the Home button and keeps its natural proportions at the sidebar logo height', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 820 })
  await page.goto(url())
  // redesign 5.1: the logo is `button.odc-sidebar-logo` named Home (no longer inside the shared icon-button adapter) and is drawn at --od-x-logo-height (22px), not at ~25px: its width is ~121px, so the old 140px minimum becomes the brand's 120px digital minimum for the full lockup (identity.md).
  const button = sidebar(page).locator('button.odc-sidebar-logo')
  await expect(button).toHaveAccessibleName('Home')
  const logo = button.locator('img')
  await expect(logo).toBeVisible()
  const box = await logo.boundingBox()
  const natural = await logo.evaluate(element => ({ ratio: element.naturalWidth / element.naturalHeight, height: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--od-x-logo-height')) }))
  expect(box.height).toBeCloseTo(natural.height, 0)
  expect(box.width / box.height).toBeCloseTo(natural.ratio, 1)
  expect(box.width).toBeGreaterThanOrEqual(120)
})

test('selecting Home closes only the open section in its own navigation root', async ({ page }) => {
  await page.goto(url())
  const nav = sidebar(page)
  await nav.getByRole('button', { name: 'Logs audit', exact: true }).click()
  const auditLink = nav.locator('a[href="/settings/logs"]')
  await expect(auditLink).toBeVisible()
  // redesign 5.1: /orders opens its own section, so open it only if it is closed.
  await openSection(nav.getByRole('button', { name: 'Orders', exact: true }))
  const orderLink = nav.locator('a[href="/orders"]')
  await expect(orderLink).toBeVisible()
  await nav.locator('a[href="/home"]').filter({ hasText: 'Home' }).click()
  await expect(orderLink).toBeHidden()
  await expect(auditLink).toBeVisible()
  await expect.poll(() => emitted(page)).toEqual([{ name: 'go_to_page', payload: { page: 'home' } }])
})

test('language popup remains usable inside the real sidebar account menu', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto(url())
  // redesign 5.1: the language selector moved from the sidebar footer into the account menu popup.
  const popup = await openAccount(page)
  // redesign fix-qa E8: the account's language is a single-choice menu (it was a legacy listbox that opened over the popup's header).
  const trigger = popup.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'English', exact: true })
  await expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
  expect(await page.locator('[aria-haspopup="listbox"]').count(), 'no legacy select').toBe(0)
  await trigger.click()
  const list = page.locator('[data-field-menu]')
  await expect(list).toBeVisible()
  // Beside the popover, never over it (its header stays readable), and inside the viewport with every language reachable.
  const boxes = await page.evaluate(() => {
    const rect = selector => { const { left, right, top, bottom } = document.querySelector(selector).getBoundingClientRect(); return { left, right, top, bottom } }
    return { popup: rect('[data-slot="sidebar-account-popup"]'), head: rect('.odc-account-head'), list: rect('[data-field-menu]'), height: innerHeight, width: innerWidth }
  })
  const apart = (a, b) => a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top
  expect(apart(boxes.list, boxes.popup), 'the list is beside the popover').toBe(true)
  expect(apart(boxes.list, boxes.head)).toBe(true)
  expect(boxes.list.top).toBeGreaterThanOrEqual(0)
  expect(boxes.list.bottom).toBeLessThanOrEqual(boxes.height)
  expect(boxes.list.right).toBeLessThanOrEqual(boxes.width)
  const option = page.getByRole('menuitemradio', { name: 'Spanish', exact: true })
  await option.click()
  expect(await page.evaluate(() => globalThis.__OD_SHELL_LANGUAGE_CHANGES__)).toEqual([['es', true]])
})

test('desktop sidebar stays pinned while real page content scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 820 })
  await page.goto(url({ extra: '&pt=0' }))
  const nav = sidebar(page)
  await expect(nav).toBeVisible()
  await page.locator('.shell-navigation-content').evaluate(element => { element.style.height = '2200px' })
  await page.mouse.move(800, 500)
  await page.mouse.wheel(0, 650)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await expect(nav).toHaveCSS('position', 'sticky')
  await expect(nav).toHaveCSS('align-self', 'flex-start')
  // redesign 5.1: the horizontal clip moved from the nav root to the navigation scroll zone (nav root and panel no longer scroll).
  await expect(nav.getByTestId('sidebar-scroll-content')).toHaveCSS('overflow-x', 'hidden')
  await expect.poll(async () => Math.abs((await nav.boundingBox()).y)).toBeLessThanOrEqual(1)
})

test('desktop footer stays visible while the navigation section scrolls independently', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 820 })
  await page.goto(url({ extra: '&pt=0' }))
  const nav = sidebar(page)
  // redesign 5.1: the scroll zone is `sidebar-scroll-content` (was `.od-shell-content`) and the footer is the account row (Logout moved into its popup).
  const content = nav.getByTestId('sidebar-scroll-content')
  const footer = accountTrigger(page)
  await expect(footer).toBeVisible()
  const before = await footer.boundingBox()
  const box = await content.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(0, 1000)
  await expect.poll(() => content.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
  const after = await footer.boundingBox()
  expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1)
  expect(after.y + after.height).toBeLessThanOrEqual(820)
  expect(await footer.evaluate(element => {
    const rect = element.getBoundingClientRect()
    return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2))
  })).toBe(true)
})
