import styled, { css } from 'styled-components'

export const OptionStripeContainer = styled.div`
  display: flex;
  flex-direction: column;
`

export const WarningMessage = styled.p`
  color: #D81212;
  font-size: var(--od-type-content-size);
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
  border-bottom: 1px solid #EAEAEA;
  ${({ isCursor }) => isCursor && css`
    cursor: pointer;

    &:hover {
      background-color: #F8F9FA;
    }
  `}

  ${({ invalid }) => invalid && css`
    opacity: 0.7;
  `}
`

export const CardItemContent = styled.button.attrs({ type: 'button' })`
  display: flex;
  align-items: center;
  flex: 1;
  min-height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  text-align: start;
  font: inherit;
  color: inherit;
  cursor: pointer;

  &:disabled {
    cursor: default;
  }
  
  .checks svg {
    color: ${props => props.theme.colors.primary};
    font-size: 22px;
  }

  > span.brand {
    display: flex;
    align-items: center;
    margin: 0 13px 0 5px;
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
  span.missing-zipcode {
    margin-left: 20px;
    color: ${({ theme }) => theme?.colors?.danger500};
  }
`

export const CardItemActions = styled.div`
  display: flex;
  align-items: center;

  > span {
    font-weight: 600;
    font-size: var(--od-type-secondary-size);
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
  button, span {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0;
    border: 0;
    background: transparent;
    font: inherit;
    font-size: var(--od-type-control-size);
    color: ${props => props.theme?.colors.primary};
    cursor: pointer;
    user-select: none;
  }
`

export const CardItemActionsWrapper = styled.div`
  position: relative;
  button {
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 7.6px;
    cursor: pointer;
    min-width: 44px;
    min-height: 44px;
    padding: 0;
    border: 0;
    background: transparent;
    transition: all 0.3s;

    svg {
      font-size: 20px;
      color: #212121;
    }

    &:hover {
      background: #F8F9FA;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    button {
      transition: none;
    }
  }
`

export const ActionsContent = styled.div`
  position: absolute;
  z-index: 10;
  top: 100%;
  background: ${({ theme }) => theme?.ordering?.semantic?.surface?.default ?? theme?.colors?.backgroundPage ?? '#FFFFFF'};
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
    font-size: var(--od-type-control-size);
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
