import styled, { css, keyframes } from 'styled-components'

const statusColor = (theme, status) => {
  const colors = theme?.colors || {}
  if (status === 'exceeded') return colors.danger || '#E63757'
  if (status === 'warning') return colors.warning || '#FFC700'
  if (status === 'ok') return colors.success || '#00D27A'
  return colors.secundaryLight || '#B1BCCC'
}

const muted = props => props.theme.colors?.secundaryContrast || '#748194'
const heading = props => props.theme.colors?.headingColor || '#344050'
const border = props => props.theme.colors?.borderColor || '#E9ECEF'

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
`

export const Toolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
`

export const SearchWrapper = styled.div`
  flex: 1;
  min-width: 200px;
  max-width: 320px;

  > div {
    width: 100%;
  }

  input {
    height: 36px;
    padding-top: 0;
    padding-bottom: 0;
    font-size: 13px;
  }
`

export const ToolbarActions = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
`

export const RefreshButton = styled.button`
  appearance: none;
  position: relative;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid ${border};
  border-radius: 7.6px;
  background: transparent;
  font-size: 13px;
  color: ${heading};
  cursor: pointer;

  svg {
    width: 14px;
    height: 14px;
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }

  &:not(:disabled):hover {
    border-color: ${props => props.theme.colors?.primary || '#2C7BE5'};
  }
`

const drain = keyframes`
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
`

/** Seconds left before Refresh works again, next to the label. */
export const CooldownCount = styled.span`
  min-width: 26px;
  font-variant-numeric: tabular-nums;
  color: ${muted};
`

/** Thin bar along the bottom of the button that empties over the cooldown. */
export const CooldownBar = styled.span`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  transform-origin: left center;
  background: ${props => props.theme.colors?.primary || '#2C7BE5'};
  animation: ${drain} ${props => props.$durationMs}ms linear forwards;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    opacity: 0.4;
  }
`

export const Notice = styled.div`
  padding: 12px 14px;
  border-radius: 7.6px;
  font-size: 13px;
  line-height: 18px;
  color: ${heading};
  background: ${props => props.$tone === 'danger'
    ? (props.theme.colors?.danger100 || '#FEEDF0')
    : (props.theme.colors?.warning100 || '#FFF9E2')};
`

export const EmptyState = styled.div`
  padding: 32px 16px;
  border: 1px dashed ${border};
  border-radius: 7.6px;
  text-align: center;

  h3 {
    margin: 0 0 6px;
    font-size: 15px;
    font-weight: 600;
    color: ${heading};
  }

  p {
    margin: 0;
    font-size: 13px;
    line-height: 18px;
    color: ${muted};
  }
`

export const LimitList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
`

export const LimitCard = styled.li`
  padding: 14px 16px;
  border: 1px solid ${border};
  border-radius: 7.6px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`

export const CardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
`

export const CardTitle = styled.h3`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  color: ${heading};
  word-break: break-word;
`

export const CardMeta = styled.p`
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 16px;
  color: ${muted};
`

export const StatusBadge = styled.span`
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 50px;
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
  white-space: nowrap;
  color: ${props => props.$status === 'warning' ? heading(props) : '#FFF'};
  background: ${props => statusColor(props.theme, props.$status)};

  ${props => !props.$status && css`
    color: ${heading(props)};
    background: ${border(props)};
  `}
`

export const ProgressTrack = styled.div`
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  background: ${props => props.theme.colors?.secundary || '#F8F9FA'};
  box-shadow: inset 0 0 0 1px ${border};
`

export const ProgressFill = styled.div`
  height: 100%;
  width: ${props => props.$pct}%;
  background: ${props => statusColor(props.theme, props.$status)};
  transition: width 0.3s ease;
`

export const CardFooter = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px 16px;
  flex-wrap: wrap;
  font-size: 13px;
  color: ${heading};
`

export const UsageText = styled.span`
  strong {
    font-weight: 600;
  }
`

export const Percent = styled.span`
  margin-left: 6px;
  color: ${props => props.$status === 'exceeded' ? statusColor(props.theme, 'exceeded') : muted(props)};
  font-weight: ${props => props.$status === 'exceeded' ? 600 : 400};
`

export const FooterMeta = styled.span`
  font-size: 12px;
  color: ${muted};
`
