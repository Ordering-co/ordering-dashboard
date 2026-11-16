import { resolveSelectTheme } from '../../../styles/selectTheme'
import './entity-selector.css'

const variables = values => Object.fromEntries(
  Object.entries(values).map(([key, value]) => [`--od-entity-selector-${key}`, String(value)])
)

export const entitySelectorStyle = theme => {
  const roles = resolveSelectTheme(theme)
  return variables({
    surface: roles.surface,
    subtle: roles.surfaceSubtle,
    text: roles.text,
    muted: roles.textMuted,
    border: roles.border,
    'border-strong': roles.borderStrong,
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
    duration: roles.duration,
    easing: roles.easing
  })
}
