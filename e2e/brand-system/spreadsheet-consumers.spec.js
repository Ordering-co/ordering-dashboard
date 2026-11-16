import { test, expect, fixtureUrl } from './fixtures'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: async () => '', writeText: async () => {} } }))
})

test('real translation sheet and controller preserve serialized bulk update and saved text', async ({ page }) => {
  await page.goto(fixtureUrl('surface=spreadsheet-consumers&mode=light'))
  const scope = page.getByTestId('translation-sheet')
  const cell = scope.locator('.ht_master td').filter({ hasText: 'Original greeting' })
  await expect(cell).toBeVisible()
  await cell.dblclick()
  const editor = scope.locator('textarea.handsontableInput:visible')
  await editor.fill('Edited greeting')
  await editor.press('Enter')
  await expect.poll(() => page.evaluate(() => globalThis.__OD_SPREADSHEET_REQUESTS__?.length || 0)).toBe(1)
  const request = await page.evaluate(() => globalThis.__OD_SPREADSHEET_REQUESTS__[0])
  expect(request.method).toBe('PUT')
  expect(Object.keys(request.body)).toEqual(['translations'])
  expect(JSON.parse(request.body.translations)).toEqual([{ id: 71, key: 'FIXTURE_GREETING', text: 'Edited greeting' }])
  await expect(page.getByTestId('translation-state')).toContainText('Edited greeting')
})

test('real product sheet retains hidden cost column, protected ID and edit callback instance', async ({ page }) => {
  await page.goto(fixtureUrl('surface=spreadsheet-consumers&mode=light'))
  const scope = page.getByTestId('product-sheet')
  await expect(scope.locator('.ht_master td').filter({ hasText: 'Fixture product' })).toBeVisible()
  await expect(scope.locator('.ht_master .colHeader').filter({ hasText: 'Product cost' })).toHaveCount(0)
  await scope.locator('.ht_master td').filter({ hasText: 'Fixture product' }).dblclick()
  const editor = scope.locator('textarea.handsontableInput:visible')
  await editor.fill('Renamed product')
  await editor.press('Enter')
  await expect.poll(() => page.evaluate(() => (globalThis.__OD_SPREADSHEET_CONSUMER_EVENTS__ || []).filter(event => event.kind === 'change' && event.args[1] === 'edit'))).toEqual([{ kind: 'change', args: [[[0, 'name', 'Fixture product', 'Renamed product']], 'edit'], instance: true }])
  await expect(scope.locator('.ht_master td .product-id')).toHaveText('81')
})
