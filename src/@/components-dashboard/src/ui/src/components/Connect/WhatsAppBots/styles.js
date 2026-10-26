import styled, { css, keyframes } from 'styled-components'

const WHATSAPP_GREEN = '#25D366'

export const Container = styled.div`
  flex: 1;
  padding: 20px;
  box-sizing: border-box;
  overflow: hidden;
`

export const HeaderContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`

export const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;

  button {
    height: 41px;
    white-space: nowrap;
  }

  @keyframes whatsapp-bots-spin {
    0% { transform: rotate(0) }
    100% { transform: rotate(360deg) }
  }

  .loading svg {
    animation: whatsapp-bots-spin 1.85s linear infinite;
  }
`

export const HeaderTitleContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;

  > h1 {
    font-size: 20px;
    margin: 0;
    font-weight: 600;
    color: ${props => props.theme.colors.headingColor};
    white-space: nowrap;
  }

  > button {
    ${props => props.theme?.rtl
? css`
      margin-left: -2px;
      margin-right: -8px;
    `
: css`
      margin-right: -2px;
      margin-left: -8px;
    `}

    svg {
      width: 25px;
      height: 25px;
    }
  }
`

export const CountBadge = styled.span`
  min-width: 24px;
  padding: 0 8px;
  border-radius: 7.6px;
  font-size: 12px;
  font-weight: 600;
  line-height: 22px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  color: ${props => props.theme.colors.primary};
  background-color: ${props => props.theme.colors.lightPrimary};
`

export const Description = styled.p`
  margin: 6px 0 0;
  font-size: 14px;
  color: ${props => props.theme.colors.lightGray};
`

export const TableWrapper = styled.div`
  margin-top: 24px;
  overflow-x: auto;
`

export const BotsTable = styled.table`
  width: 100%;
  min-width: 560px;
  border-collapse: collapse;
  color: ${props => props.theme.colors.headingColor};

  th {
    padding: 0 16px 10px 0;
    font-size: 12px;
    font-weight: 600;
    text-align: start;
    color: ${props => props.theme.colors.lightGray};
    border-bottom: 1px solid ${props => props.theme.colors.borderColor};
  }

  td {
    padding: 14px 16px 14px 0;
    font-size: 14px;
    vertical-align: middle;
    border-bottom: 1px solid ${props => props.theme.colors.borderColor};
  }

  th.status,
  td.status {
    width: 168px;
    padding-right: 0;
  }

  tbody tr {
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  tbody tr.selected,
  tbody tr:hover {
    background-color: ${props => props.theme.colors.lightPrimary};
  }

  .muted {
    color: ${props => props.theme.colors.lightGray};
  }
`

export const BotIdentity = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
`

export const BrandLogo = styled.div`
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: ${props => props.theme.colors.primary};
  background-color: ${props => props.theme.colors.lightPrimary};
  border: 1px solid ${props => props.theme.colors.borderColor};

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  svg {
    width: 18px;
    height: 18px;
  }
`

export const BotName = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;

  .title {
    font-weight: 600;
    line-height: 20px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .subtitle {
    font-size: 12px;
    line-height: 18px;
    color: ${props => props.theme.colors.lightGray};
    font-variant-numeric: tabular-nums;
  }
`

export const PhoneCell = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;

  svg {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    color: ${WHATSAPP_GREEN};
  }
`

export const StatusControl = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
`

export const ToggleError = styled.p`
  margin: 6px 0 0;
  max-width: 168px;
  font-size: 12px;
  line-height: 16px;
  color: ${props => props.theme.colors.danger};
`

export const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 7.6px;
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
  color: ${props => props.theme.colors.lightGray};
  background-color: ${props => props.theme.colors.secundary};

  ${({ active }) => active && css`
    color: ${props => props.theme.colors.success};
    background-color: ${props => props.theme.colors.lightGreen};
  `}
`

export const ErrorBox = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 20px;
  padding: 15px;
  border-radius: 8px;
  background-color: ${props => props.theme.colors.danger100};
  color: ${props => props.theme.colors.danger};
  font-size: 14px;

  p {
    margin: 0;
  }
`

export const PaginationWrapper = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
`

export const PanelBody = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  min-width: 0;
  padding: 20px;
  box-sizing: border-box;
  container-type: inline-size;
`

export const PanelTitle = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: ${props => props.theme.colors.headingColor};
`

export const EnableRow = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 600;
  color: ${props => props.theme.colors.headingColor};
`

export const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: ${props => props.theme.colors.headingColor};

  input:not([type='color']) {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }
`

export const Hint = styled.p`
  margin: 0;
  font-size: 12px;
  font-weight: 400;
  color: ${props => props.theme.colors.lightGray};
`

export const ColorRow = styled.div`
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-width: 0;

  input:not([type='color']) {
    width: 100%;
    height: 42px;
    min-width: 0;
    box-sizing: border-box;
  }
`

export const ColorClear = styled.button`
  height: 42px;
  padding: 0 12px;
  border: 1px solid #DEE2E6;
  border-radius: 8px;
  background: ${props => props.theme.colors.backgroundPage || '#FFF'};
  color: ${props => props.theme.colors.headingColor};
  font-size: 14px;
  font-weight: 600;
  line-height: 40px;
  white-space: nowrap;
  cursor: pointer;

  &:hover {
    border-color: ${props => props.theme.colors.primary};
    color: ${props => props.theme.colors.primary};
  }
`

export const ColorPair = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 16px;
  min-width: 0;

  > * {
    min-width: 0;
  }
`

export const SectionLabel = styled.span`
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: ${props => props.theme.colors.headingColor};
`

export const SkeletonStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;

  .sk-line,
  .sk-grow,
  .sk-fixed {
    line-height: 0;
  }

  .sk-line,
  .sk-grow {
    display: block;
  }

  .sk-line {
    width: 100%;
  }

  .sk-grow {
    flex: 1;
    min-width: 0;
  }

  .sk-fixed {
    display: inline-block;
    flex: none;
    width: auto;
  }

  .sk-line .react-loading-skeleton,
  .sk-grow .react-loading-skeleton {
    display: block;
    width: 100%;
  }

  .sk-hint {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
`

export const Swatch = styled.input`
  width: 42px;
  height: 42px;
  padding: 0;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 8px;
  background: ${props => props.theme.colors.backgroundPage};
  cursor: pointer;

  &::-webkit-color-swatch-wrapper {
    padding: 0;
  }

  &::-webkit-color-swatch {
    border: none;
    border-radius: 6px;
  }
`

const selectCaret = (color) => encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="8" viewBox="0 0 12 8" fill="none"><path d="M1 1.5L6 6.5L11 1.5" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
)

export const BranchSelect = styled.select`
  width: 100%;
  box-sizing: border-box;
  appearance: none;
  background-color: ${props => props.theme.colors.backgroundPage};
  background-image: url("data:image/svg+xml,${props => selectCaret(props.theme.colors.headingColor || '#1a1a1a')}");
  background-repeat: no-repeat;
  background-position: ${props => props.theme?.rtl ? 'left' : 'right'} 15px center;
  background-size: 12px 8px;
  color: ${props => props.theme.colors.headingColor};
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 8px;
  font-size: 14px;
  padding: 10px 15px;
  padding-${props => props.theme?.rtl ? 'left' : 'right'}: 39px;

  &::-ms-expand {
    display: none;
  }
`

export const BrandTrigger = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 10px 15px;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 8px;
  background: ${props => props.theme.colors.backgroundPage};
  color: ${props => props.$placeholder ? props.theme.colors.lightGray : props.theme.colors.headingColor};
  font-size: 14px;
  font-weight: 400;
  text-align: start;
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  svg {
    flex: none;
  }
`

export const BrandTriggerLabel = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const BrandMenu = styled.div`
  position: fixed;
  z-index: 1100;
  box-sizing: border-box;
  max-width: calc(100vw - 24px);
  padding: 4px 0;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 8px;
  background: ${props => props.theme.colors.backgroundPage};
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
`

export const BrandList = styled.div`
  max-height: 192px;
  overflow-y: auto;
`

export const BrandOption = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 36px;
  box-sizing: border-box;
  padding: 8px 12px;
  border: 0;
  background: transparent;
  color: ${props => props.theme.colors.headingColor};
  font-size: 14px;
  font-weight: 400;
  text-align: start;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: ${props => props.theme.colors.lightGray}22;
    outline: none;
  }

  &[aria-disabled='true'] {
    color: ${props => props.theme.colors.lightGray};
    cursor: not-allowed;
    opacity: 0.6;
  }
`

export const BrandCheck = styled.span`
  display: inline-flex;
  flex: none;
  width: 16px;
  color: ${props => props.theme.colors.primary};
`

const brandSpin = keyframes`
  to { transform: rotate(360deg); }
`

export const BrandSpinner = styled.span`
  width: 14px;
  height: 14px;
  flex: none;
  border: 2px solid ${props => props.theme.colors.borderColor};
  border-top-color: ${props => props.theme.colors.primary};
  border-radius: 50%;
  animation: ${brandSpin} 0.7s linear infinite;
`

export const BrandMore = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 12px;
  color: ${props => props.theme.colors.lightGray};
  font-size: 12px;
`

export const PanelActions = styled.div`
  display: flex;
  align-items: stretch;
  gap: 12px;

  button {
    flex: 1 1 0;
    min-width: 0;
  }
`

export const SavedNote = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: ${props => props.theme.colors.success};
`

export const ConnectionSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  padding-bottom: 20px;
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};
`

export const SectionHeader = styled.div`
  h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: ${props => props.theme.colors.headingColor};
  }
`

export const SectionDescription = styled.p`
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 18px;
  font-weight: 400;
  color: ${props => props.theme.colors.lightGray};
`

export const FieldHeading = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
`

export const HelpButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: ${props => props.theme.colors.lightGray};
  cursor: pointer;

  &:hover,
  &[aria-expanded='true'] {
    color: ${props => props.theme.colors.headingColor};
  }
`

export const ConnectBlock = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  padding: 14px;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 8px;

  button {
    width: 100%;
  }
`

export const ConnectionCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  padding: 14px;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 8px;
`

export const RecommendedTag = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 6px;
  background-color: ${props => props.theme.colors.lightGreen};
  color: ${props => props.theme.colors.success};
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
`

export const PhoneLine = styled.p`
  margin: 0;
  font-size: 14px;
  color: ${props => props.theme.colors.headingColor};

  span {
    color: ${props => props.theme.colors.lightGray};
  }
`

export const DiagnoseRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 8px;
  font-size: 13px;
  color: ${props => props.theme.colors.lightGray};
`

export const TextDanger = styled.button`
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: ${props => props.theme.colors.danger};
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

export const StatusRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`

export const ConnectionBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  border-radius: 7.6px;
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
  color: ${props => props.theme.colors.lightGray};
  background-color: ${props => props.theme.colors.secundary};

  ${({ status }) => status === 'connected' && css`
    color: ${props => props.theme.colors.success};
    background-color: ${props => props.theme.colors.lightGreen};
  `}

  ${({ status }) => status === 'error' && css`
    color: ${props => props.theme.colors.danger};
    background-color: ${props => props.theme.colors.danger100};
  `}
`

export const ReasonText = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 18px;
  color: ${props => props.theme.colors.danger};
`

export const AuthOptions = styled.fieldset`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  border: none;

  legend {
    margin-bottom: 6px;
    font-size: 13px;
    font-weight: 600;
    color: ${props => props.theme.colors.headingColor};
  }
`

export const AuthOption = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.2s ease, background-color 0.2s ease;

  input {
    margin-top: 3px;
    accent-color: ${props => props.theme.colors.primary};
  }

  .option-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: ${props => props.theme.colors.headingColor};
  }

  .option-description {
    display: block;
    font-size: 12px;
    color: ${props => props.theme.colors.lightGray};
  }

  ${({ checked }) => checked && css`
    border-color: ${props => props.theme.colors.primary};
    background-color: ${props => props.theme.colors.lightPrimary};
  `}

  ${({ disabled }) => disabled && css`
    cursor: not-allowed;
    opacity: 0.6;
  `}
`

export const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 16px;
  min-width: 0;
`

export const InfoItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  font-size: 13px;

  span {
    color: ${props => props.theme.colors.lightGray};
  }

  strong {
    overflow-wrap: anywhere;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: ${props => props.theme.colors.headingColor};
  }

  &.wide {
    grid-column: 1 / -1;
  }
`

export const PinBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 8px;

  .pin-value {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    font-size: 13px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: ${props => props.theme.colors.headingColor};
  }

  .pin-value > span:first-child {
    font-weight: 400;
    color: ${props => props.theme.colors.lightGray};
  }
`

export const FieldGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 16px;
  min-width: 0;

  > * {
    min-width: 0;
  }

  > :not(.half) {
    grid-column: 1 / -1;
  }
`

export const InlineRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

export const ConnectionActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;

  > button:first-child {
    flex: 1 1 180px;
  }
`

export const DangerButton = styled.button`
  padding: 0 15px;
  line-height: 30px;
  font-size: 14px;
  border-radius: 8px;
  cursor: pointer;
  color: ${props => props.theme.colors.danger};
  background: transparent;
  border: 1px solid ${props => props.theme.colors.danger};
  transition: background-color 0.2s ease;

  &:hover:not(:disabled) {
    background-color: ${props => props.theme.colors.danger100};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

export const Notice = styled.div`
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 18px;
  color: ${props => props.theme.colors.success};
  background-color: ${props => props.theme.colors.lightGreen};

  ${({ type }) => type === 'error' && css`
    color: ${props => props.theme.colors.danger};
    background-color: ${props => props.theme.colors.danger100};
  `}

  ul {
    margin: 4px 0 0;
    padding-inline-start: 18px;
  }
`

export const Warning = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid ${props => props.theme.colors.warning};
  border-radius: 8px;
  font-size: 13px;
  line-height: 18px;
  color: ${props => props.theme.colors.headingColor};
  background-color: ${props => props.theme.colors.warning100};

  svg {
    flex: none;
    margin-top: 1px;
  }
`

export const TestListButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  border: 0;
  border-radius: 8px;
  background-color: ${WHATSAPP_GREEN};
  color: #111;
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;

  &:hover {
    filter: brightness(0.95);
  }
`

export const TestModalBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`

export const TestPhone = styled.p`
  margin: 0;
  padding: 12px 14px;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 8px;
  font-size: 14px;

  span {
    font-weight: 600;
  }
`

export const TestLink = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 42px;
  border-radius: 8px;
  background-color: ${WHATSAPP_GREEN};
  color: #111;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
`

export const QrBlock = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 14px;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 8px;
`

export const QrFrame = styled.div`
  padding: 8px;
  border-radius: 8px;
  background-color: #fff;
  border: 1px solid ${props => props.theme.colors.borderColor};
  line-height: 0;
`
