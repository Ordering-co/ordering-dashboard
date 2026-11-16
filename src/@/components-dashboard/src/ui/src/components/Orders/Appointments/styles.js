import styled from 'styled-components'

export const Container = styled.div`
  flex: 1;
  padding: 20px;
  box-sizing: border-box;
  transition: all ${props => props.theme?.ordering?.motion?.duration?.slow ?? '0.5s'};
  max-height: 100vh;
  /* redesign W1-7 (T1-7-4, b): a screen without events or without a business is still as tall as the window, so the business dropdown
     opened from the header is not cut by this scrolling container (as it was on a phone) */
  min-height: 100vh;
  overflow: auto;
  display: flex;
  flex-direction: column;
  position: relative;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`
export const SpinnerLoaderWrapper = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  inset-inline-start: 0;
  z-index: var(--od-x-layer-sticky);

  > div {
    height: 100%;
  }
`
// the opener is PageHeader's `leading`; the HeaderRow that laid out the pair is gone (the brand harness mounts the same).
// The business selector is the page header's action: a Product button and the shared BusinessSelectHeader dropdown (not edited
// inside), opened under the button and anchored at the end of the row so it does not leave the page.
export const BusinessPicker = styled.div`
  position: relative;
  min-inline-size: 0;
  max-inline-size: 100%;

  > button {
    max-inline-size: 100%;
  }

  .business-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-inline-size: 0;
  }

  > div {
    left: auto;
    inset-inline-end: 0;
    inset-block-start: calc(100% + var(--od-space-1));
    inline-size: min(325px, calc(100vw - 2 * var(--od-x-page-gutter-mobile)));
  }
`

// redesign W1-7 (T1-7-4): every rbc override lives under this class; the vendor sheet is only structure, its colours come from --od-* tokens
export const CALENDAR_CLASS = 'od-appointments-calendar'
export const CalendarWrapper = styled.div.attrs({ className: CALENDAR_CLASS })`
  flex: 1 0 auto;
  display: flex;
  flex-direction: column;
  padding-top: 20px;
  overflow: auto;
  /* the toolbar below measures against this width (100cqw), not against the calendar's own 728px */
  container-type: inline-size;
  /* the wrapper scrolls, so it clips what leaves it: 6px at each side keep the 44px area of the buttons at its edges (decision 12) */
  margin-inline: calc(var(--od-x-space-1-5) * -1);
  padding-inline: var(--od-x-space-1-5);

  /* redesign  (decision 5): in week and day the calendar takes the height left in the window and the hours scroll INSIDE
     the grid (rbc's .rbc-time-content), so the toolbar and the day names stay in view and the page can open the grid at the first
     appointment. Before, the 24 hours grew the page and the grid had nothing to scroll. Never under the 40rem below. */
  &:has(.rbc-time-view) {
    flex: 1 1 0;
    min-block-size: 0;
  }

  .rbc-calendar:has(.rbc-time-view) {
    flex: 1 1 0;
  }

  /* redesign  (R1-04): after a Retry that succeeds the page moves the focus to this region (tabIndex -1) so the keyboard does
     not start again from the top; a programmatic focus draws no ring (a keyboard focus-visible one still would) */
  &:focus:not(:focus-visible) {
    outline: none;
  }

  .rbc-calendar {
    --appointments-month-event-size: calc(18px + 15px + 2 * 2px + 2 * 1px);
    /* redesign W1-7 (T1-7-4, W1-A0-01): the calendar takes its own place. rbc gives it height: 100% of a wrapper whose height is
       indefinite on a phone, and it collapsed to 60x21; it now fills the wrapper. */
    block-size: auto;
    flex: 1 1 auto;
    color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors.lightGray};

    /* redesign  (decision 6, auditor): the minimums belong to the grids (the month's seven columns, the time grid's days), never
       to the calendar as such: the List view has neither, so it takes the width of the page with no sideways scroll. The calendar
       never goes under room for six month rows. */
    &:has(.rbc-month-view),
    &:has(.rbc-time-view) {
      min-width: 728px;
      min-block-size: 40rem;
    }

    .rbc-header {
      padding: 7px 3px;
      span {
        font-size: var(--od-type-section-title-size);
        font-weight: 600;
        color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};
      }
    }

    .rbc-time-view {
      border-left: none;
      border-right: none;
      .rbc-allday-cell {
        display: none;
      }
      .rbc-time-content {
        border-width: 1px;
      }
    }
    .rbc-event {
      background-color: ${props => props.theme?.ordering?.semantic?.background ?? props.theme.colors.backgroundPage};
      border: none;
      padding: 0;
      color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};
    }
    /* redesign W1-7 (T1-7-4, b): the day numbers, week headers and «+N more» share the event's pinned focus ring.
       redesign C1a (W1-QC1-02): the month's event is not an rbc-event itself but the button inside it, which takes the same ring. */
    .rbc-event:focus-visible,
    .rbc-event [role='button']:focus-visible,
    .rbc-button-link:focus-visible,
    .rbc-show-more:focus-visible {
      outline: 2px solid ${props => props.theme?.ordering?.semantic?.action?.focus ?? props.theme.colors.primary};
      outline-offset: 2px;
    }
    .rbc-event-label {
      display: none;
    }
    .rbc-timeslot-group {
      min-height: 60px;
    }

    /* redesign W1-7 (T1-7-4): the vendor sheet's hex colours (borders, today, off-range, now line, show-more) replaced by tokens */
    .rbc-month-view,
    .rbc-time-view,
    .rbc-month-row + .rbc-month-row,
    .rbc-day-bg + .rbc-day-bg,
    .rbc-rtl .rbc-day-bg + .rbc-day-bg,
    .rbc-timeslot-group,
    .rbc-time-view-resources .rbc-time-gutter,
    .rbc-time-view-resources .rbc-time-header-gutter,
    .rbc-time-view .rbc-allday-cell + .rbc-allday-cell,
    .rbc-time-header.rbc-overflowing,
    .rbc-rtl .rbc-time-header.rbc-overflowing,
    .rbc-time-header > .rbc-row:first-child,
    .rbc-time-header > .rbc-row.rbc-row-resource,
    .rbc-time-header-content,
    .rbc-rtl .rbc-time-header-content,
    .rbc-time-header-content > .rbc-row.rbc-row-resource,
    .rbc-time-content,
    .rbc-time-content > * + * > *,
    .rbc-rtl .rbc-time-content > * + * > *,
    .rbc-header,
    .rbc-header + .rbc-header,
    .rbc-rtl .rbc-header + .rbc-header {
      border-color: var(--od-border);
    }
    .rbc-day-slot .rbc-time-slot {
      border-top-color: var(--od-border);
    }
    .rbc-today {
      background-color: var(--od-action-soft);
    }
    .rbc-off-range {
      color: var(--od-text-subtle);
    }
    .rbc-off-range-bg {
      background: var(--od-surface-subtle);
    }
    .rbc-current-time-indicator {
      background-color: var(--od-action);
    }
    .rbc-show-more {
      color: var(--od-action-content);
    }

    /* redesign W1-7 (T1-7-4, decision 12): the calendar's own controls (day numbers, week headers, «+N more», events).
       With a fine pointer none is under 24px.
       redesign  (R1-01): .rbc-event takes position only in the month. In the time grid rbc places each appointment with
       position: absolute and an inline top and height; a position: relative here put every one at the wrong hour. */
    .rbc-button-link,
    .rbc-show-more {
      position: relative;
    }
    .rbc-month-view .rbc-event {
      position: relative;
    }
    .rbc-date-cell {
      /* the 44px area of a day number (phone, below) must not reach the first event of its cell */
      padding-block-end: var(--od-x-space-1-5);
    }
    .rbc-date-cell > .rbc-button-link {
      display: inline-flex;
      align-items: center;
      justify-content: flex-end;
      min-inline-size: var(--od-x-target-fine);
      min-block-size: var(--od-x-target-fine);
    }
    .rbc-header > .rbc-button-link {
      display: flex;
      align-items: center;
      justify-content: center;
      inline-size: 100%;
      min-block-size: var(--od-x-target-fine);
    }
    .rbc-show-more {
      display: flex;
      align-items: center;
      min-block-size: var(--od-x-target-fine);
    }
    .rbc-event {
      min-block-size: var(--od-x-target-fine);
    }
    /* redesign C1a (W1-QC1-01): rbc counts how many events fit in a month row by measuring a dummy event (a bare &nbsp; in a
       .rbc-event, 24px) and then draws the real ones (name and time, 39px): the row held 4 and drew 3 cut, and «+N more» fell
       outside its row. The month event now has ONE height, the real content's (two lines of 18 and 15px, 2px of padding and 1px of
       border at each side; --appointments-month-event-size), so the dummy and the real events measure the same. With a coarse
       pointer or on a phone the 44px minimum above wins for both. */
    .rbc-month-view .rbc-event {
      block-size: var(--appointments-month-event-size);
    }
    /* the event's button (the summary inside the event) fills the event: with the 44px minimum of a coarse pointer it is 44px too */
    .rbc-month-view .rbc-event-content {
      block-size: 100%;
    }
    /* rbc also draws one event plus «+N more» (two slots) when it counts room for only one. redesign  (W1-D-34): with a fine
       pointer the row holds TWO events and «+N more», so a month row is never shorter than its day number, three slots (an event and
       1px of the segment under it, each) and its 1px top border. The coarse pointer and phone rules below are unchanged. */
    .rbc-month-row {
      min-block-size: calc(1px + var(--od-x-target-fine) + var(--od-x-space-1-5) + 2 * (var(--appointments-month-event-size) + 1px) + var(--appointments-month-event-size) + 1px);
    }

    /* Phone or coarse pointer: a day number and a week header are SEEN at 32px and reach 44px through a centered pseudo-element
       (as the Product buttons); a day number sits against its cell's first event, so the cell keeps room for the area. «+N more» and
       the events are cells of a dense grid, stacked with no gap: they are 44px visible instead (neighbours under 12px apart), listed for
       the owner (W0-D-08). The time grid grows to make a 30 minute appointment 44px tall. */
    @media (pointer: coarse), (max-width: 767px) {
      /* the month row clips what leaves it: the first row of a cell keeps the 6px the area of its day number takes above the box */
      .rbc-date-cell {
        padding-block-start: var(--od-x-space-1-5);
      }
      .rbc-date-cell > .rbc-button-link,
      .rbc-header > .rbc-button-link {
        min-inline-size: var(--od-x-control-height);
        min-block-size: var(--od-x-control-height);
      }
      .rbc-date-cell > .rbc-button-link::after,
      .rbc-header > .rbc-button-link::after {
        content: '';
        position: absolute;
        inset: var(--od-x-target-inset);
      }
      .rbc-show-more,
      .rbc-event {
        min-block-size: var(--od-x-target-coarse);
      }
      /* appointments at the same time share a column of the time grid: none goes under 32px wide */
      .rbc-day-slot .rbc-event {
        min-inline-size: var(--od-x-control-height);
      }
      /* room for a day number and two 44px events: rbc counts the events that fit from the height of the row
         (redesign C1a, W1-QC1-01: plus the 1px top border and the 1px under each slot, which the 132px used to leave out and let
         «+N more» stand 2px past the row) */
      .rbc-month-row {
        min-block-size: calc(1px + var(--od-x-control-height) + 2 * var(--od-x-space-1-5) + 2 * (var(--od-x-target-coarse) + 1px));
      }
      .rbc-timeslot-group {
        min-height: calc(var(--od-x-target-coarse) * 2);
      }
    }

    /* redesign C1a (W1-QC1-04, W1-PC1-01, W1-D-21): the grid in thirds (month) and halves (week) is PRESENTATION for phones only
       (proposal), so it lives under the width of a phone and not under the pointer: a touch tablet keeps main's calendar (728px
       minimum, all seven days in view). The touch targets above still follow the pointer.
       redesign  (n.º 29, W1-D-21): and only under 600px. From 600 to 767 the month and the week show all seven days with no
       widening, as from 768 up (the owner's answer); under 600 the calendar is wider than a phone and scrolls sideways (as in main), its
       width whole columns of the visible width (three of seven), so at rest no day cell is cut by the edge of the scroller. */
    @media (max-width: 599px) {
      &:has(.rbc-month-view) {
        min-width: calc(100cqw * 7 / 3);
      }
      /* the week and day grids have a time gutter of a fixed width; their columns (seven in the week) are sized so that two of them fill
         what is left of the visible width (their day names need more room than a month's cells) */
      .rbc-time-gutter,
      .rbc-time-header-gutter {
        flex: none;
        inline-size: 5rem;
      }
      &:has(.rbc-time-view) {
        min-width: calc(100cqw * 7 / 2 - 5rem * 5 / 2);
      }
    }
    /* redesign  (n.º 29): from 600 to 767 the page is narrower than main's 728px minimum, which still scrolled a day or two
       out of view; the grids take the width of the page there, so all seven days are in view */
    @media (min-width: 600px) and (max-width: 767px) {
      &:has(.rbc-month-view),
      &:has(.rbc-time-view) {
        min-width: 0;
      }
    }

    /* redesign  (decision 6): the week and day event is ONE line (EventComponent): centred in the event, inside it, and the
       line ends in an ellipsis instead of widening the event */
    .rbc-time-view .appointments-event-inline {
      inline-size: 100%;
      min-inline-size: 0;
      block-size: 100%;
      align-items: center;
      justify-content: flex-start;
      overflow: hidden;
      /* tanda P: the event is the container of the queries in appointments-events.css (the photo gives its room to the
         hour in a narrow event); styled-components drops nested @container rules */
      container-type: inline-size;
    }

    /* redesign C1a (W1-QC1-08): the hours of the gutter are isolated, so a right-to-left language does not reorder digits and meridiem */
    .rbc-time-gutter .rbc-label {
      unicode-bidi: isolate;
      direction: ltr;
    }
  }
`
export const CalendarHeaderContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  /* redesign W1-7 (T1-7-4): 12px between rows and buttons, so the 44px areas of two 32px buttons never cross (decision 12) */
  gap: var(--od-space-3);
  margin-bottom: 15px;
  /* redesign W1-7 (T1-7-4, b): the toolbar stays in view while a phone scrolls the 728px calendar sideways (its view buttons used to
     sit past the right edge, out of reach) */
  position: sticky;
  inset-inline-start: 0;
  inline-size: min(100cqw, 100%);
  box-sizing: border-box;
`
export const CalendarLabelContainer = styled.div`
  display: flex;
  align-items: center;
  min-width: 0;
  /* redesign  (R1-02): the row is «Today» · ‹ · › · label, so the buttons never move with the width of the label; 12px
     between buttons so their 44px areas never cross (decision 12) */
  gap: var(--od-space-3);

  span.label {
    font-weight: 600;
    font-size: var(--od-type-section-title-size);
    margin: 0;
    color: ${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};
    overflow-wrap: anywhere;
  }

  /* redesign  (decision 3): «Today» is the first of the row */
  .today {
    flex: 0 0 auto;
  }
`
// redesign (R1-02): the gap between the label and the views. It exists with or without a notice, so a notice that comes
// and goes moves nothing. On a phone it is the third row (under the views) and is not there while empty.
export const ToolbarNoticeSlot = styled.div`
  flex: 1 1 0;
  min-inline-size: 0;

  /* the notice is quiet text here: no page gutter around it (the Product notice carries one), one line that ends in an ellipsis */
  .odc-notice {
    margin: 0;
    inline-size: fit-content;
    max-inline-size: 100%;
    box-sizing: border-box;
  }
  .odc-notice-text {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (max-width: 767px) {
    order: 3;
    flex: 1 0 100%;

    &:empty {
      display: none;
    }
  }
`
// redesign (decision 3): the views are a Product SegmentedControl, which needs a container of definite width (it measures its
// options against it and becomes a <select> when they do not fit: the rule of the system, C13). Beside the arrows it is as wide as
// its options need, up to 20rem; below 768px it is the second row of the toolbar and takes the whole row.
export const ViewSwitch = styled.div`
  inline-size: min(20rem, 100%);
  min-inline-size: 0;

  /* tanda P: the options end where the calendar ends (the track was left at the start of its 20rem, ~110px short of
     the edge). The control still measures its whole box; only the track moves. Below 768px the track fills the row (below). */
  .odc-seg {
    text-align: end;
  }

  @media (max-width: 767px) {
    flex: 1 0 100%;
    inline-size: 100%;

    /* the options share the row: the track fills it */
    .odc-seg > .odc-seg-track {
      display: flex;
    }
    .odc-seg > .odc-seg-track > .odc-seg-btn {
      flex: 1 1 0;
    }
  }
`
export const EventContainer = styled.div`
  display: flex;
  justify-content: space-between;
  border: 1px solid ${props => props.theme?.ordering?.semantic?.border?.default ?? props.theme.colors.gray};
  padding: 2px 5px;
  border-radius: ${props => props.theme?.ordering?.radius?.panel ?? '8px'};
  height: 100%;
  box-sizing: border-box;

  > div.info {
    width: calc(100% - 42px);
    p {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    p.name {
      font-size: var(--od-type-secondary-size);
      font-weight: 500;
      line-height: 18px;
      margin: 0;
      /* redesign C1a (W1-QC1-08): the name takes the direction of its own text, so a Latin name in a right-to-left page is cut at its end */
      unicode-bidi: plaintext;
    }
    p.date {
      font-size: var(--od-type-secondary-size);
      line-height: 15px;
      color: ${props => props.theme?.ordering?.semantic?.text?.muted ?? props.theme.colors.lightGray};
      margin: 0;
    }
  }
`
export const EventProfessionalPhoto = styled.div`
  width: 32px;
  height: 32px;
  border-radius: ${props => props.theme?.ordering?.radius?.panel ?? '8px'};
  box-shadow: ${props => props.theme?.ordering?.shadow?.[1] ?? '0px 1px 4px rgba(0, 0, 0, 0.1)'};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  img {
    width: 100%;
    height: 100%;
    border-radius: ${props => props.theme?.ordering?.radius?.panel ?? '8px'};
    object-fit: cover;
  }
  svg {
    width: 85%;
    height: 85%;
  }
`
