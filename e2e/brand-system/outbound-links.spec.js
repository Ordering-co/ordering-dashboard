import { test, expect, fixtureUrl } from './fixtures'
import { tokens } from '../../src/brand/ordering.tokens.generated'

const typeformUrl = 'https://orderingco.typeform.com/to/qHPQtU'
const rgb = hex => `rgb(${hex.slice(1).match(/../g).map(part => parseInt(part, 16)).join(', ')})`
const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number)
  .map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
const contrast = (first, second) => {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a)
  return (values[0] + 0.05) / (values[1] + 0.05)
}
const effectiveColors = locator => locator.evaluate(element => {
  let current = element
  let background = getComputedStyle(current).backgroundColor
  while (current.parentElement && ['transparent', 'rgba(0, 0, 0, 0)'].includes(background)) {
    current = current.parentElement
    background = getComputedStyle(current).backgroundColor
  }
  return { background, foreground: getComputedStyle(element).color }
})
const focusByKeyboard = async (page, target) => {
  for (let index = 0; index < 30 && !await target.evaluate(element => element === document.activeElement); index += 1) await page.keyboard.press('Tab')
  await expect(target).toBeFocused()
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    globalThis.__OD_OUTBOUND_OPEN_CALLS__ = []
    window.open = (...args) => {
      globalThis.__OD_OUTBOUND_OPEN_CALLS__.push(args)
      return { closed: false, focus: () => {} }
    }
  })
})

test('Personalization preserves title flag, tenant image, exact Typeform link and window.open arguments', async ({ page }) => {
  await page.goto(fixtureUrl('surface=outbound-links&mode=light'))
  const titled = page.getByTestId('personalization-title')
  const untitled = page.getByTestId('personalization-no-title')
  await expect(titled.getByRole('heading', { name: 'Personalization', exact: true })).toHaveCount(1)
  await expect(untitled.getByRole('heading', { name: 'Personalization', exact: true })).toHaveCount(0)
  for (const scope of [titled, untitled]) {
    const link = scope.getByRole('link', { name: 'send us your special wish.', exact: true })
    await expect(link).toHaveAttribute('href', typeformUrl)
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    await expect(scope.locator('img')).toHaveAttribute('src', process.env.BRAND_HARNESS_PRODUCTION === '1' ? /^\/pilot\/assets\/personalization-[^/]+\.svg$/ : '/src/assets/images/personalization.svg')
  }
  await titled.getByRole('button', { name: 'Contact us', exact: true }).click()
  expect(await page.evaluate(() => globalThis.__OD_OUTBOUND_OPEN_CALLS__)).toEqual([[typeformUrl, '_blank', 'noopener,noreferrer']])
  await expect(page.getByTestId('personalization-submits')).toHaveText('1')
})

test('LinkableText preserves bare URL, email, HTTPS punctuation and literal named-window targets', async ({ page }) => {
  await page.goto(fixtureUrl('surface=outbound-links&mode=light'))
  const bare = page.getByTestId('link-bare').getByRole('link')
  const email = page.getByTestId('link-email').getByRole('link')
  const secure = page.getByTestId('link-https-punctuation').getByRole('link')
  await expect(bare).toHaveText('docs.ordering.co/guides')
  await expect(bare).toHaveAttribute('href', 'http://docs.ordering.co/guides')
  await expect(email).toHaveText('fixture.person@example.com')
  await expect(email).toHaveAttribute('href', 'mailto:fixture.person@example.com')
  await expect(secure).toHaveText('https://example.com/path?q=one')
  await expect(secure).toHaveAttribute('href', 'https://example.com/path?q=one')
  await expect(page.getByTestId('link-https-punctuation')).toHaveText('Read (https://example.com/path?q=one), then continue.')
  for (const link of [bare, email, secure]) {
    await expect(link).toHaveAttribute('target', 'blank')
    await expect(link).not.toHaveAttribute('rel', /.+/)
  }
})

test('LinkableText renders raw markup as text and safely preserves nested React text while linkifying descendants', async ({ page }) => {
  await page.goto(fixtureUrl('surface=outbound-links&mode=light'))
  const raw = page.getByTestId('link-raw-text')
  const nested = page.getByTestId('link-nested')
  await expect(raw).toHaveText('Raw <strong>customer content</strong> at example.net.')
  await expect(raw.locator('strong')).toHaveCount(0)
  await expect(raw.getByRole('link')).toHaveAttribute('href', 'http://example.net')
  await expect(nested.locator('strong')).toHaveText('label')
  await expect(nested.getByRole('link')).toHaveText('status.example.org/health')
  await expect(nested.getByRole('link')).toHaveAttribute('href', 'http://status.example.org/health')
  await expect(nested.getByRole('link')).toHaveAttribute('target', 'blank')
})

for (const mode of ['light', 'dark']) {
  test(`outbound links use readable ${mode} colors and canonical real-keyboard focus`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1100, height: 820 })
    await page.goto(fixtureUrl(`surface=outbound-links&mode=${mode}`))
    const personalization = page.getByTestId('personalization-title').locator('[data-slot="personalization"]')
    const typeform = personalization.locator('[data-outbound-link-slot="personalization-link"]')
    const contact = personalization.locator('[data-outbound-link-slot="contact-action"]')
    const generated = page.getByTestId('link-bare').locator('[data-outbound-link-slot="generated-link"]')
    await expect(personalization.locator('[data-outbound-link-slot="personalization-image"]')).toHaveAccessibleName('Personalization')
    await expect(contact).toHaveAttribute('type', 'submit')
    for (const link of [typeform, generated]) {
      const colors = await effectiveColors(link)
      expect.soft(contrast(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5)
      await expect(link).toHaveCSS('text-decoration-line', /underline/)
    }
    await page.evaluate(() => document.activeElement?.blur())
    for (const target of [typeform, contact]) {
      await focusByKeyboard(page, target)
      await expect(target).toHaveCSS('outline-color', rgb(tokens.theme[mode].semantic.action.focus))
      expect(parseFloat(await target.evaluate(element => getComputedStyle(element).outlineWidth))).toBeGreaterThanOrEqual(2)
    }
    await page.keyboard.press('Enter')
    expect(await page.evaluate(() => globalThis.__OD_OUTBOUND_OPEN_CALLS__)).toEqual([[typeformUrl, '_blank', 'noopener,noreferrer']])
    await expect(page.getByTestId('personalization-submits')).toHaveText('1')
    await focusByKeyboard(page, generated)
    await expect(generated).toHaveCSS('outline-color', rgb(tokens.theme[mode].semantic.action.focus))
    expect(parseFloat(await generated.evaluate(element => getComputedStyle(element).outlineWidth))).toBeGreaterThanOrEqual(2)
    await page.screenshot({ path: testInfo.outputPath(`outbound-links-${mode}.png`), fullPage: true })
  })
}

for (const width of [320, 390]) {
  test.describe(`outbound links at ${width}px coarse pointer`, () => {
    test.use({ viewport: { width, height: 760 }, hasTouch: true, isMobile: true })
    test('RTL tenant image and long generated links reflow with an unobstructed 44px contact action', async ({ page }, testInfo) => {
      await page.goto(fixtureUrl('surface=outbound-links&mode=dark&rtl=true&locale=ar'))
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      const titled = page.getByTestId('personalization-title')
      const image = titled.locator('[data-outbound-link-slot="personalization-image"]')
      const contact = titled.locator('[data-outbound-link-slot="contact-action"]')
      for (const target of [image, contact]) {
        const box = await target.boundingBox()
        expect.soft(box.x).toBeGreaterThanOrEqual(0)
        expect.soft(box.x + box.width).toBeLessThanOrEqual(width)
      }
      const contactBox = await contact.boundingBox()
      expect(contactBox.width).toBeGreaterThanOrEqual(44)
      expect(contactBox.height).toBeGreaterThanOrEqual(44)
      await expect(page.getByTestId('link-short').getByRole('link', { name: 'g.co', exact: true })).toBeVisible()
      for (const link of await page.locator('[data-outbound-link-slot="personalization-link"], [data-outbound-link-slot="generated-link"]').all()) {
        const linkBox = await link.boundingBox()
        expect.soft(linkBox.height).toBeGreaterThanOrEqual(44)
        expect.soft(linkBox.width).toBeGreaterThanOrEqual(44)
      }
      await page.screenshot({ path: testInfo.outputPath(`outbound-links-${width}-before.png`) })
      const longCase = page.getByTestId('link-long')
      await longCase.scrollIntoViewIfNeeded()
      const longLink = longCase.locator('[data-outbound-link-slot="generated-link"]')
      const longBox = await longLink.boundingBox()
      expect(longBox.x).toBeGreaterThanOrEqual(0)
      expect(longBox.x + longBox.width).toBeLessThanOrEqual(width)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      await contact.scrollIntoViewIfNeeded()
      const touchBox = await contact.boundingBox()
      await page.touchscreen.tap(touchBox.x + touchBox.width / 2, touchBox.y + touchBox.height / 2)
      expect(await page.evaluate(() => globalThis.__OD_OUTBOUND_OPEN_CALLS__)).toEqual([[typeformUrl, '_blank', 'noopener,noreferrer']])
      await page.screenshot({ path: testInfo.outputPath(`outbound-links-${width}-after.png`) })
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
    })
  })
}
