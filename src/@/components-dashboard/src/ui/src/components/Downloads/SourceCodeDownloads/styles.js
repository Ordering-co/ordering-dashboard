import styled from 'styled-components'
import { Button, IconButton } from '../../../styles/Buttons'

export const Page = styled.section`
  flex: 1;
  min-width: 0;
  max-height: 100vh;
  overflow: auto;
  box-sizing: border-box;
  padding: 25px 20px 40px;
  color: var(--od-text, ${props => props.theme.colors.headingColor});
  background: var(--od-bg, ${props => props.theme.colors.backgroundPage});
  font-family: var(--od-font-sans, inherit);
  direction: ${props => props.theme.rtl ? 'rtl' : 'ltr'};
  font-size: 14px;
  line-height: 1.6;
  @media (max-width: 600px) { padding: 20px 16px; }
`
export const Content = styled.div`
  max-width: 1080px;
  min-width: 0;
  h1 { margin: 0; font-size: 20px; line-height: 32px; font-weight: 600; }
  h2 { margin: 0; font-size: 20px; line-height: 30px; font-weight: 600; }
  h3 { margin: 0 0 12px; font-size: 16px; line-height: 24px; font-weight: 600; }
  p { margin: 8px 0 16px; }
  code, pre { font-family: var(--od-font-mono, ui-monospace), monospace; font-variant-ligatures: none; }
  code { color: inherit; overflow-wrap: anywhere; direction: ltr; unicode-bidi: isolate; }
  pre { padding: 12px; background: var(--od-surface-subtle, ${props => props.theme.colors.secundary || props.theme.colors.backgroundPage}); border-radius: 6px; overflow: auto; direction: ltr; text-align: left; }
  pre code { overflow-wrap: normal; }
  a { color: var(--od-action-content, ${props => props.theme.colors.primary}); text-decoration: underline; }
  a:focus-visible, summary:focus-visible { outline: 2px solid var(--od-action, ${props => props.theme.colors.primary}); outline-offset: 2px; }
  table { border-collapse: collapse; }
  th, td { border: 1px solid ${props => props.theme.colors.borderColor}; padding: 8px; text-align: start; }
  .assistant-table { overflow: auto; }
`
export const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`
export const MenuButton = styled(IconButton)`
  min-width: 44px;
  min-height: 44px;
  flex-shrink: 0;
  &:focus-visible { outline: 2px solid var(--od-action, ${props => props.theme.colors.primary}); outline-offset: 2px; }
`
export const Product = styled.article`
  margin-top: 24px;
  padding: 24px;
  border: 1px solid var(--od-border, ${props => props.theme.colors.borderColor});
  border-radius: 8px;
  @media (max-width: 600px) { padding: 16px; }
`
export const Metadata = styled.dl`
  display: flex;
  flex-wrap: wrap;
  gap: 20px 40px;
  margin: 20px 0;
  > div { min-width: 0; }
  dt { font-size: 12px; color: var(--od-text-muted, ${props => props.theme.colors.headingColor}); }
  dd { margin: 4px 0 0; overflow-wrap: anywhere; }
`
export const Action = styled(Button)`
  min-height: 44px;
  border-radius: 4px;
  white-space: normal;
  line-height: 22px;
  padding: 10px 16px;
  max-width: 100%;
  background: ${props => props.outline ? `var(--od-bg, ${props.theme.colors.backgroundPage})` : `var(--od-action, ${props.theme.colors.btnSecondary || props.theme.colors.primary})`};
  color: ${props => props.outline ? `var(--od-action-content, ${props.theme.colors.btnSecondary || props.theme.colors.primary})` : `var(--od-action-foreground, ${props.theme.colors.primaryContrast || '#FFF'})`};
  border-color: var(--od-action, ${props => props.theme.colors.btnSecondary || props.theme.colors.primary});
  &:hover, &:active {
    background: var(--od-action, ${props => props.theme.colors.btnSecondary || props.theme.colors.primary});
    color: var(--od-action-foreground, ${props => props.theme.colors.primaryContrast || '#FFF'});
  }
  &:focus-visible { outline: 2px solid var(--od-action, ${props => props.theme.colors.primary}); outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) { transition: none; }
`
export const Actions = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
  > span { font-size: 12px; }
  @media (max-width: 600px) { ${Action} { width: 100%; } }
`
export const State = styled.div`
  margin-top: 24px;
  padding: 20px 0;
  p { max-width: 65ch; }
`
export const DownloadStatus = styled.div`
  margin-bottom: 20px;
  p { margin-bottom: 8px; }
`
export const Instructions = styled.section`
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--od-border, ${props => props.theme.colors.borderColor});
  overflow-wrap: anywhere;
`
export const Details = styled.details`
  margin-top: 20px;
  border-top: 1px solid var(--od-border, ${props => props.theme.colors.borderColor});
  padding-top: 12px;
  summary { cursor: pointer; min-height: 44px; padding: 10px 0; font-weight: 600; }
  pre { white-space: pre-wrap; overflow-wrap: anywhere; }
  dl { margin-bottom: 0; }
  dt { margin-top: 12px; font-weight: 600; }
  dd { margin-inline-start: 0; }
  li { margin-top: 8px; }
`
export const LicenseText = styled.div`
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`
