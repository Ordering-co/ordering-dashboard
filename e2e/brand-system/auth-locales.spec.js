import { test, expect, fixtureUrl } from './fixtures'
import localeConfig from '../../i18n/config.json'
import translations from '../../i18n/translations.json'

for (const locale of [localeConfig.sourceLanguage, ...localeConfig.supportedLocales]) {
  test(`auth forms use the ${locale} catalog and preserve password validation`, async ({ page }) => {
    await page.setViewportSize({ width: locale === 'ar' ? 320 : 390, height: 760 })
    const label = key => {
      const value = translations[key]?.[locale]
      expect(value?.trim(), `${key}.${locale}`).toBeTruthy()
      return value
    }
    const url = form => fixtureUrl(`surface=auth-forms&case=${form}&mode=light&locale=${locale}&rtl=${locale === 'ar'}`)
    await page.goto(url('login'))
    await expect(page.getByRole('heading', { name: label('LOGIN_PAGE_TITLE'), exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: label('SIGN_IN'), exact: true })).toBeVisible()
    await expect(page.getByLabel(label('PROJECT'), { exact: true })).toBeVisible()
    await expect(page.getByLabel(label('EMAIL'), { exact: true })).toBeVisible()
    await expect(page.getByRole('group', { name: label('SIGN_IN_METHOD'), exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

    await page.goto(url('forgot'))
    await expect(page.getByRole('heading', { name: label('TITLE_FORGOT_PASSWORD'), exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: label('SEND_RESET_LINK'), exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

    await page.goto(`${url('reset')}&tokens=present&resetProject=fixtureproject`)
    await expect(page.getByRole('heading', { name: label('TITLE_RESET_PASSWORD'), exact: true })).toBeVisible()
    await page.getByLabel(label('NEW_PASSWORD'), { exact: true }).fill('synthetic-password8')
    await page.getByLabel(label('CONFIRM_PASSWORD'), { exact: true }).fill('different-password8')
    await page.getByRole('button', { name: label('CHANGE_PASSWORD'), exact: true }).click()
    await expect(page.getByRole('alertdialog')).toContainText(label('VALIDATION_ERROR_PASSWORDS_MATCH'))
    expect(await page.evaluate(() => (globalThis.__OD_AUTH_EVENTS__ || []).filter(event => event.kind === 'reset-submit'))).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

// The sign-in method tabs keep `main`'s segmented look (equal-width pills on a subtle track) but
// must never split a word across lines nor widen the page, however long the localized label is.
for (const width of [320, 390]) {
  test.describe(`login method tabs at ${width}px coarse pointer`, () => {
    test.use({ viewport: { width, height: 760 }, hasTouch: true, isMobile: true })
    for (const locale of ['en', 'da', 'nl', 'el']) {
      test(`${locale} tabs split no word and keep the page inside the viewport`, async ({ page }) => {
        await page.goto(fixtureUrl(`surface=auth-forms&case=login&mode=light&locale=${locale}`))
        expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
        const group = page.getByRole('group', { name: translations.SIGN_IN_METHOD[locale], exact: true })
        await expect(group).toBeVisible()
        const measured = await group.evaluate(element => {
          const tabs = [...element.querySelectorAll('button')]
          const split = []
          for (const tab of tabs) {
            const walker = document.createTreeWalker(tab, NodeFilter.SHOW_TEXT)
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
              for (const match of node.data.matchAll(/\S+/g)) {
                const range = document.createRange()
                range.setStart(node, match.index)
                range.setEnd(node, match.index + match[0].length)
                if (range.getClientRects().length > 1) split.push(match[0])
              }
            }
          }
          return { count: tabs.length, split, scrollWidth: document.documentElement.scrollWidth, innerWidth }
        })
        expect(measured.count).toBe(4)
        expect(measured.split, 'words broken across lines inside the method tabs').toEqual([])
        expect(measured.scrollWidth).toBeLessThanOrEqual(measured.innerWidth)
      })
    }
  })
}
