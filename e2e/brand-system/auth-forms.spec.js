import { test, expect, fixtureUrl } from './fixtures'
import { tokens } from '../../src/brand/ordering.tokens.generated'

const authUrl = (fixtureCase, extra = '') => fixtureUrl(`surface=auth-forms&case=${fixtureCase}&mode=light${extra}`)
const events = page => page.evaluate(() => globalThis.__OD_AUTH_EVENTS__ || [])
const byKind = async (page, kind) => (await events(page)).filter(event => event.kind === kind)
// `main` wraps login, forgot and reset in AuthLayout: a full-height container holding the
// brand panel (aside, lg+) and the form column (a <main>, nested in the fixture's <main>).
const loginRoot = page => page.getByTestId('auth-forms-fixture').locator(':scope > div').filter({ has: page.getByRole('heading', { level: 1 }) })
const formRoot = page => page.getByTestId('auth-forms-fixture').locator('main')
const methodGroup = page => page.getByRole('group', { name: 'Sign-in method', exact: true })
const methodTabs = page => methodGroup(page).getByRole('button')
const resendControl = page => page.locator('button', { hasText: /^Resend code$/ })
const rgb = hex => `rgb(${hex.slice(1).match(/../g).map(part => parseInt(part, 16)).join(', ')})`
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
const focusByKeyboard = async (page, target) => {
  for (let index = 0; index < 80 && !await target.evaluate(element => element === document.activeElement); index += 1) await page.keyboard.press('Tab')
  await expect(target).toBeFocused()
}

test('login preserves four method flags, email/password callbacks and whitespace-free 750ms project debounce', async ({ page }) => {
  const fixedTime = new Date('2026-01-01T00:00:00Z')
  await page.clock.install({ time: fixedTime })
  await page.clock.pauseAt(fixedTime)
  // The fixture's API project is the submitted one, so the login callback fires.
  await page.goto(authUrl('login', '&project=debouncedtenant'))
  await page.evaluate(() => { globalThis.__OD_AUTH_EVENTS__ = [] })
  await expect(methodTabs(page)).toHaveText(['Password', 'Email code', 'Phone code', 'Phone number'])
  const project = page.getByLabel('Project', { exact: true })
  await project.fill(' debounced tenant ')
  await expect(project).toHaveValue('debouncedtenant')
  await page.clock.runFor(749)
  await expect(page.getByTestId('auth-config-state')).toContainText('"project":null')
  await page.clock.runFor(1)
  await expect(page.getByTestId('auth-config-state')).toContainText('"project":"debouncedtenant"')

  await page.getByLabel('Email', { exact: true }).fill('owner@example.com')
  await page.getByLabel('Password', { exact: true }).fill('secret8')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect.poll(() => byKind(page, 'login-submit')).toEqual([{
    kind: 'login-submit',
    payload: {
      credentials: { email: 'owner@example.com', password: 'secret8', country_phone_code: '', cellphone: '' },
      loginTab: 'email',
      otpState: '',
      otpType: 'email'
    }
  }])
  expect(await byKind(page, 'login-input')).toEqual([
    { kind: 'login-input', payload: { name: 'email', value: 'owner@example.com' } },
    { kind: 'login-input', payload: { name: 'password', value: 'secret8' } }
  ])
})

test('login switches between direct phone and both OTP targets without changing field contracts', async ({ page }) => {
  await page.goto(authUrl('login'))
  await methodTabs(page).filter({ hasText: 'Phone number' }).click()
  await expect(page.getByLabel('Phone number', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Email', { exact: true })).toHaveCount(0)
  await methodTabs(page).filter({ hasText: 'Email code' }).click()
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0)
  await methodTabs(page).filter({ hasText: 'Phone code' }).click()
  await expect(page.locator('.PhoneInputInput')).toBeVisible()
  await expect(page.getByLabel('Email', { exact: true })).toHaveCount(0)
  expect((await byKind(page, 'login-tab')).map(event => event.payload)).toEqual(['cellphone', 'otp', 'otp'])
  expect((await byKind(page, 'login-otp-type')).map(event => event.payload)).toEqual(['email', 'cellphone'])
})

test('six-digit OTP auto-submits and resend unlocks exactly at 520 seconds using the real countdown', async ({ page }) => {
  const fixedTime = new Date('2026-01-01T00:00:00Z')
  await page.clock.install({ time: fixedTime })
  await page.clock.pauseAt(fixedTime)
  await page.goto(authUrl('login'))
  await methodTabs(page).filter({ hasText: 'Email code' }).click()
  await page.getByLabel('Project', { exact: true }).fill('fixtureproject')
  await page.getByLabel('Email', { exact: true }).fill('otp@example.com')
  await page.getByRole('button', { name: 'Send code', exact: true }).click()
  const otpInputs = page.locator('.otp-input')
  await expect(otpInputs).toHaveCount(6)
  await expect(page.getByText('10:00', { exact: true })).toBeVisible()
  const resend = resendControl(page)
  await expect(resend).toBeDisabled()
  await page.clock.runFor(79000)
  await expect(page.getByText('8:41', { exact: true })).toBeVisible()
  await expect(resend).toBeDisabled()
  await page.clock.runFor(1000)
  await expect(page.getByText('8:40', { exact: true })).toBeVisible()
  await expect(resend).toBeEnabled()
  await resend.click()
  await expect(page.getByText('10:00', { exact: true })).toBeVisible()
  expect(await byKind(page, 'login-generate-otp')).toHaveLength(2)

  await otpInputs.first().click()
  await page.keyboard.type('123456')
  await expect.poll(() => byKind(page, 'login-submit')).toEqual([{
    kind: 'login-submit',
    payload: {
      credentials: { email: 'otp@example.com', password: '', country_phone_code: '', cellphone: '' },
      loginTab: 'otp',
      otpState: '123456',
      otpType: 'email'
    }
  }])
})

test('login popup/page and project-domain loading branches preserve tenant assets without external CAPTCHA', async ({ page }) => {
  await page.goto(authUrl('login'))
  let login = loginRoot(page)
  await expect(login).toHaveCSS('min-height', `${await page.evaluate(() => innerHeight)}px`)
  const logoSrc = `${process.env.BRAND_HARNESS_PRODUCTION === '1' ? '/pilot' : ''}/brand/ordering/1.3.0/assets/logos/ordering-lockup-color-on-dark.svg`
  // Brand panel logo and mobile logo both carry the tenant logo; the old hero image is gone in main.
  const logos = login.locator('img')
  await expect(logos).toHaveCount(2)
  for (const logo of await logos.all()) {
    await expect(logo).toHaveAttribute('src', logoSrc)
    await expect.poll(() => logo.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true)
  }
  const hero = login.locator('aside')
  await expect(hero).toBeVisible()
  await expect(hero.getByRole('listitem')).toHaveText(['Order', 'Store', 'Driver', 'Customer'])
  await expect(hero).toHaveCSS('background-image', 'none')
  // A tenant login background replaces the route and paints the panel.
  await page.goto(authUrl('login', `&loginBackground=${encodeURIComponent('/brand/ordering/1.3.0/assets/logos/ordering-lockup-color-on-dark.svg')}`))
  await expect(login.locator('aside')).toHaveCSS('background-image', /ordering-lockup-color-on-dark\.svg/)
  await expect(login.locator('aside').getByRole('listitem')).toHaveCount(0)
  await page.goto(authUrl('login'))

  await page.goto(authUrl('login', '&popup=1'))
  login = loginRoot(page)
  await expect(login).toHaveCSS('min-height', '500px')
  await page.goto(authUrl('login', '&domain=1&domainLoading=1'))
  await expect(page.locator('[data-slot="spinner-loader"]')).toBeVisible()
  await expect(loginRoot(page)).toHaveCount(0)
  await page.goto(authUrl('login', '&domain=1'))
  await expect(loginRoot(page)).toBeVisible()
  await expect(page.getByLabel('Project', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /partners portal/i })).toHaveCount(0)
  expect(await page.locator('iframe').count()).toBe(0)
})

test('forgot password validates locally and preserves success and error callback payloads', async ({ page }) => {
  await page.goto(authUrl('forgot'))
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click()
  // no dialog; each message under its field (aria-describedby) and the focus on the first field with an error
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await expect(page.locator('#forgot-project-error')).toContainText('Project is required')
  await expect(page.locator('#forgot-email-error')).toContainText('Email is required')
  await expect(page.getByLabel('Project', { exact: true })).toHaveAttribute('aria-describedby', 'forgot-project-error')
  expect(await byKind(page, 'forgot-submit')).toEqual([])
  await expect(page.getByLabel('Project', { exact: true })).toBeFocused()
  await page.getByLabel('Project', { exact: true }).fill('fixtureproject')
  await page.getByLabel('Email', { exact: true }).fill('recover@example.com')
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click()
  await expect.poll(async () => (await byKind(page, 'forgot-submit')).length).toBe(1)
  expect(await byKind(page, 'forgot-submit')).toEqual([{ kind: 'forgot-submit', payload: { email: 'recover@example.com' } }])
  const success = page.locator('form').getByRole('status')
  await expect(success).toContainText('If an account exists with this email, we\'ll send you a link to reset your password.')
  await expect(success).toBeFocused()
  await expect(page.getByRole('button', { name: 'Link sent', exact: true })).toBeDisabled()

  await page.goto(authUrl('forgot', '&outcome=error'))
  await page.getByLabel('Project', { exact: true }).fill('fixtureproject')
  await page.getByLabel('Email', { exact: true }).fill('error@example.com')
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click()
  await expect(page.locator('form').getByRole('alert')).toContainText('Fixture recovery error')
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await expect.poll(async () => (await byKind(page, 'forgot-submit')).length).toBe(1)
  expect(await byKind(page, 'forgot-submit')).toEqual([{ kind: 'forgot-submit', payload: { email: 'error@example.com' } }])
})

test('reset password preserves token/password success and missing-code redirect branches with callbacks', async ({ page }) => {
  await page.goto(authUrl('reset', '&tokens=present&resetProject=fixtureproject'))
  await expect(page.getByLabel('Project', { exact: true })).toHaveCount(0)
  await page.getByLabel('New password', { exact: true }).fill('newsecret8')
  await page.getByLabel('Confirm password', { exact: true }).fill('newsecret8')
  await page.getByRole('button', { name: 'Change password', exact: true }).click()
  await expect.poll(() => byKind(page, 'reset-submit')).toEqual([{
    kind: 'reset-submit',
    payload: { code: 'code-fixture-17', random: 'random-fixture-29', password: 'newsecret8', 'confirm-password': 'newsecret8' }
  }])
  // the success is a status notice in the form; its «Sign in» does what Accept did (the reset-complete callback)
  const success = page.locator('form').getByRole('status')
  await expect(success).toContainText('Password changed successfully')
  await expect(page.getByRole('button', { name: 'Change password', exact: true })).toBeDisabled()
  await success.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect.poll(() => byKind(page, 'reset-complete')).toEqual([{ kind: 'reset-complete' }])

  await page.goto(authUrl('reset', '&tokens=missing'))
  await page.getByLabel('Code', { exact: true }).fill('manual-code')
  await page.getByLabel('Verification code', { exact: true }).fill('manual-random')
  await page.getByRole('button', { name: 'Submit codes', exact: true }).click()
  await expect.poll(() => byKind(page, 'reset-redirect')).toEqual([{
    kind: 'reset-redirect',
    payload: { code: 'manual-code', random: 'manual-random', password: '' }
  }])
})

test('QueryLogin updates ConfigFileContext and remains a busy spinner without requesting a user', async ({ page }) => {
  await page.goto(authUrl('query', '&queryProject=query-tenant'))
  await expect(page.locator('[data-slot="spinner-loader"]')).toBeVisible()
  await expect(page.getByTestId('auth-config-state')).toContainText('"project":"query-tenant"')
  await expect.poll(() => byKind(page, 'config-update')).toEqual([{
    kind: 'config-update',
    payload: { billing_url: '/__brand-fixture__/auth/partners', project: 'query-tenant' }
  }])
})

for (const mode of ['light', 'dark']) {
  test(`auth controls keep readable ${mode} surfaces, semantic tabs and real keyboard focus`, async ({ page }, testInfo) => {
    // main's AuthLayout follows the OS scheme through prefers-color-scheme.
    await page.emulateMedia({ colorScheme: mode })
    await page.setViewportSize({ width: 1280, height: 820 })
    await page.goto(fixtureUrl(`surface=auth-forms&case=login&mode=${mode}`))
    const root = formRoot(page)
    const tabs = methodTabs(page)
    await expect(tabs).toHaveCount(4)
    await expect(tabs.first()).toHaveAttribute('aria-pressed', 'true')
    const project = page.getByLabel('Project', { exact: true })
    const email = page.getByLabel('Email', { exact: true })
    const password = page.getByLabel('Password', { exact: true })
    const toggle = root.getByRole('button', { name: 'Show password', exact: true })
    const submit = root.getByRole('button', { name: 'Sign in', exact: true })
    const recover = root.getByRole('link', { name: 'Recover access', exact: true })
    const signup = root.getByRole('link', { name: 'Create account', exact: true })
    await expect(recover).toHaveAttribute('href', '/forgot-password')
    await expect(signup).toHaveAttribute('href', '/signup')
    await expect(recover).not.toHaveAttribute('aria-disabled', 'true')
    await expect(signup).not.toHaveAttribute('aria-disabled', 'true')
    for (const target of [root.getByRole('heading', { name: 'Sign in to your dashboard', exact: true }), project, tabs.first(), tabs.nth(1), recover, signup]) {
      const colors = await effectiveColors(target)
      expect.soft(contrast(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5)
    }
    const iconColors = await effectiveColors(toggle.locator('svg'))
    expect.soft(contrast(iconColors.foreground, iconColors.background)).toBeGreaterThanOrEqual(3)
    await page.evaluate(() => document.activeElement?.blur())
    for (const target of [tabs.first(), project, email, password, toggle, submit]) {
      await focusByKeyboard(page, target)
      await expect(target).toHaveCSS('outline-color', rgb(tokens.theme[mode].semantic.action.focus))
    }
    await page.keyboard.press('Shift+Tab')
    await expect(toggle).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text')
    await page.screenshot({ path: testInfo.outputPath(`auth-login-${mode}.png`), fullPage: false })
  })
}

for (const width of [320, 390]) {
  test.describe(`auth at ${width}px coarse pointer`, () => {
    test.use({ viewport: { width, height: 760 }, hasTouch: true, isMobile: true })
    test('RTL login and six OTP cells stay inside the viewport with 44px controls', async ({ page }, testInfo) => {
      const fixedTime = new Date('2026-01-01T00:00:00Z')
      await page.emulateMedia({ colorScheme: 'dark' })
      await page.clock.install({ time: fixedTime })
      await page.clock.pauseAt(fixedTime)
      await page.goto(fixtureUrl('surface=auth-forms&case=login&mode=dark&rtl=true&locale=ar'))
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      const root = formRoot(page)
      // A-1: the controls were read right after the navigation, on a page still blank, so the loop measured nothing
      // and passed; it waits for the form, and it must see the show-password toggle (the control that used to be 36px).
      await expect(page.locator('#login-project')).toBeVisible()
      const toggle = root.getByRole('button', { name: 'إظهار كلمة المرور', exact: true })
      await expect(toggle).toBeVisible()
      await page.screenshot({ path: testInfo.outputPath(`auth-${width}-before.png`) })
      const targets = await root.locator('input:visible, button:visible').all()
      expect(targets.length).toBeGreaterThanOrEqual(8)
      for (const target of targets) {
        const box = await target.boundingBox()
        expect.soft(box.x).toBeGreaterThanOrEqual(0)
        expect.soft(box.x + box.width).toBeLessThanOrEqual(width)
        // The brand touch target is 44px for every control on a coarse pointer (the floor is not lowered to match a control).
        expect.soft(box.height, await target.getAttribute('aria-label') || await target.textContent()).toBeGreaterThanOrEqual(44)
      }
      await root.locator('[role="group"] button').nth(1).click()
      await page.locator('#login-project').fill('fixtureproject')
      await page.locator('#login-email').fill('mobile@example.com')
      await root.locator('form > button[type="submit"]').click()
      const otpGroup = root.locator('.otp-container')
      await expect(otpGroup.locator('input')).toHaveCount(6)
      const groupBox = await otpGroup.boundingBox()
      expect(groupBox.x).toBeGreaterThanOrEqual(0)
      expect(groupBox.x + groupBox.width).toBeLessThanOrEqual(width)
      for (const input of await otpGroup.locator('input').all()) {
        const box = await input.boundingBox()
        expect.soft(box.width).toBeGreaterThanOrEqual(44)
        expect.soft(box.height).toBeGreaterThanOrEqual(44)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      await page.screenshot({ path: testInfo.outputPath(`auth-${width}-after.png`) })
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
    })
  })
}

// Row #53: the method tabs are 44px on a coarse pointer even when every label fits on one line (en, 768px wide). The 390px
// case above passes with the tabs at 32px because the Arabic labels wrap onto two lines.
test.describe('auth method tabs at 768px coarse pointer, one-line labels', () => {
  test.use({ viewport: { width: 768, height: 900 }, hasTouch: true, isMobile: true })
  test('every method tab is at least 44px tall', async ({ page }) => {
    const fixedTime = new Date('2026-01-01T00:00:00Z')
    await page.clock.install({ time: fixedTime })
    await page.clock.pauseAt(fixedTime)
    await page.goto(authUrl('login'))
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
    await expect(methodTabs(page)).toHaveText(['Password', 'Email code', 'Phone code', 'Phone number'])
    for (const tab of await methodTabs(page).all()) {
      const box = await tab.boundingBox()
      expect.soft(box.height, await tab.textContent()).toBeGreaterThanOrEqual(44)
    }
  })
})

test('Dark OTP digits retain contrast and a visible keyboard focus indicator', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto(fixtureUrl('surface=auth-forms&case=login&mode=dark&initialTab=otp&initialOtpType=email'))
  await page.getByLabel('Project', { exact: true }).fill('fixtureproject')
  await page.getByLabel('Email', { exact: true }).fill('otp-focus@example.com')
  await page.getByRole('button', { name: 'Send code', exact: true }).click()
  const digits = page.locator('.otp-input')
  await expect(digits).toHaveCount(6)
  await digits.first().click()
  await page.keyboard.type('12')
  await page.keyboard.press('Shift+Tab')
  await expect(digits.nth(1)).toBeFocused()
  await expect(digits.first()).toHaveValue('1')
  const colors = await effectiveColors(digits.first())
  expect.soft(contrast(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5)
  const focus = await digits.nth(1).evaluate(element => {
    const style = getComputedStyle(element)
    return { style: style.outlineStyle, width: parseFloat(style.outlineWidth), color: style.outlineColor, background: style.backgroundColor }
  })
  expect.soft(focus.style).not.toBe('none')
  expect.soft(focus.width).toBeGreaterThanOrEqual(2)
  expect.soft(contrast(focus.color, focus.background)).toBeGreaterThanOrEqual(3)
})
