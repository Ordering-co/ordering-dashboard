import { test, expect, fixtureUrl } from './fixtures'
import { tokens } from '../../src/brand/ordering.tokens.generated'
import localeConfig from '../../i18n/config.json'
import translations from '../../i18n/translations.json'

const read = async (page, testId) => JSON.parse(await page.getByTestId(testId).textContent())
const schedule = (page, testId = 'schedule-main') => page.getByTestId(testId).locator('[data-slot="schedule"]')
const day = (root, index) => root.locator(`[data-slot="schedule-day"][data-day="${index}"]`)
const field = (dayRow, boundary, unit, lapse = 0) => dayRow.locator(`[data-slot="schedule-time-field"][data-boundary="${boundary}"][data-unit="${unit}"][data-lapse="${lapse}"]`)
const trigger = group => group.locator('[role="button"][aria-haspopup="listbox"]').first()
const choose = async (page, group, name) => {
  await trigger(group).click()
  await page.getByRole('option', { name, exact: true }).click()
}
const waitState = (page, predicate) => expect.poll(async () => predicate(await read(page, 'schedule-main-state'))).toBe(true)
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
  for (let index = 0; index < 120 && !await target.evaluate(element => element === document.activeElement); index += 1) await page.keyboard.press('Tab')
  await expect(target).toBeFocused()
}

test('actual controller preserves explicit empty and default seven-day initialization with 24/12-hour scalar values', async ({ page }) => {
  await page.goto(fixtureUrl('surface=schedules&mode=light'))
  await expect(schedule(page)).toBeVisible()
  await expect(schedule(page, 'schedule-default').locator('[data-slot="schedule-day"]')).toHaveCount(7)
  await expect.poll(async () => (await read(page, 'schedule-default-events')).length).toBe(1)
  const generated = (await read(page, 'schedule-default-events'))[0]
  expect(generated).toHaveLength(7)
  for (const generatedDay of generated) expect(generatedDay).toEqual({ enabled: true, lapses: [{ open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 59 } }] })
  await expect(schedule(page, 'schedule-empty')).toBeAttached()
  await expect(schedule(page, 'schedule-empty').locator('[data-slot="schedule-day"]')).toHaveCount(0)
  expect(await read(page, 'schedule-empty-events')).toEqual([])

  const sunday = day(schedule(page), 0)
  await expect(trigger(field(sunday, 'open', 'hour', 0))).toContainText('09')
  await expect(trigger(field(sunday, 'open', 'minute', 0))).toContainText('00')
  await expect(trigger(field(sunday, 'close', 'hour', 0))).toContainText('10')

  await page.goto(fixtureUrl('surface=schedules&mode=light&hour=12'))
  const twelveHourSunday = day(schedule(page), 0)
  await expect(trigger(field(twelveHourSunday, 'open', 'hour', 0))).toContainText('9 AM')
  await expect(trigger(field(twelveHourSunday, 'close', 'hour', 1))).toContainText('1 PM')
  await expect(trigger(field(twelveHourSunday, 'open', 'minute', 0))).toContainText('00')
})

test('valid, rejected, conflicting, enabled and read-only time changes retain exact controller behavior', async ({ page }) => {
  await page.goto(fixtureUrl('surface=schedules&mode=light'))
  const main = schedule(page)
  const sunday = day(main, 0)
  await choose(page, field(sunday, 'open', 'hour', 0), '08')
  await waitState(page, value => value[0].lapses[0].open.hour === 8)

  await choose(page, field(sunday, 'close', 'hour', 0), '08')
  const timeAlert = page.getByRole('alertdialog').filter({ hasText: 'Choose an end time later than the start time.' })
  await expect(timeAlert).toBeVisible()
  expect((await read(page, 'schedule-main-state'))[0].lapses[0].close.hour).toBe(10)
  await timeAlert.getByRole('button', { name: 'Accept', exact: true }).click()

  await choose(page, field(sunday, 'open', 'hour', 1), '09')
  const conflictAlert = page.getByRole('alertdialog').filter({ hasText: 'There is an schedule conflict' })
  await expect(conflictAlert).toBeVisible()
  expect((await read(page, 'schedule-main-state'))[0].lapses[1].open.hour).toBe(12)
  await conflictAlert.getByRole('button', { name: 'Accept', exact: true }).click()

  const tuesday = day(main, 2)
  await expect(tuesday.getByText('Unavailable', { exact: true })).toBeVisible()
  await tuesday.getByRole('checkbox', { name: 'Schedule: Tuesday', exact: true }).check()
  await waitState(page, value => value[2].enabled === true)
  await expect(field(day(main, 2), 'open', 'hour', 0)).toBeVisible()

  const readonly = schedule(page, 'schedule-readonly')
  const readonlySunday = day(readonly, 0)
  await expect(readonlySunday.getByRole('checkbox')).toHaveCount(0)
  await expect(readonlySunday.locator('[data-schedule-action]')).toHaveCount(0)
  await expect(readonly.locator('[data-slot="schedule-date"] .date')).toHaveCount(7)
  await choose(page, field(readonlySunday, 'open', 'hour', 0), '08')
  await expect.poll(async () => (await read(page, 'schedule-readonly-state'))[0].lapses[0].open.hour).toBe(8)
  expect(await page.evaluate(() => globalThis.__OD_SCHEDULE_DATE_CALLS__.every(call => call.outputFormat === 'YYYY-MM-DD'))).toBe(true)
})

test('automatic gap addition and delete confirmation preserve sorted payloads and cancellation', async ({ page }) => {
  await page.goto(fixtureUrl('surface=schedules&mode=light'))
  const main = schedule(page)
  const sunday = day(main, 0)
  await sunday.getByRole('button', { name: 'Add Schedule: Sunday', exact: true }).click()
  await waitState(page, value => value[0].lapses.length === 3)
  expect((await read(page, 'schedule-main-state'))[0].lapses).toEqual([
    { open: { hour: 9, minute: 0 }, close: { hour: 10, minute: 0 } },
    { open: { hour: 10, minute: 1 }, close: { hour: 11, minute: 59 } },
    { open: { hour: 12, minute: 0 }, close: { hour: 13, minute: 0 } }
  ])

  await day(main, 0).getByRole('button', { name: 'Delete Schedule: Sunday 2', exact: true }).click()
  let confirm = page.getByRole('alertdialog').filter({ hasText: 'Are you sure to delete this Schedule?' })
  await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect((await read(page, 'schedule-main-state'))[0].lapses).toHaveLength(3)
  await day(main, 0).getByRole('button', { name: 'Delete Schedule: Sunday 2', exact: true }).click()
  confirm = page.getByRole('alertdialog').filter({ hasText: 'Are you sure to delete this Schedule?' })
  await confirm.getByRole('button', { name: 'Accept', exact: true }).click()
  await waitState(page, value => value[0].lapses.length === 2)
  expect((await read(page, 'schedule-main-state'))[0].lapses).toEqual([
    { open: { hour: 9, minute: 0 }, close: { hour: 10, minute: 0 } },
    { open: { hour: 12, minute: 0 }, close: { hour: 13, minute: 0 } }
  ])
})

test('copy times resets destinations, blocks its source, closes on Escape/outside and applies exact days', async ({ page }) => {
  await page.goto(fixtureUrl('surface=schedules&mode=light'))
  const main = schedule(page)
  const sunday = day(main, 0)
  const copy = sunday.getByRole('button', { name: 'Copy times to: Sunday', exact: true })
  await copy.click()
  let dialog = page.getByRole('dialog', { name: 'Copy times to', exact: true })
  const source = dialog.getByRole('button', { name: 'Sunday', exact: true })
  await expect(source).toBeDisabled()
  await expect(source).toHaveAttribute('data-copy-source', '')
  await expect(source).toHaveAttribute('aria-pressed', 'true')
  await dialog.getByRole('button', { name: 'Monday', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Monday', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(copy).toBeFocused()
  await expect(page.getByTestId('schedule-parent-escape-events')).toHaveText('0')

  await copy.click()
  dialog = page.getByRole('dialog', { name: 'Copy times to', exact: true })
  await expect(dialog.getByRole('button', { name: 'Monday', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await page.getByTestId('schedule-outside').click()
  await expect(dialog).toHaveCount(0)

  await copy.click()
  dialog = page.getByRole('dialog', { name: 'Copy times to', exact: true })
  await dialog.getByRole('button', { name: 'Monday', exact: true }).click()
  await dialog.getByRole('button', { name: 'Tuesday', exact: true }).click()
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await waitState(page, value => value[1].enabled && value[2].enabled && value[1].lapses.length === 2 && value[2].lapses.length === 2)
  const applied = await read(page, 'schedule-main-state')
  expect(applied[1]).toEqual(applied[0])
  expect(applied[2]).toEqual(applied[0])
})

for (const mode of ['light', 'dark']) {
  test(`schedule uses governed ${mode} borders, effective contrast, keyboard focus and readable copy state`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(fixtureUrl(`surface=schedules&mode=${mode}`))
    const main = schedule(page)
    await expect(main).toBeVisible()
    const semantic = tokens.theme[mode].semantic
    await expect(day(main, 0)).toHaveCSS('border-bottom-color', rgb(semantic.border.default))
    for (const target of [day(main, 0).getByRole('heading', { name: 'Sunday', exact: true }), trigger(field(day(main, 0), 'open', 'hour', 0))]) {
      const value = await effectiveColors(target)
      expect.soft(contrast(value.foreground, value.background)).toBeGreaterThanOrEqual(4.5)
    }

    const keyboardTargets = [
      day(main, 0).getByRole('checkbox', { name: 'Schedule: Sunday', exact: true }),
      trigger(field(day(main, 0), 'open', 'hour', 0)),
      day(main, 0).getByRole('button', { name: 'Delete Schedule: Sunday 1', exact: true }),
      day(main, 0).getByRole('button', { name: 'Add Schedule: Sunday', exact: true }),
      day(main, 0).getByRole('button', { name: 'Copy times to: Sunday', exact: true })
    ]
    await page.evaluate(() => document.activeElement?.blur())
    for (const target of keyboardTargets) {
      await focusByKeyboard(page, target)
      const focus = await target.evaluate(element => ({ style: getComputedStyle(element).outlineStyle, width: parseFloat(getComputedStyle(element).outlineWidth) }))
      expect.soft(focus.style).toBe('solid')
      expect.soft(focus.width).toBeGreaterThanOrEqual(2)
    }
    await keyboardTargets.at(-1).press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Copy times to', exact: true })
    await expect(dialog).toBeVisible()
    for (const target of [dialog.getByText('Copy times to', { exact: true }), dialog.getByRole('button', { name: 'Monday', exact: true })]) {
      const value = await effectiveColors(target)
      expect.soft(contrast(value.foreground, value.background)).toBeGreaterThanOrEqual(4.5)
    }
    await page.screenshot({ path: testInfo.outputPath(`schedule-${mode}.png`), fullPage: true })
  })
}

test('reduced motion keeps schedule controls functional with primitive transitions removed', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(fixtureUrl('surface=schedules&mode=light'))
  const sunday = day(schedule(page), 0)
  const time = trigger(field(sunday, 'open', 'hour', 0))
  await expect(time).toHaveCSS('transition-duration', '0s')
  await time.press('Enter')
  await page.getByRole('option', { name: '08', exact: true }).press('Enter')
  await waitState(page, value => value[0].lapses[0].open.hour === 8)
  const copy = sunday.getByRole('button', { name: 'Copy times to: Sunday', exact: true })
  await copy.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Copy times to', exact: true })).toBeVisible()
})

for (const width of [320, 390]) {
  test.describe(`schedule at ${width}px coarse pointer`, () => {
    test.use({ viewport: { width, height: 800 }, hasTouch: true, isMobile: true })
    for (const rtl of [false, true]) {
      test(`${rtl ? 'RTL' : 'LTR'} lapse and copy controls stay within real viewport bounds before and after opening`, async ({ page }, testInfo) => {
        await page.goto(fixtureUrl(`surface=schedules&mode=dark&locale=${rtl ? 'ar' : 'en'}&rtl=${rtl}`))
        expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
        const sunday = day(schedule(page), 0)
        await sunday.scrollIntoViewIfNeeded()
        await page.screenshot({ path: testInfo.outputPath(`schedule-${width}-${rtl ? 'rtl' : 'ltr'}-before.png`) })
        expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
        const copy = sunday.locator('[data-schedule-action="copy"]')
        await copy.click()
        const dialog = page.getByRole('dialog', { name: translations.COPY_TIMES_TO[rtl ? 'ar' : 'en'], exact: true })
        await dialog.scrollIntoViewIfNeeded()
        for (const target of await sunday.locator('[data-slot="schedule-lapse"]:visible, [data-slot="schedule-time-field"]:visible, [data-schedule-action]:visible').all()) {
          const box = await target.boundingBox()
          expect.soft(box.x).toBeGreaterThanOrEqual(0)
          expect.soft(box.x + box.width).toBeLessThanOrEqual(width)
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
        const dialogBox = await dialog.boundingBox()
        expect(dialogBox.x).toBeGreaterThanOrEqual(0)
        expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(width)
        for (const control of await sunday.locator('input:visible, button:visible').all()) {
          const box = await control.boundingBox()
          expect.soft(box.width).toBeGreaterThanOrEqual(44)
          expect.soft(box.height).toBeGreaterThanOrEqual(44)
        }
        await page.screenshot({ path: testInfo.outputPath(`schedule-${width}-${rtl ? 'rtl' : 'ltr'}-after.png`) })
        expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      })
    }
  })
}

test('schedule and copy labels use all twelve locale dictionaries', async ({ page }) => {
  for (const locale of [localeConfig.sourceLanguage, ...localeConfig.supportedLocales]) {
    await page.goto(fixtureUrl(`surface=schedules&mode=light&locale=${locale}&rtl=${locale === 'ar'}`))
    const sunday = day(schedule(page), 0)
    const dayName = translations.SUNDAY[locale]
    await expect(sunday.getByRole('heading', { name: dayName, exact: true })).toBeVisible()
    await expect(sunday.getByRole('group', { name: `${dayName} ${translations.OPEN[locale]} ${translations.HOUR[locale]} 1`, exact: true })).toBeVisible()
    await expect(sunday.getByRole('checkbox', { name: `${translations.SCHEDULE[locale]}: ${dayName}`, exact: true })).toBeVisible()
    const copy = sunday.getByRole('button', { name: `${translations.COPY_TIMES_TO[locale]}: ${dayName}`, exact: true })
    await copy.click()
    const dialog = page.getByRole('dialog', { name: translations.COPY_TIMES_TO[locale], exact: true })
    await expect(dialog.getByRole('button', { name: translations.DAY7[locale], exact: true })).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(copy).toBeFocused()
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
  }
})

test('copy popup remains in the viewport when its host is fixed over a horizontally scrolled page', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto(fixtureUrl('surface=schedules&mode=light&locale=en'))
  const host = day(schedule(page), 0).locator('[data-slot="schedule-copy-times"]')
  await host.evaluate(element => {
    document.body.style.minWidth = '1200px'
    Object.assign(element.style, { position: 'fixed', right: '16px', top: '80px', zIndex: '1002' })
    window.scrollTo(100, 0)
  })
  await expect.poll(() => page.evaluate(() => window.scrollX)).toBe(100)
  await host.getByRole('button', { name: 'Copy times to: Sunday', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Copy times to', exact: true })
  await expect(dialog).toBeVisible()
  const bounds = await dialog.boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(320)
  expect(await page.evaluate(() => window.scrollX)).toBe(100)
})

test('copy popup remains in the viewport during native negative RTL page scroll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto(fixtureUrl('surface=schedules&mode=light&locale=ar&rtl=true'))
  const host = day(schedule(page), 0).locator('[data-slot="schedule-copy-times"]')
  await host.evaluate(element => {
    document.body.style.minWidth = '1200px'
    Object.assign(element.style, { position: 'fixed', right: '16px', top: '80px', zIndex: '1002' })
    window.scrollTo(-100, 0)
  })
  await expect.poll(() => page.evaluate(() => window.scrollX)).toBe(-100)
  await host.locator('[data-schedule-action="copy"]').click()
  const dialog = page.locator('[data-slot="schedule-copy-popover"]')
  await expect(dialog).toBeVisible()
  const bounds = await dialog.boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(320)
  expect(await page.evaluate(() => window.scrollX)).toBe(-100)
})
