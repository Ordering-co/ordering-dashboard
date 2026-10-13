import styled, { css } from 'styled-components'

export const Container = styled.div`
  flex: 1;
  padding: 20px;
  box-sizing: border-box;
  transition: all 0.5s;
  overflow: auto;
`

export const HeaderContainer = styled.div`
  display: flex;
  align-items: center;
  margin: 10px 0 30px 0;

  h1 {
    font-weight: bold;
    font-size: 20px;
    margin: 0;
    color: ${props => props.theme.colors.headingColor};
  }

  > button {
    ${props => props.theme?.rtl
? css`
      margin-left: 8px;
      margin-right: -8px;
    `
: css`
      margin-right: 8px;
      margin-left: -8px;
    `}

    svg {
      width: 25px;
      height: 25px;
    }
  }
`

export const PaymentHistorySection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
  padding: 16px;
  border: 1px solid ${props => props.theme.colors?.borderColor || '#E9ECEF'};
  border-radius: 8px;
  max-width: 520px;

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: ${props => props.theme.colors?.headingColor || '#344054'};
  }

  p {
    margin: 0;
    font-size: 13px;
    color: #909BA9;
  }
`

export const BusinessSelectorWrapper = styled.div`
  position: relative;
  width: fit-content;
  margin-bottom: 20px;
`

export const BusinessNameWrapper = styled.div`
  display: flex;
  cursor: pointer;

  h1 {
    font-size: 18px;
    font-weight: 700;
    color: ${props => props.theme?.colors?.headingColor};

    svg {
      font-size: 0.7em;
      transition: 0.2s ease-in-out;
    }

    svg.rotate-arrow {
      transform: rotate(180deg);
    }
  }
`

export const InvoiceListTable = styled.div`
  width: 100%;
  overflow-x: auto;
`

export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  min-width: 600px;

  th, td {
    padding: 12px 16px;
    text-align: left;
    font-size: 14px;
    border-bottom: 1px solid ${props => props.theme?.colors?.borderColor || '#DEE2E6'};
    ${props => props.theme?.rtl && css`
      text-align: right;
    `}
  }

  th {
    font-weight: 600;
    color: ${props => props.theme?.colors?.headingColor};
    background: ${props => props.theme?.colors?.backgroundPage || '#F8F9FA'};
  }

  td {
    color: ${props => props.theme?.colors?.lightGray || '#909BA9'};
  }
`

export const InvoiceRow = styled.tr`
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: ${props => props.theme?.colors?.lightPrimary || '#F5F9FF'};
  }
`

export const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: ${props => props.theme?.colors?.lightGray || '#909BA9'};

  p {
    font-size: 14px;
    margin-top: 10px;
  }
`

export const LoadingWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
`

export const ViewModeWrapper = styled.div`
  display: flex;
  gap: 15px;
  margin-bottom: 20px;

  @media (max-width: 576px) {
    flex-direction: column;
  }
`

export const ViewModeCard = styled.div`
  flex: 1;
  max-width: 300px;

  @media (max-width: 576px) {
    max-width: 100%;
  }
  padding: 16px 20px;
  border: 2px solid ${props => props.active
    ? (props.theme.colors?.primary || '#E63757')
    : (props.theme.colors?.borderColor || '#E9ECEF')};
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
  background: ${props => props.active
    ? (props.theme.colors?.primaryContrast || '#FFF2F4')
    : 'transparent'};

  &:hover {
    border-color: ${props => props.theme.colors?.primary || '#E63757'};
  }

  h3 {
    font-size: 14px;
    font-weight: 600;
    margin: 0;
    color: ${props => props.theme.colors?.headingColor || '#344054'};
  }

  p {
    font-size: 12px;
    margin: 4px 0 0 0;
    color: ${props => props.theme.colors?.lightGray || '#909BA9'};
  }
`

export const GeneralReportWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`

export const MethodSelectorWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 350px;

  @media (max-width: 576px) {
    max-width: 100%;
  }

  label {
    font-size: 18px;
    font-weight: 700;
    color: ${props => props.theme.colors?.headingColor || '#344054'};
  }

  .select {
    border: 1px solid ${props => props.theme.colors?.borderColor || '#E9ECEF'};
    border-radius: 8px;
    font-size: 14px;
  }
`

export const CalendarSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;

  > label {
    font-size: 18px;
    font-weight: 700;
    color: ${props => props.theme.colors?.headingColor || '#344054'};
  }

  .rdrCalendarWrapper {
    width: 100%;
    max-width: 500px;
    border: 1px solid ${props => props.theme.colors?.borderColor || '#E9ECEF'};
    border-radius: 8px;
    overflow: hidden;
  }

  .rdrMonth {
    width: 100%;
  }

  .rdrDayToday .rdrDayNumber span::after {
    background: ${props => props.theme.colors?.primary || '#E63757'};
  }

  .rdrDay:not(.rdrDayPassive):not(.rdrDayDisabled) .rdrDayNumber span {
    font-weight: 600;
  }

  .rdrSelected,
  .rdrStartEdge,
  .rdrEndEdge,
  .rdrInRange,
  .rdrDayStartPreview,
  .rdrDayEndPreview,
  .rdrDayInPreview {
    display: none !important;
  }

  .rdrDayNumber span.pr-start,
  .rdrDayNumber span.pr-mid,
  .rdrDayNumber span.pr-end,
  .rdrDayNumber span.pr-pill {
    background: ${props => `${props.theme.colors?.primary || '#E63757'}26`};
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .rdrDayNumber span.pr-start {
    border-radius: 1.042em 0 0 1.042em;
  }

  .rdrDayNumber span.pr-end {
    border-radius: 0 1.042em 1.042em 0;
  }

  .rdrDayNumber span.pr-pill {
    border-radius: 1.042em;
  }

  .rdrDayNumber span.pr-mid {
    border-radius: 0;
  }

  .rdrDayNumber span.pr-cutoff {
    background: ${props => props.theme.colors?.primary || '#E63757'};
    color: #fff;
  }
`

export const MonthGridWrapper = styled.div`
  border: 1px solid ${props => props.theme.colors?.borderColor || '#E9ECEF'};
  border-radius: 8px;
  padding: 20px;
  max-width: 500px;
  background: ${props => props.theme.colors?.backgroundPage || '#fff'};
`

export const YearSelector = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin-bottom: 20px;

  span {
    font-size: 18px;
    font-weight: 700;
    color: ${props => props.theme.colors?.headingColor || '#344054'};
    min-width: 60px;
    text-align: center;
  }

  button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: 1px solid ${props => props.theme.colors?.borderColor || '#E9ECEF'};
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
    color: ${props => props.theme.colors?.headingColor || '#344054'};
    transition: all 0.2s ease;

    &:hover {
      background: ${props => props.theme.colors?.backgroundPage || '#F8F9FA'};
      border-color: ${props => props.theme.colors?.primary || '#E63757'};
    }

    &:disabled {
      opacity: 0.3;
      cursor: not-allowed;

      &:hover {
        background: transparent;
        border-color: ${props => props.theme.colors?.borderColor || '#E9ECEF'};
      }
    }

    svg {
      width: 14px;
      height: 14px;
    }
  }
`

export const MonthGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
`

export const MonthCard = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 12px;
  border: 2px solid ${props => props.active
    ? (props.theme.colors?.primary || '#E63757')
    : (props.theme.colors?.borderColor || '#E9ECEF')};
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s ease;
  user-select: none;

  background: ${props => props.active
    ? (props.theme.colors?.primary || '#E63757')
    : 'transparent'};
  color: ${props => props.active
    ? '#fff'
    : props.disabled
      ? (props.theme.colors?.disabled || '#B1BCCC')
      : (props.theme.colors?.headingColor || '#344054')};
  opacity: ${props => props.disabled ? 0.4 : 1};

  ${props => !props.disabled && !props.active && css`
    &:hover {
      border-color: ${props.theme.colors?.primary || '#E63757'};
      background: ${props.theme.colors?.primaryContrast || '#FFF2F4'};
    }
  `}
`

export const PeriodInfoBox = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px;
  border: 1px solid ${props => props.theme.colors?.borderColor || '#E9ECEF'};
  border-radius: 8px;
  background: ${props => props.theme.colors?.backgroundPage || '#F8F9FA'};

  @media (max-width: 576px) {
    flex-direction: column;
    align-items: flex-start;
  }
`

export const PeriodInfoText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;

  span.label {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: ${props => props.theme.colors?.lightGray || '#909BA9'};
  }

  span.dates {
    font-size: 14px;
    font-weight: 600;
    color: ${props => props.theme.colors?.headingColor || '#344054'};
  }
`

export const DownloadButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  background: ${props => props.theme.colors?.primary || '#E63757'};
  color: #fff;

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  svg {
    width: 16px;
    height: 16px;
  }
`

export const CalendarHint = styled.p`
  font-size: 14px;
  margin: 0;
  color: ${props => props.theme.colors?.lightGray || '#909BA9'};
`

export const TabsContainer = styled.div`
  display: flex;
  border-bottom: 1px solid ${props => props.theme.colors?.borderColor || '#E9ECEF'};
  margin-bottom: 20px;
`

export const TabButton = styled.div`
  padding: 10px 20px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  color: ${props => props.theme.colors?.lightGray || '#909BA9'};
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s ease;

  ${({ active }) => active && css`
    color: ${props => props.theme.colors?.primary || '#E63757'};
    border-bottom-color: ${props => props.theme.colors?.primary || '#E63757'};
  `}

  &:hover {
    color: ${props => props.theme.colors?.primary || '#E63757'};
  }
`

export const PaginationWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  padding: 16px 0;

  button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: 1px solid ${props => props.theme.colors?.borderColor || '#E9ECEF'};
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
    color: ${props => props.theme.colors?.headingColor || '#344054'};
    transition: all 0.2s ease;

    &:hover {
      background: ${props => props.theme.colors?.backgroundPage || '#F8F9FA'};
      border-color: ${props => props.theme.colors?.primary || '#E63757'};
    }

    &:disabled {
      opacity: 0.3;
      cursor: not-allowed;
      &:hover {
        background: transparent;
        border-color: ${props => props.theme.colors?.borderColor || '#E9ECEF'};
      }
    }

    svg {
      width: 14px;
      height: 14px;
    }
  }

  span {
    font-size: 14px;
    font-weight: 600;
    color: ${props => props.theme.colors?.headingColor || '#344054'};
  }
`
