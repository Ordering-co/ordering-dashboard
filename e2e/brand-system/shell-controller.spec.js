import { test, expect, fixtureUrl } from './fixtures'

test('real sidebar controller preserves builder app mapping and billing read return contract', async ({ page }) => {
  await page.goto(fixtureUrl('surface=shell-controller&mode=light'))
  await expect.poll(async () => JSON.parse(await page.getByTestId('builder-apps').textContent())).toEqual({ loading: false, error: null, apps: [{ id: 901, title: 'Fixture application', type: 'app', enabled: true }, { id: 902, title: 'Fixture website', type: 'web', enabled: true }] })
  await page.getByRole('button', { name: 'Read fixture billing token' }).click()
  await expect.poll(async () => JSON.parse(await page.getByTestId('billing-return').textContent())).toEqual({ result: { access_token: 'fixture-billing-token', referer_url: 'billing.example.test' }, error: null })
  const requests = await page.evaluate(() => globalThis.__OD_SHELL_CONTROLLER_REQUESTS__)
  expect(requests.map(request => request.path)).toEqual(['/__brand-fixture__/shell-controller/builder/apps', '/__brand-fixture__/shell-controller/integrations/internal/tokens/current/'])
  expect(requests.every(request => request.method === 'GET' && request.authorization === 'Bearer fixture-shell-controller-token')).toBe(true)
})
