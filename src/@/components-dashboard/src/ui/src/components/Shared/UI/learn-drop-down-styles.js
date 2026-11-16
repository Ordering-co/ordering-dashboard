import styled, { css } from 'styled-components'
import { safeDarken } from '../../../styles/Buttons/theme'
import { resolveSelectTheme } from '../../../styles/selectTheme'
import './learn-drop-down.css'

const variables = values => Object.fromEntries(
  Object.entries(values).map(([key, value]) => [`--od-learn-menu-${key}`, String(value)])
)

export const learnDropDownStyle = theme => {
  const roles = resolveSelectTheme(theme)
  return variables({
    surface: roles.surface,
    subtle: roles.surfaceSubtle,
    text: roles.textMuted,
    action: roles.actionContent,
    'action-soft': roles.actionSoft,
    'action-hover': safeDarken(0.04, roles.actionSoft),
    'action-active': safeDarken(0.1, roles.actionSoft),
    focus: roles.focus,
    'focus-width': roles.focusWidth,
    'focus-offset': roles.focusOffset,
    'touch-target': roles.touchTarget,
    radius: roles.radiusComponent,
    'font-size': roles.fontSize
  })
}

export const LearnDropDownContainer = styled.div.attrs(props => ({
  className: 'od-ui od-learn-menu',
  'data-slot': 'learn-menu',
  dir: props.dir ?? (props.theme?.rtl ? 'rtl' : 'ltr')
}))`
  ${props => learnDropDownStyle(props.theme)}
`

export const DropDownWrapper = styled.div.attrs({
  className: 'od-ui od-learn-menu-wrapper'
})`
  ${props => learnDropDownStyle(props.theme)}
`

export const Option = styled.div.attrs({
  className: 'od-ui od-learn-menu-option'
})`
  ${props => learnDropDownStyle(props.theme)}

  ${({ noPadding }) => noPadding && css`
    padding: 0px;
  `}
`
