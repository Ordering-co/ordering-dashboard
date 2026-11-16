import { resolve } from 'node:path'
import { test, expect, fixtureUrl } from './fixtures'
import { tokens } from '../../src/brand/ordering.tokens.generated'

// a baseline capture's screenshots go to the git-ignored .local/redesign-evidence/ (the L0/L1 evidence is in
// the tag archive/redesign-evidence-2026-10-27).
const evidence = resolve('.local/redesign-evidence/brand-system/l0-l1')
const rgb = hex => `rgb(${hex.slice(1).match(/../g).map(part => parseInt(part, 16)).join(', ')})`
const luminance = hex => hex.slice(1).match(/../g).map(part => parseInt(part, 16) / 255)
  .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)

for (const mode of ['light', 'dark']) {
  for (const density of ['full', 'light']) {
    for (const rtl of [false, true]) {
      for (const width of [1440, 390, 320]) {
        for (const reduced of [false, true]) {
          test(`pilot ${mode} ${density} ${rtl ? 'RTL' : 'LTR'} ${width} ${reduced ? 'reduced' : 'motion'}`, async ({ page }, testInfo) => {
            const errors = []
            page.on('pageerror', error => errors.push(error.message))
            await page.setViewportSize({ width, height: 900 })
            await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference', colorScheme: mode })
            await page.goto(fixtureUrl(`pilot=${mode}&density=${density}&rtl=${rtl}`))
            const status = page.getByRole('status')
            await expect(status).toHaveAttribute('aria-busy', 'true')
            await expect(status).toHaveAttribute('aria-live', 'polite')
            await expect(status).toHaveCSS('background-color', rgb(tokens.theme[mode].semantic.background))
            await expect(status).toHaveCSS('color', rgb(tokens.theme[mode].semantic.text.default))
            await expect(status).toHaveCSS('font-size', tokens.font.size.productUi)
            await page.evaluate(() => document.fonts.ready)
            expect(await status.evaluate(element => getComputedStyle(element).fontFamily)).toContain('Ordering Inter Local')
            expect(await page.evaluate(() => document.fonts.check('13px "Ordering Inter Local"'))).toBe(true)
            await expect(page.getByTestId('boot-sidebar-nav').locator(':scope > *')).toHaveCount(10)
            await expect(page.getByTestId(density === 'full' ? 'boot-chart' : 'boot-metrics')).toBeVisible()
            await expect(page.getByTestId(density === 'full' ? 'boot-metrics' : 'boot-chart')).toHaveCount(0)
            if (width >= 768) {
              await expect(page.getByTestId('boot-sidebar')).toBeVisible()
              await expect(page.getByTestId('boot-sidebar')).toHaveCSS(rtl ? 'border-left-width' : 'border-right-width', '1px')
            } else await expect(page.getByTestId('boot-sidebar')).toBeHidden()
            const bone = page.getByTestId('boot-welcome').locator('[class*="Bone"]').first()
            await expect(bone).toHaveCSS('background-color', rgb(tokens.theme[mode].semantic.border.default))
            const animation = await bone.evaluate(element => getComputedStyle(element, '::after').animationName)
            expect(animation === 'none').toBe(reduced)
            await expect(page.getByTestId('boot-welcome')).toHaveCSS('border-radius', tokens.radius.panel)
            const geometry = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: innerWidth }))
            expect(geometry.scroll).toBeLessThanOrEqual(geometry.viewport)
            expect(await status.locator('button, a, input, [tabindex]').count()).toBe(0)
            const a = luminance(tokens.theme[mode].semantic.background)
            const b = luminance(tokens.theme[mode].semantic.text.default)
            expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toBeGreaterThanOrEqual(4.5)
            expect(errors).toEqual([])
            if (!rtl && reduced && width !== 320) {
              const name = `pilot-${mode}-${density}-${width}.png`
              await page.screenshot({ path: process.env.BRAND_CAPTURE_BASELINE === '1' ? resolve(evidence, name) : testInfo.outputPath(name), fullPage: true })
            }
          })
        }
      }
    }
  }
}

for (const locale of ['en', 'es', 'fr', 'it', 'de', 'pt', 'da', 'nl', 'ar', 'el', 'bg', 'tr']) {
  test(`existing loading contract under locale ${locale}`, async ({ page }) => {
    await page.goto(fixtureUrl(`pilot=light&locale=${locale}&rtl=${locale === 'ar'}`))
    await expect(page.locator('html')).toHaveAttribute('lang', locale)
    await expect(page.getByRole('status')).toHaveText('Loading dashboard')
  })
}

for (const [auth, persisted, full] of [['true', 'false', true], ['false', 'true', false], ['pending', 'true', true], ['pending', 'false', false]]) {
  test(`session density ${auth} persisted=${persisted}`, async ({ page }) => {
    await page.goto(fixtureUrl(`pilot=light&auth=${auth}&persisted=${persisted}`))
    await expect(page.getByTestId(full ? 'boot-chart' : 'boot-metrics')).toBeVisible()
  })
}

for (const mode of ['light', 'dark']) {
  test(`pilot ${mode} supports 200 percent CSS zoom`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(fixtureUrl(`pilot=${mode}&density=full`))
    await page.evaluate(() => { document.documentElement.style.zoom = '2' })
    await expect(page.getByRole('status')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const name = `pilot-${mode}-zoom200.png`
    await page.screenshot({ path: process.env.BRAND_CAPTURE_BASELINE === '1' ? resolve(evidence, name) : testInfo.outputPath(name), fullPage: true })
  })
}
