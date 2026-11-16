import styled, { css } from 'styled-components'

export const WrapperRow = styled.div`
  display: flex;
  width: 100%;
  align-items: center;
  padding-bottom: 0px;

  & > div {
    width: 100%;
    height: 47px;
    max-width: 1000px;
    margin-inline-end: 10px;
    background-color: ${props => props.theme?.ordering?.semantic?.surface?.subtle ?? props.theme.colors.secundary};
    border: none;
    font-size: var(--od-type-control-value-size);
    border-radius: ${props => props.theme?.ordering?.radius?.component ?? '8px'};
    > div:first-child {
      height: 100%;
    }
    @media (min-width: 798px) {
      max-width: 300px;
    }
  }

  .order-status-multi-select {
    p {
      padding: 0;
      color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor} !important;
    }
  }

  .date-filter-container {
    z-index: var(--od-x-layer-sticky);
  }

  input {
    width: 100%;
    height: 47px;
    padding-block: 10px;
    padding-inline: 25px;
    box-sizing: border-box;
    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    -moz-appearance: textfield;
  }

  .external_id {
    input {
      padding-inline-end: calc(var(--od-search-touch-target, 44px) + 16px);
    }

    > button.close {
      inset-inline-start: auto;
      inset-inline-end: 8px;
    }

    @media (max-width: 1200px) {
     flex: auto;
    }
  }

  @media (max-width: 798px) {
    flex-direction: column !important;
    padding-block: 10px 0;
    padding-inline: 0 15px;
    & > div {
      margin-top: 15px;
      max-width: calc(100% - 12px);
    }
  }

  ${({ isSelectedOrders }) => isSelectedOrders && css`
      flex-direction: column !important;
      & > div {
        margin-top: 15px;
        max-width: calc(100% - 12px);
      }
  `}
`
export const Option = styled.div`
  font-weight: 400;
  font-size: var(--od-type-control-value-size);
  line-height: 24px;
  color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors.secundaryContrast};
  display: flex;
  align-items: center;
  padding: 5px;
`
