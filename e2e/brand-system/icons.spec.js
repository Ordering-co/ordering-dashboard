import { test, expect, fixtureUrl } from './fixtures'

for (const mode of ['light', 'dark']) {
  test(`Lucide ${mode} icons preserve glyph size, stroke and accessible naming`, async ({ page }) => {
    await page.goto(fixtureUrl(`surface=icons&mode=${mode}`))
    const glyph = page.getByTestId('decorative-icon').locator('svg')
    await expect(glyph).toHaveAttribute('aria-hidden', 'true')
    await expect(glyph).toHaveCSS('width', '16px')
    await expect(glyph).toHaveCSS('height', '16px')
    await expect(glyph).toHaveCSS('stroke-width', '1.75px')
    await expect(glyph).toHaveCSS('fill', 'none')
    await expect(glyph).toHaveCSS('stroke', mode === 'light' ? 'rgb(11, 12, 13)' : 'rgb(255, 255, 255)')
    await expect(page.getByRole('img', { name: 'Close preview' })).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Search orders' })).toBeFocused()
  })

  test(`reviewed SearchBar ${mode} import preserves input and clear callbacks`, async ({ page }) => {
    await page.goto(fixtureUrl(`surface=icons&mode=${mode}`))
    const consumer = page.getByTestId('search-consumer')
    const input = page.getByPlaceholder('Search test records')
    const glyph = consumer.locator('svg')
    await expect(glyph).toHaveCSS('width', '16px')
    await expect(glyph).toHaveCSS('height', '16px')
    await expect(glyph).toHaveAttribute('stroke-width', '1.75')
    await expect(glyph).toHaveAttribute('aria-hidden', 'true')
    await input.fill('Cafe')
    await expect(page.getByTestId('search-value')).toHaveText('"Cafe"')
    await consumer.getByRole('button', { name: 'Clear search', exact: true }).click()
    await expect(input).toHaveValue('')
    await expect(page.getByTestId('search-value')).toHaveText('""')
    await expect(consumer.locator('svg')).toHaveAttribute('stroke-width', '1.75')
  })
}
