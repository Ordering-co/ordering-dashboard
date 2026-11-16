import styled, { css } from 'styled-components'

import { resolveFieldTheme } from '../../../styles/fieldsTheme'
import './sidebar.css'

const variables = values => Object.fromEntries(
  Object.entries(values).map(([key, value]) => [`--od-sidebar-${key}`, String(value)])
)

export const sidebarStyle = theme => {
  const roles = resolveFieldTheme(theme)
  return variables({
    surface: roles.surface,
    border: roles.border,
    'touch-target': roles.touchTarget
  })
}

export const BarContainer = styled.div.attrs({
  className: 'od-ui od-sidebar'
})`
  ${props => sidebarStyle(props.theme)}
  ${({ noAnimation }) => !noAnimation && css`
    transition: 0.3s;
  `}
  ${({ isBorderShow }) => isBorderShow
? css`
    ${props => props.theme?.rtl
? css`
      border-right: 1px solid var(--od-sidebar-border);
    `
: css`
      border-left: 1px solid var(--od-sidebar-border);
    `}
  `
: css`
    box-shadow: 0px 8px 35px rgba(0, 0, 0, 0.16);
  `}
  ${props => props.theme?.rtl
? css`
    left: var(--assistant-offset, 0px);
    padding-left: ${({ moveDistance }) => moveDistance ? `${moveDistance}px` : '0px'};
  `
: css`
    right: var(--assistant-offset, 0px);
    padding-right: ${({ moveDistance }) => moveDistance ? `${moveDistance}px` : '0px'};
  `}
`

export const IconButtonWrapper = styled.div.attrs({
  className: 'od-ui od-sidebar-actions'
})`
  ${props => sidebarStyle(props.theme)}
  ${props => props.theme?.rtl
? css`
    left: ${({ moveDistance }) => moveDistance ? `${moveDistance + 20}px` : '20px'};
  `
: css`
    right: ${({ moveDistance }) => moveDistance ? `${moveDistance + 20}px` : '20px'};
  `}
  ${({ IconTop }) => IconTop && css`
    top: ${IconTop};
  `}
`
