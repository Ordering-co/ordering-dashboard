import styled, { css } from 'styled-components'

export const ConnectOverviewContainer = styled.div`
  flex: 1;
  padding: 20px;
  box-sizing: border-box;
  transition: all 0.5s;
  max-height: 100vh;
  overflow: auto;
`

export const HeaderTitleContainer = styled.div`
  display: flex;
  align-items: center;
  padding: 0px 10px;

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

export const OptionsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  margin-top: 20px;

  .option {
    width: 100%;
    margin: 10px 0;
    padding: 20px;
    border-radius: 10px;
    box-shadow: 0px 1px 4px 0px #0000001A;
    transition: all 0.5s;

    &:hover {
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
    }

    h2, p {
      margin-bottom: 20px;
    }

    h2 {
      font-size: 16px;
      font-weight: 500;
    }

    p {
      font-size: 14px;
      font-weight: 400;
    }

    button {
      width: 100%;
      border-radius: 5px;
      @media (min-width: 768px) {
        max-width: 320px;
      }
    }
  }
`
