import styled, { css } from 'styled-components'
import { darken } from 'polished'

export const LearnDropDownContainer = styled.div`
  display: flex;

  button {
    height: 42px;
    ${props => props.theme?.rtl
      ? css` margin-left: 14px;`
      : css`margin-right: 14px;`
    }

    svg {
      ${props => props.theme?.rtl
        ? css`margin-right: 5px;`
        : css`margin-left: 5px;`
      }
    }
  }

  @media (min-width: 992px) {
    margin: 0px;
  }
`

export const DropDownWrapper = styled.div`
  .learn-drop-down {
    min-width: 90px;
    width: fit-content;
    height: 28px;
    line-height: 43px;
    border: none;
    margin: 0 10px;
    background: ${props => props.theme.colors.lightPrimary};
    color: ${props => props.theme.colors.primary};
    border-color: ${props => props.theme.colors.lightPrimary};
    &:hover {
      background: ${props => darken(0.04, props.theme.colors.lightPrimary)};
    }
    &:active {
      background: ${props => darken(0.1, props.theme.colors.lightPrimary)};
    }
    >div:first-child {
      height: 100%;
      padding-left: 8px;
      padding-right: 8px;
    }
  }
  .list {
    right: auto;
  }
  .list-wrapper {
    min-width: 168px;
  }

  .search-bar-container {
    padding: 7px 11px;
    width: 100%;
    input {
      border-radius: 7.6px;
      width: 100%;
    }
  }

  .search-bar-container {
    svg {
      top: 13px;
    }
    input {
      height: 40px;
    }
  }
`

export const Option = styled.div`
  display: flex;
  align-items: center;
  padding: 5px 10px;
  column-gap: 5px;

  p {
    padding-left: 5px;
    margin: 0px;
    white-space: nowrap;
    font-size: 14px;
    line-height: 26px;
    color: ${props => props.theme.colors.secundaryContrast};
  }

  p.place-holder {
    font-size: 12px;
    color: ${props => props.theme.colors.primary};
  }

  ${({ noPadding }) => noPadding && css`
    padding: 0px;
  `}
`
