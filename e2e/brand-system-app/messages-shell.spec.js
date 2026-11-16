import {
// Copy decision 4 (user, 2026-10-06): shared labels in sentence case; only the names this spec looks up changed.
  expect,
  expectClosedNetworkBoundary,
  installAppNetworkBoundary,
  installSyntheticSession,
  test
} from './fixtures'

test('real Messages shell renders populated orders and preserves owned order controls', async ({ context, page }) => {
  const network = await installAppNetworkBoundary(context, { scenario: 'populated' })
  await installSyntheticSession(context, { authenticated: true })
  await page.setViewportSize({ width: 1280, height: 900 })
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))

  await page.goto('/messages', { waitUntil: 'domcontentloaded' })
  // redesign messages FASE 3 (decisions 1A, 2A): the page is the inbox. The open conversation's header is an h2 with the customer, the rows are
  // buttons named «<customer>, Order number <id>»; the old «Order number 910001» heading and the business cards (p.bold) are gone.
  await expect(page.getByRole('heading', { name: 'Fixture Customer Longname', level: 2 })).toBeVisible({ timeout: 90000 })
  const notice = page.getByRole('button', { name: 'Accept', exact: true })
  if (await notice.count()) await notice.last().click()
  // redesign 5.2: the page title is the shared page head, an h1, no longer a <p>.
  await expect(page.getByRole('heading', { name: 'Messages', level: 1 })).toBeVisible()
  // redesign messages FASE 3 (decision 3A): Active / All replaces Newest / Order number as the segmented control; Active is chosen and both are type='button'
  const active = page.locator('.odc-conv-scope').getByRole('button', { name: 'Active', exact: true })
  const all = page.locator('.odc-conv-scope').getByRole('button', { name: 'All', exact: true })
  // redesign messages FASE 3 (decision 1A): the sort is a menu; Newest message is the current choice
  const sort = page.getByRole('button', { name: /^Sort by:/ })
  await expect(active).toBeVisible()
  await expect(active).toHaveJSProperty('type', 'button')
  await expect(active).toHaveAttribute('aria-pressed', 'true')
  await expect(all).toBeVisible()
  await expect(sort).toHaveAccessibleName('Sort by: Newest message')
  const rows = page.locator('.odi-list li button')
  await expect(rows.filter({ hasText: /Order number 910001/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Fixture Customer Longname, Order number 910001\b/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Fixture Guest, Order number 910002\b/ })).toBeVisible()
  // the business name of each row (the cards' p.bold before), shown because this session is an admin
  await expect(page.locator('.odc-conv-business').filter({ hasText: /^Synthetic Store Alpha$/ })).toBeVisible()
  await expect(page.locator('.odc-conv-business').filter({ hasText: /^Synthetic Store Beta$/ })).toBeVisible()

  // Copy decision 4: the rows are buttons named with the order number. Sorting by order number and back, and All, write nothing.
  const writesBefore = network.blockedWrites.length
  await sort.click()
  await page.getByRole('menuitemradio', { name: 'Order number', exact: true }).click()
  await expect(sort).toHaveAccessibleName('Sort by: Order number')
  await expect(page.getByRole('button', { name: /^Fixture Customer Longname, Order number 910001\b/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Fixture Guest, Order number 910002\b/ })).toBeVisible()
  await sort.click()
  await page.getByRole('menuitemradio', { name: 'Newest message', exact: true }).click()
  await expect(sort).toHaveAccessibleName('Sort by: Newest message')
  await expect(page.getByRole('button', { name: /^Fixture Customer Longname, Order number 910001\b/ })).toBeVisible()
  await all.click()
  await expect(all).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: /^Fixture Guest, Order number 910002\b/ })).toBeVisible()
  // a row selects its conversation: the header follows and the row is the current one
  await page.getByRole('button', { name: /^Fixture Guest, Order number 910002\b/ }).click()
  await expect(page.getByRole('heading', { name: 'Fixture Guest', level: 2 })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Fixture Guest, Order number 910002\b/ })).toHaveAttribute('aria-current', 'true')
  expect(network.blockedWrites.length).toBe(writesBefore)

  expect(pageErrors).toEqual([])
  expectClosedNetworkBoundary(network)
})
