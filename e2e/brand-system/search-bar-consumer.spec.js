// redesign 5.1 copy: labels in sentence case (C14), approved with the catalog sync on 2026-10-06.
import { test, expect, fixtureUrl } from './fixtures'
import { tokens, variables } from '../../src/brand/ordering.tokens.generated'

const rgb = hex => `rgb(${hex.slice(1).match(/../g).map(part => parseInt(part, 16)).join(', ')})`
const searchInput = page => page.getByPlaceholder('External ID', { exact: true })
// redesign 5.2: the external-id input no longer sits inline in the header. It is the picker
// of the "External ID" filter pill (FilterPopover), so every check opens the pill first.
const externalIdPill = page => page.getByRole('button', { name: /^External ID/ })
const externalIdPopover = page => page.getByRole('dialog', { name: 'External ID' })
const openExternalId = async page => {
  const pill = externalIdPill(page)
  await expect(pill).toHaveAttribute('aria-haspopup', 'dialog')
  await expect(pill).toHaveAttribute('aria-expanded', 'false')
  await pill.click()
  await expect(pill).toHaveAttribute('aria-expanded', 'true')
  const popover = externalIdPopover(page)
  await expect(popover).toBeVisible()
  // The popover animates in; measure it only once it has settled (the old inline input never moved).
  await popover.evaluate(async element => {
    const animations = element.getAnimations({ subtree: true }).filter(animation => Number.isFinite(animation.effect.getComputedTiming().endTime))
    await Promise.all(animations.map(animation => animation.finished.catch(() => {})))
  })
  return searchInput(page)
}

test('OrdersHeaderFilterGroup keeps its native custom Input and external scalar-to-event debounce', async ({ page }) => {
  await page.goto(fixtureUrl('surface=search-bar-consumer&mode=light'))
  // redesign 5.2: closed, the filter is only its pill; the input is not in the page.
  await expect(searchInput(page)).toHaveCount(0)
  const input = await openExternalId(page)
  await expect(input).toBeVisible()
  await expect(input).toHaveAttribute('data-slot', 'input')
  await expect(input).toHaveAttribute('type', 'text')
  await expect(input).toHaveAttribute('name', 'search')
  await expect(input).toHaveAttribute('autocomplete', 'off')
  expect(await input.evaluate(element => element.tagName)).toBe('INPUT')
  expect(await input.evaluate(element => element.closest('form') === null)).toBe(true)
  await expect(page.locator('.external_id')).toHaveCount(1)
  await expect(page.locator('.external_id > svg')).toHaveCount(0)

  await input.fill('ORDER-EXT-900')
  await expect(input).toHaveValue('ORDER-EXT-900')
  await page.waitForTimeout(700)
  await expect(page.getByTestId('orders-header-filter-value')).not.toContainText('ORDER-EXT-900')
  await page.waitForTimeout(100)
  await expect(page.getByTestId('orders-header-filter-value')).toContainText('"externalId":"ORDER-EXT-900"')
  await expect(page.getByTestId('orders-header-filter-events')).toContainText('"externalId":"ORDER-EXT-900"')
  // redesign 5.2: the pill carries the value the input just sent.
  await expect(externalIdPill(page)).toContainText('ORDER-EXT-900')

  const clear = page.getByRole('button', { name: 'Clear search', exact: true })
  await expect(clear).toHaveAttribute('type', 'button')
  await clear.click()
  await expect(input).toHaveValue('')
  await expect(input).toBeFocused()
  await expect(page.getByTestId('orders-header-filter-value')).toContainText('"externalId":""')
  await expect(externalIdPill(page)).not.toContainText('ORDER-EXT-900')
})

test('a truthy external filter is reflected in the SearchBar DOM value when the input is not being typed in', async ({ page }) => {
  await page.goto(fixtureUrl('surface=search-bar-consumer&mode=light'))
  // redesign 5.2: the popover is closed when the external filter arrives; the pill shows it and
  // the input mounts already holding it when the popover opens.
  await expect(externalIdPill(page)).not.toContainText('REMOTE-42')
  await page.getByRole('button', { name: 'Apply external filter', exact: true }).click()
  await expect(page.getByTestId('orders-header-filter-value')).toContainText('"externalId":"REMOTE-42"')
  await expect(page.getByTestId('orders-header-filter-events')).toContainText('"externalId":"REMOTE-42"')
  await expect(externalIdPill(page)).toContainText('REMOTE-42')
  const input = await openExternalId(page)
  // Main (804768e2, ): an external search is shown in the input unless the user is typing in it.
  await expect(input).toHaveValue('REMOTE-42')
  // redesign 5.2: the old `not.toBeFocused()` is gone on purpose. The popover moves focus into its
  // input when it opens (Base UI), so "mounted, holding the value, unfocused" no longer exists; the
  // guarantee that survives is that the value arrives in the input the user opens.
  await expect(input).toBeFocused()
})

for (const mode of ['light', 'dark']) {
  test(`OrdersHeaderFilterGroup keeps the governed-height SearchBar in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(fixtureUrl(`surface=search-bar-consumer&mode=${mode}`))
    const input = await openExternalId(page)
    // redesign 5.2: the legacy header wrapper pinned this input to 47px; in the filter-bar popover
    // it is the governed control height (--od-control-height, 32px on a fine pointer).
    await expect(input).toHaveCSS('height', variables.root['--od-control-height'])
    await expect(input).toHaveCSS('background-color', rgb(tokens.theme[mode].semantic.surface.default))
    await input.focus()
    await expect(input).toHaveCSS('outline-width', tokens.component.focusRing.width)
    await expect(input).toHaveCSS('outline-offset', tokens.component.focusRing.offset)
    await input.fill('Visible search')
    await expect(page.getByTestId('orders-header-filter-value')).toContainText('Visible search')
    // redesign 5.2: the evidence frame is the popover that holds the input.
    const row = externalIdPopover(page)
    await row.evaluate(async element => {
      const animations = element.getAnimations({ subtree: true }).filter(animation => Number.isFinite(animation.effect.getComputedTiming().endTime))
      await Promise.all(animations.map(animation => animation.finished.catch(() => {})))
    })
    await row.screenshot({ path: testInfo.outputPath(`orders-search-${mode}.png`) })
  })
}

test('OrdersHeaderFilterGroup keeps canonical focus while retaining the tenant action value', async ({ page }) => {
  await page.goto(fixtureUrl('surface=search-bar-consumer&mode=light&tenant=%23123456'))
  const input = await openExternalId(page)
  await input.focus()
  await expect(input).toHaveCSS('outline-color', rgb(tokens.theme.light.semantic.action.focus))
  expect(await input.evaluate(element => getComputedStyle(element).getPropertyValue('--od-field-action').trim())).toBe('#123456')
})

test.describe('OrdersHeaderFilterGroup at 320px RTL', () => {
  test.use({ viewport: { width: 320, height: 760 }, hasTouch: true, isMobile: true })

  test('keeps the custom search and clear control reachable without page overflow', async ({ page }, testInfo) => {
    await page.goto(fixtureUrl('surface=search-bar-consumer&mode=dark&rtl=true'))
    const input = await openExternalId(page)
    const row = page.getByTestId('orders-header-search-row')
    const popover = externalIdPopover(page)
    const rowBefore = await row.boundingBox()
    // redesign 5.2: the clear control lives in the popover now, so the "row must not reflow"
    // guarantee is measured on the popover too (and it must fit the 320px viewport).
    const popoverBefore = await popover.boundingBox()
    expect(popoverBefore.x).toBeGreaterThanOrEqual(0)
    expect(popoverBefore.x + popoverBefore.width).toBeLessThanOrEqual(320)
    const box = await input.boundingBox()
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
    await input.fill('معرف-طلب-طويل-للغاية-RTL-SEARCH-1234567890')
    await page.waitForTimeout(800)
    const clear = page.getByRole('button', { name: 'Clear search', exact: true })
    // redesign 5.2: the old header wrapper pinned the inset to 8px; the shared SearchBar's own inset
    // is 15px. What must hold is that it stays inside the input at the inline end (asserted below).
    expect(parseFloat(await clear.evaluate(element => getComputedStyle(element).left))).toBeLessThanOrEqual(15)
    const clearBox = await clear.boundingBox()
    expect(clearBox.width).toBeGreaterThanOrEqual(44)
    expect(clearBox.height).toBeGreaterThanOrEqual(44)
    expect(clearBox.x).toBeGreaterThanOrEqual(box.x)
    expect(clearBox.x + clearBox.width).toBeLessThanOrEqual(box.x + box.width)
    const inlineEndGeometry = await input.evaluate((element, clearElement) => {
      const inputBox = element.getBoundingClientRect()
      const clearBox = clearElement.getBoundingClientRect()
      const style = getComputedStyle(element)
      return {
        contentStart: inputBox.left + parseFloat(style.paddingLeft),
        clearEnd: clearBox.right
      }
    }, await clear.elementHandle())
    expect(inlineEndGeometry.contentStart - inlineEndGeometry.clearEnd, 'RTL text content stays clear of the inline-end action').toBeGreaterThanOrEqual(4)
    const rowAfter = await row.boundingBox()
    expect(Math.abs(rowAfter.height - rowBefore.height), 'showing clear for long text must not reflow the 320px row').toBeLessThan(0.5)
    const popoverAfter = await popover.boundingBox()
    expect(Math.abs(popoverAfter.height - popoverBefore.height), 'showing clear for long text must not reflow the 320px popover').toBeLessThan(0.5)
    expect(popoverAfter.x + popoverAfter.width).toBeLessThanOrEqual(320)
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
    await popover.screenshot({ path: testInfo.outputPath('orders-search-rtl320.png') })
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
    const geometry = await page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth, dir: document.documentElement.dir }))
    expect(geometry.dir).toBe('rtl')
    expect(geometry.scroll).toBeLessThanOrEqual(geometry.viewport)
    // redesign 5.2: a long value in the pill made the layout viewport grow (innerWidth 493), which
    // let the comparison above pass vacuously; the viewport must still be the 320px that was set.
    expect(geometry.viewport).toBe(320)
  })
})
