import { test, expect, fixtureUrl } from './fixtures'

const readJson = async locator => JSON.parse(await locator.textContent())
const colorTrigger = scope => scope.locator(':scope > div').first().locator(':scope > *').first()
const colorPicker = scope => scope.locator('.ordering-color-picker')
const columnTrigger = scope => scope.locator('button').first()
const dayButton = (scope, day) => scope
  .locator('button.rdrDay:not(.rdrDayPassive):not(.rdrDayDisabled)')
  .filter({ hasText: new RegExp(`^${day}$`) })

test('ColorPicker preserves debounced last-value callbacks and default prop resync', async ({ page }) => {
  await page.goto(fixtureUrl('surface=floating-selectors&mode=light&fixtureUserLevel=0'))
  const scope = page.getByTestId('color-picker-control')
  const output = page.getByTestId('color-picker-events')

  await colorTrigger(scope).click()
  const picker = colorPicker(scope)
  await expect(picker).toBeVisible()
  const hex = picker.getByLabel('hex', { exact: true })
  await hex.fill('AA0000')
  await page.waitForTimeout(400)
  await hex.fill('00AA00')
  await page.waitForTimeout(500)
  expect((await readJson(output)).events).toEqual([])
  await expect.poll(async () => (await readJson(output)).events).toEqual(['#00aa00'])

  await page.getByTestId('floating-outside-target').click()
  await expect(picker).not.toBeVisible()
  await page.getByRole('button', { name: 'Resync color default', exact: true }).click()
  await colorTrigger(scope).click()
  await expect(colorPicker(scope).getByLabel('hex', { exact: true })).toHaveValue('663399')
  expect(await readJson(output)).toEqual({ defaultColor: '#663399', isDisabled: false, events: ['#00aa00'] })
})

// redesign bugs F row 43 (M-14): the quirk is gone by design. A truthy isDisabled used to toggle the picker (it opened it on
// mount and on every other change); now disabling closes it and never opens it by itself.
test('ColorPicker closes when it is disabled and never opens by itself', async ({ page }) => {
  await page.goto(fixtureUrl('surface=floating-selectors&mode=light&fixtureUserLevel=0'))
  const scope = page.getByTestId('color-picker-control')
  const toggle = page.getByRole('button', { name: 'Toggle color disabled', exact: true })

  await toggle.click()
  await expect(colorPicker(scope)).not.toBeVisible()
  expect((await readJson(page.getByTestId('color-picker-events'))).isDisabled).toBe(true)

  await toggle.click()
  await expect(colorPicker(scope)).not.toBeVisible()
  expect((await readJson(page.getByTestId('color-picker-events'))).isDisabled).toBe(false)

  await colorTrigger(scope).click()
  await expect(colorPicker(scope)).toBeVisible()
  await toggle.click()
  await expect(colorPicker(scope)).not.toBeVisible()
  expect((await readJson(page.getByTestId('color-picker-events'))).isDisabled).toBe(true)
})

test('ColumnAllowSettingPopover keeps flat and nested visable maps with one scalar callback per row', async ({ page }) => {
  await page.goto(fixtureUrl('surface=floating-selectors&mode=light&fixtureUserLevel=0'))
  const flat = page.getByTestId('flat-columns')
  const order = page.getByTestId('order-columns')
  const output = page.getByTestId('column-popover-events')

  await columnTrigger(flat).click()
  await expect(flat.getByText('Flat columns', { exact: true })).toBeVisible()
  await flat.getByText('Email column', { exact: true }).click()
  let state = await readJson(output)
  expect(state.flatColumns).toEqual({ name: true, email: true })
  expect(state.events).toEqual([{ kind: 'flat', value: 'email' }])

  await columnTrigger(order).click()
  await expect(order.getByText('Order columns', { exact: true })).toBeVisible()
  await order.getByText('Name column', { exact: true }).click()
  state = await readJson(output)
  expect(state.orderColumns).toEqual({
    name: { visable: false, width: 180 },
    email: { visable: false, width: 240 }
  })
  expect(state.events).toEqual([
    { kind: 'flat', value: 'email' },
    { kind: 'order', value: 'name' }
  ])
})

test('ColumnAllowSettingPopover closes on outside mouseup and Escape while ignoring controlled-looking props', async ({ page }) => {
  await page.goto(fixtureUrl('surface=floating-selectors&mode=dark&fixtureUserLevel=0'))
  const flat = page.getByTestId('flat-columns')
  const title = flat.getByText('Flat columns', { exact: true })
  const controlled = page.getByRole('button', { name: 'Toggle ignored controlled open', exact: true })

  await controlled.click()
  await expect(title).not.toBeVisible()
  expect((await readJson(page.getByTestId('column-popover-events'))).controlledOpen).toBe(true)

  await columnTrigger(flat).click()
  await expect(title).toBeVisible()
  await controlled.click()
  await expect(title).toBeVisible()
  expect((await readJson(page.getByTestId('column-popover-events'))).controlledOpen).toBe(false)

  await page.getByTestId('floating-outside-target').dispatchEvent('mouseup')
  await expect(title).not.toBeVisible()
  await columnTrigger(flat).click()
  await expect(title).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(title).not.toBeVisible()
  expect((await readJson(page.getByTestId('column-popover-events'))).events).toEqual([])
})

// redesign audit-4: Learn is a menu of links (Product Menu, portaled): `menu` / `menuitem`, not a listbox.
test('LearnDropDown keeps its level-zero nonempty gate and repeated noSelected behavior', async ({ page }) => {
  await page.goto(fixtureUrl('surface=floating-selectors&mode=light&fixtureUserLevel=0'))
  const learn = page.getByTestId('learn-menu-control')
  const trigger = learn.getByRole('button', { name: 'Learn', exact: true })
  await expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
  await expect(page.getByTestId('empty-learn-menu')).toBeEmpty()

  for (let count = 1; count <= 2; count += 1) {
    await trigger.press('Enter')
    await page.getByRole('menuitem', { name: 'Launch guide', exact: true }).press('Enter')
    await expect(trigger).toContainText('Learn')
    await expect.poll(async () => (await readJson(page.getByTestId('learn-menu-events'))).openCalls.length).toBe(count)
  }
  expect((await readJson(page.getByTestId('learn-menu-events'))).openCalls).toEqual([
    { url: 'https://help.ordering.co/launch', target: '_blank' },
    { url: 'https://help.ordering.co/launch', target: '_blank' }
  ])

  await page.goto(fixtureUrl('surface=floating-selectors&mode=light&fixtureUserLevel=2'))
  await expect(page.getByTestId('learn-menu-control')).toBeEmpty()
})

test('LearnDropDown freezes mount labels while selection looks up the current URL', async ({ page }) => {
  await page.goto(fixtureUrl('surface=floating-selectors&mode=light&fixtureUserLevel=0'))
  await page.getByRole('button', { name: 'Update learn option props', exact: true }).click()
  const learn = page.getByTestId('learn-menu-control')
  const trigger = learn.getByRole('button', { name: 'Learn', exact: true })
  await trigger.click()
  await expect(page.getByRole('menuitem', { name: 'Launch guide', exact: true })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Updated launch guide', exact: true })).toHaveCount(0)
  await page.getByRole('menuitem', { name: 'Launch guide', exact: true }).click()

  const state = await readJson(page.getByTestId('learn-menu-events'))
  expect(state.options[0]).toEqual({
    value: 'launch',
    name: 'Updated launch guide',
    url: 'https://help.ordering.co/launch-updated'
  })
  expect(state.openCalls).toEqual([{ url: 'https://help.ordering.co/launch-updated', target: '_blank' }])
})

test('RangeCalendar uses its real widgets, min/default dates, callback arity and form-safe triggers', async ({ page }) => {
  await page.goto(fixtureUrl('surface=floating-selectors&mode=light&fixtureUserLevel=0'))
  const single = page.getByTestId('single-calendar')
  const timed = page.getByTestId('timed-calendar')
  const range = page.getByTestId('range-calendar')
  const output = page.getByTestId('range-calendar-events')

  await expect(single.getByRole('button', { name: '15 Jun, 2024', exact: true })).toBeVisible()
  await expect(timed.getByRole('button', { name: '16 Jun, 2024', exact: true })).toBeVisible()
  await expect(range.getByRole('button', { name: '10 - 12 Jun, 2024', exact: true })).toBeVisible()

  await single.getByRole('button', { name: '15 Jun, 2024', exact: true }).click()
  await expect(single.locator('.rdrCalendarWrapper')).toBeVisible()
  await expect(single.locator('button.rdrDayDisabled').filter({ hasText: /^9$/ })).toHaveCount(1)
  await expect(dayButton(single, 10)).toHaveCount(1)
  await dayButton(single, 18).click()
  await expect.poll(async () => (await readJson(output)).events[0]).toEqual({ kind: 'single', args: ['2024-06-18'] })

  await timed.getByRole('button', { name: '16 Jun, 2024', exact: true }).click()
  await dayButton(timed, 19).click()
  await expect.poll(async () => (await readJson(output)).events[1]).toEqual({ kind: 'timed', args: ['2024-06-19 00:00:00'] })

  await range.getByRole('button', { name: '10 - 12 Jun, 2024', exact: true }).click()
  await expect(range.locator('.rdrDateRangeWrapper')).toBeVisible()
  await dayButton(range, 18).click()
  await expect.poll(async () => (await readJson(output)).events[2]).toEqual({ kind: 'range', args: ['2024-06-18', '2024-06-18'] })
  expect((await readJson(output)).submissions).toBe(0)
})

test('RangeCalendar resyncs single and range defaults without emitting callbacks', async ({ page }) => {
  await page.goto(fixtureUrl('surface=floating-selectors&mode=dark&fixtureUserLevel=0'))
  await page.getByRole('button', { name: 'Resync single default', exact: true }).click()
  await page.getByRole('button', { name: 'Resync range default', exact: true }).click()
  await expect(page.getByTestId('single-calendar').getByRole('button', { name: '20 Jul, 2024', exact: true })).toBeVisible()
  await expect(page.getByTestId('range-calendar').getByRole('button', { name: '21 - 23 Jul, 2024', exact: true })).toBeVisible()
  expect(await readJson(page.getByTestId('range-calendar-events'))).toEqual({ events: [], submissions: 0 })
})

for (const { label, rtl, scrollX } of [
  { label: 'positive LTR', rtl: false, scrollX: 100 },
  { label: 'negative RTL', rtl: true, scrollX: -100 }
]) {
  test(`RangeCalendar stays in the viewport during native ${label} page scroll`, async ({ page }) => {
    const viewportWidth = 390
    await page.setViewportSize({ width: viewportWidth, height: 800 })
    await page.goto(fixtureUrl(`surface=floating-selectors&mode=light&rtl=${rtl}&fixtureUserLevel=0`))
    const scope = page.getByTestId('single-calendar')
    await scope.evaluate((element, value) => {
      document.body.style.minWidth = '1200px'
      Object.assign(element.style, { position: 'fixed', right: '16px', top: '80px', width: '44px', zIndex: '1002' })
      window.scrollTo(value, 0)
    }, scrollX)
    await expect.poll(() => page.evaluate(() => window.scrollX)).toBe(scrollX)
    await scope.locator(':scope > [data-slot="range-calendar"] > button').click()
    const dialog = scope.locator('[data-slot="range-calendar"] > [role="dialog"]')
    await expect(dialog).toBeVisible()
    const bounds = await dialog.boundingBox()
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewportWidth)
    expect(await page.evaluate(() => window.scrollX)).toBe(scrollX)
  })
}

for (const mode of ['light', 'dark']) {
  test(`C4 target: floating selectors expose names, keyboard dismissal, focus and 44px actions in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(fixtureUrl(`surface=floating-selectors&mode=${mode}&fixtureUserLevel=0`))
    const colorScope = page.getByTestId('color-picker-control')
    const color = colorScope.getByRole('button', { name: /colou?r/i })
    const columnsScope = page.getByTestId('flat-columns')
    const columns = columnsScope.getByRole('button', { name: /column/i })
    const learnScope = page.getByTestId('learn-menu-control')
    const learn = learnScope.getByRole('button', { name: /learn/i })
    const calendarScope = page.getByTestId('single-calendar')
    const calendar = calendarScope.getByRole('button', { name: /date|jun/i }).first()

    for (const control of [color, columns, learn, calendar]) {
      await expect(control).toBeVisible()
      const box = await control.boundingBox()
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
      await control.focus()
      await page.keyboard.press('Tab')
      await page.keyboard.press('Shift+Tab')
      await expect(control).toBeFocused()
      expect(parseFloat(await control.evaluate(element => getComputedStyle(element).outlineWidth))).toBeGreaterThanOrEqual(2)
    }

    await color.press('Enter')
    await expect(colorPicker(colorScope)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(colorPicker(colorScope)).not.toBeVisible()
    await expect(color).toBeFocused()

    await columns.press('Enter')
    await expect(columnsScope.getByText('Flat columns', { exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(columnsScope.getByText('Flat columns', { exact: true })).not.toBeVisible()
    await expect(columns).toBeFocused()

    // redesign audit-4: the menu is portaled, so it is looked up in the page.
    await learn.press('Enter')
    await expect(page.getByRole('menu')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).not.toBeVisible()
    await expect(learn).toBeFocused()

    await calendar.press('Enter')
    await expect(calendarScope.locator('.rdrCalendarWrapper')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(calendarScope.locator('.rdrCalendarWrapper')).not.toBeVisible()
    await expect(calendar).toBeFocused()

    await page.screenshot({ path: testInfo.outputPath(`floating-selectors-${mode}.png`), fullPage: true })
  })

  test(`C4 target: picker Escape stays inside real Modal and SideBar in ${mode}`, async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 })
    await page.goto(fixtureUrl(`surface=floating-selectors&mode=${mode}&fixtureUserLevel=0`))

    await page.getByRole('button', { name: 'Open picker modal', exact: true }).click()
    const modal = page.getByRole('dialog', { name: 'Color picker modal', exact: true })
    const modalScope = modal.getByTestId('modal-color-picker')
    const modalColor = colorTrigger(modalScope)
    await modalColor.click()
    await expect(colorPicker(modalScope)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(colorPicker(modalScope)).not.toBeVisible()
    await expect(modal).toBeVisible()
    expect((await readJson(page.getByTestId('floating-layer-events'))).events).toEqual([])

    await modal.getByRole('button', { name: 'Close', exact: true }).click()
    await page.getByRole('button', { name: 'Open picker sidebar', exact: true }).click()
    const sidebar = page.locator('#floating-picker-sidebar')
    await expect(sidebar).toHaveCSS('width', '500px')
    const sidebarScope = sidebar.getByTestId('sidebar-color-picker')
    const sidebarColor = colorTrigger(sidebarScope)
    await sidebarColor.click()
    await expect(colorPicker(sidebarScope)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(colorPicker(sidebarScope)).not.toBeVisible()
    await expect(sidebar).toHaveCount(1)
    expect((await readJson(page.getByTestId('floating-layer-events'))).events).toEqual(['modal-close'])
  })
}
