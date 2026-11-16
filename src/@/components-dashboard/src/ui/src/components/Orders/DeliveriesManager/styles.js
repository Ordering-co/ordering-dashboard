import styled from 'styled-components'

// redesign deliveries F2-B3 (DV-01): the page is a column (head, notice, board) as tall as the SplitView list cell it sits in; the board
// takes what is left from 1024px, so #deliveryDashboard does not overflow and there is no second scroll. Below 1024px the board has the
// height of its content and the page scrolls, as a phone page does.
export const DeliveriesContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-inline-size: 0;
  block-size: 100%;
  transition: all ${props => props.theme?.ordering?.motion?.duration?.slow ?? '0.5s'};
  padding: 20px;
  box-sizing: border-box;
  overflow: auto;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  @media print {
    display: none;
  }
`
export const OrdersContent = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1 0 auto;
  min-inline-size: 0;

  @media (min-width: 1024px) {
    flex: 1 1 0;
    min-block-size: 0;
  }
`
export const WrapItemView = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  width: 100%;
  min-inline-size: 0;

  @media (min-width: 1024px) {
    min-block-size: 0;
  }
`
