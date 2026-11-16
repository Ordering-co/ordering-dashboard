import styled, { css } from 'styled-components'
import { brandFocusOutline, coarseHitArea } from '../../../styles/touchTarget'

export const ConditionsContainer = styled.div`
  width: 100%;
  height: 100%;
  overflow: auto;
  padding: 20px;
  box-sizing: border-box;
  
  /* Acotado a la accion de guardar, que es para lo que esta regla se escribio. Sin la
     clase, capturaba tambien los ConditionItem convertidos a <button> por accesibilidad
     y les imponia altura fija y 60px de separacion que nunca tuvieron. */
  > button.od-button-legacy {
    height: 44px;
    margin: 30px 0;
  }
`
export const Header = styled.div`
  padding-bottom: 25px;
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};
  > h1 {
    font-size: var(--od-type-title-size);
    font-weight: 700;
    margin: 0;
  }
`
export const ConditionItem = styled.div`
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};
  padding: 12px 0;
  width: 100%;
  background: none;
  border-left: none;
  border-right: none;
  border-top: none;
  color: inherit;
  font-family: inherit;
  text-align: inherit;

  &:focus-visible {
    outline: 2px solid var(--od-action);
    outline-offset: 2px;
  }

  @media (pointer: coarse) {
    min-height: 44px;
  }

  > div {
    display: flex;
    align-items: center;

    span {
      font-size: var(--od-type-content-size);
      ${props => props.theme?.rtl
? css`
        margin-right: 20px;
      `
: css`
        margin-left: 20px;
      `}
    }
  }

  /* The rows that edit a condition are a div, the include-options row is still a button
     (border-box). min-height must count the padding and border the same way on both. */
  @media (pointer: coarse) {
    box-sizing: border-box;
  }
`

// The condition rows open the editor with the mouse only: their keyboard paths are the
// remove checkbox and the edit pencil inside. They render a <div>, while the include-options
// row keeps rendering a <button>, so they get their own component with the same styles.
export const ConditionRow = styled(ConditionItem)``
export const EditButton = styled.button.attrs({ type: 'button' })`
  cursor: pointer;
  border: none;
  background: transparent;
  color: inherit;
  text-align: inherit;
  border-radius: 8px;
  padding: 2px 7px;
  svg {
    font-size: 16px;
    color: ${props => props.theme.colors.primary};
  }
  &:hover {
    background-color: #1507260a;
  }
  &:active {
    background-color: #1507261a;
  }
  ${brandFocusOutline}
  ${coarseHitArea}
`
export const CheckboxWrapper = styled.div`
  width: 18px;
  height: 18px;
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  svg {
    color: #FFF;
    font-size: 16px;
  }
  ${({ isCursorAllowed }) => !isCursorAllowed && css`
    cursor: not-allowed;
  `}

  ${({ active }) => active
? css`
    /* cursor: pointer; */
    background: ${props => props.theme.colors.primary};
  `
: css`
    border: 1px solid #B1BCCC;
  `}
`

// The checked box of a condition row is the one control that removes the condition. It is a
// real button, so it needs the resets a div never had, and it keeps the pointer it used to
// inherit from the row.
export const ConditionCheckButton = styled(CheckboxWrapper)`
  border: none;
  padding: 0;
  color: inherit;
  text-align: inherit;
  cursor: pointer;
  ${brandFocusOutline}
  ${coarseHitArea}
`
