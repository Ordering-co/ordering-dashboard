import React, { useEffect, useRef, useState } from 'react'

import { useLanguage } from '../../../../../index'
import { BusinessPaymentReports as BusinessPaymentReportsController } from '../../../../../components/BusinessPaymentReports'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { IconButton, PageHeader, SplitView, TabPanel, Tabs, useProductDir } from '../../Shared/Product'
import { Menu as MenuIcon } from '../../Shared/Icon'
import { settleFocusOn } from '../../../utils/listFocus'
import { StoreReports } from './StoreReports'
import { GeneralReport } from './GeneralReport'
import { InvoicePanel } from './InvoicePanel'
import { LegacyReportPanel } from './LegacyReportPanel'
import './business-payments.css'

// redesign business-payments FC2 (; D1, D5, D8): /intelligence/business-payment-reports, one page. The header (the menu button when the
// menu is collapsed, «Payment reports», what the page does), the two views as tabs (the two cards of `main`, one click as before), and beside
// them the document that is open, an invoice or a legacy EatStreet report, in the split view. The data and every request are the controller
// `BusinessPaymentReports` of `~components` (lote A); this file only mounts it and arranges what it gives. The store side is `StoreReports` (lote C1),
// the panels are `InvoicePanel` and `LegacyReportPanel` (lote D).

const VIEW_BUSINESS = 'business'
const VIEW_GENERAL = 'general'

// an id that came from the controller or from the URL (a number or a string); `null` and '' are no document
const has = (id) => id != null && id !== ''

export const BusinessPaymentReportsUI = (props) => {
  // redesign business-payments integration: named, never spread (the l6-b3 guard of this file reads every spread as a colour it cannot resolve)
  const { view, setView, business, plugin, invoices, history, legacy, detail, legacyDetail, methods, method, selectMethod, periods, report } = props
  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const dir = useProductDir()
  const [expanded, setExpanded] = useState(false)
  const listRef = useRef(null)

  // redesign business-payments FC2 (D8): one panel at a time. The invoice wins when the URL brought both.
  const invoiceId = detail?.invoiceId
  const reportId = legacyDetail?.reportId
  const panelKind = has(invoiceId) ? 'invoice' : has(reportId) ? 'legacy' : null
  const panelOpen = panelKind !== null

  // «expanded» is local and ends with the panel: the next document opens beside the list, as it always did
  useEffect(() => {
    if (!panelOpen) setExpanded(false)
  }, [panelOpen])

  // redesign business-payments FC2 (D8): both ids in the URL (`?invoice_id=` and `?ext_report_id=`) is a state `main` allowed, with two layers one over
  // the other; here the invoice is the panel and the report is closed, so what the URL says is what the page shows
  useEffect(() => {
    if (panelKind === 'invoice' && has(reportId)) legacyDetail.close()
  }, [panelKind, reportId])

  // redesign a panel opened from the URL has no opener (the split view returns the focus to the row that opened it), so the focus
  // fell to <body> when it closed. Once the panel is gone, if the focus is still nowhere it goes to the row of that document, else to the table.
  // A focus the split view already returned, or anything the person put in the list, is left alone. Watching the panel (not the click) also
  // covers Escape, «Close» and «Back», and never moves the focus while a close is refused.
  const lastDocument = useRef(null)
  if (panelOpen) lastDocument.current = panelKind === 'invoice' ? invoiceId : reportId
  const wasOpen = useRef(false)
  useEffect(() => {
    if (wasOpen.current && !panelOpen) settleFocusOn(() => listRef.current, lastDocument.current)
    wasOpen.current = panelOpen
  }, [panelOpen])

  const closePanel = () => {
    setExpanded(false)
    if (panelKind === 'invoice') detail.close()
    else if (panelKind === 'legacy') legacyDetail.close()
  }

  // redesign business-payments FC2 (D8): the store side opens a document through these. Opening one closes the other first (never the reverse:
  // the controller takes only the parameter of the one it closes, so `business_id` stays, )
  const storeDetail = { ...detail, open: (id) => { if (has(reportId)) legacyDetail.close(); detail.open(id) } }
  const storeLegacyDetail = { ...legacyDetail, open: (id) => { if (has(invoiceId)) detail.close(); legacyDetail.open(id) } }

  const panelLabel = panelKind === 'invoice'
    ? t('BUSINESS_PAYMENTS_INVOICE_NUMBER', 'Invoice #_id_').replace('_id_', invoiceId)
    : panelKind === 'legacy' ? t('LEGACY_REPORTS', 'Legacy Reports') : ''

  const list = (
    <div ref={listRef} className='odc-root odc-bpr-page' data-slot='business-payments-page' dir={dir}>
      <PageHeader
        leading={isCollapse && (
          <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)} />
        )}
        title={t('PAYMENT_REPORTS', 'Payment reports')}
        description={t('BUSINESS_PAYMENTS_DESCRIPTION', 'What each store is paid per billing period, and the payout files.')}
      />
      <Tabs
        label={t('BUSINESS_PAYMENTS_VIEW', 'View')}
        value={view}
        onValueChange={setView}
        items={[
          { value: VIEW_BUSINESS, label: t('REPORTS_BY_BUSINESS', 'Reports by business') },
          { value: VIEW_GENERAL, label: t('GENERAL_REPORT', 'General report') }
        ]}
      >
        <TabPanel value={VIEW_BUSINESS} className='odc-bpr-view'>
          <p className='odc-bpr-view-desc'>{t('REPORTS_BY_BUSINESS_DESC', 'View invoices per business')}</p>
          <StoreReports
            business={business}
            plugin={plugin}
            invoices={invoices}
            history={history}
            legacy={legacy}
            detail={storeDetail}
            legacyDetail={storeLegacyDetail}
            panelOpen={panelOpen}
          />
        </TabPanel>
        <TabPanel value={VIEW_GENERAL} className='odc-bpr-view'>
          <p className='odc-bpr-view-desc'>{t('GENERAL_REPORT_DESC', 'Download report for all businesses')}</p>
          <GeneralReport methods={methods} method={method} selectMethod={selectMethod} periods={periods} report={report} />
        </TabPanel>
      </Tabs>
    </div>
  )

  const panel = panelKind === 'invoice'
    ? <InvoicePanel key={invoiceId} invoiceId={invoiceId} onClose={closePanel} expanded={expanded} onExpandedChange={setExpanded} />
    : panelKind === 'legacy'
      ? <LegacyReportPanel key={reportId} reportId={reportId} onClose={closePanel} expanded={expanded} onExpandedChange={setExpanded} />
      : null

  return (
    <SplitView
      className='odc-bpr-split'
      list={list}
      panel={panel}
      open={panelOpen}
      expanded={expanded}
      panelLabel={panelLabel}
      resizeLabel={t('BUSINESS_PAYMENTS_RESIZE_PANEL', 'Resize the panel')}
      storageKey='od.business-payments.panel'
      onClose={closePanel}
    />
  )
}

// The page of `main` was one big component that fetched and drew. Now the controller fetches and this file draws: same name, same export, so
// `BusinessIntelligence/index.js`, `~ui` and the page `src/pages/BusinessPaymentReports` do not change. The page passes no props, and `main`
// read none: nothing is forwarded.
export const BusinessPaymentReports = () => (
  <BusinessPaymentReportsController UIComponent={BusinessPaymentReportsUI} />
)
