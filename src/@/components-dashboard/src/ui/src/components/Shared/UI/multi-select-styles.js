import styled, { css } from 'styled-components'

import { resolveSelectTheme } from '../../../styles/selectTheme'

const variables = values => Object.fromEntries(
  Object.entries(values).map(([key, value]) => [`--od-multi-select-${key}`, String(value)])
)

export const multiSelectStyle = theme => {
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

export const CheckBox = styled.div`
  color: ${props => resolveSelectTheme(props.theme).actionContent};
  display: flex;
  align-items: center;
  flex-shrink: 0;
  margin-right: 10px;

  svg {
    font-size: 16px;
  }
`

export const TextFormatted = styled.span`
  ${({ primary, theme }) => primary && css`
    color: ${resolveSelectTheme(theme).actionContent};
  `}

  div {
    font-size: ${props => resolveSelectTheme(props.theme).fontSize};
    color: ${props => resolveSelectTheme(props.theme).actionContent};
  }
`

export const PaginationWrapper = styled.div`
  margin: 20px;
`
