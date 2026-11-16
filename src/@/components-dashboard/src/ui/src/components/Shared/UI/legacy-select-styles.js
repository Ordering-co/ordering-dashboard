import styled from 'styled-components'

import { resolveSelectTheme } from '../../../styles/selectTheme'

const variables = values => Object.fromEntries(
  Object.entries(values).map(([key, value]) => [`--od-legacy-select-${key}`, String(value)])
)

export const legacySelectStyle = theme => {
  const roles = resolveSelectTheme(theme)
  return variables({
    surface: roles.surface,
    subtle: roles.surfaceSubtle,
    text: roles.text,
    muted: roles.textMuted,
    'text-subtle': roles.textSubtle,
    border: roles.border,
    'border-strong': roles.borderStrong,
    action: roles.action,
    'action-hover': roles.actionHover,
    'action-foreground': roles.actionForeground,
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

export const HeaderItem = styled.div.attrs({
  className: 'od-legacy-select-trigger select'
})`
  box-sizing: border-box;
  cursor: pointer;
  display: flex;
  min-width: 0;
  max-width: 100%;
  min-height: ${props => resolveSelectTheme(props.theme).compactHeight};
  color: ${props => resolveSelectTheme(props.theme).text};
  background: ${props => resolveSelectTheme(props.theme).surface};
  border-radius: ${props => resolveSelectTheme(props.theme).radiusControl};
  border: 1px solid ${props => resolveSelectTheme(props.theme).border};
  padding: 0;
  font-family: ${props => resolveSelectTheme(props.theme).fontFamily};
  font-size: ${props => resolveSelectTheme(props.theme).fontSize};
  transition:
    background-color ${props => resolveSelectTheme(props.theme).duration} ${props => resolveSelectTheme(props.theme).easing},
    border-color ${props => resolveSelectTheme(props.theme).duration} ${props => resolveSelectTheme(props.theme).easing};

  &:hover {
    border-color: ${props => resolveSelectTheme(props.theme).borderStrong};
  }

  &:focus-visible {
    outline: ${props => resolveSelectTheme(props.theme).focusWidth} solid ${props => resolveSelectTheme(props.theme).focus};
    outline-offset: ${props => resolveSelectTheme(props.theme).focusOffset};
  }

  @media (pointer: coarse) {
    min-height: ${props => resolveSelectTheme(props.theme).touchTarget};
  }

  @media (prefers-reduced-motion: reduce) {
    transition-property: none;
    transition-duration: 0s;
  }
`

export const PopoverBody = styled.div.attrs({
  className: 'od-legacy-select-popover list'
})`
  z-index: calc(var(--od-x-layer-chrome) + 1);
`
