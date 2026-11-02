import styled, { css } from 'styled-components'

const MUTED = '#5E6B7D'

const CONTRAST_COLORS = {
  aaa: css`background: #DDF5E8; color: #0B6B3A;`,
  aa: css`background: #DDF5E8; color: #0B6B3A;`,
  large: css`background: #FFF4CC; color: #7A5A00;`,
  low: css`background: #FEE4E2; color: #9F1C14;`
}

/*
 * A thin scrollbar with no track, so rounded boxes keep their corners.
 * Positioned, so hidden labels (sr-only) inside scroll with it and don't
 * stretch the editor around it.
 */
const panelScroll = css`
  position: relative;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin !important;
  scrollbar-color: #C3CAD3 transparent !important;
`

const srOnly = css`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`

/* Saved themes */

export const ThemesCard = styled.section`
  background: ${props => props.theme.colors.backgroundPage};
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 12px;

  > header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px 16px;
    padding: 20px 24px;

    h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: ${props => props.theme.colors.headingColor};
    }
  }
`

export const ThemesCount = styled.span`
  margin-left: 10px;
  color: ${MUTED};
  font-size: 13px;
`

export const ThemeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  padding: 18px 24px;
  border-top: 1px solid ${props => props.theme.colors.borderColor};
`

export const ThemeText = styled.div`
  flex: 1 1 260px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;

  > div {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  strong {
    font-weight: 600;
    font-size: 15px;
    color: ${props => props.theme.colors.headingColor};
    overflow-wrap: anywhere;
  }

  > span {
    color: ${MUTED};
    font-size: 14px;
  }
`

export const ThemeActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;

  button {
    min-height: 44px;
  }
`

export const StatusPill = styled.span`
  display: inline-block;
  font-size: 12px;
  font-weight: 500;
  padding: 3px 10px;
  border-radius: 999px;
  white-space: nowrap;
  ${props => props.tone === 'active' && css`background: #E3F7EE; color: #0B6B42;`}
  ${props => props.tone === 'draft' && css`background: #FFF4CC; color: #7A5A00;`}
  ${props => props.tone === 'inactive' && css`background: #EDEFF2; color: #4A5565;`}
`

export const IconAction = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 8px;
  border: 1px solid #CED4DA;
  background: #FFFFFF;
  color: ${MUTED};
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
`

export const NoticeBox = styled.div`
  box-sizing: border-box;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 16px 20px;
  border-radius: 12px;
  background: #EEF4FD;
  color: #1D3A63;
  font-size: 14px;

  svg {
    flex: none;
    margin-top: 2px;
  }

  strong {
    display: block;
    font-weight: 600;
  }
`

/* Create panel */

export const SourceOption = styled.label`
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 64px;
  margin: 0;
  padding: 12px 16px;
  border-radius: 12px;
  cursor: pointer;
  border: 1px solid #DEE2E6;
  background: #FFFFFF;

  input {
    width: 18px;
    height: 18px;
    margin: 0;
    flex: none;
    accent-color: ${props => props.theme.colors.primary};
  }

  ${props => props.selected && css`
    border-color: ${props.theme.colors.primary};
    box-shadow: inset 0 0 0 1px ${props.theme.colors.primary};
    background: #F5F9FF;
  `}
`

export const PresetGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
`

export const PresetOption = styled.label`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid #DEE2E6;
  background: #FFFFFF;
  cursor: pointer;

  img, > span:first-child {
    display: block;
    width: 100%;
    height: 110px;
    border-radius: 8px;
    object-fit: cover;
    background: #F8F9FA;
  }

  > span:last-child {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  input {
    width: 18px;
    height: 18px;
    margin: 0;
    flex: none;
    accent-color: ${props => props.theme.colors.primary};
  }

  ${props => props.selected && css`
    border-color: ${props.theme.colors.primary};
    box-shadow: inset 0 0 0 1px ${props.theme.colors.primary};
  `}
`

/* Editor */

export const EditorHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;

  > div {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }

  h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    color: ${props => props.theme.colors.headingColor};
    overflow-wrap: anywhere;
  }

  p {
    margin: 0;
    color: ${MUTED};
  }
`

/**
 * The editor below its header: the sections' nav and the section open. On
 * computers it takes the height left, so the nav and the section scroll on
 * their own (with `$fill`, a list and its detail, each of those scrolls).
 */
export const EditorBody = styled.div`
  display: flex;
  gap: 24px;
  align-items: flex-start;

  @media (min-width: 901px) {
    flex: 1;
    min-height: 0;
    align-items: stretch;
  }

  /* The nav takes a row of its own (flex-basis 100%), the section goes below */
  @media (max-width: 900px) {
    flex-wrap: wrap;
  }
`

/**
 * The section open, next to the nav. On computers it scrolls; filling, it
 * hands its height to the list and the detail instead.
 */
export const EditorMain = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;

  @media (min-width: 901px) {
    min-height: 0;

    > * {
      flex-shrink: 0;
    }

    ${props => props.$fill
      ? css`
        > :last-child {
          flex: 1;
          min-height: 0;
        }
      `
      : css`
        ${panelScroll}
        /* Room for the cards' focus rings, without moving them */
        margin: -4px -10px -4px -4px;
        padding: 4px 10px 4px 4px;
      `}
  }
`

export const SectionNav = styled.nav`
  flex: 1 1 200px;
  max-width: 220px;
  display: flex;
  flex-direction: column;
  gap: 2px;

  h3 {
    margin: 14px 12px 4px;
    font-size: 12px;
    font-weight: 600;
    color: ${MUTED};
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* An entry is a link when the section has an address, a button otherwise */
  button, a {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 40px;
    padding: 0 12px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: ${props => props.theme.colors.headingColor};
    font: inherit;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
  }

  a:hover {
    color: ${props => props.theme.colors.headingColor};
    text-decoration: none;
  }

  /* The section open */
  button[aria-current='true'], a[aria-current='true'] {
    background: #E9F2FE;
    color: #1F63C4;
    font-weight: 500;
  }

  /* Stays put next to the section; a long nav scrolls on its own */
  @media (min-width: 901px) {
    ${panelScroll}
    min-height: 0;
    margin: -4px;
    padding: 4px;

    > * {
      flex-shrink: 0;
    }
  }

  @media (max-width: 900px) {
    max-width: none;
    flex-basis: 100%;
    flex-direction: row;
    flex-wrap: wrap;

    h3 {
      display: none;
    }
  }
`

export const EditorCard = styled.section`
  background: ${props => props.theme.colors.backgroundPage};
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 12px;

  /* A card with no header: its rows start and end the card */
  ${props => props.$bare && css`
    padding: 8px 0;

    > :first-child {
      border-top: 0;
    }
  `}

  > header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 16px 20px 10px;

    h3 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      color: ${props => props.theme.colors.headingColor};
    }

    p {
      flex-basis: 100%;
      margin: 0;
      font-size: 13px;
      color: ${MUTED};
    }
  }
`

export const GroupToggle = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 56px;
  padding: 0 20px;
  border: 0;
  background: none;
  font-weight: 600;
  font-size: 15px;
  color: ${props => props.theme.colors.headingColor};
  text-align: left;
  cursor: pointer;

  span {
    font-weight: 400;
    font-size: 13px;
    color: ${MUTED};
  }

  /* Changed and the chevron go right; the chevron turns up while open */
  > span, > svg {
    margin-left: auto;
  }

  > span + svg {
    margin-left: 0;
  }

  > svg {
    flex: none;
    width: 16px;
    height: 16px;
    color: ${MUTED};
    transition: transform 0.2s ease;
    @media (prefers-reduced-motion: reduce) { transition: none; }
  }

  &[aria-expanded='true'] > svg {
    transform: rotate(180deg);
  }
`

/** A row of a list of values: label, controls, and an optional reset. */
export const ValueRow = styled.div`
  display: grid;
  grid-template-columns: ${props => props.columns || 'minmax(110px, 160px) minmax(0, 1fr) 40px'};
  gap: 10px 12px;
  align-items: center;
  padding: 8px 20px;
  border-top: 1px solid #F1F3F5;

  > label, > span:first-child {
    font-weight: 500;
    color: ${props => props.theme.colors.headingColor};
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px 8px;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  @media (max-width: 640px) {
    grid-template-columns: minmax(0, 1fr) 40px;

    > :first-child {
      grid-column: 1 / -1;
    }
  }

  /* In a narrow detail (ListSection measures it) */
  [data-narrow='true'] & {
    grid-template-columns: minmax(0, 1fr) 40px;

    > :first-child {
      grid-column: 1 / -1;
    }
  }

  /* Many controls in a row (a piece's size, style, color and shape): the name goes above them */
  ${props => props.$stacked && css`
    grid-template-columns: minmax(0, 1fr) 40px;

    > :first-child {
      grid-column: 1 / -1;
    }
  `}
`

/** Where a value comes from: another component (`inherits`), or its own over it. */
export const SourceTag = styled.span`
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 6px;
  white-space: nowrap;
  ${props => props.custom ? css`background: #E9F2FE; color: #1F63C4;` : css`background: #EDEFF2; color: #4A5565;`}
`

/** The tags of a value's label, always on their own line under it. */
export const SourceTags = styled.span`
  flex-basis: 100%;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`

export const RowHead = styled(ValueRow)`
  border-top: 0;
  padding-top: 0;
  padding-bottom: 2px;
  font-size: 12px;
  font-weight: 500;
  color: ${MUTED};

  > span:first-child {
    font-weight: 500;
    color: ${MUTED};
  }

  @media (max-width: 640px) {
    display: none;
  }
`

export const RowControls = styled.div`
  display: grid;
  grid-template-columns: ${props => props.columns || 'minmax(0, 1fr)'};
  gap: 10px;
  align-items: center;
  min-width: 0;

  @media (max-width: 640px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

export const ChangedDot = styled.span`
  display: inline-block;
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => props.theme.colors.primary};
`

export const ResetButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: ${MUTED};
  cursor: pointer;

  &:hover {
    background: #F1F3F5;
  }
`

export const SelectControl = styled.select`
  box-sizing: border-box;
  width: 100%;
  min-height: 44px;
  padding: 0 10px;
  border: 1px solid ${props => props.invalid ? '#C02642' : '#CED4DA'};
  border-radius: 8px;
  background: #FFFFFF;
  color: ${props => props.theme.colors.headingColor};
  font: inherit;
  font-size: 14px;

  &:disabled {
    background: #F8F9FA;
    color: ${MUTED};
  }
`

export const NumberControl = styled.input`
  box-sizing: border-box;
  width: 100%;
  min-height: 44px;
  padding: 0 10px;
  border: 1px solid ${props => props.invalid ? '#C02642' : '#CED4DA'};
  border-radius: 8px;
  background: #FFFFFF;
  color: ${props => props.theme.colors.headingColor};
  font: inherit;
  font-size: 14px;
`

/** A swatch that opens the color picker; the value shows as text, never as a field. */
export const SwatchLabel = styled.label`
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  min-height: 44px;
  margin: 0;
  padding: 0 10px;
  box-sizing: border-box;
  border: 1px solid ${props => props.invalid ? '#C02642' : '#CED4DA'};
  border-radius: 8px;
  background: #FFFFFF;
  cursor: pointer;
  font: 400 13px ui-monospace, Menlo, monospace;
  color: ${props => props.theme.colors.headingColor};

  input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }

  &:has(input:focus-visible) {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: 1px;
  }
`

export const Swatch = styled.span`
  flex: none;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  /* Over a checkerboard, so a translucent color shows as one */
  background:
    linear-gradient(${props => props.color || 'transparent'}, ${props => props.color || 'transparent'}),
    repeating-conic-gradient(#DEE2E6 0% 25%, #FFFFFF 0% 50%) 50% / 10px 10px;
  ${props => props.small && css`width: 20px; height: 20px;`}
`

export const OpacityRow = styled.label`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  margin: 0;
  font-size: 13px;
  color: ${MUTED};

  input[type='range'] {
    flex: 1;
    min-width: 80px;
    accent-color: ${props => props.theme.colors.primary};
  }

  output {
    min-width: 44px;
    text-align: right;
    font: 400 13px ui-monospace, Menlo, monospace;
    color: ${props => props.theme.colors.headingColor};
  }
`

export const ContrastBadge = styled.span`
  justify-self: start;
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 500;
  padding: 4px 8px;
  border-radius: 6px;
  white-space: nowrap;
  ${props => CONTRAST_COLORS[props.level] || ''}
`

export const ValueTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  font: 500 12px ${props => props.theme.fonts?.primary?.name || 'inherit'}, sans-serif;
  padding: 2px 8px;
  border-radius: 6px;
  white-space: nowrap;
  ${props => props.linked ? css`background: #E9F2FE; color: #1F63C4;` : css`background: #EDEFF2; color: #4A5565;`}
`

/** The button of a component color: a theme color (alias) or its own. */
export const ColorValueButton = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 44px;
  padding: 0 10px;
  box-sizing: border-box;
  border: 1px solid ${props => props.invalid ? '#C02642' : '#CED4DA'};
  border-radius: 8px;
  background: #FFFFFF;
  color: ${props => props.theme.colors.headingColor};
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;

  > span:nth-child(2) {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

/** As wide as the six columns of colors, inside Bootstrap's popover. */
export const ColorPopover = styled.div`
  width: max-content;
  max-width: 100%;
  box-sizing: border-box;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;

  h4 {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: ${MUTED};
  }
`

export const ThemeColorGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 40px));
  gap: 6px;

  button {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 8px;
    border: 1px solid rgba(0, 0, 0, 0.15);
    cursor: pointer;
    padding: 0;
  }

  button[aria-pressed='true'] {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: 2px;
  }
`

export const LevelOption = styled.label`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  margin: 0;
  padding: 8px 4px;
  border: 1px solid #DEE2E6;
  border-radius: 10px;
  font-size: 12px;
  text-align: center;
  color: ${props => props.theme.colors.headingColor};
  cursor: pointer;

  input {
    ${srOnly}
  }

  > span:first-of-type {
    width: 40px;
    height: 28px;
    box-sizing: border-box;
    border: 2px solid currentColor;
    border-right: 0;
    border-bottom: 0;
  }

  ${props => props.selected && css`
    border-color: ${props.theme.colors.primary};
    box-shadow: inset 0 0 0 1px ${props.theme.colors.primary};
    background: #F5F9FF;
    color: #1F63C4;
    font-weight: 500;
  `}

  &:has(input:focus-visible) {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: 1px;
  }
`

export const FieldError = styled.span`
  grid-column: 2 / -1;
  font-size: 12px;
  color: #B0213D;
`

export const SwitchTrack = styled.span`
  position: relative;
  flex: none;
  width: 40px;
  height: 24px;
  border-radius: 999px;
  background: ${props => props.checked ? props.theme.colors.primary : '#8A94A6'};

  &::after {
    content: '';
    position: absolute;
    top: 3px;
    left: ${props => props.checked ? '19px' : '3px'};
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #FFFFFF;
  }
`

/** A switch alone in a row of values. */
export const ToggleControl = styled.label`
  /* Holds the hidden checkbox: focusing it doesn't scroll the page */
  position: relative;
  display: inline-flex;
  align-items: center;
  align-self: center;
  justify-self: start;
  margin: 0;
  cursor: pointer;

  input {
    ${srOnly}
  }

  &:has(input:focus-visible) > span {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: 2px;
  }
`

export const ComponentLayout = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 16px;

  @media (min-width: 901px) {
    flex: 1;
    min-height: 0;
    flex-wrap: nowrap;
    align-items: stretch;
  }
`

/* The gray box keeps its corners: the list scrolls inside it, away from the edges */
export const ComponentList = styled.nav`
  flex: 1 1 200px;
  max-width: 230px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 8px 4px 8px 0;
  border-radius: 12px;
  background: #EEF1F5;

  > div {
    ${panelScroll}
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0 4px 0 8px;
  }

  /* The search stays on top while the list scrolls */
  > label {
    position: relative;
    flex: none;
    margin: 0 4px 6px 8px;

    svg {
      position: absolute;
      top: 50%;
      left: 12px;
      transform: translateY(-50%);
      color: ${MUTED};
      pointer-events: none;
    }

    input {
      width: 100%;
      height: 40px;
      padding: 0 12px 0 36px;
      border: 1px solid #D5DBE3;
      border-radius: 8px;
      background: #FFFFFF;
      color: ${props => props.theme.colors.headingColor};
      font: inherit;
    }

    input:focus {
      outline: none;
      border-color: ${props => props.theme.colors.primary};
      box-shadow: 0 0 0 3px rgba(44, 123, 229, 0.2);
    }
  }

  > div > p {
    margin: 12px;
    color: ${MUTED};
    overflow-wrap: anywhere;
  }

  h4 {
    margin: 12px 12px 4px;
    font-size: 12px;
    font-weight: 600;
    color: ${MUTED};
  }

  /* An entry is a link when the item has an address, a button otherwise */
  button, a {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 40px;
    flex: none;
    padding: 6px 12px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: ${props => props.theme.colors.headingColor};
    font: inherit;
    line-height: 1.3;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
  }

  a:hover {
    color: ${props => props.theme.colors.headingColor};
    text-decoration: none;
  }

  button[aria-current='true'], a[aria-current='true'] {
    background: #FFFFFF;
    box-shadow: inset 0 0 0 1px ${props => props.theme.colors.primary};
    color: #1F63C4;
    font-weight: 500;
  }

  @media (max-width: 900px) {
    max-width: none;
    flex-basis: 100%;
  }
`

export const ComponentDetail = styled.div`
  flex: 999 1 420px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;

  @media (min-width: 901px) {
    ${panelScroll}
    min-height: 0;
    padding: 0 8px 2px 2px;

    /* The detail scrolls, its blocks keep their height (tabs and tables scroll sideways) */
    > * {
      flex-shrink: 0;
    }
  }

  > header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;

    h3 {
      margin: 0 0 4px;
      font-size: 18px;
      font-weight: 600;
      color: ${props => props.theme.colors.headingColor};
    }

    p {
      margin: 0;
      color: ${MUTED};
    }
  }
`

export const ChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  button {
    display: inline-flex;
    align-items: center;
    min-height: 36px;
    padding: 0 14px;
    border-radius: 999px;
    border: 1px solid #DEE2E6;
    background: #FFFFFF;
    color: ${props => props.theme.colors.headingColor};
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }

  button[aria-checked='true'] {
    border-color: ${props => props.theme.colors.primary};
    background: #E9F2FE;
    color: #1F63C4;
    font-weight: 500;
  }
`

/**
 * The editor fills the window below its top: its content scrolls and the
 * save bar stays at the bottom. The page around it does not scroll.
 */
export const EditorShell = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 320px;
  margin: 0 -20px -20px;
`

export const EditorScroll = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 0 20px 20px;

  /* On computers the nav and the section scroll inside, not the whole editor */
  @media (min-width: 901px) {
    overflow-y: hidden;
  }
`

export const SaveBar = styled.div`
  flex: none;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 16px;
  padding: 14px 20px;
  /* Its buttons stay clear of the assistant's launcher, at the bottom right */
  padding-right: max(20px, var(--assistant-launcher-space, 0px));
  background: #FFFFFF;
  border-top: 1px solid #DEE2E6;
  box-shadow: 0 -2px 8px rgba(20, 24, 31, 0.06);

  > span {
    color: ${MUTED};
  }

  > div {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  button {
    min-height: 44px;
  }
`

export const SrOnly = styled.span`
  ${srOnly}
`

/* Shadows */

export const NoticeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 12px;
  background: ${props => props.theme.colors.backgroundPage};
  border: 1px solid ${props => props.theme.colors.borderColor};
  color: ${MUTED};

  > span:last-child {
    flex: 1 1 260px;
  }
`

/** The styles to pick from, each with a sample (the default style of Tabs). */
export const StyleOptions = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 10px;
  padding: 4px 20px 16px;

  label {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    margin: 0;
    padding: 12px;
    border: 1px solid #CED4DA;
    border-radius: 10px;
    background: #FFFFFF;
    cursor: pointer;
  }

  label:has(input:checked) {
    border-color: #2C7BE5;
    box-shadow: 0 0 0 3px rgba(44, 123, 229, 0.15);
  }

  label:has(input:focus-visible) {
    outline: 2px solid #2C7BE5;
    outline-offset: 2px;
  }

  strong {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: ${props => props.theme.colors.headingColor};
  }

  input {
    margin: 0;
    accent-color: #2C7BE5;
  }

  small {
    font-size: 12px;
    color: ${MUTED};
  }
`

/** A few choices side by side, as one control (the length of the underline). */
export const Segmented = styled.div`
  display: flex;
  min-width: 0;
  border: 1px solid #CED4DA;
  border-radius: 8px;
  overflow: hidden;

  label {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-width: 0;
    margin: 0;
    padding: 8px 6px;
    border-left: 1px solid #CED4DA;
    font-size: 13px;
    cursor: pointer;
  }

  label:first-child {
    border-left: 0;
  }

  label:has(input:checked) {
    background: #E9F2FE;
    color: #1F63C4;
    font-weight: 500;
  }

  label:has(input:focus-visible) {
    box-shadow: inset 0 0 0 2px #2C7BE5;
  }

  input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  i {
    display: block;
    height: 3px;
    border-radius: 2px;
    background: currentColor;
  }
`

/* Pages */

/** A block of a page's sections that move among themselves (a `group`). */
export const SectionGroupHead = styled.h4`
  margin: 0;
  padding: 14px 20px 4px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: ${MUTED};
`

/** A section of a page: the handle, its name, its arrows and whether it shows. */
export const SectionRow = styled.li`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  min-height: 52px;
  padding: 4px 20px;
  border-top: 1px solid #F1F3F5;
  background: ${props => props.$dragging ? '#F5F8FC' : 'transparent'};
  ${props => props.$over && css`box-shadow: inset 0 2px 0 ${props.theme.colors.primary};`}

  > span:nth-child(2) {
    flex: 1 1 140px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px 8px;
    min-width: 0;
    overflow-wrap: anywhere;
    font-weight: 500;
    color: ${props => props.$hidden ? MUTED : props.theme.colors.headingColor};
    ${props => props.$hidden && css`text-decoration: line-through;`}
  }

  /* The handle and the lock */
  > span:first-child {
    flex: 0 0 24px;
    display: inline-flex;
    justify-content: center;
    color: #8A94A6;
    cursor: ${props => props.draggable ? 'grab' : 'default'};
  }

  /*
   * Up and down, and the switch: fixed widths, so they line up from row to
   * row. When the name needs the room they go below it together, at the end.
   */
  > div {
    flex: none;
    margin-inline-start: auto;
    display: flex;
    align-items: center;
    gap: 10px;

    > span {
      display: flex;
      gap: 2px;
      width: 74px;
    }

    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: ${MUTED};
      cursor: pointer;

      &:hover:not(:disabled) {
        background: #F1F3F5;
      }

      &:disabled {
        opacity: 0.35;
        cursor: default;
      }
    }

    > small {
      width: 96px;
      font-size: 12px;
      color: ${MUTED};
      text-align: end;
    }

    > label {
      width: 96px;
      justify-content: flex-end;
    }
  }

  > ${FieldError} {
    flex-basis: 100%;
    padding-inline-start: 34px;
  }
`

export const SectionList = styled.ul`
  margin: 0;
  padding: 0 0 8px;
  list-style: none;
  /* What phones show while they follow all screens: to read, not to change */
  ${props => props.$readOnly && css`opacity: 0.6;`}
`
