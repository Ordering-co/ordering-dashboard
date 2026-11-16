import styled, { css } from 'styled-components'

import { resolveFieldTheme } from '../../../styles/fieldsTheme'

const variables = values => Object.fromEntries(
  Object.entries(values).map(([key, value]) => [`--od-phone-${key}`, String(value)])
)

export const phoneInputStyle = theme => {
  const roles = resolveFieldTheme(theme)

  return variables({
    surface: roles.surface,
    'surface-subtle': roles.surfaceSubtle,
    text: roles.text,
    'text-muted': roles.textMuted,
    placeholder: roles.textSubtle,
    border: roles.border,
    'border-strong': roles.borderStrong,
    focus: roles.focus,
    danger: roles.danger,
    font: roles.fontFamily,
    'font-size': roles.fontSize,
    radius: roles.radiusControl,
    'compact-height': roles.compactHeight,
    'touch-target': roles.touchTarget,
    'focus-width': roles.focusWidth,
    'focus-offset': roles.focusOffset,
    duration: roles.duration,
    easing: roles.easing
  })
}

export const Container = styled.div.attrs({
  className: 'od-ui od-phone-input'
})`
  ${props => phoneInputStyle(props.theme)}

  ${props => props.theme?.rtl && css`
    .PhoneInputCountrySelectArrow {
      margin-right: 0.35em;
    }
  `}
`

export const ErrorMsg = styled.span.attrs({
  className: 'od-ui od-phone-input-error'
})`
  ${props => phoneInputStyle(props.theme)}
`
