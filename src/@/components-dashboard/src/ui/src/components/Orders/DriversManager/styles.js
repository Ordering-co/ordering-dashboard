import styled from 'styled-components'

// redesign drivers-dashboard B4 (DD-02): the page is a column (head, notice, sound slot, board). From 1024px it is as tall as the window and
// the board takes what is left (DriversContent), so nothing overflows and there is no second scroll; below, it has the height of its content
// and the page scrolls (same model as O/DeliveriesManager). «Filters applied» is in the flow and the flex absorbs it, so the variable
// that subtracted its height from the list (--odc-drivers-notice) and its [data-filtered] rule are gone.
export const DriversContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-inline-size: 0;
  transition: all ${props => props.theme?.ordering?.motion?.duration?.slow ?? '0.5s'};
  padding: 20px;
  box-sizing: border-box;
  /* clip, not hidden: «hidden» would make this a scroll container and the panel of the phone's list view (sticky) would stick to it, not to the window */
  overflow-x: clip;

  @media (min-width: 1024px) {
    block-size: calc(var(--vh, 1vh) * 100);
    overflow: hidden;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  @media print {
    display: none;
  }
`

// redesign W1-4 (T1-4-4a): the head is P/PageHeader. the opener is PageHeader's `leading`, so this wrapper only keeps the
// two rules below (the title's case and the head's bottom padding).
export const DriversHeader = styled.div`
  /* main wrote the title in Title Case (text-transform: capitalize on the h1); PageHeader's title has no transform of its own. */
  .odc-pagehead-title {
    text-transform: capitalize;
  }

  /* The page's own 20px padding and the notification slot already separate the head from the list (main's head had no bottom space
     either). */
  .odc-pagehead {
    padding-block-end: 0;
  }
`

// redesign drivers-dashboard B4 (DD-02): the board's cell. A column that, from 1024px, takes the height the page leaves and lets the board
// (drivers-board.css) share it between the two columns; below, the height of its content.
// redesign tanda AB (O-3): no top margin of its own; the FilterBar above ends with its own block padding (--od-space-3), the
// gap that /deliveries and /all-in-one have between the bar and the board. The search and the notice moved there from the head.
export const DriversContent = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1 0 auto;
  min-inline-size: 0;

  @media (min-width: 1024px) {
    flex: 1 1 0;
    min-block-size: 0;
  }
`
