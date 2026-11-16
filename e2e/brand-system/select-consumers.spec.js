import { test, expect, fixtureUrl } from './fixtures'
import translations from '../../i18n/translations.json'
import localeConfig from '../../i18n/config.json'

const header = scope => scope.locator('[role="button"][aria-expanded], [role="combobox"]').first()
const receipt = async page => JSON.parse(await page.getByTestId('select-consumer-events').textContent())

for (const mode of ['light', 'dark']) {
  for (const touch of [false, true]) {
    test.describe(`${mode} selector consumers ${touch ? 'touch' : 'desktop'}`, () => {
      test.use({ viewport: { width: touch ? 390 : 1440, height: 1000 }, hasTouch: touch, isMobile: touch })
      test('keeps the real customizable settings editor when its scalar value is unchanged', async ({ page }) => {
        await page.goto(fixtureUrl(`surface=select-consumers&mode=${mode}&fixtureUserLevel=0`))
        const settings = page.getByTestId('custom-setting-consumer')
        const settingsTrigger = header(settings)
        await settingsTrigger.click()
        await settings.getByRole('option', { name: 'Custom', exact: true }).click()
        const input = settings.getByPlaceholder('Custom', { exact: true })
        await expect(input).toBeVisible()
        await expect(input).toHaveValue('javascript')
        expect((await receipt(page)).customConfigCalls).toBe(1)
        await input.click()
        await expect(input).toBeFocused()
        await expect(settingsTrigger).toHaveAttribute('aria-expanded', 'false')
        await input.fill('custom-value')
        // Wait for the simulated parent config/options update before the next
        // keystroke targets its refreshed uncontrolled editor.
        await expect(input).toHaveJSProperty('defaultValue', 'custom-value')
        await input.focus()
        await input.evaluate(element => element.setSelectionRange(element.value.length, element.value.length))
        await input.press('h')
        await expect(input).toHaveValue('custom-valueh')
        await expect.poll(async () => (await receipt(page)).customConfigValue).toBe('custom-valueh')
        expect((await receipt(page)).customConfigCalls).toBe(3)
        await settingsTrigger.locator('svg').last().click()
        await expect(settingsTrigger).toHaveAttribute('aria-expanded', 'true')
        await input.click()
        await expect(input).toBeFocused()
        await expect(settingsTrigger).toHaveAttribute('aria-expanded', 'true')
        await input.press('Escape')
        await expect(settingsTrigger).toHaveAttribute('aria-expanded', 'false')
        await expect(settingsTrigger).toBeFocused()
        expect((await receipt(page)).customConfigCalls).toBe(3)
      })

      test('FirstSelect preserves real driver and company assignment payloads', async ({ page }) => {
        await page.goto(fixtureUrl(`surface=select-consumers&mode=${mode}&fixtureUserLevel=0&firstSelect=true`))
        const driver = page.getByTestId('driver-single-consumer')
        await header(driver).click()
        await driver.getByPlaceholder('Search', { exact: true }).fill('Ada')
        await driver.getByRole('option').filter({ hasText: 'Ada Fixture' }).click()
        await expect.poll(async () => (await receipt(page)).driverAssignment).toEqual({ orderId: 9700, driverId: 21 })
        await expect(header(driver)).toContainText('Ada Fixture')
        const company = page.getByTestId('company-single-consumer')
        await header(company).click()
        await company.getByPlaceholder('Search', { exact: true }).fill('Orbit')
        await company.getByRole('option').filter({ hasText: 'Orbit Delivery' }).press('Enter')
        await expect.poll(async () => (await receipt(page)).companyAssignment).toEqual({ orderId: 9700, companyId: 31 })
        await expect(header(company)).toContainText('Orbit Delivery')
        await expect(header(company)).toBeFocused()
        expect((await receipt(page)).searchConsumerCounts).toEqual({ driver: 1, company: 1, occupation: 0, create: 0 })
      })

      test('preserves real searchable assignments and occupation creation payloads', async ({ page }) => {
        await page.goto(fixtureUrl(`surface=select-consumers&mode=${mode}&fixtureUserLevel=0`))
        const driver = page.getByTestId('driver-single-consumer')
        await header(driver).click()
        await driver.getByPlaceholder('Search', { exact: true }).fill('Ada')
        await driver.getByRole('option').filter({ hasText: 'Ada Fixture' }).click()
        await expect.poll(async () => (await receipt(page)).driverAssignment).toEqual({ orderId: 9700, driverId: 21 })
        await expect(header(driver)).toContainText('Ada Fixture')

        const company = page.getByTestId('company-single-consumer')
        await header(company).click()
        await company.getByPlaceholder('Search', { exact: true }).fill('Orbit')
        await company.getByRole('option').filter({ hasText: 'Orbit Delivery' }).click()
        await expect.poll(async () => (await receipt(page)).companyAssignment).toEqual({ orderId: 9700, companyId: 31 })
        await expect(header(company)).toContainText('Orbit Delivery')

        const occupation = page.getByTestId('occupation-consumer')
        await header(occupation).click()
        await occupation.getByPlaceholder('Search', { exact: true }).fill('New Fixture Role')
        await occupation.getByRole('option').filter({ hasText: 'New Fixture Role' }).press('Enter')
        await expect.poll(async () => (await receipt(page)).occupationCreation).toEqual({ name: 'New Fixture Role' })
        await expect.poll(async () => (await receipt(page)).occupationId).toBe(94)
        await expect(header(occupation)).toContainText('New Fixture Role')
        await expect(header(occupation)).toBeFocused()
        expect((await receipt(page)).searchConsumerCounts).toEqual({ driver: 1, company: 1, occupation: 0, create: 1 })
      })

      test('preserves real recipient and user-type callbacks', async ({ page }, testInfo) => {
        await page.goto(fixtureUrl(`surface=select-consumers&mode=${mode}&fixtureUserLevel=0`))
        const recipient = page.getByTestId('recipient-consumer')
        await header(recipient).focus()
        await header(recipient).press('Enter')
        await page.getByRole('option', { name: 'Business', exact: true }).click()
        expect((await receipt(page)).recipient).toBe('business')
        await header(recipient).press('Space')
        await page.getByRole('option', { name: 'Inherit', exact: true }).click()
        expect((await receipt(page)).recipient).toBeNull()

        const disabled = page.getByTestId('recipient-disabled-consumer')
        await expect(header(disabled)).toBeDisabled()
        await header(disabled).focus()
        await expect(header(disabled)).not.toBeFocused()
        await header(disabled).evaluate(element => element.click())
        await expect(header(disabled)).toHaveAttribute('aria-expanded', 'false')

        const primary = page.getByTestId('primary-type-consumer')
        await header(primary).press('Enter')
        await primary.getByRole('option', { name: 'Driver', exact: true }).click()
        expect((await receipt(page)).primaryType).toBe(4)

        const bulk = page.getByTestId('user-type-consumer')
        await header(bulk).press('Enter')
        await expect(bulk.getByRole('option', { name: 'User', exact: true })).toHaveAttribute('aria-disabled', 'true')
        await bulk.getByRole('option', { name: 'Business owner', exact: true }).press('Enter')
        expect((await receipt(page)).typeEvent).toEqual({ id: 901, level: 2 })
        await expect(header(bulk)).toContainText('Type')

        if (touch) {
          // redesign RecipientSelect is a Product select (32px seen, 44x44 area, decision 12); this surface does not load
          // the --od-x-* candidates, so its size is measured where it does: e2e/product-ui/select-behaviour.spec.js › touch phone,
          // and the transition surface (transition.spec.js › coarse transition targets)
          for (const scope of [primary, bulk]) {
            const box = await header(scope).boundingBox()
            expect(box.height).toBeGreaterThanOrEqual(44)
            expect(box.width).toBeGreaterThanOrEqual(44)
          }
        }
        const geometry = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth }))
        expect(geometry.width).toBeLessThanOrEqual(geometry.viewport)
        expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(touch)
        await page.screenshot({ path: testInfo.outputPath(`select-consumers-${mode}-${touch ? 'touch' : 'desktop'}.png`) })
        expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(touch)
      })
    })
  }
}

test('RecipientSelect keeps its existing administrator-only visibility', async ({ page }) => {
  await page.goto(fixtureUrl('surface=select-consumers&fixtureUserLevel=2'))
  await expect(header(page.getByTestId('primary-type-consumer'))).toBeVisible()
  await expect(page.getByTestId('recipient-consumer')).toBeEmpty()
  await expect(page.getByTestId('recipient-disabled-consumer')).toBeEmpty()
})

for (const locale of [localeConfig.sourceLanguage, ...localeConfig.supportedLocales]) {
  test(`RecipientSelect uses catalog labels and existing payloads in ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 })
    await page.goto(fixtureUrl(`surface=select-consumers&fixtureUserLevel=0&locale=${locale}&rtl=${locale === 'ar'}`))
    const recipient = page.getByTestId('recipient-consumer')
    const inherit = translations.INHERIT[locale]
    const business = translations.RECIPIENT_BUSINESS[locale]
    expect(inherit).toBeTruthy()
    expect(business).toBeTruthy()
    await expect(header(recipient)).toContainText(inherit)
    await header(recipient).press('Enter')
    await page.getByRole('option', { name: business, exact: true }).press('Enter')
    expect((await receipt(page)).recipient).toBe('business')
    await expect(header(recipient)).toContainText(business)
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
  })
}
