import { test, expect, fixtureUrl } from './fixtures'

const events = page => page.getByTestId('entity-consumer-events').evaluate(element => JSON.parse(element.textContent))
const rowCheckbox = (section, name) => section.getByText(name, { exact: true }).locator('..').getByRole('checkbox')

test('real zone settings preserves CitySelector numeric adaptation and save payload', async ({ page }) => {
  await page.goto(fixtureUrl('surface=entity-consumers'))
  const zone = page.getByTestId('zone-consumer')
  await zone.getByRole('button', { name: 'Northport', exact: true }).click()
  await page.getByRole('option', { name: 'Southport', exact: true }).click()
  await expect.poll(() => events(page)).toContainEqual(['zone-change', 'city_id', 102])
  await zone.getByRole('button', { name: 'Save', exact: true }).click()
  await expect.poll(() => events(page)).toContainEqual(['zone-save', { city_id: 102 }])
})

test('real promotion selection tabs retain distinct row and all-selection payloads', async ({ page }) => {
  await page.goto(fixtureUrl('surface=entity-consumers'))
  const promotion = page.getByTestId('promotion-consumer')
  await expect(promotion.getByRole('heading', { name: 'Fixture promotion' })).toBeVisible()
  await promotion.getByText('Sites', { exact: true }).click()
  await rowCheckbox(promotion, 'Mobile').check()
  await expect.poll(() => events(page)).toContainEqual(['site', true, 502])
  await promotion.getByRole('button', { name: 'Select none', exact: true }).click()
  await expect.poll(() => events(page)).toContainEqual(['all-sites', false])

  await promotion.getByText('Business', { exact: true }).click()
  await rowCheckbox(promotion, 'South store').check()
  await expect.poll(() => events(page)).toContainEqual(['business', 202, true])
  await promotion.getByRole('button', { name: 'Select all', exact: true }).click()
  await expect.poll(() => events(page)).toContainEqual(['all-businesses', true])

  await promotion.getByText('Users', { exact: true }).click()
  await rowCheckbox(promotion, 'Sam South').check()
  await expect.poll(() => events(page)).toContainEqual(['user', true, 302])

  await promotion.getByText(/^Loyalty Levels$/i).click()
  await rowCheckbox(promotion, 'Gold').check()
  await expect.poll(() => events(page)).toContainEqual(['level', true, 402])
  await promotion.getByRole('button', { name: 'Select all', exact: true }).click()
  await expect.poll(() => events(page)).toContainEqual(['all-levels', [401, 402]])
  await promotion.getByRole('button', { name: 'Save', exact: true }).click()
  await expect.poll(() => events(page)).toContainEqual(['save'])
  for (const name of ['site', 'business', 'user', 'level']) expect((await events(page)).filter(event => event[0] === name)).toHaveLength(1)
})

test('real promotion Rules preserves Sponsor selection through RecipientSelect', async ({ page }) => {
  await page.goto(fixtureUrl('surface=entity-consumers'))
  const promotion = page.getByTestId('promotion-consumer')
  await promotion.getByText('Rules', { exact: true }).click()
  // redesign (stores 5.14): the Sponsor select is named by its label and its value
  const sponsor = promotion.getByRole('combobox', { name: /^Sponsor/ })
  await sponsor.click()
  await page.getByRole('option', { name: 'Platform', exact: true }).click()
  await expect.poll(() => events(page)).toContainEqual(['change-item', { sponsor: 'platform' }])
  await expect(sponsor).toHaveAccessibleName('Sponsor Platform')
})
