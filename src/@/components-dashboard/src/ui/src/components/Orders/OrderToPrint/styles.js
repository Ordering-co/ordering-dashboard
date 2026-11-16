import styled from 'styled-components'

export const PrintContainer = styled.div`
  display: none;
  padding: 80px 50px;
  box-sizing: border-box;
  min-width: 0;
  color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor ?? '#000'};

  > h1 {
    font-size: 20px;
    font-weight: 700;
    margin: 0;
  }

  @media print {
    display: block;
    width: 100%;
    max-width: 100%;
    overflow: visible;
    color: #000;
    background: #FFF;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;

    table,
    tr,
    li {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    a {
      color: inherit;
      text-decoration: none;
      overflow-wrap: anywhere;
    }

    @page { size: portrait; }

    /* Six classes beat the status label color !important (0,4,6). */
    &&&&&&,
    &&&&&& * {
      color: #000 !important;
      -webkit-text-fill-color: #000 !important;
    }
  }
`
