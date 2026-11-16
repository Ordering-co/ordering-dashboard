import { test, expect, fixtureUrl } from './fixtures'
import { tokens } from '../../src/brand/ordering.tokens.generated'
import localeConfig from '../../i18n/config.json'
import translations from '../../i18n/translations.json'

// The insertion dialogs (link, image, video) that Shared/RichHtmlEditor opens. The editor itself (Tiptap) is covered by
// its unit tests; this fixture mounts the dialogs on their own, so it checks their contract and their brand surfaces.
const directEvents = async (page, testId) => JSON.parse(await page.getByTestId(`${testId}-events`).textContent())
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
  for (let index = 0; index < 120 && !await target.evaluate(element => element === document.activeElement); index += 1) await page.keyboard.press('Tab')
  await expect(target).toBeFocused()
}

test('direct link and video dialogs preserve exact restore, invoke, default-window and inline-button payloads', async ({ page }) => {
  await page.goto(fixtureUrl('surface=html-editor&mode=light'))
  const link = page.getByTestId('insert-link-case')
  await link.getByLabel('Text to display', { exact: true }).fill('Ordering.co help')
  await link.getByLabel('Url', { exact: true }).fill('https://ordering.co/help')
  await expect(link.getByRole('checkbox', { name: 'Open in a new window', exact: true })).toBeChecked()
  await link.getByRole('button', { name: 'Insert', exact: true }).click()
  expect(await directEvents(page, 'insert-link-case')).toEqual([
    { kind: 'restore' },
    { kind: 'invoke', args: ['editor.createLink', { text: 'Ordering.co help', url: 'https://ordering.co/help', isNewWindow: true }] },
    { kind: 'close' }
  ])

  const buttonLink = page.getByTestId('insert-link-button-case')
  await buttonLink.getByLabel('Text to display', { exact: true }).fill('Buy now')
  await buttonLink.getByLabel('Url', { exact: true }).fill('/checkout')
  await buttonLink.getByRole('checkbox', { name: 'Open in a new window', exact: true }).uncheck()
  await buttonLink.getByRole('button', { name: 'Insert', exact: true }).click()
  expect(await directEvents(page, 'insert-link-button-case')).toEqual([
    { kind: 'restore' },
    {
      kind: 'invoke',
      args: ['editor.createLink', {
        text: "<button style='font-size: 9px;color: white;padding: 6px 11px; cursor: pointer; border-radius: 4px; background: #2C7BE5; border: none;'>Buy now</button>",
        url: '/checkout',
        isNewWindow: false
      }]
    },
    { kind: 'close' }
  ])

  const video = page.getByTestId('insert-video-case')
  await video.getByLabel('Video url', { exact: true }).fill('https://youtu.be/dQw4w9WgXcQ')
  await video.getByRole('button', { name: 'Insert', exact: true }).click()
  expect(await directEvents(page, 'insert-video-case')).toEqual([
    { kind: 'restore' },
    { kind: 'invoke', args: ['editor.pasteHTML', '<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>'] },
    { kind: 'close' }
  ])
})

test('direct image dialog preserves preview, selection bubble, insertion, deletion and file boundaries', async ({ page }) => {
  await page.goto(fixtureUrl('surface=html-editor&mode=light'))
  const image = page.getByTestId('insert-image-case')
  await expect(image.getByRole('group', { name: 'Insert image', exact: true })).toHaveAttribute('data-slot', 'editor-insert-image')
  await expect(image.getByRole('button', { name: 'Put your image here', exact: true })).toHaveAttribute('data-has-preview', '')
  await expect(image.getByAltText('Insert image', { exact: true })).toHaveAttribute('src', /^data:image\/svg\+xml;base64,/)
  await image.getByRole('button', { name: 'Insert image: 32', exact: true }).click()
  await expect(page.getByTestId('direct-selected-image')).toContainText('data:image/svg+xml;base64,')
  await image.getByRole('button', { name: 'Delete Insert image: 31', exact: true }).click()
  let confirm = page.getByRole('alertdialog').filter({ hasText: 'Are you sure that you want to delete this image?' })
  await expect(confirm).toBeVisible()
  expect((await directEvents(page, 'insert-image-case')).at(-1).kind).toBe('select-image')
  await confirm.getByRole('button', { name: 'Accept', exact: true }).click()
  expect((await directEvents(page, 'insert-image-case')).at(-1)).toEqual({ id: 31, kind: 'delete' })

  await image.getByLabel('Image URL', { exact: true }).fill('data:image/png;base64,fixture')
  await image.getByRole('button', { name: 'Insert', exact: true }).click()
  expect((await directEvents(page, 'insert-image-case')).slice(-3)).toEqual([
    { kind: 'restore' },
    { kind: 'invoke', args: ['editor.insertImage', 'data:image/png;base64,fixture'] },
    { kind: 'close' }
  ])

  const input = image.locator('input[type="file"]')
  await input.setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not image') })
  let alert = page.getByRole('alertdialog').filter({ hasText: 'Only images can be accepted' })
  await expect(alert).toBeVisible()
  await alert.getByRole('button', { name: 'Accept', exact: true }).click()
  await input.setInputFiles({ name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(2 * 1024 * 1024 + 1024) })
  alert = page.getByRole('alertdialog').filter({ hasText: 'The maximum image size is 2 megabytes' })
  await expect(alert).toBeVisible()
  await alert.getByRole('button', { name: 'Accept', exact: true }).click()

  await input.setInputFiles({ name: 'edge.png', mimeType: 'image/png', buffer: Buffer.alloc(2 * 1024 * 1024 + 1023) })
  confirm = page.getByRole('alertdialog').filter({ hasText: 'Are you sure that you want to add this gallery image?' })
  await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: 'Accept', exact: true }).click()
  expect((await directEvents(page, 'insert-image-case')).at(-1)).toEqual({ file: { name: 'edge.png', size: 2098175, type: 'image/png' }, kind: 'upload' })

  const eventCount = (await directEvents(page, 'insert-image-case')).length
  await input.evaluate(input => {
    const transfer = new DataTransfer()
    transfer.items.add(new File(['one'], 'one.png', { type: 'image/png' }))
    transfer.items.add(new File(['two'], 'two.png', { type: 'image/png' }))
    Object.defineProperty(input, 'files', { configurable: true, value: transfer.files })
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.waitForTimeout(50)
  expect(await directEvents(page, 'insert-image-case')).toHaveLength(eventCount)
})

for (const mode of ['light', 'dark']) {
  test(`insertion dialogs use readable ${mode} surfaces, keyboard focus and 44px actions`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(fixtureUrl(`surface=html-editor&mode=${mode}`))
    const semantic = tokens.theme[mode].semantic
    const link = page.getByTestId('insert-link-case')
    await expect(link).toBeVisible()
    await expect(link.getByLabel('Text to display')).toHaveCSS('border-color', rgb(semantic.border.default))
    for (const target of [link.getByLabel('Text to display'), page.getByTestId('insert-video-case').getByLabel('Video url')]) {
      const value = await effectiveColors(target)
      expect.soft(contrast(value.foreground, value.background)).toBeGreaterThanOrEqual(4.5)
    }
    await page.evaluate(() => document.activeElement?.blur())
    await focusByKeyboard(page, link.getByLabel('Text to display'))
    expect(parseFloat(await link.getByLabel('Text to display').evaluate(element => getComputedStyle(element).outlineWidth))).toBeGreaterThanOrEqual(2)
    for (const button of await page.getByTestId('html-editor-dialogs').locator('button:visible').all()) {
      const box = await button.boundingBox()
      expect.soft(box.width).toBeGreaterThanOrEqual(44)
      expect.soft(box.height).toBeGreaterThanOrEqual(44)
    }
    await page.screenshot({ path: testInfo.outputPath(`html-editor-${mode}.png`), fullPage: true })
  })
}

for (const width of [320, 390]) {
  test.describe(`Insertion dialogs at ${width}px coarse pointer`, () => {
    test.use({ viewport: { width, height: 800 }, hasTouch: true, isMobile: true })
    test('RTL link dialog stays within the viewport', async ({ page }, testInfo) => {
      await page.goto(fixtureUrl('surface=html-editor&mode=dark&locale=ar&rtl=true'))
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      const dialog = page.getByTestId('insert-link-case')
      await dialog.scrollIntoViewIfNeeded()
      for (const target of await dialog.locator('input:visible, button:visible').all()) {
        const box = await target.boundingBox()
        expect.soft(box.width).toBeGreaterThanOrEqual(44)
        expect.soft(box.height).toBeGreaterThanOrEqual(44)
        expect.soft(box.x).toBeGreaterThanOrEqual(0)
        expect.soft(box.x + box.width).toBeLessThanOrEqual(width)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      await page.screenshot({ path: testInfo.outputPath(`html-editor-${width}.png`) })
    })
  })
}

test('insertion dialogs render their labels in all twelve locales', async ({ page }) => {
  for (const locale of [localeConfig.sourceLanguage, ...localeConfig.supportedLocales]) {
    await page.goto(fixtureUrl(`surface=html-editor&mode=light&locale=${locale}&rtl=${locale === 'ar'}`))
    await expect(page.getByTestId('insert-link-case').getByRole('heading', { name: translations.INSERT_LINK[locale], exact: true })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
  }
})
