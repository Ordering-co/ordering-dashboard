import { test, expect, fixtureUrl } from './fixtures'
import { tokens } from '../../src/brand/ordering.tokens.generated'
import localeConfig from '../../i18n/config.json'

const selected = async (page, testId) => JSON.parse(await page.getByTestId(testId).textContent())
const controllerReceipts = page => page.evaluate(() => globalThis.__OD_TREE_CONTROLLER_RECEIPTS__)
const disclosure = (scope, name) => scope.getByRole('button', { name, exact: true })
const checkbox = (scope, name) => scope.getByRole('checkbox', { name, exact: true })
const row = control => control.locator('xpath=ancestor::*[@data-slot="selection-tree-row"][1]')
const settle = page => page.evaluate(() => Promise.all(document.getAnimations().filter(animation => animation instanceof window.CSSTransition).map(animation => animation.finished.catch(() => {}))))
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

test('controller seam forwards category and product flags, local ordering and v1 without services', async ({ page }) => {
  await page.goto(fixtureUrl('surface=selection-trees&mode=light'))
  await expect(page.locator('[data-slot="entity-selector"]').first()).toBeVisible()
  await expect.poll(() => controllerReceipts(page)).toMatchObject({
    'categories-include': [{
      isAllCategoryProducts: true,
      isInitialRender: false,
      isSearchByDescription: true,
      isSearchByName: true,
      ordering: { source: 'selection-tree-fixture' }
    }],
    'products-include': [{
      isAllCategoryProducts: true,
      isInitialRender: false,
      isSearchByDescription: true,
      isSearchByName: true,
      ordering: { source: 'selection-tree-fixture' },
      version: 'v1'
    }]
  })
  await page.getByRole('button', { name: 'Update category initial render', exact: true }).click()
  await page.getByRole('button', { name: 'Update product initial render', exact: true }).click()
  await expect.poll(async () => (await controllerReceipts(page))['categories-include'].map(value => value.isInitialRender)).toEqual([false, true])
  await expect.poll(async () => (await controllerReceipts(page))['products-include'].map(value => value.isInitialRender)).toEqual([false, true])
})

test('category tree keeps ranked disabled nodes, three levels and exact include/exclude map quirks', async ({ page }) => {
  await page.goto(fixtureUrl('surface=selection-trees&mode=light'))
  const include = page.getByTestId('categories-include')
  const exclude = page.getByTestId('categories-exclude')
  const rootName = 'Root category with an exceptionally long localized display name'
  const rootDisclosure = disclosure(include, rootName)
  const rootCheckbox = checkbox(include, rootName)
  await expect(rootDisclosure).toHaveAttribute('data-selection-tree-slot', 'disclosure')
  await expect(include.getByText('Disabled top category', { exact: true })).toBeVisible()
  const topLabels = await include.locator('[data-slot="selection-tree-row"][data-depth="0"] > .od-selection-tree-selection > span').allTextContents()
  expect(topLabels).toEqual(['Disabled top category', rootName, 'Enabled category with disabled-only immediate product'])
  await expect(rootDisclosure).toHaveAttribute('aria-expanded', 'false')
  await expect(row(rootCheckbox)).toHaveAttribute('data-depth', '0')

  await rootCheckbox.click()
  await expect(rootDisclosure).toHaveAttribute('aria-expanded', 'false')
  expect(await selected(page, 'selected-categories')).toEqual({
    10: { id: 10, include: true },
    20: { id: 20, include: true },
    21: { id: 21, include: true },
    30: { id: 30, include: true },
    900: { id: 900, include: true }
  })
  await rootCheckbox.click()
  expect(await selected(page, 'selected-categories')).toEqual({
    20: { id: 20, include: true },
    21: { id: 21, include: true },
    30: { id: 30, include: true },
    900: { id: 900, include: true }
  })

  await disclosure(exclude, rootName).press('Enter')
  await settle(page)
  await expect(disclosure(exclude, rootName)).toHaveAttribute('aria-expanded', 'true')
  await expect(disclosure(exclude, 'Nested disabled category')).toBeVisible()
  await disclosure(exclude, 'Nested disabled category').press('Space')
  await settle(page)
  await disclosure(exclude, 'Third-level category').press('Enter')
  await settle(page)
  await expect(row(checkbox(exclude, 'Third-level category'))).toHaveAttribute('data-depth', '2')
  await checkbox(exclude, rootName).click()
  expect(await selected(page, 'selected-categories')).toEqual({
    10: { id: 10, include: false },
    20: { id: 20, include: false },
    21: { id: 21, include: false },
    30: { id: 30, include: false },
    900: { id: 900, include: true }
  })
})

test('product tree preserves top-only filtering, immediate enabled selection, empty every behavior and client images', async ({ page }) => {
  await page.goto(fixtureUrl('surface=selection-trees&mode=light'))
  const include = page.getByTestId('products-include')
  const exclude = page.getByTestId('products-exclude')
  const rootName = 'Root category with an exceptionally long localized display name'
  await expect(include.getByText('Disabled top category', { exact: true })).toHaveCount(0)
  await expect(include.getByText('Enabled category with disabled-only immediate product', { exact: true })).toBeVisible()
  await expect(checkbox(include, 'Enabled category with disabled-only immediate product')).toBeChecked()

  await disclosure(include, rootName).click()
  await settle(page)
  await expect(include.getByText('Immediate enabled product', { exact: true })).toBeVisible()
  await expect(include.getByText('Immediate disabled product', { exact: true })).toHaveCount(0)
  await expect(disclosure(include, 'Nested disabled category')).toBeVisible()
  await checkbox(include, rootName).click()
  expect(await selected(page, 'selected-products')).toEqual({
    1001: { id: 1001, include: true },
    2001: { id: 2001, include: false },
    9001: { id: 9001, include: true }
  })
  await checkbox(include, rootName).click()
  expect(await selected(page, 'selected-products')).toEqual({
    2001: { id: 2001, include: false },
    9001: { id: 9001, include: true }
  })

  await disclosure(include, 'Nested disabled category').click()
  await settle(page)
  await disclosure(include, 'Third-level category').click()
  await settle(page)
  await expect(include.getByText('Nested enabled product', { exact: true })).toBeVisible()
  await expect(include.getByText('Third-level product with an exceptionally long localized display name', { exact: true })).toBeVisible()

  await disclosure(exclude, rootName).click()
  await settle(page)
  await checkbox(exclude, 'Immediate enabled product').click()
  expect(await selected(page, 'selected-products')).toEqual({
    1001: { id: 1001, include: false },
    2001: { id: 2001, include: false },
    9001: { id: 9001, include: true }
  })

  const rawFrame = row(checkbox(include, 'Immediate enabled product')).locator('[data-slot="selection-tree-image"]')
  const fallbackFrame = row(checkbox(include, 'Nested enabled product')).locator('[data-slot="selection-tree-image"]')
  for (const frame of [rawFrame, fallbackFrame]) {
    const box = await frame.boundingBox()
    expect(box.width).toBe(38)
    expect(box.height).toBe(38)
    expect(await frame.locator(':scope > div').evaluate(element => getComputedStyle(element).backgroundImage)).not.toBe('none')
  }
  expect(await page.evaluate(() => globalThis.__OD_TREE_OPTIMIZE_CALLS__)).toEqual(expect.arrayContaining([
    { value: expect.stringContaining('data:image/svg+xml;base64,'), options: 'h_50,c_limit' },
    { value: expect.any(String), options: 'h_50,c_limit' }
  ]))
})

test('loading and empty trees stay distinct with ten skeleton rows', async ({ page }) => {
  await page.goto(fixtureUrl('surface=selection-trees&mode=dark'))
  for (const testId of ['categories-loading', 'products-loading']) {
    await expect(page.getByTestId(testId).locator('[data-slot="entity-selector-skeleton"]')).toHaveCount(10)
    await expect(page.getByTestId(testId).locator('.react-loading-skeleton')).toHaveCount(30)
  }
  for (const testId of ['categories-empty', 'products-empty']) {
    await expect(page.getByTestId(testId).locator('[data-slot="entity-selector"]')).toBeAttached()
    await expect(page.getByTestId(testId).locator('[data-slot="selection-tree-row"]')).toHaveCount(0)
    await expect(page.getByTestId(testId).locator('.react-loading-skeleton')).toHaveCount(0)
  }
})

for (const mode of ['light', 'dark']) {
  test(`selection trees use governed ${mode} surfaces, readable rows, focus and 600ms disclosure`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(fixtureUrl(`surface=selection-trees&mode=${mode}`))
    const roots = page.locator('[data-slot="entity-selector"]')
    await expect(roots.first()).toBeVisible()
    await expect(roots).toHaveCount(8)
    const semantic = tokens.theme[mode].semantic
    for (const root of await roots.all()) {
      const value = await effectiveColors(root)
      expect(value.background).toBe(rgb(semantic.background))
      expect.soft(contrast(value.foreground, value.background)).toBeGreaterThanOrEqual(4.5)
    }

    const categories = page.getByTestId('categories-include')
    const rootName = 'Root category with an exceptionally long localized display name'
    const toggle = disclosure(categories, rootName)
    const check = checkbox(categories, rootName)
    await expect(toggle.locator('svg')).toHaveCSS('transition-duration', '0.6s')
    await page.evaluate(() => document.activeElement?.blur())
    await focusByKeyboard(page, toggle)
    expect(parseFloat(await toggle.evaluate(element => getComputedStyle(element).outlineWidth))).toBeGreaterThanOrEqual(2)
    await focusByKeyboard(page, check)
    expect(parseFloat(await check.evaluate(element => getComputedStyle(element).outlineWidth))).toBeGreaterThanOrEqual(2)
    await check.press('Space')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await toggle.press('Enter')
    await settle(page)
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await page.screenshot({ path: testInfo.outputPath(`selection-trees-${mode}.png`), fullPage: true })
  })
}

test('reduced motion removes tree transitions while disclosure and selection remain usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(fixtureUrl('surface=selection-trees&mode=light'))
  const categories = page.getByTestId('categories-include')
  const name = 'Root category with an exceptionally long localized display name'
  const toggle = disclosure(categories, name)
  await expect(toggle.locator('svg')).toHaveCSS('transition-duration', '0s')
  await toggle.press('Enter')
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await checkbox(categories, name).press('Space')
  expect((await selected(page, 'selected-categories'))[10]).toEqual({ id: 10, include: true })
})

for (const width of [320, 390]) {
  test.describe(`selection trees at ${width}px coarse pointer`, () => {
    test.use({ viewport: { width, height: 800 }, hasTouch: true, isMobile: true })
    test('deep RTL state keeps real row, label and action bounds inside the viewport', async ({ page }, testInfo) => {
      await page.goto(fixtureUrl('surface=selection-trees&mode=dark&locale=ar&rtl=true'))
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      const products = page.getByTestId('products-include')
      const rootName = 'Root category with an exceptionally long localized display name'
      await products.scrollIntoViewIfNeeded()
      await page.screenshot({ path: testInfo.outputPath(`selection-trees-${width}-before.png`) })
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      await disclosure(products, rootName).click()
      await settle(page)
      await disclosure(products, 'Nested disabled category').click()
      await settle(page)
      await disclosure(products, 'Third-level category').click()
      await settle(page)
      const deep = row(checkbox(products, 'Third-level product with an exceptionally long localized display name'))
      await deep.scrollIntoViewIfNeeded()
      for (const target of await products.locator('[data-slot="selection-tree-row"]:visible, [data-selection-tree-slot="disclosure"]:visible, input[type="checkbox"]:visible').all()) {
        const box = await target.boundingBox()
        expect.soft(box.x).toBeGreaterThanOrEqual(0)
        expect.soft(box.x + box.width).toBeLessThanOrEqual(width)
      }
      for (const control of await products.locator('[data-selection-tree-slot="disclosure"]:visible, input[type="checkbox"]:visible').all()) {
        const box = await control.boundingBox()
        expect.soft(box.width).toBeGreaterThanOrEqual(44)
        expect.soft(box.height).toBeGreaterThanOrEqual(44)
      }
      const textBounds = await deep.locator('.od-selection-tree-selection > span').evaluate(element => {
        const range = document.createRange()
        range.selectNodeContents(element)
        const box = range.getBoundingClientRect()
        return { left: box.left, right: box.right }
      })
      expect(textBounds.left).toBeGreaterThanOrEqual(0)
      expect(textBounds.right).toBeLessThanOrEqual(width)
      await page.screenshot({ path: testInfo.outputPath(`selection-trees-${width}-after.png`) })
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
    })
  })
}

test('selection trees retain accessible names and direction in all twelve locales', async ({ page }) => {
  for (const locale of [localeConfig.sourceLanguage, ...localeConfig.supportedLocales]) {
    await page.goto(fixtureUrl(`surface=selection-trees&mode=light&locale=${locale}&rtl=${locale === 'ar'}`))
    const categories = page.getByTestId('categories-include')
    const name = 'Root category with an exceptionally long localized display name'
    await expect(disclosure(categories, name)).toBeVisible()
    await expect(checkbox(categories, name)).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
  }
})

for (const kind of ['categories', 'products']) {
  test(`${kind} closing a parent excludes previously opened descendants from keyboard navigation`, async ({ page }) => {
    await page.goto(fixtureUrl('surface=selection-trees&mode=light'))
    const scope = page.getByTestId(`${kind}-include`)
    const root = disclosure(scope, 'Root category with an exceptionally long localized display name')
    await root.press('Enter')
    await settle(page)
    await disclosure(scope, 'Nested disabled category').press('Enter')
    await settle(page)
    await root.press('Enter')
    const contentId = await root.getAttribute('aria-controls')
    await expect(page.locator('[id="' + contentId + '"]')).toHaveAttribute('inert', '')
    for (let index = 0; index < 2; index += 1) {
      await page.keyboard.press('Tab')
      expect(await page.evaluate(id => document.getElementById(id).contains(document.activeElement), contentId)).toBe(false)
    }
    await settle(page)
    await expect(root).toHaveAttribute('aria-expanded', 'false')
    for (let index = 0; index < 12; index += 1) {
      await page.keyboard.press('Tab')
      expect(await page.evaluate(id => document.getElementById(id).contains(document.activeElement), contentId)).toBe(false)
    }
  })
}
