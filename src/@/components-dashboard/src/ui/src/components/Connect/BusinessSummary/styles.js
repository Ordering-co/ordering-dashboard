import React from 'react'
import styled, { css } from 'styled-components'
import { darken } from 'polished'

export const BusinessDetailsContainer = styled.div`
  width: 100%;
  box-sizing: border-box;
  padding: 20px;
  position: relative;
  overflow-x: hidden;

  .sticky-buttons {
    position: sticky;
    top: 100%;
    height: 42px;
    display: flex;

    > div {
      display: flex;
    }
    .save-button {
      width: 100%;
      justify-content: end;
    }
  }

  @media (min-width: 768px) {
    min-width: 500px;
  }
`

export const DetailsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`

export const BusinessName = styled.h1`
  color: ${props => props.theme.colors.headingColor};
  font-size: 20px;
  margin: 0px;
  font-weight: 700;
  flex: 1;

  ${props => props.theme?.rtl
? css`
    margin-left: 10px;
  `
: css`
    margin-right: 10px;
  `}
`

export const SyncMenuWrapper = styled.h1`
  color: ${props => props.theme.colors.headingColor};
  font-size: 14px;
  margin: 20px 0 10px 0;
  padding-bottom: 20px;
  font-weight: 700;
  flex: 1;
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};

  ${props => props.theme?.rtl
? css`
    margin-left: 10px;
  `
: css`
    margin-right: 10px;
  `}
`

export const LeftHeader = styled.div`
  display: flex;
  align-items: center;
`

export const RightHeader = styled.div`
  display: flex;
  align-items: center;

  button.sync-button {
    min-width: 100px;
    margin-left: 10px;
  }
`

const BusinessHeaderStyled = styled.div`
  background: #CCC;
  width: 100%;
  box-sizing: border-box;
  position: relative;
  background-repeat: no-repeat, repeat;
  background-size: cover;
  object-fit: cover;
  background-position: center;
  height: 150px;
  border-radius: 8px;
  margin-top: 20px;
  ${({ isSkeleton }) => isSkeleton && css`
    background: #E9ECEF;
  `}

  @media (min-width: 768px) {
    height: 180px;
  }
`

export const BusinessHeader = (props) => {
  const style = {}
  style.backgroundImage = `url(${props.bgimage})`

  return (
    <BusinessHeaderStyled {...props} style={style}>
      {props.children}
    </BusinessHeaderStyled>
  )
}

const BusinessLogoStyled = styled.div`
  display: flex;
  width: 60px;
  height: 60px;
  box-sizing: border-box;
  background-repeat: no-repeat, repeat;
  background-size: cover;
  object-fit: cover;
  background-position: center;
  min-height: 60px;
  border-radius: 8px;
  filter: drop-shadow(0px 1px 4px rgba(0, 0, 0, 0.1));
  position: absolute;
  bottom: -30px;
  ${props => props.theme?.rtl
? css`
    right: 20px;
  `
: css`
    left: 20px;
  `}
`

export const BusinessLogo = (props) => {
  const style = {}
  if (props.bgimage) {
    style.backgroundImage = `url(${props.bgimage})`
  }

  return (
    <BusinessLogoStyled {...props} style={style}>
      {props.children}
    </BusinessLogoStyled>
  )
}

export const BusinessDetailsContent = styled.div`
  margin-top: 50px;

  ${({ fromSalesChannels }) => fromSalesChannels && css`
    margin-top: 20px;
  `}

  > button {
    height: 42px;
  }

  .daily-wrap {
    display: flex;
    padding-left: 40px;
    padding-bottom: 10px;
    border-bottom: 1px solid ${props => props.theme.colors.borderColor};

    input {
      padding: 10px 15px;
      background-color: ${props => props.theme.colors.secundary};
      border: none;
      border-radius: 8px;
    }
  }

  .weekly-wrap {
    display: flex;
    justify-content: space-between;
    padding-bottom: 10px;
    border-bottom: 1px solid ${props => props.theme.colors.borderColor};

    > label {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      > div {
        text-align: center;
      }
      input {
        width: 20px;
        height: 20px;
      }
    }
    > input {
      padding: 10px 15px;
      background-color: ${props => props.theme.colors.secundary};
      border: none;
      border-radius: 8px;
    }
  }

  .monthly-wrap {
    display: flex;
    padding-bottom: 10px;
    border-bottom: 1px solid ${props => props.theme.colors.borderColor};

    > label {
      padding: 10px;
      margin: 0;
    }

    > input, select {
      margin-right: 20px;
      padding: 10px 15px;
      background-color: ${props => props.theme.colors.secundary};
      border: none;
      border-radius: 8px;
    }
  }

  .connect-pos-wrapper {
    display: flex;
    justify-content: space-between;
    ${({ hasIntegration }) => hasIntegration && css`
      cursor: pointer;
    `}

    ${({ fromSalesChannels }) => fromSalesChannels && css`
      padding-bottom: 20px;
      margin-bottom: 0px;
      border-bottom: 1px solid ${props => props.theme.colors.borderColor};
    `}

    button {
      min-height: 40px;
    }

    .connect-pos {
      display: flex;
      align-items: center;

      img {
        border-radius: 10px;
        width: 40px;
        height: 40px;
      }

      img.setup-call-logo {
        width: 100px;
        height: auto;
        object-fit: contain;
        border-radius: 0;
      }
      p {
        margin: 0 0 0 10px;
      }
    }
  }
`

export const MenuStatusWrapper = styled.div`
  padding: 15px 0;
  display: flex;
  align-items: center;
  cursor: pointer;

  > span {
    font-size: 14px;
    ${props => props.theme?.rtl
? css`
      margin-right: 15px;
    `
: css`
      margin-left: 15px;
    `}
  }
`

export const RadioButton = styled.div`
  svg {
    font-size: 16px;
    color: ${props => props.theme.colors.secundaryLight};
  }

  ${({ active }) => active && css`
    svg {
      color: ${props => props.theme.colors.primary};
    }
  `}
`

export const BusinessDescription = styled.p`
  color: ${props => props.theme.colors.headingColor};
  margin: 25px 0;
`

export const BusinessConfigsContainer = styled.div`
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 8px;
  margin-bottom: 50px;
  overflow: hidden;
  ${({ isLoading }) => isLoading && css`
    pointer-events: none;
  `}

  > div:first-child {
    border-top: none !important;
  }

  > div:last-child {
    border-bottom: none !important;
  }
`

export const BusinessConfigItem = styled.div`
  cursor: pointer;
  padding: 10px 15px;
  display: flex;
  justify-content: space-between;
  color: ${props => props.theme.colors.lightGray};
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};

  &:hover {
    background-color: ${props => props.theme.colors.lightPrimary};
  }
  span {
    font-size: 14px;
  }

  ${({ active }) => active && css`
    color: ${props => props.theme.colors.headingColor};
    border-top: 1px solid ${props => props.theme.colors.primary};
    border-bottom: 1px solid ${props => props.theme.colors.primary} !important;
    background-color: ${props => props.theme.colors.lightPrimary};
  `}

  svg {
    font-size: 20px;
  }
`

export const ActionSelectorWrapper = styled.div`
  button {
    background: transparent !important;
    border: none;
    padding: 0px 5px;
    &:active,
    &:focus {
      border-color: unset !important;
      box-shadow: none !important;
    }
    svg {
      color: ${props => props.theme.colors.headingColor};
      font-size: 20px;
    }

    &:after {
      display: none;
    }

    &:hover {
      background: ${props => darken(0.04, props.theme.colors.secundary)} !important;
    }
    &:active {
      background: ${props => darken(0.1, props.theme.colors.secundary)} !important;
    }
  }

  .show {
    button {
      background: ${props => darken(0.04, props.theme.colors.secundary)} !important;
    }
    >div {
      border: 1px solid ${props => props.theme.colors.borderColor};
      box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.12);
    }
  }

  > div {
    > div {
      border-radius: 8px;
      .dropdown-item {
        font-size: 12px;
        color: ${props => props.theme.colors.headingColor};
        &:active {
          background: ${props => darken(0.1, props.theme.colors.secundary)} !important;
        }
      }
      .dropdown-item:last-child {
        color: #E63757;
      }
    }
  }
`

export const ButtonWrapper = styled.div`
  display: flex;
  > button:first-child, > a:first-child {
    margin-right: 15px;
  }
  .redirect-website {
    margin: auto;
  }
  ${({ flexEnd }) => flexEnd && css`
    display: flex;
    justify-content: flex-end;
    margin: -40px 0 10px 0;
  `}
`
