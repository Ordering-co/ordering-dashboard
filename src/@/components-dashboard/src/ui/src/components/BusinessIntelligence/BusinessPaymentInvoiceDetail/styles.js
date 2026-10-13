import styled, { css } from 'styled-components'

export const DetailContainer = styled.div`
  padding: 24px 32px;
  overflow-x: auto;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, Helvetica, sans-serif;
  font-size: 12px;
  color: #333;
  background: #fff;

  @media print {
    overflow: visible;
    padding: 0;
  }
`

export const DownloadButtonWrapper = styled.div`
  display: flex;
  justify-content: flex-start;
  margin-bottom: 16px;

  @media print {
    display: none;
  }
`

export const DownloadButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: ${props => props.theme?.colors?.primary || '#1a1a2e'};
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;

  &:hover:not(:disabled) {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

export const PrintableContent = styled.div`
  @media print {
    width: 100%;
  }

  @page {
    size: A4;
    margin: 15mm;
  }
`

export const DetailHeader = styled.div`
  padding: 24px 0;
  text-align: center;
  border-bottom: 2px solid #eee;
  margin-bottom: 0;

  img {
    max-height: 80px;
    max-width: 280px;
    margin-bottom: 10px;
  }

  h1 {
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 4px 0;
    color: #1a1a2e;
  }

  p {
    font-size: 12px;
    color: #555;
    margin: 0;
  }
`

export const PeriodBar = styled.div`
  display: flex;
  width: 100%;
  background: #f8f9fb;
  padding: 12px 20px;
  margin-top: 16px;
  border-radius: 4px;
  box-sizing: border-box;
`

export const PeriodCol = styled.div`
  flex: 1;

  &:last-child {
    text-align: right;
  }
`

export const PeriodLabel = styled.span`
  font-size: 10px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`

export const PeriodValue = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: #333;
  display: block;
  margin-top: 2px;
`

export const SummaryRow = styled.div`
  display: flex;
  width: 100%;
  margin-top: 16px;
`

export const SummaryCell = styled.div`
  flex: 1;
  padding: 10px;
  text-align: center;

  ${({ variant }) => variant === 'left' && css`
    background: #f8f9fb;
    border-radius: 4px 0 0 4px;
  `}

  ${({ variant }) => variant === 'mid' && css`
    background: #f8f9fb;
  `}

  ${({ variant }) => variant === 'quad-left' && css`
    background: #f8f9fb;
    border-radius: 4px 0 0 4px;
  `}

  ${({ variant }) => variant === 'quad-mid' && css`
    background: #f8f9fb;
  `}

  ${({ variant }) => variant === 'right' && css`
    background: #e8f5e9;
    border-radius: 0 4px 4px 0;
  `}

  ${({ variant }) => variant === 'quad-right' && css`
    background: #e8f5e9;
    border-radius: 0 4px 4px 0;
  `}
`

export const SummaryLabel = styled.span`
  font-size: 10px;
  color: ${({ green }) => green ? '#2e7d32' : '#888'};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`

export const SummaryValue = styled.span`
  font-size: 16px;
  font-weight: 700;
  margin-top: 2px;
  display: block;

  ${({ color }) => color === 'red' && css`
    color: #c0392b;
  `}

  ${({ color }) => color === 'green' && css`
    color: #2e7d32;
  `}

  ${({ color }) => !color && css`
    color: #333;
  `}
`

export const SectionTitle = styled.h2`
  font-size: 14px;
  color: #1a1a2e;
  font-weight: 600;
  border-bottom: 2px solid #eee;
  padding-bottom: 6px;
  margin: 20px 0 10px 0;
`

export const DayTitle = styled.h3`
  font-size: 12px;
  color: #555;
  font-weight: 600;
  margin: 14px 0 6px 0;
`

export const OrderDetailsTableScroll = styled.div`
  width: 100%;
  overflow-x: auto;
  margin-bottom: 10px;
  -webkit-overflow-scrolling: touch;

  table {
    margin-bottom: 0;
    min-width: max-content;
  }
`

export const DataTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  margin-bottom: 10px;

  th {
    background: #f8f9fb;
    padding: 6px 8px;
    font-weight: 600;
    color: #555;
    text-align: left;
    ${props => props.theme?.rtl && css`text-align: right;`}
  }

  th.right, td.right {
    text-align: right;
  }

  th.center, td.center {
    text-align: center;
  }

  td {
    padding: 5px 8px;
    border-bottom: 1px solid #f0f0f0;
    color: #333;
  }
`

export const TotalRow = styled.tr`
  td {
    background: #f8f9fb;
    font-weight: 700;
    color: #1a1a2e !important;
  }
`

export const FeeSection = styled.div`
  > ${() => FeeRow}:last-child {
    border-bottom: none;
  }
`

export const FeeGroup = styled.div`
  font-size: 11px;
  font-weight: 700;
  color: #1a1a2e;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 10px 8px 5px;
  border-bottom: 1px solid #ddd;
  margin-top: 6px;
`

export const FeeRow = styled.div`
  display: flex;
  justify-content: space-between;
  width: 100%;
  border-bottom: 1px solid #f0f0f0;
`

export const FeeName = styled.span`
  padding: 4px 8px;
  color: #333;
  font-size: 11px;
`

export const FeeAmount = styled.span`
  padding: 4px 8px;
  text-align: right;
  font-size: 11px;

  ${({ color }) => color === 'red' && css`
    color: #c0392b;
  `}

  ${({ color }) => color === 'green' && css`
    color: #2e7d32;
  `}
`

export const CountLabel = styled.span`
  color: #999;
  font-size: 10px;
`

export const TotalsBlock = styled.div`
  margin-top: 0;
  border-top: 2px solid #eee;
`

export const TotalsRow = styled.div`
  display: flex;
  justify-content: space-between;
  width: 100%;
`

export const TotalsLabel = styled.span`
  padding: 6px 8px;
  color: ${({ bold }) => bold ? '#1a1a2e' : '#555'};
  font-size: 11px;
  font-weight: ${({ bold }) => bold ? '700' : '400'};
`

export const TotalsValue = styled.span`
  padding: 6px 8px;
  text-align: right;
  font-weight: 600;
  font-size: 11px;

  ${({ color }) => color === 'red' && css`
    color: #c0392b;
  `}

  ${({ bold }) => bold && css`
    font-weight: 700;
  `}
`

export const TransferRow = styled.div`
  display: flex;
  justify-content: space-between;
  width: 100%;
  background: #e8f5e9;
  border-radius: 4px;
  margin-top: 4px;

  span {
    font-weight: 700;
    color: #2e7d32;
    font-size: 13px;
    padding: 8px;
  }
`

export const InvoiceFooter = styled.div`
  text-align: center;
  padding: 20px 0 8px;
  font-size: 10px;
  color: #999;
  line-height: 1.6;
`

export const LoadingWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
`

export const ErrorWrapper = styled.div`
  padding: 20px;
  text-align: center;
  color: #C62828;
  font-size: 14px;
`
