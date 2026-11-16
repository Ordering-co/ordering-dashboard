import styled, { css } from 'styled-components'

export const GpsButtonStyle = styled.button`
  position: absolute;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background: ${props => props.theme?.ordering?.semantic?.background ?? props.theme.colors?.backgroundPage ?? '#FFF'};
  padding: 0;
  width: 44px;
  height: 44px;
  line-height: 34px;
  text-align: center;
  border-radius: 50%;
  border-style: solid;
  border-width: 1px;
  border-color: ${props => props.theme?.ordering?.semantic?.action?.default ?? props.theme.colors?.primary};
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.default ?? props.theme.colors?.primary};
    outline-offset: 2px;
  }

  ${props => props.theme?.rtl && css`
    left: 0;
    right: initial;
  `}
  svg {
    color: ${props => props.theme?.ordering?.semantic?.action?.default ?? props.theme.colors?.primary};
    font-size: 25px;
  }
`
