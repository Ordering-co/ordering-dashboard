import styled, { css } from 'styled-components'

const KIND_COLORS = {
  success: css`background: #E3F7EE; color: #0B6B42;`,
  failed: css`background: #FEEDF0; color: #B0213D;`,
  progress: css`background: #FFF4D6; color: #7A5000;`,
  never: css`background: #F1F3F5; color: #5E6B7D;`
}

const STATUS_COLORS = {
  draft: css`background: #EEF2F7; color: #44556B;`,
  active: css`background: #E3F7EE; color: #0B6B42;`,
  archived: css`background: #F1F1F1; color: #5E6B7D;`
}

export const PageContainer = styled.div`
  flex: 1;
  padding: 20px;
  box-sizing: border-box;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 20px;
`

export const HeaderContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
`

export const HeaderTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;

  h1 {
    font-size: 20px;
    font-weight: 600;
    margin: 0;
    color: ${props => props.theme.colors.headingColor};
  }

  p {
    margin: 4px 0 0;
    font-size: 14px;
    color: #5E6B7D;
  }

  > button svg {
    width: 25px;
    height: 25px;
  }
`

export const CreateButtonContent = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
`

export const FiltersRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 20px;
`

export const SearchWrapper = styled.div`
  flex: 1 1 240px;
  max-width: 360px;
`

export const ChipGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`

export const Chip = styled.button`
  font-size: 13px;
  min-height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  cursor: pointer;
  border: 1px solid #DEE2E6;
  background: #FFFFFF;
  color: ${props => props.theme.colors.headingColor};

  ${props => props.active && css`
    border-color: ${props.theme.colors.primary};
    background: ${props.theme.colors.primary};
    color: ${props.theme.colors.primaryContrast || '#FFFFFF'};
  `}
`

export const Segmented = styled.div`
  display: flex;
  border: 1px solid #DEE2E6;
  border-radius: 8px;
  overflow: hidden;
  background: #FFFFFF;
`

export const SegmentButton = styled.button`
  font-size: 13px;
  min-height: 36px;
  padding: 0 16px;
  border: 0;
  cursor: pointer;
  background: #FFFFFF;
  color: ${props => props.theme.colors.headingColor};

  & + & {
    ${props => props.theme?.rtl ? css`border-right: 1px solid #DEE2E6;` : css`border-left: 1px solid #DEE2E6;`}
  }

  ${props => props.active && css`
    background: ${props.theme.colors.lightPrimary || '#E9F2FE'};
    color: ${props.theme.colors.primary};
    font-weight: 500;
  `}
`

export const TableCard = styled.div`
  background: ${props => props.theme.colors.backgroundPage};
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 12px;
  overflow-x: auto;
`

export const Table = styled.table`
  width: 100%;
  min-width: 720px;
  border-collapse: collapse;

  th {
    text-align: ${props => props.theme?.rtl ? 'right' : 'left'};
    font-size: 13px;
    font-weight: 600;
    color: #5E6B7D;
    padding: 14px 20px;
    border-bottom: 1px solid ${props => props.theme.colors.borderColor};
  }

  td {
    padding: 14px 20px;
    font-size: 14px;
    color: ${props => props.theme.colors.headingColor};
    border-bottom: 1px solid #F1F3F5;
    vertical-align: middle;
  }

  tbody tr {
    cursor: pointer;
  }

  tbody tr:hover td {
    background: ${props => props.theme.colors.backgroundInfo || '#F5F9FF'};
  }
`

export const NameCell = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;

  a {
    font-weight: 500;
    color: ${props => props.theme.colors.headingColor};
    text-decoration: none;
  }

  a:hover,
  a:focus-visible {
    color: ${props => props.theme.colors.primary};
    text-decoration: underline;
  }

  span {
    font-size: 12px;
    color: #5E6B7D;
  }
`

export const MutedText = styled.span`
  color: #5E6B7D;
  font-size: ${props => props.small ? '12px' : '14px'};
`

export const PlatformList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`

export const PlatformBubble = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  ${props => KIND_COLORS[props.kind] || KIND_COLORS.never}

  svg {
    width: 16px;
    height: 16px;
  }
`

export const Pill = styled.span`
  display: inline-block;
  font-size: 12px;
  font-weight: 500;
  padding: 3px 10px;
  border-radius: 999px;
  white-space: nowrap;
  ${props => props.status ? (STATUS_COLORS[props.status] || STATUS_COLORS.archived) : (KIND_COLORS[props.kind] || KIND_COLORS.never)}
`

export const PaginationWrapper = styled.div`
  padding: 12px 20px;
`

export const MessagePanel = styled.div`
  background: ${props => props.theme.colors.backgroundPage};
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 12px;
  min-height: 280px;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-align: center;

  > svg {
    width: 36px;
    height: 36px;
    color: ${props => props.tone === 'error' ? '#B0213D' : '#5E6B7D'};
  }

  h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: ${props => props.theme.colors.headingColor};
  }

  p {
    margin: 0;
    max-width: 420px;
    color: #5E6B7D;
  }
`

export const InfoBanner = styled.div`
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px 16px;
  border-radius: 10px;
  background: ${props => props.theme.colors.backgroundInfo || '#F5F9FF'};
  border: 1px solid #D6E6FB;
  color: ${props => props.theme.colors.headingColor};

  svg {
    flex: none;
    margin-top: 2px;
    color: ${props => props.theme.colors.primary};
  }
`

export const BannerAction = styled.button`
  margin-${props => props.theme?.rtl ? 'right' : 'left'}: auto;
  flex: none;
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid ${props => props.theme.colors.primary};
  border-radius: 8px;
  background: #FFFFFF;
  color: ${props => props.theme.colors.primary};
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
`

export const SkeletonRow = styled.div`
  padding: 14px 20px;
  border-bottom: 1px solid #F1F3F5;
`

/* Detail */

export const Breadcrumb = styled.nav`
  display: flex;
  align-items: center;
  gap: 8px;
  color: #5E6B7D;
  font-size: 14px;

  a {
    color: ${props => props.theme.colors.primary};
    text-decoration: none;
  }

  [aria-current] {
    color: ${props => props.theme.colors.headingColor};
  }
`

export const DetailHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;

  > div {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
  }

  h1 {
    margin: 0;
    font-size: 22px;
    font-weight: 600;
    color: ${props => props.theme.colors.headingColor};
  }

  /* A name left empty */
  h1 em {
    color: #5E6B7D;
  }

  p {
    margin: 0;
    color: #5E6B7D;
  }
`

export const DetailTop = styled.div`
  max-width: 1100px;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
`

export const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;

  > button {
    min-height: 44px;
  }

  .dropdown-item {
    min-height: 40px;
    display: flex;
    align-items: center;
  }
`

export const MoreToggle = styled.button`
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #CED4DA;
  border-radius: 8px;
  background: #FFFFFF;
  color: ${props => props.theme.colors.headingColor};
  cursor: pointer;

  &::after {
    display: none;
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`

export const Card = styled.section`
  background: ${props => props.theme.colors.backgroundPage};
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 12px;
  max-width: 1100px;

  > header {
    padding: 20px 24px 8px;

    h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: ${props => props.theme.colors.headingColor};
    }

    p {
      margin: 4px 0 0;
      color: #5E6B7D;
      font-size: 14px;
    }
  }
`

export const DetailsList = styled.dl`
  margin: 0;
  padding: 12px 24px 24px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 20px 24px;

  dt {
    font-size: 12px;
    font-weight: 400;
    color: #5E6B7D;
    margin-bottom: 4px;
  }

  dd {
    margin: 0;
    font-weight: 500;
    color: ${props => props.theme.colors.headingColor};
    overflow-wrap: anywhere;
  }
`

export const PlatformName = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;

  svg {
    width: 16px;
    height: 16px;
  }
`

export const InheritedValue = styled.span`
  color: ${props => props.inherited ? '#5E6B7D' : 'inherit'};
  overflow-wrap: anywhere;
`

export const BuildCell = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
`

/* Create panel */

export const PanelContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100%;
  padding: 26px 24px 24px;
  box-sizing: border-box;
  gap: 24px;

  h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: ${props => props.theme.colors.headingColor};
  }
`

export const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;

  label {
    font-weight: 500;
    font-size: 14px;
    color: ${props => props.theme.colors.headingColor};
  }

  input {
    ${props => props.invalid && css`border-color: #C02642;`}
  }
`

export const FieldHelp = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: #5E6B7D;

  [role='alert'],
  [data-over='true'] {
    color: #B0213D;
    font-weight: 500;
  }
`

/** Apps or Websites at the top of the create panel: radios drawn as a segmented control. */
export const KindSwitch = styled.fieldset`
  margin: 0;
  padding: 4px;
  border: 0;
  display: flex;
  gap: 4px;
  border-radius: 10px;
  background: #EEF1F5;

  svg {
    width: 16px;
    height: 16px;
  }
`

export const KindOption = styled.label`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 40px;
  margin: 0;
  border-radius: 8px;
  font-weight: 500;
  font-size: 14px;
  color: #4A5565;
  cursor: pointer;

  ${props => props.selected && css`
    background: #FFFFFF;
    color: #1F63C4;
    box-shadow: 0 1px 3px rgba(20, 24, 31, 0.15);
  `}

  &:has(input:focus-visible) {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: 1px;
  }

  input {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
  }
`

export const TypeFieldset = styled.fieldset`
  margin: 0;
  padding: 0;
  border: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;

  legend {
    font-weight: 500;
    font-size: 14px;
    margin-bottom: 10px;
    color: ${props => props.theme.colors.headingColor};
  }
`

export const TypeOption = styled.label`
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 72px;
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

  /* Highlight only: the inset ring keeps the box size, so nothing shifts */
  ${props => props.selected && css`
    border-color: ${props.theme.colors.primary};
    box-shadow: inset 0 0 0 1px ${props.theme.colors.primary};
    background: ${props.theme.colors.backgroundInfo || '#F5F9FF'};
  `}
`

export const TypeIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  flex: none;
  background: ${props => props.selected ? props.theme.colors.primary : (props.theme.colors.lightPrimary || '#E9F2FE')};
  color: ${props => props.selected ? (props.theme.colors.primaryContrast || '#FFFFFF') : props.theme.colors.primary};

  svg {
    width: 20px;
    height: 20px;
  }
`

export const TypeText = styled.span`
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
  color: ${props => props.theme.colors.headingColor};

  strong {
    font-weight: 600;
    font-size: 14px;
  }

  span {
    font-size: 13px;
    color: #5E6B7D;
  }
`

export const TypePlatforms = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #5E6B7D;
  flex: none;

  svg {
    width: 14px;
    height: 14px;
  }
`

export const ErrorBanner = styled.div`
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px 16px;
  border-radius: 10px;
  background: #FEEDF0;
  color: #8A1830;
  font-size: 14px;

  svg {
    flex: none;
    margin-top: 2px;
  }
`

export const PanelFooter = styled.div`
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid ${props => props.theme.colors.borderColor};
  display: flex;
  flex-direction: column;

  > div {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  > div > button {
    min-height: 44px;
    padding: 0 20px;
  }
`

/* Edit */

export const RenameForm = styled.form`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px;

  input {
    font-size: 18px;
    font-weight: 600;
    min-height: 44px;
    width: 320px;
    max-width: 100%;
  }

  > button {
    min-height: 44px;
  }
`

export const RenameButton = styled.button`
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #5E6B7D;
  cursor: pointer;

  &:hover {
    background: #F1F3F5;
  }
`

export const ChecksPanel = styled.section`
  max-width: 1100px;
  border-radius: 12px;
  border: 1px solid ${props => props.clean ? '#BFE8D4' : '#F3DFA2'};
  background: ${props => props.clean ? '#F2FBF6' : '#FFFBEF'};
  color: ${props => props.theme.colors.headingColor};
`

export const ChecksHeader = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  border: 0;
  background: transparent;
  text-align: ${props => props.theme?.rtl ? 'right' : 'left'};
  color: inherit;
  cursor: ${props => props.disabled ? 'default' : 'pointer'};

  > svg {
    flex: none;
  }

  > span:first-of-type {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  strong {
    font-weight: 600;
  }

  small {
    font-size: 13px;
    color: #5E6B7D;
  }
`

export const ChecksToggleLabel = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: ${props => props.theme.colors.primary};
  font-weight: 500;
`

export const ChecksGrid = styled.div`
  padding: 0 20px 20px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 12px;
`

export const ChecksCard = styled.div`
  background: #FFFFFF;
  border: 1px solid #F1E6C4;
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;

  > strong {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  li {
    display: flex;
    align-items: flex-start;
    gap: 10px;

    > span:nth-child(2) {
      flex: 1;
      min-width: 0;
    }
  }
`

export const OwnerPill = styled.span`
  flex: none;
  margin-top: 1px;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  ${props => props.owner === 'ordering'
    ? css`background: #FEEDF0; color: #B0213D;`
    : css`background: #FFF4D6; color: #7A5000;`}
`

export const LinkButton = styled.button`
  flex: none;
  padding: 0;
  border: 0;
  background: transparent;
  color: ${props => props.theme.colors.primary};
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;

  &:disabled {
    color: #B1BCCC;
    cursor: default;
  }
`

export const TabList = styled.div`
  max-width: 1100px;
  display: flex;
  gap: 4px;
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};
  overflow-x: auto;
`

export const TabButton = styled.button`
  flex: none;
  min-height: 44px;
  padding: 0 16px;
  border: 0;
  border-bottom: 2px solid ${props => props.selected ? props.theme.colors.primary : 'transparent'};
  background: transparent;
  color: ${props => props.selected ? props.theme.colors.primary : '#5E6B7D'};
  font-weight: ${props => props.selected ? 500 : 400};
  cursor: pointer;
`

export const TabHint = styled.p`
  max-width: 1100px;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #5E6B7D;
  font-size: 14px;

  svg {
    flex: none;
  }
`

export const FormGrid = styled.div`
  padding: 8px 24px 24px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px 24px;

  > .full {
    grid-column: 1 / -1;
  }

  input {
    width: 100%;
    box-sizing: border-box;
  }

  textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 10px 12px;
    border: 1px solid #CED4DA;
    border-radius: 8px;
    font: inherit;
    resize: vertical;
    color: ${props => props.theme.colors.headingColor};

    ${props => props.invalid && css`border-color: #C02642;`}
  }
`

export const FormActions = styled.div`
  padding: 0 24px 24px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;

  > button {
    min-height: 44px;
    padding: 0 20px;
  }
`

export const SettingList = styled.div`
  max-width: 1100px;
  background: ${props => props.theme.colors.backgroundPage};
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 12px;
`

export const SettingRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px 16px;
  padding: 16px 24px;
  border-bottom: 1px solid #F1F3F5;

  &:last-child {
    border-bottom: 0;
  }

  > div:first-child {
    flex: 1 1 220px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
`

export const SettingName = styled.span`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-weight: 500;
  color: ${props => props.theme.colors.headingColor};
  overflow-wrap: anywhere;
`

export const Tag = styled.span`
  font-size: 11px;
  font-weight: 500;
  color: #5E6B7D;
  border: 1px solid #DEE2E6;
  border-radius: 999px;
  padding: 1px 8px;
`

export const ValueEditor = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px;

  input[type='text'] {
    min-height: 40px;
  }

  > button {
    min-height: 40px;
  }
`

export const ValueField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;

  > div {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  input[type='color'] {
    width: 40px;
    height: 40px;
    padding: 2px;
    border: 1px solid #DEE2E6;
    border-radius: 8px;
    background: #FFFFFF;
    cursor: pointer;
  }

  [role='alert'] {
    font-size: 12px;
    color: #B0213D;
  }

  ${props => props.invalid && css`
    input[type='text'], textarea {
      border-color: #C02642;
    }
  `}
`

export const MonoInput = styled.input`
  width: ${props => props.wide ? '280px' : '130px'};
  max-width: 100%;
  box-sizing: border-box;
  min-height: 40px;
  padding: 0 12px;
  border: 1px solid #CED4DA;
  border-radius: 8px;
  font-family: ${props => props.mono ? 'ui-monospace, Menlo, monospace' : 'inherit'};
  font-size: 14px;
  color: ${props => props.theme.colors.headingColor};
`

export const JsonInput = styled.textarea`
  width: 320px;
  max-width: 100%;
  min-height: 88px;
  box-sizing: border-box;
  padding: 8px 12px;
  border: 1px solid #CED4DA;
  border-radius: 8px;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 13px;
  color: ${props => props.theme.colors.headingColor};
  resize: vertical;
`

export const Switch = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: ${props => props.checked ? 'flex-end' : 'flex-start'};
  width: 44px;
  height: 26px;
  padding: 3px;
  box-sizing: border-box;
  border: 0;
  border-radius: 999px;
  background: ${props => props.checked ? props.theme.colors.primary : '#CED4DA'};
  cursor: pointer;

  &::after {
    content: '';
    width: 20px;
    height: 20px;
    border-radius: 999px;
    background: #FFFFFF;
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`

/** Fixed width so Save, Cancel and Restore never move the value field. */
export const RowAside = styled.div`
  flex: 0 0 190px;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;

  > button {
    min-height: 40px;
  }
`

export const FileGrid = styled.div`
  max-width: 1100px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
`

export const FileCard = styled.div`
  background: ${props => props.theme.colors.backgroundPage};
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`

export const FilePreview = styled.div`
  height: 120px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: repeating-conic-gradient(#F1F3F5 0% 25%, #FFFFFF 0% 50%) 50% / 16px 16px;
  color: #5E6B7D;
  font-size: 13px;
  text-align: center;

  ${props => props.missing && css`
    background: #FFF7F8;
    border: 1px dashed #E7A3B1;
    color: #B0213D;
    font-weight: 500;
  `}

  img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
`

export const FileMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #5E6B7D;

  [role='alert'] {
    font-size: 13px;
    color: #B0213D;
  }
`

export const FileActions = styled.div`
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;

  > button:first-child {
    min-height: 36px;
  }

  input[type='file'] {
    display: none;
  }
`

export const CredentialsGrid = styled.div`
  max-width: 1100px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 16px;
`

export const CredentialsCard = styled.form`
  background: ${props => props.theme.colors.backgroundPage};
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;

  > header {
    display: flex;
    flex-direction: column;
    gap: 4px;

    > div {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: ${props => props.theme.colors.headingColor};
    }

    p {
      margin: 0;
      color: #5E6B7D;
    }
  }

  > footer {
    display: flex;
    justify-content: flex-end;

    > button {
      min-height: 44px;
      padding: 0 20px;
    }
  }
`

export const CompleteBadge = styled.span`
  flex: none;
  font-size: 12px;
  font-weight: 500;
  padding: 3px 10px;
  border-radius: 999px;
  ${props => props.complete
    ? css`background: #E3F7EE; color: #0B6B42;`
    : css`background: #FFF4D6; color: #7A5000;`}
`

export const SecretField = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 44px;
  padding: 0 6px 0 12px;
  border: 1px solid #E9ECEF;
  border-radius: 8px;
  background: #F7F9FC;

  > span {
    min-width: 0;
    overflow-wrap: anywhere;
    color: ${props => props.set ? '#0B6B42' : '#5E6B7D'};
    font-weight: ${props => props.set ? 500 : 400};
  }

  > button {
    flex: none;
    min-height: 32px;
    padding: 0 12px;
    border: 1px solid #CED4DA;
    border-radius: 6px;
    background: #FFFFFF;
    color: ${props => props.theme.colors.headingColor};
    cursor: pointer;
  }

  input[type='file'] {
    display: none;
  }
`

/* Builds */

export const ExternalLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: ${props => props.theme.colors.primary};

  svg {
    width: 12px;
    height: 12px;
  }
`

export const BuildsCard = styled.section`
  max-width: 1100px;
  box-sizing: border-box;
  background: ${props => props.theme.colors.backgroundPage};
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 12px;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;

  > header {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;

    h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: ${props => props.theme.colors.headingColor};
    }
  }
`

export const BuildsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
`

export const BuildColumn = styled.div`
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
`

export const BuildColumnHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;

  > strong {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 600;
    color: ${props => props.theme.colors.headingColor};
  }
`

export const BuildSummary = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: ${props => props.theme.colors.headingColor};

  > span:first-child {
    font-weight: 500;
  }
`

export const BuildActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;

  > button {
    min-height: 36px;
    font-size: 13px;
  }
`

export const BuildSuccessful = styled.div`
  border-top: 1px solid ${props => props.theme.colors.borderColor};
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  > small {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #5E6B7D;
  }
`

export const BuildFooter = styled.div`
  margin-top: auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
`

export const Notice = styled.div`
  display: flex;
  gap: 10px;
  align-items: flex-start;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 13px;
  ${props => props.tone === 'error'
    ? css`background: #FFF7F8; border: 1px solid #E7A3B1; color: #8A1830;`
    : css`background: #FFFBEF; border: 1px solid #F3DFA2; color: #5C3D00;`}

  svg {
    flex: none;
    margin-top: 2px;
  }
`

export const InstallPanel = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  padding: 14px;
  border: 1px solid #CED4DA;
  border-radius: 10px;
  font-size: 13px;

  > div:last-child {
    flex: 1 1 160px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  svg[role='img'] {
    flex: none;
    width: 112px;
    height: 112px;
  }
`

export const DialogBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0 0;
  color: ${props => props.theme.colors.headingColor};
  font-size: 14px;
  text-align: ${props => props.theme?.rtl ? 'right' : 'left'};

  p {
    margin: 0;
  }

  fieldset {
    border: 0;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  legend {
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 10px;
  }
`

export const DialogTitle = styled.h2`
  margin: 0;
  padding-${props => props.theme?.rtl ? 'left' : 'right'}: 40px;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.3;
  color: ${props => props.theme.colors.headingColor};
`

/** A dialog title led by an icon tile. */
export const DialogIconTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding-${props => props.theme?.rtl ? 'left' : 'right'}: 40px;

  > span {
    flex: none;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: ${props => props.theme.colors.lightPrimary || '#E9F2FE'};
    color: #1F63C4;

    svg {
      width: 20px;
      height: 20px;
    }
  }

  h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    line-height: 1.3;
    color: ${props => props.theme.colors.headingColor};
  }
`

export const DialogFooter = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
`

export const ModeOption = styled.label`
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin: 0;
  padding: 14px;
  border: 1px solid ${props => props.selected ? props.theme.colors.primary : '#CED4DA'};
  border-radius: 10px;
  background: ${props => props.selected ? '#F5F9FF' : '#FFFFFF'};
  cursor: pointer;

  input {
    margin-top: 4px;
    width: 18px;
    height: 18px;
    accent-color: ${props => props.theme.colors.primary};
  }

  > span {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;

    strong {
      font-weight: 500;
    }

    small {
      font-size: 13px;
      color: #5E6B7D;
    }
  }
`

export const ProblemList = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;

  li {
    display: flex;
    gap: 8px;
    align-items: flex-start;

    > span:nth-child(2) {
      flex: 1;
      min-width: 0;
    }
  }
`

export const BlockedPanel = styled.div`
  border: 1px solid #F3DFA2;
  background: #FFFBEF;
  border-radius: 10px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;

  > strong {
    display: flex;
    gap: 8px;
    align-items: center;
  }
`

export const IncompleteGroup = styled.div`
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 10px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`

export const LogBox = styled.pre`
  margin: 0;
  height: min(360px, 50vh);
  overflow: auto;
  background: #141820;
  color: #D7DEE8;
  border-radius: 8px;
  padding: 14px 16px;
  font: 12px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  text-align: left;
  direction: ltr;
`

export const HistoryFilters = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px;
  padding: 16px 20px;

  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
    font-size: 12px;
    color: #5E6B7D;
  }

  select {
    min-height: 40px;
    padding: 0 12px;
    border: 1px solid #CED4DA;
    border-radius: 8px;
    background: #FFFFFF;
    font-size: 14px;
    color: ${props => props.theme.colors.headingColor};
  }
`

/** A message inside the history card: no card of its own. */
export const HistoryMessage = styled.div`
  > div {
    border: 0;
    border-top: 1px solid ${props => props.theme.colors.borderColor};
    border-radius: 0;
    min-height: 220px;
  }
`

export const StatusCell = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;

  > span:first-child {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  > small {
    max-width: 300px;
    font-size: 13px;
    color: #5E6B7D;
  }
`

export const RowActions = styled.div`
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 4px 14px;
  white-space: nowrap;

  button {
    min-height: 32px;
    font-size: 13px;
  }
`

/* Push */

export const PushCard = styled(Card)`
  padding: 20px 24px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 18px;

  > header {
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;

    > div:first-child {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    h2 {
      display: flex;
      align-items: center;
      gap: 10px;
    }
  }

  dd {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 13px;
    font-weight: 400;
  }
`

export const PushEditor = styled.div`
  border-top: 1px solid ${props => props.theme.colors.borderColor};
  padding-top: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;

  h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: ${props => props.theme.colors.headingColor};
  }

  p {
    margin: 0;
  }

  textarea {
    width: 100%;
    box-sizing: border-box;
    min-height: 140px;
    padding: 10px 12px;
    border: 1px solid ${props => props.invalid ? '#C02642' : '#CED4DA'};
    border-radius: 8px;
    font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    color: ${props => props.theme.colors.headingColor};
    resize: vertical;
  }

  input[type='file'] {
    display: none;
  }
`

export const FileDrop = styled.div`
  border: 1.5px dashed #B9C6D6;
  border-radius: 10px;
  padding: 16px 18px;
  background: #FBFCFE;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  > div {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow-wrap: anywhere;
  }
`

export const HelpDetails = styled.details`
  background: #F7F9FC;
  border-radius: 10px;
  padding: 12px 14px;
  color: ${props => props.theme.colors.headingColor};

  summary {
    cursor: pointer;
    font-weight: 500;
  }

  ol {
    margin: 10px 0 0;
    padding-${props => props.theme?.rtl ? 'right' : 'left'}: 20px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
`

/* Websites */

export const TypeMenu = styled.div`
  position: relative;

  > button {
    min-height: 36px;
    padding: 0 12px;
    border: 1px solid ${props => props.active ? props.theme.colors.primary : '#DEE2E6'};
    border-radius: 8px;
    background: ${props => props.active ? '#F5F9FF' : '#FFFFFF'};
    color: ${props => props.active ? props.theme.colors.primary : props.theme.colors.headingColor};
    font-size: 13px;
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    white-space: nowrap;

    svg {
      width: 12px;
      height: 12px;
    }
  }
`

export const TypeMenuPanel = styled.div`
  position: absolute;
  top: calc(100% + 6px);
  ${props => props.theme?.rtl ? 'right' : 'left'}: 0;
  z-index: 20;
  width: 280px;
  max-width: calc(100vw - 32px);
  box-sizing: border-box;
  padding: 6px;
  background: #FFFFFF;
  border: 1px solid #DEE2E6;
  border-radius: 10px;
  box-shadow: 0 12px 28px rgba(52, 64, 80, 0.16);

  fieldset {
    border: 0;
    margin: 0;
    padding: 0;
  }

  fieldset + fieldset {
    border-top: 1px solid ${props => props.theme.colors.borderColor};
    margin-top: 6px;
    padding-top: 6px;
  }

  legend {
    width: 100%;
    margin: 0;
    padding: 8px 12px 4px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #5E6B7D;

    button {
      border: 0;
      background: none;
      padding: 0;
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 0;
      text-transform: none;
      color: ${props => props.theme.colors.primary};
      cursor: pointer;
    }
  }

  label {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 36px;
    margin: 0;
    padding: 0 12px;
    border-radius: 6px;
    font-size: 14px;
    color: ${props => props.theme.colors.headingColor};
    cursor: pointer;

    &:hover {
      background: #F7F9FC;
    }
  }

  input {
    width: 16px;
    height: 16px;
    margin: 0;
    accent-color: ${props => props.theme.colors.primary};
  }

  > div:last-child {
    border-top: 1px solid ${props => props.theme.colors.borderColor};
    margin-top: 6px;
    padding: 8px 6px 2px;
  }
`

export const DomainLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  font-size: 13px;
  color: ${props => props.theme.colors.primary};
  overflow-wrap: anywhere;

  svg {
    flex: none;
    width: 12px;
    height: 12px;
  }
`

export const WebOnlineCard = styled.section`
  max-width: 1100px;
  box-sizing: border-box;
  padding: 20px 24px;
  border-radius: 12px;
  background: #F5F9FF;
  border: 1px solid #D6E6FB;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 16px;
  color: ${props => props.theme.colors.headingColor};

  > span {
    flex: none;
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background: #E9F2FE;
    color: ${props => props.theme.colors.primary};
    display: flex;
    align-items: center;
    justify-content: center;

    svg {
      width: 22px;
      height: 22px;
    }
  }

  > div {
    flex: 1 1 320px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;

    h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }

    p {
      margin: 0;
      overflow-wrap: anywhere;
    }
  }

  > a {
    align-self: center;
  }
`

/* Own domain of a website */

export const DomainsCard = styled(Card)`
  > div {
    padding: 16px 24px 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
`

const OWN_DOMAIN_BORDERS = {
  empty: '1px dashed #B9C3CF',
  error: '1px solid #F0C5CE',
  editing: '1px solid #C9DDF7'
}

export const OwnDomainBox = styled.div`
  border: ${props => OWN_DOMAIN_BORDERS[props.tone] || `1px solid ${props.theme.colors.borderColor}`};
  border-radius: 10px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: ${props => props.theme.colors.headingColor};
  overflow-wrap: anywhere;

  h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }

  p {
    margin: 0;
  }
`

export const OwnDomainHead = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;

  > div:first-child {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  > div:last-child {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
`

export const OwnDomainName = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;

  > a {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: ${props => props.theme.colors.primary};
    overflow-wrap: anywhere;

    svg {
      flex: none;
      width: 13px;
      height: 13px;
    }
  }

  ${Pill} {
    display: inline-flex;
    align-items: center;
    gap: 6px;

    svg {
      width: 12px;
      height: 12px;
    }
  }
`

export const DomainSteps = styled.ol`
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 16px;

  > li {
    display: flex;
    gap: 12px;
    align-items: flex-start;

    > span:first-child {
      flex: none;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: #E9F2FE;
      color: ${props => props.theme.colors.primary};
      font-size: 13px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    > div {
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
  }

  strong {
    font-weight: 500;
  }
`

export const RecordTable = styled.div`
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 8px;
  overflow-x: auto;
  background: #FFFFFF;

  table {
    width: 100%;
    min-width: 480px;
    border-collapse: collapse;
    font-size: 13px;
  }

  th {
    padding: 8px 12px;
    background: #F7F9FC;
    color: #5E6B7D;
    font-weight: 500;
    text-align: ${props => props.theme?.rtl ? 'right' : 'left'};
  }

  th:first-child {
    width: 90px;
  }

  td {
    padding: 10px 12px;
    border-top: 1px solid ${props => props.theme.colors.borderColor};
    vertical-align: middle;

    > div {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
  }

  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 13px;
    background: #F1F4F8;
    border-radius: 6px;
    padding: 2px 6px;
    color: #243142;
  }
`

export const CopyButton = styled.button`
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 10px;
  border: 1px solid #CED4DA;
  border-radius: 8px;
  background: #FFFFFF;
  color: ${props => props.theme.colors.headingColor};
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;

  svg {
    width: 14px;
    height: 14px;
  }
`

export const DomainField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;

  label {
    margin: 0;
    font-weight: 500;
  }

  > div {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    input {
      flex: 1 1 280px;
      min-width: 0;
      ${props => props.invalid && css`border-color: #C02642;`}
    }
  }
`

export const FieldError = styled.p`
  display: flex;
  gap: 6px;
  align-items: flex-start;
  font-size: 13px;
  color: #B0213D;

  svg {
    flex: none;
    margin-top: 2px;
  }
`

export const CnameHelp = styled.div`
  background: #FFF8EC;
  border: 1px solid #F3D9A8;
  border-radius: 10px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;

  h4 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }

  p {
    font-size: 13px;
  }
`

export const TemporaryDomain = styled.div`
  border-top: 1px solid ${props => props.theme.colors.borderColor};
  padding-top: 16px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  > div {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  a {
    font-weight: 500;
    overflow-wrap: anywhere;
  }
`
