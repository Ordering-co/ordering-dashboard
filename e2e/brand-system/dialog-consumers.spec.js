import { test, expect, fixtureUrl } from './fixtures'

const dialogByTitle = (page, title) => page.locator('.popup-dialog').filter({ has: page.getByText(title, { exact: true }) })
const closeIcon = dialog => dialog.locator('.modal-close-icon button')
const viewportState = page => page.evaluate(() => ({
  coarse: matchMedia('(pointer: coarse)').matches,
  documentScrollLeft: document.documentElement.scrollLeft,
  offsetLeft: window.visualViewport?.offsetLeft ?? 0,
  offsetTop: window.visualViewport?.offsetTop ?? 0,
  scale: window.visualViewport?.scale ?? 1,
  scrollWidth: document.documentElement.scrollWidth,
  viewportHeight: window.visualViewport?.height ?? innerHeight,
  viewportWidth: window.visualViewport?.width ?? innerWidth
}))

const parseRgb = color => color.match(/[\d.]+/g).slice(0, 3).map(Number)
const luminance = color => parseRgb(color).map(value => value / 255)
  .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
const contrast = (foreground, background) => {
  const a = luminance(foreground)
  const b = luminance(background)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

test('Modal keeps accept, cancel, and close callbacks independent without automatic dismissal', async ({ page }) => {
  await page.goto(fixtureUrl('surface=dialog-consumers&mode=light'))
  const opener = page.getByRole('button', { name: 'Open primary dialog', exact: true })
  await opener.click()
  const dialog = dialogByTitle(page, 'Edit populated record')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Edit populated record', exact: true })).toBeVisible()
  await expect(page.locator('#app-modals')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0.4)')
  await expect(dialog).toHaveCSS('width', '640px')
  await expect(dialog).toHaveCSS('max-width', '680px')
  await expect(dialog.locator('.dialog-inner')).toHaveCSS('padding', '24px')
  await expect(dialog.locator('.dialog-inner')).toHaveCSS('overflow', 'visible')

  await dialog.getByRole('button', { name: 'Keep changes', exact: true }).click()
  await expect(dialog).toBeVisible()
  await expect(page.getByTestId('dialog-events')).toHaveText('["primary-accept"]')
  await dialog.getByRole('button', { name: 'Discard changes', exact: true }).click()
  await expect(dialog).toBeVisible()
  await expect(page.getByTestId('dialog-events')).toHaveText('["primary-accept","primary-cancel"]')
  await closeIcon(dialog).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByTestId('dialog-events')).toHaveText('["primary-accept","primary-cancel","primary-close"]')
})

test('Modal keeps onRemove precedence and the hidden-close presentation contract', async ({ page }) => {
  await page.goto(fixtureUrl('surface=dialog-consumers&mode=dark'))
  await page.getByRole('button', { name: 'Open removable dialog', exact: true }).click()
  const removable = dialogByTitle(page, 'Removable attachment')
  await closeIcon(removable).click()
  await expect(removable).not.toBeVisible()
  await expect(page.getByTestId('dialog-events')).toHaveText('["remove-on-remove"]')

  await page.getByRole('button', { name: 'Open hidden-close dialog', exact: true }).click()
  const protectedDialog = dialogByTitle(page, 'Protected progress')
  await expect(protectedDialog).toBeVisible()
  await expect(protectedDialog.locator('.modal-close-icon')).toHaveCount(0)
  await expect(protectedDialog).toHaveCSS('width', '520px')
  await expect(protectedDialog).toHaveCSS('max-width', '540px')
  await expect(protectedDialog.locator('.dialog-inner')).toHaveCSS('padding', '30px')
  await expect(protectedDialog.locator('.dialog-inner')).toHaveCSS('overflow', 'hidden')
  await protectedDialog.getByRole('button', { name: 'Finish protected progress', exact: true }).click()
  await expect(protectedDialog).not.toBeVisible()
})

test('Modal honors the populated descendant autofocus target', async ({ page }) => {
  await page.goto(fixtureUrl('surface=dialog-consumers&mode=light'))
  await page.getByRole('button', { name: 'Open primary dialog', exact: true }).click()
  const dialog = dialogByTitle(page, 'Edit populated record')
  const initial = dialog.getByLabel('Record name', { exact: true })
  await expect(initial).toBeFocused()
})

test('accessibility target: Modal traps focus and returns it to the opener', async ({ page }) => {
  await page.goto(fixtureUrl('surface=dialog-consumers&mode=light'))
  const opener = page.getByRole('button', { name: 'Open primary dialog', exact: true })
  await opener.click()
  const dialog = dialogByTitle(page, 'Edit populated record')
  const cancel = dialog.getByRole('button', { name: 'Discard changes', exact: true })
  await cancel.focus()
  await page.keyboard.press('Tab')
  await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement)), { message: 'Native Tab wrapping settles inside the modal' }).toBe(true)

  await closeIcon(dialog).click()
  await expect.soft(opener).toBeFocused()
})

test('accessibility target: Escape closes only the nested top layer exactly once', async ({ page }) => {
  await page.goto(fixtureUrl('surface=dialog-consumers&mode=dark'))
  await page.getByRole('button', { name: 'Open primary dialog', exact: true }).click()
  const primary = dialogByTitle(page, 'Edit populated record')
  await primary.getByRole('button', { name: 'Open nested dialog', exact: true }).click()
  const nested = dialogByTitle(page, 'Nested confirmation')
  await expect(nested).toBeVisible()
  await expect(nested.getByLabel('Nested value', { exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(nested).not.toBeVisible()
  await expect(primary).toBeVisible()
  await expect(page.getByTestId('dialog-events')).toHaveText('["nested-close"]')
  await expect(primary.getByRole('button', { name: 'Open nested dialog', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(primary.getByRole('button', { name: 'Open nested confirmation', exact: true })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(primary.getByRole('button', { name: 'Open nested dialog', exact: true })).toBeFocused()
})

test('owned Confirm remains an accessible top layer inside Modal and keeps its callbacks independent', async ({ page }) => {
  await page.goto(fixtureUrl('surface=dialog-consumers&mode=light'))
  const opener = page.getByRole('button', { name: 'Open primary dialog', exact: true })
  await opener.click()
  const primary = dialogByTitle(page, 'Edit populated record')
  const confirmOpener = primary.getByRole('button', { name: 'Open nested confirmation', exact: true })
  await confirmOpener.click()

  const confirm = page.getByRole('alertdialog', { name: 'Approve nested change?', exact: true })
  await expect(confirm).toBeVisible()
  expect(await confirm.evaluate(element => {
    for (let current = element; current; current = current.parentElement) {
      if (current.getAttribute('aria-hidden') === 'true' || current.hasAttribute('hidden')) return false
    }
    return true
  })).toBe(true)
  await expect(confirm.getByRole('button', { name: 'Close', exact: true })).toBeFocused()

  await confirm.getByRole('button', { name: 'Apply nested change', exact: true }).click()
  await expect(confirm).toBeVisible()
  await expect(page.getByTestId('dialog-events')).toHaveText('["nested-confirm-accept"]')
  await confirm.getByRole('button', { name: 'Keep editing nested', exact: true }).click()
  await expect(confirm).toBeVisible()
  await expect(page.getByTestId('dialog-events')).toHaveText('["nested-confirm-accept","nested-confirm-cancel"]')

  await page.keyboard.press('Escape')
  await expect(confirm).not.toBeVisible()
  await expect(primary).toBeVisible()
  await expect(page.getByTestId('dialog-events')).toHaveText('["nested-confirm-accept","nested-confirm-cancel","nested-confirm-close"]')
  await expect(confirmOpener).toBeFocused()

  await closeIcon(primary).click()
  await expect(primary).not.toBeVisible()
  await expect(opener).toBeFocused()
})

test('owned sibling Confirm closes above Modal and restores focus inside the remaining layer', async ({ page }) => {
  await page.goto(fixtureUrl('surface=dialog-consumers&mode=dark'))
  await page.getByRole('button', { name: 'Open primary dialog', exact: true }).click()
  const primary = dialogByTitle(page, 'Edit populated record')
  const confirmOpener = primary.getByRole('button', { name: 'Open sibling confirmation', exact: true })
  await confirmOpener.click()

  const confirm = page.getByRole('alertdialog', { name: 'Approve sibling change?', exact: true })
  await expect(confirm).toBeVisible()
  expect(await confirm.evaluate(element => {
    for (let current = element; current; current = current.parentElement) {
      if (current.getAttribute('aria-hidden') === 'true' || current.hasAttribute('hidden')) return false
    }
    return true
  })).toBe(true)
  await expect(confirm.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(confirm).not.toBeVisible()
  await expect(primary).toBeVisible()
  await expect(page.getByTestId('dialog-events')).toHaveText('["sibling-confirm-close"]')
  await expect(confirmOpener).toBeFocused()
})

test('sibling Modals preserve backdrop policy and the isTopPosition stack exception', async ({ page }) => {
  await page.goto(fixtureUrl('surface=dialog-consumers&mode=light'))
  await page.getByRole('button', { name: 'Open sibling dialog stack', exact: true }).click()
  const topPosition = dialogByTitle(page, 'Top-position exception')
  const sibling = dialogByTitle(page, 'Sibling protected layer')
  await expect(topPosition).toBeVisible()
  await expect(sibling).toBeVisible()

  await page.mouse.click(2, 2)
  await expect(topPosition).toBeVisible()
  await expect(sibling).toBeVisible()
  await expect(page.getByTestId('dialog-events')).toHaveText('[]')

  await closeIcon(topPosition).click()
  await expect(topPosition).not.toBeVisible()
  await expect(sibling).toBeVisible()
  await expect(page.getByTestId('dialog-events')).toHaveText('["top-position-close"]')
  await expect.poll(() => sibling.evaluate(element => element.contains(document.activeElement)), { message: 'Closing a sibling must keep focus in the surviving dialog' }).toBe(true)

  await page.mouse.click(2, 2)
  await expect(sibling).toBeVisible()
  await expect(page.getByTestId('dialog-events')).toHaveText('["top-position-close"]')
  await closeIcon(sibling).click()
  await expect(sibling).not.toBeVisible()
  await expect(page.getByTestId('dialog-events')).toHaveText('["top-position-close","sibling-close"]')

  await page.getByRole('button', { name: 'Open top-position dialog', exact: true }).click()
  const singleTopPosition = dialogByTitle(page, 'Top-position exception')
  await expect(singleTopPosition).toBeVisible()
  await page.mouse.click(2, 2)
  await expect(singleTopPosition).not.toBeVisible()
  await expect(page.getByTestId('dialog-events')).toHaveText('["top-position-close","sibling-close","top-position-close"]')
})

for (const mode of ['light', 'dark']) {
  test(`Modal title keeps readable contrast in ${mode}`, async ({ page }) => {
    await page.goto(fixtureUrl(`surface=dialog-consumers&mode=${mode}`))
    await page.getByRole('button', { name: 'Open primary dialog', exact: true }).click()
    const dialog = dialogByTitle(page, 'Edit populated record')
    const colors = await dialog.getByRole('heading', { name: 'Edit populated record', exact: true }).evaluate(element => {
      let background = getComputedStyle(element).backgroundColor
      let current = element
      while ((background === 'transparent' || background === 'rgba(0, 0, 0, 0)') && current.parentElement) {
        current = current.parentElement
        background = getComputedStyle(current).backgroundColor
      }
      return { background, color: getComputedStyle(element).color }
    })
    expect(contrast(colors.color, colors.background)).toBeGreaterThanOrEqual(4.5)
  })
}

test.describe('Modal with long content at 320px RTL', () => {
  test.use({ viewport: { width: 320, height: 480 }, hasTouch: true, isMobile: true })

  test('keeps content and actions reachable inside the visual viewport', async ({ page }, testInfo) => {
    await page.goto(fixtureUrl('surface=dialog-consumers&mode=dark&rtl=true'))
    const before = await viewportState(page)
    expect(before.coarse).toBe(true)
    expect(before.scrollWidth).toBeLessThanOrEqual(before.viewportWidth)
    expect(before.documentScrollLeft).toBe(0)
    expect(before.offsetLeft).toBe(0)
    expect(before.offsetTop).toBe(0)
    expect(before.scale).toBe(1)
    await page.screenshot({ path: testInfo.outputPath('dialog-consumer-before-open-coarse.png') })
    await page.getByRole('button', { name: 'Open primary dialog', exact: true }).click()
    const dialog = dialogByTitle(page, 'Edit populated record')
    await expect(dialog).toBeVisible()
    const metrics = await dialog.evaluate(element => {
      const rect = element.getBoundingClientRect()
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        viewportWidth: window.visualViewport?.width ?? innerWidth,
        viewportHeight: window.visualViewport?.height ?? innerHeight
      }
    })
    expect(metrics.left).toBeGreaterThanOrEqual(0)
    expect(metrics.right).toBeLessThanOrEqual(metrics.viewportWidth)
    expect(metrics.top).toBeGreaterThanOrEqual(0)
    expect(metrics.bottom).toBeLessThanOrEqual(metrics.viewportHeight)
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight)

    await page.screenshot({ path: testInfo.outputPath('dialog-consumer-top-coarse.png') })
    expect((await viewportState(page)).coarse).toBe(true)

    const accept = dialog.getByRole('button', { name: 'Keep changes', exact: true })
    await accept.scrollIntoViewIfNeeded()
    await expect(accept).toBeVisible()
    const acceptBox = await accept.boundingBox()
    expect(acceptBox.width).toBeGreaterThanOrEqual(44)
    expect(acceptBox.height).toBeGreaterThanOrEqual(44)
    const after = await viewportState(page)
    expect(after.coarse).toBe(true)
    expect(after.scrollWidth).toBeLessThanOrEqual(after.viewportWidth)
    expect(after.documentScrollLeft).toBe(0)
    expect(after.offsetLeft).toBe(0)
    expect(after.offsetTop).toBe(0)
    expect(after.scale).toBe(1)
    expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl')
    await page.screenshot({ path: testInfo.outputPath('dialog-consumer-after-open-coarse.png') })
    expect((await viewportState(page)).coarse).toBe(true)
    const opaqueBehindText = await dialog.locator('[data-testid=dialog-long-content] p').last().evaluate(element => {
      const textRect = element.getBoundingClientRect()
      const x = textRect.left + textRect.width / 2
      const y = textRect.top + textRect.height / 2
      for (let parent = element; parent && !parent.classList.contains('popup-component'); parent = parent.parentElement) {
        const rect = parent.getBoundingClientRect()
        const color = getComputedStyle(parent).backgroundColor
        const channels = color.match(/[\d.]+/g)?.map(Number) || []
        const opaque = color !== 'transparent' && channels.length >= 3 && (channels.length === 3 || channels[3] === 1)
        if (opaque && rect.left <= x && x <= rect.right && rect.top <= y && y <= rect.bottom) return true
      }
      return false
    })
    expect(opaqueBehindText, 'Long modal text must retain an opaque panel behind it while scrolled').toBe(true)
  })
})

test('three simultaneous sibling dialogs expose only the active layer and close one layer per Escape', async ({ page }) => {
  await page.goto(fixtureUrl('surface=dialog-consumers&mode=light'))
  const opener = page.getByRole('button', { name: 'Open three sibling dialogs', exact: true })
  await opener.click()
  const expectedEvents = []
  for (const index of [3, 2, 1]) {
    const title = `Sibling layer ${index}`
    const visibleLayer = dialogByTitle(page, title)
    await expect(page.getByRole('dialog', { name: title, exact: true })).toBeVisible()
    await expect.poll(() => visibleLayer.evaluate(element => element.contains(document.activeElement))).toBe(true)
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).overflowY)).toMatch(/hidden|clip/)
    await expect(page.getByRole('button', { name: 'Open three sibling dialogs', exact: true })).toHaveCount(0)
    await closeIcon(visibleLayer).focus()
    await page.keyboard.press('Tab')
    await expect(visibleLayer.getByLabel(`Layer ${index} value`)).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(closeIcon(visibleLayer)).toBeFocused()
    await page.keyboard.press('Escape')
    expectedEvents.push(`layer-${index}-close`)
    await expect(visibleLayer).not.toBeVisible()
    await expect(page.getByTestId('dialog-events')).toHaveText(JSON.stringify(expectedEvents))
    await expect(page.locator('.popup-component[data-open]')).toHaveCount(index - 1)
  }
  await expect(opener).toBeFocused()
  await expect(page.locator('#app-modals')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).overflowY)).not.toMatch(/hidden|clip/)
})

test('simultaneous Modal and Confirm keep the visible alert dialog accessible and focused', async ({ page }) => {
  await page.goto(fixtureUrl('surface=dialog-consumers&mode=light'))
  await page.getByRole('button', { name: 'Open simultaneous mixed dialogs', exact: true }).click()
  const alert = page.getByRole('alertdialog')
  await expect(alert).toBeVisible()
  await expect.poll(() => alert.evaluate(element => element.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(alert).not.toBeVisible()
  await expect(dialogByTitle(page, 'Edit populated record')).toBeVisible()
})

for (const relation of ['nested', 'sibling']) {
  test(`later ${relation} Dialog appears above Confirm and restores its keyboard navigation`, async ({ page }) => {
    await page.goto(fixtureUrl('surface=dialog-consumers&mode=light'))
    const opener = page.getByRole('button', { name: `Open Confirm for ${relation} child`, exact: true })
    await opener.click()
    const parent = page.getByRole('alertdialog', { name: 'Parent alert confirmation', exact: true })
    await expect(parent).toBeVisible()
    await expect(page.locator('#app-modals')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    const childOpener = parent.getByRole('button', { name: 'Open dialog above confirmation', exact: true })
    await childOpener.click()
    const child = page.getByRole('dialog', { name: 'Child dialog above confirmation', exact: true })
    await expect(child).toBeVisible()
    const field = child.getByLabel('Child dialog value')
    await expect(field).toBeFocused()
    expect(await field.evaluate(element => {
      const rect = element.getBoundingClientRect()
      return document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) === element
    })).toBe(true)
    await page.keyboard.press('Escape')
    await expect(child).not.toBeVisible()
    await expect(parent).toBeVisible()
    await expect(childOpener).toBeFocused()
    await expect(page.locator('#app-modals')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await page.keyboard.press('Tab')
    await expect(parent.getByRole('button', { name: 'Next parent action', exact: true })).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(childOpener).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(parent).not.toBeVisible()
    await expect(opener).toBeFocused()
    await expect(page.getByTestId('dialog-events')).toHaveText('["reverse-dialog-close","reverse-confirm-close"]')
  })
}
