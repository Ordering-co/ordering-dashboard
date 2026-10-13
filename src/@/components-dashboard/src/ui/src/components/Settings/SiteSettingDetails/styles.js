import styled, { css } from 'styled-components'

export const SettingsListContainer = styled.div`
  width: 100%;
  padding: 26px 20px;
  overflow-x: hidden;
`

export const GeneralContainer = styled.div``

export const GeneralTitle = styled.div`
  display: flex;
  align-items: center;

  p {
    font-weight: bold;
    font-size: 20px;
    color: ${props => props.theme.colors.headingColor};
    margin-bottom: 6px;
  }
`

export const FormContainer = styled.div`
  margin-top: 20px;
`

export const FormGroupText = styled.div`
  margin-bottom: 20px;

  label {
    font-weight: 600;
    margin-bottom: 10px;
    font-size: 14px;
    color: ${props => props.theme.colors.headingColor};
  }

  input[type='text'] {
    font-size: 14px;
    height: 44px;
    border: 1px solid #DEE2E6;
    box-sizing: border-box;
    border-radius: 7.6px;
  }
`

export const Required = styled.span`
  font-weight: 600;
  font-size: 10px;
  color: #E63757;
`

export const SkeletonWrapper = styled.div`
  margin-top: 20px;

  div {
    margin-bottom: 15px;
  }
`
export const ContentWrapper = styled.div`
`
export const HeaderTitleContainer = styled.div`
  display: flex;
  align-items: center;

  > h1 {
    font-weight: 700;
    font-size: 20px;
    color: ${props => props.theme.colors.headingColor};
    margin: 0px;
    line-height: 32px;
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
export const Content = styled.div`
  width: 100%;
`

export const CategoryName = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-right: 25px;
  ${props => props.theme.rtl && css`
    margin-right: 0;
    margin-left: 25px;
  `}

  p {
    font-weight: bold;
    font-size: 20px;
    margin-bottom: 6px;
    width: auto
  }
`
export const Description = styled.p`
  font-size: 14px;
  margin-bottom: 0px;
  text-align: justify;

  @media (min-width: 768px) {
    text-align: initial;
  }
`
export const SubCategoryWrapper = styled.div`
  padding: 20px 20px 0px 30px;
  width: 100%;
`

export const PasswordInputWrapper = styled.div`
  position: relative;
  width: 100%;

  input {
    width: 100%;
    height: 44px;
    padding-right: 40px;
  }

  button {
    position: absolute;
    ${props => props.theme?.rtl ? 'left: 10px;' : 'right: 10px;'}
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${props => props.theme.colors.headingColor};
    opacity: 0.7;
    transition: opacity 0.3s;

    &:hover {
      opacity: 1;
    }

    svg {
      font-size: 18px;
    }
  }
`
