import { test, expect, fixtureUrl } from './fixtures'
import { tokens } from '../../src/brand/ordering.tokens.generated'
import translations from '../../i18n/translations.json'
import localeConfig from '../../i18n/config.json'

const sidebar = (page, id) => page.locator(`#${id}`)
const events = page => page.getByTestId('sidebar-events').evaluate(element => JSON.parse(element.textContent))
const inlineWidth = locator => locator.evaluate(element => element.style.width)
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
const effectiveBackground = locator => locator.evaluate(element => {
  let current = element
  let background = getComputedStyle(current).backgroundColor
  while ((background === 'transparent' || background === 'rgba(0, 0, 0, 0)') && current.parentElement) {
    current = current.parentElement
    background = getComputedStyle(current).backgroundColor
  }
  return background
})

test('legacy contract: SideBar starts at zero, opens at 500, keeps width when open becomes false, and parent close unmounts', async ({ page }) => {
  await page.goto(fixtureUrl('surface=sidebar-consumers&mode=light'))
  let primary = sidebar(page, 'sidebar-primary')
  await expect(primary).toHaveCount(1)
  expect(await inlineWidth(primary)).toBe('')
  await expect(primary).toHaveCSS('width', '0px')

  await page.getByRole('button', { name: 'Open primary sidebar', exact: true }).click()
  await expect.poll(() => inlineWidth(primary)).toBe('500px')
  await primary.locator('button').nth(0).click()
  // Main (0baa7cb9, assistant dock): the expanded width is var(--app-width, 100vw); the fixture defines no --app-width so it resolves to 100vw.
  expect(await inlineWidth(primary)).toBe('var(--app-width, 100vw)')
  await expect.poll(() => primary.evaluate(el => getComputedStyle(el).width)).toBe(await page.evaluate(() => `${document.documentElement.clientWidth}px`))
  await primary.locator('button').nth(0).click()
  expect(await inlineWidth(primary)).toBe('500px')
  await page.getByRole('button', { name: 'Write primary width 620', exact: true }).click()
  expect(await inlineWidth(primary)).toBe('620px')
  await page.getByRole('button', { name: 'Set primary open false', exact: true }).click()
  expect(await inlineWidth(primary)).toBe('620px')

  await page.getByRole('button', { name: 'Mount primary closed', exact: true }).click()
  primary = sidebar(page, 'sidebar-primary')
  await expect(primary).toHaveCSS('width', '0px')
  await page.getByRole('button', { name: 'Open primary sidebar', exact: true }).click()
  await expect.poll(() => inlineWidth(primary)).toBe('500px')
  await primary.locator('button').nth(1).click()
  await expect(primary).toHaveCount(0)
  expect(await events(page)).toContainEqual({ kind: 'primary-close', id: 'sidebar-primary', open: true, width: '500px' })
})

test('legacy contract: custom width, noAnimation, moveDistance, border, ID, and direct width writes remain observable', async ({ page }) => {
  await page.goto(fixtureUrl('surface=sidebar-consumers&mode=light'))
  const custom = sidebar(page, 'sidebar-custom')
  await page.getByRole('button', { name: 'Open custom sidebar', exact: true }).click()
  await expect.poll(() => inlineWidth(custom)).toBe('640px')
  await expect(custom).toHaveCSS('padding-right', '36px')
  await expect(custom).toHaveCSS('transition-duration', '0s')
  await expect(custom).toHaveCSS('border-left-width', '1px')
  await custom.evaluate(element => { element.style.width = '700px' })
  expect(await inlineWidth(custom)).toBe('700px')
})

test('legacy contract: outside close respects disabled mode and both referenced exclusion containers', async ({ page }) => {
  await page.goto(fixtureUrl('surface=sidebar-consumers&mode=light'))
  await page.getByRole('button', { name: 'Open primary sidebar', exact: true }).click()
  await page.getByTestId('outside-sidebar').click()
  await expect(sidebar(page, 'sidebar-primary')).toHaveCount(1)
  expect(await events(page)).toEqual([])

  await page.getByRole('button', { name: 'Open outside-close sidebar', exact: true }).click()
  await page.getByRole('button', { name: 'Container ref exclusion', exact: true }).click()
  await page.getByRole('button', { name: 'Setting container exclusion', exact: true }).click()
  await expect(sidebar(page, 'sidebar-primary')).toHaveCount(1)
  expect(await events(page)).toEqual([])
  await page.getByTestId('outside-sidebar').click()
  await expect(sidebar(page, 'sidebar-primary')).toHaveCount(0)
  expect(await events(page)).toContainEqual({ kind: 'primary-close', id: 'sidebar-primary', open: true, width: '500px' })
})

test('legacy contract: Escape closes SideBar with callback snapshots only at viewport widths of at least 1000', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 })
  await page.goto(fixtureUrl('surface=sidebar-consumers&mode=light'))
  await page.getByRole('button', { name: 'Open primary sidebar', exact: true }).click()
  await expect.poll(() => inlineWidth(sidebar(page, 'sidebar-primary'))).toBe('500px')
  await page.keyboard.press('Escape')
  await expect(sidebar(page, 'sidebar-primary')).toHaveCount(0)
  expect(await events(page)).toEqual([
    { kind: 'primary-close', id: 'sidebar-primary', open: true, width: '500px' },
    { kind: 'primary-wizard-close', id: 'sidebar-primary', open: true, width: '500px' }
  ])

  await page.setViewportSize({ width: 900, height: 700 })
  await page.goto(fixtureUrl('surface=sidebar-consumers&mode=light'))
  await page.getByRole('button', { name: 'Open primary sidebar', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(sidebar(page, 'sidebar-primary')).toHaveCount(1)
  expect(await events(page)).toEqual([])
})

test('legacy contract: populated Confirm callbacks stay independent above SideBar', async ({ page }) => {
  await page.goto(fixtureUrl('surface=sidebar-consumers&mode=light'))
  await page.getByRole('button', { name: 'Open primary sidebar', exact: true }).click()
  await sidebar(page, 'sidebar-primary').getByRole('button', { name: 'Open sidebar confirmation', exact: true }).click()
  const confirm = page.getByRole('alertdialog', { name: 'Sidebar confirmation', exact: true })
  await expect(confirm.getByText('The populated sidebar remains mounted below this confirmation.', { exact: true })).toBeVisible()
  await confirm.getByRole('button', { name: 'Accept sidebar confirmation', exact: true }).click()
  await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: 'Cancel sidebar confirmation', exact: true }).click()
  await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(confirm).not.toBeVisible()
  expect((await events(page)).map(event => event.kind)).toEqual(['confirm-accept', 'confirm-cancel', 'confirm-close'])
})

// Shared/MoreSidebarLayout was deleted as dead code; its two legacy-contract tests and the More-close assertions of the 44px test (2 tests -> 0) went with it.
for (const mode of ['light', 'dark']) {
  test(`C3 target: named Lucide SideBar actions expose 44px canonical focus in ${mode}`, async ({ page }) => {
    await page.goto(fixtureUrl(`surface=sidebar-consumers&mode=${mode}`))
    await page.getByRole('button', { name: 'Open primary sidebar', exact: true }).click()
    const primary = sidebar(page, 'sidebar-primary')
    const expand = primary.getByRole('button', { name: 'Click to expand', exact: true })
    const close = primary.getByRole('button', { name: 'Close', exact: true })
    for (const action of [expand, close]) {
      const box = await action.boundingBox()
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
      await expect(action.locator('svg.lucide')).toHaveCount(1)
      await action.focus()
      await page.keyboard.press('Tab')
      await page.keyboard.press('Shift+Tab')
      await expect(action).toHaveCSS('outline-width', '2px')
      await expect(action).toHaveCSS('outline-color', rgb(tokens.theme[mode].semantic.action.focus))
      expect(contrast(await action.evaluate(element => getComputedStyle(element).outlineColor), await effectiveBackground(action))).toBeGreaterThanOrEqual(3)
    }
    await expand.click()
    await expect(primary.getByRole('button', { name: 'Collapse', exact: true })).toBeVisible()
    await primary.getByRole('button', { name: 'Close', exact: true }).click()
  })
}

test('C3 target: Escape dismisses only the top visible SideBar when two are open', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 })
  await page.goto(fixtureUrl('surface=sidebar-consumers&mode=light'))
  await page.getByRole('button', { name: 'Open two sidebars', exact: true }).click()
  await expect(sidebar(page, 'sidebar-layer-one')).toHaveCount(1)
  await expect(sidebar(page, 'sidebar-layer-two')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(sidebar(page, 'sidebar-layer-two')).toHaveCount(0)
  await expect(sidebar(page, 'sidebar-layer-one')).toHaveCount(1)
  expect((await events(page)).map(event => event.kind)).toEqual(['layer-two-close'])
})

test('C3 target: Escape dismisses a Modal above SideBar without closing the lower layer', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 })
  await page.goto(fixtureUrl('surface=sidebar-consumers&mode=light'))
  await page.getByRole('button', { name: 'Open sidebar and modal', exact: true }).click()
  const modal = page.getByRole('dialog', { name: 'Modal above sidebar', exact: true })
  await expect(modal).toBeVisible()
  await expect(sidebar(page, 'sidebar-modal-parent')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(modal).not.toBeVisible()
  await expect(sidebar(page, 'sidebar-modal-parent')).toHaveCount(1)
  expect((await events(page)).map(event => event.kind)).toEqual(['modal-layer-close'])
})

test('C3 target: a newly mounted open SideBar handles desktop Escape after its width resolves', async ({ page }) => {
  await page.goto(fixtureUrl('surface=sidebar-consumers&mode=light'))
  await page.getByRole('button', { name: 'Mount primary open', exact: true }).click()
  await expect.poll(() => inlineWidth(sidebar(page, 'sidebar-primary'))).toBe('500px')
  await page.keyboard.press('Escape')
  await expect(sidebar(page, 'sidebar-primary')).toHaveCount(0)
})

test('C3 target: modal interaction does not close the underlying outside-close SideBar', async ({ page }) => {
  await page.goto(fixtureUrl('surface=sidebar-consumers&mode=light'))
  await page.getByRole('button', { name: 'Open sidebar and modal', exact: true }).click()
  const modal = page.getByRole('dialog', { name: 'Modal above sidebar', exact: true })
  await expect(modal).toBeVisible()
  await modal.getByRole('textbox').click()
  await expect(sidebar(page, 'sidebar-modal-parent')).toHaveCount(1)
  await expect(modal).toBeVisible()
  expect(await events(page)).toEqual([])
})

test('C3 target: one Escape keeps its original layer owner during a synchronous unmount', async ({ page }) => {
  await page.goto(fixtureUrl('surface=sidebar-consumers&mode=light&syncClose=true'))
  await page.getByRole('button', { name: 'Open upper sidebar first', exact: true }).click()
  await expect.poll(() => inlineWidth(sidebar(page, 'sidebar-layer-two'))).toBe('500px')
  await page.getByRole('button', { name: 'Open lower sidebar second', exact: true }).click()
  await expect.poll(() => inlineWidth(sidebar(page, 'sidebar-layer-one'))).toBe('500px')
  await page.keyboard.press('Escape')
  await expect(sidebar(page, 'sidebar-layer-two')).toHaveCount(0)
  await expect(sidebar(page, 'sidebar-layer-one')).toHaveCount(1)
  expect((await events(page)).map(event => event.kind)).toEqual(['layer-two-close'])
})

test('C3 target: closing a Modal does not transfer its click to the underlying SideBar', async ({ page }) => {
  await page.goto(fixtureUrl('surface=sidebar-consumers&mode=light'))
  await page.getByRole('button', { name: 'Open sidebar and modal', exact: true }).click()
  const modal = page.getByRole('dialog', { name: 'Modal above sidebar', exact: true })
  await expect(modal).toBeVisible()
  await modal.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(modal).not.toBeVisible()
  await expect(sidebar(page, 'sidebar-modal-parent')).toHaveCount(1)
  expect((await events(page)).map(event => event.kind)).toEqual(['modal-layer-close'])
})

test('C3 target: sidebar actions use all twelve catalog locales and retain RTL placement', async ({ page }) => {
  for (const locale of [localeConfig.sourceLanguage, ...localeConfig.supportedLocales]) {
    await page.goto(fixtureUrl(`surface=sidebar-consumers&mode=light&locale=${locale}&rtl=${locale === 'ar'}`))
    await page.getByRole('button', { name: 'Open primary sidebar', exact: true }).click()
    const primary = sidebar(page, 'sidebar-primary')
    await expect(primary).toHaveCSS('width', '500px')
    const bounds = await primary.boundingBox()
    if (locale === 'ar') expect(bounds.x).toBe(0)
    else expect(bounds.x + bounds.width).toBe(await page.evaluate(() => innerWidth))
    await primary.getByRole('button', { name: translations.CLICK_TO_EXPAND[locale], exact: true }).click()
    await expect(primary.getByRole('button', { name: translations.COLLAPSE[locale], exact: true })).toBeVisible()
    await primary.getByRole('button', { name: translations.CLOSE[locale], exact: true }).click()
    await expect(primary).toHaveCount(0)
  }
})
