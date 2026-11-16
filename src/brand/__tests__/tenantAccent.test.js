// redesign W0-6 (T0-19) · decision 30: the tenant action color reaches the
// primary action of the Product wrappers through `--od-x-tenant-action`.
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { darken, parseToHsl } from 'polished'

import { tokens, variables } from '../ordering.tokens.generated'
import { createDashboardTheme } from '../adapter'
import dashboardDefaults from '../../theme.json'
import { resolveButtonTheme } from '../../@/components-dashboard/src/ui/src/styles/Buttons/theme'
import {
  TENANT_ACCENT_HOVER_TOKEN,
  TENANT_ACCENT_TOKEN,
  TENANT_ACCENT_TOKENS,
  applyTenantAccent,
  mergeThemePrimary,
  readTenantAccent,
  tenantAccentContrast,
  tenantAccentHover,
  tenantAccentPaint
} from '../../utils/bootTheme'
import { useDashboardBootReveal } from '../../utils/useDashboardBootReveal'

const productCss = readFileSync(resolvePath(process.cwd(), 'src/@/components-dashboard/src/ui/src/components/Shared/Product/product.css'), 'utf8')
const generatedCss = readFileSync(resolvePath(process.cwd(), 'src/brand/ordering.tokens.generated.css'), 'utf8')
const candidatesCss = readFileSync(resolvePath(process.cwd(), 'src/brand/candidates.css'), 'utf8')

const withValue = value => ({ dashboard_buttons_colors: { value } })
const BRAND = variables.root['--od-action'] ?? variables.light['--od-action']

// Declarations of the (single) rule whose selector is exactly `selector`.
const ruleBody = (css, selector) => {
  const start = css.search(new RegExp(`(^|\\n)${selector.replace(/[.[\]()'=:]/g, '\\$&')}\\s*\\{`))
  expect(start, `rule ${selector}`).toBeGreaterThanOrEqual(0)
  const open = css.indexOf('{', start)
  return css.slice(open + 1, css.indexOf('}', open))
}
const declaration = (body, property) => body.match(new RegExp(`(?:^|[;\\s])${property}:\\s*([^;]+?)\\s*(?:;|$)`))?.[1]

// Minimal var() resolver: var(--name, fallback) against a map of set properties.
const resolve = (expression, set) => {
  const match = expression.match(/^var\((--[\w-]+)(?:,\s*(.+))?\)$/)
  if (!match) return expression
  const [, name, fallback] = match
  if (set[name] !== undefined) return resolve(set[name], set)
  return fallback === undefined ? undefined : resolve(fallback, set)
}
const cssProps = { ...variables.root, ...variables.product, ...variables.light }

afterEach(() => {
  document.documentElement.removeAttribute('style')
})

describe('readTenantAccent', () => {
  it('returns the stored hex as supplied (trimmed), never rewritten', () => {
    expect(readTenantAccent(withValue('#2c7be5'))).toBe('#2c7be5')
    expect(readTenantAccent(withValue('  #2C7BE5 '))).toBe('#2C7BE5')
    expect(readTenantAccent(withValue('#fff'))).toBe('#fff')
  })

  it.each([undefined, null, '', '   ', 'blue', 'tenant-value-as-supplied', 'rgb(44, 123, 229)', '#12', '#12345', '#2c7be5ff', '2c7be5', 42])(
    'is null for %j', value => {
      expect(readTenantAccent(withValue(value))).toBeNull()
    })

  it('is null when the project has no key', () => {
    expect(readTenantAccent({})).toBeNull()
    expect(readTenantAccent(undefined)).toBeNull()
  })
})

describe('tenantAccentContrast (AA report)', () => {
  it('fails AA for the orderingv1 stored value #2c7be5 (4.14:1 with white text)', () => {
    expect(tenantAccentContrast('#2c7be5')).toEqual({ value: '#2c7be5', foreground: '#FFFFFF', ratio: 4.14, passesAA: false })
  })

  it('passes AA for the brand action #266DF0 (4.64:1)', () => {
    expect(tenantAccentContrast('#266DF0')).toMatchObject({ ratio: 4.64, passesAA: true })
  })

  it('decides on the unrounded ratio and accepts 3-digit hex', () => {
    expect(tenantAccentContrast('#000')).toMatchObject({ ratio: 21, passesAA: true })
    expect(tenantAccentContrast('#fff')).toMatchObject({ ratio: 1, passesAA: false })
  })

  it('reports nothing for a value that is not a hex color, and never mutates the config', () => {
    expect(tenantAccentContrast('blue')).toBeNull()
    expect(tenantAccentContrast(undefined)).toBeNull()
    const configs = Object.freeze({ dashboard_buttons_colors: Object.freeze({ value: '#2c7be5' }) })
    tenantAccentContrast(readTenantAccent(configs))
    expect(configs.dashboard_buttons_colors.value).toBe('#2c7be5')
  })
})

describe('applyTenantAccent', () => {
  it('sets the accent and its hover on the root when the project has a value', () => {
    const root = document.createElement('div')
    expect(applyTenantAccent(withValue('#2c7be5'), root)).toBe('#2c7be5')
    // decision 42: white misses AA on #2c7be5, so the token carries a darker shade of it (tenantAccentPaint); the
    // brand blue reaches AA and is painted as stored, with the darkening hover
    expect(root.style.getPropertyValue(TENANT_ACCENT_TOKEN)).toBe(tenantAccentPaint('#2c7be5').background)
    expect(root.style.getPropertyValue(TENANT_ACCENT_HOVER_TOKEN)).toBe(tenantAccentPaint('#2c7be5').hover)
    applyTenantAccent(withValue('#266DF0'), root)
    expect(root.style.getPropertyValue(TENANT_ACCENT_TOKEN)).toBe('#266DF0')
    expect(root.style.getPropertyValue(TENANT_ACCENT_HOVER_TOKEN)).toBe(tenantAccentHover('#266DF0'))
  })

  it.each([undefined, '', 'blue', 'rgb(1, 2, 3)', '#12'])('does not set anything for %j', value => {
    const root = document.createElement('div')
    expect(applyTenantAccent(withValue(value), root)).toBeNull()
    expect(root.style.length).toBe(0)
  })

  it('removes the tokens when the project stops having a value', () => {
    const root = document.createElement('div')
    applyTenantAccent(withValue('#2c7be5'), root)
    applyTenantAccent({}, root)
    expect(root.style.length).toBe(0)
  })

  it('touches only the accent tokens: action, focus and status stay on the brand', () => {
    const root = document.createElement('div')
    applyTenantAccent(withValue('#2c7be5'), root)
    const names = Array.from({ length: root.style.length }, (_, i) => root.style.item(i))
    expect(names.sort()).toEqual([TENANT_ACCENT_HOVER_TOKEN, TENANT_ACCENT_TOKEN].sort())
    expect(generatedCss).not.toContain('tenant-action')
    expect(candidatesCss).not.toContain('tenant-action')
    expect(generatedCss).toContain('--od-action: #266DF0;')
  })
})

describe('legacy and Product compute the same action color', () => {
  it('the legacy button theme and the primary token agree, base and hover', () => {
    const legacy = resolveButtonTheme(mergeThemePrimary(createDashboardTheme(dashboardDefaults), '#2c7be5'))
    const root = document.createElement('div')
    applyTenantAccent(withValue('#2c7be5'), root)
    expect(legacy.action).toBe(root.style.getPropertyValue(TENANT_ACCENT_TOKEN))
    expect(legacy.actionHover).toBe(root.style.getPropertyValue(TENANT_ACCENT_HOVER_TOKEN))
  })
})

describe('useDashboardBootReveal applies the accent on :root', () => {
  const run = configs => renderHook(({ c }) => useDashboardBootReveal({
    sessionLoading: false,
    configLoading: false,
    configs: c,
    theme: createDashboardTheme(dashboardDefaults),
    update: () => {}
  }), { initialProps: { c: configs } })

  it('sets the tokens for a project with a value, clears them on a project without, and on unmount', () => {
    const style = document.documentElement.style
    const { rerender, unmount } = run(withValue('#266DF0'))
    expect(style.getPropertyValue(TENANT_ACCENT_TOKEN)).toBe('#266DF0')
    rerender({ c: {} })
    expect(style.getPropertyValue(TENANT_ACCENT_TOKEN)).toBe('')
    rerender({ c: withValue('#2c7be5') })
    expect(style.getPropertyValue(TENANT_ACCENT_TOKEN)).toBe('#1e72e3') // decision 42: the shade white reaches AA on
    unmount()
    expect(style.length).toBe(0)
  })

  it('sets nothing for an invalid value', () => {
    run(withValue('tenant-value-as-supplied'))
    expect(document.documentElement.style.length).toBe(0)
  })
})

describe('Product primary button CSS reads the accent token', () => {
  const primary = ruleBody(productCss, ".odc-btn[data-variant='primary']")

  it('paints background and border from the token with --od-action as fallback, text from the action foreground', () => {
    expect(declaration(primary, 'background')).toBe('var(--od-x-tenant-action, var(--od-action))')
    expect(declaration(primary, 'border-color')).toBe('var(--od-x-tenant-action, var(--od-action))')
    expect(declaration(primary, 'color')).toBe('var(--od-action-foreground)') // decision 42: always the action foreground (white)
  })

  it('hover reads the hover token with --od-action-hover as fallback', () => {
    const hover = ruleBody(productCss, ".odc-btn[data-variant='primary']:hover")
    expect(declaration(hover, 'background')).toBe('var(--od-x-tenant-action-hover, var(--od-action-hover))')
    expect(declaration(hover, 'border-color')).toBe('var(--od-x-tenant-action-hover, var(--od-action-hover))')
  })

  it('with a stored value the primary resolves to what applyTenantAccent paints (the legacy action too); without, to --od-action (brand blue)', () => {
    const root = document.createElement('div')
    applyTenantAccent(withValue('#2c7be5'), root)
    const set = { ...cssProps, [TENANT_ACCENT_TOKEN]: root.style.getPropertyValue(TENANT_ACCENT_TOKEN) }
    const legacy = resolveButtonTheme(mergeThemePrimary(createDashboardTheme(dashboardDefaults), '#2c7be5'))
    expect(resolve(declaration(primary, 'background'), set)).toBe(legacy.action)
    expect(resolve(declaration(primary, 'background'), cssProps)).toBe(BRAND)
    expect(BRAND).toBe('#266DF0')
  })

  it('the tenant token is read only by the primary rules: focus, danger and every other rule keep the brand', () => {
    const rules = [...productCss.matchAll(/(^|\n)([^{}\n]+)\{([^}]*)\}/g)]
      .filter(([, , , body]) => body.includes('tenant-action'))
      .map(([, , selector]) => selector.trim())
    expect(rules).toEqual([
      ".odc-btn[data-variant='primary']",
      ".odc-btn[data-variant='primary']:hover"
    ])
    const focus = ruleBody(productCss, '.odc-btn:focus-visible')
    expect(declaration(focus, 'outline')).toBe('var(--od-focus-ring-width) solid var(--od-focus-ring-color)')
    const danger = ruleBody(productCss, ".odc-btn[data-variant='danger']")
    expect(declaration(danger, 'background')).toBe('var(--od-x-danger-strong)')
  })
})

// redesign tramo B r2 (W0-PB1-04): any CSS color the browser accepts, not only hex.
describe('readTenantAccent with CSS.supports (W0-PB1-04)', () => {
  // A stand-in for the browser: rgb(), a few names, #RRGGBBAA and var() (which the real one also accepts) pass.
  const supports = (property, value) => property === 'color' &&
    /^(rgba?\([\d\s,.%]+\)|#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|rebeccapurple|blue|red|var\(--[\w-]+\)|inherit|currentcolor)$/i.test(value)
  beforeEach(() => { globalThis.CSS = { supports } })
  afterEach(() => { delete globalThis.CSS })

  it.each(['rgb(44, 123, 229)', 'rebeccapurple', 'blue', '#2c7be5ff', '#2C7BE5'])('accepts %j as supplied', value => {
    expect(readTenantAccent(withValue(value))).toBe(value)
  })

  it.each(['not-a-color', '#12', '#12345', '2c7be5', 'var(--od-action)', 'inherit', 'currentcolor', 'red; background: url(x)'])('refuses %j', value => {
    expect(readTenantAccent(withValue(value))).toBeNull()
  })

  it('applies the accent and a hover for a non-hex value (polished parses rgb, names and 8-digit hex)', () => {
    ;['rgb(44, 123, 229)', 'rebeccapurple', '#2c7be5ff'].forEach(value => {
      const root = document.createElement('div')
      expect(applyTenantAccent(withValue(value), root)).toBe(value)
      // decision 42: what tenantAccentPaint paints (a darker shade where white misses AA, the value as stored otherwise)
      expect(root.style.getPropertyValue(TENANT_ACCENT_TOKEN)).toBe(tenantAccentPaint(value).background)
      expect(root.style.getPropertyValue(TENANT_ACCENT_HOVER_TOKEN)).not.toBe('')
      expect(root.style.getPropertyValue(TENANT_ACCENT_HOVER_TOKEN)).toBe(tenantAccentPaint(value).hover)
    })
  })

  it('the hover is the same value when polished cannot parse the color', () => {
    expect(tenantAccentHover('color(display-p3 0.2 0.4 0.9)')).toBe('color(display-p3 0.2 0.4 0.9)')
  })

  it('the AA report is null for a non-hex color where there is no browser to convert it (jsdom), and keeps hex', () => {
    delete globalThis.CSS
    expect(tenantAccentContrast('rgb(44, 123, 229)')).toBeNull()
    expect(tenantAccentContrast('rebeccapurple')).toBeNull()
    expect(tenantAccentContrast('#2c7be5ff')).toBeNull()
    expect(tenantAccentContrast('#2c7be5')).toMatchObject({ ratio: 4.14 })
  })
})

// redesign tramo B r3 (W0-PB2-05): what Chromium accepts that is no tenant color, and the AA report for colors that are not hex.
describe('readTenantAccent and the AA report in a browser (W0-PB2-05)', () => {
  // Chromium accepts env(), attr() and transparent in CSS.supports('color', …) as well.
  const supports = (property, value) => property === 'color' &&
    /^(rgba?\([\d\s,.%]+\)|#[0-9a-f]{3,8}|rebeccapurple|tomato|transparent|oklch\([^)]*\)|env\([^)]*\)|attr\([^)]*\)|var\(--[\w-]+\))$/i.test(value)
  // The probe: getComputedStyle(...).color answers rgb() for what it knows, oklch() as it is, and rgba() with alpha.
  const known = { rebeccapurple: 'rgb(102, 51, 153)', tomato: 'rgb(255, 99, 71)', 'rgb(44, 123, 229)': 'rgb(44, 123, 229)', '#c81e5a80': 'rgba(200, 30, 90, 0.5)' }
  const original = window.getComputedStyle
  beforeEach(() => {
    globalThis.CSS = { supports }
    window.getComputedStyle = (el) => ({ color: known[el.style.color] ?? known[el.getAttribute('style')?.match(/color:\s*([^;]+)/)?.[1]] ?? el.style.color })
  })
  afterEach(() => {
    delete globalThis.CSS
    window.getComputedStyle = original
  })

  it.each(['env(safe-area-inset-top)', 'attr(data-x)', 'transparent', 'TRANSPARENT'])('refuses %j', value => {
    expect(readTenantAccent(withValue(value))).toBeNull()
  })

  it('reports the contrast of a color that is not hex, converted by the browser', () => {
    expect(tenantAccentContrast('rgb(44, 123, 229)')).toMatchObject({ value: 'rgb(44, 123, 229)', ratio: 4.14, passesAA: false })
    expect(tenantAccentContrast('rebeccapurple')).toMatchObject({ value: 'rebeccapurple', passesAA: true })
    expect(tenantAccentContrast('tomato')).toMatchObject({ passesAA: false })
  })

  it('is the same ratio as the hex of that color', () => {
    expect(tenantAccentContrast('rgb(44, 123, 229)').ratio).toBe(tenantAccentContrast('#2c7be5').ratio)
  })

  it('is null for a color with alpha, one the browser keeps in another space, or no color; the probe is removed', () => {
    expect(tenantAccentContrast('#c81e5a80')).toBeNull()
    expect(tenantAccentContrast('oklch(0.55 0.2 20)')).toBeNull()
    expect(tenantAccentContrast('not-a-color')).toBeNull()
    expect(tenantAccentContrast('')).toBeNull()
    expect(tenantAccentContrast('transparent')).toBeNull()
    expect(document.body.querySelectorAll('span[style*="display: none"]')).toHaveLength(0)
  })
})

// redesign tramo B r2 (W0-PB1-02): «New order» is the legacy button dressed as the primary action.
describe('the legacy button dressed as the primary reads the tenant accent (W0-PB1-02)', () => {
  const headerCss = readFileSync(resolvePath(process.cwd(), 'src/@/components-dashboard/src/ui/src/components/Orders/OrdersContentHeader/content-header.css'), 'utf8')
  const createSelector = ".odc-header-actions > [data-action='create']:not([data-emphasis='secondary']) > button:first-of-type"
  const bodyOf = (selectorEnd) => {
    const at = headerCss.indexOf(selectorEnd)
    expect(at, selectorEnd).toBeGreaterThanOrEqual(0)
    const open = headerCss.indexOf('{', at)
    return headerCss.slice(open + 1, headerCss.indexOf('}', open))
  }

  it('paints background and border with the tenant token, falling back to --od-action', () => {
    const body = bodyOf(`${createSelector},\n.odc-header-actions > [data-action='create']:not([data-emphasis='secondary']) > div:first-child > button:first-of-type {`)
    expect(declaration(body, 'background')).toBe('var(--od-x-tenant-action, var(--od-action))')
    expect(declaration(body, 'border-color')).toBe('var(--od-x-tenant-action, var(--od-action))')
  })

  it('does the same on hover', () => {
    const body = bodyOf(`${createSelector}:hover,`)
    expect(declaration(body, 'background')).toBe('var(--od-x-tenant-action-hover, var(--od-action-hover))')
    expect(declaration(body, 'border-color')).toBe('var(--od-x-tenant-action-hover, var(--od-action-hover))')
  })
})

// Decision 42 (replaces the dark text of ): where white misses AA on the tenant accent (orderingv1 #2c7be5,
// 4.13:1), the primary paints a slightly darker shade of it, the first one that reaches AA with white, and keeps white text.
describe('the primary keeps white text on a darker shade of the tenant accent (decision 42)', () => {
  const WHITE = tokens.theme.light.semantic.action.foreground
  const passes = (background, foreground = WHITE) => tenantAccentContrast(background, foreground).passesAA

  it('nothing changes on an accent where white reaches AA', () => {
    expect(tenantAccentPaint('#266DF0')).toEqual({ background: '#266DF0', hover: tenantAccentHover('#266DF0') })
  })

  it('where white misses AA the background is the first darker step of the same tone that reaches it, and the hover goes further', () => {
    const paint = tenantAccentPaint('#2c7be5')
    expect(paint).toEqual({ background: '#1e72e3', hover: '#1a69d2' })
    expect(passes(paint.background)).toBe(true)
    expect(passes(paint.hover)).toBe(true)
    // the step before does not reach AA: the shade is the lightest that does
    expect(passes(darken(0.02, '#2c7be5'))).toBe(false)
    expect(parseToHsl(paint.background).hue).toBeCloseTo(parseToHsl('#2c7be5').hue, 0)
    expect(parseToHsl(paint.hover).hue).toBeCloseTo(parseToHsl('#2c7be5').hue, 0)
  })

  it.each(['#F5C518', '#ff6600', '#00D27A', '#e91e63', '#fff'])('reaches AA with white on %s', value => {
    const paint = tenantAccentPaint(value)
    expect(passes(paint.background)).toBe(true)
    expect(passes(paint.hover)).toBe(true)
  })

  it('a value it cannot measure (no browser to convert it) stays as today', () => {
    expect(tenantAccentPaint('#2c7be5ff')).toEqual({ background: '#2c7be5ff', hover: tenantAccentHover('#2c7be5ff') })
  })

  it('applyTenantAccent paints the shade and its hover; the stored value is never rewritten and no text token is set', () => {
    const root = document.createElement('div')
    const configs = Object.freeze({ dashboard_buttons_colors: Object.freeze({ value: '#2c7be5' }) })
    expect(applyTenantAccent(configs, root)).toBe('#2c7be5')
    expect(configs.dashboard_buttons_colors.value).toBe('#2c7be5')
    expect(root.style.getPropertyValue(TENANT_ACCENT_TOKEN)).toBe('#1e72e3')
    expect(root.style.getPropertyValue(TENANT_ACCENT_HOVER_TOKEN)).toBe('#1a69d2')
    expect(TENANT_ACCENT_TOKENS).toEqual([TENANT_ACCENT_TOKEN, TENANT_ACCENT_HOVER_TOKEN])
    expect(root.style.getPropertyValue('--od-x-tenant-action-foreground')).toBe('')
  })

  it('the Product primary on orderingv1 paints white text at AA, base and hover; without a tenant value the brand pair is unchanged', () => {
    const primary = ruleBody(productCss, ".odc-btn[data-variant='primary']")
    const hover = ruleBody(productCss, ".odc-btn[data-variant='primary']:hover")
    const root = document.createElement('div')
    applyTenantAccent(withValue('#2c7be5'), root)
    const set = { ...cssProps }
    TENANT_ACCENT_TOKENS.forEach(name => { set[name] = root.style.getPropertyValue(name) || undefined })
    const color = resolve(declaration(primary, 'color'), set)
    expect(color).toBe(WHITE)
    expect(passes(resolve(declaration(primary, 'background'), set), color)).toBe(true)
    expect(passes(resolve(declaration(hover, 'background'), set), color)).toBe(true)
    expect(resolve(declaration(primary, 'background'), cssProps)).toBe(BRAND)
    expect(resolve(declaration(primary, 'color'), cssProps)).toBe(variables.light['--od-action-foreground'] ?? variables.root['--od-action-foreground'])
  })

  it('the legacy primary paints the same shade, hover and white text, and its active state keeps AA', () => {
    const legacy = resolveButtonTheme(mergeThemePrimary(createDashboardTheme(dashboardDefaults), '#2c7be5'))
    expect(legacy.action).toBe('#1e72e3')
    expect(legacy.actionHover).toBe('#1a69d2')
    expect(passes(legacy.action, legacy.actionForeground)).toBe(true)
    expect(passes(legacy.actionActive, legacy.actionForeground)).toBe(true)
    expect(passes(legacy.actionHover, legacy.actionForeground)).toBe(true)
    expect(['#FFF', '#FFFFFF']).toContain(legacy.actionForeground.toUpperCase())
    // the outline and transparent primary write in the shade on the page, and it reaches AA on white too
    expect(legacy.actionContent).toBe('#1e72e3')
    expect(passes(legacy.actionContent, '#FFFFFF')).toBe(true)
    expect(passes('#2c7be5', '#FFFFFF')).toBe(false)
  })

  it('no stylesheet reads a tenant text token: the primary and the controls dressed as it paint the action foreground', () => {
    const files = [
      'src/@/components-dashboard/src/ui/src/components/Shared/Product/product.css',
      'src/@/components-dashboard/src/ui/src/components/Orders/OrdersContentHeader/content-header.css',
      'src/@/components-dashboard/src/ui/src/components/Assistant/assistant.css'
    ]
    files.forEach(file => {
      const css = readFileSync(resolvePath(process.cwd(), file), 'utf8')
      expect(css, file).not.toContain('--od-x-tenant-action-foreground')
      const painted = [...css.matchAll(/\{([^}]*)\}/g)].map(([, body]) => body)
        .filter(body => /background:\s*var\(--od-x-tenant-action,/.test(body))
      expect(painted.length, file).toBeGreaterThan(0)
      painted.forEach(body => expect(declaration(body, 'color'), file).toBe('var(--od-action-foreground)'))
    })
  })
})

// Decision 42 in a browser: a measurable color that is not hex is darkened from the sRGB value the browser converts it to.
describe('decision 42 for a color that is not hex (browser conversion)', () => {
  const supports = (property, value) => property === 'color' && /^(rgba?\([\d\s,.%]+\)|#[0-9a-f]{3,8}|oklch\([^)]*\))$/i.test(value)
  const known = { 'rgb(44, 123, 229)': 'rgb(44, 123, 229)' }
  const original = window.getComputedStyle
  beforeEach(() => {
    globalThis.CSS = { supports }
    window.getComputedStyle = (el) => ({ color: known[el.style.color] ?? el.style.color })
  })
  afterEach(() => {
    delete globalThis.CSS
    window.getComputedStyle = original
  })

  it('rgb(44, 123, 229) paints the same shade as #2c7be5', () => {
    expect(tenantAccentPaint('rgb(44, 123, 229)')).toEqual(tenantAccentPaint('#2c7be5'))
  })

  it('oklch() is not measured and stays as today', () => {
    const value = 'oklch(0.55 0.2 20)'
    expect(tenantAccentPaint(value)).toEqual({ background: value, hover: tenantAccentHover(value) })
  })
})
