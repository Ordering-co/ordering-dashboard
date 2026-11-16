import React from 'react'

import {
  ActionBlock as AvActionBlock,
  ChartHeaderContainer as AvHeader
} from '../../../src/@/components-dashboard/src/ui/src/components/BusinessIntelligence/AnalyticsAvailableTimes/styles'
import {
  ActionBlock as BtActionBlock,
  ChartHeaderContainer as BtHeader
} from '../../../src/@/components-dashboard/src/ui/src/components/BusinessIntelligence/AnalyticsBusyTimes/styles'
import {
  SelectBtnWrapper as DfSelectBtn,
  TreeViewChildrenItem as DfChildItem,
  TreeViewChildrenLabel as DfChildLabel,
  TreeViewParentItem as DfParentItem,
  TreeViewParentLabel as DfParentLabel
} from '../../../src/@/components-dashboard/src/ui/src/components/BusinessIntelligence/AnalyticsDriversFilter/styles'
import {
  OrderStatusFilterContainer as AsfContainer,
  Tab as AsfTab
} from '../../../src/@/components-dashboard/src/ui/src/components/BusinessIntelligence/AnalyticsStatusFilterBar/styles'
import {
  BusinessCalendarWrapper as DaCalendar,
  BusinessFilterWrapper as DaFilter,
  HeaderTitleContainer as DaHeader
} from '../../../src/@/components-dashboard/src/ui/src/components/BusinessIntelligence/DriverAnalytics/styles'
import {
  LoadingMessage as GlMessage
} from '../../../src/@/components-dashboard/src/ui/src/components/BusinessIntelligence/GraphLoadingMessage/styles'

// Batch fixture for b1-analytics-filters, the first of Wave B and the layer's first
// entry into `BusinessIntelligence`.
//
// It mounts the migrated STYLES, not the controllers, for the same reason as every
// batch of Wave A — and here that boundary also keeps the charts out. Section 5.2 of
// the goal warns that a size INSIDE a canvas is not governed by a CSS variable, and
// this batch proved it concretely: `AnalyticsAvailableTimes` and `AnalyticsBusyTimes`
// configure Chart.js with `scales.x.ticks.font.size: 12`, painted into the `<canvas>`
// by react-chartjs-2. Those are NOT in this batch's universe — the engine cannot read
// them and no rule reaches them. The `<p>` of `ChartHeaderContainer` in the very same
// files IS here, because it is ordinary DOM outside the canvas. The distinction is not
// "lives in a chart component", it is "painted by the canvas or painted by the DOM".
const Glyph = ({ testid }) => (
  <svg data-testid={testid} viewBox='0 0 16 16' width='1em' height='1em'><circle cx='8' cy='8' r='7' /></svg>
)

export const AnalyticsB1StylesFixture = () => (
  <div data-testid='analytics-b1-styles' style={{ padding: 24, display: 'grid', gap: 12 }}>

    {/* AnalyticsAvailableTimes and AnalyticsBusyTimes are twins: identical markup at
        identical line numbers. They are mounted side by side so the spec measures both
        rather than trusting that one stands for the other. */}
    <AvHeader data-testid='av-header-wrapper'>
      <p data-testid='av-header'>Available Times</p>
      <AvActionBlock data-testid='av-actions'>
        {/* The svgs used to carry the onClick themselves -- not keyboard reachable and
            with no accessible name. This batch wrapped them in real buttons in BOTH
            twins. This fixture mounts the SHAPE, not the product's markup, so it
            cannot attest that both were converted; the batch record says how that was
            checked and which tools do NOT cover it. */}
        <button type='button' aria-label='Expand' data-testid='av-action-button'><Glyph testid='av-action-icon' /></button>
      </AvActionBlock>
    </AvHeader>
    <BtHeader data-testid='bt-header-wrapper'>
      <p data-testid='bt-header'>Busy Times</p>
      <BtActionBlock data-testid='bt-actions'>
        <button type='button' aria-label='Expand' data-testid='bt-action-button'><Glyph testid='bt-action-icon' /></button>
      </BtActionBlock>
    </BtHeader>

    {/* AnalyticsDriversFilter — the tree. Its three 15px labels are decided together:
        they are option labels of a filter, not table cells, and splitting them by where
        the click handler happens to sit would separate three siblings that do the same
        job. `TreeViewChildrenLabel` is not interactive at all, which is why `control`
        would have been false for it and `control-value` is not. */}
    <DfParentItem data-testid='df-parent-item'>
      <Glyph testid='df-parent-icon' />
      <DfParentLabel data-testid='df-parent-label'>Madrid drivers</DfParentLabel>
    </DfParentItem>
    <DfChildItem data-testid='df-child-item'>
      <Glyph testid='df-child-icon' />
      <DfChildLabel data-testid='df-child-label'>Ana Driver</DfChildLabel>
    </DfChildItem>
    <DfSelectBtn data-testid='df-select-wrapper'>
      <button type='button' data-testid='df-select-button'>
        Select All<Glyph testid='df-select-icon' />
      </button>
    </DfSelectBtn>

    {/* AnalyticsStatusFilterBar — the lapse tabs, with the product's real styled components.
        The product mounts them inside DragScroll, whose track is a flex row; the wrapper
        stands in for it. One active and three inactive, as the product renders them. */}
    <AsfContainer data-testid='asf-container'>
      <div style={{ display: 'flex' }}>
        <AsfTab data-testid='asf-tab-today' active aria-pressed='true'>Today</AsfTab>
        <AsfTab data-testid='asf-tab-yesterday' aria-pressed='false'>Yesterday</AsfTab>
        <AsfTab data-testid='asf-tab-last-7-days' aria-pressed='false'>Last 7 days</AsfTab>
        <AsfTab data-testid='asf-tab-last-30-days' aria-pressed='false'>Last 30 days</AsfTab>
      </div>
    </AsfContainer>

    {/* DriverAnalytics: three sites (the twin BusinessAnalytics styles went with the old page). */}
    <DaHeader data-testid='da-header-wrapper'><h1 data-testid='da-header'>Delivery reports</h1></DaHeader>
    <DaFilter data-testid='da-filter-wrapper'><button type='button' data-testid='da-filter'>Country</button></DaFilter>
    <DaCalendar data-testid='da-calendar-wrapper'>
      <button type='button'><Glyph testid='da-calendar-icon' /></button>
    </DaCalendar>

    {/* GraphLoadingMessage */}
    <GlMessage data-testid='gl-message'>Please wait while we load all the information</GlMessage>
  </div>
)
