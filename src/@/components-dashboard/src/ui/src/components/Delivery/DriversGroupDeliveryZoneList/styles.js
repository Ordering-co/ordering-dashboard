import styled, { css } from 'styled-components'

export const ZoneContainer = styled.div`
  margin: 30px 0 20px 0;
  @media (min-width: 1000px) {
    max-width: 500px;
  }
`

export const DeliveryZonesTable = styled.table`
  width: 100%;
  border-collapse: collapse;

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }

  thead {
    border-bottom: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors.borderColor};
    tr {
      th {
        font-size: var(--od-type-secondary-size);
        font-weight: 700;
        padding: 10px 0;
        text-align: start;
      }
    }
  }
`

export const DeliveryZonesTableWrapper = styled.div`
  width: 100%;
  display: flex;
  margin-bottom: 20px;
`

export const CheckSkeleteon = styled.div`
  width: 18px;
  height: 18px;
  margin-inline-end: 5px;
`

export const InfoBlock = styled.div`
  width: 100%;
`

export const ZoneRow = styled.tr`
  border-bottom: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors.borderColor};

  td,
  th[scope='row'] {
    font-size: var(--od-type-content-size);
    font-weight: normal;
    text-align: start;
    padding: 13px 0;
    &.arrow {
      font-size: 13px;
      color: ${props => props.theme?.ordering?.semantic?.text?.subtle ?? props.theme.colors.secundaryLight};
    }
  }
  &:hover {
    background-color: ${props => props.theme?.ordering?.semantic?.action?.soft ?? props.theme.colors.lightPrimary};
  }
  ${({ active }) => active && css`
    background-color: ${props => props.theme?.ordering?.semantic?.action?.soft ?? props.theme.colors.lightPrimary};
    td,
    th[scope='row'] {
      border-top: 1px solid ${props => props.theme?.ordering?.semantic?.action?.default ?? props.theme.colors.primary};
      border-bottom: 1px solid ${props => props.theme?.ordering?.semantic?.action?.default ?? props.theme.colors.primary};
    }
  `}
`

export const ZoneOpenButton = styled.button`
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  color: inherit;
  font-family: inherit;
  font-size: var(--od-type-content-size);
  font-weight: inherit;
  text-align: start;
  cursor: pointer;
  min-height: 44px;

  &:focus-visible {
    outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.default ?? props.theme.colors.primary};
    outline-offset: 2px;
  }
`

// The trailing disclosure control repeats the row's activation; it carries the
// reviewed chevron geometry rather than a readable role.
export const ZoneOpenIconButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  color: inherit;
  font-size: 13px;
  cursor: pointer;
  min-width: 44px;
  min-height: 44px;

  &:focus-visible {
    outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.default ?? props.theme.colors.primary};
    outline-offset: -2px;
  }
`

export const ActionsWrapper = styled.div`
  display: flex;
  align-items: center;
`

export const AddDeliveryZoneButton = styled.button`
  background: none;
  border: none;
  color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors.lightGray};
  font-size: var(--od-type-control-size);
  font-family: inherit;
  padding: 10px 0;
  min-height: 44px;
  cursor: pointer;
  width: fit-content;
  text-align: start;

  &:hover {
    color: ${props => props.theme?.ordering?.semantic?.action?.content ?? props.theme.colors.primary};
  }

  &:focus-visible {
    outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.default ?? props.theme.colors.primary};
    outline-offset: 2px;
  }
`
export const CheckboxWrapper = styled.div`
  display: flex;
  margin-inline-end: 10px;
`
