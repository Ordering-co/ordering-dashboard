import styled from 'styled-components'

export const SchoolsContainer = styled.div`
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  max-height: 100vh;
  overflow: auto;
  padding: 20px;

  @media (min-width: 768px) {
    padding: 20px 25px;
  }
`

export const SchoolsHeader = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
`

export const SchoolsTitle = styled.p`
  margin: 0;
  font-size: 20px;
  font-weight: bold;
  line-height: 1.2;
  color: ${({ theme }) => theme?.colors?.headingColor || '#151b26'};
`

export const SchoolsHeaderActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-left: auto;

  > button {
    min-height: 43px;
    padding: 0 20px;
    font-size: 14px;
    white-space: nowrap;
  }
`

export const TextButton = styled.button`
  background: transparent;
  border: none;
  padding: 6px 4px;
  font-size: 14px;
  font-weight: 500;
  color: ${({ theme }) => theme?.colors?.danger || '#E63757'};
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    text-decoration: underline;
  }

  &:disabled {
    color: ${({ theme }) => theme?.colors?.disabled || '#B1BCCC'};
    cursor: not-allowed;
    text-decoration: none;
  }
`

export const SchoolModuleDisabledStage = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: min(420px, calc(100vh - 160px));
  padding: 16px 8px 48px;
`

export const SchoolModulePanel = styled.section`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 640px;
  padding: 8px 16px;
  text-align: center;
`

export const SchoolModulePanelTitle = styled.h2`
  margin: 0 0 12px 0;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.25;
  color: ${({ theme }) => theme?.colors?.headingColor || '#151b26'};
`

export const SchoolModulePanelText = styled.p`
  margin: 0;
  max-width: 58ch;
  font-size: 15px;
  line-height: 1.6;
  color: ${({ theme }) => theme?.colors?.secundaryText || '#748194'};

  & + & {
    margin-top: 16px;
    font-weight: 500;
    color: ${({ theme }) => theme?.colors?.headingColor || '#151b26'};
  }
`

export const SchoolModulePanelActions = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 28px;

  > button {
    min-height: 43px;
    padding: 0 24px;
    font-size: 14px;
    white-space: nowrap;
  }
`

export const SchoolSelectorWrapper = styled.div`
  .select {
    width: fit-content;
    min-width: 200px;
    max-width: 500px;
  }

  .list {
    width: 100% !important;
    min-width: 100% !important;
    left: 0 !important;
    right: auto !important;
  }
`

export const TabsWrapper = styled.div`
  display: flex;
  gap: 8px;
  border-bottom: 1px solid ${({ theme }) => theme?.colors?.borderColor || '#E9ECEF'};
  margin-bottom: 20px;
  flex-wrap: wrap;
`

export const Tab = styled.button`
  background: transparent;
  border: none;
  border-bottom: 2px solid ${({ active, theme }) => (active ? (theme?.colors?.primary || '#1907C7') : 'transparent')};
  color: ${({ active, theme }) => (active ? (theme?.colors?.primary || '#1907C7') : (theme?.colors?.secundaryText || '#748194'))};
  font-weight: ${({ active }) => (active ? 600 : 400)};
  padding: 10px 14px;
  cursor: pointer;
  font-size: 14px;
  white-space: nowrap;
`

export const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-end;
  margin-top: 10px;
  margin-bottom: 16px;

  > div {
    min-width: 180px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  label {
    font-size: 13px;
    font-weight: 500;
    color: ${({ theme }) => theme?.colors?.headingColor || '#263238'};
  }

  input {
    width: 100%;
    box-sizing: border-box;
    height: 43px;
  }

  .select {
    width: 100%;
    box-sizing: border-box;
    font-size: 14px;
  }

  .select > div:first-child {
    min-height: 43px;
  }
`

export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;

  th, td {
    text-align: start;
    padding: 12px 10px;
    border-bottom: 1px solid ${({ theme }) => theme?.colors?.borderColor || '#E9ECEF'};
    font-size: 13px;
  }

  th {
    color: ${({ theme }) => theme?.colors?.secundaryText || '#748194'};
    font-weight: 600;
  }
`

export const RowActions = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
`

export const FormGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 4px 2px 4px;

  > div {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: ${({ theme }) => theme?.colors?.headingColor || '#263238'};
  }

  input,
  textarea {
    width: 100%;
    box-sizing: border-box;
  }

  input {
    height: 43px;
  }

  .select {
    width: 100%;
    font-size: 14px;
  }

  .select > div:first-child {
    min-height: 43px;
  }
`

export const FormActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;

  button {
    min-height: 43px;
    padding: 0 24px;
    font-size: 14px;
  }
`

export const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`

export const Chip = styled.span`
  background: ${({ theme }) => theme?.colors?.primary || '#1907C7'};
  color: ${({ theme }) => theme?.colors?.primaryContrast || '#FFF'};
  border-radius: 12px;
  padding: 3px 10px;
  font-size: 12px;
`

export const EmptyState = styled.div`
  padding: 40px 10px;
  text-align: center;
  color: ${({ theme }) => theme?.colors?.secundaryText || '#748194'};
`

export const ReportsWrapper = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
  margin-top: 8px;
`

export const ReportCard = styled.div`
  border: 1px solid ${({ theme }) => theme?.colors?.borderColor || '#E9ECEF'};
  border-radius: 8px;
  padding: 16px;

  h3 {
    margin: 0 0 6px 0;
    font-size: 15px;
  }

  p {
    margin: 0 0 14px 0;
    font-size: 13px;
    color: ${({ theme }) => theme?.colors?.secundaryText || '#748194'};
  }
`

export const ReportActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  button {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  svg {
    width: 16px;
    height: 16px;
  }
`
