import styled, { css } from 'styled-components'
import { darken } from 'polished'

export const OrderDetailsHeaderContainer = styled.div`
  > div {
    display: flex;
    justify-content: space-between;
    flex-direction: column-reverse;
    h1 {
      width: 100%;
      font-size: 20px;
      margin: 0px;
      font-weight: 700;
      word-break: break-word;
    }
    h2 {
      width: 100%;
      font-size: 18px;
      margin: 0px;
      font-weight: 700;
      word-break: break-word;
    }
    > div {
      display: flex;
      width: 100%;
      justify-content: flex-end;
      margin-bottom: 20px;
    }
  }

  p {
    font-size: 14px;
    margin: 0px;
    padding: 5px 0;
  }

  @media (min-width: 768px) {
    > div {
      flex-direction: row;
      align-items: flex-start;
    }
    > div {
      > div {
        margin-bottom: 0px;
      }
    }
  }
`

export const ButtonGroup = styled.div`
  > button {
    position: relative;
    ${props => props.theme?.rtl
? css`
      margin-left: 8px;
    `
: css`
      margin-right: 8px;
    `}
    &:last-child {
      ${props => props.theme?.rtl
? css`
        margin-left: 0px;
      `
: css`
        margin-right: 0px;
      `}
    }
  }

  .clone {
    width: max-content;
  }
`

export const UreadMessageAlert = styled.span`
  position: absolute;
  top: -9px;

  ${props => props.theme?.rtl
? css`
    left: -13px;
  `
: css`
    right: -13px;
  `}
  svg {
    font-size: 40px;
    color: ${props => props.theme.colors.primary};
  }
`
export const StripeLink = styled.a`
  color: ${props => props.theme.colors.primary};
  &:hover {
    color: ${props => props.theme.colors.primary};
  }
`
export const PrinterSelectContainer = styled.div`
  position: relative;
  margin-right: 8px;
`

export const PrinterSelect = styled.div`
  position: absolute;
  right: 0;
  min-width: 220px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  z-index: 100;
  padding: 0.5rem 0;
  border: 1px solid ${props => props.theme.colors.borderColor};
  box-shadow: 0px 4px 10px rgba(0,0,0,0.12);
  z-index: 12;
  background-color: ${props => props.theme.colors.white};

  button {
    height: auto;
    padding: 0.25rem 1.5rem;
    font-size: 12px;
    border-radius: 0px;
    font-weight: 400;
    white-space: nowrap;
    color: ${props => props.theme.colors.headingColor};
    &:hover {
      background-color: #f5f5f5;
    }
  }
`

export const TicketSectionsFooter = styled.div`
  border-top: 1px solid ${props => props.theme.colors.borderColor};
  margin-top: 0.25rem;
  padding-top: 0.25rem;

  button {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    text-align: start;

    svg {
      width: 14px;
      height: 14px;
      flex: 0 0 auto;
    }
  }
`

export const TicketSectionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 4px 8px;
`

export const TicketSectionRow = styled.label`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 0;
  font-size: 14px;
  color: ${props => props.theme.colors.headingColor};
`

export const TicketSectionActions = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 16px;

  button {
    min-width: 220px;
    padding-left: 28px;
    padding-right: 28px;
  }
`

export const TicketSectionHint = styled.p`
  margin: 0 0 16px;
  font-size: 13px;
  color: ${props => props.theme.colors.lightGray};
`

export const ActionSelectorWrapper = styled.div`
  button {
    height: 32px;
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
