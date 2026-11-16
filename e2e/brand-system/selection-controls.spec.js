import { test, expect, fixtureUrl } from './fixtures'
import { tokens } from '../../src/brand/ordering.tokens.generated'

for (const mode of ['light', 'dark']) {
  test(`exported ${mode} switch pieces retain child styling and parent checked colors`, async ({ page }) => {
    await page.goto(fixtureUrl(`surface=fields&mode=${mode}`))
    const input = page.getByLabel('Composed switch', { exact: true })
    const slider = page.getByTestId('composed-switch-slider')
    await expect(slider).toHaveCSS('background-color', 'rgb(100, 110, 120)')
    await expect(slider).toHaveCSS('width', '31px')
    await expect(slider).toHaveCSS('height', '17px')
    expect(await slider.evaluate(element => getComputedStyle(element, '::before').right)).toBe('1px')
    await input.check()
    await expect(slider).toHaveCSS('background-color', 'rgb(18, 52, 86)')
    await expect(slider).toHaveCSS('width', '31px')
    await expect.poll(() => slider.evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element, '::before').transform).e)).toBe(11)
    await input.uncheck()
    await expect(slider).toHaveCSS('background-color', 'rgb(100, 110, 120)')
  })

  test(`owned ${mode} checkbox retains focus and native state when a default value appears`, async ({ page }) => {
    await page.goto(fixtureUrl(`surface=fields&mode=${mode}`))
    const input = page.getByTestId('owned-dynamic-checkbox')
    await input.check()
    await input.evaluate(element => { element.dataset.mountMarker = 'original' })
    await page.getByTestId('update-owned-checkbox-default').click()
    await expect(input).toHaveAttribute('data-mount-marker', 'original')
    await expect(input).toBeChecked()
    await expect(input).toHaveJSProperty('indeterminate', true)
    await expect(input).toBeFocused()
    await expect(input).toHaveJSProperty('value', 'updated-default')
  })

  test(`mounted ${mode} selection controls preserve nodes and state during tenant changes`, async ({ page }) => {
    await page.goto(fixtureUrl(`surface=fields&mode=${mode}`))
    const checkbox = page.locator('.fixture-checkbox-hook')
    const switchInput = page.locator('.fixture-switch-hook input')
    const thumb = page.locator('.fixture-switch-hook span')
    await expect(checkbox).toBeChecked()
    await page.locator('.fixture-switch-hook').click()
    await expect(switchInput).toBeChecked()
    for (const node of [checkbox, switchInput]) await node.evaluate(element => { element.dataset.mountMarker = 'original' })
    await page.getByTestId('update-field-theme').click()
    for (const node of [checkbox, switchInput]) {
      await expect(node).toHaveAttribute('data-mount-marker', 'original')
      await expect(node).toBeChecked()
    }
    await expect(checkbox).toHaveCSS('font-family', 'monospace')
    await expect.poll(() => checkbox.evaluate(element => getComputedStyle(element, '::before').backgroundColor)).toBe('rgb(18, 52, 86)')
    await expect(thumb).toHaveCSS('background-color', 'rgb(18, 52, 86)')
    await expect.poll(() => thumb.evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element, '::before').transform).e)).toBe(-11)
    await expect(page.getByTestId('switch-event')).toHaveText('true')
  })

  test(`real product preview retains independent round checkboxes in ${mode}`, async ({ page }, testInfo) => {
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(fixtureUrl(`surface=product-field-consumer&mode=${mode}&bootstrap=true`))
    await expect(page.getByTestId('product-field-consumer')).toBeVisible()
    const first = page.getByLabel('Round choice A', { exact: true })
    const second = page.getByLabel('Round choice B', { exact: true })
    for (const input of [first, second]) {
      await expect(input).toHaveAttribute('type', 'checkbox')
      await expect(input).not.toBeChecked()
      expect(await input.evaluate(element => element.tagName)).toBe('INPUT')
      await expect(input.locator('..').locator('input')).toHaveCount(1)
    }
    await page.getByText('Round choice A', { exact: true }).click()
    await expect(first).toBeChecked()
    await page.getByText('Round choice B', { exact: true }).click()
    await expect(first).toBeChecked()
    await expect(second).toBeChecked()
    const checkedBackground = `rgb(${tokens.theme[mode].semantic.action.default.slice(1).match(/../g).map(part => parseInt(part, 16)).join(', ')})`
    for (const input of [first, second]) {
      await expect.poll(() => input.evaluate(element => getComputedStyle(element, '::before').backgroundColor)).toBe(checkedBackground)
    }
    await page.screenshot({ path: testInfo.outputPath(`product-round-checkboxes-${mode}.png`) })
    await second.focus()
    await page.keyboard.press('Space')
    await expect(second).not.toBeChecked()
    await expect(first).toBeChecked()
    expect(errors).toEqual([])
  })
}
