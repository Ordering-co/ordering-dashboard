import { test, expect, fixtureUrl } from './fixtures'
import translations from '../../i18n/translations.json'
import config from '../../i18n/config.json'

test('pilot selection and confirmation retain the twelve catalog locales', async ({ page }) => {
  // fila 48: twelve full page loads in one test (one per locale); 30s ran out on a loaded machine
  test.setTimeout(90000)
  await page.setViewportSize({ width: 390, height: 900 })
  const locales = [config.sourceLanguage, ...config.supportedLocales]
  expect(locales).toHaveLength(12)
  for (const locale of locales) {
    await page.goto(fixtureUrl(`surface=transition&mode=dark&fixtureUserLevel=0&locale=${locale}&rtl=${locale === 'ar'}`))
    const recipient = page.getByTestId('recipient-consumer').getByRole('combobox')
    await expect(recipient).toContainText(translations.RECIPIENT_BUSINESS[locale])
    await recipient.click()
    await page.getByRole('option', { name: translations.RECIPIENT_PLATFORM[locale], exact: true }).click()
    await expect(page.getByTestId('recipient-value')).toHaveText('platform')
    await page.getByTestId('school-consumer').getByRole('button', { name: translations.SCHOOL_MODULE_DISABLE_ACTION[locale], exact: true }).click()
    const dialog = page.getByRole('alertdialog', { name: translations.SCHOOL_MODULE_DISABLE_CONFIRM_TITLE[locale] })
    await expect(dialog).toContainText(translations.SCHOOL_MODULE_DISABLE_CONFIRM_TEXT[locale])
    await expect(dialog.getByRole('button', { name: translations.SCHOOL_MODULE_DISABLE_CONFIRM[locale], exact: true })).toBeVisible()
    await expect(dialog).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
    await dialog.getByRole('button', { name: translations.CANCEL[locale], exact: true }).click()
    await expect(page.getByTestId('school-events')).toHaveText('{"disable":0,"enable":0}')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})
