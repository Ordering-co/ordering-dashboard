import styled, { css } from 'styled-components'

export const PageContainer = styled.div`
`

export const Header = styled.div`
  display: flex;
  align-items: center;
  h1 {
    font-size: var(--od-type-title-size);
    font-weight: 700;
    margin-bottom: 0px;

    ${props => props.theme?.rtl
? css`
      margin-left: 20px;
    `
: css`
      margin-right: 20px;
    `}
  }
`

export const WrapperEditor = styled.div`
  margin-top: 40px;
`

export const ButtonGroupWrapper = styled.div`
  margin-top: 25px;
  display: flex;
  align-items: center;
  > button {
    height: 44px;
    &:last-child {
      ${props => props.theme?.rtl
? css`
        margin-right: 14px;
      `
: css`
        margin-left: 14px;
      `}
    }
  }
`
