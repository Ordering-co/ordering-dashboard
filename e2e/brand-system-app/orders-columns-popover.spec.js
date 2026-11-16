import {
  expect,
  installAppNetworkBoundary,
  installSyntheticSession,
  test
} from './fixtures'

// redesign 5.2: the column manager of /orders is the Product `ColumnManager` (a Base UI popover,
// role=dialog titled "Columns", one `.odc-cm-row` per column), not `ColumnAllowSettingPopover`.
// This spec is the D2 regression ("the popover measures its content and can be used") measured on it.
// The row target sizes come from the governed tokens: --od-x-control-height on a fine pointer and
// --od-x-target-coarse (44px) on a coarse one (C3), read from the page instead of written here.

const measure = page => page.evaluate(() => {
  const box = element => {
    const { x, y, width, height } = element.getBoundingClientRect()
    return { x, y, width, height, right: x + width, bottom: y + height }
  }
  const root = getComputedStyle(document.documentElement)
  const token = name => parseFloat(root.getPropertyValue(name))
  const panel = document.querySelector('.odc-cm-popup')
  const trigger = document.querySelector('button[aria-label="Manage columns"][aria-expanded="true"]')
  const rows = [...panel.querySelectorAll('.odc-cm-row')]
  const first = rows[0]
  const hit = document.elementFromPoint(box(first).x + 20, box(first).y + box(first).height / 2)
  return {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    coarse: matchMedia('(pointer: coarse)').matches,
    tokens: { fine: token('--od-x-control-height'), coarse: token('--od-x-target-coarse') },
    panel: {
      ...box(panel),
      scrollHeight: panel.scrollHeight,
      clientHeight: panel.clientHeight,
      position: getComputedStyle(panel.parentElement).position,
      whiteSpace: getComputedStyle(panel).whiteSpace
    },
    trigger: box(trigger),
    rows: rows.map(row => ({
      ...box(row),
      position: getComputedStyle(row).position,
      overflowX: row.scrollWidth - row.clientWidth,
      label: row.textContent.trim()
    })),
    firstRowOnTop: panel.contains(hit)
  }
})

for (const viewport of [
  { name: 'tall desktop', width: 1440, height: 1300 },
  { name: 'short desktop', width: 1440, height: 900 },
  // redesign 5.2: the new rows are 32px, so the 592px list fits at 900px; this height is the one
  // that keeps the "short viewport scrolls inside itself" half of the regression meaningful.
  { name: 'very short desktop', width: 1440, height: 600, scrolls: true },
  // redesign 5.2: the 44px row target is a coarse-pointer rule (C3), so it is measured with a touch tablet.
  { name: 'touch tablet', width: 820, height: 1180, touch: true }
]) {
  test.describe(`Orders "Manage columns" on a ${viewport.name} viewport`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: Boolean(viewport.touch), isMobile: Boolean(viewport.touch) })

    test(`Orders "Manage columns" opens as a readable anchored list on a ${viewport.name} viewport`, async ({ context, page }) => {
      test.setTimeout(120000)
      await installAppNetworkBoundary(context, { scenario: 'populated' })
      await installSyntheticSession(context, { authenticated: true })
      await page.goto('/orders', { waitUntil: 'domcontentloaded' })

      // redesign 5.2: rows load on the status, which every width keeps (the business column does not).
      await expect(page.locator('tbody tr').filter({ hasText: '910001' }).first()).toContainText('Pending', { timeout: 90000 })
      const accept = page.getByRole('button', { name: 'Accept', exact: true })
      if (await accept.count()) await accept.last().click()

      const trigger = page.getByRole('button', { name: 'Manage columns', exact: true })
      await trigger.click()
      const panel = page.getByRole('dialog', { name: 'Columns' })
      await expect(panel).toBeVisible()
      await expect(trigger).toHaveAttribute('aria-expanded', 'true')
      await expect(panel.getByRole('checkbox')).not.toHaveCount(0)
      await expect(panel.getByRole('button', { name: 'Reset' })).toBeVisible()
      // The popover animates in; measure it once it has settled.
      await panel.evaluate(async element => {
        const animations = element.getAnimations({ subtree: true }).filter(animation => Number.isFinite(animation.effect.getComputedTiming().endTime))
        await Promise.all(animations.map(animation => animation.finished.catch(() => {})))
      })

      const result = await measure(page)
      const { panel: box, rows, trigger: anchor, viewport: screen } = result
      const longest = Math.max(...rows.map(row => row.label.length))
      const rowMin = viewport.touch ? result.tokens.coarse : result.tokens.fine
      expect(result.coarse, 'pointer type of the viewport').toBe(Boolean(viewport.touch))
      expect(rowMin).toBeGreaterThan(0)

      // Several rows, one per line: a collapsed panel stacks them all at one y.
      expect(rows.length).toBeGreaterThan(5)
      expect(longest).toBeGreaterThan(0)
      rows.forEach((row, index) => {
        expect(row.position, `${row.label} stays in flow`).toBe('static')
        expect(row.height, `${row.label} meets the ${rowMin}px row target`).toBeGreaterThanOrEqual(rowMin)
        expect(row.overflowX, `${row.label} is not cropped horizontally`).toBeLessThanOrEqual(0)
        expect(row.width, `${row.label} fits inside the panel`).toBeLessThanOrEqual(box.width)
        if (index > 0) expect(row.y, `${row.label} sits below the previous row`).toBeGreaterThanOrEqual(rows[index - 1].bottom - 1)
      })
      if (viewport.touch) {
        expect(anchor.width, 'trigger width on a coarse pointer').toBeGreaterThanOrEqual(result.tokens.coarse)
        expect(anchor.height, 'trigger height on a coarse pointer').toBeGreaterThanOrEqual(result.tokens.coarse)
      }

      // The panel measures its content instead of the old 100x32 box.
      expect(box.width).toBeGreaterThan(rows[0].width)
      expect(box.scrollHeight).toBeGreaterThanOrEqual(rows.length * rowMin)
      expect(box.height).toBeGreaterThanOrEqual(Math.min(rows.length * rowMin, 400))
      expect(box.whiteSpace).toBe('normal')
      // It used to be position: fixed; the Base UI positioner is absolute (or fixed) in a body-level portal.
      expect(['absolute', 'fixed']).toContain(box.position)

      // Inside the viewport, anchored under the trigger, and above the table header.
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.y).toBeGreaterThanOrEqual(0)
      expect(box.right).toBeLessThanOrEqual(screen.width)
      expect(box.bottom).toBeLessThanOrEqual(screen.height)
      expect(box.y).toBeGreaterThanOrEqual(anchor.bottom)
      expect(Math.abs(box.right - anchor.right)).toBeLessThanOrEqual(2)
      expect(result.firstRowOnTop).toBe(true)

      if (viewport.scrolls) {
        // Shorter than the list: the panel scrolls inside itself and still reaches the last row.
        expect(box.scrollHeight).toBeGreaterThan(box.clientHeight)
        await panel.locator('.odc-cm-row').last().scrollIntoViewIfNeeded()
        await expect(panel.locator('.odc-cm-row').last()).toBeInViewport({ ratio: 0.9 })
      } else if (viewport.height >= 1300) {
        // Tall enough for the whole list: no inner scrolling, every row visible.
        expect(box.clientHeight).toBe(box.scrollHeight)
        expect(rows.at(-1).bottom).toBeLessThanOrEqual(box.bottom)
      } else {
        // Short viewport: the panel still reaches the last row.
        await panel.locator('.odc-cm-row').last().scrollIntoViewIfNeeded()
        await expect(panel.locator('.odc-cm-row').last()).toBeInViewport({ ratio: 0.9 })
      }

      await page.keyboard.press('Escape')
      await expect(panel).toBeHidden()
      await expect(trigger).toBeFocused()
    })
  })
}
