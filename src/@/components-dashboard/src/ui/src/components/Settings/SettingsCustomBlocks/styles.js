import styled, { css } from 'styled-components'

export const BlocksStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 28px;
  margin: 20px 0 8px;
`

export const Block = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

export const BlockHeader = styled.div``

export const BlockTitle = styled.h3`
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 20px;
  color: ${props => props.theme.colors.headingColor};
`

export const BlockHelp = styled.p`
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 18px;
  color: ${props => props.theme.colors.secundaryContrast};
`

export const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;

  ${({ $focused }) => $focused && css`
    box-shadow: inset 3px 0 0 ${props => props.theme.colors.primary};
    padding-left: 12px;
  `}
`

export const FieldLabel = styled.label`
  font-weight: 600;
  font-size: 14px;
  color: ${props => props.theme.colors.headingColor};
`

export const FieldHelp = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 18px;
  color: ${props => props.theme.colors.secundaryContrast};
`

export const FieldControl = styled.input`
  font-size: 14px;
  height: 44px;
  border: 1px solid ${({ $invalid, theme }) => $invalid ? '#E63757' : '#DEE2E6'};
  box-sizing: border-box;
  border-radius: 7.6px;
  padding: 0 12px;
  width: 100%;
`

export const FieldError = styled.p`
  margin: 0;
  font-size: 12px;
  line-height: 16px;
  color: #E63757;
`

export const FieldSelect = styled.select`
  font-size: 14px;
  height: 44px;
  border: 1px solid #DEE2E6;
  box-sizing: border-box;
  border-radius: 7.6px;
  padding: 0 12px;
  width: 100%;
  background: ${props => props.theme.colors.backgroundPage};
  color: ${props => props.theme.colors.headingColor};
`

export const PreviewList = styled.ul`
  margin: 0;
  padding: 12px 14px;
  list-style: none;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 8px;
  background: ${props => props.theme.colors.secundary};
`

export const PreviewItem = styled.li`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  line-height: 20px;
  color: ${props => props.theme.colors.headingColor};

  & + & {
    margin-top: 4px;
  }

  span:last-child {
    font-weight: 600;
  }
`

export const ToggleRow = styled.label`
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

export const CompactTable = styled.div`
  overflow-x: auto;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 8px;
`

export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;

  th, td {
    padding: 10px 12px;
    text-align: left;
    border-bottom: 1px solid ${props => props.theme.colors.borderColor};
    vertical-align: middle;
  }

  th {
    font-size: 12px;
    font-weight: 600;
    color: ${props => props.theme.colors.lightGray};
    background: ${props => props.theme.colors.secundary};
  }

  tr:last-child td {
    border-bottom: 0;
  }

  input[type='text'],
  input[type='number'],
  input[type='password'],
  select {
    width: 100%;
    min-width: 88px;
    height: 36px;
    border: 1px solid #DEE2E6;
    border-radius: 6px;
    padding: 0 8px;
    font-size: 13px;
  }
`

export const LoyaltySection = styled.section`
  margin-top: 28px;
  padding-top: 8px;
`
