import React from 'react'

import {
  OptionItem,
  WrapperPagination as SelectHeaderWrapperPagination
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/BusinessSelectHeader/styles'

// Presentation-only fixture: the real Stores (business listing filters) styled
// surfaces, no controller, SDK, account or network. Every interactive node
// here is mounted exactly as it exists in today's source: a styled `div`/
// `span`/`p` with `onClick` stays that element (never promoted to `<button>`),
// per the a3 lesson. Real `<button>` usages are native `<button type='button'>`
// with an accessible name.
//
// Real-nesting adaptations (checked against each source styles.js and its
// consuming index.js before mounting, per the a2/a3 batch lesson):
// - (Retired 2026-10-20, the old list pieces BusinessesList,
//   BusinessesListingHeader, BusinessFilterGroup, the BusinessTypeFilter UI,
//   BusinessSummary, BusinessDelete and BusinessSupport were deleted as dead code,
//   so their nodes, their native-button checks and the four glyph preservations are gone.)
// - (Retired 2026-10-20, BusinessActiveStateFilter had no production consumer and was
//   deleted as dead code, so its `Tab` node and its native-button / focus-ring checks are gone.)
// - (Retired 2026-10-09: the /stores/list redesign, / a63b5d4a, removed
//   BusinessesListing/styles.js's `ViewMethodButton`; its card/list toggle now lives in the
//   redesigned list and is covered by e2e/brand-system-app/l4-b1. History of the old rule:)
// - BusinessesListing/styles.js's `ViewMethodButton` was a `styled.span` with
//   `onClick` (never a button in source) whose own rule is `svg
//   { font-size: 20px }` (the `&:hover { svg { font-size: 24px } }` variant
//   is not a base declaration and is not asserted here). index.js renders the
//   view-toggle icon as a direct child of the span, so it is mounted nested
//   inside it, unconverted.
// - BusinessSelectHeader/styles.js's `OptionItem` rule is `> div { b
//   { font-size: 14px } p { font-size: 12px } }`: index.js renders
//   `<OptionItem><img/><div><b>…</b><p>…</p></div></OptionItem>`, so `b` and
//   `p` are mounted nested inside a direct-child `div`, matching that shape.
// - BusinessSelectHeader/styles.js's `WrapperPagination` rule is `>div>div
//   { button { font-size: 12px } }`. The real consumer renders the shared
//   `Pagination` component, whose own styles nest
//   `PaginationContainer`(div) > `PaginationButtonContainer`(div) >
//   `PageButton`(a real `<button>`, via `PaginationButtonBridge`) — the
//   exact two-level div nesting the selector expects. Mounted with plain
//   elements standing in for that library shape (div > div > button),
//   rather than importing the full stateful `Pagination` component.
// - (Retired 2026-10-10, BusinessLogs moved onto Product and plain CSS
//   and its styles.js is gone, so its seven business-logs- nodes are no longer
//   mounted here.)
export const StoresB1StylesFixture = () => {
  return (
    <main data-testid='stores-b1-styles' style={{ display: 'grid', gap: 24, maxWidth: 760, minWidth: 0, padding: 24 }}>
      <OptionItem data-testid='select-header-option-item'>
        <img src='' alt='' />
        <div>
          <b data-testid='select-header-option-name'>Fresh Cuts Salon</b>
          <p data-testid='select-header-option-city'>Denver</p>
        </div>
      </OptionItem>

      <SelectHeaderWrapperPagination className='pagination-container' data-testid='select-header-pagination'>
        <div>
          <div>
            <button type='button' aria-label='Next page' data-testid='select-header-pagination-button'>2</button>
          </div>
        </div>
      </SelectHeaderWrapperPagination>
    </main>
  )
}
