import React, { useEffect, useRef, useState } from 'react'

import { orderingAssets } from '../../../src/brand/assets'
import { getDashboardLogoUrl } from '../../../src/utils/dashboardBranding'
import { LanguageContext } from '../../../src/@/components-dashboard/src/contexts/LanguageContext'
import { UtilsContext } from '../../../src/@/components-dashboard/src/contexts/UtilsContext'
import { ConfigFileContext } from '../../../src/@/components-dashboard/src/ui/src/contexts/ConfigFileContext'
import { InvoiceBusinessPdf } from '../../../src/@/components-dashboard/src/ui/src/components/BusinessIntelligence/InvoiceBusinessPdf'
import { InvoiceDriverPdf } from '../../../src/@/components-dashboard/src/ui/src/components/BusinessIntelligence/InvoiceDriverPdf'
import { resolveInvoiceLogoSrc } from '../../../src/@/components-dashboard/src/ui/src/components/BusinessIntelligence/invoicePdfLogo'
import { buildInvoicePdfHtml, downloadInvoicePdfFromHtml } from '../../../src/@/components-dashboard/src/ui/src/components/BusinessIntelligence/downloadInvoicePdf'

const order = { id: 7001, delivery_datetime: '2026-09-15T12:30:00Z', status: 1, subtotal: 18, total: 21 }
const totals = {
  orders: [order],
  from: '2026-09-01',
  to: '2026-09-15',
  orders_subtotal: 18,
  orders_total: 21,
  discounts: 1,
  percentage_fee: 5,
  percentage_fee_total: 1,
  fixed_fee_total: 2,
  percentage_delivery_price_total: 0,
  percentage_driver_tip_total: 0,
  misc_description: 'Fixture adjustment',
  misc_amount: 1,
  subtotal: 20,
  tax: 5,
  tax_total: 1,
  total: 21,
  notes: '<strong>Fixture note</strong>'
}
const businessInvoice = { loading: false, invoice: { ...totals, business: { name: 'Fixture Business' } } }
const driverInvoice = { loading: false, invoice: { ...totals, driver: { name: 'Fixture Driver' } } }
const parsePrice = value => `$${Number(value || 0).toFixed(2)}`
const parseDate = value => `DATE:${value}`
const t = (key, fallback) => fallback || key

export const IdentityPdfFixture = () => {
  const [logo, setLogo] = useState({ status: 'loading', src: null })
  const [capture, setCapture] = useState(null)
  const businessRef = useRef(null)
  const driverRef = useRef(null)

  useEffect(() => {
    let active = true
    resolveInvoiceLogoSrc(getDashboardLogoUrl({}, orderingAssets.logos.print, 'dashboard.ordering.co')).then(result => active && setLogo(result))
    return () => { active = false }
  }, [])

  const captureRequest = async () => {
    const requests = []
    await downloadInvoicePdfFromHtml({
      html: businessRef.current.innerHTML,
      logoSrc: logo.src,
      root: '/fixture-api',
      token: 'fixture-token',
      fetchFn: async (url, options) => {
        requests.push({ url, options })
        return new Response(new Blob(['fixture pdf'], { type: 'application/pdf' }), {
          status: 200,
          headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="fixture.pdf"' }
        })
      },
      saveBlob: (blob, filename) => setCapture({ request: requests[0], filename, blobType: blob.type })
    })
  }

  const providers = content => (
    <LanguageContext.Provider value={[{ dictionary: {} }, t]}>
      <UtilsContext.Provider value={[{ parseDate, parsePrice }]}>
        <ConfigFileContext.Provider value={[{ app_internal_name: 'ordering' }, () => {}]}>
          {content}
        </ConfigFileContext.Provider>
      </UtilsContext.Provider>
    </LanguageContext.Provider>
  )

  const exactHtml = logo.src && businessRef.current
    ? buildInvoicePdfHtml({ bodyHtml: businessRef.current.innerHTML, logoSrc: logo.src })
    : ''

  return (
    <main data-testid='identity-pdf-fixture'>
      <h1>Ordering.co PDF identity pipeline</h1>
      <output data-testid='logo-status'>{logo.status}</output>
      <output data-testid='logo-prefix'>{logo.src?.slice(0, 30) || ''}</output>
      <section aria-label='Business invoice renderer' ref={businessRef}>
        {providers(<InvoiceBusinessPdf exportInvoiceList={businessInvoice} getSubtotal={item => item.subtotal} getTotal={item => item.total} logoSrc={logo.src} />)}
      </section>
      <section aria-label='Driver invoice renderer' ref={driverRef}>
        {providers(<InvoiceDriverPdf exportInvoiceList={driverInvoice} getSubtotal={item => item.subtotal} getTotal={item => item.total} logoSrc={logo.src} />)}
      </section>
      <textarea data-testid='exact-pdf-html' readOnly value={exactHtml} />
      <textarea data-testid='exact-driver-pdf-html' readOnly value={logo.src && driverRef.current ? buildInvoicePdfHtml({ bodyHtml: driverRef.current.innerHTML, logoSrc: logo.src }) : ''} />
      <button type='button' disabled={logo.status !== 'ready'} onClick={captureRequest}>Capture PDF request</button>
      <output data-testid='pdf-request-capture'>{JSON.stringify(capture)}</output>
    </main>
  )
}
