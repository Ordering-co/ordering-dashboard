import styled from 'styled-components'
import { entitySelectorStyle } from './entity-selector-theme'
import './messages-listing.css'

export const MessagesListingContainer = styled.div.attrs(props => ({ className: 'od-ui od-messages-listing', dir: props.dir ?? (props.theme?.rtl ? 'rtl' : 'ltr'), 'data-slot': 'messages-listing' }))`
  ${props => entitySelectorStyle(props.theme)}
  flex: 1;
  transition: all 0.5s;
  padding: 20px;
  box-sizing: border-box;
  max-height: 100vh;
  overflow: auto;
  min-height: 100vh;

  /* redesign tramo B r1 fixes (W1-QB1-02): from 1024px the page is a column of exactly the window's height (header, notice slot,
     then the conversation fills what is left), so the text field and the pager are in view whatever the header measures */
  @media (min-width: 1024px) {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }
`

// redesign messages B3b: the two-pane inbox (Orders/Messages/Inbox.jsx, inbox.css) owns the list and conversation panes; this file keeps
// the page container only (the former MessagesContent, OrdersContainer, FilterContainer, tabs, sort and MessageContainer are gone).
