import styled, { css } from 'styled-components'

export const BusinessListingContainer = styled.div`
  flex: 1;
  padding: 20px;
  box-sizing: border-box;
  transition: all 0.5s;
  overflow: hidden;
  ${({ isAdd }) => isAdd && css`
    max-height: 100vh;
    overflow: auto;
  `}
  @media print {
    display: none;
  }
`

export const ViewContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
  ${({ flexEnd }) => flexEnd && css`
    justify-content: flex-end;
  `}
  .box-wrapper {
    display: flex;
    flex-direction: column;
    p.bold {
      font-weight: 700;
    }
    p {
      margin: 0;
    }
    .box-container {
      display: flex;
      padding: 10px 10px 10px 30px;
      border-radius: 8px;
      background-color: ${props => props.theme.colors.secundary};
    }
    .text-wrapper {
      display: flex;
      align-items: center;
      margin-right: 20px;
    }
  }
`

export const BoxColor = styled.div`
  width: 15px;
  height: 15px;
  border-radius: 4px;
  background-color: ${({ color }) => color};
  margin-right: 10px;
`

export const WrapperView = styled.div`
  display: flex;
  > span:first-child {
    ${props => props.theme?.rtl
? css`
      margin-left: 10px;
    `
: css`
      margin-right: 10px;
    `}
  }
`

export const ViewMethodButton = styled.span`
  cursor: pointer;
  color: ${props => props.theme.colors.headingColor};
  svg {
    font-size: 20px;
    transition: all .2s ease-in;
  }
  ${({ active }) => active && css`
    color: ${props => props.theme.colors.primary};
  `}
  &:hover {
    svg {
      font-size: 24px;
    }
  }
`

export const ButtonGroup = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-direction: column;
  > div {
    width: 100%;
  }
  @media (min-width: 769px) {
    flex-direction: row;
    align-items: center;
    ${({ isSelect }) => isSelect && css`
      > div {
        width: calc(100% - 100px);
      }
    `}
  }
  > button {
    height: 42px;
    display: flex;
    align-items: center;
    svg {
      min-width: 14px;
      margin-left: 5px;
      ${props => props.theme.rtl && css`
        margin-left: 0px;
        margin-right: 5px;
      `}
    }
  }
`

export const EmptyBusinessWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  min-height: calc(50vh - 140px);
  > img {
    width: 90%;
    max-width: 500px;
  }
  button {
    height: 44px;
    margin-top: 30px;
  }
  @media (min-width: 576px) {
    > img {
      width: 60%;
    }
  }
`
