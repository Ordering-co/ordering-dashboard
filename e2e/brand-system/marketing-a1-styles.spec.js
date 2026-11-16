import { expect, test } from './fixtures'

// The batch keeps its own harness entry so the shared compact registry in
// scripts/brand-system/harness/main.jsx is never edited by a parallel session.
const batchUrl = (query = '') => `/scripts/brand-system/harness/marketing-a1.html?${query}`

const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']

// Reviewed role assignment for a1-campaigns: 48 migrated sites. control 13px,
// controlValue and content 14px, secondary 12px, sectionTitle 18px, title 22px.
// `identifier` takes no site in this batch, which continues what L4 already
// named: the markup almost always couples a technical value with its own label
// in a single declaration.
const ROLE_SIZES = [
  ['amount-title', '22px'],
  ['amount-radio-check', '13px'],
  ['amount-sub-title', '18px'],
  ['detail-campaign-detail', '14px'],
  ['detail-campaign-name', '22px'],
  ['detail-action-selector', '13px'],
  ['detail-tab', '13px'],
  ['detail-contact', '14px'],
  ['general-select', '13px'],
  ['general-select-controlvalue', '14px'],
  ['general-option', '14px'],
  ['general-input', '13px'],
  ['general-audience', '18px'],
  ['general-radio-check', '13px'],
  ['general-switch', '13px'],
  ['general-dynamic-content', '14px'],
  ['general-fixed-content', '14px'],
  ['general-fixed-content-sectiontitle', '18px'],
  ['general-fixed-status', '14px'],
  ['general-rules', '18px'],
  ['general-rules-secondary', '12px'],
  ['general-check-box', '13px'],
  ['general-end-date', '13px'],
  ['email-input', '13px'],
  ['email-input-control', '13px'],
  ['email-description', '14px'],
  ['email-contact', '14px'],
  ['header-header-title', '22px'],
  ['header-info-content', '12px'],
  ['list-table', '14px'],
  ['list-table-secondary', '12px'],
  ['list-switch', '13px'],
  ['list-status', '14px'],
  ['notif-input', '13px'],
  ['notif-description', '14px'],
  ['notif-contact', '14px'],
  ['popup-input', '13px'],
  ['sms-input', '13px'],
  ['sms-description', '14px'],
  ['sms-contact', '14px'],
  ['signup-title', '22px'],
  ['signup-radio-check', '13px'],
  ['users-title', '22px'],
  ['users-table', '14px'],
  ['users-thead', '12px'],
  ['webhook-input', '13px'],
  ['webhook-description', '14px'],
  ['whatsapp-input', '13px']
]

// The declared preservations that can be observed. Fifteen of the batch's
// seventeen render here; the other two are dead CSS, so the node their selector
// needs does not exist in the product and cannot exist in a fixture either.
//
// Eleven of these belong to a facsimile of the message the recipient receives —
// the SMS and push mocks, the WhatsApp bubble, the popup and the email preview.
// Their sizes are the customer's message, not this product's interface, so a
// role must never reach them. Three size an icon glyph. One is summernote's own
// sample of what an H1 looks like inside its format menu.
const PRESERVATIONS = [
  ['amount-arrow-icon', '12px'],
  ['detail-action-icon', '20px'],
  ['email-preview-title', '14px'],
  ['email-preview-body', '12px'],
  ['email-editor-specimen', '36px'],
  ['notif-preview-title', '10px'],
  ['notif-preview-body', '7px'],
  ['sms-preview-title', '10px'],
  ['sms-preview-body', '7px'],
  ['whatsapp-preview-title', '10px'],
  ['whatsapp-preview-body', '7px'],
  ['popup-email-preview-body', '12px'],
  ['popup-preview-copy', '10px'],
  ['popup-preview-title', '14px'],
  ['popup-close-icon', '16px']
]

const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, value] of Object.entries(values)) document.documentElement.style.setProperty(`--od-type-${role}-size`, value)
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-type-${role}-size`)
}, roles)

const PROBE = { title: '28px', 'section-title': '25px', content: '19px', secondary: '16px', control: '17px', 'control-value': '18px', identifier: '18px' }

for (const mode of ['light', 'dark']) {
  test(`marketing-a1 keeps governed typography and native controls in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('marketing-a1-styles')

    for (const [testid, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
    }

    // The controls this batch converted are native buttons carrying their own
    // state, not divs with a click handler.
    const amountOption = surface.getByTestId('amount-radio-button')
    await expect(amountOption).toHaveAttribute('type', 'button')
    await expect(amountOption).toHaveJSProperty('tagName', 'BUTTON')
    await expect(amountOption).toHaveAttribute('aria-pressed', 'true')

    const signupOption = surface.getByTestId('signup-radio-button')
    await expect(signupOption).toHaveAttribute('type', 'button')
    await expect(signupOption).toHaveJSProperty('tagName', 'BUTTON')
    await expect(signupOption).toHaveAttribute('aria-pressed', 'false')

    // A mutually exclusive pair is a radiogroup with a name; each option exposes
    // checked state through the browser accessibility tree, not aria-pressed.
    // Audience holds Dynamic and Fixed; Delivery Schedule is nested inside it and
    // keeps its own two radios, so neither pair leaks into the other's group.
    const audienceGroup = surface.getByRole('radiogroup', { name: 'Audience' })
    await expect(audienceGroup).toHaveAttribute('aria-labelledby', 'fixture-marketing-general-audience')
    await expect(audienceGroup.getByRole('radio', { name: 'Dynamic', checked: false })).toHaveCount(1)
    await expect(audienceGroup.getByRole('radio', { name: 'Fixed', checked: true })).toHaveCount(1)
    for (const name of ['Dynamic', 'Fixed']) {
      const option = surface.getByRole('radio', { name, exact: true })
      await expect(option).toHaveJSProperty('tagName', 'BUTTON')
      await expect(option).toHaveAttribute('type', 'button')
      await expect(option).not.toHaveAttribute('aria-pressed')
    }
    const scheduleGroup = surface.getByRole('radiogroup', { name: 'Delivery Schedule' })
    await expect(scheduleGroup.getByRole('radio')).toHaveCount(2)
    await expect(scheduleGroup.getByRole('radio', { name: 'Dynamic' })).toHaveCount(0)
    await expect(scheduleGroup.getByRole('radio', { name: 'Fixed' })).toHaveCount(0)
    await expect(scheduleGroup.getByRole('radio', { name: 'Send now', checked: true })).toHaveCount(1)
    await expect(scheduleGroup.getByRole('radio', { name: 'Schedule for later', checked: false })).toHaveCount(1)
    // Each radio resolves to its nearest group, not to the outer Audience one.
    await expect(surface.locator('[role=radio]')).toHaveCount(4)
    expect(await surface.locator('[role=radio]').evaluateAll(nodes => nodes.map(node => node.closest('[role=radiogroup]').getAttribute('aria-labelledby'))))
      .toEqual(['fixture-marketing-general-audience', 'fixture-marketing-general-audience', 'fixture-marketing-general-schedule', 'fixture-marketing-general-schedule'])
    const audienceOption = surface.getByRole('radio', { name: 'Send now', checked: true })
    await expect(audienceOption).toHaveCount(1)
    await expect(audienceOption).toHaveAttribute('type', 'button')
    await expect(audienceOption).toHaveJSProperty('tagName', 'BUTTON')
    await expect(audienceOption).not.toHaveAttribute('aria-pressed')
    await expect(surface.getByRole('radio', { name: 'Schedule for later', checked: false })).toHaveCount(1)

    // The rule selector is a checkbox, so it exposes checked state, not pressed,
    // and it carries its own accessible name because its label sits beside it.
    const ruleControl = surface.getByRole('checkbox', { name: 'Require email confirmation' })
    await expect(ruleControl).toHaveAttribute('type', 'button')
    await expect(ruleControl).toHaveJSProperty('tagName', 'BUTTON')
    await expect(ruleControl).toHaveAttribute('aria-checked', 'true')

    // The campaign tabs are native buttons in the tab order, not divs with a click
    // handler: pressed state is exact, they keep the div's look, and the keyboard
    // reaches General and then Content.
    const tabGeneral = surface.getByRole('button', { name: 'General', exact: true })
    const tabContent = surface.getByRole('button', { name: 'Content', exact: true })
    for (const tab of [tabGeneral, tabContent]) {
      await expect(tab).toHaveJSProperty('tagName', 'BUTTON')
      await expect(tab).toHaveAttribute('type', 'button')
      await expect(tab).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
      await expect(tab).toHaveCSS('border-top-width', '0px')
      await expect(tab).toHaveCSS('padding', '10px 0px')
      await expect(tab).toHaveCSS('text-align', 'left')
    }
    await expect(tabGeneral).toHaveAttribute('aria-pressed', 'true')
    await expect(tabContent).toHaveAttribute('aria-pressed', 'false')
    await expect(tabGeneral).toHaveCSS('border-bottom-width', '1px')
    await expect(tabContent).toHaveCSS('border-bottom-width', '0px')
    await tabGeneral.focus()
    await expect(tabGeneral).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(tabContent).toBeFocused()
    await expect(tabContent).toHaveCSS('outline-width', '2px')
    await expect(tabContent).toHaveCSS('outline-style', 'solid')

    // Keyboard focus, not a pointer, must paint the governed 2px focus ring.
    await amountOption.focus()
    await expect(amountOption).toBeFocused()
    await expect(amountOption).toHaveCSS('outline-width', '2px')
    await expect(amountOption).toHaveCSS('outline-style', 'solid')

    await page.screenshot({ path: testInfo.outputPath(`marketing-a1-${mode}.png`), fullPage: true })
  })
}

test('Audience and Delivery Schedule keep roving tabindex: one Tab stop per group, arrows stay in their group', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('marketing-a1-styles')
  const audience = surface.getByRole('radiogroup', { name: 'Audience' })
  const schedule = surface.getByRole('radiogroup', { name: 'Delivery Schedule' })
  const dynamic = surface.getByRole('radio', { name: 'Dynamic', exact: true })
  const fixed = surface.getByRole('radio', { name: 'Fixed', exact: true })
  const sendNow = schedule.getByRole('radio', { name: 'Send now' })
  const later = schedule.getByRole('radio', { name: 'Schedule for later' })

  // Markup: exactly one tabindex 0 per group, on the checked radio.
  await expect(dynamic).toHaveAttribute('tabindex', '-1')
  await expect(fixed).toHaveAttribute('tabindex', '0')
  await expect(sendNow).toHaveAttribute('tabindex', '0')
  await expect(later).toHaveAttribute('tabindex', '-1')
  expect(await surface.locator('[role=radio][tabindex="0"]').count()).toBe(2)

  // Tab reaches ONE radio of Audience, then ONE of Delivery Schedule (it skips the unchecked ones).
  await surface.getByLabel('Campaign name').focus()
  await page.keyboard.press('Tab')
  await expect(fixed).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(sendNow).toBeFocused()

  // Arrows in Audience select and move focus within Audience; they never reach Delivery Schedule.
  await fixed.focus()
  await page.keyboard.press('ArrowRight')
  await expect(dynamic).toBeFocused()
  await expect(dynamic).toHaveAttribute('aria-checked', 'true')
  await expect(fixed).toHaveAttribute('aria-checked', 'false')
  await expect(dynamic).toHaveAttribute('tabindex', '0')
  await expect(fixed).toHaveAttribute('tabindex', '-1')
  await page.keyboard.press('ArrowDown')
  await expect(fixed).toBeFocused()
  await expect(fixed).toHaveAttribute('aria-checked', 'true')
  // Delivery Schedule did not change.
  await expect(sendNow).toHaveAttribute('aria-checked', 'true')
  await expect(later).toHaveAttribute('aria-checked', 'false')
  await expect(sendNow).toHaveAttribute('tabindex', '0')
  await expect(later).toHaveAttribute('tabindex', '-1')

  // Arrows in Delivery Schedule move inside it and never leave for Audience.
  await sendNow.focus()
  await page.keyboard.press('ArrowRight')
  await expect(later).toBeFocused()
  await expect(later).toHaveAttribute('aria-checked', 'true')
  await expect(sendNow).toHaveAttribute('aria-checked', 'false')
  await expect(later).toHaveAttribute('tabindex', '0')
  await expect(sendNow).toHaveAttribute('tabindex', '-1')
  await page.keyboard.press('ArrowRight')
  await expect(sendNow).toBeFocused()
  await expect(audience.getByRole('radio', { name: 'Fixed', checked: true })).toHaveCount(1)
  await expect(dynamic).toHaveAttribute('aria-checked', 'false')
})

test('the declared preservations keep their literal size when every role moves', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('marketing-a1-styles')
  for (const [testid, size] of PRESERVATIONS) {
    await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
  }

  // Moving every role must NOT move a preservation: that is what the word means,
  // and for the message previews it is the difference between showing the
  // operator what the customer will receive and showing them something else.
  await setRoleSizes(page, PROBE)
  for (const [testid, size] of PRESERVATIONS) {
    await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
  }
  await restoreRoleSizes(page, ROLES)

  for (const [testid, size] of PRESERVATIONS) {
    await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
  }
})

test('central roles drive the real marketing-a1 styles and restore', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('marketing-a1-styles')

  // content and control-value both resolve to 14px today, so a 14px site cannot
  // be attributed to one of them by size alone. Those sites are covered by
  // ROLE_SIZES above and by the ruleset; here they are deliberately skipped
  // rather than asserted on a guess.
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
