import styled, { css } from 'styled-components'

export const DriversAdvacedLogsContainer = styled.div`
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

export const SeeChanges = styled.span`
  color: ${props => props.theme?.ordering?.semantic?.action?.content ?? props.theme.colors.primary};
  cursor: pointer;
  &:hover {
    text-decoration: underline;
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
        &:first-child {
          width: 10%;
          ${props => props.theme?.rtl
? css`
            padding-left: 15px;
          `
: css`
            padding-right: 15px;
          `}
          box-sizing: border-box;
        }
        &:nth-child(2) {
          width: 10%;
          padding-left: 15px;
          padding-right: 15px;
        }
        &:nth-child(3) {
          width: 15%;
          padding-left: 15px;
          padding-right: 15px;
          box-sizing: border-box;
        }
        &:nth-child(4) {
          ${props => props.theme?.rtl
? css`
            padding-right: 15px;
          `
: css`
            padding-left: 15px;
          `}
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
        ${props => props.theme?.rtl
? css`
          padding-left: 15px;
        `
: css`
          padding-right: 15px;
        `}
        box-sizing: border-box;
      }
      &:nth-child(2) {
        width: 10%;
        padding-left: 15px;
        padding-right: 15px;
      }
      &:nth-child(3) {
        width: 15%;
        padding-left: 15px;
        padding-right: 15px;
      }
      &:nth-child(4) {
        ${props => props.theme?.rtl
? css`
          padding-right: 15px;
        `
: css`
          padding-left: 15px;
        `}
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
  padding-inline-end: 15px;
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
