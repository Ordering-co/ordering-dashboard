import { test, expect, fixtureUrl } from './fixtures'
import translations from '../../i18n/translations.json'
import localeConfig from '../../i18n/config.json'
import { tokens } from '../../src/brand/ordering.tokens.generated'

const rgb = hex => `rgb(${hex.slice(1).match(/../g).map(part => parseInt(part, 16)).join(', ')})`

const paginationControls = async page => {
  const scope = page.getByTestId('pagination-button-consumer')
  const pagination = scope.locator('[data-slot="compact-pagination"]')
  await expect(pagination).toHaveCount(1)
  const buttons = pagination.locator('button')
  await expect(buttons).toHaveCount(2)
  const namedPrevious = pagination.getByRole('button', { name: 'Previous page', exact: true })
  const namedNext = pagination.getByRole('button', { name: 'Next page', exact: true })
  return {
    previous: await namedPrevious.count() ? namedPrevious : buttons.nth(0),
    next: await namedNext.count() ? namedNext : buttons.nth(1)
  }
}

test('ChatBusinessesList preserves local pages and loads the final five businesses exactly once', async ({ page }) => {
  await page.goto(fixtureUrl('surface=pagination-button-consumer&mode=light'))
  let controls = await paginationControls(page)
  await expect(page.getByText('1-10 of 25', { exact: true })).toBeVisible()
  await expect(page.getByText('Fixture business 01', { exact: true })).toBeVisible()
  await expect(page.getByText('Fixture business 10', { exact: true })).toBeVisible()
  await expect(page.getByText('Fixture business 11', { exact: true })).toHaveCount(0)
  await expect(controls.previous).toBeDisabled()
  await expect(controls.next).toBeEnabled()

  await controls.next.click()
  await expect(page.getByText('11-20 of 25', { exact: true })).toBeVisible()
  await expect(page.getByText('Fixture business 11', { exact: true })).toBeVisible()
  await expect(page.getByText('Fixture business 20', { exact: true })).toBeVisible()
  await expect(page.getByTestId('pagination-load-more-calls')).toHaveText('0')

  controls = await paginationControls(page)
  await controls.next.click()
  await expect(page.getByTestId('pagination-load-more-calls')).toHaveText('1')
  await expect(page.getByTestId('pagination-loaded-count')).toHaveText('25')
  await expect(page.getByText('21-25 of 25', { exact: true })).toBeVisible()
  await expect(page.getByText('Fixture business 21', { exact: true })).toBeVisible()
  await expect(page.getByText('Fixture business 25', { exact: true })).toBeVisible()

  controls = await paginationControls(page)
  await expect(controls.next).toBeDisabled()
  await controls.previous.click()
  await expect(page.getByText('11-20 of 25', { exact: true })).toBeVisible()
  await expect(page.getByTestId('pagination-load-more-calls')).toHaveText('1')
})

for (const mode of ['light', 'dark']) {
  test(`ChatBusinessesList pagination remains keyboard-visible in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(fixtureUrl(`surface=pagination-button-consumer&mode=${mode}`))
    const { next } = await paginationControls(page)
    await expect(next).toHaveAccessibleName('Next page')
    await next.hover()
    await expect(next).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expect(next).toHaveCSS('color', rgb(tokens.theme[mode].semantic.text.default))
    await next.focus()
    await expect(next).toBeFocused()
    await expect(next).toHaveCSS('outline-width', '2px')
    await page.keyboard.press('Enter')
    await expect(page.getByText('11-20 of 25', { exact: true })).toBeVisible()
    await expect(page.getByText('Fixture business 11', { exact: true })).toBeVisible()
    await expect(page.getByText('Fixture business 01', { exact: true })).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath(`compact-pagination-${mode}.png`), fullPage: false })
  })
}

test.describe('ChatBusinessesList pagination at 320px RTL', () => {
  test.use({ viewport: { width: 320, height: 760 }, hasTouch: true, isMobile: true })

  test('keeps both page actions at 44px and the populated list free of page overflow', async ({ page }, testInfo) => {
    await page.goto(fixtureUrl('surface=pagination-button-consumer&mode=dark&rtl=true'))
    const controls = await paginationControls(page)
    for (const control of [controls.previous, controls.next]) {
      const box = await control.boundingBox()
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
    }
    await controls.next.click()
    await expect(page.getByText('11-20 of 25', { exact: true })).toBeVisible()
    await expect(page.getByText('Fixture business 11', { exact: true })).toBeVisible()
    await expect(page.getByText('Fixture business 01', { exact: true })).toHaveCount(0)
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('compact-pagination-rtl320.png'), fullPage: false })
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
    const geometry = await page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth, dir: document.documentElement.dir }))
    expect(geometry.dir).toBe('rtl')
    expect(geometry.scroll).toBeLessThanOrEqual(geometry.viewport)
  })
})

test('compact page actions expose their new accessible names in all twelve locales', async ({ page }) => {
  for (const locale of [localeConfig.sourceLanguage, ...localeConfig.supportedLocales]) {
    await page.goto(fixtureUrl(`surface=pagination-button-consumer&mode=light&locale=${locale}&rtl=${locale === 'ar'}`))
    await expect(page.getByRole('button', { name: translations.PREVIOUS_PAGE[locale] || 'Previous page', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: translations.NEXT_PAGE[locale] || 'Next page', exact: true })).toBeEnabled()
  }
})
