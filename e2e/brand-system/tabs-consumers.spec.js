import { test, expect, fixtureUrl } from './fixtures'

// Lot 5.12: removed the four tests of the BusinessTaxAndFees and
// EditTaxManager consumers (both moved onto Product wrappers and no longer render
// the Shared Tabs; EditTaxManager lost its «Change by order types» modal) and
// their two fixture sections. The focus / external active state / Enter and the
// 44px target at 320px RTL stay proven, now on the stateful Shared Tabs probe.
// Tests 9 -> 5 (the probe test also presses Space, as the removed Symbol-backed test did).

const action = async (scope, name) => {
  const semantic = scope.getByRole('button', { name, exact: true })
  return await semantic.count() ? semantic : scope.getByText(name, { exact: true })
}

for (const mode of ['light', 'dark']) {
  test(`Shared Tabs inherit inactive parent weight in ${mode}`, async ({ page }) => {
    await page.goto(fixtureUrl(`surface=tabs-consumers&mode=${mode}`))
    const scope = page.getByTestId('tabs-weight-probe')
    await expect(await action(scope, 'Inherited')).toHaveCSS('font-weight', '600')
    await expect(await action(scope, 'Active')).toHaveCSS('font-weight', '500')
  })

  test(`Shared Tabs keep focus and external active state in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(fixtureUrl(`surface=tabs-consumers&mode=${mode}`))
    const scope = page.getByTestId('tabs-state-probe')
    const first = await action(scope, 'First')
    const second = await action(scope, 'Second')
    await expect(first).toHaveAttribute('aria-pressed', 'true')
    await expect(second).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByTestId('tabs-state-panel')).toHaveText('First panel')
    await second.focus()
    await expect(second).toBeFocused()
    await expect(second).toHaveCSS('outline-width', '2px')
    await page.keyboard.press('Enter')
    await expect(second).toHaveAttribute('aria-pressed', 'true')
    await expect(first).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByTestId('tabs-state-panel')).toHaveText('Second panel')
    await first.focus()
    await page.keyboard.press('Space')
    await expect(first).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('tabs-state-panel')).toHaveText('First panel')
    await page.screenshot({ path: testInfo.outputPath(`shared-tabs-${mode}.png`), fullPage: false })
  })
}

test.describe('Shared Tabs at 320px RTL', () => {
  test.use({ viewport: { width: 320, height: 820 }, hasTouch: true, isMobile: true })

  test('keeps the tab group reachable with 44px targets and no page overflow', async ({ page }, testInfo) => {
    await page.goto(fixtureUrl('surface=tabs-consumers&mode=dark&rtl=true'))
    const probe = page.getByTestId('tabs-state-probe')
    for (const label of ['First', 'Second']) {
      const box = await (await action(probe, label)).boundingBox()
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
    }
    const geometry = await page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth, dir: document.documentElement.dir }))
    expect(geometry.dir).toBe('rtl')
    expect(geometry.scroll).toBeLessThanOrEqual(geometry.viewport)
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('shared-tabs-rtl320.png'), fullPage: false })
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
  })
})
