import styled, { css } from 'styled-components'

import { getOrderingAction } from '~/brand/adapter'

export const WrapperNoneOrders = styled.div`
  overflow: auto;

  `
export const InnerNoneOrdersContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 15px;
  img {
    width: 250px;
  }

  p {
    font-size: var(--od-type-content-size);
    margin: 0px 0 40px 0;
  }

  button {
    height: 44px;
  }

  ${({ small }) => small && css`
    img {
      width: 150px;
    }
  `}

  @media (min-width: 768px) {
    img {
      width: 305px;
    }
    ${({ small }) => small && css`
      img {
        width: 250px;
      }
    `}
  }
`

export const WrapperOrderListContent = styled.div`
  ${({ maxHeight }) => maxHeight && css`
    height: 100%;
  `}
`

export const InfoMessage = styled.div`
  display: flex;
  align-items: center;
  z-index: var(--od-x-layer-sticky);
  bottom: 40px;
  background: ${props => props.theme?.ordering?.semantic?.action?.soft ?? props.theme.colors.backgroundInfo};
  border: 1px solid ${props => getOrderingAction(props.theme) ?? props.theme.colors.info};
  box-shadow: ${props => props.theme?.ordering?.shadow?.[2] ?? '0px 4px 10px rgba(0, 0, 0, 0.12)'};
  border-radius: ${props => props.theme?.ordering?.radius?.component ?? '7.6px'};
  padding: 6px 15px;
  box-sizing: border-box;
  margin: 10px 0px 0px 0px !important;
  max-width: 300px;
  inset-inline-end: 0px;

  svg {
    font-size: 20px;
    color: ${props => props.theme?.ordering?.actionOverride ?? props.theme?.ordering?.semantic?.action?.content ?? props.theme.colors.info};
  }

  span {
    font-size: var(--od-type-secondary-size);
    line-height: 18px;
    color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};
    margin: 0 10px;
    flex: 1;
  }

  a {
    font-size: var(--od-type-control-size);
    color: ${props => props.theme?.ordering?.actionOverride ?? props.theme?.ordering?.semantic?.action?.content ?? props.theme.colors.primary};
    white-space: nowrap;
  }

  @media (min-width: 768px) {
    padding: 8px 20px;
    font-size: var(--od-type-content-size);
    line-height: 24px;
    inset-inline-end: ${({ isLateralBar, theme }) => (theme?.rtl || isLateralBar) ? '0px' : '270px'};
    ${({ isLateralBar }) => isLateralBar
? css`
      bottom: 40px;
    `
: css`
      bottom: 0;
    `}
    span {
      white-space: nowrap;
    }
  }
`

export const ColumnPopoverContainer = styled.div`
  position: relative;
  /* Only the trigger floats over the table header. Since the column rows became
     buttons (387aa99b) a bare \`button\` selector also took them out of the flow
     and collapsed the popover to 100×32px. */
  button[aria-expanded] {
    inset-inline-end: 0px;
    position: absolute;
    transform: translateY(-3px);
    /* Above the sticky table header (z-index 100), below the shell sidebar
       and drawers (1000): at 1000 it painted over the open mobile menu. */
    z-index: calc(var(--od-x-layer-sticky) + 1);
    background: ${props => props.theme?.ordering?.semantic?.surface?.default ?? 'white'};
    padding: 0 10px;
  }
`
