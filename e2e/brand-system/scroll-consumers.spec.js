import { test, expect, fixtureUrl } from './fixtures'

test('real occupations filter retains numeric and null selection after scrolling populated content', async ({ page }) => {
  await page.goto(fixtureUrl('surface=scroll-consumers&mode=light'))
  const scope = page.getByTestId('scroll-occupation-consumer')
  const port = scope.locator('.scroll-box__wrapper')
  expect(await port.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true)
  await port.evaluate(element => { element.scrollLeft = element.scrollWidth })
  await expect.poll(() => port.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
  await scope.getByRole('button', { name: 'Occupation 12 with a long name', exact: true }).click()
  await expect(page.getByTestId('occupation-scroll-events')).toHaveText('[12]')
  await scope.getByRole('button', { name: 'All', exact: true }).click()
  await expect(page.getByTestId('occupation-scroll-events')).toHaveText('[12,null]')
  await expect(page.getByTestId('scroll-occupation-loading').locator('.react-loading-skeleton')).toHaveCount(3)
  await expect(page.getByTestId('scroll-occupation-empty').getByRole('button')).toHaveCount(0)
})
