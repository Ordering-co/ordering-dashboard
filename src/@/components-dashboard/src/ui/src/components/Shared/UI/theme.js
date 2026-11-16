import { useTheme } from 'styled-components'
import { resolveButtonTheme, resolveTransparentButtonText, safeDarken } from '../../../styles/Buttons/theme'
import { tokens } from '~/brand/ordering.tokens.generated'
import '~/brand/pilot.css'

// Same JS resolver as the compatible facade; variables also travel with portals.
export const orderingUIStyle = theme => {
  const roles = resolveButtonTheme(theme)
  const variables = {
    surface: roles.surface,
    subtle: roles.surfaceSubtle,
    text: roles.text,
    muted: roles.textMuted,
    border: roles.border,
    'border-strong': roles.borderStrong,
    action: roles.action,
    'action-hover': roles.actionHover,
    'action-foreground': roles.actionForeground,
    'action-content': roles.actionContent,
    'action-soft': roles.actionSoft,
    focus: roles.focus,
    danger: theme?.ordering?.semantic.state.danger.functional ?? tokens.theme.light.semantic.state.danger.functional,
    font: roles.fontFamily,
    'font-size': roles.fontSize,
    'font-weight': roles.fontWeight,
    'control-height': tokens.component.density.compactControlHeight,
    'touch-target': roles.touchTarget,
    radius: roles.radiusControl,
    'radius-component': roles.radiusComponent,
    'radius-panel': theme?.ordering?.radius.panel ?? tokens.radius.panel,
    duration: roles.duration,
    easing: roles.easing,
    'focus-width': theme?.ordering?.component?.focusRing?.width ?? tokens.component.focusRing.width,
    'focus-offset': theme?.ordering?.component?.focusRing?.offset ?? tokens.component.focusRing.offset,
    'icon-size': roles.iconSize
  }
  return Object.fromEntries(Object.entries(variables).map(([key, value]) => [`--od-ui-${key}`, String(value)]))
}

const cssVariables = variables => Object.fromEntries(
  Object.entries(variables).map(([key, value]) => [`--od-ui-${key}`, value])
)

// styled-components resolves interpolations after every attrs layer. These
// variables therefore reflect the final props even when an existing consumer
// extends the facade with styled(Button).attrs(...) or changes its `as` target.
export const orderingButtonStyle = (theme, props, { buttonLink = false } = {}) => {
  const roles = resolveButtonTheme(theme)
  const legacy = props.compatibility === 'legacy'
  let background = legacy ? roles.surfaceSubtle : roles.surface
  let foreground = roles.text
  let border = roles.border
  let hoverBackground = safeDarken(0.04, roles.surfaceSubtle)
  let activeBackground = safeDarken(0.1, roles.surfaceSubtle)

  if (props.outline) {
    background = roles.surface
    foreground = roles.textMuted
    border = roles.borderStrong
    hoverBackground = roles.surfaceSubtle
    activeBackground = roles.surfaceSubtle
  }

  if (props.color === 'primary') {
    background = roles.action
    foreground = roles.actionForeground
    border = roles.action
    hoverBackground = roles.actionHover
    activeBackground = roles.actionActive
    if (props.outline) {
      background = roles.surface
      foreground = roles.actionContent
      hoverBackground = legacy ? roles.actionHover : roles.surfaceSubtle
      activeBackground = hoverBackground
    }
  } else if (props.color === 'lightPrimary') {
    background = roles.actionSoft
    foreground = roles.actionContent
    border = roles.actionSoft
    hoverBackground = safeDarken(0.04, roles.actionSoft)
    activeBackground = safeDarken(0.04, roles.actionSoft)
  } else if (props.color === 'lightGreen') {
    background = roles.successSoft
    foreground = roles.successFunctional
    border = roles.successSignal
    hoverBackground = safeDarken(0.04, roles.successSoft)
    activeBackground = safeDarken(0.1, roles.successSoft)
  } else if (props.color === 'green') {
    background = roles.successSignal
    foreground = roles.signalForeground
    border = roles.successSignal
    hoverBackground = safeDarken(0.04, roles.successSignal)
    activeBackground = safeDarken(0.1, roles.successSignal)
  } else if (props.color === 'warning') {
    background = roles.warningSignal
    foreground = roles.signalForeground
    border = roles.warningSignal
    hoverBackground = safeDarken(0.04, roles.warningSignal)
    activeBackground = safeDarken(0.1, roles.warningSignal)
  } else if (props.color === 'secundaryDark') {
    background = roles.border
    foreground = roles.text
    border = roles.border
    hoverBackground = safeDarken(0.04, roles.border)
    activeBackground = safeDarken(0.1, roles.border)
  } else if (props.color === 'secundary') {
    background = roles.surfaceSubtle
    foreground = roles.textMuted
    border = roles.border
    hoverBackground = safeDarken(0.04, roles.surfaceSubtle)
    activeBackground = safeDarken(0.1, roles.surfaceSubtle)
    if (props.outline) {
      background = roles.surface
      hoverBackground = roles.surfaceSubtle
      activeBackground = roles.surfaceSubtle
    }
  } else if (props.color === 'black') {
    background = roles.surfaceStrong
    foreground = roles.textInverse
    border = roles.surfaceStrong
    hoverBackground = safeDarken(0.04, roles.surfaceStrong)
    activeBackground = safeDarken(0.1, roles.surfaceStrong)
  }

  if (props.bgtransparent) {
    background = 'transparent'
    hoverBackground = 'transparent'
    activeBackground = 'transparent'
    foreground = resolveTransparentButtonText(theme, props.color)
  }

  if (props.tone === 'dangerText') {
    const danger = theme?.ordering?.semantic.state.danger.functional ?? tokens.theme.light.semantic.state.danger.functional
    background = 'transparent'
    foreground = danger
    border = 'transparent'
    hoverBackground = 'transparent'
    activeBackground = 'transparent'
  }

  const rtl = props.dir ? props.dir === 'rtl' : Boolean(theme?.rtl)
  const circle = Boolean(props.circle)
  const radius = circle
    ? roles.radiusRound
    : props.rectangle
      ? '0px'
      : props.borderRadius || roles.radiusControl

  const lineHeight = buttonLink ? '40px' : circle ? '32px' : legacy ? '30px' : '1.5'
  return cssVariables({
    'button-background': background,
    'button-foreground': foreground,
    'button-border': border,
    'button-hover-background': hoverBackground,
    'button-active-background': activeBackground,
    'button-display': legacy ? 'inline-block' : 'inline-flex',
    'button-line-height': lineHeight,
    'button-touch-line-height': buttonLink ? '40px' : circle ? `calc(${roles.touchTarget} - 2px)` : lineHeight,
    'button-padding-inline': circle ? '0px' : legacy ? '15px' : tokens.space[3],
    'button-min-height': legacy ? '0px' : tokens.component.density.compactControlHeight,
    'button-max-width': legacy ? 'none' : '100%',
    'button-width': circle ? '34px' : 'auto',
    'button-height': circle ? '34px' : 'auto',
    'button-radius': radius,
    'button-text-align': buttonLink || circle ? 'center' : props.initialIcon ? (rtl ? 'right' : 'left') : 'center'
  })
}

export const orderingButtonStateForeground = (theme, props) => {
  if (props.compatibility !== 'legacy') return {}
  const roles = resolveButtonTheme(theme)
  if (props.bgtransparent) {
    const foreground = resolveTransparentButtonText(theme, props.color)
    return { hover: foreground, active: foreground }
  }
  if (props.outline) {
    const foreground = props.color === 'primary' ? roles.actionForeground : roles.text
    return { hover: foreground, active: foreground }
  }
  if (props.color === 'primary') return { hover: roles.actionForeground }
  return {}
}

export const orderingIconButtonStyle = (theme, props) => {
  const roles = resolveButtonTheme(theme)
  const black = props.color === 'black'
  const primary = props.color === 'primary'
  return cssVariables({
    'icon-button-background': black && props.active ? roles.border : 'transparent',
    'icon-button-hover-background': roles.surfaceSubtle,
    'icon-button-active-background': black ? roles.border : roles.actionSoft,
    'icon-button-foreground': primary ? roles.actionContent : black ? roles.text : roles.textMuted,
    'icon-button-hover-foreground': primary ? roles.actionContent : roles.text,
    'icon-button-pointer-events': props.isDisabled ? 'none' : 'auto'
  })
}

export const orderingLinkButtonStyle = (theme, props) => {
  const roles = resolveButtonTheme(theme)
  return cssVariables({
    'link-button-foreground': roles.actionContent,
    'link-button-pointer-events': props.disabled ? 'none' : 'auto',
    'link-button-opacity': props.disabled ? '0.5' : '1'
  })
}

export const useOrderingUI = () => {
  const theme = useTheme()
  return { style: orderingUIStyle(theme), dir: theme?.rtl ? 'rtl' : 'ltr' }
}
