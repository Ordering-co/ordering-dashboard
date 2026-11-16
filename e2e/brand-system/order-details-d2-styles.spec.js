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
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-type-${role}-size`)
}, roles)

for (const mode of ['light', 'dark']) {
  test(`D2 detail surfaces expose governed ${mode} typography, contrast and focus`, async ({ page }, testInfo) => {
    await page.goto(fixtureUrl(`surface=order-details-d2-styles&mode=${mode}`))
    const surface = page.getByTestId('order-details-d2-styles')
    await expect(surface).toBeVisible()

    await expect(surface.getByRole('button', { name: 'Order History' })).toHaveCSS('font-size', '13px')
    await expect(surface.getByRole('textbox', { name: 'Search' })).toHaveCSS('font-size', '14px')
    await expect(surface.getByText('Restaurant confirmed the long preparation note for the driver.')).toHaveCSS('font-size', '14px')
    await expect(surface.getByRole('cell', { name: 'Email' })).toHaveCSS('font-size', '12px')
    await expect(surface.getByText('Custom fields', { exact: true })).toHaveCSS('font-size', '18px')
    await expect(surface.getByText('Order 910001', { exact: true })).toHaveCSS('font-size', '14px')
    await expect(surface.locator('.order-identifier')).toHaveCSS('font-size', '13px')
    await expect(surface.locator('.order-identifier')).toHaveCSS('font-family', /JetBrains Mono/)

    const detail = surface.getByRole('button', { name: 'Order details' })
    await detail.focus()
    await expect(detail).toHaveCSS('outline-width', '2px')
    for (const text of ['Restaurant confirmed the long preparation note for the driver.', 'Distance from business: 1.6 km', 'Custom fields']) {
      const colors = await effectiveColors(surface.getByText(text, { exact: true }))
      expect(contrast(colors.foreground, colors.background), `${mode}: ${text}`).toBeGreaterThanOrEqual(4.5)
    }

    await surface.screenshot({ path: testInfo.outputPath(`order-details-d2-${mode}.png`) })
  })
}

test('D2 central roles propagate through all open detail families and restore canonically', async ({ page }, testInfo) => {
  await page.goto(fixtureUrl('surface=order-details-d2-styles&mode=light'))
  const surface = page.getByTestId('order-details-d2-styles')
  const roles = [
    [surface.getByRole('button', { name: 'Order History' }), '17px'],
    [surface.getByRole('textbox', { name: 'Search' }), '18px'],
    [surface.getByText('Restaurant confirmed the long preparation note for the driver.'), '19px'],
    [surface.getByRole('cell', { name: 'Email' }), '16px'],
    [surface.getByText('Custom fields', { exact: true }), '24px'],
    [surface.getByText('Order 910001', { exact: true }), '19px'],
    [surface.locator('.order-identifier'), '18px'],
    [surface.getByText('استخدم مدخل الخدمة بعد الساعة العاشرة مساءً', { exact: true }), '19px']
  ]
  const families = await surface.locator('[data-testid$="open"]').all()
  const before = await Promise.all(families.map(locator => locator.boundingBox()))

  await setRoleSizes(page, {
    control: '17px',
    'control-value': '18px',
    content: '19px',
    secondary: '16px',
    'section-title': '24px',
    identifier: '18px'
  })
  for (const [locator, size] of roles) await expect(locator).toHaveCSS('font-size', size)
  const after = await Promise.all(families.map(locator => locator.boundingBox()))
  for (let index = 0; index < families.length; index += 1) {
    expect(after[index].height).toBeGreaterThanOrEqual(before[index].height)
    const geometry = await families[index].evaluate(element => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }))
    expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.clientHeight + 1)
  }
  for (const button of await surface.getByRole('button').all()) {
    const box = await button.boundingBox()
    const name = await button.getAttribute('aria-label') || await button.textContent()
    expect(box.width, name).toBeGreaterThanOrEqual(44)
    expect(box.height, name).toBeGreaterThanOrEqual(44)
  }
  await surface.screenshot({ path: testInfo.outputPath('order-details-d2-propagated.png') })

  await restoreRoleSizes(page, ['control', 'control-value', 'content', 'secondary', 'section-title', 'identifier'])
  await expect(surface.getByRole('button', { name: 'Order History' })).toHaveCSS('font-size', '13px')
  await expect(surface.getByText('Restaurant confirmed the long preparation note for the driver.')).toHaveCSS('font-size', '14px')
})

test.describe('D2 detail at 320px RTL coarse pointer and reduced motion', () => {
  test.use({ viewport: { width: 320, height: 760 }, hasTouch: true, isMobile: true })

  test('reflows long operational data without clipping and keeps all actions reachable', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(fixtureUrl('surface=order-details-d2-styles&mode=dark&rtl=true'))
    const surface = page.getByTestId('order-details-d2-styles')
    for (const button of await surface.getByRole('button').all()) {
      const box = await button.boundingBox()
      const name = await button.getAttribute('aria-label') || await button.textContent()
      expect(box.width, name).toBeGreaterThanOrEqual(44)
      expect(box.height, name).toBeGreaterThanOrEqual(44)
    }
    const disclosure = surface.locator('.disclosure-button')
    await expect(disclosure.locator('.down-arrow')).toHaveCSS('transition-duration', '0s')
    await expect(surface.getByText('رقم الطلب 910001', { exact: true })).toHaveCSS('direction', 'rtl')
    await expect(surface.locator('.order-identifier')).toHaveCSS('direction', 'ltr')
    await expect(surface.getByText('استخدم مدخل الخدمة بعد الساعة العاشرة مساءً', { exact: true })).toHaveCSS('direction', 'rtl')
    for (const family of ['messages-open', 'contact-open', 'meta-open']) {
      const region = surface.getByTestId(family)
      const regionGeometry = await region.evaluate(element => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }))
      expect(regionGeometry.scrollWidth, family).toBeLessThanOrEqual(regionGeometry.clientWidth + 1)
    }
    for (const rowName of ['meta-existing', 'meta-add']) {
      const boxes = (await Promise.all((await surface.getByTestId(rowName).locator(':scope > div').all()).map(child => child.boundingBox()))).filter(Boolean)
      for (let index = 1; index < boxes.length; index += 1) expect(boxes[index].y, rowName).toBeGreaterThan(boxes[index - 1].y)
    }
    const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)
    await surface.screenshot({ path: testInfo.outputPath('order-details-d2-dark-rtl-320.png') })
  })
})
