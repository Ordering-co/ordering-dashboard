import styled, { css } from 'styled-components'

export const DeliveryzonesContainer = styled.div`
  padding: 10px;

  > h1 {
    font-size: var(--od-type-title-size);
    font-weight: 700;
    margin-top: 0;
    margin-bottom: 20px;
  }

  > button {
    height: 44px;
  }
`
export const DeliveryzonesTable = styled.table`
  width: 100%;
  td, th {
    padding: 12px 0;
  }
  th {
    font-size: var(--od-type-secondary-size);
    font-weight: 700;
  }

  td {
    font-size: var(--od-type-content-size);
  }
  thead {
    border-bottom: 1px solid ${props => props.theme.colors.disabled};
    tr {
      th {
        position: sticky;
        top: 0px;
        z-index: var(--od-x-layer-sticky);
        background: ${props => props.theme.colors?.backgroundPage || '#FFF'};
      }
    }
  }
`
export const SingleDeliveryzoneTbody = styled.tbody`
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};
`
export const ZoneNameWrapper = styled.div`
  display: flex;
  align-items: center;
  ${props => props.theme?.rtl
? css`
    border-left: 1px solid ${props => props.theme.colors.borderColor};
    margin-left: 25px;
  `
: css`
    border-right: 1px solid ${props => props.theme.colors.borderColor};
    margin-right: 25px;
  `}

  span.name {
    ${props => props.theme?.rtl
? css`
      margin-right: 25px;
    `
: css`
      margin-left: 25px;
    `}
  }
`
export const WrapperPagination = styled.div`
  display: flex;
  justify-content: flex-end;
  margin: 20px 0;
`
