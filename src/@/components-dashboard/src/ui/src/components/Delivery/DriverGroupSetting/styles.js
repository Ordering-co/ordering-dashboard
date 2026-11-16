import styled, { css } from 'styled-components'

export const Container = styled.div`
  margin-top: 26px;
`

export const ButtonGroup = styled.div`
  display: flex;
  align-items: center;
  margin-top: 10px;
  margin-bottom: 10px;
  button {
    min-height: 44px;
  }
  button:first-child {
    ${props => props.theme?.rtl
  ? css`
      margin-left: 7px;
    `
  : css`
      margin-right: 7px;
    `}
  }
`

export const DriverGroupListContainer = styled.div`
  margin: 15px 0;
`

export const DriverGroupItem = styled.button`
  display: flex;
  width: 100%;
  align-items: center;
  border-bottom: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors.borderColor};
  border-top: 0;
  border-left: 0;
  border-right: 0;
  background: transparent;
  color: inherit;
  text-align: start;
  padding: 12px 0;
  min-height: 44px;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.default ?? props.theme.colors.primary};
    outline-offset: 2px;
  }

  ${({ disabled }) => disabled && css`
    cursor: not-allowed;
    opacity: 0.6;
    pointer-events: none;
  `}

  > span {
    font-size: var(--od-type-content-size);
    ${props => props.theme?.rtl
? css`
      margin-right: 15px;
    `
: css`
      margin-left: 15px;
    `}
  }
`

export const CheckboxWrapper = styled.div`
  svg {
    font-size: 20px;
    color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors.lightGray};
  }

  ${({ active }) => active && css`
    svg {
      color: ${props => props.theme?.ordering?.semantic?.action?.default ?? props.theme.colors.primary};
    }
  `}
`
