import styled from 'styled-components'

// redesign deliveries F2-B3 (DV-01, DV-04, DV-05): the layout of the board (the page column, the 400 / 440 / 480px list, the List | Map
// switch, the height the page leaves) lives in delivery-board.css, in tokens. What stays here is the frame of the list column and its tabs.
export const DeliveryDashboardContainer = styled.div`
`

// redesign deliveries R1 fix (Q-02): the tabs and the toggles sit above the scrolling cards (the cards scroll in #cardOrders), so this
// head is no longer sticky and opens no stacking context: a z-index of 100 here covered the SLA menu's lower items.
export const FilterContainer = styled.div`
  background: ${props => props.theme?.ordering?.semantic?.surface?.default ?? props.theme.colors?.backgroundPage ?? '#FFF'};
  padding: 0 12px;
`

export const OrdersContainer = styled.div`
  border: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors.borderColor};
  border-radius: ${props => props.theme?.ordering?.radius?.panel ?? '8px'};
  overflow: hidden;
`

export const WrapperOrderlist = styled.div`
`

export const WrapperDeliveriesLocation = styled.div`
  border-radius: ${props => props.theme?.ordering?.radius?.panel ?? '8px'};
  overflow: hidden;
`
