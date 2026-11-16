import styled, { css } from 'styled-components'
import { Button } from '../../../styles/Buttons'
import { resolveSelectTheme } from '../../../styles/selectTheme'
import './column-allow-setting-popover.css'

const variables = values => Object.fromEntries(
  Object.entries(values).map(([key, value]) => [`--od-column-popover-${key}`, String(value)])
)

export const columnAllowSettingPopoverStyle = theme => {
  const roles = resolveSelectTheme(theme)
  return variables({
    surface: roles.surface,
    subtle: roles.surfaceSubtle,
    text: roles.text,
    border: roles.border,
    action: roles.actionContent,
    focus: roles.focus,
    'focus-width': roles.focusWidth,
    'focus-offset': roles.focusOffset,
    'touch-target': roles.touchTarget,
    radius: roles.radiusComponent,
    shadow: roles.shadow,
    duration: roles.duration,
    easing: roles.easing
  })
}

export const HeaderItem = styled.div.attrs({
  className: 'od-ui od-column-popover-header'
})`
  ${props => columnAllowSettingPopoverStyle(props.theme)}
`

export const PopoverBody = styled.div.attrs({
  className: 'od-ui od-column-popover-panel'
})`
  ${props => columnAllowSettingPopoverStyle(props.theme)}
`

export const PopoverList = styled.div.attrs({
  className: 'od-ui od-column-popover-list'
})`
`

export const AllowItem = styled(Button).attrs({
  bgtransparent: true,
  className: 'od-ui od-column-popover-item',
  type: 'button'
})`
  ${props => columnAllowSettingPopoverStyle(props.theme)}
  span {
    ${props => props.theme?.rtl
? css`
      margin-right: 10px;
      `
: css`
      margin-left: 10px;
    `}
  }
`

export const Title = styled.div.attrs({
  className: 'od-ui od-column-popover-title'
})`
  ${props => columnAllowSettingPopoverStyle(props.theme)}
`
