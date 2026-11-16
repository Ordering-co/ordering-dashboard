import styled from 'styled-components'

export const PrintContainer = styled.div`
  display: none;
  font-family: arial !important;
  color: #000 !important;
  padding: 80px 50px;
  max-width: 420px;
  box-sizing: border-box;
  overflow-wrap: anywhere;

  > h1 {
    font-size: 20px;
    font-weight: 700;
    margin: 0;
  }

  @media print {
    display: block;
    width: 100%;
    overflow: visible;
    background: #FFF;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;

    @page { size: portrait; }
  }
`

export const PrintTextContainer = styled.p`
  font-size: 16px;
  overflow-wrap: anywhere;
`
export const PrintProductsContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`

export const PrintProducts = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  min-width: 0;
  break-inside: avoid;
  page-break-inside: avoid;
`

export const Products = styled.div`
  display: flex;
  width: 100%;
  min-width: 0;
`

export const ProdcutCommentsContainer = styled.div`
  font-size: 16px;
  width: 100%;
  min-width: 0;
`

export const ProductComments = styled.div`
  margin-inline-start: 10px;
  overflow-wrap: anywhere;
`

export const InfoContainer = styled.div`
  display: flex;
  align-items: flex-start;
  width: 100%;
  min-width: 0;
  break-inside: avoid;
  page-break-inside: avoid;
`

export const InsideInfo = styled.div`
  display: flex;
  justify-content: flex-start;
  font-size: 16px;
  width: 70%;
  min-width: 0;
  padding-inline-end: 8px;
  font-weight: bold;
  overflow-wrap: anywhere;
`

export const InsideInfo2 = styled.div`
  display: flex;
  justify-content: flex-end;
  font-size: 16px;
  width: 30%;
  min-width: 0;
  text-align: end;
  overflow-wrap: anywhere;
`
