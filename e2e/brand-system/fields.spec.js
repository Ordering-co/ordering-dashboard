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

const computedColors = locator => locator.evaluate(element => {
  const style = getComputedStyle(element)
  const placeholder = getComputedStyle(element, '::placeholder')
  return {
    background: style.backgroundColor,
    border: style.borderColor,
    color: style.color,
    outline: style.outlineColor,
    placeholder: placeholder.color
  }
})

for (const mode of ['light', 'dark']) {
  test(`Selection controls retain native checkbox serialization and keyboard behavior in ${mode}`, async ({ page }) => {
    await page.goto(fixtureUrl(`surface=fields&mode=${mode}&bootstrap=true`))
    const form = page.getByTestId('fields-form')
    const defaultValueCheckbox = page.getByTestId('default-value-checkbox')
    const partial = page.getByTestId('indeterminate-checkbox')
    await expect(defaultValueCheckbox).toBeChecked()
    await expect(defaultValueCheckbox).toHaveJSProperty('value', 'on')
    expect(await form.evaluate(element => new FormData(element).get('defaultChoice'))).toBe('on')
    for (const target of [defaultValueCheckbox, partial, page.getByTestId('radio-checkbox')]) {
      expect(await target.evaluate(element => element.tagName)).toBe('INPUT')
      await expect(target).toHaveAttribute('type', 'checkbox')
      await expect(target.locator('..').locator('input')).toHaveCount(1)
    }
    await expect(partial).toHaveJSProperty('indeterminate', true)
    await partial.click()
    await expect(partial).toHaveJSProperty('indeterminate', false)
    await expect(partial).not.toBeChecked()
    await defaultValueCheckbox.uncheck()
    expect(await form.evaluate(element => new FormData(element).has('defaultChoice'))).toBe(false)
    const visualDisabledSwitch = page.locator('.fixture-disabled-switch-hook')
    const switchInput = visualDisabledSwitch.locator('input')
    await expect(visualDisabledSwitch.locator(':scope > *')).toHaveCount(2)
    await expect(visualDisabledSwitch.locator(':scope > input + span')).toHaveCount(1)
    await expect(switchInput).toBeEnabled()
    await expect(switchInput).toBeChecked()
    await switchInput.focus()
    await page.keyboard.press('Space')
    await expect(switchInput).not.toBeChecked()
    await expect(page.getByTestId('switch-event')).toHaveText('false')
    await expect(visualDisabledSwitch).toHaveCSS('pointer-events', 'none')
    await form.evaluate(element => element.reset())
    await expect(defaultValueCheckbox).toBeChecked()
    expect(await form.evaluate(element => new FormData(element).get('defaultChoice'))).toBe('on')
  })

  test(`Base UI fields keep browser reset and Bootstrap composition in ${mode}`, async ({ page }) => {
    await page.goto(fixtureUrl(`surface=fields&mode=${mode}&bootstrap=true&rtl=true`))
    const input = page.locator('.fixture-input-hook')
    const textarea = page.locator('.fixture-textarea-hook')
    await expect(input).toBeVisible()
    await expect(input).toHaveCSS('background-color', rgb(tokens.theme[mode].semantic.surface.default))
    await expect(input).toHaveCSS('color', rgb(tokens.theme[mode].semantic.text.default))
    for (const side of ['left', 'right']) {
      const adornment = page.getByTestId(`tenant-attrs-group-${side}`)
      await expect(adornment).toHaveCSS('color', 'rgb(18, 52, 86)')
      await expect(adornment).toHaveCSS('border-top-color', 'rgb(18, 52, 86)')
    }
    await expect(page.getByTestId('primary-input')).toHaveCSS('border-top-color', rgb(tokens.theme[mode].semantic.action.default))
    await expect(page.getByTestId('input-group-left')).toHaveCSS('border-left-width', '0px')
    // Legacy RTL explicitly uses initial (medium), not the LTR 1px width.
    expect(await page.getByTestId('input-group-left').evaluate(element => parseFloat(getComputedStyle(element).borderRightWidth))).toBeGreaterThan(0)
    await expect(page.getByTestId('input-group-right')).toHaveCSS('border-left-width', '1px')
    await expect(page.getByTestId('input-group-right')).toHaveCSS('border-right-width', '0px')
    const initialNote = await textarea.inputValue()
    await input.fill('Edited browser value')
    await textarea.fill('Edited browser note')
    await page.getByTestId('fields-form').evaluate(form => form.reset())
    await expect(input).toHaveValue('Initial value')
    await expect(textarea).toHaveValue(initialNote)
    // A subsequent native edit must still reach React after reset.
    await input.fill('Edited after reset')
    await page.getByTestId('required-input').fill('Valid')
    await page.getByRole('button', { name: 'Serialize form' }).click()
    const serialized = JSON.parse(await page.getByTestId('serialized-form').textContent())
    expect(serialized.uncontrolled).toBe('Edited after reset')
    expect(serialized.notes).toBe(initialNote)
    expect(serialized.readonly).toBe('Read-only value')
    expect(serialized).not.toHaveProperty('disabled')
    expect(await input.evaluate(element => element.parentElement.tagName)).toBe('LABEL')
    expect(await textarea.evaluate(element => element.parentElement.tagName)).toBe('LABEL')
  })
}

const pseudoGeometry = (locator, pseudo = '::before') => locator.evaluate((element, pseudo) => {
  const style = getComputedStyle(element, pseudo)
  const matrix = style.transform === 'none' ? new DOMMatrixReadOnly() : new DOMMatrixReadOnly(style.transform)
  const width = parseFloat(style.width)
  const height = parseFloat(style.height)
  const left = style.left === 'auto' ? element.clientWidth - parseFloat(style.right) - width : parseFloat(style.left)
  const top = style.top === 'auto' ? element.clientHeight - parseFloat(style.bottom) - height : parseFloat(style.top)
  return {
    width,
    height,
    x: left + matrix.e,
    y: top + matrix.f,
    centerX: left + matrix.e + width / 2,
    centerY: top + matrix.f + height / 2,
    transformX: matrix.e,
    transformY: matrix.f
  }
}, pseudo)

const expectCentered = async (target, control) => {
  const targetBox = await target.boundingBox()
  const controlBox = await control.boundingBox()
  expect(Math.abs((targetBox.y + targetBox.height / 2) - (controlBox.y + controlBox.height / 2))).toBeLessThanOrEqual(1)
}

const reflowGeometry = page => page.evaluate(() => ({
  scroll: document.documentElement.scrollWidth,
  viewport: innerWidth,
  offenders: [...document.body.querySelectorAll('*')].map(element => {
    const rect = element.getBoundingClientRect()
    return {
      tag: element.tagName.toLowerCase(),
      className: typeof element.className === 'string' ? element.className.slice(0, 100) : '',
      text: element.textContent.trim().replace(/\s+/g, ' ').slice(0, 80),
      left: rect.left,
      right: rect.right,
      width: rect.width,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth
    }
  }).filter(item => item.left < -0.5 || item.right > innerWidth + 0.5).slice(0, 40)
}))

for (const mode of ['light', 'dark']) {
  test(`Fields preserve native contracts and governed ${mode} roles`, async ({ page }, testInfo) => {
    await page.goto(fixtureUrl(`surface=fields&mode=${mode}`))
    await expect(page.getByTestId('fields-fixture')).toBeVisible()

    const input = page.locator('.fixture-input-hook')
    const textarea = page.locator('.fixture-textarea-hook')
    const colors = await computedColors(input)
    expect(colors.background).toBe(rgb(tokens.theme[mode].semantic.surface.default))
    expect(colors.color).toBe(rgb(tokens.theme[mode].semantic.text.default))
    expect(colors.border).toBe(rgb(tokens.theme[mode].semantic.border.default))
    expect(contrast(colors.color, colors.background)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(colors.placeholder, colors.background)).toBeGreaterThanOrEqual(4.5)
    await expect(page.getByTestId('primary-input')).toHaveCSS('border-color', rgb(tokens.theme[mode].semantic.action.default))
    await expect(page.getByTestId('secondary-input')).toHaveCSS('color', rgb(tokens.theme[mode].semantic.text.muted))
    await expect(page.getByTestId('input-group-left')).toHaveCSS('border-color', rgb(tokens.theme[mode].semantic.action.default))
    await expect(page.getByTestId('input-group-left')).toHaveCSS('color', rgb(tokens.theme[mode].semantic.action.content))
    await expect(page.getByTestId('input-group-right')).toHaveCSS('background-color', rgb(tokens.theme[mode].semantic.surface.default))
    await expect(page.getByTestId('input-group-right')).toHaveCSS('color', rgb(tokens.theme[mode].semantic.action.content))
    await expect(page.getByTestId('input-group-right')).toHaveCSS('border-color', rgb(tokens.theme[mode].semantic.action.default))
    const adornedInput = page.getByRole('textbox', { name: 'Adorned value' })
    await expect(adornedInput).toHaveCSS('border-top-color', rgb(tokens.theme[mode].semantic.action.default))
    await expect(adornedInput).toHaveCSS('border-bottom-color', rgb(tokens.theme[mode].semantic.action.default))
    await expect(adornedInput).toHaveCSS('border-left-width', '0px')
    await expect(adornedInput).toHaveCSS('border-right-width', '0px')
    await expect(page.getByTestId('adorned-input-group').locator(':scope > *')).toHaveCount(3)
    expect(await page.getByTestId('left-adornment-button').evaluate(element => element.tagName)).toBe('BUTTON')
    expect(await page.getByTestId('right-adornment-button').evaluate(element => element.tagName)).toBe('BUTTON')
    expect(await page.getByTestId('custom-font-input').evaluate(element => getComputedStyle(element).fontFamily)).toContain('Fixture Tenant Sans')
    const checkbox = page.locator('.fixture-checkbox-hook')
    const checkboxRest = await checkbox.evaluate(element => ({
      background: getComputedStyle(element, '::before').backgroundColor,
      border: getComputedStyle(element, '::before').borderColor
    }))
    expect(checkboxRest.background).toBe(rgb(tokens.theme[mode].semantic.action.default))
    expect(checkboxRest.border).toBe(rgb(tokens.theme[mode].semantic.action.default))
    const indeterminateDash = await page.getByTestId('indeterminate-checkbox').evaluate(element => {
      const style = getComputedStyle(element, '::after')
      return {
        background: style.backgroundColor,
        borderBottom: style.borderBottomWidth,
        borderLeft: style.borderLeftWidth,
        borderRight: style.borderRightWidth,
        borderTop: style.borderTopWidth
      }
    })
    expect(indeterminateDash).toEqual({
      background: rgb(tokens.theme[mode].semantic.action.foreground),
      borderBottom: '0px',
      borderLeft: '0px',
      borderRight: '0px',
      borderTop: '0px'
    })
    await expect(page.locator('.fixture-disabled-switch-hook span')).toHaveCSS('background-color', rgb(tokens.theme[mode].semantic.action.default))
    await page.screenshot({ path: testInfo.outputPath(`fields-${mode}-roles.png`), fullPage: true })

    for (const field of [input, textarea, page.getByTestId('primary-input'), page.getByTestId('secondary-input')]) {
      await page.keyboard.press('Tab')
      await field.focus()
      await expect(field).toHaveCSS('outline-width', tokens.component.focusRing.width)
      await expect(field).toHaveCSS('outline-offset', tokens.component.focusRing.offset)
      const focused = await computedColors(field)
      expect(contrast(focused.outline, focused.background)).toBeGreaterThanOrEqual(3)
    }
    await page.keyboard.press('Tab')
    await checkbox.focus()
    await expect(checkbox).toHaveCSS('outline-width', tokens.component.focusRing.width)
    await expect(checkbox).toHaveCSS('outline-offset', tokens.component.focusRing.offset)
    const checkboxFocus = await computedColors(checkbox)
    expect(contrast(checkboxFocus.outline, rgb(tokens.theme[mode].semantic.surface.default))).toBeGreaterThanOrEqual(3)
    const switchInput = page.locator('.fixture-switch-hook input')
    const switchSlider = page.locator('.fixture-switch-hook span')
    await page.keyboard.press('Tab')
    await switchInput.focus()
    await expect(switchSlider).toHaveCSS('outline-width', tokens.component.focusRing.width)
    await expect(switchSlider).toHaveCSS('outline-offset', tokens.component.focusRing.offset)
    expect(contrast(await switchSlider.evaluate(element => getComputedStyle(element).outlineColor), rgb(tokens.theme[mode].semantic.surface.default))).toBeGreaterThanOrEqual(3)

    await expect(input).toHaveValue('Initial value')
    await input.fill('Changed uncontrolled value')
    const controlled = page.getByRole('textbox', { name: 'Controlled field', exact: true })
    await controlled.fill('Updated controlled value')
    await expect(page.getByTestId('controlled-value')).toHaveText('Updated controlled value')
    await expect(page.getByTestId('readonly-input')).toHaveJSProperty('readOnly', true)
    await expect(page.getByTestId('disabled-input')).toBeDisabled()
    const required = page.getByTestId('required-input')
    expect(await required.evaluate(element => element.checkValidity())).toBe(false)
    await required.fill('Required value')
    expect(await required.evaluate(element => element.checkValidity())).toBe(true)
    await expect(page.getByTestId('ref-contract')).toHaveText('INPUT:text:TEXTAREA')

    await expect(page.getByTestId('indeterminate-checkbox')).toHaveJSProperty('indeterminate', true)
    expect(await page.getByTestId('radio-checkbox').evaluate(element => element.type)).toBe('checkbox')
    await page.getByRole('button', { name: 'Serialize form' }).click()
    const serialized = JSON.parse(await page.getByTestId('serialized-form').textContent())
    expect(serialized).toMatchObject({
      uncontrolled: 'Changed uncontrolled value',
      controlled: 'Updated controlled value',
      required: 'Required value',
      readonly: 'Read-only value',
      primary: 'Primary value',
      secondary: 'Secondary value',
      notes: 'A long fixture note that preserves the native textarea value contract.',
      groupLeft: 'Left value',
      groupRight: 'Right value',
      adorned: 'Adorned value',
      accepted: 'yes',
      partial: 'partial',
      roundChoice: 'round'
    })
    expect(serialized).not.toHaveProperty('disabled')

    expect(await page.locator('.fixture-switch-hook input').isChecked()).toBe(false)
    await page.locator('.fixture-switch-hook').click()
    await expect(page.getByTestId('switch-event')).toHaveText('true')
    expect(await page.locator('.fixture-switch-hook input').isChecked()).toBe(true)
    await page.locator('.fixture-not-async-hook').click()
    await expect(page.getByTestId('pending-switch')).toHaveText('false')
    expect(await page.locator('.fixture-not-async-hook input').isChecked()).toBe(true)
    await page.getByTestId('commit-switch').click()
    await expect(page.locator('.fixture-not-async-hook input')).not.toBeChecked()

    const disabledSwitch = page.locator('.fixture-disabled-switch-hook')
    await expect(disabledSwitch).toHaveCSS('pointer-events', 'none')
    expect(await disabledSwitch.locator('input').isDisabled()).toBe(false)
    await expect(page.locator('.fixture-input-hook')).toHaveCount(1)
    await expect(page.locator('.fixture-checkbox-hook')).toHaveCount(1)
    await expect(page.locator('.fixture-input-group-hook')).toHaveCount(1)
  })

  test(`Fields ${mode} reflow, zoom, RTL, and reduced motion remain stable`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 320, height: 900 })
    await page.goto(fixtureUrl(`surface=fields&mode=${mode}`))
    const ltrSwitch = page.locator('.fixture-disabled-switch-hook')
    const ltrThumb = await pseudoGeometry(ltrSwitch.locator('span'))
    expect(ltrThumb.transformX).toBeGreaterThan(0)
    expect(ltrThumb.x).toBeGreaterThanOrEqual(0)
    expect(ltrThumb.x + ltrThumb.width).toBeLessThanOrEqual(25)

    await page.goto(fixtureUrl(`surface=fields&mode=${mode}&rtl=true`))
    await expect(page.getByTestId('fields-fixture')).toBeVisible()
    let geometry = await reflowGeometry(page)
    expect(geometry.scroll, JSON.stringify(geometry.offenders)).toBeLessThanOrEqual(geometry.viewport)
    await expect(page.locator('.fixture-input-hook')).toHaveCSS('transition-duration', '0s')
    await expect(page.locator('.fixture-switch-hook').locator('span')).toHaveCSS('transition-duration', '0s')
    await expect(page.getByTestId('input-group-left')).toHaveCSS('border-left-width', '0px')
    await expect(page.getByTestId('input-group-right')).toHaveCSS('border-right-width', '0px')
    expect(parseFloat(await page.getByTestId('left-adornment-button').evaluate(element => getComputedStyle(element).marginRight))).toBeLessThan(0)
    expect(parseFloat(await page.getByTestId('right-adornment-button').evaluate(element => getComputedStyle(element).marginLeft))).toBeLessThan(0)
    const checkedSwitch = page.locator('.fixture-disabled-switch-hook input')
    const rtlSwitch = page.locator('.fixture-disabled-switch-hook')
    const switchBox = await rtlSwitch.boundingBox()
    const rtlThumb = await pseudoGeometry(rtlSwitch.locator('span'))
    expect(await checkedSwitch.isChecked()).toBe(true)
    expect(switchBox.width).toBeGreaterThan(0)
    expect(rtlThumb.transformX).toBeLessThan(0)
    expect(Math.abs(rtlThumb.transformX)).toBe(Math.abs(ltrThumb.transformX))
    expect(rtlThumb.x).toBeGreaterThanOrEqual(0)
    expect(rtlThumb.x + rtlThumb.width).toBeLessThanOrEqual(25)

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(fixtureUrl(`surface=fields&mode=${mode}&rtl=true`))
    await page.evaluate(() => { document.documentElement.style.zoom = '2' })
    await expect(page.getByTestId('fields-fixture')).toBeVisible()
    geometry = await reflowGeometry(page)
    expect(geometry.scroll, JSON.stringify(geometry.offenders)).toBeLessThanOrEqual(geometry.viewport)
  })
}

test('tenant action remains exact for field accents', async ({ page }) => {
  await page.goto(fixtureUrl('surface=fields&mode=light&tenant=%23123456'))
  await expect(page.getByTestId('resolved-action')).toHaveText('#123456')
  await expect(page.getByTestId('primary-input')).toHaveCSS('border-color', 'rgb(18, 52, 86)')
})

test.describe('coarse field targets', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })

  for (const mode of ['light', 'dark']) {
    test(`checkboxes and switches expose centered 44px targets in ${mode}`, async ({ page }) => {
      await page.goto(fixtureUrl(`surface=fields&mode=${mode}`))
      for (const [targetId, control] of [
        ['checkbox-target', page.locator('.fixture-checkbox-hook')],
        ['radio-checkbox-target', page.getByTestId('radio-checkbox')],
        ['indeterminate-target', page.getByTestId('indeterminate-checkbox')],
        ['switch-target', page.locator('.fixture-switch-hook')],
        ['not-async-switch-target', page.locator('.fixture-not-async-hook')],
        ['disabled-switch-target', page.locator('.fixture-disabled-switch-hook')]
      ]) {
        const target = page.getByTestId(targetId)
        const targetBox = await target.boundingBox()
        const controlBox = await control.boundingBox()
        expect(targetBox.height).toBeGreaterThanOrEqual(44)
        expect(targetBox.width).toBeGreaterThanOrEqual(44)
        expect(controlBox.height, `${targetId} control height`).toBeGreaterThanOrEqual(44)
        expect(controlBox.width, `${targetId} control width`).toBeGreaterThanOrEqual(44)
        await expectCentered(target, control)
      }

      for (const [name, field] of [
        ['Input', page.locator('.fixture-input-hook')],
        ['TextArea', page.locator('.fixture-textarea-hook')]
      ]) {
        const box = await field.boundingBox()
        expect(box.height, `${name} coarse height`).toBeGreaterThanOrEqual(44)
      }

      for (const checkbox of [page.locator('.fixture-checkbox-hook'), page.getByTestId('radio-checkbox'), page.getByTestId('indeterminate-checkbox')]) {
        const box = await checkbox.boundingBox()
        const visual = await pseudoGeometry(checkbox)
        expect(visual.width).toBe(18)
        expect(visual.height).toBe(18)
        expect(Math.abs(visual.centerX - box.width / 2)).toBeLessThanOrEqual(0.5)
        expect(Math.abs(visual.centerY - box.height / 2)).toBeLessThanOrEqual(0.5)
      }

      for (const switchControl of [page.locator('.fixture-switch-hook'), page.locator('.fixture-not-async-hook'), page.locator('.fixture-disabled-switch-hook')]) {
        const controlBox = await switchControl.boundingBox()
        const trackBox = await switchControl.locator('span').boundingBox()
        expect(trackBox.width).toBe(25)
        expect(trackBox.height).toBe(14)
        expect(Math.abs((trackBox.x + trackBox.width / 2) - (controlBox.x + controlBox.width / 2))).toBeLessThanOrEqual(0.5)
        expect(Math.abs((trackBox.y + trackBox.height / 2) - (controlBox.y + controlBox.height / 2))).toBeLessThanOrEqual(0.5)
      }
    })
  }
})
