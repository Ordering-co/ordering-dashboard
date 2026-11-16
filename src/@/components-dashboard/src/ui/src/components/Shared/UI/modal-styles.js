import styled, { css } from 'styled-components'

import { resolveFieldTheme } from '../../../styles/fieldsTheme'

const variables = values => Object.fromEntries(
  Object.entries(values)
    .filter(([, value]) => value != null)
    .map(([key, value]) => [`--od-modal-${key}`, String(value)])
)

export const modalThemeStyle = theme => {
  const roles = resolveFieldTheme(theme)

  return variables({
    surface: roles.surface,
    text: roles.text,
    font: roles.fontFamily,
    focus: roles.focus,
    'focus-width': roles.focusWidth,
    'focus-offset': roles.focusOffset,
    'touch-target': roles.touchTarget,
    'radius-panel': theme?.ordering?.radius?.panel ?? '10px',
    'icon-size': theme?.ordering?.component?.density?.iconSize ?? '16px'
  })
}

const modalDialogStyle = props => {
  const roles = resolveFieldTheme(props.theme)

  return variables({
    width: props.width || '50%',
    height: props.height,
    'dialog-surface': props.isTransparent ? 'transparent' : roles.surface
  })
}

const modalInnerStyle = props => {
  const roles = resolveFieldTheme(props.theme)

  return variables({
    padding: props.padding || '20px',
    overflow: props.overflow || 'auto',
    'inner-surface': props.isTransparent ? 'transparent' : roles.surface
  })
}

export const Container = styled.div.attrs({
  className: 'od-ui od-modal-container'
})`
  ${props => modalThemeStyle(props.theme)}
  ${({ zx }) => zx && css`
    .popup {
      z-index: ${zx} !important;
    }
  `}
`

export const ModalDialog = styled.div.attrs({
  className: 'od-ui od-modal-dialog'
})`
  ${props => modalThemeStyle(props.theme)}
  ${props => modalDialogStyle(props)}
  ${({ maxWidth }) => maxWidth && css`
    max-width: ${maxWidth} !important;
  `}

  /* #400 (main): a dialog whose height changes while it is open (a plugin window that fits its page) stays near the top, so it
     grows downward and its title does not move. */
  ${({ $anchorTop }) => $anchorTop && css`
    margin-top: calc(var(--vh, 1vh) * 8);
  `}
`

export const ModalDialogInnerContainer = styled.div.attrs({
  className: 'od-ui od-modal-inner'
})`
  ${props => modalThemeStyle(props.theme)}
  ${props => modalInnerStyle(props)}
`

export const ModalActions = styled.div.attrs({
  className: 'od-ui od-modal-actions'
})`
  ${props => modalThemeStyle(props.theme)}
`

export const ModalHeader = styled.div.attrs({
  className: 'od-ui od-modal-header'
})`
  ${props => modalThemeStyle(props.theme)}
`

export const ModalTitle = styled.h2.attrs({
  className: 'od-ui od-modal-title'
})`
  ${props => modalThemeStyle(props.theme)}
  ${props => props.theme?.rtl && css`
    text-align: right;
    padding-right: 10px;
    padding-left: 0px;
  `}
`

export const ModalOrderTypes = styled.div.attrs({
  className: 'od-ui od-modal-order-types'
})`
  ${props => modalThemeStyle(props.theme)}
  ${props => props.theme?.rtl && css`
    padding-left: 15px;
    padding-right: 0px;
  `}
`

export const ModalIcon = styled.span.attrs({
  className: 'od-ui od-modal-icon'
})`
  ${props => modalThemeStyle(props.theme)}
  ${props => props.theme?.rtl && css`
    left: 5px;
    right: initial;
  `}
`
