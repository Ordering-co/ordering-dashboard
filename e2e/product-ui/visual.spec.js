// Assert the gallery renders and remains interactive across theme, direction and viewport.
import { expect, test } from '@playwright/test'

const GALLERY = '/scripts/product-ui/gallery.html'
const SECTIONS = ['buttons', 'status', 'avatar', 'checkbox', 'feedback', 'tabs', 'menu', 'table', 'table-compact', 'table-loading', 'table-empty', 'columns', 'filterbar', 'filterbar-active', 'notice', 'route', 'timeline', 'split', 'overlays', 'fa-overflow', 'fa-onerow', 'route-dated', 'select', 'selectable-list']
const DARK = ['buttons', 'status', 'table', 'filterbar-active', 'notice', 'route', 'timeline', 'split', 'fa-overflow', 'select']
const RTL = ['status', 'table', 'filterbar-active', 'route', 'timeline', 'split', 'fa-overflow', 'route-dated', 'select', 'selectable-list']

const checkSection = async (page, section, { theme = 'light', dir = 'ltr', coarse = false } = {}) => {
  const query = new URLSearchParams({ section, theme, dir })
  await page.goto(`${GALLERY}?${query}`)
  const node = page.getByTestId(`section-${section}`)
  await expect(node).toBeVisible()
  await expect(node.getByRole('heading').first()).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-od-theme', theme)
  await expect(page.locator('html')).toHaveAttribute('dir', dir)
  if (coarse) expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
}

test.use({ viewport: { width: 1280, height: 900 } })

for (const section of SECTIONS) {
  test(`light · ${section}`, async ({ page }) => checkSection(page, section))
}
for (const section of DARK) {
  test(`dark · ${section}`, async ({ page }) => checkSection(page, section, { theme: 'dark' }))
}
for (const section of RTL) {
  test(`rtl · ${section}`, async ({ page }) => checkSection(page, section, { dir: 'rtl' }))
}

test('open popups and dialogs', async ({ page }) => {
  await page.goto(`${GALLERY}?section=overlays`)
  await page.getByTestId('open-confirm').click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('alertdialog')).toBeHidden()
  await page.getByTestId('open-sheet').click()
  await expect(page.getByRole('dialog', { name: 'Filters' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Filters' })).toBeHidden()
  await page.goto(`${GALLERY}?section=menu`)
  await page.getByRole('button', { name: 'More actions' }).click()
  await expect(page.getByRole('menu')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toBeHidden()
  await page.goto(`${GALLERY}?section=menu-radio`)
  await page.getByRole('button', { name: 'SLA' }).click()
  await expect(page.getByRole('menu')).toBeVisible()
  await expect(page.getByRole('menuitemradio', { checked: true })).toBeVisible()
})

test('open select', async ({ page }) => {
  await page.goto(`${GALLERY}?section=select`)
  await page.getByRole('combobox', { name: /^Site/ }).click()
  await expect(page.getByRole('listbox', { name: 'Site' })).toBeVisible()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('option', { name: 'All', exact: true })).toBeFocused()
  await expect(page.getByRole('option', { name: 'All', exact: true })).toHaveAttribute('aria-selected', 'true')
})

test.describe('mobile, coarse pointer', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  for (const section of ['buttons', 'filterbar-active', 'route', 'fa-overflow', 'select', 'selectable-list']) {
    test(`mobile · ${section}`, async ({ page }) => checkSection(page, section, { coarse: true }))
  }
})
