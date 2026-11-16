import { test, expect, fixtureUrl } from './fixtures'
import { tokens } from '../../src/brand/ordering.tokens.generated'
import localeConfig from '../../i18n/config.json'
import translations from '../../i18n/translations.json'

const autoRoot = (page, testId) => page.getByTestId(testId).locator('[data-slot="auto-scroll"]')
const autoPort = (page, testId) => page.getByTestId(`${testId}-scrollport`)
const dragRoot = (page, testId) => page.getByTestId(testId).locator('[data-slot="drag-scroll"]')
const dragPort = (page, testId) => page.getByTestId(testId).locator('[data-slot="drag-scroll-scrollport"]')
const action = (scope, direction) => scope.getByRole('button', { name: `Scroll ${direction}`, exact: true })
const position = locator => locator.evaluate(element => element.scrollLeft)
const waitPosition = (locator, predicate) => expect.poll(async () => predicate(await position(locator))).toBe(true)
const readEvents = async page => JSON.parse(await page.getByTestId('scroll-container-events').textContent())
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
test('AutoScroll keeps explicit IDs, generates unique defaults and isolates multiple real scrollports', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(fixtureUrl('surface=scroll-containers&mode=light'))
  const first = autoRoot(page, 'auto-default-one')
  const second = autoRoot(page, 'auto-default-two')
  await expect(first).toBeVisible()
  const ids = [await first.getAttribute('id'), await second.getAttribute('id')]
  expect(ids[0]).toMatch(/^autoscroll-/)
  expect(ids[1]).toMatch(/^autoscroll-/)
  expect(ids[0]).not.toBe(ids[1])
  await expect(first).toHaveAttribute('data-scroll-target', 'ancestor-scrollport')
  await expect(autoRoot(page, 'auto-explicit')).toHaveAttribute('id', 'fixture-explicit-autoscroll')
  await expect(action(first, 'left')).toBeHidden()
  await expect(action(first, 'right')).toBeVisible()
  await action(first, 'right').press('Enter')
  await waitPosition(autoPort(page, 'auto-default-one'), value => value >= 195)
  expect(await position(autoPort(page, 'auto-default-two'))).toBe(0)
  await expect(action(first, 'left')).toBeVisible()
  await expect(action(autoRoot(page, 'auto-special'), 'right')).toBeVisible()
  await expect(action(autoRoot(page, 'auto-modal'), 'left')).toBeHidden()
  await expect(action(autoRoot(page, 'auto-modal'), 'right')).toBeHidden()
})

test('AutoScroll preserves 200px/10-percent steps, native scroll synchronization and LTR/RTL boundaries', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(fixtureUrl('surface=scroll-containers&mode=light'))
  const first = autoRoot(page, 'auto-default-one')
  const firstPort = autoPort(page, 'auto-default-one')
  await action(first, 'right').click()
  await expect.poll(() => position(firstPort)).toBeCloseTo(200, 0)
  await action(first, 'left').click()
  await waitPosition(firstPort, value => value <= 5)

  const second = autoRoot(page, 'auto-default-two')
  const secondPort = autoPort(page, 'auto-default-two')
  await action(second, 'right').click()
  await expect.poll(() => position(secondPort)).toBeCloseTo(220, 0)

  const explicit = autoRoot(page, 'auto-explicit')
  const explicitPort = autoPort(page, 'auto-explicit')
  await explicitPort.hover()
  await page.mouse.wheel(320, 0)
  await waitPosition(explicitPort, value => value > 100)
  await expect(action(explicit, 'left')).toBeVisible()
  await explicitPort.evaluate(element => { element.scrollLeft = element.scrollWidth; element.dispatchEvent(new Event('scroll')) })
  await expect(action(explicit, 'right')).toBeHidden()
  await expect(action(explicit, 'left')).toBeVisible()

  await page.goto(fixtureUrl('surface=scroll-containers&mode=light&rtl=true'))
  const rtlRoot = autoRoot(page, 'auto-explicit')
  const rtlPort = autoPort(page, 'auto-explicit')
  await expect(action(rtlRoot, 'right')).toBeHidden()
  await expect(action(rtlRoot, 'left')).toBeVisible()
  await action(rtlRoot, 'left').click()
  await waitPosition(rtlPort, value => value <= -195)
  await rtlPort.evaluate(element => { element.scrollLeft = -(element.scrollWidth - element.clientWidth); element.dispatchEvent(new Event('scroll')) })
  await expect(action(rtlRoot, 'left')).toBeHidden()
  await expect(action(rtlRoot, 'right')).toBeVisible()
})

test('DragScroll synchronizes arrows after buttons, wheel, resize and children updates', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(fixtureUrl('surface=scroll-containers&mode=light'))
  const wide = dragRoot(page, 'drag-wide')
  const widePort = dragPort(page, 'drag-wide')
  await expect(wide).toBeVisible()
  await expect(action(wide, 'left')).toHaveCount(0)
  await expect(action(wide, 'right')).toBeVisible()
  await action(wide, 'right').press('Enter')
  await expect.poll(() => position(widePort)).toBeCloseTo(216, 0)
  await expect(action(wide, 'left')).toBeVisible()
  await widePort.hover()
  await page.mouse.wheel(300, 0)
  await waitPosition(widePort, value => value > 300)
  await widePort.evaluate(element => { element.scrollLeft = element.scrollWidth; element.dispatchEvent(new Event('scroll')) })
  await expect(action(wide, 'right')).toHaveCount(0)

  const dynamic = dragRoot(page, 'drag-dynamic')
  await expect(action(dynamic, 'right')).toHaveCount(0)
  const beforeWidth = await dragPort(page, 'drag-dynamic').evaluate(element => element.clientWidth)
  await page.getByRole('button', { name: 'Toggle dynamic children', exact: true }).click()
  await expect(action(dynamic, 'right')).toBeVisible()
  await page.setViewportSize({ width: 900, height: 800 })
  await expect.poll(() => dragPort(page, 'drag-dynamic').evaluate(element => element.clientWidth)).not.toBe(beforeWidth)
})

test('DragScroll mouse drag updates native position and preserves child click behavior', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(fixtureUrl('surface=scroll-containers&mode=light'))
  const root = dragRoot(page, 'drag-wide')
  const port = dragPort(page, 'drag-wide')
  const box = await port.boundingBox()
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2)
  await page.mouse.down()
  await expect(root).toHaveAttribute('data-dragging', '')
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2, { steps: 8 })
  await page.mouse.up()
  await waitPosition(port, value => value > 100)
  await expect(root).not.toHaveAttribute('data-dragging', '')
  await port.evaluate(element => { element.scrollLeft = 0; element.dispatchEvent(new Event('scroll')) })
  await page.getByTestId('drag-wide').getByRole('button', { name: 'Long horizontal option 1', exact: true }).click()
  expect(await readEvents(page)).toContain('drag-wide-1')
})

for (const mode of ['light', 'dark']) {
  test(`scroll containers expose readable 44px keyboard actions and governed ${mode} focus`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(fixtureUrl(`surface=scroll-containers&mode=${mode}`))
    const semantic = tokens.theme[mode].semantic
    const auto = autoRoot(page, 'auto-explicit')
    const drag = dragRoot(page, 'drag-wide')
    await autoPort(page, 'auto-explicit').evaluate(element => { element.scrollLeft = 300; element.dispatchEvent(new Event('scroll')) })
    await dragPort(page, 'drag-wide').evaluate(element => { element.scrollLeft = 300; element.dispatchEvent(new Event('scroll')) })
    const keyboardCases = [
      [page.getByTestId('auto-explicit-focus-before'), action(auto, 'left'), autoPort(page, 'auto-explicit')],
      [page.getByTestId('drag-wide-focus-before'), action(drag, 'left'), dragPort(page, 'drag-wide')]
    ]
    let captureIndex = 0
    for (const [sentinel, control, port] of keyboardCases) {
      await sentinel.focus()
      await page.keyboard.press('Tab')
      await expect(control).toBeFocused()
      const box = await control.boundingBox()
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
      const portBox = await port.boundingBox()
      expect(box.x - portBox.x).toBeGreaterThanOrEqual(3.5)
      expect(box.x - portBox.x).toBeLessThanOrEqual(8)
      expect(portBox.x + portBox.width - box.x - box.width).toBeGreaterThanOrEqual(3.5)
      expect(box.y - portBox.y).toBeGreaterThanOrEqual(3.5)
      expect(portBox.y + portBox.height - box.y - box.height).toBeGreaterThanOrEqual(3.5)
      await expect(control).toHaveCSS('outline-color', rgb(semantic.action.focus))
      expect(parseFloat(await control.evaluate(element => getComputedStyle(element).outlineWidth))).toBeGreaterThanOrEqual(2)
      const value = await effectiveColors(control)
      expect(contrast(value.foreground, value.background)).toBeGreaterThanOrEqual(3)
      await control.scrollIntoViewIfNeeded()
      await page.screenshot({ path: testInfo.outputPath(`scroll-containers-${mode}-${captureIndex++}.png`) })
    }
  })
}

test('reduced motion changes button scrolling to immediate behavior', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(fixtureUrl('surface=scroll-containers&mode=light'))
  for (const [root, port] of [[autoRoot(page, 'auto-explicit'), autoPort(page, 'auto-explicit')], [dragRoot(page, 'drag-wide'), dragPort(page, 'drag-wide')]]) {
    await port.evaluate(element => {
      const nativeScrollBy = element.scrollBy.bind(element)
      element.scrollBy = options => {
        element.dataset.lastScrollBehavior = options.behavior
        nativeScrollBy(options)
      }
    })
    await action(root, 'right').press('Enter')
    await expect(port).toHaveAttribute('data-last-scroll-behavior', 'auto')
  }
})

for (const width of [320, 390]) {
  test.describe(`scroll containers at ${width}px coarse pointer`, () => {
    test.use({ viewport: { width, height: 800 }, hasTouch: true, isMobile: true })
    test('native RTL touch scroll and modal arrows remain bounded before and after movement', async ({ page }, testInfo) => {
      await page.goto(fixtureUrl('surface=scroll-containers&mode=dark&rtl=true'))
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      const modal = autoRoot(page, 'auto-modal')
      await modal.scrollIntoViewIfNeeded()
      await page.screenshot({ path: testInfo.outputPath(`scroll-containers-${width}-before.png`) })
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      const modalPortBox = await autoPort(page, 'auto-modal').boundingBox()
      for (const control of await modal.locator('[data-scroll-action]:visible').all()) {
        const box = await control.boundingBox()
        expect.soft(box.width).toBeGreaterThanOrEqual(44)
        expect.soft(box.height).toBeGreaterThanOrEqual(44)
        expect.soft(box.x).toBeGreaterThanOrEqual(0)
        expect.soft(box.x + box.width).toBeLessThanOrEqual(width)
        expect.soft(box.x - modalPortBox.x).toBeGreaterThanOrEqual(3.5)
        if (await control.getAttribute('data-scroll-action') === 'left') expect.soft(box.x - modalPortBox.x).toBeLessThanOrEqual(8)
        else expect.soft(modalPortBox.x + modalPortBox.width - box.x - box.width).toBeLessThanOrEqual(8)
        expect.soft(modalPortBox.x + modalPortBox.width - box.x - box.width).toBeGreaterThanOrEqual(3.5)
      }

      const port = dragPort(page, 'drag-wide')
      await port.scrollIntoViewIfNeeded()
      const box = await port.boundingBox()
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width * 0.25, y: box.y + box.height / 2 }] })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width * 0.5, y: box.y + box.height / 2 }] })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width * 0.75, y: box.y + box.height / 2 }] })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await waitPosition(port, value => value < 0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      await port.scrollIntoViewIfNeeded()
      await page.screenshot({ path: testInfo.outputPath(`scroll-containers-${width}-after.png`) })
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
    })
  })
}

test('scroll actions keep names, direction and independent IDs in all twelve locales', async ({ page }) => {
  for (const locale of [localeConfig.sourceLanguage, ...localeConfig.supportedLocales]) {
    await page.goto(fixtureUrl(`surface=scroll-containers&mode=light&locale=${locale}&rtl=${locale === 'ar'}`))
    const first = autoRoot(page, 'auto-default-one')
    const second = autoRoot(page, 'auto-default-two')
    await expect(first.getByRole('button', { name: translations[locale === 'ar' ? 'SCROLL_LEFT' : 'SCROLL_RIGHT'][locale], exact: true })).toBeVisible()
    expect(await first.getAttribute('id')).not.toBe(await second.getAttribute('id'))
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
  }
})

test('near-fit AutoScroll does not create overflow solely from its hidden arrow slots', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(fixtureUrl('surface=scroll-containers&mode=light'))
  const port = autoPort(page, 'auto-near-fit')
  await expect(page.locator('#fixture-near-fit')).toBeVisible()
  await expect.poll(() => port.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await expect(page.locator('#fixture-near-fit').locator('[data-scroll-action]:visible, .left-autoscroll:visible, .right-autoscroll:visible')).toHaveCount(0)
})
