import { test, expect } from './fixtures'

for (const width of [1440, 390]) {
  test(`review explains the persistent loader and switches variants at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/scripts/brand-system/harness/review.html')
    await expect(page.getByRole('heading', { name: 'Pantalla de carga · Piloto L1' })).toBeVisible()
    await expect(page.getByText('La animación permanece visible y no abre el dashboard.', { exact: false })).toBeVisible()
    await expect(page.getByRole('status')).toHaveText('Demostración cargada. Los bloques animados son el resultado esperado.')
    await page.getByRole('button', { name: 'Oscuro', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Oscuro', exact: true })).toHaveAttribute('aria-pressed', 'true')
    const frame = page.frameLocator('iframe')
    await expect(frame.getByTestId('boot-home')).toHaveCSS('background-color', 'rgb(11, 12, 13)')
    await page.getByRole('button', { name: 'Sin sesión', exact: true }).click()
    await expect(frame.getByTestId('boot-metrics')).toBeVisible()
    await expect(frame.getByTestId('boot-chart')).toHaveCount(0)
    await expect(page.getByRole('status')).toHaveText('Demostración cargada. Los bloques animados son el resultado esperado.')
    await page.getByRole('button', { name: 'Claro', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(frame.getByTestId('boot-home')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test('review reports a failed specimen and recovers through retry', async ({ page }) => {
  const specimenUrl = '**/harness/index.html?*'
  await page.route(specimenUrl, route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }))
  await page.goto('/scripts/brand-system/harness/review.html')
  await expect(page.getByRole('status')).toHaveText('No se pudo mostrar la demostración. Puedes volver a cargarla.', { timeout: 15000 })
  await page.unroute(specimenUrl)
  await page.getByRole('button', { name: 'Volver a cargar' }).click()
  await expect(page.getByRole('status')).toHaveText('Demostración cargada. Los bloques animados son el resultado esperado.')
  await expect(page.getByRole('button', { name: 'Volver a cargar' })).toBeHidden()
})
