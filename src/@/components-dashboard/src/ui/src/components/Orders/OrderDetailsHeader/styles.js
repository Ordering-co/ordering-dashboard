import styled from 'styled-components'

export const OrderDetailsHeaderContainer = styled.div`
  > div {
    display: flex;
    justify-content: space-between;
    flex-direction: column-reverse;
    h1 {
      width: 100%;
      font-size: var(--od-type-title-size);
      margin: 0px;
      font-weight: 700;
      word-break: break-word;
      color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};
    }
    h2 {
      width: 100%;
      font-size: var(--od-type-section-title-size);
      margin: 0px;
      font-weight: 700;
      word-break: break-word;
      color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};
    }
    > div {
      display: flex;
      width: 100%;
      justify-content: flex-end;
      margin-bottom: 20px;
    }
  }

  p {
    font-size: var(--od-type-content-size);
    margin: 0px;
    padding: 5px 0;
    color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors?.headingColor};
  }

  .order-identifier {
    font-size: var(--od-type-identifier-size);
    font-family: var(--od-type-identifier-font);
    font-variant-ligatures: var(--od-type-identifier-ligatures);
    direction: ltr;
    unicode-bidi: isolate;
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
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;

  > button,
  > div {
    position: relative;
  }

  .clone {
    width: max-content;
  }
`

export const UreadMessageAlert = styled.span`
  position: absolute;
  inset-block-start: -9px;
  inset-inline-end: -13px;
  svg {
    font-size: 40px;
    color: ${props => props.theme?.ordering?.actionOverride ?? props.theme?.ordering?.semantic?.action?.default ?? props.theme.colors.primary};
  }
`
export const StripeLink = styled.a`
  color: ${props => props.theme?.ordering?.actionOverride ?? props.theme?.ordering?.semantic?.action?.content ?? props.theme.colors.primary};
  &:hover {
    color: ${props => props.theme?.ordering?.actionOverride ?? props.theme?.ordering?.semantic?.action?.hover ?? props.theme.colors.primary};
  }
`
export const PrinterSelectContainer = styled.div`
  position: relative;
`

export const PrinterSelect = styled.div`
  position: absolute;
  inset-inline-end: 0;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  z-index: var(--od-x-layer-sticky);
  padding: 0.5rem 0;
  border: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors.borderColor};
  box-shadow: ${props => props.theme?.ordering?.shadow?.[2] ?? '0px 4px 10px rgba(0,0,0,0.12)'};
  z-index: 12;
  background-color: ${props => props.theme?.ordering?.semantic?.surface?.default ?? props.theme.colors.white};

  button {
    min-height: 44px;
    padding: 0.25rem 1.5rem;
    font-size: var(--od-type-control-size);
    border-radius: 0px;
    font-weight: 400;
    color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};
    &:hover {
      background-color: ${props => props.theme?.ordering?.semantic?.action?.soft ?? '#f5f5f5'};
    }
    &:focus-visible {
      outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.focus ?? props.theme.colors.primary};
      outline-offset: -2px;
    }
  }
`

export const ActionSelectorWrapper = styled.div`
  button {
    min-width: 44px;
    height: 44px;
    background: transparent !important;
    border: none;
    padding: 0px 5px;
    &:active {
      border-color: unset !important;
      box-shadow: none !important;
    }
    &:focus-visible {
      outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.focus ?? props.theme.colors.primary} !important;
      outline-offset: 2px;
      box-shadow: none !important;
    }
    svg {
      color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};
      font-size: 20px;
    }

    &:after {
      display: none;
    }

    &:hover {
      background: ${props => props.theme?.ordering?.semantic?.action?.soft ?? props.theme.colors.secundary} !important;
    }
    &:active {
      background: ${props => props.theme?.ordering?.semantic?.action?.soft ?? props.theme.colors.secundary} !important;
    }
  }

  .show {
    button {
      background: ${props => props.theme?.ordering?.semantic?.action?.soft ?? props.theme.colors.secundary} !important;
    }
    >div {
      border: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors.borderColor};
      box-shadow: ${props => props.theme?.ordering?.shadow?.[2] ?? '0px 4px 10px rgba(0, 0, 0, 0.12)'};
      background: ${props => props.theme?.ordering?.semantic?.surface?.default ?? props.theme.colors.white};
    }
  }

  > div {
    > div {
      border-radius: 8px;
      .dropdown-item {
        display: flex;
        align-items: center;
        min-height: 44px;
        font-size: var(--od-type-control-size);
        color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};
        &:active {
          background: ${props => props.theme?.ordering?.semantic?.action?.soft ?? props.theme.colors.secundary} !important;
        }
      }
      .dropdown-item:last-child {
        color: ${props => props.theme?.ordering?.semantic?.state?.danger?.functional ?? '#E63757'};
      }
    }
  }
`
