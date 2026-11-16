import styled, { css } from 'styled-components'
import { IconButton, Input } from '../../../styles'

export const OrderBillContainer = styled.div`
  color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};
  padding: 15px 0 20px;
  display: flex;
  align-items: center;
  flex-direction: column;
  min-width: 0;

  table {
    width: 100%;
    font-size: var(--od-type-content-size);
    table-layout: fixed;

    th,
    td {
      min-width: 0;
      vertical-align: top;
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    th:first-child,
    td:first-child {
      padding-inline-end: 12px;
    }

    tr td:nth-child(2) {
      text-align: end;
    }
  }

  table.total {
    border-top: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors.borderColor};
    margin-top: 15px;
    tr {
      font-size: var(--od-type-section-title-size);
      td {
        font-weight: bold;
        padding-top: 10px;
      }
    }
  }
  table.payments {
    margin-top: 15px;
    thead {
      th {
        font-weight: 600;
        font-size: var(--od-type-section-title-size);
        padding-bottom: 5px;
      }
    }
  }
  table.comments {
    margin-top: 20px;
    align-items: center;

    .comment-heading {
      color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor ?? '#000'};
      font-weight: 600;
    }
  }
  table.spot_number,
  table.vehicle {
    margin-top: 20px;
  }
  table.delivery_option {
    margin-top: 15px;
    thead {
      th {
        font-weight: 600;
        font-size: var(--od-type-section-title-size);
        padding-bottom: 5px;
      }
    }
  }
`
export const RefundButtonWrapper = styled.div`
  width: 100%;
  padding: 20px 0;

  > button {
    height: 44px;
  }
`

export const RefundWalletButtonWrapper = styled.div`
  width: 100%;
  padding: 20px 0;

  > button {
    height: 44px;
  }
`
export const RefundContainer = styled.form`
  display: flex;
  flex-direction: column;

  h2 {
    font-size: var(--od-type-section-title-size);
    font-weight: 700;
    text-align: center;
    margin: 0 0 30px;
    color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};
  }

  p {
    margin: 4px 0;
    font-size: var(--od-type-content-size);
    color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};
  }

  button {
    height: 44px;
  }
`
export const RefundSummary = styled.p`
  margin: 0 0 16px;
  text-align: center;
  overflow-wrap: anywhere;
`

export const RadioItemContainer = styled.label`
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: 4px 0;
  border-radius: ${props => props.theme?.ordering?.radius?.control ?? '6px'};
  cursor: pointer;

  &:hover {
    background: ${props => props.theme?.ordering?.semantic?.action?.soft ?? props.theme.colors?.secundary};
  }

  &:focus-within {
    outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.focus ?? props.theme.colors.primary};
    outline-offset: 2px;
  }

  ${({ active }) => active && css`
    color: ${props => props.theme?.ordering?.actionOverride ?? props.theme?.ordering?.semantic?.action?.content ?? props.theme.colors.primary};
  `}

  ${({ disabled }) => disabled && css`
    cursor: not-allowed;
    color: ${props => props.theme?.ordering?.semantic?.text?.subtle ?? props.theme.colors.disabled};
    background: transparent;
  `}

  > span {
    font-size: var(--od-type-control-size);
    margin-inline-start: 13px;
  }
`
export const RefundAllDisabledNote = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 5px;
  padding: 10px 12px;
  background: ${props => props.theme?.ordering?.semantic?.state?.warning?.soft ?? props.theme.colors.warning100};
  border: 1px solid ${props => props.theme?.ordering?.semantic?.state?.warning?.signal ?? props.theme.colors.warning};
  border-radius: var(--od-radius-component);
  font-size: var(--od-type-secondary-size);
  color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};

  svg {
    flex-shrink: 0;
    margin-top: 2px;
    color: ${props => props.theme?.ordering?.semantic?.state?.warning?.functional ?? props.theme.colors.warning};
  }
`
export const RefundAmountWrapper = styled.div`
  margin-inline-start: 28px;

  input {
    width: 100%;
  }
`

export const RefundReasonContainer = styled.div`
  display: flex;
  flex-direction: column;
  margin: 40px 0;

  label {
    font-size: var(--od-type-control-size);
    margin-block-end: 7px;
  }

  textarea {
    width: 100%;
  }
`
export const Option = styled.div`
  color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.secundaryContrast};
  font-size: var(--od-type-control-value-size);
  min-width: 0;
  overflow-wrap: anywhere;
`
export const SelectWrapper = styled.div`
  display: flex;
  flex-direction: column;
  margin-block-end: 20px;
  
  > span {
    font-size: var(--od-type-control-size);
    margin-block-end: 7px;
  }
  .select {
    width: 100%;
    background: ${props => props.theme?.ordering?.semantic?.surface?.subtle ?? props.theme.colors.secundary};

    > div:first-child {
      padding-top: 4px;
      padding-bottom: 4px;
    }
  }
`
export const ErrorText = styled.div`
  text-align: center;
  color: ${props => props.theme?.ordering?.semantic?.state?.danger?.functional ?? props.theme.colors.danger};
  font-size: var(--od-type-content-size);
  overflow-wrap: anywhere;
`

export const RefundItemsPicker = styled.div`
  max-height: 280px;
  margin-block-start: 8px;
  padding: 12px;
  overflow-y: auto;
  border: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? '#E0E0E0'};
  border-radius: ${props => props.theme?.ordering?.radius?.component ?? '8px'};
  background: ${props => props.theme?.ordering?.semantic?.surface?.default ?? props.theme.colors?.backgroundPage ?? '#FFF'};
`

export const RefundProductRow = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding-block: 6px;
`

export const RefundProductLabel = styled.span`
  min-width: 0;
  font-size: var(--od-type-content-size);
  overflow-wrap: anywhere;
`

export const RefundQuantityInput = styled(Input)`
  width: 60px;
  min-height: 44px;
  padding: 4px 8px;
`

export const RefundExpandButton = styled(IconButton)`
  min-width: 44px;
  min-height: 44px;
`

export const RefundSuboptions = styled.div`
  margin-inline-start: 8px;
  padding-inline-start: 24px;
  border-inline-start: 2px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? '#EEE'};
`

export const RefundSuboptionRow = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding-block: 4px;
`

export const RefundSuboptionLabel = styled.span`
  min-width: 0;
  font-size: var(--od-type-secondary-size);
  color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? '#555'};
  overflow-wrap: anywhere;
`
