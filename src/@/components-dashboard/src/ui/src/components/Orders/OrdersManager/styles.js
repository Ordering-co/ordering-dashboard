import styled, { css } from 'styled-components'

export const OrdersListContainer = styled.div`
  flex: 1;
  padding: 20px;
  box-sizing: border-box;
  transition: all 0.5s;
  overflow: auto;
  max-height: 100vh;
  ${({ isSelectedOrders }) => isSelectedOrders && css`
    margin-top: 0px;
    padding: 20px 0 0 0;
  `}
  /* redesign 5.6-B: on phones the page pads the list with the mobile gutter, so the hairlines of the
     order cards (they bleed out of that same gutter, order-card.css) reach the edges of the screen. After
     the lateral-bar override on purpose: a bar on a phone gets the gutter too. */
  @media (max-width: 767px) {
    padding-inline: var(--od-x-page-gutter-mobile);
  }
  @media print {
    display: none;
  }
`
export const OrdersContent = styled.div`
  margin-top: 10px;
`
export const OrdersInnerContent = styled.div`
`
export const WrapperIndicator = styled.div`
  position: fixed;
  bottom: 20px;
  inset-inline-end: 20px;
  width: 100px;
  height: 50px;
  border-radius: ${props => props.theme?.ordering?.radius?.component ?? '5px'};
  background: ${props => props.theme?.ordering?.semantic?.surface?.strong ?? '#151824'};
  z-index: calc(var(--od-x-layer-notice) - 20);
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${props => props.theme?.ordering?.semantic?.text?.inverse ?? '#fff'};
  font-weight: 500;
  font-size: var(--od-type-identifier-size);
  font-family: var(--od-type-identifier-font);
  font-variant-ligatures: var(--od-type-identifier-ligatures);
`

export const WrapItemView = styled.div`
  width: 100%;
`
export const OrderSubFilterControls = styled.div`
  flex-wrap: wrap;
  display: flex;
  justify-content: space-between;
  width: 100%;
  flex-direction: row;
  justify-content: space-between;
`
export const OrderStatusSubFilterWrapper = styled.div`
  width: 50%;
  display: inline-block;
  flex: 1;
  margin-inline-end: 20px;
`
