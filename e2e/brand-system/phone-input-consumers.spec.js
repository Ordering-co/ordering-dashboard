import { test, expect, fixtureUrl } from './fixtures'
import { tokens } from '../../src/brand/ordering.tokens.generated'
import localeConfig from '../../i18n/config.json'
import translations from '../../i18n/translations.json'

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

const input = scope => scope.locator('.PhoneInputInput')
const country = scope => scope.locator('.PhoneInputCountrySelect')
const events = page => page.getByTestId('phone-events').evaluate(element => JSON.parse(element.textContent))
const viewportState = page => page.evaluate(() => ({
  coarse: matchMedia('(pointer: coarse)').matches,
  offsetLeft: window.visualViewport?.offsetLeft ?? 0,
  offsetTop: window.visualViewport?.offsetTop ?? 0,
  scale: window.visualViewport?.scale ?? 1,
  scrollLeft: document.documentElement.scrollLeft,
  scrollWidth: document.documentElement.scrollWidth,
  viewportWidth: window.visualViewport?.width ?? innerWidth
}))

test('real InputPhoneNumber preserves controlled international/national display and disabled controls', async ({ page }) => {
  await page.goto(fixtureUrl('surface=phone-input-consumers&mode=light'))
  const international = page.getByTestId('international-phone-consumer')
  const national = page.getByTestId('confirm-admin-phone-consumer')
  const disabled = page.getByTestId('disabled-phone-consumer')

  for (const scope of [international, national, disabled]) {
    await expect(scope.locator('img.PhoneInputCountryIconImg')).toHaveAttribute('src', /brand-fixture-flags\/US\.svg$/)
    await expect.poll(() => scope.locator('img.PhoneInputCountryIconImg').evaluate(element => element.complete && element.naturalWidth > 0)).toBe(true)
  }
  await expect(input(international)).toHaveValue(/\+1.*202.*555.*0123/)
  await expect(input(national)).toHaveValue(/202.*555.*0123/)
  expect((await input(national).inputValue()).startsWith('+1')).toBe(false)
  await expect(input(disabled)).toBeDisabled()
  await expect(country(disabled)).toBeDisabled()
  // Direct styled-facade consumers must load their own presentation rules.
  await expect(input(national)).toHaveCSS('height', '43px')
  await expect(national.locator('.PhoneInputCountry')).toHaveCSS('padding-left', '8px')

  await input(international).clear()
  await expect(page.getByTestId('phone-values')).toContainText('"internationalValue":""')
  await expect.poll(async () => (await events(page)).international.at(-1)).toMatchObject({ number: null, numberType: 'undefined', raw: null, validType: 'undefined', arity: 3 })
})

test('real InputPhoneNumber reports invalid then valid controlled values', async ({ page }) => {
  await page.goto(fixtureUrl('surface=phone-input-consumers&mode=light'))
  const national = page.getByTestId('confirm-admin-phone-consumer')
  await input(national).clear()
  await input(national).fill('2')
  await expect.poll(async () => (await events(page)).national.at(-1)).toMatchObject({ valid: null, validType: 'undefined', arity: 3 })
  await input(national).fill('202')
  await expect.poll(async () => (await events(page)).national.at(-1)?.valid).toBe(false)
  await expect(national.getByText('The Phone Number field is invalid', { exact: true })).toBeVisible()

  const eventCount = (await events(page)).national.length
  await input(national).fill('2025550147')
  await expect.poll(async () => (await events(page)).national.length).toBe(eventCount + 1)
  await expect.poll(async () => (await events(page)).national.at(-1)).toMatchObject({ number: '+12025550147', valid: true })
  await expect(national.getByText('The Phone Number field is invalid', { exact: true })).toHaveCount(0)
})

test('real country change preserves the UK leading-zero raw credential shape', async ({ page }) => {
  await page.goto(fixtureUrl('surface=phone-input-consumers&mode=light'))
  const national = page.getByTestId('confirm-admin-phone-consumer')
  await input(national).clear()
  await country(national).selectOption('GB')
  await expect(country(national)).toHaveValue('GB')
  await input(national).fill('02079460018')
  await expect.poll(async () => (await events(page)).national.at(-1)).toMatchObject({
    number: '+442079460018',
    raw: { countryCallingCode: '+44', number: '02079460018' },
    valid: true
  })
})

test('validation-disabled config keeps the real widget controlled and returns no raw override', async ({ page }) => {
  await page.goto(fixtureUrl('surface=phone-input-consumers&mode=light'))
  const national = page.getByTestId('confirm-admin-phone-consumer')
  await page.getByRole('button', { name: 'Disable phone validation', exact: true }).click()
  await input(national).clear()
  await input(national).fill('2')
  await expect.poll(async () => (await events(page)).national.at(-1)).toMatchObject({ valid: true, raw: null })
  await expect(national.getByText('The Phone Number field is invalid', { exact: true })).toHaveCount(0)
})

for (const mode of ['light', 'dark']) {
  test(`style target: ConfirmAdmin phone exposes canonical contrast and governed focus in ${mode}`, async ({ page }) => {
    await page.goto(fixtureUrl(`surface=phone-input-consumers&mode=${mode}`))
    const consumer = page.getByTestId('confirm-admin-phone-consumer')
    const field = input(consumer)
    const surface = rgb(tokens.theme[mode].semantic.surface.default)
    const text = rgb(tokens.theme[mode].semantic.text.default)
    const placeholder = rgb(tokens.theme[mode].semantic.text.subtle)
    const focus = rgb(tokens.theme[mode].semantic.action.focus)
    const danger = rgb(tokens.theme[mode].semantic.state.danger.functional)

    const fieldColors = await field.evaluate(element => ({
      background: getComputedStyle(element).backgroundColor,
      color: getComputedStyle(element).color,
      placeholder: getComputedStyle(element, '::placeholder').color
    }))
    expect(fieldColors).toEqual({ background: surface, color: text, placeholder })
    expect(contrast(fieldColors.color, fieldColors.background)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(fieldColors.placeholder, fieldColors.background)).toBeGreaterThanOrEqual(4.5)

    await field.clear()
    await field.fill('2')
    const error = consumer.getByText('The Phone Number field is invalid', { exact: true })
    await expect(error).toHaveCSS('color', danger)
    expect(contrast(await error.evaluate(element => getComputedStyle(element).color), surface)).toBeGreaterThanOrEqual(4.5)

    await input(consumer).focus()
    await expect(input(consumer)).toHaveCSS('outline-width', '2px')
    await expect(input(consumer)).toHaveCSS('outline-color', focus)
    expect(contrast(await input(consumer).evaluate(element => getComputedStyle(element).outlineColor), surface)).toBeGreaterThanOrEqual(3)
    await country(consumer).focus()
    await expect(consumer.locator('.PhoneInputCountry')).toHaveCSS('outline-width', '2px')
    await expect(consumer.locator('.PhoneInputCountry')).toHaveCSS('outline-color', focus)
  })
}

test('style target: phone retains tenant action data and uses canonical focus', async ({ page }) => {
  await page.goto(fixtureUrl('surface=phone-input-consumers&mode=light&tenant=%23123456'))
  const consumer = page.getByTestId('confirm-admin-phone-consumer')
  await input(consumer).focus()
  await expect(page.getByTestId('phone-theme')).toContainText('"primary":"#123456"')
  await expect(input(consumer)).toHaveCSS('outline-color', rgb(tokens.theme.light.semantic.action.focus))
  await country(consumer).focus()
  await expect(consumer.locator('.PhoneInputCountry')).toHaveCSS('outline-color', rgb(tokens.theme.light.semantic.action.focus))
})

test('runtime theme, direction, tenant and validation updates preserve the mounted input value', async ({ page }) => {
  await page.goto(fixtureUrl('surface=phone-input-consumers&mode=light'))
  const consumer = page.getByTestId('confirm-admin-phone-consumer')
  const field = input(consumer)
  const initialValue = await field.inputValue()
  await field.evaluate(element => { element.dataset.sameMount = 'phone-control' })

  await page.getByTestId('phone-theme-toggle').click()
  await expect(page.getByTestId('phone-theme')).toContainText('"mode":"dark"')
  await expect(field).toHaveCSS('background-color', rgb(tokens.theme.dark.semantic.surface.default))

  await page.getByTestId('phone-direction-toggle').click()
  await expect(page.getByTestId('phone-theme')).toContainText('"rtl":true')
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).direction)).toBe('rtl')

  await page.getByTestId('phone-tenant-apply').click()
  await expect(page.getByTestId('phone-theme')).toContainText('"primary":"#123456"')
  await expect(page.getByTestId('phone-theme')).toContainText('"font":"monospace"')
  await expect(field).toHaveCSS('font-family', 'monospace')

  await page.getByRole('button', { name: 'Disable phone validation', exact: true }).click()
  await expect(page.getByTestId('phone-values')).toContainText('"validationEnabled":false')
  await expect(field).toHaveAttribute('data-same-mount', 'phone-control')
  await expect(field).toHaveValue(initialValue)
  await field.focus()
  await expect(field).toHaveCSS('outline-color', rgb(tokens.theme.dark.semantic.action.focus))
})

test('native country select supports keyboard selection and keeps its visible focus indicator', async ({ page }) => {
  await page.goto(fixtureUrl('surface=phone-input-consumers&mode=light'))
  const consumer = page.getByTestId('confirm-admin-phone-consumer')
  const select = country(consumer)
  const initialCountry = await select.inputValue()

  await select.focus()
  await expect(select).toBeFocused()
  await expect(consumer.locator('.PhoneInputCountrySelectArrow')).toHaveCSS('opacity', '1')
  await page.keyboard.press('g')
  await expect.poll(() => select.inputValue()).not.toBe(initialCountry)
  await expect(input(consumer)).toBeFocused()
})

for (const width of [320, 390]) {
  test.describe(`ConfirmAdmin phone at ${width}px RTL`, () => {
    test.use({ viewport: { width, height: 720 }, hasTouch: true, isMobile: true })

    test('style target: input and country controls keep 44px targets without viewport overflow', async ({ page }, testInfo) => {
      await page.goto(fixtureUrl('surface=phone-input-consumers&mode=dark&rtl=true'))
      const before = await viewportState(page)
      expect(before.coarse).toBe(true)
      expect(before.scrollWidth).toBeLessThanOrEqual(before.viewportWidth)
      await page.screenshot({ path: testInfo.outputPath(`phone-input-${width}-before.png`) })
      expect((await viewportState(page)).coarse).toBe(true)

      const consumer = page.getByTestId('confirm-admin-phone-consumer')
      for (const control of [input(consumer), consumer.locator('.PhoneInputCountry')]) {
        const box = await control.boundingBox()
        expect(box.width).toBeGreaterThanOrEqual(44)
        expect(box.height).toBeGreaterThanOrEqual(44)
      }
      await input(consumer).clear()
      await input(consumer).fill('2')
      await expect(consumer.getByText('The Phone Number field is invalid', { exact: true })).toBeVisible()

      const after = await viewportState(page)
      expect(after.coarse).toBe(true)
      expect(after.scrollWidth).toBeLessThanOrEqual(after.viewportWidth)
      expect(after.scrollLeft).toBe(0)
      expect(after.offsetLeft).toBe(0)
      expect(after.offsetTop).toBe(0)
      expect(after.scale).toBe(1)
      expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl')
      await page.screenshot({ path: testInfo.outputPath(`phone-input-${width}-after.png`) })
      expect((await viewportState(page)).coarse).toBe(true)
    })
  })
}

test('real smart caret preserves mid-number editing and a single callback per bulk change', async ({ page }) => {
  await page.goto(fixtureUrl('surface=phone-input-consumers&mode=light'))
  const national = page.getByTestId('confirm-admin-phone-consumer')
  const field = input(national)
  await field.clear()
  const eventCount = (await events(page)).national.length
  await field.fill('2025550147')
  await expect.poll(async () => (await events(page)).national.length).toBe(eventCount + 1)
  await expect.poll(async () => (await events(page)).national.at(-1)?.number).toBe('+12025550147')
  await field.press('End')
  await field.press('ArrowLeft')
  await field.press('Backspace')
  await field.pressSequentially('9')
  await expect.poll(async () => (await events(page)).national.at(-1)?.number).toBe('+12025550197')
  expect(await field.evaluate(element => element.selectionStart === element.value.length - 1 && element.selectionEnd === element.selectionStart)).toBe(true)
})

test('phone placeholder and validation error use the actual catalog in all twelve locales', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 })
  for (const locale of [localeConfig.sourceLanguage, ...localeConfig.supportedLocales]) {
    await page.goto(fixtureUrl(`surface=phone-input-consumers&mode=light&locale=${locale}&rtl=${locale === 'ar'}`))
    const consumer = page.getByTestId('confirm-admin-phone-consumer')
    const field = input(consumer)
    const expectedPlaceholder = translations.PHONE_NUMBER[locale]
    const expectedError = translations.INVALID_ERROR_PHONE_NUMBER[locale]
    expect(expectedPlaceholder).toBeTruthy()
    expect(expectedError).toBeTruthy()
    await expect(field).toHaveAttribute('placeholder', expectedPlaceholder)
    await field.clear()
    await field.fill('2')
    const error = consumer.getByText(expectedError, { exact: true })
    await expect(error).toBeVisible()
    const bounds = await error.evaluate(element => {
      const range = document.createRange()
      range.selectNodeContents(element)
      const rect = range.getBoundingClientRect()
      return { left: rect.left, right: rect.right, viewport: innerWidth }
    })
    expect(bounds.left).toBeGreaterThanOrEqual(0)
    expect(bounds.right).toBeLessThanOrEqual(bounds.viewport)
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
  }
})
