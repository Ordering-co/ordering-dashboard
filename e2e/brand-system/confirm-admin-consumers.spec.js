import { test, expect, fixtureUrl } from './fixtures'
import { tokens } from '../../src/brand/ordering.tokens.generated'
import localeConfig from '../../i18n/config.json'
import translations from '../../i18n/translations.json'

// redesign fix-qa E5: the owner is a Product Dialog, and the Product wrappers read the --od-x-* candidate
// tokens that the app loads from src/index.js, and the released --od-* tokens at :root (the dashboard's
// GlobalStyle does that; the portal of a dialog sits outside the harness wrapper). This harness entry only
// scopes the release to its wrapper, so the fixture adds the candidates file the app ships and scopes the
// release to the document too; nothing else about the fixture changes.
const gotoFixture = async (page, query) => {
  await page.goto(fixtureUrl(query))
  await page.addStyleTag({ path: 'src/brand/candidates.css' })
  const mode = new URLSearchParams(query).get('mode') === 'dark' ? 'dark' : 'light'
  await page.evaluate(theme => {
    document.documentElement.setAttribute('data-ordering-brand', '')
    document.documentElement.setAttribute('data-od-theme', theme)
  }, mode)
}
const parseRgb = color => color.match(/[\d.]+/g).slice(0, 3).map(Number)
const luminance = color => parseRgb(color).map(value => value / 255)
  .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
const contrast = (foreground, background) => {
  const a = luminance(foreground)
  const b = luminance(background)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
const rgb = hex => `rgb(${hex.slice(1).match(/../g).map(part => parseInt(part, 16)).join(', ')})`
const effectiveColors = locator => locator.evaluate(element => {
  let background = getComputedStyle(element).backgroundColor
  let current = element
  while ((background === 'transparent' || background === 'rgba(0, 0, 0, 0)') && current.parentElement) {
    current = current.parentElement
    background = getComputedStyle(current).backgroundColor
  }
  return { background, color: getComputedStyle(element).color }
})
// redesign fix-qa E5: the owner is a Product Dialog, found by role and name instead of the legacy `.popup-dialog`
// shell; its title is an h2 and its close button is the one the wrapper draws.
const openAdmin = async (page, headingName = 'Confirm password') => {
  await page.getByRole('button', { name: 'Open administrator confirmation', exact: true }).click()
  const heading = page.getByRole('heading', { name: headingName, exact: true })
  await expect(heading).toBeVisible()
  return page.getByRole('dialog', { name: headingName, exact: true })
}
// redesign fix-qa E5: the three methods are a SegmentedControl. On a narrow screen, or with a long locale, the
// control becomes a native select by design (C13: one row or a select, never two rows), so a flow picks the
// method by its button when there is one and by its option otherwise. The flow after the pick is unchanged.
const chooseMethod = async (dialog, label) => {
  const button = dialog.getByRole('button', { name: label, exact: true })
  if (await button.count() > 0) {
    await button.click()
    return
  }
  await dialog.getByRole('combobox', { name: 'Confirmation method', exact: true }).selectOption({ label })
}
const alertDialog = page => page.getByRole('alertdialog', { name: 'Ordering.co', exact: true })
const closeAlert = async page => {
  const alert = alertDialog(page)
  await expect(alert).toBeVisible()
  await alert.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(alert).not.toBeVisible()
}
const requests = page => page.getByTestId('confirm-admin-requests').evaluate(element => JSON.parse(element.textContent))
const viewportState = page => page.evaluate(() => ({
  coarse: matchMedia('(pointer: coarse)').matches,
  offsetLeft: window.visualViewport?.offsetLeft ?? 0,
  offsetTop: window.visualViewport?.offsetTop ?? 0,
  scale: window.visualViewport?.scale ?? 1,
  scrollLeft: document.documentElement.scrollLeft,
  scrollWidth: document.documentElement.scrollWidth,
  viewportWidth: window.visualViewport?.width ?? innerWidth
}))
const fillOtp = async (dialog, code) => {
  const inputs = dialog.locator('.otp-input')
  await expect(inputs).toHaveCount(6)
  for (let index = 0; index < code.length; index++) await inputs.nth(index).fill(code[index])
}
const openEmailOtp = async (page, dialog) => {
  await dialog.getByRole('button', { name: 'Email code', exact: true }).click()
  await dialog.getByPlaceholder('Email', { exact: true }).fill('admin@example.test')
  await dialog.getByRole('button', { name: 'Get verify code', exact: true }).click()
  await closeAlert(page)
  const inputs = dialog.locator('.otp-input')
  await expect(inputs).toHaveCount(6)
  return inputs
}
const controlGeometry = (dialog, selector) => dialog.evaluate((root, controlSelector) => {
  const viewport = {
    left: window.visualViewport?.offsetLeft ?? 0,
    top: window.visualViewport?.offsetTop ?? 0,
    right: (window.visualViewport?.offsetLeft ?? 0) + (window.visualViewport?.width ?? innerWidth),
    bottom: (window.visualViewport?.offsetTop ?? 0) + (window.visualViewport?.height ?? innerHeight)
  }
  const clipRect = element => {
    const rect = element.getBoundingClientRect()
    return {
      left: rect.left + element.clientLeft,
      top: rect.top + element.clientTop,
      right: rect.left + element.clientLeft + element.clientWidth,
      bottom: rect.top + element.clientTop + element.clientHeight
    }
  }
  const intersect = (first, second, clipX, clipY) => ({
    left: clipX ? Math.max(first.left, second.left) : first.left,
    top: clipY ? Math.max(first.top, second.top) : first.top,
    right: clipX ? Math.min(first.right, second.right) : first.right,
    bottom: clipY ? Math.min(first.bottom, second.bottom) : first.bottom
  })

  return Array.from(root.querySelectorAll(controlSelector)).map((element, index) => {
    const sourceRect = element.getBoundingClientRect()
    const rect = {
      left: sourceRect.left,
      top: sourceRect.top,
      right: sourceRect.right,
      bottom: sourceRect.bottom,
      width: sourceRect.width,
      height: sourceRect.height
    }
    let visible = { ...viewport }
    const clippingAncestors = []
    for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor)
      const clipsX = ancestor === root || /(auto|scroll|hidden|clip)/.test(style.overflowX)
      const clipsY = ancestor === root || /(auto|scroll|hidden|clip)/.test(style.overflowY)
      if (clipsX || clipsY) {
        const bounds = clipRect(ancestor)
        visible = intersect(visible, bounds, clipsX, clipsY)
        clippingAncestors.push({
          className: ancestor.className?.toString() || '',
          clipsX,
          clipsY,
          bounds
        })
      }
      if (ancestor === root) break
    }
    return { index, rect, visible, viewport, clippingAncestors }
  })
}, selector)
const expectControlsFullyVisible = async (dialog, selector, count) => {
  const controls = await controlGeometry(dialog, selector)
  expect(controls).toHaveLength(count)
  for (const control of controls) {
    expect(control.clippingAncestors.length).toBeGreaterThan(0)
    expect(control.rect.width).toBeGreaterThanOrEqual(44)
    expect(control.rect.height).toBeGreaterThanOrEqual(44)
    expect(control.rect.left).toBeGreaterThanOrEqual(control.viewport.left - 0.5)
    expect(control.rect.top).toBeGreaterThanOrEqual(control.viewport.top - 0.5)
    expect(control.rect.right).toBeLessThanOrEqual(control.viewport.right + 0.5)
    expect(control.rect.bottom).toBeLessThanOrEqual(control.viewport.bottom + 0.5)
    expect(control.rect.left).toBeGreaterThanOrEqual(control.visible.left - 0.5)
    expect(control.rect.top).toBeGreaterThanOrEqual(control.visible.top - 0.5)
    expect(control.rect.right).toBeLessThanOrEqual(control.visible.right + 0.5)
    expect(control.rect.bottom).toBeLessThanOrEqual(control.visible.bottom + 0.5)
  }
  for (let first = 0; first < controls.length; first++) {
    for (let second = first + 1; second < controls.length; second++) {
      const horizontalOverlap = Math.min(controls[first].rect.right, controls[second].rect.right) - Math.max(controls[first].rect.left, controls[second].rect.left)
      const verticalOverlap = Math.min(controls[first].rect.bottom, controls[second].rect.bottom) - Math.max(controls[first].rect.top, controls[second].rect.top)
      expect(Math.min(horizontalOverlap, verticalOverlap)).toBeLessThanOrEqual(0.5)
    }
  }
}

test('ConfirmAdmin keeps RHF password-required validation without a synthetic request', async ({ page }) => {
  await gotoFixture(page, 'surface=confirm-admin-consumers&mode=light')
  const dialog = await openAdmin(page)
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click()
  const alert = alertDialog(page)
  await expect(alert.getByText('Password is required', { exact: true })).toBeVisible()
  expect(await requests(page)).toEqual([])
  await closeAlert(page)
  await expect(dialog).toBeVisible()
})

test('ConfirmAdmin keeps password error and zero-argument success distinct', async ({ page }) => {
  await gotoFixture(page, 'surface=confirm-admin-consumers&mode=light')
  let dialog = await openAdmin(page)
  // redesign fix-qa E5: the brand «md» dialog (560px, --od-x-dialog-md) replaces the legacy 600px modal.
  await expect(dialog).toHaveCSS('width', '560px')
  const password = dialog.getByPlaceholder('Type your password to confirm.', { exact: true })
  await password.fill('wrong-secret')
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(alertDialog(page).getByText('Password mismatch', { exact: true })).toBeVisible()
  await expect(page.getByTestId('confirm-admin-confirmations')).toHaveText('[]')
  await closeAlert(page)
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByTestId('confirm-admin-close-calls')).toHaveText('1')

  dialog = await openAdmin(page)
  await dialog.getByPlaceholder('Type your password to confirm.', { exact: true }).fill('fixture-secret')
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByTestId('confirm-admin-confirmations')).toHaveText('[{"args":[],"arity":0}]')
  expect(await requests(page)).toEqual([
    { kind: 'password', body: { password: 'wrong-secret' } },
    { kind: 'password', body: { password: 'fixture-secret' } }
  ])
})

test('ConfirmAdmin keeps native email validation, code-sent Alert, and one-string OTP confirmation', async ({ page }) => {
  await gotoFixture(page, 'surface=confirm-admin-consumers&mode=light')
  const dialog = await openAdmin(page)
  await chooseMethod(dialog, 'Email code')
  const email = dialog.getByPlaceholder('Email', { exact: true })
  await email.fill('invalid-email')
  await dialog.getByRole('button', { name: 'Get verify code', exact: true }).click()
  expect(await email.evaluate(element => ({ typeMismatch: element.validity.typeMismatch, valid: element.checkValidity() }))).toEqual({ typeMismatch: true, valid: false })
  await expect(alertDialog(page)).toHaveCount(0)
  expect(await requests(page)).toEqual([])

  await email.fill('admin@example.test')
  await dialog.getByRole('button', { name: 'Get verify code', exact: true }).click()
  expect(await requests(page)).toEqual([{ kind: 'otp', body: { type: 5, channel: 1, size: 6, email: 'admin@example.test' } }])
  await expect(alertDialog(page).getByText('The code has been sent', { exact: true })).toBeVisible()
  await closeAlert(page)
  await fillOtp(dialog, '123456')
  await expect(dialog).not.toBeVisible()
  await expect(page.getByTestId('confirm-admin-confirmations')).toHaveText('[{"args":["123456"],"arity":1}]')
})

test('ConfirmAdmin keeps real cellphone validation and channel-two OTP payload', async ({ page }) => {
  await gotoFixture(page, 'surface=confirm-admin-consumers&mode=light')
  const dialog = await openAdmin(page)
  await chooseMethod(dialog, 'SMS code')
  await dialog.getByRole('button', { name: 'Get verify code', exact: true }).click()
  await expect(alertDialog(page).getByText('The field Phone Number is required.', { exact: true })).toBeVisible()
  expect(await requests(page)).toEqual([])
  await closeAlert(page)

  const phone = dialog.locator('.PhoneInputInput')
  await phone.fill('+12025550147')
  await dialog.getByRole('button', { name: 'Get verify code', exact: true }).click()
  await expect.poll(() => requests(page)).toEqual([{
    kind: 'otp',
    body: { type: 5, channel: 2, size: 6, country_phone_code: '1', cellphone: '2025550147' }
  }])
  await expect(alertDialog(page).getByText('The code has been sent', { exact: true })).toBeVisible()
  await closeAlert(page)
  await fillOtp(dialog, '654321')
  await expect(page.getByTestId('confirm-admin-confirmations')).toHaveText('[{"args":["654321"],"arity":1}]')
})

test('ConfirmAdmin preserves early resend and resets the elapsed timer after an eligible resend', async ({ page }) => {
  await page.clock.install()
  await gotoFixture(page, 'surface=confirm-admin-consumers&mode=light')
  const dialog = await openAdmin(page)
  await chooseMethod(dialog, 'Email code')
  await dialog.getByRole('button', { name: 'Get verify code', exact: true }).click()
  await closeAlert(page)
  await expect(dialog.getByText('10:00', { exact: true })).toBeVisible()

  await dialog.getByText('Resend again?', { exact: true }).click()
  await expect.poll(async () => (await requests(page)).length).toBe(2)
  await closeAlert(page)
  await expect(dialog.getByText('10:00', { exact: true })).toBeVisible()

  await page.clock.runFor(80000)
  await expect(dialog.getByText('8:40', { exact: true })).toBeVisible()
  await dialog.getByText('Resend again?', { exact: true }).click()
  await expect.poll(async () => (await requests(page)).length).toBe(3)
  await closeAlert(page)
  await expect(dialog.getByText('10:00', { exact: true })).toBeVisible()
  expect((await requests(page)).every(request => request.body.channel === 1)).toBe(true)
})

test('C2 target: ConfirmAdmin links its visible heading as the dialog accessible name', async ({ page }) => {
  await gotoFixture(page, 'surface=confirm-admin-consumers&mode=dark')
  await openAdmin(page)
  await expect(page.getByRole('dialog', { name: 'Confirm password', exact: true })).toBeVisible()
})

test('C2 target: OTP autofocus reaches resend by Tab and Enter or Space keeps early resend active', async ({ page }) => {
  await gotoFixture(page, 'surface=confirm-admin-consumers&mode=light')
  const dialog = await openAdmin(page)
  await chooseMethod(dialog, 'Email code')
  await dialog.getByRole('button', { name: 'Get verify code', exact: true }).click()
  await closeAlert(page)

  const otpInputs = dialog.locator('.otp-input')
  await expect(otpInputs.first()).toBeFocused()
  await otpInputs.last().focus()
  await page.keyboard.press('Tab')
  const resend = dialog.getByRole('button', { name: 'Resend again?', exact: true })
  await expect(resend).toBeFocused()
  await page.keyboard.press('Enter')
  await expect.poll(async () => (await requests(page)).length).toBe(2)
  await closeAlert(page)
  await expect(resend).toBeFocused()
  await page.keyboard.press('Space')
  await expect.poll(async () => (await requests(page)).length).toBe(3)
})

test('C2 target: pointer and keyboard tab actions retain the password, email, and phone flows', async ({ page }) => {
  await gotoFixture(page, 'surface=confirm-admin-consumers&mode=light')
  const dialog = await openAdmin(page)
  const passwordTab = dialog.getByRole('button', { name: 'Password', exact: true })
  const emailTab = dialog.getByRole('button', { name: 'Email code', exact: true })
  const phoneTab = dialog.getByRole('button', { name: 'SMS code', exact: true })

  await expect(passwordTab).toHaveAttribute('aria-pressed', 'true')
  await expect(dialog.getByPlaceholder('Type your password to confirm.', { exact: true })).toBeVisible()
  await emailTab.click()
  await expect(emailTab).toHaveAttribute('aria-pressed', 'true')
  await expect(dialog.getByPlaceholder('Email', { exact: true })).toBeVisible()
  await phoneTab.focus()
  await page.keyboard.press('Enter')
  await expect(phoneTab).toHaveAttribute('aria-pressed', 'true')
  await expect(dialog.locator('.PhoneInputInput')).toBeVisible()
  await passwordTab.focus()
  await page.keyboard.press('Space')
  await expect(passwordTab).toHaveAttribute('aria-pressed', 'true')
  await expect(dialog.getByPlaceholder('Type your password to confirm.', { exact: true })).toBeVisible()
})

for (const mode of ['light', 'dark']) {
  test(`C2 target: ConfirmAdmin text, tab focus, and OTP fields retain contrast in ${mode}`, async ({ page }, testInfo) => {
    await gotoFixture(page, `surface=confirm-admin-consumers&mode=${mode}`)
    const dialog = await openAdmin(page)
    const heading = dialog.getByRole('heading', { name: 'Confirm password', exact: true })
    const passwordTab = dialog.getByRole('button', { name: 'Password', exact: true })
    const emailTab = dialog.getByRole('button', { name: 'Email code', exact: true })
    const password = dialog.getByPlaceholder('Type your password to confirm.', { exact: true })

    for (const text of [heading, emailTab, password]) {
      const colors = await effectiveColors(text)
      expect(contrast(colors.color, colors.background)).toBeGreaterThanOrEqual(4.5)
    }
    await emailTab.focus()
    // redesign fix-qa E5: a script focus after a pointer click is not a keyboard focus, so the ring would not
    // show; Tab and Shift+Tab return to the group the way a keyboard user does. R1-08 (951562fa): the
    // group's tab stop is the chosen option, so they land on «Password» (chosen), and the arrow moves the
    // keyboard focus to «Email code» without choosing it, as before the ring is measured on an unchosen tab.
    await page.keyboard.press('Tab')
    await page.keyboard.press('Shift+Tab')
    await expect(passwordTab).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(emailTab).toBeFocused()
    await expect(emailTab).toHaveAttribute('aria-pressed', 'false')
    await expect(passwordTab).toHaveAttribute('aria-pressed', 'true')
    const tabBackground = (await effectiveColors(emailTab)).background
    const tabFocus = await emailTab.evaluate(element => {
      const style = getComputedStyle(element)
      return { outline: style.outlineColor, width: style.outlineWidth }
    })
    expect(parseFloat(tabFocus.width)).toBeGreaterThanOrEqual(2)
    expect(contrast(tabFocus.outline, tabBackground)).toBeGreaterThanOrEqual(3)

    const otpInputs = await openEmailOtp(page, dialog)
    const otp = otpInputs.first()
    await otp.focus()
    const otpColors = await otp.evaluate(element => {
      const style = getComputedStyle(element)
      return {
        background: style.backgroundColor,
        color: style.color,
        outline: style.outlineColor,
        outlineWidth: style.outlineWidth,
        placeholder: getComputedStyle(element, '::placeholder').color
      }
    })
    expect(contrast(otpColors.color, otpColors.background)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(otpColors.placeholder, otpColors.background)).toBeGreaterThanOrEqual(4.5)
    expect(parseFloat(otpColors.outlineWidth)).toBeGreaterThanOrEqual(2)
    expect(contrast(otpColors.outline, otpColors.background)).toBeGreaterThanOrEqual(3)
    expect(otpColors.outline).toBe(rgb(tokens.theme[mode].semantic.action.focus))
    await page.screenshot({ path: testInfo.outputPath(`confirm-admin-${mode}-otp.png`) })
  })
}

const expectTabsFit = async (tabButtons, dialogRect) => {
  for (const tab of tabButtons) {
    await expect(tab).toBeVisible()
    const rect = await tab.boundingBox()
    const content = await tab.evaluate(element => {
      const range = document.createRange()
      range.selectNodeContents(element)
      const textRect = range.getBoundingClientRect()
      return {
        clientHeight: element.clientHeight,
        clientWidth: element.clientWidth,
        scrollHeight: element.scrollHeight,
        scrollWidth: element.scrollWidth,
        touchArea: getComputedStyle(element, '::after').position === 'absolute',
        text: { left: textRect.left, top: textRect.top, right: textRect.right, bottom: textRect.bottom }
      }
    })
    expect(rect.x).toBeGreaterThanOrEqual(dialogRect.x)
    expect(rect.x + rect.width).toBeLessThanOrEqual(dialogRect.x + dialogRect.width)
    expect(rect.y).toBeGreaterThanOrEqual(dialogRect.y)
    expect(rect.y + rect.height).toBeLessThanOrEqual(dialogRect.y + dialogRect.height)
    if (content.touchArea) {
      // redesign deliveries-followups W1-D-25: on a phone the option carries its 44x44 area as an absolute ::after, 6px past its 32px box,
      // which scrollHeight counts as overflow. The label itself must still fit inside the drawn box, on every side.
      expect(content.text.left).toBeGreaterThanOrEqual(rect.x - 0.5)
      expect(content.text.right).toBeLessThanOrEqual(rect.x + rect.width + 0.5)
      expect(content.text.top).toBeGreaterThanOrEqual(rect.y - 0.5)
      expect(content.text.bottom).toBeLessThanOrEqual(rect.y + rect.height + 0.5)
    } else {
      expect(content.scrollWidth).toBeLessThanOrEqual(content.clientWidth + 1)
      expect(content.scrollHeight).toBeLessThanOrEqual(content.clientHeight + 1)
    }
    expect(content.text.left).toBeGreaterThanOrEqual(Math.max(0, dialogRect.x) - 0.5)
    expect(content.text.right).toBeLessThanOrEqual(Math.min(390, dialogRect.x + dialogRect.width) + 0.5)
    expect(content.text.top).toBeGreaterThanOrEqual(dialogRect.y - 0.5)
    expect(content.text.bottom).toBeLessThanOrEqual(dialogRect.y + dialogRect.height + 0.5)
  }
}

test('C2 target: ConfirmAdmin uses its catalog heading and action labels in all twelve locales', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  const locales = [localeConfig.sourceLanguage, ...localeConfig.supportedLocales]
  expect(locales).toHaveLength(12)
  for (const locale of locales) {
    const labels = {
      heading: translations.CONFIRM_PASSWORD[locale],
      password: translations.BY_PASSWORD[locale],
      email: translations.BY_OTP_EMAIL[locale],
      phone: translations.BY_OTP_PHONE[locale],
      // redesign C13 (f8556689): the method select is named from the catalog, so it is looked up in each locale.
      method: translations.CONFIRMATION_METHOD[locale]
    }
    expect(Object.values(labels).every(Boolean)).toBe(true)
    await gotoFixture(page, `surface=confirm-admin-consumers&mode=light&locale=${locale}&rtl=${locale === 'ar'}`)
    const dialog = await openAdmin(page, labels.heading)
    const tabButtons = [labels.password, labels.email, labels.phone].map(label => dialog.getByRole('button', { name: label, exact: true }))
    const dialogRect = await dialog.boundingBox()
    const select = dialog.getByRole('combobox', { name: labels.method, exact: true })
    if (await select.count() > 0) {
      // C13: the labels do not fit in one row at this width, so the control is a select with the same three options.
      const box = await select.boundingBox()
      expect(box.x).toBeGreaterThanOrEqual(dialogRect.x)
      expect(box.x + box.width).toBeLessThanOrEqual(dialogRect.x + dialogRect.width)
      expect(await select.locator('option').allTextContents()).toEqual([labels.password, labels.email, labels.phone])
    } else {
      await expectTabsFit(tabButtons, dialogRect)
    }
    await expect(dialog).toHaveCSS('direction', locale === 'ar' ? 'rtl' : 'ltr')
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
  }
})

test('ConfirmAdmin exposes the stable synthetic password loading state without a request', async ({ page }) => {
  await gotoFixture(page, 'surface=confirm-admin-consumers&mode=light&adminState=password-loading')
  const dialog = await openAdmin(page)
  const loading = dialog.getByRole('button', { name: 'Loading', exact: true })
  await expect(loading).toBeVisible()
  await expect(loading).toBeDisabled()
  expect(await requests(page)).toEqual([])
})

test('ConfirmAdmin exposes a stable synthetic OTP error without provider requests', async ({ page }) => {
  await gotoFixture(page, 'surface=confirm-admin-consumers&mode=light&adminState=otp-error')
  const dialog = await openAdmin(page)
  await dialog.getByRole('button', { name: 'Email code', exact: true }).click()
  await dialog.getByPlaceholder('Email', { exact: true }).fill('admin@example.test')
  await dialog.getByRole('button', { name: 'Get verify code', exact: true }).click()
  await expect(alertDialog(page).getByText('Fixture OTP delivery error', { exact: true })).toBeVisible()
  expect(await requests(page)).toEqual([{ kind: 'otp', body: { type: 5, channel: 1, size: 6, email: 'admin@example.test' } }])
})

test('ConfirmAdmin timer expiry keeps all six OTP inputs present and disabled', async ({ page }) => {
  await page.clock.install()
  await gotoFixture(page, 'surface=confirm-admin-consumers&mode=light')
  const dialog = await openAdmin(page)
  const otpInputs = await openEmailOtp(page, dialog)
  await page.clock.runFor(601000)
  await expect(dialog.getByText('0:00', { exact: true })).toBeVisible()
  await expect(otpInputs).toHaveCount(6)
  for (const otp of await otpInputs.all()) await expect(otp).toBeDisabled()
})

for (const width of [320, 390]) {
  test.describe(`ConfirmAdmin OTP at ${width}px`, () => {
    test.use({ viewport: { width, height: 640 }, hasTouch: true, isMobile: true })

    test('C2 target: six OTP fields and phone controls fit with 44px targets', async ({ page }, testInfo) => {
      await gotoFixture(page, 'surface=confirm-admin-consumers&mode=dark&rtl=true')
      const before = await viewportState(page)
      expect(before.coarse).toBe(true)
      expect(before.scrollWidth).toBeLessThanOrEqual(before.viewportWidth)
      expect(before.scrollLeft).toBe(0)
      expect(before.offsetLeft).toBe(0)
      expect(before.offsetTop).toBe(0)
      expect(before.scale).toBe(1)
      await page.screenshot({ path: testInfo.outputPath(`confirm-admin-otp-${width}-before.png`) })
      expect((await viewportState(page)).coarse).toBe(true)
      const dialog = await openAdmin(page)
      const headingGeometry = await dialog.evaluate(element => {
        const range = document.createRange()
        range.selectNodeContents(element.querySelector('h2'))
        const close = element.querySelector('.odc-overlay-close').getBoundingClientRect()
        return { close: { left: close.left, right: close.right, top: close.top, bottom: close.bottom }, text: Array.from(range.getClientRects(), rect => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom })) }
      })
      for (const text of headingGeometry.text) {
        const close = headingGeometry.close
        expect(text.right <= close.left || text.left >= close.right || text.bottom <= close.top || text.top >= close.bottom).toBe(true)
      }
      await chooseMethod(dialog, 'SMS code')
      const phone = dialog.locator('.PhoneInputInput')
      const country = dialog.locator('.PhoneInputCountry')
      await expect(phone).toHaveCount(1)
      await expect(country).toHaveCount(1)
      await expectControlsFullyVisible(dialog, '.PhoneInputCountry, .PhoneInputInput', 2)
      await phone.fill('+12025550147')
      await dialog.getByRole('button', { name: 'Get verify code', exact: true }).click()
      await closeAlert(page)
      const otpInputs = dialog.locator('.otp-input')
      await expect(otpInputs).toHaveCount(6)
      await expectControlsFullyVisible(dialog, '.otp-input', 6)
      const geometry = await page.evaluate(() => ({ viewport: window.visualViewport?.width ?? innerWidth, scroll: document.documentElement.scrollWidth, dir: document.documentElement.dir }))
      expect(geometry.dir).toBe('rtl')
      expect(geometry.scroll).toBeLessThanOrEqual(geometry.viewport)
      const after = await viewportState(page)
      expect(after.coarse).toBe(true)
      expect(after.scrollLeft).toBe(0)
      expect(after.offsetLeft).toBe(0)
      expect(after.offsetTop).toBe(0)
      expect(after.scale).toBe(1)
      await page.screenshot({ path: testInfo.outputPath(`confirm-admin-otp-${width}-after.png`) })
      expect((await viewportState(page)).coarse).toBe(true)
    })
  })
}
