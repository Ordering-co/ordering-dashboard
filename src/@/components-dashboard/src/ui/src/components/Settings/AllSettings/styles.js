import styled, { css } from 'styled-components'

export const MainContainer = styled.div`
  flex: 1;
  box-sizing: border-box;
  transition: all 0.5s;
  max-height: 100vh;
  overflow: auto;
  padding: 25px 10px;
`

export const Container = styled.div`
  display: flex;
`

export const IconButton = styled.button`
  background-color: transparent;
  border: none;
  border-radius: 6px;
  height: 32px;
  padding: 0 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all .2s ease-in;
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  > svg {
    width: 20px;
    height: 20px;
    color: #B1BCCC;
  }

  &:hover {
    background-color: #1507260a;

    > svg {
      color:  #151b26;
    }
  }

  &:active {
    background-color: #1507261a;
  }

  ${({ color }) => color === 'black' && css`
    > svg {
      color: ${props => props.theme.colors.headingColor};
    }
    &:hover {
      background-color: ${props => props.theme.colors.secundary};
    }
    &:active {
      background-color: ${props => props.theme.colors.secundaryDarkContrast};
    }

    ${({ active }) => active && css`
      background-color: ${props => props.theme.colors.secundaryDarkContrast};
    `}
  `}

  ${({ color }) => color === 'primary' && css`
    > svg {
      color: ${props => props.theme.colors.primary};
    }
    &:hover {
      background-color: #1507260a;
      > svg {
        color: ${props => props.theme.colors.primary};
      }
    }
  `}
  ${({ isDisabled }) => isDisabled && css`
    pointer-events: none;
  `}
`

export const CategoryContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  width: -webkit-fill-available;
`

export const SkeletonWrapper = styled.div`
  padding-top: 10px;

  div {
    margin-bottom: 15px;
    span {
      margin-top: 5px;
    }
  }
`

export const HeaderTitleContainer = styled.div`
  display: flex;
  align-items: center;
  padding: 0px 10px;
  margin-bottom: 10px;

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
      margin-right: 0px;
    `
: css`
      margin-right: 8px;
      margin-left: 0px;
    `}

    svg {
      width: 25px;
      height: 25px;
    }
  }
`

export const IconWrapper = styled.div`
  background-color: ${props => props.theme.colors.secundary};
  border-radius: 8px;
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    font-size: 24px;
    color: ${props => props.theme.colors.secundaryLight};
  }
`

export const CategoryName = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;

  > p {
    font-weight: bold;
    font-size: 20px;
    margin-bottom: 0px;
    width: 100%;
  }
`

export const InfoWrapper = styled.div`
  position: relative;
  ${props => props.theme?.rtl
? css`
    margin-left: -8px;
    margin-right: 8px;
  `
: css`
    margin-right: -8px;
    margin-left: 8px;
  `}

  > button {
    height: 25px;
    svg {
      width: 16px;
      height: 16px;
    }
  }
  &:hover > div {
    /* display: block; */
    visibility: visible;
    opacity: 1;
  }
`

export const InfoContent = styled.div`
  position: absolute;
  top: 100%;
  z-index: 999;
  background: ${props => props.theme.colors.backgroundInfo};
  border: 1px solid ${props => props.theme.colors.primary};
  box-sizing: border-box;
  box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.12);
  border-radius: 7.6px;
  padding: 8px 12px;
  font-size: 12px;
  line-height: 18px;
  min-width: 150px;
  transition: all 0.3s linear;
  visibility: hidden;
  opacity: 0;
  right: 0px;
  ${props => props.theme.rtl && css`
    left: 0px;
    right: initial;
  `}

  @media (min-width: 576px) {
    min-width: 330px;
    padding: 12px 15px;
    left: 0px;
    ${props => props.theme.rtl && css`
      right: 0px;
      left: initial;
    `}
  }
`

export const MenuContainer = styled.div`
  margin: 5px 0;
  > span {
    font-weight: 500;
    font-size: 10px;
    line-height: 15px;
    padding: 0px 13px;
    color: ${props => props.theme.colors.lightGray};
  }
  > button {
    width: 100%;
    text-align: initial;
  }

  > span {
    font-weight: 500;
    font-size: 10px;
    line-height: 15px;
    padding: 20px;
    color: ${props => props.theme.colors.lightGray};
  }

  ${({ disabledFeature }) => disabledFeature && css`
    background-color: ${props => props.theme.colors.disabled};
    cursor: not-allowed;
    > button {
      pointer-events: none;
    }
  `}
`

export const MenuContent = styled.div`
  padding: 5px 0;
`

export const SubMenu = styled.div`
  cursor: pointer;
  padding: 5px 0;
  font-size: 14px;
  color: ${props => props.theme.colors.lightGray};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-radius: 8px;

  &:hover {
    background-color: ${props => props.theme.colors.lightPrimary};
  }

  ${({ active }) => active && css`
    color: ${props => props.theme.colors.primary};
  `}
  ${({ disabledFeature }) => disabledFeature && css`
    background-color: ${props => props.theme.colors.disabled}!important;
    cursor: not-allowed;
  `}

  ${props => props.theme?.rtl
? css`
    padding-right: 40px;
  `
: css`
    padding-left: 40px;
  `}
`

export const SidebarContent = styled.div`
  flex: 1;
  box-sizing: border-box;
  transition: 0.1s;
  width: 40%;
  min-width: 270px;

  button.btn-primary {
    background-color: ${props => props.theme.colors.primary};
  }

  button {
    display: flex;
    font-size: 14px;
    box-sizing: border-box;
    border-radius: 8px;
    font-weight: 500;
    &:hover {
      background-color: ${props => props.theme.colors.lightPrimary};
    }
    &.btn-primary {
      &:hover {
        background-color: ${props => props.theme.colors.primary};
      }
    }

    span {
      ${props => props.theme?.rtl
? css`
        margin-right: 15px;
      `
: css`
        margin-left: 15px;
      `}
    }

    svg {
      font-size: 20px;
    }
  }

  .accordion {
    padding: 10px;
    box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.12);
    border-radius: 7.6px;
  }
`

export const SidebarMainContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: auto;
`
