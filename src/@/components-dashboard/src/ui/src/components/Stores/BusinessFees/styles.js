import styled, { css } from 'styled-components'

export const BusinessFeesContainer = styled.div`
  padding: 20px;
  flex: 1;
  overflow: auto;
`

export const HeaderContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;

  @media (min-width: 768px) {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
`

export const HeaderTitleContainer = styled.div`
  h1 {
    font-size: 20px;
    font-weight: 700;
    margin: 0;
  }
`

export const TabsContainer = styled.div`
  display: flex;
  border-bottom: 1px solid ${props => props.theme.colors?.borderColor || '#E9ECEF'};
  margin-bottom: 20px;
  margin-top: 20px;
`

export const TabButton = styled.div`
  padding: 10px 20px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  color: ${props => props.theme.colors?.disabled || '#B1BCCC'};
  font-weight: 500;
  transition: all 0.2s ease;

  ${({ active }) => active && css`
    color: ${props => props.theme.colors?.primary || '#E63757'};
    border-bottom-color: ${props => props.theme.colors?.primary || '#E63757'};
  `}

  &:hover {
    color: ${props => props.theme.colors?.primary || '#E63757'};
  }
`

export const RefreshButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  margin-left: auto;
  color: ${props => props.theme.colors?.headingColor || '#344054'};
  border-radius: 8px;
  transition: all 0.2s ease;

  svg {
    font-size: 18px;
  }

  &:hover {
    background-color: ${props => props.theme.colors?.backgroundHover || '#F8F9FA'};
    color: ${props => props.theme.colors?.primary || '#E63757'};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

export const ActionsWrapper = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;

  button {
    max-width: 150px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`

export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-top: 15px;

  th, td {
    padding: 12px 10px;
    text-align: left;
    border-bottom: 1px solid ${props => props.theme.colors?.borderColor || '#E9ECEF'};
  }
`

export const Thead = styled.thead`
  tr {
    th {
      font-weight: 600;
      font-size: 14px;
      color: ${props => props.theme.colors?.headingColor || '#344054'};
    }
  }
`

export const Tbody = styled.tbody`
  tr {
    cursor: pointer;
    transition: background-color 0.2s ease;

    &:hover {
      background-color: ${props => props.theme.colors?.backgroundHover || '#F8F9FA'};
    }

    &.readonly {
      opacity: 0.7;
      cursor: default;
    }

    td {
      font-size: 14px;
      color: ${props => props.theme.colors?.textColor || '#344054'};
    }
  }
`

export const CheckBoxWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  svg {
    font-size: 18px;
    color: ${props => props.isChecked
      ? (props.theme.colors?.primary || '#E63757')
      : (props.theme.colors?.disabled || '#B1BCCC')};
  }
`

export const FeeIdWrapper = styled.div`
  font-weight: 500;
`

export const FeeNameWrapper = styled.div`
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
  max-width: 200px;
`

export const StatusWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;

  p {
    margin: 0;
    font-size: 14px;
  }

  .enable_control {
    display: flex;
    align-items: center;
  }
`

export const Badge = styled.span`
  display: inline-block;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
  text-transform: uppercase;

  ${({ type }) => {
    switch (type) {
      case 'order_fee':
        return css`
          background-color: #E7F1FF;
          color: #0D6EFD;
        `
      case 'manual_charge':
        return css`
          background-color: #D1F2EB;
          color: #198754;
        `
      case 'manual_credit':
        return css`
          background-color: #FFEBE9;
          color: #DC3545;
        `
      default:
        return css`
          background-color: ${props => props.theme.colors?.primaryContrast || '#FFF2F4'};
          color: ${props => props.theme.colors?.primary || '#E63757'};
        `
    }
  }}
`

export const PagesBottomContainer = styled.div`
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
`

export const EmptyWrapper = styled.div`
  padding: 40px 20px;
  text-align: center;
  color: ${props => props.theme.colors?.disabled || '#B1BCCC'};
  font-size: 14px;
`

export const FormContainer = styled.div`
  padding: 20px;
`

export const FormHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;

  h2 {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
  }
`

export const FormSection = styled.div`
  margin-bottom: 20px;
`

export const SectionTitle = styled.h3`
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 15px;
  color: ${props => props.theme.colors?.headingColor || '#344054'};
`

export const FieldsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
`

export const Field = styled.div`
  flex: 1;
  min-width: 200px;

  label {
    display: block;
    margin-bottom: 5px;
    font-size: 13px;
    font-weight: 500;
    color: ${props => props.theme.colors?.headingColor || '#344054'};
  }
`

export const CheckboxRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 15px;

  label {
    font-size: 14px;
    color: ${props => props.theme.colors?.textColor || '#344054'};
  }
`

export const FormActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid ${props => props.theme.colors?.borderColor || '#E9ECEF'};
`

export const AmountWrapper = styled.div`
  font-weight: 500;

  ${({ isNegative }) => isNegative && css`
    color: #DC3545;
  `}

  ${({ isPositive }) => isPositive && css`
    color: #198754;
  `}
`

export const OrderLinkWrapper = styled.a`
  color: ${props => props.theme.colors?.primary || '#E63757'};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`

export const EventFormContainer = styled.div`
  padding: 25px;
`

export const EventFormHeader = styled.div`
  margin-bottom: 25px;
  padding-bottom: 15px;
  border-bottom: 1px solid ${props => props.theme.colors?.borderColor || '#E9ECEF'};

  h2 {
    font-size: 20px;
    font-weight: 700;
    margin: 0;
    color: ${props => props.theme.colors?.headingColor || '#344054'};
  }
`

export const EventTypeSelector = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
`

export const EventTypeOption = styled.div`
  flex: 1;
  padding: 16px;
  border-radius: 8px;
  border: 2px solid ${props => props.isSelected
    ? (props.theme.colors?.primary || '#E63757')
    : (props.theme.colors?.borderColor || '#E9ECEF')};
  background: ${props => props.isSelected
    ? (props.theme.colors?.primaryContrast || '#FFF2F4')
    : 'transparent'};
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;

  &:hover {
    border-color: ${props => props.theme.colors?.primary || '#E63757'};
  }

  .icon {
    font-size: 24px;
    margin-bottom: 8px;
    color: ${props => props.isSelected
      ? (props.isCharge ? '#DC3545' : '#198754')
      : (props.theme.colors?.disabled || '#B1BCCC')};
  }

  .label {
    font-size: 14px;
    font-weight: 600;
    color: ${props => props.isSelected
      ? (props.theme.colors?.headingColor || '#344054')
      : (props.theme.colors?.disabled || '#B1BCCC')};
  }

  .description {
    font-size: 12px;
    color: ${props => props.theme.colors?.disabled || '#B1BCCC'};
    margin-top: 4px;
  }
`

export const EventFormField = styled.div`
  margin-bottom: 20px;

  label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 600;
    color: ${props => props.theme.colors?.headingColor || '#344054'};

    span {
      color: #DC3545;
      margin-left: 2px;
    }
  }

  input {
    width: 100%;
    padding: 12px 14px;
    border: 1px solid ${props => props.theme.colors?.borderColor || '#E9ECEF'};
    border-radius: 8px;
    font-size: 14px;
    transition: border-color 0.2s ease;

    &:focus {
      outline: none;
      border-color: ${props => props.theme.colors?.primary || '#E63757'};
    }

    &::placeholder {
      color: ${props => props.theme.colors?.disabled || '#B1BCCC'};
    }
  }
`

export const AmountInputWrapper = styled.div`
  position: relative;

  .currency-symbol {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 14px;
    font-weight: 500;
    color: ${props => props.theme.colors?.headingColor || '#344054'};
  }

  input {
    padding-left: 30px;
  }
`

export const EventFormHint = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding: 10px 12px;
  background: ${props => props.isCredit ? '#D1F2EB' : '#FFF3CD'};
  border-radius: 6px;
  font-size: 13px;
  color: ${props => props.isCredit ? '#198754' : '#856404'};

  svg {
    flex-shrink: 0;
  }
`

export const EventFormActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 25px;
  padding-top: 20px;
  border-top: 1px solid ${props => props.theme.colors?.borderColor || '#E9ECEF'};
`
