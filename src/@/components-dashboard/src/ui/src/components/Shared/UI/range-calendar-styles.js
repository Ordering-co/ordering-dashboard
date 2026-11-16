import styled, { css } from 'styled-components'
import { resolveSelectTheme } from '../../../styles/selectTheme'
import './range-calendar.css'

const variables = values => Object.fromEntries(
  Object.entries(values).map(([key, value]) => [`--od-range-calendar-${key}`, String(value)])
)

export const rangeCalendarStyle = theme => {
  const roles = resolveSelectTheme(theme)
  return variables({
    surface: roles.surface,
    subtle: roles.surfaceSubtle,
    text: roles.text,
    muted: roles.textMuted,
    'text-subtle': roles.textSubtle,
    border: roles.border,
    action: roles.action,
    'action-foreground': roles.actionForeground,
    'action-soft': roles.actionSoft,
    focus: roles.focus,
    'focus-width': roles.focusWidth,
    'focus-offset': roles.focusOffset,
    'touch-target': roles.touchTarget,
    radius: roles.radiusComponent,
    shadow: roles.shadow,
    'icon-size': roles.iconSize
  })
}

export const Container = styled.div.attrs(props => ({
  className: 'od-ui od-range-calendar',
  'data-slot': 'range-calendar',
  dir: props.dir ?? (props.theme?.rtl ? 'rtl' : 'ltr')
}))`
  ${props => rangeCalendarStyle(props.theme)}
`

export const CalendarWrapper = styled.div.attrs({
  className: 'od-ui od-range-calendar-panel'
})`
  ${props => rangeCalendarStyle(props.theme)}
  ${props => props.theme?.rtl
? css`
    left: 0px;
  `
: css`
    right: 0px;
  `}
  ${({ isLeft }) => isLeft && css`
    ${props => props.theme?.rtl
? css`
      right: 0px;
    `
: css`
      left: 0px;
    `}
  `}
`
