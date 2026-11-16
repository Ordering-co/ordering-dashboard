import styled, { css } from 'styled-components'

import { getOrderingAction } from '~/brand/adapter'

// redesign deliveries F2-B1 (decision 4): the dispatch card no longer uses OrderCard, OrderSelectButton, CardHeading, OrderHeader, Timer,
// ViewDetails, InfoItemContainer, WrapperImage, CardContent, UnreadMessageCounter or Timestatus: it is drawn by delivery-card.css (tokens only).
// OrdersListContainer and WrapperPagination are still the list and the pager. The rest stays only because l3-orders-list-typography-rules.json,
// l3-orders-list-guard-rules.json and scripts/brand-system/harness/orders-list-styles.jsx still pin and import it (outside B1's files): remove
// them together with those entries.

export const OrdersListContainer = styled.div`
  height: calc(100% - 200px);
  padding: 0 12px 15px 12px;
  box-sizing: border-box;
  overflow-x: hidden;

  @media (min-width: 1024px) and (max-width: 1300px) {
    height: calc(100% - 230px);
  }
`
export const OrderNunberContainer = styled.div`

`
// redesign W1-3 (T1-3-4, W1-A0-02): the compact card. The padding and the gap come from the product spacing scale (the density of
// RecordCard); the selection is OrderSelectButton, which covers the card, and the controls inside sit above it.
export const OrderCard = styled.div`
  position: relative;
  display: grid;
  gap: var(--od-space-1);
  min-width: 0;
  border-radius: ${props => props.theme?.ordering?.radius?.panel ?? '8px'};
  border: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors?.secundary};
  margin-bottom: var(--od-space-2);
  padding: var(--od-x-space-2-5) var(--od-space-3);
  padding-inline-start: var(--od-space-5);

  &:hover:not([data-skeleton]) {
    background-color: ${props => props.theme?.ordering?.semantic?.action?.soft ?? props.theme.colors.lightPrimary};
  }

  /* redesign tramo B r1 fixes (W1-QB1-03, W1-PB1-02): the mouse acts on the card itself, as in main */
  &:not([data-skeleton]) {
    cursor: pointer;
  }

  ${({ active }) => active && css`
    background-color: ${props => props.theme?.ordering?.semantic?.action?.soft ?? props.theme.colors.lightPrimary};
    border: 1px solid ${props => getOrderingAction(props.theme) ?? props.theme.colors.primary};
  `}

  p,
  h2 {
    color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};
    margin: 0px;
  }
  
  /* redesign W1-3 (W1-D-1, decision 11): the heading is in the interface font; only the figure (.odc-mono) is in mono */
  h2 {
    font-size: var(--od-type-identifier-size);
    font-weight: 600;
  }
`

// The selection of the card for the map, for the keyboard and for assistive technology: a pressed button laid over the card (the
// pattern of DriverSelectButton) that the pointer goes through. The mouse and the touch act on the card (OrdersCards handles
// that click), so the text stays selectable and copyable as in main.
// redesign tramo B r1 fixes (W1-QB1-03, W1-PB1-02): it used to take the pointer and cover the text.
export const OrderSelectButton = styled.button`
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  min-height: 100%;
  padding: 0;
  border: 0;
  border-radius: inherit;
  background: transparent;
  pointer-events: none;

  &:focus-visible {
    outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.focus ?? getOrderingAction(props.theme)};
    outline-offset: 2px;
  }
`

// First row: the number, the timer and «View details».
export const CardHeading = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: var(--od-space-3);
  min-width: 0;

  h2 {
    flex: 1 1 auto;
    min-width: 0;
  }
`

// Second row: the status and the dates.
export const OrderHeader = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: var(--od-space-3);
  min-width: 0;

  > div {
    display: flex;
    flex-wrap: wrap;
    column-gap: var(--od-space-3);
    > p {
      font-size: var(--od-type-identifier-size);
      font-family: var(--od-type-identifier-font);
      font-variant-ligatures: var(--od-type-identifier-ligatures);
    }
  }

  > p {
    font-size: var(--od-type-content-size);
    color: ${props => props.theme.colors.colorPage};
  }
`
export const Timer = styled.div`
  display: flex;
  align-items: baseline;
  gap: var(--od-space-1);

  p {
    font-size: var(--od-type-identifier-size);
    font-family: var(--od-type-identifier-font);
    font-variant-ligatures: var(--od-type-identifier-ligatures);
    direction: ltr;
    unicode-bidi: isolate;
    line-height: var(--od-x-leading-ui);
  }

  .bold {
    font-weight: 500;
    font-size: var(--od-type-secondary-size);
    font-family: inherit;
    font-variant-ligatures: normal;
    direction: inherit;
    unicode-bidi: normal;
    line-height: var(--od-x-leading-ui);
  }

  .in_time{
    color: ${props => props.theme?.ordering?.semantic?.state?.success?.functional ?? 'var(--od-success-functional)'};
  }

  .at_risk {
    color: ${props => props.theme?.ordering?.semantic?.state?.warning?.functional ?? 'var(--od-warning-functional)'};
  }
  
  .delayed {
    color: ${props => props.theme?.ordering?.semantic?.state?.danger?.functional ?? 'var(--od-danger-functional)'};
  }
`

export const ViewDetails = styled.button.attrs({ type: 'button' })`
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 2;
  /* redesign W1-3 (T1-3-4): drawn at 44 (the 44px minimum the card always had), and the card keeps its compact height because the box
     takes back what it adds above and below the 24px line (the margin), so it grows into the padding of the card, not the rows */
  min-width: 44px;
  min-height: 44px;
  margin-block: calc((var(--od-x-target-fine) - 44px) / 2);
  padding: 0 var(--od-space-2);
  border: 0;
  background: transparent;
  /* redesign tramo B r1 fixes (W1-QB1-04, decision 30): a text link is not the primary action, so it takes the product's action
     text colour and not the tenant's (the stored tenant blue gave 4.14:1 on white and 3.71:1 on the selected card) */
  color: var(--od-action-content);
  font-size: var(--od-type-control-size);
  /* alone on its row (a narrow list), it goes to the end of the line */
  margin-inline-start: auto;
  &:hover {
    text-decoration: underline;
  }

  &:focus-visible {
    outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.focus ?? getOrderingAction(props.theme)};
    outline-offset: 2px;
  }
`

export const InfoItemContainer = styled.div`
  width: 100%;
  box-sizing: border-box;
  margin: 0;
  min-width: 0;
  p {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 125px;

  }
  display: flex;
  align-items: center;

  div.info {
    margin-inline-start: 10px;
    p {
      margin: 0px;
      color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};
      font-size: var(--od-type-secondary-size);
    }
    p.bold {
      font-size: var(--od-type-content-size);
      font-weight: 500;
    }
  }
  @media (min-width: 1300px) {
    width: 50%;
    margin: 0;
  }
`

export const WrapperImage = styled.div`
  flex: none;
  max-width: 32px;
  max-height: 32px;
  height: 32px;
  width: 32px;
  ${({ isSkeleton }) => !isSkeleton && css`
    border: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? 'var(--od-border)'};
    border-radius: ${props => props.theme?.ordering?.radius?.panel ?? '10px'};
  `}

  img {
    width: 100%;
    height: 100%;
    border-radius: inherit;
    object-fit: cover;
  }

  svg {
    width: 100%;
    height: 100%;
    padding: 6px;
    box-sizing: border-box;
    border-radius: 50%;
  }
`

export const CardContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--od-space-1);

  @media (min-width: 1300px) {
    flex-direction: row;
  }
`
export const WrapperPagination = styled.div`
  margin: var(--od-space-2) var(--od-space-3) 0;
`

export const UnreadMessageCounter = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${props => props.theme?.ordering?.semantic?.action?.soft ?? props.theme.colors.lightPrimary};
  border-radius: ${props => props.theme?.ordering?.radius?.component ?? '8px'};
  font-size: var(--od-type-identifier-size);
  font-family: var(--od-type-identifier-font);
  font-variant-ligatures: var(--od-type-identifier-ligatures);
  height: 24px;
  /* redesign tramo B r1 fixes (W1-QB1-04, decision 30): the same class as «View details»: a count is not the primary action */
  color: var(--od-action-content);
  padding: 0 10px;
`
export const Timestatus = styled.div`
  position: absolute;
  width: 4px;
  /* redesign W1-3 (W1-A0-02): the bar takes the height of the card, not a fixed 130px */
  inset-block: var(--od-space-2);
  border-radius: ${props => props.theme?.ordering?.radius?.round ?? '20px'};
  inset-inline-start: var(--od-x-space-2-5);
 ${({ timeState }) => timeState === 'in_time' && css`
    background-color: ${props => props.theme?.ordering?.semantic?.state?.success?.signal ?? 'var(--od-success-signal)'};
  `}
  ${({ timeState }) => timeState === 'at_risk' && css`
    background-color: ${props => props.theme?.ordering?.semantic?.state?.warning?.signal ?? 'var(--od-warning-signal)'};
  `}
  ${({ timeState }) => timeState === 'delayed' && css`
    background-color: ${props => props.theme?.ordering?.semantic?.state?.danger?.signal ?? 'var(--od-danger-signal)'};
  `}
`
