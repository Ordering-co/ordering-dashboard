import styled, { css } from 'styled-components'

import { getOrderingAction } from '~/brand/adapter'

export const OrdersContainer = styled.div`
  overflow: auto;

  ${({ noScroll }) => noScroll && css`
    overflow: hidden;
  `}

  @media (min-width: 992px) {
    ${({ isSelectedOrders }) => isSelectedOrders && css`
      max-height: calc(var(--vh, 1vh) * 100 - 345px);
    `}
  }

  @media (min-width: 1200px) {
    ${({ isSelectedOrders }) => isSelectedOrders && css`
      max-height: calc(var(--vh, 1vh) * 100 - 345px);
    `}
  }
`

export const Table = styled.table`
  width: calc(100% - 10px);
  min-width: 900px;

  th,
  td {
    padding: 15px;
    box-sizing: border-box;
    font-size: var(--od-type-content-size);

    &:first-child {
      padding-left: 0px;
      padding-right: 0px;
    }
  }

  th {
    padding-top: 0px;
  }

  thead {
    tr {
      width: 100%;
      border-bottom: solid 1px ${props => props.theme?.ordering?.semantic?.border?.strong ?? props.theme.colors.disabled};
      th {
        color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};
        white-space: nowrap;
        ${({ noFixedHeader }) => !noFixedHeader && css`
          position: sticky;
          top: 0px;
          z-index: var(--od-x-layer-sticky);
        `}
        background: ${props => props.theme?.ordering?.semantic?.surface?.default ?? props.theme.colors.backgroundPage};
      }
    }
  }

  p {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cloned {
    text-align: center;
    svg {
      width: 18px;
      height: 18px;
      color: ${props => props.theme?.ordering?.semantic?.state?.success?.functional ?? props.theme.colors.green};
    }
  }
  .orderPrice {
    div.info {
      p {
        text-align: end;
      }
    }
  }

  thead th.orderPrice.total {
    text-align: end;
    /* the floating manage-columns button (44px touch target) sits over the end of this header */
    padding-inline-end: calc(15px + 44px);
  }

  div.info {
    p {
      margin: 0px;
      color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors?.lightGray};
      font-size: var(--od-type-secondary-size);
    }
    p.date {
      color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};
    }
    p.bold {
      font-size: var(--od-type-content-size);
      font-weight: 600;
      color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};
    }
  }
`

export const OrderTbody = styled.tbody`
  tr {
    border-bottom: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors.borderColor};
    cursor: pointer;

    &[data-status="delayed"] {
      background-color: ${props => props.theme?.ordering?.semantic?.state?.danger?.soft ?? props.theme.colors.danger100};
      td {
        border-top: 1px solid ${props => props.theme?.ordering?.semantic?.state?.danger?.signal ?? props.theme.colors.danger} !important;
        border-bottom: 1px solid ${props => props.theme?.ordering?.semantic?.state?.danger?.signal ?? props.theme.colors.danger} !important;
      }
    }
    &[data-status="at_risk"] {
      background-color: ${props => props.theme?.ordering?.semantic?.state?.warning?.soft ?? props.theme.colors.warning100};
      td {
        border-top: 1px solid ${props => props.theme?.ordering?.semantic?.state?.warning?.signal ?? props.theme.colors.warning} !important;
        border-bottom: 1px solid ${props => props.theme?.ordering?.semantic?.state?.warning?.signal ?? props.theme.colors.warning} !important;
      }
    }
    &:hover {
      background-color: ${props => props.theme?.ordering?.semantic?.action?.soft ?? props.theme.colors.lightPrimary};
    }
    &.active {
      background-color: ${props => props.theme?.ordering?.semantic?.action?.soft ?? props.theme.colors.lightPrimary};
      td {
        border-top: 1px solid ${props => getOrderingAction(props.theme) ?? props.theme.colors.primary} !important;
        border-bottom: 1px solid ${props => getOrderingAction(props.theme) ?? props.theme.colors.primary} !important;
      }
    }
  }
`

export const OrderNumberContainer = styled.div`
  display: flex;
  align-items: center;

  p {
    max-width: 180px;
  }

  border-inline-end: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? '#E9ECEF'};
  padding-inline-end: 15px;
`

export const CheckBox = styled.button.attrs({ type: 'button' })`
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  margin-inline-end: 10px;

  &:focus-visible {
    outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.focus ?? getOrderingAction(props.theme)};
    outline-offset: 2px;
  }

  @media (pointer: coarse) {
    min-width: 44px;
    min-height: 44px;
  }

  &:disabled {
    cursor: default;
  }

  svg {
    font-size: 24px;
    color: ${props => props.theme?.ordering?.semantic?.text?.subtle ?? '#B1BCCC'};

    ${({ isChecked }) => isChecked && css`
      color: ${props => getOrderingAction(props.theme) ?? props.theme.colors?.primary};
    `}
  }
`

export const BusinessInfo = styled.div`
  display: flex;
  align-items: center;
  p {
    max-width: 125px;
  }
  div.info {
    margin-inline-start: 10px;
  }
`

export const CustomerInfo = styled(BusinessInfo)`
  p {
    max-width: 125px;
  }
`

export const StatusInfo = styled.div`
  .bold {
    max-width: 150px;
    font-weight: 600;
    margin: 0;
  }
`

export const ChannelInfo = styled.div`
  .bold {
    max-width: 150px;
    font-weight: 600;
    margin: 0;
  }
`

export const EtaInfo = styled.div`
  .bold {
    max-width: 150px;
    font-weight: 600;
    margin: 0;
  }

  .empty {
    margin: 0;
  }
`

export const PodInfo = styled.div`
  .bold {
    max-width: 150px;
    font-weight: 600;
    margin: 0;
  }

  .empty {
    margin: 0;
  }
`

export const DriversInfo = styled.div`
  .select {
    > div:first-child {
      padding-left: 0;
      padding-right: 0;
    }
  }
  > div {
    > div {
      border: none;
      &:first-child {
        .driver-photo {
          width: 45px;
          height: 45px;
        }
        .driver-info {
          p {
            color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};
            font-size: var(--od-type-control-value-size);
            font-weight: 600;
          }
          span {
            display: initial;
          }
        }
      }
    }
  }
  ${({ noClick }) => noClick && css`
    pointer-events: none;
  `}
`

export const WrapperImage = styled.div`
  max-width: 45px;
  max-height: 45px;
  height: 45px;
  width: 45px;
  box-shadow: ${props => props.theme?.ordering?.shadow?.[1] ?? '0px 1px 4px rgba(0, 0, 0, 0.1)'};
  border-radius: 7.6px;
  position: relative;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 7.6px;
  }

  svg {
    width: 100%;
    height: 100%;
    padding: 7px;
    box-sizing: border-box;
    border-radius: 50%;
  }
`

export const OrderType = styled.div`
  display: flex;
  align-items: center;

  img, svg {
    width: 25px;
    height: 30px;
  }

  img {
    border-radius: unset;
    border: none;
  }

  span {
    color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};
    font-size: var(--od-type-content-size);
    margin-inline-start: 5px;
  }
`

export const WrapOrderStatusSelector = styled.div`
  > div {
    p {
      font-size: var(--od-type-control-value-size);
    }
    > div:first-child {
      p {
        color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};
        max-width: 140px;
      }
    }
  }
`

export const WrapperPagination = styled.div`
  padding-top: 5px;
`
export const LogisticStatusDot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;

  margin-inline-start: 6px;

  ${({ status }) => status === 0 && css`
    background-color: ${props => props.theme.colors.orange};
  `}
  ${({ status }) => status === 1 && css`
    background-color: ${props => props.theme.colors.warning};
  `}
  ${({ status }) => status === 2 && css`
    background-color: ${props => props.theme.colors.info};
  `}
  ${({ status }) => status === 3 && css`
    background-color: ${props => props.theme.colors.danger};
  `}
  ${({ status }) => status === 4 && css`
    background-color: ${props => props.theme.colors.success};
  `}
`
export const PriorityDot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;

  margin-inline-start: 6px;

  ${({ priority }) => priority === -1 && css`
    background-color: ${props => props.theme.colors.secundaryLight};
  `}
  ${({ priority }) => priority === 0 && css`
    background-color: ${props => props.theme.colors.primary};
  `}
  ${({ priority }) => priority === 1 && css`
    background-color: ${props => props.theme.colors.warning};
  `}
  ${({ priority }) => priority === 2 && css`
    background-color: ${props => props.theme.colors.danger};
  `}
`
export const Timestatus = styled.div`
  width: 4px;
  height: 37px;
  border-radius: ${props => props.theme?.ordering?.radius?.round ?? '20px'};
  ${({ timeState }) => timeState === 'in_time' && css`
    background-color: ${props => props.theme?.ordering?.semantic?.state?.success?.signal ?? '#00D27A'};
  `}
  ${({ timeState }) => timeState === 'at_risk' && css`
    background-color: ${props => props.theme?.ordering?.semantic?.state?.warning?.signal ?? '#FFC700'};
  `}
  ${({ timeState }) => timeState === 'delayed' && css`
    background-color: ${props => props.theme?.ordering?.semantic?.state?.danger?.signal ?? '#E63757'};
  `}
`
export const Timer = styled.div`
  min-width: 65px;
  p {
    margin: 0px;
    color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors?.lightGray};
    font-size: var(--od-type-identifier-size);
    font-family: var(--od-type-identifier-font);
    font-variant-ligatures: var(--od-type-identifier-ligatures);
    direction: ltr;
    unicode-bidi: isolate;
  }

  .bold {
    font-size: var(--od-type-content-size);
    font-weight: 600;
    font-family: inherit;
    font-variant-ligatures: normal;
    direction: inherit;
    unicode-bidi: normal;
    color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};
  }

  .in_time{
    color: ${props => props.theme?.ordering?.semantic?.state?.success?.functional ?? '#00D27A'};
  }

  .at_risk {
    color: ${props => props.theme?.ordering?.semantic?.state?.warning?.functional ?? '#FFC700'};
  }

  .delayed {
    color: ${props => props.theme?.ordering?.semantic?.state?.danger?.functional ?? '#E63757'};
  }
`

export const OrdersCountWrapper = styled.div`
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${props => props.theme?.ordering?.radius?.round ?? '50px'};
  background-color: ${props => props.theme?.ordering?.semantic?.action?.soft ?? props.theme.colors.backgroundInfo};
  color: ${props => props.theme?.ordering?.actionOverride ?? props.theme?.ordering?.semantic?.action?.content ?? props.theme.colors.primary};
  font-weight: 400;
  font-size: var(--od-type-identifier-size);
  font-family: var(--od-type-identifier-font);
  font-variant-ligatures: var(--od-type-identifier-ligatures);
  line-height: 12px;
  padding: 2px 5px;
  position: absolute;
  top: -9px;
  inset-inline-end: -5px;

  ${({ isNew }) => isNew && css`
    background-color: ${props => props.theme?.ordering?.semantic?.state?.success?.soft ?? props.theme.colors.lightGreen};
    color: ${props => props.theme?.ordering?.semantic?.state?.success?.functional ?? props.theme.colors.success};
  `}
`
export const DragTh = styled.th`
  cursor: pointer;
  ${({ selectedDragOver }) => selectedDragOver && css`
    border: 1px solid ${props => getOrderingAction(props.theme) ?? props.theme.colors.primary};
  `}
`
export const InfoWrapper = styled.div`
  position: relative;
  margin-inline-end: 4px;

  .bold {
    max-width: 150px;
    font-weight: 600;
    margin: 0;
  }

  &:hover > div {
    visibility: visible;
    opacity: 1;
  }
`
