import styled, { css } from 'styled-components'
import { darken } from 'polished'

export const DetailsContainer = styled.div`
  width: 100%;
  padding: 20px;
  box-sizing: border-box;
`

export const Header = styled.div`
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: space-between;
  margin-inline-end: 40px;

  > div:first-child {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    min-width: 0;
    h1 {
      font-size: var(--od-type-title-size);
      font-weight: 700;
      margin: 0px;
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
    }

    label {
      margin: 0 20px;
    }
  }
`

export const MenusContainer = styled.div`
  border-bottom: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors.borderColor};
  margin-bottom: 35px;
`

export const Tab = styled.button`
  padding: 10px 0px;
  min-height: 44px;
  cursor: pointer;
  color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors?.lightGray};
  white-space: nowrap;
  font-size: var(--od-type-control-size);
  border: 0;
  background: transparent;

  margin-inline-end: 30px;

  ${({ active }) => active && css`
    color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};
    border-bottom: 2px solid ${props => props.theme?.ordering?.semantic?.action?.default ?? props.theme.colors.headingColor};
    font-weight: 500;
    font-size: var(--od-type-control-size);
  `}

  &:focus-visible {
    outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.default ?? props.theme.colors.primary};
    outline-offset: 2px;
  }
`

export const TabPanel = styled.div`
  min-width: 0;
`

export const ActionSelectorWrapper = styled.div`
  margin-inline-start: 5px;

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }

  button {
    background: transparent !important;
    border: none;
    padding: 0px 5px;
    min-width: 44px;
    min-height: 44px;
    &:active,
    &:focus {
      border-color: unset !important;
      box-shadow: none !important;
    }
    &:focus-visible {
      outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.default ?? props.theme.colors.primary};
      outline-offset: 2px;
    }
    svg {
      color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};
      font-size: 20px;
    }

    &:after {
      display: none;
    }

    &:hover {
      background: ${props => props.theme?.ordering?.semantic?.action?.soft ?? darken(0.04, props.theme.colors.secundary ?? '#F6F7F7')} !important;
    }
    &:active {
      background: ${props => props.theme?.ordering?.semantic?.surface?.subtle ?? darken(0.1, props.theme.colors.secundary ?? '#F6F7F7')} !important;
    }
  }

  .show {
    button {
      background: ${props => props.theme?.ordering?.semantic?.action?.soft ?? darken(0.04, props.theme.colors.secundary ?? '#F6F7F7')} !important;
    }
    >div {
      border: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors.borderColor};
      box-shadow: ${props => props.theme?.ordering?.shadow?.[2] ?? '0px 4px 10px rgba(0, 0, 0, 0.12)'};
    }
  }

  > div {
    > div {
      border-radius: ${props => props.theme?.ordering?.radius?.control ?? '8px'};
      .dropdown-item {
        font-size: var(--od-type-control-size);
        color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};
      }
      .dropdown-item:last-child {
        color: ${props => props.theme?.ordering?.semantic?.state?.danger?.functional ?? '#E63757'};
      }
    }
  }
`

export const RightHeader = styled.div`
  display: flex;
  align-items: center;
  margin-inline-start: auto;
`
