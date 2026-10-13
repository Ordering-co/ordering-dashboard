import styled, { css } from 'styled-components'

export const BusinessListContainer = styled.div`
  max-height: calc(100vh - 330px);
  overflow: auto;

  @media (min-width: 768px) {
    max-height: ${props => props.fromSalesChannels ? 'calc(100vh - 240px)' : 'calc(100vh - 320px)'};
  }
`

export const BusinessListTable = styled.table`
  width: calc(100% - 10px);
  min-width: 650px;
  color: ${props => props.theme.colors?.headingColor};
  transition: all 0.3s;

  td, th {
    padding: 10px 0;
  }

  th {
    font-size: 14px;
    color: ${props => props.theme.colors.headingColor};
  }

  th.business,
  td.business {
    width: 35%;
  }

  th.action {
    width: 10%;
  }

  td.business-id {
    font-size: 13px;
    font-weight: 500;
  }

  ${({ fromImporters }) => fromImporters && css`
    min-width: 0;
    table-layout: fixed;

    th:first-child,
    td:first-child {
      width: 80px;
    }

    th.business,
    td.business {
      width: auto;
    }
  `}

  thead {
    border-bottom: 1px solid ${props => props.theme.colors.disabled};
    tr {
      th {
        position: sticky;
        top: 0px;
        z-index: 100;
        background: ${props => props.theme.colors?.backgroundPage || '#FFF'};
      }
    }
  }
`

export const WrapperPagination = styled.div`
`

export const BusinessCardContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  width: calc(100% + 20px);
  ${props => props.theme?.rtl
? css`
    transform: translateX(10px);
  `
: css`
    transform: translateX(-10px);
  `}
  max-height: calc(100vh - 210px);
  overflow: auto;
`
export const BusinessListBottomContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: ${({ allowBusinessRegister }) => allowBusinessRegister ? 'space-between' : 'flex-end'};
  align-items: center;
  margin-top: 10px;
`
export const AddFirstStoreContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 50px 0 20px 0;

  > img {
    width: 200px;
    margin-bottom: 12px;
  }

  > button {
    height: 44px;
  }

  @media (min-width: 768px) {
    > img {
      width: 370px;
    }
  }
`

export const CheckBoxWrapper = styled.div`
  cursor: pointer;
  display: flex;
  ${props => props.theme?.rtl
? css`
    margin-left: 10px;
  `
: css`
    margin-right: 10px;
  `}
  svg {
    font-size: 16px;
    color: ${props => props.theme.colors.secundaryLight};
  }

  ${({ isChecked }) => isChecked && css`
    svg {
      color: ${props => props.theme.colors?.primary};
    }
  `}
`

export const BusinessIdWrapper = styled.div`
  display: flex;
  align-items: center;
`

export const ActionWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;

  > label {
    margin-left: 5px;
    ${props => props.theme.rtl && css`
      margin-right: 5px;
      margin-left: 0px;
    `}
  }
`

export const FeaturedWrapper = styled.div`
  display: flex;
  align-items: center;

  label {
    margin-right: 5px;
    ${props => props.theme.rtl && css`
      margin-right: 0px;
      margin-left: 5px;
    `}
  }
`

export const BusinessListEmptyState = styled.div`
  display: flex;
  justify-content: center;
  padding: 32px 16px 24px;

  #not-found-source {
    width: 100%;
    max-width: 420px;
    height: auto;
    min-height: 0;
    margin: 0;
  }

  #not-found-source h1 {
    opacity: 0.72;
    font-size: 16px;
    font-weight: 500;
    line-height: 1.5;
    max-width: 36ch;
  }

  #not-found-source img {
    width: 180px;
  }
`
