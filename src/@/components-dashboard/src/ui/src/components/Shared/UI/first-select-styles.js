import { resolveSelectTheme } from '../../../styles/selectTheme'

const variables = values => Object.fromEntries(
  Object.entries(values).map(([key, value]) => [`--od-first-select-${key}`, String(value)])
)

export const firstSelectStyle = theme => {
  const roles = resolveSelectTheme(theme)
  return variables({
    surface: roles.surface,
    subtle: roles.surfaceSubtle,
    text: roles.text,
    muted: roles.textMuted,
    'text-subtle': roles.textSubtle,
    border: roles.border,
    action: roles.action,
    'action-content': roles.actionContent,
    'action-soft': roles.actionSoft,
    focus: roles.focus,
    'focus-width': roles.focusWidth,
    'focus-offset': roles.focusOffset,
    font: roles.fontFamily,
    'font-size': roles.fontSize,
    'font-ui': roles.fontUi,
    'compact-height': roles.compactHeight,
    'touch-target': roles.touchTarget,
    radius: roles.radiusControl,
    'radius-component': roles.radiusComponent,
    shadow: roles.shadow,
    duration: roles.duration,
    easing: roles.easing,
    'icon-size': roles.iconSize
  })
}
