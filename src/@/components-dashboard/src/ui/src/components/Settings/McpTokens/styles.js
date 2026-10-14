import styled, { css } from 'styled-components'

const muted = props => props.theme.colors?.secundaryContrast || '#748194'
const heading = props => props.theme.colors?.headingColor || '#344050'
const border = props => props.theme.colors?.borderColor || '#E9ECEF'
const primary = props => props.theme.colors?.primary || '#2C7BE5'
const subtle = props => props.theme.colors?.secundary || '#F8F9FA'

const statusColor = (theme, status) => {
  const colors = theme?.colors || {}
  if (status === 'active') return colors.success || '#00D27A'
  if (status === 'expired') return colors.warning || '#FFC700'
  if (status === 'revoked') return colors.danger || '#E63757'
  return colors.secundaryLight || '#B1BCCC'
}

export const Container = styled.div`
  width: 100%;
  padding: 20px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 28px;
  color: ${heading};
`

export const Header = styled.div`
  ${props => props.theme?.rtl ? css`margin-left: 65px;` : css`margin-right: 65px;`}

  h1 {
    margin: 0 0 6px;
    font-size: 20px;
    font-weight: 700;
  }

  p {
    margin: 0;
    font-size: 14px;
    line-height: 20px;
    color: ${muted};
  }
`

export const Section = styled.section`
  details summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; }
  details summary:focus-visible, a:focus-visible { outline: 2px solid ${primary}; outline-offset: 2px; }
  a { display: inline-flex; align-items: center; min-height: 44px; }

  display: flex;
  flex-direction: column;
  gap: 12px;

  > h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  > p {
    margin: 0;
    font-size: 13px;
    line-height: 19px;
    color: ${muted};
  }
`

export const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;

  h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  button {
    height: 36px;
    font-size: 13px;
  }
`

export const Notice = styled.div`
  padding: 12px 14px;
  border-radius: 7.6px;
  font-size: 13px;
  line-height: 19px;
  color: ${heading};
  background: ${props => props.$tone === 'danger'
    ? (props.theme.colors?.danger100 || '#FEEDF0')
    : props.$tone === 'info'
      ? (props.theme.colors?.backgroundInfo || '#E9F2FE')
      : (props.theme.colors?.warning100 || '#FFF9E2')};

  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;

  button {
    height: 32px;
    font-size: 13px;
  }
`

export const ComingSoon = styled.div`
  padding: 24px 20px;
  border: 1px dashed ${border};
  border-radius: 7.6px;
  display: flex;
  flex-direction: column;
  gap: 10px;

  > span {
    align-self: flex-start;
    padding: 2px 10px;
    border-radius: 50px;
    font-size: 11px;
    font-weight: 600;
    line-height: 16px;
    color: ${primary};
    background: ${props => props.theme.colors?.lightPrimary || '#E9F2FE'};
  }

  h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }

  p, li {
    margin: 0;
    font-size: 13px;
    line-height: 19px;
    color: ${muted};
  }

  ul {
    margin: 0;
    padding-left: 18px;
  }
`

export const CopyRow = styled.div`
  display: flex;
  align-items: stretch;
  gap: 8px;

  code {
    flex: 1;
    min-width: 0;
    padding: 9px 12px;
    border: 1px solid ${border};
    border-radius: 7.6px;
    background: ${subtle};
    font-size: 13px;
    color: ${heading};
    overflow-x: auto;
    white-space: nowrap;
  }
`

export const CopyButton = styled.button`
  appearance: none;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid ${border};
  border-radius: 7.6px;
  background: ${props => props.theme.colors?.backgroundPage || '#FFF'};
  font-size: 13px;
  color: ${heading};
  cursor: pointer;

  svg {
    width: 14px;
    height: 14px;
  }

  &:hover {
    border-color: ${primary};
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;

    &:hover {
      border-color: ${border};
    }
  }

  ${props => props.$copied && css`
    color: ${props.theme.colors?.success || '#00D27A'};
    border-color: ${props.theme.colors?.success || '#00D27A'};
  `}
`

export const CodeBlock = styled.div`
  position: relative;

  pre {
    margin: 0;
    padding: 12px 14px;
    padding-right: 90px;
    border: 1px solid ${border};
    border-radius: 7.6px;
    background: ${subtle};
    font-size: 12.5px;
    line-height: 19px;
    color: ${heading};
    overflow-x: auto;
    white-space: pre;
  }

  ${CopyButton} {
    position: absolute;
    top: 8px;
    ${props => props.theme?.rtl ? css`left: 8px;` : css`right: 8px;`}
  }
`

export const TokenList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
`

export const TokenCard = styled.li`
  padding: 12px 14px;
  border: 1px solid ${border};
  border-radius: 7.6px;
  display: flex;
  align-items: center;
  gap: 12px;

  ${props => props.$inactive && css`
    background: ${subtle(props)};

    h3 {
      color: ${muted(props)};
    }
  `}
`

export const TokenMain = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`

export const TokenTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;

  h3 {
    margin: 0;
    min-width: 0;
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

export const ScopePill = styled.span`
  flex-shrink: 0;
  padding: 0 7px;
  border: 1px solid ${props => props.$write ? primary(props) : border(props)};
  border-radius: 4px;
  font-size: 11px;
  line-height: 17px;
  color: ${props => props.$write ? primary(props) : muted(props)};
  white-space: nowrap;
`

/** Facts on one line, separated by a dot; they wrap on narrow panels. */
export const TokenFacts = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: 8px;
  row-gap: 2px;
  font-size: 12.5px;
  line-height: 18px;
  color: ${muted};

  > * + *::before {
    content: '·';
    margin-right: 8px;
    color: ${border};
  }

  code {
    font-size: 12px;
    color: ${muted};
  }

  span[title] {
    cursor: help;
  }
`

export const Warn = styled.strong`
  font-weight: 600;
  color: ${props => props.theme.colors?.danger || '#E63757'};
`

export const TokenSide = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
`

export const InactiveToggle = styled.button`
  appearance: none;
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  border: none;
  background: none;
  font-size: 13px;
  color: ${muted};
  cursor: pointer;

  svg {
    width: 12px;
    height: 12px;
  }

  &:hover {
    color: ${heading};
  }
`

export const StatusBadge = styled.span`
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 50px;
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
  white-space: nowrap;
  color: ${props => props.$status === 'expired' ? heading(props) : '#FFF'};
  background: ${props => statusColor(props.theme, props.$status)};
`

export const LinkAction = styled.button`
  appearance: none;
  flex-shrink: 0;
  padding: 0;
  border: none;
  background: none;
  font-size: 13px;
  color: ${props => props.$danger ? (props.theme.colors?.danger || '#E63757') : primary(props)};
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
    text-decoration: none;
  }
`

export const EmptyState = styled.div`
  padding: 24px 16px;
  border: 1px dashed ${border};
  border-radius: 7.6px;
  text-align: center;

  h3 {
    margin: 0 0 6px;
    font-size: 15px;
    font-weight: 600;
  }

  p {
    margin: 0 0 14px;
    font-size: 13px;
    line-height: 18px;
    color: ${muted};
  }

  button {
    height: 36px;
    font-size: 13px;
  }
`

export const LoadMore = styled.div`
  display: flex;
  justify-content: center;
`

export const GuideTabs = styled.div`
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 8px;
  background: ${subtle};
  align-self: center;
`

export const GuideTab = styled.button`
  min-height: 44px;
  &:focus-visible { outline: 2px solid ${primary}; outline-offset: 2px; }
  appearance: none;
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  color: ${muted};
  cursor: pointer;

  ${props => props.$active && css`
    background: ${props.theme.colors?.backgroundPage || '#FFF'};
    color: ${heading(props)};
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  `}
`

export const GuideActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;

  @media (max-width: 480px) {
    ${GuideTab} {
      padding: 6px 4px;
    }

    ${CopyButton} {
      padding: 0 8px;
    }
  }

  ${CopyButton} {
    min-height: 44px;
    margin-left: auto;

    &:focus-visible {
      outline: 2px solid ${primary};
      outline-offset: 2px;
    }
  }
`

export const Steps = styled.ol`
  margin: 0;
  padding: 0;
  list-style: none;
  counter-reset: step;
  display: flex;
  flex-direction: column;
  gap: 18px;

  > li {
    position: relative;
    counter-increment: step;
    ${props => props.theme?.rtl ? css`padding-right: 34px;` : css`padding-left: 34px;`}
    display: flex;
    flex-direction: column;
    gap: 8px;

    &::before {
      content: counter(step);
      position: absolute;
      top: 0;
      ${props => props.theme?.rtl ? css`right: 0;` : css`left: 0;`}
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: ${props => props.theme.colors?.lightPrimary || '#E9F2FE'};
      color: ${primary};
      font-size: 12px;
      font-weight: 600;
      line-height: 22px;
      text-align: center;
    }

    h3 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      line-height: 22px;
    }

    p {
      margin: 0;
      font-size: 13px;
      line-height: 19px;
      color: ${muted};
    }

    code {
      font-size: 12.5px;
    }
  }
`

export const OptionLabel = styled.p`
  && {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    color: ${muted};
  }
`

export const PromptRow = styled(CopyRow)`
  code {
    font-family: inherit;
    white-space: normal;
  }
`

/* Create form */

export const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
  color: ${heading};
`

export const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;

  > label, > span {
    font-size: 14px;
    font-weight: 600;
  }

  input[type='text'], input[type='number'] {
    width: 100%;
    box-sizing: border-box;
  }
`

export const FieldHelp = styled.p`
  margin: 0;
  font-size: 12px;
  line-height: 17px;
  color: ${props => props.$error ? (props.theme.colors?.danger || '#E63757') : muted(props)};
`

export const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;

  input[type='number'] {
    width: 110px;
    padding-top: 6px;
    padding-bottom: 6px;
  }
`

export const Chip = styled.button`
  appearance: none;
  padding: 6px 14px;
  border: 1px solid ${border};
  border-radius: 50px;
  background: ${props => props.theme.colors?.backgroundPage || '#FFF'};
  font-size: 13px;
  color: ${heading};
  cursor: pointer;

  ${props => props.$active && css`
    border-color: ${primary(props)};
    color: ${primary(props)};
    background: ${props.theme.colors?.lightPrimary || '#E9F2FE'};
  `}
`

export const ScopeOptions = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
`

export const ScopeOption = styled.label`
  margin: 0;
  padding: 12px 14px;
  border: 1px solid ${border};
  border-radius: 7.6px;
  display: flex;
  gap: 10px;
  cursor: pointer;

  input {
    margin-top: 3px;
    flex-shrink: 0;
  }

  strong {
    display: block;
    font-size: 14px;
    font-weight: 600;
  }

  span {
    display: block;
    margin-top: 2px;
    font-size: 12px;
    line-height: 17px;
    color: ${muted};
  }

  ${props => props.$active && css`
    border-color: ${primary(props)};
  `}
`

export const DataNotice = styled.div`
  padding: 14px 16px;
  border-radius: 7.6px;
  background: ${props => props.theme.colors?.warning100 || '#FFF9E2'};
  font-size: 13px;
  line-height: 19px;

  h3 {
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 600;
  }

  p {
    margin: 0 0 8px;
  }

  ul {
    margin: 0 0 12px;
    padding-left: 18px;
  }

  li {
    margin-bottom: 6px;
  }

  label {
    margin: 0;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-weight: 600;
    cursor: pointer;

    input {
      margin-top: 1px;
      flex-shrink: 0;
    }
  }
`

export const FormActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;

  button {
    height: 40px;
    min-width: 110px;
  }
`

/* One-time secret */

export const SecretView = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: ${heading};

  > p {
    margin: 0;
    font-size: 13px;
    line-height: 19px;
    color: ${muted};
  }

  ${CopyRow} code {
    white-space: normal;
    word-break: break-all;
    font-size: 13.5px;
  }
`

export const SetupSection = styled(Section)`
  && p, && ${GuideTab}, && ${CopyButton} { color: ${heading}; }
  ${Steps} > li::before { color: ${heading}; }
  pre:focus-visible { outline: 2px solid ${primary}; outline-offset: 2px; }
`
