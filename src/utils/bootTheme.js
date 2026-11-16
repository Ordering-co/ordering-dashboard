import { darken } from 'polished'

import { tokens } from '../brand/ordering.tokens.generated'
import { getDashboardStorageKey } from './local-tenant'

export const shouldResolveDashboardProject = ({
  auth,
  isOrderingSubdomain,
  useProjectDomain,
  useProjectSubdomain
} = {}) => Boolean(
  useProjectDomain &&
  !auth &&
  (!isOrderingSubdomain || useProjectSubdomain)
)

export const shouldResolveDashboardProjectAtBoot = ({
  auth,
  isOrderingSubdomain,
  useProjectDomain,
  useProjectSubdomain,
  storedProject,
  firstLoadConfigs,
  localProjectPin
} = {}) => !localProjectPin && (shouldResolveDashboardProject({
  auth,
  isOrderingSubdomain,
  useProjectDomain,
  useProjectSubdomain
}) || Boolean(
  useProjectDomain &&
  !auth &&
  !storedProject &&
  !firstLoadConfigs
))

export const readStoredDashboardAuth = (win = window, settings) => {
  const read = key => win?.localStorage?.getItem(getDashboardStorageKey(settings, key))
  const token = read('token')
  const project = read('project')
  if (!token || !project || (settings?.local_project_pin && project !== settings.local_project_pin)) return null

  try {
    const user = JSON.parse(read('user'))
    return user && typeof user === 'object' && !Array.isArray(user) ? token : null
  } catch {
    return null
  }
}

export const resolveInitialDashboardProject = ({
  settings,
  auth,
  storedProject,
  isDevelopment = false,
  isOrderingSubdomain
} = {}) => {
  if (settings?.local_project_pin) return settings.local_project_pin
  const shouldResolveProject = shouldResolveDashboardProject({
    auth,
    isOrderingSubdomain,
    useProjectDomain: settings?.use_project_domain,
    useProjectSubdomain: settings?.use_project_subdomain
  })
  if (shouldResolveProject) return null
  const canUseConfiguredProject = !settings?.use_project_domain || isDevelopment
  return storedProject ?? (canUseConfiguredProject ? settings?.project : null) ?? null
}

// A stored project can be a stale public alias (e.g. logged in before this normalization
// shipped). Resolving it needs an authenticated session and no pin, which already names
// the internal code.
export const shouldNormalizeStoredProjectAlias = ({
  auth,
  storedProject,
  localProjectPin
} = {}) => Boolean(auth && storedProject && storedProject !== '_' && !localProjectPin)

export const readFirstLoadConfigs = (win = window) => {
  const payload = win?.__FIRST_LOAD__
  if (!payload || typeof payload !== 'object') return null
  if (payload.configs && typeof payload.configs === 'object') return payload.configs
  if (payload.result?.configs && typeof payload.result.configs === 'object') {
    return payload.result.configs
  }
  return null
}

const normalizeProject = (project) => {
  if (typeof project !== 'string') return null
  const trimmed = project.trim().toLowerCase()
  return trimmed.length > 0 ? trimmed : null
}

// The Worker fetches first_load for the project it resolves from the host and
// injects that same project as window.__CONFIG__.project.
export const readFirstLoadProject = (win = window) => normalizeProject(win?.__CONFIG__?.project)

// On an Ordering host the Worker falls back to the default project, while the
// session may belong to another one; its configs (and dashboard color) must not
// hydrate the active project. Custom domains resolve the same project, so they
// keep the first_load hydrate.
export const readFirstLoadConfigsForProject = (project, win = window) => {
  const configs = readFirstLoadConfigs(win)
  const activeProject = normalizeProject(project)
  const firstLoadProject = readFirstLoadProject(win)
  if (!configs || !activeProject || !firstLoadProject) return configs
  return activeProject === firstLoadProject ? configs : null
}

export const readDashboardPrimary = (configs) => {
  const value = configs?.dashboard_buttons_colors?.value
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

// redesign W0-6 (T0-19) · decision 30: the tenant action color reaches the
// Product wrappers through a dedicated accent token, only on the primary
// action. `--od-action`, the focus ring and the status colors are never touched
// and the stored value is never rewritten.
export const TENANT_ACCENT_TOKEN = '--od-x-tenant-action'
export const TENANT_ACCENT_HOVER_TOKEN = '--od-x-tenant-action-hover'
export const TENANT_ACCENT_TOKENS = [TENANT_ACCENT_TOKEN, TENANT_ACCENT_HOVER_TOKEN]
export const WCAG_AA_NORMAL_TEXT = 4.5

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

// redesign tramo B r2 (W0-PB1-04): any value the browser accepts as a CSS color (rgb(), a color name, #RRGGBBAA…).
// Where `CSS.supports` does not exist (jsdom, SSR) the previous rule stands: 3 or 6 digit hex only. `var()` and the
// CSS-wide keywords pass `CSS.supports('color', …)` but are not a color of the tenant: they are refused.
const isCssColor = (value) => {
  if (HEX_COLOR.test(value)) return true
  const supports = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' ? CSS.supports.bind(CSS) : null
  if (!supports) return false
  // redesign tramo B r3 (W0-PB2-05): `env()` and `attr()` also pass `CSS.supports('color', …)` and `transparent` is no color to paint with.
  if (/var\(|env\(|attr\(|^(inherit|initial|unset|revert|revert-layer|currentcolor|transparent)$/i.test(value)) return false
  return supports('color', value)
}

// Single accessor: the stored value as supplied (trimmed), or null when the
// project has none or it is not a CSS color (the legacy theme still receives it).
export const readTenantAccent = (configs) => {
  const value = readDashboardPrimary(configs)
  return value && isCssColor(value) ? value : null
}

const channels = (hex) => {
  const digits = hex.slice(1)
  const full = digits.length === 3 ? [...digits].map(d => d + d).join('') : digits
  return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255)
}

const luminanceOf = (rgb) => {
  const [r, g, b] = rgb.map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const luminance = (hex) => luminanceOf(channels(hex))

// redesign tramo B r3 (W0-PB2-05): a color that is not hex (rgb(), a name, hsl(), #RRGGBBAA…) is converted to sRGB by the browser:
// painted on a probe element and read back from getComputedStyle, which answers `rgb(r, g, b)`. Only where `CSS.supports` exists
// (a browser); jsdom and SSR give null. A color with alpha, or one the browser keeps in another space (oklch(), color()), has no single
// contrast against an unknown background, so it is null too.
const RGB_COMPUTED = /^rgb\(\s*(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)\s*\)$/i
const browserRgb = (value) => {
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function' || typeof document === 'undefined' || !document.body) return null
  if (!isCssColor(value)) return null
  const probe = document.createElement('span')
  probe.style.color = value
  probe.style.display = 'none'
  document.body.appendChild(probe)
  try {
    const match = RGB_COMPUTED.exec(String(window.getComputedStyle(probe).color).trim())
    return match ? [match[1], match[2], match[3]].map(n => Number(n) / 255) : null
  } catch (_) {
    return null
  } finally {
    probe.remove()
  }
}

// sRGB channels (0–1) of a color the report can measure, or null
const measurableRgb = (value) => (HEX_COLOR.test(value) ? channels(value) : (value ? browserRgb(value) : null))

// AA report for the stored value: contrast of the action foreground (white by
// default, the text the primary button paints) on it. Returns null for a value that is not a color
// the report can measure (see browserRgb). `passesAA` uses the unrounded ratio.
export const tenantAccentContrast = (
  value,
  foreground = tokens.theme.light.semantic.action.foreground
) => {
  const stored = typeof value === 'string' ? value.trim() : ''
  if (!HEX_COLOR.test(foreground)) return null
  const rgb = measurableRgb(stored)
  if (!rgb) return null
  const [lighter, darker] = [luminance(foreground), luminanceOf(rgb)].sort((a, b) => b - a)
  const raw = (lighter + 0.05) / (darker + 0.05)
  return {
    value: stored,
    foreground,
    ratio: Math.round(raw * 100) / 100,
    passesAA: raw >= WCAG_AA_NORMAL_TEXT
  }
}

// Same derivation the legacy buttons use for the custom action (polished
// darken 0.04), so both surfaces compute the same hover. redesign tramo B r2 (W0-PB1-04): a value polished cannot
// parse (a CSS color it does not know) keeps the same value as its hover.
export const tenantAccentHover = (accent) => {
  try {
    return darken(0.04, accent)
  } catch (_) {
    return accent
  }
}

const toHex = (rgb) => `#${rgb.map(c => Math.round(c * 255).toString(16).padStart(2, '0')).join('')}`
const SHADE_STEP = 0.01

// Decision 42 (replaces the dark text of ) · decision 30: what the primary paints for the stored value, which
// is never rewritten. White text (the brand action foreground) always. While white reaches AA on the stored value, or the report
// cannot measure it, the stored value and its darkening hover, as before. Where white misses AA, the first shade of the same tone
// darkened in steps of 0.01 (polished, HSL lightness) that reaches it, and a hover darkened 0.04 more, which keeps it too
// (orderingv1 #2c7be5, white 4.13:1 → #1e72e3 4.59:1, hover #1a69d2 5.25:1). Black gives 21:1, so a shade is always found.
export const tenantAccentPaint = (accent) => {
  const asStored = { background: accent, hover: tenantAccentHover(accent) }
  const white = tenantAccentContrast(accent)
  if (!white || white.passesAA) return asStored
  const base = toHex(measurableRgb(white.value))
  for (let step = 1; step * SHADE_STEP <= 1; step++) {
    const background = darken(step * SHADE_STEP, base)
    if (tenantAccentContrast(background)?.passesAA) return { background, hover: tenantAccentHover(background) }
  }
  return asStored
}

// Sets the accent tokens (what tenantAccentPaint paints) when the project has a valid value; removes them when
// it does not. Returns the stored accent (or null).
export const applyTenantAccent = (configs, root = typeof document === 'undefined' ? null : document.documentElement) => {
  const accent = readTenantAccent(configs)
  if (!root?.style) return accent
  if (accent) {
    const paint = tenantAccentPaint(accent)
    root.style.setProperty(TENANT_ACCENT_TOKEN, paint.background)
    root.style.setProperty(TENANT_ACCENT_HOVER_TOKEN, paint.hover)
  } else {
    TENANT_ACCENT_TOKENS.forEach(name => root.style.removeProperty(name))
  }
  return accent
}

export const mergeThemePrimary = (theme, primary) => {
  if (!primary) return theme
  return {
    ...theme,
    ...(theme?.ordering && { ordering: { ...theme.ordering, actionOverride: primary } }),
    colors: {
      ...theme?.colors,
      primary
    }
  }
}

export const canRevealDashboard = ({
  sessionLoading,
  configLoading
} = {}) => !sessionLoading && !configLoading

export const resolveBootRevealAction = ({
  canReveal,
  loaded,
  primary,
  currentPrimary
} = {}) => {
  if (loaded) return 'idle'
  if (!canReveal) return 'hold'
  if (primary && primary !== currentPrimary) return 'apply-primary'
  return 'reveal'
}
