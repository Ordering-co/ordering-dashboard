import styled from 'styled-components'

export const TaxInformationContainer = styled.div`
  > h2 {
    font-size: var(--od-type-title-size);
    margin: 10px;
    text-align: center;
  }

  > h3 {
    font-size: var(--od-type-section-title-size);
  }
`

export const ProductContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  > div{
    border: 1px solid #E9ECEF;
    cursor: initial;
    @media (min-width: 681px){
      width: calc(50% - 45px);
    }

  }
`
