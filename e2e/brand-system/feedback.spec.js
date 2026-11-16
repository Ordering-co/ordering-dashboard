import { test, expect, fixtureUrl } from './fixtures'
import { tokens } from '../../src/brand/ordering.tokens.generated'
import localeConfig from '../../i18n/config.json'
import translations from '../../i18n/translations.json'

const rgb = hex => `rgb(${hex.slice(1).match(/../g).map(part => parseInt(part, 16)).join(', ')})`
const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number)
  .map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
const contrast = (first, second) => {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a)
  return (values[0] + 0.05) / (values[1] + 0.05)
}
const colors = locator => locator.evaluate(element => {
  const style = getComputedStyle(element)
  let current = element
  let background = style.backgroundColor
  while (current && ['transparent', 'rgba(0, 0, 0, 0)'].includes(background)) {
    current = current.parentElement
    background = current ? getComputedStyle(current).backgroundColor : 'rgb(255, 255, 255)'
  }
  return { background, foreground: style.color }
})
const json = async locator => JSON.parse(await locator.textContent())
const toast = page => page.locator('#toast-container .toast-bar')
// decision 12 (as transition.spec.js): what a finger hits is measured by hit-testing out from the centre of the control, a quarter
// pixel at a time, so a clipped or covered area counts as smaller (the computed insets of the pseudo-element are not its box).
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

test('legacy empty, progress and loader contracts remain exact through the public facades', async ({ page }) => {
  await page.goto(fixtureUrl('surface=feedback&mode=light'))

  const action = page.getByTestId('not-found-action')
  await expect(action.getByRole('heading', { name: 'No matching orders', exact: true })).toBeVisible()
  await expect(action.getByAltText('Not Found')).toHaveAttribute('src', /not-found/)
  await expect(action.getByTestId('callback-losing-child')).toHaveCount(0)
  await action.getByRole('button', { name: 'Clear filters', exact: true }).click()
  expect(await json(page.getByTestId('not-found-events'))).toEqual([[]])
  await expect(page.getByTestId('not-found-child').getByRole('link', { name: 'Create an export', exact: true })).toBeVisible()
  await expect(page.getByTestId('not-found-empty').getByAltText('Not Found')).toBeVisible()
  await expect(page.getByTestId('not-found-empty').locator('h1')).toBeEmpty()

  await expect(page.getByTestId('progress-numeric').getByText('25%', { exact: true })).toHaveCSS('font-size', '18px')
  const direct = page.getByTestId('progress-direct').getByRole('img')
  await expect(direct).toHaveAttribute('role', 'img')
  await expect(direct).toHaveAccessibleName('38%')
  await expect(direct).toContainText('38%')
  const circles = direct.locator('circle')
  const radius = 54
  const circumference = radius * 2 * Math.PI
  await expect(circles).toHaveCount(2)
  for (const circle of await circles.all()) {
    await expect(circle).toHaveAttribute('cx', '60')
    await expect(circle).toHaveAttribute('cy', '60')
    await expect(circle).toHaveAttribute('r', String(radius))
    await expect(circle).toHaveAttribute('stroke-width', '12')
  }
  await expect(circles.nth(0)).toHaveAttribute('stroke', '#ABCDEF')
  await expect(circles.nth(1)).toHaveAttribute('stroke', '#123456')
  await expect(circles.nth(1)).toHaveAttribute('stroke-linecap', 'round')
  expect(Number(await circles.nth(1).getAttribute('stroke-dasharray'))).toBeCloseTo(circumference, 5)
  expect(parseFloat(await circles.nth(1).evaluate(element => element.style.strokeDashoffset))).toBeCloseTo(circumference * (1 - 37.6 / 100), 3)
  await expect(circles.nth(1)).toHaveCSS('transition-duration', '0.45s')
  await expect(direct.locator('svg')).toHaveCSS('animation-duration', '2s')
  const percentLabel = direct.getByText('38%', { exact: true })
  await expect(percentLabel).toHaveCSS('color', 'rgb(101, 67, 33)')
  await expect(percentLabel).toHaveCSS('font-size', '18px')

  for (const [testId, value, label] of [['progress-below', -25, '-25%'], ['progress-above', 150, '150%']]) {
    const progress = page.getByTestId(testId).getByRole('img')
    await expect(progress).toHaveAttribute('role', 'img')
    await expect(progress).toHaveAccessibleName(label)
    await expect(progress).toContainText(label)
    const expected = 36 * 2 * Math.PI * (1 - value / 100)
    expect(parseFloat(await progress.locator('circle').nth(1).evaluate(element => element.style.strokeDashoffset))).toBeCloseTo(expected, 3)
  }

  const simple = page.getByTestId('simple-spinner')
  await expect(simple).toHaveAttribute('id', 'loading')
  await expect(simple).toHaveCSS('width', '36px')
  await expect(simple).toHaveCSS('height', '28px')
  await expect(simple).toHaveCSS('border-top-color', 'rgb(18, 52, 86)')
  await expect(simple).toHaveCSS('margin-left', '7px')
  const normal = page.getByTestId('spinner-normal').getByRole('status')
  await expect(normal).toContainText('Preparing report')
  await expect(normal).toHaveCSS('height', `${await page.evaluate(() => innerHeight)}px`)
  await expect(page.getByTestId('spinner-logo').getByRole('status').getByAltText('logo')).toHaveAttribute('src', /ordering-lockup-color/)
  const compact = page.getByTestId('spinner-compact').getByRole('status')
  await expect(compact).toHaveCSS('width', '170px')
  await expect(compact).toHaveCSS('height', '90px')
  await expect(compact).toHaveCSS('transform', 'matrix(0.3, 0, 0, 0.3, 0, 0)')
  await expect(page.getByTestId('spinner-falsy').locator('h1, img')).toHaveCount(0)
})

test('toast provider preserves replacement, duration, coercion, HTML, manual hide and cleanup', async ({ page }) => {
  await page.goto(fixtureUrl('surface=feedback&mode=light'))

  const cases = [
    ['Show info', 'Information saved', 'status', 'INFO'],
    ['Show error', 'Unable to save', 'alert', 'ERROR'],
    ['Show success', 'Changes saved', 'status', 'SUCCESS'],
    ['Show unknown', 'Unknown notification', 'status', 'UNKNOWN']
  ]
  for (const [button, message, role, type] of cases) {
    await page.getByRole('button', { name: button, exact: true }).click()
    await expect(toast(page)).toHaveCount(1)
    await expect(toast(page)).toHaveRole(role)
    await expect(toast(page)).toHaveText(message)
    expect((await json(page.getByTestId('toast-state'))).toastConfig).toEqual({ type, message, duration: 3000 })
  }

  // tanda N: the message is text, never HTML; markup in a message shows as typed (array coercion as before)
  await page.getByRole('button', { name: 'Show array HTML', exact: true }).click()
  await expect(toast(page)).toHaveText('Array ,<strong>content</strong>')
  await expect(toast(page).locator('strong')).toHaveCount(0)
  await page.getByRole('button', { name: 'Show supported HTML', exact: true }).click()
  await expect(toast(page)).toContainText('Saved with <strong>verified details</strong>')
  await expect(toast(page).locator('strong')).toHaveCount(0)

  await page.getByRole('button', { name: 'Replace rapidly', exact: true }).click()
  await expect(toast(page)).toHaveCount(1)
  await expect(toast(page)).toHaveText('Replacement notification')
  expect((await json(page.getByTestId('toast-state'))).toastConfig).toEqual({ type: 'ERROR', message: 'Replacement notification', duration: 60000 })
  await page.getByRole('button', { name: 'Hide notification', exact: true }).click()
  await expect(toast(page)).toHaveCount(0)
  expect((await json(page.getByTestId('toast-state'))).toastConfig).toBeNull()

  await page.getByRole('button', { name: 'Show short notification', exact: true }).click()
  await expect(toast(page)).toHaveText('Short notification')
  await page.getByRole('button', { name: 'Toggle notification mount', exact: true }).click()
  await expect(toast(page)).toHaveCount(0)
  expect((await json(page.getByTestId('toast-state'))).mounted).toBe(false)
  await page.getByRole('button', { name: 'Show long notification', exact: true }).click()
  await page.getByRole('button', { name: 'Toggle notification mount', exact: true }).click()
  await expect(toast(page)).toContainText('A very long notification')
  await page.waitForTimeout(250)
  await expect(toast(page)).toContainText('A very long notification')
  expect((await json(page.getByTestId('toast-state'))).toastConfig.duration).toBe(60000)
  await page.getByRole('button', { name: 'Hide notification', exact: true }).click()
  await expect(toast(page)).toHaveCount(0)
})

test('banners retain named-user, billing, configuration, events and browser reload behavior', async ({ page, context }) => {
  await page.goto(fixtureUrl('surface=feedback&mode=light'))
  // redesign (R2): the past-due notice is an InlineNotice (role alert, danger); its title is a <strong>, no longer a heading
  const pastDue = page.getByTestId('past-due-banner').getByRole('alert')
  await expect(pastDue).toHaveAttribute('data-tone', 'danger')
  await expect(pastDue).toContainText('Avery')
  await expect(pastDue.locator('.odc-shell-notice-title')).toContainText('Avery')
  await pastDue.getByRole('button', { name: 'Pay now', exact: true }).click()
  expect(await json(page.getByTestId('billing-state'))).toEqual({ open: true, from: 'past_due', retained: 'yes' })

  const featureLink = page.getByTestId('disabled-feature').getByRole('link', { name: 'Get this feature', exact: true })
  await expect(featureLink).toHaveAttribute('href', 'https://www.ordering.com/ordering-sales')
  await expect(featureLink).toHaveAttribute('target', '_blank')

  await page.getByRole('button', { name: 'Emit connection failed', exact: true }).click()
  const websocket = page.getByTestId('websocket-banner')
  await expect(websocket.getByRole('alert')).toHaveAttribute('data-tone', 'warning')
  await expect(websocket.getByText('Connection issue', { exact: true })).toBeVisible()
  await expect(websocket).toContainText('Real-time updates are unavailable')
  await websocket.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(websocket).toBeEmpty()
  await page.getByRole('button', { name: 'Emit connection restored', exact: true }).click()
  await page.getByRole('button', { name: 'Emit connection failed', exact: true }).click()
  await expect(websocket.getByText('Connection issue', { exact: true })).toBeVisible()

  // redesign (D6): online the offline page paints nothing; offline it is one empty state, a level-1 heading and no picture
  const network = page.getByTestId('network-state')
  await expect(network).toBeEmpty()
  await context.setOffline(true)
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
  await expect(websocket).toContainText('No internet connection detected')
  await expect(network.getByRole('heading', { name: "You're offline", level: 1 })).toBeVisible()
  await expect(network.locator('img')).toHaveCount(0)
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect(network).toBeEmpty()

  const before = Number(await page.getByTestId('feedback-mount-count').textContent())
  await Promise.all([
    page.waitForNavigation(),
    websocket.getByRole('button', { name: 'Refresh', exact: true }).click()
  ])
  await expect(page.getByTestId('feedback-mount-count')).toHaveText(String(before + 1))
})

for (const mode of ['light', 'dark']) {
  test(`semantic feedback states use governed colors and readable content in ${mode}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(fixtureUrl(`surface=feedback&mode=${mode}`))
    await page.getByRole('button', { name: 'Show success', exact: true }).click()
    await page.getByRole('button', { name: 'Emit connection failed', exact: true }).click()

    const expected = tokens.theme[mode].semantic
    // redesign (R2): past due is a danger notice (approved design change), the connection issue stays warning
    const pastDue = page.getByTestId('past-due-banner').locator('[role="alert"][data-tone="danger"]')
    const websocket = page.getByTestId('websocket-banner').locator('[role="alert"][data-tone="warning"]')
    await expect(pastDue).toHaveCSS('background-color', rgb(expected.state.danger.soft))
    await expect(websocket).toHaveCSS('background-color', rgb(expected.state.warning.soft))
    const disabled = page.getByTestId('disabled-feature').locator('[data-slot="disabled-feature-alert"]')
    await expect(disabled).toHaveCSS('background-color', rgb(expected.action.soft))
    await expect(disabled).toHaveCSS('border-color', rgb(expected.action.content))
    for (const target of [pastDue.locator('.odc-shell-notice-title'), pastDue.locator('.odc-shell-notice-body'), websocket.locator('.odc-shell-notice-title'), websocket.locator('.odc-shell-notice-body'), disabled]) {
      const value = await colors(target)
      expect.soft(contrast(value.foreground, value.background)).toBeGreaterThanOrEqual(4.5)
    }
    const featureLink = disabled.getByRole('link')
    await featureLink.focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    await expect(featureLink).toBeFocused()
    const focus = await featureLink.evaluate(element => ({ width: parseFloat(getComputedStyle(element).outlineWidth), style: getComputedStyle(element).outlineStyle, color: getComputedStyle(element).outlineColor }))
    expect.soft(focus.width).toBeGreaterThanOrEqual(2)
    expect.soft(focus.style).toBe('solid')
    expect.soft(contrast(focus.color, (await colors(featureLink)).background)).toBeGreaterThanOrEqual(3)
    const spinner = page.getByTestId('simple-spinner-default')
    expect.soft(contrast(await spinner.evaluate(element => getComputedStyle(element).borderTopColor), (await colors(spinner)).background)).toBeGreaterThanOrEqual(3)
    const notificationColors = await colors(toast(page))
    expect.soft(contrast(notificationColors.foreground, notificationColors.background)).toBeGreaterThanOrEqual(4.5)
    // redesign NF: the 404 is a Product empty state: a level-1 heading, one line, one link and no pictures
    const pageNotFound = page.getByTestId('page-not-found')
    const notFoundTitle = pageNotFound.getByRole('heading', { name: "This page isn't available", level: 1 })
    await expect(notFoundTitle).toBeVisible()
    expect.soft(contrast((await colors(notFoundTitle)).foreground, (await colors(notFoundTitle)).background)).toBeGreaterThanOrEqual(4.5)
    const startLink = pageNotFound.getByRole('link', { name: 'Go to your start page', exact: true })
    await expect(startLink).toHaveAttribute('href', '/')
    const startColors = await colors(startLink)
    expect.soft(contrast(startColors.foreground, startColors.background)).toBeGreaterThanOrEqual(4.5)
    await expect(pageNotFound.locator('img')).toHaveCount(0)
    await expect(pageNotFound.getByRole('alert')).toHaveCount(0)
    await page.getByTestId('past-due-banner').scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath(`feedback-banners-${mode}.png`) })
    await page.getByTestId('progress-direct').scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath(`feedback-progress-${mode}.png`) })
    await page.screenshot({ path: testInfo.outputPath(`feedback-${mode}.png`), fullPage: true })
  })
}

test('primary loader keeps its full-screen overlay contract and a single live status owner', async ({ page }) => {
  await page.goto(fixtureUrl('surface=feedback&mode=dark&view=primary-loader'))
  const loader = page.getByTestId('primary-loader-case').getByRole('status')
  await expect(loader).toHaveCSS('position', 'fixed')
  await expect(loader).toHaveCSS('width', `${await page.evaluate(() => innerWidth)}px`)
  await expect(loader).toHaveCSS('z-index', '100')
  await expect(loader).toHaveAttribute('aria-live', 'polite')
  await expect(loader.getByText('Loading dashboard', { exact: true })).toBeVisible()
  await expect(page.locator('[role="status"]')).toHaveCount(1)
})

test('reduced motion removes progress and spinner animation without changing their geometry', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(fixtureUrl('surface=feedback&mode=light'))
  const direct = page.getByTestId('progress-direct').getByRole('img')
  const simple = page.getByTestId('simple-spinner')
  const spinner = page.getByTestId('spinner-normal').locator('.spinner-content > div')
  const before = await Promise.all([direct.boundingBox(), simple.boundingBox(), spinner.boundingBox()])
  await expect(direct.locator('svg')).toHaveCSS('animation-name', 'none')
  await expect(direct.locator('circle').nth(1)).toHaveCSS('transition-duration', '0s')
  await expect(simple).toHaveCSS('animation-name', 'none')
  await expect(spinner).toHaveCSS('animation-name', 'none')
  const after = await Promise.all([direct.boundingBox(), simple.boundingBox(), spinner.boundingBox()])
  expect(after).toEqual(before)
})

for (const width of [320, 390]) {
  test.describe(`feedback at ${width}px coarse pointer`, () => {
    test.use({ viewport: { width, height: 800 }, hasTouch: true, isMobile: true })
    test('long RTL states reflow, retain 44px actions and stay inside the viewport', async ({ page }, testInfo) => {
      await page.goto(fixtureUrl('surface=feedback&mode=dark&locale=ar&rtl=true'))
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      await page.getByRole('button', { name: 'Show long notification', exact: true }).click()
      await page.getByRole('button', { name: 'Emit connection failed', exact: true }).click()
      const longToast = toast(page)
      await expect(longToast).toBeVisible()
      await longToast.scrollIntoViewIfNeeded()
      await page.screenshot({ path: testInfo.outputPath(`feedback-${width}-before.png`) })
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)

      // redesign (decision 12): the notices' Product buttons are SEEN at 32px and their 44x44 area is the ::after, so it is
      // measured by hit-testing out from the centre; the legacy disabled-feature link keeps its own 44px box
      for (const control of await page.locator('[data-testid="past-due-banner"] button, [data-testid="websocket-banner"] button').all()) {
        // mid-viewport, clear of the fixed long toast that covers the lower part of a 320px screen and of the top edge that cuts the area
        await control.evaluate(element => element.scrollIntoView({ block: 'center' }))
        const area = await touchArea(control)
        expect.soft(area.width).toBeGreaterThanOrEqual(44)
        expect.soft(area.height).toBeGreaterThanOrEqual(44)
      }
      for (const control of await page.locator('[data-testid="disabled-feature"] a').all()) {
        const box = await control.boundingBox()
        expect.soft(box.width).toBeGreaterThanOrEqual(44)
        expect.soft(box.height).toBeGreaterThanOrEqual(44)
      }
      const bounds = await longToast.boundingBox()
      expect(bounds.x).toBeGreaterThanOrEqual(0)
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      await page.screenshot({ path: testInfo.outputPath(`feedback-${width}-after.png`) })
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
    })
  })
}

test('page-not-found uses the catalog in all twelve locales and Arabic keeps the translated feedback direction', async ({ page }) => {
  // fila 48: thirteen full page loads (twelve locales and the Arabic dark one) in one test; 30s ran out on a loaded machine
  test.setTimeout(90000)
  await page.setViewportSize({ width: 390, height: 844 })
  for (const locale of [localeConfig.sourceLanguage, ...localeConfig.supportedLocales]) {
    await page.goto(fixtureUrl(`surface=feedback&mode=light&locale=${locale}&rtl=${locale === 'ar'}`))
    const pageNotFound = page.getByTestId('page-not-found')
    await expect(pageNotFound.getByRole('heading', { name: translations.PAGE_UNAVAILABLE_TITLE[locale], level: 1 })).toBeVisible()
    await expect(pageNotFound.getByText(translations.PAGE_UNAVAILABLE_DESCRIPTION[locale], { exact: true })).toBeVisible()
    await expect(pageNotFound.getByRole('link', { name: translations.GO_TO_START_PAGE[locale], exact: true })).toHaveAttribute('href', '/')
    // redesign NF: the longest strings stay inside the 390px viewport in every language
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    await expect(page.getByTestId('spinner-falsy').locator('.od-spinner-loader-announcement')).toHaveText(translations.LOADING[locale])
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
  }
  await page.goto(fixtureUrl('surface=feedback&mode=dark&locale=ar&rtl=true'))
  const pastDue = page.getByTestId('past-due-banner')
  // redesign (R2): the title is a <strong>, no longer a heading
  await expect(pastDue.locator('.odc-shell-notice-title')).toHaveText(translations.PAST_DUE_TITLE_BANNER.ar.replace(':user:', 'Avery'))
  await expect(pastDue.getByRole('button')).toHaveText(translations.PAY_NOW.ar)
  await expect(page.getByTestId('disabled-feature').getByRole('link')).toHaveText(translations.GET_FEATURE.ar)
})

test('page-not-found without a session points to the login and offers no menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(fixtureUrl('surface=feedback&mode=light&session=out'))
  const pageNotFound = page.getByTestId('page-not-found')
  await expect(pageNotFound.getByRole('heading', { name: "This page isn't available", level: 1 })).toBeVisible()
  await expect(pageNotFound.getByText('Check the address, or log in to continue.', { exact: true })).toBeVisible()
  await expect(pageNotFound.getByRole('link', { name: 'Go to log in', exact: true })).toHaveAttribute('href', '/login')
  await expect(pageNotFound.getByRole('button', { name: 'Open menu' })).toHaveCount(0)
  // decision 12: the button is seen at 32 and its 44x44 touch area is a centred pseudo-element
  const login = pageNotFound.getByRole('link', { name: 'Go to log in', exact: true })
  expect.soft((await login.boundingBox()).height).toBeGreaterThanOrEqual(32)
  const area = await login.evaluate(element => { const style = getComputedStyle(element, '::after'); return { content: style.content, position: style.position } })
  expect.soft(area).toEqual({ content: '""', position: 'absolute' })
})
