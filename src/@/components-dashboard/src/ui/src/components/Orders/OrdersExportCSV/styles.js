import styled, { css } from 'styled-components'

// redesign 5.2 audit-3: the trigger is the Product Menu, dressed by content-header.css. The old
// `> button { height: 42px; margin-inline-end: 14px }` won over it whenever Base UI's focus guards
// became the first child, and the trigger grew 10px when the menu opened.
export const ExportContainer = styled.div`
  position: relative;
`

export const PopoverContainer = styled.div`
  position: absolute;
  margin-top: 5px;
  padding: 5px 0;
  background: ${props => props.theme?.ordering?.semantic?.surface?.default ?? props.theme.colors?.backgroundPage ?? '#FFF'};
  box-shadow: ${props => props.theme?.ordering?.shadow?.[2] ?? '0 6px 12px rgba(0,0,0,.175)'};
  border-radius: ${props => props.theme?.ordering?.radius?.component ?? '0px'};
  z-index: calc(var(--od-x-layer-notice) - 10);

  inset-inline-end: 14px;

  ${({ disabled }) => disabled && css`
    pointer-events: none;
  `}
`

export const Item = styled.div`
  padding: 3px 20px;
  white-space: nowrap;
  cursor: pointer;
  &:hover {
    background-color: ${props => props.theme?.ordering?.semantic?.surface?.subtle ?? '#F2F2F2'};
  }
`

export const ExportCSVResult = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;

  h1 {
    font-size: var(--od-type-title-size);
    color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};
  }

  button {
    width: 100%;
    padding-top: 5px;
    padding-bottom: 5px;
    margin-top: 20px;
  }
`

export const ErrorMessage = styled.p`
  text-align: center;
  margin: 5px 0;
  color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};
`

export const TabsSelectContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;

  h1 {
    font-size: var(--od-type-title-size);
    text-align: center;
    color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};
  }

  button {
    width: 100%;
    padding-top: 5px;
    padding-bottom: 5px;
    margin-top: 20px;
  }
`

export const TabsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 10px;
`

export const TabItem = styled.label`
  display: flex;
  align-items: center;
  cursor: pointer;
  color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors?.headingColor};

  input {
    margin-inline-end: 10px;
  }
`
