import styled, { css, keyframes } from 'styled-components'
import { darken } from 'polished'
import { ASSISTANT_PANEL_WIDTH } from '../../utils/assistantDock'
import { ASSISTANT_STAGE_COLOR } from '../../../../contexts/AssistantContext/name'
import { Input } from '../../styles/Inputs'
import { orderingBrandScope } from '../../styles/OrderingBrand'

// Caption text that keeps 4.5:1 on white (theme greys are lighter)
const MUTED = '#5E6A7D'

const tones = {
  success: { background: '#E3FEF3', border: '#A8EBCB', color: '#0B5A35' },
  danger: { background: '#FEEDF0', border: '#F6BCC7', color: '#8E1B31' },
  warning: { background: '#FFF9E2', border: '#F2D675', color: '#6B4500' },
  neutral: { background: '#F8F9FA', border: '#E9ECEF', color: '#414954' }
}

const spin = keyframes`
  to { transform: rotate(360deg); }
`

const blink = keyframes`
  50% { opacity: 0; }
`

export const Launcher = styled.button`
  position: fixed;
  right: calc(20px + env(safe-area-inset-right, 0px));
  bottom: calc(20px + env(safe-area-inset-bottom, 0px));
  z-index: 990;
  min-height: 52px;
  padding: 0 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid ${props => props.theme.colors.primary};
  border-radius: 28px;
  background: ${props => props.theme.colors.primary};
  color: #FFF;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);

  &:hover {
    background: ${props => darken(0.08, props.theme.colors.primary)};
  }
  &:focus-visible {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: 3px;
  }
  @media (max-width: 767px) {
    min-height: 48px;
    padding: 0 16px;
  }
  @media print {
    display: none;
  }
`

export const Panel = styled.aside`
  position: fixed;
  top: var(--assistant-viewport-top, 0px);
  height: var(--assistant-viewport-height, 100dvh);
  z-index: 1010;
  width: ${ASSISTANT_PANEL_WIDTH}px;
  max-width: 100vw;
  box-sizing: border-box;
  overflow: hidden;
  padding-top: env(safe-area-inset-top, 0px);
  display: flex;
  flex-direction: column;
  background: ${props => props.theme.colors?.backgroundPage || '#FFF'};
  ${props => props.theme?.rtl
    ? css`
      left: 0;
      border-right: 1px solid ${props => props.theme.colors.borderColor};
    `
    : css`
      right: 0;
      border-left: 1px solid ${props => props.theme.colors.borderColor};
    `}
  ${({ floating }) => floating && css`
    box-shadow: 0 8px 35px rgba(0, 0, 0, 0.16);
  `}
`

export const PageContainer = styled.div`
  width: 100%;
  height: var(--assistant-viewport-height, calc(var(--vh, 1vh) * 100));
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: ${props => props.theme.colors?.backgroundPage || '#FFF'};
`

export const Header = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 10px 10px 16px;
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};
  min-height: 57px;
  box-sizing: border-box;

  ${({ page }) => page && css`
    padding: 14px 24px;
  `}
`

export const HeaderTitle = styled.h2`
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: ${props => props.theme.colors.headingColor};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 8px;

  > svg {
    flex-shrink: 0;
    color: ${props => props.theme.colors.primary};
  }

  > span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  ${({ page }) => page && css`
    font-size: 18px;
  `}
`

export const StageBadge = styled.small`
  flex-shrink: 0;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  line-height: 14px;
  letter-spacing: 0.04em;
  background-color: ${ASSISTANT_STAGE_COLOR};
  color: #FFF;
`

export const HeaderButton = styled.button`
  width: 36px;
  height: 36px;
  @media (pointer: coarse) {
    width: 44px;
    height: 44px;
  }
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: ${MUTED};
  cursor: pointer;

  &:hover {
    background: ${props => props.theme.colors.secundary};
    color: ${props => props.theme.colors.headingColor};
  }
  &:focus-visible {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: 1px;
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

export const Body = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;

  ${({ page }) => page && css`
    padding: 24px;
    align-items: center;
    > * {
      width: 100%;
      max-width: 760px;
    }
  `}
`

export const Messages = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: auto;
`

export const UserBubble = styled.div`
  align-self: flex-end;
  max-width: 85%;
  padding: 10px 14px;
  border-radius: 14px 14px 4px 14px;
  background: ${props => props.theme.colors.lightPrimary};
  color: ${props => props.theme.colors.headingColor};
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;

  ${props => props.theme?.rtl && css`
    border-radius: 14px 14px 14px 4px;
  `}
`

export const AssistantText = styled.div`
  font-size: 13px;
  line-height: 1.6;
  color: ${props => props.theme.colors.headingColor};
  overflow-wrap: anywhere;

  p, ul, ol, pre {
    margin: 0 0 8px;
  }
  > *:last-child {
    margin-bottom: 0;
  }
  ul, ol {
    padding-inline-start: 20px;
  }
  code {
    font-size: 12px;
    background: ${props => props.theme.colors.secundary};
    border-radius: 4px;
    padding: 1px 4px;
  }
  pre {
    background: ${props => props.theme.colors.secundary};
    border-radius: 8px;
    padding: 10px;
    overflow-x: auto;
    code {
      padding: 0;
    }
  }
  a {
    color: ${props => darken(0.08, props.theme.colors.primary)};
    text-decoration: underline;
  }
  .assistant-table {
    overflow-x: auto;
    margin: 0 0 8px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  th {
    font-weight: 500;
    color: ${MUTED};
    text-align: start;
  }
  th, td {
    padding: 6px 8px 6px 0;
    border-bottom: 1px solid ${props => props.theme.colors.borderColor};
    vertical-align: top;
  }

  ${({ streaming }) => streaming && css`
    > *:last-child::after {
      content: '';
      display: inline-block;
      width: 7px;
      height: 14px;
      margin-inline-start: 2px;
      vertical-align: -2px;
      background: ${props => props.theme.colors.primary};
      animation: ${blink} 1s step-end infinite;
    }
  `}
`

export const Note = styled.div`
  font-size: 11px;
  color: ${MUTED};
`

export const ToolLine = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: ${MUTED};

  > svg {
    flex-shrink: 0;
  }
`

export const Spinner = styled.span`
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 2px solid ${props => props.theme.colors.lightPrimary};
  border-top-color: ${props => props.theme.colors.primary};
  animation: ${spin} 0.8s linear infinite;
`

export const Card = styled.div`
  border: 1px solid ${props => props.theme.colors.gray};
  border-radius: 12px;
  overflow: hidden;
  background: ${props => props.theme.colors?.backgroundPage || '#FFF'};
`

export const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: ${props => props.theme.colors.secundary};
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};
`

export const CardTitle = styled.div`
  flex: 1;
  min-width: 0;
  small {
    display: block;
    font-size: 11px;
    color: ${MUTED};
  }
  strong {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: ${props => props.theme.colors.headingColor};
    overflow-wrap: anywhere;
  }
`

export const Countdown = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: ${MUTED};
  white-space: nowrap;
`

export const ChangeList = styled.dl`
  margin: 0;
`

export const ChangeRow = styled.div`
  display: flex;
  gap: 8px;
  padding: 10px 14px;
  font-size: 13px;
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};

  &:last-child {
    border-bottom: none;
  }

  dt {
    width: 104px;
    flex-shrink: 0;
    font-weight: 400;
    color: ${MUTED};
  }
  dd {
    flex: 1;
    min-width: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 6px;
    color: ${props => props.theme.colors.headingColor};
    overflow-wrap: anywhere;
  }
  .before {
    color: ${MUTED};
    text-decoration: line-through;
    white-space: pre-line;
  }
  .after {
    font-weight: 600;
    white-space: pre-line;
  }
  .unknown {
    font-size: 11px;
    color: ${MUTED};
  }
`

export const CardActions = styled.div`
  display: flex;
  gap: 8px;
  padding: 12px 14px 14px;
  border-top: 1px solid ${props => props.theme.colors.borderColor};

  > button {
    flex: 1;
  }
`

export const ActionButton = styled.button`
  min-height: 44px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid ${props => props.theme.colors.gray};
  background: ${props => props.theme.colors?.backgroundPage || '#FFF'};
  color: ${props => props.theme.colors.headingColor};

  &:hover:not(:disabled) {
    background: ${props => props.theme.colors.secundary};
  }
  &:focus-visible {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: 1px;
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  ${({ primary }) => primary && css`
    border-color: transparent;
    font-weight: 500;
    background: ${props => darken(0.08, props.theme.colors.primary)};
    color: ${props => props.theme.colors.primaryContrast};
    &:hover:not(:disabled) {
      background: ${props => darken(0.14, props.theme.colors.primary)};
    }
  `}

  ${({ small }) => small && css`
    min-height: 36px;
    font-size: 12px;
    flex: none !important;
    align-self: flex-start;
  `}
`

export const Callout = styled.div`
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  line-height: 1.5;
  ${({ tone = 'neutral' }) => css`
    background: ${tones[tone].background};
    border: 1px solid ${tones[tone].border};
    color: ${tones[tone].color};
    a, button.link {
      color: ${tones[tone].color};
    }
  `}

  .title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
  }
  .values {
    white-space: pre-line;
  }
  button.link {
    align-self: flex-start;
    padding: 0;
    border: none;
    background: none;
    font-size: 12px;
    font-weight: 500;
    text-decoration: underline;
    cursor: pointer;
  }
`

export const Composer = styled.div`
  flex-shrink: 0;
  min-height: 0;
  max-height: 60%;
  overflow-y: auto;
  padding: 12px 16px 16px;
  border-top: 1px solid ${props => props.theme.colors.borderColor};
  display: flex;
  flex-direction: column;
  gap: 8px;

  ${({ page }) => page && css`
    align-items: center;
    padding: 12px 24px 20px;
    > * {
      width: 100%;
      max-width: 760px;
    }
  `}
  padding-bottom: max(16px, env(safe-area-inset-bottom, 0px));
  padding-left: max(16px, env(safe-area-inset-left, 0px));
  padding-right: max(16px, env(safe-area-inset-right, 0px));
`

export const Refs = styled.div`
  min-height: 0;
  overflow-y: auto;
  flex-shrink: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: ${MUTED};

  span.ref {
    max-width: 100%;
    overflow-wrap: anywhere;
    background: ${props => props.theme.colors.secundary};
    color: ${props => props.theme.colors.secundaryDark};
    border-radius: 12px;
    padding: 2px 10px;
  }
`

export const InputBox = styled.form`
  flex-shrink: 0;
  display: flex;
  align-items: flex-end;
  gap: 8px;
  border: 1px solid ${props => props.theme.colors.gray};
  border-radius: 12px;
  padding: 6px 6px 6px 14px;
  background: ${props => props.theme.colors?.backgroundPage || '#FFF'};

  &:focus-within {
    border-color: ${props => props.theme.colors.primary};
  }

  ${({ disabled }) => disabled && css`
    background: ${props => props.theme.colors.secundary};
  `}

  textarea {
    flex: 1;
    min-width: 0;
    resize: none;
    border: none;
    outline: none;
    background: transparent;
    font-family: inherit;
    font-size: 13px;
    line-height: 20px;
    padding: 8px 0;
    max-height: min(140px, calc(var(--assistant-viewport-height, 100vh) * 0.2));
    color: ${props => props.theme.colors.headingColor};
    @media (max-width: 1199px), (pointer: coarse) {
      font-size: 16px;
    }
  }
`

export const SendButton = styled.button`
  min-width: 36px;
  height: 36px;
  @media (pointer: coarse) {
    min-width: 44px;
    height: 44px;
  }
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 8px;
  border: none;
  padding: 0 10px;
  font-size: 12px;
  cursor: pointer;
  background: ${props => darken(0.08, props.theme.colors.primary)};
  color: ${props => props.theme.colors.primaryContrast};

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  &:focus-visible {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: 1px;
  }

  ${({ stop }) => stop && css`
    background: ${props => props.theme.colors?.backgroundPage || '#FFF'};
    color: ${props => props.theme.colors.headingColor};
    border: 1px solid ${props => props.theme.colors.gray};
  `}
`

export const UsageStrip = styled.div`
  font-size: 12px;
  border-radius: 8px;
  padding: 8px 12px;
  background: ${tones.warning.background};
  color: ${tones.warning.color};
  border: 1px solid ${tones.warning.border};
`

export const Centered = styled.div`
  margin: auto 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 13px;
  line-height: 1.5;
  color: ${props => props.theme.colors.headingColor};

  h3 {
    margin: 0;
    font-size: 17px;
    font-weight: 600;
  }
  p {
    margin: 0;
    color: ${MUTED};
  }
`

export const Suggestion = styled.button`
  text-align: start;
  min-height: 44px;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid ${props => props.theme.colors.gray};
  background: ${props => props.theme.colors?.backgroundPage || '#FFF'};
  font-size: 13px;
  color: ${props => props.theme.colors.headingColor};
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: ${props => props.theme.colors.primary};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

export const NoticeIcon = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${props => props.theme.colors.lightPrimary};
  color: ${props => darken(0.08, props.theme.colors.primary)};
`

export const NoticePoint = styled.div`
  display: flex;
  gap: 10px;
  > svg {
    flex-shrink: 0;
    margin-top: 3px;
    color: #0E9B55;
  }
`

export const NoticeText = styled.div`
  font-size: 12px;
  line-height: 1.55;
  color: ${MUTED};
  white-space: pre-line;
`

export const DestinationCard = styled.section`
  ${orderingBrandScope}
  font-family: var(--od-font-sans);
  background: var(--od-surface);
  color: var(--od-text);
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  padding: var(--od-space-3);
  border: 1px solid var(--od-border);
  border-radius: var(--od-radius-panel);
  font-size: 13px;
  overflow-wrap: anywhere;
`

export const DestinationButton = styled(Suggestion)`
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  border-radius: 6px;
  overflow-wrap: anywhere;
  text-align: start;

  small { color: ${MUTED}; }
  &:focus-visible {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: 2px;
  }
`

export const DestinationSearch = styled.form`
  display: flex;
  flex-direction: column;
  gap: 8px;
  label { display: flex; flex-direction: column; gap: 8px; margin: 0; }
  > div { display: flex; flex-wrap: wrap; gap: 8px; }
`

export const DestinationSearchInput = styled(Input)`
  width: 100%;
  min-width: 0;
  min-height: 44px;
  border-radius: 6px;
  &:focus-visible {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: 2px;
  }
  @media (max-width: 767px) { font-size: 16px; }
`
