import styled, { css } from 'styled-components'

export const MainContainer = styled.div`
  display: flex;
  height: 100%;
`

export const PaymentMethodsContainer = styled.div`
  height: 100%;
  overflow-x: hidden;
  flex: 1;
  ${({ isOpenWalletDetails }) => isOpenWalletDetails && css`
    max-width: 500px;
  `}
  h1 {
    color: ${props => props.theme.colors.headingColor};
    font-size: 20px;
    font-weight: 700;
    margin-top: 5px;
  }
  > button {
    height: 44px;
    margin: 20px 0;
  }
  @media (min-width: 576px) {
    padding: 20px;
  }
`

export const PaymethodListWrapper = styled.div`
  border-top: 1px solid ${props => props.theme.colors.borderColor};
  h2 {
    font-size: 16px;
    font-weight: 700;
  }
`

export const PaymethodOptionContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};
  cursor: pointer;

  &:hover {
    background-color: ${props => props.theme.colors.lightPrimary};
  }

  ${({ disabled }) => disabled && css`
    cursor: initial;
    svg {
      cursor: pointer;
    }
  `}

  ${({ active }) => active && css`
    background-color: ${props => props.theme.colors.lightPrimary};
    border-top: 1px solid ${props => props.theme.colors.primary};
    border-bottom: 1px solid ${props => props.theme.colors.primary};
  `}
  > svg {
    font-size: 13px;
    color: ${props => props.theme.colors.secundaryLight};
  }
`

export const PaymethodOption = styled.div`
  display: flex;
  align-items: center;
  padding: 16px 0;
  color: ${props => props.theme.colors.headingColor};

  > svg {
    font-size: 20px;
    &.fill {
      color: ${props => props.theme.colors.primary};
    }
  }
`

export const PaymethodLeadSpacer = styled.span`
  display: inline-block;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
`

export const PaymethodName = styled.span`
  color: ${props => props.theme.colors.headingColor};
  font-size: 14px;
  flex: 1;
  min-width: 0;
  margin: 0 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const PaymethodInstallAction = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  button {
    height: 32px;
    line-height: 30px;
    font-size: 12px;
    padding: 0 14px;
    white-space: nowrap;
  }
`
export const SearchBarWrapper = styled.div`
  margin-bottom: 15px;
  margin-top: 27px;
`
export const ButtonGroup = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 15px;
  button {
    height: 32px;
    font-size: 12px;
    &:first-child {
      ${props => props.theme?.rtl
    ? css`
        margin-left: 20px;
      `
    : css`
        margin-right: 20px;
      `}
    }
  }
`

export const Divider = styled.div`
  height: 10px;
  margin: 20px 0px;
  background-color: #F8F9FA;
`

export const CreditCardPaymentsContainer = styled.div`
  position: relative;
`
