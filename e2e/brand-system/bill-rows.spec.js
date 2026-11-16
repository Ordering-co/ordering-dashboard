import { test, expect, fixtureUrl } from './fixtures'
import localeConfig from '../../i18n/config.json'
import translations from '../../i18n/translations.json'
import { tokens } from '../../src/brand/ordering.tokens.generated'

const rows = scope => scope.locator('tbody > tr')
const rowText = async scope => (await rows(scope).allTextContents()).map(value => value.replace(/\s+/g, ' ').trim())
const receipts = async page => JSON.parse(await page.getByTestId('bill-row-receipts').textContent())
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
  for (let index = 0; index < 30 && !await target.evaluate(element => element === document.activeElement); index += 1) await page.keyboard.press('Tab')
  await expect(target).toBeFocused()
}

test('fee rows preserve fixed and percentage detail, summary precedence, after-discount amount, zero filtering and NaN', async ({ page }) => {
  await page.goto(fixtureUrl('surface=bill-rows&mode=light'))
  const scope = page.getByTestId('fee-contracts')
  await expect(rows(scope)).toHaveCount(5)
  expect(await rowText(scope)).toEqual([
    'Combined service fee with a deliberately long customer supplied name([USD 2.50] + 5%)[USD 5.50]',
    'Summary override[USD 9.25]',
    'After discount(10%)[USD 3.00]',
    'Not a number fee[USD NaN:not-a-number]',
    'Inherit from business([USD 1.00])[USD 1.00]'
  ])
  await expect(scope).not.toContainText('Zero fee')
})

test('tax rows preserve target order, type-one and zero filtering, after-discount amounts and integer or decimal rates', async ({ page }) => {
  await page.goto(fixtureUrl('surface=bill-rows&mode=light'))
  const product = page.getByTestId('tax-product-contracts')
  const order = page.getByTestId('tax-order-contracts')
  await expect(rows(product)).toHaveCount(3)
  expect(await rowText(product)).toEqual([
    'Product tax fractional([N 7.50]%)[USD 3.80]',
    'Zero rate[USD 2.00]',
    'Inherit from business(8%)[USD 1.00]'
  ])
  expect(await rowText(order)).toEqual(['Order tax(6%)[USD 2.40]'])
  await expect(product).not.toContainText('Included type one')
  await expect(product).not.toContainText('Zero tax')
  await expect(product).not.toContainText('Order tax')
})

test('icon and exclamation wrappers emit exact fee and tax payloads with original object references', async ({ page }) => {
  await page.goto(fixtureUrl('surface=bill-rows&mode=light'))
  const icon = page.getByTestId('icon-wrappers')
  const exclamation = page.getByTestId('exclamation-wrappers')
  await expect(icon.locator('.fixture-info-wrapper')).toHaveCount(2)
  await expect(exclamation.locator('.fixture-exclamation-wrapper')).toHaveCount(2)
  for (const action of await icon.locator('.fixture-info-wrapper').all()) await action.click()
  for (const action of await exclamation.locator('.fixture-exclamation-wrapper').all()) await action.click()
  await expect.poll(() => receipts(page)).toEqual([
    { variant: 'icon-fee', id: 31, open: true, type: 'fee', sameReference: true },
    { variant: 'icon-tax', id: 32, open: true, type: 'tax', sameReference: true },
    { variant: 'exclamation-fee', id: 31, open: true, type: 'fee', sameReference: true },
    { variant: 'exclamation-tax', id: 32, open: true, type: 'tax', sameReference: true }
  ])
})

test('wrapper and callback gates leave rows visible without orphan information actions', async ({ page }) => {
  await page.goto(fixtureUrl('surface=bill-rows&mode=light'))
  const gates = page.getByTestId('wrapper-gates')
  await expect(rows(gates)).toHaveCount(2)
  await expect(gates).toContainText('Interactive fee')
  await expect(gates).toContainText('Interactive tax')
  await expect(gates.locator('.fixture-info-wrapper, [data-bill-row-slot="info-action"]')).toHaveCount(0)
  await expect(page.getByTestId('bill-row-receipts')).toHaveText('[]')
})

for (const mode of ['light', 'dark']) {
  test(`bill rows use canonical information actions, readable ${mode} colors and real keyboard focus`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1100, height: 800 })
    await page.goto(fixtureUrl(`surface=bill-rows&mode=${mode}`))
    const icon = page.getByTestId('icon-wrappers')
    const feeAction = icon.getByRole('button', { name: 'Info: Interactive fee', exact: true })
    const taxAction = icon.getByRole('button', { name: 'Info: Interactive tax', exact: true })
    await expect(icon.locator('[data-slot="bill-row"][data-row-kind="fee"]')).toHaveCount(1)
    await expect(icon.locator('[data-slot="bill-row"][data-row-kind="tax"]')).toHaveCount(1)
    await expect(icon.locator('[data-bill-row-slot="action-wrapper"][data-icon-variant="icon"]')).toHaveCount(2)
    await expect(feeAction.locator('svg.lucide-info')).toHaveAttribute('aria-hidden', 'true')
    for (const target of [icon.locator('[data-bill-row-slot="label"]').first(), icon.locator('[data-bill-row-slot="amount"]').first()]) {
      const colors = await effectiveColors(target)
      expect.soft(contrast(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5)
    }
    await page.evaluate(() => document.activeElement?.blur())
    await focusByKeyboard(page, feeAction)
    await expect(feeAction).toHaveCSS('outline-color', rgb(tokens.theme[mode].semantic.action.focus))
    expect(parseFloat(await feeAction.evaluate(element => getComputedStyle(element).outlineWidth))).toBeGreaterThanOrEqual(2)
    await page.keyboard.press('Enter')
    await focusByKeyboard(page, taxAction)
    await page.keyboard.press('Space')
    await expect.poll(() => receipts(page)).toEqual([
      { variant: 'icon-fee', id: 31, open: true, type: 'fee', sameReference: true },
      { variant: 'icon-tax', id: 32, open: true, type: 'tax', sameReference: true }
    ])
    await page.screenshot({ path: testInfo.outputPath(`bill-rows-${mode}.png`), fullPage: true })
  })
}

for (const width of [320, 390]) {
  test.describe(`bill rows at ${width}px coarse pointer`, () => {
    test.use({ viewport: { width, height: 720 }, hasTouch: true, isMobile: true })
    test('RTL long labels reflow inside viewport and information actions retain 44px touch targets', async ({ page }, testInfo) => {
      await page.goto(fixtureUrl('surface=bill-rows&mode=dark&rtl=true&locale=ar'))
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      const feeContracts = page.getByTestId('fee-contracts')
      const firstRow = rows(feeContracts).first()
      await firstRow.scrollIntoViewIfNeeded()
      await page.screenshot({ path: testInfo.outputPath(`bill-rows-${width}-before.png`) })
      for (const target of [firstRow, firstRow.locator('td').first(), firstRow.locator('td').nth(1)]) {
        const box = await target.boundingBox()
        expect.soft(box.x).toBeGreaterThanOrEqual(0)
        expect.soft(box.x + box.width).toBeLessThanOrEqual(width)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      const action = page.getByTestId('icon-wrappers').getByRole('button', { name: `${translations.INFO.ar}: Interactive fee`, exact: true })
      await action.scrollIntoViewIfNeeded()
      const actionBox = await action.boundingBox()
      expect(actionBox.width).toBeGreaterThanOrEqual(44)
      expect(actionBox.height).toBeGreaterThanOrEqual(44)
      await page.touchscreen.tap(actionBox.x + actionBox.width / 2, actionBox.y + actionBox.height / 2)
      await expect.poll(() => receipts(page)).toEqual([
        { variant: 'icon-fee', id: 31, open: true, type: 'fee', sameReference: true }
      ])
      await page.screenshot({ path: testInfo.outputPath(`bill-rows-${width}-after.png`) })
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
    })
  })
}

// Exercise translated names through the real row wrappers without changing fee/tax data.
test('all twelve dictionaries preserve fee and tax labels, actions and original references', async ({ page }) => {
  for (const locale of [localeConfig.sourceLanguage, ...localeConfig.supportedLocales]) {
    await page.goto(fixtureUrl(`surface=bill-rows&mode=light&locale=${locale}&rtl=${locale === 'ar'}`))
    const scope = page.getByTestId('icon-wrappers')
    const info = translations.INFO[locale]
    expect(info.trim()).not.toBe('')
    await scope.getByRole('button', { name: `${info}: Interactive fee`, exact: true }).click()
    await scope.getByRole('button', { name: `${info}: Interactive tax`, exact: true }).click()
    await expect.poll(() => receipts(page)).toEqual([
      { variant: 'icon-fee', id: 31, open: true, type: 'fee', sameReference: true },
      { variant: 'icon-tax', id: 32, open: true, type: 'tax', sameReference: true }
    ])
    await expect(page.getByTestId('fee-contracts')).toContainText(translations.INHERIT_FROM_BUSINESS[locale])
    await expect(page.getByTestId('tax-product-contracts')).toContainText(translations.INHERIT_FROM_BUSINESS[locale])
  }
})
