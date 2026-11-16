// redesign (K-1, R-4): P/Select in a real browser, in the gallery's «select» section. axe (light, dark, RTL; closed and
// open), the keyboard path (ArrowDown opens and enters the list, Enter picks, Escape and Tab leave), a visible focus ring, the popup
// inside the window and never narrower than its field, and on a 390×844 touch phone the 32px trigger with its 44px area.
//   pnpm ui:test:browser
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { expectTouchTarget } from '../touch-target'

const GALLERY = '/scripts/product-ui/gallery.html'

const open = async (page, query = '') => {
  const errors = []
  page.on('pageerror', error => errors.push(String(error)))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(`${GALLERY}?section=select${query}`)
  await page.getByTestId('section-select').waitFor()
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))))
  return errors
}

const seriousViolations = async page => {
  const { violations } = await new AxeBuilder({ page }).exclude('.g-section > h2').analyze()
  return violations
    .filter(violation => ['serious', 'critical'].includes(violation.impact))
    .map(violation => `${violation.id}: ${violation.nodes.map(node => node.target.join(' ')).join(' | ')}`)
}

const site = page => page.getByRole('combobox', { name: /^Site/ })

for (const [theme, dir] of [['light', 'ltr'], ['dark', 'ltr'], ['light', 'rtl']]) {
  test(`no console errors and no serious axe violations, closed and open (${theme}, ${dir})`, async ({ page }) => {
    const errors = await open(page, `&theme=${theme}&dir=${dir}`)
    expect(await seriousViolations(page)).toEqual([])
    await site(page).click()
    await expect(page.getByRole('listbox', { name: 'Site' })).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
    expect(errors).toEqual([])
  })
}

test('the trigger is named by its label and value, and its hint describes it', async ({ page }) => {
  await open(page)
  await expect(site(page)).toHaveAccessibleName('Site All')
  await expect(site(page)).toHaveAccessibleDescription('Where the order was placed')
  await expect(page.getByRole('combobox', { name: /^Payment method/ })).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByRole('combobox', { name: /^Business/ })).toBeDisabled()
})

test('keyboard: ArrowDown opens with the focus in the search, ArrowDown enters the list, Enter picks and gives the focus back', async ({ page }) => {
  await open(page)
  await site(page).focus()
  await page.keyboard.press('ArrowDown')
  const search = page.getByRole('searchbox', { name: 'Search Site' })
  await expect(search).toBeFocused()
  await page.keyboard.type('ios')
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('option', { name: 'iOS app' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(site(page)).toBeFocused()
  await expect(site(page)).toHaveAccessibleName('Site iOS app')
})

test('keyboard: Escape closes only the list; Tab from the list goes on to the next field', async ({ page }) => {
  await open(page)
  await site(page).click()
  await expect(page.getByRole('listbox', { name: 'Site' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(site(page)).toBeFocused()
  const recipient = page.getByRole('combobox', { name: /^Recipient/ })
  await recipient.click()
  await expect(page.getByRole('option', { name: 'Business' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: /^Payment method/ })).toBeFocused()
})

test('the focus ring is visible on the trigger and on an option', async ({ page }) => {
  await open(page)
  await site(page).focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  const ring = locator => locator.evaluate(node => getComputedStyle(node).outlineStyle)
  expect(await ring(site(page))).not.toBe('none')
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('searchbox', { name: 'Search Site' })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  const all = page.getByRole('option', { name: 'All', exact: true })
  await expect(all).toBeFocused()
  expect(await ring(all)).not.toBe('none')
})

test('the popup is never narrower than its field and stays inside the window', async ({ page }) => {
  await open(page)
  await site(page).click()
  const popup = page.getByRole('dialog', { name: 'Site' })
  await expect(popup).toBeVisible()
  const field = await site(page).boundingBox()
  const box = await popup.boundingBox()
  const viewport = page.viewportSize()
  expect(box.width).toBeGreaterThanOrEqual(field.width - 1)
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
})

test('a remote list keeps its pager in the footer: page 2 shows the next stores and a pick closes it', async ({ page }) => {
  await open(page)
  const store = page.getByRole('combobox', { name: /^Store/ })
  await store.click()
  await expect(page.getByRole('option', { name: 'Store 01' })).toBeVisible()
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.getByRole('option', { name: 'Store 09' })).toBeVisible()
  await page.getByRole('option', { name: 'Store 10' }).click()
  await expect(store).toHaveAccessibleName('Store Store 10')
})

test.describe('touch phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  test('the trigger is 32px visible with a 44px area, and every option row is 44px', async ({ page }) => {
    await open(page)
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
    expect(Math.round((await site(page).boundingBox()).height)).toBe(32)
    await expectTouchTarget(site(page), { label: 'Site' })
    await site(page).tap()
    const rows = page.getByRole('option')
    await expect(rows.first()).toBeVisible()
    for (const height of await rows.evaluateAll(nodes => nodes.slice(0, 6).map(node => Math.round(node.getBoundingClientRect().height)))) {
      expect(height).toBeGreaterThanOrEqual(44)
    }
    const box = await page.getByRole('dialog', { name: 'Site' }).boundingBox()
    expect(box.x + box.width).toBeLessThanOrEqual(390)
  })
})
