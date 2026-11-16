import { metadata, tokens, variables } from './ordering.tokens.generated'
import dashboardDefaults from '../theme.json'
import { orderingAssets } from './assets'

const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

// Application typography roles are aliases over the locked Ordering.co scale,
// not another scale. Keeping the aliases here lets operational surfaces change
// hierarchy through a few shared values while the generated release remains an
// immutable representation of the upstream DTCG source.
const createTypography = font => freeze({
  roles: {
    control: { size: font.size.productUi },
    controlValue: { size: font.size.productContent },
    content: { size: font.size.productContent },
    secondary: { size: font.size[1] },
    sectionTitle: { size: font.size[4] },
    title: { size: font.size[5] },
    identifier: {
      size: font.size.productUi,
      family: font.family.mono,
      ligatures: font.variant.monoLigatures
    }
  }
})

const typography = createTypography(tokens.font)
const typographyVariables = Object.fromEntries(Object.entries(typography.roles).flatMap(([role, value]) => {
  const cssRole = role.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
  return [
    [`--od-type-${cssRole}-size`, value.size],
    ...(value.family ? [[`--od-type-${cssRole}-font`, value.family]] : []),
    ...(value.ligatures ? [[`--od-type-${cssRole}-ligatures`, value.ligatures]] : [])
  ]
}))

// Only the additive namespace is governed here. Existing colors/fonts/images,
// runtime tenant overrides and ThemeContext operations keep their contracts.
const modes = Object.fromEntries(['light', 'dark'].map(mode => [mode, freeze({
  release: metadata.release,
  mode,
  assets: orderingAssets,
  semantic: structuredClone(tokens.theme[mode].semantic),
  font: structuredClone(tokens.font),
  typography,
  radius: structuredClone(tokens.radius),
  shadow: structuredClone(tokens.shadow),
  motion: structuredClone(tokens.motion),
  component: structuredClone(tokens.component),
  css: { ...variables.root, ...variables.product, ...variables[mode], ...typographyVariables }
})]))

export function createOrderingTheme (legacyTheme, { mode = 'light' } = {}) {
  if (!Object.hasOwn(modes, mode)) throw new Error(`Unsupported Ordering.co fixture mode: ${mode}`)
  return { ...legacyTheme, ordering: modes[mode] }
}

// the runtime switch of the color mode. Only the mode values change; what the boot added to the namespace (the
// tenant action, `actionOverride`) stays. The same object comes back when the mode is already that one.
export function withOrderingMode (theme, mode) {
  if (!Object.hasOwn(modes, mode)) throw new Error(`Unsupported Ordering.co fixture mode: ${mode}`)
  return theme.ordering?.mode === mode ? theme : { ...theme, ordering: { ...theme.ordering, ...modes[mode] } }
}

// Run once at the dashboard entry, before runtime tenant overrides. Do not use
// this initializer in ThemeContext.update/merge: supplied tenant values win.
export function createDashboardTheme (sourceTheme, options) {
  const theme = createOrderingTheme(sourceTheme, options)
  const { semantic, font } = theme.ordering
  const roles = {
    primaryContrast: semantic.action.foreground,
    backgroundPage: semantic.background,
    headingColor: semantic.text.default,
    borderColor: semantic.border.default
  }
  const colors = { ...theme.colors }
  for (const [key, value] of Object.entries(roles)) {
    if (colors[key] === dashboardDefaults.colors[key]) colors[key] = value
  }
  const fonts = { ...theme.fonts }
  for (const key of ['primary', 'special']) {
    if (fonts[key]?.name === dashboardDefaults.fonts[key].name) {
      fonts[key] = { ...fonts[key], name: 'Ordering Inter Local', family: font.family.sans, local: true }
    }
  }
  const actionOverride = sourceTheme.colors?.primary !== dashboardDefaults.colors.primary ? sourceTheme.colors?.primary : undefined
  return { ...theme, colors, fonts, ordering: actionOverride ? { ...theme.ordering, actionOverride } : theme.ordering }
}

// Legacy primary also appears in copyable widget configuration. Migrated UI
// consumes this role; that data-facing legacy value is deliberately unchanged.
export const getOrderingAction = theme => theme.ordering?.actionOverride ?? theme.ordering?.semantic?.action?.default ?? theme.colors?.primary

export const getOrderingTypography = theme => theme?.ordering?.typography
