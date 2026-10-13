import styled, { css } from 'styled-components'

export const Container = styled.div`
  flex: 1;
  padding: 20px;
  box-sizing: border-box;
  transition: all 0.5s;
  max-height: 100vh;
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

export const HeaderActions = styled.div`
  margin-left: auto;
  display: flex;
  align-items: center;
`

export const ReloadButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid ${props => props.theme.colors?.borderColor || '#E9ECEF'};
  background: ${props => props.theme.colors?.white || '#FFF'};
  color: ${props => props.theme.colors?.headingColor || '#344050'};
  font-size: 14px;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: ${props => props.theme.colors?.lightPrimary || '#E9F2FE'};
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }

  svg {
    width: 16px;
    height: 16px;
  }
`

export const FiltersContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
`

export const FilterItem = styled.div`
  min-width: 220px;
  flex: 0 1 auto;
`

export const Option = styled.div`
  display: flex;
  align-items: center;

  span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`

export const KpiRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
`

export const KpiCard = styled.div`
  border: 1px solid ${props => props.theme.colors?.borderColor || '#E9ECEF'};
  border-radius: 8px;
  padding: 16px 20px;
  background: ${props => props.theme.colors?.white || '#FFF'};
`

export const KpiLabel = styled.div`
  color: ${props => props.theme.colors?.lightGray || '#909BA9'};
  font-size: 13px;
  margin-bottom: 8px;
`

export const KpiValue = styled.div`
  color: ${props => props.theme.colors?.headingColor || '#344050'};
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
`

export const KpiSub = styled.div`
  color: ${props => props.alert
    ? (props.theme.colors?.danger || '#E63757')
    : (props.theme.colors?.lightGray || '#909BA9')};
  font-size: 13px;
  margin-top: 8px;
  font-weight: ${props => props.alert ? '600' : 'normal'};
`

export const TableWrapper = styled.div`
  border: 1px solid ${props => props.theme.colors?.borderColor || '#E9ECEF'};
  border-radius: 8px;
  overflow-x: auto;
`

export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
`

export const Th = styled.th`
  text-align: ${props => props.align || 'left'};
  color: ${props => props.theme.colors?.lightGray || '#909BA9'};
  font-weight: 600;
  padding: 12px 16px;
  border-bottom: 1px solid ${props => props.theme.colors?.borderColor || '#E9ECEF'};
  white-space: nowrap;
`

export const Tr = styled.tr`
  ${props => props.highlighted && css`
    background: ${props.theme.colors?.danger100 || '#FEEDF0'};

    td {
      border-bottom-color: ${props.theme.colors?.secundaryLight || '#B1BCCC'};
    }
  `}
`

export const Td = styled.td`
  text-align: ${props => props.align || 'left'};
  color: ${props => props.theme.colors?.headingColor || '#344050'};
  padding: 12px 16px;
  border-bottom: 1px solid ${props => props.theme.colors?.borderColor || '#E9ECEF'};
  white-space: nowrap;
`

export const ConnectedValue = styled.span`
  font-weight: 700;
  color: ${props => props.zero
    ? (props.theme.colors?.danger || '#E63757')
    : (props.theme.colors?.headingColor || '#344050')};
`

export const TableFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 16px;
`

export const EmptyState = styled.div`
  padding: 40px 16px;
  text-align: center;
  color: ${props => props.theme.colors?.lightGray || '#909BA9'};
`
