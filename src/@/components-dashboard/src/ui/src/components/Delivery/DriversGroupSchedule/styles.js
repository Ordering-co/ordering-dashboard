import styled, { css } from 'styled-components'

export const Container = styled.form`
  min-height: calc(100% - 130px);
  padding-bottom: 20px;
  ${({ disabled }) => disabled && css`
    opacity: 0.7;
    pointer-events: none;
  `}
  > button {
    position: sticky;
    top: 100%;
    height: 42px;
    margin-top: 20px;
  }
`
