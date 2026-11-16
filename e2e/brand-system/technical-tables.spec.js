import { test, expect, fixtureUrl } from './fixtures'
import translations from '../../i18n/translations.json'
import { tokens } from '../../src/brand/ordering.tokens.generated'
// Copy decision 4 (user, 2026-10-06): shared labels in sentence case; only the names this spec looks up changed.

const logRows = scope => scope.locator('table > tbody')
const pushRows = scope => scope.locator('table > tbody > tr')
const receipts = async page => JSON.parse(await page.getByTestId('technical-log-receipts').textContent())
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

test('integration log table preserves model columns, levels, UTC dates, page size and empty-last-page fallback', async ({ page }) => {
  await page.goto(fixtureUrl('surface=technical-tables&mode=light'))
  const main = page.getByTestId('integration-logs')
  const model = page.getByTestId('integration-logs-model')
  await expect(logRows(main)).toHaveCount(3)
  await expect(main.locator('thead')).toContainText('Model')
  await expect(main.locator('thead')).toContainText('Model ID')
  await expect(main).toContainText('Order')
  await expect(main).toContainText('7001')
  await expect(main).toContainText('order.failed')
  await expect(main).toContainText('DATE:2026-09-14T10:30:00Z:utc=true')
  await expect(main.locator('tbody').nth(0).locator('td').first().locator('div').last()).toHaveCSS('background-color', 'rgb(230, 55, 87)')
  await expect(main.locator('tbody').nth(1).locator('td').first().locator('div').last()).toHaveCSS('background-color', 'rgb(255, 199, 0)')
  await expect(main.locator('tbody').nth(2).locator('td').first().locator('div').last()).toHaveCSS('background-color', 'rgb(44, 123, 229)')
  await expect(model.locator('thead')).not.toContainText('Model ID')
  await expect(model.locator('thead')).not.toContainText('Model')

  await main.getByRole('button', { name: 'Page 2', exact: true }).click()
  await expect.poll(async () => (await receipts(page)).some(item => item.kind === 'getLogs' && item.source === 'main' && item.page === 2 && item.size === 10)).toBe(true)
  await expect(page.getByTestId('integration-logs-empty-last')).toContainText('No data')
  await expect.poll(async () => (await receipts(page)).some(item => item.kind === 'getLogs' && item.source === 'empty-last' && item.page === 2 && item.size === 10)).toBe(true)
})

test('log detail preserves nested exception trace truncation, request expansion and invalid JSON response', async ({ page }) => {
  await page.goto(fixtureUrl('surface=technical-tables&mode=light'))
  const main = page.getByTestId('integration-logs')
  await logRows(main).filter({ hasText: 'order.failed' }).click()
  const modal = page.getByRole('dialog', { name: 'Log', exact: true })
  await expect(modal).toBeVisible()
  await modal.getByText('Exception:', { exact: true }).click()
  await expect(modal).toContainText('Fixture exception')
  await expect(modal).toContainText('execution_time: 27 ms')
  await expect(modal).toContainText('reason: timeout')
  await expect(modal).toContainText('stepSix (/app/steps.js:46)')
  await expect(modal).not.toContainText('stepSeven')
  await modal.getByRole('button', { name: 'Show more (2 more)', exact: true }).click()
  await expect(modal).toContainText('stepEight (/app/steps.js:48)')

  await modal.getByText('Request:', { exact: true }).click()
  const requestExpand = modal.getByRole('button', { name: 'Show More', exact: true })
  await expect(requestExpand).toBeVisible()
  await requestExpand.click()
  await expect(modal.getByRole('button', { name: 'Show Less', exact: true })).toBeVisible()
  await expect(modal).toContainText('field_12')
  await expect(modal).toContainText('/orders')

  await modal.getByText('Response:', { exact: true }).click()
  await expect(modal).toContainText('{"broken": true')
  await expect(modal).toContainText('status: 500')
})

test('expanded request code persists when switching sections and reopening', async ({ page }) => {
  await page.goto(fixtureUrl('surface=technical-tables&mode=light'))
  await logRows(page.getByTestId('integration-logs')).filter({ hasText: 'order.failed' }).click()
  const modal = page.getByRole('dialog', { name: 'Log', exact: true })
  await modal.getByText('Request:', { exact: true }).click()
  await modal.getByRole('button', { name: 'Show More', exact: true }).click()
  await modal.getByText('Response:', { exact: true }).click()
  await expect(modal.getByRole('button', { name: 'Show Less', exact: true })).toHaveCount(0)
  await modal.getByText('Request:', { exact: true }).click()
  await expect(modal.getByRole('button', { name: 'Show Less', exact: true })).toBeVisible()
})

test('detail Escape, group selection and reset preserve controlled state and exact log reference', async ({ page }) => {
  await page.goto(fixtureUrl('surface=technical-tables&mode=light'))
  const main = page.getByTestId('integration-logs')
  const failed = logRows(main).filter({ hasText: 'order.failed' })
  await failed.click()
  await expect(page.getByTestId('technical-selected-log')).toHaveText(JSON.stringify({ id: 101, loading: false }))
  await expect.poll(async () => (await receipts(page)).some(item => item.kind === 'selected' && item.id === 101 && item.sameReference)).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Log', exact: true })).toHaveCount(0)
  await expect(page.getByTestId('technical-selected-log')).toHaveText(JSON.stringify({ loading: false }))

  await failed.click()
  const modal = page.getByRole('dialog', { name: 'Log', exact: true })
  await modal.getByText('View group related events', { exact: true }).click()
  await expect(page.getByTestId('technical-related-group')).toHaveText('group-fixture-7')
  const group = main.getByRole('button').filter({ hasText: 'Group : group-fixture-7' })
  await expect(group).toBeVisible()
  await group.click()
  await expect(page.getByTestId('technical-related-group')).toHaveText('')
  await expect.poll(async () => (await receipts(page)).filter(item => item.kind === 'group').map(item => item.value)).toEqual(['group-fixture-7', ''])
})

test('push tokens sort without mutation, page by ten, keep local dates, update and reset on user change', async ({ page }) => {
  await page.goto(fixtureUrl('surface=technical-tables&mode=light'))
  const scope = page.getByTestId('push-tokens')
  await expect(pushRows(scope)).toHaveCount(10)
  await expect(pushRows(scope).first()).toContainText('fixture-token-13')
  await expect(pushRows(scope).last()).toContainText('fixture-token-04')
  await expect(scope).toContainText('DATE:2026-09-13T08:00:00Z:utc=false')
  await expect(page.getByTestId('technical-token-source-order')).toHaveText(JSON.stringify(Array.from({ length: 13 }, (_, index) => index + 1)))
  await scope.getByRole('button', { name: 'Page 2', exact: true }).click()
  await expect(pushRows(scope)).toHaveCount(3)
  await expect(pushRows(scope).first()).toContainText('fixture-token-03')
  await expect(pushRows(scope).last()).toContainText('fixture-token-01')

  await page.getByRole('button', { name: 'Update token list', exact: true }).click()
  await expect(pushRows(scope)).toHaveCount(4)
  await expect(pushRows(scope).first()).toContainText('fixture-token-04')
  await page.getByRole('button', { name: 'Next token user', exact: true }).click()
  await expect(page.getByTestId('technical-token-user')).toHaveText('881')
  await expect(pushRows(scope)).toHaveCount(10)
  await expect(pushRows(scope).first()).toContainText('fixture-token-14-updated')
  const dateCalls = await page.evaluate(() => globalThis.__OD_TECHNICAL_DATE_CALLS__)
  expect(dateCalls.some(call => call.value === '2026-09-13T08:00:00Z' && call.options.utc === false)).toBe(true)
  expect(dateCalls.filter(call => call.value.startsWith('2026-09-')).every(call => typeof call.options.utc === 'boolean')).toBe(true)
})

for (const mode of ['light', 'dark']) {
  test(`technical tables keep readable ${mode} rows, disclosures and real keyboard focus`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 850 })
    await page.goto(fixtureUrl(`surface=technical-tables&mode=${mode}`))
    const main = page.getByTestId('integration-logs')
    const logAction = main.getByRole('button', { name: 'View details: order.failed', exact: true })
    await expect(logAction).toBeVisible()
    for (const target of [main.locator('th').filter({ hasText: 'Event' }), logAction]) {
      const colors = await effectiveColors(target)
      expect.soft(contrast(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5)
    }
    await page.evaluate(() => document.activeElement?.blur())
    await focusByKeyboard(page, logAction)
    await expect(logAction).toHaveCSS('outline-color', rgb(tokens.theme[mode].semantic.action.focus))
    await page.keyboard.press('Enter')
    const modal = page.getByRole('dialog', { name: 'Log', exact: true })
    const groupAction = modal.getByRole('button', { name: 'View group related events', exact: true })
    const groupColors = await effectiveColors(groupAction)
    expect.soft(contrast(groupColors.foreground, groupColors.background)).toBeGreaterThanOrEqual(4.5)
    const exception = modal.getByRole('button', { name: 'Exception:', exact: true })
    await focusByKeyboard(page, exception)
    await page.keyboard.press('Space')
    await expect(modal).toContainText('Fixture exception')
    await modal.getByRole('button', { name: 'Request:', exact: true }).click()
    await expect(modal.locator('pre:visible').first()).toBeVisible()
    for (const action of await modal.locator('.od-integration-log-text-action:visible').all()) {
      const colors = await effectiveColors(action)
      expect.soft(contrast(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5)
    }
    for (const span of await modal.locator('pre span').all()) {
      if (!await span.isVisible() || !await span.evaluate(element => element.children.length === 0 && element.textContent.trim())) continue
      const colors = await effectiveColors(span)
      expect.soft(contrast(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5)
    }
    await page.screenshot({ path: testInfo.outputPath(`technical-tables-${mode}.png`), fullPage: false })
  })
}

for (const width of [320, 390]) {
  test.describe(`technical tables at ${width}px coarse pointer`, () => {
    test.use({ viewport: { width, height: 760 }, hasTouch: true, isMobile: true })
    test('RTL tables contain wide data and retain 44px touch actions without page overflow', async ({ page }, testInfo) => {
      await page.goto(fixtureUrl('surface=technical-tables&mode=dark&rtl=true&locale=ar'))
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      const main = page.getByTestId('integration-logs')
      const scrollport = main.locator('[data-slot="integration-log-scrollport"]')
      await scrollport.scrollIntoViewIfNeeded()
      await page.screenshot({ path: testInfo.outputPath(`technical-tables-${width}-before.png`) })
      const metrics = await scrollport.evaluate(element => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }))
      expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth)
      const action = main.getByRole('button', { name: `${translations.VIEW_DETAILS.ar || 'View details'}: order.failed`, exact: true })
      await action.scrollIntoViewIfNeeded()
      const actionBox = await action.boundingBox()
      expect(actionBox.width).toBeGreaterThanOrEqual(44)
      expect(actionBox.height).toBeGreaterThanOrEqual(44)
      await page.touchscreen.tap(actionBox.x + actionBox.width / 2, actionBox.y + actionBox.height / 2)
      await expect(page.getByRole('dialog', { name: translations.LOG.ar || 'Log', exact: true })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      await page.screenshot({ path: testInfo.outputPath(`technical-tables-${width}-after.png`) })
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
    })
  })
}
