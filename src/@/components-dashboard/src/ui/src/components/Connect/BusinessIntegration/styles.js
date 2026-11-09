import styled, { css } from 'styled-components'
import { darken } from 'polished'

export const BusinessOrderingChannelsContainer = styled.div`
  padding: 20px;

  /* Below 1000px MoreSidebarLayout shows the detail in the shared Modal, which
     already pads its content and places the close button at its top right. */
  ${({ inModal }) => inModal && css`
    padding: 0;
  `}
`

export const Title = styled.h1`
  font-size: 20px;
  margin: 0px;
  font-weight: 600;
  width: 90%;
`

export const BusinessCustomSlugContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 20px;
`

export const FormControl = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`

export const Label = styled.label`
  font-size: 14px;
  color: ${props => props.theme.colors.darkTextColor};
`

export const Tabs = styled.div`
  display: flex;
  gap: 20px;
  margin-top: 20px;
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};
`

export const Tab = styled.div`
  padding: 10px 0px;
  cursor: pointer;
  color: ${props => props.active ? props.theme.colors.primary : props.theme.colors.darkTextColor};
  border-bottom: 2px solid ${props => props.active ? props.theme.colors.primary : 'transparent'};
`

export const IntegrationContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`

export const IntegrationItem = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 15px;
  border: 1px solid ${props => props.selected ? props.theme.colors.primary : props.theme.colors.borderColor};
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    border-color: ${props => props.theme.colors.primary};
  }
`

export const IntegrationLogo = styled.div`
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
`

export const IntegrationInfo = styled.div`
  flex: 1;

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  p {
    margin: 5px 0 0;
    font-size: 14px;
    color: ${props => props.theme.colors.darkTextColor};
  }
`

export const IntegrationActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 20px;

  ${({ noMargin }) => noMargin && css`
    margin-top: 0;
  `}

  input[type="checkbox"] {
    width: 20px;
    height: 20px;
  }

  > button {
    align-self: flex-start;
    min-width: 120px;
    justify-content: center;
  }
`

export const TitleWrapper = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 3px;
  margin-bottom: 20px;
  max-width: 94%;

  ${({ inModal }) => inModal && css`
    max-width: none;
    margin-right: 40px;
  `}

  .title-wrapper {
    display: flex;
    align-items: center;
    gap: 10px;

    label {
      min-width: 25px;
    }
  }
`

export const ActionSelectorWrapper = styled.div`
  button {
    background: transparent !important;
    border: none;
    padding: 0px 5px;
    &:active,
    &:focus {
      border-color: unset !important;
      box-shadow: none !important;
    }
    svg {
      color: ${props => props.theme.colors.headingColor};
      font-size: 20px;
    }

    &:after {
      display: none;
    }

    &:hover {
      background: ${props => darken(0.04, props.theme.colors.secundary)} !important;
    }
    &:active {
      background: ${props => darken(0.1, props.theme.colors.secundary)} !important;
    }
  }

  .show {
    button {
      background: ${props => darken(0.04, props.theme.colors.secundary)} !important;
    }
    >div {
      border: 1px solid ${props => props.theme.colors.borderColor};
      box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.12);
    }
  }

  > div {
    > div {
      border-radius: 8px;
      .dropdown-item {
        font-size: 12px;
        color: ${props => props.theme.colors.headingColor};
        &:active {
          background: ${props => darken(0.1, props.theme.colors.secundary)} !important;
        }
      }
      .dropdown-item:last-child {
        color: ${props => props.theme.colors.danger};
      }
    }
  }
`

export const StatusCard = styled.div`
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;

  ${({ tone }) => tone === 'danger' && css`
    border-color: ${props => props.theme.colors.danger};
  `}

  .status-row {
    display: flex;
    align-items: center;
    gap: 12px;

    > div:first-child {
      margin-right: 4px;
    }

    > div:nth-child(2) {
      flex: 1;
    }

    > button {
      min-width: 120px;
      white-space: nowrap;
      justify-content: center;
    }
  }

  .integration-name {
    margin: 0;
    font-size: 14px;
    color: ${props => props.theme.colors.headingColor};
  }

  .status-message {
    margin: 0;
    font-size: 14px;
  }
`

export const SyncActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 24px;

  p { margin: 0; }

  .title {
    font-weight: 600;
    font-size: 14px;
  }

  .sync-action {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;

    > div {
      flex: 1;
      min-width: 0;
    }

    > button {
      flex-shrink: 0;
      min-width: 120px;
      white-space: nowrap;
      justify-content: center;
    }
  }

  .name { font-size: 14px; }

  .hint {
    font-size: 12px;
    color: ${props => props.theme.colors.lightGray};
  }
`

export const MoreActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid ${props => props.theme.colors.borderColor};

  > button {
    min-width: 120px;
    white-space: nowrap;
    justify-content: center;
  }
`
