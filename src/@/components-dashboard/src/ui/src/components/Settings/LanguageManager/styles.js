import styled, { css } from 'styled-components'

export const LanguageManagerContainer = styled.div`
  flex: 1;
  padding: 0 20px;
  box-sizing: border-box;
  transition: all 0.5s;
  overflow: auto;
  max-height: 100vh;

  ${({ allowOverflow }) => allowOverflow && css`
    overflow: visible;
  `}

  @media print {
    display: none;
  }
`

export const HeaderContainer = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 20px;

  input {
    border: none;
    background: #F8F9FA;
    border-radius: 50px;
  }

  @media (min-width: 992px) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
`

export const HeaderTitleContainer = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  h1 {
    font-size: 20px;
    margin: 0;
    font-weight: bold;
    color: ${props => props.theme.colors.headingColor};
  }
  > button {
    ${props => props.theme?.rtl
? css`
      margin-left: 8px;
      margin-right: -8px;
    `
: css`
      margin-right: 8px;
      margin-left: -8px;
    `}

    svg {
      width: 25px;
      height: 25px;
    }
  }
`

export const ActionsGroup = styled.div`
  display: flex;
  align-items: center;
  margin-top: 15px;

  @media (min-width: 992px) {
    margin-top: 0px;
  }
`

export const TranslationManagerContainer = styled.div`
  margin-top: 20px;
`

export const ActionGroupWrapper = styled.div`
  display: flex;
  ${props => props.theme?.rtl
? css`
    justify-content: flex-start;
  `
: css`
    justify-content: flex-end;
  `}
`

export const ActionGroup = styled.div`
  display: flex;
  align-items: center;
`

export const ViewIconWrapper = styled.span`
  cursor: pointer;

  &.table-mode {
    ${props => props.theme?.rtl
? css`
      margin-left: 12px;
    `
: css`
      margin-right: 12px;
    `}
  }

  > svg {
    font-size: 16px;
    color: ${props => props.theme?.colors.secundaryContrast};
  }

  ${({ active }) => active && css`
    > svg {
      color: ${props => props.theme?.colors.primary};
    }
  `}
`

export const SelectContent = styled.div`
  padding-block: 20px;

  p {
    font-size: 14px;
    color: #748194;
  }

  .select {
    border: none;
    width: 100%;
    line-height: 26px;
    padding: 0;

    > div:first-child {
      padding: 8px 15px;
      border-radius: 7.6px;
      border: 1px solid ${props => props.theme.colors.borderColor};
      font-size: 14px;
    }

    .list {
      max-height: 300px;
      overflow: auto;
    }
  }
`

export const Option = styled.div`
  display: flex;
  align-items: center;
  column-gap: 10px;
  font-size: 13px;
  line-height: 2;
  font-weight: 500;
`

export const LanguageSelectorContainer = styled.div`
  position: relative;
  border-radius: 8px;
  min-height: 35px;
  margin-right: 40px;

  &:hover {
    background-color: ${props => props.theme.colors.lightPrimary};
  }

  .options {
    > div {
      font-size: 14px;
      max-height: fit-content;
    }
  }
`
