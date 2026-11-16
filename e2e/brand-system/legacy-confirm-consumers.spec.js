import { test, expect, fixtureUrl } from './fixtures'

const confirmByTitle = (page, title) => page.locator('.popup-dialog').filter({ has: page.getByText(title, { exact: true }) })
const iconButton = confirm => confirm.locator(':scope > span button')
const viewportState = page => page.evaluate(() => ({
  coarse: matchMedia('(pointer: coarse)').matches,
  offsetLeft: window.visualViewport?.offsetLeft ?? 0,
  offsetTop: window.visualViewport?.offsetTop ?? 0,
  scale: window.visualViewport?.scale ?? 1,
  scrollLeft: document.documentElement.scrollLeft,
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
const effectiveColors = locator => locator.evaluate(element => {
  let background = getComputedStyle(element).backgroundColor
  let current = element
  while ((background === 'transparent' || background === 'rgba(0, 0, 0, 0)') && current.parentElement) {
    current = current.parentElement
    background = getComputedStyle(current).backgroundColor
  }
  return { background, color: getComputedStyle(element).color }
})

test('legacy Confirm preserves populated content filtering and independent scalar callbacks', async ({ page }) => {
  await page.goto(fixtureUrl('surface=legacy-confirm-consumers&mode=light'))
  await page.getByRole('button', { name: 'Open populated legacy confirmation', exact: true }).click()
  const confirm = confirmByTitle(page, 'Legacy populated confirmation')
  await expect(confirm).toBeVisible()
  await expect(confirm).toHaveCSS('width', '620px')
  await expect(confirm.getByText('Primary fixture error with enough text to wrap in a narrow viewport.', { exact: true })).toBeVisible()
  await expect(confirm.getByText('Nested fixture error one.', { exact: true })).toBeVisible()
  await expect(confirm.getByText('Nested fixture error two with a deliberately long explanation for short screens.', { exact: true })).toBeVisible()
  await expect(confirm.getByText('Final fixture error remains visible after the ignored values.', { exact: true })).toBeVisible()
  await expect(confirm.getByText('42', { exact: true })).toHaveCount(0)
  await expect(confirm.getByText('[object Object]', { exact: true })).toHaveCount(0)
  await expect(confirm.getByText('Parent modal data must remain mounted.', { exact: true })).toHaveCount(0)
  await expect(confirm.getByLabel('Confirmation value', { exact: true })).toHaveValue('Preserved legacy value')

  const cancel = confirm.getByRole('button', { name: 'Cancel legacy change', exact: true })
  const accept = confirm.getByRole('button', { name: 'Keep legacy change', exact: true })
  await expect(cancel).toHaveCSS('height', '45px')
  await expect(accept).toHaveCSS('height', '45px')
  for (const button of [cancel, accept, iconButton(confirm)]) {
    expect(await button.getAttribute('type')).toBe(null)
    expect(await button.evaluate(element => element.type)).toBe('submit')
  }
  await accept.click()
  await expect(confirm).toBeVisible()
  await expect(page.getByTestId('legacy-confirm-events')).toHaveText('["confirm-accept"]')
  await cancel.click()
  await expect(confirm).toBeVisible()
  await expect(page.getByTestId('legacy-confirm-events')).toHaveText('["confirm-accept","confirm-cancel"]')
  await iconButton(confirm).click()
  await expect(confirm).not.toBeVisible()
  await expect(page.getByTestId('legacy-confirm-events')).toHaveText('["confirm-accept","confirm-cancel","confirm-close"]')
})

test('legacy Confirm keeps default width, RTL list spacing, and independent backdrop policy', async ({ page }) => {
  await page.goto(fixtureUrl('surface=legacy-confirm-consumers&mode=light&rtl=true'))
  await page.getByRole('button', { name: 'Open protected legacy confirmation', exact: true }).click()
  const protectedConfirm = confirmByTitle(page, 'Protected legacy confirmation')
  const width = (await protectedConfirm.boundingBox()).width
  expect(Math.abs(width - (await page.evaluate(() => innerWidth)) * 0.7)).toBeLessThanOrEqual(1)
  await page.mouse.click(2, 2)
  await expect(protectedConfirm).toBeVisible()
  await expect(page.getByTestId('legacy-confirm-events')).toHaveText('[]')
  await iconButton(protectedConfirm).click()
  await expect(page.getByTestId('legacy-confirm-events')).toHaveText('["protected-close"]')

  await page.getByRole('button', { name: 'Open populated legacy confirmation', exact: true }).click()
  const populated = confirmByTitle(page, 'Legacy populated confirmation')
  await expect(populated.getByRole('heading', { name: 'Legacy populated confirmation', exact: true })).toHaveCSS('text-align', 'right')
  const list = populated.locator('ul')
  await expect(list).toHaveCSS('padding-left', '0px')
  await expect(list).toHaveCSS('padding-right', '30px')
  await expect(list.locator('li').first()).toHaveCSS('margin-top', '7px')
  await expect(list.locator('li').first()).toHaveCSS('margin-bottom', '7px')
  await page.mouse.click(2, 2)
  await expect(populated).not.toBeVisible()
  await expect(page.getByTestId('legacy-confirm-events')).toHaveText('["protected-close","confirm-close"]')
})

test('improvement target: parent Modal and legacy Alert preserve top-layer focus and Escape ownership', async ({ page }) => {
  await page.goto(fixtureUrl('surface=legacy-confirm-consumers&mode=light'))
  const parentOpener = page.getByRole('button', { name: 'Open parent modal for legacy alert', exact: true })
  await parentOpener.click()
  const parent = page.locator('.popup-dialog').filter({ has: page.getByText('Parent modal with legacy alert', { exact: true }) })
  const alertOpener = parent.getByRole('button', { name: 'Open legacy alert', exact: true })
  await alertOpener.click()
  const alert = confirmByTitle(page, 'Legacy alert above modal')
  await expect(alert).toBeVisible()
  await expect(iconButton(alert)).toBeFocused()
  await alert.getByRole('button', { name: 'Acknowledge alert', exact: true }).click()
  await expect(alert).toBeVisible()
  await expect(page.getByTestId('legacy-confirm-events')).toHaveText('["alert-accept"]')

  await page.keyboard.press('Tab')
  // Tab past the last action lands on Base UI's hidden focus guard, which moves focus back into the popup on the
  // next animation frame (enqueueFocus). Read the focus in a later frame callback: before it, the guard held focus 6 runs in 40.
  expect(await alert.evaluate(element => new Promise(resolve => requestAnimationFrame(() => resolve(element.contains(document.activeElement)))))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(alert).not.toBeVisible()
  await expect(parent).toBeVisible()
  await expect(page.getByTestId('legacy-confirm-events')).toHaveText('["alert-accept","alert-close"]')
  await expect(alertOpener).toBeFocused()
  await parent.locator('.modal-close-icon button').click()
  await expect(parent).not.toBeVisible()
  await expect(parentOpener).toBeFocused()
})

for (const mode of ['light', 'dark']) {
  test(`improvement target: legacy Confirm title and content retain readable contrast in ${mode}`, async ({ page }) => {
    await page.goto(fixtureUrl(`surface=legacy-confirm-consumers&mode=${mode}`))
    await page.getByRole('button', { name: 'Open populated legacy confirmation', exact: true }).click()
    const confirm = confirmByTitle(page, 'Legacy populated confirmation')
    for (const locator of [
      confirm.getByRole('heading', { name: 'Legacy populated confirmation', exact: true }),
      confirm.getByText('Primary fixture error with enough text to wrap in a narrow viewport.', { exact: true })
    ]) {
      const colors = await effectiveColors(locator)
      expect(contrast(colors.color, colors.background)).toBeGreaterThanOrEqual(4.5)
    }
  })
}

for (const width of [320, 390]) {
  test.describe(`legacy Confirm long content at ${width}px`, () => {
    test.use({ viewport: { width, height: 480 }, hasTouch: true, isMobile: true })

    test('improvement target: content and footer actions stay reachable in the short viewport', async ({ page }, testInfo) => {
      await page.goto(fixtureUrl('surface=legacy-confirm-consumers&mode=dark&rtl=true'))
      const before = await viewportState(page)
      expect(before.coarse).toBe(true)
      expect(before.scrollWidth).toBeLessThanOrEqual(before.viewportWidth)
      await page.screenshot({ path: testInfo.outputPath(`legacy-confirm-${width}-before.png`) })
      expect((await viewportState(page)).coarse).toBe(true)

      await page.getByRole('button', { name: 'Open populated legacy confirmation', exact: true }).click()
      const confirm = confirmByTitle(page, 'Legacy populated confirmation')
      const rect = await confirm.boundingBox()
      expect(rect.x).toBeGreaterThanOrEqual(0)
      expect(rect.x + rect.width).toBeLessThanOrEqual(before.viewportWidth)
      expect(rect.y).toBeGreaterThanOrEqual(0)
      expect(rect.y + rect.height).toBeLessThanOrEqual(before.viewportHeight)

      await page.screenshot({ path: testInfo.outputPath(`legacy-confirm-${width}-top.png`) })
      expect((await viewportState(page)).coarse).toBe(true)

      const accept = confirm.getByRole('button', { name: 'Keep legacy change', exact: true })
      const cancel = confirm.getByRole('button', { name: 'Cancel legacy change', exact: true })
      for (const control of [cancel, accept]) {
        await control.scrollIntoViewIfNeeded()
        await expect(control).toBeVisible()
        const box = await control.boundingBox()
        expect(box.width).toBeGreaterThanOrEqual(44)
        expect(box.height).toBeGreaterThanOrEqual(44)
        const textFits = await control.evaluate(element => {
          const range = document.createRange()
          range.selectNodeContents(element)
          const text = range.getBoundingClientRect()
          const button = element.getBoundingClientRect()
          return text.top >= button.top && text.bottom <= button.bottom && text.left >= button.left && text.right <= button.right
        })
        expect(textFits, 'The complete action label must remain inside its button').toBe(true)
      }
      const after = await viewportState(page)
      expect(after.coarse).toBe(true)
      expect(after.scrollWidth).toBeLessThanOrEqual(after.viewportWidth)
      expect(after.scrollLeft).toBe(0)
      expect(after.offsetLeft).toBe(0)
      expect(after.offsetTop).toBe(0)
      expect(after.scale).toBe(1)
      await page.screenshot({ path: testInfo.outputPath(`legacy-confirm-${width}-after.png`) })
      expect((await viewportState(page)).coarse).toBe(true)
    })
  })
}

test('legacy alert links its real rich title and description while retaining mounted form values', async ({ page }) => {
  await page.goto(fixtureUrl('surface=legacy-confirm-consumers&mode=light&probeRichTitle=true'))
  await page.getByRole('button', { name: 'Open populated legacy confirmation', exact: true }).click()
  const alert = page.getByRole('alertdialog', { name: 'Legacy populated confirmation', exact: true })
  await expect(alert).toHaveAccessibleDescription(/Primary fixture error/)
  const field = alert.getByLabel('Confirmation value', { exact: true })
  await field.fill('Retained edits')
  const originalField = await field.elementHandle()
  await alert.getByRole('button', { name: 'Use rich title', exact: true }).click()
  const renamed = page.getByRole('alertdialog', { name: 'Legacy rich confirmation', exact: true })
  await expect(renamed).toBeVisible()
  await expect(renamed.getByLabel('Confirmation value', { exact: true })).toHaveValue('Retained edits')
  expect(await originalField.evaluate(element => element.isConnected)).toBe(true)
  await renamed.getByRole('button', { name: 'Close', exact: true }).click()
})

test('legacy alert accepts a nonvisual accessible label when its visual title is absent', async ({ page }) => {
  await page.goto(fixtureUrl('surface=legacy-confirm-consumers&mode=dark'))
  await page.getByRole('button', { name: 'Open labelled legacy alert', exact: true }).click()
  const alert = page.getByRole('alertdialog', { name: 'Description-only alert', exact: true })
  await expect(alert).toHaveAccessibleDescription('Description-only fixture message.')
  await expect(alert.getByRole('heading')).toHaveCount(0)
  await alert.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(alert).not.toBeVisible()
})
