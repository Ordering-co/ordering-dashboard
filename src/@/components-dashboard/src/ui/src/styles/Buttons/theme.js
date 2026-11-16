import { darken } from 'polished'

import { getOrderingAction, getOrderingTypography } from '~/brand/adapter'
import { tokens } from '~/brand/ordering.tokens.generated'
import { tenantAccentPaint } from '~/utils/bootTheme'

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key)

export const safeDarken = (amount, color) => {
  try {
    return darken(amount, color)
  } catch (_) {
    return color
  }
}

const resolveEasing = theme => {
  const value = theme?.ordering?.css?.['--od-ease-standard'] ?? theme?.ordering?.motion?.easing?.standard
  if (Array.isArray(value)) return `cubic-bezier(${value.join(', ')})`
  return value ?? 'ease-in'
}

// (T10, review): resolveButtonTheme runs on every render of the legacy buttons, and measuring a color that is not hex
// paints a probe element; the paint of a tenant color is the same for the whole session, so it is worked out once per color
const tenantPaints = new Map()
const paintOf = (action) => {
  if (!tenantPaints.has(action)) tenantPaints.set(action, tenantAccentPaint(action))
  return tenantPaints.get(action)
}

export const resolveButtonTheme = theme => {
  const semantic = theme?.ordering?.semantic
  const font = theme?.ordering?.font
  const component = theme?.ordering?.component
  const customAction = hasOwn(theme?.ordering, 'actionOverride')
  const stored = getOrderingAction(theme)
  const primaryFont = theme?.fonts?.primary
  const typography = getOrderingTypography(theme)
  const fontFamily = primaryFont?.family || (primaryFont?.name ? `'${primaryFont.name}', sans-serif` : font?.family?.sans ?? 'inherit')

  // decision 42: a tenant color where white misses AA paints a darker shade of it with white text, as the Product
  // primary does (tenantAccentPaint); the stored value is never rewritten
  const tenantPaint = customAction ? paintOf(stored) : null
  const action = customAction ? tenantPaint.background : stored

  return {
    action,
    actionHover: customAction ? tenantPaint.hover : semantic?.action?.hover ?? safeDarken(0.04, action),
    actionActive: customAction ? safeDarken(0.1, action) : semantic?.action?.hover ?? safeDarken(0.1, action),
    actionForeground: customAction
      ? theme?.colors?.primaryContrast ?? semantic?.action?.foreground ?? '#FFF'
      : semantic?.action?.foreground ?? theme?.colors?.primaryContrast ?? '#FFF',
    // the text of the outline and transparent primary on the page takes the same shade: contrast is symmetric, so the shade white
    // reads on also reads on white (orderingv1 #2c7be5 4.14:1 → #1e72e3 4.59:1)
    actionContent: customAction ? action : semantic?.action?.content ?? action,
    actionSoft: semantic?.action?.soft ?? theme?.colors?.lightPrimary ?? '#E9F2FE',
    focus: semantic?.action?.focus ?? action,
    surface: semantic?.surface?.default ?? theme?.colors?.backgroundPage ?? '#FFF',
    surfaceSubtle: semantic?.surface?.subtle ?? theme?.colors?.secundary ?? '#F8F9FA',
    surfaceStrong: semantic?.surface?.strong ?? theme?.colors?.black ?? '#000',
    text: semantic?.text?.default ?? theme?.colors?.headingColor ?? '#344050',
    textMuted: semantic?.text?.muted ?? theme?.colors?.secundaryContrast ?? '#748194',
    textInverse: semantic?.text?.inverse ?? theme?.colors?.white ?? '#FFF',
    border: semantic?.border?.default ?? theme?.colors?.borderColor ?? '#E9ECEF',
    borderStrong: semantic?.border?.strong ?? theme?.colors?.disabled ?? '#B1BCCC',
    successSignal: semantic?.state?.success?.signal ?? theme?.colors?.green ?? '#00D27A',
    successFunctional: semantic?.state?.success?.functional ?? theme?.colors?.textBlackContrast ?? '#151824',
    successSoft: semantic?.state?.success?.soft ?? theme?.colors?.lightGreen ?? '#E3FEF3',
    warningSignal: semantic?.state?.warning?.signal ?? theme?.colors?.warning ?? '#FFC700',
    warningFunctional: semantic?.state?.warning?.functional ?? theme?.colors?.textBlackContrast ?? '#151824',
    warningSoft: semantic?.state?.warning?.soft ?? theme?.colors?.warning100 ?? '#FFF9E2',
    signalForeground: tokens.theme.light.semantic.text.default,
    fontFamily,
    fontSize: typography?.roles.control.size ?? font?.size?.productUi ?? '14px',
    fontWeight: font?.weight?.medium ?? 400,
    radiusControl: theme?.ordering?.radius?.control ?? '30px',
    radiusComponent: theme?.ordering?.radius?.component ?? '6px',
    radiusRound: theme?.ordering?.radius?.round ?? '50%',
    duration: theme?.ordering?.motion?.duration?.base ?? '.2s',
    easing: resolveEasing(theme),
    touchTarget: component?.density?.touchTargetMinimum ?? '44px',
    iconSize: component?.density?.iconSize ?? '20px'
  }
}

export const resolveTransparentButtonText = (theme, color) => {
  const palette = resolveButtonTheme(theme)
  if (color === 'primary' || color === 'lightPrimary') return palette.actionContent
  if (color === 'green' || color === 'lightGreen') return palette.successFunctional
  if (color === 'warning') return palette.warningFunctional
  if (color === 'secundary') return palette.textMuted
  return palette.text
}
