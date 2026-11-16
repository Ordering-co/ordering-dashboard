import { test, expect, fixtureUrl } from './fixtures'
import { tokens } from '../../src/brand/ordering.tokens.generated'

const transitionUrl = mode => fixtureUrl(`surface=transition&mode=${mode}&fixtureUserLevel=0`)
const selectTrigger = scope => scope.getByRole('combobox').first()
const readJson = locator => locator.textContent().then(value => JSON.parse(value))
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
  const style = getComputedStyle(element)
  let background = style.backgroundColor
  let current = element
  while ((background === 'transparent' || background === 'rgba(0, 0, 0, 0)') && current.parentElement) {
    current = current.parentElement
    background = getComputedStyle(current).backgroundColor
  }
  return { color: style.color, background, outline: style.outlineColor }
})
const pageGeometry = page => page.evaluate(() => ({
  viewportWidth: innerWidth,
  viewportHeight: innerHeight,
  scrollWidth: document.documentElement.scrollWidth,
  scrollHeight: document.documentElement.scrollHeight
}))
// (decision 12): a Product control is SEEN at its size and its 44x44 touch area is an absolute ::after
// around it. What a finger hits is measured by hit-testing out from the center of the control, a quarter pixel at a
// time, so a clipped or covered area counts as smaller (the computed insets of the pseudo-element are not its box).
const touchArea = locator => locator.evaluate(element => {
  const box = element.getBoundingClientRect()
  const lands = (x, y) => { const hit = document.elementFromPoint(x, y); return hit === element || element.contains(hit) }
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const reach = (dx, dy, limit) => { let step = 0; while (step < limit && lands(cx + dx * (step + 0.25), cy + dy * (step + 0.25))) step += 0.25; return step }
  const limitX = box.width / 2 + 30
  const limitY = box.height / 2 + 30
  return { width: reach(-1, 0, limitX) + reach(1, 0, limitX), height: reach(0, -1, limitY) + reach(0, 1, limitY) }
})
const overlapArea = (a, b) => {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
  return width * height
}

test('transition fixture starts with bounded real consumers and legacy siblings', async ({ page }) => {
  await page.goto(transitionUrl('light'))

  const fixture = page.getByTestId('transition-fixture')
  await expect(fixture).toBeVisible()
  await expect(fixture.getByRole('heading').first()).toBeVisible()
  await expect(page.getByTestId('recipient-consumer')).toBeVisible()
  await expect(page.getByTestId('school-consumer')).toBeVisible()
  await expect(page.getByTestId('recipient-value')).toHaveText('business')
  await expect(page.getByTestId('recipient-events')).toHaveText('0')
  expect(await readJson(page.getByTestId('school-events'))).toEqual({ disable: 0, enable: 0 })
  expect(await readJson(page.getByTestId('select-events'))).toEqual([])
  await expect(page.getByTestId('submit-events')).toHaveText('0')

  const legacy = page.getByTestId('legacy-sibling')
  await expect(legacy.getByTestId('legacy-button')).toBeVisible()
  await expect(legacy.getByTestId('legacy-input')).toBeVisible()
  expect(await legacy.locator('button').count()).toBeGreaterThanOrEqual(4)
  await expect(legacy.locator('input')).toHaveCount(1)
})

// redesign RecipientSelect is a Product select (P/SelectField) since its label names it («Recipient
// Business», the Sponsor fix of stores 5.14), its list is a non-modal layer of the overlay host (#app-modals), and picking the
// option that is already chosen only closes the list (P/Select, as ListPopover) instead of calling onChange again.
test('RecipientSelect preserves scalar, null inheritance, re-selection, portal and focus contracts', async ({ page }) => {
  await page.goto(transitionUrl('light'))
  const consumer = page.getByTestId('recipient-consumer')
  const trigger = selectTrigger(consumer)

  await expect(trigger).toHaveAccessibleName('Recipient Business')
  await trigger.focus()
  await page.keyboard.press('Enter')
  const listbox = page.getByRole('listbox')
  await expect(listbox).toBeVisible()
  expect(await listbox.evaluate(element => element.closest('#app-modals')?.parentElement === document.body)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.hasAttribute('data-base-ui-scroll-locked'))).toBe(false)
  await page.getByRole('option', { name: 'Platform', exact: true }).click()
  await expect(page.getByTestId('recipient-value')).toHaveText('platform')
  await expect(page.getByTestId('recipient-events')).toHaveText('1')
  await expect(trigger).toBeFocused()

  await trigger.click()
  await page.getByRole('option', { name: 'Inherit', exact: true }).click()
  await expect(page.getByTestId('recipient-value')).toHaveText('null')
  await expect(page.getByTestId('recipient-events')).toHaveText('2')
  await expect(trigger).toHaveAccessibleName('Recipient Inherit')

  await trigger.click()
  await page.getByRole('option', { name: 'Inherit', exact: true }).click()
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(page.getByTestId('recipient-events')).toHaveText('2')

  await trigger.click()
  await page.keyboard.press('Escape')
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(trigger).toBeFocused()
})

test('standalone Select preserves scalar callbacks, disabled values and explicit repeated activation', async ({ page }) => {
  await page.goto(transitionUrl('light'))
  const scope = page.getByTestId('select-contract')
  const trigger = selectTrigger(scope)

  await expect(trigger).toHaveAccessibleName('Alpha')
  await trigger.click()
  await page.getByRole('option', { name: 'Alpha', exact: true }).click()
  expect(await readJson(page.getByTestId('select-events'))).toEqual(['alpha'])

  await trigger.focus()
  await page.keyboard.press('Enter')
  await page.getByRole('option', { name: 'Alpha', exact: true }).focus()
  await page.keyboard.press('Space')
  expect(await readJson(page.getByTestId('select-events'))).toEqual(['alpha', 'alpha'])

  await trigger.click()
  await page.getByRole('option', { name: 'Beta', exact: true }).click()
  expect(await readJson(page.getByTestId('select-events'))).toEqual(['alpha', 'alpha', 'beta'])
  await expect(trigger).toHaveAccessibleName('Beta')

  await trigger.click()
  const before = await readJson(page.getByTestId('select-events'))
  const inertOptions = page.locator('.od-select-option[data-disabled]')
  await expect(inertOptions).toHaveCount(2)
  for (const inert of await inertOptions.all()) {
    await inert.evaluate(element => element.click())
  }
  expect(await readJson(page.getByTestId('select-events'))).toEqual(before)
})

test('standalone Select keeps noSelected and notAsync as separate observable contracts', async ({ page }) => {
  await page.goto(transitionUrl('light'))
  const scope = page.getByTestId('select-contract')
  const trigger = selectTrigger(scope)

  await page.getByRole('button', { name: 'Toggle notAsync fixture', exact: true }).click()
  await page.getByRole('button', { name: 'Change default fixture', exact: true }).click()
  await expect(trigger).toHaveAccessibleName('Alpha')
  await page.getByRole('button', { name: 'Toggle notAsync fixture', exact: true }).click()
  await expect(trigger).toHaveAccessibleName('Beta')

  await page.getByRole('button', { name: 'Toggle noSelected fixture', exact: true }).click()
  await expect(trigger).toHaveAccessibleName('Alpha')
  await trigger.click()
  await page.getByRole('option', { name: 'Beta', exact: true }).click()
  await expect(trigger).toHaveAccessibleName('Alpha')
  expect(await readJson(page.getByTestId('select-events'))).toEqual(['beta'])
})

test('SchoolModuleToggle confirm keeps close, cancel and destructive acceptance independent', async ({ page }) => {
  await page.goto(transitionUrl('light'))
  const school = page.getByTestId('school-consumer')
  const disable = school.getByRole('button', { name: 'Disable school module', exact: true })

  await disable.click()
  let dialog = page.getByRole('alertdialog', { name: 'Disable the School module?' })
  await expect(dialog).toBeVisible()
  // the toggle is on the Product ConfirmDialog since , whose initial focus is Cancel, never the action (C8)
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused()
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeVisible()
  expect(await dialog.evaluate(element => {
    const host = element.closest('[data-base-ui-portal]')?.parentElement
    return host?.id === 'app-modals' && host.parentElement === document.body
  })).toBe(true)
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).overflowY)).toMatch(/hidden|clip/)
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('.odc-overlay-backdrop')).toHaveCount(0)
  expect(await readJson(page.getByTestId('school-events'))).toEqual({ disable: 0, enable: 0 })

  await disable.click()
  dialog = page.getByRole('alertdialog', { name: 'Disable the School module?' })
  await expect(dialog).toBeVisible()
  await page.locator('.odc-overlay-backdrop').click({ position: { x: 2, y: 2 } })
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('.odc-overlay-backdrop')).toHaveCount(0)
  expect(await readJson(page.getByTestId('school-events'))).toEqual({ disable: 0, enable: 0 })

  await disable.click()
  dialog = page.getByRole('alertdialog', { name: 'Disable the School module?' })
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('.odc-overlay-backdrop')).toHaveCount(0)
  await expect(disable).toBeFocused()
  expect(await readJson(page.getByTestId('school-events'))).toEqual({ disable: 0, enable: 0 })

  await disable.click()
  dialog = page.getByRole('alertdialog', { name: 'Disable the School module?' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Disable module', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('.odc-overlay-backdrop')).toHaveCount(0)
  expect(await readJson(page.getByTestId('school-events'))).toEqual({ disable: 1, enable: 0 })
})

test('SchoolModuleToggle preserves permission, saving and enable branches', async ({ page }) => {
  await page.goto(transitionUrl('light'))
  const school = page.getByTestId('school-consumer')

  await page.getByRole('button', { name: 'Toggle permission fixture', exact: true }).click()
  await expect(school.getByRole('button')).toHaveCount(0)
  await page.getByRole('button', { name: 'Toggle permission fixture', exact: true }).click()
  await expect(school.getByRole('button', { name: 'Disable school module', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Toggle saving fixture', exact: true }).click()
  // a busy Product Button keeps its label and focus, says aria-busy and drops the click: no confirmation, no event
  const busyDisable = school.getByRole('button', { name: 'Disable school module', exact: true })
  await expect(busyDisable).toHaveAttribute('aria-busy', 'true')
  await busyDisable.click()
  // the dialog mounts a frame late (its overlay layer), so its absence is only proof once saving ends and nothing opened meanwhile;
  // the same click then does open it: the drop was the busy state, not a dead trigger
  await page.getByRole('button', { name: 'Toggle saving fixture', exact: true }).click()
  await expect(busyDisable).not.toHaveAttribute('aria-busy', 'true')
  await page.waitForTimeout(300)
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await busyDisable.click()
  const notBusyDialog = page.getByRole('alertdialog', { name: 'Disable the School module?' })
  await expect(notBusyDialog).toBeVisible()
  await notBusyDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(notBusyDialog).toHaveCount(0)
  expect(await readJson(page.getByTestId('school-events'))).toEqual({ disable: 0, enable: 0 })

  await page.getByRole('button', { name: 'Toggle enabled fixture', exact: true }).click()
  const enable = school.getByRole('button', { name: 'Enable school module', exact: true })
  await expect(enable).toBeVisible()
  await enable.click()
  expect(await readJson(page.getByTestId('school-events'))).toEqual({ disable: 0, enable: 1 })
})

test('new Button preserves native required validation and default submit behavior', async ({ page }) => {
  await page.goto(transitionUrl('light'))
  const form = page.getByTestId('button-contract')
  const input = form.getByRole('textbox', { name: 'Fixture required value', exact: true })
  const submit = form.getByRole('button', { name: 'Submit fixture', exact: true })

  expect(await submit.evaluate(element => ({ tag: element.tagName, attribute: element.getAttribute('type'), type: element.type }))).toEqual({
    tag: 'BUTTON',
    attribute: 'submit',
    type: 'submit'
  })
  expect(await input.evaluate(element => element.checkValidity())).toBe(false)
  await submit.click()
  await expect(page.getByTestId('submit-events')).toHaveText('0')
  await input.fill('Ready')
  expect(await input.evaluate(element => element.checkValidity())).toBe(true)
  await submit.click()
  await expect(page.getByTestId('submit-events')).toHaveText('1')
})

test('theme, tenant and RTL update the same mounted controls and open portals', async ({ page }) => {
  await page.goto(transitionUrl('light'))
  const submit = page.getByRole('button', { name: 'Submit fixture', exact: true })
  const originalSubmit = await submit.elementHandle()
  expect(await submit.evaluate(element => getComputedStyle(element).getPropertyValue('--od-ui-surface').trim())).toBe(tokens.theme.light.semantic.surface.default)

  await page.getByRole('button', { name: 'Switch theme fixture', exact: true }).click()
  expect(await originalSubmit.evaluate(element => element.isConnected)).toBe(true)
  expect(await submit.evaluate(element => getComputedStyle(element).getPropertyValue('--od-ui-surface').trim())).toBe(tokens.theme.dark.semantic.surface.default)

  await page.getByRole('button', { name: 'Apply tenant fixture', exact: true }).click()
  expect(await submit.evaluate(element => getComputedStyle(element).getPropertyValue('--od-ui-action').trim())).toBe('#123456')
  await expect(submit).toHaveCSS('background-color', 'rgb(18, 52, 86)')

  // redesign the od-ui portal checks stay on the legacy Select (select-contract); RecipientSelect is a Product select now
  // and its popup follows the direction below
  const legacySelect = selectTrigger(page.getByTestId('select-contract'))
  await legacySelect.click()
  const popup = page.locator('.od-select-popup')
  const originalPopup = await popup.elementHandle()
  await page.getByRole('button', { name: 'Toggle RTL fixture', exact: true }).evaluate(element => element.click())
  expect(await originalPopup.evaluate(element => element.isConnected)).toBe(true)
  await expect(popup).toHaveAttribute('dir', 'rtl')
  await expect(popup.locator('xpath=ancestor::*[@data-base-ui-portal]')).toHaveAttribute('dir', 'rtl')
  await page.getByRole('button', { name: 'Switch theme fixture', exact: true }).evaluate(element => element.click())
  expect(await originalPopup.evaluate(element => element.isConnected)).toBe(true)
  expect(await popup.evaluate(element => getComputedStyle(element).getPropertyValue('--od-ui-surface').trim())).toBe(tokens.theme.light.semantic.surface.default)
  expect(await popup.evaluate(element => getComputedStyle(element).getPropertyValue('--od-ui-action').trim())).toBe('#123456')
  await page.getByRole('button', { name: 'Apply font fixture', exact: true }).evaluate(element => element.click())
  await expect(popup).toHaveCSS('font-family', 'monospace')
  await page.keyboard.press('Escape')

  // A press outside a Product popover closes it (D-11), so the direction is read on the next open: the portal takes the page's.
  const recipient = selectTrigger(page.getByTestId('recipient-consumer'))
  const recipientPopup = page.locator('.odc-select-popup')
  await recipient.click()
  await expect(recipientPopup).toHaveAttribute('dir', 'rtl')
  await expect(recipientPopup.locator('xpath=ancestor::*[contains(@class,"odc-overlay-portal")]')).toHaveAttribute('dir', 'rtl')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Toggle RTL fixture', exact: true }).evaluate(element => element.click())
  await recipient.click()
  await expect(recipientPopup).toHaveAttribute('dir', 'ltr')
})

for (const mode of ['light', 'dark']) {
  test(`transition ${mode} desktop keeps governed contrast, focus and open geometry`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(transitionUrl(mode))
    await expect(page.getByTestId('transition-fixture')).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`transition-${mode}-desktop-closed.png`), fullPage: true })

    const trigger = selectTrigger(page.getByTestId('recipient-consumer'))
    await trigger.focus()
    const focused = await effectiveColors(trigger)
    await expect(trigger).toHaveCSS('outline-width', tokens.component.focusRing.width)
    await expect(trigger).toHaveCSS('outline-offset', tokens.component.focusRing.offset)
    expect(contrast(focused.outline, focused.background)).toBeGreaterThanOrEqual(3)
    await trigger.click()

    const popup = page.locator('.odc-select-popup') // redesign RecipientSelect's list is the Product select's popup
    await expect(popup).toBeVisible()
    const triggerBox = await trigger.boundingBox()
    const popupBox = await popup.boundingBox()
    expect(overlapArea(triggerBox, popupBox), JSON.stringify({ triggerBox, popupBox })).toBeLessThanOrEqual(1)
    for (const item of await page.getByRole('option').all()) {
      const colors = await effectiveColors(item)
      expect(contrast(colors.color, colors.background), await item.textContent()).toBeGreaterThanOrEqual(4.5)
    }
    const geometry = await pageGeometry(page)
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth)
    await page.screenshot({ path: testInfo.outputPath(`transition-${mode}-desktop-open.png`), fullPage: true })
  })
}

test.describe('coarse transition targets and reflow', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })

  for (const mode of ['light', 'dark']) {
    test(`390px and 320px keep ${mode} controls, long data, dialog and portals usable`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto(transitionUrl(mode))
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      const recipient = selectTrigger(page.getByTestId('recipient-consumer'))
      const submit = page.getByRole('button', { name: 'Submit fixture', exact: true })
      const submitBox = await submit.boundingBox()
      expect(submitBox.width).toBeGreaterThanOrEqual(44)
      expect(submitBox.height).toBeGreaterThanOrEqual(44)
      // redesign (decision 12): RecipientSelect is a Product select, 32px seen with a 44x44 area that a finger hits
      expect(Math.round((await recipient.boundingBox()).height)).toBe(32)
      const area = await touchArea(recipient)
      expect(area.width).toBeGreaterThanOrEqual(44)
      expect(area.height).toBeGreaterThanOrEqual(44)

      await recipient.click()
      const popup = page.locator('.odc-select-popup')
      await expect(popup).toBeVisible()
      const optionBox = await page.getByRole('option').first().boundingBox()
      expect(optionBox.height).toBeGreaterThanOrEqual(44)
      let geometry = await pageGeometry(page)
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth)
      await page.screenshot({ path: testInfo.outputPath(`transition-${mode}-390-select-open.png`), fullPage: false })
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      await page.getByRole('option', { name: 'Business', exact: true }).click()
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)

      await page.getByTestId('school-consumer').getByRole('button', { name: 'Disable school module', exact: true }).click()
      const dialog = page.getByRole('alertdialog', { name: 'Disable the School module?' })
      const dialogBox = await dialog.boundingBox()
      expect(dialogBox.x).toBeGreaterThanOrEqual(0)
      expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(390)
      for (const action of await dialog.getByRole('button').all()) {
        const metrics = await action.evaluate(element => {
          const style = getComputedStyle(element)
          const box = element.getBoundingClientRect()
          return {
            className: element.className,
            coarse: matchMedia('(pointer: coarse)').matches,
            height: box.height,
            minHeight: style.minHeight,
            flexShrink: style.flexShrink,
            touchTarget: style.getPropertyValue('--od-ui-touch-target').trim()
          }
        })
        const label = await action.getAttribute('aria-label') || await action.textContent()
        await expect.poll(
          async () => (await touchArea(action)).width,
          { message: `${label} ${JSON.stringify(metrics)}` }
        ).toBeGreaterThanOrEqual(44)
        await expect.poll(
          async () => (await touchArea(action)).height,
          { message: `${label} ${JSON.stringify(metrics)}` }
        ).toBeGreaterThanOrEqual(44)
      }
      await page.screenshot({ path: testInfo.outputPath(`transition-${mode}-390-dialog-open.png`), fullPage: false })
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()

      await page.setViewportSize({ width: 320, height: 900 })
      const contract = page.getByTestId('select-contract')
      const longTrigger = contract.getByRole('combobox')
      await longTrigger.click()
      const availableWidth = await contract.evaluate(element => {
        const style = getComputedStyle(element)
        return element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      })
      expect(Math.abs((await longTrigger.boundingBox()).width - availableWidth)).toBeLessThanOrEqual(1)
      const longest = page.getByRole('option').filter({ hasText: /./ }).last()
      await longest.scrollIntoViewIfNeeded()
      await expect(longest).toBeInViewport()
      const itemBounds = await longest.boundingBox()
      const menuBounds = await page.locator('.od-select-popup[data-open]').boundingBox()
      expect(itemBounds.y).toBeGreaterThanOrEqual(menuBounds.y)
      expect(itemBounds.y + itemBounds.height).toBeLessThanOrEqual(menuBounds.y + menuBounds.height + 1)
      geometry = await pageGeometry(page)
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth)
      await page.screenshot({ path: testInfo.outputPath(`transition-${mode}-320-long-open.png`), fullPage: false })
      await longest.click()
      expect(await readJson(page.getByTestId('select-events'))).toEqual(['long-11'])
    })
  }
})
