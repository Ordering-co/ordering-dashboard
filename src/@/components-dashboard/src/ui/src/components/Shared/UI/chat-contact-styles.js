import React from 'react'
import styled, { css } from 'styled-components'
import { Button, IconButton } from './Button'
import { entitySelectorStyle } from './entity-selector-theme'
import './chat-contact.css'

export const Container = styled.div.attrs(props => ({ className: 'od-ui od-chat-contacts', dir: props.dir ?? (props.theme?.rtl ? 'rtl' : 'ltr'), 'data-slot': 'chat-contacts' }))`
  ${props => entitySelectorStyle(props.theme)}
  padding: 0px 12px 15px 12px;
  height: calc(100% - 140px);
`

export const CustomersListConatainer = styled.div.attrs({ 'data-slot': 'chat-list-scrollport' })`
  max-height: calc(100% - 50px);
  overflow: auto;
`

export const Card = styled.div.attrs(props => ({ 'data-slot': 'chat-list-row', 'data-selected': props.active ? '' : undefined }))`
  cursor: pointer;
  display: flex;
  align-items: center;
  border: 1px solid var(--od-entity-selector-border);
  box-sizing: border-box;
  border-radius: 8px;
  margin-bottom: 20px;
  padding: 10px 15px;

  &:hover {
    background-color: var(--od-entity-selector-action-soft);
  }

  ${({ active }) => active && css`
    background-color: var(--od-entity-selector-action-soft);
    border: 1px solid var(--od-entity-selector-action-content);
  `}
`

export const WrapperImage = styled.div`
  max-width: 45px;
  max-height: 45px;
  height: 45px;
  width: 45px;
  ${({ isSkeleton }) => !isSkeleton && css`
    border: 1px solid var(--od-entity-selector-border);
  `}
  border-radius: 8px;

  svg {
    width: 100%;
    height: 100%;
    padding: 7px;
    box-sizing: border-box;
    border-radius: 50%;
  }
`

const ImageStyled = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  position: relative;
  background-repeat: no-repeat, repeat;
  background-size: cover;
  object-fit: cover;
  background-position: center;
  border-radius: 10px;
`
export const Image = (props) => {
  return (
    <ImageStyled
      {...props}
      style={{ backgroundImage: `url(${props.bgimage})` }}
    >
      {props.children}
    </ImageStyled>
  )
}

export const InfoContainer = styled.div`
  ${props => props.theme?.rtl
? css`
    margin-right: 15px;
  `
: css`
    margin-left: 15px;
  `}
  > div:first-child {
    display: flex;
    align-items: center;

    svg {
      margin: 0 5px;
    }

    p {
      font-size: 14px;
      color: var(--od-entity-selector-text);
      font-weight: 600;
      margin: 0px;
    }
  }
`

export const AssignedOrdersCount = styled(Button).attrs({ className: 'od-chat-orders-action', type: 'button' })`
  font-size: 14px;
  cursor: pointer;
  color: var(--od-entity-selector-action-content);

  ${({ disabled }) => disabled && css`
    pointer-events: none;
    opacity: 0.5;
  `}
`

export const WrapperPagination = styled.div`
  display: flex;
  align-items: center;
  margin-top: 20px;
`

export const PageButton = styled(IconButton).attrs({ className: 'od-chat-page-action', type: 'button' })`
  outline: none;
  border: 1px solid var(--od-entity-selector-border);
  border-radius: 100%;
  background: transparent;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin: 0 5px;

  /* redesign W1-6 (T1-6-4, D-24): pressed, the glyph is the inverse of the action fill. Before, the same blue content token drew
     on the blue action fill (about 2.3:1). The glyph is the svg (the legacy icon button paints it itself), so it is set below
     and in chat-contact.css, where it wins over that rule. */
  &:active {
    background: var(--od-entity-selector-action);
    color: var(--od-text-inverse);
  }
  &:disabled {
    cursor: no-drop;
    pointer-events: none;
  }
`

export const WrapperPageState = styled.div`
  display: flex;
  min-width: 140px;
`
