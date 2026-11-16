import styled from 'styled-components'

// redesign OC-B: the page frame is the only own style left. The header, filters, table, foot and panel are Product
// pieces (Shared/Product, OpenCartsQueue, OpenCartPanel); the split view's height, the phone gutter and print are in
// OpenCartsQueue/open-carts.css (the literal guard reads breakpoints only in CSS).
// Every value is a var(--od-*) token.

export const ListFrame = styled.div`
  box-sizing: border-box;
  min-inline-size: 0;
  padding: var(--od-x-page-gutter);
`

// The line that says the list is a window of what exists (Follow up and Live now ask for a capped number of carts).
export const Foot = styled.div`
  display: grid;
  gap: var(--od-space-2);
`
