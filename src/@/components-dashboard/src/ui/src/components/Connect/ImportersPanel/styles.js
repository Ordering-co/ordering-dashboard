import styled, { css } from 'styled-components'
import { Button } from '../../../styles'

export const PanelContainer = styled.div`
  width: 100%;
  box-sizing: border-box;
  padding: 20px;
  position: relative;
  overflow-x: hidden;

  @media (min-width: 768px) {
    min-width: 460px;
  }
`

export const DetailsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-right: 40px;

  ${props => props.theme?.rtl && css`
    padding-right: 0;
    padding-left: 40px;
  `}
`

export const BusinessName = styled.h1`
  color: ${props => props.theme.colors.headingColor};
  font-size: 20px;
  margin: 0px;
  font-weight: 700;
  flex: 1;
`

export const SectionLabel = styled.h2`
  color: ${props => props.theme.colors.headingColor};
  font-size: 14px;
  margin: 20px 0 10px;
  padding-bottom: 20px;
  font-weight: 700;
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};
`

export const ImportersList = styled.div`
  display: flex;
  flex-direction: column;
`

export const ImporterRowContainer = styled.div`
  margin-top: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
`

export const ImporterInfo = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;

  button {
    min-height: 40px;
    flex-shrink: 0;
  }

  .connect-pos {
    display: flex;
    align-items: flex-start;
    flex: 1;
    min-width: 0;
  }
`

export const ImporterLogo = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background-color: ${({ $color }) => $color};
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
  margin-right: 10px;

  ${props => props.theme?.rtl && css`
    margin-right: 0;
    margin-left: 10px;
  `}
`

export const ImporterText = styled.div`
  min-width: 0;

  p {
    margin: 0;
  }

  .title {
    font-size: 14px;
    font-weight: 600;
    color: ${props => props.theme.colors.headingColor};
    margin-bottom: 4px;
  }

  .description {
    font-size: 12px;
    color: ${props => props.theme.colors.lightGray || '#909BA9'};
    line-height: 1.4;
  }
`

export const ImporterNote = styled.p`
  margin: 8px 0 0 !important;
  font-size: 11px;
  line-height: 1.4;
  color: ${props => props.theme.colors.warning || '#FFC700'};
`

export const TabsRow = styled.div`
  display: flex;
  align-items: center;
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};
  margin: 18px 0 16px;
`

export const PanelTab = styled.button`
  appearance: none;
  background: transparent;
  border: 0;
  padding: 10px 0;
  margin-right: 28px;
  cursor: pointer;
  color: ${props => props.theme.colors?.lightGray || '#909BA9'};
  white-space: nowrap;
  font-size: 12px;
  font-weight: 500;

  ${props => props.theme?.rtl && css`
    margin-right: 0;
    margin-left: 28px;
  `}

  ${({ $active }) => $active && css`
    color: ${props => props.theme.colors.headingColor};
    border-bottom: 2px solid ${props => props.theme.colors.headingColor};
    font-size: 14px;
  `}
`

export const CapacityHint = styled.p`
  margin: 0 0 12px;
  font-size: 12px;
  color: ${props => props.theme.colors.lightGray || '#909BA9'};
`

export const FilterScrollWrap = styled.div`
  margin-bottom: 16px;
`

export const FilterRow = styled.div`
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  width: max-content;
  min-width: 100%;
`

export const FilterChip = styled.button`
  appearance: none;
  border: 1px solid ${props => props.theme.colors.borderColor};
  background: ${props => props.$active
    ? (props.theme.colors.primaryContrast || '#F5F6F8')
    : 'transparent'};
  color: ${props => props.$active
    ? props.theme.colors.headingColor
    : (props.theme.colors.lightGray || '#909BA9')};
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  min-height: 32px;
  white-space: nowrap;
  flex-shrink: 0;

  &:hover {
    color: ${props => props.theme.colors.headingColor};
  }
`

export const LogsList = styled.div`
  display: flex;
  flex-direction: column;
`

export const LogsSelectionBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
  min-height: 36px;
`

export const LogsSelectionLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`

export const LogsSelectionLabel = styled.button`
  appearance: none;
  border: 0;
  background: transparent;
  padding: 0;
  font-size: 12px;
  font-weight: 500;
  color: ${props => props.theme.colors.headingColor};
  cursor: pointer;

  &:hover {
    color: ${props => props.theme.colors.primary};
  }
`

export const LogsSelectionCount = styled.span`
  font-size: 12px;
  color: ${props => props.theme.colors.lightGray || '#909BA9'};
`

export const LogsDeleteButton = styled(Button)`
  min-height: 36px;
  padding: 0 14px;
  flex-shrink: 0;
`

export const LogRowSelect = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding-top: 2px;

  ${props => props.theme?.rtl && css`
    margin-left: 0;
  `}
`

export const LogRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};
  animation: importerLogRowIn 220ms ease both;
  border-radius: 8px;
  transition: background-color 0.15s ease;

  ${({ $selected, theme }) => $selected && css`
    background: ${theme.colors.primaryContrast || '#F5F6F8'};
    margin: 0 -8px;
    padding-left: 8px;
    padding-right: 8px;
  `}

  &:last-child {
    border-bottom: none;
  }

  button {
    min-height: 40px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
  }

  @keyframes importerLogRowIn {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`

export const LogRowMain = styled.div`
  display: flex;
  align-items: flex-start;
  min-width: 0;
  flex: 1;

  .title {
    margin: 0 0 4px;
    font-size: 14px;
    font-weight: 600;
    color: ${props => props.theme.colors.headingColor};
  }
`

export const LogMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 12px;
  color: ${props => props.theme.colors.lightGray || '#909BA9'};
  margin-bottom: 4px;
`

export const LogStatus = styled.span`
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  color: ${({ $tone, theme }) => {
    if ($tone === 'ready') return theme.colors.success || '#28A745'
    if ($tone === 'failed' || $tone === 'skipped_too_large') return theme.colors.danger || '#E63757'
    return theme.colors.lightGray || '#909BA9'
  }};
`

export const EmptyLogs = styled.p`
  margin: 24px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: ${props => props.theme.colors.lightGray || '#909BA9'};
`

export const LogsSkeletonList = styled.div`
  display: flex;
  flex-direction: column;
`

export const LogsSkeletonRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};

  &:last-child {
    border-bottom: none;
  }
`

export const LogsSkeletonMain = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex: 1;
  min-width: 0;
`

export const LogsEmptyState = styled.div`
  margin-top: 8px;
  padding: 28px 16px;
  text-align: center;
  border: 1px dashed ${props => props.theme.colors.borderColor};
  border-radius: 12px;
  background: ${props => props.theme.colors.primaryContrast || '#FAFBFC'};
`

export const LogsEmptyIcon = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin: 0 auto 12px;
  border-radius: 12px;
  color: ${props => props.theme.colors.lightGray || '#909BA9'};
  background: ${props => props.theme.colors.backgroundPage || '#fff'};
  border: 1px solid ${props => props.theme.colors.borderColor};
`

export const LogsEmptyTitle = styled.h3`
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
  color: ${props => props.theme.colors.headingColor};
`

export const LogsEmptyBody = styled.p`
  margin: 0 auto 16px;
  max-width: 320px;
  font-size: 13px;
  line-height: 1.5;
  color: ${props => props.theme.colors.lightGray || '#909BA9'};
`

export const LogsEmptySteps = styled.ol`
  margin: 0 auto 20px;
  padding: 0;
  list-style: none;
  max-width: 320px;
  text-align: left;

  li {
    position: relative;
    margin: 0 0 8px;
    padding-left: 28px;
    font-size: 12px;
    line-height: 1.45;
    color: ${props => props.theme.colors.lightGray || '#909BA9'};

    &:last-child {
      margin-bottom: 0;
    }

    &::before {
      content: attr(data-step);
      position: absolute;
      left: 0;
      top: 0;
      width: 18px;
      height: 18px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 600;
      color: ${props => props.theme.colors.headingColor};
      background: ${props => props.theme.colors.backgroundPage || '#fff'};
      border: 1px solid ${props => props.theme.colors.borderColor};
    }
  }
`

export const LogsFilterEmpty = styled.p`
  margin: 20px 0 0;
  padding: 16px;
  text-align: center;
  font-size: 13px;
  line-height: 1.5;
  color: ${props => props.theme.colors.lightGray || '#909BA9'};
  border-radius: 8px;
  background: ${props => props.theme.colors.primaryContrast || '#F5F6F8'};
`
