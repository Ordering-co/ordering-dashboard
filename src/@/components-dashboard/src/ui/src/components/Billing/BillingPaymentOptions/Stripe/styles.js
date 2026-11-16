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
      font-size: var(--od-type-secondary-size);
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
    font-size: var(--od-type-content-size);
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
  /* redesign  (row 82): the ⋮ is a real button (reset to the former span look), so it takes Tab/Enter */
  > button {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    background: transparent;
    border-radius: 7.6px;
    cursor: pointer;
    width: 26px;
    height: 24px;
    transition: all 0.3s;

    &:focus-visible {
      outline: var(--od-focus-ring-width) solid var(--od-focus-ring-color);
      outline-offset: var(--od-x-focus-inset);
    }

    svg {
      font-size: 20px;
      color: #212121;
    }

    &:hover {
      background: #F8F9FA;
    }

    /* redesign  (batch O, row 19 a): 44px touch area without moving the layout. A centred ::after grows only the hit
       area, so the 26x24 box and the menu at top: 100% of the wrapper stay put. Mouse measures at 390px, hence max-width too. */
    @media (pointer: coarse), (max-width: 767px) {
      position: relative;

      &::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: max(100%, var(--od-touch-target-minimum, 44px));
        height: max(100%, var(--od-touch-target-minimum, 44px));
        transform: translate(-50%, -50%);
      }
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

  /* redesign  (row 82): the items are real buttons (role='menuitem'), reset to the former div look */
  button {
    display: block;
    width: 100%;
    padding: 10px 13px;
    border: 0;
    background: transparent;
    font-size: var(--od-type-control-size);
    text-align: start;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.3s;
    color: ${props => props.theme?.colors.headingColor};

    &:hover {
      background: #f8f9fa;
    }

    &:focus-visible {
      outline: var(--od-focus-ring-width) solid var(--od-focus-ring-color);
      outline-offset: var(--od-x-focus-inset);
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
  font-size: var(--od-type-content-size);
  font-weight: bold;
  margin-top: 10px;
  margin-bottom: 20px;
  color: #D81212;
  margin: 10px 0px 0px 10px;
  ${props => props.theme?.rtl && css`
    margin: 10px 10px 0px 0px
  `}
`
