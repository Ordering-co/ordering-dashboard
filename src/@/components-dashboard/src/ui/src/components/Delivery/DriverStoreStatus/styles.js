import styled from 'styled-components'

// redesign W1-8 (T1-8-4): the page frame, the figures' gap, the store cards and the row tint are the only own styles left. The header,
// search, table, loading, empty state and foot are Product wrappers (P/); every value is a var(--od-*) token.

export const Container = styled.div`
  flex: 1;
  box-sizing: border-box;
  /* redesign tanda AB (, O-3): the inset of the other operations pages (20px, so the page starts at x = 268 after the sidebar,
     not 272 with the 24px page gutter): space-5 minus space-1 */
  padding: calc(var(--od-space-5) - var(--od-space-1));
  max-height: 100vh;
  overflow: auto;
`

export const FiltersContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--od-space-3);
  margin-block-end: var(--od-space-4);
`

export const FilterItem = styled.div`
  min-inline-size: min(100%, 220px);
  flex: 0 1 auto;
`

// redesign driver-store-status (decision 1): the figures are P/MetricGrid + P/Metric; this wrapper only keeps the
// gap that the old KPI row left under them.
export const KpiSection = styled.div`
  margin-block-end: var(--od-space-5);
`

// redesign driver-store-status (decision 1): «N without online drivers» turns red when N > 0 (a local span: P/Metric stays as is)
// redesign driver-store-status (review r1, Q-05): «(N Busy)» never breaks inside its brackets
export const NoWrap = styled.span`
  white-space: nowrap;
`

export const AlertRef = styled.span`
  &[data-alert] {
    color: var(--od-danger-functional);
    font-weight: var(--od-font-weight-semibold);
  }

  /* the figure inside a reference is dark by default (.odc-metric-ref .odc-figure); the whole phrase is red here, as before */
  &[data-alert] .odc-figure {
    color: inherit;
  }
`

// redesign driver-store-status (decision 2): an «Active unassigned» figure above 0 is semibold, in the table and in the cards
export const AttentionValue = styled.span`
  &[data-attention] {
    font-weight: var(--od-font-weight-semibold);
  }
`

// redesign driver-store-status (M-DSS1): the partial-error notice keeps a gap above the table
export const NoticeArea = styled.div`
  margin-block-end: var(--od-space-4);
`

// A store without online drivers is tinted by the row's data attribute (getRowAttributes), not by a class of ours.
export const TableArea = styled.div`
  /* redesign tramo C r1 (W1-QC1-15): the store cell is the row header (th scope=row) and takes the same tint */
  tr[data-no-online] td,
  tr[data-no-online] th[scope='row'] {
    background: var(--od-danger-soft);
  }
`

export const ConnectedValue = styled.span`
  font-weight: var(--od-font-weight-bold);

  &[data-zero] {
    color: var(--od-danger-functional);
  }
`

// (row 29, driver-store-status P-4): the «Not in any delivery group» tag on its own line; in the card the name's bottom margin
// already separates them, so the room goes below the tag, before the figures
export const UngroupedNote = styled.div`
  margin: ${props => props.$card ? '0 0 var(--od-space-2)' : 'var(--od-space-1) 0 0'};
`

// (row 31, driver-store-status P-9): the Online drivers figure and, when every connected driver is busy, its text mark
// (P/Status), on one line when it fits and wrapping under the figure when it does not (390 px cards never scroll sideways).
export const ConnectedCell = styled.span`
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: flex-end;
  gap: var(--od-space-1) var(--od-space-2);
  max-inline-size: 100%;
  min-inline-size: 0;
`

// (row 28, driver-store-status P-1, D-22): the two exits of a store («View drivers», «View unassigned orders») are P/Button links
// (anchors, so a modified click opens a tab). (rows 28-29, live check): the table's Actions cell now holds one P/Menu instead
// (StoreActionsMenu), so these links are the phone card's: they wrap and sit under the figures, after the room the figures' grid leaves.
export const StoreExits = styled.div`
  display: flex;
  flex-wrap: ${props => props.$card ? 'wrap' : 'nowrap'};
  align-items: center;
  gap: var(--od-space-1) var(--od-space-4);
  min-inline-size: 0;
  margin: ${props => props.$card ? 'var(--od-space-3) 0 0' : '0'};
`

// The two order columns load on their own: the cell holds a Skeleton at the width of a figure.
export const FigureSkeleton = styled.span`
  display: inline-flex;
  justify-content: flex-end;
  min-inline-size: var(--od-space-5);
`

// redesign driver-store-status (decision 3): under 768 each store is a card with its four figures (the card itself has no link and no focus; the store's two exits sit at its foot, row 28)
export const StoreList = styled.ul`
  display: grid;
  gap: var(--od-space-3);
  min-inline-size: 0;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const StoreCard = styled.li`
  box-sizing: border-box;
  min-inline-size: 0;
  padding: var(--od-space-3) var(--od-space-4);
  background: var(--od-surface);
  border-width: var(--od-x-hairline);
  border-style: solid;
  border-color: var(--od-border);
  border-radius: var(--od-radius-component);
  color: var(--od-text);

  /* the same tint as the table row of a store without online drivers */
  &[data-no-online] {
    background: var(--od-danger-soft);
  }
`

// The card's heading: it names the store, so it takes the content size and semibold.
export const StoreName = styled.h2`
  margin: 0 0 var(--od-space-2);
  font-size: var(--od-type-content-size);
  font-weight: var(--od-font-weight-semibold);
  color: var(--od-text);
  overflow-wrap: anywhere;
`

// 2×2: Online drivers, Total drivers / Active unassigned, Finished today
export const StoreFigures = styled.dl`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--od-space-2) var(--od-space-3);
  min-inline-size: 0;
  margin: 0;

  > div {
    min-inline-size: 0;
  }

  dt {
    color: var(--od-text-muted);
    font-size: var(--od-type-secondary-size);
    font-weight: var(--od-font-weight-regular);
    overflow-wrap: anywhere;
  }

  dd {
    margin: var(--od-space-1) 0 0;
    font-size: var(--od-type-content-size);
  }
`
