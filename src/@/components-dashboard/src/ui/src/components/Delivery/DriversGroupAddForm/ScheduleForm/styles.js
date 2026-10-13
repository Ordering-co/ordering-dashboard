import styled, { css } from 'styled-components'

export const HeaderWrapper = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;

  h2 {
    font-weight: 600;
    font-size: 16px;
    line-height: 24px;
    margin: 0 0 29px 0;
    ${props => props.theme?.rtl
? css`
      padding-left: 16px;
    `
: css`
      padding-right: 16px;
    `}
  }
`

export const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  margin: 0 0 29px 0;

  p {
    font-size: 14px;
    margin: 0px;
    ${props => props.theme?.rtl
? css`
      padding-right: 10px;
    `
: css`
      padding-left: 10px;
    `}
  }
`

export const Description = styled.p`
  font-size: 12px;
  margin: 0 0 25px 0;
  color: ${props => props.theme.colors.lightGray};
`

export const InputWrapper = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 35px;

  label {
    font-size: 14px;
  }

  .select {
    padding-top: 4px;
    padding-bottom: 4px;
    border: none;
    background-color: ${props => props.theme.colors.secundary};
    font-size: 14px;

    ${({ isTimezone }) => isTimezone && css`
      > div:first-child {
        > div {
          overflow: hidden;
        }
      }
      .list-wrapper {
        font-size: 12px;
      }
    `}
  }
`
