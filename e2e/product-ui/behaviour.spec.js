// Product wrappers in a real browser (orders pilot, wave 4): keyboard, focus,
// touch targets, axe and the layout requirements that jsdom cannot measure.
//   pnpm ui:test:browser
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { expectTouchTarget, ONE_CONTROL_FRAME, TARGET_FRAME, touchTargetProblems } from '../touch-target'

const GALLERY = '/scripts/product-ui/gallery.html'
const open = async (page, query = '') => {
  const errors = []
  page.on('pageerror', error => errors.push(String(error)))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(`${GALLERY}${query}`)
  await page.getByRole('heading', { name: 'Product wrappers' }).waitFor()
  await page.evaluate(() => document.fonts.ready)
  return errors
}

const seriousViolations = async page => {
  const { violations } = await new AxeBuilder({ page }).analyze()
  return violations
    .filter(violation => ['serious', 'critical'].includes(violation.impact))
    .map(violation => `${violation.id}: ${violation.nodes.map(node => node.target.join(' ')).join(' | ')}`)
}

// redesign W0 T0-45 (W0-E-02, W0-PB4-03): the «step-boundary» section of the gallery (StepBoundaryDemo, `report={false}`) throws on purpose
// from <Boom> to show «Try again». React logs that one error as the exception itself ('Error: Step failed', twice: console and window)
// and as its own message naming the <Boom> component inside StepBoundaryDemo. Those, and only those, are expected; anything else still fails.
const isDemoError = text => text === 'Error: Step failed' ||
  (text.startsWith('The above error occurred in the <Boom> component:') && text.includes('at StepBoundaryDemo') && text.includes('at StepBoundary '))

for (const [theme, dir] of [['light', 'ltr'], ['dark', 'ltr'], ['light', 'rtl'], ['dark', 'rtl']]) {
  test(`gallery has no console errors and no serious axe violations (${theme}, ${dir})`, async ({ page }) => {
    const errors = await open(page, `?theme=${theme}&dir=${dir}`)
    expect(await seriousViolations(page)).toEqual([])
    // The demo throws once on load: at most its three messages are ignored, so a second throw cannot hide behind them.
    expect(errors.filter(isDemoError).length).toBeLessThanOrEqual(3)
    expect(errors.filter(text => !isDemoError(text))).toEqual([])
  })
}

test('open overlays and popups have no serious axe violations, light and dark', async ({ page }) => {
  for (const theme of ['light', 'dark']) {
    await open(page, `?theme=${theme}`)
    await page.getByTestId('open-confirm').click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
    await page.keyboard.press('Escape')
    await page.getByTestId('open-sheet').click()
    await expect(page.getByRole('dialog', { name: 'Filters' })).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
    await page.keyboard.press('Escape')
    await page.locator('#columns').getByRole('button', { name: 'Manage columns' }).click()
    await expect(page.getByRole('dialog', { name: 'Columns' })).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
    await page.keyboard.press('Escape')
  }
})

// Base UI's checkbox keeps a 1px visually hidden native input next to the button: it is not a target.
const TARGETS = 'button:visible, [role="checkbox"]:visible, [role="tab"]:visible, summary:visible, select:visible, input:not([aria-hidden="true"]):not([type="checkbox"]):visible'

test('every control reaches 24×24 with a fine pointer', async ({ page }) => {
  await open(page)
  const small = await page.locator(TARGETS).evaluateAll(nodes => nodes
    .map(node => ({ node, box: node.getBoundingClientRect() }))
    .filter(({ box }) => box.width > 0 && (box.width < 24 || box.height < 24))
    .map(({ node, box }) => `${node.getAttribute('aria-label') || node.textContent.trim().slice(0, 30)} ${Math.round(box.width)}×${Math.round(box.height)}`))
  expect(small).toEqual([])
})

test.describe('coarse pointer', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  // redesign W0 T0-45 (W0-E-01, decision 12): on a phone a control is 32px VISIBLE and reaches 44×44 through a pseudo-element
  // (`::after { inset: var(--od-x-target-inset) }`; an <input>/<select> takes it on its frame). The bar did not go down: the 44×44
  // is now measured with elementFromPoint at the four corners (±21px of the centre) instead of with the element's own box.
  // Controls that keep 44px visible (W0-D-08) pass by their box. A drawn size under 32 is allowed only for the compact variants
  // (`data-size="sm"`, switches, the technical-details summary and the wizard step link: 24px floor, still with the 44 area).
  // The frames are the criterion's (e2e/touch-target.js), and so is the rule below (a select frame counts only while it holds
  // exactly one control), repeated inline because evaluateAll cannot take a function: keep both alike.
  const COMPACT = '[data-size="sm"], [role="switch"], .odc-feed-summary, .odc-wizard-step-link'
  test('every control is 32px visible and reaches 44×44 by its box or its hit area with a coarse pointer (C3)', async ({ page }) => {
    await open(page)
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
    const problems = await page.locator(TARGETS).evaluateAll((nodes, { frameSelector, oneControl, compact }) => nodes
      .filter(node => !node.closest('[aria-hidden="true"]'))
      .flatMap(node => {
        node.scrollIntoView({ block: 'center', inline: 'center' })
        const frameOf = node.matches('input, select') ? node.closest(frameSelector) : null
        const frame = frameOf && frameOf.matches(oneControl) && frameOf.querySelectorAll('input, select, textarea').length !== 1 ? null : frameOf
        const box = (frame ?? node).getBoundingClientRect()
        if (box.width <= 0) return []
        const name = `${node.getAttribute('aria-label') || node.textContent.trim().slice(0, 30)} ${Math.round(box.width)}×${Math.round(box.height)}`
        const side = Math.round(Math.min(box.width, box.height))
        const found = []
        const floor = node.matches(compact) ? 24 : 32
        if (side < floor) found.push(`${name}: drawn under ${floor}px`)
        if (side < 44) {
          const x = box.x + box.width / 2
          const y = box.y + box.height / 2
          const missed = [[-21, -21], [21, -21], [-21, 21], [21, 21]].filter(([dx, dy]) => {
            const hit = document.elementFromPoint(x + dx, y + dy)
            return !(hit && (hit === node || node.contains(hit) || (frame && frame.contains(hit))))
          }).map(point => point.join(','))
          if (missed.length) found.push(`${name}: the 44×44 area does not hold at ${missed.join(' | ')}`)
        }
        return found
      }), { frameSelector: TARGET_FRAME, oneControl: ONE_CONTROL_FRAME, compact: COMPACT })
    expect(problems).toEqual([])
  })

  // redesign a select frame lends its 44px area only while it holds exactly one control. With one select it is that
  // select's frame; around two selects it is not (the one-control rule), and an empty wrapper beside a bare select whose area
  // covers it is not either (a frame must be the control's ancestor): in both cases the select fails.
  test('the touch criterion takes a select frame only when it holds exactly one control', async ({ page }) => {
    const area = '.odc-sched-time { position: relative; display: inline-block; isolation: isolate } ' +
      '.odc-sched-time::after { content: ""; position: absolute; inset: -6px; z-index: -1 } ' +
      'select { display: block; inline-size: 56px; block-size: 32px; margin: 0 } body { padding: 48px }'
    await page.setContent(`<style>${area}</style>
      <p><span class="odc-sched-time"><select aria-label="one"><option>1</option></select></span></p>
      <p><span class="odc-sched-time"><select aria-label="first of two"><option>1</option></select><select aria-label="second of two"><option>2</option></select></span></p>
      <p style="position: relative"><span class="odc-sched-time" style="position: absolute; inset: 0; inline-size: 56px; block-size: 32px"></span><select aria-label="bare" style="position: relative"><option>3</option></select></p>`)
    expect(await touchTargetProblems(page.getByLabel('one', { exact: true }))).toEqual([])
    expect(await touchTargetProblems(page.getByLabel('first of two'))).not.toEqual([])
    expect(await touchTargetProblems(page.getByLabel('bare'))).not.toEqual([])
  })
})

test('data table: one tab stop, arrows move, Enter opens, Space selects (C6)', async ({ page }) => {
  await open(page, '?section=table')
  const table = page.getByRole('table', { name: 'In progress orders, most urgent first' })
  const rows = table.locator('tbody tr')
  // The active row (#13791) holds the tab stop.
  await expect(rows.nth(2)).toHaveAttribute('tabindex', '0')
  await expect(table.locator('tbody tr[tabindex="0"]')).toHaveCount(1)
  await rows.nth(2).focus()
  await page.keyboard.press('ArrowDown')
  await expect(rows.nth(3)).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(rows.nth(3)).toHaveAttribute('data-active', '')
  await page.keyboard.press('Space')
  await expect(rows.nth(3).getByRole('checkbox')).toHaveAttribute('aria-checked', 'true')
  // Tab from the row reaches its own controls, not the next row's.
  await page.keyboard.press('Tab')
  await expect(rows.nth(3).getByRole('checkbox')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(table.getByRole('checkbox', { checked: true })).toHaveCount(0)
})

// redesign bugs G row 74, in bugs F: e2e/brand-system/stores-d2 lost the focus ring check of the Markups checkbox
// with its subject (b8d86cd39); /stores/markups selects with this P/Checkbox of P/DataTable, so the check lives here. Its 44px
// area is the coarse-pointer target test above (every [role="checkbox"]).
test('data table: the selection checkbox shows the focus ring from the keyboard', async ({ page }) => {
  await open(page, '?section=table')
  const rows = page.getByRole('table', { name: 'In progress orders, most urgent first' }).locator('tbody tr')
  await rows.nth(2).focus()
  await page.keyboard.press('Tab')
  const checkbox = rows.nth(2).getByRole('checkbox')
  await expect(checkbox).toBeFocused()
  const ring = await checkbox.evaluate(node => ({
    visible: node.matches(':focus-visible'),
    style: getComputedStyle(node).outlineStyle,
    width: getComputedStyle(node).outlineWidth
  }))
  expect(ring).toEqual({ visible: true, style: 'solid', width: '2px' })
})

test('confirm dialog: initial focus on Cancel, focus trapped, page inert, focus returned (C8)', async ({ page }) => {
  await open(page, '?section=overlays')
  const opener = page.getByTestId('open-confirm')
  await opener.click()
  const dialog = page.getByRole('alertdialog', { name: 'Delete order #13729?' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
  for (let index = 0; index < 6; index += 1) {
    await page.keyboard.press('Tab')
    // Base UI's focus guard holds the focus for a moment before sending it back inside.
    await expect.poll(() => dialog.evaluate(node => node.contains(document.activeElement))).toBe(true)
  }
  // The page behind cannot be clicked.
  const blocked = await page.evaluate(() => {
    const target = document.querySelector('[data-testid="open-dialog"]')
    const box = target.getBoundingClientRect()
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
    return !target.contains(hit)
  })
  expect(blocked).toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(opener).toBeFocused()
})

test('sheet traps focus and gives it back', async ({ page }) => {
  await open(page, '?section=overlays')
  const opener = page.getByTestId('open-sheet')
  await opener.click()
  const sheet = page.getByRole('dialog', { name: 'Filters' })
  await expect(sheet).toBeVisible()
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press('Tab')
    await expect.poll(() => sheet.evaluate(node => node.contains(document.activeElement))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(opener).toBeFocused()
})

test('filter bar keeps search, filters and tools in one row at 1024px (wave 3 requirement)', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await open(page, '?section=filterbar-active')
  const bar = page.getByRole('group', { name: 'Order filters' })
  const tops = await bar.locator('.odc-search, .odc-pill, .odc-btn').evaluateAll(nodes => nodes
    .filter(node => node.getBoundingClientRect().width > 0 && getComputedStyle(node).visibility !== 'hidden' && !node.closest('.odc-chips') && !node.closest('.odc-notice'))
    .map(node => Math.round(node.getBoundingClientRect().top + node.getBoundingClientRect().height / 2)))
  expect(tops.length).toBeGreaterThan(4)
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(2)
})

// Redesign F1b (D-06): the bar of /orders is one row at every width above a phone. The pills that do not fit
// leave it for «+N»; nothing stacks, wraps or scrolls, so the bar never changes height when the list narrows.
const geometry = (bar, selector) => bar.locator(selector).first().evaluate(node => {
  const box = node.getBoundingClientRect()
  return { top: Math.round(box.top), bottom: Math.round(box.bottom), left: Math.round(box.left), right: Math.round(box.right), width: Math.round(box.width) }
})
const rowState = frame => frame.locator('.odc-filterbar').evaluate(bar => {
  const start = bar.querySelector('.odc-filterbar-start')
  const drawn = [...bar.querySelectorAll('.odc-filterbar-start :is(.odc-search, .odc-pill, .odc-btn), .odc-filterbar-tools button')]
    .filter(node => node.getBoundingClientRect().width > 0 && getComputedStyle(node).visibility !== 'hidden')
  const centers = drawn.map(node => Math.round(node.getBoundingClientRect().top + node.getBoundingClientRect().height / 2))
  const units = [...bar.querySelectorAll('.odc-filterbar-filters > *')]
  const plus = bar.querySelector('[data-filterbar-overflow]')
  return {
    spread: Math.max(...centers) - Math.min(...centers),
    parked: units.filter(unit => unit.hasAttribute('data-overflowed')).length,
    shown: units.filter(unit => !unit.hasAttribute('data-overflowed')).length,
    plusVisible: Boolean(plus) && getComputedStyle(plus).visibility !== 'hidden',
    plusText: plus?.textContent,
    // The start group is wider than its column when the measure left too many pills in the row.
    overflow: start.scrollWidth - start.clientWidth,
    mainHeight: Math.round(bar.querySelector('.odc-filterbar-main').getBoundingClientRect().height)
  }
})

// redesign the row as it settles. A width change is measured by the bar's ResizeObserver at the next rendering step
// and the row re-renders after it, so a read right after the resize can still see the previous layout (under load, 1 run in 5
// read a 39px overflow that was 0 200ms later). The same state two frames apart, twice in a row, is the settled one; the
// assertions then judge that state with their own bounds.
const settledRowState = async (page, frame) => {
  const twoFrames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  let last = JSON.stringify(await rowState(frame))
  let same = 0
  for (let read = 0; read < 50 && same < 2; read += 1) {
    await twoFrames()
    const next = JSON.stringify(await rowState(frame))
    same = next === last ? same + 1 : 0
    last = next
  }
  expect(same, 'the filter bar row settles').toBe(2)
  return JSON.parse(last)
}

test.describe('F1b · one row, the rest in «+N»', () => {
  test.use({ viewport: { width: 1400, height: 900 } })

  test('1100px: every control is on one line, the pills that do not fit are in «+N» and nothing overflows the row', async ({ page }) => {
    await open(page, '?section=fa-onerow')
    const frame = page.getByTestId('onerow-1100')
    await expect.poll(async () => (await rowState(frame)).plusVisible).toBe(true)
    const state = await rowState(frame)
    expect(state.spread).toBeLessThanOrEqual(2)
    expect(state.overflow).toBeLessThanOrEqual(1)
    expect(state.shown + state.parked).toBe(6)
    expect(state.parked).toBeGreaterThan(0)
    expect(state.plusText).toBe(`+${state.parked}`)
    // Search, «Filters», «Clear filters» and the tools share the first (and only) row.
    const search = await geometry(frame, '.odc-search')
    const tools = await geometry(frame, '.odc-filterbar-tools button')
    expect(Math.abs(tools.top + tools.bottom - search.top - search.bottom)).toBeLessThanOrEqual(2)
    expect(await seriousViolations(page)).toEqual([])
  })

  test('where the pills fit the bar stays on one row with no «+N»', async ({ page }) => {
    await open(page, '?section=fa-onerow')
    const frame = page.getByTestId('onerow-wide')
    await frame.evaluate(node => { node.style.inlineSize = '1340px' })
    await expect.poll(async () => (await rowState(frame)).parked).toBe(0)
    const state = await rowState(frame)
    expect(state.plusVisible).toBe(false)
    expect(state.spread).toBeLessThanOrEqual(2)
  })

  test('the parked pills are out of the tab order and of the accessibility tree; «+N» lists them with their value', async ({ page }) => {
    await open(page, '?section=fa-onerow')
    const frame = page.getByTestId('onerow-1100')
    await expect.poll(async () => (await rowState(frame)).plusVisible).toBe(true)
    const more = frame.locator('[data-filterbar-overflow]')
    await more.click()
    const items = page.getByRole('menuitem')
    await expect(items.first()).toBeVisible()
    expect(await items.count()).toBe((await rowState(frame)).parked)
    // redesign Q2-06 (0d110482): the pills with a value are the last to go, so at 1100px «+N» holds inactive pills
    // only and «Business», with its value, keeps its place in the row although it is the last pill.
    await expect(page.getByRole('menuitem', { name: /^Business/ })).toHaveCount(0)
    await expect(frame.getByRole('button', { name: /^Business/ })).toBeVisible()
    const parkedName = (await items.first().textContent()).trim()
    await page.keyboard.press('Escape')
    await expect(more).toBeFocused()
    // a parked pill is not reachable by name: it is invisible, not merely covered
    await expect(frame.getByRole('button', { name: parkedName, exact: true })).toHaveCount(0)
    // In a split view (552px) the pills with a value are in «+N» too: the menu lists each one with its value.
    const split = page.getByTestId('onerow-split')
    const splitMore = split.locator('[data-filterbar-overflow]')
    await splitMore.click()
    await expect(page.getByRole('menuitem').first()).toBeVisible()
    // redesign W0 T0-45 (W0-E-09, W0-D-12; decision 18, rounds 4-5 of tramo A): at 552px this fixture's «Clear filters» is parked too
    // (measured: it leaves the row below ~690px because the pill with a value does not fit beside it), so «+N» lists the parked pills
    // and «Clear filters» as its last entry: parked + 1.
    expect(await page.getByRole('menuitem').count()).toBe((await rowState(split)).parked + 1)
    await expect(page.getByRole('menuitem').last()).toHaveText(/Clear filters/)
    await expect(page.getByRole('menuitem', { name: /^Business/ })).toHaveAccessibleDescription('Fast Bite')
    await page.keyboard.press('Escape')
    await expect(splitMore).toBeFocused()
    await expect(split.getByRole('button', { name: /^Business/ })).toHaveCount(0)
  })

  test('it does not flip back and forth: growing and shrinking the bar changes the pills in «+N» one way, with a hysteresis', async ({ page }) => {
    await open(page, '?section=fa-onerow')
    const frame = page.getByTestId('onerow-wide')
    const sweep = async widths => {
      const seen = []
      for (const width of widths) {
        await frame.evaluate((node, value) => { node.style.inlineSize = `${value}px` }, width)
        await expect.poll(() => frame.locator('.odc-filterbar').evaluate(node => node.clientWidth)).toBe(width)
        // The bar re-measures when the browser renders: let two frames pass before reading it.
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
        const state = await rowState(frame)
        // The measure and the CSS agree: the row never spills past its column, and it is always one line.
        expect(state.overflow, `the row overflows at ${width}px`).toBeLessThanOrEqual(1)
        expect(state.spread, `two lines at ${width}px`).toBeLessThanOrEqual(2)
        seen.push([width, state.parked])
      }
      return seen
    }
    const range = (from, to, step) => Array.from({ length: Math.floor(Math.abs(to - from) / step) + 1 }, (_, index) => from + Math.sign(to - from) * index * step)
    const up = await sweep(range(700, 1240, 10))
    const down = await sweep(range(1240, 700, 10))
    // growing never parks one more pill; shrinking never brings one back
    up.forEach((entry, index) => { if (index) expect(entry[1], `grew to ${entry[0]}px and parked more`).toBeLessThanOrEqual(up[index - 1][1]) })
    down.forEach((entry, index) => { if (index) expect(entry[1], `shrank to ${entry[0]}px and parked fewer`).toBeGreaterThanOrEqual(down[index - 1][1]) })
    expect(up.at(-1)[1]).toBe(0)
    expect(up[0][1]).toBeGreaterThan(0)
    // Taking a pill back needs more room than hiding it does: every width where the last pill came back going up
    // is wider than the width where it left going down.
    const backAt = up.find(entry => entry[1] === 0)[0]
    const leftAt = down.find(entry => entry[1] > 0)[0]
    expect(leftAt).toBeLessThan(backAt)
  })

  test('a list as narrow as a split view is the same one row, tools included, with one «Clear filters»', async ({ page }) => {
    await open(page, '?section=fa-onerow')
    const frame = page.getByTestId('onerow-split')
    await expect.poll(async () => (await rowState(frame)).plusVisible).toBe(true)
    expect(await frame.locator('.odc-filterbar').evaluate(node => node.clientWidth)).toBeLessThan(600)
    const state = await rowState(frame)
    expect(state.spread).toBeLessThanOrEqual(2)
    expect(state.overflow).toBeLessThanOrEqual(1)
    await expect(frame.getByRole('button', { name: 'Manage columns' })).toBeVisible()
    await expect(frame.getByRole('button', { name: 'Compact rows' })).toBeVisible()
    // redesign W0 T0-45 (W0-E-09, W0-D-12; decision 18, rounds 4-5 of tramo A): the fixture's row at 552px is a tight one (measured: «Clear filters»
    // leaves the row below ~690px, the search keeps its 280 with every pill but one in «+N»), so «Clear filters» is the last entry of «+N»,
    // the bar has no button of its own in the row and exactly one «Clear filters» menu entry is reachable. bugs H (W0-Q2-06): the
    // chips row, a different node outside the main row, shows its «clear all» in this state, so the parked Clear is never out of sight.
    await expect(frame.locator('.odc-filterbar')).toHaveAttribute('data-clear-parked', '')
    await expect(frame.locator('.odc-filterbar-main').getByRole('button', { name: 'Clear filters' })).toBeHidden()
    await expect(frame.locator('.odc-filterbar-clear button')).toBeHidden()
    await expect(frame.locator('.odc-chips-clear button')).toBeVisible()
    await frame.locator('[data-filterbar-overflow]').click()
    await expect(page.getByRole('menuitem', { name: 'Clear filters' })).toHaveCount(1)
    await page.keyboard.press('Escape')
  })

  // redesign W0-4b (decision 18): when the row is tight «Clear filters» leaves it and is the last entry of «+N».
  // redesign W0 T0-45 (W0-E-09, W0-E-03): this fixture reaches that state below ~690px now (rounds 4-5 of tramo A: 700 keeps it in the row,
  // 680 parks it; 552, 480 and 440 park it), and `.g-frame` no longer takes 2px from the bar (measured: a 480px frame gives a 480px bar).
  test('a tight row parks «Clear filters» in «+N»: no button in the row, the chips\' «clear all» shown (W0-Q2-06), one last menu entry', async ({ page }) => {
    await open(page, '?section=fa-onerow')
    const frame = page.getByTestId('onerow-split')
    await frame.evaluate(node => { node.style.inlineSize = '480px' })
    await expect.poll(() => frame.locator('.odc-filterbar').evaluate(node => node.clientWidth)).toBe(480) // redesign W0 T0-45 (W0-E-03): 478 before the frame stopped taking its border from the bar
    await expect(frame.locator('.odc-filterbar')).toHaveAttribute('data-clear-parked', '')
    await expect.poll(async () => (await rowState(frame)).plusVisible).toBe(true)
    const state = await settledRowState(page, frame)
    expect(state.spread).toBeLessThanOrEqual(2)
    expect(state.overflow).toBeLessThanOrEqual(1)
    await expect(frame.getByRole('button', { name: 'Manage columns' })).toBeVisible()
    await expect(frame.getByRole('button', { name: 'Compact rows' })).toBeVisible()
    await expect(frame.locator('.odc-filterbar-main').getByRole('button', { name: 'Clear filters' })).toBeHidden()
    await expect(frame.locator('.odc-chips-clear button')).toBeVisible() // W0-Q2-06: the chips row keeps its own, outside the main row
    await frame.locator('[data-filterbar-overflow]').click()
    const entries = page.getByRole('menuitem')
    await expect(entries.last()).toHaveText(/Clear filters/)
    await expect(page.getByRole('menuitem', { name: 'Clear filters' })).toHaveCount(1)
  })

  test('the bar keeps its height when the list narrows from a wide frame to a split view', async ({ page }) => {
    await open(page, '?section=fa-onerow')
    const frame = page.getByTestId('onerow-wide')
    await frame.evaluate(node => { node.style.inlineSize = '1240px' })
    await expect.poll(() => frame.locator('.odc-filterbar').evaluate(node => node.clientWidth)).toBe(1240)
    const wide = await rowState(frame)
    await frame.evaluate(node => { node.style.inlineSize = '552px' })
    await expect.poll(() => frame.locator('.odc-filterbar').evaluate(node => node.clientWidth)).toBe(552)
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    const narrow = await rowState(frame)
    expect(narrow.mainHeight).toBe(wide.mainHeight)
    expect(narrow.parked).toBeGreaterThan(wide.parked)
  })

  test('on a wide list the bar keeps its Clear filters and the chips drop theirs: one at a time', async ({ page }) => {
    await open(page, '?section=fa-onerow')
    const frame = page.getByTestId('onerow-1100')
    await expect(frame.locator('.odc-filterbar-clear button')).toBeVisible()
    await expect(frame.locator('.odc-chips-clear button')).toBeHidden()
  })
})

test.describe('audit 3 · phones', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  test('a phone hides the table tools (the list is cards there) and keeps the chips Clear filters', async ({ page }) => {
    await open(page, '?section=fa-onerow')
    const frame = page.getByTestId('onerow-split')
    await expect(frame.locator('.odc-filterbar-tools')).toBeHidden()
    await expect(frame.locator('.odc-chips-clear button')).toBeVisible()
    // the phone layout has no «+N»: the pills sit on their own sideways row
    await expect(frame.locator('[data-filterbar-overflow]')).toBeHidden()
  })
})

// Redesign F1b: from 768px of viewport a narrow list is a split view, not a phone: one row with «+N», never
// wrapped and with no fade. A phone (767px and below) keeps the pills on their own sideways row with the fade.
const pillsState = pills => pills.evaluate(node => {
  const box = node.getBoundingClientRect()
  const items = [...node.children].filter(item => !item.hasAttribute('data-overflowed')).map(item => item.getBoundingClientRect())
  return {
    room: node.scrollWidth - node.clientWidth,
    flexWrap: getComputedStyle(node).flexWrap,
    mask: getComputedStyle(node).maskImage,
    overflowStart: node.hasAttribute('data-overflow-start'),
    overflowEnd: node.hasAttribute('data-overflow-end'),
    whole: items.every(rect => rect.width > 0 && rect.left >= box.left - 1 && rect.right <= box.right + 1),
    lines: new Set(items.map(rect => Math.round(rect.top))).size,
    count: items.length
  }
})

test.describe('F1b · pills in a split view', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  for (const frameId of ['onerow-split', 'onerow-split-plain']) {
    test(`a 552px list at 1280 keeps one line of pills, every one whole, none behind a fade, the rest in «+N» (${frameId})`, async ({ page }) => {
      await open(page, '?section=fa-onerow')
      const frame = page.getByTestId(frameId)
      const pills = frame.locator('.odc-filterbar-filters')
      // The frame is narrower than 600px: where the old layout wrapped the pills onto several lines.
      expect(await frame.locator('.odc-filterbar').evaluate(node => node.clientWidth)).toBeLessThan(600)
      await expect.poll(async () => (await rowState(frame)).plusVisible).toBe(true)
      const state = await pillsState(pills)
      expect(state.flexWrap).toBe('nowrap')
      expect(state.mask).toBe('none')
      expect(state.overflowStart || state.overflowEnd).toBe(false)
      expect(state.whole).toBe(true)
      expect(state.lines).toBeLessThanOrEqual(1)
      const row = await rowState(frame)
      expect(row.shown + row.parked).toBe(6)
      expect(await seriousViolations(page)).toEqual([])
    })
  }
})

test.describe('F1b · from 768px one row, a phone keeps the sideways row', () => {
  for (const [width, oneRow] of [[768, true], [767, false]]) {
    test(`${width}px viewport: the pills of a narrow list ${oneRow ? 'stay on one line with «+N», no fade' : 'scroll sideways with their fade'}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await open(page, '?section=fa-onerow')
      const frame = page.getByTestId('onerow-split-plain')
      // 552px for a split view; 440px on a phone, where the six pills (570px) do not fit their own row
      await frame.evaluate((node, size) => { node.style.inlineSize = size }, oneRow ? '552px' : '440px')
      const pills = frame.locator('.odc-filterbar-filters')
      if (oneRow) {
        await expect.poll(async () => (await rowState(frame)).plusVisible).toBe(true)
        expect(await pillsState(pills)).toMatchObject({ flexWrap: 'nowrap', mask: 'none', overflowEnd: false, whole: true, lines: 1 })
      } else {
        await expect.poll(() => pillsState(pills)).toMatchObject({ flexWrap: 'nowrap', overflowEnd: true, lines: 1 })
        expect((await pillsState(pills)).mask).not.toBe('none')
        expect((await pillsState(pills)).room).toBeGreaterThan(1)
        await expect(frame.locator('[data-filterbar-overflow]')).toBeHidden()
      }
    })
  }
})

test('removing the last chip with the keyboard leaves the focus on «Filters», not on the page', async ({ page }) => {
  await open(page, '?section=filterbar-active')
  const bar = page.getByRole('group', { name: 'Order filters' })
  await bar.getByRole('button', { name: 'Remove Date: Today' }).focus()
  await page.keyboard.press('Enter')
  await expect(bar.getByRole('button', { name: 'Remove Business: Fast Bite' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(bar.getByRole('list', { name: 'Active filters' })).toHaveCount(0)
  await expect(bar.getByRole('button', { name: /^Filters/ })).toBeFocused()
})

test('column manager starts on the first checkbox you can change, not on Reset', async ({ page }) => {
  await open(page, '?section=columns')
  await page.getByRole('button', { name: 'Manage columns' }).click()
  const popup = page.getByRole('dialog', { name: 'Columns' })
  await expect(popup).toBeVisible()
  const active = await page.evaluate(() => ({ role: document.activeElement?.getAttribute('role'), text: document.activeElement?.textContent }))
  expect(active.role).toBe('checkbox')
  expect(active.text).not.toMatch(/Reset/)
})

test('column manager reflects a column hidden by width', async ({ page }) => {
  await open(page, '?section=columns')
  await page.getByRole('button', { name: 'Manage columns' }).click()
  const popup = page.getByRole('dialog', { name: 'Columns' })
  await expect(popup.getByText('Hidden at this width')).toBeVisible()
  await expect(popup.getByText('Always shown')).toHaveCount(2)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Manage columns' })).toBeFocused()
})

test('a segmented control that does not fit becomes a select with the same label (C13)', async ({ page }) => {
  await open(page, '?section=segmented-narrow')
  await expect(page.getByTestId('narrow-seg').getByRole('combobox', { name: 'Show' })).toBeVisible()
  await expect(page.getByTestId('narrow-seg').getByRole('button')).toHaveCount(0)
})

// redesign deliveries-followups W1-D-25 (decision 12): every option of P/SegmentedControl, the 36px-wide «All» too, is
// 32px visible and answers the four corners of its 44×44 area on a phone (with a mouse below 768px, and with a coarse pointer);
// on a desktop with a mouse it stays at 28px.
const segOptions = page => page.getByTestId('touch-seg').getByRole('button')
const segHeights = async page => (await segOptions(page).evaluateAll(nodes => nodes.map(node => Math.round(node.getBoundingClientRect().height))))

test('segmented options are 28px on a desktop with a mouse', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await open(page, '?section=segmented-touch')
  expect(await segHeights(page)).toEqual([28, 28, 28])
})

test('segmented options are 32px visible with a 44×44 area at 390 with a mouse', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page, '?section=segmented-touch')
  expect(await segHeights(page)).toEqual([32, 32, 32])
  for (const option of await segOptions(page).all()) await expectTouchTarget(option, { label: await option.textContent() })
})

test.describe('segmented options with a coarse pointer', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  test('are 32px visible with a 44×44 area, not a 44px box', async ({ page }) => {
    await open(page, '?section=segmented-touch')
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
    expect(await segHeights(page)).toEqual([32, 32, 32])
    for (const option of await segOptions(page).all()) await expectTouchTarget(option, { label: await option.textContent() })
  })
})

test('tabs: arrows follow the reading direction in RTL', async ({ page }) => {
  await open(page, '?section=tabs&dir=rtl')
  const tablist = page.getByRole('tablist', { name: 'Order status' })
  await tablist.getByRole('tab', { selected: true }).focus()
  await page.keyboard.press('ArrowLeft')
  await expect(tablist.getByRole('tab', { name: /Completed/ })).toBeFocused()
})

// FA-1 / FA-3 · a sideways scroller that does not fit fades the edge it continues past.
const edgeState = locator => locator.evaluate(node => ({
  start: node.hasAttribute('data-overflow-start'),
  end: node.hasAttribute('data-overflow-end'),
  mask: getComputedStyle(node).maskImage
}))
// Scrolls to a logical position: 'start' (0) or 'end' (all the way, either direction).
const scrollToEdge = (locator, edge) => locator.evaluate((node, where) => {
  const room = node.scrollWidth - node.clientWidth
  const sign = getComputedStyle(node).direction === 'rtl' ? -1 : 1
  node.scrollLeft = where === 'end' ? sign * room : 0
}, edge)

// redesign audit-4: from 768px of viewport a narrow list is a split view, not a phone; redesign F1b: its pills stay
// on one line with «+N» (see «F1b · pills in a split view»); the sideways row and its fade are the phone's, so
// these run at 767px.
test.describe('pills that scroll: the widest phone', () => {
  test.use({ viewport: { width: 767, height: 900 } })
  for (const dir of ['ltr', 'rtl']) {
    test(`filter bar pills that do not fit fade at the edge they continue past and clear at the end (${dir})`, async ({ page }) => {
      await open(page, `?section=fa-overflow&dir=${dir}`)
      const pills = page.getByTestId('fa-bar-frame').locator('.odc-filterbar-filters')
      await expect.poll(() => edgeState(pills)).toMatchObject({ start: false, end: true })
      const initial = await edgeState(pills)
      expect(initial.mask).not.toBe('none')
      // The gradient follows the reading direction: it never hard-codes the physical side.
      expect(initial.mask).toContain(dir === 'rtl' ? 'to left' : 'to right')
      await scrollToEdge(pills, 'end')
      await expect.poll(() => edgeState(pills)).toMatchObject({ start: true, end: false })
      await scrollToEdge(pills, 'start')
      await expect.poll(() => edgeState(pills)).toMatchObject({ start: false, end: true })
      // The last pill is still reachable with Tab and brought into view, clear of the fade.
      await page.getByTestId('fa-bar-frame').getByRole('button', { name: 'Filters' }).focus()
      await page.keyboard.press('Shift+Tab')
      await expect(page.getByTestId('fa-bar-frame').getByRole('button', { name: 'Payment method' })).toBeFocused()
    })
  }
})

test('filter bar that fits has no fade', async ({ page }) => {
  await open(page, '?section=filterbar')
  const pills = page.locator('#filterbar .odc-filterbar-filters')
  expect(await edgeState(pills)).toMatchObject({ start: false, end: false, mask: 'none' })
})

for (const dir of ['ltr', 'rtl']) {
  test(`tabs that do not fit fade at the edge they continue past, and every tab stays reachable (${dir})`, async ({ page }) => {
    await open(page, `?section=fa-overflow&dir=${dir}`)
    const list = page.getByTestId('fa-tabs-frame').getByRole('tablist', { name: 'Order status' })
    await expect.poll(() => edgeState(list)).toMatchObject({ start: false, end: true })
    expect((await edgeState(list)).mask).not.toBe('none')
    await list.getByRole('tab', { selected: true }).focus()
    await page.keyboard.press('End')
    const last = list.getByRole('tab', { name: /^Cancelled/ })
    await expect(last).toBeFocused()
    await expect.poll(() => edgeState(list)).toMatchObject({ start: true, end: false })
    // The focused tab is fully inside the list, not under the fade. Chrome snaps the scroll
    // extent to whole pixels, so the end of the row can sit less than 1px past the box.
    const inside = await last.evaluate(node => {
      const tab = node.getBoundingClientRect()
      const box = node.parentElement.getBoundingClientRect()
      return tab.left >= box.left - 1 && tab.right <= box.right + 1
    })
    expect(inside).toBe(true)
  })
}

test('tabs that fit have no fade', async ({ page }) => {
  await open(page, '?section=tabs')
  expect(await edgeState(page.getByRole('tablist', { name: 'Order status' }))).toMatchObject({ start: false, end: false, mask: 'none' })
})

// FA-2 · flush: the main row, the chips and the notice add no inline padding of their own.
for (const dir of ['ltr', 'rtl']) {
  test(`flush filter bar aligns search, chips and notice with the screen's own margin (${dir})`, async ({ page }) => {
    await open(page, `?section=fa-overflow&dir=${dir}`)
    const frame = page.getByTestId('fa-flush-frame')
    const edge = await frame.evaluate(node => {
      const start = node.getBoundingClientRect()
      const rtl = getComputedStyle(node).direction === 'rtl'
      const content = rtl ? start.right - parseFloat(getComputedStyle(node).paddingRight) - parseFloat(getComputedStyle(node).borderRightWidth) : start.left + parseFloat(getComputedStyle(node).paddingLeft) + parseFloat(getComputedStyle(node).borderLeftWidth)
      const at = selector => {
        const box = node.querySelector(selector).getBoundingClientRect()
        return Math.round(rtl ? box.right : box.left)
      }
      return { content: Math.round(content), search: at('.odc-search'), chip: at('.odc-chip'), notice: at('.odc-notice') }
    })
    expect(edge.search).toBe(edge.content)
    expect(edge.chip).toBe(edge.content)
    expect(edge.notice).toBe(edge.content)
  })
}

test('a filter bar without flush keeps the page gutter', async ({ page }) => {
  await open(page, '?section=filterbar-active')
  const gutter = await page.locator('#filterbar-active .odc-filterbar-main').evaluate(node => getComputedStyle(node).paddingInlineStart)
  expect(parseFloat(gutter)).toBeGreaterThan(0)
})

// FA-4 · single choice in a menu.
test('menu with a single choice: menuitemradio, the mark follows the choice, choosing closes', async ({ page }) => {
  await open(page, '?section=menu-radio')
  await page.getByRole('button', { name: 'SLA' }).click()
  const menu = page.getByRole('menu')
  const radios = menu.getByRole('menuitemradio')
  await expect(radios).toHaveCount(3)
  await expect(radios.nth(1)).toHaveAttribute('aria-checked', 'true')
  await expect(radios.nth(0)).toHaveAttribute('aria-checked', 'false')
  // A visible mark on the checked one only, and the labels stay aligned.
  const marks = await radios.evaluateAll(nodes => nodes.map(node => ({
    mark: node.querySelector('.odc-menu-mark svg') !== null,
    labelLeft: Math.round(node.querySelector('.odc-menu-label').getBoundingClientRect().left)
  })))
  expect(marks.map(item => item.mark)).toEqual([false, true, false])
  expect(new Set(marks.map(item => item.labelLeft)).size).toBe(1)
  expect(await seriousViolations(page)).toEqual([])
  await radios.nth(2).click()
  await expect(menu).toBeHidden()
  await page.getByRole('button', { name: 'SLA' }).click()
  await expect(page.getByRole('menuitemradio').nth(2)).toHaveAttribute('aria-checked', 'true')
})

// FA-5 · a dated last milestone stays inside the content edge, in LTR and RTL.
for (const dir of ['ltr', 'rtl']) {
  test(`order route with dated milestones keeps every label and time inside its column (${dir})`, async ({ page }) => {
    await open(page, `?section=route-dated&dir=${dir}`)
    for (const width of ['420px', '480px', '560px']) {
      const frame = page.getByTestId(`dated-${width}`)
      const outside = await frame.evaluate(node => {
        const area = node.querySelector('.odc-route').getBoundingClientRect()
        const problems = []
        for (const item of node.querySelectorAll('li')) {
          const column = item.getBoundingClientRect()
          for (const part of item.querySelectorAll('.odc-route-label, .odc-route-time')) {
            const range = document.createRange()
            range.selectNodeContents(part)
            for (const box of range.getClientRects()) {
              if (box.right > Math.ceil(Math.min(column.right, area.right)) + 0.5 || box.left < Math.floor(Math.max(column.left, area.left)) - 0.5) {
                problems.push(`${part.textContent.trim()} ${Math.round(box.left)}-${Math.round(box.right)} outside ${Math.round(column.left)}-${Math.round(column.right)}`)
              }
            }
          }
        }
        return problems
      })
      expect(outside, width).toEqual([])
    }
  })
}
