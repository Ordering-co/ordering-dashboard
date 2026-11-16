import { expect, fixtureUrl, test } from './fixtures'

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
  const foreground = getComputedStyle(element).color
  let current = element
  while (current) {
    const background = getComputedStyle(current).backgroundColor
    const values = background.match(/[\d.]+/g)?.map(Number) || []
    if (background !== 'transparent' && (values.length === 3 || values[3] > 0.99)) return { foreground, background }
    current = current.parentElement
  }
  return { foreground, background: 'rgb(255, 255, 255)' }
})
const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, value] of Object.entries(values)) document.documentElement.style.setProperty(`--od-type-${role}-size`, value)
}, sizes)

for (const mode of ['light', 'dark']) {
  test(`D1 detail surfaces use governed ${mode} roles, open actions and focus`, async ({ page }, testInfo) => {
    await page.goto(fixtureUrl(`surface=order-details-d1-styles&mode=${mode}`))
    const surface = page.getByTestId('order-details-d1-styles')
    await expect(surface).toBeVisible()

    await expect(surface.getByRole('heading', { name: /Order No/ })).toHaveCSS('font-size', '22px')
    await expect(surface.locator('.order-identifier')).toHaveCSS('font-size', '13px')
    await expect(surface.getByRole('heading', { name: 'Order status' })).toHaveCSS('font-size', '18px')
    await expect(surface.getByText('2026-09-15 10:30', { exact: true })).toHaveCSS('font-size', '14px')
    await expect(surface.getByRole('button', { name: 'Normal' })).toHaveCSS('font-size', '13px')
    await expect(surface.getByRole('button', { name: 'Clone full order' }).locator('span')).toHaveCSS('font-size', '13px')
    await expect(surface.getByRole('alert')).toHaveCSS('font-size', '12px')

    const options = surface.getByRole('button', { name: 'Options' })
    await options.focus()
    await expect(options).toHaveCSS('outline-width', '2px')
    for (const text of ['Card payment · Delivery', 'Order status', 'Please enter a valid domain']) {
      const colors = await effectiveColors(surface.getByText(text, { exact: true }))
      expect(contrast(colors.foreground, colors.background), `${mode}: ${text}`).toBeGreaterThanOrEqual(4.5)
    }

    await surface.screenshot({ path: testInfo.outputPath(`order-details-d1-${mode}.png`) })
  })
}

test('D1 central roles propagate through open detail families and reflow', async ({ page }) => {
  await page.goto(fixtureUrl('surface=order-details-d1-styles&mode=light'))
  const surface = page.getByTestId('order-details-d1-styles')
  const roles = [
    [surface.getByRole('heading', { name: /Order No/ }), '28px'],
    [surface.locator('.order-identifier'), '18px'],
    [surface.getByRole('heading', { name: 'Order status' }), '24px'],
    [surface.getByText('2026-09-15 10:30', { exact: true }), '19px'],
    [surface.getByRole('button', { name: 'Normal' }), '17px'],
    [surface.getByRole('button', { name: 'Clone full order' }).locator('span'), '17px'],
    [surface.getByRole('alert'), '16px']
  ]
  const families = await surface.locator('[data-testid$="surface"], [data-testid="details-header"], [data-testid="order-status"], [data-testid="open-actions"]').all()
  const before = await Promise.all(families.map(locator => locator.boundingBox()))

  await setRoleSizes(page, {
    control: '17px',
    'control-value': '18px',
    content: '19px',
    secondary: '16px',
    'section-title': '24px',
    title: '28px',
    identifier: '18px'
  })
  for (const [locator, size] of roles) await expect(locator).toHaveCSS('font-size', size)
  const after = await Promise.all(families.map(locator => locator.boundingBox()))
  for (let index = 0; index < families.length; index += 1) {
    expect(after[index].height).toBeGreaterThanOrEqual(before[index].height)
    const geometry = await families[index].evaluate(element => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }))
    expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.clientHeight + 1)
  }
})

test.describe('D1 detail at 320px RTL coarse pointer', () => {
  test.use({ viewport: { width: 320, height: 760 }, hasTouch: true, isMobile: true })

  test('mirrors progress and keeps open actions reachable without page overflow', async ({ page }, testInfo) => {
    await page.goto(fixtureUrl('surface=order-details-d1-styles&mode=dark&rtl=true'))
    const surface = page.getByTestId('order-details-d1-styles')
    const gradient = await surface.getByTestId('status-bar').evaluate(element => getComputedStyle(element).backgroundImage)
    expect(gradient).toContain('to left')
    for (const button of await surface.getByRole('button').all()) {
      const box = await button.boundingBox()
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
    }
    const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)
    await surface.screenshot({ path: testInfo.outputPath('order-details-d1-dark-rtl-320.png') })
  })
})
