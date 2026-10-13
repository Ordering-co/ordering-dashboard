import styled from 'styled-components'

export const CustomerFeesContainer = styled.div`
  flex: 1;
  overflow: auto;
  margin-top: 20px;
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

export const ConditionsColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  min-width: 110px;
  max-width: 170px;
`

export const ConditionBadge = styled.span`
  display: block;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 4px;
  background-color: ${props => props.theme.colors?.primaryContrast || '#FFF2F4'};
  color: ${props => props.theme.colors?.primary || '#E63757'};
  line-height: 1.3;
  max-width: 100%;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
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
  width: 100%;
  height: 100%;
  overflow: auto;
  padding: 20px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
`

export const FormHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;

  > div:first-child {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;

    h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      display: -webkit-box;
      line-clamp: 2;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      max-width: 90%;
    }

    > label {
      margin: 0;
    }
  }
`

export const FormSection = styled.div`
  flex: 1;
  margin-bottom: 20px;
`

export const FieldsColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

export const FieldsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;

  > div {
    flex: 1;
    min-width: 200px;
  }
`

export const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;

  label {
    font-size: 14px;
    font-weight: 500;
    color: ${props => props.theme.colors?.headingColor || '#344054'};
  }

  .select, .multi-select {
    background: ${props => props.theme.colors?.secundary || '#F8F9FA'};
    border: none;

    > div:first-child {
      padding-top: 5px;
      padding-bottom: 5px;
    }
  }
`

export const FieldHint = styled.div`
  font-size: 12px;
  color: ${props => props.theme.colors?.disabled || '#B1BCCC'};
  line-height: 1.4;
  margin-top: 2px;
`

export const FormActions = styled.div`
  display: flex;
  gap: 10px;
  margin-top: auto;
  padding-top: 20px;
  justify-content: flex-end;
`

export const LegacyFeeContainer = styled.div`
  display: flex;
  flex-direction: column;
  margin-top: 20px;
  margin-bottom: 20px;

  .legacy-field {
    display: flex;
    flex-direction: column;
    margin-bottom: 30px;

    label {
      font-size: 14px;
      margin-bottom: 11px;
    }

    input {
      font-size: 14px;
    }
  }

  > button {
    width: 100%;
  }
`

export const DateToggleWrapper = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid ${props => props.theme.colors?.borderColor || '#E9ECEF'};
  margin-bottom: 12px;

  > div {
    display: flex;
    flex-direction: column;
    gap: 2px;

    > span {
      font-size: 14px;
      font-weight: 500;
      color: ${props => props.theme.colors?.headingColor || '#344054'};
    }
  }
`
