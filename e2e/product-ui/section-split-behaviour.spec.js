// redesign 2.B: P/SectionSplit inside the real store editor panel (gallery harness `#section-split`): the mode at
// each width, no containing block for the fixed side bars the detail opens, the order of the Escape, the focus and the sticky
// detail of a long list. Runs with `pnpm ui:test:browser` (this file name carries «behaviour»).
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const GALLERY = '/scripts/product-ui/gallery.html?section=section-split'

const openEditor = async (page, { width, height = 900, splitFrom = false } = {}) => {
  await page.setViewportSize({ width, height })
  const errors = []
  page.on('pageerror', error => errors.push(String(error)))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(GALLERY)
  await page.getByRole('heading', { name: 'Product wrappers' }).waitFor()
  await page.evaluate(() => document.fonts.ready)
  await page.getByRole('button', { name: splitFrom ? /splitFrom 768/ : 'Open the store editor' }).click()
  await expect(page.getByTestId('split-editor')).toBeVisible()
  return errors
}

// The first load of the gallery compiles it: once, with room, so no test pays for it.
test.beforeAll(async ({ browser }) => {
  test.setTimeout(180000)
  const page = await browser.newPage()
  await page.goto(GALLERY)
  await page.getByRole('heading', { name: 'Product wrappers' }).waitFor({ timeout: 170000 })
  await page.close()
})

const detail = page => page.locator('.odc-section-split-detail')
const zoneRow = (page, name) => page.getByTestId('split-editor').getByRole('row', { name: new RegExp(`^${name}\\b`) })

const openZone = async (page, name) => {
  await zoneRow(page, name).click()
  await expect(detail(page)).toBeVisible()
}

// The inline size of the piece, of its two columns and whether anything overflows sideways inside the editor.
const layout = page => page.evaluate(() => {
  const root = document.querySelector('.odc-section-split')
  const list = root.querySelector('.odc-section-split-list')
  const panel = root.querySelector('.odc-section-split-detail')
  const content = document.querySelector('[data-testid="split-content"]')
  const editor = document.querySelector('[data-testid="split-editor"]')
  const box = node => (node && !node.hidden ? node.getBoundingClientRect() : null)
  return {
    mode: root.dataset.mode,
    view: root.dataset.view,
    root: root.getBoundingClientRect().width,
    list: box(list),
    detail: box(panel),
    contentOverflow: content.scrollWidth - content.clientWidth,
    editorOverflow: editor.scrollWidth - editor.clientWidth,
    pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  }
})

for (const width of [1280, 1366, 1440]) {
  test(`side by side at ${width}: list and detail in one row, the detail 440 to 720px, nothing overflows`, async ({ page }) => {
    const errors = await openEditor(page, { width })
    await openZone(page, 'Zone Fast Bite principal')
    const box = await layout(page)
    expect(box.mode).toBe('split')
    expect(box.view).toBe('split')
    expect(box.detail.width).toBeGreaterThanOrEqual(440)
    expect(box.detail.width).toBeLessThanOrEqual(720)
    expect(Math.abs(box.detail.top - box.list.top)).toBeLessThan(2)
    expect(box.detail.left).toBeGreaterThan(box.list.left + box.list.width - 1)
    expect(box.contentOverflow).toBeLessThanOrEqual(0)
    expect(box.editorOverflow).toBeLessThanOrEqual(0)
    await expect(page.getByRole('button', { name: 'Close zone' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Zones', exact: true })).toHaveCount(0)
    expect(errors).toEqual([])
  })
}

for (const width of [1024, 390]) {
  test(`stacked at ${width}: the detail replaces the list with «‹ Zones», and the list comes back`, async ({ page }) => {
    const errors = await openEditor(page, { width })
    await openZone(page, 'Zone Fast Bite principal')
    const box = await layout(page)
    expect(box.mode).toBe('stack')
    expect(box.view).toBe('detail')
    expect(box.list).toBeNull()
    expect(box.contentOverflow).toBeLessThanOrEqual(0)
    expect(box.editorOverflow).toBeLessThanOrEqual(0)
    await expect(page.getByRole('button', { name: 'Close zone' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Zones', exact: true }).click()
    await expect(detail(page)).toHaveCount(0)
    await expect(zoneRow(page, 'Zone Fast Bite principal')).toBeVisible()
    expect(errors).toEqual([])
  })
}

test('splitFrom (opt-in): at 1024 with splitFrom 768 the zones go side by side, as the side bar of main left the list in view', async ({ page }) => {
  await openEditor(page, { width: 1024, splitFrom: true })
  await openZone(page, 'Zone Fast Bite principal')
  const box = await layout(page)
  expect(box.mode).toBe('split')
  expect(box.contentOverflow).toBeLessThanOrEqual(0)
})

test('a fixed side bar opened from the detail paints over the page, not inside the piece', async ({ page }) => {
  await openEditor(page, { width: 1440 })
  await openZone(page, 'Zone Fast Bite principal')
  await page.getByRole('button', { name: 'Share with' }).click()
  const sidebar = page.getByTestId('legacy-sidebar')
  await expect(sidebar).toBeVisible()
  const facts = await sidebar.evaluate(node => {
    const rect = node.getBoundingClientRect()
    const blockers = []
    for (let up = node.parentElement; up && up !== document.documentElement; up = up.parentElement) {
      const style = getComputedStyle(up)
      const creates = style.transform !== 'none' || style.filter !== 'none' || style.perspective !== 'none' ||
        (style.backdropFilter && style.backdropFilter !== 'none') || (style.containerType && style.containerType !== 'normal') ||
        (style.contain && style.contain !== 'none') || (style.willChange && /transform|filter|perspective/.test(style.willChange))
      if (creates) blockers.push(up.className || up.tagName)
    }
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    return { right: rect.right, top: rect.top, height: rect.height, viewport: window.innerWidth, viewportHeight: window.innerHeight, blockers, onTop: node.contains(hit) }
  })
  expect(facts.blockers).toEqual([])
  expect(Math.round(facts.right)).toBe(facts.viewport)
  expect(facts.top).toBe(0)
  expect(Math.round(facts.height)).toBe(facts.viewportHeight)
  expect(facts.onTop).toBe(true)
})

test('Escape closes the top layer first: the side bar, then the zone, then the editor', async ({ page }) => {
  await openEditor(page, { width: 1440 })
  await openZone(page, 'Zone Fast Bite principal')
  await page.getByRole('button', { name: 'Share with' }).click()
  await expect(page.getByTestId('legacy-sidebar')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('legacy-sidebar')).toHaveCount(0)
  await expect(detail(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(detail(page)).toHaveCount(0)
  await expect(page.getByTestId('split-editor')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('split-editor')).toHaveCount(0)
})

test('Escape with a menu open closes only the menu (the zone ⋯ and the editor ⋯)', async ({ page }) => {
  await openEditor(page, { width: 1440 })
  await openZone(page, 'Zone Fast Bite principal')
  for (const name of ['More zone actions', 'More store actions']) {
    await page.getByRole('button', { name }).click()
    await expect(page.getByRole('menu')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(detail(page)).toBeVisible()
  }
})

test('Escape in a field only leaves it; with a change, closing asks first and «Keep editing» keeps the zone', async ({ page }) => {
  await openEditor(page, { width: 1440 })
  await openZone(page, 'Zone Fast Bite principal')
  const name = detail(page).getByLabel('Name')
  await name.fill('Zone Fast Bite north')
  await page.keyboard.press('Escape')
  await expect(detail(page)).toBeVisible()
  await expect(name).toHaveValue('Zone Fast Bite north')
  await expect(name).not.toBeFocused()
  await page.keyboard.press('Escape')
  const dialog = page.getByRole('alertdialog', { name: 'Discard the changes to this zone?' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Keep editing' }).click()
  await expect(detail(page)).toBeVisible()
  await expect(name).toHaveValue('Zone Fast Bite north')
  // moving to another zone also goes through the guard
  await zoneRow(page, '2km').click()
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Discard' }).click()
  await expect(detail(page).getByRole('heading', { name: '2km' })).toBeVisible()
})

test('the focus goes into the detail on open and back to the row on close (keyboard and mouse)', async ({ page }) => {
  await openEditor(page, { width: 1440 })
  const row = zoneRow(page, 'Zone Fast Bite principal')
  await row.focus()
  await page.keyboard.press('Enter')
  await expect(detail(page)).toBeVisible()
  expect(await detail(page).evaluate(node => node.contains(document.activeElement))).toBe(true)
  await page.getByRole('button', { name: 'Close zone' }).click()
  await expect(row).toBeFocused()

  await zoneRow(page, '2km').click()
  await expect(detail(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(detail(page)).toHaveCount(0)
  const focused = await page.evaluate(() => {
    const active = document.activeElement
    return { body: active === document.body, key: active?.closest('[data-section-split-key]')?.dataset.sectionSplitKey ?? null, inList: !!active?.closest('.odc-section-split-list') }
  })
  expect(focused.body).toBe(false)
  expect(focused.inList).toBe(true)
})

test('stacked: the focus goes to the detail, and «‹ Zones» gives it back to the row', async ({ page }) => {
  await openEditor(page, { width: 1024 })
  const row = zoneRow(page, '2km')
  await row.focus()
  await page.keyboard.press('Enter')
  expect(await detail(page).evaluate(node => node.contains(document.activeElement))).toBe(true)
  await page.getByRole('button', { name: 'Zones', exact: true }).click()
  await expect(row).toBeFocused()
})

test('a long list at 1280: opening the last zone keeps the detail and its foot in view', async ({ page }) => {
  await openEditor(page, { width: 1280, height: 800 })
  const content = page.getByTestId('split-content')
  await content.evaluate(node => { node.scrollTop = node.scrollHeight })
  await zoneRow(page, 'Zone 22').click()
  await expect(detail(page)).toBeVisible()
  await detail(page).getByLabel('Name').fill('Zone 22 west')
  await page.keyboard.press('Tab')
  const box = await page.evaluate(() => {
    const scroller = document.querySelector('[data-testid="split-content"]').getBoundingClientRect()
    const panel = document.querySelector('.odc-section-split-detail').getBoundingClientRect()
    const foot = document.querySelector('.odc-section-split-foot').getBoundingClientRect()
    return { scrollerTop: scroller.top, scrollerBottom: scroller.bottom, top: panel.top, footBottom: foot.bottom }
  })
  expect(box.top).toBeGreaterThanOrEqual(box.scrollerTop - 1)
  expect(box.footBottom).toBeLessThanOrEqual(box.scrollerBottom + 1)
})

test('«All sections» with a zone open: the panel goes back to its width with the navigation and the zone stays open', async ({ page }) => {
  await openEditor(page, { width: 1440 })
  await openZone(page, 'Zone Fast Bite principal')
  await page.getByRole('button', { name: 'All sections' }).click()
  await expect(page.getByRole('navigation', { name: 'Store sections' })).toBeVisible()
  await expect(detail(page)).toBeVisible()
  const box = await layout(page)
  // Measured, not decided here: side by side when the piece is 736px or wider, else stacked (decisions.md D3, P-1).
  test.info().annotations.push({ type: 'all-sections-1440', description: `${box.mode} at a root of ${Math.round(box.root)}px` })
  expect(box.mode).toBe(box.root >= 736 ? 'split' : 'stack')
  expect(box.contentOverflow).toBeLessThanOrEqual(0)
})

test('no serious accessibility violations with a zone open, side by side and stacked', async ({ page }) => {
  for (const width of [1440, 390]) {
    await openEditor(page, { width })
    await openZone(page, 'Zone Fast Bite principal')
    const { violations } = await new AxeBuilder({ page }).include('[data-testid="split-editor"]').analyze()
    expect(violations.filter(violation => ['serious', 'critical'].includes(violation.impact)).map(violation => violation.id)).toEqual([])
  }
})

// review F3-1: after the leave question («Discard»), the focus goes back to the row, never to <body>, by every way out.
for (const { width, way } of [{ width: 1440, way: 'x' }, { width: 1440, way: 'escape' }, { width: 1024, way: 'back' }]) {
  test(`after «Discard» the focus goes back to the row (${way} at ${width})`, async ({ page }) => {
    await openEditor(page, { width })
    const row = zoneRow(page, '2km')
    await row.click()
    await detail(page).getByLabel('Name').fill('2km north')
    if (way === 'x') await page.getByRole('button', { name: 'Close zone' }).click()
    if (way === 'back') await page.getByRole('button', { name: 'Zones', exact: true }).click()
    if (way === 'escape') {
      await page.keyboard.press('Escape')
      await page.keyboard.press('Escape')
    }
    const dialog = page.getByRole('alertdialog', { name: 'Discard the changes to this zone?' })
    await dialog.getByRole('button', { name: 'Discard' }).click()
    await expect(detail(page)).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => document.activeElement?.closest('[data-section-split-key]')?.dataset.sectionSplitKey ?? document.activeElement?.tagName)).toBe('3')
  })
}

// review F3-2/F3-3: a way out of the host (closing the editor) asks about the open zone once; «Keep editing» keeps both.
test('closing the editor with a change asks once: «Keep editing» keeps the zone, «Discard» closes the editor', async ({ page }) => {
  await openEditor(page, { width: 1440 })
  await openZone(page, 'Zone Fast Bite principal')
  await detail(page).getByLabel('Name').fill('Zone Fast Bite north')
  await page.getByRole('button', { name: 'Close store editor' }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Discard the changes to this zone?' })
  await expect(dialog).toHaveCount(1)
  await dialog.getByRole('button', { name: 'Keep editing' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(detail(page).getByLabel('Name')).toHaveValue('Zone Fast Bite north')
  await page.getByRole('button', { name: 'Close store editor' }).click()
  await dialog.getByRole('button', { name: 'Discard' }).click()
  await expect(page.getByTestId('split-editor')).toHaveCount(0)
  await expect(dialog).toHaveCount(0)
})

// review F3-5: moving to another zone shows that zone's values in every field.
test('moving to another zone shows its own values', async ({ page }) => {
  await openEditor(page, { width: 1440 })
  await openZone(page, 'Zone 7')
  await zoneRow(page, 'Zone 9').click()
  await expect(detail(page).getByRole('heading', { name: 'Zone 9' })).toBeVisible()
  await expect(detail(page).getByLabel('Minimum purchase')).toHaveValue('$10.00')
})

// review F3-4: a wrapper that clips without scrolling (overflow-x: hidden, as some legacy section wrappers have) does not make the
// detail taller than what the section shows.
test('under a clipping wrapper the detail is never taller than the visible section', async ({ page }) => {
  await openEditor(page, { width: 1280, height: 800 })
  await page.evaluate(() => { document.querySelector('.odc-section-split').parentElement.style.overflowX = 'hidden' })
  await openZone(page, 'Zone 21')
  const sizes = await page.evaluate(() => ({
    max: Number.parseFloat(getComputedStyle(document.querySelector('.odc-section-split-detail')).maxHeight),
    visible: document.querySelector('[data-testid="split-content"]').clientHeight
  }))
  expect(sizes.max).toBeLessThanOrEqual(sizes.visible)
})
