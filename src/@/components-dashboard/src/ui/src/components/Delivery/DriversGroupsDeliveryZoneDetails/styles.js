import styled, { css } from 'styled-components'
import { darken } from 'polished'

export const Container = styled.div`
  width: 100%;
  padding: 20px;
  box-sizing: border-box;
  
  > button {
    margin: 20px 0;
  }
`

export const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  h1 {
    font-size: var(--od-type-title-size);
    font-weight: 700;
    color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};
    margin-bottom: 0;
  }
  ${props => props.theme?.rtl
? css`
    margin-left: 35px;
  `
: css`
    margin-right: 35px;
  `}
`

export const TabContainer = styled.div`
  width: 100%;
  display: flex;
  border-bottom: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors?.borderColor};
  margin-bottom: 24px;
  margin-top: 15px;
`

export const Tab = styled.button`
  appearance: none;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: inherit;
  padding: 10px 0px;
  min-width: 44px;
  min-height: 44px;
  cursor: pointer;
  color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};
  white-space: nowrap;
  font-size: var(--od-type-control-size);
  position: relative;
  ${props => props.theme?.rtl
? css`
    margin-left: 30px;
  `
: css`
    margin-right: 30px;
  `}

  ${({ active }) => active && css`
    font-weight: 500;

    &::after {
      content: "";
      background: ${props => props.theme?.ordering?.semantic?.text?.default ?? '#344050'};
      height: 1px;
      position: absolute;
      width: 100%;
      bottom: -1px;
      ${props => props.theme?.rtl
? css`
        right: 0;
      `
: css`
        left: 0;
      `}
    }
  `}
  ${({ active }) => !active && css`
    color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors?.lightGray};
  `}

  &:focus-visible {
    outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.default ?? props.theme.colors?.primary};
    outline-offset: 2px;
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
      color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};
      font-size: 20px;
    }

    &:after {
      display: none;
    }

    &:hover {
      background: ${props => darken(0.04, props.theme?.ordering?.semantic?.surface?.subtle ?? props.theme.colors?.secundary)} !important;
    }
    &:active {
      background: ${props => darken(0.1, props.theme?.ordering?.semantic?.surface?.subtle ?? props.theme.colors?.secundary)} !important;
    }
  }

  .show {
    button {
      background: ${props => darken(0.04, props.theme?.ordering?.semantic?.surface?.subtle ?? props.theme.colors?.secundary)} !important;
    }
    >div {
      border: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors?.borderColor};
      box-shadow: ${props => props.theme?.ordering?.shadow?.[2] ?? '0px 4px 10px rgba(0, 0, 0, 0.12)'};
    }
  }

  > div {
    > div {
      border-radius: 8px;
      .dropdown-item {
        font-size: var(--od-type-secondary-size);
        color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};
        &:active {
          background: ${props => darken(0.1, props.theme?.ordering?.semantic?.surface?.subtle ?? props.theme.colors?.secundary)} !important;
        }
      }
      .dropdown-item:last-child {
        color: ${props => props.theme?.ordering?.semantic?.state?.danger?.signal ?? '#E63757'};
      }
    }
  }
`

export const TabPanel = styled.div`
  width: 100%;
`
