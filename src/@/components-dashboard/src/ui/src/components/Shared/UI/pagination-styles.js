import styled, { css } from 'styled-components'

import { resolveSelectTheme } from '../../../styles/selectTheme'
import { PaginationButtonBridge } from './pagination-button-bridge'

const variables = values => Object.fromEntries(
  Object.entries(values).map(([key, value]) => [`--od-pagination-${key}`, String(value)])
)

export const paginationStyle = theme => {
  const roles = resolveSelectTheme(theme)
  return variables({
    surface: roles.surface,
    subtle: roles.surfaceSubtle,
    text: roles.text,
    muted: roles.textMuted,
    border: roles.border,
    'border-strong': roles.borderStrong,
    action: roles.action,
    'action-hover': roles.actionHover,
    'action-foreground': roles.actionForeground,
    'action-soft': roles.actionSoft,
    focus: roles.focus,
    'focus-width': roles.focusWidth,
    'focus-offset': roles.focusOffset,
    font: roles.fontFamily,
    'font-size': roles.fontSize,
    'font-ui': roles.fontUi,
    'compact-height': roles.compactHeight,
    'touch-target': roles.touchTarget,
    'radius-round': roles.radiusRound,
    duration: roles.duration,
    easing: roles.easing,
    'title-margin-left': theme?.rtl ? '10px' : '0px',
    'title-margin-right': theme?.rtl ? '0px' : '10px'
  })
}

export const PaginationContainer = styled.div.attrs({
  className: 'od-ui od-pagination',
  'data-slot': 'pagination'
})`
  ${props => paginationStyle(props.theme)}
`

export const PaginationButtonContainer = styled.div.attrs({
  className: 'od-ui od-pagination-buttons',
  'data-slot': 'pagination-buttons'
})`
  ${props => paginationStyle(props.theme)}
  ${props => props.theme?.rtl ? css`margin-left: 20px;` : css`margin-right: 20px;`}
`

export const PageButton = styled(PaginationButtonBridge).attrs({
  className: 'od-ui od-pagination-page-button',
  type: 'button'
})`
  ${props => paginationStyle(props.theme)}
  --od-pagination-page-background: ${props => props.active ? 'var(--od-pagination-action)' : 'transparent'};
  --od-pagination-page-color: ${props => props.active ? 'var(--od-pagination-action-foreground)' : 'var(--od-pagination-text)'};
  --od-pagination-page-hover: ${props => props.active ? 'var(--od-pagination-action-hover)' : 'var(--od-pagination-subtle)'};
  --od-pagination-page-pressed: ${props => props.active ? 'var(--od-pagination-action-hover)' : 'var(--od-pagination-action-soft)'};
  ${props => props.theme?.rtl ? css`margin-left: 3px;` : css`margin-right: 3px;`}
`

export const PageGap = styled.span.attrs({
  className: 'od-ui od-pagination-gap',
  'data-slot': 'pagination-gap'
})`
  ${props => paginationStyle(props.theme)}
`

export const PageSizeContainer = styled.div.attrs({
  className: 'od-ui od-pagination-size',
  'data-slot': 'pagination-size'
})`
  ${props => paginationStyle(props.theme)}
`

export const PageSizeTitle = styled.p.attrs({
  className: 'od-ui od-pagination-size-title',
  'data-slot': 'pagination-size-title'
})`
  ${props => paginationStyle(props.theme)}
`

export const Option = styled.div.attrs({
  className: 'od-ui od-pagination-option',
  'data-slot': 'pagination-option'
})`
  ${props => paginationStyle(props.theme)}
`
