import React from 'react'

import {
  CountLabel as BPIDCountLabel,
  DataTable as BPIDDataTable,
  DayTitle as BPIDDayTitle,
  DetailContainer as BPIDDetailContainer,
  DetailHeader as BPIDDetailHeader,
  DownloadButton as BPIDDownloadButton,
  ErrorWrapper as BPIDErrorWrapper,
  FeeAmount as BPIDFeeAmount,
  FeeGroup as BPIDFeeGroup,
  FeeName as BPIDFeeName,
  InvoiceFooter as BPIDInvoiceFooter,
  PeriodLabel as BPIDPeriodLabel,
  PeriodValue as BPIDPeriodValue,
  SectionTitle as BPIDSectionTitle,
  SummaryLabel as BPIDSummaryLabel,
  SummaryValue as BPIDSummaryValue,
  TotalsLabel as BPIDTotalsLabel,
  TotalsValue as BPIDTotalsValue,
  TransferRow as BPIDTransferRow
} from '../../../src/@/components-dashboard/src/ui/src/components/BusinessIntelligence/BusinessPaymentInvoiceDetail/styles'
import {
  BusinessNameWrapper as BPRBusinessNameWrapper,
  CalendarHint as BPRCalendarHint,
  CalendarSection as BPRCalendarSection,
  DownloadButton as BPRDownloadButton,
  EmptyState as BPREmptyState,
  HeaderContainer as BPRHeaderContainer,
  MethodSelectorWrapper as BPRMethodSelectorWrapper,
  MonthCard as BPRMonthCard,
  PaginationWrapper as BPRPaginationWrapper,
  PaymentHistorySection as BPRPaymentHistorySection,
  PeriodInfoText as BPRPeriodInfoText,
  TabButton as BPRTabButton,
  Table as BPRTable,
  ViewModeCard as BPRViewModeCard,
  YearSelector as BPRYearSelector
} from '../../../src/@/components-dashboard/src/ui/src/components/BusinessIntelligence/BusinessPaymentReports/styles'
import {
  ActionButton as ESRActionButton
} from '../../../src/@/components-dashboard/src/ui/src/components/BusinessIntelligence/EatStreetReportDetail/styles'
// Batch fixture for b3-invoices-pdf: the invoice, report and payment surfaces of
// BusinessIntelligence.
//
// It mounts the migrated STYLES, not the controllers, which is what keeps this batch
// inside section 5.1: nothing here opens a request, and in particular nothing posts a
// document to the PDF endpoint the two InvoicePdf rows use.
//
// The fixture is GENERATED from the ruleset by
// docs/brand-system-evidence/l6/tools/generate-batch-fixture.mjs (tag archive/redesign-evidence-2026-10-27), and `--check` refuses
// a fixture that is not what the ruleset derives today.
//
// What it deliberately does NOT mount, each for a reason the ruleset itself states:
// the printed-document sites it DOES mount (they are ordinary DOM and observable), the
// two `font-size: inherit` resets of this batch's conversions, which declare no size of
// their own, and the one JSX inline style, which no fixture can mount because it is not
// a rendered styled declaration at all.
//
// A note on the contexts: most of this batch's selectors are not element names --
// `th, td`, `> label`, `span.label`, `.select > div:first-child`. The generator refuses
// to invent a mount for a selector it does not understand, so each of those shapes is
// declared in fixture-config.json and read from the real styles.js rather than guessed.
const Glyph = ({ testid }) => (
  <svg data-testid={testid} viewBox='0 0 16 16' width='1em' height='1em'><circle cx='8' cy='8' r='7' /></svg>
)

export const InvoicesB3StylesFixture = () => (
  <div data-testid='invoices-b3-styles' style={{ padding: 24, display: 'grid', gap: 12 }}>
    {/* BusinessPaymentInvoiceDetail */}
    <BPIDDownloadButton data-testid='bpid-download-button-root'>42</BPIDDownloadButton>
    <BPIDErrorWrapper data-testid='bpid-error-wrapper-root'>42</BPIDErrorWrapper>
    <BPIDDetailContainer data-testid='bpid-detail-container-root'>42</BPIDDetailContainer>
    <BPIDDetailHeader data-testid='bpid-detail-header-wrap'>
      <h1 data-testid='bpid-detail-header-h1'>Payment reports</h1>
      <p data-testid='bpid-detail-header-p'>Syncing reports</p>
    </BPIDDetailHeader>
    <BPIDPeriodLabel data-testid='bpid-period-label-root'>42</BPIDPeriodLabel>
    <BPIDPeriodValue data-testid='bpid-period-value-root'>42</BPIDPeriodValue>
    <BPIDSummaryLabel data-testid='bpid-summary-label-root'>42</BPIDSummaryLabel>
    <BPIDSummaryValue data-testid='bpid-summary-value-root'>42</BPIDSummaryValue>
    <BPIDSectionTitle data-testid='bpid-section-title-root'>42</BPIDSectionTitle>
    <BPIDDayTitle data-testid='bpid-day-title-root'>42</BPIDDayTitle>
    <BPIDDataTable data-testid='bpid-data-table-root'>42</BPIDDataTable>
    <BPIDFeeGroup data-testid='bpid-fee-group-root'>42</BPIDFeeGroup>
    <BPIDFeeName data-testid='bpid-fee-name-root'>42</BPIDFeeName>
    <BPIDFeeAmount data-testid='bpid-fee-amount-root'>42</BPIDFeeAmount>
    <BPIDCountLabel data-testid='bpid-count-label-root'>42</BPIDCountLabel>
    <BPIDTotalsLabel data-testid='bpid-totals-label-root'>42</BPIDTotalsLabel>
    <BPIDTotalsValue data-testid='bpid-totals-value-root'>42</BPIDTotalsValue>
    <BPIDTransferRow data-testid='bpid-transfer-row-wrap'>
      <span data-testid='bpid-transfer-row-span'>2026</span>
    </BPIDTransferRow>
    <BPIDInvoiceFooter data-testid='bpid-invoice-footer-root'>42</BPIDInvoiceFooter>

    {/* BusinessPaymentReports */}
    <BPRHeaderContainer data-testid='bpr-header-container-wrap'>
      <h1 data-testid='bpr-header-container-h1'>Payment reports</h1>
    </BPRHeaderContainer>
    <BPRPaymentHistorySection data-testid='bpr-payment-history-section-wrap'>
      <h3 data-testid='bpr-payment-history-section-h3'>Payment history</h3>
      <p data-testid='bpr-payment-history-section-p'>Syncing reports</p>
    </BPRPaymentHistorySection>
    <BPRBusinessNameWrapper data-testid='bpr-business-name-wrapper-wrap'>
      <h1 data-testid='bpr-business-name-wrapper-h1'>Payment reports</h1>
      <h1><Glyph testid='bpr-business-name-wrapper-h1svg' /></h1>
    </BPRBusinessNameWrapper>
    <BPRTable data-testid='bpr-table-wrap'>
      <table><tbody><tr><td data-testid='bpr-table-thtd'>Acme Store</td></tr></tbody></table>
    </BPRTable>
    <BPREmptyState data-testid='bpr-empty-state-wrap'>
      <p data-testid='bpr-empty-state-p'>Syncing reports</p>
    </BPREmptyState>
    <BPRViewModeCard data-testid='bpr-view-mode-card-wrap'>
      <h3 data-testid='bpr-view-mode-card-h3'>Payment history</h3>
      <p data-testid='bpr-view-mode-card-p'>Syncing reports</p>
    </BPRViewModeCard>
    <BPRMethodSelectorWrapper data-testid='bpr-method-selector-wrapper-wrap'>
      <label data-testid='bpr-method-selector-wrapper-label'>Payment method</label>
      <div className='select' data-testid='bpr-method-selector-wrapper-select'>Card</div>
    </BPRMethodSelectorWrapper>
    <BPRCalendarSection data-testid='bpr-calendar-section-wrap'>
      <label data-testid='bpr-calendar-section-label'>Payment method</label>
    </BPRCalendarSection>
    <BPRYearSelector data-testid='bpr-year-selector-wrap'>
      <span data-testid='bpr-year-selector-span'>2026</span>
    </BPRYearSelector>
    <BPRMonthCard data-testid='bpr-month-card-root'>42</BPRMonthCard>
    <BPRPeriodInfoText data-testid='bpr-period-info-text-wrap'>
      <span className='label' data-testid='bpr-period-info-text-spanlabel'>PERIOD</span>
      <span className='dates' data-testid='bpr-period-info-text-spandates'>1 - 15 Sep</span>
    </BPRPeriodInfoText>
    <BPRDownloadButton data-testid='bpr-download-button-root'>42</BPRDownloadButton>
    <BPRCalendarHint data-testid='bpr-calendar-hint-root'>42</BPRCalendarHint>
    <BPRTabButton data-testid='bpr-tab-button-root'>42</BPRTabButton>
    <BPRPaginationWrapper data-testid='bpr-pagination-wrapper-wrap'>
      <span data-testid='bpr-pagination-wrapper-span'>2026</span>
    </BPRPaginationWrapper>

    {/* EatStreetReportDetail */}
    <ESRActionButton data-testid='esr-action-button-root'>42</ESRActionButton>
  </div>
)
