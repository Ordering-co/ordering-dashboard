import styled, { css } from 'styled-components'

export const OrdersListContainer = styled.div`
  flex: 1;
  padding: 20px;
  /* redesign AH: the top padding by name, for the sticky List / Map switch that gives it back (all-in-one-board.css) */
  --aio-scroll-pad-start: 20px;
  box-sizing: border-box;
  transition: all ${props => props.theme?.ordering?.motion?.duration?.slow ?? '0.5s'};
  overflow: auto;
  height: calc(var(--vh,1vh) * 100);
  ${({ isSelectedOrders }) => isSelectedOrders && css`
    margin-top: 0px;
    padding: 20px 0 0 0;
  `}

  /* redesign all-in-one B2 (decision 1, AIO-03): from 1024px the page is a column (head, notice, board) that does not scroll;
     the board takes what is left and the orders scroll inside it (all-in-one-board.css). Below, the page scrolls as before. */
  @media (min-width: 1024px) {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  @media print {
    display: none;
  }
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

// redesign all-in-one B2 (decision 1, AIO-08): MainContentContainer, TopContent, DriversContainer, OrdersContainer, WrapperDriversLocation,
// OrdersContent, OrdersInnerContent and WrapItemView are gone with the old layout (the grey 5px separators and the #orderTable cap of
// AIO-02); the board is laid out by all-in-one-board.css. The three below are pinned by the L3 ruleset and allInOne.r3.test.js.
export const OrderSubFilterControls = styled.div`
  display: flex;
  width: 100%;
  ${({ isColumn }) => isColumn
? css`
    flex-direction: column;
    > div:last-child {
      margin-top: 0;
      margin-bottom: 10px;
      > div {
        justify-content: space-between;
        width: 100%;
      }
    }
  `
: css`
    flex-direction: row;
    justify-content: space-between;
  `}

  /* redesign tramo A r3 (W0-QA1-02): on a phone the row wraps; the controls drop under the Status pill instead of sitting
     on top of it. Static on purpose: the guard of the L3 ruleset pins the text of the interpolation above. */
  @media (max-width: 767px) {
    flex-wrap: wrap;
    row-gap: 8px;
  }
`
export const OrderStatusSubFilterWrapper = styled.div`
  flex: 1;
  display: inline-block;
  min-width: 0;
  margin-inline-end: ${props => props.theme?.rtl ? '15px' : '20px'};
  ${({ isColumn }) => isColumn
? css`
    width: 100%;
  `
: css`
    width: 50%;
  `}

  /* redesign tramo A r3 (W0-QA1-02): the Status pill is never squeezed under the neighbouring controls. \`flex: 1\` gave the
     wrapper a basis of zero and it shrank to 38px while the pill, 84px wide, ran under «Create custom order». On a phone it
     keeps its basis (the width above) and never goes below its pill, and the row wraps (OrderSubFilterControls). */
  @media (max-width: 767px) {
    flex: 1 0 auto;
    min-width: fit-content;
  }
`
