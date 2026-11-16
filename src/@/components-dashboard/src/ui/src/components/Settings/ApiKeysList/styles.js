import styled, { css } from 'styled-components'

export const ApiKeysListContainer = styled.div`
  width: 100%;
  padding: 20px;
  box-sizing: border-box;

  > button {
    height: 44px;
    margin: 20px 0;
  }
`

export const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;

  ${props => props.theme?.rtl
? css`
    margin-left: 35px;
  `
: css`
    margin-right: 35px;
  `}

  h1 {
    font-size: var(--od-type-title-size);
    font-weight: 700;
    margin: 0px;
  }

  button {
    height: 42px;
  }

  @media (min-width: 576px) {
    ${props => props.theme?.rtl
? css`
      margin-left: 65px;
    `
: css`
      margin-right: 65px;
    `}
  }
`

export const ApiKeysListTable = styled.table`
  width: 100%;
  margin-top: 25px;

  thead {
    border-bottom: 1px solid ${props => props.theme.colors.secundaryLight};
    th {
      padding: 10px 0;
      &:last-child {
        padding-left: 20px;
        padding-right: 20px;
      }
    }
  }
  tr {
    width: 100%;
    th,
    td {
      font-size: var(--od-type-content-size);
      word-break: break-all;

      &:last-child {
        width: 100px;
        > div {
          padding-left: 20px;
          padding-right: 20px;
        }
      }
    }
  }

  tbody {
    border-bottom: 1px solid ${props => props.theme.colors.borderColor};
    td {
      padding-top: 9px;
      padding-bottom: 9px;

      &:last-child {
        > div {
          display: flex;
          justify-content: flex-end;
        }
      }
    }
  }
`

export const DropdownButtonWrapper = styled.div`
  ${props => props?.theme?.rtl
? css`
    border-right: 1px solid ${props => props.theme.colors.borderColor};
  `
: css`
    border-left: 1px solid ${props => props.theme.colors.borderColor};
  `}
  padding: 5px 20px;
  position: relative;
  button {
    background: transparent !important;
    border: none;
    padding: 0px;
    /* 44x44 touch area for the three-dots button */
    min-width: 44px;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    &:active,
    &:focus {
      border-color: unset !important;
      box-shadow: none !important;
    }
    svg {
      color: ${props => props.theme.colors.headingColor};
    }

    &:after {
      display: none;
    }
  }

  .show {
    button {
      background: ${props => props.theme.colors.secundary} !important;
      border-color: unset !important;
      box-shadow: none !important;
    }
    >div {
      border: 1px solid ${props => props.theme.colors.borderColor};
      box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.12);
    }
  }

  > div {
    > div {
      border-radius: 8px;
      .dropdown-item {
        font-size: var(--od-type-control-size);
        color: ${props => props.theme.colors.headingColor};
      }
      .dropdown-item:last-child {
        color: #E63757;
      }
    }
  }
`

// Owner decision 25 B: the ending of a key and its Show and Copy, on one line that wraps on a phone
export const KeyCell = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--od-space-2);

  .odc-api-key-value {
    flex: 1 1 auto;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .odc-api-key-actions {
    display: inline-flex;
    gap: var(--od-space-2);
  }
`
