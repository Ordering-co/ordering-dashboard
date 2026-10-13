import styled, { css } from 'styled-components'

export const OptionStripeContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;

  a.Link {
    color: #0074d4;
    cursor: default;
    text-decoration: none;
    background-color: transparent;
    margin-bottom: 10px;

    span.Text {
      color: hsla(0,0%,10%,.5);
      font-size: 12px;
      font-weight: 400;
      margin: 0;
      cursor: default;
    }

    svg {
      fill: hsla(0,0%,10%,.4);
      transform: translateY(1.5px);
      vertical-align: text-bottom;
      height: 16px;
      color: hsla(0,0%,10%,.5);
      font-weight: 400;
      font-size: 12px;
      cursor: default;
    }
  }
`

export const WarningMessage = styled.p`
  color: #D81212;
  font-size: 24px;
  padding-left: 10px;
  font-weight: bold;
  opacity: 0.8;
  ${props => props.theme?.rtl && css`
    padding-right: 10px;
    padding-left: 0;
  `}
`

export const CardItem = styled.div`
  width: 100%;
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border: 1px solid ${props => props.theme.colors.gray200};
  border-radius: 8px;
  margin-top: 10px;

  ${({ isCursor }) => isCursor && css`
    cursor: pointer;
  `}

  ${({ isSelected }) => isSelected && css`
    background-color: ${props => props.theme.colors.gray200};
  `}

`

export const CardItemContent = styled.div`
  display: flex;
  align-items: center;
  margin-left: 10px;

  > div {
    display: flex;
    align-items: center;
    margin-right: 13px;
    ${props => props.theme?.rtl && css`
      margin-left: 13px;
      margin-right: 0;
    `}

    img {
      width: 24px;
      height: 20px;
    }
  }

  span {
    font-size: 14px;
    color: ${props => props.theme?.colors.headingColor};
  }
`

export const CardItemActions = styled.div`
  display: flex;
  align-items: center;

  > span {
    font-weight: 600;
    font-size: 12px;
    color: ${props => props.theme?.colors.headingColor};
    margin-right: 20px;
    ${props => props.theme?.rtl && css`
      margin-left: 20px;
      margin-right: 0;
    `}
  }
`

export const BlockLoading = styled.div`
  width: 100%;
  margin-bottom: 10px;
`

export const AddNewCard = styled.div`
  span {
    font-size: 14px;
    color: ${props => props.theme?.colors.primary};
    cursor: pointer;
    user-select: none;
  }
`

export const CardItemActionsWrapper = styled.div`
  position: relative;
  span {
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 7.6px;
    cursor: pointer;
    width: 26px;
    height: 24px;
    transition: all 0.3s;

    svg {
      font-size: 20px;
      color: #212121;
    }

    &:hover {
      background: #F8F9FA;
    }
  }
`

export const ActionsContent = styled.div`
  position: absolute;
  z-index: 10;
  top: 100%;
  background: #FFFFFF;
  border: 1px solid #E9ECEF;
  box-sizing: border-box;
  box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.12);
  border-radius: 7.6px;
  overflow: hidden;
  ${props => props.theme?.rtl
? css`
    left: 0;
  `
: css`
    right: 0;
  `}

  div {
    padding: 10px 13px;
    font-size: 14px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.3s;
    color: ${props => props.theme?.colors.headingColor};

    &:hover {
      background: #f8f9fa;
    }

    &.delete {
      color: #E63757;
    }
  }
`

export const CardInputWrapper = styled.div`
  border: 1px solid ${props => props.theme.colors.gray300};
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 15px;
`

export const ErrorMessage = styled.div`
  font-size: 16px;
  font-weight: bold;
  margin-top: 10px;
  margin-bottom: 20px;
  color: #D81212;
  margin: 10px 0px 0px 10px;
  ${props => props.theme?.rtl && css`
    margin: 10px 10px 0px 0px
  `}
`
