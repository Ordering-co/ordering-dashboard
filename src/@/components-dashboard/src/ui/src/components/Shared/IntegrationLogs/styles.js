import styled, { css } from 'styled-components'

export const LogsContainer = styled.div`
  height: calc(100% - 180px);
  > button {
    margin: 10px 0;
    padding-left: 10px;
    padding-right: 10px;
    display: flex;
    align-items: center;

    > p {
      margin: 0;
      height: 30px;
      display: -webkit-box;
      overflow: hidden;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 1;
    }
    svg {
      width: 20px;
      height: 20px;
    }
  }
  ${({ disabled }) => disabled && css`
    opacity: 0.7;
    pointer-events: none;
  `}
`

export const LogContainer = styled.div`
`

export const TableWrapper = styled.div`
  overflow: auto;
  height: ${({ hasGroupRelated }) => hasGroupRelated ? 'calc(100% - 54px)' : '100%'};
`

export const RelatedEvents = styled.div`
  .related-events {
    display: flex;
    justify-content: flex-end;
    color: ${props => props.theme.colors.primary};
    span {
      cursor: pointer;
      &:hover {
        text-decoration: underline;
      }
    }
  }

  .show-more {
    background: none;
    border: none;
    color: blue;
    cursor: pointer;
    text-decoration: underline;
    padding: 0;
  }
`

export const Table = styled.table`
  width: 100%;
  color: ${props => props.theme.colors?.headingColor};

  thead {
    tr {
      border-bottom: solid 1px ${props => props.theme.colors.disabled};
      th {
        padding: 13px 0;
        font-size: 12px;
        box-sizing: border-box;

        &:first-child {
          padding: 0;
          width: 0%;
        }

        &:nth-child(2) {
          width: 10%;
          ${props =>
            props.theme?.rtl
              ? css`
                  padding-left: 15px;
                `
              : css`
                  padding-right: 15px;
                `}
        }

        &:nth-child(3) {
          width: 20%;
          padding-left: 15px;
        }

        &:nth-child(4) {
          width: 10%;
          padding-left: 15px;
          padding-right: 15px;
        }
        &:nth-child(5) {
          padding-left: 15px;
        }
      }
    }
  }

  tbody {
    cursor: pointer;
    border-bottom: 1px solid ${props => props.theme.colors.borderColor};
    td {
      padding: 13px 0;
      font-size: 12px;
      box-sizing: border-box;

      &:first-child {
        padding: 0;
        width: 0%;
      }

      &:nth-child(2) {
        width: 10%;
        ${props =>
          props.theme?.rtl
            ? css`
                padding-left: 15px;
                padding-right: 5px;
              `
            : css`
                padding-right: 15px;
                padding-left: 5px;
              `}
      }

      &:nth-child(3) {
        width: 20%;
      }

      &:nth-child(4) {
        ${props =>
          props.theme?.rtl
            ? css`
                padding-right: 15px;
              `
            : css`
                padding-left: 15px;
              `}
      }
    }
  }
`

export const UserInfoContainer = styled.div`
  display: flex;
  align-items: center;
  padding-right: 5px;
  min-height: 36px;

  p {
    margin: 0px;
    font-size: 12px;
  }
`

export const DateTimeWrapper = styled.div`
  white-space: nowrap;
  font-size: 12px;
  min-height: 36px;
  display: flex;
  align-items: center;
  padding-left: 15px;

  ${props => props.theme?.rtl
? css`
    padding-left: 15px;
    margin-left: 15px;
  `
: css`
    padding-right: 15px;
    margin-right: 15px;
  `}
`

export const NoData = styled.div`
  font-size: 16px;
`
export const WrapperPagination = styled.div`
  display: flex;
  align-items: center;
  padding: 20px 0;
`

export const DataListTable = styled.table`
  width: 100%;
  border-right: 1px solid ${props => props.theme.colors.borderColor};

  tbody {
    border-bottom: none;
    td {
      box-sizing: border-box;
      &:first-child {
        width: 50% !important;
        padding-left: 15px;
        padding-right: 15px;
        box-sizing: border-box;
      }
      &:not(:first-child) {
        width: initial !important;
      }
      white-space: nowrap;
      padding-top: 10px;
      padding-bottom: 10px;
      ${props => props.theme?.rtl
? css`
        padding-left: 15px;
      `
: css`
        padding-right: 15px;
      `}
    }
  }
`

export const EventTypeContainer = styled.div`
  white-space: nowrap;
  font-size: 12px;
  min-height: 36px;
  display: flex;
  align-items: center;
  padding-right: 15px;
  padding-left: 15px;
  border-left: 1px solid ${props => props.theme.colors.borderColor};
  border-right: 1px solid ${props => props.theme.colors.borderColor};

  ${({ isFirst }) => isFirst && css`
    border-left: 0px;
  `}
  p {
    margin-bottom: 0px;
  }
`

export const Option = styled.div`
  display: flex;
  align-items: center;
  padding: 0px 15px;
  column-gap: 5px;
  min-height: 36px;

  p {
    margin: 0px;
    white-space: nowrap;
    font-size: 12px;
    line-height: 26px;
    color: ${props => props.theme.colors.headingColor};
  }

  ${({ noPadding }) => noPadding && css`
    padding: 0px;
  `}
`
export const Timestatus = styled.div`
  width: 4px;
  height: 22px;
  border-radius: 20px 20px 20px 20px;

  ${({ timeState }) => timeState === 'info' && css`
    background-color: #2C7BE5;
  `}
  ${({ timeState }) => timeState === 'warning' && css`
    background-color: #FFC700;
  `}
  ${({ timeState }) => (timeState === 'critical' || timeState === 'danger') && css`
    background-color: #E63757;
  `}
`

export const ToggleItemWrapper = styled.div`
  margin-top: 10px;
  border-bottom: 2px solid ${props => props.theme.colors?.secundaryLight};

  ${({ active }) => active && css`
    border-bottom: none;
    .down-arrow {
      transform: rotateZ(180deg);
    }
  `}
`

export const ContextAwareWrapper = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`

export const ActionIconWrapper = styled.div`
  display: flex;
  align-items: center;
  height: 100%;
  right: 0;
  top: 0;
  > .down-arrow {
    transition: all 0.3s;
    margin: 0 10px;
  }
`

export const ViewContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;

  ${({ flexEnd }) => flexEnd && css`
    justify-content: flex-end;
  `}

  .box-wrapper {
    display: flex;
    flex-direction: column;

    p.bold {
      font-weight: 700;
    }
    p {
      margin: 0;
    }

    .box-container {
      display: flex;
      padding: 10px 0px;
      border-radius: 8px;
    }
    .text-wrapper {
      display: flex;
      align-items: center;
      margin-right: 20px;
    }
  }
`

export const BoxColor = styled.div`
  width: 15px;
  height: 15px;
  border-radius: 4px;
  background-color: ${({ color }) => color};
  margin-right: 10px;
`
