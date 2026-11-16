import { expect, test } from '@playwright/test'
import { expectClosedNetworkBoundary, installAppNetworkBoundary, installSyntheticSession } from './brand-system-app/fixtures.js'

test('loads the login screen in a browser without persisted state', async ({ page, context }) => {
  await installSyntheticSession(context, { authenticated: false })
  const network = await installAppNetworkBoundary(context)
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Sign in to your dashboard', level: 1 })).toBeVisible({ timeout: 30000 })
  await expect(page.getByText('Loading dashboard')).toBeHidden()
  expectClosedNetworkBoundary(network)
})
