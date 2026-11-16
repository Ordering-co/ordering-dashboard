import { test, expect, fixtureUrl } from './fixtures'
import { tokens } from '../../src/brand/ordering.tokens.generated'
import localeConfig from '../../i18n/config.json'
import translations from '../../i18n/translations.json'

const sheet = (page, name) => page.getByTestId(`sheet-${name}`)
const cellWithText = (scope, text) => scope.locator('.ht_master td').filter({ hasText: text }).first()
const editor = scope => scope.locator('textarea.handsontableInput:focus')
const events = async page => JSON.parse(await page.getByTestId('spreadsheet-events').textContent())
const clearEvents = page => page.getByRole('button', { name: 'Clear receipts', exact: true }).click()
const openMenu = async (scope, text) => {
  await cellWithText(scope, text).click({ button: 'right' })
  return scope.page().locator('.htContextMenu:visible')
}
const edit = async (scope, oldValue, newValue) => {
  await cellWithText(scope, oldValue).dblclick()
  await editor(scope).fill(newValue)
  await editor(scope).press('Enter')
}
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

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    globalThis.__OD_SPREADSHEET_CLIPBOARD_READS__ = 0
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        readText: async () => {
          globalThis.__OD_SPREADSHEET_CLIPBOARD_READS__ += 1
          return 'Owned clipboard value\t19'
        },
        writeText: async () => {}
      }
    })
  })
})

test('text and numeric edits preserve exact change source, instance and numeric key filtering', async ({ page }) => {
  await page.goto(fixtureUrl('surface=spreadsheet&mode=light'))
  const primary = sheet(page, 'primary')
  await expect(cellWithText(primary, 'Alpha product with a deliberately long customer supplied name')).toBeVisible()
  await clearEvents(page)
  await edit(primary, 'Alpha product with a deliberately long customer supplied name', 'Alpha revised')
  await expect.poll(async () => (await events(page)).filter(event => event.sheet === 'primary' && event.kind === 'change' && event.values[1] === 'edit')).toEqual([{
    sheet: 'primary',
    kind: 'change',
    values: [[[0, 'name', 'Alpha product with a deliberately long customer supplied name', 'Alpha revised']], 'edit'],
    instance: { active: true, rows: 4, firstValue: 'Alpha revised' }
  }])

  await cellWithText(primary, '12').dblclick()
  const numericEditor = editor(primary)
  await numericEditor.press('Home')
  await numericEditor.press('Shift+End')
  await page.keyboard.type('x')
  await expect(numericEditor).toHaveValue('12')
  await numericEditor.press('Backspace')
  await page.keyboard.type('29')
  await numericEditor.press('Enter')
  await expect(cellWithText(primary, '29')).toBeVisible()
  await expect.poll(async () => (await events(page)).some(event => event.kind === 'change' && event.values[0]?.[0]?.[1] === 'units' && event.values[0][0][3] === 29)).toBe(true)
})

test('selection, outside clicks and row removal preserve callback payloads and live instance', async ({ page }) => {
  await page.goto(fixtureUrl('surface=spreadsheet&mode=light'))
  const primary = sheet(page, 'primary')
  await expect(cellWithText(primary, 'Beta product')).toBeVisible()
  await clearEvents(page)
  await cellWithText(primary, 'Beta product').click()
  await expect.poll(async () => (await events(page)).find(event => event.sheet === 'primary' && event.kind === 'selection')).toMatchObject({
    values: [1, 0, 1, 0],
    instance: { active: true, rows: 4, firstValue: 'Alpha product with a deliberately long customer supplied name' }
  })
  await page.getByTestId('fixture-outside').click()
  await expect.poll(async () => (await events(page)).some(event => event.sheet === 'primary' && event.kind === 'outside' && event.values[0].tag === 'BUTTON')).toBe(true)

  const menu = await openMenu(primary, 'Beta product')
  await menu.getByText('Remove row', { exact: true }).click()
  await expect.poll(async () => (await events(page)).find(event => event.sheet === 'primary' && event.kind === 'remove')).toEqual({
    sheet: 'primary',
    kind: 'remove',
    values: [1, 1, [1]],
    instance: { active: true, rows: 3, firstValue: 'Alpha product with a deliberately long customer supplied name' }
  })
  await expect(cellWithText(primary, 'Beta product')).toHaveCount(0)
})

test('hidden columns update and business product IDs and loading rows remain read only', async ({ page }) => {
  await page.goto(fixtureUrl('surface=spreadsheet&mode=light'))
  const primary = sheet(page, 'primary')
  const products = sheet(page, 'products')
  const loading = sheet(page, 'loading')
  const visibleHeaders = primary.locator('.ht_clone_top:visible .colHeader')
  await expect(visibleHeaders.filter({ hasText: 'Private' })).toHaveCount(0)
  await expect(visibleHeaders.filter({ hasText: 'Notes' })).toBeVisible()
  await page.getByRole('button', { name: 'Toggle Notes column', exact: true }).click()
  await expect(visibleHeaders.filter({ hasText: 'Notes' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Toggle Notes column', exact: true }).click()
  await expect(visibleHeaders.filter({ hasText: 'Notes' })).toBeVisible()

  await expect(products.locator('.product-id')).toHaveText(['501', '502'])
  await cellWithText(products, '501').dblclick()
  await expect(editor(products)).toHaveCount(0)
  await cellWithText(products, 'Editable product name').dblclick()
  await expect(editor(products)).toBeVisible()
  await editor(products).press('Escape')
  await cellWithText(loading, 'Editable product name').dblclick()
  await expect(editor(loading)).toHaveCount(0)
})

// W1 n.º 8 B (owner, 2026-10-21): no background clipboard poll; the menu Paste reads the clipboard once, when clicked.
test('context menu flags preserve undo, redo and remove, and Paste reads the clipboard only when clicked', async ({ page }) => {
  await page.goto(fixtureUrl('surface=spreadsheet&mode=light'))
  const primary = sheet(page, 'primary')
  const products = sheet(page, 'products')
  await page.waitForTimeout(1200)
  expect(await page.evaluate(() => globalThis.__OD_SPREADSHEET_CLIPBOARD_READS__)).toBe(0)
  await edit(primary, 'Gamma product', 'Gamma edited')

  let menu = await openMenu(primary, 'Gamma edited')
  await expect(menu.getByText('Undo', { exact: true })).toBeVisible()
  await expect(menu.getByText('Redo', { exact: true })).toBeVisible()
  await expect(menu.getByText('Remove row', { exact: true })).toBeVisible()
  await expect(menu.getByText('Paste', { exact: true }).locator('xpath=ancestor::td[1]')).not.toHaveClass(/htDisabled/)
  await menu.getByText('Undo', { exact: true }).click()
  await expect(cellWithText(primary, 'Gamma product')).toBeVisible()
  await edit(primary, 'Gamma product', 'Gamma edited again')
  menu = await openMenu(primary, 'Gamma edited again')
  expect(await page.evaluate(() => globalThis.__OD_SPREADSHEET_CLIPBOARD_READS__)).toBe(0)
  await menu.getByText('Paste', { exact: true }).click()
  await expect(cellWithText(primary, 'Owned clipboard value')).toBeVisible()
  expect(await page.evaluate(() => globalThis.__OD_SPREADSHEET_CLIPBOARD_READS__)).toBe(1)
  await expect.poll(async () => (await events(page)).some(event => event.kind === 'change' && event.values[1] === 'CopyPaste.paste' && event.values[0]?.[0]?.[3] === 'Owned clipboard value')).toBe(true)

  menu = await openMenu(products, 'Editable product name')
  await expect(menu.getByText('Remove row', { exact: true })).toBeVisible()
  await expect(menu.getByText('Undo', { exact: true })).toHaveCount(0)
  await expect(menu.getByText('Redo', { exact: true })).toHaveCount(0)
})

test('context menu uses all twelve catalog dictionaries and a translated command keeps its action', async ({ page }) => {
  const menuKeys = ['SPREADSHEET_COPY', 'SPREADSHEET_UNDO', 'SPREADSHEET_REDO', 'SPREADSHEET_REMOVE_ROW', 'SPREADSHEET_PASTE']
  for (const locale of [localeConfig.sourceLanguage, ...localeConfig.supportedLocales]) {
    await page.goto(fixtureUrl(`surface=spreadsheet&mode=light&locale=${locale}&rtl=${locale === 'ar'}`))
    const primary = sheet(page, 'primary')
    await expect(cellWithText(primary, 'Gamma product')).toBeVisible()
    const menu = await openMenu(primary, 'Gamma product')
    const menuHost = menu.locator('xpath=ancestor::*[@data-slot="spreadsheet-menu-host"][1]')
    await expect(menuHost).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
    for (const key of menuKeys) {
      expect(translations[key][locale].trim(), `${key}.${locale} must come from the catalog`).not.toBe('')
      await expect(menu.getByText(translations[key][locale], { exact: true })).toBeVisible()
    }
    await page.keyboard.press('Escape')
  }

  await page.goto(fixtureUrl('surface=spreadsheet&mode=light&locale=es'))
  const primary = sheet(page, 'primary')
  await edit(primary, 'Gamma product', 'Gamma editado')
  const menu = await openMenu(primary, 'Gamma editado')
  await menu.getByText(translations.SPREADSHEET_UNDO.es, { exact: true }).click()
  await expect(cellWithText(primary, 'Gamma product')).toBeVisible()
})

test('context menu remains near the clicked cell with an offset owner and scrolled page', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(fixtureUrl('surface=spreadsheet&mode=light'))
  const primary = sheet(page, 'primary')
  await primary.evaluate(element => { element.style.marginTop = '600px' })
  const cell = cellWithText(primary, 'Beta product')
  await cell.scrollIntoViewIfNeeded()
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  const cellBox = await cell.boundingBox()
  const menu = await openMenu(primary, 'Beta product')
  const box = await menu.boundingBox()
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(1280)
  expect(box.y + box.height).toBeLessThanOrEqual(900)
  const clickY = cellBox.y + cellBox.height / 2
  expect(Math.min(Math.abs(box.y - clickY), Math.abs(box.y + box.height - clickY))).toBeLessThanOrEqual(12)
})

for (const mode of ['light', 'dark']) {
  test(`real grid keeps readable ${mode} surfaces and keyboard editing`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(fixtureUrl(`surface=spreadsheet&mode=${mode}`))
    const primary = sheet(page, 'primary')
    const region = primary.getByRole('region', { name: 'Spreadsheet', exact: true })
    await expect(region).toBeVisible()
    await expect(region).toHaveAttribute('dir', 'ltr')
    const header = primary.locator('.ht_clone_top:visible .colHeader').filter({ hasText: 'Name' })
    const cell = cellWithText(primary, 'Beta product')
    for (const target of [header, cell]) {
      const colors = await effectiveColors(target)
      expect.soft(contrast(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5)
    }

    await cell.click()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Enter')
    await expect(editor(primary)).toBeFocused()
    await editor(primary).fill('8')
    await editor(primary).press('Enter')
    await expect(cellWithText(primary, '8')).toBeVisible()
    const selected = primary.locator('.ht_master .wtBorder.current:visible').first()
    await expect(selected).toBeVisible()
    const outline = await selected.evaluate(element => getComputedStyle(element).backgroundColor)
    expect(outline).toBe(`rgb(${tokens.theme[mode].semantic.action.focus.slice(1).match(/../g).map(part => parseInt(part, 16)).join(', ')})`)
    await page.screenshot({ path: testInfo.outputPath(`spreadsheet-${mode}.png`), fullPage: true })
  })
}

for (const width of [320, 390]) {
  test.describe(`spreadsheet at ${width}px coarse pointer`, () => {
    test.use({ viewport: { width, height: 760 }, hasTouch: true, isMobile: true })
    test('RTL grid contains its 900px table and responds to native horizontal touch', async ({ page }, testInfo) => {
      await page.goto(fixtureUrl('surface=spreadsheet&mode=dark&rtl=true&locale=ar'))
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      const primary = sheet(page, 'primary')
      const region = primary.getByRole('region', { name: 'جدول البيانات', exact: true })
      const scrollport = region.locator('[data-slot="spreadsheet-scrollport"]')
      await expect(region).toHaveAttribute('dir', 'rtl')
      await scrollport.scrollIntoViewIfNeeded()
      await page.screenshot({ path: testInfo.outputPath(`spreadsheet-${width}-before.png`) })
      const metrics = await scrollport.evaluate(element => ({ clientWidth: element.clientWidth, scrollLeft: element.scrollLeft, scrollWidth: element.scrollWidth }))
      expect(metrics.scrollWidth).toBeGreaterThanOrEqual(900)
      expect(metrics.clientWidth).toBeLessThan(metrics.scrollWidth)
      expect(metrics.scrollLeft).toBe(0)
      const box = await scrollport.boundingBox()
      await scrollport.evaluate(element => {
        element.dataset.fixtureScrollEnded = 'false'
        element.addEventListener('scrollend', () => { element.dataset.fixtureScrollEnded = 'true' }, { once: true })
      })
      const cdp = await page.context().newCDPSession(page)
      // every event carries its own timestamp, 16 ms apart like a real finger. Without one, Chrome
      // stamps each event when it arrives, and irregular arrivals (a short first gap, then ~30 ms) make the fling
      // reverse, sometimes all the way to the start edge, in LTR as much as in RTL (main and orders-pilot alike).
      let timestamp = Date.now() / 1000
      const touch = (type, touchPoints) => {
        timestamp += 0.016
        return cdp.send('Input.dispatchTouchEvent', { type, touchPoints, timestamp })
      }
      await touch('touchStart', [{ x: box.x + box.width * 0.25, y: box.y + box.height / 2 }])
      await touch('touchMove', [{ x: box.x + box.width * 0.5, y: box.y + box.height / 2 }])
      await touch('touchMove', [{ x: box.x + box.width * 0.75, y: box.y + box.height / 2 }])
      // The finger is still down: wait until both moves have scrolled (two equal readings) before keeping the value.
      let released = null
      await expect.poll(async () => {
        const current = await scrollport.evaluate(element => element.scrollLeft)
        const settled = current < 0 && current === released
        released = current
        return settled
      }).toBe(true)
      await touch('touchEnd', [])
      await expect(scrollport).toHaveAttribute('data-fixture-scroll-ended', 'true')
      expect(await scrollport.evaluate(element => element.scrollLeft)).toBeLessThanOrEqual(released)
      await primary.locator('.ht_master td').filter({ hasText: 'First note' }).click({ button: 'right' })
      const menu = page.locator('.htContextMenu:visible')
      await expect(menu).toBeVisible()
      const menuBox = await menu.boundingBox()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      expect(menuBox.y).toBeGreaterThanOrEqual(0)
      expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(760)
      expect(menuBox.x).toBeGreaterThanOrEqual(0)
      expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(width)
      for (const row of await menu.locator('tbody tr').all()) {
        const rowBox = await row.boundingBox()
        expect(rowBox.height).toBeGreaterThanOrEqual(44)
      }
      const lastAction = menu.locator('tbody tr').last()
      const lastBox = await lastAction.boundingBox()
      expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(760)
      expect(await lastAction.evaluate(element => {
        const box = element.getBoundingClientRect()
        return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2))
      })).toBe(true)
      await page.screenshot({ path: testInfo.outputPath(`spreadsheet-${width}-menu.png`) })
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      await lastAction.tap()
      await expect(menu).toHaveCount(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      for (const control of await page.locator('.spreadsheet-fixture-controls button').all()) {
        const controlBox = await control.boundingBox()
        expect.soft(controlBox.x).toBeGreaterThanOrEqual(0)
        expect.soft(controlBox.x + controlBox.width).toBeLessThanOrEqual(width)
        expect.soft(controlBox.height).toBeGreaterThanOrEqual(44)
      }
      await page.screenshot({ path: testInfo.outputPath(`spreadsheet-${width}-after.png`) })
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
    })
  })
}
