import React from 'react'
import styled, { css } from 'styled-components'
import { lighten } from 'polished'

export const Container = styled.div`
  display: flex;
  width: 0;
  position: fixed;
  box-shadow: ${props => props.theme?.ordering?.shadow?.[2] ?? '0px 8px 35px rgba(0, 0, 0, 0.16)'};

  ${({ isSelectedOrders }) => isSelectedOrders && css`
    box-shadow: none;
    border-inline-start: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors.borderColor};
  `}
  background: ${props => props.theme?.ordering?.semantic?.surface?.default ?? props.theme.colors?.backgroundPage ?? '#FFF'};
  height: calc(var(--vh, 1vh) * 100);
  inset-block-start: 0px;
  z-index: calc(var(--od-x-layer-chrome) + 1);
  overflow-x: hidden;
  ${({ noAnimation }) => !noAnimation && css`
    transition: 0.3s;
  `}

  inset-inline-end: var(--assistant-offset, 0px);
  @media print {
    box-shadow: none;
  }
`

export const SkeletonWrapper = styled.div`
  width: 100%;
  padding: 20px;
  box-sizing: border-box;
  flex-direction: column;
  > span {
    width: 100%;
  }
`

export const OrderDetailsContent = styled.div`
  padding: 30px 20px;
  box-sizing: border-box;
  width: 100%;
  overflow-x: hidden;

  ${({ noScroll }) => noScroll && css`
    overflow: hidden;
  `}
`

export const OrderDetailsExtraContent = styled.div`
  max-width: 600px;
  position: relative;
  padding: 30px 20px;
  box-sizing: border-box;
  width: 100%;

  border-inline-start: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? '#E9ECEF'};
`

export const ChatContainer = styled.div`
  border: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors.borderColor};
  border-radius: 8px;
  margin-top: 40px;
  height: calc(100% - 40px);
  overflow: hidden;
`

export const ButtonLink = styled.button.attrs({ type: 'button' })`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  cursor: pointer;
  padding: 5px;
  margin: 0 5px;
  border: 0;
  background: transparent;

  &:hover {
    background-color: ${props => props.theme?.ordering?.semantic?.action?.soft ?? props.theme.colors?.secundary};
    border-radius: 5px;
  }

  &:focus-visible {
    outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.focus ?? props.theme.colors?.primary};
    outline-offset: 2px;
  }

  svg {
    color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors?.secundaryContrast};
    font-size: 24px;
  }
`

export const OrderStatus = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px 16px;
  margin: ${({ noMargin }) => noMargin ? '0px' : '20px 0'};

  h2 {
    color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};
    margin: 0px;
    font-size: var(--od-type-section-title-size);
  }

  p {
    color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};
    font-size: var(--od-type-content-size);
    margin: 0px;
  }


  ${({ isDisabled }) => isDisabled && css`
    pointer-events: none;
  `}

  @media (min-width: 768px) {
    flex-direction: row;
    align-items: center;
    justify-content: ${({ flexEnd }) => flexEnd ? 'flex-end' : 'space-between'};
  }
`
export const OrderStatusSelectorWrapper = styled.div`
  width: 45%;
  > div {
    > div:first-child {
      border-color: ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors?.secundary};
      border-radius: 8px;
      background-color: ${props => props.theme?.ordering?.semantic?.surface?.subtle ?? props.theme.colors?.secundary};
      > div:first-child {
        padding-top: 5px;
        padding-bottom: 5px;
        > div:first-child {
          > div {
            border: none !important;
            p {
              color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor} !important;
              padding: 0 !important;
            }
          }
        }
      }
    }

    .list-wrapper {
      > div {
        padding: 0 10px;
      }
    }
  }
`

export const StatusBarContainer = styled.div`
`

const StatusBarStyled = styled.div`
  height: 10px;
  border-radius: 10px;
  background: ${props => `linear-gradient(to ${props.theme?.rtl ? 'left' : 'right'}, ${props.theme?.ordering?.actionOverride ?? props.theme?.ordering?.semantic?.action?.default ?? props.theme.colors.primary} ${props.percentage}%, ${props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors.borderColor} ${props.percentage}%)`};
`

export const StatusBar = (props) => {
  return (
    <StatusBarStyled
      {...props}
    >
      {props.children}
    </StatusBarStyled>
  )
}

export const AdvancedLogistic = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 20px 0;

  > div {
    p {
      color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};
      margin: 0px;

      &:first-child {
        font-weight: 500;
        font-size: var(--od-type-content-size);
      }
      &:not(:first-child) {
        font-size: var(--od-type-secondary-size);
        color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors.lightGray};
      }
    }
  }
`
export const OrderProducts = styled.div`
  padding: 10px 0 10px 0;
  border-bottom: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? '#E9ECEF'};
  h2 {
    color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};
    font-size: var(--od-type-section-title-size);
  }
`

export const CloseButtonWrapper = styled.div`
  width: fit-content;
  cursor: pointer;
  z-index: var(--od-x-layer-sticky);
  position: absolute;
  inset-block-start: 30px;
  inset-inline-end: 20px;
`

export const PlaceSpotContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 10px 0;

  p {
    color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};
    font-size: var(--od-type-content-size);
    margin: 0px;
  }
`
export const RejectReasonsContainer = styled.div`
  > p {
    font-size: var(--od-type-content-size);
    line-height: 21px;
    font-weight: 500;
    margin: 0;
  }
`
export const RejectReasonsList = styled.div`
  display: flex;
  flex-wrap: wrap;
  width: calc(100% + 10px);
  margin-inline-start: -5px;
  margin-top: 10px;
`
export const RejectReasonWrapper = styled.div`
  padding: 4px 10px;
  border-radius: 50px;
  font-size: var(--od-type-secondary-size);
  line-height: 18px;
  margin: 5px;
  width: fit-content;
  background-color: ${props => props.theme?.ordering?.semantic?.state?.danger?.soft ?? lighten(0.4, props.theme.colors.danger)};
  color: ${props => props.theme?.ordering?.semantic?.state?.danger?.functional ?? props.theme.colors.danger};
`

export const DetailBottom = styled.div`
  height: 20px;
`

export const FormControl = styled.div`
  label {
    margin-bottom: 10px;
    font-size: var(--od-type-control-size);
  }
  textarea {
    width: 100%;
  }
  ${({ isError }) => isError && css`
    textarea {
      border: 1px solid ${props => props.theme?.ordering?.semantic?.state?.danger?.signal ?? props.theme.colors.danger};
      &:focus {
        border: 1px solid ${props => props.theme?.ordering?.semantic?.state?.danger?.signal ?? props.theme.colors.danger};
      }
    }
  `}
`

export const AssigmentCommentContainer = styled.form`
  button {
    width: 100%;
    border-radius: 8px;
    height: 44px;
    margin-top: 30px;
  }
`

export const ErrorMessage = styled.div`
  color: ${props => props.theme?.ordering?.semantic?.state?.danger?.functional ?? props.theme.colors.danger};
  font-size: var(--od-type-content-size);
`

export const OrderStatusTime = styled.div`

`

const getForterColor = (status) => {
  switch (status) {
    case 'valid': return '#28a745'
    case 'invalid': return '#dc3545'
    case 'error': return '#fd7e14'
    default: return 'transparent'
  }
}

export const ForterDecisionContainer = styled.div`
  margin: 10px 0;

  span {
    font-size: var(--od-type-content-size);
    font-weight: 600;
    color: ${({ status }) => getForterColor(status)};
  }

  p {
    font-size: var(--od-type-secondary-size);
    color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors?.lightGray};
    margin: 4px 0 0 0;
  }
`
