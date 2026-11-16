import { test, expect, fixtureUrl } from './fixtures'
import { tokens } from '../../src/brand/ordering.tokens.generated'

const crop = (page, kind) => page.getByTestId(`crop-${kind}`)
const cropperImage = scope => scope.locator('.cropper-canvas img')
const cropRatio = scope => scope.locator('.cropper-crop-box').evaluate(element => {
  const box = element.getBoundingClientRect()
  return box.width / box.height
})
const cropEvents = async page => JSON.parse(await page.getByTestId('crop-events').textContent())
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
  for (let index = 0; index < 80 && !await target.evaluate(element => element === document.activeElement); index += 1) await page.keyboard.press('Tab')
  await expect(target).toBeFocused()
}

test('Image preserves source, fallback, second-error removal, literal fallback and ref chains', async ({ page }) => {
  await page.goto(fixtureUrl('surface=media&mode=light'))
  await expect(page.getByTestId('image-valid').getByAltText('profile-image')).toHaveAttribute('src', /^data:image\/svg\+xml;base64,/)
  await expect(page.getByTestId('image-react-fallback-no-src')).toHaveText('Fallback without source')
  await expect(page.getByTestId('image-string-fallback').getByAltText('profile-image')).toHaveAttribute('src', /^data:image\/svg\+xml;base64,/)
  await expect(page.getByTestId('image-string-remove').locator('.fixture-removed')).toHaveCount(1)
  await expect(page.getByTestId('image-string-remove').locator('img')).toHaveCount(0)
  await expect(page.getByTestId('image-react-fallback').locator('.fixture-react-fallback')).toContainText('React fallback after error')
  await expect(page.getByTestId('image-string-no-src')).toHaveText('literal-fallback-value')

  await page.getByRole('button', { name: 'Supply valid source after error', exact: true }).click()
  await expect(page.getByTestId('image-error-reset')).toContainText('Error state remains')
  await expect(page.getByTestId('image-error-reset').locator('img')).toHaveCount(0)
  await page.getByRole('button', { name: 'Read image refs', exact: true }).click()
  await expect(page.getByTestId('image-ref-state')).toHaveText(JSON.stringify({ fallback: 'IMG', reactFallback: 'DIV', removed: 'DIV', valid: 'IMG' }))
})

test('real CropperJS preserves scale, 45-degree rotation and 18/9 aspect toggle with restore', async ({ page }) => {
  await page.goto(fixtureUrl('surface=media&mode=light'))
  const jpeg = crop(page, 'local-jpeg')
  await expect(jpeg.locator('.cropper-container')).toBeVisible()
  const range = jpeg.locator('input[type="range"]')
  await expect(range).toHaveValue('50')
  await range.fill('25')
  await expect(jpeg.getByText('50 %', { exact: true })).toBeVisible()
  await expect.poll(() => cropperImage(jpeg).evaluate(element => element.style.transform)).toContain('scaleX(0.5)')
  await jpeg.getByRole('button', { name: 'Rotate', exact: true }).click()
  await expect.poll(() => cropperImage(jpeg).evaluate(element => element.style.transform)).toContain('rotate(45deg)')

  const aspect = jpeg.getByRole('checkbox', { name: 'Use web aspect ratio', exact: true })
  await expect.poll(() => cropRatio(jpeg)).toBeCloseTo(4 / 3, 1)
  await aspect.check()
  await expect.poll(() => cropRatio(jpeg)).toBeCloseTo(2, 1)
  await aspect.uncheck()
  await expect.poll(() => cropRatio(jpeg)).toBeCloseTo(4 / 3, 1)
})

test('local crop preserves JPEG/WebP/PNG MIME, quality, canvas limits and callback order', async ({ page }) => {
  await page.addInitScript(() => {
    const nativeToDataURL = HTMLCanvasElement.prototype.toDataURL
    globalThis.__OD_CANVAS_EXPORTS__ = []
    HTMLCanvasElement.prototype.toDataURL = function (type, quality) {
      globalThis.__OD_CANVAS_EXPORTS__.push({ height: this.height, quality, type, width: this.width })
      return nativeToDataURL.call(this, type, quality)
    }
  })
  await page.goto(fixtureUrl('surface=media&mode=light'))
  await expect(crop(page, 'local-jpeg').locator('.cropper-container')).toBeVisible()
  await page.evaluate(() => { globalThis.__OD_CANVAS_EXPORTS__ = [] })
  for (const kind of ['local-jpeg', 'local-webp', 'local-png']) await crop(page, kind).getByRole('button', { name: 'Crop', exact: true }).click()
  await expect.poll(async () => (await cropEvents(page)).length).toBe(6)
  expect((await cropEvents(page)).map(event => [event.kind, event.action])).toEqual([
    ['local-jpeg', 'change'], ['local-jpeg', 'close'],
    ['local-webp', 'change'], ['local-webp', 'close'],
    ['local-png', 'change'], ['local-png', 'close']
  ])
  const results = await page.evaluate(() => globalThis.__OD_MEDIA_RESULTS__)
  expect(results['local-jpeg']).toMatch(/^data:image\/jpeg;base64,/)
  expect(results['local-webp']).toMatch(/^data:image\/webp;base64,/)
  expect(results['local-png']).toMatch(/^data:image\/png;base64,/)
  const exports = await page.evaluate(() => globalThis.__OD_CANVAS_EXPORTS__)
  expect(exports).toHaveLength(3)
  expect(exports.map(value => value.type)).toEqual(['image/jpeg', 'image/webp', 'image/png'])
  for (const value of exports) {
    expect(value.quality).toBe(0.92)
    expect(value.width).toBeLessThanOrEqual(1920)
    expect(value.height).toBeLessThanOrEqual(1080)
  }
})

test('synthetic gallery success preserves request, optimization and callbacks while API error stays open', async ({ page }) => {
  await page.goto(fixtureUrl('surface=media&mode=light'))
  const success = crop(page, 'cloud-success')
  const error = crop(page, 'cloud-error')
  await expect(success.locator('.cropper-container')).toBeVisible()
  await success.getByRole('button', { name: 'Crop', exact: true }).click()
  await expect.poll(async () => (await cropEvents(page)).filter(event => event.kind === 'cloud-success').length).toBe(2)
  let service = await page.evaluate(() => globalThis.__OD_MEDIA_SERVICE__)
  expect(service.requests[0]).toMatchObject({
    authorization: 'Bearer fixture-media-token',
    method: 'POST',
    pathname: '/__brand-fixture__/media/themes/1/gallery',
    body: { type: 'image', file: expect.stringMatching(/^data:image\/jpeg;base64,/) }
  })
  expect(service.optimizeCalls).toEqual([{ value: expect.stringMatching(/^data:image\/jpeg;base64,/), options: 'f_auto,q_auto,w_2000,c_limit' }])

  const eventCount = (await cropEvents(page)).length
  await error.getByRole('button', { name: 'Crop', exact: true }).click()
  await expect.poll(async () => (await page.evaluate(() => globalThis.__OD_MEDIA_SERVICE__)).requests.length).toBe(2)
  service = await page.evaluate(() => globalThis.__OD_MEDIA_SERVICE__)
  expect(service.requests[1].pathname).toBe('/__brand-fixture__/media/themes/2/gallery')
  expect(await cropEvents(page)).toHaveLength(eventCount)
  await expect(error.getByRole('button', { name: 'Crop', exact: true })).toBeEnabled()
})

for (const mode of ['light', 'dark']) {
  test(`media controls use readable ${mode} roles, governed colors and real keyboard focus`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(fixtureUrl(`surface=media&mode=${mode}`))
    const jpeg = crop(page, 'local-jpeg')
    await expect(jpeg.locator('.cropper-container')).toBeVisible()
    const semantic = tokens.theme[mode].semantic
    const range = jpeg.getByRole('slider', { name: 'Resize image', exact: true })
    const rotate = jpeg.getByRole('button', { name: 'Rotate', exact: true })
    const cropButton = jpeg.getByRole('button', { name: 'Crop', exact: true })
    for (const target of [jpeg.getByText('Resize image', { exact: true }), jpeg.getByText('100 %', { exact: true })]) {
      const colors = await effectiveColors(target)
      expect.soft(contrast(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5)
    }
    await page.evaluate(() => document.activeElement?.blur())
    for (const target of [range, rotate, cropButton]) {
      await focusByKeyboard(page, target)
      await expect(target).toHaveCSS('outline-color', rgb(semantic.action.focus))
      expect(parseFloat(await target.evaluate(element => getComputedStyle(element).outlineWidth))).toBeGreaterThanOrEqual(2)
    }
    await page.screenshot({ path: testInfo.outputPath(`media-${mode}.png`), fullPage: true })
  })
}

for (const width of [320, 390]) {
  test.describe(`media at ${width}px coarse pointer`, () => {
    test.use({ viewport: { width, height: 800 }, hasTouch: true, isMobile: true })
    test('RTL crop canvas and actions stay inside real viewport bounds with 44px targets', async ({ page }, testInfo) => {
      await page.goto(fixtureUrl('surface=media&mode=dark&rtl=true&locale=ar'))
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      const jpeg = crop(page, 'local-jpeg')
      await jpeg.scrollIntoViewIfNeeded()
      await page.screenshot({ path: testInfo.outputPath(`media-${width}-before.png`) })
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      for (const target of await jpeg.locator('.cropper-container, input:visible, button:visible').all()) {
        const box = await target.boundingBox()
        expect.soft(box.x).toBeGreaterThanOrEqual(0)
        expect.soft(box.x + box.width).toBeLessThanOrEqual(width)
      }
      for (const control of await jpeg.locator('input:visible, button:visible').all()) {
        const box = await control.boundingBox()
        expect.soft(box.width).toBeGreaterThanOrEqual(44)
        expect.soft(box.height).toBeGreaterThanOrEqual(44)
      }
      await jpeg.getByRole('slider', { name: /Resize image|Cambiar el tamaño de la imagen|تغيير حجم الصورة/ }).fill('75')
      await expect(jpeg.getByText('150 %', { exact: true })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      await page.screenshot({ path: testInfo.outputPath(`media-${width}-after.png`) })
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
    })
  })
}
