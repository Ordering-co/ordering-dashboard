import { test, expect, fixtureUrl } from './fixtures'
import { tokens } from '../../src/brand/ordering.tokens.generated'
import { readFileSync, writeFileSync } from 'node:fs'

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
const effectiveColors = locator => locator.evaluate(element => {
  const foregroundTarget = element.querySelector('svg') || element
  const foreground = getComputedStyle(foregroundTarget).color
  let background = 'rgba(0, 0, 0, 0)'
  let current = element
  while (current) {
    const candidate = getComputedStyle(current).backgroundColor
    const values = candidate.match(/[\d.]+/g)?.map(Number) || []
    if (candidate !== 'transparent' && (values.length === 3 || values[3] > 0.99)) {
      background = candidate
      break
    }
    current = current.parentElement
  }
  return { foreground, background }
})

const contrastTestIds = [
  'button-default',
  'button-primary',
  'button-light-primary',
  'button-light-green',
  'button-green',
  'button-warning',
  'button-secondary',
  'button-secondary-dark',
  'button-black',
  'button-dark-blue',
  'button-outline',
  'button-circle',
  'button-short',
  'button-rectangle',
  'button-custom-radius',
  'button-transparent',
  'button-initial-icon',
  'button-long-label',
  'button-custom-font',
  'icon-default',
  'icon-black',
  'icon-active',
  'icon-primary',
  'implicit-submit',
  'busy-button',
  'toggle-busy',
  'button-link',
  'link-button',
  'link-short'
]

for (const mode of ['light', 'dark']) {
  test(`direct owned button variants retain ${mode} hover and active contrast`, async ({ page }) => {
    await page.goto(fixtureUrl(`surface=buttons&mode=${mode}`))
    const variants = page.locator('[data-owned-variant]')
    await expect(variants).toHaveCount(18)
    for (let index = 0; index < 18; index++) {
      const control = variants.nth(index)
      for (const state of ['rest', 'hover', 'active']) {
        if (state === 'rest') await page.getByTestId('resolved-action').hover()
        else if (state === 'hover') await control.hover()
        else await page.mouse.down()
        await page.waitForTimeout(250)
        const colors = await effectiveColors(control)
        expect(contrast(colors.foreground, colors.background), `${await control.getAttribute('data-owned-variant')} ${state}`).toBeGreaterThanOrEqual(4.5)
        if (state !== 'rest' && await control.getAttribute('data-owned-variant') === 'primary-outline') {
          await expect(control).toHaveCSS('background-color', rgb(tokens.theme[mode].semantic.surface.subtle))
        }
        if (state === 'active') await page.mouse.up()
      }
    }
  })

  test(`real legacy action states and final theme remain equivalent in ${mode}`, async ({ page }, testInfo) => {
    test.setTimeout(60000)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(fixtureUrl(`surface=action-probes&mode=${mode}`))
    await expect(page.getByTestId('action-probes')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    const appearance = locator => locator.evaluate(element => {
      const style = getComputedStyle(element)
      return Object.fromEntries(['color', 'background-color', 'border-color', 'border-radius', 'font-family', 'font-weight', 'text-align', 'width', 'height'].map(key => [key, style.getPropertyValue(key)]))
    })
    const rows = []
    const finishTransitions = locator => locator.evaluate(element => Promise.all(
      element.getAnimations({ subtree: true })
        .filter(animation => animation instanceof window.CSSTransition)
        .map(animation => animation.finished.catch(() => {}))
    ))
    const probes = page.locator('[data-probe]')
    await expect(probes).toHaveCount(26)
    for (let index = 0; index < 26; index++) {
      const probe = probes.nth(index)
      await page.getByRole('heading').hover()
      // Observe completed CSS states even when rendering is throttled under load.
      // This waits for transitions without disabling or changing their timing.
      await finishTransitions(probe)
      const row = { name: await probe.getAttribute('data-probe'), rest: await appearance(probe) }
      await probe.hover()
      await finishTransitions(probe)
      row.hover = await appearance(probe)
      await page.mouse.down()
      await finishTransitions(probe)
      row.active = await appearance(probe)
      await page.mouse.up()
      rows.push(row)
    }
    const focused = page.locator('[data-probe="final-theme"]')
    await focused.focus()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Shift+Tab')
    await expect(focused).toBeFocused()
    const focus = await focused.evaluate(element => ({ width: getComputedStyle(element).outlineWidth, offset: getComputedStyle(element).outlineOffset }))
    const result = { mode, rows, focus }
    writeFileSync(testInfo.outputPath(`action-states-${mode}.json`), JSON.stringify(result, null, 2))
    const baseline = JSON.parse(readFileSync(`e2e/brand-system/baselines/l2-actions/action-states-${mode}.json`, 'utf8'))
    // Deliberate L2 adoption: text-bearing IconButton uses the canonical text
    // role, replacing unreadable browser-default black in Dark. Its absent
    // border's currentColor follows that text; all other measured values stay.
    const icon = baseline.rows.find(row => row.name === 'icon-text')
    for (const state of ['rest', 'hover', 'active']) {
      icon[state].color = rgb(tokens.theme[mode].semantic.text.default)
      icon[state]['border-color'] = icon[state].color
    }
    const selectedComment = result.rows.find(row => row.name === 'comment-selected')
    for (const [state, background] of Object.entries({
      rest: tokens.theme[mode].semantic.action.default,
      hover: tokens.theme[mode].semantic.action.hover,
      active: tokens.theme[mode].semantic.action.hover
    })) {
      const actual = selectedComment[state]
      expect(actual.color).toBe(rgb(tokens.theme[mode].semantic.action.foreground))
      expect(actual['background-color']).toBe(rgb(background))
      expect(actual['border-color']).toBe(rgb(background))
      expect(contrast(actual.color, actual['background-color']), `selected comment ${state}`).toBeGreaterThanOrEqual(4.5)
    }
    const unselectedComment = result.rows.find(row => row.name === 'comment-unselected')
    expect(unselectedComment.rest.color).toBe(rgb(tokens.theme[mode].semantic.text.default))
    expect(unselectedComment.rest['background-color']).toBe(rgb(tokens.theme[mode].semantic.surface.subtle))
    expect(unselectedComment.rest['border-color']).toBe(rgb(tokens.theme[mode].semantic.border.default))
    for (const row of [selectedComment, unselectedComment]) {
      for (const state of ['rest', 'hover', 'active']) {
        expect(row[state]['border-radius']).toBe(tokens.radius.round)
        expect(contrast(row[state].color, row[state]['background-color']), `${row.name} ${state}`).toBeGreaterThanOrEqual(4.5)
      }
    }
    for (const name of ['comment-selected', 'comment-unselected']) {
      await expect(page.locator(`[data-probe="${name}"]`)).toHaveCSS('font-size', tokens.font.size.productUi)
    }
    const iconControl = page.locator('[data-probe="icon-text"]')
    await expect(iconControl).toHaveCSS('border-top-width', '0px')
    for (const state of ['rest', 'hover', 'active']) {
      const colors = result.rows.find(row => row.name === 'icon-text')[state]
      const background = colors['background-color'] === 'rgba(0, 0, 0, 0)' ? rgb(tokens.theme[mode].semantic.background) : colors['background-color']
      expect(contrast(colors.color, background)).toBeGreaterThanOrEqual(4.5)
    }
    const unchangedRows = rows => rows.filter(row => !['comment-selected', 'comment-unselected'].includes(row.name))
    expect({ ...result, rows: unchangedRows(result.rows) }).toEqual({ ...baseline, rows: unchangedRows(baseline.rows) })
  })
}

for (const mode of ['light', 'dark']) {
  test(`Button variants use governed ${mode} roles and preserve native contracts`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(fixtureUrl(`surface=buttons&mode=${mode}`))
    await expect(page.getByTestId('buttons-fixture')).toBeVisible()

    const primary = page.getByTestId('button-primary')
    const green = page.getByTestId('button-green')
    const warning = page.getByTestId('button-warning')
    const lightGreen = page.getByTestId('button-light-green')
    await expect(page.getByTestId('button-default')).toHaveCSS('background-color', rgb(tokens.theme[mode].semantic.surface.subtle))
    await expect(primary).toHaveCSS('background-color', rgb(tokens.theme[mode].semantic.action.default))
    await expect(primary).toHaveCSS('color', rgb(tokens.theme[mode].semantic.action.foreground))
    await expect(page.getByTestId('button-light-primary')).toHaveCSS('background-color', rgb(tokens.theme[mode].semantic.action.soft))
    await expect(page.getByTestId('button-light-primary')).toHaveCSS('color', rgb(tokens.theme[mode].semantic.action.content))
    await expect(green).toHaveCSS('background-color', rgb(tokens.theme[mode].semantic.state.success.signal))
    await expect(green).toHaveCSS('color', rgb(tokens.theme.light.semantic.text.default))
    await expect(warning).toHaveCSS('background-color', rgb(tokens.theme[mode].semantic.state.warning.signal))
    await expect(warning).toHaveCSS('color', rgb(tokens.theme.light.semantic.text.default))
    await expect(lightGreen).toHaveCSS('background-color', rgb(tokens.theme[mode].semantic.state.success.soft))
    await expect(page.getByTestId('button-secondary')).toHaveCSS('color', rgb(tokens.theme[mode].semantic.text.muted))
    await expect(page.getByTestId('button-secondary-dark')).toHaveCSS('background-color', rgb(tokens.theme[mode].semantic.border.default))
    await expect(page.getByTestId('button-black')).toHaveCSS('background-color', rgb(tokens.theme[mode].semantic.surface.strong))
    await expect(page.getByTestId('button-outline')).toHaveCSS('background-color', rgb(tokens.theme[mode].semantic.surface.default))
    await expect(page.getByTestId('button-outline')).toHaveCSS('color', rgb(tokens.theme[mode].semantic.action.content))
    await expect(page.getByTestId('link-button')).toHaveCSS('color', rgb(tokens.theme[mode].semantic.action.content))
    await expect(page.getByTestId('button-rectangle')).toHaveCSS('border-radius', '0px')
    await expect(page.getByTestId('button-custom-radius')).toHaveCSS('border-radius', '12px')
    await expect(page.getByTestId('button-transparent')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expect(page.getByTestId('button-forced-transparent')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expect(page.getByTestId('button-transparent')).toHaveCSS('color', rgb(tokens.theme[mode].semantic.action.content))
    await expect(page.getByTestId('button-caller-graphic').locator('svg')).toHaveCSS('width', '32px')
    await expect(page.getByTestId('button-caller-graphic').locator('svg')).toHaveCSS('height', '18px')
    const primaryGlyph = page.getByTestId('icon-primary').locator('svg')
    await expect(primaryGlyph).toHaveCSS('color', rgb(tokens.theme[mode].semantic.action.content))
    await expect(primaryGlyph).toHaveAttribute('width', tokens.component.density.iconSize)
    await expect(primaryGlyph).toHaveAttribute('height', tokens.component.density.iconSize)
    await expect(primaryGlyph).toHaveAttribute('stroke-width', String(tokens.stroke.icon))
    expect(await page.getByTestId('button-custom-font').evaluate(element => getComputedStyle(element).fontFamily)).toContain('Fixture Tenant Sans')
    expect((await page.getByTestId('button-default').boundingBox()).height).toBe(32)
    expect((await page.getByTestId('button-circle').boundingBox()).height).toBe(34)
    expect((await page.getByTestId('icon-primary').boundingBox()).height).toBe(32)
    await page.screenshot({ path: testInfo.outputPath(`buttons-${mode}-1440.png`), fullPage: true })

    for (const testId of contrastTestIds) {
      const locator = page.getByTestId(testId)
      let colors = await effectiveColors(locator)
      expect(contrast(colors.foreground, colors.background), `${testId} rest`).toBeGreaterThanOrEqual(4.5)
      await locator.hover()
      await page.waitForTimeout(220)
      colors = await effectiveColors(locator)
      expect(contrast(colors.foreground, colors.background), `${testId} hover`).toBeGreaterThanOrEqual(4.5)
      const box = await locator.boundingBox()
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.waitForTimeout(220)
      colors = await effectiveColors(locator)
      expect(contrast(colors.foreground, colors.background), `${testId} active`).toBeGreaterThanOrEqual(4.5)
      await page.mouse.move(0, 0)
      await page.mouse.up()
    }

    expect(contrast(...Object.values(await effectiveColors(page.getByTestId('icon-pointer-guarded'))))).toBeGreaterThanOrEqual(4.5)
    await expect(page.getByTestId('disabled-button')).toBeDisabled()
    await expect(page.getByTestId('icon-disabled')).toBeDisabled()
    await expect(page.getByTestId('disabled-link')).toHaveCSS('pointer-events', 'none')

    await primary.hover()
    await expect(primary).toHaveCSS('background-color', rgb(tokens.theme[mode].semantic.action.hover))
    await page.mouse.down()
    await expect(primary).toHaveCSS('background-color', rgb(tokens.theme[mode].semantic.action.hover))
    await page.mouse.move(0, 0)
    await page.mouse.up()

    await page.keyboard.press('Tab')
    const focused = page.locator(':focus')
    await expect(focused).toHaveCSS('outline-width', tokens.component.focusRing.width)
    await expect(focused).toHaveCSS('outline-offset', tokens.component.focusRing.offset)

    expect(await page.getByTestId('implicit-submit').evaluate(element => ({ tag: element.tagName, attribute: element.getAttribute('type'), type: element.type }))).toEqual({ tag: 'BUTTON', attribute: null, type: 'submit' })
    expect(await page.getByTestId('button-link').evaluate(element => element.tagName)).toBe('A')
    expect(await page.getByTestId('link-button').evaluate(element => element.tagName)).toBe('A')
    expect(await page.getByTestId('icon-pointer-guarded').isDisabled()).toBe(false)
    expect(await page.getByTestId('icon-pointer-guarded').evaluate(element => getComputedStyle(element).pointerEvents)).toBe('none')
    await expect(page.getByTestId('icon-active')).toHaveCSS('background-color', rgb(tokens.theme[mode].semantic.border.default))
    expect(await page.getByTestId('button-dark-blue').evaluate(element => getComputedStyle(element).backgroundColor)).toBe(await page.getByTestId('button-default').evaluate(element => getComputedStyle(element).backgroundColor))
    await expect(page.getByTestId('button-default')).toHaveCSS('transition-timing-function', 'cubic-bezier(0.32, 0.72, 0, 1), cubic-bezier(0.32, 0.72, 0, 1), cubic-bezier(0.32, 0.72, 0, 1)')

    await expect(page.getByTestId('button-events')).toHaveText('0')
    await primary.click()
    await page.getByTestId('implicit-submit').click()
    await page.getByTestId('disabled-button').evaluate(element => element.click())
    await page.getByTestId('button-link').click()
    await expect(page).toHaveURL(/#button-target$/)
    await expect(page.getByTestId('button-events')).toHaveText('3')
  })

  test(`Button ${mode} RTL and reduced motion remain usable`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(fixtureUrl(`surface=buttons&mode=${mode}&rtl=true`))
    const label = page.getByTestId('button-initial-icon').locator('span')
    await expect(label).toHaveCSS('padding-left', '0px')
    expect(parseFloat(await label.evaluate(element => getComputedStyle(element).paddingRight))).toBeGreaterThan(0)
    await expect(page.getByTestId('button-primary')).toHaveCSS('transition-property', 'none')
    await expect(page.getByTestId('button-primary')).toHaveCSS('transition-duration', '0s')
  })

  test(`Button ${mode} reflows at 320px, supports 200 percent zoom and keeps busy geometry`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 })
    await page.goto(fixtureUrl(`surface=buttons&mode=${mode}`))
    const longLabel = page.getByTestId('button-long-label')
    await expect(longLabel).toBeVisible()
    let geometry = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: innerWidth }))
    expect(geometry.scroll).toBeLessThanOrEqual(geometry.viewport)
    const box = await longLabel.boundingBox()
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(320)

    const busy = page.getByTestId('busy-button')
    const documentBox = () => busy.evaluate(element => {
      const box = element.getBoundingClientRect()
      return { x: box.left + scrollX, y: box.top + scrollY, width: box.width, height: box.height }
    })
    // A long fixture may scroll when Playwright brings Toggle busy into view;
    // document coordinates retain the actual layout-shift assertion.
    const before = await documentBox()
    await page.getByTestId('toggle-busy').click()
    await expect(busy).toBeDisabled()
    await expect(busy).toHaveAttribute('aria-busy', 'true')
    const after = await documentBox()
    for (const key of ['x', 'y', 'width', 'height']) expect(Math.abs(before[key] - after[key]), `busy ${key}`).toBeLessThan(0.5)

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(fixtureUrl(`surface=buttons&mode=${mode}`))
    await page.evaluate(() => { document.documentElement.style.zoom = '2' })
    await expect(page.getByTestId('button-long-label')).toBeVisible()
    geometry = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: innerWidth }))
    expect(geometry.scroll).toBeLessThanOrEqual(geometry.viewport)
  })
}

test('tenant action stays exact in the theme and paints an AA shade', async ({ page }) => {
  const stored = '#F5A300'
  const shade = 'rgb(158, 105, 0)'
  await page.goto(fixtureUrl(`surface=buttons&mode=light&tenant=${encodeURIComponent(stored)}`))
  await expect(page.getByTestId('resolved-action')).toHaveText(stored)
  const primary = page.getByTestId('button-primary')
  await expect(primary).toHaveCSS('background-color', shade)
  await expect(primary).toHaveCSS('color', 'rgb(255, 255, 255)')
  await expect(page.getByTestId('button-light-primary')).toHaveCSS('color', shade)
  await expect(page.getByTestId('button-outline')).toHaveCSS('color', shade)
  await expect(page.getByTestId('link-button')).toHaveCSS('color', shade)
  const colors = await effectiveColors(primary)
  expect(contrast(colors.foreground, rgb(stored)), 'unadjusted tenant color').toBeLessThan(4.5)
  expect(contrast(colors.foreground, colors.background), 'rendered primary button').toBeGreaterThanOrEqual(4.5)
})

test('selected CommentButton keeps the tenant action and foreground through hover and active', async ({ page }) => {
  await page.goto(fixtureUrl('surface=action-probes&mode=light&tenant=%23123456'))
  const comment = page.locator('[data-probe="comment-selected"]')
  expect(await comment.evaluate(element => getComputedStyle(element).getPropertyValue('--od-ui-action').trim())).toBe('#123456')
  for (const state of ['rest', 'hover', 'active']) {
    if (state === 'rest') await page.getByRole('heading').hover()
    if (state === 'hover') await comment.hover()
    if (state === 'active') await page.mouse.down()
    await page.waitForTimeout(250)
    const colors = await effectiveColors(comment)
    expect(contrast(colors.foreground, colors.background), `tenant selected comment ${state}`).toBeGreaterThanOrEqual(4.5)
    if (state === 'active') await page.mouse.up()
  }
})

test.describe('coarse pointer targets', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })

  for (const mode of ['light', 'dark']) {
    test(`Button, circle, icon and text link expose common 44px targets in ${mode}`, async ({ page }) => {
      await page.goto(fixtureUrl(`surface=buttons&mode=${mode}`))
      for (const testId of ['button-primary', 'button-circle', 'button-short', 'icon-primary', 'link-button', 'link-short']) {
        const box = await page.getByTestId(testId).boundingBox()
        expect(box.height).toBeGreaterThanOrEqual(44)
        expect(box.width).toBeGreaterThanOrEqual(44)
      }
    })
  }
})
