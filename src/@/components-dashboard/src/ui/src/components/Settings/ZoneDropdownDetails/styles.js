import styled, { css } from 'styled-components'

export const ZoneDropdownDetailsContainer = styled.div`
  width: 100%;
  padding: 20px;
  box-sizing: border-box;

  > button {
    position: sticky;
    top: 100%;
    margin-bottom: 20px;
    height: 42px;
  }
`

export const Header = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 35px;

  h1 {
    font-size: var(--od-type-title-size);
    font-weight: 700;
    margin-bottom: 0;
    ${props => props.theme?.rtl
? css`
      margin-left: 15px;
    `
: css`
      margin-right: 15px;
    `}
  }
`

export const InputWrapper = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 25px;

  label {
    font-size: var(--od-type-control-size);
  }

  div {
    font-size: var(--od-type-control-value-size);
  }

  .select {
    ${({ isCity }) => isCity
? css`
      > div:first-child {
        > div:first-child {
          div {
            padding-left: 0px;
            padding-right: 0px;
          }
        }
      }
    `
: css`
      padding-top: 4px;
      padding-bottom: 4px;
    `}
    border: none;
    background-color: ${props => props.theme.colors.secundary};
  }
`
