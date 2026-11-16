import styled from 'styled-components'

export const TransSpreadContainer = styled.div`
  margin-top: 3px;
  table {
    th {
      > div {
        font-size: var(--od-type-secondary-size);
        padding: 15px 0 !important;
      }
    }
    td {
      font-size: var(--od-type-content-size);
      padding: 15px 0;
    }
  }
`
