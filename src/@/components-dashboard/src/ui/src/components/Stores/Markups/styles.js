import styled, { css } from 'styled-components'

export const MarkupsContainer = styled.div`
  flex: 1;
  padding: 20px;
  box-sizing: border-box;
  transition: all 0.5s;
  overflow: hidden;
`

export const HeaderContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  flex-direction: column;

  @media (min-width: 768px) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
`

export const HeaderTitleContainer = styled.div`
  flex: 1;
  display: flex;
  align-items: center;

  > h1 {
    font-size: 20px;
    margin: 0px;
    font-weight: 600;
    color: ${props => props.theme.colors.headingColor};
    white-space: nowrap;
    text-transform: capitalize;
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

export const ActionsWrapper = styled.div`
  display: flex;
  align-items: center;

  > button {
    height: 41px;
    width: 90px;
    white-space: nowrap;
    ${props => props.theme?.rtl
? css`
      margin-left: 15px;
    `
: css`
      margin-right: 15px;
    `}
    @media (min-width: 768px) {
      width: unset;
    }
  }
`

export const Table = styled.table`
  width: 100%;
  margin-top: 20px;
  border-collapse: collapse;
  background: ${props => props.theme.colors.backgroundPage};
`

export const Thead = styled.thead`
  th {
    text-align: left;
    font-size: 12px;
    font-weight: 600;
    padding: 12px 10px;
    color: ${props => props.theme.colors.grayColor};
    border-bottom: 1px solid ${props => props.theme.colors.borderColor};
  }
`

export const Tbody = styled.tbody`
  td {
    padding: 14px 10px;
    border-bottom: 1px solid ${props => props.theme.colors.borderColor};
    font-size: 14px;
    color: ${props => props.theme.colors.headingColor};
    vertical-align: middle;
  }
  tr:hover {
    background-color: ${props => props.theme.colors.lightPrimary};
  }
`

export const CheckBoxWrapper = styled.div`
  cursor: pointer;
  display: flex;
  ${props => props.theme?.rtl
? css`
    margin-left: 10px;
  `
: css`
    margin-right: 10px;
  `}
  svg {
    font-size: 16px;
    color: ${props => props.theme.colors.secundaryLight};
  }

  ${({ isChecked }) => isChecked && css`
    svg {
      color: ${props => props.theme.colors?.primary};
    }
  `}
`

export const MarkupIdWrapper = styled.div`
  display: flex;
  align-items: center;
`

export const StatusWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;

  p {
    margin: 0;
    font-size: 12px;
    color: ${props => props.theme.colors.grayColor};
    text-transform: capitalize;
  }

  .enable_control {
    opacity: 0.85;
  }
`

export const PagesBottomContainer = styled.div`
  margin-top: 15px;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
`

export const EmptyWrapper = styled.div`
  margin-top: 20px;
  padding: 20px;
  border: 1px dashed ${props => props.theme.colors.borderColor};
  border-radius: 8px;
  color: ${props => props.theme.colors.grayColor};
`

export const DetailsContainer = styled.div`
  width: 100%;
  height: 100%;
  overflow: auto;
  padding: 20px;
  box-sizing: border-box;
`

export const DetailsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 15px;

  ${props => props.theme?.rtl
? css`
    margin-left: 35px;
  `
: css`
    margin-right: 35px;
  `}

  > div:first-child {
    display: flex;
    align-items: center;
    gap: 12px;

    h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      max-width: 350px;
    }

    > label {
      margin: 0;
    }
  }
`

export const RightHeader = styled.div`
  display: flex;
  align-items: center;
`

export const FormContainer = styled.div`
  padding: 20px;
`

export const FormTitle = styled.h2`
  font-size: 18px;
  margin: 0 0 15px 0;
  font-weight: 600;
  color: ${props => props.theme.colors.headingColor};
`

export const FormSection = styled.div`
  margin-bottom: 16px;
`

export const SectionTitle = styled.p`
  font-size: 12px;
  font-weight: 600;
  color: ${props => props.theme.colors.grayColor};
  text-transform: uppercase;
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
    min-width: 240px;
  }
`

export const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  label {
    font-size: 14px;
  }

  .select, .multi-select {
    background: ${props => props.theme.colors.secundary};
    border: none;

    > div:first-child {
      padding-top: 4px;
      padding-bottom: 4px;
    }
  }

  .select {
    div {
      max-height: 300px;
    }
  }

`

export const CheckboxRow = styled.label`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: ${props => props.theme.colors.headingColor};

  input {
    width: 16px;
    height: 16px;
  }
`

export const FormActions = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 18px;
  flex-wrap: wrap;

  button {
    height: 44px;

    &:disabled {
      opacity: 0.5;
    }
  }

`

export const ErrorText = styled.p`
  margin: 10px 0 0 0;
  color: ${props => props.theme.colors.danger500 || '#dc3545'};
  font-size: 13px;
`
