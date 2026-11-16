import React from 'react'

import {
  ActionBlock as CSActionBlock,
  CustomerSatisfactionHeader as CSCustomerSatisfactionHeader,
  ScoreDiv as CSScoreDiv,
  StarContent as CSStarContent
} from '../../../src/@/components-dashboard/src/ui/src/components/BusinessIntelligence/AnalyticsCustomerSatisfaction/styles'
import {
  ActionBlock as DOActionBlock,
  ChartFooterContainer as DOChartFooterContainer,
  ChartHeaderContainer as DOChartHeaderContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/BusinessIntelligence/AnalyticsDriverOrders/styles'
import {
  HeatMapToggleWrap as MHeatMapToggleWrap
} from '../../../src/@/components-dashboard/src/ui/src/components/BusinessIntelligence/AnalyticsMap/styles'
import {
  OrdersAcceptSpendHeader as OASOrdersAcceptSpendHeader,
  ReviewBlock as OASReviewBlock,
  ReviewContentWrapper as OASReviewContentWrapper,
  TimeContentWrapper as OASTimeContentWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/BusinessIntelligence/AnalyticsOrdersAcceptSpend/styles'
import {
  ActionBlock as OSActionBlock,
  OrderStatusFooter as OSOrderStatusFooter,
  OrderStatusHeader as OSOrderStatusHeader
} from '../../../src/@/components-dashboard/src/ui/src/components/BusinessIntelligence/AnalyticsOrdersStatus/styles'
import {
  AnalyticsSpendListHeader as SLAnalyticsSpendListHeader,
  ReviewBlock as SLReviewBlock,
  ReviewContentWrapper as SLReviewContentWrapper,
  TimeContentWrapper as SLTimeContentWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/BusinessIntelligence/AnalyticsSpendList/styles'
import {
  ActionBlock as STActionBlock,
  ChartHeaderContainer as STChartHeaderContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/BusinessIntelligence/AnalyticsSpendTimes/styles'
import {
  ActionBlock as TOActionBlock,
  AnalyticsTopOrdersHeader as TOAnalyticsTopOrdersHeader,
  PercentContainer as TOPercentContainer,
  TopOrdersContent as TOTopOrdersContent,
  ValueContainer as TOValueContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/BusinessIntelligence/AnalyticsTopOrders/styles'
// Batch fixture for b2-analytics-charts: the chart cards of BusinessIntelligence.
//
// It mounts the migrated STYLES, not the controllers, which is also what keeps the
// charts out of the run: nothing here instantiates react-chartjs-2. That matters
// because the Chart.js tick sizes of this batch are painted INSIDE a `<canvas>` and
// no CSS variable governs them -- they are not in this batch's universe at all, and
// the batch record names each one.
//
// The fixture is GENERATED from the ruleset rather than hand-written: the rows repeat
// the same card shape, and a hand-written mount across so many near-copies is how
// near-copies drift apart.
//
// What it deliberately does NOT mount: a preservation whose own declared reason says
// the selector reaches no node the product renders. The first version of this fixture
// mounted a `<p>` inside TimeContentWrapper so the spec could assert 14px over it --
// green, and about a node that does not exist in the product. The generator now drops
// those by the same criterion verify-spec-tables derives, so the table and the mount
// move together.
const Glyph = ({ testid }) => (
  <svg data-testid={testid} viewBox='0 0 16 16' width='1em' height='1em'><circle cx='8' cy='8' r='7' /></svg>
)

export const AnalyticsB2StylesFixture = () => (
  <div data-testid='analytics-b2-styles' style={{ padding: 24, display: 'grid', gap: 12 }}>

    {/* AnalyticsCustomerSatisfaction */}
    <CSCustomerSatisfactionHeader data-testid='cs-customer-satisfaction-header-wrap'>
      <p data-testid='cs-customer-satisfaction-header-p'>Available times</p>
    </CSCustomerSatisfactionHeader>
    <CSScoreDiv data-testid='cs-score-div-wrap'>
      <p data-testid='cs-score-div-p'>Available times</p>
    </CSScoreDiv>
    <CSActionBlock data-testid='cs-action-block-wrap'>
      <button type='button' aria-label='Download' data-testid='cs-download-button'>
        <Glyph testid='cs-action-block-svg' />
      </button>
    </CSActionBlock>
    <CSStarContent data-testid='cs-star-content-wrap'>
      <Glyph testid='cs-star-content-svg' />
    </CSStarContent>

    {/* AnalyticsDriverOrders */}
    <DOChartHeaderContainer data-testid='do-chart-header-container-wrap'>
      <p data-testid='do-chart-header-container-p'>Available times</p>
    </DOChartHeaderContainer>
    <DOChartFooterContainer data-testid='do-chart-footer-container-wrap'>
      <h2 data-testid='do-chart-footer-container-h2'>1.234</h2>
      <p data-testid='do-chart-footer-container-p'>Available times</p>
    </DOChartFooterContainer>
    <DOActionBlock data-testid='do-action-block-wrap'>
      <button type='button' aria-label='Expand' data-testid='do-expand-button'>
        <Glyph testid='do-action-block-svg' />
      </button>
      <button type='button' aria-label='Download CSV' data-testid='do-download-button'>
        <Glyph />
      </button>
    </DOActionBlock>

    {/* AnalyticsMap */}
    <MHeatMapToggleWrap data-testid='m-heat-map-toggle-wrap-root'>42</MHeatMapToggleWrap>

    {/* AnalyticsOrdersAcceptSpend */}
    <OASOrdersAcceptSpendHeader data-testid='oas-orders-accept-spend-header-wrap'>
      <p data-testid='oas-orders-accept-spend-header-p'>Available times</p>
    </OASOrdersAcceptSpendHeader>
    <OASReviewContentWrapper data-testid='oas-review-content-wrapper-wrap'>
      <p data-testid='oas-review-content-wrapper-p'>Available times</p>
    </OASReviewContentWrapper>
    <OASTimeContentWrapper data-testid='oas-time-content-wrapper-wrap'>
      <h1 data-testid='oas-time-content-wrapper-h1'>01:23:45</h1>
    </OASTimeContentWrapper>
    <OASReviewBlock data-testid='oas-review-block-wrap'>
      <Glyph testid='oas-review-block-svg' />
    </OASReviewBlock>

    {/* AnalyticsOrdersStatus */}
    <OSOrderStatusHeader data-testid='os-order-status-header-wrap'>
      <p data-testid='os-order-status-header-p'>Available times</p>
    </OSOrderStatusHeader>
    <OSOrderStatusFooter data-testid='os-order-status-footer-wrap'>
      <h2 data-testid='os-order-status-footer-h2'>1.234</h2>
      <p data-testid='os-order-status-footer-p'>Available times</p>
    </OSOrderStatusFooter>
    <OSActionBlock data-testid='os-action-block-wrap'>
      <button type='button' aria-label='Download CSV' data-testid='os-download-button'>
        <Glyph testid='os-action-block-svg' />
      </button>
    </OSActionBlock>

    {/* AnalyticsSpendList */}
    <SLAnalyticsSpendListHeader data-testid='sl-analytics-spend-list-header-wrap'>
      <p data-testid='sl-analytics-spend-list-header-p'>Available times</p>
    </SLAnalyticsSpendListHeader>
    <SLReviewContentWrapper data-testid='sl-review-content-wrapper-wrap'>
      <p data-testid='sl-review-content-wrapper-p'>Available times</p>
    </SLReviewContentWrapper>
    <SLTimeContentWrapper data-testid='sl-time-content-wrapper-wrap'>
      <h1 data-testid='sl-time-content-wrapper-h1'>01:23:45</h1>
    </SLTimeContentWrapper>
    <SLReviewBlock data-testid='sl-review-block-wrap'>
      <Glyph testid='sl-review-block-svg' />
    </SLReviewBlock>

    {/* AnalyticsSpendTimes */}
    <STChartHeaderContainer data-testid='st-chart-header-container-wrap'>
      <p data-testid='st-chart-header-container-p'>Available times</p>
    </STChartHeaderContainer>
    <STActionBlock data-testid='st-action-block-wrap'>
      <button type='button' aria-label='Expand' data-testid='st-expand-button'>
        <Glyph testid='st-action-block-svg' />
      </button>
      <button type='button' aria-label='Download CSV' data-testid='st-download-button'>
        <Glyph />
      </button>
    </STActionBlock>

    {/* AnalyticsTopOrders */}
    <TOAnalyticsTopOrdersHeader data-testid='to-analytics-top-orders-header-wrap'>
      <p data-testid='to-analytics-top-orders-header-p'>Available times</p>
    </TOAnalyticsTopOrdersHeader>
    <TOTopOrdersContent data-testid='to-top-orders-content-wrap'>
      <p data-testid='to-top-orders-content-p'>Available times</p>
    </TOTopOrdersContent>
    <TOPercentContainer data-testid='to-percent-container-root'>42</TOPercentContainer>
    <TOValueContainer data-testid='to-value-container-root'>42</TOValueContainer>
    <TOActionBlock data-testid='to-action-block-wrap'>
      <button type='button' aria-label='Download CSV' data-testid='to-download-button'>
        <Glyph testid='to-action-block-svg' />
      </button>
    </TOActionBlock>
  </div>
)
