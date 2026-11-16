import { expect, test } from './fixtures'

// The batch keeps its own harness entry so the shared compact registry in
// scripts/brand-system/harness/main.jsx is never edited by a parallel session.
const batchUrl = (query = '') => `/scripts/brand-system/harness/l8-shell.html?${query}`

const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']

// L8 lot 3.2 (l8-shell): CommandPalette and Login/AuthLayout (the Assistant left
// the lot with , when its styled-components file was replaced by Product
// CSS). 13 sites migrated to a role (20 minus the seven AuthLayout sites that went
// back to main's rem scale, see REM_SCALE_SIZES). Role defaults: title 22px, section-title 18px, content 14px,
// secondary 12px, control 13px, control-value 14px, identifier 13px.
//
// The order of this table is the order of the migration rules in
// scripts/brand-system/l8-shell-typography-rules.json (entry i pairs with rule i).
const ROLE_SIZES = [
  ['cp-content-group-heading', '12px'], // secondary
  ['cp-contextchip', '14px'], // control-value
  ['cp-kbd', '12px'], // secondary
  ['cp-itemtitle', '14px'], // content
  ['cp-itemsubtitle', '12px'], // secondary
  ['cp-badge', '12px'], // secondary
  ['cp-statusrow', '12px'], // secondary
  ['cp-emptystate-p', '14px'], // content
  ['cp-emptystate-p-p', '12px'], // secondary
  ['cp-footer', '12px'], // secondary
  ['cp-triggerbutton', '13px'], // control
  ['auth-route-li', '13px'], // control
  ['auth-divider', '12px'] // secondary
]

// The seven Login/AuthLayout sites that `main` sizes with the rem scale of its
// adapter (`--od-font-size-2` = 0.875rem). They are NOT migrated to the `content`
// role (14px fixed): that would stop the login scaling with the browser font
// size, a behaviour `main` ships (user decision 2026-10-04). They measure 14px at
// the default 16px root, the same value `content` has, and 17.5px at a 20px root.
// They are preservations in the ruleset, so they ignore the role probe.
const REM_SCALE_SIZES = [
  ['auth-logincontainer', '14px', '17.5px'],
  ['auth-titleformside-p', '14px', '17.5px'],
  ['auth-tab', '14px', '17.5px'],
  ['auth-field-label', '14px', '17.5px'],
  ['auth-controlstyles', '14px', '17.5px'], // the min-width: 768px branch, at 1280px
  ['auth-buttonbase', '14px', '17.5px'],
  ['auth-redirectlink', '14px', '17.5px']
]

// The preservations whose size is the SAME at 1280px before and after the
// migration, so one pinned value is valid on both sides of it.
//
//   - Literal and token sizes are taken from the declaration: 16px text-input
//     size (the iOS focus-zoom floor), 16px glyph, 20px OTP digits, and
//     `--od-font-size-6` = 1.75rem = 28px.
//   - The `clamp(...)` entry is PINNED to the browser's computed value at 1280px
//     (confirmed by a run of this spec), because it does not change with the
//     migration: `clamp(2rem, 3.2vw, 2.75rem)` resolves to 3.2vw = 40.96px.
const PRESERVATIONS = [
  ['cp-inputrow-input', '16px'], // [cmdk-input], unconditional
  ['cp-triggerbutton-svg', '16px'], // && svg, glyph size
  ['auth-herocaption', '40.96px'], // clamp(2rem, 3.2vw, 2.75rem) at 1280px
  ['auth-titleformside-h1', '28px'], // var(--od-font-size-6)
  ['auth-countdowntimer', '28px'], // var(--od-font-size-6)
  ['auth-otp-input', '20px'] // .otp-input digits
]

// The preservation that only exists BELOW a breakpoint. At 1280px the sibling
// declaration (a migrated rule) wins, so its value there moves with the
// migration; it is measured at 320px with a coarse pointer instead, where the
// declaration is the one that applies.
const NARROW_PRESERVATIONS = [
  ['auth-controlstyles-font-size-3', '16px'] // var(--od-font-size-3), below 768px
]

// The `font: inherit` resets. Each is a second node of the same styled component
// as its rule (a node cannot carry both testids). Its container is the parent
// element, which inherits the login's `content` size.
//   - 'size': the node's own next declaration takes the same `content` size as
//     its container, so it must measure what the container measures and move
//     with it.
//   - 'family': `.otp-input` sets 20px itself (its own preservation), so the
//     size cannot be compared to the container; what `font: inherit` still owns
//     there is the family.
const FONT_RESETS = [
  ['auth-tab-font-reset', 'size'],
  ['auth-controlstyles-font-reset', 'size'],
  ['auth-buttonbase-font-reset', 'size'],
  ['auth-otp-font-reset', 'family'],
  ['auth-resendcode-font-reset', 'size']
]

const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, size] of Object.entries(values)) {
    document.documentElement.style.setProperty(`--od-type-${role}-size`, size)
  }
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-type-${role}-size`)
}, roles)

const PROBE = { title: '28px', 'section-title': '25px', content: '19px', secondary: '16px', control: '17px', 'control-value': '18px', identifier: '18px' }

const measureAgainstParent = (surface, testid, kind) => surface.getByTestId(testid).evaluate((node, which) => {
  const own = getComputedStyle(node)
  const parent = getComputedStyle(node.parentElement)
  return which === 'family' ? { own: own.fontFamily, parent: parent.fontFamily } : { own: own.fontSize, parent: parent.fontSize }
}, kind)

for (const mode of ['light', 'dark']) {
  test(`l8-shell keeps governed typography and native controls in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('l8-shell-styles')

    for (const [testid, size] of ROLE_SIZES) {
      await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
    }
    for (const [testid, size] of REM_SCALE_SIZES) {
      await expect(surface.getByTestId(testid), `${testid} at the default root`).toHaveCSS('font-size', size)
    }

    await page.screenshot({ path: testInfo.outputPath(`l8-shell-${mode}.png`), fullPage: true })
  })
}

test('the declared preservations keep their size when every role moves', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('l8-shell-styles')
  for (const [testid, size] of PRESERVATIONS) {
    await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
  }

  await setRoleSizes(page, PROBE)
  for (const [testid, size] of PRESERVATIONS) {
    await expect(surface.getByTestId(testid), `${testid} ignores the probe`).toHaveCSS('font-size', size)
  }
  await restoreRoleSizes(page, ROLES)

  for (const [testid, size] of PRESERVATIONS) {
    await expect(surface.getByTestId(testid), `${testid} restores`).toHaveCSS('font-size', size)
  }
})

test('the rem-scale login sites ignore the role probe', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('l8-shell-styles')
  await setRoleSizes(page, PROBE)
  for (const [testid, size] of REM_SCALE_SIZES) {
    await expect(surface.getByTestId(testid), `${testid} ignores the probe`).toHaveCSS('font-size', size)
  }
  await restoreRoleSizes(page, ROLES)
})

// Regression guard for L8 lot 3.2: it moved these sites to the `content` role
// (14px fixed), so the login stopped scaling with the browser font size. `main`
// scales it (rem), and the user decided it must keep doing so. At a 20px root the
// rem scale gives 17.5px; the px role gives 14px, so this test fails against it.
// `secondary` (0.75rem) and `control` (13px) never regressed and are pinned too.
test('the rem-scale login sites follow the browser font size', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('l8-shell-styles')
  await page.evaluate(() => { document.documentElement.style.fontSize = '20px' })
  for (const [testid, , scaled] of REM_SCALE_SIZES) {
    await expect(surface.getByTestId(testid), `${testid} scales with a 20px root`).toHaveCSS('font-size', scaled)
  }
  await expect(surface.getByTestId('auth-route-li'), 'auth-route-li stays 13px (control, literal on main)').toHaveCSS('font-size', '13px')
  await expect(surface.getByTestId('auth-divider'), 'auth-divider scales (secondary is 0.75rem)').toHaveCSS('font-size', '15px')
  await page.evaluate(() => { document.documentElement.style.fontSize = '' })
  for (const [testid, size] of REM_SCALE_SIZES) {
    await expect(surface.getByTestId(testid), `${testid} restores`).toHaveCSS('font-size', size)
  }
})

test('the font: inherit resets keep their container typography instead of the user agent default', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('l8-shell-styles')

  const check = async (label) => {
    for (const [testid, kind] of FONT_RESETS) {
      const { own, parent } = await measureAgainstParent(surface, testid, kind)
      expect(own, `${testid} ${label}: ${kind} follows its container`).toBe(parent)
    }
  }

  await check('at rest')
  await setRoleSizes(page, PROBE)
  await check('when its role moves')
  await restoreRoleSizes(page, ROLES)
  await check('after restore')
})

test('central roles drive the real l8-shell styles and restore', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('l8-shell-styles')

  // content and control-value both resolve to 14px today, and control and
  // identifier both to 13px, so a site at 14px or 13px cannot be attributed to
  // one role by size alone. Those accept either candidate's probe value (and
  // never the literal), instead of being skipped.
  const expected = {
    '22px': ['28px'],
    '18px': ['25px'],
    '14px': ['19px', '18px'], // content | control-value
    '12px': ['16px'],
    '13px': ['17px', '18px'] // control | identifier
  }

  await setRoleSizes(page, PROBE)
  for (const [testid, size] of ROLE_SIZES) {
    const moved = await surface.getByTestId(testid).evaluate(node => getComputedStyle(node).fontSize)
    expect(expected[size], `${testid} moves with its role (measured ${moved})`).toContain(moved)
  }

  for (const [testid, size] of PRESERVATIONS) {
    await expect(surface.getByTestId(testid), `${testid} does not move`).toHaveCSS('font-size', size)
  }

  await restoreRoleSizes(page, ROLES)
  for (const [testid, size] of ROLE_SIZES) {
    await expect(surface.getByTestId(testid), `${testid} restores`).toHaveCSS('font-size', size)
  }
})

test.describe('l8-shell at 320px RTL coarse pointer', () => {
  test.use({ viewport: { width: 320, height: 900 }, hasTouch: true, isMobile: true })

  test('lays out without overflow and keeps the below-breakpoint 16px preservations', async ({ page }, testInfo) => {
    await page.goto(batchUrl('mode=dark&rtl=true&locale=ar'))
    const surface = page.getByTestId('l8-shell-styles')

    const documentGeometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(documentGeometry.document).toBeLessThanOrEqual(documentGeometry.viewport)

    const geometry = await surface.evaluate(node => ({ clientWidth: node.clientWidth, scrollWidth: node.scrollWidth }))
    expect(geometry.scrollWidth, 'l8-shell-styles').toBeLessThanOrEqual(geometry.clientWidth + 1)

    for (const [testid, size] of NARROW_PRESERVATIONS) {
      await expect(surface.getByTestId(testid), testid).toHaveCSS('font-size', size)
    }
    await setRoleSizes(page, PROBE)
    for (const [testid, size] of NARROW_PRESERVATIONS) {
      await expect(surface.getByTestId(testid), `${testid} ignores the probe`).toHaveCSS('font-size', size)
    }
    await restoreRoleSizes(page, ROLES)

    await page.screenshot({ path: testInfo.outputPath('l8-shell-dark-rtl-320.png'), fullPage: true })
  })
})
