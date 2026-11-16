import { test, expect, fixtureUrl } from './fixtures'
import translations from '../../i18n/translations.json'

const treeFollowing = (scope, key) => scope.getByText(translations[key].en, { exact: true }).locator('xpath=following-sibling::*[1]')
const checkboxFor = (scope, name) => scope.getByText(name, { exact: true }).locator('xpath=ancestor::*[.//*[@role="checkbox"] or .//input[@type="checkbox"]][1]').getByRole('checkbox').first()
const payload = (page, id) => page.getByTestId(id).evaluate(element => JSON.parse(element.textContent))

test('real category condition consumer preserves descendants, repeated-node removal, exclusion and is_condition payload', async ({ page }) => {
  await page.goto(fixtureUrl('surface=tree-consumers'))
  const section = page.getByTestId('category-tree-consumer')
  const include = treeFollowing(section, 'SELECT_CATEGORY_INCLUDE')
  const exclude = treeFollowing(section, 'SELECT_CATEGORY_EXCLUDE')
  await checkboxFor(include, 'Root category').check()
  await expect.poll(() => payload(page, 'category-condition-payload')).toEqual({ categories: [10, 11, 12].map(id => ({ id, include: true, is_condition: true })) })
  await checkboxFor(include, 'Root category').uncheck()
  await expect.poll(() => payload(page, 'category-condition-payload')).toEqual({ categories: [11, 12].map(id => ({ id, include: true, is_condition: true })) })
  await checkboxFor(exclude, 'Root category').check()
  await expect.poll(() => payload(page, 'category-condition-payload')).toEqual({ categories: [10, 11, 12].map(id => ({ id, include: false, is_condition: true })) })
  await section.getByRole('button', { name: translations.DONE.en, exact: true }).click()
  await expect(page.getByTestId('tree-consumer-done')).toHaveText(JSON.stringify([['category', []]]))
})

test('real product condition consumer keeps category selection immediate-only and serializes explicit exclusion', async ({ page }) => {
  await page.goto(fixtureUrl('surface=tree-consumers'))
  const section = page.getByTestId('product-tree-consumer')
  const include = treeFollowing(section, 'SELECT_PRODUCT_INCLUDE')
  const exclude = treeFollowing(section, 'SELECT_PRODUCT_EXCLUDE')
  await expect(include.getByText('Disabled top category', { exact: true })).toHaveCount(0)
  await checkboxFor(include, 'Root category').check()
  await expect.poll(() => payload(page, 'product-condition-payload')).toEqual({ products: [{ id: 101, include: true, is_condition: true }] })
  await include.getByText('Root category', { exact: true }).click()
  await expect(include.getByText('Child category', { exact: true })).toBeVisible()
  await checkboxFor(include, 'Child category').check()
  await expect.poll(() => payload(page, 'product-condition-payload')).toEqual({ products: [101, 103].map(id => ({ id, include: true, is_condition: true })) })
  await checkboxFor(exclude, 'Root category').check()
  await expect.poll(() => payload(page, 'product-condition-payload')).toEqual({ products: [{ id: 101, include: false, is_condition: true }, { id: 103, include: true, is_condition: true }] })
  await section.getByRole('button', { name: translations.DONE.en, exact: true }).click()
  await expect(page.getByTestId('tree-consumer-done')).toHaveText(JSON.stringify([['product', []]]))
})
