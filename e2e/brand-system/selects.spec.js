import { test, expect, fixtureUrl } from './fixtures'
import { tokens } from '../../src/brand/ordering.tokens.generated'

const rgb = hex => `rgb(${hex.slice(1).match(/../g).map(part => parseInt(part, 16)).join(', ')})`
const parseRgb = color => color.match(/[\d.]+/g).slice(0, 3).map(Number)
const luminance = color => parseRgb(color).map(value => value / 255)
  .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
const contrast = (foreground, background) => {
  const a = luminance(foreground)
  const b = luminance(background)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
const composite = (foreground, background, opacity) => {
  const foregroundRgb = parseRgb(foreground)
  const backgroundRgb = parseRgb(background)
  return `rgb(${foregroundRgb.map((value, index) => Math.round(value * opacity + backgroundRgb[index] * (1 - opacity))).join(', ')})`
}

const trigger = scope => scope.locator('[role="button"][aria-expanded]').first()
const option = (scope, name) => scope.getByRole('option', { name, exact: true })
const clickCenter = async (page, locator) => {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
}
const pageGeometry = page => page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth }))
const effectiveColors = locator => locator.evaluate(element => {
  const style = getComputedStyle(element)
  let background = style.backgroundColor
  let current = element
  while ((background === 'transparent' || background === 'rgba(0, 0, 0, 0)') && current.parentElement) {
    current = current.parentElement
    background = getComputedStyle(current).backgroundColor
  }
  return { color: style.color, background, outline: style.outlineColor }
})
const placeholderColors = locator => locator.evaluate(element => {
  const style = getComputedStyle(element, '::placeholder')
  let current = element
  let background = getComputedStyle(current).backgroundColor
  while ((background === 'transparent' || background === 'rgba(0, 0, 0, 0)') && current.parentElement) {
    current = current.parentElement
    background = getComputedStyle(current).backgroundColor
  }
  return { color: style.color, background }
})
const standardHook = scope => scope.locator('.select, .multi-select').first()
const standardTrigger = scope => standardHook(scope).locator(':scope > div:first-child')

for (const mode of ['light', 'dark']) {
  test(`legacy Popper ${mode} retains minimum keyboard behavior and native tab stops`, async ({ page }) => {
    await page.goto(fixtureUrl(`surface=selects&mode=${mode}`))
    const main = page.getByTestId('popper-main')
    const header = trigger(main)
    await header.focus()
    await page.keyboard.press('b')
    await expect(page.getByTestId('popper-receipt')).toHaveText('null')
    await expect(header).toContainText('Alpha option')
    for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End']) {
      await header.press(key)
      await expect(header).toHaveAttribute('aria-expanded', 'false')
    }
    await page.keyboard.down('Space')
    await expect(header).toHaveAttribute('aria-expanded', 'true')
    await page.keyboard.up('Space')
    await expect(header).toHaveAttribute('aria-expanded', 'true')
    await page.keyboard.press('Escape')
    await expect(header).toHaveAttribute('aria-expanded', 'false')
    await header.press('Enter')
    await expect(main.getByRole('listbox').first()).toBeVisible()
    await expect(header).toBeFocused()
    const alpha = option(main, 'Alpha option')
    const beta = option(main, 'Beta option with an exceptionally long translated label')
    await expect(alpha).toHaveAttribute('tabindex', '0')
    await expect(beta).toHaveAttribute('tabindex', '0')
    await expect(option(main, 'Disabled option')).toHaveAttribute('tabindex', '-1')
    await page.keyboard.press('Tab')
    await expect(main.getByPlaceholder('Search Popper options')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(alpha).toBeFocused()
    for (const key of ['ArrowDown', 'b']) {
      await alpha.press(key)
      await expect(alpha).toBeFocused()
      await expect(page.getByTestId('popper-receipt')).toHaveText('null')
    }
    await beta.hover()
    await expect(alpha).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(beta).toBeFocused()
    await beta.press('Enter')
    await expect(page.getByTestId('popper-receipt')).toHaveText('beta')
    await expect(header).toBeFocused()
  })
}

for (const mode of ['light', 'dark']) {
  test(`legacy Popper ${mode} preserves keyboard entry and exit while the list stays open`, async ({ page }) => {
    await page.goto(fixtureUrl(`surface=selects&mode=${mode}`))
    const scope = page.getByTestId('popper-no-selected')
    const header = trigger(scope)
    await header.press('Enter')
    await page.keyboard.press('Tab')
    await expect(option(scope, 'Alpha option')).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(header).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(option(scope, 'Alpha option')).toBeFocused()
    await page.keyboard.press('Tab')
    const beta = option(scope, 'Beta option with an exceptionally long translated label')
    await expect(beta).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(trigger(page.getByTestId('popper-not-async'))).toBeFocused()
    await expect(header).toHaveAttribute('aria-expanded', 'true')
    await page.keyboard.press('Shift+Tab')
    await expect(beta).toBeFocused()
  })
}

test('Popper Select preserves scalar, noSelected, notAsync, search, custom, and pagination contracts', async ({ page }) => {
  await page.goto(fixtureUrl('surface=selects&mode=light'))
  const main = page.getByTestId('popper-main')
  const mainTrigger = trigger(main)
  await mainTrigger.focus()
  await page.keyboard.press('Enter')
  await expect(mainTrigger).toHaveAttribute('aria-expanded', 'true')
  await expect(main.locator('[role="listbox"]').first()).toBeVisible()
  await expect(option(main, 'Disabled option')).toHaveAttribute('aria-disabled', 'true')
  await clickCenter(page, option(main, 'Disabled option'))
  await expect(page.getByTestId('popper-receipt')).toHaveText('null')
  await option(main, 'Beta option with an exceptionally long translated label').focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('popper-receipt')).toHaveText('beta')
  await expect(mainTrigger).toBeFocused()
  await expect(mainTrigger).toContainText('Beta option with an exceptionally long translated label')

  await mainTrigger.click()
  const search = main.getByPlaceholder('Search Popper options')
  await search.fill('alp')
  await page.waitForTimeout(700)
  await expect(page.getByTestId('popper-search')).toHaveText('')
  await page.waitForTimeout(100)
  await expect(page.getByTestId('popper-search')).toHaveText('alp')
  await page.mouse.click(4, 4)
  await expect(page.getByTestId('popper-search')).toHaveText('')
  await expect(mainTrigger).toHaveAttribute('aria-expanded', 'false')

  await mainTrigger.click()
  await option(main, 'Create custom option').click()
  await expect(page.getByTestId('custom-count')).toHaveText('1')
  await expect(page.getByTestId('popper-receipt')).toHaveText('beta')

  const noSelected = page.getByTestId('popper-no-selected')
  const noSelectedTrigger = trigger(noSelected)
  await noSelectedTrigger.click()
  await option(noSelected, 'Beta option with an exceptionally long translated label').click()
  await expect(page.getByTestId('no-selected-receipt')).toHaveText('beta')
  await expect(noSelectedTrigger).toContainText('Alpha option')

  const notAsync = page.getByTestId('popper-not-async')
  await notAsync.getByRole('button', { name: 'Change Popper prop' }).click()
  await expect(trigger(notAsync)).toContainText('Alpha option')

  const local = page.getByTestId('popper-local')
  await trigger(local).click()
  await expect(local.getByRole('option')).toHaveCount(2)
  await page.mouse.click(4, 4)
  const lazy = page.getByTestId('popper-lazy')
  await trigger(lazy).click()
  await expect(lazy.getByRole('option')).toHaveCount(4)
})

test('FirstSelect preserves loading, disabled, edit, delete, scalar, and pagination branches', async ({ page }) => {
  await page.goto(fixtureUrl('surface=selects&mode=light'))
  const disabled = page.getByTestId('first-disabled')
  await expect(trigger(disabled)).toHaveAttribute('aria-disabled', 'true')
  await expect(trigger(disabled)).toHaveCSS('pointer-events', 'none')

  const loading = page.getByTestId('first-loading')
  await trigger(loading).click()
  await expect(loading.locator('.react-loading-skeleton')).toHaveCount(3)

  const main = page.getByTestId('first-main')
  const mainTrigger = trigger(main)
  await mainTrigger.focus()
  await page.keyboard.down('Space')
  await expect(mainTrigger).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.up('Space')
  await expect(mainTrigger).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Tab')
  await expect(main.getByPlaceholder('Search First options')).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(mainTrigger).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(main.getByPlaceholder('Search First options')).toBeFocused()
  const beta = main.getByRole('option').filter({ hasText: 'Beta editable' })
  await expect(beta.getByRole('button', { name: 'Edit', exact: true })).not.toHaveAttribute('type')
  await beta.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(page.getByTestId('edit-receipt')).toHaveText('beta:1')
  await expect(page.getByTestId('first-submits')).toHaveText('0')
  await expect(page.getByTestId('first-receipt')).toHaveText('null')
  await mainTrigger.click()
  await expect(beta.getByRole('button', { name: 'Delete', exact: true })).toHaveAttribute('type', 'button')
  await beta.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByTestId('delete-receipt')).toHaveText('beta')
  await expect(page.getByTestId('first-receipt')).toHaveText('null')
  await mainTrigger.click()
  await beta.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('first-receipt')).toHaveText('beta')
  await expect(mainTrigger).toBeFocused()

  await mainTrigger.click()
  await main.getByPlaceholder('Search First options').fill('editable')
  await page.waitForTimeout(800)
  await expect(page.getByTestId('first-search')).toHaveText('editable')
  await main.getByRole('button', { name: 'Page 2', exact: true }).click()
  await expect(page.getByTestId('first-page')).toHaveText('2')
  await page.keyboard.press('Escape')
  await expect(mainTrigger).toHaveAttribute('aria-expanded', 'false')
  await expect(mainTrigger).toBeFocused()

  const noSelected = page.getByTestId('first-no-selected')
  await trigger(noSelected).click()
  await option(noSelected, 'Beta option with an exceptionally long translated label').click()
  await expect(page.getByTestId('first-no-selected-receipt')).toHaveText('beta')
  await expect(trigger(noSelected)).toContainText('Alpha option')
  const notAsync = page.getByTestId('first-not-async')
  await notAsync.getByRole('button', { name: 'Change First prop' }).click()
  await expect(trigger(notAsync)).toContainText('Alpha option')
})

for (const mode of ['light', 'dark']) {
  for (const rtl of [false, true]) {
    test(`FirstSelect preserves styled consumer geometry, minimum keys and close boundaries in ${mode} rtl=${rtl}`, async ({ page }, testInfo) => {
      await page.goto(fixtureUrl(`surface=selects&mode=${mode}&rtl=${rtl}`))
      const owner = page.getByTestId('first-owner-styles')
      const control = owner.locator(':scope > .select')
      await expect(control).toHaveCount(1)
      await trigger(owner).press('Enter')
      await expect(trigger(owner)).toBeFocused()
      const list = control.locator(':scope > .list')
      await expect(list.locator(':scope > .list-wrapper')).toHaveCount(1)
      expect(await trigger(owner).evaluate(element => {
        const controls = element.getAttribute('aria-controls')
        return !controls || document.getElementById(controls) === element.parentElement.querySelector('.list')
      })).toBe(true)
      const controlBox = await control.boundingBox()
      const listBox = await list.boundingBox()
      expect(Math.abs(controlBox.width - listBox.width)).toBeLessThanOrEqual(2)
      expect(Math.abs(listBox.y - (controlBox.y + controlBox.height) - 6)).toBeLessThanOrEqual(2)
      const ownerLabel = option(owner, 'Beta option with an exceptionally long translated label').locator(':scope > div')
      await expect(ownerLabel).toHaveCSS('text-overflow', 'ellipsis')
      await expect(ownerLabel).toHaveCSS('overflow', 'hidden')
      await page.screenshot({ path: testInfo.outputPath(`first-owner-${mode}-rtl-${rtl}.png`) })
      await page.keyboard.press('Tab')
      await expect(option(owner, 'Alpha option')).toBeFocused()
      await page.keyboard.press('b')
      await expect(option(owner, 'Alpha option')).toBeFocused()
      await page.keyboard.press('Shift+Tab')
      await expect(trigger(owner)).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(option(owner, 'Alpha option')).toBeFocused()
      await page.keyboard.press('Tab')
      const ownerBeta = option(owner, 'Beta option with an exceptionally long translated label')
      await expect(ownerBeta).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(trigger(page.getByTestId('multi-main'))).toBeFocused()
      await page.keyboard.press('Shift+Tab')
      await expect(ownerBeta).toBeFocused()
      await page.keyboard.press('Escape')
      await expect(trigger(owner)).toBeFocused()
      await expect(list).toHaveCount(0)

      const main = page.getByTestId('first-main')
      await expect(main.locator('.fixture-first-main')).not.toHaveClass(/(?:^|\s)select(?:\s|$)/)
      await trigger(main).click()
      const search = main.getByPlaceholder('Search First options')
      await search.fill('draft')
      await expect(page.getByTestId('first-search')).toHaveText('draft')
      await search.press('Escape')
      await expect(page.getByTestId('first-search')).toHaveText('draft')
      await expect(search).toHaveCount(0)
      await trigger(main).click()
      // Main (804768e2, ): SearchBar shows a search set from outside on mount (never while typing), so the remount reflects the retained value.
      await expect(search).toHaveValue('draft')
      await expect(page.getByTestId('first-search')).toHaveText('draft')
      await page.mouse.click(4, 4)
      await expect(page.getByTestId('first-search')).toHaveText('')
      await expect(trigger(main)).toHaveAttribute('aria-expanded', 'false')

      const noSelected = page.getByTestId('first-no-selected')
      for (const count of [1, 2]) {
        await trigger(noSelected).click()
        await option(noSelected, 'Beta option with an exceptionally long translated label').click()
        await expect(page.getByTestId('first-no-selected-calls')).toHaveText(String(count))
        await expect(trigger(noSelected)).toContainText('Alpha option')
      }
      await trigger(noSelected).click()
      await expect(option(noSelected, 'Hidden option')).toBeHidden()
      await clickCenter(page, option(noSelected, 'Null option'))
      await expect(trigger(noSelected)).toHaveAttribute('aria-expanded', 'false')
      await expect(page.getByTestId('first-no-selected-calls')).toHaveText('2')
    })
  }
}

for (const mode of ['light', 'dark']) {
  for (const rtl of [false, true]) {
    test(`FirstSelect keeps case-insensitive placement in ${mode} rtl=${rtl}`, async ({ page }) => {
      for (const side of ['left', 'right']) {
        const boxes = []
        for (const value of [side, side.toUpperCase()]) {
          await page.goto(fixtureUrl(`surface=selects&mode=${mode}&rtl=${rtl}&firstPosition=${value}`))
          await page.evaluate(() => document.fonts.ready)
          const scope = page.getByTestId('first-no-selected')
          await trigger(scope).click()
          boxes.push(await scope.locator('.list').boundingBox())
        }
        for (const key of ['x', 'y', 'width', 'height']) {
          expect(Math.abs(boxes[0][key] - boxes[1][key])).toBeLessThanOrEqual(0.5)
        }
      }
    })
  }
}

test('MultiSelect, SearchBar, and Pagination preserve their callback payloads and form behavior', async ({ page }) => {
  await page.goto(fixtureUrl('surface=selects&mode=light'))
  const multi = page.getByTestId('multi-main')
  const multiTrigger = trigger(multi)
  await multiTrigger.focus()
  await page.keyboard.press('Enter')
  await expect(option(multi, 'All values')).toHaveAttribute('aria-disabled', 'true')
  await clickCenter(page, option(multi, 'All values'))
  await expect(page.getByTestId('multi-receipt')).toHaveText('null')
  await option(multi, 'Beta option with an exceptionally long translated label').click()
  await expect(page.getByTestId('multi-receipt')).toHaveText('beta')
  const chipRemove = multi.getByRole('button', { name: 'Remove beta', exact: true })
  await expect(chipRemove).toHaveAttribute('type', 'reset')
  const chipBox = await chipRemove.boundingBox()
  const controlBox = await multi.locator('.fixture-multi-main').boundingBox()
  expect(chipBox.x + chipBox.width, JSON.stringify({ chipBox, controlBox })).toBeLessThanOrEqual(controlBox.x + controlBox.width)
  await page.getByRole('textbox', { name: 'Multi reset witness' }).fill('edited')
  await chipRemove.click()
  // The removed reset button is disconnected before native default activation.
  await expect(page.getByTestId('multi-resets')).toHaveText('0')
  await expect(page.getByRole('textbox', { name: 'Multi reset witness' })).toHaveValue('edited')
  await expect(page.getByTestId('multi-receipt')).toHaveText('beta')
  await expect(page.getByTestId('multi-submits')).toHaveText('0')
  await page.keyboard.press('Escape')
  await expect(multiTrigger).toHaveAttribute('aria-expanded', 'false')
  await expect(multiTrigger).toBeFocused()
  await expect(page.getByTestId('multi-text')).toContainText('plus 1 +')
  const loading = page.getByTestId('multi-loading')
  await trigger(loading).click()
  await page.mouse.click(4, 4)
  await expect(trigger(loading)).toHaveAttribute('aria-expanded', 'true')
  await trigger(loading).click()
  await expect(trigger(loading)).toHaveAttribute('aria-expanded', 'false')

  const immediate = page.getByTestId('search-immediate').getByRole('textbox')
  await immediate.fill('instant')
  await expect(page.getByTestId('immediate-search')).toHaveText('instant')
  const clear = page.getByTestId('search-immediate').getByRole('button', { name: 'Clear search', exact: true })
  await expect(clear).toHaveCSS('opacity', '1')
  const clearColors = await effectiveColors(clear)
  const clearOpacity = Number(await clear.evaluate(element => getComputedStyle(element).opacity))
  expect(clearOpacity).toBe(1)
  expect(contrast(composite(clearColors.color, clearColors.background, clearOpacity), clearColors.background)).toBeGreaterThanOrEqual(3)
  await clear.click()
  await expect(page.getByTestId('immediate-search')).toHaveText('')
  await expect(immediate).toHaveValue('')
  await expect(immediate).toBeFocused()

  const lazy = page.getByTestId('search-lazy').getByRole('textbox')
  await lazy.fill('delayed')
  await page.waitForTimeout(700)
  await expect(page.getByTestId('lazy-search')).toHaveText('')
  await page.waitForTimeout(100)
  await expect(page.getByTestId('lazy-search')).toHaveText('delayed')
  await expect(page.getByTestId('custom-search-input')).toHaveAttribute('name', 'search')
  await expect(page.getByTestId('custom-search-input')).toHaveAttribute('autocomplete', 'off')

  const pagination = page.getByTestId('pagination-main')
  await expect(pagination.getByText('...', { exact: true })).toHaveCount(2)
  const active = pagination.getByRole('button', { name: 'Page 5', exact: true })
  await expect(active).toHaveAttribute('aria-current', 'page')
  await active.click()
  await expect(page.getByTestId('page-receipt')).toHaveText('null')
  await pagination.getByRole('button', { name: 'Previous page', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('page-receipt')).toHaveText('4')
  const sizeTrigger = trigger(pagination)
  await sizeTrigger.click()
  await option(pagination, '25').click()
  await expect(page.getByTestId('page-size')).toHaveText('25')
  await expect(page.getByTestId('pagination-hidden').getByText('Items per page')).toHaveCount(0)
})

for (const mode of ['light', 'dark']) {
  test(`Select cluster uses governed ${mode} roles and visible focus`, async ({ page }, testInfo) => {
    await page.goto(fixtureUrl(`surface=selects&mode=${mode}`))
    const scopes = [page.getByTestId('popper-main'), page.getByTestId('first-main'), page.getByTestId('multi-main')]
    await expect(page.getByTestId('popper-main')).toHaveCSS('overflow', 'visible')
    await page.keyboard.press('Tab')
    await trigger(page.getByTestId('popper-main')).focus()
    await page.screenshot({ path: testInfo.outputPath(`selects-${mode}-popper-focus.png`), fullPage: true })
    for (const scope of scopes) {
      const control = trigger(scope)
      const colors = await effectiveColors(control)
      // FirstSelect deliberately exercises its primary (soft action) variant.
      const background = await scope.getAttribute('data-testid') === 'first-main'
        ? tokens.theme[mode].semantic.action.soft
        : tokens.theme[mode].semantic.surface.default
      expect(colors.background).toBe(rgb(background))
      expect(contrast(colors.color, colors.background)).toBeGreaterThanOrEqual(4.5)
      await page.keyboard.press('Tab')
      await control.focus()
      await expect(control).toHaveCSS('outline-width', tokens.component.focusRing.width)
      await expect(control).toHaveCSS('outline-offset', tokens.component.focusRing.offset)
      const focused = await effectiveColors(control)
      expect(contrast(focused.outline, focused.background)).toBeGreaterThanOrEqual(3)
      await control.click()
      // MultiSelect starts with an unselected "All values" sentinel.
      const selected = scope.getByRole('option').filter({ hasText: /^Alpha/ })
      await expect(selected).toBeVisible()
      await expect(selected).toHaveAttribute('aria-selected', 'true')
      await page.keyboard.press('Escape')
      await expect(control).toHaveAttribute('aria-expanded', 'false')
    }
    await expect(page.getByTestId('first-disabled').locator('.select')).toHaveCSS('background-color', rgb(tokens.theme[mode].semantic.surface.subtle))
    const loading = page.getByTestId('first-loading')
    await trigger(loading).click()
    await expect(loading.locator('.react-loading-skeleton')).toHaveCount(3)
    const placeholder = await placeholderColors(page.getByTestId('search-immediate').getByRole('textbox'))
    expect(contrast(placeholder.color, placeholder.background)).toBeGreaterThanOrEqual(4.5)
    for (const standard of ['standard-popper', 'standard-first', 'standard-multi']) {
      expect((await page.getByTestId(standard).locator('.select, .multi-select').first().boundingBox()).height).toBeGreaterThanOrEqual(parseFloat(tokens.component.density.compactControlHeight))
    }
    await page.screenshot({ path: testInfo.outputPath(`selects-${mode}-open.png`), fullPage: true })
  })

  test(`Select cluster ${mode} reflows at 320px, zooms, mirrors RTL, and reduces motion`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 320, height: 900 })
    await page.goto(fixtureUrl(`surface=selects&mode=${mode}&rtl=true`))
    await expect(page.getByTestId('selects-fixture')).toBeVisible()
    let geometry = await pageGeometry(page)
    expect(geometry.scroll).toBeLessThanOrEqual(geometry.viewport)
    const first = page.getByTestId('first-main')
    await trigger(first).click()
    const list = first.locator('.list')
    // Compare actual mirrored alignment, including the existing border offset.
    const listBox = await list.boundingBox()
    const firstBox = await first.locator('.fixture-first-main').boundingBox()
    expect(Math.abs(listBox.x - firstBox.x)).toBeLessThanOrEqual(2)
    await expect(trigger(first)).toHaveCSS('transition-duration', '0s')
    await expect(first.getByRole('option').filter({ hasText: 'Beta editable' })).toHaveCSS('transition-duration', '0s')
    for (const id of ['multi-main', 'multi-text']) {
      await expect(trigger(page.getByTestId(id))).toHaveCSS('padding-left', '9px')
      await expect(trigger(page.getByTestId(id))).toHaveCSS('padding-right', '9px')
    }

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(fixtureUrl(`surface=selects&mode=${mode}&rtl=true`))
    await page.evaluate(() => { document.documentElement.style.zoom = '2' })
    geometry = await pageGeometry(page)
    expect(geometry.scroll).toBeLessThanOrEqual(geometry.viewport)
  })
}

for (const mode of ['light', 'dark']) {
  test(`StandardField ${mode} scopes real selectors and updates its own theme at RTL 320px`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 })
    await page.goto(fixtureUrl(`surface=selects&mode=${mode}&rtl=true`))
    const geometry = await pageGeometry(page)
    expect(geometry.viewport).toBe(320)
    expect(geometry.scroll).toBeLessThanOrEqual(geometry.viewport)

    for (const id of ['standard-popper', 'standard-first', 'standard-multi']) {
      const scope = page.getByTestId(id)
      const hook = standardHook(scope)
      const control = standardTrigger(scope)
      const scopeBox = await scope.boundingBox()
      const hookBox = await hook.boundingBox()
      expect(Math.abs(scopeBox.width - hookBox.width)).toBeLessThanOrEqual(1)
      await expect(hook).toHaveCSS('box-sizing', 'border-box')
      await expect(control).toHaveCSS('min-height', '32px')
      await expect(control).toHaveCSS('justify-content', 'space-between')
    }
    const multiControl = standardTrigger(page.getByTestId('standard-multi'))
    await expect(multiControl).toHaveCSS('display', 'flex')
    await expect(multiControl).toHaveCSS('align-items', 'center')

    const themedScope = page.getByTestId('standard-themed')
    const themedHook = standardHook(themedScope)
    const themedControl = standardTrigger(themedScope)
    await expect(themedHook).toHaveCSS('font-family', '"Standard Parent One", system-ui')
    await expect(themedControl).toHaveCSS('min-height', '36px')
    expect(await themedHook.evaluate(element => getComputedStyle(element).getPropertyValue('--od-first-select-font'))).not.toContain('Standard Parent')
    await themedScope.evaluate(element => { window.__standardFieldNode = element })
    await page.getByTestId('standard-theme-toggle').click()
    await expect(page.getByTestId('standard-theme-name')).toHaveText('two')
    expect(await themedScope.evaluate(element => element === window.__standardFieldNode)).toBe(true)
    await expect(themedHook).toHaveCSS('font-family', '"Standard Parent Two", system-ui')
    await expect(themedControl).toHaveCSS('min-height', '38px')

    for (const id of ['standard-similar-select-child', 'standard-similar-multi-child', 'standard-outside-select-child', 'standard-outside-multi-child']) {
      const child = page.getByTestId(id)
      await expect(child).toHaveCSS('min-height', '0px')
      await expect(child).toHaveCSS('display', 'block')
      await expect(child).toHaveCSS('justify-content', 'normal')
    }
  })
}

test.describe('coarse StandardField targets', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 320, height: 844 } })

  for (const mode of ['light', 'dark']) {
    test(`StandardField ${mode} keeps 44px controls and parent density in RTL coarse mode`, async ({ page }) => {
      await page.goto(fixtureUrl(`surface=selects&mode=${mode}&rtl=true`))
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      for (const id of ['standard-popper', 'standard-first', 'standard-multi']) {
        await expect(standardTrigger(page.getByTestId(id))).toHaveCSS('min-height', '44px')
      }
      const themedScope = page.getByTestId('standard-themed')
      const themedControl = standardTrigger(themedScope)
      await expect(themedControl).toHaveCSS('min-height', '52px')
      await page.getByTestId('standard-theme-toggle').click()
      await expect(themedControl).toHaveCSS('min-height', '54px')
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
    })
  }
})

for (const mode of ['light', 'dark']) {
  test(`SearchBar ${mode} keeps native input identity, implicit submit and clear focus`, async ({ page }) => {
    await page.goto(fixtureUrl(`surface=selects&mode=${mode}`))
    const form = page.getByTestId('search-immediate')
    const input = form.getByRole('textbox')
    await expect(input).not.toHaveAttribute('id')
    await expect(input).not.toHaveAttribute('value')
    await input.evaluate(element => { window.__searchNativeNode = element })
    await input.fill('native-enter')
    await expect(page.getByTestId('immediate-search')).toHaveText('native-enter')
    expect(await input.evaluate(element => element === window.__searchNativeNode)).toBe(true)
    await input.press('Enter')
    await expect(page.getByTestId('search-submits')).toHaveText('1')
    await expect(page.getByTestId('search-form-data')).toHaveText('[["search","native-enter"]]')
    const clear = form.getByRole('button', { name: 'Clear search', exact: true })
    await expect(clear).toHaveAttribute('type', 'button')
    await clear.focus()
    await clear.press('Space')
    await expect(input).toHaveValue('')
    await expect(input).toBeFocused()
    await expect(page.getByTestId('search-submits')).toHaveText('1')
    await expect(page.getByTestId('immediate-search')).toHaveText('')
    expect(await input.evaluate(element => element === window.__searchNativeNode)).toBe(true)
  })
}

for (const mode of ['light', 'dark']) {
  test(`SearchBar ${mode} applies derived attrs after direct custom-input props`, async ({ page }) => {
    await page.goto(fixtureUrl(`surface=selects&mode=${mode}`))
    await expect(page.getByRole('textbox', { name: 'Final custom search style' })).toHaveCSS('min-height', 'auto')
    await expect(page.getByRole('textbox', { name: 'Final default search style' })).toHaveCSS('min-height', '32px')
  })
}

test.describe('SearchBar coarse content space', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 320, height: 844 } })
  for (const rtl of [false, true]) {
    test(`SearchBar reserves the clear target beside long input text rtl=${rtl}`, async ({ page }, testInfo) => {
      await page.goto(fixtureUrl(`surface=selects&mode=light&rtl=${rtl}`))
      const scope = page.getByTestId('search-immediate')
      const input = scope.getByRole('textbox')
      await input.fill('A long search query with a visible final word: ENDING')
      const clear = scope.getByRole('button', { name: 'Clear search' })
      const fieldBox = await input.boundingBox()
      const clearBox = await clear.boundingBox()
      const padding = await input.evaluate(element => {
        const style = getComputedStyle(element)
        return { left: parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth), right: parseFloat(style.paddingRight) + parseFloat(style.borderRightWidth) }
      })
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      await scope.screenshot({ path: testInfo.outputPath(`default-search-coarse-${rtl}.png`) })
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      if (rtl) expect(fieldBox.x + padding.left).toBeGreaterThanOrEqual(clearBox.x + clearBox.width)
      else expect(fieldBox.x + fieldBox.width - padding.right).toBeLessThanOrEqual(clearBox.x)
    })
  }
})

for (const mode of ['light', 'dark']) {
  test(`Pagination ${mode} preserves governed hover and disabled backgrounds`, async ({ page }) => {
    await page.goto(fixtureUrl(`surface=selects&mode=${mode}`))
    const scope = page.getByTestId('pagination-main')
    await expect(trigger(scope)).toHaveCSS('border-color', rgb(tokens.theme[mode].semantic.border.strong))
    await scope.getByRole('button', { name: 'Page 5', exact: true }).hover()
    await expect(scope.getByRole('button', { name: 'Page 5', exact: true })).toHaveCSS('background-color', rgb(tokens.theme[mode].semantic.action.hover))
    await scope.getByRole('button', { name: 'Page 1', exact: true }).click()
    const previous = scope.getByRole('button', { name: 'Previous page', exact: true })
    await expect(previous).toBeDisabled()
    await previous.hover()
    await previous.evaluate(async element => {
      getComputedStyle(element).backgroundColor
      await Promise.all(element.getAnimations().filter(animation => Number.isFinite(animation.effect.getComputedTiming().endTime)).map(animation => animation.finished.catch(() => {})))
    })
    await expect(previous).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expect(page.getByTestId('page-receipt')).toHaveText('1')
  })
}

test('Pagination native polymorphism keeps as styling, forwardedAs refs and form types', async ({ page }) => {
  await page.goto(fixtureUrl('surface=selects&mode=light'))
  for (const family of ['numbered', 'compact']) {
    const anchor = page.getByTestId(`pager-${family}-as`)
    const button = page.getByTestId(`pager-${family}-forwarded`)
    expect(await anchor.evaluate(element => element.tagName)).toBe('A')
    await expect(anchor).toHaveCSS('border-radius', '999px')
    await expect(anchor).toHaveCSS('min-height', '32px')
    expect(await button.evaluate(element => element.tagName)).toBe('BUTTON')
    await expect(button).toHaveAttribute('as', 'a')
  }
  const numbered = page.getByTestId('pager-numbered-forwarded')
  const compact = page.getByTestId('pager-compact-forwarded')
  await expect(numbered).toHaveAttribute('type', 'button')
  await expect(compact).not.toHaveAttribute('type')
  expect(await compact.evaluate(element => element === window.__paginationButtonRef)).toBe(true)
  await numbered.click()
  await expect(page.getByTestId('pagination-probe-submits')).toHaveText('0')
  await compact.click()
  await expect(page.getByTestId('pagination-probe-submits')).toHaveText('1')
  expect(await compact.evaluate(element => element === window.__paginationButtonRef)).toBe(true)
})

test('tenant action remains exact for selected options and current pages', async ({ page }) => {
  await page.goto(fixtureUrl('surface=selects&mode=light&tenant=%23123456'))
  await expect(page.getByTestId('resolved-action')).toHaveText('#123456')
  const pagination = page.getByTestId('pagination-main')
  await expect(pagination.getByRole('button', { name: 'Page 5', exact: true })).toHaveCSS('background-color', 'rgb(18, 52, 86)')
  const popper = page.getByTestId('popper-main')
  await trigger(popper).click()
  await expect(option(popper, 'Alpha option')).toHaveCSS('color', 'rgb(18, 52, 86)')
})

test.describe('coarse select targets', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })

  for (const mode of ['light', 'dark']) {
    test(`headers, options, search clear, and page controls expose 44px targets in ${mode}`, async ({ page }) => {
      await page.goto(fixtureUrl(`surface=selects&mode=${mode}`))
      for (const scope of [page.getByTestId('popper-main'), page.getByTestId('first-main'), page.getByTestId('multi-main')]) {
        const control = trigger(scope)
        const box = await control.boundingBox()
        expect(box.height).toBeGreaterThanOrEqual(44)
        expect(box.width).toBeGreaterThanOrEqual(44)
        await control.click()
        const optionBox = await scope.getByRole('option').first().boundingBox()
        expect(optionBox.height).toBeGreaterThanOrEqual(44)
        // Finish measuring the open popup before moving to the next control;
        // its legitimate overlay can cover that control on a narrow viewport.
        await page.keyboard.press('Escape')
        await expect(control).toHaveAttribute('aria-expanded', 'false')
      }
      const search = page.getByTestId('search-immediate')
      await search.getByRole('textbox').fill('clear me')
      const clearBox = await search.getByRole('button', { name: 'Clear search', exact: true }).boundingBox()
      expect(clearBox.height).toBeGreaterThanOrEqual(44)
      expect(clearBox.width).toBeGreaterThanOrEqual(44)
      const pagination = page.getByTestId('pagination-main')
      for (const control of await pagination.getByRole('button').all()) {
        const box = await control.boundingBox()
        expect(box.height).toBeGreaterThanOrEqual(44)
        expect(box.width).toBeGreaterThanOrEqual(44)
      }
    })
  }
})

for (const mode of ['light', 'dark']) {
  test(`MultiSelect ${mode} preserves chip keys, form effects, native Tab and option sentinels`, async ({ page }) => {
    await page.goto(fixtureUrl(`surface=selects&mode=${mode}`))
    const scope = page.getByTestId('multi-main')
    const control = trigger(scope)
    await control.focus()
    await page.keyboard.down('Space')
    await expect(control).toHaveAttribute('aria-expanded', 'true')
    await page.keyboard.up('Space')
    await expect(control).toHaveAttribute('aria-expanded', 'true')
    const panel = scope.locator('.fixture-multi-main > [role="listbox"]')
    await expect(panel).not.toHaveClass(/(?:^|\s)list(?:\s|$)/)
    await expect(panel.locator(':scope > .list-wrapper')).toHaveCount(0)
    const removeAlpha = scope.getByRole('button', { name: 'Remove alpha', exact: true })
    await page.keyboard.press('Tab')
    await expect(removeAlpha).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(scope.getByPlaceholder('Search Multi options')).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(removeAlpha).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(control).toBeFocused()

    const size = scope.locator('[role="button"][aria-haspopup="listbox"]').last()
    await size.focus()
    await page.keyboard.press('Tab')
    // Chromium includes the narrow, scrollable page-size label in native Tab order.
    const sizeLabel = size.locator('.header')
    await expect(sizeLabel).toBeFocused()
    await page.keyboard.press('Tab')
    const witness = page.getByRole('textbox', { name: 'Multi reset witness' })
    await expect(witness).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(sizeLabel).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(size).toBeFocused()
    await expect(control).toHaveAttribute('aria-expanded', 'true')
    await witness.fill('edited')
    await removeAlpha.press('Space')
    await expect(page.getByTestId('multi-calls')).toHaveText('["alpha"]')
    await expect(page.getByTestId('multi-resets')).toHaveText('0')
    await expect(page.getByTestId('multi-submits')).toHaveText('0')
    await expect(witness).toHaveValue('edited')
    await expect(control).toHaveAttribute('aria-expanded', 'true')

    const disabled = option(scope, 'Disabled option')
    await expect(disabled).toHaveAttribute('aria-disabled', 'false')
    await disabled.click()
    const hidden = option(scope, 'Hidden option')
    await expect(hidden).toBeVisible()
    await hidden.click()
    await disabled.click()
    await expect(page.getByTestId('multi-calls')).toHaveText('["alpha","disabled","hidden","disabled"]')
    for (const label of ['All values', 'Null option']) {
      const sentinel = option(scope, label)
      await sentinel.scrollIntoViewIfNeeded()
      await clickCenter(page, sentinel)
    }
    await expect(page.getByTestId('multi-calls')).toHaveText('["alpha","disabled","hidden","disabled"]')
    await expect(control).toHaveAttribute('aria-expanded', 'true')
    await scope.getByPlaceholder('Search Multi options').press('Enter')
    await expect(page.getByTestId('multi-submits')).toHaveText('1')
    await page.keyboard.press('Escape')
    await expect(control).toBeFocused()
    await expect(control).toHaveAttribute('aria-expanded', 'false')
  })
}

test('MultiSelect preserves the string loading sentinel without removal actions', async ({ page }) => {
  await page.goto(fixtureUrl('surface=selects&mode=light'))
  const form = page.getByTestId('multi-string-loading')
  const control = trigger(form)
  const witness = form.getByRole('textbox', { name: 'String loading reset witness' })
  await witness.fill('edited')
  await expect(control).toContainText('Loading sentinel')
  await expect(form.getByRole('button', { name: /^Remove / })).toHaveCount(0)
  await control.click()
  await clickCenter(page, form.getByRole('option', { name: 'Loading sentinel', exact: true }))
  await page.keyboard.press('Escape')
  await page.mouse.click(4, 4)
  await expect(control).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByTestId('string-loading-resets')).toHaveText('0')
  await expect(page.getByTestId('string-loading-calls')).toHaveText('[]')
  await expect(witness).toHaveValue('edited')
  await control.click()
  await expect(control).toHaveAttribute('aria-expanded', 'false')
})
