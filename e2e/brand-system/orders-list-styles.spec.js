import { test, expect, fixtureUrl } from './fixtures'
import { tokens } from '../../src/brand/ordering.tokens.generated'

const parseRgb = color => color.match(/[\d.]+/g).slice(0, 3).map(Number)
const luminance = color => parseRgb(color).map(value => value / 255)
  .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
const contrast = (foreground, background) => {
  const a = luminance(foreground)
  const b = luminance(background)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

const colors = locator => locator.evaluate(element => {
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
  for (const [role, value] of Object.entries(values)) {
    document.documentElement.style.setProperty(`--od-type-${role}-size`, value)
  }
}, sizes)

for (const mode of ['light', 'dark']) {
  test(`Orders list style owners use ${mode} roles, focus and readable operational states`, async ({ page }, testInfo) => {
    await page.goto(fixtureUrl(`surface=orders-list-styles&mode=${mode}`))
    const surface = page.getByTestId('orders-list-styles')
    await expect(surface).toBeVisible()

    const tabs = surface.getByRole('button', { name: /Pending|Completed/ })
    await expect(tabs).toHaveCount(2)
    await expect(tabs.first()).toHaveAttribute('aria-pressed', 'true')
    await expect(tabs.first()).toHaveCSS('font-size', tokens.font.size.productUi)
    await tabs.first().focus()
    await expect(tabs.first()).toHaveCSS('outline-width', tokens.component.focusRing.width)

    const tableContent = surface.locator('td').first()
    await expect(tableContent).toHaveCSS('font-size', tokens.font.size.productContent)
    const date = surface.getByTestId('websocket-date')
    await expect(date).toHaveCSS('font-size', tokens.font.size.productUi)
    expect(await date.evaluate(element => getComputedStyle(element).fontFamily)).toContain('JetBrains Mono')

    for (const text of ['Filters applied. You may miss new orders.', 'Two records require attention.', 'Receiving operational updates.']) {
      const value = await colors(surface.getByText(text, { exact: true }))
      expect(contrast(value.foreground, value.background), `${mode}: ${text}`).toBeGreaterThanOrEqual(4.5)
    }

    const selected = surface.getByRole('button', { name: 'Selected comment', exact: true })
    for (const state of ['rest', 'hover', 'active']) {
      if (state === 'rest') await tabs.last().hover()
      if (state === 'hover') await selected.hover()
      if (state === 'active') await page.mouse.down()
      const value = await colors(selected)
      expect(contrast(value.foreground, value.background), `${mode} selected comment ${state}`).toBeGreaterThanOrEqual(4.5)
      if (state === 'active') await page.mouse.up()
    }

    await surface.screenshot({ path: testInfo.outputPath(`orders-list-${mode}.png`) })
  })
}

test('central role changes propagate through every Orders list family and reflow open surfaces', async ({ page }) => {
  await page.goto(fixtureUrl('surface=orders-list-styles&mode=light'))
  const surface = page.getByTestId('orders-list-styles')
  const roles = [
    [surface.getByTestId('family-content-header'), '22px', '28px'],
    [surface.getByTestId('family-card').locator('h2'), tokens.font.size.productUi, '18px'],
    [surface.getByTestId('family-card').locator(':scope > div > p').first(), tokens.font.size.productContent, '19px'],
    [surface.getByRole('button', { name: 'View details', exact: true }), tokens.font.size.productUi, '17px'],
    [surface.getByText('Driver Alpha', { exact: true }), tokens.font.size.productContent, '18px'],
    [surface.getByText('Available now', { exact: true }), '12px', '16px'],
    [surface.getByTestId('family-notification').locator('h1'), '18px', '24px'],
    [surface.getByText('Pickup order', { exact: true }), '12px', '16px'],
    [surface.getByText('Export ready', { exact: true }), '22px', '28px'],
    // redesign W1-1 (T1-2): the lateral bar name block left with OrdersLateralBar; the panel header is P/Sheet now
    [surface.getByText('Review', { exact: true }), tokens.font.size.productContent, '19px']
  ]
  const families = await surface.locator('[data-testid^="family-"]').all()
  const before = await Promise.all(families.map(locator => locator.boundingBox()))

  for (const [locator, canonical] of roles) await expect(locator).toHaveCSS('font-size', canonical)

  await setRoleSizes(page, {
    control: '17px',
    'control-value': '18px',
    content: '19px',
    secondary: '16px',
    'section-title': '24px',
    title: '28px',
    identifier: '18px'
  })

  for (const [locator, , expanded] of roles) await expect(locator).toHaveCSS('font-size', expanded)
  const after = await Promise.all(families.map(locator => locator.boundingBox()))
  for (let index = 0; index < families.length; index += 1) {
    expect(after[index].height, `family ${index} keeps or grows its height`).toBeGreaterThanOrEqual(before[index].height)
    const overflow = await families[index].evaluate(element => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }))
    expect(overflow.scrollHeight, `family ${index} does not vertically clip`).toBeLessThanOrEqual(overflow.clientHeight + 1)
  }

  const viewDetails = await surface.getByRole('button', { name: 'View details', exact: true }).boundingBox()
  expect(viewDetails.width).toBeGreaterThanOrEqual(44)
  expect(viewDetails.height).toBeGreaterThanOrEqual(44)
})

test.describe('Orders list styles at 320px RTL coarse pointer', () => {
  test.use({ viewport: { width: 320, height: 760 }, hasTouch: true, isMobile: true })

  test('keeps actions, long text and the table reachable without document overflow', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(fixtureUrl('surface=orders-list-styles&mode=dark&rtl=true'))
    const surface = page.getByTestId('orders-list-styles')
    // `.all()` does not wait. The fixture is a lazy chunk, so in most runs the list was taken before it
    // mounted and no button was measured; the run that measured found «Pickup» at 25.5px. Measure the mounted surface.
    await expect(surface.getByRole('button', { name: 'Pickup' })).toBeVisible()
    const buttons = await surface.getByRole('button').all()
    expect(buttons.length).toBeGreaterThan(1)
    for (const button of buttons) {
      const box = await button.boundingBox()
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
    }
    const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)
    await surface.screenshot({ path: testInfo.outputPath('orders-list-dark-rtl-320.png') })
  })
})
