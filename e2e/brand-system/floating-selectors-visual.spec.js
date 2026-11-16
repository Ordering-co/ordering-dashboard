import { writeFile } from 'node:fs/promises'
import { test, expect, fixtureUrl } from './fixtures'

const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number)
  .map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
const contrast = (first, second) => {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a)
  return (values[0] + 0.05) / (values[1] + 0.05)
}
const colors = locator => locator.evaluate(element => {
  let parent = element
  let background = 'rgb(255, 255, 255)'
  while (parent) {
    const value = getComputedStyle(parent).backgroundColor
    if (value !== 'transparent' && value !== 'rgba(0, 0, 0, 0)') { background = value; break }
    parent = parent.parentElement
  }
  return { text: getComputedStyle(element).color, background }
})

for (const mode of ['light', 'dark']) {
  test(`C4 picker internals retain readable text and selected dates in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(fixtureUrl(`surface=floating-selectors&mode=${mode}&fixtureUserLevel=0`))
    const color = page.getByTestId('color-picker-control')
    await color.getByRole('button', { name: 'Select color', exact: true }).click()
    const picker = color.locator('.sketch-picker')
    await expect(picker).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`color-${mode}.png`) })
    for (const field of await picker.locator('input:visible, label:visible').all()) {
      const value = await colors(field)
      expect.soft(contrast(value.text, value.background)).toBeGreaterThanOrEqual(4.5)
    }
    const white = picker.getByTitle(/^#ffffff$/i)
    const boundary = await white.evaluate(element => {
      const style = getComputedStyle(element)
      const raw = style.boxShadow.match(/rgba?\([^)]+\)/)?.[0]
      const value = raw?.match(/[\d.]+/g).map(Number)
      const base = style.backgroundColor.match(/[\d.]+/g).slice(0, 3).map(Number)
      const alpha = value?.[3] ?? 1
      return value ? `rgb(${value.slice(0, 3).map((channel, index) => channel * alpha + base[index] * (1 - alpha)).join(', ')})` : null
    })
    expect.soft(boundary).not.toBeNull()
    if (boundary) expect.soft(contrast(boundary, (await colors(picker)).background)).toBeGreaterThanOrEqual(3)
    await page.keyboard.press('Escape')
    const calendar = page.getByTestId('single-calendar')
    await calendar.locator('button').first().click()
    const selected = calendar.locator('button.rdrDay').filter({ has: page.locator('.rdrSelected') })
    await expect(selected).toHaveCount(1)
    const foreground = await selected.locator('.rdrDayNumber span').evaluate(element => getComputedStyle(element).color)
    const background = await selected.locator('.rdrSelected').evaluate(element => getComputedStyle(element).backgroundColor)
    await calendar.locator('.rdrCalendarWrapper').scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath(`calendar-${mode}.png`) })
    expect.soft(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5)
    expect.soft(contrast(background, (await colors(calendar.locator('.rdrCalendarWrapper'))).background)).toBeGreaterThanOrEqual(3)
    for (const day of await calendar.locator('.rdrDay:not(.rdrDayPassive):not(.rdrDayDisabled)').filter({ hasNot: page.locator('.rdrSelected') }).locator('.rdrDayNumber span').all()) {
      const value = await colors(day)
      expect.soft(contrast(value.text, value.background)).toBeGreaterThanOrEqual(4.5)
    }
    for (const control of await calendar.locator('.rdrNextPrevButton, .rdrMonthAndYearPickers select').all()) await expect.soft(control).toHaveAccessibleName(/.+/)
    await calendar.locator('.rdrPprevButton').focus()
    for (const control of await calendar.locator('.rdrMonthAndYearPickers select').all()) {
      await page.keyboard.press('Tab')
      await expect(control).toBeFocused()
      const focus = await control.evaluate(element => {
        const style = getComputedStyle(element)
        return { width: parseFloat(style.outlineWidth), style: style.outlineStyle }
      })
      expect.soft(focus.width).toBeGreaterThanOrEqual(2)
      expect.soft(focus.style).toBe('solid')
    }
  })
}

for (const width of [320, 390]) {
  test.describe(`C4 picker internals at ${width}px`, () => {
    test.use({ viewport: { width, height: 800 }, hasTouch: true, isMobile: true })
    test('color inputs, swatches and date controls have non-overlapping 44px targets', async ({ page }, testInfo) => {
      const viewportStates = []
      const captureViewport = async label => {
        viewportStates.push(await page.evaluate(currentLabel => {
          const bounds = selector => {
            const element = document.querySelector(selector)
            const rect = element?.getBoundingClientRect()
            const style = element && getComputedStyle(element)
            return rect && { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height, offsetLeft: element.offsetLeft, position: style.position, leftStyle: style.left, rightStyle: style.right, transform: style.transform }
          }
          return {
            label: currentLabel,
            scrollX: window.scrollX,
            scrollY: window.scrollY,
            innerWidth: window.innerWidth,
            clientWidth: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
            visualViewport: window.visualViewport && {
              left: window.visualViewport.offsetLeft,
              top: window.visualViewport.offsetTop,
              width: window.visualViewport.width,
              height: window.visualViewport.height,
              scale: window.visualViewport.scale
            },
            fixture: bounds('[data-testid="floating-selectors"]'),
            main: bounds('main'),
            calendar: bounds('[data-testid="range-calendar"] .od-range-calendar-panel'),
            calendarWidget: bounds('[data-testid="range-calendar"] .rdrCalendarWrapper')
          }
        }, label))
      }
      await page.goto(fixtureUrl('surface=floating-selectors&mode=dark&rtl=true&fixtureUserLevel=0'))
      await captureViewport('loaded')
      const color = page.getByTestId('color-picker-control')
      await color.getByRole('button', { name: 'Select color', exact: true }).click()
      const picker = color.locator('.sketch-picker')
      await picker.scrollIntoViewIfNeeded()
      await captureViewport('color-scrolled-into-view')
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath(`color-${width}.png`) })
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      const swatches = picker.locator('[title][tabindex="0"]')
      expect(await swatches.count()).toBeGreaterThan(0)
      for (const target of [...await picker.locator('input:visible').all(), ...await swatches.all(), ...await picker.locator('.hue-horizontal').all()]) {
        const box = await target.boundingBox()
        expect.soft(box.width).toBeGreaterThanOrEqual(44)
        expect.soft(box.height).toBeGreaterThanOrEqual(44)
      }
      const swatchBoxes = await Promise.all([...await swatches.all(), ...await picker.locator('input:visible').all(), ...await picker.locator('.hue-horizontal').all()].map(target => target.boundingBox()))
      for (let first = 0; first < swatchBoxes.length; first++) {
        for (let second = first + 1; second < swatchBoxes.length; second++) {
          const a = swatchBoxes[first]; const b = swatchBoxes[second]
          expect.soft(a.x + a.width <= b.x + 0.5 || b.x + b.width <= a.x + 0.5 || a.y + a.height <= b.y + 0.5 || b.y + b.height <= a.y + 0.5).toBe(true)
        }
      }
      await page.keyboard.press('Escape')
      await captureViewport('color-closed')
      const calendar = page.getByTestId('range-calendar')
      await calendar.locator('button').first().click()
      await captureViewport('calendar-opened')
      const panel = calendar.locator('.rdrCalendarWrapper')
      await panel.scrollIntoViewIfNeeded()
      await captureViewport('calendar-scrolled-into-view')
      await writeFile(testInfo.outputPath(`viewport-pan-${width}.json`), JSON.stringify(viewportStates, null, 2))
      await page.screenshot({ path: testInfo.outputPath(`calendar-${width}.png`) })
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      const bounds = await panel.boundingBox()
      expect.soft(bounds.x).toBeGreaterThanOrEqual(0)
      expect.soft(bounds.x + bounds.width).toBeLessThanOrEqual(width)
      if (await page.evaluate(() => document.documentElement.scrollWidth) > width) {
        await testInfo.attach('overflow-elements', {
          contentType: 'application/json',
          body: JSON.stringify(await page.locator('body *').evaluateAll(elements => elements.map(element => {
            const box = element.getBoundingClientRect()
            return { tag: element.tagName, class: element.className, text: element.textContent?.slice(0, 60), x: box.x, right: box.right, width: box.width }
          }).filter(box => box.width && (box.x < -1 || box.right > 320))), null, 2)
        })
      }
      expect.soft(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      for (const target of await panel.locator('button.rdrDay:not(.rdrDayDisabled), button.rdrNextPrevButton, select, input').all()) {
        const box = await target.boundingBox()
        expect.soft(box.width).toBeGreaterThanOrEqual(44)
        expect.soft(box.height).toBeGreaterThanOrEqual(44)
      }
    })
  })
}

const calendarMonths = { en: 'June', es: 'junio', fr: 'juin', it: 'giugno', de: 'Juni', pt: 'junho', da: 'juni', nl: 'juni', ar: 'يونيو', el: 'Ιούνιος', bg: 'юни', tr: 'Haziran' }

test('C4 real calendar uses all 12 locale dictionaries and preserves selected date values', async ({ page }) => {
  for (const [locale, month] of Object.entries(calendarMonths)) {
    await page.goto(fixtureUrl(`surface=floating-selectors&locale=${locale}&rtl=${locale === 'ar'}&fixtureUserLevel=0`))
    const calendar = page.getByTestId('single-calendar')
    await calendar.locator('button').first().click()
    await expect(calendar.locator('.rdrMonthPicker select option:checked')).toHaveText(month)
    await expect(calendar.locator('.rdrYearPicker select')).toHaveValue('2024')
    await expect(calendar.locator('.rdrPprevButton')).toHaveAccessibleName(/.+/)
    await expect(calendar.locator('.rdrNextButton')).toHaveAccessibleName(/.+/)
    await page.keyboard.press('Escape')
    await expect(calendar.locator('button').first()).toBeFocused()
    await expect(calendar.locator('.rdrCalendarWrapper')).toHaveCount(0)
  }
})
