import styled, { css } from 'styled-components'

import { resolveFieldTheme } from '../../../styles/fieldsTheme'

const variables = values => Object.fromEntries(
  Object.entries(values).map(([key, value]) => [`--od-confirm-legacy-${key}`, String(value)])
)

export const confirmLegacyStyle = theme => {
  const roles = resolveFieldTheme(theme)

  return variables({
    surface: roles.surface,
    text: roles.text,
    focus: roles.focus,
    'focus-width': roles.focusWidth,
    'focus-offset': roles.focusOffset,
    'touch-target': roles.touchTarget,
    'radius-panel': theme?.ordering?.radius?.panel ?? '10px',
    'icon-size': theme?.ordering?.component?.density?.iconSize ?? '16px'
  })
}

export const PopupWrap = styled.div.attrs({
  className: 'od-ui od-confirm-legacy-wrap'
})`
  ${props => confirmLegacyStyle(props.theme)}
`

export const PopupDialog = styled.div.attrs({
  className: 'od-ui od-confirm-legacy-dialog'
})`
  ${props => confirmLegacyStyle(props.theme)}
  --od-confirm-legacy-width: ${props => props.width || '70%'};
`

export const PopupActions = styled.div.attrs({
  className: 'od-ui od-confirm-legacy-actions'
})`
  ${props => confirmLegacyStyle(props.theme)}

  button:first-child {
    ${props => props.theme?.rtl
? css`
      margin-left: 25px;
      margin-right: 0;
    `
: css`
      margin-right: 25px;
    `}
  }

  button:last-child {
    ${props => props.theme?.rtl
? css`
      margin-left: 0;
    `
: css`
      margin-right: 0;
    `}
  }
`

export const PopupTitle = styled.h2.attrs({
  className: 'od-ui od-confirm-legacy-title'
})`
  ${props => confirmLegacyStyle(props.theme)}
  ${props => props.theme?.rtl && css`
    text-align: right;
  `}
`

export const PopupContent = styled.div.attrs({
  className: 'od-ui od-confirm-legacy-content'
})`
  ${props => confirmLegacyStyle(props.theme)}
  ${props => props.theme?.rtl && css`
    text-align: right;

    ul {
      padding-right: 30px;
      padding-left: 0;
    }
  `}
`

export const PopupIcon = styled.span.attrs({
  className: 'od-ui od-confirm-legacy-icon'
})`
  ${props => confirmLegacyStyle(props.theme)}
  ${props => props.theme?.rtl && css`
    float: left;
  `}
`
