import styled, { css, keyframes } from 'styled-components'
import * as Dialog from '@radix-ui/react-dialog'

// redesign F6h-3 (A2-05): the text of the palette is a role of the brand, not a legacy theme grey: --od-x-text-subtle (5.11:1 on
// white, 4.84:1 on the Kbd fill, 4.52:1 on the selected row) for what is secondary, --od-action-content for the context chip.
// Nothing else of the old look changes.

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`

const rise = keyframes`
  from { opacity: 0; transform: translate(-50%, -6px) scale(0.98); }
  to { opacity: 1; transform: translate(-50%, 0) scale(1); }
`

const spin = keyframes`
  to { transform: rotate(360deg); }
`

export const Overlay = styled(Dialog.Overlay)`
  position: fixed;
  inset: 0;
  /* Above app modals (#app-modals .popup-backdrop is 3000) */
  z-index: calc(var(--od-x-layer-overlay) + 100); /* redesign W0-5 (T0-17): was 3100 */
  background: rgba(21, 24, 36, 0.32);
  animation: ${fadeIn} 120ms ease-out;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

export const Content = styled(Dialog.Content)`
  position: fixed;
  z-index: calc(var(--od-x-layer-overlay) + 101); /* redesign W0-5 (T0-17): was 3101 */
  top: 12vh;
  left: 50%;
  transform: translateX(-50%);
  width: min(640px, calc(100vw - 32px));
  max-height: min(560px, 76vh);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: ${props => props.theme.colors.backgroundPage};
  color: ${props => props.theme.colors.headingColor};
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(21, 24, 36, 0.18), 0 2px 6px rgba(21, 24, 36, 0.08);
  animation: ${rise} 140ms cubic-bezier(0.2, 0.8, 0.2, 1);
  outline: none;

  @media (max-width: 575px) {
    top: 8px;
    width: calc(100vw - 16px);
    max-height: calc(100dvh - 16px);
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }

  [cmdk-root] {
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex: 1;
  }

  [cmdk-list] {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 4px 8px 8px;
    scroll-padding: 8px;
  }

  [cmdk-group-heading] {
    padding: 10px 8px 4px;
    font-size: var(--od-type-secondary-size);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--od-x-text-subtle);
  }

  [cmdk-item] {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 44px;
    padding: 6px 10px;
    border-radius: 8px;
    cursor: pointer;
    user-select: none;
    color: ${props => props.theme.colors.headingColor};
    transition: background-color 80ms ease;

    &[data-selected='true'] {
      background: ${props => props.theme.colors.lightPrimary};
    }

    &[data-selected='true'] .command-item-icon {
      color: ${props => props.theme.colors.primary};
    }
  }
`

export const VisuallyHidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`

export const InputRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  min-height: 56px;
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};

  > svg {
    flex-shrink: 0;
    color: var(--od-x-text-subtle);
  }

  [cmdk-input] {
    flex: 1;
    min-width: 0;
    height: 54px;
    border: none;
    outline: none;
    background: transparent;
    font-size: 16px;
    color: ${props => props.theme.colors.headingColor};

    &::placeholder {
      color: var(--od-x-text-subtle);
    }
  }
`

export const ContextChip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  max-width: 45%;
  height: 28px;
  padding: 0 10px;
  border: none;
  border-radius: 14px;
  background: ${props => props.theme.colors.lightPrimary};
  color: var(--od-action-content);
  font-size: var(--od-type-control-value-size);
  font-weight: 500;
  cursor: pointer;

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &:focus-visible {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: 2px;
  }
`

export const Kbd = styled.kbd`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-bottom-width: 2px;
  border-radius: 6px;
  background: ${props => props.theme.colors.secundary};
  color: var(--od-x-text-subtle);
  font-family: inherit;
  font-size: var(--od-type-secondary-size);
  font-weight: 500;
  line-height: 1;
  box-shadow: none;
`

export const ItemIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: var(--od-x-text-subtle);
  background: ${props => props.theme.colors.secundary};
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

export const ItemText = styled.span`
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
`

export const ItemTitle = styled.span`
  font-size: var(--od-type-content-size);
  font-weight: 500;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const ItemSubtitle = styled.span`
  font-size: var(--od-type-secondary-size);
  line-height: 1.3;
  color: var(--od-x-text-subtle);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const Badge = styled.span`
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: var(--od-type-secondary-size);
  font-weight: 500;
  color: var(--od-x-text-subtle);
  background: ${props => props.theme.colors.secundary};
  border: 1px solid ${props => props.theme.colors.borderColor};
`

export const ItemEnd = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  color: var(--od-x-text-subtle);
`

export const StatusRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  padding: 6px 10px;
  font-size: var(--od-type-secondary-size);
  color: var(--od-x-text-subtle);
`

export const Spinner = styled.span`
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid ${props => props.theme.colors.borderColor};
  border-top-color: ${props => props.theme.colors.primary};
  animation: ${spin} 700ms linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation-duration: 2s;
  }
`

export const EmptyState = styled.div`
  padding: 28px 16px;
  text-align: center;

  p {
    margin: 0;
    font-size: var(--od-type-content-size);
    color: ${props => props.theme.colors.headingColor};
  }

  p + p {
    margin-top: 4px;
    font-size: var(--od-type-secondary-size);
    color: var(--od-x-text-subtle);
  }
`

export const Footer = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 14px;
  border-top: 1px solid ${props => props.theme.colors.borderColor};
  font-size: var(--od-type-secondary-size);
  color: var(--od-x-text-subtle);

  span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  @media (max-width: 575px) {
    display: none;
  }
`

export const TriggerButton = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 36px;
  margin: 14px 0 8px;
  padding: 0 8px 0 10px;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 8px;
  background: ${props => props.theme.colors.secundary};
  color: var(--od-x-text-subtle);
  font-size: var(--od-type-control-size);
  text-align: start;
  cursor: pointer;
  transition: border-color 120ms ease, background-color 120ms ease;

  /* The sidebar styles every nested button and span; keep this one plain */
  && span {
    margin: 0;
  }

  &&:hover {
    border-color: ${props => props.theme.colors.secundaryLight};
    background: ${props => props.theme.colors.backgroundPage};
  }

  &:focus-visible {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: 1px;
  }

  && svg {
    font-size: 16px;
    flex-shrink: 0;
  }

  && > span:first-of-type {
    flex: 1;
  }

  ${props => props.$compact && css`
    width: auto;
    margin: 0;
  `}
`

export const TriggerKeys = styled.span`
  display: inline-flex;
  gap: 2px;

  /* No keyboard shortcut to hint on touch screens */
  @media (hover: none) {
    display: none;
  }

  ${Kbd} {
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    background: ${props => props.theme.colors.backgroundPage};
  }
`
