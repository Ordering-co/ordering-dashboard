import styled, { css } from 'styled-components'

export const DriversGroupLogsContainer = styled.div`
  height: calc(100% - 180px);
  ${({ disabled }) => disabled && css`
    opacity: 0.7;
    pointer-events: none;
  `}
`

export const TableWrapper = styled.div`
  overflow: auto;
  height: 100%;
  max-width: 100%;
`

export const SeeChanges = styled.button`
  background: none;
  border: none;
  padding: 0;
  font-family: inherit;
  font-size: var(--od-type-content-size);
  color: ${props => props.theme?.ordering?.semantic?.action?.content ?? props.theme.colors.primary};
  cursor: pointer;
  min-height: 44px;
  text-align: start;

  &:hover {
    text-decoration: underline;
  }

  &:focus-visible {
    outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.default ?? props.theme.colors.primary};
    outline-offset: 2px;
  }
`

export const Table = styled.table`
  width: 100%;
  min-width: 1000px;
  color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};

  thead {
    tr {
      border-bottom: solid 1px ${props => props.theme?.ordering?.semantic?.border?.strong ?? props.theme.colors.disabled};
      th {
        padding: 13px 0;
        font-size: var(--od-type-secondary-size);
        text-align: start;
        &:first-child {
          width: 10%;
          padding-inline-end: 15px;
          box-sizing: border-box;
        }
        &:nth-child(3) {
          width: 35%;
          padding-inline: 15px;
          box-sizing: border-box;
        }
        &:nth-child(4) {
          padding-inline-start: 15px;
          box-sizing: border-box;
        }
      }
    }
  }

  > tbody {
    tr {
      border-bottom: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors.borderColor};
    }
    td,
    th[scope='row'] {
      padding: 13px 0;
      font-size: var(--od-type-content-size);
      font-weight: normal;
      text-align: start;
      &:first-child {
        width: 10%;
        padding-inline-end: 15px;
        box-sizing: border-box;
      }
      &:nth-child(3) {
        width: 35%;
      }
      &:nth-child(4) {
        padding-inline-start: 15px;
        box-sizing: border-box;
      }
    }
  }
`

export const UserInfoContainer = styled.div`
  p {
    color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors.lightGray};
    margin: 0px;
    font-size: var(--od-type-content-size);
    &:first-child {
      color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};
      font-weight: 500;
    }
  }
`

export const DateTimeWrapper = styled.div`
  white-space: nowrap;
  font-size: var(--od-type-identifier-size);
  font-family: var(--od-type-identifier-font);
  font-variant-ligatures: var(--od-type-identifier-ligatures);
  direction: ltr;
  unicode-bidi: isolate;
  min-height: 36px;
  display: flex;
  align-items: center;
  padding-inline: 15px;
  margin-inline-end: 15px;
  border-inline-end: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors.borderColor};
`

export const NoData = styled.div`
  font-size: var(--od-type-section-title-size);
`
export const WrapperPagination = styled.div`
  display: flex;
  align-items: center;
  padding: 20px 0;
`

export const DataListTable = styled.table`
  width: 100%;
  border-inline-end: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors.borderColor};
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    box-sizing: border-box;
    white-space: nowrap;
    padding: 10px 15px;
  }
`

export const EventTypeContainer = styled.div`
  white-space: nowrap;
  font-size: var(--od-type-control-size);
  min-height: 36px;
  display: flex;
  align-items: center;
  padding-inline: 15px;
  margin-inline-start: 15px;
  margin-inline-end: 10px;
  border-inline: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors.borderColor};
  p{
    margin-bottom: 0px;
  }
`

export const SchedulesWrapper = styled.div`
  display: flex;
  flex-direction: row;
  gap: 30px;
  justify-content: center;

  ${props => props?.border && css`
    div:first-child {
      border-inline-end: 1px solid ${props.theme?.ordering?.semantic?.border?.default ?? '#E9ECEF'};
      padding-inline-end: 30px;
    }
  `}
`

export const Schedules = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`

export const ScheduleDay = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: space-between;
`

export const ScheduleLapses = styled.div`
  display: flex;
  flex-direction: column;
  border-inline-start: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? '#E9ECEF'};
  padding-inline-start: 10px;

  p  {
    margin: 0px;
  }
`

export const ScheduleTitle = styled.h2`
  text-align: center;
`
