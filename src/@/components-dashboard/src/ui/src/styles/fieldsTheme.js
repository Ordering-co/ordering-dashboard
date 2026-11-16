import { getOrderingAction, getOrderingTypography } from '~/brand/adapter'

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key)

const resolveEasing = theme => {
  const value = theme?.ordering?.css?.['--od-ease-standard'] ?? theme?.ordering?.motion?.easing?.standard
  if (Array.isArray(value)) return `cubic-bezier(${value.join(', ')})`
  return value ?? 'ease-in'
}

export const resolveFieldTheme = theme => {
  const semantic = theme?.ordering?.semantic
  const font = theme?.ordering?.font
  const component = theme?.ordering?.component
  const action = getOrderingAction(theme || {}) ?? '#2C7BE5'
  const customAction = hasOwn(theme?.ordering, 'actionOverride')
  const primaryFont = theme?.fonts?.primary
  const typography = getOrderingTypography(theme)
  const fontFamily = primaryFont?.family || (primaryFont?.name ? `'${primaryFont.name}', sans-serif` : font?.family?.sans ?? 'inherit')

  return {
    action,
    actionContent: customAction ? action : semantic?.action?.content ?? action,
    actionForeground: customAction
      ? theme?.colors?.primaryContrast ?? semantic?.action?.foreground ?? '#FFF'
      : semantic?.action?.foreground ?? theme?.colors?.primaryContrast ?? '#FFF',
    focus: semantic?.action?.focus ?? action,
    surface: semantic?.surface?.default ?? theme?.colors?.backgroundPage ?? '#FFF',
    surfaceSubtle: semantic?.surface?.subtle ?? theme?.colors?.secundary ?? '#F8F9FA',
    text: semantic?.text?.default ?? theme?.colors?.headingColor ?? '#344050',
    textMuted: semantic?.text?.muted ?? theme?.colors?.secundaryContrast ?? '#748194',
    textSubtle: semantic?.text?.subtle ?? theme?.colors?.disabled ?? '#B1BCCC',
    border: semantic?.border?.default ?? theme?.colors?.borderColor ?? '#DEE2E6',
    borderStrong: semantic?.border?.strong ?? theme?.colors?.disabled ?? '#B1BCCC',
    danger: semantic?.state?.danger?.functional ?? theme?.colors?.danger ?? '#E63757',
    secondaryContent: semantic?.text?.muted ?? theme?.colors?.secundary ?? '#F8F9FA',
    secondaryBorder: semantic?.border?.strong ?? theme?.colors?.secundary ?? '#F8F9FA',
    fontFamily,
    fontSize: typography?.roles.controlValue.size ?? font?.size?.productContent ?? '14px',
    radiusControl: theme?.ordering?.radius?.control ?? '8px',
    duration: theme?.ordering?.motion?.duration?.fast ?? '.2s',
    easing: resolveEasing(theme),
    compactHeight: component?.density?.compactControlHeight ?? '32px',
    touchTarget: component?.density?.touchTargetMinimum ?? '44px',
    focusWidth: component?.focusRing?.width ?? '2px',
    focusOffset: component?.focusRing?.offset ?? '2px'
  }
}
