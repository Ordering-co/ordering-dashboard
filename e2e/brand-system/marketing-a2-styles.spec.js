import { expect, test } from './fixtures'

// The batch keeps its own harness entry so the shared compact registry in
// scripts/brand-system/harness/main.jsx is never edited by a parallel session.
const batchUrl = (query = '') => `/scripts/brand-system/harness/marketing-a2.html?${query}`

const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']

// Reviewed role assignment for a2-enterprise-promotions: 51 migrated sites.
// Two pairs of near-identical files are in this batch and were given identical
// roles on purpose — SpecficCategory and SpecficProducts differ by a single
// margin line, OrderTypes and Paymethods only by their component names — so the
// same element cannot end up with two roles on two screens.
const ROLE_SIZES = [
  ['cond-header', '22px'],
  ['cond-condition-item', '14px'],
  ['zones-deliveryzones', '22px'],
  ['zones-deliveryzones-table', '12px'],
  ['zones-deliveryzones-table-content', '14px'],
  ['det-header', '22px'],
  ['det-tab', '13px'],
  ['det-wrapper-action-selector', '13px'],
  ['edit-single-edit-condition', '22px'],
  ['edit-input', '13px'],
  ['gen-upload-image-icon', '12px'],
  ['gen-input', '13px'],
  ['gen-date-range', '13px'],
  ['gen-label', '13px'],
  ['gen-order-priority', '13px'],
  ['gen-order-priority-controlvalue', '14px'],
  ['gen-stackable', '13px'],
  ['list-promotion-list-table', '12px'],
  ['list-promotion-list-table-content', '14px'],
  ['list-enable', '13px'],
  ['listing-workspace-header', '22px'],
  ['listing-workspace-tab', '13px'],
  ['listing-header-title', '22px'],
  ['max-container', '22px'],
  ['max-input', '13px'],
  ['max-input-controlvalue', '14px'],
  ['max-option', '14px'],
  ['otype-order-types', '22px'],
  ['otype-order-type-item', '13px'],
  ['pay-paymethods', '22px'],
  ['pay-paymethod-item', '13px'],
  ['rules-section-title', '18px'],
  ['rules-coupon-header', '13px'],
  ['rules-show-in-cart', '13px'],
  ['rules-show-in-cart-secondary', '12px'],
  ['rules-coupon-code', '13px'],
  ['rules-condtion-item', '13px'],
  ['rules-option', '14px'],
  ['rules-discount', '13px'],
  ['rules-automatic-enable', '13px'],
  ['sched-schedule', '22px'],
  ['cat-container', '22px'],
  ['cat-label', '13px'],
  ['cat-no-selected-business', '14px'],
  ['cat-option', '12px'],
  ['cat-option-controlvalue', '14px'],
  ['prod-container', '22px'],
  ['prod-label', '13px'],
  ['prod-no-selected-business', '14px'],
  ['prod-option', '12px'],
  ['prod-option-controlvalue', '14px']
]

// Five of the batch's six preservations. All five size an icon glyph rather
// than readable text, so no role may reach them. The sixth is a `font: inherit`
// on a styled.button — a reset that declares no size of its own — and it has
// nothing observable to assert, which is said here rather than quietly omitted.
const PRESERVATIONS = [
  ['cond-edit-icon', '16px'],
  ['cond-checkbox-icon', '16px'],
  ['det-action-icon', '20px'],
  ['gen-upload-icon', '25px'],
  ['list-dummy-image-icon', '18px']
]

const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, value] of Object.entries(values)) document.documentElement.style.setProperty(`--od-type-${role}-size`, value)
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-type-${role}-size`)
}, roles)

const PROBE = { title: '28px', 'section-title': '25px', content: '19px', secondary: '16px', control: '17px', 'control-value': '18px', identifier: '18px' }

for (const mode of ['light', 'dark']) {
  test(`marketing-a2 keeps governed typography and native controls in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('marketing-a2-styles')

    for (const [testid, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
    }

    // The tab strip is a native button carrying its own selected state.
    const tab = surface.getByTestId('det-tab')
    await expect(tab).toHaveAttribute('type', 'button')
    await expect(tab).toHaveJSProperty('tagName', 'BUTTON')
    await expect(tab).toHaveAttribute('aria-pressed', 'true')

    // The workspace tab was already a styled.button before this layer.
    await expect(surface.getByTestId('listing-workspace-tab')).toHaveAttribute('type', 'button')
    await expect(surface.getByTestId('listing-workspace-tab')).toHaveJSProperty('tagName', 'BUTTON')
    // Keyboard focus, not a pointer, must paint the governed 2px focus ring.
    await tab.focus()
    await expect(tab).toBeFocused()
    await expect(tab).toHaveCSS('outline-width', '2px')
    await expect(tab).toHaveCSS('outline-style', 'solid')

    await page.screenshot({ path: testInfo.outputPath(`marketing-a2-${mode}.png`), fullPage: true })
  })
}

test('the declared glyph preservations keep their literal size when every role moves', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('marketing-a2-styles')
  for (const [testid, size] of PRESERVATIONS) {
    await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
  }

  await setRoleSizes(page, PROBE)
  for (const [testid, size] of PRESERVATIONS) {
    await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
  }
  await restoreRoleSizes(page, ROLES)

  for (const [testid, size] of PRESERVATIONS) {
    await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
  }
})

test('central roles drive the real marketing-a2 styles and restore', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('marketing-a2-styles')

  // content and control-value both resolve to 14px today, so a 14px site cannot
  // be attributed to one of them by size alone; those are skipped here rather
  // than asserted on a guess, and are covered by ROLE_SIZES and the ruleset.
  const expected = { '22px': '28px', '18px': '25px', '14px': null, '12px': '16px', '13px': '17px' }

  await setRoleSizes(page, PROBE)
  for (const [testid, size] of ROLE_SIZES) {
    const moved = expected[size]
    if (!moved) continue
    await expect(surface.getByTestId(testid), `${testid} moves with its role`).toHaveCSS('font-size', moved)
  }

  await restoreRoleSizes(page, ROLES)
  for (const [testid, size] of ROLE_SIZES) {
    await expect(surface.getByTestId(testid), `${testid} restores`).toHaveCSS('font-size', size)
  }
})

test('how-it-is-applied pair is a named radiogroup of two real buttons with exact state', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const group = page.getByRole('radiogroup', { name: "How it's going to be applied?" })
  await expect(group).toHaveCount(1)

  const coupon = group.getByRole('radio', { name: 'Coupon' })
  const discount = group.getByRole('radio', { name: 'Discount' })
  await expect(group.getByRole('radio')).toHaveCount(2)
  for (const radio of [coupon, discount]) {
    await expect(radio).toHaveJSProperty('tagName', 'BUTTON')
    await expect(radio).toHaveAttribute('type', 'button')
    await expect(radio).not.toHaveAttribute('aria-pressed')
    await expect(radio.locator('svg')).toHaveAttribute('aria-hidden', 'true')
  }
  await expect(coupon).toHaveAttribute('aria-checked', 'true')
  await expect(discount).toHaveAttribute('aria-checked', 'false')

  // The button must fill the row exactly like the div it replaced. The radiogroup is a
  // display: contents wrapper (no box of its own), so the row is measured against the form container.
  const [formBox, couponBox] = await Promise.all([page.getByTestId('rules-apply-group').boundingBox(), coupon.boundingBox()])
  expect(couponBox.width).toBe(formBox.width)
  expect(await group.evaluate(node => getComputedStyle(node).display)).toBe('contents')

  // The group is only the title and the two radios, not the whole form container.
  expect(await group.evaluate(node => node.parentElement.getAttribute('role'))).toBeNull()

  // Keyboard reaches the radio and paints the governed 2px ring.
  await coupon.focus()
  await expect(coupon).toBeFocused()
  await expect(coupon).toHaveCSS('outline-width', '2px')
  await expect(coupon).toHaveCSS('outline-style', 'solid')
})

test('how-it-is-applied radios keep roving tabindex: one Tab stop, arrows move focus and checked', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const group = page.getByRole('radiogroup', { name: "How it's going to be applied?" })
  const coupon = group.getByRole('radio', { name: 'Coupon' })
  const discount = group.getByRole('radio', { name: 'Discount' })

  // Markup: tabindex 0 on the checked radio, -1 on the other.
  await expect(coupon).toHaveAttribute('tabindex', '0')
  await expect(discount).toHaveAttribute('tabindex', '-1')

  // Tab from the last control before the group lands on ONE radio, then leaves the group.
  await page.getByTestId('listing-workspace-tab').focus()
  await page.keyboard.press('Tab')
  await expect(coupon).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(discount).not.toBeFocused()
  expect(await page.evaluate(() => document.activeElement.getAttribute('role'))).not.toBe('radio')

  // Arrows select and move focus; tabindex follows the selection.
  await coupon.focus()
  await page.keyboard.press('ArrowRight')
  await expect(discount).toBeFocused()
  await expect(discount).toHaveAttribute('aria-checked', 'true')
  await expect(coupon).toHaveAttribute('aria-checked', 'false')
  await expect(discount).toHaveAttribute('tabindex', '0')
  await expect(coupon).toHaveAttribute('tabindex', '-1')

  await page.keyboard.press('ArrowDown')
  await expect(coupon).toBeFocused()
  await expect(coupon).toHaveAttribute('aria-checked', 'true')
  await expect(discount).toHaveAttribute('aria-checked', 'false')
  await expect(coupon).toHaveAttribute('tabindex', '0')
  await expect(discount).toHaveAttribute('tabindex', '-1')
})

test('condition rows keep the edit and remove controls separate, native and keyboard reachable', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const rows = page.getByTestId('cond-rows')

  // The rows that open the edit are no longer buttons: nothing is nested inside a control.
  for (const row of ['cond-row-active', 'cond-row-inactive']) {
    await expect(rows.getByTestId(row), row).toHaveJSProperty('tagName', 'DIV')
    await expect(rows.getByTestId(row), row).not.toHaveAttribute('type')
    await expect(rows.getByTestId(row), row).not.toHaveAttribute('role')
  }
  // The include-options row is a whole-row toggle with no nested control: it stays a button.
  await expect(rows.getByTestId('cond-row-include')).toHaveJSProperty('tagName', 'BUTTON')
  await expect(rows.getByTestId('cond-row-include')).toHaveAttribute('type', 'button')

  // The checked box is the only control that removes the condition.
  const checkbox = rows.getByRole('checkbox', { name: 'Product specific' })
  await expect(rows.getByRole('checkbox')).toHaveCount(1)
  await expect(checkbox).toHaveJSProperty('tagName', 'BUTTON')
  await expect(checkbox).toHaveAttribute('type', 'button')
  await expect(checkbox).toHaveAttribute('aria-checked', 'true')
  await expect(checkbox.locator('svg')).toHaveAttribute('aria-hidden', 'true')
  // The unchecked box is decorative: ticking a condition is done from its edit.
  const inactive = rows.getByTestId('cond-row-inactive-checkbox')
  await expect(inactive).toHaveAttribute('aria-hidden', 'true')
  await expect(inactive).toHaveJSProperty('tagName', 'DIV')

  // The pencil is the native edit control, named after its condition.
  const edits = rows.getByRole('button', { name: /^Edit: / })
  await expect(edits).toHaveCount(2)
  const activeEdit = rows.getByRole('button', { name: 'Edit: Product specific' })
  const inactiveEdit = rows.getByRole('button', { name: 'Edit: Schedule limit' })
  for (const edit of [activeEdit, inactiveEdit]) {
    await expect(edit).toHaveJSProperty('tagName', 'BUTTON')
    await expect(edit).toHaveAttribute('type', 'button')
    await expect(edit.locator('svg')).toHaveAttribute('aria-hidden', 'true')
  }

  // Tab reaches the checkbox, then each pencil, and paints the governed 2px ring.
  await page.keyboard.press('Tab')
  await expect(checkbox).toBeFocused()
  await expect(checkbox).toHaveCSS('outline-width', '2px')
  await expect(checkbox).toHaveCSS('outline-style', 'solid')
  await page.keyboard.press('Tab')
  await expect(activeEdit).toBeFocused()
  await expect(activeEdit).toHaveCSS('outline-width', '2px')
  await expect(activeEdit).toHaveCSS('outline-style', 'solid')
  await page.keyboard.press('Tab')
  await expect(inactiveEdit).toBeFocused()
  await expect(inactiveEdit).toHaveCSS('outline-width', '2px')

  // The controls keep the size they had as a span and a div.
  const [boxSize, editSize] = await Promise.all([checkbox.boundingBox(), activeEdit.boundingBox()])
  expect([boxSize.width, boxSize.height]).toEqual([18, 18])
  expect([editSize.width, editSize.height]).toEqual([30, 28])
})
