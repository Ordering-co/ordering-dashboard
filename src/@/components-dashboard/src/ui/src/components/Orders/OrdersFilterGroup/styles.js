import styled, { css } from 'styled-components'

export const FilterGroupListContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  padding: 15px 20px;
  > h1 {
    font-size: var(--od-type-title-size);
    font-weight: 600;
    margin-top: 10px;
    margin-bottom: 30px;
  }

  & > div {
    width: 48%;
  }

  @media (max-width: 576px) {
    flex-direction: column;
    & > div {
      width: 100%;
    }
  }

  @media (min-width: 768px) {
    padding: 30px;
  }
`
export const WrapperRow = styled.div`
  display: flex;
  width: 100% !important;
  flex-direction: column;
  justify-content: space-between;

  & > div {
    width: 100%;
    height: 57px;
    margin-bottom: 20px;
    background-color: ${props => props.theme?.ordering?.semantic?.surface?.subtle ?? props.theme.colors.secundary};
    border: none;
    font-size: var(--od-type-control-value-size);
    border-radius: ${props => props.theme?.ordering?.radius?.component ?? '8px'};
    > div:first-child {
      height: 100%;
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

  > input {
    width: 100%;
    height: 57px;
    margin-bottom: 20px;
    padding: 10px 25px;
    box-sizing: border-box;
    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    -moz-appearance: textfield;
  }

  @media (min-width: 992px) {
    flex-direction: row;
    & > div {
      width: 48%;
    }

    > input {
      width: 48%;
    }
  }
`

export const MultiSelectContainer = styled.div`
  > div {
    width: 100%;
    border: none;

    > div:first-child {
      height: 54px;
      > div:first-child {
        padding: 5px;
        border: none;
      }
    }

    > div:not(:first-child) {
      > div {
        > div {
          > div {
            border: none;
          }
        }
      }
    }
  }
`

export const ButtonGroup = styled.div`
  display: flex;
  align-items: center;
  margin-top: 40px;

  button {
    padding-top: 5px;
    padding-bottom: 5px;

    &:last-child {
      margin-inline-start: 20px;
    }
  }
`

export const AddInputWrapper = styled.div`
  display: flex;
  align-items: center;
  background-color: transparent !important;
  input {
    flex: 1;
    height: 57px;
  }
  button {
    width: 30px;
    height: 30px;
    margin-inline-start: 10px;
  }
`

export const AddMetaFiled = styled.button.attrs({ type: 'button' })`
  font-size: var(--od-type-control-size);
  color: ${props => props.theme?.ordering?.actionOverride ?? props.theme?.ordering?.semantic?.action?.content ?? props.theme.colors.primary};
  cursor: pointer;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  text-align: start;

  &:focus-visible {
    outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.focus ?? props.theme.colors.primary};
    outline-offset: 2px;
  }

  @media (pointer: coarse) {
    min-height: 44px;
  }
`

export const SelectWrapper = styled.div`
    > div {
    width: 100%;
    border: none;
    height: 100%;

    > div:first-child {
      height: 100%;
      background-color: ${props => props.theme?.ordering?.semantic?.surface?.subtle ?? props.theme.colors.secundary};
      border: none;
      border-radius: ${props => props.theme?.ordering?.radius?.control ?? '7.6px'};
      font-weight: 400;
      font-size: var(--od-type-control-value-size);
      line-height: 24px;
      padding-inline-start: 20px;
    }
    .list {
      background-color: ${props => props.theme?.ordering?.semantic?.surface?.subtle ?? props.theme.colors.secundary};
      border: none;
      
      .list-wrapper {
        > div {
          padding: 6px 10px;
          &:hover {
            background-color: ${props => props.theme?.ordering?.semantic?.surface?.default ?? '#f2f5f7'};
          }
        }
      }
    }
  }
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
export const WarningMessage = styled.div`
  position: absolute;
  display: flex;
  align-items: center;
  z-index: var(--od-x-layer-sticky);
  bottom: 40px;
  background: ${props => props.theme?.ordering?.semantic?.state?.warning?.soft ?? props.theme.colors.warning100};
  border: 1px solid ${props => props.theme?.ordering?.semantic?.state?.warning?.signal ?? props.theme.colors.warning};
  box-shadow: ${props => props.theme?.ordering?.shadow?.[2] ?? '0px 4px 10px rgba(0, 0, 0, 0.12)'};
  border-radius: ${props => props.theme?.ordering?.radius?.component ?? '7.6px'};
  padding: 0px 15px;
  box-sizing: border-box;
  margin: 10px 0px 0px 0px !important;

  inset-inline-end: 0px;

  svg {
    font-size: 20px;
    color: ${props => props.theme?.ordering?.semantic?.state?.warning?.functional ?? props.theme.colors.warning};
  }

  span {
    font-size: var(--od-type-secondary-size);
    line-height: 18px;
    color: ${props => props.theme?.ordering?.semantic?.state?.warning?.functional ?? props.theme.colors.headingColor};
    margin: 0 10px;
    flex: 1;
  }

  a {
    font-size: var(--od-type-control-size);
    white-space: nowrap;
  }

  @media (min-width: 768px) {
    padding: 0px 20px;
    font-size: var(--od-type-content-size);
    line-height: 24px;
    ${({ isLateralBar }) => isLateralBar
? css`
      bottom: -25px;
    `
: css`
      bottom: -20px;
    `}
    span {
      white-space: nowrap;
    }
  }
`
