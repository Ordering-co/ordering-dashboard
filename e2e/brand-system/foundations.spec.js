import { test, expect, fixtureUrl } from './fixtures'

for (const mode of ['light', 'dark']) {
  test(`mounted ${mode} tenant font changes reconcile owned stylesheets`, async ({ page }) => {
    // Synthetic stylesheets: no Google request or unverified font is fetched.
    const requests = []
    await page.route('https://fonts.googleapis.com/**', async route => {
      requests.push(route.request().url())
      await route.fulfill({ contentType: 'text/css', body: '/* isolated tenant font fixture */' })
    })
    await page.goto(fixtureUrl(`surface=foundations&mode=${mode}`))
    await page.getByLabel('Fixture field').fill('Typed before theme update')
    await page.getByRole('button', { name: 'Apply first fixture font' }).click()
    await expect(page.locator('#primary-font-styles')).toHaveAttribute('href', /Fixture(?:\+|%20| )Tenant(?:\+|%20| )One/)
    await expect(page.locator('body')).toHaveCSS('font-family', /Fixture Tenant One/)
    await page.getByRole('button', { name: 'Toggle fixture direction' }).click()
    await page.getByRole('button', { name: 'Apply second fixture font' }).click()
    await expect(page.locator('#primary-font-styles')).toHaveCount(1)
    await expect(page.locator('#primary-font-styles')).toHaveAttribute('href', /Fixture(?:\+|%20| )Tenant(?:\+|%20| )Two/)
    await expect(page.locator('body')).toHaveCSS('font-family', /Fixture Tenant Two/)
    await page.getByRole('button', { name: 'Restore local fixture fonts' }).click()
    await expect(page.locator('#primary-font-styles')).toHaveCount(0)
    await expect(page.locator('body')).toHaveCSS('font-family', /Ordering Inter Local/)
    await expect(page.getByLabel('Fixture field')).toHaveValue('Typed before theme update')
    await expect(page.locator('body')).toHaveCSS('direction', 'rtl')
    expect(requests).toHaveLength(2)
  })

  test(`boot ${mode} renders RTL and tenant color together`, async ({ page }) => {
    await page.goto(fixtureUrl(`surface=coordination&mode=${mode}`))
    await expect(page.getByTestId('coordinated-ready')).toHaveText('true')
    await expect(page.locator('body')).toHaveCSS('direction', 'rtl')
    await expect(page.getByRole('button', { name: 'Coordinated appearance' })).toHaveCSS('background-color', 'rgb(18, 52, 86)')
  })

  test(`local ${mode} fonts and theme survive tenant update and RTL merge`, async ({ page }) => {
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(fixtureUrl(`surface=foundations&mode=${mode}`))
    await expect(page.getByTestId('foundations')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    const before = await page.evaluate(() => ({
      font: getComputedStyle(document.body).fontFamily,
      mono: getComputedStyle(document.querySelector('code')).fontFamily,
      background: getComputedStyle(document.body).backgroundColor,
      face: [...document.fonts].some(font => font.family === 'Ordering Inter Local' && font.status === 'loaded'),
      remote: [...document.querySelectorAll('link')].some(link => link.href.includes('fonts.googleapis.com')),
      variable: getComputedStyle(document.documentElement).getPropertyValue('--od-bg').trim()
    }))
    expect(before.font).toContain('Ordering Inter Local')
    expect(before.mono).toContain('Ordering JetBrains Mono Local')
    expect(before.face).toBe(true)
    expect(before.remote).toBe(false)
    expect(before.background).toBe(mode === 'light' ? 'rgb(255, 255, 255)' : 'rgb(11, 12, 13)')
    expect(before.variable).toBe(mode === 'light' ? '#FFFFFF' : '#0B0C0D')
    await page.getByRole('button', { name: 'Apply fixture tenant' }).click()
    await expect(page.getByTestId('tenant-primary')).toHaveText('#123456')
    await page.getByRole('heading').hover()
    await expect(page.getByRole('button', { name: 'Apply fixture tenant' })).toHaveCSS('background-color', 'rgb(18, 52, 86)')
    await page.getByRole('button', { name: 'Toggle fixture direction' }).click()
    await expect(page.locator('body')).toHaveCSS('direction', 'rtl')
    await expect(page.getByLabel('Fixture field')).toHaveValue('Preserved value')
    expect(errors).toEqual([])
  })
}
