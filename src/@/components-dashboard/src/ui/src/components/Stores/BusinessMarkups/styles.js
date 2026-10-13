import styled, { css } from 'styled-components'

export const BusinessMarkupsContainer = styled.div`
  padding: 20px;
  box-sizing: border-box;
`

export const Container = styled.div`
  padding: 20px;
  overflow: auto;
  transition: 0.3s;

  > button {
    height: 42px;
    width: 100%;
    margin-top: 20px;
  }

  @media (min-width: 1000px) {
    max-width: 500px;
    width: 0;
    ${props => props.theme?.rtl
? css`
      border-right: 1px solid ${props => props.theme.colors.borderColor};
    `
: css`
      border-left: 1px solid ${props => props.theme.colors.borderColor};
    `}
  }
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
    font-size: 18px;
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
  }
`

export const ActionsWrapper = styled.div`
  display: flex;
  align-items: center;
  margin-right: 15px;
  > button {
    height: 41px;
    white-space: nowrap;
    ${props => props.theme?.rtl
? css`
      margin-left: 15px;
    `
: css`
      margin-right: 15px;
    `}
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

  tr.readonly {
    cursor: not-allowed;
    opacity: 0.85;
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
    position: relative;
    top: 3px;
  }
`

export const Badge = styled.span`
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: ${props => props.theme.colors.secundary};
  color: ${props => props.theme.colors.headingColor};
  border: 1px solid ${props => props.theme.colors.borderColor};
  margin-left: 8px;
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
