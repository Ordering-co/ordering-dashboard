import { test, expect, installAppNetworkBoundary, installSyntheticSession, expectClosedNetworkBoundary } from './fixtures'

for (const touch of [false, true]) {
  test.describe(`${touch ? 'mobile' : 'desktop'} Login field consumers`, () => {
    test.use({ viewport: { width: touch ? 390 : 1440, height: 900 }, hasTouch: touch, isMobile: touch })
    test('keeps registered values and rejects invalid input without an auth write', async ({ context, page }, testInfo) => {
      const network = await installAppNetworkBoundary(context)
      await installSyntheticSession(context, { authenticated: false })
      await page.goto('/login', { waitUntil: 'domcontentloaded' })
      // redesign W0-12 (T0-49, M-08): the sign-in heading is LoginForm/index.js:282, t('LOGIN_PAGE_TITLE', 'Sign in to your dashboard').
      await expect(page.getByRole('heading', { name: 'Sign in to your dashboard', exact: true })).toBeVisible()
      // The fields are named by a visible <label htmlFor>: Email (LoginForm/index.js:353 -> #login-email) and Project (:317 -> #login-project, no placeholder).
      const email = page.getByRole('textbox', { name: 'Email', exact: true })
      const password = page.locator('input[name="password"]')
      const project = page.getByLabel('Project', { exact: true })
      if (await project.count()) await project.fill('brand-fixture')
      await email.fill('fixture@example.test')
      await password.fill('synthetic-only')
      await page.keyboard.press('Tab')
      await email.focus()
      await expect(email).toHaveCSS('outline-width', '2px')
      await expect(email).toHaveCSS('outline-offset', '2px')
      await expect(email).toHaveValue('fixture@example.test')
      await expect(password).toHaveValue('synthetic-only')
      for (const field of [email, password]) {
        if (touch) {
          const box = await field.boundingBox()
          expect(box.height).toBeGreaterThanOrEqual(44)
          expect(box.width).toBeGreaterThanOrEqual(44)
        }
      }
      if (touch) expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath(`login-fields-${touch ? 'mobile' : 'desktop'}.png`) })
      if (touch) expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      await email.fill('invalid-email')
      const writesBefore = network.blockedWrites.length
      await password.press('Enter')
      await expect(page.getByText('Invalid email address', { exact: true })).toBeVisible()
      await expect(page.getByText('Project is required', { exact: true })).toHaveCount(0)
      await expect(page.getByText('Password is required', { exact: true })).toHaveCount(0)
      // the error sits under its field (no modal); the field points at it and takes the focus.
      await expect(page.getByRole('alertdialog')).toHaveCount(0)
      await expect(email).toHaveAttribute('aria-invalid', 'true')
      const describedBy = await email.getAttribute('aria-describedby')
      expect(describedBy).toBeTruthy()
      await expect(page.locator(`[id="${describedBy.split(' ')[0]}"]`)).toHaveText('Invalid email address')
      await expect(email).toBeFocused()
      expect(await page.locator('input[name="email"]').evaluate(element => element.validity.typeMismatch)).toBe(true)
      await expect(page).toHaveURL(/\/login$/)
      expect(network.blockedWrites.length).toBe(writesBefore)
      if (touch) expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath(`login-validation-${touch ? 'mobile' : 'desktop'}.png`) })
      if (touch) expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      await expect(email).toHaveValue('invalid-email')
      expect(network.blockedWrites.length).toBe(writesBefore)
      expectClosedNetworkBoundary(network)
    })
  })
}
