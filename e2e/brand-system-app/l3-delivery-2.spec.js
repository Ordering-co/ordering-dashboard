import {
  expect,
  expectClosedNetworkBoundary,
  installAppNetworkBoundary,
  installSyntheticSession,
  test
} from './delivery-2-fixtures'
import { tokens } from '../../src/brand/ordering.tokens.generated'
import { overlapProbeSource } from '../../scripts/redesign/tools/overlap-probe.mjs'

// redesign DG-F3: two scales are in play. The panel (RecordPanel title, SectionNav selector) is Product and reads the product
// type scale `--od-x-type-*` (src/brand/candidates.css); the General form is still the Part 1 styled block and reads `--od-type-*-size`.
// `prefix` picks the family: '--od-type-' (Part 1 roles) or '--od-x-type-' (Product scale).
const setRoleSizes = (page, sizes, prefix = '--od-type-') => page.evaluate(({ values, prefix }) => {
  for (const [role, value] of Object.entries(values)) document.documentElement.style.setProperty(`${prefix}${role}-size`, value)
}, { values: sizes, prefix })
const restoreRoleSizes = (page, roles, prefix = '--od-type-') => page.evaluate(({ values, prefix }) => {
  for (const role of values) document.documentElement.style.removeProperty(`${prefix}${role}-size`)
}, { values: roles, prefix })

// redesign DG-F3: decision 12 (W0-3d). The box of a Product control does not grow: it is SEEN at 32 and its 44×44 touch
// area is a centered pseudo-element, on a coarse pointer or below 768px. Where the box is already 44 or more the area is the box. On a
// fine pointer on desktop the contract is the piece's own: the seen box is the 32px control height, no pseudo-element.
const touchArea = (locator) => locator.evaluate(element => {
  const box = element.getBoundingClientRect()
  const pseudo = getComputedStyle(element, '::after')
  const drawn = pseudo.content !== 'none' && pseudo.position === 'absolute'
  const pw = drawn ? parseFloat(pseudo.width) : 0
  const ph = drawn ? parseFloat(pseudo.height) : 0
  return { boxWidth: box.width, boxHeight: box.height, areaWidth: Math.max(box.width, pw || 0), areaHeight: Math.max(box.height, ph || 0), pseudo: drawn }
})
const expectTouchReach = async (locator, phone, what) => {
  const area = await touchArea(locator)
  if (phone) {
    expect(area.areaHeight, `${what}: 44px area high (box ${area.boxWidth}x${area.boxHeight}, pseudo ${area.pseudo})`).toBeGreaterThanOrEqual(44)
    expect(area.areaWidth, `${what}: 44px area wide (box ${area.boxWidth}x${area.boxHeight}, pseudo ${area.pseudo})`).toBeGreaterThanOrEqual(44)
  } else {
    // fine pointer: the piece's contract, a box of the control height (32px) or taller, and no pseudo-element
    expect(area.boxHeight, `${what}: seen at the control height (box ${area.boxWidth}x${area.boxHeight})`).toBeGreaterThanOrEqual(32)
    expect(area.pseudo, `${what}: no touch pseudo-element with a fine pointer`).toBe(false)
  }
}

for (const [name, viewport] of Object.entries({
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 }
})) {
  test(`${name} Delivery-2 driver group details keep section navigation, roles and native selection governed`, async ({ context, page }, testInfo) => {
    test.setTimeout(120000)
    const network = await installAppNetworkBoundary(context)
    await installSyntheticSession(context, { authenticated: true })
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    await page.setViewportSize(viewport)
    await page.goto('/delivery/drivers-groups', { waitUntil: 'domcontentloaded' })

    const group = page.getByText('Downtown couriers', { exact: true }).first()
    await expect(group).toBeVisible({ timeout: 90000 })
    const accept = page.getByRole('button', { name: 'Accept', exact: true })
    const noticeVisible = await accept.last().waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false)
    if (noticeVisible) await accept.last().click()

    const writesBeforeInteractions = network.blockedWrites.length
    await group.click()
    await expect(page).toHaveURL(/(?:\?|&)id=975001(?:&|$)/)

    const heading = page.getByRole('heading', { name: 'Downtown couriers', exact: true })
    await expect(heading).toBeVisible()
    await expect(heading).toHaveCSS('font-size', '22px')

    // redesign DG-F3: the settings tab bar is now RecordPanel + SectionNav (level 0, seven sections). Beside a panel
    // narrower than 640px (the split view on desktop, and the phone) it is one selector: a nav named «Driver group settings»
    // whose trigger shows the current section.
    const sectionNav = page.getByRole('navigation', { name: 'Driver group settings', exact: true })
    await expect(sectionNav).toBeVisible()
    const general = sectionNav.getByRole('button', { name: 'Section General', exact: true })
    await expect(general).toBeVisible()
    await expect(general).toHaveText('General')
    await expect(general).toHaveCSS('font-size', tokens.font.size.productUi)
    await expectTouchReach(general, name === 'mobile', 'section selector') // redesign DG-F3

    // the Name field (Product TextField) carries the «Required» mark in its name and gets its own id
    const nameField = page.getByRole('textbox', { name: 'Name Required', exact: true })
    await expect(nameField).toBeVisible()
    const nameLabel = page.locator(`label[for="${await nameField.getAttribute('id')}"]`)
    await expect(nameLabel).toHaveCSS('font-size', tokens.font.size.productUi)

    // redesign DG-F3: title -> x-type title (panel title), control -> x-type ui (section selector); the Name label keeps the Part 1 control role
    await setRoleSizes(page, { title: '28px', ui: '17px' }, '--od-x-type-')
    await setRoleSizes(page, { title: '28px', control: '17px', content: '19px', secondary: '16px' })
    await expect(heading).toHaveCSS('font-size', '28px')
    await expect(general).toHaveCSS('font-size', '17px')
    await expect(nameLabel).toHaveCSS('font-size', '17px')
    // redesign DG-F3: the panel slides in (a transition of about a second); the document may be 1-3px wider than the viewport
    // while it moves. The bar is the same, measured once it rests: it settles within 5s and stays inside the viewport.
    await expect.poll(
      () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
      { message: 'the document does not scroll sideways with larger text once the panel rests', timeout: 5000 }
    ).toBeLessThanOrEqual(0)
    await restoreRoleSizes(page, ['title', 'control', 'content', 'secondary'])
    await restoreRoleSizes(page, ['title', 'ui'], '--od-x-type-') // redesign DG-F3
    await expect(heading).toHaveCSS('font-size', '22px')
    await expect(nameLabel).toHaveCSS('font-size', tokens.font.size.productUi)

    // redesign DG-F3: open the selector, General is the checked section, choose Businesses
    await general.click()
    const sectionMenu = page.getByRole('menu')
    await expect(sectionMenu).toBeVisible()
    await expect(sectionMenu.getByRole('menuitemradio', { name: 'General', exact: true })).toHaveAttribute('aria-checked', 'true')
    await sectionMenu.getByRole('menuitemradio', { name: 'Businesses', exact: true }).click()
    await expect(sectionNav.getByRole('button', { name: 'Section Businesses', exact: true })).toBeVisible()
    await expect(page).toHaveURL(/(?:\?|&)tab=businesses(?:&|$)/)
    const panel = page.locator('.gp-section:not([hidden])') // redesign DG-F3: the open section (no tabpanel role now)
    await expect(panel).toBeVisible()

    const businessOption = panel.getByLabel('Synthetic Store Alpha', { exact: true })
    await expect(businessOption).toBeVisible()
    // since the store is a DriversGroupPickRow whose title is a one-line label, not main's tall label. On a
    // phone the row is one touch target high and its checkbox reaches 44×44; with a mouse the checkbox keeps its fine target.
    if (name === 'mobile') {
      expect((await panel.locator('li.gpl-row', { hasText: 'Synthetic Store Alpha' }).boundingBox()).height).toBeGreaterThanOrEqual(44)
      await expectTouchReach(businessOption, true, 'store checkbox')
    }
    const selectAll = panel.getByRole('button', { name: 'Select all', exact: true })
    // since «Select all» is a small Product button (DriversGroupPickList), below the 32px control height with
    // a mouse; the 44px reach on a phone is what still holds
    if (name === 'mobile') await expectTouchReach(selectAll, true, 'Select all')

    await page.screenshot({ path: testInfo.outputPath(`${name}-delivery-2-group.png`), fullPage: true })

    expect(network.blockedWrites.length).toBe(writesBeforeInteractions)
    expect(pageErrors).toEqual([])
    expectClosedNetworkBoundary(network)
  })
}

// at 390 the 44px area of the «Temporary driver» checkbox of a selected driver covered 6×32px of the link beside it.
// Selecting both drivers (local state only, nothing is saved) shows the extra on each row; the rows must have no overlapping pair.
for (const width of [1440, 1280, 912, 390]) {
  test(`${width}px drivers group rows draw the temporary driver extra without overlaps`, async ({ context, page }) => {
    const network = await installAppNetworkBoundary(context)
    await installSyntheticSession(context, { authenticated: true })
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/delivery/drivers-groups?id=975001', { waitUntil: 'domcontentloaded' })
    const rows = page.locator('ul.gpl-rows').filter({ hasText: 'Ada Lovelace' })
    for (const name of ['Ada Lovelace', 'Grace Hopper with a long dispatch surname']) await rows.getByRole('checkbox', { name, exact: true }).click()
    await expect(rows.locator('.gpl-extra')).toHaveCount(2)
    await page.waitForTimeout(1200) // the panel slides in; measure once it rests
    const result = await page.evaluate(`(${overlapProbeSource})({ root: 'ul.gpl-rows:has(.gpl-extra)' })`)
    expect(result.pairs, `overlapping pairs at ${width}px`).toEqual([])
    expect(network.blockedWrites.filter(write => write.includes('/drivergroups'))).toEqual([]) // selecting saves nothing
    expectClosedNetworkBoundary(network)
  })
}
