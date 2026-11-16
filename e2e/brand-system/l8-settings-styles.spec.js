import { expect, test } from './fixtures'

// The batch keeps its own harness entry so the shared compact registry in
// scripts/brand-system/harness/main.jsx is never edited by a parallel session.
const batchUrl = (query = '') => `/scripts/brand-system/harness/l8-settings.html?${query}`

const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']

// Default size of each role, as set by the coordinator.
const ROLE_DEFAULTS = {
  title: '22px',
  'section-title': '18px',
  content: '14px',
  secondary: '12px',
  control: '13px',
  'control-value': '14px',
  identifier: '13px'
}

// One entry per rule of scripts/brand-system/l8-settings-typography-rules.json
// (63 rules), in the SAME ORDER as the rules, with the default size of the role
// the rule assigns (the role is the comment on each line). Entry i pairs with
// rule i; do not sort this by role.
//
// Prefixes: aul = ApiUsageLimits, mcp = McpTokens, scb = SettingsCustomBlocks,
// sls = SettingsLoyaltyStores.
const ROLE_SIZES = [
  ['aul-search-input', '14px'], // control-value
  ['aul-refresh', '13px'], // control
  ['aul-notice', '14px'], // content
  ['aul-empty-title', '18px'], // section-title
  ['aul-empty-text', '14px'], // content
  ['aul-card-title', '14px'], // content
  ['aul-card-meta', '12px'], // secondary
  ['aul-status-badge', '12px'], // secondary
  ['aul-card-footer', '14px'], // content
  ['aul-footer-meta', '12px'], // secondary
  ['mcp-header-title', '22px'], // title
  ['mcp-header-text', '14px'], // content
  ['mcp-section-title', '18px'], // section-title
  ['mcp-section-text', '14px'], // content
  ['mcp-section-header-title', '18px'], // section-title
  ['mcp-section-header-button', '13px'], // control
  ['mcp-notice', '14px'], // content
  ['mcp-notice-button', '13px'], // control
  ['mcp-coming-soon-badge', '12px'], // secondary
  ['mcp-coming-soon-title', '18px'], // section-title
  ['mcp-coming-soon-text', '14px'], // content
  ['mcp-copy-code', '13px'], // identifier
  ['mcp-code-block-pre', '13px'], // identifier
  ['mcp-token-title', '14px'], // content
  ['mcp-scope-pill', '12px'], // secondary
  ['mcp-token-facts', '12px'], // secondary
  ['mcp-token-facts-code', '13px'], // identifier
  ['mcp-inactive-toggle', '13px'], // control
  ['mcp-status-badge', '12px'], // secondary
  ['mcp-link-action', '13px'], // control
  ['mcp-empty-title', '18px'], // section-title
  ['mcp-empty-text', '14px'], // content
  ['mcp-empty-button', '13px'], // control
  ['mcp-guide-tab', '13px'], // control
  ['mcp-steps-step', '12px'], // secondary
  ['mcp-steps-title', '14px'], // content
  ['mcp-steps-text', '14px'], // content
  ['mcp-option-label', '12px'], // secondary
  ['mcp-field-label', '13px'], // control
  ['mcp-field-help', '12px'], // secondary
  ['mcp-chip', '13px'], // control
  ['mcp-scope-option-title', '13px'], // control
  ['mcp-scope-option-text', '12px'], // secondary
  ['mcp-data-notice', '14px'], // content
  ['mcp-data-notice-title', '14px'], // content
  ['mcp-secret-text', '14px'], // content
  ['mcp-secret-code', '13px'], // identifier
  ['scb-block-title', '18px'], // section-title
  ['scb-block-help', '14px'], // content
  ['scb-field-label', '13px'], // control
  ['scb-field-help', '12px'], // secondary
  ['scb-field-control', '14px'], // control-value
  ['scb-field-error', '12px'], // secondary
  ['scb-field-select', '14px'], // control-value
  ['scb-preview-item', '14px'], // content
  ['scb-toggle-row', '13px'], // control
  ['scb-table', '14px'], // content
  ['scb-table-th', '12px'], // secondary
  ['scb-table-input', '14px'], // control-value
  ['sls-card-title', '18px'], // section-title
  ['sls-card-help', '14px'], // content
  ['sls-tab', '13px'], // control
  ['sls-block-help', '14px'] // content
]

// The role of each site above, in the same order, read from the `replace` of the
// rule. ROLE_SIZES alone cannot say which role a 14px site takes (content and
// control-value both default to 14px) or a 13px one (control and identifier), so
// the probe test below needs this to move each site by ITS role.
const SITE_ROLES = [
  ['aul-search-input', 'control-value'],
  ['aul-refresh', 'control'],
  ['aul-notice', 'content'],
  ['aul-empty-title', 'section-title'],
  ['aul-empty-text', 'content'],
  ['aul-card-title', 'content'],
  ['aul-card-meta', 'secondary'],
  ['aul-status-badge', 'secondary'],
  ['aul-card-footer', 'content'],
  ['aul-footer-meta', 'secondary'],
  ['mcp-header-title', 'title'],
  ['mcp-header-text', 'content'],
  ['mcp-section-title', 'section-title'],
  ['mcp-section-text', 'content'],
  ['mcp-section-header-title', 'section-title'],
  ['mcp-section-header-button', 'control'],
  ['mcp-notice', 'content'],
  ['mcp-notice-button', 'control'],
  ['mcp-coming-soon-badge', 'secondary'],
  ['mcp-coming-soon-title', 'section-title'],
  ['mcp-coming-soon-text', 'content'],
  ['mcp-copy-code', 'identifier'],
  ['mcp-code-block-pre', 'identifier'],
  ['mcp-token-title', 'content'],
  ['mcp-scope-pill', 'secondary'],
  ['mcp-token-facts', 'secondary'],
  ['mcp-token-facts-code', 'identifier'],
  ['mcp-inactive-toggle', 'control'],
  ['mcp-status-badge', 'secondary'],
  ['mcp-link-action', 'control'],
  ['mcp-empty-title', 'section-title'],
  ['mcp-empty-text', 'content'],
  ['mcp-empty-button', 'control'],
  ['mcp-guide-tab', 'control'],
  ['mcp-steps-step', 'secondary'],
  ['mcp-steps-title', 'content'],
  ['mcp-steps-text', 'content'],
  ['mcp-option-label', 'secondary'],
  ['mcp-field-label', 'control'],
  ['mcp-field-help', 'secondary'],
  ['mcp-chip', 'control'],
  ['mcp-scope-option-title', 'control'],
  ['mcp-scope-option-text', 'secondary'],
  ['mcp-data-notice', 'content'],
  ['mcp-data-notice-title', 'content'],
  ['mcp-secret-text', 'content'],
  ['mcp-secret-code', 'identifier'],
  ['scb-block-title', 'section-title'],
  ['scb-block-help', 'content'],
  ['scb-field-label', 'control'],
  ['scb-field-help', 'secondary'],
  ['scb-field-control', 'control-value'],
  ['scb-field-error', 'secondary'],
  ['scb-field-select', 'control-value'],
  ['scb-preview-item', 'content'],
  ['scb-toggle-row', 'control'],
  ['scb-table', 'content'],
  ['scb-table-th', 'secondary'],
  ['scb-table-input', 'control-value'],
  ['sls-card-title', 'section-title'],
  ['sls-card-help', 'content'],
  ['sls-tab', 'control'],
  ['sls-block-help', 'content']
]

// The one declared preservation of the batch: McpTokens `Steps > li > code`,
// 12.5px. The product renders no such node; the fixture mounts it literally (see
// the header of l8-settings-styles.jsx) to prove the selector exists and that its
// literal survives every role moving.
const PRESERVATIONS = [
  ['mcp-steps-dead-code', '12.5px']
]

// Sites whose rule targets a pseudo-element: toHaveCSS reads the element, not the
// pseudo, so these are read with getComputedStyle(node, pseudo).
const PSEUDO = {
  'mcp-steps-step': '::before'
}

const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, size] of Object.entries(values)) {
    document.documentElement.style.setProperty(`--od-type-${role}-size`, size)
  }
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-type-${role}-size`)
}, roles)

// Every role gets a DIFFERENT probe, so a site can be attributed to its role even
// where two roles share a default size.
const PROBE = { title: '28px', 'section-title': '25px', content: '19px', secondary: '16px', control: '17px', 'control-value': '21px', identifier: '23px' }

const expectFontSize = async (surface, testid, size, message = testid) => {
  const node = surface.getByTestId(testid)
  const pseudo = PSEUDO[testid]
  if (!pseudo) {
    await expect(node, message).toHaveCSS('font-size', size)
    return
  }
  const measured = await node.evaluate((element, which) => getComputedStyle(element, which).fontSize, pseudo)
  expect(measured, message).toBe(size)
}

for (const mode of ['light', 'dark']) {
  test(`l8-settings keeps governed typography in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('l8-settings-styles')

    // Exactly one node per rule and per preservation: 63 + 1.
    expect(ROLE_SIZES).toHaveLength(63)
    expect(SITE_ROLES).toHaveLength(63)
    expect(PRESERVATIONS).toHaveLength(1)
    for (const [testid] of [...ROLE_SIZES, ...PRESERVATIONS]) {
      await expect(surface.getByTestId(testid), `${testid} is mounted once`).toHaveCount(1)
    }

    for (const [testid, size] of ROLE_SIZES) {
      await expectFontSize(surface, testid, size)
    }
    for (const [testid, size] of PRESERVATIONS) {
      await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
    }

    await page.screenshot({ path: testInfo.outputPath(`l8-settings-${mode}.png`), fullPage: true })
  })
}

test('central roles drive the real l8-settings styles and restore', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('l8-settings-styles')

  // The two tables must agree before either is trusted: the size of every site is
  // the default of the role the same site is moved by below.
  ROLE_SIZES.forEach(([testid, size], index) => {
    expect(SITE_ROLES[index][0], `SITE_ROLES[${index}] pairs with ROLE_SIZES[${index}]`).toBe(testid)
    expect(size, `${testid} default matches its role`).toBe(ROLE_DEFAULTS[SITE_ROLES[index][1]])
  })

  await setRoleSizes(page, PROBE)
  for (const [testid, role] of SITE_ROLES) {
    await expectFontSize(surface, testid, PROBE[role], `${testid} moves with ${role}`)
  }
  // The preserved literal must NOT move with any role.
  for (const [testid, size] of PRESERVATIONS) {
    await expect(surface.getByTestId(testid), `${testid} stays literal when every role moves`).toHaveCSS('font-size', size)
  }

  await restoreRoleSizes(page, ROLES)
  for (const [testid, size] of ROLE_SIZES) {
    await expectFontSize(surface, testid, size, `${testid} restores`)
  }
  for (const [testid, size] of PRESERVATIONS) {
    await expect(surface.getByTestId(testid), `${testid} restores`).toHaveCSS('font-size', size)
  }
})

test.describe('l8-settings at 320px RTL coarse pointer', () => {
  test.use({ viewport: { width: 320, height: 900 }, hasTouch: true, isMobile: true })

  test('does not overflow horizontally', async ({ page }, testInfo) => {
    await page.goto(batchUrl('mode=dark&rtl=true&locale=ar'))
    const surface = page.getByTestId('l8-settings-styles')
    await expect(surface).toBeVisible()

    const documentGeometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(documentGeometry.document).toBeLessThanOrEqual(documentGeometry.viewport)

    // One pixel absorbs sub-pixel rounding of percentage widths.
    const geometry = await surface.evaluate(node => ({ clientWidth: node.clientWidth, scrollWidth: node.scrollWidth }))
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1)

    await page.screenshot({ path: testInfo.outputPath('l8-settings-dark-rtl-320.png'), fullPage: true })
  })
})
