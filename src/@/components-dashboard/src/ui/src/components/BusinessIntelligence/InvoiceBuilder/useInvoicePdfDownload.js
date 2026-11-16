import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useTheme } from 'styled-components'

import { ToastType, useApi, useConfig, useLanguage, useSession, useToast } from '../../../../../index'
import { canCopyInvoicePdfHtml, useInvoicePdfLogo } from '../invoicePdfLogo'
import { downloadInvoicePdfFromHtml, requestInvoicePdf } from '../downloadInvoicePdf'

// redesign invoice FC2 (D3, D13; auditor 4): the download of `main` (`InvoiceBusinessManager` 37-71) in a hook, without changing
// `downloadInvoicePdf.js`. The file is made from the innerHTML of the hidden PDF node (`pdfRef`), never from the preview.
//
// - `canDownload` is the controller's (auditor 4): the last load that ended is the one of the form. With no invoice there is nothing to print.
// - The logo has to be resolved first (`logo.status !== 'loading'`), as in `main`.
// - A failure is a toast with a translated text; the raw message of the server («Invalid response format») never reaches the person.
//
// the batch has its own hidden node (`batchPdfRef`, painting `batchInvoice`). `makeBatchPdf` paints an invoice there at
// once (flushSync), takes its innerHTML and asks the PDF, so each file is made by the same component and the same request as the
// single download. Two in flight at once never share the node: painting and reading happen in the same synchronous step.
export const useInvoicePdfDownload = ({ invoice, canDownload }) => {
  const [, t] = useLanguage()
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()
  const [{ configs }] = useConfig()
  const theme = useTheme()
  const pdfRef = useRef(null)
  const running = useRef(false)
  const [downloading, setDownloading] = useState(false)
  const batchPdfRef = useRef(null)
  const [batchInvoice, setBatchInvoice] = useState(null)
  const logo = useInvoicePdfLogo(configs, theme?.images?.logos?.logoPdf)

  const canDownloadPdf = canCopyInvoicePdfHtml({ invoiceReady: Boolean(canDownload) && Boolean(invoice), logoStatus: logo.status })

  const download = async () => {
    if (!canDownloadPdf || running.current || !pdfRef.current) return
    running.current = true
    setDownloading(true)
    try {
      await downloadInvoicePdfFromHtml({
        html: pdfRef.current.innerHTML,
        logoSrc: logo.src,
        root: ordering.root,
        token
      })
    } catch {
      showToast(ToastType.Error, t('INVOICE_MANAGER_PDF_ERROR', 'The PDF could not be created. Try again.'))
    } finally {
      running.current = false
      setDownloading(false)
    }
  }

  const makeBatchPdf = async (invoice, party, signal) => {
    flushSync(() => setBatchInvoice(invoice))
    const html = batchPdfRef.current.innerHTML
    const { blob } = await requestInvoicePdf({ html, logoSrc: logo.src, root: ordering.root, token, signal })
    return { blob, filename: invoicePdfFilename(party, invoice) }
  }

  return { pdfRef, logo, downloading, canDownloadPdf, download, batchPdfRef, batchInvoice, makeBatchPdf }
}

// «José's Café», 7, September → invoice-joses-cafe-7-2026-09-01_2026-09-30.pdf: the id keeps two parties of the same name apart in the .zip
const slug = (text) => String(text ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export const invoicePeriodName = ({ from, to } = {}) => (from && to ? `${from}_${to}` : '')

export const invoicePdfFilename = (party, invoice) => {
  const period = invoicePeriodName(invoice)
  return `${['invoice', slug(party?.name), party?.id, period].filter(Boolean).join('-')}.pdf`
}
