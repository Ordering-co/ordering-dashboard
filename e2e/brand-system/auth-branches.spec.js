import { test, expect, fixtureUrl } from './fixtures'

const authUrl = extra => fixtureUrl(`surface=auth-forms&case=login&mode=light${extra}`)
const events = page => page.evaluate(() => globalThis.__OD_AUTH_EVENTS__ || [])
const byKind = async (page, kind) => (await events(page)).filter(event => event.kind === kind)
// The login of `main` (AuthLayout) names its method switches by text, in the order
// Password, Email code, Phone code, Phone number, inside a "Sign-in method" group.
const methodGroup = page => page.getByRole('group', { name: 'Sign-in method', exact: true })
const methodControl = (page, name) => methodGroup(page).getByRole('button', { name, exact: true })
const resendControl = page => page.locator('button', { hasText: /^Resend code$/ })

test('individual login flags preserve supplied active method and exact visible order', async ({ page }) => {
  const order = ['Password', 'Email code', 'Phone code', 'Phone number']
  const cases = [
    { query: '&methods=all&initialTab=email', labels: order, active: 'Password', field: 'Email' },
    { query: '&methods=email-only&initialTab=email', labels: [], field: 'Email' },
    { query: '&methods=phone-only&initialTab=cellphone', labels: [], field: 'Phone number' },
    { query: '&methods=otp-email-only&initialTab=otp&initialOtpType=email', labels: [], field: 'Email' },
    { query: '&methods=otp-phone-only&initialTab=otp&initialOtpType=cellphone', labels: [], field: 'phone-widget' }
  ]
  for (const item of cases) {
    await page.goto(authUrl(item.query))
    if (item.field === 'phone-widget') await expect(page.locator('.PhoneInputInput')).toBeVisible()
    else await expect(page.getByLabel(item.field, { exact: true })).toBeVisible()
    // main renders the method switch only when more than one method is enabled.
    if (!item.labels.length) {
      await expect(methodGroup(page)).toHaveCount(0)
      continue
    }
    const buttons = methodGroup(page).getByRole('button')
    await expect(buttons).toHaveText(item.labels)
    await expect(methodControl(page, item.active)).toHaveAttribute('aria-pressed', 'true')
    for (const label of item.labels.filter(label => label !== item.active)) {
      await expect(methodControl(page, label)).toHaveAttribute('aria-pressed', 'false')
    }
  }
})

test('synthetic reCAPTCHA records v3 props and switches to v2 after verification-code error', async ({ page }) => {
  await page.goto(authUrl('&recaptcha=1&loginOutcome=verification-error'))
  await expect(page.getByTestId('synthetic-recaptcha')).toContainText('v3')
  await page.getByTestId('synthetic-recaptcha').click()
  await page.getByLabel('Project', { exact: true }).fill('fixtureproject')
  await page.getByLabel('Email', { exact: true }).fill('captcha@example.com')
  await page.getByLabel('Password', { exact: true }).fill('secret8')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('alertdialog')).toContainText('Please try again')
  await expect(page.getByTestId('synthetic-recaptcha')).toContainText('v2')
  await expect.poll(async () => (await byKind(page, 'recaptcha-render')).filter(event => event.payload.siteKey).length).toBe(2)
  expect((await byKind(page, 'recaptcha-render')).filter(event => event.payload.siteKey)).toEqual([
    { kind: 'recaptcha-render', payload: { version: 'v3', siteKey: 'fixture-site-v3' } },
    { kind: 'recaptcha-render', payload: { version: 'v2', siteKey: 'fixture-site-v2' } }
  ])
  await expect.poll(async () => (await byKind(page, 'login-submit')).length).toBe(1)
})

test('empty OTP phone is rejected locally and the six-digit code expires at zero', async ({ page }) => {
  await page.goto(authUrl(''))
  await methodControl(page, 'Phone code').click()
  await page.getByLabel('Project', { exact: true }).fill('fixtureproject')
  await page.getByRole('button', { name: 'Send code', exact: true }).click()
  await expect(page.getByRole('alertdialog')).toContainText('Phone number is not valid')
  expect(await byKind(page, 'login-generate-otp')).toHaveLength(0)

  const fixedTime = new Date('2026-01-01T00:00:00Z')
  await page.clock.install({ time: fixedTime })
  await page.clock.pauseAt(fixedTime)
  await page.goto(authUrl(''))
  await methodControl(page, 'Email code').click()
  await page.getByLabel('Project', { exact: true }).fill('fixtureproject')
  await page.getByLabel('Email', { exact: true }).fill('expires@example.com')
  await page.getByRole('button', { name: 'Send code', exact: true }).click()
  await expect(page.locator('.otp-input')).toHaveCount(6)
  await page.clock.runFor(600000)
  await expect(page.getByText('0:00', { exact: true })).toBeVisible()
  await expect(page.getByRole('alertdialog')).toContainText('Time is up. Please resend code again')
  for (const input of await page.locator('.otp-input').all()) await expect(input).toBeDisabled()
  await expect(resendControl(page)).toBeEnabled()
})

test('reset code-only, random-only and mismatched-password branches preserve exact callbacks', async ({ page }) => {
  await page.goto(fixtureUrl('surface=auth-forms&case=reset&mode=light&tokens=code-only'))
  await expect(page.getByLabel('Code', { exact: true })).toHaveCount(0)
  await page.getByLabel('Verification code', { exact: true }).fill('manual-random')
  await page.getByRole('button', { name: 'Submit codes', exact: true }).click()
  await expect.poll(async () => (await byKind(page, 'reset-redirect')).length).toBe(1)
  expect(await byKind(page, 'reset-redirect')).toEqual([{
    kind: 'reset-redirect',
    payload: { code: 'code-fixture-17', random: 'manual-random', password: '' }
  }])

  await page.goto(fixtureUrl('surface=auth-forms&case=reset&mode=light&tokens=random-only'))
  await expect(page.getByLabel('Verification code', { exact: true })).toHaveCount(0)
  await page.getByLabel('Code', { exact: true }).fill('manual-code')
  await page.getByRole('button', { name: 'Submit codes', exact: true }).click()
  await expect.poll(async () => (await byKind(page, 'reset-redirect')).length).toBe(1)
  expect(await byKind(page, 'reset-redirect')).toEqual([{
    kind: 'reset-redirect',
    payload: { code: 'manual-code', random: 'random-fixture-29', password: '' }
  }])

  await page.goto(fixtureUrl('surface=auth-forms&case=reset&mode=light&tokens=present&resetProject=fixtureproject'))
  await page.getByLabel('New password', { exact: true }).fill('newsecret8')
  await page.getByLabel('Confirm password', { exact: true }).fill('different8')
  await page.getByRole('button', { name: 'Change password', exact: true }).click()
  await expect(page.getByRole('alertdialog')).toContainText('The passwords do not match')
  expect(await byKind(page, 'reset-submit')).toHaveLength(0)
})

test('forgot password exposes loading and keeps successful recovery disabled with one callback', async ({ page }) => {
  await page.goto(fixtureUrl('surface=auth-forms&case=forgot&mode=light&forgotDelay=500'))
  await page.getByLabel('Project', { exact: true }).fill('fixtureproject')
  await page.getByLabel('Email', { exact: true }).fill('loading@example.com')
  const recover = page.getByRole('button', { name: 'Send reset link', exact: true })
  await recover.click()
  await expect(page.getByRole('button', { name: 'Sending…', exact: true })).toBeDisabled()
  await expect(page.getByRole('alertdialog')).toContainText('If an account exists with this email, we\'ll send you a link to reset your password.')
  await page.getByRole('alertdialog').getByRole('button', { name: 'Accept', exact: true }).click()
  const sent = page.locator('form button').filter({ hasText: 'Link sent' })
  await expect(sent).toBeDisabled()
  await expect.poll(async () => (await byKind(page, 'forgot-submit')).length).toBe(1)
  expect(await byKind(page, 'forgot-submit')).toEqual([{ kind: 'forgot-submit', payload: { email: 'loading@example.com' } }])
})
