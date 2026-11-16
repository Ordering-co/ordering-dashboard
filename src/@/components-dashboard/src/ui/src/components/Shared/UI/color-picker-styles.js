import styled, { css } from 'styled-components'
import { Button } from '../../../styles/Buttons'
import { resolveSelectTheme } from '../../../styles/selectTheme'
import './color-picker.css'

const variables = values => Object.fromEntries(
  Object.entries(values).map(([key, value]) => [`--od-color-picker-${key}`, String(value)])
)

export const colorPickerStyle = theme => {
  const roles = resolveSelectTheme(theme)
  return variables({
    surface: roles.surface,
    subtle: roles.surfaceSubtle,
    text: roles.text,
    border: roles.border,
    'border-strong': roles.borderStrong,
    'swatch-boundary': roles.text,
    focus: roles.focus,
    'focus-width': roles.focusWidth,
    'focus-offset': roles.focusOffset,
    'touch-target': roles.touchTarget,
    'icon-size': '20px',
    radius: roles.radiusControl,
    shadow: roles.shadow
  })
}

export const Container = styled.div.attrs(props => ({
  className: 'od-ui od-color-picker',
  'data-slot': 'color-picker',
  dir: props.dir ?? (props.theme?.rtl ? 'rtl' : 'ltr')
}))`
  ${props => colorPickerStyle(props.theme)}
`

export const ColorWrapper = styled(Button).attrs({
  bgtransparent: true,
  className: 'od-color-picker-trigger',
  type: 'button'
})`
  ${props => colorPickerStyle(props.theme)}
`

export const ColorBox = styled.div.attrs(props => ({
  className: 'od-ui od-color-picker-value',
  style: props.bgColor ? { '--od-color-picker-value': props.bgColor } : undefined
}))`
  ${props => colorPickerStyle(props.theme)}
  ${props => props.theme.rtl && css`
    margin-left: 10px;
    margin-right: 0px;
  `}
`

export const ColorPickerWrapper = styled.div.attrs({
  className: 'od-ui od-color-picker-panel'
})`
  ${props => colorPickerStyle(props.theme)}
  ${props => props.theme?.rtl && css`
    right: 0px;
    left: initial;
  `}
`
