import styled, { css } from 'styled-components'

export const MessagesContainer = styled.div`
  width: 100%;
  height: 100%;
  overflow: hidden;
`

export const WrapperContainer = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
`

export const NotSendMessage = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  width: 100%;
  color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? 'var(--od-text-muted)'};
  background: ${props => props.theme?.ordering?.semantic?.surface?.subtle ?? 'var(--od-surface-subtle)'};

  svg {
    font-size: 20px;
  }

  p {
    font-size: var(--od-type-content-size);
    color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? 'var(--od-text-muted)'};
    margin: 6px 0;
  }
`

export const HeaderProfile = styled.div`
  display: flex;
  padding: 20px 0px;

  div {
     p {
       margin-inline-start: 10px;
      }
     strong {
      p{
        margin-block-end: 0.1em;
      }
    }
    p {
      margin-block-start: 0.1em;
      font-size: var(--od-type-secondary-size)
    }
  }

  @media (max-width: 576px) {
    padding: 10px 0;
  }
`
export const WrapperHeader = styled.div`
  width: 91%;
  max-width: 1200px;
  margin: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;

  @media (max-width: 576px) {
    justify-content: center;
    width: 90%;
  }

  ${({ messageDashboardView }) => messageDashboardView && css`
    width: 92%;
    border-bottom: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? 'var(--od-border)'};
    padding-bottom: 5px;
    flex-wrap: wrap;
    row-gap: 10px;
  `}

  ${({ historyView }) => historyView && css`
    width: 92%;
  `}
`
export const HeaderName = styled.p`
  font-size: var(--od-type-content-size);
  margin-block-end: 0.1em;
  margin-block-start: 0.1em;

`

export const Status = styled.p`
  margin-block-start: 0.1em;
  margin-block-end: 0.1em;
  font-size: var(--od-type-secondary-size);
`

export const ImageContainer = styled.div`
  overflow: auto;
  display: flex;
  align-items: center;
  padding-bottom: 20px;
  flex-wrap: wrap;

  > * {
    margin-inline-end: 10px;

    &:last-child {
      margin-inline-end: 0px;
    }
  }

  img {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    object-fit: cover;
    box-shadow: ${props => props.theme?.ordering?.shadow?.[1] ?? 'var(--od-shadow-1)'};
  }

  svg {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    padding: 6px;
    box-shadow: ${props => props.theme?.ordering?.shadow?.[1] ?? 'var(--od-shadow-1)'};
  }
  ${({ isCircle }) => isCircle && css`
    img, svg {
      width: 20px;
      height: 20px;
      border-radius: 50%;
    }
    svg {
      padding: 3px;
    }

    ${({ isReceived }) => !isReceived && css`
      justify-content: flex-end;
    `}
  `}

`

export const OrderNumber = styled.div`
  color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};
  font-size: var(--od-type-content-size);
  font-weight: 600;

  .order-identifier {
    display: inline-block;
    font-size: var(--od-type-identifier-size);
    font-family: var(--od-type-identifier-font);
    font-variant-ligatures: var(--od-type-identifier-ligatures);
    direction: ltr;
    unicode-bidi: isolate;
  }
`

// (W1-D-38): decision 30, the tenant color is only for the primary action; the thread keeps a floor (--od-x-chat-min-block) and the container above scrolls
// redesign W1-6 (W1-QB1-04): the chat scrolls, so it is reachable by keyboard (tabIndex 0 in index.js) and shows where the focus is
export const Chat = styled.div`
  flex: 1;
  min-block-size: var(--od-x-chat-min-block);
  display: flex;
  overflow-y: auto;
  overflow-x: hidden;
  flex-direction: column;
  &:focus-visible {
    outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.focus ?? props.theme.colors.primary};
    outline-offset: -2px;
  }
  > :first-child{
    margin-top: 10px;
  }
  @media (min-width: 768px){
  }
`

export const MessageConsole = styled.div`
  display: inline-flex;
  justify-content: center;
  font-size: var(--od-type-content-size);
  margin-bottom: 20px;
`

export const MessageBusiness = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  font-size: var(--od-type-content-size);
  width: 91%;
  margin: 0 auto;
  margin-bottom: 20px;
`

export const MessageCustomer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: var(--od-type-content-size);
  width: 91%;
  margin: 0 auto;
  margin-bottom: 20px;
`

export const BubbleConsole = styled.div`
  border-radius: 5px;
  padding: 10px 25px 10px 25px;
  margin-bottom: 8px;
  background: ${props => props.theme?.ordering?.semantic?.surface?.subtle ?? props.theme.colors.secundary};
  color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};
  text-align: center;
  height: auto;
  overflow: hidden;
  overflow-wrap: break-word;
  max-width: 80%;

  @media (min-width: 1024px){
    max-width: 80%;
  }
`

export const BubbleBusines = styled.div`
  border-radius: 8px;
  border-end-start-radius: 0;
  padding: 10px 25px 10px 25px;
  max-width: 80%;
  min-width: 80px;
  margin-bottom: 8px;
  background: ${props => props.theme?.ordering?.semantic?.surface?.subtle ?? props.theme.colors.secundary};
  color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};
  overflow: hidden;
  overflow-wrap: break-word;
  &[name=image]{
    width: 100%;
  }
`

// redesign W1-6 (W1-QB1-04, decision 30): the tenant color is only for the primary action, and a bubble is a background (white on #2c7be5 is
// 4.14:1). The operator bubble takes the action of the product, --od-action with its foreground (4.64:1).
export const BubbleCustomer = styled.div`
  border-radius: 8px;
  border-end-end-radius: 0;
  padding: 10px 25px 10px 25px;
  max-width: 80%;
  min-width: 80px;
  height: auto;
  margin-bottom: 10px;
  background: ${props => props.theme?.ordering?.semantic?.action?.default ?? props.theme.colors.primary};
  color: ${props => props.theme?.ordering?.semantic?.action?.foreground ?? props.theme?.colors?.primaryContrast ?? 'var(--od-action-foreground)'};
  overflow-wrap: break-word;
  overflow: hidden;

  p:last-child {
    inset-inline-start: 10px;
  }

  &[name=image]{
    width: 100%;
  }

`

export const SkeletonBubbleCustomer = styled.div`
  span{
    border-radius: 5px;
  }
`

export const SkeletonBubbleBusiness = styled.div`
  span{
    border-radius: 5px;
  }
`

export const ChatImage = styled.button.attrs({ type: 'button' })`
  width: 100%;
  min-height: 44px;
  height: auto;
  cursor: zoom-in;
  display: block;
  padding: 0;
  border: 0;
  border-radius: ${props => props.theme?.ordering?.radius?.control ?? '4px'};
  background: transparent;

  &:focus-visible {
    outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.focus ?? props.theme.colors.primary};
    outline-offset: 2px;
  }
  img{
    max-width: 100%;
    height: auto;
    vertical-align: middle;
    object-fit: contain;
  }
`

export const ImagePreviewWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;

  img {
    max-width: 100%;
    max-height: calc(var(--vh, 1vh) * 75);
    height: auto;
    object-fit: contain;
  }

  a {
    font-size: var(--od-type-control-size);
    color: ${props => props.theme?.ordering?.semantic?.action?.content ?? props.theme.colors.primary};

    &:hover {
      color: ${props => props.theme?.ordering?.semantic?.action?.hover ?? props.theme.colors.primary};
    }

    &:focus-visible {
      outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.focus ?? props.theme.colors.primary};
      outline-offset: 2px;
    }
  }
`

export const PartnerName = styled.p`
  margin-block-start: 0;
  margin-block-end: 0.6em;
  font-size: var(--od-type-content-size);
`

export const MyName = styled.p`
    margin-block-start: 0;
    margin-block-end: 0.6em;
    font-size: var(--od-type-content-size);
    text-align: right;

    ${props => props.theme?.rtl && css`
      text-align: left;
  `}
`

// redesign W1-6 (W1-QB1-06, decision 11): the time here is a phrase («7 hours ago», «منذ ساعات 7»), not a figure. It takes the font of the text,
// with figures of equal width, and follows the reading direction of the page; forcing it to mono and LTR left Arabic letters in a fallback
// monospace font and the figure at the wrong end of the line. A figure inside the phrase stays isolated from the letters around it.
export const TimeofSent = styled.p`
  position: relative;
  font-size: var(--od-type-identifier-size);
  font-variant-numeric: tabular-nums;
  margin-block-start: 0.2em;
  margin-block-end: initial;
  width: fit-content;
  font-weight: 600;

  margin-inline-start: auto;
  unicode-bidi: isolate;
`

export const SendForm = styled.div`
  display: flex;
  flex-direction: column;
  border-top: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors.borderColor};
  background: ${props => props.theme?.ordering?.semantic?.surface?.default ?? props.theme.colors.backgroundPage};
  padding: 13px;
`

export const Send = styled.form`
  align-items: center;
  display: flex;
  margin-top: 8px;
  height: auto;
  max-width: 1200px;
  justify-content: space-between;
  width: 100%;
`

export const WrapperSendInput = styled.div`
  flex: 1;
  position: relative;
  box-sizing: border-box;
  margin-inline-end: 10px;

  /* redesign W1-6 (T1-6-4a): the box is the Product TextField (its own border and focus ring) at the 44px the composer always had;
     the text leaves room for the attach / remove control that sits over its end. */
  .odc-field-input {
    block-size: 44px;
    padding-inline-end: 52px;
  }
`

export const SendImage = styled.label`
  width: 44px;
  height: 44px;
  position: absolute;
  inset-block-start: 0;
  inset-inline-end: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${props => props.theme?.ordering?.radius?.control ?? '4px'};
  cursor: pointer;

  input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }

  svg {
    color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? 'var(--od-text-muted)'};
    font-size: 20px;
    pointer-events: none;
  }

  &:hover {
    background: ${props => props.theme?.ordering?.semantic?.action?.soft ?? props.theme.colors.secundary};
  }

  &:focus-within {
    outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.focus ?? props.theme.colors.primary};
    outline-offset: 2px;
  }
`

export const WrapperDeleteImage = styled.div`
  position: absolute;
  inset-block-start: 0;
  inset-inline-end: 0;

  img {
    width: 44px;
    height: 44px;
    &:disabled {
    cursor: not-allowed;
    }
    border-radius: 8px;
  }

  svg {
    color: ${props => props.theme?.ordering?.semantic?.text?.default ?? 'var(--od-text)'};
  }

  /* redesign W1-6 (T1-6-4a): «Remove» is the Product IconButton (28px seen, 44px area on a phone); it sits on the corner of the thumbnail */
  button.odc-btn {
    position: absolute;
    inset-block-start: -6px;
    inset-inline-end: -6px;
    background: ${props => props.theme?.ordering?.semantic?.surface?.default ?? props.theme.colors?.backgroundPage ?? 'var(--od-surface)'};
    border: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? 'var(--od-border)'};
    border-radius: var(--od-radius-round);
    transform: translate(50%, -50%);
  }
`

export const WrapperSendMessageButton = styled.div`
  white-space: nowrap;
  flex: 0 0 80px;

  /* redesign W1-6 (T1-6-4a): «Send» is the Product primary Button; its glyph, gap, disabled look and phone area are its own */
  button.odc-btn {
    min-height: 44px;
    width: 100%;

    span {
      display: none;
    }
  }

  @media (min-width: 480px) {
    width: fit-content;
    button.odc-btn {
      span {
        display: inline;
      }
    }
  }
`
export const WrapperHitoryHeader = styled.div`
  display: flex;
  width: 100%;
  align-items: center;
`

export const TabItem = styled.button.attrs({ type: 'button' })`
  font-size: var(--od-type-control-size);
  padding: 5px 10px;
  cursor: pointer;
  text-align: center;
  min-height: 44px;
  border: 0;
  border-bottom: 1px solid transparent;
  background: transparent;
  color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? 'var(--od-text-muted)'};
  
  ${({ active }) => active && css`
    border-bottom: 1px solid ${props => props.theme?.ordering?.semantic?.action?.default ?? props.theme.colors?.headingColor};
    color: ${props => props.theme?.ordering?.semantic?.action?.content ?? props.theme.colors?.headingColor};
    font-weight: 600;
  `}

  @media (max-width: 576px) {
    padding: 5px 10px;
    font-size: var(--od-type-control-size);
  }

  &:hover {
    background: ${props => props.theme?.ordering?.semantic?.action?.soft ?? props.theme.colors.secundary};
  }

  &:focus-visible {
    outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.focus ?? props.theme.colors.primary};
    outline-offset: -2px;
  }
`
export const SkeletonHitory = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  column-gap: 20px;

  @media (max-width: 576px) {
    span {
      width: 250px !important;
    }
  }
`
export const WrapperLogistics = styled.div``

export const WrapperLogisticInformation = styled.div``

export const HeaderInfo = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  justify-content: space-between;
  border-bottom: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors.borderColor};
`

export const ChatHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding-bottom: 15px;
`

export const SearchAndDetailControlContainer = styled.div`
  display: flex;
  column-gap: 10px;
  align-items: center;
  flex-wrap: wrap;
`
export const MessagesSearch = styled.div`
  position: relative;

  img {
    position: absolute;
    top: 13px;
    inset-inline-start: 14px;
  }

  input {
    width: 200px;
    max-width: 100%;
    border: 1px solid ${props => props.theme?.ordering?.semantic?.border?.strong ?? 'var(--od-border-strong)'};
    border-radius: 22px;
    outline: none;
    padding: 8px;
    padding-inline-start: 40px;
    font-size: var(--od-type-control-value-size);
    background: transparent;

    &::placeholder {
      color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? 'var(--od-text-muted)'};
    }

    &:focus-visible {
      outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.focus ?? props.theme.colors.primary};
      outline-offset: 2px;
    }
  }
`
export const OrderDetailIconButton = styled.button`
  border: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? 'var(--od-border)'};
  color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};
  background: ${props => props.theme?.ordering?.semantic?.surface?.subtle ?? 'var(--od-surface-subtle)'};
  border-radius: 5px;
  display: flex;
  align-items: center;
  cursor: pointer;
  min-width: 44px;
  min-height: 44px;
  justify-content: center;
  padding: 5px;

  &:hover,
  &:active {
    background: ${props => props.theme?.ordering?.semantic?.action?.soft ?? 'var(--od-action-soft)'};
  }

  &:focus-visible {
    outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.focus ?? props.theme.colors.primary};
    outline-offset: 2px;
  }

  svg {
    font-size: 30px;
  }
`

export const ChatContactInfoContainer = styled.button.attrs({ type: 'button' })`
  flex: 1;
  display: flex;
  align-items: center;
  cursor: pointer;
  margin-bottom: 10px;
  min-width: 44px;
  min-height: 44px;
  padding: 4px;
  border: 1px solid transparent;
  border-radius: ${props => props.theme?.ordering?.radius?.component ?? '6px'};
  background: transparent;
  color: inherit;
  text-align: start;

  ${({ selected }) => !selected && css`
    opacity: 0.55;
  `}

  &:hover {
    background: ${props => props.theme?.ordering?.semantic?.action?.soft ?? props.theme.colors.secundary};
  }

  &:focus-visible {
    outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.focus ?? props.theme.colors.primary};
    outline-offset: 2px;
  }
`

export const InfoBlock = styled.div`
  margin-inline-start: 10px;
  min-width: 0;
  > p {
    margin: 0px;
    overflow-wrap: anywhere;
    max-width: 100%;

    &:first-child {
      color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};
      font-size: var(--od-type-content-size);
      font-weight: 500;
      white-space: normal;
    }
    &:last-child {
      color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors.lightGray};
      font-size: var(--od-type-secondary-size);
    }
  }
`

export const SendToContainer = styled.div`
  p {
    color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors.secundaryContrast};
    margin-bottom: 2px;
    text-align: end;
    font-size: var(--od-type-secondary-size);
  }

  ${({ isReceived }) => isReceived && css`
    text-align: initial;
  `}
`

export const MessageSender = styled.p`
  margin-bottom: 5px;
  text-align: start;
  font-weight: 600;
`

export const QuickMessageWrapper = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;

  /* redesign W1-6 (T1-6-4a): the quick replies are the Product secondary Button; a long reply wraps inside the button instead of
     running past a phone's edge. */
  button {
    margin-bottom: 6px;
    margin-inline-end: 12px;
    max-inline-size: 100%;
    block-size: auto;
    min-block-size: 44px;
    padding-block: var(--od-x-space-1-5);
    white-space: normal;
    text-align: start;
    font-size: var(--od-type-control-size);
  }
`
