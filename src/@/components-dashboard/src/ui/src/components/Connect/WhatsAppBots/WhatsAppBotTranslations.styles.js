import styled, { css } from 'styled-components'

const WHATSAPP_HEADER = '#075E54'
const WHATSAPP_CHAT = '#ECE5DD'
const WHATSAPP_ACTION = '#128C7E'

export const TranslationSummary = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  padding: 14px;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 8px;
`

export const SummaryHeading = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;

  h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: ${props => props.theme.colors.headingColor};
  }
`

export const SummaryCount = styled.span`
  flex: none;
  padding: 2px 8px;
  border-radius: 7.6px;
  color: ${props => props.theme.colors.primary};
  background: ${props => props.theme.colors.lightPrimary};
  font-size: 11px;
  font-weight: 600;
  line-height: 20px;
`

export const SummaryPreview = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: ${props => props.theme.colors.secundary};

  span {
    font-size: 11px;
    color: ${props => props.theme.colors.lightGray};
  }

  p {
    display: -webkit-box;
    margin: 0;
    overflow: hidden;
    color: ${props => props.theme.colors.headingColor};
    font-size: 13px;
    line-height: 18px;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }
`

export const ModalShell = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  color: ${props => props.theme.colors.headingColor};
`

export const ModalHeader = styled.header`
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 16px 20px;
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};

  @media (max-width: 480px) {
    gap: 8px;
    padding: 12px;
  }
`

export const ModalTitleRow = styled.div`
  display: flex;
  align-items: center;
  flex: 1;
  gap: 10px;
  min-width: 0;

  h2 {
    margin: 0;
    overflow: hidden;
    font-size: 18px;
    font-weight: 600;
    line-height: 22px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (max-width: 480px) {
    gap: 6px;

    h2 {
      font-size: 13px;
      line-height: 16px;
    }
  }
`

export const BrandBadge = styled.span`
  flex: none;
  max-width: 180px;
  overflow: hidden;
  padding: 3px 8px;
  border-radius: 7.6px;
  color: ${props => props.theme.colors.primary};
  background: ${props => props.theme.colors.lightPrimary};
  font-size: 11px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;

  @media (max-width: 480px) {
    max-width: 68px;
  }
`

export const ModalHeaderActions = styled.div`
  display: flex;
  align-items: center;
  flex: none;
`

export const LanguageControl = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  height: 36px;

  > svg {
    position: absolute;
    top: 50%;
    ${props => props.theme?.rtl ? 'right' : 'left'}: 12px;
    width: 16px;
    height: 16px;
    color: ${props => props.theme.colors.lightGray};
    pointer-events: none;
    transform: translateY(-50%);
  }

  select {
    width: 132px;
    height: 36px;
    min-height: 36px;
    padding: 0 ${props => props.theme?.rtl ? '34px 0 32px' : '32px 0 34px'};
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    line-height: 36px;
    background-position: ${props => props.theme?.rtl ? 'left' : 'right'} 10px center;
  }

  @media (max-width: 480px) {
    select {
      width: 112px;
      font-size: 13px;
    }
  }
`

export const HeaderDivider = styled.span`
  flex: none;
  width: 1px;
  height: 20px;
  margin: 0 6px;
  background: ${props => props.theme.colors.borderColor};
`

export const CloseButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: ${props => props.theme.colors.lightGray};
  cursor: pointer;

  &:hover {
    background: ${props => props.theme.colors.secundary};
    color: ${props => props.theme.colors.headingColor};
  }

  &:focus-visible {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: 1px;
  }
`

export const ModalContent = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(300px, 5fr);
  flex: 1;
  min-height: 0;
  overflow: hidden;

  @media (max-width: 760px) {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }
`

export const FormPane = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-right: 1px solid ${props => props.theme.colors.borderColor};

  @media (max-width: 760px) {
    flex: none;
    height: auto;
    max-height: min(620px, calc(100dvh - 170px));
    border-right: 0;
  }
`

export const PhaseTabs = styled.div`
  flex: none;
  display: flex;
  gap: 4px;
  padding: 12px 16px 0;
  overflow-x: auto;
  overflow-y: hidden;
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};
  scrollbar-width: none;
  white-space: nowrap;

  &::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }
`

export const PhaseTab = styled.button`
  position: relative;
  flex: none;
  padding: 9px 11px 11px;
  border: 0;
  background: transparent;
  color: ${props => props.$active ? props.theme.colors.primary : props.theme.colors.lightGray};
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;

  &::after {
    position: absolute;
    right: 8px;
    bottom: -1px;
    left: 8px;
    height: 2px;
    background: ${props => props.theme.colors.primary};
    content: '';
    opacity: ${props => props.$active ? 1 : 0};
  }

  &:focus-visible {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: -2px;
  }
`

export const PhaseTabDot = styled.span`
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-left: 6px;
  border-radius: 50%;
  background: ${props => props.$error ? 'var(--od-danger-functional)' : props.theme.colors.primary};
  vertical-align: middle;
`

export const FieldsSkeleton = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`

export const SkeletonField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
`

export const SkeletonPair = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`

export const ChatSkeleton = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 7px;
  width: min(88%, 220px);
`

export const FieldsScroll = styled.div`
  flex: 1;
  min-height: 0;
  padding: 16px 20px;
  overflow-x: hidden;
  overflow-y: auto;

  @media (max-width: 760px) {
    flex: none;
    max-height: 480px;
  }
`

export const MessageUnitCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border: 1px solid ${props => props.$active ? props.theme.colors.primary : props.theme.colors.borderColor};
  border-radius: 12px;
  background: ${props => props.$active
    ? `color-mix(in srgb, ${props.theme.colors.primary} 8%, ${props.theme.colors.backgroundPage})`
    : props.theme.colors.backgroundPage};
  box-shadow: ${props => props.$active ? '0 1px 2px rgba(0, 0, 0, 0.06)' : 'none'};
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
`

export const MessageUnitList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

export const SystemPill = styled.p`
  align-self: center;
  max-width: 92%;
  margin: 0;
  padding: 4px 8px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
  color: #54656F;
  font-size: 11px;
  line-height: 14px;
  text-align: center;
`

export const CustomerBubble = styled.div`
  align-self: flex-end;
  max-width: 88%;
  padding: 8px 10px;
  border-radius: 10px 4px 10px 10px;
  background: #DCF8C6;
  color: #202C33;
  font-size: 12px;
  line-height: 17px;
`

export const PreviewStepper = styled.div`
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
  padding: 8px 10px 12px;
  background: ${WHATSAPP_CHAT};

  span {
    flex: 1;
    min-width: 0;
    color: #54656F;
    font-size: 11px;
    line-height: 14px;
    text-align: center;
  }

  button {
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: 50%;
    background: #FFF;
    color: #202C33;
    font-size: 16px;
    line-height: 1;
    cursor: pointer;

    &:disabled {
      opacity: 0.35;
      cursor: default;
    }

    &:focus-visible {
      outline: 2px solid ${WHATSAPP_ACTION};
      outline-offset: 2px;
    }
  }
`

export const FieldsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;

  > [data-long='true'] {
    grid-column: 1 / -1;
  }

  @media (max-width: 900px) {
    grid-template-columns: 1fr;

    > * {
      grid-column: 1;
    }
  }
`

export const EditorField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
`

export const EditorFieldHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 22px;

  label {
    min-width: 0;
    color: ${props => props.theme.colors.headingColor};
    font-size: 13px;
    font-weight: 600;
  }
`

export const FieldMetaActions = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
`

export const StatusBadge = styled.span`
  padding: 1px 7px;
  border-radius: 6px;
  color: ${props => props.$custom ? props.theme.colors.primary : props.theme.colors.lightGray};
  background: ${props => props.$custom ? props.theme.colors.lightPrimary : props.theme.colors.secundary};
  font-size: 11px;
  font-weight: 600;
`

export const ResetButton = styled.button`
  padding: 0;
  border: 0;
  background: transparent;
  color: ${props => props.theme.colors.primary};
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: 2px;
  }
`

const editorControl = css`
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid ${props => props.$invalid ? props.theme.colors.danger : props.theme.colors.borderColor};
  border-radius: 8px;
  background: ${props => props.theme.colors.backgroundPage};
  color: ${props => props.theme.colors.headingColor};
  font: inherit;
  font-size: 13px;
  line-height: 19px;

  &::placeholder {
    color: ${props => props.theme.colors.lightGray};
    opacity: 1;
  }

  &:focus {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: 1px;
  }
`

export const EditorTextarea = styled.textarea`
  ${editorControl}
  height: 94px;
  min-height: 94px;
  resize: none;
`

export const EditorInput = styled.input`
  ${editorControl}
  height: 42px;
`

export const PlaceholderRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
`

export const PlaceholderChip = styled.button`
  padding: 3px 7px;
  border: 1px solid ${props => props.$present ? props.theme.colors.success : props.theme.colors.warning};
  border-radius: 999px;
  background: ${props => props.$present ? props.theme.colors.lightGreen : props.theme.colors.warning100};
  color: ${props => props.$present ? props.theme.colors.success : props.theme.colors.headingColor};
  font-size: 11px;
  line-height: 16px;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: 1px;
  }
`

export const FieldDetails = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 26px;
  color: ${props => props.$error ? props.theme.colors.danger : props.theme.colors.lightGray};
  font-size: 11px;

  > span:first-child {
    min-width: 0;
  }
`

const characterCounterColor = props => {
  if (props.$status === 'danger') return props.theme.colors.danger
  if (props.$status === 'warning') return props.theme.colors.warning
  return props.theme.colors.primary
}

export const CharacterCounter = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  color: ${characterCounterColor};
  flex: none;

  &::before {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: conic-gradient(
      ${characterCounterColor} ${props => props.$progress}deg,
      ${props => props.theme.colors.borderColor} 0
    );
    box-shadow: inset 0 0 0 5px ${props => props.theme.colors.backgroundPage};
    content: '';
  }

  span {
    margin-left: auto;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    font-weight: 600;
  }
`

export const FormFooter = styled.footer`
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 0;
  border-top: 1px solid ${props => props.theme.colors.borderColor};
  background: ${props => props.theme.colors.backgroundPage};
`

export const ErrorNotice = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  width: calc(100% - 32px);
  margin: 0 16px;
  padding: 8px 8px 8px 12px;
  border-radius: 10px;
  background: var(--od-danger-soft);
  color: var(--od-danger-functional);
  font-size: 13px;
  line-height: 18px;

  span {
    flex: 1;
    min-width: 0;
  }
`

export const ErrorNoticeButton = styled.button`
  flex: none;
  padding: 6px 10px;
  border: 0;
  border-radius: 6px;
  background: var(--od-danger-functional);
  color: #FFF;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--od-danger-functional);
    outline-offset: 2px;
  }
`

export const SaveSlot = styled.div`
  position: relative;
  width: 66%;

  > button {
    width: 100%;
  }
`

export const SaveHit = styled.button`
  position: absolute;
  inset: 0;
  border: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
`

export const PreviewPane = styled.aside`
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 0;
  padding: 24px;
  overflow: hidden;
  background: ${props => props.theme.colors.secundary};

  @media (max-width: 760px) {
    min-height: 590px;
    flex: none;
  }
`

export const PhoneFrame = styled.div`
  display: flex;
  flex-direction: column;
  width: min(100%, 260px);
  height: min(100%, 560px);
  min-height: 0;
  box-sizing: border-box;
  overflow: hidden;
  border: 8px solid ${props => props.theme.colors.headingColor};
  border-radius: 34px;
  background: ${WHATSAPP_CHAT};
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.16);
`

export const PhoneHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: ${WHATSAPP_HEADER};
  color: #FFF;
`

export const PhoneAvatar = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  overflow: hidden;
  flex: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  font-size: 12px;
  font-weight: 700;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

export const PhoneIdentity = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;

  strong {
    overflow: hidden;
    font-size: 14px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    font-size: 11px;
    opacity: 0.82;
  }
`

export const ChatBody = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 7px;
  min-height: 0;
  padding: 14px 12px;
  overflow-y: auto;
  background-color: ${WHATSAPP_CHAT};
`

export const ChatBubble = styled.button`
  position: relative;
  align-self: flex-start;
  width: auto;
  max-width: 88%;
  padding: 9px 10px 6px;
  border: 1px solid ${props => props.$invalid ? 'var(--od-danger-functional)' : props.$active ? WHATSAPP_ACTION : 'transparent'};
  border-radius: 4px 10px 10px 10px;
  background: #FFF;
  color: #202C33;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
  font-size: 12px;
  line-height: 17px;
  text-align: left;
  white-space: pre-wrap;
  cursor: pointer;

  time {
    float: right;
    margin: 4px 0 0 9px;
    color: #667781;
    font-size: 9px;
  }
`

export const PreviewMessage = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
  width: min(88%, 220px);

  > button:first-child {
    max-width: 100%;
  }
`

export const PreviewAlert = styled.span`
  position: absolute;
  top: -7px;
  right: -7px;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--od-danger-functional);
  color: #FFF;
  box-shadow: 0 0 0 2px #FFF;
`

export const ChatAction = styled.button`
  position: relative;
  align-self: flex-start;
  width: min(88%, 260px);
  padding: 8px 10px;
  border: 1px solid ${props => props.$invalid ? 'var(--od-danger-functional)' : props.$active ? WHATSAPP_ACTION : 'transparent'};
  border-radius: 7px;
  background: #FFF;
  color: ${WHATSAPP_ACTION};
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  font-size: 12px;
  font-weight: 600;
  text-align: center;
  cursor: ${props => props.$plain ? 'default' : 'pointer'};

  ${PreviewMessage} & {
    width: 100%;
  }
`

export const PreviewEmpty = styled.p`
  margin: auto;
  color: #667781;
  font-size: 12px;
  text-align: center;
`
