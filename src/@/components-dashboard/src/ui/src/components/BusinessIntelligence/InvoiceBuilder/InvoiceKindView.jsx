import React, { useState } from 'react'

import { useLanguage, useUtils } from '../../../../../index'
import { Button } from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { Download } from '../../Shared/Icon'
import { fillTemplate, figure } from '../AnalyticsKit/reportPillParts'
import { InvoiceBusinessPdf } from '../InvoiceBusinessPdf'
import { InvoiceDriverPdf } from '../InvoiceDriverPdf'
import { InvoiceBatchDialog } from './InvoiceBatchDialog'
import { InvoiceForm } from './InvoiceForm'
import { InvoicePreview } from './InvoicePreview'
import { useInvoicePdfDownload } from './useInvoicePdfDownload'
import './invoice-builder.css'

// redesign invoice FC2 (D1, D3, D4; IV-01, IV-02): the UIComponent of `InvoiceBuilder` (the controller of lote A) for one kind of invoice.
// Two columns from 1024 (the form of C1 · the preview), one below, with the dock on the phone. It also holds the hidden PDF: the source of the file
// (D3). That node has no class and no style of the brand: `invoicePdfTypographyBoundary.test.js` forbids `var(--od-*)` in the PDF.

/** The dock of the phone: the total due and the count, and the button, at the bottom of the page. */
const InvoiceDock = ({ invoice, orders, updating, download }) => {
  const [, t] = useLanguage()
  const [{ parsePrice }] = useUtils()
  const count = invoice?.orders?.length ?? 0
  const waiting = updating || (!invoice && orders?.status === 'loading')

  return (
    <div className='odc-iv-dock' data-dock='' role='region' aria-label={t('INVOICE_MANAGER_DOCK', 'Invoice total')}>
      <div className='odc-iv-dock-info'>
        {invoice && (
          <>
            <span className='odc-iv-dock-total'>{figure(parsePrice(invoice.total))}</span>
            <span className='odc-iv-dock-caption'>
              {t('INVOICE_MANAGER_TOTAL_DUE', 'Total due')} · {count === 1
                ? fillTemplate(t('INVOICE_MANAGER_DOCK_ORDERS_ONE', '_count_ order'), { count }, figure)
                : fillTemplate(t('INVOICE_MANAGER_DOCK_ORDERS_OTHER', '_count_ orders'), { count }, figure)}
            </span>
          </>
        )}
      </div>
      <div className='odc-iv-dock-action'>
        <Button variant='primary' icon={Download} disabled={download.disabled} busy={download.busy} onClick={download.onClick}>
          {t('INVOICE_MANAGER_DOWNLOAD_PDF', 'Download PDF')}
        </Button>
        {waiting && <span className='odc-iv-updating' role='status'>{t('INVOICE_MANAGER_UPDATING', 'Updating…')}</span>}
      </div>
    </div>
  )
}

export const InvoiceKindView = (props) => {
  const { kind, party, orders, invoice, updating, canDownload, getSubtotal, getTotal, batch } = props
  const isPhone = useIsPhone()
  const { pdfRef, logo, downloading, canDownloadPdf, download, batchPdfRef, batchInvoice, makeBatchPdf } = useInvoicePdfDownload({ invoice, canDownload })
  const [batchOpen, setBatchOpen] = useState(false)
  const Pdf = kind === 'driver' ? InvoiceDriverPdf : InvoiceBusinessPdf
  const downloadState = { onClick: download, disabled: !canDownloadPdf, busy: downloading }
  const dock = isPhone && Boolean(party?.selected)

  return (
    <div className='odc-iv-kind' data-kind={kind}>
      <div className='odc-iv-columns'>
        <div className='odc-iv-form' data-slot='invoice-form'>
          <InvoiceForm {...props} onBatch={batch ? () => setBatchOpen(true) : undefined} />
        </div>
        <InvoicePreview {...props} download={isPhone ? null : downloadState} />
      </div>
      {dock && <InvoiceDock invoice={invoice} orders={orders} updating={updating} download={downloadState} />}
      {/* redesign invoice FC2 (D3): the source of the PDF. Hidden, with no class and no style of the brand; `downloadInvoicePdfFromHtml` gets its innerHTML */}
      <div hidden ref={pdfRef} data-pdf-source=''>
        {invoice && <Pdf exportInvoiceList={{ invoice }} getSubtotal={getSubtotal} getTotal={getTotal} logoSrc={logo.src} />}
      </div>
      {/* the source of each PDF of a batch, the same component painted with the invoice of that party */}
      <div hidden ref={batchPdfRef} data-pdf-batch-source=''>
        {batchInvoice && <Pdf exportInvoiceList={{ invoice: batchInvoice }} getSubtotal={getSubtotal} getTotal={getTotal} logoSrc={logo.src} />}
      </div>
      {batch && (
        <InvoiceBatchDialog
          open={batchOpen}
          onOpenChange={setBatchOpen}
          kind={kind}
          party={party}
          batch={batch}
          makePdf={makeBatchPdf}
          pdfReady={logo.status !== 'loading'}
        />
      )}
    </div>
  )
}
