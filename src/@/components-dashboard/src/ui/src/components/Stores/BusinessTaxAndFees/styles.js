import styled, { css } from 'styled-components'

export const Container = styled.div`
  padding: 20px;
  height: 100%;

  h1 {
    font-size: 20px;
    font-weight: 700;
    margin-top: 5px;
  }

  > button {
    position: sticky;
    top: 100%;
    height: 44px;
    margin-bottom: 20px;
  }
`
export const SwitchWrapper = styled.div`
  display: flex;
  align-items: center;
  margin: 20px 0 40px;

  p {
    margin-top: 0;
    margin-bottom: 0;
    font-size: 14px;
    ${props => props.theme?.rtl
? css`
      margin-left: 40px;
    `
: css`
      margin-right: 40px;
    `}
  }
`
export const FormController = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 43px;
  margin-top: 20px;
  label {
    font-size: 14px;
    margin-bottom: 11px;
  }

  input {
    font-size: 14px;
  }
`

export const LinkText = styled.span`
  cursor: pointer;
  color: ${props => props.theme.colors.primary};
  &:hover {
    text-decoration: underline;
  }

  ${({ isDisabled }) => isDisabled && css`
    color: #344050;
    &:hover {
      text-decoration: none;
    }
  `}
`

export const Option = styled.div`
  font-size: 14px;
  /* white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 95%; */
  ${({ padding }) => padding && css`
    padding: 5px 0;
  `}
  ${({ isWeight }) => isWeight && css`
    font-weight: 600;
  `}
`

export const OptionCenter = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
  font-size: 16px;
  font-weight: 600;
  ${({ padding }) => padding && css`
    padding: 5px 0;
  `}
  ${({ isWeight }) => isWeight && css`
    font-weight: 600;
  `}
`

export const SelectedTaxesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
`

export const SelectedTaxItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 8px;
  font-size: 14px;
  gap: 12px;
`

export const SelectedTaxInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;

  span {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  small {
    color: ${props => props.theme.colors.darkGray};
  }
`

export const TaxItemActions = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;

  svg {
    cursor: pointer;
    font-size: 18px;
    color: ${props => props.theme.colors.darkGray};

    &:hover {
      color: ${props => props.theme.colors.primary};
    }
  }
`

export const ActionButtonsWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 20px;

  button {
    width: 100%;
    height: 44px;
  }
`
