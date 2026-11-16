import { test, expect, fixtureUrl } from './fixtures'
import { tokens } from '../../src/brand/ordering.tokens.generated'
import localeConfig from '../../i18n/config.json'
import translations from '../../i18n/translations.json'

const header = scope => scope.locator('[role="button"][aria-haspopup="listbox"], [role="combobox"]').first()
const read = async (page, testId) => JSON.parse(await page.getByTestId(testId).textContent())
const waitSearch = async (page, testId, kind, args) => expect.poll(async () => {
  const events = await read(page, testId)
  return events.filter(event => event.kind === kind).at(-1)?.args
}).toEqual(args)
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
const visibleTextbox = scope => scope.locator('input[type="text"]:visible').first()
const focusByKeyboard = async (page, target) => {
  for (let index = 0; index < 100 && !await target.evaluate(element => element === document.activeElement); index += 1) await page.keyboard.press('Tab')
  await expect(target).toBeFocused()
}

test('CitySelector preserves controller wiring, scalar and multi payloads, loading, paging and add-mode quirk', async ({ page }) => {
  await page.goto(fixtureUrl('surface=entity-selectors&mode=light'))
  await expect.poll(() => read(page, 'city-controller-receipts')).toEqual({
    'city-add': { filterValues: { cityIds: [] }, isAddMode: true },
    'city-default': { defaultValue: 2, isDefault: true, optionInnerMaxHeight: '160px', position: 'left' },
    'city-loading': { isDefault: true },
    'city-multi': { filterValues: { cityIds: [1] } }
  })

  const scalar = page.getByTestId('city-default')
  await expect(header(scalar)).toContainText('Fixture City 2')
  await header(scalar).press('Enter')
  await expect(scalar.getByRole('listbox')).toHaveAttribute('data-position', 'left')
  await expect(scalar.locator('.od-first-select-options-inner')).toHaveCSS('max-height', '160px')
  await scalar.getByRole('option', { name: 'Fixture City 3', exact: true }).click()
  await expect.poll(async () => (await read(page, 'city-events')).find(event => event.source === 'default')).toEqual({ source: 'default', args: [3, 'city_id'] })

  const multi = page.getByTestId('city-multi')
  await header(multi).press('Enter')
  await expect(multi.getByRole('textbox')).toHaveAccessibleName(translations.SEARCH.en)
  await expect(multi.getByText('Items per page', { exact: true })).toHaveCount(0)
  await multi.getByRole('button', { name: 'Page 2', exact: true }).click()
  await expect(multi.getByRole('button', { name: 'Page 2', exact: true })).toHaveAttribute('aria-current', 'page')
  await visibleTextbox(multi).fill('Fixture')
  await expect(multi.getByRole('button', { name: 'Page 2', exact: true })).toHaveAttribute('aria-current', 'page')
  await multi.getByRole('option', { name: 'Fixture City 6', exact: true }).click()
  await expect.poll(async () => (await read(page, 'city-events')).find(event => event.source === 'multi')).toEqual({ source: 'multi', args: [6, 'city_id'] })

  const add = page.getByTestId('city-add-mode')
  await header(add).press('Enter')
  await visibleTextbox(add).fill('Only matching')
  await expect.poll(async () => (await read(page, 'city-events')).find(event => event.source === 'add')).toEqual({ source: 'add', args: [91, 'city_id'] })
  await expect(page.getByTestId('city-loading').locator('.react-loading-skeleton')).toHaveCount(1)
})

test('RecipientSelect preserves level gate, value precedence, inherit null, Sponsor label and disabled state', async ({ page }) => {
  await page.goto(fixtureUrl('surface=entity-selectors&mode=light&fixtureUserLevel=0'))
  const inherit = page.getByTestId('recipient-inherit')
  const value = page.getByTestId('recipient-value')
  const sponsor = page.getByTestId('recipient-sponsor')
  await expect(header(inherit)).toContainText('Inherit')
  await expect(header(value)).toContainText('Platform')
  await expect(sponsor.getByText('Sponsor', { exact: true })).toBeVisible()
  // redesign (stores 5.14): the visible «Sponsor» label names the Product select itself, not a group around it
  await expect(header(sponsor)).toHaveAccessibleName('Sponsor Business')
  await expect(header(sponsor)).toContainText('Business')
  await header(value).press('Enter')
  await page.getByRole('listbox').getByRole('option', { name: 'Business', exact: true }).press('Enter')
  await header(inherit).press('Enter')
  await page.getByRole('listbox').getByRole('option', { name: 'Platform', exact: true }).click()
  await header(inherit).press('Enter')
  await page.getByRole('listbox').getByRole('option', { name: 'Inherit', exact: true }).click()
  expect(await read(page, 'recipient-events')).toEqual([
    { source: 'value', value: 'business' },
    { source: 'inherit', value: 'platform' },
    { source: 'inherit', value: null }
  ])
  await expect(header(page.getByTestId('recipient-disabled'))).toBeDisabled()

  await page.goto(fixtureUrl('surface=entity-selectors&mode=light&fixtureUserLevel=2'))
  for (const testId of ['recipient-inherit', 'recipient-value', 'recipient-sponsor', 'recipient-disabled']) await expect(page.getByTestId(testId).getByRole('combobox')).toHaveCount(0)
})

test('SelectBusinesses preserves local/server search, image data, row and bulk payloads, paging and add/save branches', async ({ page }) => {
  await page.goto(fixtureUrl('surface=entity-selectors&mode=light'))
  const local = page.getByTestId('business-local')
  const server = page.getByTestId('business-server')
  await local.getByPlaceholder('Search', { exact: true }).fill('Fallback')
  await expect(local.getByText('Fallback Kitchen', { exact: true })).toBeVisible()
  await expect(local.getByText('Blue Plate', { exact: true })).toHaveCount(0)
  await local.getByPlaceholder('Search', { exact: true }).fill('')
  await local.getByRole('checkbox', { name: 'Blue Plate', exact: true }).click()
  await local.getByRole('button', { name: 'Select all', exact: true }).click()
  await local.getByRole('button', { name: 'Select none', exact: true }).click()
  await local.getByRole('button', { name: 'Save', exact: true }).click()

  await server.getByPlaceholder('Search', { exact: true }).fill('Blue')
  await waitSearch(page, 'business-events', 'server-search', ['Blue'])
  await server.getByRole('button', { name: 'Page 3', exact: true }).click()
  await server.getByRole('button', { name: 'Add', exact: true }).click()
  const events = await read(page, 'business-events')
  expect(events.filter(event => ['select', 'all', 'none', 'save', 'business-page', 'add'].includes(event.kind))).toEqual([
    { kind: 'select', args: [101, false] },
    { kind: 'all', args: [] },
    { kind: 'none', args: [] },
    { kind: 'save', args: [] },
    { kind: 'business-page', args: [3] },
    { kind: 'add', args: [] }
  ])
  await expect(page.getByTestId('business-loading').locator('[data-slot="entity-selector-row"]')).toHaveCount(10)
  await expect(page.getByTestId('business-loading').getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  const images = local.locator('[data-slot="entity-selector-image"]')
  await expect(images).toHaveCount(3)
  for (const frame of await images.all()) {
    const box = await frame.boundingBox()
    expect(box.width).toBe(40)
    expect(box.height).toBe(40)
    expect(await frame.locator('[data-slot="select-businesses-image"]').evaluate(element => getComputedStyle(element).backgroundImage)).not.toBe('none')
  }
  expect(await page.evaluate(() => globalThis.__OD_ENTITY_OPTIMIZE_CALLS__)).toEqual(expect.arrayContaining([
    { value: expect.stringContaining('data:image/svg+xml;base64,'), options: 'h_50,c_limit' },
    { value: expect.any(String), options: 'h_50,c_limit' }
  ]))
})

test('loyalty and site selectors preserve filtered/all payloads, loading, actions and stale site-prop behavior', async ({ page }) => {
  await page.goto(fixtureUrl('surface=entity-selectors&mode=light'))
  const loyalty = page.getByTestId('loyalty-main')
  await loyalty.getByPlaceholder('Search', { exact: true }).fill('Silver')
  await loyalty.getByRole('button', { name: 'Select all', exact: true }).click()
  await loyalty.getByRole('button', { name: 'Select none', exact: true }).click()
  await loyalty.getByRole('checkbox', { name: 'Silver', exact: true }).click()
  await loyalty.getByRole('button', { name: 'Save', exact: true }).click()
  expect(await read(page, 'loyalty-events')).toEqual([
    { kind: 'levels-all', args: [[202]] },
    { kind: 'levels-all', args: [[]] },
    { kind: 'level', args: [true, 202] },
    { kind: 'level-save', args: [] }
  ])
  await expect(page.getByTestId('loyalty-loading').locator('[data-slot="entity-selector-row"]')).toHaveCount(10)
  await expect(page.getByTestId('loyalty-loading').getByRole('button', { name: 'Add', exact: true })).toBeDisabled()

  const sites = page.getByTestId('sites-main')
  await sites.getByRole('checkbox', { name: 'Ordering web', exact: true }).click()
  await sites.getByRole('button', { name: 'Select all', exact: true }).click()
  await sites.getByRole('button', { name: 'Select none', exact: true }).click()
  await sites.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('button', { name: 'Supply another site', exact: true }).click()
  await expect(sites.getByText('Newly supplied site', { exact: true })).toHaveCount(0)
  await sites.getByPlaceholder('Search', { exact: true }).fill('Newly')
  await expect(sites.getByText('Newly supplied site', { exact: true })).toBeVisible()
  await page.getByTestId('sites-add').getByRole('button', { name: 'Add', exact: true }).click()
  expect(await read(page, 'site-events')).toEqual([
    { kind: 'site', args: [false, 301] },
    { kind: 'sites-all', args: [] },
    { kind: 'sites-none', args: [] },
    { kind: 'site-save', args: [] },
    { kind: 'site-add', args: [] }
  ])
})

test('SelectUsers preserves forced controller props, search threshold, all-state rules, pagination and action payloads', async ({ page }) => {
  await page.goto(fixtureUrl('surface=entity-selectors&mode=light'))
  const receipts = await expect.poll(() => read(page, 'user-controller-receipts')).toMatchObject({
    'users-main': {
      defaultUserTypesSelected: [3],
      isSearchByUserEmail: true,
      isSearchByUserName: true,
      isSearchByUserPhone: true
    }
  })
  void receipts
  const main = page.getByTestId('users-main')
  await main.getByPlaceholder('Search', { exact: true }).fill('ab')
  await waitSearch(page, 'user-events', 'user-search', [''])
  await main.getByPlaceholder('Search', { exact: true }).fill('Ada')
  await waitSearch(page, 'user-events', 'user-search', ['Ada'])
  await main.getByRole('checkbox', { name: 'Ada Lovelace', exact: true }).click()
  await main.getByRole('button', { name: 'Page 3', exact: true }).click()
  const pageSize = main.locator('[data-slot="pagination-size"] [role="button"][aria-haspopup="listbox"]')
  await pageSize.click()
  await main.getByRole('option', { name: '25', exact: true }).click()
  await main.getByRole('button', { name: 'Save', exact: true }).click()
  const events = await read(page, 'user-events')
  expect(events).toEqual(expect.arrayContaining([
    { kind: 'user', args: [false, 401] },
    { kind: 'get-users', args: [3, 10] },
    { kind: 'get-users', args: [1, 25] },
    { kind: 'user-save', args: [] }
  ]))

  await main.getByPlaceholder('Search', { exact: true }).fill('')
  await waitSearch(page, 'user-events', 'user-search', [''])
  const all = page.getByTestId('users-all')
  const allCheckbox = all.getByRole('checkbox', { name: 'All', exact: true })
  await expect(allCheckbox).toBeChecked()
  await expect(all.getByText('Ada Lovelace', { exact: true })).toHaveCount(0)
  await expect(all.locator('[data-slot="pagination"]')).toHaveCount(0)
  const allEventsBefore = (await read(page, 'user-events')).filter(event => event.kind === 'users-all').length
  await allCheckbox.click()
  await expect(all.getByText('Ada Lovelace', { exact: true })).toBeVisible()
  expect((await read(page, 'user-events')).filter(event => event.kind === 'users-all')).toHaveLength(allEventsBefore)
  await all.getByRole('checkbox', { name: 'All', exact: true }).click()
  expect((await read(page, 'user-events')).filter(event => event.kind === 'users-all').at(-1)).toEqual({ kind: 'users-all', args: [] })
  await expect(page.getByTestId('users-loading').locator('[data-slot="entity-selector-row"]')).toHaveCount(10)
  await page.getByTestId('users-add').getByRole('button', { name: 'Add', exact: true }).click()
  expect((await read(page, 'user-events')).at(-1)).toEqual({ kind: 'user-add', args: [] })
  expect((await read(page, 'user-controller-receipts'))['users-main'].propsToFetch).toEqual([
    'id', 'name', 'lastname', 'email', 'phone', 'photo', 'cellphone', 'external_id',
    'country_phone_code', 'level', 'enabled', 'middle_name', 'second_lastname', 'birthdate'
  ])
})

for (const mode of ['light', 'dark']) {
  test(`entity selector surfaces use governed ${mode} roles, readable text and visible keyboard focus`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(fixtureUrl(`surface=entity-selectors&mode=${mode}`))
    const semantic = tokens.theme[mode].semantic
    const roots = page.locator('[data-slot="entity-selector"]')
    await expect(roots.first()).toBeVisible()
    expect(await roots.count()).toBeGreaterThanOrEqual(10)
    for (const root of await roots.all()) {
      // These legacy list layouts inherit their enclosing page or panel surface.
      // Verify the governed role and effective contrast without adding a new fill.
      await expect(root).toHaveCSS('--od-entity-selector-surface', semantic.surface.default)
      const rootColors = await effectiveColors(root)
      expect.soft(contrast(rootColors.foreground, rootColors.background)).toBeGreaterThanOrEqual(4.5)
    }
    for (const row of await page.locator('[data-slot="entity-selector-row"]:visible').all()) {
      const rowColors = await effectiveColors(row)
      expect.soft(contrast(rowColors.foreground, rowColors.background)).toBeGreaterThanOrEqual(4.5)
    }
    for (const skeleton of await page.locator('.react-loading-skeleton').all()) {
      const palette = await skeleton.evaluate(element => ({ base: getComputedStyle(element).getPropertyValue('--base-color').trim(), highlight: getComputedStyle(element).getPropertyValue('--highlight-color').trim() }))
      expect(palette.base.toLowerCase()).toBe(semantic.border.default.toLowerCase())
      expect(palette.highlight.toLowerCase()).toBe(semantic.surface.default.toLowerCase())
    }
    await page.evaluate(() => document.activeElement?.blur())
    const keyboardTargets = [
      header(page.getByTestId('city-default')),
      header(page.getByTestId('city-multi')),
      page.getByTestId('business-local').getByRole('textbox'),
      page.getByTestId('business-local').getByRole('button', { name: 'Select all', exact: true }),
      page.getByTestId('business-local').getByRole('checkbox', { name: 'Blue Plate', exact: true })
    ]
    for (const control of keyboardTargets) {
      await focusByKeyboard(page, control)
      const focus = await control.evaluate(element => ({ style: getComputedStyle(element).outlineStyle, width: parseFloat(getComputedStyle(element).outlineWidth) }))
      expect.soft(focus.style).toBe('solid')
      expect.soft(focus.width).toBeGreaterThanOrEqual(2)
    }
    await page.screenshot({ path: testInfo.outputPath(`entity-selectors-${mode}.png`), fullPage: true })
  })
}

for (const width of [320, 390]) {
  test.describe(`entity selectors at ${width}px coarse pointer`, () => {
    test.use({ viewport: { width, height: 800 }, hasTouch: true, isMobile: true })
    test('long RTL rows reflow with 44px actions and no viewport overflow', async ({ page }, testInfo) => {
      await page.goto(fixtureUrl('surface=entity-selectors&mode=dark&locale=ar&rtl=true'))
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      const business = page.getByTestId('business-local')
      await business.scrollIntoViewIfNeeded()
      await page.screenshot({ path: testInfo.outputPath(`entity-selectors-${width}-before.png`) })
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      for (const control of await business.locator('input:visible, button:visible').all()) {
        const box = await control.boundingBox()
        expect.soft(box.width).toBeGreaterThanOrEqual(44)
        expect.soft(box.height).toBeGreaterThanOrEqual(44)
      }
      const city = page.getByTestId('city-multi')
      await header(city).press('Enter')
      const popup = city.locator('.od-multi-select-options')
      const assertPopupFits = async () => {
        const bounds = await popup.boundingBox()
        expect(bounds.x).toBeGreaterThanOrEqual(0)
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
        for (const control of await popup.locator('button:visible, input:visible, [role="option"]:visible').all()) {
          const target = await control.boundingBox()
          expect(target.x).toBeGreaterThanOrEqual(0)
          expect(target.x + target.width).toBeLessThanOrEqual(width)
        }
      }
      await assertPopupFits()
      await expect(city.getByRole('textbox')).toHaveAccessibleName(translations.SEARCH.ar)
      await visibleTextbox(city).fill('localized')
      await assertPopupFits()
      await city.scrollIntoViewIfNeeded()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      await page.screenshot({ path: testInfo.outputPath(`entity-selectors-${width}-after.png`) })
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
    })
  })
}

test('entity selector labels use all twelve locale dictionaries with Arabic direction preserved', async ({ page }) => {
  for (const locale of [localeConfig.sourceLanguage, ...localeConfig.supportedLocales]) {
    await page.goto(fixtureUrl(`surface=entity-selectors&mode=light&locale=${locale}&rtl=${locale === 'ar'}`))
    const business = page.getByTestId('business-local')
    await expect(business.getByPlaceholder(translations.SEARCH[locale], { exact: true })).toBeVisible()
    await expect(business.getByRole('button', { name: translations.SELECT_ALL[locale], exact: true })).toBeVisible()
    await expect(business.getByRole('button', { name: translations.SAVE[locale], exact: true })).toBeVisible()
    const recipient = page.getByTestId('recipient-inherit')
    await expect(header(recipient)).toContainText(translations.INHERIT[locale])
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
  }
})
