import styled, { css } from 'styled-components'

// redesign SL-F1 (A3): the page frame is the only own style left of the list. The header, the filters, the selection bar, the table
// and the cards are Product pieces (Stores/StoresList). Every value is a var(--od-*) token; the phone gutter comes from `isPhone`
// (useIsPhone) because the literal guard reads breakpoints only in CSS.

export const BusinessListingContainer = styled.div`
  flex: 1;
  box-sizing: border-box;
  min-inline-size: 0;
  padding: var(--od-x-page-gutter);

  ${({ isPhone }) => isPhone && css`
    padding-inline: var(--od-x-page-gutter-mobile);
  `}

  @media print {
    display: none;
  }
`
